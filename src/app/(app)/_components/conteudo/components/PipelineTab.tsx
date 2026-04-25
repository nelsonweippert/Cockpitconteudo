import { useMemo, useState } from "react"
import { Search, SlidersHorizontal, LayoutGrid, List, Archive, Video, X } from "lucide-react"
import { cn, formatDate } from "@/lib/utils"
import { CONTENT_SKILLS, SKILL_LIST, type SkillId } from "@/config/content-skills"
import type { Area, ContentPhase } from "@/types"
import { PHASE_LABEL, PHASE_COLOR, SKILL_ICON, PIPELINE_PHASES } from "../constants"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Content = any

type ViewMode = "pipeline" | "list"

function toggle<T>(arr: T[], val: T): T[] {
  return arr.includes(val) ? arr.filter((v) => v !== val) : [...arr, val]
}

interface Props {
  contents: Content[]
  areas: Area[]
  countsSkill: Record<string, number>
  countsPhase: Record<string, number>
  onSelectContent: (c: Content) => void
  onArchive: (id: string) => void
}

export function PipelineTab({ contents, areas, countsSkill, countsPhase, onSelectContent, onArchive }: Props) {
  const [viewMode, setViewMode] = useState<ViewMode>("pipeline")
  const [search, setSearch] = useState("")
  const [skillFilters, setSkillFilters] = useState<SkillId[]>([])
  const [phaseFilters, setPhaseFilters] = useState<ContentPhase[]>([])
  const [areaFilters, setAreaFilters] = useState<string[]>([])
  const [showFilters, setShowFilters] = useState(false)

  const activeFilterCount = skillFilters.length + phaseFilters.length + areaFilters.length + (search ? 1 : 0)

  const filtered = useMemo(() => {
    let result = contents
    if (search) { const q = search.toLowerCase(); result = result.filter((c: Content) => c.title.toLowerCase().includes(q) || c.series?.toLowerCase().includes(q)) }
    if (skillFilters.length > 0) result = result.filter((c: Content) => c.skill && skillFilters.includes(c.skill))
    if (phaseFilters.length > 0) result = result.filter((c: Content) => phaseFilters.includes(c.phase))
    if (areaFilters.length > 0) result = result.filter((c: Content) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cAreas = c.areas?.map((a: any) => a.area?.id ?? a.areaId).filter(Boolean) ?? (c.areaId ? [c.areaId] : [])
      return cAreas.some((id: string) => areaFilters.includes(id))
    })
    return result
  }, [contents, search, skillFilters, phaseFilters, areaFilters])

  function clearFilters() { setSearch(""); setSkillFilters([]); setPhaseFilters([]); setAreaFilters([]) }

  function renderCard(c: Content) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cAreas = c.areas?.map((a: any) => a.area).filter(Boolean) ?? (c.area ? [c.area] : [])
    return (
      <div key={c.id} onClick={() => onSelectContent(c)}
        className="cockpit-card !p-0 cursor-pointer hover:border-accent/30 transition-colors group">
        <div className="flex items-start gap-3 px-4 py-3">
          {c.skill && <span className="text-lg mt-0.5">{SKILL_ICON[c.skill] || "📝"}</span>}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-cockpit-text truncate group-hover:text-accent transition-colors">{c.title}</p>
            <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
              <span className={cn("text-[10px] font-medium px-2 py-0.5 rounded-full border", PHASE_COLOR[c.phase] || "")}>{PHASE_LABEL[c.phase] || c.phase}</span>
              {c.plannedDate && <span className="text-[10px] text-cockpit-muted">{formatDate(c.plannedDate)}</span>}
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {cAreas.slice(0, 2).map((a: any) => (
                <span key={a.id} className="text-[10px] px-1.5 py-0.5 rounded-full text-white" style={{ backgroundColor: a.color }}>{a.icon}</span>
              ))}
            </div>
          </div>
          <button onClick={(e) => { e.stopPropagation(); onArchive(c.id) }}
            className="opacity-0 group-hover:opacity-100 p-1.5 text-cockpit-muted hover:text-amber-500 rounded-lg hover:bg-amber-500/10 transition-all">
            <Archive size={14} />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="flex-1 relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-cockpit-muted" />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar conteúdo..."
              className="w-full pl-9 pr-3 py-2.5 bg-cockpit-bg border border-cockpit-border rounded-xl text-sm text-cockpit-text placeholder:text-cockpit-muted focus:outline-none focus:ring-2 focus:ring-accent/30" />
          </div>
          <button onClick={() => setShowFilters((f) => !f)} className={cn(
            "flex items-center gap-1.5 px-3 py-2.5 border rounded-xl text-sm transition-colors",
            showFilters || activeFilterCount > 0 ? "bg-accent/10 border-accent/30 text-accent" : "bg-cockpit-bg border-cockpit-border text-cockpit-muted hover:text-cockpit-text"
          )}>
            <SlidersHorizontal size={15} /> Filtros{activeFilterCount > 0 && <span className="ml-0.5 px-1.5 py-0.5 bg-accent text-black text-[10px] font-bold rounded-full">{activeFilterCount}</span>}
          </button>
          <div className="flex bg-cockpit-border-light rounded-xl p-0.5">
            <button onClick={() => setViewMode("pipeline")} className={cn("p-2 rounded-lg transition-colors", viewMode === "pipeline" ? "bg-cockpit-surface text-cockpit-text shadow-sm" : "text-cockpit-muted")}><LayoutGrid size={15} /></button>
            <button onClick={() => setViewMode("list")} className={cn("p-2 rounded-lg transition-colors", viewMode === "list" ? "bg-cockpit-surface text-cockpit-text shadow-sm" : "text-cockpit-muted")}><List size={15} /></button>
          </div>
        </div>
        {showFilters && (
          <div className="cockpit-card space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-cockpit-text uppercase tracking-wider">Filtros avançados</h3>
              {activeFilterCount > 0 && <button onClick={clearFilters} className="text-xs text-cockpit-muted hover:text-red-400">Limpar</button>}
            </div>
            <div>
              <p className="text-[11px] text-cockpit-muted font-medium mb-2">Skill</p>
              <div className="flex flex-wrap gap-1.5">{SKILL_LIST.map((s) => (
                <button key={s.id} onClick={() => setSkillFilters((f) => toggle(f, s.id))} className={cn("flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all", skillFilters.includes(s.id) ? "border-accent/40 bg-accent/10 text-accent" : "border-cockpit-border text-cockpit-muted hover:border-cockpit-text/30")}>{s.icon} {s.label} <span className="text-[10px] opacity-60">{countsSkill[s.id] || 0}</span></button>
              ))}</div>
            </div>
            <div>
              <p className="text-[11px] text-cockpit-muted font-medium mb-2">Fase</p>
              <div className="flex flex-wrap gap-1.5">{PIPELINE_PHASES.map((p) => (
                <button key={p} onClick={() => setPhaseFilters((f) => toggle(f, p))} className={cn("px-3 py-1.5 rounded-lg text-xs font-medium border transition-all", phaseFilters.includes(p) ? PHASE_COLOR[p] + " border-current" : "border-cockpit-border text-cockpit-muted hover:border-cockpit-text/30")}>{PHASE_LABEL[p]} <span className="text-[10px] opacity-60">{countsPhase[p] || 0}</span></button>
              ))}</div>
            </div>
            {areas.length > 0 && (
              <div>
                <p className="text-[11px] text-cockpit-muted font-medium mb-2">Áreas</p>
                <div className="flex flex-wrap gap-1.5">{areas.map((a) => (
                  <button key={a.id} onClick={() => setAreaFilters((f) => toggle(f, a.id))} className={cn("flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all", areaFilters.includes(a.id) ? "border-transparent text-white" : "border-cockpit-border text-cockpit-muted hover:border-cockpit-text/30")} style={areaFilters.includes(a.id) ? { backgroundColor: a.color } : undefined}>{a.icon} {a.name}</button>
                ))}</div>
              </div>
            )}
          </div>
        )}
        {activeFilterCount > 0 && !showFilters && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] text-cockpit-muted mr-1">Filtros:</span>
            {skillFilters.map((s) => <span key={s} className="flex items-center gap-1 px-2 py-1 bg-cockpit-surface border border-cockpit-border rounded-lg text-[11px] text-cockpit-text">{SKILL_ICON[s]} {CONTENT_SKILLS[s].label} <button onClick={() => setSkillFilters((f) => f.filter((v) => v !== s))} className="text-cockpit-muted hover:text-red-400"><X size={10} /></button></span>)}
            {phaseFilters.map((p) => <span key={p} className={cn("flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] border", PHASE_COLOR[p])}>{PHASE_LABEL[p]} <button onClick={() => setPhaseFilters((f) => f.filter((v) => v !== p))} className="opacity-60 hover:opacity-100"><X size={10} /></button></span>)}
            {areaFilters.map((id) => { const a = areas.find((x) => x.id === id); if (!a) return null; return <span key={id} className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] text-white" style={{ backgroundColor: a.color }}>{a.icon} {a.name} <button onClick={() => setAreaFilters((f) => f.filter((v) => v !== id))} className="opacity-70 hover:opacity-100"><X size={10} /></button></span> })}
          </div>
        )}
      </div>

      <p className="text-xs text-cockpit-muted">{filtered.length} conteúdo{filtered.length !== 1 ? "s" : ""}</p>

      {viewMode === "pipeline" ? (
        <div className="overflow-x-auto pb-4">
          <div className="flex gap-3 min-w-max">
            {PIPELINE_PHASES.map((phase) => {
              const items = filtered.filter((c: Content) => c.phase === phase)
              return (
                <div key={phase} className="w-64 flex-shrink-0">
                  <div className="flex items-center justify-between mb-3 px-2">
                    <div className="flex items-center gap-2">
                      <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full border", PHASE_COLOR[phase])}>{PHASE_LABEL[phase]}</span>
                      <span className="text-[10px] text-cockpit-muted">{items.length}</span>
                    </div>
                  </div>
                  <div className="space-y-2 min-h-[100px]">
                    {items.length === 0 ? (
                      <div className="h-20 border-2 border-dashed border-cockpit-border rounded-xl flex items-center justify-center"><p className="text-[10px] text-cockpit-muted">Vazio</p></div>
                    ) : items.map((c: Content) => renderCard(c))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.length === 0 ? (
            <div className="cockpit-card flex flex-col items-center justify-center py-16 text-cockpit-muted">
              <Video size={32} strokeWidth={1} /><p className="text-sm mt-3">{activeFilterCount > 0 ? "Nenhum conteúdo com esses filtros" : "Nenhum conteúdo"}</p>
              {activeFilterCount > 0 && <button onClick={clearFilters} className="text-xs text-accent mt-2 hover:underline">Limpar filtros</button>}
            </div>
          ) : filtered.map((c: Content) => renderCard(c))}
        </div>
      )}
    </div>
  )
}
