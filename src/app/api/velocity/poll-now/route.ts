// POST /api/velocity/poll-now — dispara poll de velocity manual pra todos
// connections do user.

import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { pollVelocityForConnection } from "@/services/velocity.service"

export const runtime = "nodejs"
export const maxDuration = 60

export async function POST() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ success: false, error: "Não autorizado" }, { status: 401 })

  const conns = await db.platformConnection.findMany({
    where: { userId: session.user.id, isActive: true },
  })

  let videosTracked = 0
  const alerts: unknown[] = []
  const errors: string[] = []
  for (const c of conns) {
    const r = await pollVelocityForConnection(c.id)
    videosTracked += r.videosTracked
    alerts.push(...r.alerts)
    if (!r.ok && r.error) errors.push(`${r.channelName}: ${r.error}`)
  }

  return NextResponse.json({
    success: true,
    data: { connectionsProcessed: conns.length, videosTracked, alerts, errors },
  })
}
