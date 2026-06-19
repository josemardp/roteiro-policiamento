# Lei de Dados — Política de Proveniência

> Regra que governa todo dado incluído no projeto.

---

## Princípio

**Dado oficial só é oficial com fonte real verificável.**

Sem fonte ou ponto ambíguo → `null` / "a validar".
Nunca usar centro da cidade como coordenada-tampa.
Nunca inventar estatística.

---

## Coordenadas (`coordenadas-pontos.ts`)

### Critério de aceitação

Coordenada só entra se:
1. Fonte: Nominatim/OSM retornou ponto ou via plausível **dentro do quadrante do município**.
2. Ponto foi revisado manualmente.
3. Campo `fonte` preenchido com a origem real.

### Critério de rejeição

- Ponto fora do quadrante do município → `null`.
- Nome genérico sem localização inequívoca → `null`.
- Bairro inteiro tratado como ponto → `null`.

### Coordenadas de referência por município

Usadas quando nenhum ponto específico é encontrado. Representam um marco central válido (base policial, praça principal).

### Regra de DESL

DESL usa sempre a coordenada do **município de destino** — nunca do origem.

---

## Estatísticas criminais (Camada 1 e PPI)

- Fonte obrigatória: SSP-SP (estatísticas mensais publicadas).
- Dados de 2025 extraídos dos boletins mensais oficiais.
- Dados sem publicação oficial ficam como "a validar" e **não influenciam o motor**.
- Hotspot `a_validar_comando` não afeta a seleção automática de localidades.

### Pendência declarada

**Violência doméstica / Maria da Penha:** não há dado oficial publicado desagregado por área da 5ª Cia com granularidade suficiente. A fundamentação menciona a pendência explicitamente e não cita número sem fonte.

---

## Estatísticas de sinistros (Infosiga)

- Fonte: Infosiga SP (DETRAN-SP).
- Usados apenas para trechos de rodovia com dado real validado.
- Sem dado oficial → campo vazio.

---

## Escolas (ESC)

- Auditadas individualmente por município.
- Geocodificadas via Nominatim/OSM com revisão manual.
- Escolas sem coordenada verificável ficam sem coordenada (`null`).

---

## O que NUNCA fazer

- Não copiar coordenada de uma cidade para outra.
- Não usar `lat: -21.25, lng: -50.64` genérico como ponto específico.
- Não afirmar que "X é o local de maior incidência" sem dado real.
- Não incluir hotspot sem fonte na Camada 2.
- Não preencher campo de violência doméstica com estimativa.

---

## Impacto no motor

Dados de Camada 1 e Camada 2 influenciam:
- Pesos de modalidade por período.
- Seleção de hotspots e localidades.
- Ronda Escolar (horários reais).
- Saturação em mês de evento.

Dados com `a_validar` no campo de fonte são ignorados pelo motor na seleção de localidades.
