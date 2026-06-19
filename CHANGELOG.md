# CHANGELOG — CPP Roteiro de Policiamento

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
