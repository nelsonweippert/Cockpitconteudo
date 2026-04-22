// Stage 1: Decomposição do tema. ~15s. Sem tools.
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { stageDecomposition } from "@/services/source-discovery.service"

export const runtime = "nodejs"
export const maxDuration = 60

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ success: false, error: "Não autorizado" }, { status: 401 })
  const userId = session.user.id

  let body: { termId?: string }
  try { body = await req.json() } catch { return NextResponse.json({ success: false, error: "Body inválido" }, { status: 400 }) }
  if (!body.termId) return NextResponse.json({ success: false, error: "termId obrigatório" }, { status: 400 })

  try {
    const term = await db.monitorTerm.findFirst({ where: { id: body.termId, userId } })
    if (!term) return NextResponse.json({ success: false, error: "Termo não encontrado" }, { status: 404 })

    const decomp = await stageDecomposition({ term: term.term, intent: term.intent, userId })
    console.log(`[stage1] user=${userId} term="${term.term}" OK em ${decomp._usage.durationMs}ms`)
    return NextResponse.json({ success: true, data: { decomposition: decomp } })
  } catch (err) {
    console.error("[stage1] erro:", err)
    if (err instanceof Error && err.stack) console.error(err.stack)
    return NextResponse.json({ success: false, error: err instanceof Error ? err.message : "Erro no estágio 1" }, { status: 500 })
  }
}
