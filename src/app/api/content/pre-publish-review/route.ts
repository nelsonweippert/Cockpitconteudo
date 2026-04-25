// POST /api/content/pre-publish-review
// Review crítica final do conteúdo antes da publicação. Haiku, structured output.

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import Anthropic from "@anthropic-ai/sdk"
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod"
import { z } from "zod"
import { trackUsage } from "@/services/ai.service"

export const runtime = "nodejs"
export const maxDuration = 30

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const MODEL = "claude-haiku-4-5" as const

const ReviewSchema = z.object({
  verdict: z.enum(["go", "fix-first", "blocker"]).describe(
    "go: pronto pra publicar como está. fix-first: sai melhor com pequenos ajustes. blocker: tem problema sério, NÃO publicar.",
  ),
  summary: z.string().describe("1 frase (max 100 chars) com o veredito principal"),
  blockers: z.array(z.string()).max(3).describe("Problemas que comprometem o conteúdo (vazio se não houver)"),
  warnings: z.array(z.string()).max(5).describe("Coisas a melhorar mas não-bloqueadoras (vazio se não houver)"),
  greenLights: z.array(z.string()).max(4).describe("Pontos fortes — o que está bem feito"),
})

const SYSTEM = `Você é EDITOR-CHEFE crítico fazendo review final de conteúdo antes da publicação. Não é coach motivacional — é review honesta.

ANALISE
- Hook prende? (não pode ser genérico ou descritivo demais)
- Roteiro tem estrutura clara, frases-âncora memoráveis, frases ativas?
- Título alinha com hook? Promete o que entrega?
- Descrição funciona pra SEO? Tem CTA?
- Erros óbvios? (frases truncadas, repetições, claims sem ancoragem)

VEREDITOS
- "go" — está bom o suficiente. Greenlights >= 2, sem blockers reais.
- "fix-first" — saiu apressado, pequenas correções fariam diferença grande.
- "blocker" — tem problema sério (hook fraco demais, alucinação, falta de coesão grave). É raro, use só quando merecer.

REGRAS
- PT-BR. Sem travessões.
- Cada bullet (blocker/warning/greenlight) é UMA frase concreta sobre o conteúdo (não genérica).
- NUNCA invente fatos sobre o conteúdo. Use só o que recebeu.

FORMATO: JSON conforme schema.`

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ success: false, error: "Não autorizado" }, { status: 401 })

  let body: {
    title?: string | null
    hook?: string | null
    script?: string | null
    description?: string | null
    targetDuration?: number | null
    platform?: string | null
    format?: string | null
    skill?: string | null
  }
  try { body = await req.json() } catch { return NextResponse.json({ success: false, error: "Body inválido" }, { status: 400 }) }

  const userPrompt = `Conteúdo pra review:

Título: ${body.title || "(vazio)"}
Plataforma: ${body.platform || "?"} · Formato: ${body.format || "?"} · Skill: ${body.skill || "?"} · Duração-alvo: ${body.targetDuration ? `${body.targetDuration}s` : "?"}

HOOK:
${body.hook || "(vazio)"}

ROTEIRO:
${body.script || "(vazio)"}

DESCRIÇÃO:
${body.description || "(vazio)"}

Faça a review final. Veredito honesto.`

  try {
    const start = Date.now()
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1500,
      system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
      output_config: { format: zodOutputFormat(ReviewSchema) },
      messages: [{ role: "user", content: userPrompt }],
    })
    const durationMs = Date.now() - start

    const tb = [...response.content].reverse().find((b): b is Anthropic.TextBlock => b.type === "text")
    if (!tb) return NextResponse.json({ success: false, error: "sem resposta" }, { status: 500 })

    const parsed = ReviewSchema.parse(JSON.parse(tb.text))

    trackUsage(MODEL, "pre_publish_review", response.usage.input_tokens, response.usage.output_tokens, durationMs, session.user.id, {
      verdict: parsed.verdict === "go" ? 1 : parsed.verdict === "fix-first" ? 2 : 3,
      blockers: parsed.blockers.length,
      warnings: parsed.warnings.length,
    }).catch(() => {})

    return NextResponse.json({ success: true, data: parsed })
  } catch (err) {
    console.error("[pre-publish-review]", err)
    return NextResponse.json({
      success: false,
      error: err instanceof Error ? err.message : "Erro",
    }, { status: 500 })
  }
}
