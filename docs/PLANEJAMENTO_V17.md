# Planejamento V17 — Histórico local de CPPs

## Problema

O app gera o CPP, permite execução em campo e imprime a Folha CPP, mas não guarda snapshots dos CPPs anteriores. Cada geração sobrescreve a anterior. Não há como rever, duplicar ou exportar um CPP gerado dias atrás.

---

## Objetivo

Salvar, listar, reabrir, duplicar, excluir e exportar CPPs gerados localmente.

---

## Regra principal

> **Histórico salva snapshot do roteiro já gerado — não recalcula.**

Ao reabrir um CPP salvo, o roteiro exibido é exatamente o que foi gerado na hora do salvamento. Mesmo que a configuração seja reaproveitada, o motor só é chamado se o usuário explicitamente pedir "Gerar novo CPP".

---

## Modelo de dados preliminar

```typescript
interface CPPSalvo {
  id: string;                     // uuid v4 gerado no cliente
  versaoApp: string;              // ex: "V17"
  criadoEm: string;               // ISO 8601 local
  configuracao: ConfiguracaoServico;
  blocos: BlocoHorario[];
  avisos: string[];
  resumo: {
    municipio: string;
    tipoAtividade: string;
    horaInicio: string;
    horaTermino: string;
    totalBlocos: number;
  };
}
```

---

## Armazenamento

- `localStorage` com chave `cpp_historico` (array de `CPPSalvo`, JSON).
- Limite sugerido: 30 CPPs salvos. O mais antigo é descartado ao ultrapassar.
- Alternativa futura: IndexedDB para volume maior — mas `localStorage` é suficiente para a V17.

---

## Fluxo proposto

```
[Tela CPP gerado]
  └─ Botão "Salvar CPP" → serializa blocos + config → push em cpp_historico → toast de confirmação

[Tela Histórico] (nova rota /historico)
  └─ Lista: data, município, atividade, qtd blocos
  └─ Ações por item: Reabrir | Duplicar config | Excluir | Exportar JSON
       └─ Reabrir → exibe CPPTurno com os blocos salvos (sem recalcular)
       └─ Duplicar config → preenche ConfiguracaoServico com a config do CPP salvo
       └─ Exportar → download de arquivo .json com o CPPSalvo
```

---

## Riscos

| Risco | Mitigação |
|---|---|
| Reabrir recalcula roteiro | Snapshot armazena `blocos` — `gerarCPP` não é chamado ao reabrir |
| localStorage corrompido | Try/catch no parse; exibe lista vazia se falhar |
| Duplicação acidental | Confirmar antes de salvar se já existe CPP da mesma data+hora |
| Tamanho do storage | Limite de 30 CPPs; aviso ao usuário quando próximo do limite |
| Offline | localStorage funciona offline-first por definição |

---

## Testes previstos

```
test_historico.ts (ou integrado em test_manual_mode.ts):
- salvar CPP → reabre sem recalcular
- salvar CPP → duplicar config → config idêntica à original
- excluir CPP → não aparece na lista
- exportar → JSON válido com todos os campos
- importar JSON → adiciona ao histórico (se implementado)
- JSON inválido → erro tratado, histórico preservado
- storage corrompido → catch, lista vazia
- limite de 30 CPPs → mais antigo descartado
```

---

## Impacto em arquivos existentes

| Arquivo | Mudança esperada |
|---|---|
| `client/src/lib/gerarCPP.ts` | Nenhuma (motor preservado) |
| `client/src/pages/CPPTurno.tsx` | Adicionar botão "Salvar CPP" |
| `client/src/pages/ConfiguracaoServico.tsx` | Link para /historico |
| `client/src/lib/historico.ts` | **Novo** — CRUD do localStorage |
| `client/src/pages/HistoricoCPP.tsx` | **Novo** — tela de listagem |
| `client/src/pages/CPPReaberto.tsx` | **Novo ou rota** — exibe CPP salvo sem recalcular |

---

## O que NÃO muda

- Motor (`gerarCPP.ts`): intocável.
- Coordenadas, pesos, seed, grade, PREL/REL, refeições.
- Fuzz: 0 violações obrigatório antes de fechar a sprint.
- `test_manual_mode.ts` e `test_manual_preview.ts`: devem continuar passando.

---

## Definição de "concluído"

A V17 está concluída quando:

1. Usuário consegue salvar um CPP gerado com um clique.
2. Histórico lista CPPs salvos com data, município e atividade.
3. Reabrir exibe o roteiro exato sem recalcular.
4. Excluir e duplicar config funcionam.
5. Exportar JSON funciona offline.
6. Fuzz 0 violações.
7. TypeScript sem erros.
8. Build sem erros.
