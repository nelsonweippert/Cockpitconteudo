// GET /api/coach/conversations — lista conversas do user
// POST /api/coach/conversations — cria nova conversa

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"

export const runtime = "nodejs"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ success: false, error: "Não autorizado" }, { status: 401 })
  const userId = session.user.id

  const conversations = await db.coachConversation.findMany({
    where: { userId, archivedAt: null },
    orderBy: { lastMessageAt: "desc" },
    select: {
      id: true,
      title: true,
      lastMessageAt: true,
      _count: { select: { messages: true } },
    },
    take: 50,
  })

  return NextResponse.json({
    success: true,
    data: conversations.map((c) => ({
      id: c.id,
      title: c.title,
      lastMessageAt: c.lastMessageAt.toISOString(),
      messageCount: c._count.messages,
    })),
  })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ success: false, error: "Não autorizado" }, { status: 401 })
  const userId = session.user.id

  let body: { title?: string } = {}
  try { body = await req.json() } catch { /* ok, vai default */ }

  const conv = await db.coachConversation.create({
    data: {
      userId,
      title: body.title?.trim() || "Nova conversa",
    },
  })

  return NextResponse.json({ success: true, data: { id: conv.id, title: conv.title, lastMessageAt: conv.lastMessageAt.toISOString(), messageCount: 0 } })
}
