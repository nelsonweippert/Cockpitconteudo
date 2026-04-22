// Types exportados pelo Content-HUB — subset enxuto focado em conteúdo/ideias.

export type {
  User,
  Area,
  Content,
  ContentArea,
  ContentMetrics,
  Platform,
  ContentFormat,
  ContentPhase,
  MonitorTerm,
  IdeaFeed,
  NewsEvidence,
  SkillSource,
  ApiUsage,
} from "@/generated/prisma/client"

export type ActionResult<T = unknown> =
  | { success: true; data: T }
  | { success: false; error: string }

export type CreateAreaInput = {
  name: string
  color?: string
  icon?: string
  description?: string
}

export type CreateContentInput = {
  title: string
  platform?: "YOUTUBE" | "INSTAGRAM" | "TIKTOK" | "TWITCH" | "OTHER"
  format?: "LONG_VIDEO" | "SHORT" | "REELS" | "POST" | "LIVE" | "THREAD"
  hook?: string
  series?: string
  plannedDate?: Date | null
  areaId?: string | null
}
