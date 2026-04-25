"use client"

import { useMemo, useState } from "react"
import { CheckCircle2, AlertCircle, AlertTriangle, Info, ChevronDown } from "lucide-react"
import { computeSeoScore, type SeoInput, type SeoCheck } from "@/services/seo-score.service"
import { cn } from "@/lib/utils"

type Props = SeoInput & { compact?: boolean }

const LEVEL_META: Record<"low" | "medium" | "good" | "excellent", { label: string; ring: string; text: string; bar: string }> = {
  low:       { label: "Em construção",  ring: "ring-red-500/30 bg-red-500/5",       text: "text-red-500",       bar: "bg-red-500" },
  medium:    { label: "Pronto pra revisão", ring: "ring-amber-500/30 bg-amber-500/5", text: "text-amber-500", bar: "bg-amber-500" },
  good:      { label: "Sólido",          ring: "ring-accent/30 bg-accent/5",          text: "text-accent",        bar: "bg-accent" },
  excellent: { label: "Pronto pra publicar", ring: "ring-emerald-500/30 bg-emerald-500/5", text: "text-emerald-500", bar: "bg-emerald-500" },
}

const SEV_META: Record<SeoCheck["severity"], { icon: typeof CheckCircle2; cls: string }> = {
  ok:   { icon: CheckCircle2, cls: "text-emerald-500" },
  warn: { icon: AlertTriangle, cls: "text-amber-500" },
  info: { icon: Info, cls: "text-cockpit-muted" },
  fail: { icon: AlertCircle, cls: "text-red-500" },
}

const CATEGORY_LABEL: Record<SeoCheck["category"], string> = {
  title: "Título",
  hook: "Hook",
  script: "Roteiro",
  description: "Descrição",
  structure: "Estrutura",
  platform: "Plataforma",
}

export function SeoScorePanel(props: Props) {
  const result = useMemo(() => computeSeoScore(props), [props])
  const [showAll, setShowAll] = useState(false)

  const meta = LEVEL_META[result.level]

  // Agrupa checks por categoria
  const byCategory = useMemo(() => {
    const map: Record<SeoCheck["category"], SeoCheck[]> = {
      title: [], hook: [], script: [], description: [], structure: [], platform: [],
    }
    for (const c of result.checks) map[c.category].push(c)
    return map
  }, [result.checks])

  // Top issues = fails + warns ordenados por maxWeight perdido
  const topIssues = useMemo(() => {
    return result.checks
      .filter((c) => c.severity === "fail" || c.severity === "warn")
      .map((c) => ({ ...c, lost: c.maxWeight - c.weight }))
      .sort((a, b) => b.lost - a.lost)
      .slice(0, 3)
  }, [result.checks])

  if (props.compact) {
    return (
      <div className={cn("flex items-center gap-2 px-3 py-2 rounded-xl ring-1", meta.ring)}>
        <div className={cn("text-2xl font-bold tabular-nums", meta.text)}>{result.score}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between text-[11px]">
            <span className={cn("font-semibold", meta.text)}>{meta.label}</span>
            <span className="text-cockpit-muted">{result.positives} ok · {result.warnings} avisos · {result.fails} críticos</span>
          </div>
          <div className="h-1 bg-cockpit-border-light rounded-full overflow-hidden mt-1">
            <div className={cn("h-full rounded-full transition-all", meta.bar)} style={{ width: `${result.score}%` }} />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Header com gauge */}
      <div className={cn("p-4 rounded-xl ring-1 flex items-start gap-4", meta.ring)}>
        <div className="text-center shrink-0">
          <div className={cn("text-4xl font-bold tabular-nums leading-none", meta.text)}>{result.score}</div>
          <div className="text-[10px] text-cockpit-muted mt-1">/ 100</div>
        </div>
        <div className="flex-1 min-w-0">
          <h3 className={cn("text-sm font-semibold", meta.text)}>{meta.label}</h3>
          <p className="text-[11px] text-cockpit-muted mt-0.5">
            Diagnóstico SEO baseado em estrutura do conteúdo. Não é validação — é pra você ver o que falta.
          </p>
          <div className="h-1.5 bg-cockpit-border-light rounded-full overflow-hidden mt-2.5">
            <div className={cn("h-full rounded-full transition-all", meta.bar)} style={{ width: `${result.score}%` }} />
          </div>
          <div className="flex items-center gap-3 mt-1.5 text-[10px] text-cockpit-muted">
            <span><CheckCircle2 size={10} className="inline text-emerald-500" /> {result.positives} OK</span>
            <span><AlertTriangle size={10} className="inline text-amber-500" /> {result.warnings} a melhorar</span>
            <span><AlertCircle size={10} className="inline text-red-500" /> {result.fails} críticos</span>
          </div>
        </div>
      </div>

      {/* Top issues */}
      {topIssues.length > 0 && (
        <div className="space-y-1.5">
          <h4 className="text-[10px] font-semibold uppercase tracking-wide text-cockpit-muted">⚠ Top ações pra subir o score</h4>
          {topIssues.map((c) => {
            const SevIcon = SEV_META[c.severity].icon
            return (
              <div key={c.id} className="flex items-start gap-2 px-2.5 py-2 bg-cockpit-bg border border-cockpit-border rounded-lg text-[11px]">
                <SevIcon size={13} className={cn("shrink-0 mt-0.5", SEV_META[c.severity].cls)} />
                <div className="flex-1 min-w-0">
                  <p className="text-cockpit-text">{c.text}</p>
                  <p className="text-[9px] text-cockpit-muted">{CATEGORY_LABEL[c.category]} · {c.lost} pts disponíveis</p>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Toggle pra ver tudo */}
      <button
        onClick={() => setShowAll((v) => !v)}
        className="w-full flex items-center justify-center gap-1.5 text-[11px] text-cockpit-muted hover:text-accent transition-colors py-1"
      >
        <ChevronDown size={12} className={cn("transition-transform", showAll && "rotate-180")} />
        {showAll ? "Esconder checklist completo" : `Ver checklist completo (${result.checks.length} itens)`}
      </button>

      {showAll && (
        <div className="space-y-2.5">
          {(Object.keys(byCategory) as Array<SeoCheck["category"]>).map((cat) => {
            const items = byCategory[cat]
            if (items.length === 0) return null
            return (
              <div key={cat}>
                <h5 className="text-[10px] font-semibold uppercase tracking-wide text-cockpit-muted mb-1.5">{CATEGORY_LABEL[cat]}</h5>
                <div className="space-y-1">
                  {items.map((c) => {
                    const SevIcon = SEV_META[c.severity].icon
                    return (
                      <div key={c.id} className="flex items-start gap-2 px-2 py-1.5 bg-cockpit-bg border border-cockpit-border rounded-lg text-[11px]">
                        <SevIcon size={12} className={cn("shrink-0 mt-0.5", SEV_META[c.severity].cls)} />
                        <span className="flex-1 text-cockpit-text">{c.text}</span>
                        {c.weight > 0 && c.maxWeight > 0 && (
                          <span className="text-[9px] text-cockpit-muted tabular-nums shrink-0">{c.weight}/{c.maxWeight}</span>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
