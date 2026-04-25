// YouTube Data API + Analytics API — wrapper só com fetch direto.
//
// Auto-refresh de token: cada chamada usa getValidAccessToken() que checa
// expiresAt e refresha se necessário, persistindo o novo token.
//
// Endpoints usados:
// - GET https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true
// - GET https://www.googleapis.com/youtube/v3/search?channelId=...&order=date
// - GET https://www.googleapis.com/youtube/v3/videos?id=...&part=statistics,contentDetails
// - GET https://youtubeanalytics.googleapis.com/v2/reports?...

import { db } from "@/lib/db"
import { refreshAccessToken } from "./youtube-oauth.service"

const DATA_BASE = "https://www.googleapis.com/youtube/v3"
const ANALYTICS_BASE = "https://youtubeanalytics.googleapis.com/v2"

// ─── Token management ──────────────────────────────────────────────────

// Pega access_token válido pra uma PlatformConnection. Se expirou, refresha.
export async function getValidAccessToken(connectionId: string): Promise<string> {
  const conn = await db.platformConnection.findUnique({ where: { id: connectionId } })
  if (!conn) throw new Error("PlatformConnection não encontrada")
  if (!conn.isActive) throw new Error("PlatformConnection inativa")

  // Se expira em mais de 60s, usa o atual
  const now = Date.now()
  const expiresAt = conn.expiresAt?.getTime() ?? 0
  if (expiresAt > now + 60_000) return conn.accessToken

  // Senão refresha
  if (!conn.refreshToken) {
    throw new Error("Token expirado e sem refresh_token — usuário precisa reconectar YouTube")
  }
  const refreshed = await refreshAccessToken(conn.refreshToken)
  await db.platformConnection.update({
    where: { id: connectionId },
    data: {
      accessToken: refreshed.accessToken,
      expiresAt: new Date(Date.now() + refreshed.expiresIn * 1000),
      scope: refreshed.scope,
    },
  })
  return refreshed.accessToken
}

// Helper genérico de fetch autenticado
async function ytFetch<T>(url: string, accessToken: string): Promise<T> {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => "")
    throw new Error(`YouTube API ${res.status}: ${body.slice(0, 400)}`)
  }
  return (await res.json()) as T
}

// ─── Channel info (canal do user logado) ──────────────────────────────

export type ChannelInfo = {
  channelId: string
  title: string
  description: string
  thumbnailUrl: string | null
  customUrl: string | null  // @handle
  publishedAt: string
  country: string | null
  subscribers: number
  totalViews: number
  videoCount: number
}

export async function fetchOwnChannelInfo(accessToken: string): Promise<ChannelInfo | null> {
  type R = {
    items?: Array<{
      id: string
      snippet: {
        title: string
        description: string
        publishedAt: string
        country?: string
        thumbnails?: { high?: { url: string }; medium?: { url: string }; default?: { url: string } }
        customUrl?: string
      }
      statistics: { subscriberCount?: string; viewCount?: string; videoCount?: string }
    }>
  }
  const url = `${DATA_BASE}/channels?part=snippet,statistics&mine=true`
  const body = await ytFetch<R>(url, accessToken)
  const item = body.items?.[0]
  if (!item) return null
  const thumbs = item.snippet.thumbnails
  return {
    channelId: item.id,
    title: item.snippet.title,
    description: item.snippet.description ?? "",
    thumbnailUrl: thumbs?.high?.url ?? thumbs?.medium?.url ?? thumbs?.default?.url ?? null,
    customUrl: item.snippet.customUrl ?? null,
    publishedAt: item.snippet.publishedAt,
    country: item.snippet.country ?? null,
    subscribers: Number(item.statistics.subscriberCount ?? 0),
    totalViews: Number(item.statistics.viewCount ?? 0),
    videoCount: Number(item.statistics.videoCount ?? 0),
  }
}

// Busca info de UM canal específico por ID (usado pra refrescar snapshot)
export async function fetchChannelStats(channelId: string, accessToken: string): Promise<{
  subscribers: number
  totalViews: number
  videoCount: number
} | null> {
  type R = { items?: Array<{ statistics: { subscriberCount?: string; viewCount?: string; videoCount?: string } }> }
  const url = `${DATA_BASE}/channels?part=statistics&id=${encodeURIComponent(channelId)}`
  const body = await ytFetch<R>(url, accessToken)
  const stats = body.items?.[0]?.statistics
  if (!stats) return null
  return {
    subscribers: Number(stats.subscriberCount ?? 0),
    totalViews: Number(stats.viewCount ?? 0),
    videoCount: Number(stats.videoCount ?? 0),
  }
}

// ─── Recent videos (uploads do canal) ─────────────────────────────────

export type RecentVideo = {
  videoId: string
  title: string
  description: string
  publishedAt: string
  thumbnailUrl: string | null
  views: number
  likes: number
  comments: number
  durationSec: number | null
}

export async function fetchRecentVideos(channelId: string, accessToken: string, limit = 20): Promise<RecentVideo[]> {
  // Step 1: search por canal pra pegar IDs em ordem decrescente de data
  type SearchR = {
    items?: Array<{
      id: { videoId: string }
      snippet: { title: string; description: string; publishedAt: string; thumbnails?: { high?: { url: string } } }
    }>
  }
  const searchUrl = `${DATA_BASE}/search?part=snippet&channelId=${encodeURIComponent(channelId)}&order=date&type=video&maxResults=${Math.min(limit, 50)}`
  const search = await ytFetch<SearchR>(searchUrl, accessToken)
  const items = search.items ?? []
  if (items.length === 0) return []

  const videoIds = items.map((i) => i.id.videoId).filter(Boolean)

  // Step 2: videos.list pra pegar statistics + duration
  type VideosR = {
    items?: Array<{
      id: string
      contentDetails: { duration: string }
      statistics: { viewCount?: string; likeCount?: string; commentCount?: string }
    }>
  }
  const videosUrl = `${DATA_BASE}/videos?part=contentDetails,statistics&id=${videoIds.join(",")}`
  const videos = await ytFetch<VideosR>(videosUrl, accessToken)
  const byId = new Map(videos.items?.map((v) => [v.id, v]) ?? [])

  return items.map((it) => {
    const stat = byId.get(it.id.videoId)
    return {
      videoId: it.id.videoId,
      title: it.snippet.title,
      description: it.snippet.description,
      publishedAt: it.snippet.publishedAt,
      thumbnailUrl: it.snippet.thumbnails?.high?.url ?? null,
      views: Number(stat?.statistics.viewCount ?? 0),
      likes: Number(stat?.statistics.likeCount ?? 0),
      comments: Number(stat?.statistics.commentCount ?? 0),
      durationSec: stat ? parseIso8601Duration(stat.contentDetails.duration) : null,
    }
  })
}

// PT8M30S → 510 segundos
function parseIso8601Duration(d: string): number | null {
  const m = d.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
  if (!m) return null
  const h = Number(m[1] ?? 0)
  const min = Number(m[2] ?? 0)
  const sec = Number(m[3] ?? 0)
  return h * 3600 + min * 60 + sec
}

// ─── Analytics (retention/demographics — só funciona pro próprio canal) ─

export type ChannelAnalyticsSummary = {
  views: number
  estimatedMinutesWatched: number
  averageViewDuration: number
  averageViewPercentage: number
  subscribersGained: number
  subscribersLost: number
  daysAnalyzed: number
}

// Sumário de N dias
export async function fetchChannelAnalyticsSummary(opts: {
  channelId: string
  accessToken: string
  days?: number
}): Promise<ChannelAnalyticsSummary | null> {
  const { channelId, accessToken, days = 30 } = opts
  const endDate = new Date().toISOString().split("T")[0]
  const startDate = new Date(Date.now() - days * 24 * 3600 * 1000).toISOString().split("T")[0]

  type R = {
    rows?: Array<number[]>
    columnHeaders?: Array<{ name: string }>
  }
  const params = new URLSearchParams({
    ids: `channel==${channelId}`,
    startDate,
    endDate,
    metrics: "views,estimatedMinutesWatched,averageViewDuration,averageViewPercentage,subscribersGained,subscribersLost",
  })
  const url = `${ANALYTICS_BASE}/reports?${params.toString()}`
  try {
    const body = await ytFetch<R>(url, accessToken)
    const row = body.rows?.[0]
    if (!row) return null
    return {
      views: row[0] ?? 0,
      estimatedMinutesWatched: row[1] ?? 0,
      averageViewDuration: row[2] ?? 0,
      averageViewPercentage: row[3] ?? 0,
      subscribersGained: row[4] ?? 0,
      subscribersLost: row[5] ?? 0,
      daysAnalyzed: days,
    }
  } catch (err) {
    console.warn(`[yt-analytics] summary falhou:`, err instanceof Error ? err.message : err)
    return null
  }
}
