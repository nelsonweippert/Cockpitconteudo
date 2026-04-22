"use client"

import { Plus, Trash2, ExternalLink, Loader2, Star } from "lucide-react"
import { cn } from "@/lib/utils"

type PlatformFit = { reels: number; shorts: number; long: number; tiktok: number } | null

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Idea = any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Content = any

// Estrutura de fases mostrada no progresso quando a ideia virou Content
const PHASE_ORDER = ["IDEATION", "ELABORATION", "BRIEFING", "EDITING_SENT", "PUBLISHED"] as const
const PHASE_SHORT: Record<string, string> = {
  IDEATION: "Ideia",
  ELABORATION: "Elab.",
  BRIEFING: "Brief.",
  EDITING_SENT: "Edição",
  PUBLISHED: "Pub.",
}
const PHASE_FULL: Record<string, string> = {
  IDEATION: "Idealização",
  ELABORATION: "Elaboração",
  BRIEFING: "Briefing",
  EDITING_SENT: "Em edição",
  PUBLISHED: "Publicado",
}

function timeAgo(date: Date | string | null | undefined): string {
  if (!date) return ""
  const d = typeof date === "string" ? new Date(date) : date
  if (isNaN(d.getTime())) return ""
  const diff = Date.now() - d.getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}min atrás`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h atrás`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d atrás`
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })
}

function hostOf(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, "") } catch { return "" }
}

interface IdeaCardProps {
  idea: Idea
  linkedContent: Content | null
  onUse: () => void
  onDiscard: () => void
  onOpen: () => void  // abre painel do Content quando linkedContent existe
  onToggleFavorite: () => void
  isPending: boolean
}

export function IdeaCard({ idea, linkedContent, onUse, onDiscard, onOpen, onToggleFavorite, isPending }: IdeaCardProps) {
  const isUsed = !!idea.isUsed
  const currentPhase = linkedContent?.phase as string | undefined
  const currentPhaseIdx = currentPhase ? PHASE_ORDER.indexOf(currentPhase as typeof PHASE_ORDER[number]) : -1
  const pioneerScore = typeof idea.pioneerScore === "number" ? idea.pioneerScore : null
  const viralScore = typeof idea.viralScore === "number" ? idea.viralScore : null
  const displayScore = pioneerScore ?? idea.score ?? null
  const platformFit = idea.platformFit as PlatformFit

  // Cor do score pill
  const scoreTone =
    displayScore == null ? "border-cockpit-border text-cockpit-muted bg-cockpit-bg" :
    displayScore >= 85 ? "border-emerald-500/30 text-emerald-500 bg-emerald-500/10" :
    displayScore >= 70 ? "border-accent/30 text-accent bg-accent/10" :
    displayScore >= 50 ? "border-amber-500/30 text-amber-500 bg-amber-500/10" :
    "border-zinc-500/30 text-zinc-500 bg-zinc-500/10"

  return (
    <div className={cn(
      "rounded-xl border transition-all",
      idea.isFavorite ? "border-amber-400/40 bg-amber-500/[0.03]" :
      isUsed ? "border-emerald-500/20 bg-emerald-500/[0.02]" :
      "border-cockpit-border bg-cockpit-surface hover:border-accent/30"
    )}>
      {/* ─── HEADER: score + título + meta ─── */}
      <div className="p-4 flex items-start gap-3">
        {/* Score pill */}
        <div className={cn("flex flex-col items-center justify-center w-12 h-12 rounded-xl border font-bold shrink-0", scoreTone)}>
          <span className="text-sm leading-none">{displayScore ?? "—"}</span>
          <span className="text-[8px] font-medium opacity-70 mt-0.5 uppercase tracking-wider">score</span>
        </div>

        {/* Título + summary */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-sm font-semibold text-cockpit-text leading-snug">{idea.title}</h3>
            <div className="flex items-center gap-2 shrink-0">
              {idea.createdAt && (
                <span className="text-[10px] text-cockpit-muted whitespace-nowrap">{timeAgo(idea.createdAt)}</span>
              )}
              <button onClick={onToggleFavorite} title={idea.isFavorite ? "Remover dos favoritos" : "Favoritar"}
                className={cn(
                  "p-1 rounded-lg transition-colors",
                  idea.isFavorite ? "text-amber-400 hover:text-amber-500" : "text-cockpit-muted hover:text-amber-400"
                )}>
                <Star size={14} fill={idea.isFavorite ? "currentColor" : "none"} />
              </button>
            </div>
          </div>
          {idea.summary && (
            <p className="text-xs text-cockpit-muted mt-1 line-clamp-2 leading-relaxed">{idea.summary}</p>
          )}

          {/* Meta row — chips compactos e informativos */}
          <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
            {idea.term && (
              <span className="text-[10px] px-2 py-0.5 rounded-md bg-cockpit-border-light text-cockpit-text font-medium">
                {idea.term}
              </span>
            )}
            {idea.evidenceId && (
              <span className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-500 font-medium" title="Ancorada em matéria real lida pelo pipeline">
                ✓ matéria real
              </span>
            )}
            {idea.publisherHosts && idea.publisherHosts.length > 1 && (
              <span className="text-[10px] px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-500 font-medium" title={idea.publisherHosts.join(", ")}>
                🔗 {idea.publisherHosts.length} fontes
              </span>
            )}
            {idea.hasInternationalCoverage && (
              <span className="text-[10px] px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-500 font-medium" title="Cobertura internacional detectada">
                🌍 global
              </span>
            )}
            {viralScore != null && viralScore >= 65 && (
              <span className="text-[10px] px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-500 font-medium" title={`Viral score ${viralScore}/100`}>
                🔥 viral {viralScore}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ─── EVIDÊNCIA: quote + link primário ─── */}
      {(idea.evidenceQuote || idea.sourceUrl) && (
        <div className="px-4 pb-3 pt-0 space-y-2">
          {idea.evidenceQuote && (
            <blockquote className="text-[11px] italic text-cockpit-text/80 pl-2.5 border-l-2 border-emerald-500/40 leading-relaxed">
              &ldquo;{idea.evidenceQuote}&rdquo;
            </blockquote>
          )}
          {idea.sourceUrl && (
            <a href={idea.sourceUrl} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[10px] text-cockpit-muted hover:text-accent group">
              <ExternalLink size={10} />
              <span className="group-hover:underline">{hostOf(idea.sourceUrl) || idea.source || "fonte"}</span>
              {idea.source && idea.source !== hostOf(idea.sourceUrl) && !["ai_research", "ai_generated", "cron"].includes(idea.source) && (
                <span className="opacity-60">· {idea.source}</span>
              )}
            </a>
          )}
        </div>
      )}

      {/* ─── HOOK (quando presente) ─── */}
      {idea.hook && (
        <div className="px-4 pb-3">
          <div className="text-[10px] uppercase tracking-wider text-cockpit-muted font-semibold mb-1">Hook sugerido</div>
          <p className="text-xs text-cockpit-text italic leading-relaxed">&ldquo;{idea.hook}&rdquo;</p>
        </div>
      )}

      {/* ─── PLATFORM FIT (quando presente) ─── */}
      {platformFit && (
        <div className="px-4 pb-3">
          <div className="text-[10px] uppercase tracking-wider text-cockpit-muted font-semibold mb-1.5">Encaixe por formato</div>
          <div className="grid grid-cols-4 gap-1.5">
            {(
              [
                { key: "reels", label: "Reels", icon: "🎞️" },
                { key: "shorts", label: "Shorts", icon: "⚡" },
                { key: "long", label: "Long", icon: "🎬" },
                { key: "tiktok", label: "TikTok", icon: "🎵" },
              ] as const
            ).map(({ key, label, icon }) => {
              const val = platformFit[key] ?? 0
              const tone = val >= 75 ? "bg-emerald-500" : val >= 50 ? "bg-accent" : val >= 30 ? "bg-amber-500" : "bg-zinc-600"
              return (
                <div key={key} className="flex flex-col gap-0.5">
                  <div className="flex items-center justify-between text-[9px] text-cockpit-muted">
                    <span>{icon} {label}</span>
                    <span className="font-mono font-semibold">{val}</span>
                  </div>
                  <div className="h-1 bg-cockpit-border-light rounded-full overflow-hidden">
                    <div className={cn("h-full rounded-full transition-all", tone)} style={{ width: `${val}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ─── FOOTER: progresso de fases OU actions ─── */}
      {isUsed && linkedContent ? (
        <div className="px-4 py-3 border-t border-cockpit-border bg-cockpit-bg/30 rounded-b-xl">
          {/* Mini-progresso das 5 fases */}
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] uppercase tracking-wider text-emerald-500 font-semibold flex items-center gap-1">
              ✓ Em produção
            </span>
            <span className="text-[10px] text-cockpit-muted">
              Fase: <span className="text-cockpit-text font-semibold">{PHASE_FULL[currentPhase ?? ""] ?? "—"}</span>
            </span>
          </div>
          <div className="flex items-center gap-0.5 mb-2.5">
            {PHASE_ORDER.map((phase, i) => {
              const reached = currentPhaseIdx >= i
              const isCurrent = currentPhaseIdx === i
              return (
                <div key={phase} className="flex-1 flex items-center gap-0.5">
                  <div
                    className={cn(
                      "flex-1 h-1 rounded-full transition-all",
                      reached ? "bg-accent" : "bg-cockpit-border",
                      isCurrent && "bg-accent shadow-[0_0_8px_rgba(255,176,0,0.5)]"
                    )}
                    title={PHASE_FULL[phase]}
                  />
                </div>
              )
            })}
          </div>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-0.5 text-[9px]">
              {PHASE_ORDER.map((phase, i) => (
                <span key={phase} className={cn(
                  "px-1 font-medium",
                  currentPhaseIdx === i ? "text-accent" : currentPhaseIdx > i ? "text-cockpit-muted" : "text-cockpit-muted/50"
                )}>
                  {PHASE_SHORT[phase]}
                </span>
              ))}
            </div>
            <button onClick={onOpen}
              className="text-[11px] font-semibold text-accent hover:text-accent-hover flex items-center gap-1">
              Continuar →
            </button>
          </div>
        </div>
      ) : !isUsed ? (
        <div className="px-4 py-3 border-t border-cockpit-border flex items-center justify-between gap-2">
          <button onClick={onDiscard} disabled={isPending}
            className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] text-cockpit-muted hover:text-red-400 hover:bg-red-500/5 rounded-lg transition-colors">
            <Trash2 size={11} /> Descartar
          </button>
          <button onClick={onUse} disabled={isPending}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-accent text-black text-[11px] font-semibold rounded-lg hover:bg-accent-hover disabled:opacity-50 transition-colors">
            {isPending ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />}
            Utilizar no funil
          </button>
        </div>
      ) : (
        // isUsed sem linkedContent = estado inconsistente (ideia marcada mas Content excluído)
        <div className="px-4 py-3 border-t border-cockpit-border">
          <span className="text-[10px] text-cockpit-muted italic">Marcada como usada (sem conteúdo vinculado)</span>
        </div>
      )}
    </div>
  )
}
