import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import { CanalClient } from "./CanalClient"

export const metadata = { title: "Canal · Content Hub" }

export default async function CanalPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const connections = await db.platformConnection.findMany({
    where: { userId: session.user.id },
    orderBy: { connectedAt: "desc" },
  })

  // Carrega últimos 30 dias de snapshots por connection
  const since = new Date(Date.now() - 30 * 24 * 3600 * 1000)
  const allSnapshots = await db.channelSnapshot.findMany({
    where: {
      userId: session.user.id,
      takenAt: { gte: since },
    },
    orderBy: { takenAt: "asc" },
  })

  const snapshotsByConnection: Record<string, Array<{
    takenAt: string
    subscribers: number
    totalViews: number
    videoCount: number
  }>> = {}

  for (const s of allSnapshots) {
    const list = snapshotsByConnection[s.platformConnectionId] ?? []
    list.push({
      takenAt: s.takenAt.toISOString(),
      subscribers: Number(s.subscribers),
      totalViews: Number(s.totalViews),
      videoCount: s.videoCount,
    })
    snapshotsByConnection[s.platformConnectionId] = list
  }

  return (
    <CanalClient
      connections={connections.map((c) => ({
        id: c.id,
        platform: c.platform,
        externalId: c.externalId,
        externalName: c.externalName,
        externalHandle: c.externalHandle,
        thumbnailUrl: c.thumbnailUrl,
        isActive: c.isActive,
        connectedAt: c.connectedAt.toISOString(),
        lastSyncAt: c.lastSyncAt?.toISOString() ?? null,
      }))}
      snapshotsByConnection={snapshotsByConnection}
    />
  )
}
