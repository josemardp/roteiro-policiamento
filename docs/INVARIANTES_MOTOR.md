# Invariantes do Motor — gerarCPP.ts

> Leia este documento antes de tocar em `gerarCPP.ts`.
> Qualquer alteração no motor exige fuzz completo (11.520 roteiros · 0 violações).

---

## O que o motor garante

### 1. Seed reproduzível

```typescript
// RNG: mulberry32 + hashStr
const seed = hashStr(configuracao.data + configuracao.horaInicio + municipio);
const rng = mulberry32(seed);
```

Mesma configuração → mesmo roteiro. Turnos diferentes (data ou hora diferentes) → RNGs diferentes.

**Nunca alterar a fórmula do seed sem regredir todos os testes.**

### 2. Grade de 30 minutos

Todos os blocos iniciam em múltiplos de 30 min. Blocos manuais são snapped via `snapGrid30`:

```typescript
function snapGrid30(min: number): number {
  return Math.round(min / 30) * 30;
}
```

### 3. Soma exata

A soma das durações de todos os blocos deve ser igual à duração do turno. O fuzz verifica isso em cada um dos 11.520 roteiros.

### 4. PREL — sempre o primeiro bloco

Duração: 30 min. Horário: `turnoInicio → turnoInicio + 30`.

O bloco PREL nunca pode ser suprimido, deslocado ou encurtado.

### 5. REL — sempre o último bloco

Duração: 30 min. Horário: `turnoFim − 30 → turnoFim`.

O bloco REL nunca pode ser suprimido, deslocado ou encurtado.

### 6. Refeições

- Nunca antes dos primeiros 180 min do turno.
- Janelas horárias por tipo:
  - Almoço: ~12–13h (absoluto).
  - Café da tarde: ~16h30 (absoluto).
  - Janta: ~20–22h (absoluto).
  - Ceia: ~02–03h (absoluto).
- `clockMinAbsoluto` normaliza horários que cruzam meia-noite.
- Tipo de refeição não se repete consecutivamente.

### 7. DESL

Em roteiros multi-município, cada deslocamento usa a coordenada do **município de destino**. Nunca do município de origem.

### 8. Turnos após meia-noite

`clockMinAbsoluto(clockMin, depoisDeMin)`: enquanto `alvo < depoisDeMin`, incrementa 1440. Garante que `00h00` em turno de `23h30` seja minuto interno `1440`, não `0`.

Esta função é usada tanto nas refeições quanto no parser de blocos manuais.

### 9. Modo manual

- Blocos manuais são injetados no roteiro automático na posição correta (por `inicioMin` absoluto).
- Blocos manuais sobrepostos à PREL geram aviso e são ignorados.
- Blocos fora da janela do turno geram aviso e são ignorados.
- Local digitado pelo usuário é sempre preservado (nunca substituído por localidade automática).

---

## O que o fuzz verifica

`client/fuzz_test.ts` testa **11.520 roteiros** (combinação de municípios × atividades × horários × semente):

```
Para cada roteiro:
  ✓ soma(blocos.duracao) === duracaoTurno
  ✓ blocos[0].modalidade === "PREL"
  ✓ blocos[0].duracao === 30
  ✓ blocos[last].modalidade === "REL"
  ✓ blocos[last].duracao === 30
  ✓ todo horaInicio % 30 === 0
  ✓ sem sobreposição entre blocos consecutivos
  ✓ pelo menos 1 REF em turno >= 8h
```

---

## Como rodar o fuzz

```bash
./node_modules/.bin/tsx client/fuzz_test.ts
```

Saída esperada:

```
Fuzz finalizado com 0 falhas.
```

Se houver violações, **não fechar a sprint**.

---

## O que NÃO alterar sem justificativa muito forte

- Fórmula de seed (`hashStr`).
- RNG (`mulberry32`).
- `snapGrid30`.
- `clockMinAbsoluto`.
- Durações em `DURACAO_TURNO_MIN` e `DURACAO_REFEICAO`.
- Posição de PREL e REL.
- Janelas de refeição.
- Pesos em `MODALIDADES` (calibrados para a 5ª Cia).
- Regras de anti-repetição.
- Lógica de DESL.

---

## Exports do motor

```typescript
export function parseDataLocal(dataStr: string): Date
export function planejarRefeicoes(...)
export function calcularHoraTermino(horaInicio, tipoAtividade): string
export function obterCoordenadasLocal(municipio, local): CoordenadaPonto | null
export function analisarDescricaoManual(desc: string): AnalisadoManual
export type PreviewBlocoManual
export function analisarBlocosManuaisPreview(texto, horaInicioTurno, horaTerminoTurno?): PreviewBlocoManual[]
export function gerarCPP({ configuracao, municipios }): { blocos, avisos }
export function gerarFundamentacao(...)
```

Funções internas (`parseBlocosManuais`, `clockMinAbsoluto`, `snapGrid30`, `mulberry32`, etc.) são privadas ao módulo e não devem ser exportadas salvo necessidade de teste.
