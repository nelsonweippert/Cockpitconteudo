import type { ContentPhase } from "@/types"

export const PHASE_LABEL: Record<string, string> = {
  IDEATION: "Idealização", ELABORATION: "Elaboração", BRIEFING: "Briefing",
  EDITING_SENT: "Em edição", PUBLISHED: "Publicado", ARCHIVED: "Arquivado",
}

export const PHASE_COLOR: Record<string, string> = {
  IDEATION: "bg-violet-500/15 text-violet-500 border-violet-500/20",
  ELABORATION: "bg-amber-500/15 text-amber-500 border-amber-500/20",
  BRIEFING: "bg-orange-500/15 text-orange-500 border-orange-500/20",
  EDITING_SENT: "bg-pink-500/15 text-pink-500 border-pink-500/20",
  PUBLISHED: "bg-accent/15 text-accent-dark border-accent/20",
}

export const SKILL_ICON: Record<string, string> = { SHORT_VIDEO: "⚡", LONG_VIDEO: "🎬", INSTAGRAM: "📸" }

export const PIPELINE_PHASES: ContentPhase[] = ["IDEATION", "ELABORATION", "BRIEFING", "EDITING_SENT", "PUBLISHED"]
