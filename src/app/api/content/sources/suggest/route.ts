// Endpoint "montar catálogo" — pipeline leve com 1 call Claude + validação HTTP.
//
// Fluxo:
//   1. POST { termId }
//   2. suggestSources (Claude sem tools, ~10s)
//   3. validateHosts em paralelo (~8s, concurrency 4)
//   4. Merge com sources existentes (preserva isActive manual do usuário)
//   5. Persiste em MonitorTerm.sources
//
// Tempo total: ~15-20s. Sem web_search, sem timeouts.

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { Prisma } from "@/generated/prisma/client"
import { suggestSources } from "@/services/source-suggester"
import { validateHosts } from "@/services/source-validator"

export const runtime = "nodejs"
export const maxDuration = 60

type TermSource = {
  host: string
  name: string
  tier: "TIER_1" | "TIER_2" | "BLOG"
  language: "pt-BR" | "en" | "es"
  note?: string
  isActive: boolean
  scores?: { authority: number; specialization: number; frequency: number; independence: number; languageFit: number }
  aggregateScore?: number
  validationStatus?: "ok" | "site_name_mismatch" | "not_publisher" | "unreachable" | "error"
  validationNote?: string
  detectedSiteName?: string | null
  lastValidatedAt?: string
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ success: false, error: "Não autorizado" }, { status: 401 })
  const userId = session.user.id

  let body: { termId?: string }
  try { body = await req.json() } catch { return NextResponse.json({ success: false, error: "Body inválido" }, { status: 400 }) }
  if (!body.termId) return NextResponse.json({ success: false, error: "termId obrigatório" }, { status: 400 })

  const pipelineStart = Date.now()

  try {
    const term = await db.monitorTerm.findFirst({ where: { id: body.termId, userId } })
    if (!term) return NextResponse.json({ success: false, error: "Termo não encontrado" }, { status: 404 })

    // Fontes já no catálogo pra Claude não sugerir duplicadas
    const existing: TermSource[] = Array.isArray(term.sources) ? (term.sources as unknown as TermSource[]) : []
    const existingHosts = existing.map((s) => s.host)

    // ═══ PASSO 1: Claude sugere ═══
    console.log(`[suggest] term="${term.term}" existing=${existingHosts.length}`)
    const { sources: suggested, usage } = await suggestSources({
      term: term.term,
      intent: term.intent,
      userId,
      existingHosts,
      maxSources: 20,
    })

    if (suggested.length === 0) {
      return NextResponse.json({
        success: false,
        error: "Claude não retornou fontes (tema muito específico ou desconhecido). Tente com um tema mais amplo ou adicione fontes manualmente.",
      }, { status: 422 })
    }

    // ═══ PASSO 2: Validação HTTP paralela ═══
    console.log(`[suggest] validando ${suggested.length} hosts via HTTP...`)
    const validationStart = Date.now()
    const results = await validateHosts(
      suggested.map((s) => ({ host: s.host, expectedName: s.name })),
      4,
    )
    const validationMs = Date.now() - validationStart

    // ═══ PASSO 3: Filtrar hallucinations + formatar ═══
    const rejected: Array<{ host: string; name: string; reason: string; detail?: string }> = []
    const validated: TermSource[] = []

    for (const s of suggested) {
      const v = results.get(s.host)
      // Hard reject: unreachable ou not_publisher
      if (!v || v.status === "unreachable" || v.status === "not_publisher") {
        rejected.push({
          host: s.host,
          name: s.name,
          reason: v?.status ?? "error",
          detail: v?.notes ?? "sem resposta HTTP válida",
        })
        continue
      }
      validated.push({
        host: s.host,
        name: s.name,
        tier: s.tier,
        language: s.language,
        note: s.expertise,
        isActive: true,
        validationStatus: v.status,
        validationNote: v.notes,
        detectedSiteName: v.detectedSiteName ?? null,
        lastValidatedAt: v.checkedAt,
      })
    }

    // ═══ PASSO 4: Merge com existentes (preserva isActive) ═══
    const existingByHost = new Map(existing.map((s) => [s.host, s]))
    const merged: TermSource[] = []

    // Primeiro os novos validados
    for (const v of validated) {
      const prev = existingByHost.get(v.host)
      merged.push(prev ? { ...v, isActive: prev.isActive } : v)
    }
    // Depois preserva os existentes que Claude não repetiu
    for (const prev of existing) {
      if (!merged.find((m) => m.host === prev.host)) merged.push(prev)
    }

    // ═══ PASSO 5: Persistir ═══
    const updated = await db.monitorTerm.update({
      where: { id: body.termId, userId },
      data: {
        sources: merged as unknown as Prisma.InputJsonValue,
        sourcesUpdatedAt: new Date(),
      },
    })

    const totalMs = Date.now() - pipelineStart
    console.log(`[suggest] OK — suggested=${suggested.length} validated=${validated.length} rejected=${rejected.length} merged=${merged.length} total=${totalMs}ms`)

    return NextResponse.json({
      success: true,
      data: {
        sources: merged,
        sourcesUpdatedAt: updated.sourcesUpdatedAt,
        meta: {
          suggested: suggested.length,
          validated: validated.length,
          rejected,
          existingCount: existing.length,
          addedCount: validated.filter((v) => !existingByHost.has(v.host)).length,
          totalDurationMs: totalMs,
          claudeMs: usage.durationMs,
          validationMs,
        },
      },
    })
  } catch (err) {
    console.error("[suggest] erro:", err)
    if (err instanceof Error && err.stack) console.error(err.stack)
    return NextResponse.json({ success: false, error: err instanceof Error ? err.message : "Erro ao montar catálogo" }, { status: 500 })
  }
}
