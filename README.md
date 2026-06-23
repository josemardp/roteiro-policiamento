# CPP — Roteiro de Policiamento

App offline-first para geração do **CPP — Cartão de Prioridade de Patrulhamento** da 5ª Cia PM do 2º BPM/i · PMESP.

---

## Funcionalidades

| Funcionalidade | Estado |
|---|---|
| Geração automática do CPP | ✅ estável |
| Modo manual guiado (ModoManualUI) | ✅ estável |
| Mapa com coordenadas georreferenciadas | ✅ estável |
| Folha CPP imprimível (A4) | ✅ estável |
| Fundamentação operacional por município | ✅ estável |
| RSO / exportação | ✅ estável |
| Modo patrulha em campo | ✅ estável |
| GPS / navegação por bloco | ✅ estável |
| PWA / offline-first (service worker) | ✅ estável |
| Auto dark mode | ✅ estável |
| Histórico local de CPPs | ✅ estável (V17) |

---

## Motor (`gerarCPP.ts`)

### Invariantes do motor

O motor nunca pode ser alterado sem rodar o fuzz completo.

- **Seed reproduzível:** mesma configuração → mesmo roteiro. RNG mulberry32 com `hashStr(data + horaInicio + município)`.
- **Grade de 30 min:** todos os blocos iniciam em múltiplos de 30 min. Blocos manuais são snapped antes de entrar.
- **Soma exata:** blocos preenchem o turno inteiro sem lacuna nem sobreposição.
- **PREL obrigatória:** sempre o primeiro bloco (primeiros 30 min).
- **REL obrigatório:** sempre o último bloco (últimos 30 min).
- **REF/refeições:** encaixadas por janela horária real (almoço ~12–13h, janta ~20–22h, ceia ~02–03h). Nunca antes dos primeiros 180 min do turno.
- **DESL automático:** sempre ancorado com coordenada do município de destino.
- **Atividades mono-município** (Delegada, DEJEM, CGP): circuito fechado em um único município.
- **Turnos suportados:** 8h (Supervisor, Delegada, DEJEM) e 12h (RP, CGP, CFP).

### Durações

| Atividade | Duração |
|---|---|
| Radiopatrulha (RP) | 12h (720 min) |
| CGP / CFP | 12h (720 min) |
| Supervisor Regional | 8h (480 min) |
| Atividade Delegada e variantes | 8h (480 min) |
| DEJEM e variantes | 8h (480 min) |

### Turnos noturnos (pós meia-noite)

`00h00` em um turno de `23h30` é convertido internamente para minuto absoluto `1440` (não `0`). A função `clockMinAbsoluto(clockMin, depoisDeMin)` garante a conversão tanto no parser de blocos manuais quanto na prévia do modo manual.

---

## Dados

### Camada 1 — Base estática

Localidades, escolas, hotspots e perfil criminal por município. Arquivos em `client/src/lib/municipios/`.

### Camada 2 — PPI

Programa de Policiamento Integrado (`ppi-5cia.ts`). Define focos prioritários, eventos mensais e pesos por modalidade.

### Coordenadas

Arquivo: `coordenadas-pontos.ts`.

- Coordenadas aceitas somente com fonte Nominatim/OSM ou base validada, dentro do quadrante do município.
- Pontos genéricos ou ambíguos ficam `null` — nunca inventar coordenada.
- Cobertura global do mapa: ~82–83% após V13.2.
- Escolas auditadas individualmente.
- DESL 100% ancorado no município de destino após V13.2.
- Matching: nome exato primeiro, depois substring mais longo.

### Lei de Dados

> Dado oficial só entra com fonte real verificável.
> Sem fonte ou ponto ambíguo → `null` / "a validar".
> Nunca usar centro da cidade como coordenada-tampa.
> Hotspot `a_validar_comando` não influencia o motor.

Pendência declarada:
- Violência doméstica / Maria da Penha: dados sem publicação oficial validada → pendente.

---

## Modalidades

| Sigla | Nome |
|---|---|
| PREL | Preleção (automático, primeiro bloco) |
| REL | Relatório / RSO (automático, último bloco) |
| REF | Refeição (automático por janela horária) |
| DESL | Deslocamento (automático multi-município) |
| PE | Ponto de Estacionamento |
| ESC | Ronda Escolar |
| FISC | Fiscalização |
| PREV | Prevenção / Ronda de Bairros |
| POST | Postura / Visibilidade |
| RURAL | Patrulhamento Rural |
| SAT | Saturação |

---

## Modo manual

O modo manual substitui a seleção automática de localidades. O usuário digita blocos de texto por linha; o parser injeta os blocos no roteiro respeitando a grade de 30 min.

### Sintaxe aceita

```
HHhMM SIGLA Local / Descrição
HHhMM a HHhMM SIGLA Local
HH:MM SIGLA Local
```

Exemplos:
```
07h30 PE Banco do Brasil
08h30 a 09h00 ESC EE Aimone Sala
09h FISC SP-300 km 553
12h REF almoço
17h REL relatório final
```

### Regras do parser

- A PREL ocupa sempre os primeiros 30 min. O primeiro bloco manual válido começa após a PREL.
- Sigla explícita **em qualquer posição** vence sobre inferência: `"fiscalização PE Banco do Brasil"` → `PE | Banco do Brasil`.
- `PE` só casa com a sigla, não dentro de palavras como "perímetro" ou "presença".
- `REL` reconhece também "relatório" / "relatorio" / "RSO" / "encerramento".
- Turnos após meia-noite: `00h00` em turno de `23h30` → minuto interno `1440`.
- Blocos fora da janela do turno geram aviso e são ignorados.

### ModoManualUI

Componente React em `client/src/components/ModoManualUI.tsx`:
- Guia visual colapsível com sintaxe e tabela de siglas.
- Formulário guiado (início, fim, modalidade, local).
- Botões rápidos por sigla (insere exemplo com próximo horário sugerido).
- Textarea livre preservado.
- Prévia inline dos blocos (`analisarBlocosManuaisPreview`) — não chama `gerarCPP`.

---

## Folha CPP imprimível

- Componente: `CPPTurno.tsx` (seção de impressão).
- Ativada via `window.print()`, sem jsPDF nem html2canvas.
- Formato A4, preto-e-branco, sem dependência externa.
- Usa o roteiro já gerado — não recalcula nada.
- Campo "Emitido em" fixado no momento do clique (não re-renderiza).
- Fundamentação operacional honesta: cita fontes reais, não inventa dados.

---

## Como rodar

```bash
# Instalar dependências
pnpm install

# Type check
pnpm check

# Dev server (porta padrão Vite)
pnpm dev

# Build de produção
pnpm build

# Fuzz test (11.520 roteiros, ~0 violações esperadas)
./node_modules/.bin/tsx client/fuzz_test.ts

# Testes de regressão
./node_modules/.bin/tsx client/test_manual_mode.ts
./node_modules/.bin/tsx client/test_manual_preview.ts
```

---

## Testes

| Arquivo | Finalidade | Última execução |
|---|---|---|
| `client/fuzz_test.ts` | Invariantes do motor: soma, grade, PREL/REL, REF | V16.1 — 0 violações |
| `client/test_manual_mode.ts` | Regressão do modo manual: siglas, locais, turnos noturnos | V16.1 — 35/35 |
| `client/test_manual_preview.ts` | Prévia do modo manual: normalização noturna, PREL overlap | V16.1 — 24/24 |

---

## Estado atual

**Última versão:** V19 (2026-06-23) — Motor Especialista (Fases 1 e 2)
**Próxima sprint planejada:** Expansão e refinamento de Inteligência Artificial e dados.

### Frentes fechadas

- Motor base (seed, grade, soma, PREL/REL, refeições)
- Multi-município / DESL
- Mapa com coordenadas reais
- Folha CPP imprimível
- Fundamentação operacional
- Modo manual (parser, UX, prévia)
- Turnos após meia-noite
- **Histórico local de CPPs (V17)** — salvar, reabrir, duplicar, excluir e backup JSON (export/import). Persistido em `localStorage` na chave `historico_roteiros`. Reabrir exibe o roteiro salvo sem recalcular.
- **PWA/offline-first válido em produção** — service worker e manifest respeitam o `base` `/roteiro-policiamento/` do GitHub Pages.
- **Motor Especialista (V19)** — Adiciona lógica de fadiga, anti-previsibilidade via Cadeia de Markov, otimização física de trajeto (TSP Nearest Neighbor) e distribuição de tempo baseada em peso criminal.

### Pendências reais

- Violência doméstica / Maria da Penha sem dado oficial validado
- Algumas áreas rurais / conjuntos vagos sem coordenada (honestidade de dados)
- Chunk principal ~529 KB (gzip 156 KB) após code-splitting do mapa; aceitável para o uso, sem aviso bloqueante

---

## Estrutura de arquivos relevantes

```
client/src/lib/
  gerarCPP.ts           — motor principal
  constants.ts          — pesos, durações, modalidades
  types.ts              — tipos TypeScript
  municipios/
    ppi-5cia.ts         — Camada 2 / PPI
    coordenadas-pontos.ts — coordenadas georreferenciadas
    types-ppi.ts        — tipos da Camada 2
client/src/components/
  ModoManualUI.tsx      — UX do modo manual
client/src/pages/
  ConfiguracaoServico.tsx — tela de configuração
  CPPTurno.tsx            — tela do roteiro / impressão
client/
  fuzz_test.ts
  test_manual_mode.ts
  test_manual_preview.ts
```
