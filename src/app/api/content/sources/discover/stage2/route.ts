// Stage 2: Descoberta multi-estratégia. ~40s. web_search max 10 uses.
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { stageDiscovery, DecompositionSchema } from "@/services/source-discovery.service"

export const runtime = "nodejs"
export const maxDuration = 60

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ success: false, error: "Não autorizado" }, { status: 401 })
  const userId = session.user.id

  let body: { termId?: string; decomposition?: unknown }
  try { body = await req.json() } catch { return NextResponse.json({ success: false, error: "Body inválido" }, { status: 400 }) }
  if (!body.termId) return NextResponse.json({ success: false, error: "termId obrigatório" }, { status: 400 })
  if (!body.decomposition) return NextResponse.json({ success: false, error: "decomposition obrigatória" }, { status: 400 })

  try {
    const term = await db.monitorTerm.findFirst({ where: { id: body.termId, userId } })
    if (!term) return NextResponse.json({ success: false, error: "Termo não encontrado" }, { status: 404 })

    const decomp = DecompositionSchema.parse(body.decomposition)
    const discovery = await stageDiscovery({ term: term.term, intent: term.intent, decomposition: decomp, userId })
    console.log(`[stage2] user=${userId} term="${term.term}" OK em ${discovery._usage.durationMs}ms — ${discovery.candidates.length} candidatos`)
    return NextResponse.json({ success: true, data: { candidates: discovery.candidates, searchesUsed: discovery._usage.searchesUsed, durationMs: discovery._usage.durationMs } })
  } catch (err) {
    console.error("[stage2] erro:", err)
    if (err instanceof Error && err.stack) console.error(err.stack)
    return NextResponse.json({ success: false, error: err instanceof Error ? err.message : "Erro no estágio 2" }, { status: 500 })
  }
}
