// Vercel Cron — dispara digest pra todos users com Telegram vinculado.
//
// Proteção: header Authorization: Bearer ${CRON_SECRET} (Vercel Cron envia auto
// quando CRON_SECRET está em env).

import { NextRequest, NextResponse } from "next/server"
import { runDailyDigestForAllUsers } from "@/services/daily-digest.service"
import { captureSnapshotsForAllUsers } from "@/services/channel-snapshot.service"

export const runtime = "nodejs"
export const maxDuration = 300

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    console.error("[cron/daily-report] CRON_SECRET não configurado — abortando")
    return NextResponse.json({ ok: false, error: "CRON_SECRET não configurado" }, { status: 500 })
  }
  const auth = req.headers.get("authorization") ?? ""
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "Não autorizado" }, { status: 401 })
  }

  const start = Date.now()
  try {
    // Roda em paralelo: digest (Telegram) + snapshots (canais conectados)
    const [digestSummary, snapshotsSummary] = await Promise.all([
      runDailyDigestForAllUsers(),
      captureSnapshotsForAllUsers(),
    ])

    const durationMs = Date.now() - start
    console.log(
      `[cron/daily-report] digest: users=${digestSummary.usersProcessed} ok=${digestSummary.usersSuccess} failed=${digestSummary.usersWithErrors} | ` +
      `snapshots: users=${snapshotsSummary.usersProcessed} taken=${snapshotsSummary.snapshotsTaken} errors=${snapshotsSummary.errors} | ` +
      `duration=${durationMs}ms`,
    )

    return NextResponse.json({
      ok: true,
      digest: digestSummary,
      snapshots: snapshotsSummary,
      durationMs,
    })
  } catch (err) {
    console.error("[cron/daily-report] erro:", err)
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "erro" }, { status: 500 })
  }
}
