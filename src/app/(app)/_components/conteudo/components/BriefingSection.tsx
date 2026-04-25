import type { ReactNode } from "react"
import { ClipboardList } from "lucide-react"
import { CONTENT_SKILLS, type SkillId } from "@/config/content-skills"
import { ReferencesBlock, type ReferencesData } from "./ReferencesBlock"

interface Props {
  title: string
  hook: string
  notes: string
  script: string
  description: string
  research: string
  targetDuration: number
  skillId?: SkillId | null
  references: ReferencesData | null
  referencesLoading: boolean
  aiButton: ReactNode
  aiPanel: ReactNode
}

export function BriefingSection({
  title, hook, notes, script, description, research, targetDuration,
  skillId, references, referencesLoading, aiButton, aiPanel,
}: Props) {
  const skill = skillId ? CONTENT_SKILLS[skillId] : null

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <ClipboardList size={18} className="text-amber-500" />
          <div>
            <h2 className="text-sm font-bold text-cockpit-text">Briefing para Gravação</h2>
            <p className="text-[10px] text-cockpit-muted">Guia estruturado com frases de destaque por bloco</p>
          </div>
        </div>
        {aiButton}
      </div>

      {aiPanel}

      {/* Quick info bar */}
      <div className="flex flex-wrap gap-3 p-3 bg-cockpit-bg border border-cockpit-border rounded-xl">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-cockpit-muted">🎯</span>
          <span className="text-xs font-semibold text-cockpit-text">{title}</span>
        </div>
        {targetDuration > 0 && (
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-cockpit-muted">⏱️</span>
            <span className="text-xs font-bold text-accent">{targetDuration >= 60 ? `${Math.floor(targetDuration / 60)}min` : `${targetDuration}s`}</span>
          </div>
        )}
        {skill && <span className="text-[10px] text-cockpit-muted">{skill.icon} {skill.label}</span>}
      </div>

      {/* Hook */}
      {hook && (
        <div className="p-4 bg-amber-500/5 border border-amber-500/15 rounded-xl">
          <p className="text-[10px] text-amber-500 font-semibold uppercase tracking-wider mb-1">🎣 Hook — abra com isso</p>
          <p className="text-sm font-medium text-cockpit-text italic">&ldquo;{hook}&rdquo;</p>
        </div>
      )}

      {/* Briefing content (AI-generated or manual notes) */}
      {notes ? (
        <div className="p-4 bg-cockpit-bg border border-cockpit-border rounded-xl">
          <p className="text-[10px] text-cockpit-muted font-semibold uppercase tracking-wider mb-3">📋 Briefing estruturado</p>
          <div className="text-sm text-cockpit-text whitespace-pre-wrap leading-relaxed prose-sm max-w-none
            [&_strong]:text-accent [&_strong]:font-bold
            [&_h1]:text-base [&_h1]:font-bold [&_h1]:text-cockpit-text [&_h1]:mt-4 [&_h1]:mb-2
            [&_h2]:text-sm [&_h2]:font-bold [&_h2]:text-cockpit-text [&_h2]:mt-3 [&_h2]:mb-1.5
            [&_h3]:text-xs [&_h3]:font-bold [&_h3]:text-cockpit-text [&_h3]:mt-2 [&_h3]:mb-1">
            {notes}
          </div>
        </div>
      ) : (
        <div className="p-8 border-2 border-dashed border-cockpit-border rounded-xl text-center text-cockpit-muted">
          <ClipboardList size={24} strokeWidth={1} className="mx-auto mb-2" />
          <p className="text-xs">Clique &ldquo;Gerar briefing com IA&rdquo; para criar o guia estruturado</p>
          <p className="text-[10px] mt-1">Cada bloco terá uma frase de destaque que não pode faltar</p>
        </div>
      )}

      {/* Roteiro completo (colapsável) */}
      {script && (
        <details className="rounded-xl border border-cockpit-border overflow-hidden">
          <summary className="px-4 py-3 text-xs font-medium text-cockpit-muted cursor-pointer hover:bg-cockpit-surface-hover">📝 Roteiro completo (referência)</summary>
          <div className="px-4 py-3 border-t border-cockpit-border text-sm text-cockpit-text whitespace-pre-wrap font-mono text-[13px] max-h-64 overflow-y-auto">{script}</div>
        </details>
      )}

      {/* Descrição (colapsável) */}
      {description && (
        <details className="rounded-xl border border-cockpit-border overflow-hidden">
          <summary className="px-4 py-3 text-xs font-medium text-cockpit-muted cursor-pointer hover:bg-cockpit-surface-hover">📋 Descrição / Caption</summary>
          <div className="px-4 py-3 border-t border-cockpit-border text-xs text-cockpit-muted whitespace-pre-wrap max-h-32 overflow-y-auto">{description}</div>
        </details>
      )}

      {/* Fontes (clicáveis, do IdeaFeed → NewsEvidence) */}
      <ReferencesBlock data={references} loading={referencesLoading} />

      {/* Research livre do usuário (colapsável, só texto adicional que ele escreveu) */}
      {research && (
        <details className="rounded-xl border border-cockpit-border overflow-hidden">
          <summary className="px-4 py-3 text-xs font-medium text-cockpit-muted cursor-pointer hover:bg-cockpit-surface-hover">📝 Notas de pesquisa adicionais</summary>
          <div className="px-4 py-3 border-t border-cockpit-border text-xs text-cockpit-muted whitespace-pre-wrap max-h-48 overflow-y-auto">{research}</div>
        </details>
      )}
    </>
  )
}
