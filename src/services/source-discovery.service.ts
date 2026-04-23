// Source Discovery — Pipeline de 3 estágios pra curar as melhores fontes por tema.
// Assertividade > velocidade. ~2min, ~$0.30 por termo. Rodado poucas vezes.
//
// Estágio 1: Decomposição do tema (sem tools, pensa antes de buscar)
// Estágio 2: Descoberta multi-estratégia (web_search, executa 6-8 queries planejadas)
// Estágio 3: Validação + ranking (web_search site:host, scoring em 5 dimensões)

import Anthropic from "@anthropic-ai/sdk"
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod"
import { z } from "zod"
import { trackUsage } from "./ai.service"

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const MODEL = "claude-sonnet-4-6"

// ── Schemas ─────────────────────────────────────────────────────────────

const STRATEGIES = [
  "authority",          // "best sources on X" — ranking já feito por outros
  "expert_pick",        // "X analysts/experts recommend"
  "recent_coverage",    // "X news" → quem publica com frequência
  "deep_analysis",      // "X deep analysis" — filtra commodity news
  "newsletter_blog",    // "best newsletter X substack" — BLOG tier
  "aggregator_validation", // techmeme, feedly top, HN — curadoria 2ª ordem
] as const

export const DecompositionSchema = z.object({
  subtemas: z.array(z.string()).describe("5-8 subtemas principais dentro do tema"),
  jargao: z.array(z.string()).describe("5-10 termos técnicos/jargão que experts usam"),
  perfis_alvo: z.object({
    tier_1: z.string().describe("Descrição do tipo de fonte TIER_1 ideal pra esse tema"),
    tier_2: z.string().describe("Descrição do tipo de fonte TIER_2 (especializado)"),
    blog: z.string().describe("Descrição do tipo de BLOG/newsletter autoral ideal"),
  }),
  anti_padroes: z.array(z.string()).describe("3-8 tipos de fonte a EVITAR"),
  queries: z.array(z.object({
    query: z.string().describe("Query exata pra web_search"),
    language: z.enum(["pt-BR", "en"]),
    strategy: z.enum(STRATEGIES),
    goal: z.string().describe("O que essa query busca revelar"),
  })).describe("4-10 queries cobrindo múltiplas estratégias complementares"),
})

export const RawCandidateSchema = z.object({
  host: z.string().describe("Domínio raiz sem www, sem https://, sem path. Ex: folha.uol.com.br"),
  name: z.string().describe("Nome editorial do veículo"),
  language: z.enum(["pt-BR", "en", "es"]),
  preliminaryTier: z.enum(["TIER_1", "TIER_2", "BLOG"]).optional(),
  foundVia: z.array(z.string()).describe("Quais estratégias/queries encontraram essa fonte"),
  snippet: z.string().describe("Razão breve pela qual a fonte é relevante pro tema"),
})
export const DiscoveryResponseSchema = z.object({
  candidates: z.array(RawCandidateSchema).describe("10-50 candidatos brutos sem filtrar"),
})

const ScoredSourceSchema = z.object({
  host: z.string(),
  name: z.string(),
  tier: z.enum(["TIER_1", "TIER_2", "BLOG"]),
  language: z.enum(["pt-BR", "en", "es"]),
  note: z.string().describe("1 frase sobre a força editorial da fonte pro tema"),
  scores: z.object({
    authority: z.number().min(0).max(10).describe("Autoridade editorial (equipe real, jornalistas, editores)"),
    specialization: z.number().min(0).max(10).describe("Quão especializada NESSE tema específico"),
    frequency: z.number().min(0).max(10).describe("Frequência de publicação sobre o tema"),
    independence: z.number().min(0).max(10).describe("Independência (não é PR disfarçado, não é agregador)"),
    languageFit: z.number().min(0).max(10).describe("Adequação ao mix PT/EN desejado pelo usuário"),
  }),
  aggregateScore: z.number().min(0).max(10).describe("Média ponderada dos 5 scores"),
  validationEvidence: z.string().describe("Evidência concreta de validação via web_search site:"),
})
const RankingResponseSchema = z.object({
  sources: z.array(ScoredSourceSchema).describe("Top 8-15 fontes validadas e rankeadas"),
  rejected: z.array(z.object({
    host: z.string(),
    reason: z.enum(["inactive", "off_topic", "aggregator", "hallucination", "low_authority", "duplicate"]),
    detail: z.string().optional(),
  })).describe("Candidatos descartados durante validação"),
})

export type TermSource = {
  host: string
  name: string
  tier: "TIER_1" | "TIER_2" | "BLOG"
  language: "pt-BR" | "en" | "es"
  note?: string
  isActive: boolean
  scores?: {
    authority: number
    specialization: number
    frequency: number
    independence: number
    languageFit: number
  }
  aggregateScore?: number
  // Validação HTTP server-side (após stage 3)
  validationStatus?: "ok" | "site_name_mismatch" | "not_publisher" | "unreachable" | "error"
  validationNote?: string
  detectedSiteName?: string | null
  lastValidatedAt?: string
}

// ── Helpers ─────────────────────────────────────────────────────────────

// Seleciona as N queries mais valiosas das planejadas no stage 1.
// Prioriza diversidade de strategy + balance de idiomas.
function prioritizeQueries<T extends { strategy: string; language: string }>(queries: T[], max: number): T[] {
  if (queries.length <= max) return queries
  const seenStrategies = new Set<string>()
  const seenByLang: Record<string, number> = {}
  const selected: T[] = []
  // Primeira passada: uma por strategy única
  for (const q of queries) {
    if (selected.length >= max) break
    if (!seenStrategies.has(q.strategy)) {
      seenStrategies.add(q.strategy)
      seenByLang[q.language] = (seenByLang[q.language] ?? 0) + 1
      selected.push(q)
    }
  }
  // Segunda passada: preenche até max mantendo balance
  for (const q of queries) {
    if (selected.length >= max) break
    if (!selected.includes(q)) selected.push(q)
  }
  return selected
}

function normalizeHost(raw: string): string {
  return raw.toLowerCase().trim()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/+.*$/, "")
    .replace(/\/+$/, "")
}

// Loop pause_turn genérico — aceita multi-round web_search
async function runWithPauseTurn(opts: {
  systemPrompt: string
  userPrompt: string
  tools?: Anthropic.MessageCreateParams["tools"]
  effort: "low" | "medium" | "high"
  maxTokens: number
  outputSchema: z.ZodType
  maxRounds?: number
}): Promise<{ text: string; usage: { input: number; output: number; cacheRead: number; cacheCreation: number; searchesUsed: number } }> {
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: opts.userPrompt }]
  const totals = { input: 0, output: 0, cacheRead: 0, cacheCreation: 0, searchesUsed: 0 }
  const maxRounds = opts.maxRounds ?? 6
  let finalText: string | null = null

  for (let i = 0; i < maxRounds; i++) {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: opts.maxTokens,
      system: [{ type: "text", text: opts.systemPrompt, cache_control: { type: "ephemeral" } }],
      thinking: { type: "adaptive" },
      output_config: { format: zodOutputFormat(opts.outputSchema), effort: opts.effort },
      ...(opts.tools ? { tools: opts.tools } : {}),
      messages,
    })
    totals.input += response.usage.input_tokens
    totals.output += response.usage.output_tokens
    totals.cacheRead += response.usage.cache_read_input_tokens ?? 0
    totals.cacheCreation += response.usage.cache_creation_input_tokens ?? 0
    for (const b of response.content) {
      if (b.type === "server_tool_use" && b.name === "web_search") totals.searchesUsed++
    }
    if (response.stop_reason === "pause_turn") {
      messages.push({ role: "assistant", content: response.content })
      continue
    }
    const tb = [...response.content].reverse().find((b): b is Anthropic.TextBlock => b.type === "text")
    if (!tb) throw new Error(`stage failed: sem text (stop=${response.stop_reason})`)
    finalText = tb.text
    break
  }
  if (!finalText) throw new Error("stage failed: pause_turn loop exceeded")
  return { text: finalText, usage: totals }
}

// ── Stage 1: Decomposição ───────────────────────────────────────────────

function buildDecompositionSystemPrompt(): string {
  return `Você é CURADOR EDITORIAL SÊNIOR. Primeiro estágio: entender profundamente o tema ANTES de buscar fontes.

TAREFA
Receber um tema + intenção do usuário. Produzir um "perfil de descoberta" que vai guiar as buscas nos estágios seguintes.

O QUE ENTREGAR

1. subtemas: 5-8 subtemas principais dentro do tema. Seja específico e técnico.
   Ex: tema="Inteligência Artificial" → ["LLMs e modelos fundacionais", "visão computacional", "robótica embodied", "ética e regulação", "aplicações médicas", "agentes autônomos", "computação em dispositivos"]

2. jargao: 5-10 termos técnicos que REAIS experts usam (não o vocabulário do público).
   Ex: tema="IA" → ["context window", "RLHF", "MoE", "retrieval-augmented generation", "benchmark saturation"]

3. perfis_alvo: 3 descrições do tipo IDEAL de fonte em cada tier.
   - tier_1: publishers com redação estabelecida específica pro nicho
   - tier_2: veículos especializados reconhecidos (não generalistas com seção)
   - blog: newsletters/blogs autorais de autoridade respeitada (ex: Stratechery pra tech, TBPN, etc)

4. anti_padroes: 3-8 tipos a EVITAR. Seja cruel.
   Ex: "agregadores sem apuração", "sites de listículos SEO-oriented", "blogs que só replicam notícias de outros", "sites de opinião polarizada", "canais YouTube sem site próprio"

5. queries: 4-10 queries concretas pra web_search, cobrindo MÚLTIPLAS estratégias:
   - authority: "best sources on X", "top publications about X"
   - expert_pick: "X experts recommend", "where do X professionals read"
   - recent_coverage: "X news weekly", "X latest analysis"
   - deep_analysis: "X in-depth analysis", "X long-form journalism"
   - newsletter_blog: "best newsletter X", "top substack X"
   - aggregator_validation: "techmeme X", "hacker news X topic"
   Distribua queries em PT-BR e EN conforme o tema (tema brasileiro → mais PT; tema frontier tech → mais EN).

REGRAS
- Pense como especialista da área, não como generalista.
- Queries devem ser ESPECÍFICAS, não "<tema> best sites" genérico.
- Use jargão técnico nas queries quando apropriado (aumenta precisão).
- Diversifique estratégias — não concentre em authority + recent_coverage só.

CETICISMO OBRIGATÓRIO
- Prefira QUALIDADE > quantidade. Melhor 8 fontes excelentes que 15 medianas.
- Se não está seguro que uma fonte é boa, NÃO sugira queries que vão trazê-la.
- Anti-padrões: seja implacável. Liste todos os tipos de lixo que o usuário pode odiar.
- Público brasileiro sobre tema técnico internacional → mix 30% PT-BR (contexto local) + 70% EN (frontier).

FORMATO: JSON conforme schema.`
}

export async function stageDecomposition(opts: {
  term: string
  intent?: string | null
  userId: string
}): Promise<z.infer<typeof DecompositionSchema> & { _usage: { input: number; output: number; cacheRead: number; cacheCreation: number; searchesUsed: number; durationMs: number } }> {
  const { term, intent, userId } = opts
  const userPrompt = `TEMA: "${term}"
${intent ? `INTENÇÃO/FOCO DECLARADO: ${intent}` : "(sem intenção declarada — use julgamento padrão)"}

Produza o perfil de descoberta seguindo o schema. Pense profundamente sobre o tema antes de escrever.`

  const start = Date.now()
  const { text, usage } = await runWithPauseTurn({
    systemPrompt: buildDecompositionSystemPrompt(),
    userPrompt,
    effort: "medium",
    maxTokens: 6000,
    outputSchema: DecompositionSchema,
    maxRounds: 2,
  })
  const durationMs = Date.now() - start

  let parsed: z.infer<typeof DecompositionSchema>
  try { parsed = DecompositionSchema.parse(JSON.parse(text)) }
  catch (err) {
    console.error("[stage1] parse:", err, "raw:", text.slice(0, 400))
    throw new Error("Falha ao parsear decomposição")
  }

  trackUsage(MODEL, "source_discovery_stage1", usage.input, usage.output, durationMs, userId, {
    cacheReadTokens: usage.cacheRead, cacheCreationTokens: usage.cacheCreation,
    subtemasCount: parsed.subtemas.length, queriesCount: parsed.queries.length,
  }).catch(() => {})

  return { ...parsed, _usage: { ...usage, durationMs } }
}

// ── Stage 2: Descoberta ─────────────────────────────────────────────────

function buildDiscoverySystemPrompt(): string {
  return `Você é CURADOR EDITORIAL SÊNIOR executando o segundo estágio: DESCOBERTA.

TAREFA
Receber queries planejadas + perfis alvo + anti-padrões. Executar web_search nas queries. Agregar candidatos de publishers/blogs/newsletters.

IMPORTANTE
- Execute TODAS as queries planejadas (ou o máximo possível dentro do limite de web_search).
- Pra cada resultado, extraia o HOST (domínio raiz) do publisher.
- NÃO descarte por qualidade AINDA — só descarte claramente lixo (spam, sites porn/gambling, paywall total).
- Candidate deve ter pelo menos 1 matéria sobre o tema no snippet — sinal mínimo de relevância.
- Seja LIBERAL aqui. Mire em 20-40 candidatos. Próximo estágio valida cada um.
- foundVia: lista das strategies/queries que encontraram a fonte. Candidatos que aparecem em MÚLTIPLAS queries tendem a ser melhores.
- Registre publishers UNIVERSAIS dos resultados (não URLs individuais).

ANTI-PADRÕES (descartar imediatamente)
- news.google.com, bing.com/news (agregadores)
- Twitter, Facebook, LinkedIn, YouTube (redes sociais, não fontes)
- Sites de e-commerce, PR wires genéricos
- Blogs que obviamente replicam de outros sites

FORMATO: JSON { candidates: [...] } conforme schema.`
}

export async function stageDiscovery(opts: {
  term: string
  intent?: string | null
  decomposition: z.infer<typeof DecompositionSchema>
  userId: string
}): Promise<z.infer<typeof DiscoveryResponseSchema> & { _usage: { input: number; output: number; cacheRead: number; cacheCreation: number; searchesUsed: number; durationMs: number } }> {
  const { term, intent, decomposition, userId } = opts

  // Prioriza as queries mais valiosas: diferentes strategies + mix de idiomas.
  // Limita a 4 pra evitar timeout de 504 em proxies que cortam em 25-60s.
  const prioritizedQueries = prioritizeQueries(decomposition.queries, 4)

  const userPrompt = `TEMA: "${term}"
${intent ? `INTENÇÃO: ${intent}` : ""}

PERFIS ALVO:
- TIER_1: ${decomposition.perfis_alvo.tier_1}
- TIER_2: ${decomposition.perfis_alvo.tier_2}
- BLOG: ${decomposition.perfis_alvo.blog}

ANTI-PADRÕES A EVITAR:
${decomposition.anti_padroes.slice(0, 5).map((a) => `- ${a}`).join("\n")}

QUERIES PRIORITÁRIAS (${prioritizedQueries.length}):
${prioritizedQueries.map((q, i) => `[${i + 1}] (${q.strategy}/${q.language}) "${q.query}"`).join("\n")}

Execute TODAS as queries acima. Agregue candidatos com foundVia. Alvo 12-25 candidatos. Se chegar a 20+, pare.`

  const start = Date.now()
  console.log(`[stage2] iniciando — term="${term}" queries=${prioritizedQueries.length}`)
  const { text, usage } = await runWithPauseTurn({
    systemPrompt: buildDiscoverySystemPrompt(),
    userPrompt,
    tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 4 } as Anthropic.MessageCreateParams["tools"] extends (infer U)[] ? U : never] as Anthropic.MessageCreateParams["tools"],
    effort: "low",
    maxTokens: 4000,
    outputSchema: DiscoveryResponseSchema,
    maxRounds: 3,
  })
  console.log(`[stage2] anthropic returned — searchesUsed=${usage.searchesUsed} inputTokens=${usage.input} outputTokens=${usage.output}`)
  const durationMs = Date.now() - start

  let parsed: z.infer<typeof DiscoveryResponseSchema>
  try { parsed = DiscoveryResponseSchema.parse(JSON.parse(text)) }
  catch (err) {
    console.error("[stage2] parse:", err, "raw:", text.slice(0, 400))
    throw new Error("Falha ao parsear descoberta")
  }

  // Normaliza hosts + dedup no cliente
  const seen = new Set<string>()
  const dedupedCandidates: typeof parsed.candidates = []
  for (const c of parsed.candidates) {
    const host = normalizeHost(c.host)
    if (!host || seen.has(host)) continue
    seen.add(host)
    dedupedCandidates.push({ ...c, host })
  }

  trackUsage(MODEL, "source_discovery_stage2", usage.input, usage.output, durationMs, userId, {
    cacheReadTokens: usage.cacheRead, cacheCreationTokens: usage.cacheCreation,
    searchesUsed: usage.searchesUsed, candidatesRaw: parsed.candidates.length, candidatesDeduped: dedupedCandidates.length,
  }).catch(() => {})

  return { ...parsed, candidates: dedupedCandidates, _usage: { ...usage, durationMs } }
}

// ── Stage 3: Validação + Ranking ────────────────────────────────────────

function buildRankingSystemPrompt(): string {
  return `Você é CURADOR EDITORIAL SÊNIOR executando o terceiro estágio: VALIDAÇÃO + RANKING.

TAREFA
Receber uma lista de candidatos (hosts). Pra CADA candidato, VALIDAR com web_search que:
1. O host EXISTE e está ativo (posts últimos 30 dias)
2. Cobre o TEMA ESPECÍFICO (não só tem uma seção tangencial)
3. Publica com FREQUÊNCIA sobre o tema (pelo menos alguns posts recentes)
4. NÃO é agregador/mirror de outros

PROTOCOLO DE VALIDAÇÃO
Pra cada candidato, execute UMA query do tipo:
  site:<host> <tema> OR site:<host> <jargão específico>

Observe os resultados:
- Se 0 resultados → provavelmente hallucination ou morto → REJECT("inactive" ou "hallucination")
- Se resultados mas NENHUM sobre o tema → REJECT("off_topic")
- Se parece mirror/agregador (só títulos copiados) → REJECT("aggregator")
- Se autoridade óbvia baixa (Wikipedia, quora, reddit raiz) → REJECT("low_authority")
- Senão → APROVAR e scorear

SCORING (0-10 por dimensão, pesar na aggregateScore)
- authority: equipe editorial identificável? jornalistas com nome? editor-chefe visível?
- specialization: site é SOBRE o tema ou só COBRE o tema? Dedicated publication > section.
- frequency: baseado no site:, quantos posts recentes? 5+ recentes no mês = 8-10; <2/mês = 2-4.
- independence: apuração própria visível? ou só replica releases/news wires?
- languageFit: mix de idiomas alinhado com o tema (tema BR → PT fit alto; tema frontier tech → EN fit alto).

REGRAS FINAIS
- Retorne TOP 8-15 fontes após validação. Qualidade > quantidade.
- Balance tiers: inclua TIER_1 (publishers), TIER_2 (especializados), e 2-4 BLOG de autoridade.
- Balance idiomas conforme o tema pede.
- note: 1 frase objetiva sobre por que a fonte é valiosa PRO TEMA específico.
- validationEvidence: string concreta do que viu no site:, tipo "site:<host> <tema> retornou 12 posts, 5 nos últimos 14 dias".

CETICISMO RIGOROSO
- NUNCA inclua um host que você "acha" que existe. Se o web_search não confirmou, REJECT("hallucination").
- Requisito mínimo de posts recentes: 3+ nos últimos 60 dias. Se menos, REJECT("inactive").
- Se o host é parte de um grupo maior (ex: globo.com), confirme que a URL vai pra SEÇÃO específica do tema, não pro domínio raiz. Se for raiz, REJECT("low_authority") — não é fonte dedicada.
- Wikipedia, Reddit raiz, Quora, Twitter, Medium raiz → SEMPRE REJECT("low_authority").
- Se o publisher é conhecido mas a cobertura desse tema específico é fraca (só 1-2 posts genéricos), REJECT("off_topic").

FORMATO: JSON { sources: [...], rejected: [...] } conforme schema.`
}

export async function stageRanking(opts: {
  term: string
  intent?: string | null
  candidates: z.infer<typeof DiscoveryResponseSchema>["candidates"]
  decomposition: z.infer<typeof DecompositionSchema>
  userId: string
}): Promise<z.infer<typeof RankingResponseSchema> & { _usage: { input: number; output: number; cacheRead: number; cacheCreation: number; searchesUsed: number; durationMs: number } }> {
  const { term, intent, candidates, decomposition, userId } = opts

  const userPrompt = `TEMA: "${term}"
${intent ? `INTENÇÃO: ${intent}` : ""}

SUBTEMAS (pra validar cobertura):
${decomposition.subtemas.map((s) => `- ${s}`).join("\n")}

JARGÃO TÉCNICO (use em queries site:):
${decomposition.jargao.join(", ")}

CANDIDATOS A VALIDAR (${candidates.length}):
${candidates.map((c, i) => `[${i + 1}] ${c.host} (${c.name}) · ${c.language} · tier preliminar: ${c.preliminaryTier ?? "?"} · ${c.snippet}`).join("\n")}

Execute site: pra validar cada candidato. Descarte hallucinations/mortos/off-topic. Scoreie e retorne top 8-15 rankeados + lista de rejeitados com motivo.`

  const start = Date.now()
  const { text, usage } = await runWithPauseTurn({
    systemPrompt: buildRankingSystemPrompt(),
    userPrompt,
    tools: [{ type: "web_search_20260209", name: "web_search", max_uses: Math.min(Math.max(candidates.length, 8), 12) } as Anthropic.MessageCreateParams["tools"] extends (infer U)[] ? U : never] as Anthropic.MessageCreateParams["tools"],
    effort: "medium",
    maxTokens: 10000,
    outputSchema: RankingResponseSchema,
    maxRounds: 6,
  })
  const durationMs = Date.now() - start

  let parsed: z.infer<typeof RankingResponseSchema>
  try { parsed = RankingResponseSchema.parse(JSON.parse(text)) }
  catch (err) {
    console.error("[stage3] parse:", err, "raw:", text.slice(0, 400))
    throw new Error("Falha ao parsear ranking")
  }

  // Normaliza hosts nos resultados
  parsed.sources = parsed.sources.map((s) => ({ ...s, host: normalizeHost(s.host) }))
  parsed.rejected = parsed.rejected.map((r) => ({ ...r, host: normalizeHost(r.host) }))

  trackUsage(MODEL, "source_discovery_stage3", usage.input, usage.output, durationMs, userId, {
    cacheReadTokens: usage.cacheRead, cacheCreationTokens: usage.cacheCreation,
    searchesUsed: usage.searchesUsed, sourcesFinal: parsed.sources.length, rejectedCount: parsed.rejected.length,
  }).catch(() => {})

  return { ...parsed, _usage: { ...usage, durationMs } }
}

// ── Pipeline orquestrador ───────────────────────────────────────────────

export async function discoverSourcesForTerm(opts: {
  term: string
  intent?: string | null
  userId: string
}): Promise<{
  sources: TermSource[]
  rejected: Array<{ host: string; reason: string; detail?: string }>
  decomposition: z.infer<typeof DecompositionSchema>
  usage: { inputTokens: number; outputTokens: number; searchesUsed: number; totalDurationMs: number; stageTimings: Record<string, number> }
}> {
  const { term, intent, userId } = opts
  const pipelineStart = Date.now()

  // Stage 1 — Decomposição
  console.log(`[source-discovery] stage1 começando...`)
  const decomp = await stageDecomposition({ term, intent, userId })
  console.log(`[source-discovery] stage1 OK em ${decomp._usage.durationMs}ms: ${decomp.subtemas.length} subtemas, ${decomp.queries.length} queries planejadas`)

  // Stage 2 — Descoberta
  console.log(`[source-discovery] stage2 começando...`)
  const disc = await stageDiscovery({ term, intent, decomposition: decomp, userId })
  console.log(`[source-discovery] stage2 OK em ${disc._usage.durationMs}ms: ${disc.candidates.length} candidatos brutos, ${disc._usage.searchesUsed} searches`)

  // Stage 3 — Validação + Ranking
  console.log(`[source-discovery] stage3 começando...`)
  const rank = await stageRanking({ term, intent, candidates: disc.candidates, decomposition: decomp, userId })
  console.log(`[source-discovery] stage3 OK em ${rank._usage.durationMs}ms: ${rank.sources.length} aprovadas, ${rank.rejected.length} rejeitadas, ${rank._usage.searchesUsed} searches`)

  // Stage 4 (novo) — Validação HTTP server-side: pega hosts mortos, hallucinations,
  // not-publishers que passaram nos site: do stage 3.
  console.log(`[source-discovery] stage4 (validação HTTP) começando...`)
  const validationStart = Date.now()
  const { validateHosts } = await import("./source-validator")
  const results = await validateHosts(
    rank.sources.map((s) => ({ host: s.host, expectedName: s.name })),
    4,
  )
  const validationMs = Date.now() - validationStart
  const allRejected = [...rank.rejected.map((r) => ({ host: r.host, reason: r.reason, detail: r.detail }))]

  const validatedSources: TermSource[] = []
  for (const s of rank.sources) {
    const v = results.get(s.host)
    if (!v || v.status === "unreachable" || v.status === "not_publisher") {
      // Hard reject: host não responde ou não parece publisher
      allRejected.push({
        host: s.host,
        reason: v?.status === "unreachable" ? "inactive" : v?.status === "not_publisher" ? "low_authority" : "inactive",
        detail: v?.notes ?? "falha na validação HTTP",
      })
      continue
    }
    validatedSources.push({
      host: s.host,
      name: s.name,
      tier: s.tier,
      language: s.language,
      note: s.note,
      isActive: true,
      scores: s.scores,
      aggregateScore: s.aggregateScore,
      validationStatus: v.status,
      validationNote: v.notes,
      detectedSiteName: v.detectedSiteName ?? null,
      lastValidatedAt: v.checkedAt,
    })
  }
  console.log(`[source-discovery] stage4 OK em ${validationMs}ms: ${validatedSources.length} passaram, ${rank.sources.length - validatedSources.length} rejeitadas na validação HTTP`)

  const totalDurationMs = Date.now() - pipelineStart

  return {
    sources: validatedSources,
    rejected: allRejected,
    decomposition: decomp,
    usage: {
      inputTokens: decomp._usage.input + disc._usage.input + rank._usage.input,
      outputTokens: decomp._usage.output + disc._usage.output + rank._usage.output,
      searchesUsed: disc._usage.searchesUsed + rank._usage.searchesUsed,
      totalDurationMs,
      stageTimings: {
        stage1: decomp._usage.durationMs,
        stage2: disc._usage.durationMs,
        stage3: rank._usage.durationMs,
        stage4_validation: validationMs,
      },
    },
  }
}
