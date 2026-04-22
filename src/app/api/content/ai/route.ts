import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { generateContentSuggestion } from "@/services/ai.service"
import { CONTENT_SKILLS, type SkillId } from "@/config/content-skills"

const SYSTEM_PROMPT = `Você é um especialista em criação de conteúdo digital para redes sociais e YouTube.
Você domina hooks virais, storytelling, copywriting, SEO para vídeo, e estratégias de engajamento.
Responda sempre em português brasileiro, de forma direta e prática.`

const SYSTEM_PROMPT_JSON = `Você é um especialista em criação de conteúdo digital para redes sociais e YouTube.
Você domina hooks virais, storytelling, copywriting, SEO para vídeo, e estratégias de engajamento.
Responda sempre em português brasileiro. Retorne APENAS JSON válido, sem markdown, sem code blocks, sem texto extra.`

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Não autorizado" }, { status: 401 })

  const body = await req.json()
  const { action, skill, phase, title, hook, script, notes, series, research, targetDuration, durationStrategy } = body as {
    action: string
    skill?: SkillId
    phase?: string
    title?: string
    hook?: string
    script?: string
    notes?: string
    series?: string
    research?: string
    targetDuration?: number
    durationStrategy?: {
      strategyName: string
      strategyBrief: string
      hookGuide: string
      scriptGuide: string
      titleGuide: string
      descriptionGuide: string
    }
  }

  function formatDuration(s?: number) {
    if (!s) return "não definida"
    return s >= 60 ? `${Math.floor(s / 60)} minutos${s % 60 > 0 ? ` e ${s % 60} segundos` : ""}` : `${s} segundos`
  }
  const isShortContent = skill === "SHORT_VIDEO" || skill === "INSTAGRAM"
  // Se a skill tem durationStrategy específica, usa ela. Senão, fallback genérico.
  const durationCtx = targetDuration
    ? (durationStrategy
      ? `\n- Duração alvo: ${formatDuration(targetDuration)}\n- Estratégia escolhida: **${durationStrategy.strategyName}** — ${durationStrategy.strategyBrief}`
      : `\n- Duração alvo: ${formatDuration(targetDuration)} — ${isShortContent
        ? "CONTEÚDO CURTO: ritmo rápido, cortes a cada 2-3s, hooks de 1-3s, sem enrolação. Cada segundo conta."
        : "CONTEÚDO LONGO: estruture com capítulos, use open loops a cada 3-4 min, pattern interrupts a cada 30-60s."
      } ADAPTE o roteiro para caber EXATAMENTE nesta duração.`)
    : ""

  // Guides específicos por ação, derivados da estratégia escolhida
  const hookDirective = durationStrategy?.hookGuide ? `\n\nDIRETRIZ DE HOOK (estratégia ${durationStrategy.strategyName}):\n${durationStrategy.hookGuide}` : ""
  const scriptDirective = durationStrategy?.scriptGuide ? `\n\nDIRETRIZ DE ROTEIRO (estratégia ${durationStrategy.strategyName}):\n${durationStrategy.scriptGuide}` : ""
  const titleDirective = durationStrategy?.titleGuide ? `\n\nDIRETRIZ DE TÍTULO (estratégia ${durationStrategy.strategyName}):\n${durationStrategy.titleGuide}` : ""
  const descriptionDirective = durationStrategy?.descriptionGuide ? `\n\nDIRETRIZ DE DESCRIÇÃO (estratégia ${durationStrategy.strategyName}):\n${durationStrategy.descriptionGuide}` : ""

  const skillConfig = skill ? CONTENT_SKILLS[skill] : null
  const phaseConfig = skillConfig?.phases.find((p) => p.id === phase)
  const aiContext = phaseConfig?.aiPromptContext ?? ""

  let prompt = ""

  switch (action) {
    case "generate_hook": {
      const hookPrompt = `${aiContext}${hookDirective}

Contexto do conteúdo:
- Tipo: ${skillConfig?.label ?? "Geral"}
- Título: ${title ?? "Não definido"}${durationCtx}
${notes ? `- Notas: ${notes}` : ""}
${series ? `- Série: ${series}` : ""}

Gere 5 opções de HOOK seguindo a DIRETRIZ acima. Retorne APENAS um JSON array:
[{"text": "texto do hook", "style": "estilo usado (pergunta/chocante/estatística/POV/direto)", "why": "por que funciona"}]`
      try {
        const result = await generateContentSuggestion(SYSTEM_PROMPT_JSON, hookPrompt)
        const options = JSON.parse(result.replace(/```json?\n?/g, "").replace(/```/g, "").trim())
        return NextResponse.json({ type: "options", field: "hook", options })
      } catch {
        return NextResponse.json({ type: "options", field: "hook", options: [] })
      }
    }

    case "generate_titles": {
      const titlesPrompt = `${aiContext}${titleDirective}

Contexto:
- Tipo: ${skillConfig?.label ?? "Geral"}
- Tema/Título atual: ${title ?? "Não definido"}${durationCtx}
${hook ? `- Hook: ${hook}` : ""}

Gere 6 variações de TÍTULO otimizados para clique, seguindo a DIRETRIZ acima. Retorne APENAS um JSON array:
[{"text": "título aqui", "style": "técnica usada (curiosity gap/números/urgência/como fazer/contraste)", "why": "por que gera clique"}]
Cada título < 60 caracteres.`
      try {
        const result = await generateContentSuggestion(SYSTEM_PROMPT_JSON, titlesPrompt)
        const options = JSON.parse(result.replace(/```json?\n?/g, "").replace(/```/g, "").trim())
        return NextResponse.json({ type: "options", field: "title", options })
      } catch {
        return NextResponse.json({ type: "options", field: "title", options: [] })
      }
    }

    case "generate_series": {
      const seriesPrompt = `${aiContext}

Tema/nicho: ${title ?? "Não definido"}
Tipo de conteúdo: ${skillConfig?.label ?? "Geral"}
${series ? `Série existente: ${series}` : ""}

Gere uma SÉRIE de 6 peças de conteúdo. Retorne APENAS um JSON array:
[{"title": "título da peça", "hook": "hook sugerido (1-2 frases)", "angle": "ângulo único desta peça"}]
A série deve ter progressão lógica.`
      try {
        const result = await generateContentSuggestion(SYSTEM_PROMPT_JSON, seriesPrompt)
        const options = JSON.parse(result.replace(/```json?\n?/g, "").replace(/```/g, "").trim())
        return NextResponse.json({ type: "series", options })
      } catch {
        return NextResponse.json({ type: "series", options: [] })
      }
    }

    case "generate_script":
      prompt = `${aiContext}${scriptDirective}

Contexto do conteúdo:
- Tipo: ${skillConfig?.label ?? "Geral"}
- Título: ${title ?? "Não definido"}${durationCtx}
${hook ? `- Hook definido: ${hook}` : ""}
${research ? `- Pesquisa/referências: ${research}` : ""}
${notes ? `- Notas: ${notes}` : ""}

Escreva um roteiro COMPLETO que caiba na duração alvo, seguindo a DIRETRIZ DE ROTEIRO acima (quando presente) e as boas práticas da skill.
${skillConfig?.scriptTemplates?.[0] ? `Template-base: ${skillConfig.scriptTemplates[0].structure.join(" → ")}` : ""}

FORMATO DO ROTEIRO:
- Divida em BLOCOS claros (ABERTURA, BLOCO 1, BLOCO 2, etc., FECHAMENTO)
- Cada bloco deve ter o TEXTO EXATO que o apresentador vai falar
- Escreva como fala natural, não como texto escrito
- NÃO inclua marcações de edição ([CORTE], [B-ROLL], [ZOOM], etc)
- NÃO inclua indicações técnicas de câmera ou efeitos
- Foque 100% no conteúdo falado, estruturado por blocos`
      break

    case "generate_research":
      prompt = `${aiContext}

Contexto do conteúdo:
- Tipo: ${skillConfig?.label ?? "Geral"}
- Título: ${title ?? "Não definido"}${durationCtx}
${hook ? `- Hook: ${hook}` : ""}

Sugira um plano de pesquisa completo:
1. Pontos-chave para cobrir neste conteúdo
2. Perguntas que o público provavelmente tem sobre este tema
3. Dados/estatísticas interessantes para incluir
4. Referências e fontes sugeridas para pesquisar
5. Ângulos únicos que poucos criadores exploram`
      break

    case "generate_briefing":
      prompt = `Você é um diretor de conteúdo que prepara briefings para gravação.

Tipo: ${skillConfig?.label ?? "Geral"}
Título: ${title ?? "Não definido"}${durationCtx}
${hook ? `Hook: ${hook}` : ""}
${script ? `\nROTEIRO COMPLETO:\n${script}` : ""}
${research ? `\nPESQUISA:\n${research.substring(0, 1000)}` : ""}

Crie um BRIEFING DE GRAVAÇÃO estruturado em blocos. Para cada bloco:

1. **Nome do bloco** (ABERTURA, DESENVOLVIMENTO 1, DESENVOLVIMENTO 2, etc., FECHAMENTO)
2. **O que falar neste bloco** — resumo em 2-3 frases do ponto principal
3. **⭐ FRASE DE DESTAQUE** — a frase mais impactante que NÃO PODE FALTAR neste bloco. É o ponto-chave que faz o espectador parar, reagir ou compartilhar. Deve ser memorável e viral.
4. **Dica de entrega** — tom de voz, energia, gesto ou expressão facial para este momento

A FRASE DE DESTAQUE de cada bloco deve:
- Ser curta e impactante (máximo 2 frases)
- Conter um dado chocante, uma verdade provocativa, ou uma analogia forte
- Funcionar isolada como quote para cortes/reels
- Seguir a estrutura lógica de viralização: hook → tensão → revelação → CTA

Após os blocos, adicione uma seção:

## 📰 FONTES PARA A EDIÇÃO

A editora usará estas fontes para tirar screenshots, imagens, textos e dados para incluir no vídeo.
TODOS os vídeos são em PORTUGUÊS BRASILEIRO — priorize fontes em PT-BR.

Analise a PESQUISA/REFERÊNCIAS abaixo e extraia:

1. **FONTES DA PESQUISA ORIGINAL** — liste todas as fontes, sites, links e referências mencionadas na pesquisa. Para cada uma:
   - Nome do site/fonte
   - O que a editora pode extrair de lá (screenshot, gráfico, texto, dado)
   - Se o site é em inglês, sugira o equivalente em PT-BR (ex: se a fonte é TechCrunch, sugerir Tecmundo, Olhar Digital, Canaltech, etc.)

2. **SITES PT-BR RECOMENDADOS** para buscar imagens/screenshots sobre este tema:
   - Portais de notícias: G1, Folha, UOL, InfoMoney, Exame, Tecmundo, Olhar Digital, Canaltech, Livecoins
   - Indique 3-5 sites ESPECÍFICOS para este tema onde a editora pode:
     - Tirar screenshots de manchetes (prova social)
     - Copiar gráficos e dados
     - Encontrar imagens contextuais

3. **O QUE CAPTURAR POR BLOCO** — para cada bloco do briefing:
   - Descreva exatamente o que mostrar na tela
   - Em qual site/app capturar o screenshot
   - Texto overlay sugerido (em português)

4. **TERMOS DE BUSCA** em português para Google Imagens e YouTube (a editora buscará imagens complementares)

Formate com markdown. Use **negrito** para as frases de destaque.`
      break

    case "generate_editing_notes":
      prompt = `Você é um editor de vídeo profissional. Analise o roteiro abaixo e gere um GUIA DE EDIÇÃO completo.

Tipo de conteúdo: ${skillConfig?.label ?? "Geral"}
Título: ${title ?? "Não definido"}${durationCtx}
${hook ? `Hook: ${hook}` : ""}

ROTEIRO:
${script || "Não fornecido"}

Gere indicações técnicas de edição BLOCO A BLOCO:
1. Para cada bloco do roteiro, sugira:
   - Tipo de corte (jump cut, J-cut, L-cut, transição suave)
   - B-roll sugerido (o que mostrar enquanto fala)
   - Texto overlay (palavras-chave na tela)
   - Zoom/movimento de câmera
   - Música/SFX (momentos de mudar tom, adicionar efeito)

2. Indicações gerais:
   - Estilo de música de fundo por seção
   - Paleta de cores/filtro sugerido
   - Ritmo de cortes (a cada Xs)
   - Momentos de pattern interrupt
   - Sugestões de memes/referências visuais se aplicável

3. Para cada B-roll sugerido, indique:
   - Termo de busca em inglês para bancos de imagem/vídeo
   - Site recomendado (Pexels, Unsplash, Coverr, Videvo, etc)
   - Se é screenshot/gravação de tela, indicar qual app/site

Formate como guia prático que o editor pode seguir passo a passo.`
      break

    case "deep_research":
      prompt = `Você é um pesquisador de conteúdo especializado. Faça uma pesquisa APROFUNDADA sobre o tema abaixo.

Tema: ${title ?? "Não definido"}
Tipo de conteúdo: ${skillConfig?.label ?? "Geral"}${durationCtx}
${research ? `\nPesquisa existente:\n${research}` : ""}
${hook ? `Hook: ${hook}` : ""}
${notes ? `Notas do criador: ${notes}` : ""}

Pesquise PROFUNDAMENTE e retorne:

1. **CONTEXTO COMPLETO**: O que está acontecendo sobre este tema agora? Explique como se fosse um briefing para um jornalista.

2. **DADOS E NÚMEROS**: Estatísticas, percentuais, valores, métricas reais que dão credibilidade ao conteúdo. Cite fontes quando possível.

3. **DIFERENTES PERSPECTIVAS**: Visão de especialistas, opiniões contrastantes, o que os defensores e críticos dizem.

4. **TIMELINE**: Cronologia dos eventos recentes relacionados (o que aconteceu, quando, e o que vem a seguir).

5. **OPORTUNIDADE DE CONTEÚDO**: Por que AGORA é o momento de fazer este conteúdo? Qual é a janela de oportunidade?

6. **PONTOS QUE NINGUÉM ESTÁ COBRINDO**: Lacunas no conteúdo existente. O que os outros criadores estão ignorando?

7. **PERGUNTAS DO PÚBLICO**: As 5-8 perguntas mais comuns que as pessoas têm sobre este tema.

8. **FONTES RECOMENDADAS**: Links e referências para aprofundar a pesquisa.

Formate com markdown. Seja extenso e detalhado — esta pesquisa será a base de todo o conteúdo.`
      break

    case "generate_thumbnail":
      prompt = `Você é um especialista em design de thumbnails para ${skillConfig?.label ?? "conteúdo digital"}.

Contexto:
- Título: ${title ?? "Não definido"}${durationCtx}
${hook ? `- Hook: ${hook}` : ""}
${notes ? `- Notas visuais: ${notes}` : ""}

Gere 3 conceitos de THUMBNAIL/ARTE VISUAL detalhados:
Para cada um descreva:
1. Composição visual (layout, elementos, posição)
2. Expressão facial/pose se aplicável
3. Texto overlay (máximo 5 palavras)
4. Esquema de cores (primária, secundária, contraste)
5. Estilo/mood (minimalista, energético, dramático, etc)
6. Prompt para usar em ferramentas de IA de imagem (DALL-E/Midjourney)

Numere cada conceito.`
      break

    case "generate_description":
      prompt = `${aiContext}${descriptionDirective}

Contexto do conteúdo:
- Tipo: ${skillConfig?.label ?? "Geral"}
- Título: ${title ?? "Não definido"}${durationCtx}
${hook ? `- Hook: ${hook}` : ""}
${script ? `- Roteiro (resumo): ${script.substring(0, 500)}` : ""}
${notes ? `- Notas: ${notes}` : ""}

Gere uma DESCRIÇÃO/CAPTION seguindo a DIRETRIZ acima (quando presente) e otimizada pra publicação na plataforma.
Inclua:
1. Descrição otimizada para SEO (keywords naturais no texto)
2. Call-to-action
3. 10-15 hashtags relevantes (mix de tamanhos)
4. Se YouTube: inclua timestamps/capítulos sugeridos

Formate a descrição pronta para copiar e colar na plataforma.`
      break

    case "review":
      prompt = `${aiContext}

Revise este conteúdo e dê feedback detalhado:

- Tipo: ${skillConfig?.label ?? "Geral"}
- Título: ${title ?? "Não definido"}${durationCtx}
${hook ? `- Hook: ${hook}` : ""}
${script ? `- Roteiro:\n${script}` : ""}
${research ? `- Pesquisa: ${research}` : ""}

Analise:
1. O hook é forte o suficiente? Sugira melhoria se não
2. A estrutura mantém atenção ao longo de todo o conteúdo?
3. O CTA é claro e efetivo?
4. Pontos fortes do conteúdo
5. Pontos a melhorar (seja específico)
6. Nota geral de 1-10 com justificativa`
      break

    default:
      return NextResponse.json({ error: "Ação desconhecida" }, { status: 400 })
  }

  try {
    const result = await generateContentSuggestion(SYSTEM_PROMPT, prompt)
    return NextResponse.json({ result })
  } catch (err) {
    console.error("[content/ai] error:", err)
    return NextResponse.json({ error: "Erro ao gerar sugestão" }, { status: 500 })
  }
}
