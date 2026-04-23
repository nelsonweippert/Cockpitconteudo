// Source Suggester — monta catálogo misto por tema, com quotas por sourceType.
// Objetivo: trazer FONTES UPSTREAM (fóruns, código, curadores) ao invés de
// só publishers tradicionais — o digest fica à frente da cobertura comum.

import Anthropic from "@anthropic-ai/sdk"
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod"
import { z } from "zod"
import { trackUsage } from "./ai.service"

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const MODEL = "claude-sonnet-4-6"

const SourceTypeEnum = z.enum(["PUBLISHER", "CURATOR", "PRIMARY_FORUM", "PRIMARY_CODE", "PRIMARY_SOCIAL"])

const SuggestedSourceSchema = z.object({
  host: z.string().describe(
    "Domínio raiz sem www/https. PUBLISHER/CURATOR = só o domínio (ex: folha.uol.com.br). " +
    "PRIMARY_FORUM = pode ter path de subreddit (ex: reddit.com/r/LocalLLaMA) ou o raiz (news.ycombinator.com). " +
    "PRIMARY_CODE = github.com/{org}/{repo} ou arxiv.org.",
  ),
  name: z.string().describe("Nome editorial do veículo"),
  sourceType: SourceTypeEnum.describe(
    "PUBLISHER: mídia tradicional (TechCrunch, Folha). CURATOR: newsletter/analista (Stratechery, Import AI). " +
    "PRIMARY_FORUM: Hacker News, subreddits específicos, Product Hunt — discussão upstream. " +
    "PRIMARY_CODE: GitHub repos, arXiv — produto/paper nascendo. " +
    "PRIMARY_SOCIAL: Twitter/Farcaster — só use se tiver certeza do handle canônico do tema.",
  ),
  tier: z.enum(["TIER_1", "TIER_2", "BLOG"]).describe(
    "Autoridade dentro do tipo. TIER_1: canônico. TIER_2: forte mas de nicho. BLOG: autor individual ou sub-canal.",
  ),
  language: z.enum(["pt-BR", "en", "es"]),
  country: z.string().optional().describe("US, BR, UK, etc"),
  expertise: z.string().describe("1 frase explicando por que é relevante PRO TEMA específico"),
  confidence: z.enum(["high", "medium", "low"]).describe(
    "high: fonte notória que você conhece muito bem. medium: conhece mas pode ter mudado. low: tem dúvida — não inclua.",
  ),
})

const ResponseSchema = z.object({
  sources: z.array(SuggestedSourceSchema).describe("Mix de 15-20 fontes curadas pro tema, balanceadas por sourceType"),
})

export type SuggestedSource = z.infer<typeof SuggestedSourceSchema>

function buildSystemPrompt(): string {
  return `Você é CURADOR EDITORIAL SÊNIOR especializado em FLUXO DE INFORMAÇÃO: sabe onde a notícia NASCE vs onde ela é só REPRODUZIDA.

OBJETIVO
Montar catálogo MISTO por tipo de fonte pra ficar À FRENTE da cobertura comum. Quem lê publisher tá lendo o mesmo que todo mundo. Quem lê PRIMARY_FORUM/CODE tá vendo o sinal antes de virar commodity.

REGRAS ABSOLUTAS
- SÓ inclua fontes que você tem CERTEZA que existem. Não inventa.
- Host deve ser domínio raiz, exceto pra fórum/código onde path pode ser crítico:
  · PUBLISHER/CURATOR: só "folha.uol.com.br", "stratechery.com"
  · PRIMARY_FORUM: pode ser "news.ycombinator.com" OU "reddit.com/r/LocalLLaMA"
  · PRIMARY_CODE: "github.com/openai/evals" (repo específico) ou "arxiv.org" com categoria implícita na nota
- Marque confidence rigorosamente. Se não lembra com precisão, descarta.

QUOTAS DE sourceType POR TEMA (mire nesse mix)
- PRIMARY_FORUM (2-4 fontes) — discussão original. Onde devs/analistas comentam primeiro.
  · Tech/IA/software: news.ycombinator.com + 1-3 subreddits específicos (reddit.com/r/MachineLearning, r/LocalLLaMA, r/selfhosted, etc.)
  · Produto/design: news.ycombinator.com + producthunt.com + r/startups
  · Cripto: r/CryptoCurrency, r/ethfinance, farcaster.xyz
  · Ciência: r/science, r/askscience
  · SEMPRE: escolha subreddits CANÔNICOS do tema (se não lembrar um específico, prefira pular)

- PRIMARY_CODE (0-2 fontes) — produto/paper nascendo, ONDE só existir fluxo técnico.
  · Tech/IA: github.com/{org}/{repo-canônico} + arxiv.org (pra papers)
  · Não existe pra política/entretenimento/geral

- CURATOR (3-5 fontes) — newsletters e analistas com opinião forte.
  · Tech/IA: stratechery.com, importai.substack.com, theneurondaily.com, lennysnewsletter.com
  · Cripto: messari.io, bankless.substack.com
  · Política: newsletters no substack (mapeie pelo tema)
  · Ciência: pesquisadores com substack próprio

- PUBLISHER (5-8 fontes) — mídia tradicional que SABE cobrir o tema.
  · Internacional: TechCrunch, The Information, Bloomberg, Reuters, etc.
  · BR: Folha, G1, Estadão, Valor, etc. quando o tema tiver relevância local

- PRIMARY_SOCIAL (0-1 fontes) — só inclua se existe um HANDLE canônico que domina o tema (raro). Quase sempre pular.

BALANÇO DE IDIOMAS (DENTRO DO MIX)
- Tema BR (ex: "política brasileira") → 70% pt-BR
- Tema frontier (ex: "LLMs") → 70% en (o sinal tá lá)
- Misto → 50/50

ANTI-PADRÕES (NUNCA incluir)
- Agregadores como "fonte": Google News, Bing News, Techmeme, feedly (são ferramentas de descoberta, não fonte)
- Wikipedia, Quora, Medium raiz (plataforma, não publisher)
- E-commerce, PR wires, blogs que só replicam

expertise: 1 frase concreta explicando por que a fonte é relevante ESPECIFICAMENTE pro tema.

FORMATO: JSON { sources: [...] } conforme schema.`
}

export async function suggestSources(opts: {
  term: string
  intent?: string | null
  userId: string
  existingHosts?: string[]
  maxSources?: number
}): Promise<{
  sources: SuggestedSource[]
  usage: { inputTokens: number; outputTokens: number; durationMs: number }
}> {
  const { term, intent, userId, existingHosts = [], maxSources = 20 } = opts

  const userPrompt = `TEMA: "${term}"
${intent ? `INTENÇÃO/FOCO: ${intent}` : "(sem intenção declarada — use julgamento padrão)"}
${existingHosts.length > 0 ? `\nJÁ NO CATÁLOGO (NÃO repita, sugira NOVAS):\n${existingHosts.map((h) => `- ${h}`).join("\n")}\n` : ""}
Liste até ${maxSources} fontes que VOCÊ CONHECE, balanceadas conforme as QUOTAS de sourceType do system prompt.

Prioridade do mix PARA ESTE TEMA:
1. PRIMARY_FORUM (HN + subreddits específicos do tema) — onde o sinal aparece primeiro
2. CURATOR (newsletters/analistas)
3. PUBLISHER (mídia que cobre bem)
4. PRIMARY_CODE só se tema tiver dimensão técnica
5. PRIMARY_SOCIAL evite

Priorize confidence=high. Evite "low".`

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
  // Pra hosts de fórum/código, preserva path (reddit.com/r/X, github.com/org/repo).
  // Pra publisher/curator, só o domínio raiz.
  const seen = new Set<string>()
  const sources: SuggestedSource[] = []
  for (const s of parsed.sources) {
    if (s.confidence === "low") continue
    const raw = s.host.toLowerCase().trim().replace(/^https?:\/\//, "").replace(/^www\./, "")
    let host: string
    if (s.sourceType === "PRIMARY_FORUM" || s.sourceType === "PRIMARY_CODE") {
      // Remove trailing slash mas mantém path
      host = raw.replace(/\/+$/, "")
    } else {
      // Domínio raiz
      host = raw.replace(/\/+.*$/, "")
    }
    if (!host || seen.has(host)) continue
    seen.add(host)
    sources.push({ ...s, host })
  }

  // Counts por tipo pra log/telemetria
  const byType = sources.reduce((acc, s) => {
    acc[s.sourceType] = (acc[s.sourceType] ?? 0) + 1
    return acc
  }, {} as Record<string, number>)

  trackUsage(MODEL, "source_suggester", response.usage.input_tokens, response.usage.output_tokens, durationMs, userId, {
    cacheReadTokens: response.usage.cache_read_input_tokens ?? 0,
    cacheCreationTokens: response.usage.cache_creation_input_tokens ?? 0,
    suggested: parsed.sources.length, afterFilter: sources.length,
  }).catch(() => {})

  console.log(`[suggester] term="${term}" → ${sources.length} sources (drop ${parsed.sources.length - sources.length}) ${durationMs}ms. Mix: ${JSON.stringify(byType)}`)

  return {
    sources,
    usage: {
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      durationMs,
    },
  }
}
