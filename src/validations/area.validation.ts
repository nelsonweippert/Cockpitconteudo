import { z } from "zod"

export const createAreaSchema = z.object({
  name: z.string().min(1).max(50),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default("#00D6AB"),
  icon: z.string().default("📁"),
  description: z.string().optional(),
})

export type CreateAreaInput = z.infer<typeof createAreaSchema>
