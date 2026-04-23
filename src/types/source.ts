// Shape canônica de uma fonte curada (dentro de MonitorTerm.sources[]).
// Centraliza aqui pra evitar drift entre suggester, validator, pipeline e UI.

export type SourceType =
  | "PUBLISHER"       // Mídia tradicional (TechCrunch, Folha, G1) — cobertura ampla
  | "CURATOR"         // Newsletter/analista (Stratechery, Import AI) — análise aprofundada
  | "PRIMARY_FORUM"   // HN, Reddit, Product Hunt — onde nasce discussão
  | "PRIMARY_CODE"    // GitHub, arXiv — onde nasce o produto/paper
  | "PRIMARY_SOCIAL"  // Twitter/X, Farcaster — broadcast ao vivo dos operadores

export type SourceTier = "TIER_1" | "TIER_2" | "BLOG"

export type TermSourceScores = {
  authority: number
  specialization: number
  frequency: number
  independence: number
  languageFit: number
}

export type TermSource = {
  host: string
  name: string
  // sourceType é optional só pra retrocompat — shape legado (sem o campo) trata como PUBLISHER.
  sourceType?: SourceType
  tier: SourceTier
  language: "pt-BR" | "en" | "es"
  note?: string
  isActive: boolean
  // Flags de validação
  anthropicBlocked?: boolean
  scores?: TermSourceScores
  aggregateScore?: number
  validationStatus?: "ok" | "site_name_mismatch" | "not_publisher" | "unreachable" | "error"
  validationNote?: string
  detectedSiteName?: string | null
  lastValidatedAt?: string
}

// Retrocompat: sources antigas não têm sourceType — trata como PUBLISHER.
export function getSourceType(s: Pick<TermSource, "sourceType">): SourceType {
  return s.sourceType ?? "PUBLISHER"
}

// Metadata visual por tipo (cores tailwind + ícone+label).
export const SOURCE_TYPE_META: Record<SourceType, { label: string; emoji: string; cls: string }> = {
  PUBLISHER:      { label: "Publisher",  emoji: "📰", cls: "bg-blue-500/15 text-blue-500 border-blue-500/30" },
  CURATOR:        { label: "Curador",    emoji: "📝", cls: "bg-purple-500/15 text-purple-500 border-purple-500/30" },
  PRIMARY_FORUM:  { label: "Fórum",      emoji: "⚡", cls: "bg-orange-500/15 text-orange-500 border-orange-500/30" },
  PRIMARY_CODE:   { label: "Código",     emoji: "🔬", cls: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30" },
  PRIMARY_SOCIAL: { label: "Social",     emoji: "📡", cls: "bg-pink-500/15 text-pink-500 border-pink-500/30" },
}
