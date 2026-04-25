import { useState, useTransition } from "react"
import {
  Plus, Loader2, Sparkles, Lightbulb, ChevronDown, ChevronUp,
  ExternalLink, Link, Trash2, Send, FileText,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { ALL_SKILLS, type SkillId } from "@/config/content-skills"
import { getSkillSourcesAction, addSkillSourceAction, deleteSkillSourceAction } from "@/app/actions/skill.actions"
import { PHASE_COLOR } from "../constants"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SkillSource = any

interface Props {
  countsSkill: Record<string, number>
}

export function SkillsTab({ countsSkill }: Props) {
  const [isPending, startTransition] = useTransition()
  const [expandedSkill, setExpandedSkill] = useState<SkillId | null>(null)
  const [userSources, setUserSources] = useState<Record<string, SkillSource[]>>({})
  const [loadingSources, setLoadingSources] = useState<string | null>(null)
  const [addSourceSkill, setAddSourceSkill] = useState<SkillId | null>(null)
  const [srcTitle, setSrcTitle] = useState("")
  const [srcUrl, setSrcUrl] = useState("")
  const [srcContent, setSrcContent] = useState("")
  const [srcType, setSrcType] = useState<"insight" | "link" | "note">("insight")

  async function loadUserSources(skillId: SkillId) {
    setLoadingSources(skillId)
    const result = await getSkillSourcesAction(skillId)
    if (result.success) setUserSources((prev) => ({ ...prev, [skillId]: result.data as SkillSource[] }))
    setLoadingSources(null)
  }

  function toggleSkillExpand(skillId: SkillId) {
    if (expandedSkill === skillId) { setExpandedSkill(null); return }
    setExpandedSkill(skillId)
    if (!userSources[skillId]) loadUserSources(skillId)
  }

  async function handleAddSource() {
    if (!addSourceSkill || !srcTitle.trim()) return
    startTransition(async () => {
      const result = await addSkillSourceAction({
        skillId: addSourceSkill, title: srcTitle, url: srcUrl || undefined,
        content: srcContent || undefined, type: srcType,
      })
      if (result.success) {
        setUserSources((prev) => ({ ...prev, [addSourceSkill]: [result.data as SkillSource, ...(prev[addSourceSkill] ?? [])] }))
        setSrcTitle(""); setSrcUrl(""); setSrcContent(""); setAddSourceSkill(null)
      }
    })
  }

  async function handleDeleteSource(id: string, skillId: string) {
    startTransition(async () => {
      const result = await deleteSkillSourceAction(id)
      if (result.success) setUserSources((prev) => ({ ...prev, [skillId]: (prev[skillId] ?? []).filter((s: SkillSource) => s.id !== id) }))
    })
  }

  return (
    <div className="space-y-6">
      {ALL_SKILLS.map((skill) => {
        const isExpanded = expandedSkill === skill.id
        const uSources = userSources[skill.id] ?? []
        return (
          <div key={skill.id} className="cockpit-card">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-2xl">{skill.icon}</span>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-cockpit-text">{skill.label}</h3>
                <p className="text-[11px] text-cockpit-muted">{skill.description}</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-[10px] text-cockpit-muted">Atualizado: {skill.lastUpdated}</span>
                <span className="text-xs text-cockpit-muted bg-cockpit-border-light px-2.5 py-1 rounded-full">{countsSkill[skill.id] || 0} conteúdos</span>
                <button onClick={() => toggleSkillExpand(skill.id)} className="p-1.5 text-cockpit-muted hover:text-cockpit-text rounded-lg hover:bg-cockpit-surface-hover">
                  {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>
              </div>
            </div>

            <div className="mb-4">
              <p className="text-[10px] text-cockpit-muted font-medium uppercase tracking-wider mb-2">Fases do fluxo</p>
              <div className="flex flex-wrap gap-1">{skill.phases.map((p, i) => (
                <span key={p.id} className="flex items-center gap-1 text-[10px] text-cockpit-muted">
                  {i > 0 && <span className="text-cockpit-border">→</span>}
                  <span className={cn("px-2 py-0.5 rounded-full border", PHASE_COLOR[p.id] || "border-cockpit-border")}>{p.label}</span>
                </span>
              ))}</div>
            </div>

            <div className="mb-4">
              <p className="text-[10px] text-cockpit-muted font-medium uppercase tracking-wider mb-2">KPIs alvo</p>
              <div className="flex flex-wrap gap-2">{skill.kpis.map((kpi) => (
                <div key={kpi.label} className="px-3 py-2 bg-cockpit-bg border border-cockpit-border rounded-xl" title={kpi.why}>
                  <p className="text-[10px] text-cockpit-muted">{kpi.label}</p>
                  <p className="text-sm font-bold text-accent">{kpi.target}</p>
                </div>
              ))}</div>
            </div>

            {isExpanded && (
              <div className="space-y-4 mt-4 pt-4 border-t border-cockpit-border">
                <div>
                  <p className="text-[10px] text-cockpit-muted font-medium uppercase tracking-wider mb-2">Boas práticas ({skill.bestPractices.length})</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">{skill.bestPractices.map((tip, i) => (
                    <div key={i} className="flex items-start gap-1.5 text-[11px] text-cockpit-text"><span className="text-accent mt-0.5 flex-shrink-0">✓</span><span>{tip}</span></div>
                  ))}</div>
                </div>

                <div>
                  <p className="text-[10px] text-cockpit-muted font-medium uppercase tracking-wider mb-2">Erros comuns ({skill.commonMistakes.length})</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">{skill.commonMistakes.map((m, i) => (
                    <div key={i} className="flex items-start gap-1.5 text-[11px] text-cockpit-text"><span className="text-red-400 mt-0.5 flex-shrink-0">✗</span><span>{m}</span></div>
                  ))}</div>
                </div>

                {skill.scriptTemplates.length > 0 && (
                  <div>
                    <p className="text-[10px] text-cockpit-muted font-medium uppercase tracking-wider mb-2">Templates de roteiro</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">{skill.scriptTemplates.map((tmpl) => (
                      <div key={tmpl.name} className="p-3 bg-cockpit-bg border border-cockpit-border rounded-xl">
                        <p className="text-xs font-medium text-cockpit-text mb-1">{tmpl.name}</p>
                        <div className="space-y-0.5">{tmpl.structure.map((step, i) => (<p key={i} className="text-[10px] text-cockpit-muted">{step}</p>))}</div>
                      </div>
                    ))}</div>
                  </div>
                )}

                <div>
                  <p className="text-[10px] text-cockpit-muted font-medium uppercase tracking-wider mb-2 flex items-center gap-1"><Link size={11} /> Fontes da base de conhecimento ({skill.sources.length})</p>
                  <div className="space-y-1.5">{skill.sources.map((src, i) => (
                    <a key={i} href={src.url} target="_blank" rel="noopener noreferrer" className="flex items-start gap-2 p-2.5 bg-cockpit-bg border border-cockpit-border rounded-xl hover:border-accent/30 transition-colors group">
                      <ExternalLink size={12} className="text-cockpit-muted mt-0.5 flex-shrink-0 group-hover:text-accent" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-cockpit-text group-hover:text-accent truncate">{src.title}</p>
                        <p className="text-[10px] text-cockpit-muted mt-0.5">{src.description}</p>
                      </div>
                    </a>
                  ))}</div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[10px] text-cockpit-muted font-medium uppercase tracking-wider flex items-center gap-1"><Sparkles size={11} /> Suas contribuições {uSources.length > 0 && `(${uSources.length})`}</p>
                    <button onClick={() => setAddSourceSkill(addSourceSkill === skill.id ? null : skill.id)}
                      className="flex items-center gap-1 text-[11px] text-accent hover:underline">
                      <Plus size={11} /> Adicionar
                    </button>
                  </div>

                  {loadingSources === skill.id && <div className="flex justify-center py-4"><Loader2 size={16} className="animate-spin text-cockpit-muted" /></div>}

                  {uSources.length > 0 && (
                    <div className="space-y-1.5 mb-3">{uSources.map((src: SkillSource) => (
                      <div key={src.id} className="flex items-start gap-2 p-2.5 bg-accent/5 border border-accent/15 rounded-xl group">
                        <div className="flex-shrink-0 mt-0.5">
                          {src.type === "link" ? <Link size={12} className="text-accent" /> : src.type === "note" ? <FileText size={12} className="text-amber-500" /> : <Lightbulb size={12} className="text-violet-500" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-cockpit-text">{src.title}</p>
                          {src.url && <a href={src.url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-accent hover:underline truncate block">{src.url}</a>}
                          {src.content && <p className="text-[10px] text-cockpit-muted mt-0.5 line-clamp-3">{src.content}</p>}
                          <p className="text-[9px] text-cockpit-muted mt-1">{new Date(src.createdAt).toLocaleDateString("pt-BR")}</p>
                        </div>
                        <button onClick={() => handleDeleteSource(src.id, skill.id)} className="opacity-0 group-hover:opacity-100 p-1 text-cockpit-muted hover:text-red-400 transition-all"><Trash2 size={12} /></button>
                      </div>
                    ))}</div>
                  )}

                  {uSources.length === 0 && !loadingSources && (
                    <p className="text-[11px] text-cockpit-muted py-2">Nenhuma contribuição ainda. Adicione insights, links ou notas para aprimorar esta skill.</p>
                  )}

                  {addSourceSkill === skill.id && (
                    <div className="mt-3 p-3 bg-cockpit-bg border border-cockpit-border rounded-xl space-y-3">
                      <div className="flex gap-1.5">
                        {(["insight", "link", "note"] as const).map((t) => (
                          <button key={t} onClick={() => setSrcType(t)} className={cn(
                            "px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-all",
                            srcType === t ? "border-accent/40 bg-accent/10 text-accent" : "border-cockpit-border text-cockpit-muted"
                          )}>
                            {t === "insight" ? "💡 Insight" : t === "link" ? "🔗 Link" : "📝 Nota"}
                          </button>
                        ))}
                      </div>
                      <input type="text" value={srcTitle} onChange={(e) => setSrcTitle(e.target.value)}
                        placeholder={srcType === "link" ? "Título do link" : srcType === "insight" ? "Resumo do insight" : "Título da nota"}
                        className="w-full px-3 py-2 bg-cockpit-surface border border-cockpit-border rounded-xl text-sm text-cockpit-text placeholder:text-cockpit-muted focus:outline-none focus:ring-1 focus:ring-accent/30" />
                      {srcType === "link" && (
                        <input type="url" value={srcUrl} onChange={(e) => setSrcUrl(e.target.value)}
                          placeholder="https://..."
                          className="w-full px-3 py-2 bg-cockpit-surface border border-cockpit-border rounded-xl text-sm text-cockpit-text placeholder:text-cockpit-muted focus:outline-none focus:ring-1 focus:ring-accent/30" />
                      )}
                      <textarea value={srcContent} onChange={(e) => setSrcContent(e.target.value)}
                        placeholder={srcType === "insight" ? "Descreva o insight que descobriu..." : srcType === "link" ? "O que aprendeu com esse link? (opcional)" : "Conteúdo da nota..."}
                        rows={3} className="w-full px-3 py-2 bg-cockpit-surface border border-cockpit-border rounded-xl text-sm text-cockpit-text placeholder:text-cockpit-muted focus:outline-none focus:ring-1 focus:ring-accent/30 resize-none" />
                      <div className="flex justify-end gap-2">
                        <button onClick={() => setAddSourceSkill(null)} className="px-3 py-1.5 text-xs text-cockpit-muted hover:text-cockpit-text">Cancelar</button>
                        <button onClick={handleAddSource} disabled={!srcTitle.trim() || isPending}
                          className="flex items-center gap-1 px-3 py-1.5 bg-accent text-black text-xs font-semibold rounded-lg hover:bg-accent-hover disabled:opacity-50">
                          {isPending ? <Loader2 size={11} className="animate-spin" /> : <Send size={11} />} Adicionar
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {!isExpanded && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {skill.bestPractices.slice(0, 4).map((tip, i) => (
                  <div key={i} className="flex items-start gap-1.5 text-[11px] text-cockpit-text"><span className="text-accent mt-0.5 flex-shrink-0">✓</span><span>{tip}</span></div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
