import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"

export async function POST() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Não autorizado" }, { status: 401 })

  const userId = session.user.id
  const terms = await db.monitorTerm.findMany({ where: { userId, isActive: true } })
  const termNames = terms.map((t) => t.term)

  if (termNames.length === 0) return NextResponse.json({ error: "Sem termos" }, { status: 400 })

  const ideas = await db.ideaFeed.findMany({ where: { userId, isDiscarded: false } })

  let fixed = 0
  for (const idea of ideas) {
    // Skip if already matches a monitored term
    if (termNames.includes(idea.term)) continue

    const ideaText = `${idea.term} ${idea.title} ${idea.summary || ""}`.toLowerCase()

    let matched = termNames.find((t) => {
      const words = t.toLowerCase().split(/\s+/)
      return words.some((w) => w.length >= 2 && ideaText.includes(w))
    })

    if (!matched) {
      const ideaWords = idea.term.toLowerCase().split(/\s+/)
      matched = termNames.find((t) => ideaWords.some((w) => w.length >= 2 && t.toLowerCase().includes(w)))
    }

    if (matched) {
      await db.ideaFeed.update({ where: { id: idea.id }, data: { term: matched } })
      fixed++
    }
  }

  const allIdeas = await db.ideaFeed.findMany({ where: { userId, isDiscarded: false }, orderBy: { createdAt: "desc" }, take: 100 })
  return NextResponse.json({ ok: true, fixed, ideas: allIdeas })
}
