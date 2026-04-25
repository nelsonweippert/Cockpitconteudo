// Endpoint manual — user clica "Rodar digest agora" na UI.
// Autenticado via session (nunca por CRON_SECRET).

import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { runDailyDigestForUser } from "@/services/daily-digest.service"

export const runtime = "nodejs"
export const maxDuration = 300 // até 5min (Vercel Pro) — digest pesado

export async function POST() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ success: false, error: "Não autorizado" }, { status: 401 })

  const start = Date.now()
  try {
    const result = await runDailyDigestForUser(session.user.id)
    const durationMs = Date.now() - start
    console.log(`[digest/run-now] user=${session.user.id} themes=${result.themesProcessed} msgsSent=${result.messagesSent} errors=${result.errors.length} duration=${durationMs}ms`)

    if (!result.chatId) {
      return NextResponse.json({ success: false, error: result.errors[0] ?? "Usuário sem Telegram vinculado" }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      data: {
        themesProcessed: result.themesProcessed,
        themesWithNews: result.themesWithNews,
        themesCached: result.themesCached,
        messagesSent: result.messagesSent,
        errors: result.errors,
        durationMs,
      },
    })
  } catch (err) {
    console.error("[digest/run-now]", err)
    return NextResponse.json({
      success: false,
      error: err instanceof Error ? err.message : "Erro ao rodar digest",
    }, { status: 500 })
  }
}
