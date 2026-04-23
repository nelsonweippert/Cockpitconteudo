"use client"

import { useEffect, useState, useTransition } from "react"
import { Loader2, Search, X, Plus, Check } from "lucide-react"
import { cn } from "@/lib/utils"
import { updateTermSourcesAction } from "@/app/actions/idea.actions"

export type TermSourceScores = {
  authority: number
  specialization: number
  frequency: number
  independence: number
  languageFit: number
}
export type TermSource = {
  host: string
  name: string
  tier: "TIER_1" | "TIER_2" | "BLOG"
  language: "pt-BR" | "en" | "es"
  note?: string
  isActive: boolean
  scores?: TermSourceScores
  aggregateScore?: number
  validationStatus?: "ok" | "site_name_mismatch" | "not_publisher" | "unreachable" | "error"
  validationNote?: string
  detectedSiteName?: string | null
  lastValidatedAt?: string
}

function tierBadge(tier: TermSource["tier"]) {
  if (tier === "TIER_1") return { text: "TIER 1", cls: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30" }
  if (tier === "TIER_2") return { text: "TIER 2", cls: "bg-blue-500/15 text-blue-500 border-blue-500/30" }
  return { text: "BLOG", cls: "bg-amber-500/15 text-amber-500 border-amber-500/30" }
}

function langFlag(l: string) {
  return l === "pt-BR" ? "🇧🇷" : l === "en" ? "🇺🇸" : l === "es" ? "🇪🇸" : "🌐"
}

interface Props {
  termId: string
  sources: TermSource[]
  onSourcesChange: (sources: TermSource[]) => void
}

type DiscoverStage = "decomp" | "discover" | "validate"

async function callStage<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  let data: { success: boolean; error?: string; data?: T }
  try { data = await res.json() } catch { throw new Error(`${url}: HTTP ${res.status} — resposta inválida`) }
  if (!res.ok || !data.success) throw new Error(data.error || `${url}: HTTP ${res.status}`)
  return data.data as T
}

export function TermSourcesManager({ termId, sources, onSourcesChange }: Props) {
  const [discovering, setDiscovering] = useState(false)
  const [currentStage, setCurrentStage] = useState<DiscoverStage | null>(null)
  const [discoverStartedAt, setDiscoverStartedAt] = useState<number | null>(null)
  const [discoverElapsed, setDiscoverElapsed] = useState(0)
  const [lastResult, setLastResult] = useState<{ found: number; rejected: number; durationMs: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [addingHost, setAddingHost] = useState("")
  const [, startTransition] = useTransition()

  const activeCount = sources.filter((s) => s.isActive).length

  // Timer durante descoberta
  useEffect(() => {
    if (!discoverStartedAt) return
    const interval = setInterval(() => {
      setDiscoverElapsed(Math.floor((Date.now() - discoverStartedAt) / 1000))
    }, 500)
    return () => clearInterval(interval)
  }, [discoverStartedAt])

  async function handleDiscover() {
    setDiscovering(true)
    setDiscoverStartedAt(Date.now())
    setDiscoverElapsed(0)
    setError(null)
    setLastResult(null)
    const pipelineStart = Date.now()
    try {
      // Estágio 1: Decomposição (~15s)
      setCurrentStage("decomp")
      const { decomposition } = await callStage<{ decomposition: unknown }>(
        "/api/content/sources/discover/stage1",
        { termId },
      )

      // Estágio 2: Descoberta (~40s)
      setCurrentStage("discover")
      const { candidates } = await callStage<{ candidates: unknown[] }>(
        "/api/content/sources/discover/stage2",
        { termId, decomposition },
      )

      // Estágio 3: Validação + ranking + persistência (~60s)
      setCurrentStage("validate")
      const stage3 = await callStage<{ sources: TermSource[]; found: number; rejected: unknown[] }>(
        "/api/content/sources/discover/stage3",
        { termId, decomposition, candidates },
      )

      onSourcesChange(stage3.sources)
      setLastResult({
        found: stage3.found,
        rejected: stage3.rejected.length,
        durationMs: Date.now() - pipelineStart,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado")
    } finally {
      setDiscovering(false)
      setDiscoverStartedAt(null)
      setCurrentStage(null)
    }
  }

  async function persistSources(newSources: TermSource[]) {
    onSourcesChange(newSources)
    startTransition(async () => {
      await updateTermSourcesAction(termId, newSources as unknown as unknown[])
    })
  }

  function handleToggle(host: string) {
    persistSources(sources.map((s) => s.host === host ? { ...s, isActive: !s.isActive } : s))
  }

  function handleRemove(host: string) {
    persistSources(sources.filter((s) => s.host !== host))
  }

  function handleAddManual() {
    const clean = addingHost.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/+.*$/, "")
    if (!clean || !/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(clean)) {
      setError("Host inválido. Ex: folha.uol.com.br")
      return
    }
    if (sources.find((s) => s.host === clean)) {
      setError("Fonte já cadastrada")
      return
    }
    const manual: TermSource = {
      host: clean, name: clean,
      tier: "TIER_2", language: clean.endsWith(".br") || clean.includes(".com.br") ? "pt-BR" : "en",
      note: "Adicionada manualmente", isActive: true,
    }
    persistSources([...sources, manual])
    setAddingHost("")
    setError(null)
  }

  return (
    <div className="mt-2 space-y-2 border-t border-cockpit-border pt-2">
      <div className="flex items-center justify-between">
        <div className="text-[11px] text-cockpit-muted">
          {sources.length > 0 ? (
            <>
              <span className="font-semibold text-cockpit-text">{activeCount}</span>/{sources.length} fonte{sources.length === 1 ? "" : "s"} ativa{activeCount === 1 ? "" : "s"}
            </>
          ) : (
            <span className="italic">Sem fontes curadas — pesquisa usa Google News RSS</span>
          )}
        </div>
        <button onClick={handleDiscover} disabled={discovering}
          className="flex items-center gap-1 px-2.5 py-1 bg-accent/10 text-accent text-[11px] font-semibold border border-accent/20 rounded-lg hover:bg-accent/20 disabled:opacity-50 transition-colors">
          {discovering ? <Loader2 size={11} className="animate-spin" /> : <Search size={11} />}
          {discovering ? "Pesquisando..." : sources.length > 0 ? "Atualizar fontes" : "Pesquisar fontes"}
        </button>
      </div>

      {error && (
        <div className="px-2 py-1 bg-red-500/10 border border-red-500/20 rounded-lg text-[10px] text-red-400">
          {error}
        </div>
      )}

      {/* Progress dos 3 estágios — currentStage real via callStage sequencial */}
      {discovering && currentStage && (() => {
        const stages: { id: DiscoverStage; label: string; detail: string }[] = [
          { id: "decomp", label: "Decompondo tema", detail: "subtemas, jargão, perfis-alvo, queries planejadas (~15s)" },
          { id: "discover", label: "Descoberta multi-estratégia", detail: "executando 6-10 queries web_search (~40s)" },
          { id: "validate", label: "Validação + ranking", detail: "site: por candidato, score em 5 dimensões (~60s)" },
        ]
        const effectiveIdx = stages.findIndex((s) => s.id === currentStage)
        return (
          <div className="p-3 bg-cockpit-bg border border-accent/20 rounded-lg space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Loader2 size={12} className="animate-spin text-accent" />
                <span className="text-[11px] font-semibold text-cockpit-text">
                  Estágio {effectiveIdx + 1}/3 · {stages[effectiveIdx].label}
                </span>
              </div>
              <span className="text-[11px] text-cockpit-muted tabular-nums">{discoverElapsed}s</span>
            </div>
            <p className="text-[10px] text-cockpit-muted">{stages[effectiveIdx].detail}</p>
            <div className="flex items-center gap-1">
              {stages.map((s, i) => {
                const done = i < effectiveIdx
                const current = i === effectiveIdx
                return (
                  <div key={s.id} className="flex-1 h-1 bg-cockpit-border-light rounded-full overflow-hidden">
                    <div className={cn(
                      "h-full rounded-full transition-all duration-500",
                      done ? "bg-emerald-500 w-full" : current ? "bg-accent w-1/2 animate-pulse" : "w-0"
                    )} />
                  </div>
                )
              })}
            </div>
          </div>
        )
      })()}

      {/* Resultado da última descoberta */}
      {lastResult && !discovering && (
        <div className="px-2 py-1 bg-emerald-500/5 border border-emerald-500/15 rounded-lg text-[10px] text-emerald-500">
          ✓ {lastResult.found} fontes encontradas · {lastResult.rejected} rejeitadas · {(lastResult.durationMs / 1000).toFixed(0)}s
        </div>
      )}

      {sources.length > 0 && (
        <div className="space-y-1 max-h-96 overflow-y-auto">
          {sources.map((s) => {
            const tier = tierBadge(s.tier)
            const scoreTone =
              s.aggregateScore == null ? "" :
              s.aggregateScore >= 8 ? "text-emerald-500" :
              s.aggregateScore >= 6 ? "text-accent" :
              "text-amber-500"
            const scoresTooltip = s.scores
              ? `Autoridade: ${s.scores.authority} · Especialização: ${s.scores.specialization} · Frequência: ${s.scores.frequency} · Independência: ${s.scores.independence} · Idioma: ${s.scores.languageFit}`
              : undefined
            return (
              <div key={s.host} className={cn(
                "flex items-center gap-2 px-2 py-1.5 rounded-lg border text-[11px]",
                s.isActive ? "border-cockpit-border bg-cockpit-bg" : "border-cockpit-border-light bg-cockpit-border-light/20 opacity-60"
              )}>
                <button onClick={() => handleToggle(s.host)}
                  title={s.isActive ? "Desativar" : "Ativar"}
                  className={cn(
                    "w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors",
                    s.isActive ? "bg-accent border-accent text-black" : "bg-cockpit-bg border-cockpit-border text-transparent hover:border-accent/40"
                  )}>
                  {s.isActive && <Check size={10} strokeWidth={3} />}
                </button>
                <span className={cn("px-1.5 py-0.5 text-[9px] font-bold border rounded", tier.cls)}>{tier.text}</span>
                <span className="text-[11px]">{langFlag(s.language)}</span>
                {s.aggregateScore != null && (
                  <span title={scoresTooltip} className={cn("text-[10px] font-bold tabular-nums shrink-0 cursor-help", scoreTone)}>
                    {s.aggregateScore.toFixed(1)}
                  </span>
                )}
                {/* Badge de validação HTTP */}
                {s.validationStatus && (
                  <span
                    title={`${s.validationStatus === "ok" ? "Validada: site ativo e é publisher real" : `Atenção: ${s.validationNote ?? s.validationStatus}`}${s.lastValidatedAt ? ` · ${new Date(s.lastValidatedAt).toLocaleDateString("pt-BR")}` : ""}`}
                    className={cn(
                      "text-[9px] font-semibold px-1 py-0.5 rounded shrink-0 cursor-help",
                      s.validationStatus === "ok" ? "bg-emerald-500/10 text-emerald-500" :
                      s.validationStatus === "site_name_mismatch" ? "bg-amber-500/10 text-amber-500" :
                      "bg-red-500/10 text-red-500"
                    )}>
                    {s.validationStatus === "ok" ? "✓" : s.validationStatus === "site_name_mismatch" ? "!" : "✗"}
                  </span>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-1.5">
                    <a href={`https://${s.host}`} target="_blank" rel="noopener noreferrer"
                      className="font-semibold text-cockpit-text truncate hover:text-accent hover:underline">{s.name}</a>
                    <span className="text-[9px] text-cockpit-muted truncate">{s.host}</span>
                  </div>
                  {s.note && <p className="text-[10px] text-cockpit-muted truncate" title={s.note}>{s.note}</p>}
                </div>
                <button onClick={() => handleRemove(s.host)} title="Remover"
                  className="p-0.5 text-cockpit-muted hover:text-red-400 rounded shrink-0">
                  <X size={11} />
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* Add manual */}
      <div className="flex items-center gap-1.5">
        <input type="text" value={addingHost} onChange={(e) => setAddingHost(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleAddManual() }}
          placeholder="Adicionar manual: folha.uol.com.br"
          className="flex-1 px-2 py-1 bg-cockpit-bg border border-cockpit-border rounded-lg text-[11px] text-cockpit-text placeholder:text-cockpit-muted focus:outline-none focus:ring-1 focus:ring-accent/30" />
        <button onClick={handleAddManual} disabled={!addingHost.trim()}
          className="px-2 py-1 text-cockpit-muted hover:text-accent disabled:opacity-50">
          <Plus size={12} />
        </button>
      </div>
    </div>
  )
}
