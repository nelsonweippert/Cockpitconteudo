// POST /api/keyword — explora uma palavra-chave.
// Body: { query }

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { exploreKeyword } from "@/services/keyword-explorer.service"

export const runtime = "nodejs"
export const maxDuration = 30

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ success: false, error: "Não autorizado" }, { status: 401 })

  let body: { query?: string }
  try { body = await req.json() } catch { return NextResponse.json({ success: false, error: "Body inválido" }, { status: 400 }) }
  if (!body.query || typeof body.query !== "string" || body.query.trim().length < 2) {
    return NextResponse.json({ success: false, error: "Query deve ter pelo menos 2 chars" }, { status: 400 })
  }

  try {
    const result = await exploreKeyword(body.query)
    return NextResponse.json({ success: true, data: result })
  } catch (err) {
    console.error("[keyword]", err)
    return NextResponse.json({
      success: false,
      error: err instanceof Error ? err.message : "Erro",
    }, { status: 500 })
  }
}
