// Renderiza um Content do Cockpit em Markdown completo, pronto pra colar em Notion/Obsidian/Google Doc.
// Inclui metadados, todas as seções de fase relevantes, e o bloco de fontes (primária + apoios)
// com keyQuote verbatim quando disponível.

import type { ContentArea, Area, NewsEvidence } from "@/generated/prisma/client"

type ContentForExport = {
  id: string
  title: string
  platform: string
  format: string
  phase: string
  rawVideoUrl: string | null
  skill: string | null
  targetDuration: number | null
  hook: string | null
  script: string | null
  ideaFeedId: string | null
  tags: string[]
  thumbnailNotes: string | null
  research: string | null
  titleOptions: string[]
  description: string | null
  hashtags: string[]
  plannedDate: Date | null
  publishedAt: Date | null
  publishedUrl: string | null
  notes: string | null
  createdAt: Date
  area: Area | null
  areas: (ContentArea & { area: Area })[]
}

export type ContentExportReferences = {
  primary: NewsEvidence | null
  supporting: NewsEvidence[]
  ideaTitle?: string
  ideaTerm?: string
  ideaQuote?: string | null
} | null

const PHASE_LABEL: Record<string, string> = {
  IDEATION: "Idealização",
  ELABORATION: "Elaboração",
  BRIEFING: "Briefing",
  EDITING_SENT: "Em Edição",
  PUBLISHED: "Publicado",
  ARCHIVED: "Arquivado",
}

const PLATFORM_LABEL: Record<string, string> = {
  YOUTUBE: "YouTube",
  INSTAGRAM: "Instagram",
  TIKTOK: "TikTok",
  TWITCH: "Twitch",
  OTHER: "Outro",
}

function fmtDuration(seconds: number | null): string | null {
  if (!seconds || seconds <= 0) return null
  if (seconds < 60) return `${seconds}s`
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return s > 0 ? `${m}min ${s}s` : `${m}min`
}

function fmtDate(d: Date | null | undefined): string | null {
  if (!d) return null
  return d.toISOString().slice(0, 10)
}

function hostFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return url
  }
}

function nonEmpty(s: string | null | undefined): s is string {
  return typeof s === "string" && s.trim().length > 0
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "content"
}

export function buildContentFilename(content: Pick<ContentForExport, "title" | "publishedAt" | "createdAt">): string {
  const date = fmtDate(content.publishedAt) ?? fmtDate(content.createdAt) ?? fmtDate(new Date())
  return `${date}-${slugify(content.title)}.md`
}

export function buildContentMarkdown(content: ContentForExport, references: ContentExportReferences): string {
  const lines: string[] = []

  // ── Header ─────────────────────────────────────────────────────────────
  lines.push(`# ${content.title}`)
  lines.push("")

  const meta: string[] = []
  meta.push(`**Plataforma:** ${PLATFORM_LABEL[content.platform] ?? content.platform}`)
  meta.push(`**Formato:** ${content.format}`)
  if (content.skill) meta.push(`**Skill:** ${content.skill}`)
  const dur = fmtDuration(content.targetDuration)
  if (dur) meta.push(`**Duração alvo:** ${dur}`)
  meta.push(`**Fase:** ${PHASE_LABEL[content.phase] ?? content.phase}`)
  lines.push(meta.join(" · "))

  // Áreas (M:N tem prioridade; cai pra area single)
  const areaNames = content.areas.length > 0
    ? content.areas.map((ca) => `${ca.area.icon} ${ca.area.name}`)
    : content.area
      ? [`${content.area.icon} ${content.area.name}`]
      : []
  if (areaNames.length > 0) {
    lines.push("")
    lines.push(`**Áreas:** ${areaNames.join(" · ")}`)
  }

  if (content.tags.length > 0) {
    lines.push("")
    lines.push(`**Tags:** ${content.tags.join(", ")}`)
  }

  // Datas relevantes
  const planned = fmtDate(content.plannedDate)
  const published = fmtDate(content.publishedAt)
  const created = fmtDate(content.createdAt)
  const dates: string[] = []
  if (created) dates.push(`Criado em ${created}`)
  if (planned) dates.push(`Planejado pra ${planned}`)
  if (published) dates.push(`Publicado em ${published}`)
  if (dates.length > 0) {
    lines.push("")
    lines.push(`_${dates.join(" · ")}_`)
  }

  if (references?.ideaTerm || references?.ideaTitle) {
    lines.push("")
    if (references.ideaTerm) lines.push(`**Termo monitorado:** ${references.ideaTerm}`)
    if (references.ideaTitle && references.ideaTitle !== content.title) {
      lines.push(`**Ideia original:** ${references.ideaTitle}`)
    }
  }

  // ── Hook ───────────────────────────────────────────────────────────────
  if (nonEmpty(content.hook)) {
    lines.push("", "---", "", "## Hook", "", content.hook.trim())
  }

  // ── Roteiro ────────────────────────────────────────────────────────────
  if (nonEmpty(content.script)) {
    lines.push("", "---", "", "## Roteiro", "", content.script.trim())
  }

  // ── Título e variações ─────────────────────────────────────────────────
  if (content.titleOptions.length > 0) {
    lines.push("", "---", "", "## Variações de título")
    lines.push("")
    for (const opt of content.titleOptions) lines.push(`- ${opt}`)
  }

  // ── Thumbnail ──────────────────────────────────────────────────────────
  if (nonEmpty(content.thumbnailNotes)) {
    lines.push("", "---", "", "## Thumbnail", "", content.thumbnailNotes.trim())
  }

  // ── Descrição ──────────────────────────────────────────────────────────
  if (nonEmpty(content.description)) {
    lines.push("", "---", "", "## Descrição", "", content.description.trim())
  }
  if (content.hashtags.length > 0) {
    lines.push("")
    lines.push(`**Hashtags:** ${content.hashtags.map((h) => (h.startsWith("#") ? h : `#${h}`)).join(" ")}`)
  }

  // ── Pesquisa ───────────────────────────────────────────────────────────
  if (nonEmpty(content.research)) {
    lines.push("", "---", "", "## Pesquisa / Notas de produção", "", content.research.trim())
  }

  // ── Notas (briefing/edição) ────────────────────────────────────────────
  if (nonEmpty(content.notes)) {
    const notesLabel = content.phase === "BRIEFING"
      ? "Briefing de gravação"
      : content.phase === "EDITING_SENT"
        ? "Guia de edição"
        : content.phase === "PUBLISHED"
          ? "Métricas e lições"
          : "Notas"
    lines.push("", "---", "", `## ${notesLabel}`, "", content.notes.trim())
  }

  // ── Fontes ─────────────────────────────────────────────────────────────
  if (references && (references.primary || references.supporting.length > 0)) {
    lines.push("", "---", "", "## Fontes da pesquisa")

    if (references.primary) {
      const p = references.primary
      const host = hostFromUrl(p.url)
      lines.push("", "### Primária")
      lines.push("")
      lines.push(`- **${host}** — [${p.title}](${p.url})`)
      const quote = references.ideaQuote ?? p.keyQuote
      if (nonEmpty(quote)) {
        lines.push(`  > "${quote.trim()}"`)
      }
      const pubDate = fmtDate(p.publishedAt)
      const metaBits: string[] = []
      if (p.sourceAuthority && p.sourceAuthority !== "UNKNOWN") metaBits.push(p.sourceAuthority)
      if (p.language) metaBits.push(p.language)
      if (pubDate) metaBits.push(pubDate)
      if (metaBits.length > 0) lines.push(`  _${metaBits.join(" · ")}_`)
    }

    if (references.supporting.length > 0) {
      lines.push("", "### Apoio")
      lines.push("")
      for (const s of references.supporting) {
        const host = hostFromUrl(s.url)
        lines.push(`- **${host}** — [${s.title}](${s.url})`)
        if (nonEmpty(s.keyQuote)) lines.push(`  > "${s.keyQuote.trim()}"`)
      }
    }
  }

  // ── Publicação ─────────────────────────────────────────────────────────
  if (nonEmpty(content.publishedUrl) || nonEmpty(content.rawVideoUrl)) {
    lines.push("", "---", "", "## Links")
    if (nonEmpty(content.publishedUrl)) lines.push(`- **Publicado:** ${content.publishedUrl}`)
    if (nonEmpty(content.rawVideoUrl)) lines.push(`- **Vídeo bruto:** ${content.rawVideoUrl}`)
  }

  // ── Footer ─────────────────────────────────────────────────────────────
  lines.push("", "---", "")
  lines.push(`_Exportado em ${fmtDate(new Date())} via Content Hub_`)

  return lines.join("\n") + "\n"
}
