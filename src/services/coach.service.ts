// AI Coach — chat persistente com memória do criador.
//
// Diferencial: o coach NÃO é genérico. Ele lê o estado real do user
// (temas monitorados, ideias geradas, conteúdos em produção, áreas, custo de IA)
// e responde com contexto. É a fonte unificada de orientação editorial.
//
// Modelo: Opus 4.7 com adaptive thinking (default omitted) e prompt caching pesado.

import Anthropic from "@anthropic-ai/sdk"
import { db } from "@/lib/db"
import { trackUsage } from "./ai.service"
import type { TermSource } from "@/types/source"

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const COACH_MODEL = "claude-opus-4-7" as const

// ─── Loader de contexto: snapshot do estado do user ─────────────────────

export type CoachContext = {
  user: { name: string; email: string }
  areas: Array<{ id: string; name: string; icon: string; color: string; description: string | null }>
  monitorTerms: Array<{
    term: string
    intent: string | null
    isActive: boolean
    includeInDigest: boolean
    sourcesCount: { total: number; active: number; byType: Record<string, number> }
    lastDigestAt: string | null
  }>
  recentIdeas: Array<{
    title: string
    summary: string
    angle: string | null
    term: string
    pioneerScore: number | null
    viralScore: number | null
    isFavorite: boolean
    isUsed: boolean
    sourceUrl: string | null
    publishedAt: string | null
    createdAt: string
  }>
  recentContents: Array<{
    title: string
    phase: string
    skill: string | null
    platform: string | null
    format: string | null
    hook: string | null
    plannedDate: string | null
    publishedAt: string | null
    publishedUrl: string | null
    createdAt: string
  }>
  contentStats: {
    total: number
    byPhase: Record<string, number>
    publishedLast30d: number
    inProduction: number
  }
  channels: Array<{
    platform: string
    name: string
    handle: string | null
    connectedAt: string
    latestSnapshot: { subscribers: number; totalViews: number; videoCount: number; takenAt: string } | null
    delta7d: { subs: number; views: number; videos: number } | null
    delta30d: { subs: number; views: number; videos: number } | null
  }>
  hotVideos: Array<{
    title: string
    publishedAt: string
    views: number
    multiplier: number | null
    status: "viral" | "accelerating" | "stable" | "decelerating"
  }>
  competitorOutliers: Array<{
    competitorName: string
    title: string
    views: number
    multiplier: number
    publishedAt: string
  }>
  apiUsage: {
    last30dCostUsd: number
    last30dCalls: number
    topActions: Array<{ action: string; calls: number; costUsd: number }>
  }
  generatedAt: string
}

export async function loadCoachContext(userId: string): Promise<CoachContext> {
  const now = new Date()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 3600 * 1000)
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 3600 * 1000)

  const [user, areas, terms, ideas, contents, allContents, usage30d, connections, recentSnapshots] = await Promise.all([
    db.user.findUniqueOrThrow({ where: { id: userId }, select: { name: true, email: true } }),
    db.area.findMany({
      where: { userId, isArchived: false },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, icon: true, color: true, description: true },
    }),
    db.monitorTerm.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
      select: { id: true, term: true, intent: true, isActive: true, includeInDigest: true, sources: true },
    }),
    db.ideaFeed.findMany({
      where: { userId, isDiscarded: false },
      orderBy: { createdAt: "desc" },
      take: 30,
      select: {
        title: true, summary: true, angle: true, term: true,
        pioneerScore: true, viralScore: true, isFavorite: true, isUsed: true,
        sourceUrl: true, publishedAt: true, createdAt: true,
      },
    }),
    db.content.findMany({
      where: { userId, isArchived: false },
      orderBy: { updatedAt: "desc" },
      take: 30,
      select: {
        title: true, phase: true, skill: true, platform: true, format: true,
        hook: true, plannedDate: true, publishedAt: true, publishedUrl: true, createdAt: true,
      },
    }),
    db.content.findMany({
      where: { userId, isArchived: false },
      select: { phase: true, publishedAt: true },
    }),
    db.apiUsage.findMany({
      where: { userId, createdAt: { gte: thirtyDaysAgo } },
      select: { action: true, costUsd: true },
    }),
    db.platformConnection.findMany({
      where: { userId, isActive: true },
      select: { id: true, platform: true, externalName: true, externalHandle: true, connectedAt: true },
    }),
    db.channelSnapshot.findMany({
      where: { userId, takenAt: { gte: thirtyDaysAgo } },
      orderBy: { takenAt: "asc" },
      select: { platformConnectionId: true, takenAt: true, subscribers: true, totalViews: true, videoCount: true },
    }),
  ])

  // Vídeos quentes do user (próprios) + outliers de competidores — em queries separadas
  const [ownVideoSnapshots, competitorOutlierRows] = await Promise.all([
    // Pega o snapshot MAIS RECENTE de cada vídeo "own" publicado nos últimos 7d
    db.videoSnapshot.findMany({
      where: {
        userId,
        origin: "own",
        publishedAt: { gte: sevenDaysAgo },
      },
      orderBy: { takenAt: "desc" },
      take: 50,
    }),
    db.videoSnapshot.findMany({
      where: {
        userId,
        origin: "competitor",
        takenAt: { gte: sevenDaysAgo },
        outlierMultiplier: { gte: 2.0 },
      },
      orderBy: { outlierMultiplier: "desc" },
      take: 8,
      include: { competitor: { select: { externalName: true } } },
    }),
  ])

  // Distribuição de phase
  const byPhase: Record<string, number> = {}
  for (const c of allContents) {
    byPhase[c.phase] = (byPhase[c.phase] ?? 0) + 1
  }
  const publishedLast30d = allContents.filter(
    (c) => c.publishedAt && c.publishedAt >= thirtyDaysAgo,
  ).length
  const inProduction = allContents.filter(
    (c) => c.phase === "BRIEFING" || c.phase === "ELABORATION" || c.phase === "EDITING_SENT",
  ).length

  // Top ações de API
  const actionCosts = new Map<string, { calls: number; costUsd: number }>()
  for (const u of usage30d) {
    const action = u.action.split(":")[0] // remove suffix de extras
    const prev = actionCosts.get(action) ?? { calls: 0, costUsd: 0 }
    actionCosts.set(action, { calls: prev.calls + 1, costUsd: prev.costUsd + u.costUsd })
  }
  const topActions = Array.from(actionCosts.entries())
    .map(([action, v]) => ({ action, ...v }))
    .sort((a, b) => b.costUsd - a.costUsd)
    .slice(0, 8)
  const last30dCostUsd = usage30d.reduce((sum, u) => sum + u.costUsd, 0)

  // Termos: contagem de fontes por tipo
  const termsEnriched = terms.map((t) => {
    const arr = Array.isArray(t.sources) ? (t.sources as unknown as TermSource[]) : []
    const active = arr.filter((s) => s?.isActive !== false)
    const byType: Record<string, number> = {}
    for (const s of active) {
      const type = s.sourceType ?? "PUBLISHER"
      byType[type] = (byType[type] ?? 0) + 1
    }
    return {
      term: t.term,
      intent: t.intent,
      isActive: t.isActive,
      includeInDigest: t.includeInDigest,
      sourcesCount: { total: arr.length, active: active.length, byType },
      lastDigestAt: null as string | null, // pode preencher depois consultando ThemeDiscoveryRun
    }
  })

  // Snapshots agrupados por connection
  const snapshotsByConn = new Map<string, typeof recentSnapshots>()
  for (const s of recentSnapshots) {
    const list = snapshotsByConn.get(s.platformConnectionId) ?? []
    list.push(s)
    snapshotsByConn.set(s.platformConnectionId, list)
  }

  const channels = connections.map((c) => {
    const snaps = snapshotsByConn.get(c.id) ?? []
    const latest = snaps[snaps.length - 1] ?? null
    const oldest30d = snaps[0] ?? null
    const oldest7d = snaps.find((s) => s.takenAt >= sevenDaysAgo) ?? null
    return {
      platform: c.platform,
      name: c.externalName,
      handle: c.externalHandle,
      connectedAt: c.connectedAt.toISOString(),
      latestSnapshot: latest ? {
        subscribers: Number(latest.subscribers),
        totalViews: Number(latest.totalViews),
        videoCount: latest.videoCount,
        takenAt: latest.takenAt.toISOString(),
      } : null,
      delta7d: latest && oldest7d ? {
        subs: Number(latest.subscribers) - Number(oldest7d.subscribers),
        views: Number(latest.totalViews) - Number(oldest7d.totalViews),
        videos: latest.videoCount - oldest7d.videoCount,
      } : null,
      delta30d: latest && oldest30d && snaps.length > 1 ? {
        subs: Number(latest.subscribers) - Number(oldest30d.subscribers),
        views: Number(latest.totalViews) - Number(oldest30d.totalViews),
        videos: latest.videoCount - oldest30d.videoCount,
      } : null,
    }
  })

  // Hot videos (own) — pega o snapshot mais recente por videoId, dedupe
  const seenHotIds = new Set<string>()
  const hotVideos = ownVideoSnapshots
    .filter((s) => {
      if (seenHotIds.has(s.videoId)) return false
      seenHotIds.add(s.videoId)
      return true
    })
    .slice(0, 10)
    .map((s) => {
      const m = s.outlierMultiplier
      const status: "viral" | "accelerating" | "stable" | "decelerating" =
        m == null ? "stable" :
        m >= 4 ? "viral" :
        m >= 1.3 ? "accelerating" :
        m <= 0.5 ? "decelerating" :
        "stable"
      return {
        title: s.videoTitle,
        publishedAt: s.publishedAt.toISOString(),
        views: Number(s.views),
        multiplier: m,
        status,
      }
    })

  return {
    user: { name: user.name, email: user.email },
    areas,
    monitorTerms: termsEnriched,
    recentIdeas: ideas.map((i) => ({
      ...i,
      sourceUrl: i.sourceUrl,
      publishedAt: i.publishedAt?.toISOString() ?? null,
      createdAt: i.createdAt.toISOString(),
    })),
    recentContents: contents.map((c) => ({
      ...c,
      plannedDate: c.plannedDate?.toISOString() ?? null,
      publishedAt: c.publishedAt?.toISOString() ?? null,
      createdAt: c.createdAt.toISOString(),
    })),
    contentStats: { total: allContents.length, byPhase, publishedLast30d, inProduction },
    channels,
    hotVideos,
    competitorOutliers: competitorOutlierRows.map((o) => ({
      competitorName: o.competitor?.externalName ?? "—",
      title: o.videoTitle,
      views: Number(o.views),
      multiplier: o.outlierMultiplier ?? 1,
      publishedAt: o.publishedAt.toISOString(),
    })),
    apiUsage: { last30dCostUsd, last30dCalls: usage30d.length, topActions },
    generatedAt: now.toISOString(),
  }
}

// ─── Render do contexto pra prompt ──────────────────────────────────────

function renderContext(ctx: CoachContext): string {
  const lines: string[] = []
  lines.push(`# CONTEXTO DO CRIADOR (snapshot ${ctx.generatedAt})`)
  lines.push(``)
  lines.push(`## Quem é`)
  lines.push(`- Nome: ${ctx.user.name}`)
  lines.push(``)

  // Áreas
  if (ctx.areas.length > 0) {
    lines.push(`## Áreas de conteúdo`)
    for (const a of ctx.areas) {
      lines.push(`- ${a.icon} **${a.name}**${a.description ? ` — ${a.description}` : ""}`)
    }
    lines.push(``)
  }

  // Temas monitorados
  if (ctx.monitorTerms.length > 0) {
    lines.push(`## Temas monitorados (${ctx.monitorTerms.length})`)
    for (const t of ctx.monitorTerms) {
      const flags: string[] = []
      if (!t.isActive) flags.push("INATIVO")
      if (!t.includeInDigest) flags.push("fora-do-digest")
      const flagStr = flags.length > 0 ? ` [${flags.join(", ")}]` : ""
      const types = Object.entries(t.sourcesCount.byType).map(([k, v]) => `${k}:${v}`).join(", ")
      lines.push(`- "${t.term}"${flagStr}`)
      if (t.intent) lines.push(`  intent: ${t.intent}`)
      lines.push(`  fontes: ${t.sourcesCount.active}/${t.sourcesCount.total} ativas${types ? ` (${types})` : ""}`)
    }
    lines.push(``)
  }

  // Stats de produção
  lines.push(`## Produção`)
  lines.push(`- Total de conteúdos: ${ctx.contentStats.total}`)
  lines.push(`- Em produção (briefing/elaboration/editing): ${ctx.contentStats.inProduction}`)
  lines.push(`- Publicados nos últimos 30 dias: ${ctx.contentStats.publishedLast30d}`)
  lines.push(`- Distribuição por fase: ${Object.entries(ctx.contentStats.byPhase).map(([k, v]) => `${k}=${v}`).join(", ") || "(vazio)"}`)
  lines.push(``)

  // Canais conectados (YouTube, etc.)
  if (ctx.channels.length > 0) {
    lines.push(`## Canais conectados`)
    for (const ch of ctx.channels) {
      lines.push(`### ${ch.platform.toUpperCase()} — "${ch.name}"${ch.handle ? ` (${ch.handle})` : ""}`)
      if (ch.latestSnapshot) {
        const ls = ch.latestSnapshot
        lines.push(`- Inscritos: ${ls.subscribers.toLocaleString("pt-BR")}`)
        lines.push(`- Views totais: ${ls.totalViews.toLocaleString("pt-BR")}`)
        lines.push(`- Vídeos: ${ls.videoCount}`)
        lines.push(`- Snapshot: ${ls.takenAt.slice(0, 10)}`)
      } else {
        lines.push(`- (sem snapshots ainda)`)
      }
      if (ch.delta7d) {
        const d = ch.delta7d
        lines.push(`- Delta 7d: ${d.subs >= 0 ? "+" : ""}${d.subs} subs, ${d.views >= 0 ? "+" : ""}${d.views.toLocaleString("pt-BR")} views, ${d.videos >= 0 ? "+" : ""}${d.videos} vídeos`)
      }
      if (ch.delta30d) {
        const d = ch.delta30d
        lines.push(`- Delta 30d: ${d.subs >= 0 ? "+" : ""}${d.subs} subs, ${d.views >= 0 ? "+" : ""}${d.views.toLocaleString("pt-BR")} views, ${d.videos >= 0 ? "+" : ""}${d.videos} vídeos`)
      }
    }
    lines.push(``)
  }

  // Conteúdos recentes
  if (ctx.recentContents.length > 0) {
    lines.push(`## Últimos ${ctx.recentContents.length} conteúdos (mais recentes primeiro)`)
    for (const c of ctx.recentContents.slice(0, 20)) {
      const meta: string[] = [c.phase]
      if (c.skill) meta.push(c.skill)
      if (c.platform) meta.push(c.platform)
      if (c.publishedAt) meta.push(`pub:${c.publishedAt.slice(0, 10)}`)
      else if (c.plannedDate) meta.push(`agendado:${c.plannedDate.slice(0, 10)}`)
      lines.push(`- "${c.title}" [${meta.join(" · ")}]`)
      if (c.hook) lines.push(`  hook: ${c.hook.slice(0, 120)}`)
    }
    lines.push(``)
  }

  // Ideias recentes (favoritadas + top score)
  if (ctx.recentIdeas.length > 0) {
    lines.push(`## Últimas ${ctx.recentIdeas.length} ideias geradas (não-descartadas)`)
    for (const i of ctx.recentIdeas.slice(0, 20)) {
      const flags: string[] = []
      if (i.isFavorite) flags.push("⭐")
      if (i.isUsed) flags.push("✓ usada")
      const scores: string[] = []
      if (i.pioneerScore != null) scores.push(`pioneer=${i.pioneerScore}`)
      if (i.viralScore != null) scores.push(`viral=${i.viralScore}`)
      const tag = flags.length > 0 ? ` ${flags.join(" ")}` : ""
      const score = scores.length > 0 ? ` (${scores.join(", ")})` : ""
      lines.push(`- [${i.term}] "${i.title}"${tag}${score}`)
      if (i.angle) lines.push(`  ângulo: ${i.angle.slice(0, 120)}`)
    }
    lines.push(``)
  }

  // Vídeos quentes do user
  if (ctx.hotVideos.length > 0) {
    lines.push(`## Seus vídeos publicados nos últimos 7 dias`)
    for (const v of ctx.hotVideos) {
      const flag = v.status === "viral" ? "🔥 VIRAL" : v.status === "accelerating" ? "↗ ACELERANDO" : v.status === "decelerating" ? "↘ DESACELERANDO" : "estável"
      lines.push(`- "${v.title}" — ${v.views.toLocaleString("pt-BR")} views${v.multiplier != null ? ` (${v.multiplier.toFixed(2)}× mediana)` : ""} [${flag}]`)
    }
    lines.push(``)
  }

  // Outliers de competidores
  if (ctx.competitorOutliers.length > 0) {
    lines.push(`## Vídeos de competidores quebrando a curva (últimos 7d)`)
    for (const o of ctx.competitorOutliers) {
      lines.push(`- [${o.competitorName}] "${o.title}" — ${o.views.toLocaleString("pt-BR")} views, ${o.multiplier.toFixed(1)}× a mediana`)
    }
    lines.push(``)
  }

  // Custo de IA
  lines.push(`## Uso de IA (30 dias)`)
  lines.push(`- Custo: $${ctx.apiUsage.last30dCostUsd.toFixed(4)} em ${ctx.apiUsage.last30dCalls} chamadas`)
  if (ctx.apiUsage.topActions.length > 0) {
    lines.push(`- Top ações por custo:`)
    for (const a of ctx.apiUsage.topActions.slice(0, 5)) {
      lines.push(`  · ${a.action}: ${a.calls} calls, $${a.costUsd.toFixed(4)}`)
    }
  }

  return lines.join("\n")
}

// ─── System prompt do Coach ─────────────────────────────────────────────

const COACH_PERSONA = `Você é o **Coach** do Cockpit Conteúdo — assistente editorial pessoal de um criador de conteúdo solo.

QUEM VOCÊ É
- Você conhece o estado real do criador (temas monitorados, ideias geradas, conteúdos em produção, custo de IA).
- Você fala com TOM de mentor experiente, não de IA genérica. Direto, sem firulas, com observação aguda.
- Você sabe que o criador opera sozinho. Suas sugestões devem ser EXECUTÁVEIS por uma pessoa, não por uma equipe.

COMO RESPONDER
- Sempre baseado no contexto fornecido. Se a info não está lá, diga "não tenho esse dado, mas se você me contar X eu posso responder".
- Cite especificidades quando útil ("seu tema 'X' tem 7 ideias acumuladas, nenhuma marcada como usada").
- Aponte padrões: gargalos no funil ("12 conteúdos parados em ELABORATION há mais de 7 dias"), desbalanceios ("70% do custo de IA é em discovery, vale revisar").
- Quando pedir ação, dê 1-3 próximos passos concretos.
- Responda em PT-BR. Sem travessões.
- Markdown leve (bold/listas curtas). Sem hierarquia desnecessária de heading.

LIMITES
- Não invente dados. Se for opinião, marque como "minha leitura".
- Não dê conselhos genéricos ("seja consistente!"). Sempre amarre ao contexto.
- Não simule métricas que você não tem ("seu CTR provavelmente é..."). Diga que não tem.

QUANDO O USUÁRIO PERGUNTA SOBRE PRODUÇÃO
- Use os campos title/phase/skill/platform/format/hook das listagens.
- Identifique gargalos (muito tempo na mesma fase, sem hook, sem plataforma definida).

QUANDO O USUÁRIO PERGUNTA SOBRE IDEIAS
- Olhe pioneerScore, viralScore, isFavorite, isUsed.
- Sugira quais merecem virar conteúdo.

QUANDO O USUÁRIO PERGUNTA SOBRE TEMAS
- Mostre quais têm fontes curadas, quais estão sub-utilizados, quais geram mais ideias.

QUANDO O USUÁRIO PERGUNTA SOBRE PERFORMANCE / CRESCIMENTO DO CANAL
- Use a seção "Canais conectados" do contexto. Cite delta 7d/30d com números reais.
- Se delta30d está positivo mas baixo, sinaliza ("subiu 80 subs em 30d, ritmo de ~2.5/dia").
- Se publicou X vídeos no período (delta videos) vs publishedLast30d do funil, valide consistência.
- Se NÃO tem canal conectado, instrua: "vá em /canal e clique em Conectar canal do YouTube".
- Se snapshots < 2, diga que precisa de mais alguns dias pra ter delta confiável.

QUANDO O USUÁRIO PERGUNTA SOBRE VÍDEOS RECENTES OU "ESTÁ PEGANDO?"
- Use "Seus vídeos publicados nos últimos 7 dias". Status VIRAL = 4×+ a mediana — mencionar destacado.
- Status ACELERANDO = bom sinal. DESACELERANDO = pode ter morrido.
- Se nenhum vídeo recente, diga isso.

QUANDO O USUÁRIO PERGUNTA SOBRE COMPETIDORES OU "O QUE TÁ BOMBANDO NO NICHO?"
- Use "Vídeos de competidores quebrando a curva". Multiplier alto = sinal de tema ressonando agora.
- Sugira esses títulos como inspiração pra próximas ideias (sem copiar, mas observar ângulo).
- Se sem competitor outliers, diga que ou os competidores estão estáveis ou faltam canais monitorados.`

// ─── Conversação: adiciona msg e gera resposta streaming ────────────────

export async function streamCoachReply(opts: {
  userId: string
  conversationId: string
  userMessage: string
  onText: (delta: string) => void
}): Promise<{
  fullText: string
  usage: { inputTokens: number; outputTokens: number; cacheReadTokens: number; cacheCreationTokens: number; durationMs: number }
}> {
  const { userId, conversationId, userMessage, onText } = opts

  // 1. Persiste msg do user
  await db.coachMessage.create({
    data: { conversationId, role: "user", content: userMessage },
  })

  // 2. Carrega histórico da conversa (últimas 30 mensagens)
  const history = await db.coachMessage.findMany({
    where: { conversationId },
    orderBy: { createdAt: "asc" },
    take: 30,
  })

  // 3. Carrega contexto fresco do user
  const ctx = await loadCoachContext(userId)
  const ctxText = renderContext(ctx)

  // 4. Monta messages pro Anthropic — exclui a msg que acabamos de criar (ela vai como user message)
  // Última msg deve ser do user (a recém criada)
  const messages: Anthropic.MessageParam[] = history.map((m) => ({
    role: m.role === "user" ? "user" : "assistant",
    content: m.content,
  }))

  const start = Date.now()
  let fullText = ""
  const usage = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheCreationTokens: 0 }

  // 5. Stream
  const stream = await anthropic.messages.stream({
    model: COACH_MODEL,
    max_tokens: 4000,
    thinking: { type: "adaptive" },
    system: [
      { type: "text", text: COACH_PERSONA, cache_control: { type: "ephemeral" } },
      { type: "text", text: ctxText, cache_control: { type: "ephemeral" } },
    ],
    messages,
  })

  for await (const event of stream) {
    if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
      onText(event.delta.text)
      fullText += event.delta.text
    }
  }

  const final = await stream.finalMessage()
  usage.inputTokens = final.usage.input_tokens
  usage.outputTokens = final.usage.output_tokens
  usage.cacheReadTokens = final.usage.cache_read_input_tokens ?? 0
  usage.cacheCreationTokens = final.usage.cache_creation_input_tokens ?? 0
  const durationMs = Date.now() - start

  // 6. Persiste resposta
  await db.coachMessage.create({
    data: {
      conversationId,
      role: "assistant",
      content: fullText,
      usage: { ...usage, model: COACH_MODEL, durationMs } as unknown as object,
    },
  })

  // 7. Atualiza conversa
  await db.coachConversation.update({
    where: { id: conversationId },
    data: { lastMessageAt: new Date() },
  })

  // 8. Telemetria global
  trackUsage(COACH_MODEL, "coach_chat", usage.inputTokens, usage.outputTokens, durationMs, userId, {
    cacheReadTokens: usage.cacheReadTokens,
    cacheCreationTokens: usage.cacheCreationTokens,
    historyLen: history.length,
  }).catch(() => {})

  return { fullText, usage: { ...usage, durationMs } }
}

// Versão non-streaming pra Telegram (resposta única, mais simples).
export async function generateCoachReply(opts: {
  userId: string
  conversationId: string
  userMessage: string
}): Promise<string> {
  let buf = ""
  await streamCoachReply({
    ...opts,
    onText: (d) => { buf += d },
  })
  return buf
}

// Auto-titulação: depois da 1ª resposta, gera título curto pra conversa.
export async function generateConversationTitle(conversationId: string): Promise<string | null> {
  const msgs = await db.coachMessage.findMany({
    where: { conversationId },
    orderBy: { createdAt: "asc" },
    take: 4,
  })
  if (msgs.length < 2) return null

  try {
    const summary = msgs.map((m) => `${m.role}: ${m.content.slice(0, 300)}`).join("\n")
    const res = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 60,
      messages: [{
        role: "user",
        content: `Resuma este início de conversa em UM título curto (máx 50 chars), em PT-BR, sem aspas, sem ponto final, sem travessão:\n\n${summary}`,
      }],
    })
    const tb = res.content.find((b): b is Anthropic.TextBlock => b.type === "text")
    const title = tb?.text.trim().slice(0, 80) ?? null
    if (title) {
      await db.coachConversation.update({ where: { id: conversationId }, data: { title } })
    }
    return title
  } catch {
    return null
  }
}
