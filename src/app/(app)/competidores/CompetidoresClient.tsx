"use client"

import { useState, useTransition } from "react"
import Image from "next/image"
import { Eye, Plus, Loader2, ExternalLink, Trash2, RefreshCw, Flame, AlertCircle } from "lucide-react"
import { addCompetitorAction, removeCompetitorAction, pollCompetitorAction } from "@/app/actions/competitor.actions"
import { cn } from "@/lib/utils"

type Competitor = {
  id: string
  externalId: string
  externalName: string
  externalHandle: string | null
  thumbnailUrl: string | null
  subscribers: number | null
  videoCount: number | null
  notes: string | null
  addedAt: string
  lastSyncAt: string | null
}

type Outlier = {
  id: string
  videoId: string
  title: string
  thumbnailUrl: string | null
  views: number
  multiplier: number
  publishedAt: string
  takenAt: string
  competitorChannelId: string | null
}

export function CompetidoresClient({
  competitors,
  outliers,
}: {
  competitors: Competitor[]
  outliers: Outlier[]
}) {
  const [adding, startAdd] = useTransition()
  const [input, setInput] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [polling, setPolling] = useState<string | null>(null)

  const competitorById = new Map(competitors.map((c) => [c.id, c]))

  function handleAdd() {
    const trimmed = input.trim()
    if (!trimmed) return
    setError(null)
    startAdd(async () => {
      const res = await addCompetitorAction(trimmed)
      if (res.success) {
        setInput("")
        window.location.reload()
      } else {
        setError(res.error ?? "Erro")
      }
    })
  }

  async function handlePoll(competitorId: string) {
    setPolling(competitorId)
    setError(null)
    try {
      const res = await pollCompetitorAction(competitorId)
      if (res.success) {
        window.location.reload()
      } else {
        setError(res.error ?? "Erro")
      }
    } finally {
      setPolling(null)
    }
  }

  async function handleRemove(competitorId: string) {
    if (!confirm("Remover esse competidor? Histórico fica preservado.")) return
    const res = await removeCompetitorAction(competitorId)
    if (res.success) window.location.reload()
    else setError(res.error ?? "Erro")
  }

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-cockpit-text flex items-center gap-2">
          <Eye size={22} className="text-accent" />
          Competidores
        </h1>
        <p className="text-sm text-cockpit-muted mt-1 max-w-2xl">
          Canais que você quer monitorar. Diariamente puxamos uploads recentes e
          detectamos outliers (vídeos que quebraram a curva do canal — sinal de tema bombando no nicho).
        </p>
      </div>

      {/* Add input */}
      <div className="cockpit-card flex items-center gap-2 p-3">
        <Eye size={16} className="text-cockpit-muted shrink-0" />
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleAdd() }}
          placeholder="@handle ou URL do canal (https://youtube.com/@nome)"
          className="flex-1 bg-transparent text-sm text-cockpit-text placeholder:text-cockpit-muted focus:outline-none"
        />
        <button
          onClick={handleAdd}
          disabled={adding || !input.trim()}
          className="px-4 py-2 bg-accent text-black text-xs font-semibold rounded-xl hover:bg-accent-hover disabled:opacity-50 transition-colors flex items-center gap-1.5"
        >
          {adding ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
          Adicionar
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-sm text-red-500 flex items-center gap-2">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {/* Outliers — destaque do que está bombando */}
      {outliers.length > 0 && (
        <div className="cockpit-card space-y-3">
          <h2 className="text-sm font-semibold text-cockpit-text flex items-center gap-2">
            <Flame size={14} className="text-orange-500" />
            Vídeos quebrando a curva (últimas 72h)
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {outliers.map((o) => {
              const c = o.competitorChannelId ? competitorById.get(o.competitorChannelId) : null
              return (
                <a
                  key={o.id}
                  href={`https://youtube.com/watch?v=${o.videoId}`}
                  target="_blank" rel="noopener noreferrer"
                  className="flex items-start gap-3 p-2.5 bg-cockpit-bg border border-orange-500/20 hover:border-orange-500/40 rounded-xl transition-colors"
                >
                  {o.thumbnailUrl ? (
                    <Image src={o.thumbnailUrl} alt={o.title} width={120} height={68} className="rounded-lg object-cover shrink-0" unoptimized />
                  ) : (
                    <div className="w-[120px] h-[68px] bg-cockpit-border-light rounded-lg shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-cockpit-text line-clamp-2">{o.title}</p>
                    <p className="text-[10px] text-cockpit-muted mt-0.5">{c?.externalName ?? "—"}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] font-bold text-orange-500 tabular-nums">
                        {o.multiplier.toFixed(1)}× a mediana
                      </span>
                      <span className="text-[10px] text-cockpit-muted tabular-nums">
                        {formatNumber(o.views)} views
                      </span>
                    </div>
                  </div>
                </a>
              )
            })}
          </div>
        </div>
      )}

      {/* Lista de competidores */}
      {competitors.length === 0 ? (
        <div className="cockpit-card text-center py-10 px-6">
          <Eye size={32} className="text-cockpit-muted mx-auto mb-3" />
          <h2 className="text-base font-semibold text-cockpit-text">Nenhum competidor monitorado</h2>
          <p className="text-xs text-cockpit-muted mt-1 max-w-md mx-auto">
            Adicione 3-5 canais que você considera referência. O sistema vai puxar
            diariamente os uploads e te avisar quando algum quebrar a curva.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {competitors.map((c) => (
            <div key={c.id} className="cockpit-card space-y-2">
              <div className="flex items-start gap-3">
                {c.thumbnailUrl ? (
                  <Image src={c.thumbnailUrl} alt={c.externalName} width={48} height={48} className="rounded-full shrink-0" unoptimized />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-cockpit-border-light shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-cockpit-text truncate">{c.externalName}</h3>
                  {c.externalHandle && (
                    <a
                      href={`https://youtube.com/${c.externalHandle.startsWith("@") ? c.externalHandle : "@" + c.externalHandle}`}
                      target="_blank" rel="noopener noreferrer"
                      className="text-[10px] text-cockpit-muted hover:text-accent inline-flex items-center gap-0.5"
                    >
                      {c.externalHandle.startsWith("@") ? c.externalHandle : "@" + c.externalHandle}
                      <ExternalLink size={9} />
                    </a>
                  )}
                  <div className="flex items-center gap-3 text-[10px] text-cockpit-muted mt-1">
                    {c.subscribers != null && <span>{formatNumber(c.subscribers)} subs</span>}
                    {c.videoCount != null && <span>{c.videoCount} vídeos</span>}
                    {c.lastSyncAt && <span>· sync {timeAgo(c.lastSyncAt)}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => handlePoll(c.id)}
                    disabled={polling === c.id}
                    className="p-1.5 rounded-lg text-cockpit-muted hover:text-accent disabled:opacity-50"
                    title="Sync agora"
                  >
                    {polling === c.id ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                  </button>
                  <button
                    onClick={() => handleRemove(c.id)}
                    className="p-1.5 rounded-lg text-cockpit-muted hover:text-red-500"
                    title="Remover"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
              {c.notes && (
                <p className="text-[11px] text-cockpit-muted bg-cockpit-bg p-2 rounded-lg italic line-clamp-3">
                  {c.notes}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M"
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "k"
  return new Intl.NumberFormat("pt-BR").format(n)
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diff / 60000)
  if (min < 60) return `há ${min}min`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `há ${hr}h`
  const days = Math.floor(hr / 24)
  return `há ${days}d`
}
