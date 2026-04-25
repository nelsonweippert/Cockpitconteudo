"use client"

import { useState } from "react"
import Image from "next/image"
import { Zap, Tv, Loader2, ExternalLink, TrendingUp, TrendingDown, Flame } from "lucide-react"
import { cn } from "@/lib/utils"

type Video = {
  videoId: string
  title: string
  thumbnailUrl: string | null
  publishedAt: string
  latestViews: number
  latestVPH: number | null
  multiplier: number | null
  durationSec: number | null
  history: Array<{ takenAt: string; views: number; viewsPerHour: number | null }>
}

export function VelocityClient({
  videos,
  hasConnection,
}: {
  videos: Video[]
  hasConnection: boolean
}) {
  const [polling, setPolling] = useState(false)
  const [pollResult, setPollResult] = useState<string | null>(null)

  async function handlePollNow() {
    setPolling(true)
    setPollResult(null)
    try {
      const res = await fetch("/api/velocity/poll-now", { method: "POST" })
      const body = await res.json()
      if (body.success) {
        setPollResult(`✓ ${body.data.videosTracked} vídeos · ${body.data.alerts.length} alertas`)
        setTimeout(() => window.location.reload(), 1500)
      } else {
        setPollResult(`✗ ${body.error}`)
      }
    } finally {
      setPolling(false)
    }
  }

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-cockpit-text flex items-center gap-2">
            <Zap size={22} className="text-accent" />
            Velocity
          </h1>
          <p className="text-sm text-cockpit-muted mt-1 max-w-2xl">
            Como seus vídeos publicados nos últimos 7 dias estão performando.
            Comparamos views/hora vs sua mediana histórica.
          </p>
        </div>
        {hasConnection && (
          <button
            onClick={handlePollNow}
            disabled={polling}
            className="px-3 py-2 bg-accent text-black text-xs font-semibold rounded-xl hover:bg-accent-hover disabled:opacity-50 transition-colors flex items-center gap-1.5 shrink-0"
          >
            {polling ? <Loader2 size={13} className="animate-spin" /> : <Zap size={13} />}
            Sync agora
          </button>
        )}
      </div>

      {pollResult && (
        <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-xs text-emerald-500">
          {pollResult}
        </div>
      )}

      {!hasConnection ? (
        <div className="cockpit-card text-center py-10 px-6">
          <Tv size={32} className="text-cockpit-muted mx-auto mb-3" />
          <h2 className="text-base font-semibold text-cockpit-text">Conecte seu canal primeiro</h2>
          <p className="text-xs text-cockpit-muted mt-1 max-w-md mx-auto">
            Velocity precisa de OAuth pra puxar dados em tempo real dos seus vídeos.
            Vai pra <a href="/canal" className="text-accent hover:underline">/canal</a> e clica em &quot;Conectar canal do YouTube&quot;.
          </p>
        </div>
      ) : videos.length === 0 ? (
        <div className="cockpit-card text-center py-10 px-6">
          <Zap size={32} className="text-cockpit-muted mx-auto mb-3" />
          <h2 className="text-base font-semibold text-cockpit-text">Nenhum vídeo nos últimos 7 dias</h2>
          <p className="text-xs text-cockpit-muted mt-1 max-w-md mx-auto">
            Velocity rastreia só vídeos publicados na última semana.
            {hasConnection && " Quando publicar, o snapshot é criado no próximo ciclo."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {videos.map((v) => <VideoCard key={v.videoId} video={v} />)}
        </div>
      )}
    </div>
  )
}

function VideoCard({ video }: { video: Video }) {
  const m = video.multiplier
  const status: { label: string; tone: "viral" | "good" | "neutral" | "warn" } =
    m == null ? { label: "Aguardando dados", tone: "neutral" } :
    m >= 4 ? { label: "🔥 Viral — 4x+ a mediana", tone: "viral" } :
    m >= 1.3 ? { label: "Acelerando", tone: "good" } :
    m <= 0.5 ? { label: "Desacelerando", tone: "warn" } :
    { label: "Estável", tone: "neutral" }

  const toneClass = {
    viral: "text-orange-500 bg-orange-500/10 border-orange-500/30",
    good: "text-emerald-500 bg-emerald-500/10 border-emerald-500/30",
    neutral: "text-cockpit-muted bg-cockpit-bg border-cockpit-border",
    warn: "text-red-400 bg-red-500/10 border-red-500/30",
  }[status.tone]

  return (
    <div className="cockpit-card flex gap-4">
      {video.thumbnailUrl ? (
        <Image src={video.thumbnailUrl} alt={video.title} width={160} height={90} className="rounded-lg object-cover shrink-0" unoptimized />
      ) : (
        <div className="w-[160px] h-[90px] bg-cockpit-border-light rounded-lg shrink-0" />
      )}
      <div className="flex-1 min-w-0">
        <a href={`https://youtube.com/watch?v=${video.videoId}`} target="_blank" rel="noopener noreferrer"
          className="text-sm font-semibold text-cockpit-text hover:text-accent line-clamp-2 inline-flex items-start gap-1">
          {video.title}
          <ExternalLink size={11} className="shrink-0 mt-0.5" />
        </a>
        <p className="text-[10px] text-cockpit-muted mt-0.5">
          Publicado {timeAgo(video.publishedAt)}
          {video.durationSec && ` · ${formatDuration(video.durationSec)}`}
        </p>

        <div className="flex flex-wrap items-center gap-2 mt-2">
          <span className={cn("px-2 py-1 text-[10px] font-bold border rounded-full inline-flex items-center gap-1", toneClass)}>
            {status.tone === "viral" && <Flame size={10} />}
            {status.tone === "good" && <TrendingUp size={10} />}
            {status.tone === "warn" && <TrendingDown size={10} />}
            {status.label}
          </span>
          <span className="text-[10px] text-cockpit-muted tabular-nums">
            {formatNumber(video.latestViews)} views
          </span>
          {video.latestVPH != null && (
            <span className="text-[10px] text-cockpit-muted tabular-nums">
              {video.latestVPH < 100 ? video.latestVPH.toFixed(1) : Math.round(video.latestVPH)} views/h
            </span>
          )}
          {m != null && (
            <span className={cn("text-[10px] font-bold tabular-nums", status.tone === "viral" ? "text-orange-500" : status.tone === "good" ? "text-emerald-500" : status.tone === "warn" ? "text-red-400" : "text-cockpit-muted")}>
              {m.toFixed(2)}× mediana
            </span>
          )}
          <span className="text-[10px] text-cockpit-muted">
            {video.history.length} snapshots
          </span>
        </div>

        {video.history.length >= 2 && (
          <div className="mt-2">
            <ViewsSparkline points={video.history.map((h) => h.views)} />
          </div>
        )}
      </div>
    </div>
  )
}

function ViewsSparkline({ points }: { points: number[] }) {
  const min = Math.min(...points)
  const max = Math.max(...points)
  const range = max - min || 1
  const w = 400
  const h = 30
  const stepX = w / (points.length - 1)
  const polyPoints = points.map((p, i) => `${i * stepX},${h - ((p - min) / range) * h}`).join(" ")
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="w-full h-7 text-accent">
      <polyline points={polyPoints} fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  )
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M"
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "k"
  return new Intl.NumberFormat("pt-BR").format(n)
}

function formatDuration(s: number): string {
  if (s < 60) return `${s}s`
  const min = Math.floor(s / 60)
  const sec = s % 60
  return sec === 0 ? `${min}min` : `${min}:${String(sec).padStart(2, "0")}`
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const hr = Math.floor(diff / 3_600_000)
  if (hr < 1) return "agora há pouco"
  if (hr < 24) return `há ${hr}h`
  const days = Math.floor(hr / 24)
  return `há ${days}d`
}
