// Validação HTTP server-side pra fontes sugeridas pelo Claude.
// Roda DEPOIS do pipeline de 3 estágios pra pegar hallucinations e hosts mortos
// que passaram pelas queries site:.
//
// Checa (em paralelo, timeout 6s por host):
//   1. Host responde? (GET /, redirect follow, status 2xx/3xx)
//   2. Parece publisher real? (tem meta og:site_name OU <article> OU feed RSS)
//   3. Nome do og:site_name bate com o `name` sugerido?
//
// Retorna fonte enriquecida com lastValidatedAt + validationStatus.

export type ValidationStatus = "ok" | "site_name_mismatch" | "not_publisher" | "unreachable" | "error"

export type ValidationResult = {
  status: ValidationStatus
  detectedSiteName?: string | null
  httpStatus?: number | null
  checkedAt: string
  notes?: string
}

const TIMEOUT_MS = 6000
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"

function normalize(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "")
}

async function fetchWithTimeout(url: string, ms = TIMEOUT_MS): Promise<Response> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), ms)
  try {
    return await fetch(url, {
      signal: ctrl.signal,
      redirect: "follow",
      headers: { "User-Agent": UA, "Accept": "text/html,application/xhtml+xml" },
    })
  } finally {
    clearTimeout(t)
  }
}

function looksLikePublisher(html: string): boolean {
  // Heurísticas fracas mas úteis:
  // 1. Tem <article> ou <div class="article"> ou schema NewsArticle
  // 2. Tem <meta property="og:type" content="article|website">
  // 3. Tem feed RSS/Atom referenciado
  // 4. Tem <time> ou <dateline>
  const lower = html.toLowerCase()
  if (/<article[\s>]/.test(lower)) return true
  if (/"@type"\s*:\s*"(news)?article"/i.test(html)) return true
  if (/<link[^>]+type=["']application\/(rss|atom)\+xml["']/i.test(html)) return true
  if (/<meta[^>]+property=["']og:type["'][^>]+content=["'](article|website)["']/i.test(html)) return true
  if (lower.match(/<time[\s>]/g) && lower.match(/<time[\s>]/g)!.length >= 2) return true
  return false
}

function extractOgSiteName(html: string): string | null {
  const m = html.match(/<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i)
  return m ? m[1].trim() : null
}

export async function validateHost(opts: { host: string; expectedName: string }): Promise<ValidationResult> {
  const { host, expectedName } = opts
  const url = `https://${host.replace(/^https?:\/\//, "").replace(/^www\./, "")}/`
  const now = new Date().toISOString()

  try {
    const res = await fetchWithTimeout(url)
    const httpStatus = res.status

    if (!res.ok) {
      return {
        status: "unreachable", httpStatus, checkedAt: now,
        notes: `HTTP ${httpStatus}`,
      }
    }

    const html = (await res.text()).slice(0, 200_000) // cap 200kb pra não explodir memória em sites gigantes

    if (!looksLikePublisher(html)) {
      return {
        status: "not_publisher", httpStatus, checkedAt: now,
        notes: "Sem <article>, schema NewsArticle, feed RSS ou og:type article",
      }
    }

    const detectedSiteName = extractOgSiteName(html)
    if (detectedSiteName && expectedName) {
      const a = normalize(detectedSiteName)
      const b = normalize(expectedName)
      // Se um contém o outro, considera match (ex: "Folha" vs "Folha de São Paulo")
      if (!a.includes(b) && !b.includes(a)) {
        return {
          status: "site_name_mismatch", httpStatus, detectedSiteName, checkedAt: now,
          notes: `og:site_name "${detectedSiteName}" difere de "${expectedName}"`,
        }
      }
    }

    return { status: "ok", httpStatus, detectedSiteName, checkedAt: now }
  } catch (err) {
    return {
      status: "error", checkedAt: now,
      notes: err instanceof Error ? err.message.slice(0, 120) : "erro desconhecido",
    }
  }
}

// Valida lista inteira com concurrency cap
export async function validateHosts(
  items: Array<{ host: string; expectedName: string }>,
  concurrency = 4,
): Promise<Map<string, ValidationResult>> {
  const out = new Map<string, ValidationResult>()
  let cursor = 0
  async function worker() {
    while (true) {
      const i = cursor++
      if (i >= items.length) return
      const { host, expectedName } = items[i]
      out.set(host, await validateHost({ host, expectedName }))
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker))
  return out
}
