# Brainstorm de Design — Roteiro de Policiamento (CPP)

## Três Abordagens Estilísticas

### 1. **Institucional Clássico**

Paleta azul-marinho PM com tipografia séria, cartões estruturados, badges coloridas. Segue a doutrina visual da PMESP. Confiável e formal.
**Probabilidade:** 0.02

### 2. **Operacional Moderno**

Design minimalista com ênfase em legibilidade tática. Cores de alerta (verde/vermelho/âmbar) para modalidades. Foco em usabilidade em campo (toque grande, contraste alto, sem ruído visual).
**Probabilidade:** 0.08

### 3. **Dashboard Inteligente**

Painel analítico com gráficos de progresso, timeline visual do turno, cards com sombra e gradientes suaves. Tema claro com acentos em azul corporativo. Sensação de "controle inteligente".
**Probabilidade:** 0.05

---

## Abordagem Selecionada: **Operacional Moderno**

### Razão da Escolha

O app é usado **em campo, muitas vezes sem internet, em viatura**, durante um plantão de 8h. Precisa de:

- **Máxima legibilidade** em telas pequenas e luz solar
- **Toque grande** (≥44px) para usar com luva/movimento
- **Contraste alto** entre elementos
- **Sem distrações visuais** — cada elemento tem propósito tático
- **Feedback imediato** — cores e badges indicam status/modalidade

---

## Especificação Completa da Abordagem

### Design Movement

**Operacional Tático + Minimalismo Funcional**
Inspirado em interfaces de comando (CAD/COPOM), painéis de controle de emergência e aplicativos de campo (ex: Waze, Google Maps em modo escuro). Foco em dados acionáveis, não em estética decorativa.

### Core Principles

1. **Legibilidade Tática:** Cada elemento comunica status/ação em < 1 segundo. Sem ambiguidade.
2. **Economia Visual:** Apenas o necessário. Sem gradientes desnecessários, sem ícones decorativos.
3. **Feedback Imediato:** Cores, badges e checkboxes indicam progresso em tempo real.
4. **Acessibilidade em Campo:** Funciona com uma mão, com luva, sob luz solar, sem internet.

### Color Philosophy

- **Primária:** Azul-marinho `#0a2540` (identidade PMESP, confiança, autoridade)
- **Sucesso/Ativo:** Verde `#1e7e34` (tarefa concluída, "go")
- **Alerta/Ação:** Âmbar `#f59e0b` (refeição, deslocamento, atenção)
- **Crítico:** Vermelho `#b00020` (fiscalização, perigo, urgência)
- **Neutro:** Cinza `#6b7680` (texto secundário, desabilitado)
- **Fundo:** Branco `#ffffff` com sombra leve (não cinza — melhor contraste)

**Raciocínio:** Cores refletem modalidades de policiamento. Verde = patrulhamento concluído. Vermelho = fiscalização/saída (risco). Âmbar = refeição/pausa. Azul = base/preleção.

### Layout Paradigm

- **Cabeçalho sticky** com gradiente azul-marinho, resumo do turno (atividade, município, progresso %)
- **Lista de cartões** (blocos horários) em ordem cronológica, cada cartão ocupando ~90% da tela mobile
- **Rodapé fixo** com botões de ação (Adicionar, Recalcular, Exportar)
- **Sem sidebar** — tudo vertical, scroll natural
- **Tela 1 (Configuração):** Formulário simples, campos grandes, seletores nativos (mobile-friendly)
- **Tela 2 (CPP):** Cartões empilhados, cada um expandível para edição
- **Tela 3 (Histórico):** Lista simples com data, atividade, % concluído

### Signature Elements

1. **Badge de Modalidade:** Pequeno retângulo colorido (ex: `FISC` em vermelho, `PREL` em azul) — aparece em cada bloco
2. **Checkbox Grande (44px+):** Verde quando marcado, com checkmark. Risca o cartão levemente.
3. **Barra de Progresso:** Horizontal no cabeçalho, preenchida em verde conforme blocos concluídos. Texto: "X de Y blocos concluídos"

### Interaction Philosophy

- **Tap = Ação:** Botões grandes, sem hover (mobile-first). Feedback visual imediato (cor muda, cartão se expande).
- **Checkbox = Progresso:** Marcar tarefa concluída é a ação mais comum. Deve ser satisfatória (som opcional, animação rápida).
- **Editar = Diálogo Modal:** Toca no lápis → abre modal com campos editáveis. Salva ao confirmar.
- **Recalcular = Reset Respeitoso:** Regenera o roteiro, mas preserva blocos já concluídos e qualquer customização manual.

### Animation

- **Entrada de cartão:** Fade-in + slide-up 200ms (não muito agressivo)
- **Checkbox concluído:** Checkmark aparece com scale 0.8→1 em 150ms (satisfatório, não distrativo)
- **Barra de progresso:** Preenchimento suave em 300ms (não instantâneo, dá feedback visual)
- **Modal abrir/fechar:** Fade + scale 0.95→1 em 200ms
- **Recarregar página:** Nenhuma animação de "splash" — app carrega silenciosamente do localStorage

### Typography System

- **Display/Títulos:** Sistema font `Segoe UI, Roboto, Arial` (sem Google Fonts — offline-first)
  - Cabeçalho: `font-size: 1.5rem (24px)`, `font-weight: 700`, cor azul-marinho
  - Subtítulo: `1rem (16px)`, `font-weight: 600`, cor cinza
- **Body/Conteúdo:** `1rem (16px)`, `font-weight: 400`, cor `#1a1a1a`
- **Pequeno/Secundário:** `0.875rem (14px)`, `font-weight: 400`, cor cinza `#6b7680`
- **Monospace (horários):** `0.875rem`, `font-family: monospace`, cor azul-marinho (destaca horários)

**Hierarquia:** Sem Inter (evitar "AI slop"). Sistema font nativa garante offline e performance.

### Brand Essence

**"Roteiro de Policiamento: ferramenta de comando para o Capitão PM planejar, executar e documentar turnos de policiamento com inteligência operacional, offline, sem burocracia."**

**Personalidade:** Confiável, Direto, Tático.

### Brand Voice

- **Headlines:** Imperativas, claras. Ex: "Gerar CPP do turno" (não "Clique para gerar")
- **CTAs:** Ação + contexto. Ex: "Exportar relatório (só concluídos)" (não "Exportar")
- **Microcopy:** Técnica, sem jargão desnecessário. Ex: "Blocos concluídos: 5 de 12" (não "Você completou 5 de 12 tarefas")

### Wordmark & Logo

**Marca:** Emoji 👮 (policial) em círculo azul-marinho, sem texto.
**Uso:** Favicon, cabeçalho (pequeno), ícone de "adicionar à tela inicial"
**Logotipo:** "PMESP — 5ª Cia" em texto, ao lado do emoji, no cabeçalho

### Signature Brand Color

**Azul-Marinho `#0a2540`** — cor institucional PMESP, imediatamente reconhecível, transmite autoridade e confiança. Usado no cabeçalho, badges de preleção/base, e acentos.

---

## Implementação

- Cabeçalho sticky com gradiente azul-marinho → branco (transição suave)
- Cartões com sombra leve (`box-shadow: 0 1px 3px rgba(0,0,0,0.1)`)
- Badges coloridas por modalidade (tabela de cores acima)
- Checkbox grande, verde, com checkmark
- Barra de progresso horizontal no cabeçalho
- Sem ícones externos — apenas emojis e SVG inline
- Botões com estados `:active` (scale 0.97) para feedback tátil
- Padding bottom para não esconder conteúdo sob teclado mobile
