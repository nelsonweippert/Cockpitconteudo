// POST /api/auth/youtube/disconnect — revoga tokens e desativa connection.
// Body: { connectionId }

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { revokeToken } from "@/services/youtube-oauth.service"

export const runtime = "nodejs"

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ success: false, error: "Não autorizado" }, { status: 401 })
  const userId = session.user.id

  let body: { connectionId?: string }
  try { body = await req.json() } catch { return NextResponse.json({ success: false, error: "Body inválido" }, { status: 400 }) }
  if (!body.connectionId) return NextResponse.json({ success: false, error: "connectionId obrigatório" }, { status: 400 })

  const conn = await db.platformConnection.findFirst({ where: { id: body.connectionId, userId } })
  if (!conn) return NextResponse.json({ success: false, error: "Conexão não encontrada" }, { status: 404 })

  // Revoga no Google (best-effort)
  if (conn.refreshToken) {
    await revokeToken(conn.refreshToken).catch(() => {})
  } else {
    await revokeToken(conn.accessToken).catch(() => {})
  }

  // Desativa (não deletamos pra preservar snapshots históricos)
  await db.platformConnection.update({
    where: { id: conn.id },
    data: { isActive: false },
  })

  return NextResponse.json({ success: true, data: null })
}
