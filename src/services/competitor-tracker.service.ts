// Competitor Tracker — monitora canais externos sem OAuth (só YT Data API key).
//
// Fluxo:
// 1. User adiciona competidor por handle (@nome) ou channelId
// 2. resolveChannel: usa YT API search ou channels?forHandle pra achar channelId
// 3. addCompetitor cria registro
// 4. pollCompetitor (cron diário): refresca stats + busca uploads recentes,
//    persiste VideoSnapshot, calcula outlierMultiplier vs mediana do canal

import { db } from "@/lib/db"

const YT_BASE = "https://www.googleapis.com/youtube/v3"

function getYtKey(): string {
  const k = process.env.YOUTUBE_API_KEY
  if (!k) throw new Error("YOUTUBE_API_KEY não configurada — needed for competitor tracker")
  return k
}

// ─── Resolve channelId a partir de input do user (URL/handle/ID) ──────

export type ResolvedChannel = {
  channelId: string
  title: string
  handle: string | null
  thumbnailUrl: string | null
  subscribers: number | null
  totalViews: number | null
  videoCount: number | null
}

export async function resolveChannel(input: string): Promise<ResolvedChannel | null> {
  const apiKey = getYtKey()
  let candidateId: string | null = null
  let candidateHandle: string | null = null
  const trimmed = input.trim()

  // Limpa URL → extrai handle ou channelId
  if (trimmed.startsWith("http")) {
    const url = (() => { try { return new URL(trimmed) } catch { return null } })()
    if (url) {
      // /channel/UCxxx
      const channelMatch = url.pathname.match(/\/channel\/([A-Za-z0-9_-]+)/)
      if (channelMatch) candidateId = channelMatch[1]
      // /@handle ou /c/customname
      const handleMatch = url.pathname.match(/\/@([A-Za-z0-9._-]+)/) || url.pathname.match(/\/c\/([A-Za-z0-9._-]+)/)
      if (handleMatch) candidateHandle = handleMatch[1]
    }
  } else if (trimmed.startsWith("UC") && trimmed.length >= 20) {
    candidateId = trimmed
  } else if (trimmed.startsWith("@")) {
    candidateHandle = trimmed.slice(1)
  } else {
    candidateHandle = trimmed
  }

  let url: string
  if (candidateId) {
    url = `${YT_BASE}/channels?part=snippet,statistics&id=${candidateId}&key=${apiKey}`
  } else if (candidateHandle) {
    url = `${YT_BASE}/channels?part=snippet,statistics&forHandle=@${encodeURIComponent(candidateHandle)}&key=${apiKey}`
  } else {
    return null
  }

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) })
    if (!res.ok) return null
    const body = (await res.json()) as {
      items?: Array<{
        id: string
        snippet: { title: string; customUrl?: string; thumbnails?: { high?: { url: string }; medium?: { url: string } } }
        statistics: { subscriberCount?: string; viewCount?: string; videoCount?: string }
      }>
    }
    const item = body.items?.[0]
    if (!item) return null
    return {
      channelId: item.id,
      title: item.snippet.title,
      handle: item.snippet.customUrl ?? null,
      thumbnailUrl: item.snippet.thumbnails?.high?.url ?? item.snippet.thumbnails?.medium?.url ?? null,
      subscribers: item.statistics.subscriberCount ? Number(item.statistics.subscriberCount) : null,
      totalViews: item.statistics.viewCount ? Number(item.statistics.viewCount) : null,
      videoCount: item.statistics.videoCount ? Number(item.statistics.videoCount) : null,
    }
  } catch (err) {
    console.warn("[competitor/resolve]", err instanceof Error ? err.message : err)
    return null
  }
}

// ─── CRUD ──────────────────────────────────────────────────────────────

export async function addCompetitor(userId: string, input: string): Promise<{ ok: true; data: { id: string; channelId: string; name: string } } | { ok: false; error: string }> {
  const resolved = await resolveChannel(input)
  if (!resolved) return { ok: false, error: "Canal não encontrado. Verifica o handle ou URL." }

  // Verifica duplicata
  const existing = await db.competitorChannel.findUnique({
    where: { userId_platform_externalId: { userId, platform: "youtube", externalId: resolved.channelId } },
  })
  if (existing) {
    if (!existing.isActive) {
      // Reativa
      const updated = await db.competitorChannel.update({
        where: { id: existing.id },
        data: { isActive: true, lastSyncAt: new Date() },
      })
      return { ok: true, data: { id: updated.id, channelId: updated.externalId, name: updated.externalName } }
    }
    return { ok: false, error: "Esse canal já está sendo monitorado" }
  }

  const created = await db.competitorChannel.create({
    data: {
      userId,
      platform: "youtube",
      externalId: resolved.channelId,
      externalName: resolved.title,
      externalHandle: resolved.handle,
      thumbnailUrl: resolved.thumbnailUrl,
      subscribers: resolved.subscribers != null ? BigInt(resolved.subscribers) : null,
      totalViews: resolved.totalViews != null ? BigInt(resolved.totalViews) : null,
      videoCount: resolved.videoCount,
      lastSyncAt: new Date(),
    },
  })
  return { ok: true, data: { id: created.id, channelId: created.externalId, name: created.externalName } }
}

export async function removeCompetitor(userId: string, competitorId: string): Promise<boolean> {
  const c = await db.competitorChannel.findFirst({ where: { id: competitorId, userId } })
  if (!c) return false
  await db.competitorChannel.update({ where: { id: c.id }, data: { isActive: false } })
  return true
}

// ─── Polling: stats + uploads recentes ─────────────────────────────────

// Busca uploads recentes de um canal (sem OAuth — só API key)
async function fetchCompetitorRecentUploads(channelId: string, limit = 10): Promise<Array<{
  videoId: string
  title: string
  publishedAt: string
  thumbnailUrl: string | null
}>> {
  const apiKey = getYtKey()
  type R = {
    items?: Array<{
      id: { videoId: string }
      snippet: { title: string; publishedAt: string; thumbnails?: { high?: { url: string } } }
    }>
  }
  const url = `${YT_BASE}/search?key=${apiKey}&part=snippet&channelId=${channelId}&order=date&type=video&maxResults=${Math.min(limit, 25)}`
  const res = await fetch(url, { signal: AbortSignal.timeout(10_000) })
  if (!res.ok) throw new Error(`YT search ${res.status}`)
  const body = (await res.json()) as R
  return (body.items ?? []).map((i) => ({
    videoId: i.id.videoId,
    title: i.snippet.title,
    publishedAt: i.snippet.publishedAt,
    thumbnailUrl: i.snippet.thumbnails?.high?.url ?? null,
  }))
}

async function fetchVideosStats(videoIds: string[]): Promise<Map<string, {
  views: number
  likes: number
  comments: number
  durationSec: number | null
}>> {
  if (videoIds.length === 0) return new Map()
  const apiKey = getYtKey()
  type R = {
    items?: Array<{
      id: string
      contentDetails: { duration: string }
      statistics: { viewCount?: string; likeCount?: string; commentCount?: string }
    }>
  }
  const url = `${YT_BASE}/videos?key=${apiKey}&part=contentDetails,statistics&id=${videoIds.join(",")}`
  const res = await fetch(url, { signal: AbortSignal.timeout(10_000) })
  if (!res.ok) throw new Error(`YT videos ${res.status}`)
  const body = (await res.json()) as R
  const m = new Map<string, { views: number; likes: number; comments: number; durationSec: number | null }>()
  for (const v of body.items ?? []) {
    m.set(v.id, {
      views: Number(v.statistics.viewCount ?? 0),
      likes: Number(v.statistics.likeCount ?? 0),
      comments: Number(v.statistics.commentCount ?? 0),
      durationSec: parseIso8601(v.contentDetails.duration),
    })
  }
  return m
}

function parseIso8601(d: string): number | null {
  const m = d.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
  if (!m) return null
  return Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0)
}

// Calcula outlierMultiplier: views do vídeo / mediana de views dos uploads
// recentes do canal (mesma janela). Multiplier > 2 = outlier de fato.
function computeOutlierMultiplier(views: number, comparableViews: number[]): number | null {
  if (comparableViews.length < 3) return null
  const sorted = [...comparableViews].sort((a, b) => a - b)
  const median = sorted[Math.floor(sorted.length / 2)]
  if (median <= 0) return null
  return views / median
}

export type CompetitorPollResult = {
  competitorId: string
  channelName: string
  ok: boolean
  newUploads: number
  outliers: Array<{ videoId: string; title: string; views: number; multiplier: number; thumbnailUrl: string | null }>
  error?: string
}

export async function pollCompetitor(competitorId: string): Promise<CompetitorPollResult> {
  const result: CompetitorPollResult = {
    competitorId,
    channelName: "",
    ok: false,
    newUploads: 0,
    outliers: [],
  }
  try {
    const c = await db.competitorChannel.findUnique({ where: { id: competitorId } })
    if (!c || !c.isActive) {
      result.error = "competitor não encontrado/inativo"
      return result
    }
    result.channelName = c.externalName

    // 1. Stats do canal (refresh)
    const channelStats = await fetch(`${YT_BASE}/channels?key=${getYtKey()}&part=statistics&id=${c.externalId}`, {
      signal: AbortSignal.timeout(10_000),
    }).then((r) => r.ok ? r.json() : null) as { items?: Array<{ statistics: { subscriberCount?: string; viewCount?: string; videoCount?: string } }> } | null
    const stats = channelStats?.items?.[0]?.statistics

    // 2. Uploads recentes
    const uploads = await fetchCompetitorRecentUploads(c.externalId, 12)
    if (uploads.length === 0) {
      await db.competitorChannel.update({ where: { id: c.id }, data: { lastSyncAt: new Date() } })
      result.ok = true
      return result
    }

    const videoStats = await fetchVideosStats(uploads.map((u) => u.videoId))
    const allViews = uploads.map((u) => videoStats.get(u.videoId)?.views ?? 0)

    // 3. Cria snapshots + detecta outliers
    for (const u of uploads) {
      const stat = videoStats.get(u.videoId)
      if (!stat) continue
      const multiplier = computeOutlierMultiplier(stat.views, allViews)

      // Tem snapshot anterior pra calcular viewsPerHour?
      const prev = await db.videoSnapshot.findFirst({
        where: { videoId: u.videoId, userId: c.userId },
        orderBy: { takenAt: "desc" },
      })
      let viewsPerHour: number | null = null
      if (prev) {
        const hoursDelta = (Date.now() - prev.takenAt.getTime()) / 3_600_000
        if (hoursDelta > 0.1) {
          viewsPerHour = (stat.views - Number(prev.views)) / hoursDelta
        }
      } else {
        result.newUploads++
      }

      await db.videoSnapshot.create({
        data: {
          userId: c.userId,
          origin: "competitor",
          competitorChannelId: c.id,
          videoId: u.videoId,
          videoTitle: u.title,
          channelId: c.externalId,
          publishedAt: new Date(u.publishedAt),
          durationSec: stat.durationSec,
          thumbnailUrl: u.thumbnailUrl,
          views: BigInt(stat.views),
          likes: stat.likes,
          comments: stat.comments,
          viewsPerHour,
          outlierMultiplier: multiplier,
        },
      })

      if (multiplier != null && multiplier >= 2.0) {
        result.outliers.push({
          videoId: u.videoId,
          title: u.title,
          views: stat.views,
          multiplier,
          thumbnailUrl: u.thumbnailUrl,
        })
      }
    }

    // 4. Atualiza canal
    await db.competitorChannel.update({
      where: { id: c.id },
      data: {
        lastSyncAt: new Date(),
        subscribers: stats?.subscriberCount ? BigInt(stats.subscriberCount) : c.subscribers,
        totalViews: stats?.viewCount ? BigInt(stats.viewCount) : c.totalViews,
        videoCount: stats?.videoCount ? Number(stats.videoCount) : c.videoCount,
      },
    })

    result.ok = true
  } catch (err) {
    result.error = err instanceof Error ? err.message : "erro"
    console.error(`[competitor/poll] ${competitorId}:`, err)
  }
  return result
}

export async function pollAllCompetitorsForUser(userId: string): Promise<CompetitorPollResult[]> {
  const list = await db.competitorChannel.findMany({ where: { userId, isActive: true } })
  const results: CompetitorPollResult[] = []
  for (const c of list) {
    results.push(await pollCompetitor(c.id))
  }
  return results
}

export async function pollAllCompetitorsAllUsers(): Promise<{
  competitorsProcessed: number
  outliersDetected: number
  errors: number
}> {
  const all = await db.competitorChannel.findMany({ where: { isActive: true } })
  let outliers = 0
  let errors = 0
  for (const c of all) {
    const r = await pollCompetitor(c.id)
    outliers += r.outliers.length
    if (!r.ok) errors++
  }
  return { competitorsProcessed: all.length, outliersDetected: outliers, errors }
}
