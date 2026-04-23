import { Lightbulb, Star, Play, Archive, Zap } from "lucide-react"

interface Props {
  totalIdeas: number
  favorites: number
  inProduction: number
  activeTerms: number
}

export function IdeiasHeader({ totalIdeas, favorites, inProduction, activeTerms }: Props) {
  const isEmpty = totalIdeas === 0 && inProduction === 0 && activeTerms === 0

  return (
    <div className="max-w-6xl mx-auto mb-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-cockpit-text flex items-center gap-2">
            <Lightbulb size={22} className="text-accent" />
            Repositório de Ideias
          </h1>
          <p className="text-sm text-cockpit-muted mt-1 max-w-2xl">
            Termos monitorados, pesquisa focada e ideação manual — cada ideia ancorada
            em fontes reais, pronta pra virar conteúdo.
          </p>
        </div>

        {!isEmpty && (
          <div className="flex items-center gap-2.5">
            <Stat icon={<Zap size={12} />} label="Ativas" value={totalIdeas} />
            {favorites > 0 && (
              <Stat
                icon={<Star size={12} fill="currentColor" />}
                label="Favoritas"
                value={favorites}
                tone="amber"
              />
            )}
            {inProduction > 0 && (
              <Stat
                icon={<Play size={10} fill="currentColor" />}
                label="Em produção"
                value={inProduction}
                tone="emerald"
              />
            )}
            <Stat label="Termos" value={activeTerms} muted />
          </div>
        )}
      </div>

      {/* Vazio-estado acolhedor no primeiro acesso */}
      {isEmpty && (
        <div className="mt-5 cockpit-card border-dashed border-accent/30 bg-accent/5 flex flex-col items-center justify-center py-12 text-center">
          <Archive size={32} strokeWidth={1} className="text-accent mb-3" />
          <h3 className="text-sm font-semibold text-cockpit-text">Comece adicionando um termo</h3>
          <p className="text-xs text-cockpit-muted mt-1.5 max-w-md leading-relaxed">
            Ex: &quot;Inteligência Artificial&quot;, &quot;DeFi&quot;, &quot;Marketing Digital&quot;.
            <br />
            Clique em <span className="font-semibold text-cockpit-text">gerenciar</span> no primeiro
            card abaixo pra adicionar seu primeiro termo monitorado.
          </p>
        </div>
      )}
    </div>
  )
}

function Stat({
  icon,
  label,
  value,
  tone,
  muted,
}: {
  icon?: React.ReactNode
  label: string
  value: number
  tone?: "amber" | "emerald"
  muted?: boolean
}) {
  const classes =
    tone === "amber"
      ? "bg-amber-500/5 border-amber-500/20 text-amber-500"
      : tone === "emerald"
      ? "bg-emerald-500/5 border-emerald-500/20 text-emerald-500"
      : muted
      ? "bg-cockpit-surface border-cockpit-border text-cockpit-muted"
      : "bg-cockpit-surface border-cockpit-border text-cockpit-text"

  return (
    <div className={`flex flex-col items-center px-3 py-2 border rounded-xl min-w-[72px] ${classes}`}>
      <span className="text-lg font-bold leading-none flex items-center gap-1">
        {icon}
        {value}
      </span>
      <span className="text-[10px] uppercase tracking-wider mt-1 opacity-80">{label}</span>
    </div>
  )
}
