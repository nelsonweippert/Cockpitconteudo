"use client"

import { useEffect, useState } from "react"
import { CheckCircle2, AlertCircle, AlertTriangle, X, Loader2, Send } from "lucide-react"
import { computeSeoScore, type SeoCheck } from "@/services/seo-score.service"
import { cn } from "@/lib/utils"

type Props = {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  content: {
    title: string | null
    hook: string | null
    script: string | null
    description: string | null
    targetDuration: number | null
    platform: string | null
    format: string | null
    skill: string | null
    publishedUrl: string | null
  }
}

type LLMReview = {
  verdict: "go" | "fix-first" | "blocker"
  summary: string
  blockers: string[]
  warnings: string[]
  greenLights: string[]
}

export function PrePublishGate({ open, onClose, onConfirm, content }: Props) {
  const seo = computeSeoScore({
    title: content.title,
    hook: content.hook,
    script: content.script,
    description: content.description,
    targetDuration: content.targetDuration,
    platform: content.platform,
    format: content.format,
    skill: content.skill,
  })
  const [llmReview, setLlmReview] = useState<LLMReview | null>(null)
  const [loading, setLoading] = useState(false)
  const [llmError, setLlmError] = useState<string | null>(null)

  // Quando abre, dispara LLM review
  useEffect(() => {
    if (!open) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset ao abrir o modal antes do fetch
    setLlmReview(null)
    setLlmError(null)
    setLoading(true)
    fetch("/api/content/pre-publish-review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(content),
    })
      .then((r) => r.json())
      .then((body) => {
        if (body.success) setLlmReview(body.data)
        else setLlmError(body.error ?? "Erro na review")
      })
      .catch((err) => setLlmError(err instanceof Error ? err.message : "falha"))
      .finally(() => setLoading(false))
  }, [open, content])

  if (!open) return null

  const seoFails = seo.checks.filter((c) => c.severity === "fail")
  const seoWarns = seo.checks.filter((c) => c.severity === "warn")
  const hasUrl = !!content.publishedUrl

  // Verdict combinado
  let verdict: "go" | "fix-first" | "blocker"
  if (llmReview) {
    if (llmReview.verdict === "blocker" || seoFails.length > 0) verdict = "blocker"
    else if (llmReview.verdict === "fix-first" || seo.score < 60) verdict = "fix-first"
    else verdict = "go"
  } else {
    verdict = seoFails.length > 0 ? "blocker" : seo.score < 60 ? "fix-first" : "go"
  }

  const verdictMeta = {
    go: { label: "Pronto pra publicar", color: "text-emerald-500", border: "border-emerald-500/30 bg-emerald-500/5", icon: CheckCircle2 },
    "fix-first": { label: "Vale ajustar antes", color: "text-amber-500", border: "border-amber-500/30 bg-amber-500/5", icon: AlertTriangle },
    blocker: { label: "Tem problema crítico", color: "text-red-500", border: "border-red-500/30 bg-red-500/5", icon: AlertCircle },
  }[verdict]

  const Icon = verdictMeta.icon

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-cockpit-surface border border-cockpit-border rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="sticky top-0 bg-cockpit-surface border-b border-cockpit-border p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Send size={16} className="text-accent" />
            <h2 className="text-base font-semibold text-cockpit-text">Pré-publicação</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-cockpit-muted hover:text-cockpit-text hover:bg-cockpit-surface-hover">
            <X size={16} />
          </button>
        </div>

        {/* Verdict */}
        <div className={cn("m-4 p-4 rounded-xl border flex items-start gap-3", verdictMeta.border)}>
          <Icon size={20} className={cn("shrink-0 mt-0.5", verdictMeta.color)} />
          <div className="flex-1">
            <h3 className={cn("text-sm font-semibold", verdictMeta.color)}>{verdictMeta.label}</h3>
            <p className="text-[11px] text-cockpit-muted mt-0.5">
              SEO Score: <strong className={verdictMeta.color}>{seo.score}/100</strong>
              {llmReview && <> · Review IA: {llmReview.summary.slice(0, 100)}</>}
            </p>
          </div>
        </div>

        <div className="px-4 pb-4 space-y-4">
          {/* SEO problems */}
          {(seoFails.length > 0 || seoWarns.length > 0) && (
            <Section title={`SEO Score: ${seo.score}/100`}>
              {seoFails.map((c) => <CheckItem key={c.id} check={c} />)}
              {seoWarns.slice(0, 5).map((c) => <CheckItem key={c.id} check={c} />)}
            </Section>
          )}

          {/* LLM Review */}
          {loading && (
            <div className="flex items-center gap-2 text-xs text-cockpit-muted py-2">
              <Loader2 size={14} className="animate-spin" />
              Review crítica da IA (~10s)...
            </div>
          )}
          {llmError && (
            <div className="p-2.5 bg-red-500/5 border border-red-500/20 rounded-lg text-xs text-red-500">
              Review indisponível: {llmError}
            </div>
          )}
          {llmReview && (
            <>
              {llmReview.blockers.length > 0 && (
                <Section title="Bloqueadores apontados pela IA">
                  {llmReview.blockers.map((b, i) => (
                    <div key={i} className="flex items-start gap-2 px-2.5 py-2 bg-red-500/5 border border-red-500/20 rounded-lg text-[11px]">
                      <AlertCircle size={13} className="text-red-500 shrink-0 mt-0.5" />
                      <span className="text-cockpit-text">{b}</span>
                    </div>
                  ))}
                </Section>
              )}
              {llmReview.warnings.length > 0 && (
                <Section title="A melhorar">
                  {llmReview.warnings.map((w, i) => (
                    <div key={i} className="flex items-start gap-2 px-2.5 py-2 bg-amber-500/5 border border-amber-500/20 rounded-lg text-[11px]">
                      <AlertTriangle size={13} className="text-amber-500 shrink-0 mt-0.5" />
                      <span className="text-cockpit-text">{w}</span>
                    </div>
                  ))}
                </Section>
              )}
              {llmReview.greenLights.length > 0 && (
                <Section title="Pontos fortes">
                  {llmReview.greenLights.map((g, i) => (
                    <div key={i} className="flex items-start gap-2 px-2.5 py-2 bg-emerald-500/5 border border-emerald-500/20 rounded-lg text-[11px]">
                      <CheckCircle2 size={13} className="text-emerald-500 shrink-0 mt-0.5" />
                      <span className="text-cockpit-text">{g}</span>
                    </div>
                  ))}
                </Section>
              )}
            </>
          )}

          {/* Publication URL warning */}
          {!hasUrl && (
            <div className="p-2.5 bg-amber-500/5 border border-amber-500/20 rounded-lg text-[11px] text-amber-500">
              ⚠ Sem URL de publicação. Avançar pra &quot;Publicado&quot; sem URL é OK, mas você não vai conseguir trackear.
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="sticky bottom-0 bg-cockpit-surface border-t border-cockpit-border p-3 flex items-center justify-between gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs text-cockpit-muted hover:text-cockpit-text border border-cockpit-border rounded-xl"
          >
            Voltar e ajustar
          </button>
          <button
            onClick={onConfirm}
            className={cn(
              "px-4 py-2 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors",
              verdict === "go" ? "bg-accent text-black hover:bg-accent-hover" :
              verdict === "fix-first" ? "bg-amber-500 text-black hover:bg-amber-600" :
              "bg-red-500/80 text-white hover:bg-red-500",
            )}
          >
            <Send size={12} />
            {verdict === "go" ? "Marcar como publicado" :
             verdict === "fix-first" ? "Publicar mesmo assim" :
             "Forçar publicação"}
          </button>
        </div>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="text-[10px] font-semibold uppercase tracking-wide text-cockpit-muted mb-1.5">{title}</h4>
      <div className="space-y-1.5">{children}</div>
    </div>
  )
}

function CheckItem({ check }: { check: SeoCheck }) {
  const Icon = check.severity === "fail" ? AlertCircle : check.severity === "warn" ? AlertTriangle : CheckCircle2
  const cls = check.severity === "fail" ? "text-red-500" : check.severity === "warn" ? "text-amber-500" : "text-emerald-500"
  return (
    <div className="flex items-start gap-2 px-2.5 py-2 bg-cockpit-bg border border-cockpit-border rounded-lg text-[11px]">
      <Icon size={13} className={cn("shrink-0 mt-0.5", cls)} />
      <span className="text-cockpit-text">{check.text}</span>
    </div>
  )
}
