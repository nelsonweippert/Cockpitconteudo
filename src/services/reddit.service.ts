// Reddit client — lê top posts de subreddits específicos via endpoint JSON público.
// Sem auth, sem rate-limit apertado pra uso casual. User-Agent é OBRIGATÓRIO.
//
// https://www.reddit.com/r/{sub}/top.json?t=day&limit=25
//
// Subreddits mudam o sinal completamente: r/LocalLLaMA é o heartbeat de LLMs
// open-source, r/MachineLearning é mais acadêmico, r/singularity é mais hype.
// Por isso a fonte guarda o path específico (reddit.com/r/X).

export type RedditPost = {
  id: string
  title: string
  url: string                  // link externo ou permalink do post
  permalink: string            // sempre começa com /r/...
  author: string
  subreddit: string
  score: number                // net upvotes
  num_comments: number
  created_utc: number          // unix
  selftext?: string            // texto se for self-post
  is_self: boolean
  link_flair_text?: string | null
  over_18: boolean
}

const UA = "CockpitConteudo/1.0 (by /u/cockpit-bot) — content discovery"

// Parse o host (subreddit path) no formato "reddit.com/r/NomeDoSub" → "NomeDoSub"
export function extractSubreddit(host: string): string | null {
  const m = host.match(/reddit\.com\/r\/([A-Za-z0-9_]+)/i)
  return m ? m[1] : null
}

// Lista top posts de um subreddit no período. "day" é o ideal pro digest diário.
export async function fetchSubredditTop(opts: {
  subreddit: string
  time?: "hour" | "day" | "week" | "month"
  limit?: number
  minScore?: number
}): Promise<RedditPost[]> {
  const { subreddit, time = "day", limit = 25, minScore = 20 } = opts
  const url = `https://www.reddit.com/r/${encodeURIComponent(subreddit)}/top.json?t=${time}&limit=${Math.min(limit, 100)}`

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, "Accept": "application/json" },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) {
      console.warn(`[reddit] HTTP ${res.status} pra r/${subreddit}`)
      return []
    }
    const body = (await res.json()) as { data?: { children?: Array<{ data: RedditPost }> } }
    const children = body.data?.children ?? []
    return children
      .map((c) => c.data)
      .filter((p) => p && !p.over_18 && p.score >= minScore)
  } catch (err) {
    console.warn(`[reddit] falhou pra r/${subreddit}:`, err instanceof Error ? err.message : err)
    return []
  }
}

// Normaliza RedditPost → candidate do pipeline.
// Self-posts (discussão pura) caem com URL apontando pra permalink do reddit;
// link-posts têm URL externa.
export function redditPostToCandidate(p: RedditPost, term: string): {
  term: string
  url: string
  title: string
  snippet: string
  publisher: string
  publishedAt?: string | null
  locale: "pt-BR" | "en-US" | "other"
  sourceOrigin: "reddit"
  upstreamScore: number
} {
  const isExternal = !p.is_self && p.url && !p.url.includes("reddit.com")
  const finalUrl = isExternal ? p.url : `https://www.reddit.com${p.permalink}`
  const publisher = isExternal
    ? new URL(p.url).hostname.replace(/^www\./, "")
    : `r/${p.subreddit}`

  const snippet = isExternal
    ? `${p.score} upvotes · ${p.num_comments} comments em r/${p.subreddit}`
    : `${p.score} upvotes · ${p.num_comments} comments · self-post em r/${p.subreddit}${p.selftext ? " · " + p.selftext.slice(0, 180) : ""}`

  const upstreamScore = Math.min(100, Math.round(p.score * 0.3 + p.num_comments * 0.5))

  return {
    term,
    url: finalUrl,
    title: p.title,
    snippet,
    publisher,
    publishedAt: new Date(p.created_utc * 1000).toISOString(),
    locale: "en-US", // Reddit é majoritariamente inglês; PT-BR subs detectamos depois se precisar
    sourceOrigin: "reddit",
    upstreamScore,
  }
}
