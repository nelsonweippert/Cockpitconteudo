// Snapshot diário dos canais conectados. Roda dentro do cron daily-report.
// Pra cada PlatformConnection ativa, busca métricas atuais e cria ChannelSnapshot.
// Falhas são logadas mas não interrompem o pipeline (degradação graciosa).

import { db } from "@/lib/db"
import { fetchChannelStats, getValidAccessToken } from "./youtube-data.service"

export type SnapshotResult = {
  connectionId: string
  platform: string
  channelName: string
  ok: boolean
  error?: string
  delta?: { subs: number; views: number; videos: number }
}

export async function captureSnapshotsForUser(userId: string): Promise<SnapshotResult[]> {
  const connections = await db.platformConnection.findMany({
    where: { userId, isActive: true },
  })

  const results: SnapshotResult[] = []

  for (const conn of connections) {
    const result: SnapshotResult = {
      connectionId: conn.id,
      platform: conn.platform,
      channelName: conn.externalName,
      ok: false,
    }

    try {
      if (conn.platform === "youtube") {
        const accessToken = await getValidAccessToken(conn.id)
        const stats = await fetchChannelStats(conn.externalId, accessToken)
        if (!stats) {
          result.error = "fetchChannelStats retornou null"
          results.push(result)
          continue
        }

        // Snapshot anterior pra calcular delta
        const previous = await db.channelSnapshot.findFirst({
          where: { platformConnectionId: conn.id },
          orderBy: { takenAt: "desc" },
        })

        const created = await db.channelSnapshot.create({
          data: {
            userId,
            platformConnectionId: conn.id,
            subscribers: BigInt(stats.subscribers),
            totalViews: BigInt(stats.totalViews),
            videoCount: stats.videoCount,
          },
        })

        await db.platformConnection.update({
          where: { id: conn.id },
          data: { lastSyncAt: new Date() },
        })

        if (previous) {
          result.delta = {
            subs: stats.subscribers - Number(previous.subscribers),
            views: stats.totalViews - Number(previous.totalViews),
            videos: stats.videoCount - previous.videoCount,
          }
        }

        result.ok = true
        void created
      } else {
        result.error = `Plataforma ${conn.platform} ainda não suportada pra snapshot`
      }
    } catch (err) {
      result.error = err instanceof Error ? err.message : "erro desconhecido"
      console.error(`[channel-snapshot] ${conn.platform} ${conn.externalName}:`, err)
    }

    results.push(result)
  }

  return results
}

// Pra todos users com connections ativas (usado pelo cron)
export async function captureSnapshotsForAllUsers(): Promise<{
  usersProcessed: number
  snapshotsTaken: number
  errors: number
  results: SnapshotResult[]
}> {
  const usersWithConnections = await db.user.findMany({
    where: { platformConnections: { some: { isActive: true } } },
    select: { id: true },
  })

  const allResults: SnapshotResult[] = []
  let snapshotsTaken = 0
  let errors = 0

  for (const u of usersWithConnections) {
    const results = await captureSnapshotsForUser(u.id)
    allResults.push(...results)
    snapshotsTaken += results.filter((r) => r.ok).length
    errors += results.filter((r) => !r.ok).length
  }

  return {
    usersProcessed: usersWithConnections.length,
    snapshotsTaken,
    errors,
    results: allResults,
  }
}
