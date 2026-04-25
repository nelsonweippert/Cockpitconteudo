import { db } from "@/lib/db"
import type { ContentPhase, ContentSkill, Platform, ContentFormat, Prisma } from "@/generated/prisma/client"

const INCLUDE_ALL = { areas: { include: { area: true } }, area: true, metrics: true }

export async function getContents(userId: string) {
  return db.content.findMany({
    where: { userId, isArchived: false },
    include: INCLUDE_ALL,
    orderBy: { updatedAt: "desc" },
  })
}

export async function createContent(userId: string, data: {
  title: string
  platform?: Platform
  format?: ContentFormat
  skill?: ContentSkill
  hook?: string
  research?: string
  ideaFeedId?: string
  tags?: string[]
  plannedDate?: Date | null
  areaIds?: string[]
}) {
  const { areaIds, ...rest } = data
  return db.content.create({
    data: {
      ...rest,
      userId,
      ...(areaIds && areaIds.length > 0 && {
        areas: { create: areaIds.map((areaId) => ({ areaId })) },
        areaId: areaIds[0],
      }),
    },
    include: INCLUDE_ALL,
  })
}

export async function updateContent(id: string, userId: string, data: {
  title?: string
  platform?: Platform
  format?: ContentFormat
  phase?: ContentPhase
  skill?: ContentSkill | null
  hook?: string | null
  script?: string | null
  series?: string | null
  tags?: string[]
  thumbnailNotes?: string | null
  research?: string | null
  checklist?: Record<string, boolean> | null
  plannedDate?: Date | null
  publishedAt?: Date | null
  publishedUrl?: string | null
  notes?: string | null
  areaId?: string | null
  areaIds?: string[]
}) {
  const { areaId, areaIds, ...rest } = data

  // Update areas join table first if needed
  if (areaIds !== undefined) {
    await db.contentArea.deleteMany({ where: { contentId: id } })
    if (areaIds.length > 0) {
      await db.contentArea.createMany({ data: areaIds.map((areaId) => ({ contentId: id, areaId })) })
    }
  }

  const updateData: Record<string, unknown> = { ...rest }
  if (areaIds !== undefined) updateData.areaId = areaIds.length > 0 ? areaIds[0] : null
  else if (areaId !== undefined) updateData.areaId = areaId || null

  return db.content.update({
    where: { id, userId },
    data: updateData as Prisma.ContentUncheckedUpdateInput,
    include: INCLUDE_ALL,
  })
}

export async function advancePhase(id: string, userId: string, phase: ContentPhase) {
  return db.content.update({
    where: { id, userId },
    data: { phase },
    include: INCLUDE_ALL,
  })
}

export async function archiveContent(id: string, userId: string) {
  return db.content.update({ where: { id, userId }, data: { isArchived: true } })
}

export async function getContentStats(userId: string) {
  const contents = await db.content.findMany({
    where: { userId, isArchived: false },
    select: { phase: true, skill: true },
  })
  return {
    total: contents.length,
    ideas: contents.filter((c) => c.phase === "IDEATION").length,
    inProduction: contents.filter((c) => c.phase === "ELABORATION" || c.phase === "BRIEFING").length,
    editingSent: contents.filter((c) => c.phase === "EDITING_SENT").length,
    published: contents.filter((c) => c.phase === "PUBLISHED").length,
    bySkill: {
      SHORT_VIDEO: contents.filter((c) => c.skill === "SHORT_VIDEO").length,
      LONG_VIDEO: contents.filter((c) => c.skill === "LONG_VIDEO").length,
      INSTAGRAM: contents.filter((c) => c.skill === "INSTAGRAM").length,
    },
  }
}
