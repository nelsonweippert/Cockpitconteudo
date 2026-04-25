import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import { CompetidoresClient } from "./CompetidoresClient"

export const metadata = { title: "Competidores · Content Hub" }

export default async function CompetidoresPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const competitors = await db.competitorChannel.findMany({
    where: { userId: session.user.id, isActive: true },
    orderBy: { addedAt: "desc" },
  })

  // Últimos outliers (últimas 72h, multiplier >= 2)
  const since = new Date(Date.now() - 72 * 3600 * 1000)
  const recentOutliers = await db.videoSnapshot.findMany({
    where: {
      userId: session.user.id,
      origin: "competitor",
      takenAt: { gte: since },
      outlierMultiplier: { gte: 2.0 },
    },
    orderBy: { takenAt: "desc" },
    take: 12,
  })

  return (
    <CompetidoresClient
      competitors={competitors.map((c) => ({
        id: c.id,
        externalId: c.externalId,
        externalName: c.externalName,
        externalHandle: c.externalHandle,
        thumbnailUrl: c.thumbnailUrl,
        subscribers: c.subscribers != null ? Number(c.subscribers) : null,
        videoCount: c.videoCount,
        notes: c.notes,
        addedAt: c.addedAt.toISOString(),
        lastSyncAt: c.lastSyncAt?.toISOString() ?? null,
      }))}
      outliers={recentOutliers.map((o) => ({
        id: o.id,
        videoId: o.videoId,
        title: o.videoTitle,
        thumbnailUrl: o.thumbnailUrl,
        views: Number(o.views),
        multiplier: o.outlierMultiplier ?? 1,
        publishedAt: o.publishedAt.toISOString(),
        takenAt: o.takenAt.toISOString(),
        competitorChannelId: o.competitorChannelId,
      }))}
    />
  )
}
