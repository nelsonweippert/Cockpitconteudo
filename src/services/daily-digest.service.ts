// Daily digest — orquestra: discovery por tema → cache → resumo Haiku → Telegram.
//
// Unifica com generateIdeasNow via ThemeDiscoveryRun: se hoje já rodou discovery
// pro tema, reaproveita os candidates ao invés de fazer novo web_search.

import Anthropic from "@anthropic-ai/sdk"
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod"
import { z } from "zod"
import { db } from "@/lib/db"
import { Prisma } from "@/generated/prisma/client"
import { runDiscoveryPhase, trackUsage } from "./ai.service"
import { sendMessage, escapeMdV2 } from "./telegram.service"

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const DIGEST_MODEL = "claude-haiku-4-5" as const

// Shape dos candidates persistidos na ThemeDiscoveryRun (igual output do runDiscoveryPhase)
export type CachedCandidate = {
  term: string
  url: string
  title: string
  snippet: string
  publisher: string
  publishedAt?: string | null
  locale: "pt-BR" | "en-US" | "other"
}

// ─── Schema do digest por tema ──────────────────────────────────────────

const ThemeDigestSchema = z.object({
  topStory: z.object({
    title: z.string().describe("Título curto da matéria mais importante (< 80 chars)"),
    publisher: z.string(),
    url: z.string(),
    whyItMatters: z.string().describe("1 frase curta (max 120 chars): POR QUE essa matéria é o destaque do dia pro tema"),
  }).nullable(),
  bullets: z.array(z.object({
    title: z.string().describe("Título resumido (< 70 chars)"),
    publisher: z.string(),
    url: z.string(),
    whyItMatters: z.string().describe("1 frase curtíssima (max 100 chars): por que importa"),
  })).max(4).describe("Até 4 outras matérias complementares, ordenadas por relevância"),
  themeSynthesis: z.string().describe("1-2 frases resumindo o CONTEXTO GERAL do dia pro tema (max 200 chars)"),
})
type ThemeDigest = z.infer<typeof ThemeDigestSchema>

async function summarizeThemeCandidates(opts: {
  termName: string
  intent?: string | null
  candidates: CachedCandidate[]
  userId: string
}): Promise<ThemeDigest> {
  const { termName, intent, candidates, userId } = opts

  if (candidates.length === 0) {
    return { topStory: null, bullets: [], themeSynthesis: "Nenhuma novidade relevante encontrada nas últimas 24h." }
  }

  const candidatesBlock = candidates.slice(0, 10).map((c, i) => {
    const pub = c.publishedAt ? ` [publicado: ${c.publishedAt}]` : ""
    return `${i + 1}. ${c.title} (${c.publisher})${pub}\n   URL: ${c.url}\n   Snippet: ${c.snippet.slice(0, 200)}`
  }).join("\n\n")

  const system = `Você é EDITOR-CHEFE de um digest diário curto pra um criador de conteúdo.
Dada uma lista de matérias encontradas hoje sobre UM TEMA, escolha a mais importante (topStory), até 4 outras complementares (bullets), e sintetize o contexto do dia (themeSynthesis).

REGRAS
- topStory = a matéria de MAIOR impacto/novidade. Se empatar, prefira a mais recente e de publisher mais autoritativo.
- bullets = ate 4 outras relevantes, SEM repetir a topStory.
- whyItMatters = sempre em PT-BR, 1 frase objetiva, foco em "pra quem acompanha o tema, por que isso não pode passar batido hoje".
- themeSynthesis = 1-2 frases sobre O QUE DOMINA o tema hoje (tendência, fato central).
- Se a matéria não for realmente nova (ex: análise antiga), pode pular.
- NUNCA invente dados. Só use o que tem nos snippets.

FORMATO: JSON conforme schema. PT-BR sempre.`

  const userPrompt = `TEMA: "${termName}"
${intent ? `INTENÇÃO/FOCO DO USUÁRIO: ${intent}` : ""}

MATÉRIAS ENCONTRADAS HOJE (total: ${candidates.length}):
${candidatesBlock}

Monte o digest do dia.`

  const start = Date.now()
  const response = await anthropic.messages.create({
    model: DIGEST_MODEL,
    max_tokens: 2000,
    system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
    output_config: { format: zodOutputFormat(ThemeDigestSchema) },
    messages: [{ role: "user", content: userPrompt }],
  })
  const durationMs = Date.now() - start

  const tb = [...response.content].reverse().find((b): b is Anthropic.TextBlock => b.type === "text")
  if (!tb) throw new Error("digest: sem text na resposta")

  const parsed = ThemeDigestSchema.parse(JSON.parse(tb.text))

  trackUsage(DIGEST_MODEL, "daily_digest_theme", response.usage.input_tokens, response.usage.output_tokens, durationMs, userId, {
    candidatesIn: candidates.length,
    bulletsOut: parsed.bullets.length,
  }).catch(() => {})

  return parsed
}

// ─── Helpers de formatação Telegram ─────────────────────────────────────

function fmtDateBR(d: Date): string {
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "America/Sao_Paulo" })
}

function buildIntroMessage(themesCount: number): string {
  const today = escapeMdV2(fmtDateBR(new Date()))
  const plural = themesCount === 1 ? "tema" : "temas"
  return `📰 *Digest diário* — ${today}
━━━━━━━━━━━━━━━━━━━━━

Monitorando *${themesCount}* ${plural} hoje\\. As próximas mensagens trazem as principais novidades de cada um\\.`
}

function buildThemeMessage(termName: string, digest: ThemeDigest): string {
  const name = escapeMdV2(termName)
  const synth = escapeMdV2(digest.themeSynthesis)

  let msg = `📌 *${name}*

_${synth}_`

  if (digest.topStory) {
    const t = digest.topStory
    msg += `

⭐ *Destaque:* ${escapeMdV2(t.title)}
${escapeMdV2(t.publisher)}
↳ ${escapeMdV2(t.whyItMatters)}
[ler matéria](${t.url})`
  }

  if (digest.bullets.length > 0) {
    msg += `\n\n*Outras novidades:*`
    for (const b of digest.bullets) {
      msg += `\n\n• *${escapeMdV2(b.title)}* — ${escapeMdV2(b.publisher)}\n  ↳ ${escapeMdV2(b.whyItMatters)}\n  [ler](${b.url})`
    }
  }

  return msg
}

function buildEmptyThemeMessage(termName: string, reason: string): string {
  const name = escapeMdV2(termName)
  const r = escapeMdV2(reason)
  return `📌 *${name}*

_Sem novidades relevantes hoje\\._
${r}`
}

// ─── Discovery wrapper com cache diário ─────────────────────────────────

// Pega candidates de hoje. Se já tem cache (ThemeDiscoveryRun), usa.
// Senão, roda runDiscoveryPhase pro termo e persiste.
export async function getOrRunTodayDiscovery(opts: {
  userId: string
  termId: string
  termName: string
  intent?: string | null
  sources?: string[]
}): Promise<{
  run: Awaited<ReturnType<typeof db.themeDiscoveryRun.findUnique>>
  candidates: CachedCandidate[]
  cached: boolean
}> {
  const { userId, termId, termName, intent, sources = [] } = opts
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)

  // Tem cache de hoje?
  const existing = await db.themeDiscoveryRun.findUnique({
    where: { userId_termId_runDate: { userId, termId, runDate: today } },
  })
  if (existing) {
    return { run: existing, candidates: existing.candidates as unknown as CachedCandidate[], cached: true }
  }

  // Roda discovery focado NESTE termo
  const startedAt = Date.now()
  const { candidates, usage } = await runDiscoveryPhase({
    terms: [termName],
    termIntents: intent ? { [termName]: intent } : {},
    sourcesByTerm: sources.length > 0 ? { [termName]: sources } : {},
    userId,
  })
  const durationMs = Date.now() - startedAt

  const created = await db.themeDiscoveryRun.create({
    data: {
      userId,
      termId,
      runDate: today,
      candidates: candidates as unknown as Prisma.InputJsonValue,
      candidatesCount: candidates.length,
      searchesUsed: usage.searchesUsed,
      durationMs,
    },
  })
  return { run: created, candidates: candidates as CachedCandidate[], cached: false }
}

// ─── Orquestrador principal ─────────────────────────────────────────────

export type DigestRunResult = {
  userId: string
  chatId: string | null
  themesProcessed: number
  themesWithNews: number
  themesCached: number
  messagesSent: number
  errors: string[]
}

// Roda digest completo pra UM user: discover todos temas ativos com fontes,
// sumariza cada um, envia mensagens no Telegram.
export async function runDailyDigestForUser(userId: string): Promise<DigestRunResult> {
  const result: DigestRunResult = {
    userId,
    chatId: null,
    themesProcessed: 0,
    themesWithNews: 0,
    themesCached: 0,
    messagesSent: 0,
    errors: [],
  }

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { telegramChatId: true },
  })
  if (!user?.telegramChatId) {
    result.errors.push("Usuário sem telegramChatId vinculado")
    return result
  }
  result.chatId = user.telegramChatId

  const terms = await db.monitorTerm.findMany({
    where: { userId, isActive: true, includeInDigest: true },
    orderBy: { createdAt: "asc" },
  })

  // Filtra só temas com pelo menos 1 fonte ativa (ou nenhum critério se user não curou fontes)
  const termsToProcess = terms.filter((t) => {
    const s = Array.isArray(t.sources) ? (t.sources as unknown as { isActive?: boolean }[]) : []
    if (s.length === 0) return true // sem curadoria → busca livre
    return s.some((x) => x?.isActive !== false)
  })

  if (termsToProcess.length === 0) {
    const msg = `📰 *Digest diário*

Nenhum tema habilitado pro digest\\. Em /bot você escolhe quais temas aparecem aqui\\.`
    await sendMessage({ chatId: user.telegramChatId, text: msg })
    result.messagesSent++
    return result
  }

  // Intro
  const introRes = await sendMessage({ chatId: user.telegramChatId, text: buildIntroMessage(termsToProcess.length) })
  if (introRes.ok) result.messagesSent++

  // Processa tema a tema (sequencial pra evitar burst na Bot API)
  for (const term of termsToProcess) {
    result.themesProcessed++
    try {
      const activeSources = (Array.isArray(term.sources) ? (term.sources as unknown as { host: string; isActive?: boolean }[]) : [])
        .filter((s) => s?.isActive !== false)
        .map((s) => s.host)

      const { candidates, cached } = await getOrRunTodayDiscovery({
        userId,
        termId: term.id,
        termName: term.term,
        intent: term.intent,
        sources: activeSources,
      })
      if (cached) result.themesCached++
      if (candidates.length > 0) result.themesWithNews++

      let messageText: string
      if (candidates.length === 0) {
        messageText = buildEmptyThemeMessage(term.term, "Discovery não encontrou matérias novas hoje.")
      } else {
        const digest = await summarizeThemeCandidates({
          termName: term.term,
          intent: term.intent,
          candidates,
          userId,
        })
        messageText = buildThemeMessage(term.term, digest)

        // Persiste digestText e digestSentAt
        const today = new Date()
        today.setUTCHours(0, 0, 0, 0)
        await db.themeDiscoveryRun.update({
          where: { userId_termId_runDate: { userId, termId: term.id, runDate: today } },
          data: { digestText: messageText, digestSentAt: new Date() },
        }).catch(() => {})
      }

      // Telegram tem limite de 4096 chars/msg. Se passar, trunca.
      const truncated = messageText.length > 3800 ? messageText.slice(0, 3750) + "\n\n_\\.\\.\\. \\(truncado\\)_" : messageText
      const sent = await sendMessage({ chatId: user.telegramChatId, text: truncated })
      if (sent.ok) {
        result.messagesSent++
      } else {
        result.errors.push(`${term.term}: falha envio — ${sent.error}`)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "erro"
      result.errors.push(`${term.term}: ${msg}`)
      console.error(`[daily-digest] tema "${term.term}" falhou:`, err)
      // Persiste erro no run de hoje se existe
      try {
        const today = new Date()
        today.setUTCHours(0, 0, 0, 0)
        await db.themeDiscoveryRun.update({
          where: { userId_termId_runDate: { userId, termId: term.id, runDate: today } },
          data: { digestError: msg },
        })
      } catch { /* ok se não existe ainda */ }
    }
  }

  return result
}

// Pra cron: roda digest pra TODOS users com chatId vinculado.
export async function runDailyDigestForAllUsers(): Promise<{
  usersProcessed: number
  usersSuccess: number
  usersWithErrors: number
  results: DigestRunResult[]
}> {
  const users = await db.user.findMany({
    where: { telegramChatId: { not: null } },
    select: { id: true },
  })
  const results: DigestRunResult[] = []
  let usersSuccess = 0
  let usersWithErrors = 0
  for (const u of users) {
    try {
      const r = await runDailyDigestForUser(u.id)
      results.push(r)
      if (r.errors.length === 0) usersSuccess++
      else usersWithErrors++
    } catch (err) {
      console.error(`[daily-digest] user ${u.id} crash:`, err)
      usersWithErrors++
    }
  }
  return { usersProcessed: users.length, usersSuccess, usersWithErrors, results }
}
