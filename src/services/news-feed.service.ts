/**
 * News Feed — busca determinística de matérias via Google News RSS.
 * Não usa Claude. Garante que a LISTA de candidatos é externa ao modelo.
 */

export interface FeedItem {
  term: string
  title: string
  url: string           // URL do Google News (redirect)
  pubDate: Date | null
  source: string        // nome do veículo (quando o RSS fornece)
  description: string   // snippet HTML do RSS (não é o corpo)
  locale: "pt-BR" | "en-US"
}

const HTML_ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
}

function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&([a-z]+);/gi, (m, name) => HTML_ENTITIES[name.toLowerCase()] ?? m)
}

function stripHtml(s: string): string {
  return decodeEntities(s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/<[^>]+>/g, "")).trim()
}

function pickTag(block: string, tag: string): string {
  const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i"))
  return m ? stripHtml(m[1]) : ""
}

export async function fetchGoogleNews(
  term: string,
  locale: "pt-BR" | "en-US" = "pt-BR",
  timeoutMs = 8000,
): Promise<FeedItem[]> {
  const params = locale === "pt-BR"
    ? "hl=pt-BR&gl=BR&ceid=BR:pt-419"
    : "hl=en-US&gl=US&ceid=US:en"
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(term)}&${params}`

  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), timeoutMs)
  let xml: string
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { "User-Agent": "Mozilla/5.0 (cockpit-research/1.0)" },
    })
    if (!res.ok) throw new Error(`Google News RSS ${res.status}`)
    xml = await res.text()
  } finally {
    clearTimeout(t)
  }

  const items: FeedItem[] = []
  const blocks = xml.match(/<item>[\s\S]*?<\/item>/g) ?? []
  for (const block of blocks) {
    const title = pickTag(block, "title")
    const link = pickTag(block, "link")
    const pub = pickTag(block, "pubDate")
    const source = pickTag(block, "source")
    const description = pickTag(block, "description")
    if (!title || !link) continue
    const pubDate = pub ? new Date(pub) : null
    items.push({ term, title, url: link, pubDate, source, description, locale })
  }
  return items
}

/** Busca em PT e EN, combina resultados. */
export async function fetchAllFeeds(term: string): Promise<FeedItem[]> {
  const [pt, en] = await Promise.allSettled([
    fetchGoogleNews(term, "pt-BR"),
    fetchGoogleNews(term, "en-US"),
  ])
  const all: FeedItem[] = []
  if (pt.status === "fulfilled") all.push(...pt.value)
  if (en.status === "fulfilled") all.push(...en.value)
  return all
}

/** Remove duplicatas por similaridade de título (primeiros 50 chars normalizados). */
export function titleKey(t: string): string {
  return t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim().slice(0, 60)
}

export function dedupe(items: FeedItem[]): FeedItem[] {
  const seen = new Set<string>()
  const out: FeedItem[] = []
  for (const item of items) {
    const k = titleKey(item.title)
    if (seen.has(k)) continue
    seen.add(k)
    out.push(item)
  }
  return out
}

/** Filtra por freshness (horas desde pubDate) e ordena por recência. */
export function filterAndSort(items: FeedItem[], hoursWindow = 72): FeedItem[] {
  const now = Date.now()
  return items
    .filter((i) => !i.pubDate || (now - i.pubDate.getTime()) / 3600000 <= hoursWindow)
    .sort((a, b) => {
      const ta = a.pubDate?.getTime() ?? 0
      const tb = b.pubDate?.getTime() ?? 0
      return tb - ta
    })
}

/**
 * Resolve redirect do Google News → URL real do publisher.
 * Usa google-news-url-decoder que decodifica o protobuf base64 embutido na URL.
 * Em caso de falha, retorna URL original.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _decoderInstance: any = null
async function getDecoder() {
  if (_decoderInstance) return _decoderInstance
  // @ts-expect-error pacote CommonJS sem types
  const mod = await import("google-news-url-decoder")
  _decoderInstance = new mod.GoogleDecoder()
  return _decoderInstance
}

export async function resolveGoogleNewsUrl(url: string): Promise<string> {
  if (!url.includes("news.google.com")) return url
  try {
    const decoder = await getDecoder()
    const result = await decoder.decode(url)
    if (result && result.status && result.decoded_url && !result.decoded_url.includes("news.google.com")) {
      return result.decoded_url
    }
    return url
  } catch {
    return url
  }
}

/** Resolve lista em paralelo com concurrency cap. */
export async function resolveGoogleNewsUrls(urls: string[], concurrency = 6): Promise<string[]> {
  const out = new Array<string>(urls.length)
  let cursor = 0
  async function worker() {
    while (true) {
      const i = cursor++
      if (i >= urls.length) return
      out[i] = await resolveGoogleNewsUrl(urls[i])
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, urls.length) }, worker))
  return out
}

/** Fluxo completo: todos termos → dedupe global → filtrado → top N por termo. */
export async function discoverCandidates(opts: {
  terms: string[]
  hoursWindow?: number
  perTerm?: number
  perTermEn?: number
}): Promise<FeedItem[]> {
  const { terms, hoursWindow = 72, perTerm = 5, perTermEn = 3 } = opts
  const all: FeedItem[] = []
  for (const term of terms) {
    try {
      const feeds = await fetchAllFeeds(term)
      const ptItems = feeds.filter((f) => f.locale === "pt-BR")
      const enItems = feeds.filter((f) => f.locale === "en-US")
      const fresh = filterAndSort(dedupe([...ptItems, ...enItems]), hoursWindow)
      const pt = fresh.filter((f) => f.locale === "pt-BR").slice(0, perTerm)
      const en = fresh.filter((f) => f.locale === "en-US").slice(0, perTermEn)
      all.push(...pt, ...en)
    } catch (err) {
      console.warn(`[news-feed] term="${term}" error:`, (err as Error).message)
    }
  }
  return dedupe(all) // dedupe final caso termos tenham overlap
}
