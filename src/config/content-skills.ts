// ═══════════════════════════════════════════════════════════════════════════════
// Content Skills — Best practices, phases, checklists and AI prompts
// for each content format. Built from research on top-performing creators
// and platform algorithm behavior (2024-2025).
// ═══════════════════════════════════════════════════════════════════════════════

export type SkillId = "SHORT_VIDEO" | "LONG_VIDEO" | "INSTAGRAM" | "RESEARCH" | "INSTAGRAM_REELS" | "YOUTUBE_SHORTS" | "YOUTUBE_VIDEO" | "TIKTOK_VIDEO"

export type PhaseId =
  | "IDEA" | "RESEARCH" | "SCRIPT" | "RECORDING"
  | "EDITING" | "THUMBNAIL" | "REVIEW" | "SCHEDULED" | "PUBLISHED"

export interface PhaseChecklist {
  label: string
  tip?: string
}

export interface PhaseConfig {
  id: PhaseId
  label: string
  description: string
  checklist: PhaseChecklist[]
  tips: string[]
  aiPromptContext: string // context injected into AI prompts for this phase
}

export interface SkillSourceRef {
  title: string
  url: string
  description: string
}

export interface DurationOption {
  seconds: number
  label: string              // "30s", "60s", "8 min"
  strategyName: string       // "Quick Hit", "Deep Dive"
  strategyBrief: string      // 1 linha explicando a estratégia
  scriptGuide: string        // como estruturar o roteiro pra essa duração
  titleGuide: string         // fórmula do título
  descriptionGuide: string   // fórmula da caption/descrição
  hookGuide: string          // abertura/primeiros segundos
}

export interface ContentSkill {
  id: SkillId
  label: string
  icon: string
  description: string
  platforms: string[]
  phases: PhaseConfig[]
  bestPractices: string[]
  commonMistakes: string[]
  kpis: { label: string; target: string; why: string }[]
  scriptTemplates: { name: string; structure: string[] }[]
  sources: SkillSourceRef[]
  durationOptions?: DurationOption[]
  lastUpdated: string
}

// ─────────────────────────────────────────────────────────────────────────────
// SKILL 1: SHORT VIDEO (TikTok, YouTube Shorts, Instagram Reels)
// ─────────────────────────────────────────────────────────────────────────────

const SHORT_VIDEO: ContentSkill = {
  id: "SHORT_VIDEO",
  label: "Vídeo Curto",
  icon: "⚡",
  description: "TikTok, YouTube Shorts, Instagram Reels (30s–3min)",
  platforms: ["TIKTOK", "YOUTUBE", "INSTAGRAM"],
  phases: [
    {
      id: "IDEA",
      label: "Ideação",
      description: "Definir conceito, ângulo e gancho do vídeo",
      checklist: [
        { label: "Tema definido e validado (trending ou evergreen)", tip: "Use TikTok Creative Center ou Google Trends para validar" },
        { label: "Público-alvo claro (quem vai assistir?)" },
        { label: "Ângulo único definido (o que diferencia este vídeo?)", tip: "Mesmo tema popular precisa de ângulo original" },
        { label: "Hook de 3 segundos rascunhado", tip: "O hook decide 90% da performance" },
        { label: "Formato escolhido (tutorial, storytelling, POV, antes/depois, lista)" },
        { label: "Duração alvo definida (30s, 60s, 1:30, 2:00 ou 3:00)" },
      ],
      tips: [
        "Vídeos curtos vão de 30s a 3min. Sweet spot: 60-90s para máxima retenção. 1:30-3:00 para conteúdo educacional denso",
        "71% dos viewers decidem nos primeiros segundos se continuam — hook é tudo",
        "Use 'curiosity stacking': assim que uma pergunta é respondida, outra emerge (mantém até o final)",
        "Cross-platform é obrigatório: publicar em 3-5 plataformas dá 4-5x mais alcance total",
        "Videos 50-60s têm média de 4.1M views vs 19K para videos < 10s (dados 2026)",
      ],
      aiPromptContext: "Gere ideias de vídeo curto considerando: hooks virais, ângulos únicos, formatos comprovados (POV, tutorial, lista, antes/depois, storytelling). O hook deve funcionar nos primeiros 1-3 segundos. Cada ideia deve incluir: título, hook, formato e duração sugerida.",
    },
    {
      id: "SCRIPT",
      label: "Roteiro",
      description: "Escrever o roteiro completo com hook, corpo e CTA",
      checklist: [
        { label: "Hook escrito (primeiros 1-3 segundos)", tip: "Use: pergunta chocante, afirmação polêmica, visual impactante, ou 'Você sabia que...'" },
        { label: "Corpo com 1 ideia central (não tente falar de tudo)" },
        { label: "Pattern interrupts a cada 3-5 segundos", tip: "Mudança de câmera, texto, zoom, gesto, tom de voz" },
        { label: "CTA claro no final (seguir, salvar, comentar)", tip: "CTAs que pedem 'salvar' geram mais alcance que 'curtir'" },
        { label: "Texto de legenda/caption com keyword no início" },
        { label: "Tempo estimado bate com duração alvo" },
      ],
      tips: [
        "HOOK PATTERNS que funcionam: 'Pare de fazer X', 'Ninguém te conta isso sobre X', 'Em 30 segundos você vai aprender...', 'O erro que 99% das pessoas cometem'",
        "Cada frase deve ter propósito — corte palavras desnecessárias",
        "Escreva como fala, não como escreve. Tom conversacional > formal",
        "O CTA 'Salva pra ver depois' gera 3-5x mais salvamentos que 'Curte aí'",
        "Use open loops: mencione algo no início que só resolve no final",
      ],
      aiPromptContext: "Escreva um roteiro de vídeo curto. Estrutura: HOOK (1-3s, impactante) → CORPO (ideia central com pattern interrupts) → CTA. Tom conversacional. Marque [CORTE], [ZOOM], [TEXTO: xxx] para indicar edição. Inclua sugestões de texto overlay. O roteiro deve manter atenção a cada 3 segundos.",
    },
    {
      id: "RECORDING",
      label: "Gravação",
      description: "Gravar o vídeo seguindo o roteiro",
      checklist: [
        { label: "Iluminação adequada (luz natural frontal ou ring light)" },
        { label: "Áudio limpo (microfone lapela ou ambiente silencioso)", tip: "Áudio ruim é o #1 motivo de swipe away" },
        { label: "Enquadramento vertical 9:16 (1080x1920)" },
        { label: "Energia alta nos primeiros 3 segundos" },
        { label: "Múltiplos takes gravados (mínimo 2-3 opções)" },
        { label: "B-roll/cutaways gravados para edição" },
      ],
      tips: [
        "Olhe para a câmera, não para a tela — cria conexão",
        "Comece a falar IMEDIATAMENTE — sem 'oi gente' ou introduções",
        "Varie o tom de voz — monotonia = swipe",
        "Grave em pedaços curtos (facilita edição e retakes)",
        "Fundo limpo ou contextual (home office, gym, etc.) — nada distrativo",
      ],
      aiPromptContext: "Sugira direções de gravação para este vídeo curto: ângulos de câmera, dicas de enquadramento, expressões faciais, gestos que amplificam a mensagem, e momentos-chave onde a energia precisa ser mais alta.",
    },
    {
      id: "EDITING",
      label: "Edição",
      description: "Editar com ritmo rápido e elementos de retenção",
      checklist: [
        { label: "Cortes a cada 1.5-3 segundos (ritmo rápido)", tip: "Top creators cortam a cada 1.5-2s. 59% dos vídeos são assistidos entre 41-80% da duração — cortes rápidos maximizam isso" },
        { label: "Texto overlay nos pontos-chave", tip: "65% assistem sem som — texto é essencial" },
        { label: "Música/som trending adicionado", tip: "Áudio trending dá boost no algoritmo" },
        { label: "Zoom/pan em momentos de ênfase" },
        { label: "Caption automática adicionada (acessibilidade)" },
        { label: "Thumbnail/capa atrativa (primeiro frame)" },
        { label: "Loop testado (final conecta com início)", tip: "Loops aumentam watch time e replays" },
      ],
      tips: [
        "Corte silêncios e 'uhms' — cada milissegundo conta",
        "Use 3-5 estilos de texto overlay (destaque, narrativa, dados)",
        "O final ideal conecta com o início, criando um loop infinito",
        "Adicione SFX sutis (whoosh, pop) nos cortes — aumenta retenção 15-20%",
        "Teste o vídeo sem som — deve fazer sentido só com texto",
      ],
      aiPromptContext: "Sugira um plano de edição para este vídeo curto: onde colocar cortes, quais textos overlay, momentos para zoom/efeitos, sugestão de música/SFX, e como criar um loop no final.",
    },
    {
      id: "REVIEW",
      label: "Revisão",
      description: "Revisar qualidade antes de publicar",
      checklist: [
        { label: "Assistiu o vídeo inteiro como espectador" },
        { label: "Hook funciona nos primeiros 2 segundos?" },
        { label: "Áudio está limpo e mixado?" },
        { label: "Texto legível em tela de celular?" },
        { label: "CTA está claro?" },
        { label: "Hashtags relevantes (3-5, mix de volume)", tip: "#nicho + #médio + #trending" },
        { label: "Caption com keyword na primeira linha" },
      ],
      tips: [
        "Assista em mute — o texto conta a história?",
        "Mostre para 1-2 pessoas antes de publicar (feedback rápido)",
        "Se o hook não te prende, não vai prender ninguém",
      ],
      aiPromptContext: "Revise este conteúdo de vídeo curto e dê feedback: o hook é forte o suficiente? A estrutura mantém atenção? O CTA é efetivo? Sugira melhorias específicas.",
    },
    {
      id: "SCHEDULED",
      label: "Agendamento",
      description: "Agendar publicação no melhor horário",
      checklist: [
        { label: "Horário de pico do público definido", tip: "Terça a quinta, 11h-13h e 19h-21h geralmente performam melhor" },
        { label: "Cross-post programado (TikTok + Shorts + Reels)" },
        { label: "Notificações de engajamento ativadas (responder rápido)" },
      ],
      tips: [
        "Poste quando seu público está online (veja analytics)",
        "Responda TODOS os comentários na primeira hora — sinal forte pro algoritmo",
        "Frequência ideal: 1-2 vídeos/dia no TikTok, 3-5/semana no Shorts/Reels",
      ],
      aiPromptContext: "Sugira estratégia de publicação: melhor horário, copy de caption, hashtags relevantes para o nicho, e plano de engajamento pós-publicação.",
    },
    {
      id: "PUBLISHED",
      label: "Publicado",
      description: "Acompanhar métricas e aprender",
      checklist: [
        { label: "Respondeu comentários na primeira hora" },
        { label: "Métricas anotadas após 24h e 48h" },
        { label: "Lições documentadas (o que funcionou/não funcionou)" },
      ],
      tips: [
        "Taxa de conclusão > 50% = conteúdo bom. > 70% = viral potential",
        "Compartilhamentos valem 5-10x mais que likes no algoritmo",
        "Se um vídeo viralizar, faça 2-3 variações imediatamente",
      ],
      aiPromptContext: "Analise as métricas deste vídeo curto e sugira: o que pode ter contribuído para a performance, o que melhorar no próximo, e se vale fazer uma variação/continuação.",
    },
  ],
  bestPractices: [
    "Os primeiros 1-3 segundos decidem tudo — 71% dos viewers decidem ali se continuam",
    "1 vídeo = 1 ideia. Nunca tente cobrir múltiplos tópicos",
    "Consistência > qualidade perfeita. Poste regularmente para alimentar o algoritmo",
    "CROSS-PLATFORM OBRIGATÓRIO: publicar em 3-5 plataformas dá 4-5x mais alcance total (dados 2026)",
    "Use 'curiosity stacking' — crie micro-gaps de curiosidade ao longo do vídeo, não apenas no início",
    "Trending audios dão boost de 30-60% no alcance — use nas primeiras 24-72h do trend",
    "Shares via DM valem 2-5x mais que likes no algoritmo — crie conteúdo 'compartilhável'",
    "YouTube Shorts tem 5.91% de engagement rate vs TikTok 2.80% — não ignore Shorts",
    "Shorts e long-form no YouTube estão DESACOPLADOS desde 2025 — Shorts não prejudicam mais vídeos longos",
    "Grave em lote (batch) — 5-10 vídeos em uma sessão é mais eficiente",
  ],
  commonMistakes: [
    "Introdução longa antes do conteúdo ('Oi gente, tudo bem?')",
    "Áudio ruim ou ambiente barulhento",
    "Muitas ideias em um só vídeo",
    "Não adaptar conteúdo para cada plataforma (repost idêntico)",
    "Ignorar métricas e não iterar",
    "Usar hashtags irrelevantes ou banidas",
    "Não colocar legenda/caption (65% assistem mudo)",
    "Pedir para curtir antes de entregar valor",
  ],
  kpis: [
    { label: "Intro retention (3s)", target: "> 70%", why: "Algoritmo mede % que passa dos 3 primeiros segundos — top creators atingem 70%+" },
    { label: "Taxa de conclusão", target: "> 50%", why: "59% dos vídeos são assistidos até 41-80%. Acima de 50% = sinal forte" },
    { label: "Compartilhamentos (DM)", target: "> 2% dos views", why: "Valem 2-5x mais que likes no algoritmo — principal sinal em 2026" },
    { label: "Salvamentos", target: "> 3% dos views", why: "Indicam conteúdo de valor que será revisto" },
    { label: "Loop rate", target: "> 15%", why: "Replays contam como watch time adicional — sinal fortíssimo para Shorts" },
    { label: "Engagement rate", target: "> 5%", why: "YouTube Shorts média 5.91%, TikTok 2.80% — busque acima da média" },
  ],
  scriptTemplates: [
    {
      name: "Hook → Problema → Solução",
      structure: [
        "HOOK (1-3s): Afirmação impactante ou pergunta",
        "PROBLEMA (5-10s): Descrever a dor/frustração",
        "SOLUÇÃO (10-20s): Resolver com dicas práticas",
        "CTA (3s): Pedir para salvar/seguir",
      ],
    },
    {
      name: "Lista / X coisas que...",
      structure: [
        "HOOK (1-3s): '5 coisas que eu gostaria de saber antes de...'",
        "ITEM 1 (5s): Mais impactante primeiro",
        "ITEM 2-4 (5s cada): Crescendo de valor",
        "ITEM 5 (5s): Melhor item por último (retenção)",
        "CTA (3s): 'Salva pra não esquecer'",
      ],
    },
    {
      name: "Storytelling / POV",
      structure: [
        "HOOK (1-3s): Situação intrigante ('POV: você descobre que...')",
        "SETUP (5-10s): Contexto rápido",
        "CONFLITO (10-15s): Tensão/problema",
        "RESOLUÇÃO (5-10s): Virada + lição",
        "CTA (3s): 'Já passou por isso? Comenta'",
      ],
    },
    {
      name: "Antes e Depois / Transformação",
      structure: [
        "HOOK (1-3s): Resultado final impactante",
        "ANTES (5-10s): Estado inicial (pior possível)",
        "PROCESSO (10-15s): Montagem rápida da transformação",
        "DEPOIS (5s): Resultado final detalhado",
        "CTA (3s): 'Quer saber como? Segue para mais'",
      ],
    },
  ],
  sources: [
    { title: "Short-Form Video Statistics 2026", url: "https://autofaceless.ai/blog/short-form-video-statistics-2026", description: "Dados de performance: engagement rates por plataforma, views por duração, taxa de conclusão" },
    { title: "Short-Form Video Trends 2026 — ShortSync", url: "https://www.shortsync.app/resources/short-form-video-trends-2026", description: "Tendências emergentes: curiosity stacking, cross-platform, AI content" },
    { title: "50+ Viral Hook Templates 2026", url: "https://www.marketingblocks.ai/50-viral-hook-templates-for-ads-reels-tiktok-or-captions-2026-frameworks-examples-ai-prompts-included/", description: "Templates de hooks virais com frameworks e prompts de IA" },
    { title: "YouTube Shorts Best Practices 2026 — JoinBrands", url: "https://joinbrands.com/blog/youtube-shorts-best-practices/", description: "10 dicas comprovadas para maximizar views em Shorts" },
    { title: "Short-Form Video Mastery Guide — ALM Corp", url: "https://almcorp.com/blog/short-form-video-mastery-tiktok-reels-youtube-shorts-2026/", description: "Guia completo para dominar TikTok, Reels e Shorts em 2026" },
  ],
  lastUpdated: "2026-04-11",
}

// ─────────────────────────────────────────────────────────────────────────────
// SKILL 2: LONG VIDEO (YouTube 8-20+ min)
// ─────────────────────────────────────────────────────────────────────────────

const LONG_VIDEO: ContentSkill = {
  id: "LONG_VIDEO",
  label: "Vídeo Longo",
  icon: "🎬",
  description: "YouTube (8–25 min) — vídeos completos e aprofundados",
  platforms: ["YOUTUBE"],
  phases: [
    {
      id: "IDEA",
      label: "Ideação",
      description: "Definir tema, ângulo e potencial de busca/clique",
      checklist: [
        { label: "Tema validado com volume de busca", tip: "Use vidIQ, TubeBuddy ou Google Trends" },
        { label: "Pesquisa de competição (o que já existe no YouTube?)" },
        { label: "Ângulo diferenciador definido (por que alguém escolheria SEU vídeo?)" },
        { label: "Formato definido (tutorial, análise, ranking, documentário, vlog)" },
        { label: "Rascunho de título com curiosity gap", tip: "O título deve criar uma pergunta na cabeça do espectador" },
        { label: "Duração-alvo definida (8-15 min sweet spot)" },
        { label: "Série ou standalone? Se série, qual o arco?" },
      ],
      tips: [
        "O vídeo começa no título — se o título não gera clique, o conteúdo não importa",
        "Fórmulas de título comprovadas: 'Como X em Y', 'X que Mudou Minha Vida', 'Por que X é Y', número + superlativos",
        "Busque temas com alta demanda e baixa oferta (underserved topics)",
        "Pergunte: 'Eu clicaria neste vídeo?' — se hesitar, reformule",
      ],
      aiPromptContext: "Gere ideias de vídeo longo para YouTube. Cada ideia deve incluir: 3 variações de título otimizado para CTR, ângulo diferenciador, duração sugerida, e keywords principais. Títulos devem criar curiosity gap.",
    },
    {
      id: "RESEARCH",
      label: "Pesquisa",
      description: "Levantar dados, fontes e estrutura do conteúdo",
      checklist: [
        { label: "Fontes de dados coletadas (artigos, estudos, estatísticas)" },
        { label: "Top 5 vídeos do mesmo tema analisados", tip: "O que funcionou? O que faltou? Onde você pode ser melhor?" },
        { label: "Comentários dos vídeos concorrentes lidos", tip: "Goldmine de dúvidas não respondidas" },
        { label: "Outline (esboço) da estrutura do vídeo" },
        { label: "Pontos de retenção mapeados (onde manter atenção?)" },
      ],
      tips: [
        "Leia os 50 comentários mais curtidos em vídeos do mesmo tema — são perguntas não respondidas",
        "Use o 'autocomplete' do YouTube para encontrar sub-tópicos que as pessoas buscam",
        "Estruture o vídeo em capítulos — ajuda SEO e retenção",
        "Identifique o 'valley of death' (minuto 2-4) e planeje algo forte ali",
      ],
      aiPromptContext: "Ajude a pesquisar e estruturar o conteúdo deste vídeo longo. Sugira: outline com capítulos, pontos de dados interessantes, perguntas que o público pode ter, e onde colocar ganchos de retenção (open loops).",
    },
    {
      id: "SCRIPT",
      label: "Roteiro",
      description: "Escrever roteiro completo com ganchos de retenção",
      checklist: [
        { label: "Intro/Hook (0-30s): Promessa clara + preview do valor", tip: "Nos primeiros 30s declare: o que vão aprender E por que importa" },
        { label: "Open loop criado no início (resolvido só depois)", tip: "'No final eu vou revelar X que mudou tudo...' mantém até o fim" },
        { label: "Capítulos definidos com transições claras" },
        { label: "Pattern interrupt a cada 60-90 segundos", tip: "Mudança visual, B-roll, gráfico, mudança de energia" },
        { label: "Momentos de re-engajamento nos minutos 2-4", tip: "Valley of death — pico de drop-off" },
        { label: "Conclusão com CTA (inscrever, próximo vídeo, playlist)" },
        { label: "End screen planejada (últimos 20s)" },
      ],
      tips: [
        "INTRO: 'Neste vídeo você vai aprender [RESULTADO] que [BENEFÍCIO]. E no final vou mostrar [OPEN LOOP]'",
        "Nunca diga 'antes de começar...' — comece direto no conteúdo",
        "A cada capítulo novo, faça um mini-hook: 'O próximo ponto é o mais importante...'",
        "Use a estrutura PAS em cada seção: Problem → Agitate → Solve",
        "Escreva como fala. Leia em voz alta — se soa robótico, reescreva",
        "Marque no roteiro: [B-ROLL], [GRÁFICO], [CUTAWAY] para guiar a edição",
      ],
      aiPromptContext: "Escreva um roteiro de vídeo longo para YouTube. Estrutura: HOOK (0-30s com promessa e open loop) → CAPÍTULOS (cada um com mini-hook, conteúdo denso, e transição) → CONCLUSÃO (resolver open loop + CTA). Marque [B-ROLL], [GRÁFICO], [CORTE] para edição. Tom conversacional, cada parágrafo com propósito claro.",
    },
    {
      id: "RECORDING",
      label: "Gravação",
      description: "Gravar com qualidade profissional",
      checklist: [
        { label: "Câmera configurada (mín. 1080p, ideal 4K)" },
        { label: "Áudio com microfone dedicado (lapela ou shotgun)", tip: "Áudio > vídeo em importância. Invista aqui primeiro" },
        { label: "Iluminação 3-point ou ring light + preenchimento" },
        { label: "Cenário organizado e coerente com a marca" },
        { label: "Teleprompter ou notas de apoio preparados" },
        { label: "Energia alta na intro (primeiros 30s)" },
        { label: "B-roll gravado para cobrir cortes" },
      ],
      tips: [
        "Grave a intro por último — quando está mais aquecido e confiante",
        "Faça pausas curtas entre seções (facilita edição)",
        "Varie a energia: seções sérias vs entusiastas mantêm interesse",
        "Grave 2-3 versões do hook — escolha o melhor na edição",
        "Eye contact com a câmera é obrigatório — cole um adesivo ao lado da lente",
      ],
      aiPromptContext: "Sugira direções de gravação para este vídeo longo: setup de câmera, dicas de enquadramento, momentos que precisam de mais energia, sugestões de B-roll, e como manter naturalidade em gravações longas.",
    },
    {
      id: "EDITING",
      label: "Edição",
      description: "Editar mantendo ritmo e retenção alta",
      checklist: [
        { label: "Cortes de silêncio e 'uhms' removidos" },
        { label: "Pattern interrupts visuais a cada 30-60s", tip: "B-roll, zoom, lower thirds, gráficos" },
        { label: "Música de fundo (baixa, ambiente, muda por seção)" },
        { label: "Capítulos/timestamps adicionados", tip: "Capítulos melhoram SEO e experiência" },
        { label: "Lower thirds e gráficos informativos" },
        { label: "Cards internos apontando para vídeos relacionados" },
        { label: "End screen com vídeo sugerido (últimos 20s)" },
        { label: "Exportação em alta qualidade (1080p mín, bitrate alto)" },
      ],
      tips: [
        "A regra dos 8 segundos: nenhum plano deve durar mais de 8s sem corte ou elemento visual novo",
        "Use J-cuts e L-cuts para transições suaves entre seções",
        "Adicione SFX sutis em transições de capítulo",
        "O ritmo de edição deve acelerar gradualmente ao longo do vídeo",
        "Color grade consistente = profissionalismo",
      ],
      aiPromptContext: "Sugira plano de edição para este vídeo longo: pontos de corte, onde inserir B-roll/gráficos, sugestão de música por seção, timestamps de capítulos, e elementos visuais que aumentam retenção.",
    },
    {
      id: "THUMBNAIL",
      label: "Thumbnail & Título",
      description: "Criar thumbnail e título otimizados para CTR",
      checklist: [
        { label: "3+ variações de thumbnail criadas", tip: "A/B test se possível" },
        { label: "Rosto com expressão forte (surpresa, empolgação, choque)", tip: "Thumbnails com rosto têm 30% mais cliques" },
        { label: "Texto grande e legível (3-5 palavras máximo)" },
        { label: "Contraste alto de cores (destaca no feed)" },
        { label: "Título final com < 60 caracteres", tip: "Títulos cortam em mobile após ~50 chars" },
        { label: "Título cria curiosity gap (promete sem revelar)" },
        { label: "Título + Thumbnail contam histórias complementares (não repetitivas)" },
      ],
      tips: [
        "TÍTULO e THUMBNAIL são 80% do sucesso — gaste tempo aqui",
        "Teste a thumbnail: reduza a 20% do tamanho — ainda comunica?",
        "Cores quentes (amarelo, vermelho) performam melhor em thumbnails",
        "Nunca coloque o mesmo texto no título e na thumbnail",
        "Fórmulas: Número + Adjetivo + Keyword + Promessa ('7 Erros FATAIS que Destroem Seu...'')",
        "CTR alvo: 8-12% bom, > 15% excelente",
      ],
      aiPromptContext: "Gere opções de título e descrição de thumbnail para este vídeo. Títulos: 5 variações com curiosity gap, < 60 chars. Thumbnails: descreva composição visual (expressão facial, cores, texto overlay, elementos) para 3 variações. Título e thumbnail devem ser complementares, não repetitivos.",
    },
    {
      id: "REVIEW",
      label: "Revisão",
      description: "Checagem final de qualidade",
      checklist: [
        { label: "Assistiu o vídeo inteiro como espectador" },
        { label: "Intro mantém atenção nos primeiros 30s?" },
        { label: "Há valleys (trechos chatos)? Se sim, cortar ou adicionar elemento" },
        { label: "Descrição otimizada com keywords" },
        { label: "Tags adicionadas (15-25 relevantes)" },
        { label: "Legenda/subtitle verificada" },
        { label: "Cards e end screens configurados" },
      ],
      tips: [
        "Se você pular algum trecho assistindo, o espectador também vai",
        "A descrição deve ter a keyword principal nas primeiras 2 linhas",
        "Adicione timestamps na descrição = capítulos automáticos",
      ],
      aiPromptContext: "Revise este conteúdo de vídeo longo: a intro é forte? Há pontos de queda de atenção? O título gera clique? Sugira melhorias na descrição e tags para SEO.",
    },
    {
      id: "SCHEDULED",
      label: "Agendamento",
      description: "Agendar publicação estrategicamente",
      checklist: [
        { label: "Horário de publicação otimizado", tip: "2-3h antes do pico do público (17h-20h geralmente)" },
        { label: "Community tab/stories anunciando" },
        { label: "Notificação de engajamento ativo nas primeiras 2h" },
      ],
      tips: [
        "As primeiras 2 horas são críticas — responda todos os comentários",
        "Publique de terça a quinta para melhor performance inicial",
        "Use premieres para criar evento e gerar buzz",
      ],
      aiPromptContext: "Sugira estratégia de lançamento: copy para community tab, horário ideal, ações de engajamento nas primeiras horas, e descrição otimizada para SEO.",
    },
    {
      id: "PUBLISHED",
      label: "Publicado",
      description: "Monitorar e iterar",
      checklist: [
        { label: "Métricas de 48h documentadas (CTR, AVD, retenção)" },
        { label: "Gráfico de retenção analisado (onde caem?)" },
        { label: "Comentários respondidos" },
        { label: "Lições para próximo vídeo anotadas" },
      ],
      tips: [
        "CTR > 10% + AVD > 50% = algoritmo vai empurrar forte",
        "Analise o gráfico de retenção: cada queda é uma lição",
        "Se CTR alto + AVD baixa = thumbnail/título bons mas conteúdo decepcionou",
        "Se CTR baixo + AVD alta = conteúdo bom mas título/thumb fracos",
      ],
      aiPromptContext: "Analise as métricas deste vídeo e sugira: diagnóstico de performance (CTR vs AVD), o que melhorar, e se vale criar vídeo complementar ou atualização.",
    },
  ],
  bestPractices: [
    "MUDANÇA 2026: YouTube prioriza SATISFAÇÃO sobre watch time — 100% de 8min > 40% de 25min",
    "80% do sucesso é título + thumbnail. Invista tempo desproporcional nisso",
    "Os primeiros 30 segundos decidem se o espectador fica ou sai",
    "Use open loops para manter retenção ('Vou revelar no final...')",
    "Browse feed agora usa micro-nicho clustering — conteúdo genérico perde visibilidade",
    "Séries em playlist são POWER SIGNAL: viewer assistir múltiplos episódios em sessão = boost forte",
    "Consistência de publicação (3x/semana) supera 7 vídeos numa semana e depois nenhum",
    "CTR é avaliado RELATIVO à média do canal — não em números absolutos",
    "CTR alto + retenção baixa = PREJUDICA (algoritmo lê como 'promessa quebrada')",
    "Comentários longos e shares pesam mais que likes passivos em 2026",
    "Estude seu gráfico de retenção — é o feedback mais valioso",
  ],
  commonMistakes: [
    "Intro longa com logos, jingles, 'fala galera' antes do conteúdo",
    "Título genérico sem curiosity gap",
    "Thumbnail com texto pequeno demais ou sem rosto",
    "Não analisar gráfico de retenção para iterar",
    "Espaçar publicações demais (inconsistência)",
    "Pedir para inscrever antes de entregar valor",
    "Não usar capítulos/timestamps na descrição",
    "Mesma energia do início ao fim (sem variação)",
  ],
  kpis: [
    { label: "CTR (Click-Through Rate)", target: "Acima da média do canal", why: "YouTube avalia CTR RELATIVO ao seu canal — não existe número absoluto ideal" },
    { label: "AVD (Average View Duration)", target: "> 50%", why: "50-60% é sólido. 70%+ ganha placement prioritário em Suggested" },
    { label: "Satisfaction score", target: "Alto (surveys)", why: "NOVO 2026: YouTube mede satisfação pós-visualização — supera watch time puro" },
    { label: "Retenção no primeiro minuto", target: "> 70%", why: "Se perder 30% logo, dificilmente recupera" },
    { label: "Session contribution", target: "Viewer continua assistindo", why: "Vídeos que levam a mais visualizações ganham mais sugestões" },
    { label: "Inscritos por vídeo", target: "> 1-2% dos views", why: "Mede conversão em audiência recorrente" },
  ],
  scriptTemplates: [
    {
      name: "Tutorial / How-To",
      structure: [
        "HOOK (0-30s): Mostrar resultado final + promessa ('Ao final deste vídeo você vai saber fazer X')",
        "CONTEXTO (30s-1min): Por que isso importa + open loop",
        "PASSO 1-N (corpo): Cada passo com mini-hook + demonstração + dica pro",
        "BÔNUS (pré-conclusão): Dica extra que ninguém ensina",
        "CONCLUSÃO: Recapitular + resolver open loop + CTA",
      ],
    },
    {
      name: "Análise / Essay",
      structure: [
        "HOOK (0-30s): Tese controversa ou surpreendente",
        "SETUP (1-3min): Contextualizar o tema, dados de apoio",
        "ARGUMENTO 1-3: Cada um com evidência + storytelling",
        "PLOT TWIST: Virada ou perspectiva inesperada",
        "CONCLUSÃO: Síntese + reflexão + CTA",
      ],
    },
    {
      name: "Ranking / Listicle",
      structure: [
        "HOOK (0-30s): Teaser do #1 + por que a lista importa",
        "ITEM N → 2: Do menos ao mais impactante (crescendo)",
        "PRÉ-#1: Build up de anticipação ('E o número 1...')",
        "#1: O melhor item com explicação detalhada",
        "MENÇÃO HONROSA (pós-conclusão): Bônus inesperado + CTA",
      ],
    },
  ],
  sources: [
    { title: "YouTube Algorithm 2026 — vidIQ", url: "https://vidiq.com/blog/post/understanding-youtube-algorithm/", description: "Como o algoritmo do YouTube funciona em 2026: satisfação, retention, CTR relativo" },
    { title: "YouTube Algorithm Updates 2026 — OutlierKit", url: "https://outlierkit.com/resources/youtube-algorithm-updates/", description: "Todas as mudanças do algoritmo: browse feed, micro-nicho, Shorts desacoplado" },
    { title: "YouTube December 2025 Algorithm Update — Dataslayer", url: "https://www.dataslayer.ai/blog/youtubes-december-2025-algorithm-update-browse-feed-cut-long-videos-by-80", description: "Mudança do browse feed: redução de 80% em recomendações de long-form" },
    { title: "YouTube Algorithm — SocialBee", url: "https://socialbee.com/blog/youtube-algorithm/", description: "Guia completo do algoritmo YouTube para 2026" },
    { title: "Balance Shorts and Long-Form 2026", url: "https://marketingagent.blog/2026/02/15/how-to-balance-youtube-shorts-and-long-form-content-for-maximum-roi-in-2026-optimizing-both-formats/", description: "Como balancear Shorts e long-form para ROI máximo" },
  ],
  lastUpdated: "2026-04-11",
}

// ─────────────────────────────────────────────────────────────────────────────
// SKILL 3: INSTAGRAM (Carrosséis, Reels, Stories, Feed)
// ─────────────────────────────────────────────────────────────────────────────

const INSTAGRAM: ContentSkill = {
  id: "INSTAGRAM",
  label: "Instagram",
  icon: "📸",
  description: "Carrosséis, Reels (30s–3min), Stories e Posts",
  platforms: ["INSTAGRAM"],
  phases: [
    {
      id: "IDEA",
      label: "Ideação",
      description: "Definir formato, ângulo e mensagem",
      checklist: [
        { label: "Formato definido (Carrossel, Reel, Post estático, Story)", tip: "Carrosséis têm 2-3x mais alcance que posts estáticos em 2025" },
        { label: "Pilar de conteúdo identificado (educar, entreter, inspirar, vender)" },
        { label: "Hook visual ou textual definido" },
        { label: "Objetivo do post (alcance, engajamento, conversão, DM)" },
        { label: "CTA planejado (salvar, compartilhar, comentar, link)" },
      ],
      tips: [
        "Carrosséis têm 10% de engagement rate (vs Reels 6% e fotos 7%) — são o formato #1 para engajamento profundo",
        "Reels geram 1.36x mais alcance, mas carrosséis têm 3.1x mais engagement que posts simples",
        "Instagram re-serve slides não vistos para o mesmo usuário depois — mais slides = mais impressões orgânicas",
        "Keywords em captions e perfil são MAIS efetivos que hashtags para descoberta em 2026",
        "Carrosséis educacionais são o formato mais consistente em engajamento",
        "Misture pilares: 40% valor/educação, 30% entretenimento, 20% inspiração, 10% venda",
        "O Instagram prioriza Saves e Shares sobre Likes — crie conteúdo 'salvável'",
      ],
      aiPromptContext: "Gere ideias de conteúdo para Instagram. Para cada ideia inclua: formato (Carrossel/Reel/Story), hook, estrutura, CTA, e por que esse formato é o ideal para essa mensagem. Foque em formatos que geram saves e shares.",
    },
    {
      id: "SCRIPT",
      label: "Copywriting",
      description: "Escrever copy, slides ou roteiro do conteúdo",
      checklist: [
        { label: "Hook no primeiro slide/frame (parar o scroll)", tip: "Primeira linha da caption e primeiro slide são TUDO" },
        { label: "Conteúdo de valor em cada slide/seção" },
        { label: "CTA no último slide/final da caption" },
        { label: "Caption escrita com hook na primeira linha", tip: "Apenas as 2 primeiras linhas aparecem antes do 'mais'" },
        { label: "Hashtags pesquisadas (5-15, relevantes ao nicho)", tip: "Mix: 5 grandes + 5 médias + 5 nicho" },
      ],
      tips: [
        "CARROSSEL: 6-13 slides ideal. Slide 1 = hook (parar scroll). Slides 2-8 = narrativa coesa. Slides 7-9 = dados/prova. Slide 10-11 = interação. Último = CTA explícito",
        "Mix de imagem + vídeo nos slides performa melhor que formato único",
        "Carrosséis têm 95% mais saves e 41% mais growth de seguidores que outros formatos",
        "HOOKS DE CAPTION: 'Pare de fazer X se quer Y', 'O que ninguém te conta sobre X', 'Salva esse post se você...'",
        "Use line breaks na caption — blocos de texto denso = skip",
        "CTA patterns: 'Salva pra depois', 'Marca quem precisa ver', 'Manda nos stories', 'Link na bio'",
        "REEL caption: curta (1-2 linhas) + hashtags. A mensagem vai no vídeo",
        "Emojis com moderação — 1-2 por parágrafo, não em cada frase",
      ],
      aiPromptContext: "Escreva o conteúdo para este post de Instagram. Se carrossel: texto de cada slide + caption. Se Reel: roteiro + caption curta. Se post: caption completa. Inclua hook forte na primeira linha, CTAs de save/share, e sugira 10 hashtags relevantes (mix de tamanhos).",
    },
    {
      id: "RECORDING",
      label: "Design / Gravação",
      description: "Criar os visuais ou gravar o conteúdo",
      checklist: [
        { label: "Identidade visual consistente (cores, fontes, estilo)", tip: "Templates reutilizáveis economizam 80% do tempo" },
        { label: "Formato correto: Feed 1:1 ou 4:5, Reels 9:16, Stories 9:16" },
        { label: "Texto legível em tela de celular (tamanho mínimo 24pt)" },
        { label: "Contraste alto entre texto e fundo" },
        { label: "Imagens de alta qualidade (sem pixelização)" },
        { label: "Se Reel: mesmas dicas de vídeo curto aplicam" },
      ],
      tips: [
        "Crie 3-5 templates de carrossel reutilizáveis (Canva, Figma)",
        "Feed 4:5 (1080x1350) ocupa mais espaço no feed = mais atenção",
        "Mantenha no máximo 2 fontes e 3 cores da marca por post",
        "O primeiro slide do carrossel é sua 'thumbnail' — tratamento premium",
        "Rostos humanos geram 38% mais engajamento que gráficos puros",
      ],
      aiPromptContext: "Sugira direções visuais para este conteúdo de Instagram: estilo do design, cores, layout dos slides, elementos visuais, e composição da imagem/vídeo.",
    },
    {
      id: "REVIEW",
      label: "Revisão",
      description: "Revisar visual, copy e experiência completa",
      checklist: [
        { label: "Swipou pelo carrossel/assistiu o Reel como espectador" },
        { label: "Hook do primeiro slide/frame para o scroll?" },
        { label: "Texto sem erros e tom adequado?" },
        { label: "CTA claro e natural?" },
        { label: "Hashtags relevantes e não banidas?" },
        { label: "Alt text adicionado (acessibilidade + SEO)" },
        { label: "Preview do grid: combina com posts anteriores?" },
      ],
      tips: [
        "Teste em tela de celular real — 95% do consumo é mobile",
        "Verifique se todas hashtags são permitidas (hashtags banidas = shadowban)",
        "A primeira impressão no grid importa — zoom out e veja o conjunto",
      ],
      aiPromptContext: "Revise este conteúdo de Instagram e dê feedback: o hook é forte? A copy é engajante? O CTA é efetivo? Sugira melhorias na caption, hashtags e visual.",
    },
    {
      id: "SCHEDULED",
      label: "Agendamento",
      description: "Agendar para o melhor horário com estratégia",
      checklist: [
        { label: "Horário de pico do público (ver Insights)", tip: "Geralmente 12h-14h e 18h-21h performam melhor" },
        { label: "Story de antecipação agendada (teaser)" },
        { label: "Plano de engajamento: responder comentários nos primeiros 30min" },
        { label: "Story de repost após publicar (amplifica alcance)" },
      ],
      tips: [
        "Os primeiros 30 minutos são cruciais — engajamento rápido = Explore page",
        "Poste um Story apontando pro post novo (arrasta pra ver)",
        "Frequência ideal: 3-5 posts/semana + Stories diários",
        "Responda TODOS os comentários — especialmente os longos (algoritmo pesa)",
      ],
      aiPromptContext: "Sugira estratégia de publicação para este conteúdo de Instagram: horário, copy do story de divulgação, plano de engajamento pós-publicação, e sequência de stories complementares.",
    },
    {
      id: "PUBLISHED",
      label: "Publicado",
      description: "Monitorar métricas e aprender",
      checklist: [
        { label: "Métricas de 24h documentadas (alcance, saves, shares)" },
        { label: "Comentários respondidos" },
        { label: "Post fixado se teve alta performance" },
        { label: "Lições anotadas para próximos posts" },
      ],
      tips: [
        "Saves > Shares > Comments > Likes (em ordem de valor algorítmico)",
        "Se um carrossel performou bem, faça uma 'parte 2'",
        "Use Insights para mapear horários e formatos que funcionam para SEU público",
        "Repost conteúdo top nos Stories a cada 3-4 semanas (recicle)",
      ],
      aiPromptContext: "Analise as métricas deste post de Instagram e sugira: o que contribuiu para a performance, o que melhorar, e se vale reciclar/expandir este conteúdo.",
    },
  ],
  bestPractices: [
    "Carrosséis = 10% engagement rate, 95% mais saves, 3.1x mais engagement que fotos — priorizem",
    "3 sinais que MAIS importam em 2026: watch time, likes/reach ratio, e sends/DM por reach",
    "Sends via DM são o sinal MAIS pesado para Reels no algoritmo de 2026",
    "Comentários longos (5+ palavras) pesam MUITO mais que emoji-only no algoritmo",
    "Keywords em captions > hashtags para descoberta (Instagram confirmou em 2025)",
    "Cadência por tamanho: <10K = 2-3 Reels + 1 carrossel/semana. 10-100K = 1-2 Reels + 2-3 carrosséis. >100K = 1 Reel + 3-4 carrosséis",
    "Reposte top carrosséis a cada 6-8 semanas — são ativos renováveis, não one-shot",
    "Reels 60s-3min performam melhor para educação. 30s para trends virais. Formato de até 3min é o padrão em 2026",
    "Consistência visual (brand templates) = reconhecimento instantâneo no feed",
    "Stories diários mantêm você no topo do feed (story ring)",
    "Primeiros 30 min são críticos — engajamento rápido = Explore page",
    "Perguntas que exigem 5+ palavras de resposta geram mais peso algorítmico",
    "Mix carrossel imagem+vídeo performa melhor que formato único",
  ],
  commonMistakes: [
    "Texto muito pequeno no carrossel (ilegível no celular)",
    "Postar sem caption ou com caption genérica",
    "Hashtags banidas ou 100% genéricas (#love #happy)",
    "Inconsistência visual no grid (parece conta abandonada)",
    "Focar em likes em vez de saves e shares",
    "Não usar Stories (perde visibilidade no topo do feed)",
    "Repostar Reel com marca d'água do TikTok (penalizado)",
    "Caption que não tem hook na primeira linha",
    "Não responder comentários (mata engajamento)",
    "Postar mais de 30 hashtags (spam signal)",
  ],
  kpis: [
    { label: "Engagement Rate (carrossel)", target: "> 10%", why: "Média de carrosséis em 2026 é 10%. Acima = top performer" },
    { label: "Taxa de Saves", target: "> 3% do alcance", why: "Saves são o sinal PREMIUM — carrosséis geram 95% mais saves" },
    { label: "Sends/DM per reach", target: "> 1%", why: "PRINCIPAL sinal de distribuição para Reels em 2026" },
    { label: "Comentários longos", target: "5+ palavras", why: "Comentários detalhados pesam muito mais que emojis no algoritmo" },
    { label: "Swipe-through rate", target: "> 60%", why: "% que passa do slide 1 — slides não vistos são re-servidos" },
    { label: "Story Completion Rate", target: "> 70%", why: "Mede se seus stories mantêm atenção" },
    { label: "Profile Visits → Follows", target: "> 10%", why: "Mede conversão de curiosos em seguidores" },
  ],
  scriptTemplates: [
    {
      name: "Carrossel Educacional",
      structure: [
        "SLIDE 1 (Hook): Título impactante + subtítulo contextualizando",
        "SLIDE 2: O problema / por que isso importa",
        "SLIDES 3-8: Uma dica/ponto por slide (visual + texto curto)",
        "SLIDE 9: Recap / resumo visual",
        "SLIDE 10: CTA ('Salva pra depois' + 'Segue pra mais')",
      ],
    },
    {
      name: "Carrossel Storytelling",
      structure: [
        "SLIDE 1 (Hook): Situação intrigante ou resultado",
        "SLIDE 2-3: Setup / contexto",
        "SLIDE 4-6: Desenvolvimento / conflito",
        "SLIDE 7-8: Virada / resolução",
        "SLIDE 9: Lição aprendida",
        "SLIDE 10: CTA + pergunta para comentários",
      ],
    },
    {
      name: "Reel Instagram",
      structure: [
        "HOOK (1-3s): Texto bold + frase impactante",
        "CONTEÚDO (15-30s): Mesma estrutura de vídeo curto",
        "CTA (3s): Pedir save/follow",
        "CAPTION: 1-2 linhas + hashtags",
      ],
    },
    {
      name: "Story Sequence (Engajamento)",
      structure: [
        "STORY 1: Pergunta ou enquete (aquecer)",
        "STORY 2: Contexto / problema",
        "STORY 3-5: Conteúdo / dicas",
        "STORY 6: Slider de reação ou quiz",
        "STORY 7: CTA (link, DM, ver post novo)",
      ],
    },
  ],
  sources: [
    { title: "Instagram Algorithm 2026 — Buffer", url: "https://buffer.com/resources/instagram-algorithms/", description: "Guia completo do algoritmo Instagram: Feed, Stories, Reels, Explore" },
    { title: "Instagram Carousel Strategy 2026 — Marketing Agent", url: "https://marketingagent.blog/2026/01/03/mastering-instagram-carousel-strategy-in-2026-the-algorithm-demands-swipes-not-just-scrolls/", description: "Estratégia completa de carrosséis: engagement 10%, swipe mechanics, 6-13 slides" },
    { title: "Instagram Reach 2026 — TrueFuture Media", url: "https://www.truefuturemedia.com/articles/instagram-reach-2026-algorithm-reels-carousels-caption-seo", description: "Como crescer com Reels, Carrosséis e Caption SEO" },
    { title: "Instagram Algorithm 2026 — Sprout Social", url: "https://sproutsocial.com/insights/instagram-algorithm/", description: "Análise completa do algoritmo com dados de engagement" },
    { title: "Instagram Algorithm Tips 2026 — Hootsuite", url: "https://blog.hootsuite.com/instagram-algorithm/", description: "Dicas práticas para otimização no algoritmo Instagram" },
    { title: "Instagram Reels Algorithm 2026 — EvergreenFeed", url: "https://www.evergreenfeed.com/blog/instagram-reels-algorithm/", description: "Como funciona o algoritmo de Reels: sends/DM como principal sinal" },
  ],
  lastUpdated: "2026-04-11",
}

// ─────────────────────────────────────────────────────────────────────────────
// SKILL 4: RESEARCH (Busca e curadoria de ideias)
// ─────────────────────────────────────────────────────────────────────────────

const RESEARCH: ContentSkill = {
  id: "RESEARCH",
  label: "Pesquisa & Tendências",
  icon: "🔍",
  description: "Busca pioneira de notícias: web_search + web_fetch + triangulação + pioneer-score",
  platforms: ["YOUTUBE", "TIKTOK", "INSTAGRAM"],
  phases: [
    {
      id: "IDEA",
      label: "Setup de termos",
      description: "Calibrar os termos monitorados — base de toda a pesquisa",
      checklist: [
        { label: "5-10 termos ativos no monitor", tip: "Menos que 5 = pouca cobertura; mais que 10 = ruído e custo alto" },
        { label: "Termos são entidades/conceitos, não genéricos", tip: "'IA generativa em saúde' > 'inteligência artificial'" },
        { label: "Mix de termos estáveis (evergreen) + quentes (trending)", tip: "~70% evergreen, ~30% trending pra ter sempre algo pra publicar" },
        { label: "Termos em português + variação em inglês quando aplicável", tip: "Tecnologia e ciência quebram em inglês primeiro" },
        { label: "Revisar termos a cada 2 semanas — remover os sem output", tip: "Se um termo não gerou 1 ideia aproveitável em 14 dias, está errado" },
      ],
      tips: [
        "Termo bom é SPECIFIC: 'Claude Opus 4.7 API' > 'Claude' > 'IA'",
        "Termos com nome próprio (empresa, produto, pessoa) retornam mais sinal",
        "Evite termos que viram clickbait fácil — você quer notícia, não gossip",
        "Use o próprio Google Trends pra ver se o termo tem volume antes de ativar",
      ],
      aiPromptContext: "Sugira 5-10 termos monitoráveis para o nicho do usuário. Cada termo deve ser específico (ex: 'modelos de IA open-source' não 'IA'), acionável (deve retornar notícias reais) e diferenciado (não se sobrepor a outros termos).",
    },
    {
      id: "RESEARCH",
      label: "Busca & Triangulação",
      description: "Executar busca real na web, ler as matérias, priorizar ineditismo",
      checklist: [
        { label: "Pesquisa executada nas últimas 24h", tip: "Janela ideal: 24h. Aceitável: 48h. Limite: 72h." },
        { label: "Cada ideia tem URL real da matéria primária (não redirect)", tip: "Se o link é google.com/url?q=... precisa resolver" },
        { label: "Fonte está em tier-1 (veículo estabelecido) ou foi triangulada", tip: "2+ fontes independentes = notícia validada" },
        { label: "Ângulo único — não é só paráfrase do título original" },
        { label: "pioneerScore ≥ 75 pra ir pra produção", tip: "Abaixo disso é 'notícia quente que todos já cobriram'" },
        { label: "Idioma da fonte registrado (pt-BR / en / es)" },
      ],
      tips: [
        "Triangulação > volume: 3 ideias com 2+ fontes cada > 10 ideias de fonte única",
        "Inglês quebra primeiro — se a matéria só existe em EN, é lacuna pra explorar em PT",
        "Fetch o corpo da matéria: o ângulo bom está no 3º parágrafo, não no título",
        "Ignore agregadores de notícias (MSN, Yahoo, Uol portal) — vá na fonte primária",
        "Matéria com horário de publicação explícito (não só data) é mais confiável",
        "Se o Claude retornar 0 ideias, é sinal honesto — termos podem estar ruins ou janela muito apertada",
        "Duplicidade: se 2 ideias tem a mesma sourceUrl, são a mesma notícia — mantenha só a de maior pioneerScore",
      ],
      aiPromptContext: "Use web_search pra pesquisar notícias das últimas 72h dos termos monitorados. Use web_fetch pra ler o corpo das matérias promissoras. Retorne JSON estruturado com URL real, data de publicação, pioneer-score honesto (recência × autoridade × lacuna em PT × triangulação). 0 ideias reais é melhor que 10 inventadas.",
    },
  ],
  bestPractices: [
    "JANELA: últimas 24h é ouro, 48h é prata, 72h já é commodity. Acima de 72h = trend saturado.",
    "TRIANGULAÇÃO: 1 fonte = especulação, 2 fontes independentes = notícia, 3+ = trend consolidada. Priorize triangulação sobre volume.",
    "AUTORIDADE: tier-1 (Folha/Estadão/G1/Valor no BR; NYT/FT/Bloomberg/Reuters no mundo) > tier-2 (blogs verticais) > agregadores (evitar).",
    "LACUNA EM PT: notícia quente em inglês ainda sem cobertura em português = janela de 6-24h pra virar primeiro criador do BR.",
    "LEITURA DO CORPO: nunca gere ideia só com título. Use web_fetch ou abra a matéria. O ângulo original está no meio do texto, não no SEO.",
    "ÂNGULO CONTRARIAN: 'o que ninguém tá falando sobre X' > 'X acabou de acontecer' (todos vão fazer o segundo).",
    "TERMOS ESPECÍFICOS: 'Copa do Mundo Feminina 2027' > 'futebol' — amplitude dilui o sinal.",
    "CROSS-IDIOMA: pesquise em PT e EN na mesma sessão. Fontes de tecnologia e ciência quebram em inglês primeiro.",
    "FRESHNESS BEATS POPULARITY: matéria de 6h com 10 comentários > matéria de 3 dias com 10k compartilhamentos.",
    "DOCUMENTAÇÃO: sem URL real + data de publicação, a ideia é inútil pra revisão futura e para o storytelling do conteúdo.",
    "CADÊNCIA: rodar pesquisa 2x por dia (manhã pra cobrir noite americana, tarde pra cobrir manhã europeia) se o nicho for tech/negócios.",
    "FEEDBACK LOOP: marque toda ideia usada vs descartada — termos que geram descarte alto precisam sumir.",
    "CUSTO: Claude Opus 4.7 com web_search custa ~$0.05-0.15 por rodada de pesquisa — cache do system prompt corta 60% em runs consecutivos.",
    "NÃO INVENTE: se a pesquisa não retorna nada relevante, 0 ideias honestas > 10 ideias inventadas. Conteúdo fake destrói credibilidade.",
  ],
  commonMistakes: [
    "Pedir pra IA 'pesquisar tendências' sem ferramenta de busca real — Claude sem web_search alucina fontes plausíveis mas falsas.",
    "Aceitar URL do Google News (redirect) como fonte — é um proxy, não a matéria. Sempre resolver pra URL canônica.",
    "Gerar ideia só com título — o título é otimizado pra SEO, não captura o ângulo interessante da notícia.",
    "Rodar a pesquisa 1x e esquecer — trends têm meia-vida de 24-48h; cadência diária é mínimo.",
    "Monitorar termo genérico ('marketing', 'negócios') — resultados viram ruído; especificidade é rainha.",
    "Ignorar lacuna em português — copiar matéria já publicada em PT não gera pioneirismo.",
    "Pontuar todas as ideias em 95+ — se 'score' não discrimina, não informa decisão.",
    "Não marcar ideia usada/descartada — sem esse feedback, impossível saber quais termos performam.",
    "Buscar em 1 idioma só — fontes em inglês quebram tech/ciência primeiro; pesquisa em 2 idiomas dobra a cobertura.",
    "Confundir 'notícia quente' com 'algo pra criador' — nem toda tragédia ou polêmica vira conteúdo saudável de se fazer.",
  ],
  kpis: [
    { label: "Ideias com sourceUrl válida", target: "100%", why: "Sem URL real, é alucinação — métrica fundamental de qualidade." },
    { label: "% triangulado (2+ fontes)", target: "> 40%", why: "Ideias trianguladas têm menor risco de virar fake news." },
    { label: "Latência publicação → ideia", target: "< 12h", why: "Captar matéria em menos de 12h dá janela pra publicar antes da saturação." },
    { label: "pioneerScore médio", target: "> 80", why: "Acima de 80 = recente, autoritativa, com lacuna. Abaixo = commodity." },
    { label: "% de ideias usadas", target: "> 20%", why: "Conversão baixa indica termos ruins ou filtro fraco." },
    { label: "Ideias geradas / semana", target: "25-50", why: "Menos = falta de cobertura. Mais = termos muito amplos, virou ruído." },
    { label: "Custo por ideia usada", target: "< $0.10", why: "Cost/ideia publicada — o que realmente importa financeiramente." },
  ],
  scriptTemplates: [
    {
      name: "Query de busca — notícia quente",
      structure: [
        "<termo monitorado> últimas 24h",
        "<termo monitorado> notícia site:folha.uol.com.br OR site:g1.globo.com OR site:estadao.com.br",
        "<termo monitorado> news latest (fonte em inglês primeiro)",
        "<termo monitorado> <ano/mês corrente> (fixar janela temporal)",
      ],
    },
    {
      name: "Query de busca — lacuna em PT",
      structure: [
        "<English keyword> breaking news",
        "Verificar se existe cobertura em PT: <termo português> após conseguir keyword",
        "Se 0 resultado em PT nas últimas 48h = janela de pioneirismo aberta",
      ],
    },
    {
      name: "Ângulo contrarian a partir de notícia",
      structure: [
        "Todos vão cobrir: <fato da matéria>",
        "Ninguém vai perguntar: <segunda ordem — 'e se X?', 'quem perde com isso?', 'o que isso implica em 6 meses?'>",
        "Seu ângulo: <reframing baseado na segunda ordem>",
      ],
    },
  ],
  sources: [
    // Tier-1 notícia geral — Brasil
    { title: "G1 (Globo)", url: "https://g1.globo.com/", description: "Agregador tier-1 BR — cobertura ampla, boa pra generalistas" },
    { title: "Folha de S.Paulo", url: "https://www.folha.uol.com.br/", description: "Tier-1 BR — política, economia, cultura (paywall parcial)" },
    { title: "Estadão", url: "https://www.estadao.com.br/", description: "Tier-1 BR — negócios e investigações (paywall parcial)" },
    { title: "Valor Econômico", url: "https://valor.globo.com/", description: "Tier-1 BR — negócios, mercado, economia" },
    { title: "CNN Brasil", url: "https://www.cnnbrasil.com.br/", description: "Notícias 24h em PT-BR" },
    { title: "Agência Brasil", url: "https://agenciabrasil.ebc.com.br/", description: "Agência pública — notícias sem paywall, cobertura federal" },
    // Tier-1 notícia global
    { title: "Reuters", url: "https://www.reuters.com/", description: "Wire service — break first, verifica depois" },
    { title: "AP News", url: "https://apnews.com/", description: "Agência mundial — usada por todos os veículos grandes" },
    { title: "Bloomberg", url: "https://www.bloomberg.com/", description: "Negócios e mercados (paywall parcial)" },
    { title: "Financial Times", url: "https://www.ft.com/", description: "Negócios globais, análise profunda (paywall)" },
    { title: "The New York Times", url: "https://www.nytimes.com/", description: "Tech, cultura, política global (paywall)" },
    // Tecnologia (EN — quebram primeiro)
    { title: "The Verge", url: "https://www.theverge.com/", description: "Tech — consumo, gadgets, cultura digital" },
    { title: "TechCrunch", url: "https://techcrunch.com/", description: "Startups, rodadas, produtos emergentes" },
    { title: "Ars Technica", url: "https://arstechnica.com/", description: "Tech analítica — mais profundidade que velocidade" },
    { title: "Hacker News", url: "https://news.ycombinator.com/", description: "Curadoria de tech — o que engenheiros acham relevante AGORA" },
    { title: "MIT Technology Review", url: "https://www.technologyreview.com/", description: "IA, biotech, quantum — análise de fronteira" },
    // Tecnologia (PT)
    { title: "Olhar Digital", url: "https://olhardigital.com.br/", description: "Tech BR generalista — boa velocidade, profundidade média" },
    { title: "Tecmundo", url: "https://www.tecmundo.com.br/", description: "Tech BR — forte em consumo e mercado nacional" },
    { title: "NeoFeed", url: "https://neofeed.com.br/", description: "Negócios e startups BR" },
    // Sinais de tendência (não notícia)
    { title: "Google Trends BR", url: "https://trends.google.com.br/trending?geo=BR&hours=24", description: "O que BR está pesquisando nas últimas 24h" },
    { title: "Google Trends — Comparar", url: "https://trends.google.com.br/trends/explore", description: "Comparar volume de 2-5 termos lado a lado" },
    { title: "YouTube Trending BR", url: "https://www.youtube.com/feed/trending?gl=BR", description: "Vídeos em alta no Brasil" },
    { title: "TikTok Creative Center BR", url: "https://ads.tiktok.com/business/creativecenter/inspiration/popular/pc/pt", description: "Trends de hashtags, áudios e formatos no TikTok BR" },
    { title: "Reddit r/popular", url: "https://www.reddit.com/r/popular/", description: "Detector antecipado — memes aparecem aqui 24-48h antes" },
    { title: "Reddit r/brasil", url: "https://www.reddit.com/r/brasil/", description: "Discussões orgânicas BR — pegar sentimento de nicho" },
    { title: "X/Twitter Trending BR", url: "https://twitter.com/explore/tabs/trending", description: "Trending topics BR em tempo real" },
    // Inteligência de mercado
    { title: "Exploding Topics", url: "https://explodingtopics.com/topics", description: "Temas em crescimento antes de virarem mainstream" },
    { title: "Product Hunt", url: "https://www.producthunt.com/", description: "Produtos lançados hoje — sinal antecipado de tech" },
    { title: "AnswerThePublic", url: "https://answerthepublic.com/", description: "Perguntas que as pessoas pesquisam sobre um tema" },
    { title: "BuzzSumo", url: "https://buzzsumo.com/", description: "Conteúdo mais compartilhado por tema — identifica padrões" },
    // Oficial / dados primários
    { title: "IBGE", url: "https://www.ibge.gov.br/estatisticas/", description: "Dados oficiais BR — censo, inflação, mercado de trabalho" },
    { title: "ANP — preços de combustível", url: "https://www.anp.gov.br/", description: "Dados oficiais de preços — nicho logística/frete" },
    { title: "Banco Central", url: "https://www.bcb.gov.br/", description: "Selic, câmbio, dados monetários oficiais" },
  ],
  lastUpdated: "2026-04-18",
}

// ─────────────────────────────────────────────────────────────────────────────
// SKILL 5: INSTAGRAM REELS
// ─────────────────────────────────────────────────────────────────────────────

const INSTAGRAM_REELS: ContentSkill = {
  id: "INSTAGRAM_REELS",
  label: "Instagram Reels",
  icon: "🎞️",
  description: "Reels de 30s–3min otimizados para o algoritmo do Instagram",
  platforms: ["INSTAGRAM"],
  phases: SHORT_VIDEO.phases, // Same production phases
  bestPractices: [
    "Reels 60s-90s performam melhor para educação. 30s para trends virais",
    "Sends via DM são o sinal #1 para distribuição de Reels no Instagram",
    "Instagram prioriza conteúdo ORIGINAL — nunca reposte com marca d'água do TikTok",
    "Caption curta (1-2 linhas) + hashtags — a mensagem principal vai no vídeo",
    "Trending audio ajuda mas original audio com voiceover performa igual em 2026",
    "Responda TODOS os comentários nos primeiros 30 min — dispara distribuição",
    "Hook visual nos primeiros 1-2s é mais importante que hook falado no Reels",
    "Formato 9:16 (1080x1920) obrigatório — sem bordas ou letterbox",
    "Texto overlay grande e centralizado — 65% assistem sem som",
    "Perguntas que exigem 5+ palavras de resposta geram mais peso algorítmico",
    "Cover/thumbnail do Reel importa para o grid — mantenha identidade visual",
  ],
  commonMistakes: [
    "Repostar TikTok com marca d'água — Instagram penaliza",
    "Caption muito longa no Reels (a mensagem deve estar no vídeo)",
    "Não otimizar o cover para o grid do perfil",
    "Ignorar DM shares como métrica — é a mais importante",
    "Usar hashtags banidas ou genéricas (#love #happy)",
    "Não colocar texto overlay (65% assiste mudo)",
    "Hook lento — no Reels o swipe é instantâneo",
  ],
  kpis: [
    { label: "Sends/DM", target: "> 1% do alcance", why: "Principal sinal de distribuição para Reels em 2026" },
    { label: "Saves", target: "> 3% do alcance", why: "Sinal premium — indica conteúdo de valor" },
    { label: "Watch completion", target: "> 50%", why: "Reels com completion alta ganham Explore" },
    { label: "Comentários 5+ palavras", target: "Maioria", why: "Comentários longos pesam mais no algoritmo" },
  ],
  scriptTemplates: SHORT_VIDEO.scriptTemplates,
  sources: [
    { title: "Instagram Reels Algorithm 2026 — EvergreenFeed", url: "https://www.evergreenfeed.com/blog/instagram-reels-algorithm/", description: "Sends/DM como principal sinal" },
    { title: "Instagram Algorithm — Buffer", url: "https://buffer.com/resources/instagram-algorithms/", description: "Guia completo do algoritmo" },
  ],
  durationOptions: [
    {
      seconds: 30, label: "30s",
      strategyName: "Teaser Viral",
      strategyBrief: "Um fato bombástico + gancho que faz salvar. Sem contexto, só o punch.",
      hookGuide: "Visual impactante nos 1-2s + afirmação chocante na legenda (ex: 'ninguém te contou isso').",
      scriptGuide: "Uma mensagem central. Sem intro. 3 atos compactos: setup (5s) → revelação (15s) → CTA (5-10s). Cada frase tem que pagar aluguel.",
      titleGuide: "Curiosity gap em <40 chars. Pergunta aberta ou afirmação polêmica. Ex: 'Por que NINGUÉM fala disso?'",
      descriptionGuide: "Caption de 1 linha + 3-5 hashtags nicho. NÃO repita o que está no vídeo. Inclua CTA pra DM ou save.",
    },
    {
      seconds: 60, label: "60s",
      strategyName: "Fato + Contexto",
      strategyBrief: "Tempo pra explicar o fato + impacto prático. Sweet spot de Reels educacionais.",
      hookGuide: "Pergunta provocadora nos 3s. Visual + texto overlay simultâneos. Mantém suspense até os 15s.",
      scriptGuide: "Estrutura 3 atos: HOOK (3s) → CONTEXTO (15s) → DESENVOLVIMENTO (30s) → CTA (10s). Pattern interrupt a cada 5s (corte, zoom, texto). Open loop: abra algo no início que só resolve no final.",
      titleGuide: "Curiosity + specificity. Ex: 'Como X fez Y em 48h'. <60 chars. Evite clickbait óbvio.",
      descriptionGuide: "Caption 2-3 linhas com o 'porquê importa'. CTA pra DM + 5-7 hashtags específicas do nicho.",
    },
    {
      seconds: 90, label: "90s",
      strategyName: "Mini História",
      strategyBrief: "Storytelling compacto com reviravolta. Educação com emoção.",
      hookGuide: "Conflito ou dúvida aparente nos 3s ('Eu pensei que X, mas...'). Pessoal antes de profissional.",
      scriptGuide: "5 batidas: HOOK → SETUP → CONFLITO → CLIMAX → RESOLUÇÃO. Frase-chave aos 60s tem que gerar save. CTA pra seguir só depois da payoff emocional.",
      titleGuide: "Narrativa em 1 linha. 'A história de X que ninguém conta' ou 'O momento em que Y virou Z'.",
      descriptionGuide: "Caption conta a história em 4-5 linhas (continua ou contextualiza). CTA: 'salva pra quando você passar por isso'. Hashtags: 7-10 do nicho.",
    },
  ],
  lastUpdated: "2026-04-18",
}

// ─────────────────────────────────────────────────────────────────────────────
// SKILL 6: YOUTUBE SHORTS
// ─────────────────────────────────────────────────────────────────────────────

const YOUTUBE_SHORTS: ContentSkill = {
  id: "YOUTUBE_SHORTS",
  label: "YouTube Shorts",
  icon: "⚡",
  description: "Shorts de 30s–60s otimizados para o feed de Shorts do YouTube",
  platforms: ["YOUTUBE"],
  phases: SHORT_VIDEO.phases,
  bestPractices: [
    "YouTube Shorts tem 5.91% de engagement rate — supera TikTok (2.80%)",
    "Shorts e long-form são DESACOPLADOS desde 2025 — Shorts não prejudica vídeos longos",
    "Shorts são avaliados por: swipe-through rate, loop rate, shares, engajamento nos primeiros segundos",
    "Loop é POWER SIGNAL — faça o final conectar com o início para gerar replays",
    "Título do Short aparece na busca — use keywords que as pessoas pesquisam",
    "Shorts podem levar viewers para seus vídeos longos — mencione no CTA",
    "Monetização: $0.01-$0.07 por 1K views — volume é essencial",
    "Poste 1-2 Shorts por dia para máximo crescimento no algoritmo",
    "Shorts com caption/legenda automática performam 12% melhor",
    "O algoritmo do Shorts prioriza novidade — poste conteúdo original, não reciclado",
  ],
  commonMistakes: [
    "Repostar de outras plataformas com marca d'água",
    "Shorts com mais de 60 segundos (máximo absoluto da plataforma)",
    "Não usar título otimizado para busca/SEO",
    "Ignorar o loop — replays contam como watch time",
    "Postar Shorts esporadicamente (algoritmo recompensa consistência diária)",
    "Não incluir CTA para canal/vídeos longos",
    "Thumbnail ruim — Shorts também aparecem na busca com thumbnail",
  ],
  kpis: [
    { label: "Swipe-through rate", target: "Baixo (< 20%)", why: "% que passa sem assistir — quanto menor, melhor" },
    { label: "Loop rate", target: "> 15%", why: "Replays contam como watch time adicional" },
    { label: "Engagement rate", target: "> 5%", why: "Média da plataforma é 5.91% — fique acima" },
    { label: "Subscribers gained", target: "> 0.5% dos views", why: "Shorts é porta de entrada para o canal" },
  ],
  scriptTemplates: SHORT_VIDEO.scriptTemplates,
  sources: [
    { title: "YouTube Shorts Best Practices 2026 — JoinBrands", url: "https://joinbrands.com/blog/youtube-shorts-best-practices/", description: "10 dicas para maximizar views" },
    { title: "YouTube Algorithm 2026 — OutlierKit", url: "https://outlierkit.com/resources/youtube-algorithm-updates/", description: "Shorts desacoplado, satisfaction-weighted" },
  ],
  durationOptions: [
    {
      seconds: 30, label: "30s",
      strategyName: "Snap Insight",
      strategyBrief: "1 insight + loop que faz replay. Máxima densidade, zero enrolação.",
      hookGuide: "Pergunta ou fato nos 2s. Frame final deve conectar com o primeiro (loop = replay = watch time).",
      scriptGuide: "3 batidas: PERGUNTA (3s) → RESPOSTA (22s) → LOOP (5s). Final aponta de volta pro começo ('... é por isso que voltei'). Pattern interrupt a cada 4s.",
      titleGuide: "Keyword forte no início (YouTube SEO). <50 chars. Ex: 'ChatGPT: o truque que 99% não conhece'.",
      descriptionGuide: "1ª linha: keyword principal + promessa. 2ª linha: CTA pro canal longo. Inclua #shorts + 3 tags de nicho.",
    },
    {
      seconds: 45, label: "45s",
      strategyName: "Explicação Clara",
      strategyBrief: "Tempo pra 2-3 pontos conectados. Curiosity stacking explícito.",
      hookGuide: "Setup nos 3s ('Você sabia que X?') + promessa nos próximos 5s ('em 40s eu te explico').",
      scriptGuide: "4 batidas: HOOK → PONTO 1 → PONTO 2 (curiosity gap) → PAYOFF/CTA. Cada ponto de 10s. Open loop: deixa curiosidade no ponto 1 que resolve no ponto 2.",
      titleGuide: "Número + specificity. Ex: '3 coisas que X mudou em Y'. <55 chars.",
      descriptionGuide: "2 linhas: resumo + CTA pro vídeo longo no canal. #shorts + 4-5 tags.",
    },
    {
      seconds: 60, label: "60s",
      strategyName: "Mini Tutorial",
      strategyBrief: "Passo-a-passo útil com CTA pro canal. Máximo que o Shorts aceita.",
      hookGuide: "Problema específico nos 3s ('Se você faz X, tá perdendo Y'). Visual + fala sincronizados.",
      scriptGuide: "5 passos numerados (10-12s cada). Texto overlay grande. CTA aos 55s pro vídeo longo. Loop opcional mas recomendado.",
      titleGuide: "How-to ou número. 'Como X em 60s' ou '5 passos pra Y'. <55 chars.",
      descriptionGuide: "Lista dos passos em bullet. Link pro vídeo completo no canal. Keywords pesadas (YouTube é busca).",
    },
  ],
  lastUpdated: "2026-04-18",
}

// ─────────────────────────────────────────────────────────────────────────────
// SKILL 7: YOUTUBE VIDEO (Long-form)
// ─────────────────────────────────────────────────────────────────────────────

const YOUTUBE_VIDEO: ContentSkill = {
  id: "YOUTUBE_VIDEO",
  label: "YouTube Vídeo",
  icon: "🎬",
  description: "Vídeos longos de 8–30min otimizados para o algoritmo do YouTube",
  platforms: ["YOUTUBE"],
  phases: LONG_VIDEO.phases,
  bestPractices: [
    ...LONG_VIDEO.bestPractices,
    "Browse feed usa micro-nicho clustering — conteúdo genérico perde visibilidade",
    "Premieres criam evento e geram buzz — use para lançamentos importantes",
    "Community tab antecipa o vídeo 24h antes — aquece o público",
    "End screens nos últimos 20s — sempre aponte para o próximo vídeo",
    "Cards internos a cada 3-4 min — mantém viewer no seu canal",
    "Descrição com keyword principal nas 2 primeiras linhas — SEO direto",
  ],
  commonMistakes: LONG_VIDEO.commonMistakes,
  kpis: [
    ...LONG_VIDEO.kpis,
    { label: "Session time", target: "Viewer assiste 2+ vídeos", why: "YouTube recompensa canais que mantêm viewers na plataforma" },
  ],
  scriptTemplates: LONG_VIDEO.scriptTemplates,
  sources: LONG_VIDEO.sources,
  durationOptions: [
    {
      seconds: 8 * 60, label: "8 min",
      strategyName: "Explainer Focado",
      strategyBrief: "1 tema, profundidade média. Ideal pra trends e temas do dia.",
      hookGuide: "Cold open 15s: problema ou promessa + por que isso importa AGORA. Sem intro de canal nos primeiros 20s.",
      scriptGuide: "Estrutura 4 blocos: HOOK (15s) → CONTEXTO (1min) → 2 PONTOS PRINCIPAIS (5min) → CONCLUSÃO + CTA (1min). Open loops a cada 90s. Pattern interrupts: corte, B-roll, gráfico. End screen nos últimos 20s apontando pra vídeo relacionado.",
      titleGuide: "Curiosity gap + keyword principal nos 30-55 chars. 'Por que X está Y' ou 'O erro que Z'. Evite números round (usa 7, 13 em vez de 10).",
      descriptionGuide: "1ª linha: promessa + keyword (SEO). Próximas 2: resumo dos pontos. Timestamps no formato 0:00 Hook, 1:00 Contexto. Links pra fontes. 5-8 hashtags.",
    },
    {
      seconds: 15 * 60, label: "15 min",
      strategyName: "Análise Profunda",
      strategyBrief: "Narrativa em 3 atos com capítulos. Tema denso que vale monetização premium.",
      hookGuide: "Cold open de 30-45s: frase-tese + stakes ('o que está em jogo'). Depois intro curta de 5s (canal + do que trata). Curiosity gap pesado.",
      scriptGuide: "3 atos com capítulos: ATO 1 SETUP (3min) → ATO 2 CONFLITO/INVESTIGAÇÃO (8min, 2-3 capítulos) → ATO 3 RESOLUÇÃO (3min) + CTA (1min). Open loops que só resolvem no ato 3. Pattern interrupt: B-roll, citação de specialist, dado numérico. Capítulos de 3-4min com timestamps.",
      titleGuide: "Thesis clara + alta curiosidade. 'A verdade sobre X' ou 'Como Y está mudando Z'. 40-60 chars.",
      descriptionGuide: "1ª linha: thesis/promessa + keyword. Timestamps obrigatórios. Resumo em 4-5 linhas. Fontes/links numerados. Hashtags 6-8. CTA pra comunidade/Patreon/newsletter.",
    },
    {
      seconds: 25 * 60, label: "25 min",
      strategyName: "Deep Dive / Investigação",
      strategyBrief: "Conteúdo de autoridade. Um assunto esgotado com pesquisa original, entrevistas, dados.",
      hookGuide: "Cold open 60s com múltiplos stakes. Montagem de clipes/teasers das partes mais interessantes. Promessa específica: 'ao final você vai entender X'. Pattern interrupt imediato.",
      scriptGuide: "6-8 capítulos de 3-4min cada: HOOK → CONTEXTO HISTÓRICO → STATUS QUO → VIRADA/PESQUISA → CONTRA-ARGUMENTO → SÍNTESE → IMPLICAÇÕES → CTA. Entre capítulos, pattern interrupts longos (B-roll cinematográfico, citações, dados). Reviews feitos pra long-tail search. End screen robusto.",
      titleGuide: "Tese contrarian + specificity. Evite clickbait, valorize autoridade. 'O que ninguém te contou sobre X' ou 'Investigação: por que Y'.",
      descriptionGuide: "1ª linha: tese. 2ª linha: 'Nesta investigação:'. Timestamps detalhados. Fontes acadêmicas/jornalísticas listadas. Descrição longa (300+ palavras) pra SEO. CTA: inscrever + comunidade. Hashtags 8-10 mix nicho+amplo.",
    },
  ],
  lastUpdated: "2026-04-18",
}

// ─────────────────────────────────────────────────────────────────────────────
// SKILL 8: TIKTOK VIDEO
// ─────────────────────────────────────────────────────────────────────────────

const TIKTOK_VIDEO: ContentSkill = {
  id: "TIKTOK_VIDEO",
  label: "TikTok Vídeo",
  icon: "🎵",
  description: "Vídeos de 30s–3min otimizados para o For You Page do TikTok",
  platforms: ["TIKTOK"],
  phases: SHORT_VIDEO.phases,
  bestPractices: [
    "TikTok recompensa novelty e trend participation — entre em trends rápido",
    "Vídeos 50-60s têm média de 4.1M views vs 19K para <10s (dados 2026)",
    "Curiosity stacking: crie múltiplos micro-gaps de curiosidade ao longo do vídeo",
    "TikTok Creative Center mostra trends de áudio, hashtags e formatos em ascensão",
    "Trending audio nas primeiras 24-72h dá boost de 30-60% no alcance",
    "Duets e Stitch são formatos nativos que o algoritmo favorece",
    "Comentar e engajar nos primeiros 30 min pós-publicação é crítico",
    "TikTok premia autenticidade — over-produced pode parecer 'anúncio'",
    "Responder comentários com vídeo gera 2-3x mais engajamento",
    "Use 3-5 hashtags específicas — #fyp e #viral não ajudam mais",
    "O algoritmo testa seu vídeo com 300-500 viewers primeiro — se engajar, escala",
    "Poste entre 1-3 vídeos por dia para máximo crescimento",
  ],
  commonMistakes: [
    "Usar #fyp e #viral como hashtags (não funcionam mais)",
    "Início lento sem hook visual — swipe é imediato no FYP",
    "Conteúdo over-produced que parece anúncio",
    "Não participar de trends (formato/áudio) quando relevante",
    "Postar e sair — engajamento nos primeiros 30 min é crucial",
    "Vídeos muito curtos (<15s) que não dão tempo para mensagem",
    "Não adaptar conteúdo para o tom do TikTok (casual, autêntico)",
    "Ignorar TikTok Creative Center para trends",
  ],
  kpis: [
    { label: "Watch completion", target: "> 50%", why: "Principal sinal para o algoritmo do FYP" },
    { label: "Shares", target: "> 2% dos views", why: "Compartilhamentos valem 5-10x mais que likes" },
    { label: "Comments", target: "> 1% dos views", why: "Engajamento ativo impulsiona distribuição" },
    { label: "Saves", target: "> 3% dos views", why: "Indica conteúdo que será revisto" },
    { label: "Profile visits", target: "> 2% dos views", why: "Interesse em mais conteúdo = sinal forte" },
  ],
  scriptTemplates: SHORT_VIDEO.scriptTemplates,
  sources: [
    { title: "Short-Form Video Statistics 2026 — AutoFaceless", url: "https://autofaceless.ai/blog/short-form-video-statistics-2026", description: "Dados de performance por plataforma" },
    { title: "Short-Form Video Trends 2026 — ShortSync", url: "https://www.shortsync.app/resources/short-form-video-trends-2026", description: "Tendências e curiosity stacking" },
  ],
  durationOptions: [
    {
      seconds: 30, label: "30s",
      strategyName: "Trend Native",
      strategyBrief: "Entra em trend de áudio/formato, 1 ponto rápido. Autenticidade > produção.",
      hookGuide: "1s visual + 2s fala. Tom casual, como se tivesse começando no meio da conversa. Use trending audio/sound nos 24-72h do peak.",
      scriptGuide: "1 ideia, 1 gancho. 3 batidas: HOOK (3s) → DESENVOLVIMENTO (22s) → PUNCHLINE/CTA (5s). Evite tom 'produzido'. Use POV, duet ou stitch quando faz sentido.",
      titleGuide: "Sem título (TikTok não tem). A caption faz o papel: punchline + hashtags de nicho.",
      descriptionGuide: "Caption 1 linha + 3-5 hashtags (evite #fyp #viral, use nicho). Emoji estratégico. Pergunta que pede resposta nos comentários.",
    },
    {
      seconds: 60, label: "60s",
      strategyName: "Curiosity Stacking",
      strategyBrief: "Sweet spot do FYP. Múltiplos mini-gaps de curiosidade. Target 4M+ views.",
      hookGuide: "Pergunta ou afirmação polêmica nos 3s. Cria o primeiro gap. Visual + texto overlay grande.",
      scriptGuide: "HOOK (3s) → GAP 1 (15s, resolve) → GAP 2 (15s, resolve) → GAP 3 (15s) → PAYOFF + CTA (10s). Cada gap fechado abre outro. Frase-chave na metade gera save.",
      titleGuide: "Caption: pergunta forte. 'Você sabia que X?' ou afirmação que força discordância. Força comentários.",
      descriptionGuide: "Caption 2-3 linhas com mais contexto. 5-7 hashtags específicas. Mencione o trending audio se usado.",
    },
    {
      seconds: 90, label: "90s",
      strategyName: "Narrative POV",
      strategyBrief: "Story-driven. POV, story time ou before/after. Completion alta = distribuição alta.",
      hookGuide: "Emoção nos 2s ('Gente, eu tô assustado com isso'). Primeira pessoa, autêntico. Roteiro NÃO pode parecer roteirizado.",
      scriptGuide: "Arco narrativo completo em 90s: SETUP (10s) → DESENVOLVIMENTO (40s) → CLIMAX (20s) → RESOLUÇÃO (15s) → CTA (5s). Fala como pessoa, não como marca. Pattern interrupt por emoção (tom, expressão), não por edição.",
      titleGuide: "Caption: início da história. 'Eu estava X quando Y...'. Deixa em aberto, força entrar pra descobrir.",
      descriptionGuide: "Caption conta parte da história (4-6 linhas). Convida a comentar o próprio caso. Hashtags 6-8 mix POV + nicho.",
    },
  ],
  lastUpdated: "2026-04-18",
}

// ─────────────────────────────────────────────────────────────────────────────
// Export
// ─────────────────────────────────────────────────────────────────────────────

export const CONTENT_SKILLS: Record<SkillId, ContentSkill> = {
  SHORT_VIDEO, LONG_VIDEO, INSTAGRAM, RESEARCH,
  INSTAGRAM_REELS, YOUTUBE_SHORTS, YOUTUBE_VIDEO, TIKTOK_VIDEO,
}

// Skills available for content creation (new specific ones)
export const SKILL_LIST = [INSTAGRAM_REELS, YOUTUBE_SHORTS, YOUTUBE_VIDEO, TIKTOK_VIDEO]
export const ALL_SKILLS = [INSTAGRAM_REELS, YOUTUBE_SHORTS, YOUTUBE_VIDEO, TIKTOK_VIDEO, RESEARCH]
