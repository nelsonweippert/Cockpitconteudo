import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import { TemasClient, type TermView } from "./TemasClient"

export const metadata = { title: "Temas Monitorados · Content Hub" }
export const dynamic = "force-dynamic"

export default async function TemasPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")
  const userId = session.user.id

  const terms = await db.monitorTerm.findMany({
    where: { userId },
    orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
  })

  // Contagem de evidências/ideias por termo pra dar contexto visual
  const [byTerm, ideasByTerm] = await Promise.all([
    db.newsEvidence.groupBy({
      by: ["term"],
      where: { userId },
      _count: { _all: true },
    }),
    db.ideaFeed.groupBy({
      by: ["term"],
      where: { userId, isDiscarded: false },
      _count: { _all: true },
    }),
  ])
  const evidenceCountByTerm = new Map(byTerm.map((b) => [b.term, b._count._all]))
  const ideaCountByTerm = new Map(ideasByTerm.map((b) => [b.term, b._count._all]))

  const termsSerializable: TermView[] = terms.map((t) => ({
    id: t.id,
    term: t.term,
    intent: t.intent,
    isActive: t.isActive,
    sources: Array.isArray(t.sources) ? (t.sources as unknown[]) : [],
    sourcesUpdatedAt: t.sourcesUpdatedAt ? t.sourcesUpdatedAt.toISOString() : null,
    createdAt: t.createdAt.toISOString(),
    evidenceCount: evidenceCountByTerm.get(t.term) ?? 0,
    ideaCount: ideaCountByTerm.get(t.term) ?? 0,
  }))

  return <TemasClient initialTerms={termsSerializable} />
}
