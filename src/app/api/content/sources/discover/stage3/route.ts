// Stage 3: Validação + ranking. ~60s. web_search max 15 uses.
// Persiste fontes no banco após merge com existentes.
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { Prisma } from "@/generated/prisma/client"
import { stageRanking, DecompositionSchema, RawCandidateSchema } from "@/services/source-discovery.service"
import { z } from "zod"

export const runtime = "nodejs"
export const maxDuration = 90

const CandidatesSchema = z.array(RawCandidateSchema)

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ success: false, error: "Não autorizado" }, { status: 401 })
  const userId = session.user.id

  let body: { termId?: string; decomposition?: unknown; candidates?: unknown }
  try { body = await req.json() } catch { return NextResponse.json({ success: false, error: "Body inválido" }, { status: 400 }) }
  if (!body.termId) return NextResponse.json({ success: false, error: "termId obrigatório" }, { status: 400 })
  if (!body.decomposition) return NextResponse.json({ success: false, error: "decomposition obrigatória" }, { status: 400 })
  if (!body.candidates) return NextResponse.json({ success: false, error: "candidates obrigatórios" }, { status: 400 })

  try {
    const term = await db.monitorTerm.findFirst({ where: { id: body.termId, userId } })
    if (!term) return NextResponse.json({ success: false, error: "Termo não encontrado" }, { status: 404 })

    const decomp = DecompositionSchema.parse(body.decomposition)
    const allCandidates = CandidatesSchema.parse(body.candidates)

    // Limita candidatos pra caber em <60s. Se mais do que 15, prioriza os que
    // apareceram em mais queries (foundVia maior = sinal de qualidade).
    const candidates = allCandidates.length > 15
      ? [...allCandidates].sort((a, b) => (b.foundVia?.length ?? 0) - (a.foundVia?.length ?? 0)).slice(0, 15)
      : allCandidates

    const ranking = await stageRanking({ term: term.term, intent: term.intent, candidates, decomposition: decomp, userId })

    // Converte pro formato de persistência
    const newSources = ranking.sources.map((s) => ({
      host: s.host, name: s.name, tier: s.tier, language: s.language,
      note: s.note, isActive: true, scores: s.scores, aggregateScore: s.aggregateScore,
    }))

    // Merge com fontes existentes preservando isActive do usuário
    type StoredSource = { host: string; isActive?: boolean; [key: string]: unknown }
    const existing = Array.isArray(term.sources) ? (term.sources as StoredSource[]) : []
    const existingByHost = new Map<string, StoredSource>(existing.map((s) => [s.host, s]))
    const merged = newSources.map((s) => {
      const prev = existingByHost.get(s.host)
      return prev ? { ...s, isActive: prev.isActive ?? true } : s
    })
    for (const s of existing) {
      if (!merged.find((m) => m.host === s.host)) merged.push(s as typeof merged[number])
    }

    const updated = await db.monitorTerm.update({
      where: { id: body.termId, userId },
      data: {
        sources: merged as unknown as Prisma.InputJsonValue,
        sourcesUpdatedAt: new Date(),
      },
    })

    console.log(`[stage3] user=${userId} term="${term.term}" OK em ${ranking._usage.durationMs}ms — ${newSources.length} aprovadas, ${ranking.rejected.length} rejeitadas`)
    return NextResponse.json({
      success: true,
      data: {
        sources: merged,
        sourcesUpdatedAt: updated.sourcesUpdatedAt,
        found: newSources.length,
        rejected: ranking.rejected,
        searchesUsed: ranking._usage.searchesUsed,
        durationMs: ranking._usage.durationMs,
      },
    })
  } catch (err) {
    console.error("[stage3] erro:", err)
    if (err instanceof Error && err.stack) console.error(err.stack)
    return NextResponse.json({ success: false, error: err instanceof Error ? err.message : "Erro no estágio 3" }, { status: 500 })
  }
}
