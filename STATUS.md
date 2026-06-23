# STATUS — CPP Roteiro de Policiamento

> Documento de handoff. Atualizado em V18 + Motor de Inteligência Manual (2026-06-23).
> Qualquer agente pode continuar o trabalho a partir daqui.

---

## Estado atual

| Item | Valor |
|---|---|
| Última versão concluída | V18 + Motor de Inteligência Manual |
| Branch | `main` |
| Motor | Estável — não alterar sem fuzz |
| Fuzz | 11.520 roteiros · 0 violações |
| Modo manual | Funcional com UX completa |
| Mapa | Maduro · cobertura ~82–83% |
| Folha CPP | Funcional |
| Histórico | Implementado (localStorage `historico_roteiros`) |
| PWA produção | Corrigido (base path GitHub Pages) |
| Próxima sprint | Nenhum novo escopo funcional (Apenas manutenção/dados) |

---

## Frentes fechadas

Estas frentes **não precisam ser reabertas** salvo bug confirmado:

| Frente | Sprint | Observação |
|---|---|---|
| Motor base (seed, grade, soma, PREL/REL) | V3–V8 | Fuzz cobre invariantes |
| Refeições (janela horária real) | V5 | Almoço/Janta/Ceia por clockMinAbsoluto |
| DESL multi-município | V5–V13.2 | Sempre ancorado no destino |
| Atividades mono-município | V5 | Delegada/DEJEM: circuito fechado |
| Mapa com coordenadas reais | V13.2 | Matching exato + substring mais longo |
| Folha CPP imprimível | V14.1 | window.print(), A4, P&B, sem jsPDF |
| Modo manual — parser | V15 | parseBlocosManuais com clockMinAbsoluto |
| Modo manual — sigla no meio | V15.1 | analisarDescricaoManual, PE não casa em palavras |
| Modo manual — UX | V16 | ModoManualUI, prévia, formulário, botões |
| Turnos após meia-noite | V16.1 | 00h00 após 23h30 → minuto interno 1440 |
| Histórico local de CPPs | V17 | localStorage `historico_roteiros`; reabrir não recalcula; backup JSON export/import |
| Modo Manual Inteligente | V18 | Inserção flutuante (Wishlist), fuzzy logic, autocorretor Levenshtein de endereços, overleap dinâmico que empurra REF em vez de apagar bloco. |
| PWA/offline em produção | Auditoria | SW + manifest respeitam o `base` do GitHub Pages |
| Higiene de build | Auditoria | Removido runtime/debug da plataforma Manus e analytics quebrado do `index.html` |
| Integração Consolidada de Escolas | Auditoria | 69 instituições ativas (incluindo particulares, Etecs, EAD) adicionadas com integridade geográfica |

---

## Pendências reais

Estas pendências **existem de verdade** e ainda não foram implementadas:

| Pendência | Prioridade | Observação |
|---|---|---|
| Violência doméstica / Maria da Penha | Média | Sem dado oficial validado — declarado como pendente na fundamentação |
| Coordenadas de áreas rurais / conjuntos vagos | Baixa | Permanecem `null` por honestidade de dados |


---

## Invariantes que nunca podem ser violados

Qualquer PR que tocar `gerarCPP.ts` deve:

1. Rodar `./node_modules/.bin/tsx client/fuzz_test.ts` e obter 0 violações.
2. Rodar `./node_modules/.bin/tsx client/test_manual_mode.ts` e obter 35/35.
3. Rodar `./node_modules/.bin/tsx client/test_manual_preview.ts` e obter 24/24.
4. Rodar `pnpm check` sem erros TypeScript.
5. Rodar `pnpm build` sem erros.

Invariantes verificados pelo fuzz:
- Soma exata dos blocos = duração do turno.
- Primeiro bloco sempre PREL (30 min).
- Último bloco sempre REL (30 min).
- Todos os horários em múltiplos de 30 min.
- Pelo menos uma refeição em turno ≥ 8h.
- Sem sobreposição de blocos.

---

## Comandos essenciais

```bash
pnpm install          # instalar dependências
pnpm check            # tsc --noEmit
pnpm dev              # dev server (Vite)
pnpm build            # build de produção

./node_modules/.bin/tsx client/fuzz_test.ts
./node_modules/.bin/tsx client/test_manual_mode.ts
./node_modules/.bin/tsx client/test_manual_preview.ts
```

---

## Arquivos que NÃO devem ser alterados sem motivo forte

| Arquivo | Por quê |
|---|---|
| `client/src/lib/gerarCPP.ts` (motor) | Qualquer mudança exige fuzz completo |
| `client/src/lib/municipios/coordenadas-pontos.ts` | Coordenadas auditadas manualmente; não inventar |
| `client/src/lib/municipios/ppi-5cia.ts` | Pesos e focos calibrados para a 5ª Cia |
| `client/src/lib/constants.ts` | Durações de turno, DURACAO_REFEICAO — alterar quebra fuzz |

---

## Arquitetura resumida

```
Configuração (ConfiguracaoServico.tsx)
  └─ gerarCPP(configuracao, municipios)
       ├─ Seed RNG (mulberry32 + hashStr)
       ├─ Grade 30 min
       ├─ PREL (turnoInicio → +30)
       ├─ Blocos automáticos por peso × período × anti-rep
       ├─ Blocos manuais (parseBlocosManuais + clockMinAbsoluto)
       ├─ REF (janela horária real)
       ├─ DESL (coordenada destino)
       └─ REL (turnoFim − 30)
  └─ Roteiro (CPPTurno.tsx)
       ├─ Mapa (coordenadas-pontos.ts)
       ├─ Folha CPP (window.print)
       └─ Modo patrulha + GPS

Prévia (ModoManualUI.tsx)
  └─ analisarBlocosManuaisPreview (pura, não chama gerarCPP)
```

---

## Histórico de decisões relevantes

| Decisão | Razão |
|---|---|
| Seed determinístico por data+hora+município | Mesmo roteiro se gerado de novo com mesma config |
| clockMinAbsoluto no parser manual | Turnos após meia-noite: 00h00 deve ser 1440, não 0 |
| Sigla explícita vence inferência | "fiscalização PE Banco do Brasil" → PE, não FISC |
| PE não casa em palavras | "perímetro", "presença", "pedestre" não são PE |
| Coordenadas apenas com fonte real | Lei de Dados: nunca inventar ponto geográfico |
| Folha CPP via window.print() | Sem dependência de jsPDF/html2canvas, offline-safe |
| Prévia não chama gerarCPP | Preview é pura: sem efeito colateral, testável isolada |
