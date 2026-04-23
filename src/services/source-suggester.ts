// Source Suggester — pipeline leve pra montar catálogo fixo de fontes por tema.
// Single call Claude Sonnet, SEM tools. Usa apenas conhecimento do treinamento
// pra listar publishers reais. Depois, source-validator.ts filtra hallucinations
// via HTTP real.
//
// Trade-off: pode perder blogs super-recentes que Claude não conhece, mas ganha
// confiabilidade e velocidade (~10s vs 2-5min).

import Anthropic from "@anthropic-ai/sdk"
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod"
import { z } from "zod"
import { trackUsage } from "./ai.service"

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const MODEL = "claude-sonnet-4-6"

const SuggestedSourceSchema = z.object({
  host: z.string().describe("Domínio raiz SEM www, SEM https://, SEM path. Ex: folha.uol.com.br, stratechery.com"),
  name: z.string().describe("Nome editorial do veículo"),
  tier: z.enum(["TIER_1", "TIER_2", "BLOG"]).describe(
    "TIER_1: publishers estabelecidos com equipe editorial grande. TIER_2: especializados reconhecidos no nicho. BLOG: newsletter/blog de autor individual com autoridade.",
  ),
  language: z.enum(["pt-BR", "en", "es"]),
  country: z.string().optional().describe("US, BR, UK, etc"),
  expertise: z.string().describe("1 frase explicando por que é relevante PRO TEMA específico"),
  confidence: z.enum(["high", "medium", "low"]).describe(
    "high: fonte notória que você conhece muito bem. medium: conhece mas pode ter mudado. low: tem dúvida se existe — prefira não incluir.",
  ),
})

const ResponseSchema = z.object({
  sources: z.array(SuggestedSourceSchema).describe("15-20 publishers curados pro tema"),
})

export type SuggestedSource = z.infer<typeof SuggestedSourceSchema>

function buildSystemPrompt(): string {
  return `Você é CURADOR EDITORIAL SÊNIOR. Dado um tema + intenção do usuário, liste os MELHORES publishers, newsletters e blogs que você CONHECE SEM DÚVIDA cobrirem bem esse tema.

REGRAS ABSOLUTAS
- SÓ inclua fontes que você tem CERTEZA que existem. Se não lembra com precisão, NÃO inclua.
- PROIBIDO inventar hosts. "Eu acho que existe um blog chamado X" → EXCLUIR.
- Marque confidence:
  · "high" — fonte notória/canônica, você conhece muito bem
  · "medium" — existe mas pode ter evoluído (incluir se o tema é estável)
  · "low" — tem dúvida → prefira não incluir
- Host deve ser domínio raiz sem www/https/path. Valide mentalmente: "esse host vai retornar uma homepage legítima"?

O QUE ENTREGAR
- 15-20 fontes total (menos se for nicho pequeno; mais só se realmente conhece muitas)
- Balance de TIERS: 4-6 TIER_1 + 6-10 TIER_2 + 3-5 BLOG
- Balance de IDIOMAS conforme o tema:
  · Tema com foco BR (ex: "política brasileira") → 70% pt-BR
  · Tema internacional/frontier (ex: "LLMs") → 70% en
  · Misto → 50/50
- expertise: 1 frase concreta explicando por que a fonte é relevante ESPECIFICAMENTE pro tema do usuário (não genérico)

ANTI-PADRÕES (NUNCA incluir)
- Agregadores (Google News, Bing News, Techmeme, Hacker News como fonte)
- Redes sociais (Twitter/X, Reddit, LinkedIn) — são canais, não fontes
- Wikipedia, Quora, Medium raiz (plataforma, não publisher)
- Sites de e-commerce ou PR wires
- Blogs que claramente só replicam notícias de outros sem apuração

FORMATO: JSON { sources: [...] } conforme schema.`
}

export async function suggestSources(opts: {
  term: string
  intent?: string | null
  userId: string
  existingHosts?: string[] // hosts já no catálogo — Claude evita duplicar
  maxSources?: number
}): Promise<{
  sources: SuggestedSource[]
  usage: { inputTokens: number; outputTokens: number; durationMs: number }
}> {
  const { term, intent, userId, existingHosts = [], maxSources = 20 } = opts

  const userPrompt = `TEMA: "${term}"
${intent ? `INTENÇÃO/FOCO: ${intent}` : "(sem intenção declarada — use julgamento padrão)"}
${existingHosts.length > 0 ? `\nJÁ NO CATÁLOGO (NÃO repita, sugira NOVAS):\n${existingHosts.map((h) => `- ${h}`).join("\n")}\n` : ""}
Liste até ${maxSources} publishers/newsletters/blogs que VOCÊ CONHECE e que cobrem esse tema com qualidade.

Priorize confidence=high. Se ficar com menos de ${Math.floor(maxSources * 0.6)} fontes "high", inclua algumas "medium" que você considera sólidas. Evite "low".`

  const start = Date.now()
  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 4000,
    system: [{ type: "text", text: buildSystemPrompt(), cache_control: { type: "ephemeral" } }],
    output_config: { format: zodOutputFormat(ResponseSchema), effort: "low" },
    messages: [{ role: "user", content: userPrompt }],
  })
  const durationMs = Date.now() - start

  const textBlock = [...response.content].reverse().find((b): b is Anthropic.TextBlock => b.type === "text")
  if (!textBlock) throw new Error("suggester: sem text na resposta")

  let parsed: z.infer<typeof ResponseSchema>
  try { parsed = ResponseSchema.parse(JSON.parse(textBlock.text)) }
  catch (err) {
    console.error("[suggester] parse error:", err, "raw:", textBlock.text.slice(0, 400))
    throw new Error("Falha ao parsear sugestões de fontes")
  }

  // Filtra low-confidence e normaliza hosts. Dedup.
  const seen = new Set<string>()
  const sources: SuggestedSource[] = []
  for (const s of parsed.sources) {
    if (s.confidence === "low") continue
    const host = s.host.toLowerCase().trim().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/+.*$/, "")
    if (!host || seen.has(host)) continue
    seen.add(host)
    sources.push({ ...s, host })
  }

  trackUsage(MODEL, "source_suggester", response.usage.input_tokens, response.usage.output_tokens, durationMs, userId, {
    cacheReadTokens: response.usage.cache_read_input_tokens ?? 0,
    cacheCreationTokens: response.usage.cache_creation_input_tokens ?? 0,
    suggested: parsed.sources.length, afterFilter: sources.length,
  }).catch(() => {})

  console.log(`[suggester] term="${term}" → ${sources.length} sources (${parsed.sources.length - sources.length} dropped low-confidence) em ${durationMs}ms`)

  return {
    sources,
    usage: {
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      durationMs,
    },
  }
}
