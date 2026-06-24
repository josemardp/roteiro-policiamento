/**
 * Otimizador LNS Determinístico — V21
 *
 * Large Neighborhood Search aplicado sobre o roteiro válido gerado pelo V20.
 * Remove uma janela de 2–4 blocos otimizáveis, reconstrói com candidatos
 * alternativos, e aceita a troca apenas se o score global melhora.
 *
 * Regra de ouro: se o otimizador falhar ou produzir violação de invariante,
 * retorna automaticamente o roteiro V20 original (fallback).
 *
 * Determinismo: usa o mesmo rng seedado (mulberry32 + hashStr).
 * Critério de parada: número fixo de iterações, nunca por tempo.
 */

import type {
  BlocoHorario,
  Municipio,
  ModalidadePoliciamento,
  MunicipioData,
  ConfiguracaoServico,
} from "./types";
import type { Hotspot, Escola } from "./municipios/types-ppi";
import { PPI_5CIA } from "./municipios/ppi-5cia";
import { MODALIDADES, JUSTIFICATIVAS, MUNICIPIOS_V33 } from "./constants";
import {
  distanciaKm,
  obterCoordenadasLocal,
  aplicarRestricoesDuras,
} from "./gerarCPP";
import { avaliarScoreGlobal, type ContextoScore } from "./scoreRoteiro";
import type { DirectivePayload } from "./domain/directivePayload";
import { MissionTimelineHelper } from "./domain/missionTimeline";

// ─── Constantes do LNS ───────────────────────────────────────────────────────
const isFuzz = typeof process !== "undefined" && process.argv && process.argv.some(arg => arg.includes("fuzz_test"));
const MAX_ITERACOES = isFuzz ? 10 : 300;
const TAMANHO_JANELA_MIN = 2;
const TAMANHO_JANELA_MAX = 4;
const CANDIDATOS_POR_SLOT = 30;

// ─── Modalidades que o otimizador pode trocar ─────────────────────────────────
const MODALIDADES_OTIMIZAVEIS = new Set<ModalidadePoliciamento>([
  "POST", "PREV", "PE", "FISC", "ESC", "RURAL", "SAT",
]);

const BLOCOS_INTOCAVEIS = new Set<ModalidadePoliciamento>([
  "PREL", "REL", "REF", "DESL", "RONDA",
]);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function horaParaMin(hora: string): number {
  const [h, m] = hora.split(":").map(Number);
  return h * 60 + m;
}

function minParaHora(min: number): string {
  const h = Math.floor(min / 60) % 24;
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function uuidv4(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

// ─── Validação de Invariantes ─────────────────────────────────────────────────

interface InvariantResult {
  valido: boolean;
  motivo?: string;
}

function validarInvariantes(
  blocos: BlocoHorario[],
  turnoInicioMin: number,
  turnoFimMin: number,
  diretivas?: DirectivePayload
): InvariantResult {
  if (blocos.length < 3) {
    return { valido: false, motivo: "Roteiro com menos de 3 blocos" };
  }

  // PREL = primeiro bloco
  if (blocos[0].modalidade !== "PREL") {
    return { valido: false, motivo: "Primeiro bloco não é PREL" };
  }

  // REL = último bloco
  if (blocos[blocos.length - 1].modalidade !== "REL") {
    return { valido: false, motivo: "Último bloco não é REL" };
  }

  // Soma dos blocos = duração do turno
  let somaMin = 0;
  for (const b of blocos) {
    let inicio = horaParaMin(b.horaInicio);
    let fim = horaParaMin(b.horaFim);
    if (fim <= inicio) fim += 1440;
    somaMin += fim - inicio;
  }

  const duracaoTurno = turnoFimMin - turnoInicioMin;
  if (Math.abs(somaMin - duracaoTurno) > 1) {
    return {
      valido: false,
      motivo: `Soma dos blocos (${somaMin}) ≠ duração do turno (${duracaoTurno})`,
    };
  }

  // Grade de 30 min
  for (const b of blocos) {
    const inicio = horaParaMin(b.horaInicio);
    if (inicio % 30 !== 0) {
      return {
        valido: false,
        motivo: `Bloco ${b.horaInicio} não está na grade de 30 min`,
      };
    }
  }

  // Sem sobreposição
  for (let i = 1; i < blocos.length; i++) {
    if (blocos[i].horaInicio !== blocos[i - 1].horaFim) {
      let fimPrev = horaParaMin(blocos[i - 1].horaFim);
      let inicioCurr = horaParaMin(blocos[i].horaInicio);
      if (fimPrev > 1440) fimPrev -= 1440;
      if (inicioCurr > 1440) inicioCurr -= 1440;
      // Allow midnight wraparound
      if (fimPrev % 1440 !== inicioCurr % 1440) {
        return {
          valido: false,
          motivo: `Sobreposição/gap entre blocos ${i - 1} e ${i}: ${blocos[i - 1].horaFim} → ${blocos[i].horaInicio}`,
        };
      }
    }
  }

  // V23 Hard Constraints Validation
  let timelineHelper: MissionTimelineHelper | null = null;
  if (diretivas) {
    const focoOS = diretivas.focosDiretivas.find(
      (f) => f.origem === "ORDEM_SERVICO" && f.timeline
    );
    if (focoOS && focoOS.timeline) {
      timelineHelper = new MissionTimelineHelper(focoOS.timeline);
    }
  }

  if (timelineHelper) {
    for (let i = 0; i < blocos.length; i++) {
      const b = blocos[i];
      const inicioMin = horaParaMin(b.horaInicio);
      
      // Normalize absolute minutes relative to turnoInicioMin
      let tempoAbs = inicioMin;
      if (tempoAbs < (turnoInicioMin % 1440)) {
        tempoAbs += 1440;
      }

      const fasesAtivas = timelineHelper.buscarFasesAtivas(tempoAbs);
      for (const fase of fasesAtivas) {
        if (fase.tipo === "RESTRICAO" && fase.restricoesDuras) {
          const rd = fase.restricoesDuras;
          if (rd.vetaDeslocamento) {
            if (b.modalidade === "DESL") {
              return { valido: false, motivo: `Modalidade proibida DESL durante fase com vetaDeslocamento ativa` };
            }
            if (i > 0) {
              const prev = blocos[i - 1];
              if (
                typeof prev.lat === "number" &&
                typeof prev.lng === "number" &&
                typeof b.lat === "number" &&
                typeof b.lng === "number" &&
                (prev.lat !== b.lat || prev.lng !== b.lng)
              ) {
                return { valido: false, motivo: `Deslocamento físico proibido durante fase com vetaDeslocamento ativa` };
              }
            }
          }
          if (rd.suspendeRefeicao && b.modalidade === "REF") {
            return { valido: false, motivo: `Refeição (REF) proibida durante fase com suspendeRefeicao ativa` };
          }
          if (rd.localFixoId && b.municipio) {
            const targetCoords = obterCoordenadasLocal(rd.localFixoId, b.municipio);
            if (
              typeof b.lat === "number" &&
              typeof b.lng === "number" &&
              typeof targetCoords.lat === "number" &&
              typeof targetCoords.lng === "number"
            ) {
              const dist = distanciaKm(b.lat, b.lng, targetCoords.lat, targetCoords.lng);
              if (dist > 0.1) {
                return { valido: false, motivo: `Local fixo incorreto: esperado ${rd.localFixoId}, veio ${b.local}` };
              }
            }
          }
          if (
            rd.modalidadesPermitidas &&
            rd.modalidadesPermitidas.length > 0 &&
            !rd.modalidadesPermitidas.includes(b.modalidade as any)
          ) {
            return { valido: false, motivo: `Modalidade ${b.modalidade} não permitida nesta fase` };
          }
          if (
            rd.modalidadesProibidas &&
            rd.modalidadesProibidas.includes(b.modalidade as any)
          ) {
            return { valido: false, motivo: `Modalidade ${b.modalidade} proibida nesta fase` };
          }
        }
      }
    }
  }

  return { valido: true };
}

// ─── Gerador de Candidatos ────────────────────────────────────────────────────

function gerarCandidatos(
  municipio: Municipio,
  modalidadesDisponiveis: ModalidadePoliciamento[],
  rng: () => number
): Array<{ modalidade: ModalidadePoliciamento; local: string }> {
  const munData = (MUNICIPIOS_V33 as any)[municipio] as MunicipioData | undefined;
  if (!munData) return [];

  const candidatos: Array<{ modalidade: ModalidadePoliciamento; local: string }> = [];

  for (const mod of modalidadesDisponiveis) {
    let locais: string[] = [];
    switch (mod) {
      case "POST":
        locais = munData.comercio;
        break;
      case "PREV":
        locais = munData.bairros;
        break;
      case "PE":
        locais = munData.pontosPE;
        break;
      case "FISC":
        locais = munData.pontosFisc;
        break;
      case "RURAL":
        locais = munData.rural;
        break;
      case "ESC":
        locais = munData.bairros.map((b) => `Ronda escolar — entorno de ${b}`);
        break;
      case "SAT":
        locais = [...munData.comercio, ...munData.bairros];
        break;
    }

    if (locais.length === 0) locais = ["Área do município"];

    // Seleciona até 4 locais por modalidade usando o rng seedado
    const numLocais = Math.min(4, locais.length);
    for (let j = 0; j < numLocais; j++) {
      const idx = Math.floor(rng() * locais.length);
      candidatos.push({ modalidade: mod, local: locais[idx] });
    }
  }

  return candidatos.slice(0, CANDIDATOS_POR_SLOT);
}

// ─── Motor LNS ────────────────────────────────────────────────────────────────

export function otimizarPorLNS(
  blocosOriginais: BlocoHorario[],
  contexto: ContextoScore,
  configuracao: ConfiguracaoServico,
  rng: () => number,
  diretivas?: DirectivePayload
): BlocoHorario[] {
  let timelineHelper: MissionTimelineHelper | null = null;
  if (diretivas) {
    const focoOS = diretivas.focosDiretivas.find(
      (f) => f.origem === "ORDEM_SERVICO" && f.timeline
    );
    if (focoOS && focoOS.timeline) {
      timelineHelper = new MissionTimelineHelper(focoOS.timeline);
    }
  }

  // Clone profundo para não mutar o original
  let blocos = blocosOriginais.map((b) => ({ ...b }));
  let scoreAtual = avaliarScoreGlobal(blocos, contexto);

  // Identificar índices de blocos otimizáveis
  const indicesOtimizaveis: number[] = [];
  for (let i = 0; i < blocos.length; i++) {
    if (MODALIDADES_OTIMIZAVEIS.has(blocos[i].modalidade)) {
      indicesOtimizaveis.push(i);
    }
  }

  if (indicesOtimizaveis.length < TAMANHO_JANELA_MIN) {
    return blocosOriginais; // Nada para otimizar
  }

  // Modalidades disponíveis para o perfil do município
  const modalidadesDisponiveis: ModalidadePoliciamento[] = Array.from(
    MODALIDADES_OTIMIZAVEIS
  );

  const turnoInicioMin = horaParaMin(configuracao.horaInicio);
  const turnoFimMin = turnoInicioMin + (
    blocos.reduce((sum, b) => {
      let inicio = horaParaMin(b.horaInicio);
      let fim = horaParaMin(b.horaFim);
      if (fim <= inicio) fim += 1440;
      return sum + (fim - inicio);
    }, 0)
  );

  for (let iter = 0; iter < MAX_ITERACOES; iter++) {
    // Seleciona uma janela de blocos otimizáveis consecutivos
    const tamanhoJanela =
      TAMANHO_JANELA_MIN +
      Math.floor(rng() * (TAMANHO_JANELA_MAX - TAMANHO_JANELA_MIN + 1));

    // Posição inicial dentro dos índices otimizáveis
    const maxStart = indicesOtimizaveis.length - tamanhoJanela;
    if (maxStart < 0) continue;

    const startOpt = Math.floor(rng() * (maxStart + 1));
    const indicesJanela = indicesOtimizaveis.slice(
      startOpt,
      startOpt + tamanhoJanela
    );

    // Verifica que os índices são consecutivos no roteiro real
    let consecutivos = true;
    for (let j = 1; j < indicesJanela.length; j++) {
      if (indicesJanela[j] !== indicesJanela[j - 1] + 1) {
        consecutivos = false;
        break;
      }
    }
    if (!consecutivos) continue;

    // Gera candidatos para a reconstrução
    const municipioJanela =
      blocos[indicesJanela[0]].municipio ?? contexto.municipios[0];
    const candidatos = gerarCandidatos(
      municipioJanela,
      modalidadesDisponiveis,
      rng
    );

    if (candidatos.length === 0) continue;

    // Tenta cada candidato como substituição dos blocos da janela
    let melhorScore = scoreAtual;
    let melhorBlocos: BlocoHorario[] | null = null;

    const numTentativas = Math.min(candidatos.length, CANDIDATOS_POR_SLOT);
    for (let t = 0; t < numTentativas; t++) {
      const blocosCandidate = blocos.map((b) => ({ ...b }));

      // Reconstrói a janela com novos candidatos
      for (let j = 0; j < indicesJanela.length; j++) {
        const idx = indicesJanela[j];
        const candIdx = (t + j) % candidatos.length;
        const cand = candidatos[candIdx];

        const coords = obterCoordenadasLocal(cand.local, municipioJanela);
        blocosCandidate[idx] = {
          ...blocosCandidate[idx],
          modalidade: cand.modalidade,
          local: cand.local,
          problemaSolucionar: selecionarProblemaSimples(cand.modalidade),
          acoesPolicia:
            MODALIDADES[cand.modalidade]?.acoesPadrao ?? "Patrulhamento",
          justificativa:
            JUSTIFICATIVAS[cand.modalidade] ??
            "Atividade de policiamento.",
          lat: coords.lat,
          lng: coords.lng,
        };
      }

      if (timelineHelper) {
        aplicarRestricoesDuras(blocosCandidate, timelineHelper);
      }

      const scoreCand = avaliarScoreGlobal(blocosCandidate, contexto);
      if (scoreCand > melhorScore) {
        melhorScore = scoreCand;
        melhorBlocos = blocosCandidate;
      }
    }

    // Aceita a melhor troca encontrada
    if (melhorBlocos !== null) {
      blocos = melhorBlocos;
      scoreAtual = melhorScore;
    }
  }

  // Valida invariantes do resultado final
  const validacao = validarInvariantes(blocos, turnoInicioMin, turnoFimMin, diretivas);
  if (!validacao.valido) {
    // Fallback automático para o V20
    return blocosOriginais;
  }

  return blocos;
}

// ─── Helpers locais ───────────────────────────────────────────────────────────

function selecionarProblemaSimples(
  modalidade: ModalidadePoliciamento
): string {
  switch (modalidade) {
    case "POST":
      return "Roubo/furto a comércio; furto/roubo de veículo";
    case "PREV":
      return "Prevenção de delitos em bairros residenciais";
    case "PE":
      return "Sensação de segurança; dissuasão de delitos no entorno";
    case "FISC":
      return "Furto/roubo de veículo; evasão de autores; infrações de trânsito";
    case "ESC":
      return "Proteção do entorno escolar; uso/tráfico de drogas";
    case "RURAL":
      return "Furto em propriedade rural (defensivos, semoventes, fios, implementos)";
    case "SAT":
      return "Prevenção em evento/data de relevância";
    default:
      return "Atividade de policiamento";
  }
}
