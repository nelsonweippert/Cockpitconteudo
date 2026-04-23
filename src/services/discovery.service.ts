// Multi-source discovery orchestrator — por tipo de fonte, fan-out pro cliente certo:
// - PUBLISHER / CURATOR → web_search do Claude com allowed_domains (runDiscoveryPhase)
// - PRIMARY_FORUM (HN) → Algolia search (hn.service)
// - PRIMARY_FORUM (subreddit) → Reddit JSON (reddit.service)
// - PRIMARY_CODE → TODO (skip por ora; requer awareness de repo)
// - PRIMARY_SOCIAL → TODO (Twitter requer auth paga)
//
// Resultado: candidates unificados, dedupe por URL, metadados preservados
// (sourceOrigin + upstreamScore pra fórum/código alimentarem o digest).

import { runDiscoveryPhase } from "./ai.service"
import { searchHackerNews, hnStoryToCandidate } from "./hn.service"
import { fetchSubredditTop, extractSubreddit, redditPostToCandidate } from "./reddit.service"
import { getSourceType, type TermSource } from "@/types/source"

// Candidate unificado (superset do retorno de runDiscoveryPhase).
export type DiscoveryCandidate = {
  term: string
  url: string
  title: string
  snippet: string
  publisher: string
  publishedAt?: string | null
  locale: "pt-BR" | "en-US" | "other"
  // Metadados upstream (só preenchidos quando vem de fonte PRIMARY_*)
  sourceOrigin?: "web_search" | "hn" | "reddit"
  upstreamScore?: number
}

export type MultiDiscoveryUsage = {
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheCreationTokens: number
  searchesUsed: number
  // Novos contadores
  hnQueries: number
  hnResults: number
  redditQueries: number
  redditResults: number
}

export async function runMultiSourceDiscovery(opts: {
  termSources: Record<string, TermSource[]>
  termIntents: Record<string, string>
  userId: string
  hoursWindow?: number
}): Promise<{ candidates: DiscoveryCandidate[]; usage: MultiDiscoveryUsage }> {
  const { termSources, termIntents, userId, hoursWindow = 72 } = opts
  const terms = Object.keys(termSources).filter((t) => termSources[t] && termSources[t].length > 0)

  if (terms.length === 0) {
    return {
      candidates: [],
      usage: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheCreationTokens: 0, searchesUsed: 0, hnQueries: 0, hnResults: 0, redditQueries: 0, redditResults: 0 },
    }
  }

  const usage: MultiDiscoveryUsage = {
    inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheCreationTokens: 0, searchesUsed: 0,
    hnQueries: 0, hnResults: 0, redditQueries: 0, redditResults: 0,
  }

  const allCandidates: DiscoveryCandidate[] = []

  // ═══ 1. HACKER NEWS ═══
  // Um search por termo (HN é global, basta o keyword). Só busca se o termo tem fonte HN ativa.
  const hnPromises: Promise<void>[] = []
  for (const term of terms) {
    const hasHN = termSources[term].some(
      (s) => getSourceType(s) === "PRIMARY_FORUM" && s.host.includes("news.ycombinator.com") && s.isActive,
    )
    if (!hasHN) continue
    hnPromises.push(
      (async () => {
        usage.hnQueries++
        const stories = await searchHackerNews({ query: term, hoursWindow, minPoints: 10, limit: 15 })
        usage.hnResults += stories.length
        for (const s of stories) {
          const c = hnStoryToCandidate(s, term)
          allCandidates.push({ ...c, sourceOrigin: c.sourceOrigin })
        }
      })(),
    )
  }

  // ═══ 2. REDDIT (subreddits específicos) ═══
  const redditPromises: Promise<void>[] = []
  for (const term of terms) {
    const subs = termSources[term]
      .filter((s) => getSourceType(s) === "PRIMARY_FORUM" && s.isActive && s.host.includes("reddit.com"))
      .map((s) => extractSubreddit(s.host))
      .filter((s): s is string => s !== null)

    for (const sub of subs) {
      redditPromises.push(
        (async () => {
          usage.redditQueries++
          const posts = await fetchSubredditTop({ subreddit: sub, time: "day", limit: 15, minScore: 20 })
          // Keyword filter: título deve conter o termo (case-insensitive, qualquer palavra)
          const termLower = term.toLowerCase()
          const termWords = termLower.split(/\s+/).filter((w) => w.length >= 3)
          const filtered = posts.filter((p) => {
            const t = p.title.toLowerCase()
            return termWords.some((w) => t.includes(w))
          })
          usage.redditResults += filtered.length
          for (const p of filtered) {
            const c = redditPostToCandidate(p, term)
            allCandidates.push({ ...c, sourceOrigin: c.sourceOrigin })
          }
        })(),
      )
    }
  }

  // Roda HN + Reddit em paralelo
  await Promise.all([...hnPromises, ...redditPromises])

  // ═══ 3. PUBLISHER / CURATOR via web_search do Claude ═══
  // Monta sourcesByTerm só com hosts de publisher/curator (domínio raiz, sem path)
  const webSearchSourcesByTerm: Record<string, string[]> = {}
  const termsForWebSearch: string[] = []
  for (const term of terms) {
    const hosts = termSources[term]
      .filter((s) => {
        const t = getSourceType(s)
        return (t === "PUBLISHER" || t === "CURATOR") && s.isActive
      })
      .map((s) => s.host.replace(/\/+.*$/, "")) // garante que não tem path
    if (hosts.length > 0) {
      webSearchSourcesByTerm[term] = hosts
      termsForWebSearch.push(term)
    }
  }

  if (termsForWebSearch.length > 0) {
    const webIntents: Record<string, string> = {}
    for (const t of termsForWebSearch) if (termIntents[t]) webIntents[t] = termIntents[t]

    const web = await runDiscoveryPhase({
      terms: termsForWebSearch,
      termIntents: webIntents,
      sourcesByTerm: webSearchSourcesByTerm,
      userId,
    })
    usage.inputTokens += web.usage.inputTokens
    usage.outputTokens += web.usage.outputTokens
    usage.cacheReadTokens += web.usage.cacheReadTokens
    usage.cacheCreationTokens += web.usage.cacheCreationTokens
    usage.searchesUsed += web.usage.searchesUsed

    for (const c of web.candidates) {
      allCandidates.push({
        term: c.term,
        url: c.url,
        title: c.title,
        snippet: c.snippet,
        publisher: c.publisher,
        publishedAt: c.publishedAt ?? null,
        locale: c.locale === "en-US" ? "en-US" : c.locale === "pt-BR" ? "pt-BR" : "other",
        sourceOrigin: "web_search",
      })
    }
  }

  // ═══ 4. Dedup por URL (case-insensitive, sem trailing slash) ═══
  const seen = new Set<string>()
  const deduped: DiscoveryCandidate[] = []
  for (const c of allCandidates) {
    const key = c.url.toLowerCase().replace(/\/+$/, "")
    if (seen.has(key)) continue
    seen.add(key)
    deduped.push(c)
  }

  console.log(`[multi-discovery] terms=${terms.length} candidates=${deduped.length} (hn=${usage.hnResults}, reddit=${usage.redditResults}, web=${allCandidates.length - usage.hnResults - usage.redditResults - (allCandidates.length - usage.hnResults - usage.redditResults)}). searches=${usage.searchesUsed}`)

  return { candidates: deduped, usage }
}
