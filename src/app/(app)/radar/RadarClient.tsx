"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Radar, RefreshCw, Search, X, CheckCircle2 } from "lucide-react"
import { cn } from "@/lib/utils"

export type RadarEvidence = {
  id: string
  term: string
  url: string
  title: string
  publishedAt: string | null
  summary: string
  keyQuote: string | null
  sourceAuthority: string
  language: string
  relevanceScore: number
  freshnessHours: number | null
  processed: boolean
  capturedAt: string
  ideas: { id: string; title: string }[]
}

const AUTHORITY_COLOR: Record<string, { label: string; cls: string }> = {
  TIER_1: { label: "Tier 1", cls: "bg-emerald-500/10 text-emerald-500 border-emerald-500/30" },
  TIER_2: { label: "Tier 2", cls: "bg-blue-500/10 text-blue-500 border-blue-500/30" },
  BLOG: { label: "Blog", cls: "bg-amber-500/10 text-amber-500 border-amber-500/30" },
  AGGREGATOR: { label: "Agregador", cls: "bg-red-500/10 text-red-500 border-red-500/30" },
  UNKNOWN: { label: "Desconhecido", cls: "bg-zinc-500/10 text-zinc-500 border-zinc-500/30" },
}

function hostFrom(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, "") } catch { return "—" }
}

function timeAgo(date: string | null | undefined): string {
  if (!date) return ""
  const d = new Date(date)
  if (isNaN(d.getTime())) return ""
  const diff = Date.now() - d.getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  return `${days}d`
}

type FreshnessFilter = "all" | "fresh" | "normal" | "aging" | "stale"
type TierFilter = "all" | "TIER_1" | "TIER_2" | "BLOG" | "AGGREGATOR" | "UNKNOWN"
type ProcessedFilter = "all" | "processed" | "pending"

interface Props {
  evidences: RadarEvidence[]
  totalCount: number
  processedCount: number
  termCounts: { term: string; count: number }[]
}

export function RadarClient({ evidences, totalCount, processedCount, termCounts }: Props) {
  const router = useRouter()
  const [refreshing, setRefreshing] = useState(false)
  const [lastRefreshAt, setLastRefreshAt] = useState<number>(Date.now())

  // Filtros
  const [termFilter, setTermFilter] = useState<string | null>(null)
  const [tierFilter, setTierFilter] = useState<TierFilter>("all")
  const [freshnessFilter, setFreshnessFilter] = useState<FreshnessFilter>("all")
  const [processedFilter, setProcessedFilter] = useState<ProcessedFilter>("all")
  const [searchQuery, setSearchQuery] = useState("")

  // Auto-refresh a cada 60s (só quando aba ativa)
  useEffect(() => {
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") {
        router.refresh()
        setLastRefreshAt(Date.now())
      }
    }, 60_000)
    return () => clearInterval(interval)
  }, [router])

  async function handleManualRefresh() {
    setRefreshing(true)
    router.refresh()
    setLastRefreshAt(Date.now())
    // Reseta flag depois do tempo típico de roundtrip
    setTimeout(() => setRefreshing(false), 1200)
  }

  // Aplicar filtros
  const filtered = useMemo(() => {
    return evidences.filter((e) => {
      if (termFilter && e.term !== termFilter) return false
      if (tierFilter !== "all" && e.sourceAuthority !== tierFilter) return false
      if (processedFilter === "processed" && !e.processed) return false
      if (processedFilter === "pending" && e.processed) return false
      if (freshnessFilter !== "all" && e.freshnessHours !== null) {
        const h = e.freshnessHours
        if (freshnessFilter === "fresh" && h >= 24) return false
        if (freshnessFilter === "normal" && (h < 24 || h >= 48)) return false
        if (freshnessFilter === "aging" && (h < 48 || h >= 72)) return false
        if (freshnessFilter === "stale" && h < 72) return false
      }
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        if (
          !e.title.toLowerCase().includes(q) &&
          !e.summary.toLowerCase().includes(q) &&
          !(e.keyQuote ?? "").toLowerCase().includes(q)
        ) return false
      }
      return true
    })
  }, [evidences, termFilter, tierFilter, freshnessFilter, processedFilter, searchQuery])

  const hasActiveFilter = termFilter || tierFilter !== "all" || freshnessFilter !== "all" || processedFilter !== "all" || searchQuery

  const conversionRate = totalCount > 0 ? Math.round((processedCount / totalCount) * 100) : 0
  const secondsSinceRefresh = Math.floor((Date.now() - lastRefreshAt) / 1000)

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      {/* ─── HEADER ─── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-cockpit-text flex items-center gap-2">
            <Radar size={22} className="text-accent" />
            Radar de evidências
          </h1>
          <p className="text-sm text-cockpit-muted mt-1 max-w-2xl">
            Todas as matérias capturadas pelo pipeline — antes de virarem ideia.
            Audite cobertura, freshness e conversão em tempo real.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-cockpit-muted tabular-nums">
            atualizado há {secondsSinceRefresh < 60 ? `${secondsSinceRefresh}s` : `${Math.floor(secondsSinceRefresh / 60)}min`}
          </span>
          <button onClick={handleManualRefresh} disabled={refreshing}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-cockpit-surface border border-cockpit-border rounded-lg text-xs font-medium text-cockpit-muted hover:text-accent hover:border-accent/40 transition-colors disabled:opacity-50">
            <RefreshCw size={11} className={refreshing ? "animate-spin" : ""} />
            Atualizar
          </button>
        </div>
      </div>

      {/* ─── STATS ─── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard label="Evidências capturadas" value={totalCount} />
        <MetricCard label="Viraram ideia" value={processedCount} sub={`${conversionRate}% conversão`} tone="emerald" />
        <MetricCard label="Termos com sinal" value={termCounts.length} />
        <MetricCard label="Publishers únicos" value={new Set(evidences.map((e) => hostFrom(e.url))).size} />
      </div>

      {/* ─── TAG CLOUD POR TERMO (clicável) ─── */}
      {termCounts.length > 0 && (
        <div className="cockpit-card">
          <div className="text-[10px] uppercase tracking-wider text-cockpit-muted mb-2">Capturas por termo (clique pra filtrar)</div>
          <div className="flex flex-wrap gap-2">
            {termCounts.map((b) => (
              <button key={b.term} onClick={() => setTermFilter(termFilter === b.term ? null : b.term)}
                className={cn("text-xs px-2.5 py-1 rounded-full border transition-colors",
                  termFilter === b.term
                    ? "bg-accent/10 text-accent border-accent/40"
                    : "bg-cockpit-bg border-cockpit-border text-cockpit-text hover:border-accent/30")}>
                <strong>{b.term}</strong> <span className="text-cockpit-muted">· {b.count}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ─── FILTROS ─── */}
      <div className="cockpit-card">
        <div className="flex flex-wrap items-center gap-3">
          {/* Busca */}
          <div className="relative flex-1 min-w-[200px]">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-cockpit-muted" />
            <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar no título, resumo ou quote..."
              className="w-full pl-8 pr-3 py-1.5 bg-cockpit-bg border border-cockpit-border rounded-lg text-xs text-cockpit-text placeholder:text-cockpit-muted focus:outline-none focus:ring-1 focus:ring-accent/30" />
          </div>

          {/* Tier */}
          <FilterGroup label="Tier">
            {(["all", "TIER_1", "TIER_2", "BLOG", "AGGREGATOR"] as TierFilter[]).map((t) => (
              <FilterPill key={t} active={tierFilter === t} onClick={() => setTierFilter(t)}>
                {t === "all" ? "todos" : AUTHORITY_COLOR[t]?.label ?? t}
              </FilterPill>
            ))}
          </FilterGroup>

          {/* Freshness */}
          <FilterGroup label="Freshness">
            {(["all", "fresh", "normal", "aging", "stale"] as FreshnessFilter[]).map((f) => (
              <FilterPill key={f} active={freshnessFilter === f} onClick={() => setFreshnessFilter(f)}>
                {f === "all" ? "todos" :
                 f === "fresh" ? "<24h" :
                 f === "normal" ? "24-48h" :
                 f === "aging" ? "48-72h" : ">72h"}
              </FilterPill>
            ))}
          </FilterGroup>

          {/* Processed */}
          <FilterGroup label="Status">
            {(["all", "processed", "pending"] as ProcessedFilter[]).map((p) => (
              <FilterPill key={p} active={processedFilter === p} onClick={() => setProcessedFilter(p)}>
                {p === "all" ? "todos" : p === "processed" ? "virou ideia" : "pendente"}
              </FilterPill>
            ))}
          </FilterGroup>

          {hasActiveFilter && (
            <button onClick={() => {
              setTermFilter(null); setTierFilter("all"); setFreshnessFilter("all"); setProcessedFilter("all"); setSearchQuery("")
            }} className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] text-cockpit-muted hover:text-red-400 rounded-lg border border-cockpit-border hover:border-red-400/30">
              <X size={10} /> limpar
            </button>
          )}
        </div>
      </div>

      {/* ─── TIMELINE ─── */}
      <div>
        <div className="text-[10px] uppercase tracking-wider text-cockpit-muted mb-3 flex items-center gap-2">
          <span>
            {hasActiveFilter ? "Filtradas" : "Últimas evidências"} ({filtered.length}
            {hasActiveFilter && ` de ${evidences.length}`})
          </span>
        </div>

        {filtered.length === 0 ? (
          <div className="cockpit-card text-center py-10">
            {evidences.length === 0 ? (
              <p className="text-sm text-cockpit-muted">
                Nenhuma evidência ainda. O radar é preenchido automaticamente quando o pipeline roda em <a href="/ideias" className="underline hover:text-accent">/ideias</a>.
              </p>
            ) : (
              <p className="text-sm text-cockpit-muted">
                Nenhuma evidência bate com os filtros aplicados.
              </p>
            )}
          </div>
        ) : (
          <ul className="space-y-2">
            {filtered.map((e) => <EvidenceRow key={e.id} e={e} />)}
          </ul>
        )}
      </div>
    </div>
  )
}

function MetricCard({ label, value, sub, tone }: { label: string; value: number | string; sub?: string; tone?: "emerald" }) {
  const toneClass = tone === "emerald" ? "text-emerald-500" : "text-cockpit-text"
  return (
    <div className="cockpit-card">
      <div className="text-[10px] uppercase tracking-wider text-cockpit-muted">{label}</div>
      <div className={cn("text-2xl font-bold mt-1 tabular-nums", toneClass)}>{value}</div>
      {sub && <div className="text-[10px] text-cockpit-muted mt-1">{sub}</div>}
    </div>
  )
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1">
      <span className="text-[10px] text-cockpit-muted uppercase tracking-wider mr-1">{label}</span>
      <div className="flex items-center gap-1 bg-cockpit-border-light rounded-lg p-0.5">
        {children}
      </div>
    </div>
  )
}

function FilterPill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className={cn("px-2 py-1 rounded-md text-[10px] font-medium transition-colors",
        active ? "bg-cockpit-surface text-cockpit-text shadow-sm" : "text-cockpit-muted hover:text-cockpit-text")}>
      {children}
    </button>
  )
}

function EvidenceRow({ e }: { e: RadarEvidence }) {
  const auth = AUTHORITY_COLOR[e.sourceAuthority] ?? AUTHORITY_COLOR.UNKNOWN
  const freshTone =
    e.freshnessHours === null ? "text-zinc-500 bg-zinc-500/10 border-zinc-500/30" :
    e.freshnessHours < 24 ? "text-emerald-500 bg-emerald-500/10 border-emerald-500/30" :
    e.freshnessHours < 48 ? "text-blue-500 bg-blue-500/10 border-blue-500/30" :
    e.freshnessHours < 72 ? "text-amber-500 bg-amber-500/10 border-amber-500/30" :
    "text-red-500 bg-red-500/10 border-red-500/30"

  return (
    <li className={cn("cockpit-card transition-colors", e.processed && "bg-emerald-500/[0.02] border-emerald-500/20")}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <a href={e.url} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-cockpit-text hover:text-accent hover:underline">
            {e.title}
          </a>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-cockpit-muted mt-1">
            <strong className="text-cockpit-text text-[11px]">{e.term}</strong>
            <span>·</span>
            <span>{hostFrom(e.url)}</span>
            <span>·</span>
            <span>{e.language}</span>
            {e.publishedAt && (
              <>
                <span>·</span>
                <span>publicada há {timeAgo(e.publishedAt)}</span>
              </>
            )}
            <span>·</span>
            <span>capturada há {timeAgo(e.capturedAt)}</span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span className={cn("text-[9px] font-bold border px-1.5 py-0.5 rounded", auth.cls)}>{auth.label}</span>
          <span className={cn("text-[9px] font-bold border px-1.5 py-0.5 rounded", freshTone)}>
            {e.freshnessHours === null ? "—" : `${e.freshnessHours}h`}
          </span>
          <span className="text-[9px] text-cockpit-muted tabular-nums">rel {e.relevanceScore}</span>
        </div>
      </div>

      <p className="text-xs text-cockpit-muted mt-2 leading-relaxed">{e.summary}</p>

      {e.keyQuote && (
        <blockquote className="text-[11px] italic mt-2 pl-2.5 border-l-2 border-accent/40 text-cockpit-muted/90 leading-relaxed">
          &ldquo;{e.keyQuote}&rdquo;
        </blockquote>
      )}

      {e.ideas.length > 0 && (
        <div className="mt-2.5 pt-2 border-t border-emerald-500/15 flex flex-wrap items-center gap-1.5">
          <CheckCircle2 size={11} className="text-emerald-500" />
          <span className="text-[10px] text-emerald-500 font-semibold">Virou ideia:</span>
          {e.ideas.map((i) => (
            <span key={i.id} className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
              {i.title.length > 50 ? `${i.title.slice(0, 50)}…` : i.title}
            </span>
          ))}
        </div>
      )}
    </li>
  )
}
