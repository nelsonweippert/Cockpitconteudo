"use client"

import { useState } from "react"
import Image from "next/image"
import { Search, Loader2, TrendingUp, AlertTriangle, ExternalLink } from "lucide-react"
import { cn } from "@/lib/utils"

type Result = {
  query: string
  volumeIndex: number
  competition: number
  trends12m: number[]
  related: string[]
  topVideos: Array<{
    videoId: string
    title: string
    channelTitle: string
    publishedAt: string
    thumbnailUrl: string | null
  }>
  insight: { label: string; tone: "good" | "warn" | "neutral" }
}

export function KeywordClient() {
  const [query, setQuery] = useState("")
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<Result | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleSearch(q?: string) {
    const term = (q ?? query).trim()
    if (!term) return
    setQuery(term)
    setError(null)
    setLoading(true)
    setResult(null)
    try {
      const res = await fetch("/api/keyword", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: term }),
      })
      const body = await res.json()
      if (body.success) setResult(body.data)
      else setError(body.error ?? "Erro")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha de rede")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-cockpit-text flex items-center gap-2">
          <Search size={22} className="text-accent" />
          Keyword Explorer
        </h1>
        <p className="text-sm text-cockpit-muted mt-1 max-w-2xl">
          Demanda, competição e tendência 12 meses pra qualquer palavra-chave.
          Use antes de decidir título do próximo conteúdo.
        </p>
      </div>

      {/* Input */}
      <form
        onSubmit={(e) => { e.preventDefault(); handleSearch() }}
        className="cockpit-card flex items-center gap-2 p-3"
      >
        <Search size={16} className="text-cockpit-muted shrink-0" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ex: gpt-5, copywriting, dieta low carb..."
          className="flex-1 bg-transparent text-sm text-cockpit-text placeholder:text-cockpit-muted focus:outline-none"
          autoFocus
        />
        <button
          type="submit"
          disabled={loading || !query.trim()}
          className="px-4 py-2 bg-accent text-black text-xs font-semibold rounded-xl hover:bg-accent-hover disabled:opacity-50 transition-colors flex items-center gap-1.5"
        >
          {loading ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} />}
          {loading ? "Pesquisando..." : "Explorar"}
        </button>
      </form>

      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-sm text-red-500">
          {error}
        </div>
      )}

      {result && (
        <div className="space-y-4">
          {/* Insight */}
          <div className={cn(
            "cockpit-card flex items-start gap-3 p-4",
            result.insight.tone === "good" && "border-emerald-500/30 bg-emerald-500/5",
            result.insight.tone === "warn" && "border-amber-500/30 bg-amber-500/5",
          )}>
            {result.insight.tone === "good" ? <TrendingUp size={20} className="text-emerald-500 shrink-0" /> :
             result.insight.tone === "warn" ? <AlertTriangle size={20} className="text-amber-500 shrink-0" /> :
             <Search size={20} className="text-cockpit-muted shrink-0" />}
            <div>
              <p className={cn(
                "text-sm font-semibold",
                result.insight.tone === "good" && "text-emerald-500",
                result.insight.tone === "warn" && "text-amber-500",
                result.insight.tone === "neutral" && "text-cockpit-text",
              )}>{result.insight.label}</p>
              <p className="text-[11px] text-cockpit-muted mt-0.5">
                Análise pra <span className="font-mono">&quot;{result.query}&quot;</span> baseada em pico de demanda + competidores indexáveis.
              </p>
            </div>
          </div>

          {/* Gauges */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Gauge label="Demanda (índice)" value={result.volumeIndex} hint="0-100, derivado do pico de Google Trends 12m" tone={result.volumeIndex >= 50 ? "good" : "warn"} />
            <Gauge label="Competição" value={result.competition} hint="0-100, derivado de # competidores e densidade de buscas" tone={result.competition >= 80 ? "warn" : result.competition >= 50 ? "neutral" : "good"} reverse />
          </div>

          {/* Trends sparkline */}
          {result.trends12m.length > 0 && (
            <div className="cockpit-card">
              <h3 className="text-xs font-semibold text-cockpit-muted uppercase tracking-wide mb-2">
                Tendência 12 meses (Google Trends)
              </h3>
              <Sparkline values={result.trends12m} />
              <p className="text-[10px] text-cockpit-muted mt-1">
                Picos altos = momentos de alta busca. Linha em queda = janela fechando.
              </p>
            </div>
          )}

          {/* Related (autocomplete) */}
          {result.related.length > 0 && (
            <div className="cockpit-card">
              <h3 className="text-xs font-semibold text-cockpit-muted uppercase tracking-wide mb-2">
                O que as pessoas estão buscando ({result.related.length})
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {result.related.map((r) => (
                  <button
                    key={r}
                    onClick={() => handleSearch(r)}
                    className="px-2.5 py-1 bg-cockpit-bg border border-cockpit-border rounded-full text-xs text-cockpit-text hover:border-accent/40 hover:text-accent transition-colors"
                  >
                    {r}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-cockpit-muted mt-2">
                Clique pra explorar uma variação. Boas pistas pra long-tail.
              </p>
            </div>
          )}

          {/* Top videos */}
          {result.topVideos.length > 0 ? (
            <div className="cockpit-card">
              <h3 className="text-xs font-semibold text-cockpit-muted uppercase tracking-wide mb-2">
                Top {result.topVideos.length} vídeos competindo pelo termo
              </h3>
              <div className="space-y-2">
                {result.topVideos.map((v) => (
                  <a
                    key={v.videoId}
                    href={`https://youtube.com/watch?v=${v.videoId}`}
                    target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-3 p-2 bg-cockpit-bg border border-cockpit-border rounded-xl hover:border-accent/30 transition-colors group"
                  >
                    {v.thumbnailUrl ? (
                      <Image src={v.thumbnailUrl} alt={v.title} width={120} height={68} className="rounded-lg object-cover shrink-0" unoptimized />
                    ) : (
                      <div className="w-[120px] h-[68px] bg-cockpit-border-light rounded-lg shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-cockpit-text line-clamp-2 group-hover:text-accent">
                        {v.title}
                      </p>
                      <p className="text-[10px] text-cockpit-muted mt-0.5">
                        {v.channelTitle} · {new Date(v.publishedAt).toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                    <ExternalLink size={12} className="text-cockpit-muted shrink-0" />
                  </a>
                ))}
              </div>
            </div>
          ) : (
            <div className="cockpit-card">
              <p className="text-xs text-cockpit-muted">
                Top vídeos do YouTube indisponíveis.
                {!process.env.NEXT_PUBLIC_HAS_YT_KEY ? " Configure YOUTUBE_API_KEY no env pra habilitar." : ""}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function Gauge({ label, value, hint, tone, reverse }: {
  label: string; value: number; hint: string;
  tone: "good" | "warn" | "neutral"; reverse?: boolean
}) {
  const color = tone === "good" ? (reverse ? "text-emerald-500" : "text-emerald-500") :
                tone === "warn" ? "text-amber-500" :
                "text-cockpit-text"
  const barColor = tone === "good" ? "bg-emerald-500" : tone === "warn" ? "bg-amber-500" : "bg-accent"
  return (
    <div className="cockpit-card">
      <p className="text-[10px] text-cockpit-muted uppercase tracking-wide">{label}</p>
      <div className="flex items-baseline gap-2 mt-1">
        <p className={cn("text-3xl font-bold tabular-nums", color)}>{value}</p>
        <p className="text-xs text-cockpit-muted">/ 100</p>
      </div>
      <div className="h-1.5 bg-cockpit-border-light rounded-full overflow-hidden mt-2">
        <div className={cn("h-full rounded-full transition-all", barColor)} style={{ width: `${value}%` }} />
      </div>
      <p className="text-[10px] text-cockpit-muted mt-1.5">{hint}</p>
    </div>
  )
}

function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const width = 600
  const height = 80
  const stepX = width / (values.length - 1)
  const points = values.map((v, i) => `${i * stepX},${height - ((v - min) / range) * height * 0.9 - 4}`).join(" ")
  const areaPoints = `0,${height} ${points} ${(values.length - 1) * stepX},${height}`

  return (
    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="w-full h-20">
      <polygon points={areaPoints} fill="currentColor" className="text-accent/20" />
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth="2" className="text-accent" />
      {values.map((v, i) => (
        <circle key={i} cx={i * stepX} cy={height - ((v - min) / range) * height * 0.9 - 4} r="2" fill="currentColor" className="text-accent" />
      ))}
    </svg>
  )
}
