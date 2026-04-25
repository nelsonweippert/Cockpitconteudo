// SEO Score — heurística inicial pra avaliar conteúdo pré-publicação.
// Roda 100% client-side (sem chamada de IA). Retorna score 0-100 + checklist
// colorido com motivos. Evolui pra ML quando tivermos base com performance real.
//
// O score é diagnóstico, não nota. Serve pra mostrar o que falta — não pra
// validar publicação.

export type SeoInput = {
  title?: string | null
  hook?: string | null
  script?: string | null
  description?: string | null
  targetDuration?: number | null  // segundos
  platform?: string | null         // "YOUTUBE" | "INSTAGRAM" | "TIKTOK" | "TWITCH" | "OTHER"
  format?: string | null           // "LONG_VIDEO" | "SHORT" | "REELS" | "POST" | "LIVE" | "THREAD"
  skill?: string | null            // "SHORT_VIDEO" | "LONG_VIDEO" | "INSTAGRAM"
}

export type SeoCheckSeverity = "ok" | "warn" | "info" | "fail"
export type SeoCheck = {
  id: string
  category: "title" | "hook" | "script" | "description" | "structure" | "platform"
  severity: SeoCheckSeverity
  weight: number          // pontos contribuídos (positivo se ok, 0 se warn/fail)
  maxWeight: number       // teto que essa regra contribui
  text: string
}

export type SeoResult = {
  score: number               // 0-100
  level: "low" | "medium" | "good" | "excellent"
  checks: SeoCheck[]
  positives: number
  warnings: number
  fails: number
}

// ─── helpers ────────────────────────────────────────────────────────────

const isShortFormat = (s: SeoInput): boolean => {
  if (s.skill === "SHORT_VIDEO" || s.skill === "INSTAGRAM") return true
  if (s.format === "SHORT" || s.format === "REELS" || s.format === "POST") return true
  if (s.platform === "TIKTOK" || s.platform === "INSTAGRAM") return true
  return false
}

const wordCount = (s: string | null | undefined): number => {
  if (!s) return 0
  return s.trim().split(/\s+/).filter(Boolean).length
}

// Heurística pra detectar "frase-âncora" no roteiro: pegamos os marcadores que
// o nosso prompt de generate_script obriga (⭐ FRASE-ÂNCORA: "...").
const ANCHOR_RE = /(?:⭐|FRASE[-\s]ÂNCORA|FRASE-ANCORA)/i

// ─── score ──────────────────────────────────────────────────────────────

export function computeSeoScore(input: SeoInput): SeoResult {
  const checks: SeoCheck[] = []
  const isShort = isShortFormat(input)

  // ─── TÍTULO ───
  const title = (input.title ?? "").trim()
  if (!title) {
    checks.push({
      id: "title-missing",
      category: "title",
      severity: "fail",
      weight: 0, maxWeight: 18,
      text: "Sem título definido",
    })
  } else {
    // Tamanho ideal varia por plataforma
    const targetMin = isShort ? 25 : 40
    const targetMax = isShort ? 60 : 70
    const len = title.length
    if (len >= targetMin && len <= targetMax) {
      checks.push({
        id: "title-length",
        category: "title",
        severity: "ok",
        weight: 12, maxWeight: 12,
        text: `Tamanho do título OK (${len} chars, ideal ${targetMin}-${targetMax})`,
      })
    } else if (len < targetMin) {
      checks.push({
        id: "title-too-short",
        category: "title",
        severity: "warn",
        weight: 6, maxWeight: 12,
        text: `Título curto (${len} chars). Ideal ${targetMin}-${targetMax} pra desambiguar e ranquear.`,
      })
    } else {
      checks.push({
        id: "title-too-long",
        category: "title",
        severity: "warn",
        weight: 4, maxWeight: 12,
        text: `Título longo (${len} chars). Acima de ${targetMax} corta no feed.`,
      })
    }

    // Pontuação alta (?! números !)
    const hasNumber = /\d/.test(title)
    const hasQuestionOrShock = /[?!]/.test(title)
    if (hasNumber || hasQuestionOrShock) {
      checks.push({
        id: "title-hookable",
        category: "title",
        severity: "ok",
        weight: 6, maxWeight: 6,
        text: `Título com elemento atrativo (${[hasNumber && "número", hasQuestionOrShock && "pontuação forte"].filter(Boolean).join(" + ")})`,
      })
    } else {
      checks.push({
        id: "title-flat",
        category: "title",
        severity: "info",
        weight: 0, maxWeight: 6,
        text: "Considere número/pergunta/pontuação no título pra gerar curiosidade.",
      })
    }
  }

  // ─── HOOK ───
  const hook = (input.hook ?? "").trim()
  if (!hook) {
    checks.push({
      id: "hook-missing",
      category: "hook",
      severity: "fail",
      weight: 0, maxWeight: 15,
      text: "Sem hook definido. Hook é a 1ª frase falada — o que prende nos primeiros 3s.",
    })
  } else {
    const hookWords = wordCount(hook)
    const targetMaxWords = isShort ? 18 : 25
    if (hookWords <= targetMaxWords) {
      checks.push({
        id: "hook-tight",
        category: "hook",
        severity: "ok",
        weight: 10, maxWeight: 10,
        text: `Hook conciso (${hookWords} palavras)`,
      })
    } else {
      checks.push({
        id: "hook-bloated",
        category: "hook",
        severity: "warn",
        weight: 4, maxWeight: 10,
        text: `Hook longo (${hookWords} palavras). Mais de ${targetMaxWords} faz perder a janela inicial de 3s.`,
      })
    }

    // Hook engaja com pergunta, choque, dado?
    const engaging = /\?|!|\d|impressionante|ninguém|você|isso muda|atenção/i.test(hook)
    if (engaging) {
      checks.push({
        id: "hook-engaging",
        category: "hook",
        severity: "ok",
        weight: 5, maxWeight: 5,
        text: "Hook tem gancho de atenção (pergunta/dado/choque)",
      })
    } else {
      checks.push({
        id: "hook-flat",
        category: "hook",
        severity: "info",
        weight: 0, maxWeight: 5,
        text: "Hook pode ganhar com pergunta direta, dado chocante ou afirmação inesperada.",
      })
    }
  }

  // ─── ROTEIRO ───
  const script = (input.script ?? "").trim()
  if (!script) {
    checks.push({
      id: "script-missing",
      category: "script",
      severity: "fail",
      weight: 0, maxWeight: 25,
      text: "Sem roteiro. Mesmo conteúdo curto se beneficia de estrutura mínima.",
    })
  } else {
    const sw = wordCount(script)

    // Tamanho mínimo por formato
    const minWords = isShort ? 60 : 250
    if (sw >= minWords) {
      checks.push({
        id: "script-substantive",
        category: "script",
        severity: "ok",
        weight: 10, maxWeight: 10,
        text: `Roteiro com substância (${sw} palavras)`,
      })
    } else {
      checks.push({
        id: "script-thin",
        category: "script",
        severity: "warn",
        weight: 4, maxWeight: 10,
        text: `Roteiro curto (${sw} palavras). Mínimo recomendado pra esse formato: ${minWords}.`,
      })
    }

    // Tem blocos estruturados?
    const hasBlocks = /BLOCO\b|##\s/i.test(script)
    if (hasBlocks) {
      checks.push({
        id: "script-structured",
        category: "script",
        severity: "ok",
        weight: 8, maxWeight: 8,
        text: "Roteiro estruturado em blocos",
      })
    } else {
      checks.push({
        id: "script-unstructured",
        category: "script",
        severity: "warn",
        weight: 3, maxWeight: 8,
        text: "Roteiro sem blocos visíveis (BLOCO 1, ABERTURA, etc.). Estrutura ajuda na gravação.",
      })
    }

    // Tem frase-âncora? (nosso padrão de roteiro)
    const hasAnchor = ANCHOR_RE.test(script)
    if (hasAnchor) {
      checks.push({
        id: "script-anchor",
        category: "script",
        severity: "ok",
        weight: 7, maxWeight: 7,
        text: "Roteiro tem frase-âncora marcada (ponto memorável por bloco)",
      })
    } else {
      checks.push({
        id: "script-no-anchor",
        category: "script",
        severity: "info",
        weight: 0, maxWeight: 7,
        text: "Roteiro sem frase-âncora. Use 'Gerar com IA' pra ganhar pontos memoráveis por bloco.",
      })
    }
  }

  // ─── DESCRIÇÃO ───
  const description = (input.description ?? "").trim()
  const minDescLen = isShort ? 80 : 250
  if (!description) {
    checks.push({
      id: "desc-missing",
      category: "description",
      severity: isShort ? "warn" : "fail",
      weight: 0, maxWeight: 12,
      text: isShort
        ? "Sem descrição. Em curto é menos crítico, mas SEO+CTA ajudam."
        : "Sem descrição. YouTube usa pra ranking e contexto.",
    })
  } else {
    if (description.length >= minDescLen) {
      checks.push({
        id: "desc-length",
        category: "description",
        severity: "ok",
        weight: 8, maxWeight: 8,
        text: `Descrição com tamanho adequado (${description.length} chars)`,
      })
    } else {
      checks.push({
        id: "desc-short",
        category: "description",
        severity: "warn",
        weight: 3, maxWeight: 8,
        text: `Descrição curta (${description.length} chars). Mínimo ${minDescLen}.`,
      })
    }

    // CTA presente?
    const hasCta = /(inscre|curta|comente|link|segue|siga|compartilh)/i.test(description)
    if (hasCta) {
      checks.push({
        id: "desc-cta",
        category: "description",
        severity: "ok",
        weight: 4, maxWeight: 4,
        text: "Descrição tem CTA",
      })
    } else {
      checks.push({
        id: "desc-no-cta",
        category: "description",
        severity: "info",
        weight: 0, maxWeight: 4,
        text: "Sem CTA visível na descrição (inscreva, comente, etc.).",
      })
    }
  }

  // ─── ESTRUTURA / PLATAFORMA ───
  if (!input.platform) {
    checks.push({
      id: "platform-missing",
      category: "platform",
      severity: "warn",
      weight: 0, maxWeight: 5,
      text: "Plataforma não definida — define o tom e o formato ideal",
    })
  } else {
    checks.push({
      id: "platform-set",
      category: "platform",
      severity: "ok",
      weight: 5, maxWeight: 5,
      text: `Plataforma: ${input.platform}`,
    })
  }

  if (input.targetDuration && input.targetDuration > 0) {
    checks.push({
      id: "duration-set",
      category: "structure",
      severity: "ok",
      weight: 5, maxWeight: 5,
      text: `Duração-alvo: ${formatDuration(input.targetDuration)}`,
    })
  } else {
    checks.push({
      id: "duration-missing",
      category: "structure",
      severity: "info",
      weight: 0, maxWeight: 5,
      text: "Sem duração-alvo definida. Ajuda a calibrar roteiro e edição.",
    })
  }

  // ─── agregação ───
  const totalWeight = checks.reduce((s, c) => s + c.weight, 0)
  const totalMax = checks.reduce((s, c) => s + c.maxWeight, 0)
  const score = totalMax === 0 ? 0 : Math.round((totalWeight / totalMax) * 100)

  const positives = checks.filter((c) => c.severity === "ok").length
  const warnings = checks.filter((c) => c.severity === "warn" || c.severity === "info").length
  const fails = checks.filter((c) => c.severity === "fail").length

  let level: SeoResult["level"]
  if (score >= 85) level = "excellent"
  else if (score >= 65) level = "good"
  else if (score >= 40) level = "medium"
  else level = "low"

  return { score, level, checks, positives, warnings, fails }
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  const min = Math.floor(seconds / 60)
  const s = seconds % 60
  return s === 0 ? `${min}min` : `${min}min ${s}s`
}
