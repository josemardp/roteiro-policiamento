# CHANGELOG — CPP Roteiro de Policiamento

## V19 (2026-06-23)

**Implementação do Motor Especialista (Fases 1 e 2).**

- **Fase 1: Hotspots & Previsibilidade**
  - **Agendamento Estrito de Hotspots (Interval Scheduling)**: Função `tentarReservarHotspot` injetada no loop principal; garante reserva de locais críticos em horários específicos.
  - **Cadeia de Markov de 2ª Ordem**: Implementada a função `construirPenalizacaoBigrama` para analisar as últimas 4 horas e aplicar `aplicarPenalizacaoBigrama`. Penaliza matematicamente padrões repetitivos (A->B->A->B) para aumentar a imprevisibilidade tática.
- **Fase 2: Otimização de Rota, Budget e Fadiga**
  - **Otimização de Rota (TSP Nearest Neighbor)**: Injeção da Fórmula de Haversine (`distanciaKm`). A viatura agora prefere o ponto não visitado fisicamente mais próximo para economizar combustível e evitar zigue-zagues ineficientes.
  - **Distribuição Inteligente de Tempo (Budget Temporal Backward-Pass)**: A divisão ingênua de horas entre municípios foi substituída pelo `calcularBudgetBackward`. Cidades críticas (escolas, hotspots) recebem horas proporcionais ao risco.
  - **Curva Ergonômica de Fadiga (Ciclo Circadiano)**: Criado o `ajustarPesosPorFadiga` que altera multiplicadores entre 02h00 e 05h00 da manhã (o "Vale Circadiano"), focando em atividades estáticas de atenção em vez de interações dinâmicas e perigosas.
- **Fuzz Test**: O motor passou ileso em 11.520 simulações de geração massiva, atestando zero violações de invariantes com os novos multiplicadores.

---

## V18 (2026-06-22)

**Análise Arquitetural do Motor V17 e Propostas de Evolução (IA Externa).**

- Definição das 5 frentes do Motor Especialista V19, consolidadas a partir do uso operacional e falhas de zigue-zague, cidades "roubando" horas e padrões previsíveis.

---

## Auditoria corretiva (2026-06-19)

**Auditoria em 3 frentes (arquitetura, doc×realidade, mobile/missão) com correções aplicadas. Motor preservado: fuzz 11.520/0, manual 35/35, prévia 24/24.**

Performance / produção:
- Removidos os plugins da plataforma Manus do `vite.config.ts` (`manus-runtime`, `debug-collector`, `storage-proxy`) e o `jsx-loc`. O `manus-runtime` injetava um `<script>` inline de ~366 KB no `index.html` de produção.
  - `index.html`: **368 KB → 1,16 KB** (gzip 105 KB → 0,5 KB). Bundle JS: 722 KB → 692 KB.
- Removido o `<script>` de analytics (Umami) do `index.html`: as variáveis `%VITE_ANALYTICS_*%` não eram definidas e iam literais para o HTML, gerando requisição 404 a cada carregamento.

PWA / offline-first (estava quebrado em produção sob o `base` `/roteiro-policiamento/`):
- `main.tsx`: registro do service worker agora usa `import.meta.env.BASE_URL` (antes `/sw.js` dava 404 no GitHub Pages).
- `public/sw.js`: reescrito com `BASE` derivado de `self.location`; precache resiliente (`Promise.allSettled`); cache `cpp-patrulha-v2` purgando o `v1` quebrado.
- `public/manifest.json`: caminhos relativos (`start_url: "."`, `scope: "."`, `icon: "icon.svg"`).

UI / mobile:
- Corrigidos tons Tailwind inexistentes (ex.: `text-emerald-450`, `border-gray-150`, `slate-855`) em `CPPTurno`, `ModoPatrulha`, `MapaCPP`, `BlocoCard` — não geravam cor nenhuma (aba ativa, bordas e contraste afetados).
- `ErrorBoundary`: traduzido para PT-BR; stack técnico recolhido em `<details>`; toque de 44px.

Segurança / código morto:
- `MapaCPP`: removido override de ícone padrão do Leaflet via CDN externo (morto — marcadores usam `divIcon`); HTML do popup (`local`/`acoesPolicia`/`modalidade`) agora é escapado.
- Removidos `client/src/const.ts` e `shared/const.ts` (OAuth da plataforma Manus, sem nenhum import) e `client/public/__manus__/`.

Eficácia / performance (2ª rodada):
- **Code-splitting do mapa**: `MapaCPP` virou `lazy()` — o Leaflet (~161 KB JS + 16 KB CSS) só é baixado ao abrir a aba Mapa. Bundle inicial: JS 722 → 529 KB (gzip 207 → 156); CSS 147 → 72 KB.
- **Limpeza de dependências e código morto**: removidos 46 componentes `ui/` shadcn não usados (o app usa só `alert-dialog`, `button`, `dialog`, `sonner`, `tooltip`), `server/index.ts` (Express morto no deploy estático) e ~36 dependências órfãs (`react-leaflet`, `axios`, `streamdown`, `nanoid`, `@hookform/resolvers`, 22 pacotes `@radix-ui/*`, `vaul`, `cmdk`, `embla-carousel-react`, `input-otp`, `react-day-picker`, `react-resizable-panels`, `react-hook-form`, `tailwindcss-animate`, `express`, `vitest`, `esbuild`, `add`, plugins Manus). `pnpm-lock.yaml` regenerado e validado com `--frozen-lockfile`.
- **`package.json`**: `build` simplificado para `vite build`; adicionados scripts `test` e `fuzz`.
- **`tsconfig.json`**: `include` restrito a `client/src/**/*`.

Robustez:
- `Historico.tsx`: import de backup agora valida o schema de cada `RoteiroDia` (ignora entradas inválidas e reporta a contagem) e limpa o input para permitir reimportar o mesmo arquivo.

iOS / PWA:
- Gerados `icon-192.png`, `icon-512.png` e `apple-touch-icon.png` (rasterizados do `icon.svg`); manifest passa a oferecer PNG + SVG e `apple-touch-icon` aponta para PNG (iOS ignora SVG na tela inicial).

Documentação:
- README / STATUS reconciliados: Histórico de CPPs (V17) marcado como **implementado** (estava listado como pendente). Pendência de analytics removida.

---

## V17 (já implementado no código — formalizado na auditoria)

**Histórico local de CPPs.**

- Salvar roteiro gerado no histórico; reabrir (sem recalcular), duplicar config, excluir.
- Backup completo em JSON (export/import) via `Historico.tsx`.
- Persistência em `localStorage`, chave `historico_roteiros` (array de `RoteiroDia`).
- Divergências em relação ao `PLANEJAMENTO_V17.md`: chave `historico_roteiros` (planejada `cpp_historico`); modelo `RoteiroDia` (planejado `CPPSalvo`); sem cap de 30 itens; export é backup completo, não por item.

---

## V16.1 (2026-06-19)

**Corrige modo manual em turnos que cruzam meia-noite.**

- `parseBlocosManuais` recebe `turnoInicio` e aplica `clockMinAbsoluto` em cada horário manual.
  - `00h00` em turno 23:30 → minuto interno 1440 (antes ficava 0, causando "ignorado por sobreposição").
  - `00h30` → 1470; `01h00` → 1500 etc.
- `analisarBlocosManuaisPreview`: mesma normalização; adiciona `inicioMin` e `fimMin` ao tipo `PreviewBlocoManual` para testes.
- Aceita `horaTerminoTurno` opcional para detectar blocos fora da janela do turno.
- `ModoManualUI.tsx`: `calcProximoHorario` corrigido com `normAbsoluto`; aceita prop `horaTermino`.
- `ConfiguracaoServico.tsx`: passa `horaTermino` para `ModoManualUI`.
- Motor: aviso claro quando bloco normalizado cai além de `turnoFim`.
- Snap corrigido: `07h15` → snap 07:30 → não é PREL overlap (correto; teste ajustado para `07h07`).
- `test_manual_mode.ts`: +9 casos noturnos. Total: 35/35.
- `test_manual_preview.ts`: +6 casos com verificação de `inicioMin`. Total: 24/24.
- Fuzz: 0 violações. Motor automático preservado.

---

## V16 (2026-06-18)

**UX do modo manual — guia visual, formulário guiado, botões rápidos e prévia inline.**

- Criado `ModoManualUI.tsx`:
  - Guia colapsível com tabela de siglas e exemplo de blocos.
  - Formulário guiado (início, fim opcional, modalidade, local) com sugestão de próximo horário.
  - Botões rápidos por sigla (inserem exemplo editável).
  - Textarea livre preservado — compatível com uso direto.
  - Prévia inline de cada linha: ✓ ok / ⚠ aviso / ✕ erro.
- Adicionada função exportada `analisarBlocosManuaisPreview(texto, horaInicioTurno, horaTerminoTurno?)`.
  - Pura: não chama `gerarCPP`. Usada pela prévia e pelos testes.
- Tipo exportado `PreviewBlocoManual` com campos de display e diagnóstico.
- `ConfiguracaoServico.tsx` atualizado para usar `ModoManualUI`.
- `test_manual_preview.ts`: 13 casos iniciais (siglas, PREL overlap, turno noturno).

---

## V15.1 (2026-06-17)

**Refinamento da inferência de sigla e avisos do modo manual.**

- Sigla explícita **em qualquer posição** do texto vence: `"fiscalização PE Banco do Brasil"` → PE.
  - Antes: `inferirModalidade` só entendia sigla no início (`^`). Agora usa regex `(^|[\s:;,])SIGLA(?=$|[\s:;,])`.
- `PE` não casa dentro de palavras ("perímetro", "presença", "pedestre").
- `REL` reconhece "relatório" / "relatorio" / "RSO" / "encerramento" (keyword `relator` adicionada).
- Função unificada `analisarDescricaoManual` substitui `inferirModalidade` + `extrairLocalManual`.
- Aviso de PREL overlap reescrito: indica claramente que é a PREL que ocupa o horário e aponta o primeiro slot válido.
- `test_manual_mode.ts` expandido com casos de sigla no meio, negativos de PE, REL.

---

## V15 (2026-06-16)

**Modo manual funcional: preserva local digitado pelo usuário.**

- Motor aceita texto livre de blocos manuais e injeta no roteiro automático.
- Parser `parseBlocosManuais`: regex tolerante para `HHhMM SIGLA Local` e `HH:MM a HH:MM SIGLA Local`.
- Local digitado é preservado — não substituído por localidade automática.
- Inferência de sigla por keyword como fallback.
- `test_manual_mode.ts` criado com primeiros casos de regressão.

---

## V14.1 (2026-06-15)

**Audita e finaliza Folha CPP imprimível.**

- Campo "Emitido em" fixado no momento do clique via `useRef` — não re-renderiza após impressão.
- Fundamentação operacional: cita apenas dados reais do PPI e Camada 1. Remove afirmações sem fonte.
- Referências a violência doméstica/Maria da Penha marcadas como pendentes de dado oficial.
- Layout A4 revisado: margens, paginação, contraste para impressão P&B.
- Folha não chama `gerarCPP` — usa roteiro já gerado.

---

## V13.2 (2026-06-14)

**Fecha cobertura do mapa com DESL ancorado e coordenadas escolares.**

- DESL agora usa sempre a coordenada do município de destino (não do município de origem).
- Matching de coordenadas: nome exato primeiro; se não encontrar, substring mais longo.
- Escolas auditadas e geocodificadas individualmente por município.
- Cobertura global do mapa: ~82–83%.
- Coordenadas aceitas somente com fonte Nominatim/OSM validada dentro do quadrante do município.
- Pontos genéricos ou ambíguos permanecem `null` por honestidade de dados.

---

## Versões anteriores (antes de V13.2)

| Versão | Resumo |
|---|---|
| V9 | Mobile Experience: Modo Patrulha, GPS, PWA offline, auto dark mode |
| V8 | Integração SSP-SP, estatísticas 2025, hotspots detalhados |
| V7 | Auditoria de proveniência de dados, policiamento comunitário |
| V6 | ESC Fim de Semana, perfil criminal, sinistros Infosiga, geocodificação OSM |
| V5 | Camada 2 (PPI), Ronda Escolar por horários reais, hotspots direcionados |
| V4 | Suporte a múltiplos focos de distribuição |
| V3 | Motor base: seed, grade 30 min, PREL/REL, refeições, DESL multi-município |
