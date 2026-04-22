import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import Anthropic from "@anthropic-ai/sdk"
import { trackUsage } from "@/services/ai.service"

export const maxDuration = 120

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Não autorizado" }, { status: 401 })

  const userId = session.user.id
  const { description, term: providedTerm } = await req.json()
  if (!description) return NextResponse.json({ error: "Descrição obrigatória" }, { status: 400 })

  // Use provided term or extract from description
  const autoTerm = providedTerm || description.split(/\s+/).slice(0, 4).join(" ")

  try {
    const prompt = `Você é um analista de conteúdo digital. O criador tem uma ideia específica e quer saber se vale a pena produzir.

IDEIA DO CRIADOR:
"${description}"
${providedTerm ? `\nTEMA MONITORADO: "${providedTerm}" — a ideia está dentro deste tema. Use "${providedTerm}" como term.` : "\nIMPORTANTE: Esta ideia pode ser de QUALQUER nicho — não está limitada a nenhum tema específico."}

Analise PROFUNDAMENTE esta ideia e retorne EXATAMENTE 3 variações de conteúdo baseadas nela.

Para cada variação:
1. Um ângulo DIFERENTE de abordar o mesmo tema
2. Avalie o potencial real de viralização (score 90-100)
3. Explique POR QUE tem ou não potencial

O score deve ser REALISTA:
- 97-100: tema viral AGORA, timing perfeito, alta demanda + pouca oferta
- 94-96: tema relevante com boa janela, público engajado
- 90-93: tema interessante mas já saturado ou timing não ideal

${providedTerm ? `Use "${providedTerm}" como term para todas as variações.` : 'Use o campo "term" como uma TAG CURTA do tema (ex: "finanças pessoais", "receitas fit", "marketing digital").'}

Retorne APENAS JSON array (sem markdown):
[{
  "title": "título otimizado para clique",
  "summary": "análise de 2-3 frases: por que funciona (ou não), contexto atual, oportunidade",
  "angle": "o que diferencia ESTA variação das outras",
  "hook": "sugestão de hook para os primeiros 3 segundos",
  "term": "tag curta do tema (2-3 palavras)",
  "relevance": "análise de viralização: timing + demanda + competição + público-alvo + fontes PT-BR para a editora buscar imagens",
  "source": "Ideia personalizada",
  "score": 95
}]`

    const start = Date.now()
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6", max_tokens: 2048,
      messages: [{ role: "user", content: prompt }],
    })
    trackUsage("claude-sonnet-4-6", "evaluate_idea", message.usage?.input_tokens ?? 0, message.usage?.output_tokens ?? 0, Date.now() - start, userId).catch(() => {})

    const text = message.content[0]
    if (text.type !== "text") return NextResponse.json({ error: "Erro IA" }, { status: 500 })

    const clean = text.text.replace(/```json?\n?/g, "").replace(/```/g, "").trim()
    let ideas: any[]
    try { ideas = JSON.parse(clean) } catch { const m = clean.match(/\[[\s\S]*\]/); if (m) ideas = JSON.parse(m[0]); else return NextResponse.json({ error: "Erro parse" }, { status: 500 }) }

    ideas = ideas.filter((i: any) => i.title && i.summary).map((i: any) => ({
      ...i,
      term: i.term || autoTerm,
      score: Math.min(100, Math.max(90, i.score || 90)),
    }))

    await db.ideaFeed.createMany({
      data: ideas.map((i: any) => ({
        title: i.title, summary: i.summary, angle: i.angle || null, hook: i.hook || null,
        term: i.term, relevance: `[${i.score}/100] ${i.relevance || ""}`, source: "Ideia personalizada",
        score: i.score, userId,
      })),
    })

    const allIdeas = await db.ideaFeed.findMany({ where: { userId, isDiscarded: false }, orderBy: { createdAt: "desc" }, take: 100 })
    return NextResponse.json({ ok: true, created: ideas.length, ideas: allIdeas })
  } catch (err) {
    console.error("[custom-idea]", err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
