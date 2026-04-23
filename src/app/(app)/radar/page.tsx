import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import { RadarClient, type RadarEvidence } from "./RadarClient"

export const metadata = { title: "Radar · Content Hub" }

// Força re-execução em cada request (sempre fresh quando usuário navega).
// Combinado com router.refresh() auto do client, o radar fica vivo.
export const dynamic = "force-dynamic"

export default async function RadarPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")
  const userId = session.user.id

  const [evidences, totalCount, processedCount, byTerm] = await Promise.all([
    db.newsEvidence.findMany({
      where: { userId },
      include: { ideas: { select: { id: true, title: true } } },
      orderBy: [{ capturedAt: "desc" }],
      take: 200,
    }),
    db.newsEvidence.count({ where: { userId } }),
    db.newsEvidence.count({ where: { userId, processed: true } }),
    db.newsEvidence.groupBy({
      by: ["term"],
      where: { userId },
      _count: { _all: true },
      orderBy: { _count: { term: "desc" } },
    }),
  ])

  const serializable: RadarEvidence[] = evidences.map((e) => ({
    id: e.id,
    term: e.term,
    url: e.url,
    title: e.title,
    publishedAt: e.publishedAt ? e.publishedAt.toISOString() : null,
    summary: e.summary,
    keyQuote: e.keyQuote,
    sourceAuthority: e.sourceAuthority,
    language: e.language,
    relevanceScore: e.relevanceScore,
    freshnessHours: e.freshnessHours,
    processed: e.processed,
    capturedAt: e.capturedAt.toISOString(),
    ideas: e.ideas.map((i) => ({ id: i.id, title: i.title })),
  }))

  const termCounts = byTerm.map((b) => ({ term: b.term, count: b._count._all }))

  return (
    <RadarClient
      evidences={serializable}
      totalCount={totalCount}
      processedCount={processedCount}
      termCounts={termCounts}
    />
  )
}
