// Hacker News client — busca por keyword na Algolia API (oficial da HN).
// https://hn.algolia.com/api
//
// Endpoint principal: https://hn.algolia.com/api/v1/search_by_date
// Parâmetros úteis: query=X, tags=story, numericFilters=created_at_i>TIMESTAMP,points>N
//
// HN é fundamental: lançamentos, papers, discussão técnica aparecem aqui antes
// do TechCrunch/The Verge. Alta densidade de sinal por operador (devs e founders
// engajados nos comments).

const ALGOLIA_BASE = "https://hn.algolia.com/api/v1"

export type HNStory = {
  objectID: string
  title: string
  url: string | null               // Ask HN / Show HN sem URL externa caem pra hn.com/item
  author: string
  points: number
  num_comments: number
  created_at: string               // ISO
  created_at_i: number             // unix
  // Campos do Algolia
  _tags: string[]
  _highlightResult?: unknown
}

// Busca por keyword, retorna stories ordenadas por data (mais recente primeiro).
// `hoursWindow` limita janela temporal; `minPoints` filtra baixa relevância.
export async function searchHackerNews(opts: {
  query: string
  hoursWindow?: number
  minPoints?: number
  limit?: number
}): Promise<HNStory[]> {
  const { query, hoursWindow = 72, minPoints = 10, limit = 20 } = opts

  const now = Math.floor(Date.now() / 1000)
  const since = now - hoursWindow * 3600

  const params = new URLSearchParams({
    query,
    tags: "story",
    numericFilters: `created_at_i>${since},points>=${minPoints}`,
    hitsPerPage: String(Math.min(limit, 50)),
  })

  const url = `${ALGOLIA_BASE}/search_by_date?${params.toString()}`
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "CockpitConteudo/1.0 (content discovery)" },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) {
      console.warn(`[hn] HTTP ${res.status} pra query "${query}"`)
      return []
    }
    const body = (await res.json()) as { hits?: HNStory[] }
    const hits = Array.isArray(body.hits) ? body.hits : []

    // Fallback pra Ask/Show HN sem URL externa — aponta pra discussão no HN
    return hits.map((h) => ({
      ...h,
      url: h.url || `https://news.ycombinator.com/item?id=${h.objectID}`,
    }))
  } catch (err) {
    console.warn(`[hn] search falhou pra "${query}":`, err instanceof Error ? err.message : err)
    return []
  }
}

// Normaliza uma HNStory pro shape de candidate do pipeline (igual saída de web_search).
export function hnStoryToCandidate(s: HNStory, term: string): {
  term: string
  url: string
  title: string
  snippet: string
  publisher: string
  publishedAt?: string | null
  locale: "pt-BR" | "en-US" | "other"
  // Metadados extras pro digest saber que é sinal upstream
  sourceOrigin: "hn"
  upstreamScore: number  // 0-100, baseado em points+comments
} {
  const upstreamScore = Math.min(100, Math.round(s.points * 0.5 + s.num_comments * 0.3))
  const snippet = `${s.points} pts · ${s.num_comments} comments no HN · por ${s.author}`

  // Identifica se é publisher externo ou discussão nativa do HN
  const publisher = s.url && !s.url.includes("news.ycombinator.com")
    ? new URL(s.url).hostname.replace(/^www\./, "")
    : "Hacker News"

  return {
    term,
    url: s.url!,
    title: s.title,
    snippet,
    publisher,
    publishedAt: s.created_at,
    locale: "en-US", // HN é majoritariamente inglês
    sourceOrigin: "hn",
    upstreamScore,
  }
}
