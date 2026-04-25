// Velocity Watch — vídeos do user publicados nos últimos 7 dias.
// Roda mais frequentemente que o snapshot diário do canal pra ver aceleração:
// "tá pegando" (views/h crescendo) vs "morreu" (views/h caindo) vs "platôu".
//
// Usa OAuth (PlatformConnection) — diferente do Competitor que usa API key.

import { db } from "@/lib/db"
import { fetchRecentVideos, getValidAccessToken } from "./youtube-data.service"

export type VelocityResult = {
  connectionId: string
  channelName: string
  ok: boolean
  videosTracked: number
  newSnapshots: number
  alerts: Array<{
    videoId: string
    title: string
    status: "accelerating" | "stable" | "decelerating" | "viral"
    viewsPerHour: number
    multiplier: number | null
    thumbnailUrl: string | null
  }>
  error?: string
}

// Pega vídeos publicados nos últimos N dias e cria snapshots.
// Calcula viewsPerHour vs snapshot anterior + classifica status.
export async function pollVelocityForConnection(connectionId: string): Promise<VelocityResult> {
  const result: VelocityResult = {
    connectionId,
    channelName: "",
    ok: false,
    videosTracked: 0,
    newSnapshots: 0,
    alerts: [],
  }

  try {
    const conn = await db.platformConnection.findUnique({ where: { id: connectionId } })
    if (!conn || !conn.isActive) {
      result.error = "Connection inativa"
      return result
    }
    result.channelName = conn.externalName

    if (conn.platform !== "youtube") {
      result.error = `Plataforma ${conn.platform} não suportada`
      return result
    }

    const accessToken = await getValidAccessToken(conn.id)

    // Pega últimos 25 vídeos do canal
    const recent = await fetchRecentVideos(conn.externalId, accessToken, 25)
    if (recent.length === 0) {
      result.ok = true
      return result
    }

    // Filtra vídeos dos últimos 7 dias (window de "quente")
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000)
    const hot = recent.filter((v) => new Date(v.publishedAt) >= sevenDaysAgo)
    if (hot.length === 0) {
      result.ok = true
      return result
    }
    result.videosTracked = hot.length

    // Mediana de viewsPerHour de vídeos do user (últimos 30 dias) pra benchmark
    const benchmarkSince = new Date(Date.now() - 30 * 24 * 3600 * 1000)
    const benchmark = await db.videoSnapshot.findMany({
      where: {
        userId: conn.userId,
        origin: "own",
        takenAt: { gte: benchmarkSince },
        viewsPerHour: { not: null },
      },
      select: { viewsPerHour: true },
    })
    const benchmarkSorted = benchmark
      .map((b) => b.viewsPerHour ?? 0)
      .filter((v) => v > 0)
      .sort((a, b) => a - b)
    const medianVPH = benchmarkSorted.length >= 5
      ? benchmarkSorted[Math.floor(benchmarkSorted.length / 2)]
      : null

    // Cria snapshots
    for (const v of hot) {
      const prev = await db.videoSnapshot.findFirst({
        where: { videoId: v.videoId, userId: conn.userId, origin: "own" },
        orderBy: { takenAt: "desc" },
      })

      let viewsPerHour: number | null = null
      if (prev) {
        const hoursDelta = (Date.now() - prev.takenAt.getTime()) / 3_600_000
        if (hoursDelta > 0.1) {
          viewsPerHour = (v.views - Number(prev.views)) / hoursDelta
        }
      } else {
        // Primeiro snapshot — estima baseado em views totais e tempo de vida
        const ageHours = (Date.now() - new Date(v.publishedAt).getTime()) / 3_600_000
        if (ageHours > 0) viewsPerHour = v.views / ageHours
        result.newSnapshots++
      }

      const multiplier = medianVPH && viewsPerHour ? viewsPerHour / medianVPH : null

      await db.videoSnapshot.create({
        data: {
          userId: conn.userId,
          origin: "own",
          videoId: v.videoId,
          videoTitle: v.title,
          channelId: conn.externalId,
          publishedAt: new Date(v.publishedAt),
          durationSec: v.durationSec,
          thumbnailUrl: v.thumbnailUrl,
          views: BigInt(v.views),
          likes: v.likes,
          comments: v.comments,
          viewsPerHour,
          outlierMultiplier: multiplier,
        },
      })

      // Classifica status
      let status: VelocityResult["alerts"][0]["status"] = "stable"
      if (multiplier != null) {
        if (multiplier >= 4.0) status = "viral"
        else if (multiplier >= 1.3) status = "accelerating"
        else if (multiplier <= 0.5) status = "decelerating"
      }

      // Só inclui em alerts se for status interessante
      if (status === "viral" || status === "accelerating" || status === "decelerating") {
        result.alerts.push({
          videoId: v.videoId,
          title: v.title,
          status,
          viewsPerHour: viewsPerHour ?? 0,
          multiplier,
          thumbnailUrl: v.thumbnailUrl,
        })
      }
    }

    result.ok = true
  } catch (err) {
    result.error = err instanceof Error ? err.message : "erro"
    console.error(`[velocity] ${connectionId}:`, err)
  }

  return result
}

// Pra todos os connections ativos
export async function pollVelocityAllUsers(): Promise<{
  connectionsProcessed: number
  videosTracked: number
  alertsRaised: number
  errors: number
}> {
  const conns = await db.platformConnection.findMany({ where: { isActive: true } })
  let videosTracked = 0
  let alertsRaised = 0
  let errors = 0
  for (const c of conns) {
    const r = await pollVelocityForConnection(c.id)
    videosTracked += r.videosTracked
    alertsRaised += r.alerts.length
    if (!r.ok) errors++
  }
  return { connectionsProcessed: conns.length, videosTracked, alertsRaised, errors }
}
