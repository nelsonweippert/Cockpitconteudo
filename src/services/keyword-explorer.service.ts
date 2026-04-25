// Keyword Explorer — pesquisa de palavras-chave pra otimização SEO de vídeo.
//
// 3 fontes:
// 1. YouTube Autocomplete — endpoint público (suggestqueries.google.com)
//    Retorna 10 sugestões reais que pessoas estão buscando agora.
// 2. Google Trends — endpoint não-oficial (trends.google.com/trends/api/explore)
//    Retorna interesse relativo no tempo (0-100) por termo.
// 3. YouTube Data API search — pra contar competidores (top vídeos que ranqueiam)
//
// O "volume" do VidIQ é proprietário; aqui usamos um ÍNDICE PROXY:
//   volume_index = max(autocomplete_position_inverso, trends_avg_12m)
// Não é absoluto — é comparativo entre keywords.

const SUGGEST_BASE = "https://suggestqueries.google.com/complete/search"
const TRENDS_BASE = "https://trends.google.com/trends/api"

export type KeywordExplorerResult = {
  query: string
  // Índices 0-100 (proxies, não absolutos)
  volumeIndex: number
  competition: number
  // Tendência 12 meses (12 valores 0-100)
  trends12m: number[]
  // Sugestões relacionadas (do autocomplete)
  related: string[]
  // Top vídeos que competem pelo termo (se YT API disponível)
  topVideos: Array<{
    videoId: string
    title: string
    channelTitle: string
    publishedAt: string
    thumbnailUrl: string | null
  }>
  // Diagnóstico textual derivado
  insight: {
    label: string  // "Boa janela", "Concorrido", "Demanda em queda", etc.
    tone: "good" | "warn" | "neutral"
  }
}

// ─── 1. YouTube Autocomplete ───────────────────────────────────────────

export async function fetchYouTubeAutocomplete(query: string): Promise<string[]> {
  // Endpoint retorna JSONP-like: window.google.ac.h([...])
  const params = new URLSearchParams({
    client: "youtube",
    ds: "yt",
    q: query,
    hl: "pt-BR",
  })
  try {
    const res = await fetch(`${SUGGEST_BASE}?${params.toString()}`, {
      headers: { Accept: "*/*" },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return []
    const text = await res.text()
    // Parse: window.google.ac.h(["q",[["sug1",..],["sug2",..]],...]) — extrai array
    // Acha o primeiro [ e o último ] pra evitar precisar do flag /s
    const firstBracket = text.indexOf("[")
    const lastBracket = text.lastIndexOf("]")
    if (firstBracket === -1 || lastBracket === -1 || lastBracket <= firstBracket) return []
    try {
      const parsed = JSON.parse(text.slice(firstBracket, lastBracket + 1)) as unknown[]
      if (parsed.length >= 2 && Array.isArray(parsed[1])) {
        const list = parsed[1] as unknown[][]
        return list.map((row) => (Array.isArray(row) && typeof row[0] === "string" ? row[0] : "")).filter(Boolean)
      }
    } catch { /* fallback empty */ }
    return []
  } catch (err) {
    console.warn("[keyword/autocomplete]", err instanceof Error ? err.message : err)
    return []
  }
}

// ─── 2. Google Trends ──────────────────────────────────────────────────

export async function fetchTrendsInterestOverTime(query: string): Promise<number[]> {
  // Google Trends tem fluxo de 2 etapas:
  // 1. /api/explore retorna widgets com tokens
  // 2. /api/widgetdata/multiline com o token retorna a série temporal
  //
  // Endpoint público mas instável; envolve parsing de JSONP-like (")]}',\n").
  // Implementação simplificada — em caso de falha, retorna array vazio.

  try {
    // Etapa 1: explore
    const exploreParams = new URLSearchParams({
      hl: "pt-BR",
      tz: "180",
      req: JSON.stringify({
        comparisonItem: [{ keyword: query, geo: "", time: "today 12-m" }],
        category: 0,
        property: "",
      }),
    })
    const exploreRes = await fetch(`${TRENDS_BASE}/explore?${exploreParams.toString()}`, {
      headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(8000),
    })
    if (!exploreRes.ok) return []
    const exploreText = await exploreRes.text()
    const exploreJson = JSON.parse(exploreText.replace(/^[)\]}']*\s*/, "")) as {
      widgets?: Array<{ id: string; token: string; request: unknown }>
    }
    const widget = exploreJson.widgets?.find((w) => w.id === "TIMESERIES")
    if (!widget) return []

    // Etapa 2: multiline
    const dataParams = new URLSearchParams({
      hl: "pt-BR",
      tz: "180",
      token: widget.token,
      req: JSON.stringify(widget.request),
    })
    const dataRes = await fetch(`${TRENDS_BASE}/widgetdata/multiline?${dataParams.toString()}`, {
      headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(8000),
    })
    if (!dataRes.ok) return []
    const dataText = await dataRes.text()
    const dataJson = JSON.parse(dataText.replace(/^[)\]}']*\s*/, "")) as {
      default?: { timelineData?: Array<{ value?: number[] }> }
    }
    const timeline = dataJson.default?.timelineData ?? []
    // Sample pra 12 valores (1 por mês)
    const values = timeline.map((t) => t.value?.[0] ?? 0).filter((v) => v >= 0 && v <= 100)
    return sampleSeries(values, 12)
  } catch (err) {
    console.warn("[keyword/trends]", err instanceof Error ? err.message : err)
    return []
  }
}

// Reduz uma série (e.g. 52 semanas → 12 valores). Simples média por bucket.
function sampleSeries(values: number[], targetLen: number): number[] {
  if (values.length === 0) return []
  if (values.length <= targetLen) return values
  const bucketSize = values.length / targetLen
  const result: number[] = []
  for (let i = 0; i < targetLen; i++) {
    const start = Math.floor(i * bucketSize)
    const end = Math.floor((i + 1) * bucketSize)
    const slice = values.slice(start, end)
    const avg = slice.reduce((s, v) => s + v, 0) / Math.max(1, slice.length)
    result.push(Math.round(avg))
  }
  return result
}

// ─── 3. Top vídeos (YouTube Data API) ──────────────────────────────────

async function fetchTopVideos(query: string): Promise<KeywordExplorerResult["topVideos"]> {
  const apiKey = process.env.YOUTUBE_API_KEY
  if (!apiKey) return []
  try {
    const params = new URLSearchParams({
      key: apiKey,
      q: query,
      part: "snippet",
      type: "video",
      maxResults: "10",
      order: "relevance",
      regionCode: "BR",
      relevanceLanguage: "pt",
    })
    const res = await fetch(`https://www.googleapis.com/youtube/v3/search?${params.toString()}`, {
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) return []
    const body = (await res.json()) as {
      items?: Array<{
        id: { videoId: string }
        snippet: { title: string; channelTitle: string; publishedAt: string; thumbnails?: { medium?: { url: string } } }
      }>
    }
    return (body.items ?? []).map((it) => ({
      videoId: it.id.videoId,
      title: it.snippet.title,
      channelTitle: it.snippet.channelTitle,
      publishedAt: it.snippet.publishedAt,
      thumbnailUrl: it.snippet.thumbnails?.medium?.url ?? null,
    }))
  } catch (err) {
    console.warn("[keyword/topVideos]", err instanceof Error ? err.message : err)
    return []
  }
}

// ─── Heurísticas de score ───────────────────────────────────────────────

// Volume index: usa pico do trends (12m) como proxy
function computeVolumeIndex(trends12m: number[]): number {
  if (trends12m.length === 0) return 50 // sem dados → neutro
  const max = Math.max(...trends12m)
  const avg = trends12m.reduce((s, v) => s + v, 0) / trends12m.length
  // Mistura pico (peso 0.6) e média (peso 0.4) — pico mostra hype, média mostra base
  return Math.round(max * 0.6 + avg * 0.4)
}

// Competição: derivado do nº de vídeos competindo (proxy via topVideos.length).
// Como YT search retorna no máx 10, esse é coarse mas serve como sinal.
function computeCompetition(topVideos: number, autocompleteLen: number): number {
  // Mais sugestões no autocomplete = termo mais usado = maior competição
  // 10 vídeos rapidamente retornados = alta competição
  const fromVideos = Math.min(100, topVideos * 8)            // 10 vídeos = 80
  const fromSuggest = Math.min(100, autocompleteLen * 8)     // 10 sugestões = 80
  return Math.round(fromVideos * 0.7 + fromSuggest * 0.3)
}

function deriveInsight(volume: number, competition: number, trends12m: number[]): KeywordExplorerResult["insight"] {
  // Tendência: comparar últimos 3m vs 3m anteriores
  const isDownward = trends12m.length >= 6
    ? trends12m.slice(-3).reduce((s, v) => s + v, 0) < trends12m.slice(-6, -3).reduce((s, v) => s + v, 0) * 0.85
    : false

  if (volume >= 70 && competition <= 50) {
    return { label: "Janela aberta — alta demanda, baixa concorrência", tone: "good" }
  }
  if (volume >= 50 && competition <= 40) {
    return { label: "Boa oportunidade — demanda decente sem saturar", tone: "good" }
  }
  if (competition >= 80) {
    return { label: "Muito concorrido — diferenciação será difícil", tone: "warn" }
  }
  if (volume <= 30) {
    return { label: "Baixa demanda — público pequeno", tone: "warn" }
  }
  if (isDownward) {
    return { label: "Demanda em queda — janela está fechando", tone: "warn" }
  }
  return { label: "Mercado padrão — balanceado", tone: "neutral" }
}

// ─── Função principal ─────────────────────────────────────────────────

export async function exploreKeyword(query: string): Promise<KeywordExplorerResult> {
  const cleanQuery = query.trim()
  if (!cleanQuery) throw new Error("Query vazia")

  // Roda em paralelo
  const [related, trends12m, topVideos] = await Promise.all([
    fetchYouTubeAutocomplete(cleanQuery),
    fetchTrendsInterestOverTime(cleanQuery),
    fetchTopVideos(cleanQuery),
  ])

  const volumeIndex = computeVolumeIndex(trends12m)
  const competition = computeCompetition(topVideos.length, related.length)
  const insight = deriveInsight(volumeIndex, competition, trends12m)

  return {
    query: cleanQuery,
    volumeIndex,
    competition,
    trends12m,
    related,
    topVideos,
    insight,
  }
}
