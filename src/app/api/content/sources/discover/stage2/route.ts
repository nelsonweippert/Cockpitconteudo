// Stage 2: Descoberta multi-estratégia — versão chunked (1 query por call).
//
// Cliente orquestra loop: for i in 0..totalQueries: POST { queryIndex: i }.
// Cada call é <10s (1 web_search típico). Timeout-proof em qualquer proxy.
//
// Primeira chamada sem queryIndex retorna o PLANO: { totalQueries, queries[] }.
// Chamadas subsequentes com queryIndex executam 1 query cada.

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { stageDiscovery, getPrioritizedQueries, DecompositionSchema } from "@/services/source-discovery.service"

export const runtime = "nodejs"
export const maxDuration = 30  // margem pra 1 web_search (típico 5-10s)

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ success: false, error: "Não autorizado" }, { status: 401 })
  const userId = session.user.id

  let body: { termId?: string; decomposition?: unknown; queryIndex?: number }
  try { body = await req.json() } catch { return NextResponse.json({ success: false, error: "Body inválido" }, { status: 400 }) }
  if (!body.termId) return NextResponse.json({ success: false, error: "termId obrigatório" }, { status: 400 })
  if (!body.decomposition) return NextResponse.json({ success: false, error: "decomposition obrigatória" }, { status: 400 })

  try {
    const term = await db.monitorTerm.findFirst({ where: { id: body.termId, userId } })
    if (!term) return NextResponse.json({ success: false, error: "Termo não encontrado" }, { status: 404 })

    const decomp = DecompositionSchema.parse(body.decomposition)

    // Modo PLAN: retorna lista de queries pra o cliente iterar. Zero custo Anthropic.
    if (body.queryIndex === undefined) {
      const prioritized = getPrioritizedQueries(decomp, 5)
      console.log(`[stage2/plan] term="${term.term}" → ${prioritized.length} queries planejadas`)
      return NextResponse.json({
        success: true,
        data: {
          mode: "plan",
          totalQueries: prioritized.length,
          queries: prioritized.map((q, i) => ({
            index: i,
            strategy: q.strategy,
            language: q.language,
            preview: q.query,
          })),
        },
      })
    }

    // Modo QUERY: executa 1 query específica, retorna candidatos.
    const discovery = await stageDiscovery({
      term: term.term,
      intent: term.intent,
      decomposition: decomp,
      userId,
      queryIndex: body.queryIndex,
      maxQueries: 5,
    })
    console.log(`[stage2/query ${body.queryIndex + 1}/${discovery.totalQueries}] term="${term.term}" → ${discovery.candidates.length} candidatos em ${discovery._usage.durationMs}ms`)

    return NextResponse.json({
      success: true,
      data: {
        mode: "query",
        queryIndex: body.queryIndex,
        totalQueries: discovery.totalQueries,
        candidates: discovery.candidates,
        durationMs: discovery._usage.durationMs,
        searchesUsed: discovery._usage.searchesUsed,
      },
    })
  } catch (err) {
    console.error("[stage2] erro:", err)
    if (err instanceof Error && err.stack) console.error(err.stack)
    return NextResponse.json({ success: false, error: err instanceof Error ? err.message : "Erro no estágio 2" }, { status: 500 })
  }
}
