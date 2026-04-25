// GET /api/auth/youtube/callback?code=...&state=...
//
// Recebe redirect do Google após consent. Valida state, troca code por tokens,
// busca info do canal, persiste em PlatformConnection. Cria primeiro snapshot.

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { exchangeCodeForTokens } from "@/services/youtube-oauth.service"
import { fetchOwnChannelInfo } from "@/services/youtube-data.service"

export const runtime = "nodejs"
export const maxDuration = 60

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const code = url.searchParams.get("code")
  const stateFromQuery = url.searchParams.get("state")
  const errorParam = url.searchParams.get("error")

  if (errorParam) {
    return NextResponse.redirect(new URL(`/canal?error=${encodeURIComponent(errorParam)}`, req.url))
  }

  if (!code || !stateFromQuery) {
    return NextResponse.redirect(new URL("/canal?error=callback_sem_code", req.url))
  }

  // Valida sessão
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/login?next=/canal", req.url))
  }
  const userId = session.user.id

  // Valida state
  const stateFromCookie = req.cookies.get("yt_oauth_state")?.value
  if (!stateFromCookie || stateFromCookie !== stateFromQuery) {
    return NextResponse.redirect(new URL("/canal?error=state_invalido", req.url))
  }
  const [stateUserId] = stateFromQuery.split(".")
  if (stateUserId !== userId) {
    return NextResponse.redirect(new URL("/canal?error=state_user_mismatch", req.url))
  }

  try {
    // 1. Troca code por tokens
    const tokens = await exchangeCodeForTokens(code)

    // 2. Busca info do canal
    const channel = await fetchOwnChannelInfo(tokens.access_token)
    if (!channel) {
      return NextResponse.redirect(new URL("/canal?error=sem_canal", req.url))
    }

    // 3. Upsert da PlatformConnection
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000)
    const conn = await db.platformConnection.upsert({
      where: {
        userId_platform_externalId: {
          userId,
          platform: "youtube",
          externalId: channel.channelId,
        },
      },
      create: {
        userId,
        platform: "youtube",
        externalId: channel.channelId,
        externalName: channel.title,
        externalHandle: channel.customUrl,
        thumbnailUrl: channel.thumbnailUrl,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token ?? null,
        expiresAt,
        scope: tokens.scope,
        isActive: true,
        connectedAt: new Date(),
        lastSyncAt: new Date(),
      },
      update: {
        externalName: channel.title,
        externalHandle: channel.customUrl,
        thumbnailUrl: channel.thumbnailUrl,
        accessToken: tokens.access_token,
        // Se Google não devolveu refresh_token (já tinha autorizado antes), preserva o atual
        refreshToken: tokens.refresh_token ?? undefined,
        expiresAt,
        scope: tokens.scope,
        isActive: true,
        lastSyncAt: new Date(),
      },
    })

    // 4. Primeiro snapshot
    await db.channelSnapshot.create({
      data: {
        userId,
        platformConnectionId: conn.id,
        subscribers: BigInt(channel.subscribers),
        totalViews: BigInt(channel.totalViews),
        videoCount: channel.videoCount,
      },
    })

    // 5. Limpa cookie de state e redireciona
    const res = NextResponse.redirect(new URL(`/canal?connected=${encodeURIComponent(channel.title)}`, req.url))
    res.cookies.delete("yt_oauth_state")
    return res
  } catch (err) {
    console.error("[youtube/callback]", err)
    const msg = err instanceof Error ? err.message : "erro"
    return NextResponse.redirect(new URL(`/canal?error=${encodeURIComponent(msg.slice(0, 200))}`, req.url))
  }
}
