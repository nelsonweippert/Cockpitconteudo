import { useState, useTransition } from "react"
import { X, Plus, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { CONTENT_SKILLS, SKILL_LIST, type SkillId } from "@/config/content-skills"
import type { Area, Platform, ContentFormat } from "@/types"
import { DatePicker } from "@/components/ui/DatePicker"
import { createContentAction } from "@/app/actions/content.actions"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Content = any

interface Props {
  areas: Area[]
  onClose: () => void
  onCreated: (content: Content) => void
}

export function CreationModal({ areas, onClose, onCreated }: Props) {
  const [isPending, startTransition] = useTransition()
  const [step, setStep] = useState<"skill" | "details">("skill")
  const [selectedSkill, setSelectedSkill] = useState<SkillId | null>(null)
  const [title, setTitle] = useState("")
  const [plannedDate, setPlannedDate] = useState("")
  const [areaIds, setAreaIds] = useState<string[]>([])
  const [platform, setPlatform] = useState<Platform>("YOUTUBE")
  const [format, setFormat] = useState<ContentFormat>("LONG_VIDEO")

  function selectSkill(skill: SkillId) {
    setSelectedSkill(skill)
    if (skill === "SHORT_VIDEO") { setPlatform("TIKTOK"); setFormat("SHORT") }
    else if (skill === "LONG_VIDEO") { setPlatform("YOUTUBE"); setFormat("LONG_VIDEO") }
    else if (skill === "INSTAGRAM") { setPlatform("INSTAGRAM"); setFormat("POST") }
    setStep("details")
  }

  function handleCreate() {
    if (!title.trim()) return
    startTransition(async () => {
      const result = await createContentAction({
        title, platform, format,
        skill: selectedSkill,
        plannedDate: plannedDate ? new Date(plannedDate) : null,
        areaIds,
      })
      if (result.success) {
        onCreated(result.data as Content)
        onClose()
      }
    })
  }

  return (
    <div className="cockpit-card space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-cockpit-text">{step === "skill" ? "Escolha o tipo de conteúdo" : `Novo ${CONTENT_SKILLS[selectedSkill!].label}`}</h2>
        <button onClick={onClose} className="p-1 text-cockpit-muted hover:text-cockpit-text rounded-lg"><X size={16} /></button>
      </div>
      {step === "skill" && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {SKILL_LIST.map((s) => (
            <button key={s.id} onClick={() => selectSkill(s.id)} className="cockpit-card !p-4 text-left hover:border-accent/40 transition-colors group">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-2xl">{s.icon}</span>
                <div><p className="text-sm font-semibold text-cockpit-text group-hover:text-accent">{s.label}</p><p className="text-[10px] text-cockpit-muted">{s.description}</p></div>
              </div>
              <div className="flex flex-wrap gap-1 mt-2">{s.phases.slice(0, 5).map((p) => (<span key={p.id} className="text-[9px] px-1.5 py-0.5 bg-cockpit-border-light rounded text-cockpit-muted">{p.label}</span>))}{s.phases.length > 5 && <span className="text-[9px] text-cockpit-muted">+{s.phases.length - 5}</span>}</div>
            </button>
          ))}
        </div>
      )}
      {step === "details" && selectedSkill && (
        <div className="space-y-4">
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ideia do conteúdo *  (ex: Como ganhar dinheiro com IA em 2026)" className="w-full px-3 py-2.5 bg-cockpit-bg border border-cockpit-border rounded-xl text-sm text-cockpit-text placeholder:text-cockpit-muted focus:outline-none focus:ring-2 focus:ring-accent/30" autoFocus />
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-xs text-cockpit-muted mb-1.5">Data planejada</label><DatePicker value={plannedDate} onChange={setPlannedDate} /></div>
            <div><label className="block text-xs text-cockpit-muted mb-1.5">Plataforma</label><select value={platform} onChange={(e) => setPlatform(e.target.value as Platform)} className="w-full px-3 py-2 bg-cockpit-bg border border-cockpit-border rounded-xl text-sm text-cockpit-text focus:outline-none focus:ring-2 focus:ring-accent/30"><option value="YOUTUBE">YouTube</option><option value="INSTAGRAM">Instagram</option><option value="TIKTOK">TikTok</option><option value="TWITCH">Twitch</option><option value="OTHER">Outro</option></select></div>
          </div>
          {areas.length > 0 && (
            <div><label className="block text-xs text-cockpit-muted mb-1.5">Áreas</label><div className="flex flex-wrap gap-1.5">{areas.map((a) => (<button key={a.id} type="button" onClick={() => setAreaIds((prev) => prev.includes(a.id) ? prev.filter((id) => id !== a.id) : [...prev, a.id])} className={cn("flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all", areaIds.includes(a.id) ? "border-transparent text-white" : "border-cockpit-border text-cockpit-muted")} style={areaIds.includes(a.id) ? { backgroundColor: a.color } : {}}>{a.icon} {a.name}</button>))}</div></div>
          )}
          {CONTENT_SKILLS[selectedSkill].phases[0]?.tips && (
            <div className="p-3 bg-amber-500/5 border border-amber-500/10 rounded-xl">
              <p className="text-[10px] font-semibold text-amber-500 uppercase tracking-wider mb-1.5">💡 Dicas para ideação</p>
              <ul className="space-y-1">{CONTENT_SKILLS[selectedSkill].phases[0].tips.slice(0, 3).map((tip, i) => (<li key={i} className="text-[11px] text-cockpit-text">{tip}</li>))}</ul>
            </div>
          )}
          <div className="flex justify-end gap-2">
            <button onClick={() => setStep("skill")} className="px-4 py-2 text-sm text-cockpit-muted hover:text-cockpit-text border border-cockpit-border rounded-xl">Voltar</button>
            <button onClick={handleCreate} disabled={!title.trim() || isPending} className="flex items-center gap-2 px-4 py-2 bg-accent text-black text-sm font-semibold rounded-xl hover:bg-accent-hover disabled:opacity-50">
              {isPending ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Criar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
