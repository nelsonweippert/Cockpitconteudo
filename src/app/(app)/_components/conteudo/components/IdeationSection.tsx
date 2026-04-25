import { cn } from "@/lib/utils"
import { SKILL_LIST, type SkillId } from "@/config/content-skills"

const PT_BR_DOMAINS = [".com.br", ".br/", "tecmundo", "olhardigital", "canaltech", "infomoney", "g1.globo", "uol.com", "exame.com", "livecoins", "moneytimes", "seudinheiro", "tecnoblog", "meiobit", "tabnews"]

function extractLinks(text: string): { ptBr: { url: string; host: string }[]; en: { url: string; host: string }[] } {
  const urlRegex = /https?:\/\/[^\s)]+/g
  const urls = text.match(urlRegex) ?? []
  const ptBr: { url: string; host: string }[] = []
  const en: { url: string; host: string }[] = []
  for (const url of urls) {
    let host = url
    try { host = new URL(url).hostname.replace("www.", "") } catch {}
    const isPtBr = PT_BR_DOMAINS.some((d) => url.toLowerCase().includes(d))
    if (isPtBr) ptBr.push({ url, host })
    else en.push({ url, host })
  }
  return { ptBr, en }
}

function renderTextOnly(text: string) {
  return text.replace(/https?:\/\/[^\s)]+/g, "").replace(/\n🔗 Fontes:[\s\S]*$/, "").trim()
}

interface Props {
  research: string
  currentSkill: SkillId | null
  onSelectSkill: (skill: SkillId, platform: string, format: string) => void
}

const PLATFORM_MAP: Record<string, string> = { INSTAGRAM_REELS: "INSTAGRAM", YOUTUBE_SHORTS: "YOUTUBE", YOUTUBE_VIDEO: "YOUTUBE", TIKTOK_VIDEO: "TIKTOK" }
const FORMAT_MAP: Record<string, string> = { INSTAGRAM_REELS: "REELS", YOUTUBE_SHORTS: "SHORT", YOUTUBE_VIDEO: "LONG_VIDEO", TIKTOK_VIDEO: "SHORT" }

export function IdeationSection({ research, currentSkill, onSelectSkill }: Props) {
  const textOnly = research ? renderTextOnly(research) : ""
  const { ptBr, en } = research ? extractLinks(research) : { ptBr: [], en: [] }
  const hasLinks = ptBr.length > 0 || en.length > 0

  return (
    <>
      <div>
        <p className="text-xs font-medium text-cockpit-muted mb-3">Selecione o tipo de conteúdo</p>
        <div className="grid grid-cols-2 gap-2">
          {SKILL_LIST.map((s) => (
            <button key={s.id} onClick={() => onSelectSkill(s.id, PLATFORM_MAP[s.id] || "YOUTUBE", FORMAT_MAP[s.id] || "SHORT")}
              className={cn("flex items-center gap-3 p-3 rounded-xl border transition-all text-left",
                currentSkill === s.id ? "border-accent bg-accent/10" : "border-cockpit-border hover:border-accent/30")}>
              <span className="text-2xl">{s.icon}</span>
              <div>
                <p className={cn("text-xs font-semibold", currentSkill === s.id ? "text-accent" : "text-cockpit-text")}>{s.label}</p>
                <p className="text-[10px] text-cockpit-muted leading-tight">{s.description}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {research && (
        <div className="space-y-3">
          <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 overflow-hidden">
            <div className="px-4 py-2.5 border-b border-blue-500/15">
              <p className="text-xs font-semibold text-blue-400 flex items-center gap-1.5">📰 Por que esta ideia foi escolhida</p>
            </div>
            <div className="px-4 py-3 text-sm text-cockpit-text whitespace-pre-wrap leading-relaxed">{textOnly}</div>
          </div>

          {hasLinks && (
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 overflow-hidden">
                <div className="px-3 py-2 border-b border-emerald-500/15">
                  <p className="text-[11px] font-semibold text-emerald-400">🇧🇷 Fontes em Português</p>
                </div>
                <div className="px-3 py-2 space-y-1.5">
                  {ptBr.length > 0 ? ptBr.map((link, i) => (
                    <a key={i} href={link.url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-2.5 py-1.5 bg-cockpit-bg border border-cockpit-border rounded-lg text-xs text-cockpit-text hover:border-emerald-500/40 hover:text-emerald-400 transition-colors truncate">
                      🔗 {link.host}
                    </a>
                  )) : (
                    <p className="text-[10px] text-cockpit-muted py-1">Nenhuma fonte PT-BR encontrada</p>
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 overflow-hidden">
                <div className="px-3 py-2 border-b border-blue-500/15">
                  <p className="text-[11px] font-semibold text-blue-400">🇺🇸 Fontes em Inglês</p>
                </div>
                <div className="px-3 py-2 space-y-1.5">
                  {en.length > 0 ? en.map((link, i) => (
                    <a key={i} href={link.url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-2.5 py-1.5 bg-cockpit-bg border border-cockpit-border rounded-lg text-xs text-cockpit-text hover:border-blue-500/40 hover:text-blue-400 transition-colors truncate">
                      🔗 {link.host}
                    </a>
                  )) : (
                    <p className="text-[10px] text-cockpit-muted py-1">Nenhuma fonte EN encontrada</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  )
}
