// GET /api/coach/conversations/[id] — conversa + mensagens
// DELETE /api/coach/conversations/[id] — soft archive
// PATCH /api/coach/conversations/[id] — renomeia título

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"

export const runtime = "nodejs"

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ success: false, error: "Não autorizado" }, { status: 401 })
  const userId = session.user.id
  const { id } = await params

  const conv = await db.coachConversation.findFirst({
    where: { id, userId },
    include: {
      messages: { orderBy: { createdAt: "asc" } },
    },
  })
  if (!conv) return NextResponse.json({ success: false, error: "Conversa não encontrada" }, { status: 404 })

  return NextResponse.json({
    success: true,
    data: {
      id: conv.id,
      title: conv.title,
      lastMessageAt: conv.lastMessageAt.toISOString(),
      messages: conv.messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        createdAt: m.createdAt.toISOString(),
      })),
    },
  })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ success: false, error: "Não autorizado" }, { status: 401 })
  const userId = session.user.id
  const { id } = await params

  const conv = await db.coachConversation.findFirst({ where: { id, userId } })
  if (!conv) return NextResponse.json({ success: false, error: "Conversa não encontrada" }, { status: 404 })

  await db.coachConversation.update({ where: { id }, data: { archivedAt: new Date() } })
  return NextResponse.json({ success: true, data: null })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ success: false, error: "Não autorizado" }, { status: 401 })
  const userId = session.user.id
  const { id } = await params

  let body: { title?: string }
  try { body = await req.json() } catch { return NextResponse.json({ success: false, error: "Body inválido" }, { status: 400 }) }
  if (!body.title || typeof body.title !== "string") return NextResponse.json({ success: false, error: "title obrigatório" }, { status: 400 })

  const conv = await db.coachConversation.findFirst({ where: { id, userId } })
  if (!conv) return NextResponse.json({ success: false, error: "Conversa não encontrada" }, { status: 404 })

  const updated = await db.coachConversation.update({
    where: { id },
    data: { title: body.title.trim().slice(0, 80) },
  })
  return NextResponse.json({ success: true, data: { id: updated.id, title: updated.title } })
}
