"use client"

import { useSearchParams } from "next/navigation"
import { useEffect, useState } from "react"
import Image from "next/image"
import { Tv, CheckCircle2, AlertCircle, Loader2, ExternalLink, Plus, Unlink } from "lucide-react"
import { cn } from "@/lib/utils"

type Connection = {
  id: string
  platform: string
  externalId: string
  externalName: string
  externalHandle: string | null
  thumbnailUrl: string | null
  isActive: boolean
  connectedAt: string
  lastSyncAt: string | null
}

type Snapshot = {
  takenAt: string
  subscribers: number
  totalViews: number
  videoCount: number
}

export function CanalClient({
  connections,
  snapshotsByConnection,
}: {
  connections: Connection[]
  snapshotsByConnection: Record<string, Snapshot[]>
}) {
  const search = useSearchParams()
  const connected = search.get("connected")
  const error = search.get("error")
  const [banner, setBanner] = useState<{ type: "ok" | "err"; text: string } | null>(null)
  const [disconnecting, setDisconnecting] = useState<string | null>(null)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- toast direto a partir de URL params (?connected= / ?error=)
    if (connected) setBanner({ type: "ok", text: `✓ Canal "${connected}" conectado` })
    else if (error) setBanner({ type: "err", text: `Erro: ${error}` })
    if (connected || error) {
      const t = setTimeout(() => setBanner(null), 5000)
      return () => clearTimeout(t)
    }
  }, [connected, error])

  async function handleDisconnect(id: string) {
    if (!confirm("Desconectar este canal? O histórico de snapshots fica preservado.")) return
    setDisconnecting(id)
    try {
      const res = await fetch("/api/auth/youtube/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionId: id }),
      })
      const body = await res.json()
      if (body.success) {
        setBanner({ type: "ok", text: "Canal desconectado. Recarregando..." })
        setTimeout(() => window.location.reload(), 1500)
      } else {
        setBanner({ type: "err", text: body.error ?? "Erro" })
      }
    } finally {
      setDisconnecting(null)
    }
  }

  const activeConnections = connections.filter((c) => c.isActive)

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-cockpit-text flex items-center gap-2">
          <Tv size={22} className="text-red-500" />
          Canal
        </h1>
        <p className="text-sm text-cockpit-muted mt-1 max-w-2xl">
          Conecte seu canal do YouTube pra que o Coach saiba métricas reais (subs, views, retention)
          e detecte gargalos comparando histórico com o que está em produção.
        </p>
      </div>

      {/* Banner */}
      {banner && (
        <div className={cn(
          "p-3 rounded-xl border text-sm flex items-center gap-2",
          banner.type === "ok"
            ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-500"
            : "bg-red-500/10 border-red-500/30 text-red-500",
        )}>
          {banner.type === "ok" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          <span>{banner.text}</span>
        </div>
      )}

      {/* Lista de canais conectados */}
      {activeConnections.length === 0 ? (
        <div className="cockpit-card text-center py-10 px-6">
          <Tv size={32} className="text-cockpit-muted mx-auto mb-3" />
          <h2 className="text-base font-semibold text-cockpit-text">Nenhum canal conectado</h2>
          <p className="text-xs text-cockpit-muted mt-1 max-w-md mx-auto">
            Vincule seu canal do YouTube pra começar a coletar snapshots diários e
            permitir que o Coach use as métricas no contexto.
          </p>
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- OAuth redirect endpoint, não é page */}
          <a
            href="/api/auth/youtube/connect"
            className="inline-flex items-center gap-2 mt-4 px-4 py-2.5 bg-red-500 hover:bg-red-600 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            <Tv size={15} />
            Conectar canal do YouTube
          </a>
          <p className="text-[10px] text-cockpit-muted mt-3">
            Permissões: leitura do canal e analytics. Token guardado criptografado, revogável a qualquer momento.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {activeConnections.map((conn) => {
            const snapshots = snapshotsByConnection[conn.id] ?? []
            const latest = snapshots[snapshots.length - 1]
            const oldest = snapshots[0]
            const delta30d = latest && oldest && snapshots.length > 1 ? {
              subs: latest.subscribers - oldest.subscribers,
              views: latest.totalViews - oldest.totalViews,
              videos: latest.videoCount - oldest.videoCount,
            } : null

            return (
              <div key={conn.id} className="cockpit-card space-y-4">
                {/* Header da connection */}
                <div className="flex items-center gap-3">
                  {conn.thumbnailUrl ? (
                    <Image
                      src={conn.thumbnailUrl}
                      alt={conn.externalName}
                      width={48}
                      height={48}
                      className="rounded-full"
                      unoptimized
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center">
                      <Tv size={20} className="text-red-500" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-base font-semibold text-cockpit-text truncate">{conn.externalName}</h2>
                      {conn.externalHandle && (
                        <a
                          href={`https://youtube.com/${conn.externalHandle.startsWith("@") ? conn.externalHandle : "@" + conn.externalHandle}`}
                          target="_blank" rel="noopener noreferrer"
                          className="text-xs text-cockpit-muted hover:text-accent inline-flex items-center gap-0.5"
                        >
                          {conn.externalHandle.startsWith("@") ? conn.externalHandle : "@" + conn.externalHandle}
                          <ExternalLink size={10} />
                        </a>
                      )}
                    </div>
                    <p className="text-[10px] text-cockpit-muted">
                      Conectado em {new Date(conn.connectedAt).toLocaleDateString("pt-BR")}
                      {conn.lastSyncAt && ` · último sync ${new Date(conn.lastSyncAt).toLocaleString("pt-BR")}`}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDisconnect(conn.id)}
                    disabled={disconnecting === conn.id}
                    className="p-2 text-cockpit-muted hover:text-red-500 transition-colors disabled:opacity-50"
                    title="Desconectar"
                  >
                    {disconnecting === conn.id ? <Loader2 size={14} className="animate-spin" /> : <Unlink size={14} />}
                  </button>
                </div>

                {/* Métricas atuais */}
                {latest ? (
                  <div className="grid grid-cols-3 gap-3">
                    <Metric
                      label="Inscritos"
                      value={formatNumber(latest.subscribers)}
                      delta={delta30d?.subs}
                      deltaLabel="30d"
                    />
                    <Metric
                      label="Visualizações"
                      value={formatNumber(latest.totalViews)}
                      delta={delta30d?.views}
                      deltaLabel="30d"
                    />
                    <Metric
                      label="Vídeos"
                      value={String(latest.videoCount)}
                      delta={delta30d?.videos}
                      deltaLabel="30d"
                      noFormat
                    />
                  </div>
                ) : (
                  <div className="text-xs text-cockpit-muted italic">
                    Aguardando primeiro snapshot. O cron diário coleta os dados às 07h BRT.
                  </div>
                )}

                {/* Mini-gráfico de subs (se tiver 2+ snapshots) */}
                {snapshots.length >= 2 && (
                  <div>
                    <h3 className="text-xs font-semibold text-cockpit-muted mb-2 uppercase tracking-wide">
                      Crescimento de inscritos · últimos 30d ({snapshots.length} snapshots)
                    </h3>
                    <Sparkline values={snapshots.map((s) => s.subscribers)} />
                  </div>
                )}
              </div>
            )
          })}

          {/* Botão pra adicionar mais um canal */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- OAuth redirect endpoint, não é page */}
          <a
            href="/api/auth/youtube/connect"
            className="cockpit-card flex items-center justify-center gap-2 py-4 text-sm text-cockpit-muted hover:text-accent border-2 border-dashed border-cockpit-border hover:border-accent/30 transition-colors"
          >
            <Plus size={14} />
            Conectar outro canal
          </a>
        </div>
      )}
    </div>
  )
}

function Metric({
  label, value, delta, deltaLabel, noFormat,
}: {
  label: string; value: string; delta?: number; deltaLabel: string; noFormat?: boolean
}) {
  const hasDelta = delta != null && delta !== 0
  const positive = delta != null && delta > 0
  return (
    <div className="p-3 bg-cockpit-bg border border-cockpit-border rounded-xl">
      <p className="text-[10px] text-cockpit-muted uppercase tracking-wide">{label}</p>
      <p className="text-xl font-bold text-cockpit-text mt-0.5 tabular-nums">{value}</p>
      {hasDelta && (
        <p className={cn(
          "text-[10px] tabular-nums mt-0.5",
          positive ? "text-emerald-500" : "text-red-400",
        )}>
          {positive ? "+" : ""}{noFormat ? delta : formatNumber(Math.abs(delta!))} {deltaLabel}
        </p>
      )}
    </div>
  )
}

// Sparkline SVG simples — mostra a curva de inscritos.
function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const width = 600
  const height = 60
  const stepX = width / (values.length - 1)
  const points = values
    .map((v, i) => `${i * stepX},${height - ((v - min) / range) * height}`)
    .join(" ")

  return (
    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="w-full h-14">
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className="text-accent"
      />
    </svg>
  )
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M"
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "k"
  return new Intl.NumberFormat("pt-BR").format(n)
}
