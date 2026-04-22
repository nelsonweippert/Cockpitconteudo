# 📖 Guia do usuário — Content Hub

Jornada completa: do primeiro login ao primeiro vídeo publicado.

---

## 🔑 Primeiro acesso

Abre `https://seu-deploy.vercel.app/login` (ou `http://localhost:3020/login` em dev).

Credenciais criadas pelo seed:
```
Email:  nelsonweippert@gmail.com
Senha:  content-hub-2026
```

> Troca a senha rodando `SEED_EMAIL="..." SEED_PASSWORD="nova" npm run seed:user` com a `DATABASE_URL` apontando pra produção.

---

## 🗺️ Visão geral da interface

```
┌─────────────────────────────────────────────────────────────┐
│  CONTENT HUB                                          ☀️ 🌇 🌙 │
├──────────┬──────────────────────────────────────────────────┤
│ 📡 Cont. │                                                  │
│ 📊 Radar │                 Área principal                   │
│          │                                                  │
│          │                                                  │
│ Sair     │                                                  │
└──────────┴──────────────────────────────────────────────────┘
```

**Duas áreas principais:**
- **Conteúdo** — onde você cadastra termos, cura fontes, gera ideias e produz
- **Radar** — dashboard de evidências capturadas, por termo/publisher/freshness

---

## 1️⃣ Cadastrar seu primeiro termo

Vá em **Conteúdo** → clique **"gerenciar"** no card Monitor automático.

Campos:
- **Termo** — o nicho que quer monitorar. Ex: `Inteligência Artificial`, `DeFi`, `Marketing Digital`
- **Foco/exclusões** *(recomendado)* — o que você QUER e o que NÃO QUER. Ex:
  ```
  foco em LLMs, APIs de IA, produtos Anthropic/OpenAI/Google.
  EXCLUIR: IA em animais, arte generativa, relacionamentos românticos
  ```
  Esse campo guia a triagem e melhora MUITO a precisão.

> **💡 Dica:** comece com 2-3 termos. Mais de 5 polui demais o feed.

---

## 2️⃣ Curar fontes do termo (1× por tema)

Ainda no card do termo expandido, clique **"🔍 Pesquisar fontes"**.

O que acontece (~2min):

```
🔄 Estágio 1/3 · Decompondo tema
   subtemas, jargão, perfis-alvo, queries planejadas (~15s)

🔄 Estágio 2/3 · Descoberta multi-estratégia
   executando 6-10 queries web_search (~40s)

🔄 Estágio 3/3 · Validação + ranking
   site: por candidato, score em 5 dimensões (~60s)

✓ 11 fontes encontradas · 4 rejeitadas · 127s
```

### Lista de fontes curadas

```
[✓] TIER 1  🇧🇷  8.7  Folha de S.Paulo         folha.uol.com.br  ×
           jornalismo investigativo com cobertura de IA regulatória

[✓] TIER 2  🇺🇸  8.2  TechCrunch                techcrunch.com    ×
           cobertura de produtos e funding no ecossistema de IA

[✓] BLOG    🇺🇸  9.1  Stratechery              stratechery.com   ×
           análise estratégica profunda sobre Big Tech
```

### O que fazer com a lista

- **[✓] Checkbox** — desativa sem remover. Fonte some das próximas pesquisas mas não é apagada.
- **× X vermelho** — remove permanentemente. Next "Atualizar fontes" pode trazer de volta se o Claude sugerir de novo.
- **Nota** (score 8.7) — passa o mouse pra ver breakdown nas 5 dimensões (autoridade, especialização, frequência, independência, idioma)
- **Nome clicável** — abre o site em nova aba pra você inspecionar antes de confiar
- **Input de baixo** — adiciona manualmente (ex: um blog que você conhece mas o Claude não sugeriu)

### Quando atualizar?
Rodar **"Atualizar fontes"** depois:
- Adicionou intent novo/mais específico
- Tema evoluiu (novos players entraram no mercado)
- Alguma fonte saiu (deixou de publicar)

O merge preserva suas decisões: fontes desativadas continuam desativadas, adicionadas manualmente persistem.

---

## 3️⃣ Gerar ideias

Volta pro topo e escolhe um dos **3 modos**:

### 🤖 Monitor automático
Roda pipeline pra TODOS os termos ativos. Feed acumulado no final.
```
[Gerar ideias agora (~90s)]
3 termos ativos · 3/3 com fontes curadas ✓
```

### 🔍 Tema específico
Escreve 1 tema livre (ex: `NVIDIA GB200`) e gera 1 ideia focada sem monitorar.
Útil pra "caçar" ideia sobre algo que surgiu agora.

### ✍️ Ideia própria
Título + pensamento → vira Content direto no funil, sem IA.
Pra quando você JÁ tem a pauta pronta.

### Durante a pesquisa
```
🔄 Pipeline rodando                              42s
   Lendo matérias (Haiku web_fetch + classificação)

Estágio 1/4 · Descobrindo fontes       [✓ ✓ ✓ ✓]
Estágio 2/4 · Lendo matérias           [▓ ▓ ░ ░]
Estágio 3/4 · Triangulando             [░ ░ ░ ░]
Estágio 4/4 · Gerando ideias           [░ ░ ░ ░]

Tempos estimados com base em runs anteriores.
```

---

## 4️⃣ Avaliar o feed de ideias

Cada card tem **4 camadas** de informação:

```
┌─ [85]  R$ 3 Bilhões Roubados em 30 Dias               3h atrás   ⭐
│  score  Hacks de abril superam US$ 600 milhões e mostram 
│         novo foco de risco além do código vulnerável...
│         [Defi]  [✓ matéria real]  [🔗 3 fontes]  [🔥 viral 78]
├─ "trecho verbatim da matéria primária"
│  🔗 criptofacil.com
├─ HOOK SUGERIDO
│  "Se você investe em DeFi, você precisa ver isso."
├─ ENCAIXE POR FORMATO
│  🎞️ Reels 85   ⚡ Shorts 70   🎬 Long 55   🎵 TikTok 80
│  ▓▓▓▓▓▓▓▓▓░░   ▓▓▓▓▓▓▓░░░   ▓▓▓▓▓▓░░░░   ▓▓▓▓▓▓▓▓░░
└─ [Descartar]                        [Utilizar no funil +]
```

### Ações
- **⭐ Favoritar** — estrela âmbar no canto. Sempre aparece no topo do feed.
- **Descartar** — remove do feed (soft delete, vai pra `isDiscarded`)
- **Utilizar no funil** — cria um Content vinculado e abre pra elaboração

### Filtros & ordenação
```
[Defi 8] [IA 5] [Outros 2] [Em produção 3]     Ordem: [Recente] Pioneer  Viral
```

Favoritas sempre no topo, independente da ordenação.

### Cards com "Em produção"
Quando a ideia já virou Content, o footer muda:
```
✓ Em produção                    Fase: Briefing
▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░ (glow na fase atual)
Ideia · Elab. · Brief. · Edição · Pub.     Continuar →
```
Clica "Continuar →" e abre direto no painel do Content no estágio certo.

---

## 5️⃣ Elaborar o conteúdo

Clicou "Utilizar" → abre o **ContentDetailPanel** lateral.

### Fase 1: IDEATION
- Escolher o **tipo de conteúdo** (Skill): Reels, Shorts, Long, TikTok
- Ver o bloco **📚 Fontes da pesquisa** com primária + apoios clicáveis

### Fase 2: ELABORATION
Aba com 6 sub-seções:
- **Pesquisa** — notas extras + IA "pesquisar mais sobre o tema"
- **Hook** — gera 5 opções com a diretriz da skill × duração escolhida
- **Roteiro** — gera estrutura completa. Diretriz do strategy dirige 3 atos / open loops / etc
- **Título** — 6 variações otimizadas. Padrão do guide: número, curiosity gap, contraste
- **Thumbnail** — 3 conceitos visuais com composição, cor, texto overlay
- **Descrição** — caption + hashtags específicas da plataforma

### Escolher duração aqui
Grid 3-col com as 3 opções da skill:
```
┌─────────────────┬─────────────────┬─────────────────┐
│ 30s             │ 60s             │ 90s             │
│ Teaser Viral    │ Fato + Contexto │ Mini História   │
│ Um fato bombás- │ Tempo pra       │ Storytelling    │
│ tico + gancho   │ explicar fato + │ compacto com    │
│ que faz salvar  │ impacto prático │ reviravolta     │
└─────────────────┴─────────────────┴─────────────────┘
```

Depois de escolher, a IA sabe que "roteiro" = pra essa estratégia específica.

---

## 6️⃣ Briefing pra gravação

Avançou pra fase **BRIEFING** → botão **"Gerar briefing com IA"**.

O briefing não é só copy — é um **guia de gravação estruturado em blocos**:

```
## BLOCO 1 — ABERTURA (0-8s)
O que falar: gancho visual + afirmação chocante sobre o prejuízo.

⭐ FRASE DE DESTAQUE: 
"Três bilhões de reais roubados em trinta dias. E eu vou 
te mostrar por quê."

Dica de entrega: tom sério, contato com câmera direta, pausa 
depois de "trinta dias" pra criar impacto.

## BLOCO 2 — CONTEXTO (8-20s)
...
```

Mais embaixo, uma seção **📰 FONTES PARA A EDIÇÃO**:
- Cada bloco do briefing mapeia quais screenshots tirar, de qual site
- Termos de busca em português pra Google Imagens
- Texto overlay sugerido

---

## 7️⃣ Envio pra edição

Fase **EDITING_SENT**:
- Campo pra Google Drive do vídeo bruto
- "Gerar guia de edição com IA" → notas técnicas bloco a bloco:
  - Tipo de corte (jump cut, J-cut, L-cut)
  - B-roll sugerido + termos de busca em inglês pra Pexels/Unsplash
  - Texto overlay
  - Zoom/movimento de câmera
  - Música/SFX com timing

---

## 8️⃣ Publicar

Fase **PUBLISHED**:
- URL publicada
- Data
- Métricas pós-publicação (views, engagement, etc) — manual por enquanto

---

## 🎨 Temas

Topbar tem toggle de 3 temas:
- ☀️ **Dia** — claro
- 🌇 **Pôr do sol** — amber/tons quentes
- 🌙 **Noite** — dark

Preferência salva em localStorage.

---

## 🔎 Radar

Menu **Radar** → dashboard de evidências capturadas:

```
📊 Visão geral                        72h · 24h · 6h
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total captured: 127       Processed: 42 (33%)

Por termo:
  DeFi                 58 evidências (48% processed)
  Inteligência Artif.  69 evidências (20% processed)

Top publishers:
  criptofacil.com      12     TIER 2  🇧🇷
  techcrunch.com       9      TIER 1  🇺🇸
  ...

Freshness breakdown:
  < 24h     45 (fresco)      🟢
  24-48h    38               🟡
  48-72h    29 (saturado)    🟠
  > 72h     15 (descartar)   🔴
```

Use pra:
- Ver se um termo tá sendo bem coberto ou está seco
- Descobrir se um publisher específico tá publicando muito
- Balancear freshness (evitar sempre pegar matérias com >48h)

---

## 🧯 Troubleshooting

| Problema | Solução |
|---|---|
| Pipeline trava "Gerando ideias" mais de 3min | Veja logs no Vercel → provavelmente timeout no Stage 3. Cache NewsEvidence ajuda se rodar de novo. |
| "Pesquisar fontes" dá HTTP 504 | Vercel plan Hobby tem 10s — Content Hub tá em Node runtime + maxDuration 60-90s. Confirma que não está em Edge. |
| Nenhuma ideia gerada | Triagem rejeitou tudo. Veja `[triage]` logs no Vercel — ajusta intent pra ser menos restritivo. |
| `Invalid time value` ao criar ideia | Matéria veio sem publishedAt válido. `safeDate()` deve pegar — se persistir, é regressão. |
| Fontes sumiram do termo | Conferir se rodou "Atualizar fontes" recentemente — merge preserva decisões mas Claude pode ter ranqueado outras no lugar. Adicione manualmente se necessário. |

---

## 💡 Workflow recomendado

### Ritmo semanal
- **Domingo (10min):** revisa termos monitorados, atualiza intent se mudou foco
- **Segunda (5min):** gera ideias do Monitor automático, favorita 3-4 boas
- **Terça-sexta:** pega 1 favorita por dia, elabora → briefing → grava → edita → publica

### Quando adicionar um termo novo
1. Adiciona com intent bem específico
2. Roda "Pesquisar fontes" **antes** de gerar ideias — investe os 2min uma vez
3. Depois de ter 3-5 ideias daquele termo, avalia se a curadoria está boa
4. Se ideias vêm repetitivas, refina intent + re-roda fontes

### Quando arquivar um termo
Quando há 2+ semanas sem pauta relevante saindo. Desativa `isActive=false` em vez de deletar — histórico de ideias permanece.

---

<div align="center">

**Próxima parada:** [Arquitetura técnica](ARCHITECTURE.md)

</div>
