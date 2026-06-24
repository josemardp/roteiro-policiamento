/**
 * Score Global do Roteiro — V21
 *
 * Avalia a qualidade de um roteiro completo como um número escalar.
 * Maior = melhor roteiro. Usado pelo LNS como critério de aceitação.
 *
 * Componentes:
 *  w1 * coberturaHotspotsAltoRisco
 * -w2 * deslocamentoAcumuladoKm
 * -w3 * previsibilidadeResidual
 * -w4 * fadigaAcumulada
 * -w5 * concentracaoPorBairro
 * +w6 * equilibrioCoberturaMunicipal
 */

import type { BlocoHorario, Municipio, ModalidadePoliciamento } from "./types";
import type { Hotspot } from "./municipios/types-ppi";
import { PPI_5CIA } from "./municipios/ppi-5cia";
import { distanciaKm } from "./gerarCPP";
import type { DirectivePayload } from "./domain/directivePayload";
import { MissionTimelineHelper } from "./domain/missionTimeline";

// ─── Pesos da função de score ─────────────────────────────────────────────────
const W1_COBERTURA_HOTSPOT = 10.0;
const W2_DESLOCAMENTO = 2.0;
const W3_PREVISIBILIDADE = 5.0;
const W4_FADIGA = 3.0;
const W5_CONCENTRACAO_BAIRRO = 4.0;
const W6_EQUILIBRIO_MUNICIPAL = 3.0;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function horaParaMin(hora: string): number {
  const [h, m] = hora.split(":").map(Number);
  return h * 60 + m;
}

const MODALIDADES_ATIVAS: Set<string> = new Set([
  "POST", "PREV", "PE", "FISC", "ESC", "RURAL", "SAT",
]);

const MODALIDADES_ALTA_EXPOSICAO: Set<string> = new Set([
  "FISC", "POST", "SAT",
]);

// ─── Componente 1: Cobertura de Hotspots ──────────────────────────────────────

function calcularCoberturaHotspots(
  blocos: BlocoHorario[],
  municipios: Municipio[]
): number {
  let score = 0;

  for (const mun of municipios) {
    const ppi = (PPI_5CIA as any)[mun];
    if (!ppi?.hotspots) continue;

    const hotspots: Hotspot[] = ppi.hotspots;
    for (const h of hotspots) {
      if (h.confianca === "a_validar_comando") continue;
      if (h.horaInicioCritico === null || h.horaFimCritico === null) continue;

      // Calcula intensidade baseada em frequenciaAnual
      const janelaHoras =
        h.horaFimCritico >= h.horaInicioCritico
          ? h.horaFimCritico - h.horaInicioCritico + 1
          : 24 - h.horaInicioCritico + h.horaFimCritico + 1;
      const taxa =
        h.frequenciaAnual !== null && h.frequenciaAnual > 0
          ? h.frequenciaAnual / Math.max(janelaHoras, 1)
          : ({ Alto: 5, Médio: 3, Baixo: 2 }[h.risco] ?? 2);

      // Verifica se algum bloco do roteiro cobre este hotspot
      const chaveHotspot = `${h.local} (${h.bairro})`.toLowerCase();
      let coberto = false;
      for (const b of blocos) {
        if (b.municipio !== mun) continue;
        if (!MODALIDADES_ATIVAS.has(b.modalidade)) continue;
        if (b.local.toLowerCase().includes(chaveHotspot) || chaveHotspot.includes(b.local.toLowerCase().slice(0, 20))) {
          const horaBloco = Math.floor((horaParaMin(b.horaInicio) % 1440) / 60);
          const naJanela =
            h.horaInicioCritico <= h.horaFimCritico
              ? horaBloco >= h.horaInicioCritico && horaBloco <= h.horaFimCritico
              : horaBloco >= h.horaInicioCritico || horaBloco <= h.horaFimCritico;
          if (naJanela) {
            coberto = true;
            break;
          }
        }
      }

      if (coberto) score += taxa;
    }
  }

  return score;
}

// ─── Componente 2: Deslocamento Acumulado ─────────────────────────────────────

function calcularDeslocamentoAcumulado(blocos: BlocoHorario[]): number {
  let totalKm = 0;

  for (let i = 1; i < blocos.length; i++) {
    const prev = blocos[i - 1];
    const curr = blocos[i];
    if (
      typeof prev.lat === "number" &&
      typeof prev.lng === "number" &&
      typeof curr.lat === "number" &&
      typeof curr.lng === "number"
    ) {
      totalKm += distanciaKm(prev.lat, prev.lng, curr.lat, curr.lng);
    }
  }

  return totalKm;
}

// ─── Componente 3: Previsibilidade Residual ───────────────────────────────────

function calcularPrevisibilidade(blocos: BlocoHorario[]): number {
  const tactico = blocos
    .map((b) => b.modalidade)
    .filter((m) => !["PREL", "DESL", "REF", "REL", "RONDA"].includes(m));

  if (tactico.length < 3) return 0;

  // Conta trigramas repetidos
  const contagem = new Map<string, number>();
  for (let i = 0; i < tactico.length - 2; i++) {
    const chave = `${tactico[i]}|${tactico[i + 1]}|${tactico[i + 2]}`;
    contagem.set(chave, (contagem.get(chave) ?? 0) + 1);
  }

  let repeticoes = 0;
  contagem.forEach((freq) => {
    if (freq >= 2) repeticoes += freq - 1;
  });

  return repeticoes;
}

// ─── Componente 4: Fadiga Acumulada ───────────────────────────────────────────

function calcularFadiga(blocos: BlocoHorario[], turnoInicioMin: number): number {
  let fadigaTotal = 0;

  for (const b of blocos) {
    if (!MODALIDADES_ALTA_EXPOSICAO.has(b.modalidade)) continue;

    let inicioBloco = horaParaMin(b.horaInicio);
    if (inicioBloco < turnoInicioMin) inicioBloco += 1440;
    const horasNoTurno = (inicioBloco - turnoInicioMin) / 60;

    // Peso de fadiga cresce quadraticamente após 6h
    if (horasNoTurno >= 6) {
      const fator = (horasNoTurno - 5) * 0.5;
      const durBloco = horaParaMin(b.horaFim) - horaParaMin(b.horaInicio);
      fadigaTotal += fator * (durBloco / 30);
    }
  }

  return fadigaTotal;
}

// ─── Componente 5: Concentração por Bairro (Gini invertido) ───────────────────

function calcularConcentracaoBairro(blocos: BlocoHorario[]): number {
  const contagem = new Map<string, number>();

  for (const b of blocos) {
    if (!MODALIDADES_ATIVAS.has(b.modalidade)) continue;
    const local = b.local.slice(0, 30); // normaliza
    contagem.set(local, (contagem.get(local) ?? 0) + 1);
  }

  const valores = Array.from(contagem.values());
  if (valores.length <= 1) return 0;

  // Índice de Gini simplificado
  const n = valores.length;
  const media = valores.reduce((a, b) => a + b, 0) / n;
  if (media === 0) return 0;

  let somaAbsDiff = 0;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      somaAbsDiff += Math.abs(valores[i] - valores[j]);
    }
  }

  return somaAbsDiff / (n * n * media);
}

// ─── Componente 6: Equilíbrio de Cobertura Municipal ──────────────────────────

function calcularEquilibrioMunicipal(
  blocos: BlocoHorario[],
  municipios: Municipio[]
): number {
  if (municipios.length <= 1) return 0;

  const temposPorMun = new Map<string, number>();
  for (const mun of municipios) temposPorMun.set(mun, 0);

  for (const b of blocos) {
    if (!b.municipio || !MODALIDADES_ATIVAS.has(b.modalidade)) continue;
    const dur = horaParaMin(b.horaFim) - horaParaMin(b.horaInicio);
    temposPorMun.set(b.municipio, (temposPorMun.get(b.municipio) ?? 0) + dur);
  }

  const valores = Array.from(temposPorMun.values());
  const media = valores.reduce((a, b) => a + b, 0) / valores.length;
  if (media === 0) return 0;

  // Desvio-padrão normalizado (menor = melhor equilíbrio)
  const variancia =
    valores.reduce((s, v) => s + (v - media) ** 2, 0) / valores.length;
  return Math.sqrt(variancia) / media; // coeficiente de variação
}

// ─── Score Global ─────────────────────────────────────────────────────────────

export interface ContextoScore {
  municipios: Municipio[];
  turnoInicioMin: number;
  diretivas?: DirectivePayload;
}

export function avaliarScoreGlobal(
  blocos: BlocoHorario[],
  contexto: ContextoScore
): number {
  const cobertura = calcularCoberturaHotspots(blocos, contexto.municipios);
  const deslocamento = calcularDeslocamentoAcumulado(blocos);
  const previsibilidade = calcularPrevisibilidade(blocos);
  const fadiga = calcularFadiga(blocos, contexto.turnoInicioMin);
  const concentracao = calcularConcentracaoBairro(blocos);
  const equilibrio = calcularEquilibrioMunicipal(blocos, contexto.municipios);

  let scoreTotal = (
    W1_COBERTURA_HOTSPOT * cobertura -
    W2_DESLOCAMENTO * deslocamento -
    W3_PREVISIBILIDADE * previsibilidade -
    W4_FADIGA * fadiga -
    W5_CONCENTRACAO_BAIRRO * concentracao -
    W6_EQUILIBRIO_MUNICIPAL * equilibrio
  );

  if (contexto.diretivas) {
    const focoOS = contexto.diretivas.focosDiretivas.find(
      (f) => f.origem === "ORDEM_SERVICO" && f.timeline
    );
    if (focoOS && focoOS.timeline) {
      const helper = new MissionTimelineHelper(focoOS.timeline);
      for (const b of blocos) {
        if (b.modalidade === "PREL" || b.modalidade === "REL") continue;
        const inicioMin = horaParaMin(b.horaInicio);
        const fases = helper.buscarFasesAtivas(inicioMin);
        for (const fase of fases) {
          if (fase.tipo === "PREFERENCIA" && fase.modificadores) {
            const mod = fase.modificadores.find(m => m.modalidade === b.modalidade);
            if (mod) {
              // Base preference bonus
              let bonus = 15.0 * mod.multiplicadorPeso;
              // Target match bonus/penalty
              if (mod.alvos && mod.alvos.length > 0 && b.municipio) {
                const hasMatchingTarget = mod.alvos.some(
                  a => b.local.toLowerCase().includes(a.textoOriginal.toLowerCase()) || 
                       a.textoOriginal.toLowerCase().includes(b.local.toLowerCase())
                );
                if (hasMatchingTarget) {
                  bonus += 30.0 * mod.multiplicadorPeso;
                } else {
                  bonus -= 20.0 * mod.multiplicadorPeso;
                }
              }
              scoreTotal += bonus;
            }
          }
          if (fase.tipo === "CONTEXTO" && fase.contexto) {
            const ctx = fase.contexto;
            if (ctx.focoEspecifico === "COMERCIAL" && (b.modalidade === "POST" || b.modalidade === "PE")) {
              scoreTotal += 10.0;
            } else if (ctx.focoEspecifico === "RESIDENCIAL" && b.modalidade === "PREV") {
              scoreTotal += 10.0;
            } else if (ctx.focoEspecifico === "RURAL" && b.modalidade === "RURAL") {
              scoreTotal += 10.0;
            } else if (ctx.focoEspecifico === "TRANSITO" && b.modalidade === "FISC") {
              scoreTotal += 10.0;
            }

            if (ctx.riscoAglomeracao && (b.modalidade === "PE" || b.modalidade === "POST")) {
              scoreTotal += 10.0;
            }
          }
        }
      }
    }
  }

  return scoreTotal;
}
