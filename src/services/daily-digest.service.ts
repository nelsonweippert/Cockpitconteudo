// Daily digest — orquestra: discovery por tema → cache → resumo Haiku → Telegram.
//
// Unifica com generateIdeasNow via ThemeDiscoveryRun: se hoje já rodou discovery
// pro tema, reaproveita os candidates ao invés de fazer novo web_search.

import Anthropic from "@anthropic-ai/sdk"
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod"
import { z } from "zod"
import { db } from "@/lib/db"
import { Prisma } from "@/generated/prisma/client"
import { trackUsage } from "./ai.service"
import { runMultiSourceDiscovery } from "./discovery.service"
import { sendMessage, escapeMdV2 } from "./telegram.service"
import type { TermSource } from "@/types/source"

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const DIGEST_MODEL = "claude-haiku-4-5" as const

// Shape dos candidates persistidos na ThemeDiscoveryRun (igual output do discovery multi-source)
export type CachedCandidate = {
  term: string
  url: string
  title: string
  snippet: string
  publisher: string
  publishedAt?: string | null
  locale: "pt-BR" | "en-US" | "other"
  // Metadados de fonte — preenchidos quando o candidate vem de fórum/código (upstream)
  sourceOrigin?: "web_search" | "hn" | "reddit"
  upstreamScore?: number
}

// ─── Schema do digest por tema ──────────────────────────────────────────

const ThemeDigestSchema = z.object({
  topStory: z.object({
    title: z.string().describe("Título curto da matéria mais importante (< 80 chars)"),
    publisher: z.string(),
    url: z.string(),
    whyItMatters: z.string().describe("1 frase curta (max 120 chars): POR QUE essa matéria é o destaque do dia pro tema"),
    isUpstream: z.boolean().describe("true se a topStory vem de HN/Reddit/fórum. Isso significa que está ACONTECENDO AGORA, ainda não virou commodity em portais."),
    upstreamInsight: z.string().nullable().describe(
      "Se upstream signal forte (ex: assunto bombando no HN mas sem cobertura em publishers ainda), escreva 1 frase explicando a JANELA DE PIONEIRISMO: " +
      "'ainda não saiu em X/Y/Z', 'Brasil ainda não reportou isso', etc. Deixa null se não for o caso.",
    ),
  }).nullable(),
  bullets: z.array(z.object({
    title: z.string().describe("Título resumido (< 70 chars)"),
    publisher: z.string(),
    url: z.string(),
    whyItMatters: z.string().describe("1 frase curtíssima (max 100 chars): por que importa"),
    isUpstream: z.boolean().describe("true se vem de fórum/código (HN/Reddit), false se publisher tradicional"),
  })).max(4).describe("Até 4 outras matérias complementares, ordenadas por relevância"),
  themeSynthesis: z.string().describe("1-2 frases resumindo o CONTEXTO GERAL do dia pro tema (max 200 chars)"),
  upstreamGapSignal: z.number().min(0).max(100).describe(
    "0-100: quanto o dia tem SINAL UPSTREAM não-coberto ainda. 0 = só matérias recicladas de publishers. 100 = HN/Reddit fervendo, publishers ainda não reportaram. Esse é o SEU score de janela de pioneirismo."
  ),
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
    return { topStory: null, bullets: [], themeSynthesis: "Nenhuma novidade relevante encontrada nas últimas 24h.", upstreamGapSignal: 0 }
  }

  // Ordena: upstream (HN/Reddit) primeiro pro Claude ver o sinal à frente primeiro,
  // depois web_search, depois por upstreamScore decrescente.
  const sorted = [...candidates].sort((a, b) => {
    const aUp = a.sourceOrigin === "hn" || a.sourceOrigin === "reddit" ? 1 : 0
    const bUp = b.sourceOrigin === "hn" || b.sourceOrigin === "reddit" ? 1 : 0
    if (aUp !== bUp) return bUp - aUp
    return (b.upstreamScore ?? 0) - (a.upstreamScore ?? 0)
  })

  const candidatesBlock = sorted.slice(0, 15).map((c, i) => {
    const pub = c.publishedAt ? ` [publicado: ${c.publishedAt}]` : ""
    const originTag = c.sourceOrigin === "hn"
      ? " [ORIGEM: Hacker News — UPSTREAM]"
      : c.sourceOrigin === "reddit"
      ? " [ORIGEM: Reddit — UPSTREAM]"
      : " [ORIGEM: publisher]"
    const score = c.upstreamScore != null ? ` [score: ${c.upstreamScore}]` : ""
    return `${i + 1}. ${c.title} (${c.publisher})${pub}${originTag}${score}\n   URL: ${c.url}\n   Snippet: ${c.snippet.slice(0, 200)}`
  }).join("\n\n")

  const system = `Você é EDITOR-CHEFE de um digest diário pra um criador de conteúdo que quer ESTAR À FRENTE da cobertura comum.

SEU DIFERENCIAL: você recebe matérias marcadas com ORIGEM. Fontes UPSTREAM (Hacker News, Reddit) são onde a discussão NASCE — operadores/devs comentando antes da mídia escrever. Fontes PUBLISHER são mídia tradicional (cobrindo o que virou commodity).

REGRAS DE PRIORIZAÇÃO (ordem de importância)
1. GAP DETECTION — Se um assunto aparece em UPSTREAM (HN/Reddit bombando) mas AINDA NÃO virou cobertura em PUBLISHER, ISSO É O DESTAQUE. É a janela de pioneirismo do criador.
   - topStory nesse caso: escolha o post UPSTREAM com mais sinal (score alto)
   - Marque isUpstream: true
   - upstreamInsight: 1 frase identificando a janela, ex: "bombando no HN com 450 pts, ainda sem cobertura em TechCrunch/The Verge ou em PT-BR"

2. CORRIDA EM ANDAMENTO — Se o assunto está em UPSTREAM E em PUBLISHER simultaneamente, ainda prefira UPSTREAM pra topStory (é a fonte mais crua). Marque isUpstream: true. upstreamInsight pode ser null.

3. SÓ PUBLISHER — Se não tem sinal upstream, escolha a matéria de publisher com maior impacto. isUpstream: false, upstreamInsight: null.

OUTRAS REGRAS
- bullets: até 4 OUTRAS matérias relevantes (sem repetir topStory). Priorize diversidade de ORIGEM (misture upstream + publisher).
- whyItMatters: sempre PT-BR, 1 frase objetiva, foco em "por que não pode passar batido hoje".
- themeSynthesis: 1-2 frases sobre o que DOMINA o tema hoje.
- upstreamGapSignal (0-100): quão forte é a janela de pioneirismo neste digest:
  · 80-100 = UPSTREAM fervendo + publishers silentes (MÁXIMA janela)
  · 40-79 = UPSTREAM tem sinal mas publishers começando a reportar
  · 0-39 = publishers dominam, pouco sinal original
- NUNCA invente dados. Só use o que está nos snippets.
- Se nada é realmente novo hoje, diga na synthesis e baixe upstreamGapSignal.

FORMATO: JSON conforme schema. PT-BR sempre.`

  const userPrompt = `TEMA: "${termName}"
${intent ? `INTENÇÃO/FOCO DO USUÁRIO: ${intent}` : ""}

MATÉRIAS ENCONTRADAS HOJE (total: ${candidates.length}, ordenadas com UPSTREAM primeiro):
${candidatesBlock}

Monte o digest do dia. Lembre: SINAL UPSTREAM não-coberto = MAIOR janela pro criador.`

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

  // Cabeçalho — inclui flag de janela de pioneirismo se upstreamGapSignal alto
  const gapBadge = digest.upstreamGapSignal >= 70
    ? "🔥 *JANELA DE PIONEIRISMO* — sinal upstream forte, publishers ainda não cobriram\n\n"
    : digest.upstreamGapSignal >= 40
    ? "⚡ _Sinal upstream presente \\- matérias ainda crus_\n\n"
    : ""

  let msg = `📌 *${name}*

${gapBadge}_${synth}_`

  if (digest.topStory) {
    const t = digest.topStory
    // Ícone distinto pra upstream vs publisher
    const icon = t.isUpstream ? "🎯 *Janela:*" : "⭐ *Destaque:*"
    msg += `

${icon} ${escapeMdV2(t.title)}
${escapeMdV2(t.publisher)}${t.isUpstream ? " \\(fonte upstream\\)" : ""}
↳ ${escapeMdV2(t.whyItMatters)}`

    if (t.upstreamInsight) {
      msg += `\n💡 ${escapeMdV2(t.upstreamInsight)}`
    }

    msg += `\n[ler matéria](${t.url})`
  }

  if (digest.bullets.length > 0) {
    msg += `\n\n*Outras novidades:*`
    for (const b of digest.bullets) {
      const dot = b.isUpstream ? "⚡" : "•"
      msg += `\n\n${dot} *${escapeMdV2(b.title)}* — ${escapeMdV2(b.publisher)}\n  ↳ ${escapeMdV2(b.whyItMatters)}\n  [ler](${b.url})`
    }
  }

  // Rodapé com score do gap (útil pra user entender urgência do dia)
  msg += `\n\n_Janela de pioneirismo hoje: ${digest.upstreamGapSignal}/100_`

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
// Senão, roda discovery multi-fonte pro termo (HN + Reddit + Publishers) e persiste.
export async function getOrRunTodayDiscovery(opts: {
  userId: string
  termId: string
  termName: string
  intent?: string | null
  sources?: TermSource[]
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

  // Roda discovery multi-fonte focado NESTE termo
  const startedAt = Date.now()
  const { candidates, usage } = await runMultiSourceDiscovery({
    termSources: { [termName]: sources },
    termIntents: intent ? { [termName]: intent } : {},
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
      const activeSources = (Array.isArray(term.sources) ? (term.sources as unknown as TermSource[]) : [])
        .filter((s) => s?.isActive !== false)

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
