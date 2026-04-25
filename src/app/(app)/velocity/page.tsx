import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import { VelocityClient } from "./VelocityClient"

export const metadata = { title: "Velocity · Content Hub" }

export default async function VelocityPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  // Vídeos do user (origin=own) com snapshots nos últimos 7 dias.
  // Pega o snapshot mais recente de cada vídeo + a curva pra desenhar
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000)
  const allSnapshots = await db.videoSnapshot.findMany({
    where: {
      userId: session.user.id,
      origin: "own",
      publishedAt: { gte: sevenDaysAgo },
    },
    orderBy: { takenAt: "asc" },
  })

  // Agrupa por videoId
  const byVideo: Record<string, typeof allSnapshots> = {}
  for (const s of allSnapshots) {
    const list = byVideo[s.videoId] ?? []
    list.push(s)
    byVideo[s.videoId] = list
  }

  const videos = Object.entries(byVideo)
    .map(([videoId, snaps]) => {
      const latest = snaps[snaps.length - 1]
      return {
        videoId,
        title: latest.videoTitle,
        thumbnailUrl: latest.thumbnailUrl,
        publishedAt: latest.publishedAt.toISOString(),
        latestViews: Number(latest.views),
        latestVPH: latest.viewsPerHour,
        multiplier: latest.outlierMultiplier,
        durationSec: latest.durationSec,
        history: snaps.map((s) => ({
          takenAt: s.takenAt.toISOString(),
          views: Number(s.views),
          viewsPerHour: s.viewsPerHour,
        })),
      }
    })
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())

  // Tem canal conectado?
  const hasConnection = await db.platformConnection.count({
    where: { userId: session.user.id, isActive: true, platform: "youtube" },
  })

  return <VelocityClient videos={videos} hasConnection={hasConnection > 0} />
}
