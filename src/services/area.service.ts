import { db } from "@/lib/db"
import type { CreateAreaInput } from "@/types"

const DEFAULT_AREAS = [
  { name: "Trabalho", color: "#3B82F6", icon: "💼" },
  { name: "Saúde", color: "#10B981", icon: "🏃" },
  { name: "Finanças", color: "#F59E0B", icon: "💰" },
  { name: "Estudos", color: "#8B5CF6", icon: "📚" },
  { name: "Conteúdo", color: "#EF4444", icon: "🎬" },
  { name: "Pessoal", color: "#EC4899", icon: "🧠" },
]

export async function getAreas(userId: string) {
  const areas = await db.area.findMany({
    where: { userId, isArchived: false },
    orderBy: { createdAt: "asc" },
  })

  // Seed default areas if none exist
  if (areas.length === 0) {
    await db.area.createMany({
      data: DEFAULT_AREAS.map((a) => ({ ...a, userId })),
    })
    return db.area.findMany({ where: { userId, isArchived: false }, orderBy: { createdAt: "asc" } })
  }

  return areas
}

export async function createArea(userId: string, data: CreateAreaInput) {
  return db.area.create({ data: { ...data, userId } })
}

export async function updateArea(id: string, userId: string, data: Partial<CreateAreaInput>) {
  return db.area.update({ where: { id, userId }, data })
}

export async function archiveArea(id: string, userId: string) {
  return db.area.update({ where: { id, userId }, data: { isArchived: true } })
}
