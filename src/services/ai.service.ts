import Anthropic from "@anthropic-ai/sdk"
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod"
import { z } from "zod"
import { db } from "@/lib/db"
import { Prisma } from "@/generated/prisma/client"

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// ── Model registry + pricing (USD per token) ───────────────────────────
const MODELS = {
  "claude-opus-4-7":   { input: 5 / 1_000_000,  output: 25 / 1_000_000 },
  "claude-opus-4-6":   { input: 5 / 1_000_000,  output: 25 / 1_000_000 },
  "claude-sonnet-4-6": { input: 3 / 1_000_000,  output: 15 / 1_000_000 },
  "claude-haiku-4-5":  { input: 1 / 1_000_000,  output: 5 / 1_000_000 },
} as const
type ModelId = keyof typeof MODELS

// Mix de modelos por fase: Haiku pra classificação/extração (80% dos tokens), Sonnet só pra narrativa.
// Override via env pra teste.
const DISCOVERY_MODEL: ModelId = (process.env.DISCOVERY_MODEL as ModelId) || "claude-haiku-4-5"
const TRIAGE_MODEL: ModelId = (process.env.TRIAGE_MODEL as ModelId) || "claude-haiku-4-5"
const DEEP_MODEL: ModelId = (process.env.DEEP_MODEL as ModelId) || "claude-haiku-4-5"
const NARRATIVE_MODEL: ModelId = (process.env.NARRATIVE_MODEL as ModelId) || "claude-sonnet-4-6"
// Retrocompat: código antigo que usa IDEAS_MODEL continua funcionando (narrative é o "coração").
const IDEAS_MODEL: ModelId = NARRATIVE_MODEL
const REVIEW_MODEL: ModelId = "claude-sonnet-4-6"

export async function generateContentSuggestion(systemPrompt: string, userPrompt: string): Promise<string> {
  const start = Date.now()
  const message = await anthropic.messages.create({
    model: REVIEW_MODEL,
    max_tokens: 2048,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  })
  const durationMs = Date.now() - start
  const content = message.content[0]
  if (content.type !== "text") return "Erro ao gerar sugestão."

  trackUsage(REVIEW_MODEL, "content_suggestion", message.usage.input_tokens, message.usage.output_tokens, durationMs).catch(() => {})
  return content.text
}


// ═══════════════════════════════════════════════════════════════════════
// IDEAS PIPELINE — 4 stages:
//   Stage 1 (node):    discovery via Google News RSS
//   Stage 2 (Claude):  triage — lê cada candidato via web_fetch, classifica
//   Stage 3 (Claude):  deep research — busca fontes de apoio (triangulação)
//   Stage 4 (Claude):  narrative — constrói ideias sobre os grupos
// ═══════════════════════════════════════════════════════════════════════

import { discoverCandidates, resolveGoogleNewsUrls, titleKey, type FeedItem } from "./news-feed.service"

const BLOCKED_DOMAINS = [
  "pinterest.com", "pinterest.com.br",
  "quora.com",
  "reclameaqui.com.br",
  "yahoo.com",
]

// Domínios que são redirecionadores/agregadores, NÃO publishers reais.
// URLs com esses domínios NUNCA devem chegar ao usuário como "fonte".
const REDIRECT_DOMAINS = [
  "news.google.com",
  "google.com/url",
  "bing.com/news",
  "duckduckgo.com",
  "t.co",
  "bit.ly",
  "lnkd.in",
]

// Hosts que bloqueiam o user-agent do Claude (anthropic-web-search). Quando vem
// em allowed_domains, a API devolve 400. Mantemos uma lista seed + vamos
// persistindo conforme a API nos informar. Pré-filtro evita ida à API.
const ANTHROPIC_BLOCKED_HOSTS = new Set<string>([
  "theverge.com",
  "wired.com",
])

// Parse do erro 400 da API: extrai hosts listados em "['x.com', 'y.com']".
function parseBlockedDomains(errMsg: string): string[] {
  const m = errMsg.match(/not accessible to our user agent:\s*\[([^\]]+)\]/i)
  if (!m) return []
  return m[1]
    .split(",")
    .map((s) => s.trim().replace(/^['"]|['"]$/g, ""))
    .filter(Boolean)
}

// Persiste hosts bloqueados em todas as MonitorTerms do user que usavam eles.
// Desativa automaticamente (isActive=false) e marca anthropicBlocked=true.
async function persistBlockedHosts(userId: string, hosts: string[]): Promise<void> {
  try {
    const terms = await db.monitorTerm.findMany({
      where: { userId },
      select: { id: true, sources: true },
    })
    const hostSet = new Set(hosts)
    for (const t of terms) {
      const arr = Array.isArray(t.sources) ? (t.sources as unknown as Record<string, unknown>[]) : []
      let dirty = false
      for (const s of arr) {
        if (s && typeof s === "object" && typeof s.host === "string" && hostSet.has(s.host as string)) {
          s.anthropicBlocked = true
          s.isActive = false
          dirty = true
        }
      }
      if (dirty) {
        await db.monitorTerm.update({
          where: { id: t.id },
          data: { sources: arr as unknown as Prisma.InputJsonValue },
        })
      }
    }
    // Adiciona em memória (próximos runs no mesmo processo já pré-filtram)
    for (const h of hosts) ANTHROPIC_BLOCKED_HOSTS.add(h)
  } catch (err) {
    console.error("[persistBlockedHosts]", err)
  }
}

// Parse string de data → Date válido ou null. Claude às vezes retorna "recently",
// "", "N/A", etc. `new Date(x)` nessas retorna Invalid Date que depois explode em
// `.toISOString()` ou no Prisma com "Invalid time value".
export function safeDate(value: unknown): Date | null {
  if (!value || typeof value !== "string") return null
  const d = new Date(value)
  return isNaN(d.getTime()) ? null : d
}

function isRealPublisherUrl(url: string): boolean {
  if (!url || typeof url !== "string") return false
  try {
    const u = new URL(url)
    const host = u.hostname.toLowerCase()
    const fullPath = host + u.pathname.toLowerCase()
    return !REDIRECT_DOMAINS.some((d) => fullPath.startsWith(d) || host === d || host.endsWith("." + d))
  } catch {
    return false
  }
}

// ─── Stage 1-alt: discovery via Claude web_search (URLs reais) ─────────

const DiscoveryItemSchema = z.object({
  term: z.string().describe("Termo monitorado — EXATAMENTE um dos listados"),
  url: z.string().describe("URL REAL do publisher (folha.uol.com.br, techcrunch.com, etc). NUNCA news.google.com, google.com/url, bing.com/news."),
  title: z.string().describe("Título da matéria"),
  snippet: z.string().describe("Snippet do resultado de busca"),
  publisher: z.string().describe("Nome do publisher (ex: 'Folha de S.Paulo', 'TechCrunch')"),
  publishedAt: z.string().nullish().describe("Data de publicação se disponível no snippet"),
  // Haiku às vezes devolve "en", "pt", "es", "en-GB", etc. Normaliza via transform+pipe.
  locale: z.string().transform((v) => {
    const l = (v ?? "").toLowerCase()
    if (l.startsWith("pt")) return "pt-BR" as const
    if (l.startsWith("en")) return "en-US" as const
    return "other" as const
  }).pipe(z.enum(["pt-BR", "en-US", "other"])),
})

const DiscoveryResponseSchema = z.object({
  candidates: z.array(DiscoveryItemSchema),
})

function buildDiscoverySystemPrompt(): string {
  return `Você é BUSCADOR DE NOTÍCIAS. Pra cada termo monitorado, execute web_search e colete URLs REAIS de publishers.

REGRAS INEGOCIÁVEIS
- Use APENAS web_search. NÃO use web_fetch nesta etapa (a leitura vem depois).
- Retorne SOMENTE URLs de publishers REAIS: folha.uol.com.br, techcrunch.com, valor.globo.com, nytimes.com, etc.
- NUNCA inclua URL contendo: news.google.com, google.com/url, bing.com/news, duckduckgo.com, bit.ly, t.co, lnkd.in.
- Se o resultado do web_search for um redirect/agregador, DESCARTE (não inclua).
- Prefira tier-1 (veículos estabelecidos) mas pode pegar tier-2 se for especializado no nicho.
- ~5-8 candidatos por termo (ou menos se houver poucos resultados tier-1+2).
- Prefira matérias das últimas 72h quando possível de identificar pelo snippet.
- Use queries efetivas em PT e EN (ex: "<termo> notícia últimas 24h" e "<termo> news latest").

NÃO filtre por relevância aqui — coleta. A triagem cruza com a intenção depois.

FORMATO: JSON { candidates: [...] }.`
}

export async function runDiscoveryPhase(opts: {
  terms: string[]
  termIntents: Record<string, string>
  // Mapa termo → hosts permitidos (allowed_domains). Quando presente, restringe
  // web_search àquelas fontes curadas. Quando vazio/undef, busca livre.
  sourcesByTerm?: Record<string, string[]>
  userId: string
}): Promise<{
  candidates: { term: string; url: string; title: string; snippet: string; publisher: string; publishedAt?: string | null; locale: "pt-BR" | "en-US" | "other" }[]
  usage: { inputTokens: number; outputTokens: number; cacheReadTokens: number; cacheCreationTokens: number; searchesUsed: number }
}> {
  const { terms, termIntents, sourcesByTerm = {}, userId } = opts
  if (terms.length === 0) return { candidates: [], usage: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheCreationTokens: 0, searchesUsed: 0 } }

  const intentHint = Object.entries(termIntents).length > 0
    ? "\nIntenção do usuário por termo (use para decidir queries de busca melhores):\n" +
      Object.entries(termIntents).map(([t, i]) => `- "${t}": ${i}`).join("\n")
    : ""

  // União das fontes de todos os termos passados — vira allowed_domains.
  // Pré-filtra hosts que sabemos que a API do Claude não consegue acessar
  // (lista ANTHROPIC_BLOCKED_HOSTS) — evita 400 imediato.
  const rawAllowed = Array.from(new Set(terms.flatMap((t) => sourcesByTerm[t] ?? [])))
  const prefiltered = rawAllowed.filter((d) => ANTHROPIC_BLOCKED_HOSTS.has(d))
  if (prefiltered.length > 0) {
    console.log(`[discovery] pré-filtro: ${prefiltered.length} hosts bloqueados removidos do allowed_domains (${prefiltered.join(", ")})`)
  }
  let currentAllowedDomains = rawAllowed.filter((d) => !ANTHROPIC_BLOCKED_HOSTS.has(d))
  const hasCuratedSources = currentAllowedDomains.length > 0 || rawAllowed.length > 0
  // Mantido: se tinha curadoria mas pré-filtro zerou, ainda trata como "tinha fontes" (ajusta prompt),
  // mas cai em fallback blocked_domains no searchTool.
  const sourcesHint = hasCuratedSources
    ? `\nFONTES CURADAS (só busque nessas):\n${terms.map((t) => {
        const s = sourcesByTerm[t] ?? []
        return s.length > 0 ? `- "${t}": ${s.join(", ")}` : `- "${t}": (sem curadoria, busca livre)`
      }).join("\n")}`
    : ""

  const userPrompts = [
    `TERMOS MONITORADOS:
${terms.map((t) => `- "${t}"`).join("\n")}${intentHint}${sourcesHint}

Execute web_search pra cada termo (1-2 queries por termo, em PT e EN quando fizer sentido).
${hasCuratedSources
  ? "IMPORTANTE: O allowed_domains do web_search JÁ RESTRINGE a busca às fontes curadas. Não precisa usar operador site: nas queries."
  : "Colete candidatos SÓ de publishers reais (evite news.google.com, bing.com/news)."}
Mire em ~${Math.max(5, terms.length * 4)} candidatos no total.`,
    // Retry: prompt alternativo com queries mais específicas
    `TERMOS MONITORADOS (segunda tentativa — amplie queries):
${terms.map((t) => `- "${t}"`).join("\n")}${intentHint}${sourcesHint}

Use queries mais variadas: em PT tente "<termo> notícia hoje", "<termo> últimas", "<termo> lançamento"; em EN "<termo> news today", "<termo> announcement", "<termo> update". Colete ~${Math.max(5, terms.length * 4)} candidatos.`,
  ]
  const totals = { input: 0, output: 0, cacheRead: 0, cacheCreation: 0 }
  let searchesUsed = 0
  const start = Date.now()
  let candidates: z.infer<typeof DiscoveryResponseSchema>["candidates"] = []
  let rawParsed: z.infer<typeof DiscoveryResponseSchema> | null = null
  let lastParseError: unknown = null

  for (let attempt = 0; attempt < userPrompts.length; attempt++) {
    const messages: Anthropic.MessageParam[] = [{ role: "user", content: userPrompts[attempt] }]
    let finalText: string | null = null

    for (let i = 0; i < 4; i++) {
      // Quando há fontes curadas, usa allowed_domains (restringe). Caso contrário, usa blocked_domains (busca livre excluindo lixo).
      const buildSearchTool = (): Record<string, unknown> => {
        const st: Record<string, unknown> = {
          type: "web_search_20260209",
          name: "web_search",
          max_uses: Math.max(4, terms.length * 2),
          allowed_callers: ["direct"],
        }
        if (currentAllowedDomains.length > 0) {
          st.allowed_domains = currentAllowedDomains
        } else {
          st.blocked_domains = [...BLOCKED_DOMAINS, ...REDIRECT_DOMAINS]
        }
        return st
      }

      // Tenta a API; se vier 400 "domains not accessible", remove os hosts
      // bloqueados e re-tenta (até 3x). Persiste async pra evitar repetir.
      let response: Awaited<ReturnType<typeof anthropic.messages.create>> | null = null
      for (let blockedRetry = 0; blockedRetry < 4; blockedRetry++) {
        try {
          response = await anthropic.messages.create({
            model: DISCOVERY_MODEL,
            max_tokens: 6000,
            system: [{ type: "text", text: buildDiscoverySystemPrompt(), cache_control: { type: "ephemeral" } }],
            output_config: { format: zodOutputFormat(DiscoveryResponseSchema) },
            tools: [buildSearchTool() as any],
            messages,
          })
          break
        } catch (err) {
          const status = (err as { status?: number })?.status
          const msg = err instanceof Error ? err.message : String(err)
          if (status === 400) {
            const newlyBlocked = parseBlockedDomains(msg)
            if (newlyBlocked.length > 0) {
              console.warn(`[discovery] API bloqueou ${newlyBlocked.length} hosts: ${newlyBlocked.join(", ")} — filtrando e retry`)
              currentAllowedDomains = currentAllowedDomains.filter((d) => !newlyBlocked.includes(d))
              persistBlockedHosts(userId, newlyBlocked).catch(() => {})
              continue
            }
          }
          throw err
        }
      }
      if (!response) throw new Error("discovery: falha após retries de blocked_domains")

      totals.input += response.usage.input_tokens
      totals.output += response.usage.output_tokens
      totals.cacheRead += response.usage.cache_read_input_tokens ?? 0
      totals.cacheCreation += response.usage.cache_creation_input_tokens ?? 0
      for (const b of response.content) {
        if (b.type === "server_tool_use" && b.name === "web_search") searchesUsed++
      }
      if (response.stop_reason === "pause_turn") {
        messages.push({ role: "assistant", content: response.content })
        continue
      }
      const tb = [...response.content].reverse().find((b): b is Anthropic.TextBlock => b.type === "text")
      if (!tb) throw new Error(`discovery: sem text (stop=${response.stop_reason})`)
      finalText = tb.text
      break
    }
    if (!finalText) throw new Error("discovery: pause_turn loop exceeded")

    // Parse lenient: se falhar, tenta salvar o que der e segue. Só joga erro
    // no fim se NENHUMA tentativa voltou algo útil.
    let parsed: z.infer<typeof DiscoveryResponseSchema> | null = null
    try { parsed = DiscoveryResponseSchema.parse(JSON.parse(finalText)) }
    catch (err) {
      lastParseError = err
      console.error(`[discovery] parse attempt ${attempt + 1} falhou:`, err instanceof Error ? err.message : err, "raw:", finalText.slice(0, 500))
      // Tenta fallback: parse array-of-unknowns + Zod safeParse por item
      try {
        const raw = JSON.parse(finalText) as { candidates?: unknown[] }
        if (raw && Array.isArray(raw.candidates)) {
          const salvaged: z.infer<typeof DiscoveryItemSchema>[] = []
          for (const item of raw.candidates) {
            const r = DiscoveryItemSchema.safeParse(item)
            if (r.success) salvaged.push(r.data)
          }
          if (salvaged.length > 0) {
            parsed = { candidates: salvaged }
            console.log(`[discovery] salvou ${salvaged.length}/${raw.candidates.length} items via safeParse`)
          }
        }
      } catch { /* não conseguiu nem o JSON.parse — segue pro próximo attempt */ }
    }
    if (!parsed) {
      if (attempt < userPrompts.length - 1) { console.log(`[discovery] parse falhou no attempt ${attempt + 1} — tentando prompt alternativo...`); continue }
      // Último attempt falhou — logga o que temos e retorna vazio (pipeline trata como "nenhum candidato")
      console.error(`[discovery] TODOS os attempts falharam no parse. Último erro:`, lastParseError)
      break
    }
    rawParsed = parsed

    console.log(`[discovery] attempt ${attempt + 1}: Claude retornou ${parsed.candidates.length} candidatos brutos (searches=${searchesUsed})`)
    const validTerms = new Set(terms)
    const seen = new Set<string>()
    const dropStats = { missingFields: 0, termMismatch: 0, notPublisher: 0, duplicate: 0, pass: 0 }
    candidates = []
    for (const c of parsed.candidates) {
      if (!c.url || !c.title) { dropStats.missingFields++; continue }
      if (!validTerms.has(c.term)) { dropStats.termMismatch++; continue }
      if (!isRealPublisherUrl(c.url)) { dropStats.notPublisher++; continue }
      if (seen.has(c.url)) { dropStats.duplicate++; continue }
      seen.add(c.url)
      dropStats.pass++
      candidates.push(c)
    }
    console.log(`[discovery] attempt ${attempt + 1} stats: pass=${dropStats.pass} missing=${dropStats.missingFields} termMismatch=${dropStats.termMismatch} notPublisher=${dropStats.notPublisher} dup=${dropStats.duplicate}`)

    if (candidates.length > 0) break
    if (attempt < userPrompts.length - 1) console.log(`[discovery] 0 válidos — tentando prompt alternativo...`)
  }

  const durationMs = Date.now() - start

  trackUsage(DISCOVERY_MODEL, "discovery_phase", totals.input, totals.output, durationMs, userId, {
    cacheReadTokens: totals.cacheRead, cacheCreationTokens: totals.cacheCreation,
    searchesUsed, candidatesFound: candidates.length, candidatesRejected: (rawParsed?.candidates.length ?? 0) - candidates.length,
  }).catch(() => {})

  return {
    candidates,
    usage: { inputTokens: totals.input, outputTokens: totals.output, cacheReadTokens: totals.cacheRead, cacheCreationTokens: totals.cacheCreation, searchesUsed },
  }
}

// ─── Stage 2: triagem ──────────────────────────────────────────────────

const TriageItemSchema = z.object({
  candidateIndex: z.number().describe("Índice do candidato na lista fornecida no prompt (0-based)"),
  canonicalUrl: z.string().describe("URL CANÔNICA da matéria após seguir redirects. Extraia do meta og:url ou da URL final do web_fetch."),
  title: z.string().describe("Título real da matéria (no corpo — pode ser mais preciso que o do feed)"),
  publishedAt: z.string().describe("ISO 8601 se possível. Use a data visível no artigo."),
  summary: z.string().describe("Resumo 2-3 frases do CORPO que você leu"),
  keyQuote: z.string().describe("Trecho verbatim (10-40 palavras) do corpo da matéria"),
  sourceAuthority: z.enum(["TIER_1", "TIER_2", "BLOG", "AGGREGATOR", "UNKNOWN"]),
  language: z.string().transform((v) => {
    const l = v.toLowerCase()
    if (l.startsWith("pt")) return "pt-BR" as const
    if (l.startsWith("en")) return "en" as const
    if (l.startsWith("es")) return "es" as const
    return "pt-BR" as const
  }).pipe(z.enum(["pt-BR", "en", "es"])),
  relevanceScore: z.number().describe("0-100: quão DIRETAMENTE a matéria se relaciona com o termo e a intenção."),
  pioneerPotential: z.number().describe("0-100: potencial de virar conteúdo pioneiro"),
  freshnessHours: z.number(),
  topicKeywords: z.array(z.string()).describe("3-6 palavras-chave do TEMA (nomes próprios, eventos) — pro aprofundamento"),
  reject: z.boolean(),
  rejectReason: z.string().optional(),
})
const TriageResponseSchema = z.object({ items: z.array(TriageItemSchema) })
type TriageItem = z.infer<typeof TriageItemSchema>

function buildTriageSystemPrompt(): string {
  return `Você é ANALISTA DE NOTÍCIAS. Recebe candidatos pré-selecionados por RSS e precisa LER cada um via web_fetch e classificar.

REGRAS INEGOCIÁVEIS
- VOCÊ NÃO GERA IDEIAS DE CONTEÚDO. Apenas avalia.
- Para cada candidato, use web_fetch NA URL fornecida. Se falhar, marque reject=true.
- canonicalUrl: extraia do meta og:url ou do URL final pós-redirect.
- keyQuote DEVE ser verbatim do corpo. Se não consegue citar, você não leu.

RELEVÂNCIA
- Cada termo tem uma INTENÇÃO declarada pelo usuário (foco + exclusões).
- relevanceScore = quão bem a matéria se encaixa no termo E na intenção.
- Escala: 85+ no foco central; 70-84 relacionado ao termo/intenção; 50-69 tangencial; <50 fora.
- Seja generoso: matéria que informa sobre o termo e não viola exclusões → passa.

reject=true APENAS se: falhou leitura (web_fetch não trouxe corpo), repost/cópia óbvia, >72h, OU viola EXCLUSÕES explícitas do intent do usuário.
Não rejeite por score baixo — use relevanceScore pra sinalizar e deixe o filtro decidir.

topicKeywords: específicos do FATO (nome evento, pessoa, produto) pro próximo estágio.

FORMATO: JSON { items: [...] }.`
}

async function runTriagePhase(opts: { candidates: FeedItem[]; termIntents: Record<string, string>; userId: string }): Promise<{
  items: (TriageItem & { candidate: FeedItem })[]
  usage: { inputTokens: number; outputTokens: number; cacheReadTokens: number; cacheCreationTokens: number; fetchesUsed: number }
}> {
  const { candidates: allCandidates, termIntents, userId } = opts
  if (allCandidates.length === 0) return { items: [], usage: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheCreationTokens: 0, fetchesUsed: 0 } }

  // Cache: NewsEvidence recente (<1h) evita re-fetch e re-classificação
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
  const recentEvidence = await db.newsEvidence.findMany({
    where: { userId, capturedAt: { gte: oneHourAgo }, summary: { not: "" } },
    select: { url: true, title: true, summary: true, keyQuote: true, relevanceScore: true, freshnessHours: true, sourceAuthority: true, language: true, publishedAt: true, term: true },
  })
  const cacheByTitle = new Map<string, typeof recentEvidence[number]>()
  for (const ev of recentEvidence) cacheByTitle.set(titleKey(ev.title), ev)

  const cachedItems: (TriageItem & { candidate: FeedItem })[] = []
  const candidates: FeedItem[] = []
  for (const c of allCandidates) {
    const hit = cacheByTitle.get(titleKey(c.title))
    if (hit && hit.term === c.term) {
      cachedItems.push({
        candidateIndex: -1,
        canonicalUrl: hit.url,
        title: hit.title,
        publishedAt: hit.publishedAt?.toISOString() ?? "",
        summary: hit.summary,
        keyQuote: hit.keyQuote ?? "",
        sourceAuthority: (hit.sourceAuthority as TriageItem["sourceAuthority"]) ?? "UNKNOWN",
        language: (hit.language as TriageItem["language"]) ?? "pt-BR",
        relevanceScore: hit.relevanceScore,
        pioneerPotential: Math.max(40, hit.relevanceScore - 10),
        freshnessHours: hit.freshnessHours ?? 0,
        topicKeywords: [],
        reject: false,
        candidate: c,
      })
    } else {
      candidates.push(c)
    }
  }
  if (cachedItems.length > 0) console.log(`[triage] cache hit: ${cachedItems.length} de ${allCandidates.length} (NewsEvidence <1h)`)
  if (candidates.length === 0) {
    console.log(`[triage] 100% cache — pulando Claude`)
    return { items: cachedItems, usage: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheCreationTokens: 0, fetchesUsed: 0 } }
  }

  // Monta bloco de intenções por termo (só termos presentes nos candidatos)
  const termsInCandidates = Array.from(new Set(candidates.map((c) => c.term)))
  const intentBlock = termsInCandidates.map((t) => {
    const intent = termIntents[t]
    return intent ? `- "${t}" → ${intent}` : `- "${t}" → (sem intenção declarada — use julgamento padrão de relevância)`
  }).join("\n")

  const userPrompt = `INTENÇÕES POR TERMO (foco/exclusões declarados pelo usuário):
${intentBlock}

${candidates.length} CANDIDATOS (lista FIXA do RSS; NÃO invente outros):

${candidates.map((c, i) => `[${i}] term="${c.term}" (${c.locale}) · ${c.source} · pub ${c.pubDate?.toISOString() ?? "?"}
    Título: ${c.title}
    URL: ${c.url}
    Snippet RSS: ${c.description.slice(0, 200)}`).join("\n")}

Execute web_fetch em cada URL, extraia os dados e classifique contra o termo + intenção. Use relevanceScore pra sinalizar força do match (não rejeite por score baixo). reject=true só em falha de leitura, repost, ou violação explícita de exclusão.`

  const messages: Anthropic.MessageParam[] = [{ role: "user", content: userPrompt }]
  const totals = { input: 0, output: 0, cacheRead: 0, cacheCreation: 0 }
  let fetchesUsed = 0
  let finalText: string | null = null
  const start = Date.now()

  for (let i = 0; i < 5; i++) {
    const response = await anthropic.messages.create({
      model: TRIAGE_MODEL,
      max_tokens: 8000,
      system: [{ type: "text", text: buildTriageSystemPrompt(), cache_control: { type: "ephemeral" } }],
      output_config: { format: zodOutputFormat(TriageResponseSchema) },
      tools: [{ type: "web_fetch_20260209", name: "web_fetch", max_uses: candidates.length + 2, max_content_tokens: 3500, blocked_domains: BLOCKED_DOMAINS, allowed_callers: ["direct"] } as any],
      messages,
    })
    totals.input += response.usage.input_tokens
    totals.output += response.usage.output_tokens
    totals.cacheRead += response.usage.cache_read_input_tokens ?? 0
    totals.cacheCreation += response.usage.cache_creation_input_tokens ?? 0
    for (const b of response.content) {
      if (b.type === "server_tool_use" && b.name === "web_fetch") fetchesUsed++
    }
    if (response.stop_reason === "pause_turn") {
      messages.push({ role: "assistant", content: response.content })
      continue
    }
    const tb = [...response.content].reverse().find((b): b is Anthropic.TextBlock => b.type === "text")
    if (!tb) throw new Error(`triage: sem text (stop=${response.stop_reason})`)
    finalText = tb.text
    break
  }
  const durationMs = Date.now() - start
  if (!finalText) throw new Error("triage: pause_turn loop exceeded")

  let parsed: z.infer<typeof TriageResponseSchema>
  try { parsed = TriageResponseSchema.parse(JSON.parse(finalText)) }
  catch (err) {
    console.error("[triage] parse:", err, "raw:", finalText.slice(0, 400))
    throw new Error("Falha ao parsear triagem")
  }

  console.log(`[triage] Claude retornou ${parsed.items.length} items (de ${candidates.length} candidatos)`)
  const dropStats = { reject: 0, lowRelevance: 0, badIndex: 0, badUrl: 0, pass: 0 }
  for (const it of parsed.items) {
    const reasons: string[] = []
    if (it.reject) { reasons.push(`reject=true(${it.rejectReason ?? "sem-motivo"})`); dropStats.reject++ }
    if (it.relevanceScore < 70) { reasons.push(`rel=${it.relevanceScore}<70`); if (!it.reject) dropStats.lowRelevance++ }
    if (it.candidateIndex < 0 || it.candidateIndex >= candidates.length) { reasons.push(`idx=${it.candidateIndex}`); dropStats.badIndex++ }
    else if (!it.reject && it.relevanceScore >= 70 && !isRealPublisherUrl(it.canonicalUrl)) {
      reasons.push(`url-não-publisher="${it.canonicalUrl}"`); dropStats.badUrl++
    }
    const tag = reasons.length === 0 ? "PASS" : `DROP [${reasons.join(", ")}]`
    if (reasons.length === 0) dropStats.pass++
    console.log(`[triage] #${it.candidateIndex} ${tag} rel=${it.relevanceScore} "${it.title?.slice(0, 70) ?? ""}"`)
  }
  console.log(`[triage] stats: pass=${dropStats.pass} reject=${dropStats.reject} lowRel=${dropStats.lowRelevance} badIdx=${dropStats.badIndex} badUrl=${dropStats.badUrl}`)

  const freshItems = parsed.items
    .filter((it) => !it.reject && it.relevanceScore >= 70 && it.candidateIndex >= 0 && it.candidateIndex < candidates.length)
    .filter((it) => isRealPublisherUrl(it.canonicalUrl))
    .map((it) => ({ ...it, candidate: candidates[it.candidateIndex] }))

  const items = [...cachedItems, ...freshItems]

  trackUsage(TRIAGE_MODEL, "triage_phase", totals.input, totals.output, durationMs, userId, {
    cacheReadTokens: totals.cacheRead, cacheCreationTokens: totals.cacheCreation,
    fetchesUsed, itemsQualified: items.length, itemsTotal: allCandidates.length, cachedFromDb: cachedItems.length,
  }).catch(() => {})

  return { items, usage: { inputTokens: totals.input, outputTokens: totals.output, cacheReadTokens: totals.cacheRead, cacheCreationTokens: totals.cacheCreation, fetchesUsed } }
}

// ─── Stage 3: aprofundamento (triangulação) ────────────────────────────

const SupportingSourceSchema = z.object({
  primaryIndex: z.number().describe("Índice do item primário na lista QUALIFIED"),
  url: z.string(),
  title: z.string(),
  publishedAt: z.string(),
  summary: z.string(),
  keyQuote: z.string(),
  sourceAuthority: z.enum(["TIER_1", "TIER_2", "BLOG", "AGGREGATOR", "UNKNOWN"]),
  language: z.string().transform((v) => {
    const l = v.toLowerCase()
    if (l.startsWith("pt")) return "pt-BR" as const
    if (l.startsWith("en")) return "en" as const
    if (l.startsWith("es")) return "es" as const
    return "pt-BR" as const
  }).pipe(z.enum(["pt-BR", "en", "es"])),
  agreementScore: z.number().describe("0-100: quão fortemente CONFIRMA o fato do primário"),
  addsInfo: z.string().optional().describe("O que esta fonte acrescenta"),
  reject: z.boolean(),
})
const DeepResearchResponseSchema = z.object({ sources: z.array(SupportingSourceSchema) })

function buildDeepResearchSystemPrompt(): string {
  return `Você é PESQUISADOR DE TRIANGULAÇÃO E VIRALIDADE. Pra cada matéria primária, você busca cobertura ADICIONAL pra avaliar: a) é só uma notícia solitária de 1 publisher ou b) é um fato que se espalhou (potencial viral).

ESTRATÉGIA DE BUSCA (OBRIGATÓRIA — execute as 2 buscas por primário)
1. CROSS-PUBLISHER (PT): web_search com topicKeywords em PORTUGUÊS.
   Objetivo: achar OUTROS veículos BR cobrindo o MESMO fato (Folha, G1, Valor, Estadão, CNN Brasil, TechTudo, Olhar Digital, NeoFeed, etc.).
   Descartar resultados do MESMO publisher primário (triangulação independente).

2. CROSS-LANGUAGE (EN): web_search com topicKeywords EM INGLÊS.
   Objetivo: verificar se o fato virou matéria internacional (TechCrunch, Reuters, Bloomberg, NYT, The Verge, FT, etc.).
   Cobertura internacional = forte sinal de viralidade.

Pra cada resultado promissor, use web_fetch pra ler o conteúdo antes de incluir.

REGRAS PARA INCLUIR UMA FONTE
- agreementScore ≥ 70: a fonte corrobora o FATO do primário (não só toca no tema).
- publisher DIFERENTE do primário (domain host distinto).
- URL REAL de publisher (nunca news.google.com, google.com/url, etc).
- Fato central alinhado com o primário.

reject=true apenas se: redirect/agregador, publisher igual ao primário, tema adjacente sem corroborar o fato central, ou opinião sem apuração. Use agreementScore pra calibrar — não seja restritivo além disso.

FILOSOFIA
Se a primária aparece em 2+ publishers distintos → sinal de viralidade real.
Se aparece só no primário → OK retornar sources=[] pra aquele primário (ideia sai com viralScore baixo, não é falha).
Não invente fontes — só inclua o que conseguiu web_fetch e ler.

FORMATO: JSON { sources: [...] } — cada source aponta pro primaryIndex. Mire em 1-2 sources por primário quando o fato for real.`
}

async function runDeepResearchPhase(opts: {
  qualified: (TriageItem & { candidate: FeedItem })[]
  termIntents: Record<string, string>
  userId: string
}): Promise<{
  sources: (z.infer<typeof SupportingSourceSchema> & { primary: TriageItem & { candidate: FeedItem } })[]
  usage: { inputTokens: number; outputTokens: number; cacheReadTokens: number; cacheCreationTokens: number; searchesUsed: number; fetchesUsed: number }
}> {
  const { qualified, termIntents, userId } = opts
  if (qualified.length === 0) return { sources: [], usage: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheCreationTokens: 0, searchesUsed: 0, fetchesUsed: 0 } }

  const userPrompt = `${qualified.length} MATÉRIAS PRIMÁRIAS — triangule cada uma cross-publisher e cross-language:

${qualified.map((q, i) => {
  const intent = termIntents[q.candidate.term]
  const primaryHost = (() => { try { return new URL(q.canonicalUrl).hostname.replace(/^www\./, "") } catch { return "" } })()
  return `[${i}] term="${q.candidate.term}" · rel=${q.relevanceScore} · pioneer=${q.pioneerPotential}${intent ? `\n    Intenção do usuário: ${intent}` : ""}
    Primário: ${q.title}
    URL primária: ${q.canonicalUrl}
    Publisher primário: ${primaryHost} (NÃO inclua outras matérias deste mesmo host)
    Resumo: ${q.summary}
    Keywords (use em web_search): ${q.topicKeywords.join(", ")}`
}).join("\n\n")}

EXECUTE PRA CADA PRIMÁRIO:
1. web_search em PT com keywords → achar outros publishers BR
2. web_search em EN com keywords → verificar cobertura internacional
3. web_fetch em 2-4 resultados promissores (publishers ≠ primário)
4. Retorne só fontes que realmente CORROBORAM o fato (agreement ≥ 70), de publishers distintos.

MIRE em 2-4 sources por primário quando houver. 0-1 sources = notícia solitária (OK, honesto). NÃO invente URLs.`

  const messages: Anthropic.MessageParam[] = [{ role: "user", content: userPrompt }]
  const totals = { input: 0, output: 0, cacheRead: 0, cacheCreation: 0 }
  let searchesUsed = 0, fetchesUsed = 0
  let finalText: string | null = null
  const start = Date.now()

  for (let i = 0; i < 5; i++) {
    const response = await anthropic.messages.create({
      model: DEEP_MODEL,
      max_tokens: 8000,
      system: [{ type: "text", text: buildDeepResearchSystemPrompt(), cache_control: { type: "ephemeral" } }],
      output_config: { format: zodOutputFormat(DeepResearchResponseSchema) },
      tools: [
        { type: "web_search_20260209", name: "web_search", max_uses: Math.max(qualified.length * 2, qualified.length + 3), blocked_domains: [...BLOCKED_DOMAINS, ...REDIRECT_DOMAINS], allowed_callers: ["direct"] } as any,
        { type: "web_fetch_20260209", name: "web_fetch", max_uses: Math.max(qualified.length * 2, qualified.length + 4), max_content_tokens: 3000, blocked_domains: [...BLOCKED_DOMAINS, ...REDIRECT_DOMAINS], allowed_callers: ["direct"] } as any,
      ],
      messages,
    })
    totals.input += response.usage.input_tokens
    totals.output += response.usage.output_tokens
    totals.cacheRead += response.usage.cache_read_input_tokens ?? 0
    totals.cacheCreation += response.usage.cache_creation_input_tokens ?? 0
    for (const b of response.content) {
      if (b.type === "server_tool_use") {
        if (b.name === "web_search") searchesUsed++
        else if (b.name === "web_fetch") fetchesUsed++
      }
    }
    if (response.stop_reason === "pause_turn") {
      messages.push({ role: "assistant", content: response.content })
      continue
    }
    const tb = [...response.content].reverse().find((b): b is Anthropic.TextBlock => b.type === "text")
    if (!tb) throw new Error(`deep: sem text (stop=${response.stop_reason})`)
    finalText = tb.text
    break
  }
  const durationMs = Date.now() - start
  if (!finalText) throw new Error("deep: pause_turn loop exceeded")

  let parsed: z.infer<typeof DeepResearchResponseSchema>
  try { parsed = DeepResearchResponseSchema.parse(JSON.parse(finalText)) }
  catch { throw new Error("Falha ao parsear fontes de apoio") }

  const sources = parsed.sources
    .filter((s) => !s.reject && s.agreementScore >= 70 && s.primaryIndex >= 0 && s.primaryIndex < qualified.length)
    // Rejeita supporting sources que sejam redirect/agregador
    .filter((s) => {
      if (!isRealPublisherUrl(s.url)) {
        console.warn(`[deep] drop supporting: url "${s.url}" não é publisher real`)
        return false
      }
      return true
    })
    .map((s) => ({ ...s, primary: qualified[s.primaryIndex] }))

  trackUsage(DEEP_MODEL, "deep_research_phase", totals.input, totals.output, durationMs, userId, {
    cacheReadTokens: totals.cacheRead, cacheCreationTokens: totals.cacheCreation,
    searchesUsed, fetchesUsed, supportingFound: sources.length,
  }).catch(() => {})

  return {
    sources,
    usage: { inputTokens: totals.input, outputTokens: totals.output, cacheReadTokens: totals.cacheRead, cacheCreationTokens: totals.cacheCreation, searchesUsed, fetchesUsed },
  }
}

// ─── Stage 4: narrativa (sem tools) ────────────────────────────────────

const PlatformFitSchema = z.object({
  reels: z.number().describe("0-100: encaixe pra Instagram Reels (hook rápido, vertical, 15-30s, curiosidade+gancho emocional)"),
  shorts: z.number().describe("0-100: encaixe pra YouTube Shorts (lead forte nos 3s, 30-60s, alta retenção por curiosidade)"),
  long: z.number().describe("0-100: encaixe pra YouTube long-form (densidade, narrativa em 3 atos, contrarian, 8-15min)"),
  tiktok: z.number().describe("0-100: encaixe pra TikTok (tom conversacional, trend-aware, autenticidade acima de produção)"),
})

const NarrativeIdeaSchema = z.object({
  groupIndex: z.number(),
  title: z.string(),
  summary: z.string(),
  angle: z.string(),
  hook: z.string(),
  relevance: z.string(),
  evidenceQuote: z.string(),
  pioneerScore: z.number(),
  platformFit: PlatformFitSchema,
})
const NarrativeResponseSchema = z.object({ ideas: z.array(NarrativeIdeaSchema) })

function buildNarrativeSystemPrompt(): string {
  return `Você é ESTRATEGISTA DE CONTEÚDO. Recebe GRUPOS (primário + apoios) e constrói ideias pioneiras.

REGRAS
- CADA ideia aponta pro groupIndex.
- evidenceQuote = verbatim do keyQuote do primário.
- Apoios enriquecem o ângulo (o que uma traz que outra não).
- pioneerScore maior com: fresh<48h + apoios + tier-1 + lacuna PT + angle único.
- Não gere ideia se grupo for fraco.
- Contrarian > óbvio. Evite "o que você precisa saber sobre X".

PLATFORM FIT (0-100 por plataforma — calibra quão bem a ideia rende em cada formato)
- Reels: factual rápido, hook emocional, 15-30s, vertical. Alta nota pra fatos recentes com gancho visual.
- Shorts: lead forte nos 3s, curiosidade, 30-60s. Alta nota pra "sabia que X?" contrarian.
- Long-form: narrativa em 3 atos, densidade de dados, contexto histórico, 8-15min. Alta nota pra análises profundas e lacunas no que o mercado cobre.
- TikTok: tom conversacional, trend-aware, 30-90s. Alta nota pra reações autênticas a acontecimentos do dia.

Dê notas que reflitam encaixe REAL — fato denso e técnico cai baixo em TikTok; notícia bombástica com imagem forte cai alto em Reels.

FORMATO: JSON { ideas: [...] }.`
}

interface NarrativeGroup {
  primary: TriageItem & { candidate: FeedItem }
  supporting: (z.infer<typeof SupportingSourceSchema> & { primary: TriageItem & { candidate: FeedItem } })[]
}

interface ViralMetrics {
  publisherHosts: string[]         // hosts únicos primário+apoios
  uniqueLanguages: string[]
  hasInternationalCoverage: boolean
  viralScore: number               // 0-100
}

function hostOf(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, "") } catch { return "" }
}

function computeViralMetrics(group: NarrativeGroup): ViralMetrics {
  const primaryHost = hostOf(group.primary.canonicalUrl)
  const hosts = new Set<string>()
  if (primaryHost) hosts.add(primaryHost)
  const langs = new Set<string>([group.primary.language])
  for (const s of group.supporting) {
    const h = hostOf(s.url)
    if (h && h !== primaryHost) hosts.add(h)
    langs.add(s.language)
  }
  const publisherHosts = Array.from(hosts)
  const uniqueLanguages = Array.from(langs)
  const hasInternationalCoverage = uniqueLanguages.some((l) => l !== "pt-BR")
  const freshH = group.primary.freshnessHours ?? 48
  const tierScore = group.primary.sourceAuthority === "TIER_1" ? 10 : group.primary.sourceAuthority === "TIER_2" ? 5 : 0
  const freshScore = freshH < 24 ? 20 : freshH < 48 ? 10 : 0
  const publisherBonus = Math.min(45, Math.max(0, publisherHosts.length - 1) * 15)
  const internationalBonus = hasInternationalCoverage ? 15 : 0
  const raw = 20 + publisherBonus + internationalBonus + freshScore + tierScore
  const viralScore = Math.max(0, Math.min(100, raw))
  return { publisherHosts, uniqueLanguages, hasInternationalCoverage, viralScore }
}

async function runNarrativePhase(opts: { groups: NarrativeGroup[]; userId: string }): Promise<{
  ideas: (z.infer<typeof NarrativeIdeaSchema> & { group: NarrativeGroup })[]
  usage: { inputTokens: number; outputTokens: number; cacheReadTokens: number; cacheCreationTokens: number }
}> {
  const { groups, userId } = opts
  if (groups.length === 0) return { ideas: [], usage: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheCreationTokens: 0 } }

  const metrics = groups.map((g) => computeViralMetrics(g))
  const userPrompt = `${groups.length} GRUPOS:

${groups.map((g, i) => {
    const m = metrics[i]
    return `[${i}] term="${g.primary.candidate.term}" · autoridade=${g.primary.sourceAuthority} · fresh=${g.primary.freshnessHours}h · publishers=${m.publisherHosts.length} · idiomas=${m.uniqueLanguages.join(",")} · viralScore=${m.viralScore}

  PRIMÁRIO: ${g.primary.title}
    URL: ${g.primary.canonicalUrl} (${hostOf(g.primary.canonicalUrl)})
    Resumo: ${g.primary.summary}
    Quote: "${g.primary.keyQuote}"

  APOIOS:
${g.supporting.length === 0 ? "    (notícia solitária — nenhum outro publisher corroborou)" : g.supporting.map((s) => `    - [${hostOf(s.url)}/${s.language}] ${s.title} [${s.sourceAuthority}]
      "${s.keyQuote}"
      ${s.addsInfo ? `Adiciona: ${s.addsInfo}` : ""}`).join("\n")}
`
  }).join("\n")}

Gere ideias considerando o viralScore de cada grupo:
- viralScore ≥ 70: múltiplos publishers corroboram → ideia pode falar com confiança "X reportou, Y confirmou, Z em inglês"
- viralScore 40-69: notícia real mas cobertura limitada → tom mais especulativo
- viralScore < 40: notícia solitária ou fraca → ideia só se o fato for intrinsecamente grande

pioneerScore ≠ viralScore. Pioneiro = ÂNGULO único + timing. Podem coexistir: viralScore alto + pioneerScore alto = notícia quebrando em vários lugares mas com ângulo que ninguém pegou ainda.
Qualidade > quantidade. Pular grupos fracos é válido.`

  const start = Date.now()
  const response = await anthropic.messages.create({
    model: NARRATIVE_MODEL,
    max_tokens: 6000,
    system: [{ type: "text", text: buildNarrativeSystemPrompt(), cache_control: { type: "ephemeral" } }],
    output_config: { format: zodOutputFormat(NarrativeResponseSchema), effort: "low" },
    messages: [{ role: "user", content: userPrompt }],
  })
  const durationMs = Date.now() - start
  const tb = [...response.content].reverse().find((b): b is Anthropic.TextBlock => b.type === "text")
  if (!tb) throw new Error("narrative: sem text")

  let parsed: z.infer<typeof NarrativeResponseSchema>
  try { parsed = NarrativeResponseSchema.parse(JSON.parse(tb.text)) }
  catch { throw new Error("Falha ao parsear ideias") }

  const ideas = parsed.ideas
    .filter((i) => i.groupIndex >= 0 && i.groupIndex < groups.length)
    .map((i) => ({ ...i, group: groups[i.groupIndex] }))

  trackUsage(NARRATIVE_MODEL, "narrative_phase", response.usage.input_tokens, response.usage.output_tokens, durationMs, userId, {
    cacheReadTokens: response.usage.cache_read_input_tokens ?? 0,
    cacheCreationTokens: response.usage.cache_creation_input_tokens ?? 0,
    ideasReturned: ideas.length,
  }).catch(() => {})

  return {
    ideas,
    usage: {
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      cacheReadTokens: response.usage.cache_read_input_tokens ?? 0,
      cacheCreationTokens: response.usage.cache_creation_input_tokens ?? 0,
    },
  }
}

// ─── Orquestrador público ──────────────────────────────────────────────

export interface PlatformFit {
  reels: number
  shorts: number
  long: number
  tiktok: number
}

export interface ResearchedIdea {
  title: string
  summary: string
  angle: string
  hook: string
  term: string
  relevance: string
  sourceUrl: string
  sourceTitle: string
  publishedAt: string
  language: "pt-BR" | "en" | "es"
  pioneerScore: number
  evidenceId: string
  evidenceQuote: string
  supportingEvidenceIds: string[]
  viralScore: number
  publisherHosts: string[]
  hasInternationalCoverage: boolean
  platformFit: PlatformFit
}

interface GenerateIdeasOptions {
  terms: string[]
  termIntents?: Record<string, string> // term → intent (foco/exclusões)
  ideasPerTerm?: number
  language?: "pt-BR" | "en" | "both"
  hoursWindow?: number
  userId?: string
}

// ─── Parallel wrappers: 1 call por termo em paralelo ───────────────────

async function runTriagePhaseParallel(opts: {
  candidates: FeedItem[]
  termIntents: Record<string, string>
  userId: string
  concurrency: number
}): Promise<{
  items: (TriageItem & { candidate: FeedItem })[]
  usage: { inputTokens: number; outputTokens: number; cacheReadTokens: number; cacheCreationTokens: number; fetchesUsed: number }
}> {
  const { candidates, termIntents, userId, concurrency } = opts
  if (candidates.length === 0) return { items: [], usage: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheCreationTokens: 0, fetchesUsed: 0 } }

  const byTerm = new Map<string, FeedItem[]>()
  for (const c of candidates) {
    const arr = byTerm.get(c.term) ?? []
    arr.push(c)
    byTerm.set(c.term, arr)
  }
  const groups = [...byTerm.entries()]
  console.log(`[triage-parallel] ${groups.length} grupos: ${groups.map(([t, arr]) => `${t}=${arr.length}`).join(", ")}`)

  const results: Array<Awaited<ReturnType<typeof runTriagePhase>>> = []
  let cursor = 0
  async function worker() {
    while (true) {
      const i = cursor++
      if (i >= groups.length) return
      const [term, termCandidates] = groups[i]
      const intentsForTerm = termIntents[term] ? { [term]: termIntents[term] } : {}
      try {
        const res = await runTriagePhase({ candidates: termCandidates, termIntents: intentsForTerm, userId })
        results.push(res)
      } catch (err) {
        console.warn(`[triage-parallel] term="${term}" failed:`, (err as Error).message)
        results.push({ items: [], usage: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheCreationTokens: 0, fetchesUsed: 0 } })
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, groups.length) }, worker))

  return {
    items: results.flatMap((r) => r.items),
    usage: {
      inputTokens: results.reduce((s, r) => s + r.usage.inputTokens, 0),
      outputTokens: results.reduce((s, r) => s + r.usage.outputTokens, 0),
      cacheReadTokens: results.reduce((s, r) => s + r.usage.cacheReadTokens, 0),
      cacheCreationTokens: results.reduce((s, r) => s + r.usage.cacheCreationTokens, 0),
      fetchesUsed: results.reduce((s, r) => s + r.usage.fetchesUsed, 0),
    },
  }
}

async function runDeepResearchPhaseParallel(opts: {
  qualified: (TriageItem & { candidate: FeedItem })[]
  termIntents: Record<string, string>
  userId: string
  concurrency: number
}): Promise<{
  sources: (z.infer<typeof SupportingSourceSchema> & { primary: TriageItem & { candidate: FeedItem } })[]
  usage: { inputTokens: number; outputTokens: number; cacheReadTokens: number; cacheCreationTokens: number; searchesUsed: number; fetchesUsed: number }
}> {
  const { qualified, termIntents, userId, concurrency } = opts
  if (qualified.length === 0) return { sources: [], usage: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheCreationTokens: 0, searchesUsed: 0, fetchesUsed: 0 } }

  // Agrupa por termo preservando o índice global de cada qualified
  const byTerm = new Map<string, { globalIdx: number; item: TriageItem & { candidate: FeedItem } }[]>()
  qualified.forEach((q, globalIdx) => {
    const arr = byTerm.get(q.candidate.term) ?? []
    arr.push({ globalIdx, item: q })
    byTerm.set(q.candidate.term, arr)
  })
  const groups = [...byTerm.entries()]
  console.log(`[deep-parallel] ${groups.length} grupos: ${groups.map(([t, arr]) => `${t}=${arr.length}`).join(", ")}`)

  const results: Array<Awaited<ReturnType<typeof runDeepResearchPhase>>> = []
  let cursor = 0
  async function worker() {
    while (true) {
      const i = cursor++
      if (i >= groups.length) return
      const [term, termEntries] = groups[i]
      const termQualified = termEntries.map((e) => e.item)
      const intentsForTerm = termIntents[term] ? { [term]: termIntents[term] } : {}
      try {
        const res = await runDeepResearchPhase({ qualified: termQualified, termIntents: intentsForTerm, userId })
        // Remapeia primaryIndex local → global
        const remapped = {
          ...res,
          sources: res.sources.map((s) => ({ ...s, primaryIndex: termEntries[s.primaryIndex]?.globalIdx ?? -1 })).filter((s) => s.primaryIndex >= 0),
        }
        results.push(remapped)
      } catch (err) {
        console.warn(`[deep-parallel] term="${term}" failed:`, (err as Error).message)
        results.push({ sources: [], usage: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheCreationTokens: 0, searchesUsed: 0, fetchesUsed: 0 } })
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, groups.length) }, worker))

  return {
    sources: results.flatMap((r) => r.sources),
    usage: {
      inputTokens: results.reduce((s, r) => s + r.usage.inputTokens, 0),
      outputTokens: results.reduce((s, r) => s + r.usage.outputTokens, 0),
      cacheReadTokens: results.reduce((s, r) => s + r.usage.cacheReadTokens, 0),
      cacheCreationTokens: results.reduce((s, r) => s + r.usage.cacheCreationTokens, 0),
      searchesUsed: results.reduce((s, r) => s + r.usage.searchesUsed, 0),
      fetchesUsed: results.reduce((s, r) => s + r.usage.fetchesUsed, 0),
    },
  }
}

export async function generateIdeasWithResearch(opts: GenerateIdeasOptions): Promise<{
  ideas: ResearchedIdea[]
  usage: {
    inputTokens: number
    outputTokens: number
    cacheReadTokens: number
    cacheCreationTokens: number
    searchesUsed: number
    fetchesUsed: number
    evidencesCaptured: number
    candidatesFromRss: number
    qualifiedAfterTriage: number
    supportingFound: number
  }
}> {
  const { terms, termIntents = {}, hoursWindow = 72, userId } = opts
  if (!userId) throw new Error("userId obrigatório")
  const empty = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheCreationTokens: 0, searchesUsed: 0, fetchesUsed: 0, evidencesCaptured: 0, candidatesFromRss: 0, qualifiedAfterTriage: 0, supportingFound: 0 }
  if (terms.length === 0) return { ideas: [], usage: empty }

  // Busca fontes curadas dos termos (se houver) pra direcionar a pesquisa.
  // Termos com fontes → pesquisa focada com allowed_domains.
  // Termos sem fontes → fallback pra RSS + web_search amplo.
  const monitorTerms = await db.monitorTerm.findMany({
    where: { userId, term: { in: terms } },
    select: { term: true, sources: true },
  })
  const sourcesByTerm: Record<string, string[]> = {}
  for (const mt of monitorTerms) {
    const arr = Array.isArray(mt.sources) ? (mt.sources as any[]) : []
    const hosts = arr.filter((s) => s && s.isActive !== false && typeof s.host === "string").map((s) => s.host)
    if (hosts.length > 0) sourcesByTerm[mt.term] = hosts
  }
  const termsWithSources = terms.filter((t) => sourcesByTerm[t]?.length)
  const termsWithoutSources = terms.filter((t) => !sourcesByTerm[t]?.length)
  console.log(`[pipeline] curadoria: ${termsWithSources.length} termos com fontes, ${termsWithoutSources.length} sem (fallback RSS)`)

  // ── Stage 0 — RSS só pros termos SEM fontes curadas (fallback legado)
  const rssItems = termsWithoutSources.length > 0
    ? await discoverCandidates({ terms: termsWithoutSources, hoursWindow })
    : []
  const rssByTerm = new Map<string, number>()
  for (const item of rssItems) rssByTerm.set(item.term, (rssByTerm.get(item.term) ?? 0) + 1)
  if (termsWithoutSources.length > 0) {
    console.log(`[pipeline] stage0 (rss, ${termsWithoutSources.length} termos sem fontes): ${rssItems.length} candidatos`)
  }

  // ── Stage 1 — Claude web_search:
  // - Pros termos COM fontes curadas: allowed_domains restrito
  // - Pros termos SEM fontes com cobertura RSS baixa (<3): busca livre
  // - CACHE: se já rodou discovery hoje pro termo (via cron do digest), reusa.
  const undercoveredTerms = termsWithoutSources.filter((t) => (rssByTerm.get(t) ?? 0) < 3)
  const claudeTerms = [...termsWithSources, ...undercoveredTerms]
  let claudeDiscoveryUsage = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheCreationTokens: 0, searchesUsed: 0 }
  const claudeItems: FeedItem[] = []
  if (claudeTerms.length > 0) {
    // Lookup de termId por nome (cache é chaveado por termId)
    const termRecords = await db.monitorTerm.findMany({
      where: { userId, term: { in: claudeTerms } },
      select: { id: true, term: true },
    })
    const termNameToId = new Map(termRecords.map((t) => [t.term, t.id]))
    const today = new Date()
    today.setUTCHours(0, 0, 0, 0)

    const cachedRuns = await db.themeDiscoveryRun.findMany({
      where: {
        userId,
        runDate: today,
        termId: { in: termRecords.map((t) => t.id) },
      },
    })
    const cachedByTermName = new Map<string, typeof cachedRuns[number]>()
    for (const r of cachedRuns) {
      const name = termRecords.find((t) => t.id === r.termId)?.term
      if (name) cachedByTermName.set(name, r)
    }

    // Pega candidates do cache
    for (const [name, run] of cachedByTermName) {
      const arr = (Array.isArray(run.candidates) ? run.candidates : []) as Array<{ term: string; url: string; title: string; snippet: string; publisher: string; publishedAt?: string | null; locale: string }>
      for (const c of arr) {
        claudeItems.push({
          term: name,
          title: c.title,
          url: c.url,
          pubDate: safeDate(c.publishedAt),
          source: c.publisher,
          description: c.snippet,
          locale: c.locale === "en-US" ? "en-US" : "pt-BR",
        })
      }
    }

    // Só roda discovery pros termos NÃO cacheados
    const uncachedTerms = claudeTerms.filter((t) => !cachedByTermName.has(t))
    if (cachedByTermName.size > 0) {
      console.log(`[pipeline] stage1: ${cachedByTermName.size} termos reaproveitados do cache diário (+${claudeItems.length} candidatos)`)
    }

    if (uncachedTerms.length > 0) {
      const claudeIntents: Record<string, string> = {}
      for (const t of uncachedTerms) if (termIntents[t]) claudeIntents[t] = termIntents[t]
      const discovery = await runDiscoveryPhase({
        terms: uncachedTerms,
        termIntents: claudeIntents,
        sourcesByTerm,
        userId,
      })
      claudeDiscoveryUsage = discovery.usage
      console.log(`[pipeline] stage1: claude rodou pra ${uncachedTerms.length} termos novos (${discovery.candidates.length} candidatos)`)

      // Persiste candidates no cache, agrupados por termId
      const byTerm = new Map<string, typeof discovery.candidates>()
      for (const c of discovery.candidates) {
        const list = byTerm.get(c.term) ?? []
        list.push(c)
        byTerm.set(c.term, list)
      }
      for (const [termName, cands] of byTerm) {
        const termId = termNameToId.get(termName)
        if (!termId) continue
        await db.themeDiscoveryRun.upsert({
          where: { userId_termId_runDate: { userId, termId, runDate: today } },
          create: {
            userId, termId, runDate: today,
            candidates: cands as unknown as Prisma.InputJsonValue,
            candidatesCount: cands.length,
            searchesUsed: 0, // contagem total fica no run, não por termo
          },
          update: {
            candidates: cands as unknown as Prisma.InputJsonValue,
            candidatesCount: cands.length,
          },
        }).catch((err) => console.error(`[pipeline] cache upsert falhou pra "${termName}":`, err))
      }

      for (const c of discovery.candidates) {
        claudeItems.push({
          term: c.term,
          title: c.title,
          url: c.url,
          pubDate: safeDate(c.publishedAt),
          source: c.publisher,
          description: c.snippet,
          locale: c.locale === "en-US" ? "en-US" : "pt-BR",
        })
      }
    }
  } else {
    console.log(`[pipeline] stage1: pulado`)
  }

  // Merge RSS + Claude, dedup por URL
  const seenUrl = new Set<string>()
  const merged: FeedItem[] = []
  for (const item of [...rssItems, ...claudeItems]) {
    const key = item.url.toLowerCase()
    if (seenUrl.has(key)) continue
    seenUrl.add(key)
    merged.push(item)
  }

  // Resolve redirects do Google News → URL real do publisher (em paralelo, timeout 4s cada).
  // Sem isso o web_fetch do Haiku não consegue ler o corpo da matéria.
  const resolveStart = Date.now()
  const urlsResolved = await resolveGoogleNewsUrls(merged.map((i) => i.url), 6)
  const candidates: FeedItem[] = merged.map((item, idx) => ({ ...item, url: urlsResolved[idx] ?? item.url }))
  const resolvedCount = candidates.filter((c, i) => c.url !== merged[i].url).length
  console.log(`[pipeline] stage0+1 merged: ${candidates.length} únicos (rss=${rssItems.length} claude=${claudeItems.length}) — ${resolvedCount} redirects resolvidos em ${Date.now() - resolveStart}ms`)

  if (candidates.length === 0) {
    return {
      ideas: [],
      usage: { ...empty, ...claudeDiscoveryUsage },
    }
  }

  // Stage 2 — triagem: 1 call por termo em paralelo (concurrency=2 pra não estourar rate limit)
  const triage = await runTriagePhaseParallel({ candidates, termIntents, userId, concurrency: 2 })
  console.log(`[pipeline] stage2: ${triage.items.length} qualificados de ${candidates.length}`)
  if (triage.items.length === 0) {
    return {
      ideas: [],
      usage: {
        ...empty,
        inputTokens: claudeDiscoveryUsage.inputTokens + triage.usage.inputTokens,
        outputTokens: claudeDiscoveryUsage.outputTokens + triage.usage.outputTokens,
        cacheReadTokens: claudeDiscoveryUsage.cacheReadTokens + triage.usage.cacheReadTokens,
        cacheCreationTokens: claudeDiscoveryUsage.cacheCreationTokens + triage.usage.cacheCreationTokens,
        searchesUsed: claudeDiscoveryUsage.searchesUsed,
        fetchesUsed: triage.usage.fetchesUsed,
        candidatesFromRss: candidates.length,
      },
    }
  }

  // Stage 3 — aprofundamento paralelo por termo
  const deep = await runDeepResearchPhaseParallel({ qualified: triage.items, termIntents, userId, concurrency: 2 })
  console.log(`[pipeline] stage3: ${deep.sources.length} fontes de apoio`)

  // Persiste primários
  const primaryToEvId = new Map<number, string>()
  for (let idx = 0; idx < triage.items.length; idx++) {
    const it = triage.items[idx]
    try {
      const saved = await db.newsEvidence.upsert({
        where: { userId_url: { userId, url: it.canonicalUrl } },
        update: { title: it.title, summary: it.summary, keyQuote: it.keyQuote, relevanceScore: it.relevanceScore, freshnessHours: it.freshnessHours },
        create: {
          userId, term: it.candidate.term, url: it.canonicalUrl, title: it.title,
          publishedAt: safeDate(it.publishedAt),
          summary: it.summary, keyQuote: it.keyQuote,
          sourceAuthority: it.sourceAuthority, language: it.language,
          relevanceScore: it.relevanceScore, freshnessHours: it.freshnessHours,
        },
      })
      primaryToEvId.set(idx, saved.id)
    } catch (err) { console.warn("[primary upsert fail]", (err as Error).message) }
  }

  // Persiste apoios
  const supportingIdsByPrimary = new Map<number, string[]>()
  for (const s of deep.sources) {
    try {
      const saved = await db.newsEvidence.upsert({
        where: { userId_url: { userId, url: s.url } },
        update: { title: s.title, summary: s.summary, keyQuote: s.keyQuote, relevanceScore: s.agreementScore },
        create: {
          userId, term: s.primary.candidate.term, url: s.url, title: s.title,
          publishedAt: safeDate(s.publishedAt),
          summary: s.summary, keyQuote: s.keyQuote,
          sourceAuthority: s.sourceAuthority, language: s.language,
          relevanceScore: s.agreementScore, freshnessHours: s.primary.freshnessHours,
        },
      })
      const arr = supportingIdsByPrimary.get(s.primaryIndex) ?? []
      arr.push(saved.id)
      supportingIdsByPrimary.set(s.primaryIndex, arr)
    } catch (err) { console.warn("[supporting upsert fail]", (err as Error).message) }
  }

  // Stage 4 — narrativa
  const groups: NarrativeGroup[] = triage.items.map((primary, idx) => ({
    primary, supporting: deep.sources.filter((s) => s.primaryIndex === idx),
  }))
  const narr = await runNarrativePhase({ groups, userId })
  console.log(`[pipeline] stage4: ${narr.ideas.length} ideias`)

  const ideas: ResearchedIdea[] = []
  for (const i of narr.ideas) {
    const evId = primaryToEvId.get(i.groupIndex)
    if (!evId) continue
    const supIds = supportingIdsByPrimary.get(i.groupIndex) ?? []
    const p = i.group.primary
    const metrics = computeViralMetrics(i.group)
    ideas.push({
      title: i.title, summary: i.summary, angle: i.angle, hook: i.hook,
      term: p.candidate.term, relevance: i.relevance,
      sourceUrl: p.canonicalUrl, sourceTitle: p.title,
      publishedAt: p.publishedAt, language: p.language,
      pioneerScore: Math.max(0, Math.min(100, Math.round(i.pioneerScore))),
      evidenceId: evId, evidenceQuote: i.evidenceQuote,
      supportingEvidenceIds: supIds,
      viralScore: metrics.viralScore,
      publisherHosts: metrics.publisherHosts,
      hasInternationalCoverage: metrics.hasInternationalCoverage,
      platformFit: {
        reels: Math.max(0, Math.min(100, Math.round(i.platformFit?.reels ?? 50))),
        shorts: Math.max(0, Math.min(100, Math.round(i.platformFit?.shorts ?? 50))),
        long: Math.max(0, Math.min(100, Math.round(i.platformFit?.long ?? 50))),
        tiktok: Math.max(0, Math.min(100, Math.round(i.platformFit?.tiktok ?? 50))),
      },
    })
  }

  const processedIds = [...primaryToEvId.values(), ...[...supportingIdsByPrimary.values()].flat()]
  if (processedIds.length > 0) {
    await db.newsEvidence.updateMany({ where: { id: { in: processedIds } }, data: { processed: true } })
  }

  return {
    ideas,
    usage: {
      inputTokens: claudeDiscoveryUsage.inputTokens + triage.usage.inputTokens + deep.usage.inputTokens + narr.usage.inputTokens,
      outputTokens: claudeDiscoveryUsage.outputTokens + triage.usage.outputTokens + deep.usage.outputTokens + narr.usage.outputTokens,
      cacheReadTokens: claudeDiscoveryUsage.cacheReadTokens + triage.usage.cacheReadTokens + deep.usage.cacheReadTokens + narr.usage.cacheReadTokens,
      cacheCreationTokens: claudeDiscoveryUsage.cacheCreationTokens + triage.usage.cacheCreationTokens + deep.usage.cacheCreationTokens + narr.usage.cacheCreationTokens,
      searchesUsed: claudeDiscoveryUsage.searchesUsed + deep.usage.searchesUsed,
      fetchesUsed: triage.usage.fetchesUsed + deep.usage.fetchesUsed,
      evidencesCaptured: primaryToEvId.size + [...supportingIdsByPrimary.values()].flat().length,
      candidatesFromRss: candidates.length,
      qualifiedAfterTriage: triage.items.length,
      supportingFound: deep.sources.length,
    },
  }
}


// ─── Usage tracking (model-aware) ──────────────────────────────────────

export async function trackUsage(
  model: ModelId,
  action: string,
  inputTokens: number,
  outputTokens: number,
  durationMs: number,
  userId?: string,
  extra?: Record<string, number>,
) {
  const pricing = MODELS[model] ?? MODELS["claude-sonnet-4-6"]
  const costUsd = inputTokens * pricing.input + outputTokens * pricing.output
  try {
    const uid = userId || (await db.user.findFirst({ select: { id: true } }))?.id
    if (!uid) return
    await db.apiUsage.create({
      data: {
        action: extra ? `${action}:${JSON.stringify(extra)}` : action,
        model,
        inputTokens,
        outputTokens,
        costUsd,
        durationMs,
        userId: uid,
      },
    })
  } catch {}
}

