import { Lightbulb, CheckCircle, Video } from "lucide-react"
import { cn, formatDate } from "@/lib/utils"
import { SKILL_LIST } from "@/config/content-skills"
import { PHASE_LABEL, PHASE_COLOR, SKILL_ICON, PIPELINE_PHASES } from "../constants"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Content = any

interface Counts {
  total: number
  ideas: number
  elaboration: number
  editingSent: number
  published: number
  phase: Record<string, number>
  skill: Record<string, number>
}

interface Props {
  counts: Counts
  recentPublished: Content[]
  onSelectContent: (c: Content) => void
  onCreateClick: () => void
}

export function OverviewTab({ counts, recentPublished, onSelectContent, onCreateClick }: Props) {
  return (
    <div className="space-y-5">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        <div className="cockpit-card !py-3">
          <p className="text-[11px] text-cockpit-muted font-medium uppercase tracking-wider flex items-center gap-1"><Lightbulb size={10} /> Idealização</p>
          <p className="text-2xl font-bold text-violet-400 mt-1">{counts.ideas}</p>
        </div>
        <div className="cockpit-card !py-3">
          <p className="text-[11px] text-cockpit-muted font-medium uppercase tracking-wider">Elaboração</p>
          <p className="text-2xl font-bold text-amber-400 mt-1">{counts.elaboration}</p>
        </div>
        <div className="cockpit-card !py-3">
          <p className="text-[11px] text-cockpit-muted font-medium uppercase tracking-wider">Em edição</p>
          <p className="text-2xl font-bold text-pink-400 mt-1">{counts.editingSent}</p>
        </div>
        <div className="cockpit-card !py-3">
          <p className="text-[11px] text-cockpit-muted font-medium uppercase tracking-wider flex items-center gap-1"><CheckCircle size={10} /> Publicados</p>
          <p className="text-2xl font-bold text-accent mt-1">{counts.published}</p>
        </div>
        {SKILL_LIST.map((s) => (
          <div key={s.id} className="cockpit-card !py-3">
            <p className="text-[11px] text-cockpit-muted font-medium uppercase tracking-wider">{s.icon} {s.label}</p>
            <p className="text-2xl font-bold text-cockpit-text mt-1">{counts.skill[s.id] || 0}</p>
          </div>
        ))}
      </div>

      {/* Pipeline distribution */}
      {counts.total > 0 && (
        <div className="cockpit-card">
          <h3 className="text-xs font-semibold text-cockpit-text uppercase tracking-wider mb-4">Distribuição por fase</h3>
          <div className="space-y-2.5">
            {PIPELINE_PHASES.map((p) => {
              const count = counts.phase[p] || 0
              const pct = counts.total > 0 ? (count / counts.total) * 100 : 0
              if (count === 0) return null
              return (
                <div key={p}>
                  <div className="flex items-center justify-between mb-1">
                    <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full border", PHASE_COLOR[p])}>{PHASE_LABEL[p]}</span>
                    <span className="text-xs text-cockpit-muted">{count} ({pct.toFixed(0)}%)</span>
                  </div>
                  <div className="w-full h-2 bg-cockpit-border-light rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all opacity-60" style={{ width: `${pct}%`, backgroundColor: `var(--phase-${p.toLowerCase()}, #666)` }}>
                      <div className={cn("h-full rounded-full", PHASE_COLOR[p].split(" ")[0])} />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Recent published */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {recentPublished.length > 0 && (
          <div className="cockpit-card !p-0 overflow-hidden">
            <div className="px-4 py-3 border-b border-cockpit-border">
              <h3 className="text-xs font-semibold text-cockpit-text uppercase tracking-wider flex items-center gap-1.5"><CheckCircle size={12} className="text-accent" /> Publicados recentemente</h3>
            </div>
            <div className="divide-y divide-cockpit-border">{recentPublished.map((c: Content) => (
              <div key={c.id} onClick={() => onSelectContent(c)} className="flex items-center gap-3 px-4 py-3 hover:bg-cockpit-surface-hover cursor-pointer transition-colors">
                <div className="w-1 self-stretch rounded-full bg-accent flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-cockpit-text truncate">{c.title}</p>
                  <p className="text-[10px] text-cockpit-muted mt-0.5">{c.skill ? SKILL_ICON[c.skill] + " " : ""}{c.publishedAt ? formatDate(c.publishedAt) : ""}</p>
                </div>
              </div>
            ))}</div>
          </div>
        )}
      </div>

      {/* Empty state */}
      {counts.total === 0 && (
        <div className="cockpit-card flex flex-col items-center justify-center py-16 text-cockpit-muted">
          <Video size={32} strokeWidth={1} />
          <p className="text-sm mt-3">Nenhum conteúdo ainda</p>
          <button onClick={onCreateClick} className="mt-3 text-xs text-accent hover:underline font-medium">+ Criar primeiro conteúdo</button>
        </div>
      )}
    </div>
  )
}
