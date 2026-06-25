/**
 * Motor de Geração de CPP v2
 * — Seed-based RNG reproduzível (mesma config → mesmo roteiro; turnos diferentes variam)
 * — Matriz de pesos por (perfil × período), anti-repetição, cobertura geográfica
 * — Grade de 30 min: PREL/REF/REL fixos, miolo em blocos de 30 ou 60 min
 * — SAT injetado automaticamente em mês de evento do município
 * — Parser de blocos manuais (texto livre, parser tolerante)
 */

import type {
  BlocoHorario,
  ConfiguracaoServico,
  ModalidadePoliciamento,
  MunicipioData,
  TipoAtividade,
  Municipio,
  TipoPoliciamento,
  FocoDistribuicao,
} from "./types";
import { getOPM, getTempoParaOPM, BASE_A, BASE_B } from "./opm-cpi10";
import {
  MODALIDADES,
  MUNICIPIOS_V33,
  JUSTIFICATIVAS,
  MODUS_OPERANDI_DEFAULT,
  DURACAO_TURNO_MIN,
  ATIVIDADE_MONO_MUNICIPIO,
  DURACAO_REFEICAO,
  CATEGORIA_ATIVIDADE,
  type CategoriaAtividade,
  type TipoRefeicao,
} from "./constants";
import { PPI_5CIA } from "./municipios/ppi-5cia";
import { obterCoordenadaPonto, obterCoordenadaReferenciaMunicipio } from "./municipios/coordenadas-pontos";
import type { Escola, Hotspot, PerfilCriminal } from "./municipios/types-ppi";
import { avaliarScoreGlobal, isObjetivoAtivo, isObjetivoCumprido } from "./scoreRoteiro";
import type { DirectivePayload } from "./domain/directivePayload";
import { MissionTimelineHelper } from "./domain/missionTimeline";

// ─── RNG reproduzível (mulberry32) ───────────────────────────────────────────

function mulberry32(seed: number): () => number {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashStr(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

// ─── Helpers Fisiológicos & Geométricos (Fase 2) ─────────────────────────────

export interface EstadoGeoLocal {
  lastLat: number | null;
  lastLng: number | null;
  backwardBudgetMin?: number; // Backward Induction: minutos disponíveis para retorno
  historicoRecente?: Array<{ lat: number; lng: number }>; // Poisson Disk: últimos pontos visitados
}

export function distanciaKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Raio da Terra em km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function selecionarMelhorLocalTSP(
  candidatos: string[],
  municipioNome: Municipio,
  estadoGeo: EstadoGeoLocal,
  cobertura: CoberturaMapa,
  rng: () => number
): string {
  if (candidatos.length === 0) return "Área do município";

  const minVisitas = Math.min(...candidatos.map(c => cobertura.get(c) ?? 0));
  let menosVisitados = candidatos.filter(c => (cobertura.get(c) ?? 0) === minVisitas);

  // Poisson Disk: filtra candidatos muito próximos de pontos visitados recentemente (dispersão espacial)
  const MIN_DISPERSAO_KM = 0.5;
  if (menosVisitados.length > 1 && estadoGeo.historicoRecente && estadoGeo.historicoRecente.length > 0) {
    const dispersos = menosVisitados.filter(c => {
      const coord = obterCoordenadaPonto(municipioNome, c);
      if (!coord) return true; // sem coordenada, não filtra
      return estadoGeo.historicoRecente!.every(
        pt => distanciaKm(pt.lat, pt.lng, coord.lat, coord.lng) >= MIN_DISPERSAO_KM
      );
    });
    if (dispersos.length > 0) menosVisitados = dispersos;
  }

  if (menosVisitados.length === 1) {
    const escolhido = menosVisitados[0];
    const coord = obterCoordenadaPonto(municipioNome, escolhido);
    if (coord) {
      estadoGeo.lastLat = coord.lat;
      estadoGeo.lastLng = coord.lng;
      if (!estadoGeo.historicoRecente) estadoGeo.historicoRecente = [];
      estadoGeo.historicoRecente.push({ lat: coord.lat, lng: coord.lng });
      if (estadoGeo.historicoRecente.length > 6) estadoGeo.historicoRecente.shift();
    }
    cobertura.set(escolhido, (cobertura.get(escolhido) ?? 0) + 1);
    return escolhido;
  }

  // TSP: Se temos lastLat/lastLng, calculamos a distância
  if (estadoGeo.lastLat !== null && estadoGeo.lastLng !== null) {
    const candidatosComDistancia = menosVisitados.map(c => {
      const coord = obterCoordenadaPonto(municipioNome, c);
      if (coord) {
        return { c, coord, dist: distanciaKm(estadoGeo.lastLat!, estadoGeo.lastLng!, coord.lat, coord.lng) };
      }
      return { c, coord: null, dist: Infinity };
    });

    const validos = candidatosComDistancia.filter(x => x.dist !== Infinity);
    if (validos.length > 0) {
      // Ordena por menor distância
      validos.sort((a, b) => a.dist - b.dist);
      // 70% de chance de pegar o vizinho mais próximo absoluto, 30% pega o 2º (adiciona um pouco de fuzzy)
      let index = 0;
      if (validos.length > 1 && rng() > 0.7) {
        index = 1;
      }
      // Backward Induction Real: se o budget de retorno é apertado, força o mais próximo
      if (estadoGeo.backwardBudgetMin !== undefined && estadoGeo.backwardBudgetMin < 120) {
        // Velocidade estimada: 30 km/h urbano. Distância máxima viável em min disponíveis
        const distMaxKm = (estadoGeo.backwardBudgetMin / 60) * 30;
        if (validos[index].dist > distMaxKm * 0.5) {
          index = 0; // força o mais próximo
        }
      }
      const escolhidoObj = validos[index];
      estadoGeo.lastLat = escolhidoObj.coord!.lat;
      estadoGeo.lastLng = escolhidoObj.coord!.lng;
      if (!estadoGeo.historicoRecente) estadoGeo.historicoRecente = [];
      estadoGeo.historicoRecente.push({ lat: escolhidoObj.coord!.lat, lng: escolhidoObj.coord!.lng });
      if (estadoGeo.historicoRecente.length > 6) estadoGeo.historicoRecente.shift();
      cobertura.set(escolhidoObj.c, (cobertura.get(escolhidoObj.c) ?? 0) + 1);
      return escolhidoObj.c;
    }
  }

  // Fallback para seleção aleatória (RNG)
  const escolhido = pick(menosVisitados, Math.floor(rng() * menosVisitados.length), menosVisitados[0]);
  const coord = obterCoordenadaPonto(municipioNome, escolhido);
  if (coord) {
    estadoGeo.lastLat = coord.lat;
    estadoGeo.lastLng = coord.lng;
    if (!estadoGeo.historicoRecente) estadoGeo.historicoRecente = [];
    estadoGeo.historicoRecente.push({ lat: coord.lat, lng: coord.lng });
    if (estadoGeo.historicoRecente.length > 6) estadoGeo.historicoRecente.shift();
  }
  cobertura.set(escolhido, (cobertura.get(escolhido) ?? 0) + 1);
  return escolhido;
}

// ─── Intensidade de Hotspot via Poisson (V21 — Etapa 1) ──────────────────────
// Usa frequenciaAnual (dado que existia mas era ignorado) com kernel gaussiano
// centrado na janela crítica, em vez do RISCO_VALOR fixo {Alto:5, Médio:3, Baixo:2}.

export function calcularIntensidadeHotspot(h: Hotspot, tempoAtual: number): number {
  const RISCO_BASE: Record<string, number> = { Alto: 2, Médio: 1, Baixo: 0.5 };
  const base = RISCO_BASE[h.risco] ?? 1;

  // Se não há frequenciaAnual, fallback para valores discretos antigos
  if (h.frequenciaAnual === null || h.frequenciaAnual === 0) {
    const RISCO_FALLBACK: Record<string, number> = { Alto: 5, Médio: 3, Baixo: 2 };
    return RISCO_FALLBACK[h.risco] ?? 2;
  }

  // Duração da janela crítica em horas
  const janelaHoras =
    h.horaInicioCritico !== null && h.horaFimCritico !== null
      ? h.horaFimCritico >= h.horaInicioCritico
        ? h.horaFimCritico - h.horaInicioCritico + 1
        : 24 - h.horaInicioCritico + h.horaFimCritico + 1
      : 12; // fallback amplo

  // Taxa: incidentes por hora de janela crítica
  const taxa = h.frequenciaAnual / Math.max(janelaHoras, 1);

  // Kernel gaussiano centrado na janela crítica
  const horaAtual = Math.floor((tempoAtual % 1440) / 60);
  if (h.horaInicioCritico !== null && h.horaFimCritico !== null) {
    let centroJanela: number;
    if (h.horaFimCritico >= h.horaInicioCritico) {
      centroJanela = (h.horaInicioCritico + h.horaFimCritico) / 2;
    } else {
      centroJanela = ((h.horaInicioCritico + h.horaFimCritico + 24) / 2) % 24;
    }

    // Distância circular no relógio de 24h
    const dist = Math.min(
      Math.abs(horaAtual - centroJanela),
      24 - Math.abs(horaAtual - centroJanela)
    );
    const sigma = Math.max(janelaHoras / 3, 1); // 3-sigma cobre a janela
    const kernel = Math.exp(-(dist * dist) / (2 * sigma * sigma));

    return base + taxa * kernel;
  }

  return base + taxa * 0.5; // sem janela específica, usa metade da taxa
}

export function ajustarPesosPorFadiga(
  pesos: Pesos, 
  tempoAtual: number, 
  turnoInicio: number
): Pesos {
  const novosPesos = { ...pesos };
  const hora = Math.floor((tempoAtual % 1440) / 60);

  // Vale Circadiano de Alerta Baixo (02:00 as 05:00)
  if (hora >= 2 && hora <= 5) {
    if (novosPesos.FISC !== undefined) novosPesos.FISC = Math.max(0, novosPesos.FISC - 2);
    if (novosPesos.POST !== undefined) novosPesos.POST = Math.max(0, novosPesos.POST - 1);
    if (novosPesos.PE !== undefined) novosPesos.PE += 2; // aumenta PE (estático)
    if (novosPesos.PREV !== undefined) novosPesos.PREV += 1; // aumenta preventivo
  }

  // Fadiga Dinâmica Proporcional
  let tempoTrabalhado = tempoAtual - turnoInicio;
  if (tempoTrabalhado < 0) tempoTrabalhado += 1440;
  const horasTrabalhadas = Math.floor(tempoTrabalhado / 60);

  if (horasTrabalhadas >= 8) {
    const fatorFadiga = horasTrabalhadas - 7;
    if (novosPesos.FISC !== undefined) novosPesos.FISC = Math.max(0, novosPesos.FISC - fatorFadiga);
    if (novosPesos.POST !== undefined) novosPesos.POST = Math.max(0, novosPesos.POST - Math.floor(fatorFadiga / 2));
    if (novosPesos.PE !== undefined) novosPesos.PE = (novosPesos.PE ?? 0) + fatorFadiga;
  }

  return novosPesos;
}

// ─── Helpers de tempo ────────────────────────────────────────────────────────

export function parseDataLocal(dataStr: string): Date {
  const [y, m, d] = dataStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function horaParaMin(hora: string): number {
  const [h, m] = hora.split(":").map(Number);
  return h * 60 + m;
}

function minParaHora(min: number): string {
  const h = Math.floor(min / 60) % 24;
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function snapGrid30(min: number): number {
  return Math.round(min / 30) * 30;
}

export interface RefeicaoPlanejada {
  tipo: TipoRefeicao;
  alvoMin: number;
  duracaoMin: number;
}

export function clockMinAbsoluto(clockMin: number, depoisDeMin: number): number {
  let alvo = clockMin;
  while (alvo < depoisDeMin) alvo += 1440;
  return alvo;
}

function refeicao(tipo: TipoRefeicao, alvoMin: number): RefeicaoPlanejada {
  return {
    tipo,
    alvoMin: snapGrid30(alvoMin),
    duracaoMin: DURACAO_REFEICAO[tipo],
  };
}

function proximaJanelaRefeicao(
  depoisDeMin: number,
  turnoInicioMin: number,
  tipoAnterior?: TipoRefeicao
): RefeicaoPlanejada | null {
  const candidatos: RefeicaoPlanejada[] = [
    refeicao("Almoço", clockMinAbsoluto(12 * 60, depoisDeMin)),
    refeicao("Almoço", clockMinAbsoluto(13 * 60, depoisDeMin)),
    refeicao("Café da tarde", clockMinAbsoluto(16 * 60 + 30, depoisDeMin)),
    refeicao("Janta", clockMinAbsoluto(20 * 60, depoisDeMin)),
    refeicao("Janta", clockMinAbsoluto(21 * 60, depoisDeMin)),
    refeicao("Janta", clockMinAbsoluto(22 * 60, depoisDeMin)),
    refeicao("Ceia", clockMinAbsoluto(2 * 60, depoisDeMin)),
    refeicao("Ceia", clockMinAbsoluto(3 * 60, depoisDeMin)),
  ].filter(
    r =>
      r.alvoMin >= depoisDeMin + 180 &&
      r.alvoMin >= turnoInicioMin + 30 &&
      r.tipo !== tipoAnterior
  );

  return candidatos.sort((a, b) => a.alvoMin - b.alvoMin)[0] ?? null;
}

export function planejarRefeicoes(
  horaInicioMin: number,
  turnoFimMin: number,
  duracaoTurno: number,
  timelineHelper?: MissionTimelineHelper
): RefeicaoPlanejada[] {
  const inicio = snapGrid30(horaInicioMin);
  const fimRel = turnoFimMin - 30;
  const horaCheia = Math.floor((inicio % 1440) / 60);
  const planejadas: RefeicaoPlanejada[] = [];
  const add = (tipo: TipoRefeicao, alvoMin: number) => {
    const item = refeicao(tipo, alvoMin);
    const espacoDisponivel = fimRel - item.alvoMin;
    if (
      item.alvoMin >= inicio + 30 &&
      espacoDisponivel >= 30 &&
      !planejadas.some(r => r.alvoMin === item.alvoMin && r.tipo === item.tipo)
    ) {
      if (timelineHelper) {
        let isSuspended = false;
        for (let min = item.alvoMin; min < item.alvoMin + item.duracaoMin; min += 30) {
          const fases = timelineHelper.buscarFasesAtivas(min);
          if (fases.some(f => f.tipo === "RESTRICAO" && f.restricoesDuras?.suspendeRefeicao)) {
            isSuspended = true;
            break;
          }
        }
        if (isSuspended) return;
      }
      item.duracaoMin = Math.min(item.duracaoMin, espacoDisponivel);
      planejadas.push(item);
    }
  };

  if (horaCheia >= 5 && horaCheia <= 8) {
    add("Café da manhã", inicio + 30);
    add("Almoço", clockMinAbsoluto(horaCheia === 6 ? 13 * 60 : 12 * 60, inicio));
  } else if (horaCheia === 9) {
    add("Almoço", clockMinAbsoluto(12 * 60, inicio));
  } else if (horaCheia === 10) {
    add("Almoço", clockMinAbsoluto(13 * 60, inicio));
  } else if (horaCheia >= 11 && horaCheia <= 13) {
    add("Almoço", inicio + 30);
  } else if (horaCheia === 14) {
    add("Café da tarde", clockMinAbsoluto(16 * 60 + 30, inicio));
  } else if (horaCheia === 15) {
    add("Café da tarde", clockMinAbsoluto(17 * 60 + 30, inicio));
  } else if (horaCheia === 16) {
    add("Janta", clockMinAbsoluto(20 * 60, inicio));
  } else if (horaCheia === 17 || horaCheia === 18) {
    add("Janta", clockMinAbsoluto(21 * 60, inicio));
  } else if (horaCheia === 19 || horaCheia === 20) {
    add("Janta", clockMinAbsoluto(22 * 60, inicio));
  } else if (horaCheia === 21) {
    add("Janta", clockMinAbsoluto(0, inicio));
  } else if (horaCheia === 22) {
    add("Ceia", clockMinAbsoluto(2 * 60, inicio));
  } else if (horaCheia === 23) {
    add("Ceia", clockMinAbsoluto(2 * 60 + 30, inicio));
  } else {
    add("Ceia", inicio + 180);
  }

  if (duracaoTurno >= 600 && planejadas.length < 2) {
    const ultima = planejadas.at(-1);
    const candidata = proximaJanelaRefeicao(
      ultima ? ultima.alvoMin : inicio,
      inicio,
      ultima?.tipo
    );
    if (candidata) add(candidata.tipo, candidata.alvoMin);
  }

  return planejadas.sort((a, b) => a.alvoMin - b.alvoMin).slice(0, 2);
}

function parseMMDD(mmdd: string, year: number): Date {
  const [m, d] = mmdd.split("-").map(Number);
  return new Date(year, m - 1, d);
}

function dentroDaJanela(mmdd: string, inicio: string, fim: string, dataLocal: Date): boolean {
  const ano = dataLocal.getFullYear();
  let dInicio: Date;
  let dFim: Date;
  
  if (inicio.length === 10) {
    const [y, m, d] = inicio.split("-").map(Number);
    dInicio = new Date(y, m - 1, d);
  } else {
    dInicio = parseMMDD(inicio, ano);
  }
  
  if (fim.length === 10) {
    const [y, m, d] = fim.split("-").map(Number);
    dFim = new Date(y, m - 1, d);
  } else {
    dFim = parseMMDD(fim, ano);
  }
  
  if (dFim < dInicio && inicio.length !== 10 && fim.length !== 10) {
    const dFimNoAnoSeguinte = parseMMDD(fim, ano + 1);
    const dInicioNoAnoAnterior = parseMMDD(inicio, ano - 1);
    return (dataLocal >= dInicio && dataLocal <= dFimNoAnoSeguinte) ||
           (dataLocal >= dInicioNoAnoAnterior && dataLocal <= dFim);
  }
  
  return dataLocal >= dInicio && dataLocal <= dFim;
}

function pesoSatNaData(eventos: any[] | undefined, dataStr: string): number {
  if (!eventos || eventos.length === 0) return 0;
  const d = parseDataLocal(dataStr);
  const mes = d.getMonth() + 1;
  const dia = d.getDate();
  const mmdd = `${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
  
  const diasSemanaMapa: Record<number, string> = {
    0: "dom",
    1: "seg",
    2: "ter",
    3: "qua",
    4: "qui",
    5: "sex",
    6: "sab"
  };
  const diaSemana = diasSemanaMapa[d.getDay()];
  
  let pesoMax = 0;
  for (const e of eventos) {
    let ativo = false;
    if (e.inicio && e.fim) {
      ativo = dentroDaJanela(mmdd, e.inicio, e.fim, d);
    } else if (e.mes) {
      ativo = mes === e.mes;
    }
    
    if (ativo && e.diasSemana && !e.diasSemana.includes(diaSemana)) {
      ativo = false;
    }
    
    if (ativo) {
      pesoMax = Math.max(pesoMax, e.pesoSAT ?? 5);
    }
  }
  return pesoMax;
}

function ajustarPesosPorFoco(
  pesos: Pesos,
  tipoPoliciamento: TipoPoliciamento,
  perfil: string,
  periodo: string
): Pesos {
  const novosPesos: Pesos = { ...pesos };
  switch (tipoPoliciamento) {
    case "Misto (Urbano e Rural)":
      if (perfil === "urbano_medio") {
        if (novosPesos.RURAL === undefined) novosPesos.RURAL = 2;
      } else if (perfil === "rural_pequeno") {
        if (novosPesos.POST === undefined) novosPesos.POST = 2;
        if (novosPesos.PREV === undefined) novosPesos.PREV = 2;
      }
      break;
    case "Urbano":
    case "Foco Urbano":
      if (perfil === "rural_pequeno") {
        if (novosPesos.POST === undefined) novosPesos.POST = 2;
        if (novosPesos.PREV === undefined) novosPesos.PREV = 2;
        if (novosPesos.RURAL !== undefined) novosPesos.RURAL = Math.max(0, Math.round(novosPesos.RURAL * 0.3));
      } else {
        if (novosPesos.RURAL !== undefined) delete novosPesos.RURAL;
      }
      if (tipoPoliciamento === "Foco Urbano") {
        if (novosPesos.POST !== undefined) novosPesos.POST = Math.round(novosPesos.POST * 1.5);
        if (novosPesos.PREV !== undefined) novosPesos.PREV = Math.round(novosPesos.PREV * 1.5);
      }
      break;
    case "Rural":
    case "Foco Rural":
      if (perfil === "urbano_medio") {
        if (novosPesos.RURAL === undefined) novosPesos.RURAL = 4;
        if (novosPesos.POST !== undefined) novosPesos.POST = Math.max(0, Math.round(novosPesos.POST * 0.3));
        if (novosPesos.PREV !== undefined) novosPesos.PREV = Math.max(0, Math.round(novosPesos.PREV * 0.3));
        if (novosPesos.ESC !== undefined) novosPesos.ESC = Math.max(0, Math.round(novosPesos.ESC * 0.3));
      } else {
        if (novosPesos.RURAL !== undefined) novosPesos.RURAL = Math.round(novosPesos.RURAL * 2.0 + 1);
      }
      break;
    case "Foco Escolar":
      if (periodo === "manha" || periodo === "tarde") {
        novosPesos.ESC = (novosPesos.ESC ?? 0) + 5;
      } else {
        if (novosPesos.ESC !== undefined) delete novosPesos.ESC;
      }
      break;
    case "Foco Fiscalização":
      novosPesos.FISC = (novosPesos.FISC ?? 0) + 5;
      break;
    case "Foco Evento":
      novosPesos.SAT = (novosPesos.SAT ?? 0) + 6;
      novosPesos.PE = (novosPesos.PE ?? 0) + 4;
      if (novosPesos.FISC !== undefined) novosPesos.FISC = Math.round(novosPesos.FISC * 1.5 + 1);
      if (novosPesos.ESC !== undefined) delete novosPesos.ESC;
      break;
  }
  return novosPesos;
}

function determinarFocoAtivo(
  focos: FocoDistribuicao[] | undefined,
  tipoPadrao: TipoPoliciamento,
  progresso: number // 0.0 a 1.0
): TipoPoliciamento {
  if (!focos || focos.length === 0) return tipoPadrao;
  if (focos.length === 1) return focos[0].tipo;

  // Normaliza percentuais copiando para evitar mutar o estado original
  const focosNorm = focos.map(f => ({ ...f }));
  let totalFixo = 0;
  let numSemPercentual = 0;
  
  for (const f of focosNorm) {
    if (f.percentual !== undefined && f.percentual > 0) {
      totalFixo += f.percentual;
    } else {
      numSemPercentual++;
    }
  }

  // Se passar de 100%, reescalona
  if (totalFixo > 100) {
    for (const f of focosNorm) {
      if (f.percentual !== undefined && f.percentual > 0) {
        f.percentual = (f.percentual / totalFixo) * 100;
      }
    }
    totalFixo = 100;
  }

  const restante = 100 - totalFixo;
  const percPadrao = numSemPercentual > 0 ? restante / numSemPercentual : 0;

  const ordemPos = { "Começo": 1, "Automático": 2, "Meio": 2, "Fim": 3 };
  focosNorm.sort((a, b) => ordemPos[a.posicao] - ordemPos[b.posicao]);

  let acumulado = 0;
  for (const f of focosNorm) {
    const p = (f.percentual !== undefined && f.percentual > 0) ? f.percentual : percPadrao;
    const fracao = p / 100;
    acumulado += fracao;
    if (progresso <= acumulado || Math.abs(progresso - acumulado) < 0.001) {
      return f.tipo;
    }
  }
  return focosNorm[focosNorm.length - 1].tipo;
}

function obterLocalEventos(configuracao: ConfiguracaoServico, focoAtivo: TipoPoliciamento, modalidade: string, localPadrao: string): string {
  if (focoAtivo !== "Foco Evento") return localPadrao;
  const evNome = configuracao.nomeEvento || "Evento";
  const evLocal = configuracao.localEvento || "Local do Evento";
  if (modalidade === "PE") {
    return `Ponto de Estacionamento - Imediações do Evento: ${evNome} (${evLocal})`;
  } else if (modalidade === "SAT") {
    return `Saturação - Entorno do Evento: ${evNome} (${evLocal})`;
  } else if (modalidade === "POST" || modalidade === "PREV") {
    return `Patrulhamento nas imediações do Evento: ${evNome}`;
  } else if (modalidade === "FISC") {
    return `Fiscalização no acesso ao Evento: ${evNome} (${evLocal})`;
  }
  return localPadrao;
}

function ajustarPesosPorCategoria(pesos: Pesos, categoria: CategoriaAtividade): Pesos {
  const novosPesos: Pesos = { ...pesos };
  switch (categoria) {
    case "PATRULHA":
      break;
    case "CGP":
      if (novosPesos.FISC !== undefined) novosPesos.FISC = Math.round(novosPesos.FISC * 1.5 + 1);
      if (novosPesos.PE !== undefined) novosPesos.PE = Math.round(novosPesos.PE * 1.5 + 1);
      if (novosPesos.ESC !== undefined) novosPesos.ESC = Math.max(0, Math.round(novosPesos.ESC * 0.3));
      break;
    case "COMANDO":
      if (novosPesos.FISC !== undefined) novosPesos.FISC = Math.round(novosPesos.FISC * 2.0 + 1);
      if (novosPesos.PE !== undefined) novosPesos.PE = Math.round(novosPesos.PE * 0.7);
      if (novosPesos.ESC !== undefined) novosPesos.ESC = Math.max(0, Math.round(novosPesos.ESC * 0.3));
      if (novosPesos.POST !== undefined) novosPesos.POST = Math.round(novosPesos.POST * 0.5);
      break;
    case "SUPERVISAO":
      if (novosPesos.FISC !== undefined) novosPesos.FISC = Math.round(novosPesos.FISC * 2.5 + 2);
      if (novosPesos.PE !== undefined) novosPesos.PE = Math.round(novosPesos.PE * 1.8 + 1);
      if (novosPesos.POST !== undefined) novosPesos.POST = Math.max(0, Math.round(novosPesos.POST * 0.2));
      if (novosPesos.ESC !== undefined) novosPesos.ESC = Math.max(0, Math.round(novosPesos.ESC * 0.1));
      if (novosPesos.PREV !== undefined) novosPesos.PREV = Math.round(novosPesos.PREV * 0.6);
      break;
  }
  return novosPesos;
}

function ajustarPesosPorPerfilCriminal(
  pesos: Pesos,
  perfil: PerfilCriminal | undefined
): Pesos {
  if (!perfil || !perfil.indicadorDominante) return pesos;
  if (
    perfil.confianca !== "oficial" ||
    !perfil.fonteUrl ||
    (!perfil.fonteUrl.startsWith("http") && !perfil.fonteUrl.startsWith("file:///"))
  ) {
    return pesos;
  }

  const novosPesos: Pesos = { ...pesos };
  switch (perfil.indicadorDominante) {
    case "furto_veiculo":
    case "roubo_veiculo":
      novosPesos.FISC = (novosPesos.FISC ?? 0) + 2;
      novosPesos.PE = (novosPesos.PE ?? 0) + 2;
      break;
    case "roubo":
      novosPesos.POST = (novosPesos.POST ?? 0) + 2;
      novosPesos.PE = (novosPesos.PE ?? 0) + 2;
      break;
    case "furto":
      novosPesos.PREV = (novosPesos.PREV ?? 0) + 2;
      novosPesos.POST = (novosPesos.POST ?? 0) + 2;
      break;
    case "letalidade":
      novosPesos.PREV = (novosPesos.PREV ?? 0) + 1;
      novosPesos.POST = (novosPesos.POST ?? 0) + 1;
      break;
    case "rural":
      novosPesos.RURAL = (novosPesos.RURAL ?? 0) + 3;
      break;
  }
  return novosPesos;
}

export function calcularHoraTermino(horaInicio: string, tipoAtividade: TipoAtividade): string {
  const duracao = DURACAO_TURNO_MIN[tipoAtividade] ?? 480;
  return minParaHora(horaParaMin(horaInicio) + duracao);
}

function calcularPeriodo(
  minAbsoluto: number
): "manha" | "tarde" | "noite" | "madrugada" {
  const h = Math.floor((minAbsoluto % 1440) / 60);
  if (h >= 6 && h < 12) return "manha";
  if (h >= 12 && h < 18) return "tarde";
  if (h >= 18 && h < 24) return "noite";
  return "madrugada";
}

function ehDiaUtil(dataStr: string): boolean {
  const d = parseDataLocal(dataStr).getDay();
  return d !== 0 && d !== 6;
}

function uuidv4(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

// Acesso seguro a arrays — nunca retorna undefined
function pick<T>(arr: T[], i: number, fallback: T): T {
  return arr.length > 0 ? arr[i % arr.length] : fallback;
}

const hhmmParaMin = (s: string): number => {
  const [h, m] = s.split(":").map(Number);
  return h * 60 + m;
};

function obterEscolasEmJanela(escolas: Escola[], minutoDia: number, W = 40): Escola[] {
  const ativas: Escola[] = [];
  for (const e of escolas) {
    let escolaAtiva = false;
    for (const h of [e.turnoEntrada, e.turnoSaida, e.turnoEntradaTarde, e.turnoSaidaTarde]) {
      if (!h) continue;
      const alvo = hhmmParaMin(h);
      const dist = Math.min(Math.abs(minutoDia - alvo), 1440 - Math.abs(minutoDia - alvo));
      if (dist <= W) {
        escolaAtiva = true;
        break;
      }
    }
    if (escolaAtiva) {
      ativas.push(e);
    }
  }
  return ativas;
}

function obterBoostEscola(escolas: Escola[], minutoDia: number, W = 40): number {
  const ativas = obterEscolasEmJanela(escolas, minutoDia, W);
  if (ativas.length === 0) return 0;
  const temCrechePre = ativas.some(e =>
    e.etapas?.some(stage => stage === "Creche" || stage === "Pre-escola")
  );
  return temCrechePre ? 7 : 6;
}

function normalizeDia(d: string): string {
  return d.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace("-feira", "");
}

function hotspotsAtivos(hotspots: Hotspot[], periodo: string, hora: number, diaSemana: string): Hotspot[] {
  return hotspots.filter(h => {
    if (h.confianca === "a_validar_comando") return false;
    
    const periodoOk = h.periodosCriticos.includes(periodo as any) ||
      (h.horaInicioCritico !== null && h.horaFimCritico !== null &&
       (h.horaInicioCritico <= h.horaFimCritico
         ? (hora >= h.horaInicioCritico && hora <= h.horaFimCritico)
         : (hora >= h.horaInicioCritico || hora <= h.horaFimCritico)
       ));
         
    if (!periodoOk) return false;
    
    if (h.diasCriticos.length > 0) {
      const diasNorm = h.diasCriticos.map(normalizeDia);
      const diaSemanaNorm = normalizeDia(diaSemana);
      if (!diasNorm.includes(diaSemanaNorm)) return false;
    }
    
    return true;
  });
}

function determinarLocalFinal({
  modalidade,
  tempoAtual,
  diaUtil,
  escolasMun,
  hotspotsAtivosMun,
  currentMunData,
  cobertura,
  rng,
  configuracao,
  focoAtivo,
  ppiMun,
  municipioNome,
  estadoGeo,
  timelineHelper
}: {
  modalidade: ModalidadePoliciamento;
  tempoAtual: number;
  diaUtil: boolean;
  escolasMun: Escola[];
  hotspotsAtivosMun: Hotspot[];
  currentMunData: MunicipioData;
  cobertura: CoberturaMapa;
  rng: () => number;
  configuracao: ConfiguracaoServico;
  focoAtivo: TipoPoliciamento;
  ppiMun: any;
  municipioNome: Municipio;
  estadoGeo: EstadoGeoLocal;
  timelineHelper?: MissionTimelineHelper;
}): string {
  // ── Preferência por Alvos da Diretriz ───────────────────────────────────────
  if (timelineHelper) {
    const fases = timelineHelper.buscarFasesAtivas(tempoAtual);
    for (const fase of fases) {
      if (fase.tipo === "PREFERENCIA" && fase.modificadores) {
        const mod = fase.modificadores.find(m => m.modalidade === modalidade);
        if (mod && mod.alvos && mod.alvos.length > 0) {
          const alvosFiltrados = mod.alvos.filter(a => {
            if (a.municipio && a.municipio !== municipioNome) return false;
            return pertenceAoMunicipio(a.textoOriginal, municipioNome);
          });
          if (alvosFiltrados.length > 0) {
            const candidatosAlvos = alvosFiltrados.map(a => a.textoOriginal);
            return selecionarMelhorLocalTSP(candidatosAlvos, municipioNome, estadoGeo, cobertura, rng);
          }
        }
      }
    }
  }

  if (modalidade === "ESC") {
    const minutoDia = tempoAtual % 1440;
    const escolasAtivas = diaUtil ? obterEscolasEmJanela(escolasMun, minutoDia) : [];
    if (escolasAtivas.length > 0) {
      const candidatos = escolasAtivas.map(e => `Ronda escolar — ${e.nome} (${e.bairro})`);
      return selecionarMelhorLocalTSP(candidatos, municipioNome, estadoGeo, cobertura, rng);
    }
  }

  if (modalidade === "FISC" && ppiMun?.transito) {
    const horaAtual = Math.floor((tempoAtual % 1440) / 60);
    const transito = ppiMun.transito;
    if (transito.horariosCriticos?.includes(horaAtual) && transito.tiposViaCriticos?.length > 0) {
      const candidatos = transito.tiposViaCriticos;
      return selecionarMelhorLocalTSP(candidatos, municipioNome, estadoGeo, cobertura, rng);
    }
  }

  if (hotspotsAtivosMun.length > 0) {
    const hsRecomendados = hotspotsAtivosMun.filter(h => h.modalidadesRecomendadas.includes(modalidade as any));
    if (hsRecomendados.length > 0) {
      const candidatos = hsRecomendados.map(h => `${h.local} (${h.bairro})`);
      return selecionarMelhorLocalTSP(candidatos, municipioNome, estadoGeo, cobertura, rng);
    }
  }

  if (modalidade === "PREV" && ppiMun?.entidadesSociais) {
    const crasCREAS = ppiMun.entidadesSociais.filter(
      (e: any) =>
        (e.tipo === "CRAS" || e.tipo === "CREAS") &&
        e.fonteUrl &&
        e.fonteUrl.startsWith("http")
    );
    if (crasCREAS.length > 0) {
      const bairrosVulneraveis = new Set(
        crasCREAS.map((e: any) => e.bairro).filter(Boolean)
      );
      if (bairrosVulneraveis.size > 0) {
        const candidatos = currentMunData.bairros;
        if (candidatos.length > 0) {
          const minVisitas = Math.min(...candidatos.map(c => cobertura.get(c) ?? 0));
          const menosVisitados = candidatos.filter(
            c => (cobertura.get(c) ?? 0) === minVisitas
          );
          const menosVisitadosVulneraveis = menosVisitados.filter(c =>
            bairrosVulneraveis.has(c)
          );
          let escolhido: string;
          if (menosVisitadosVulneraveis.length > 0 && rng() < 0.6) {
            escolhido = selecionarMelhorLocalTSP(menosVisitadosVulneraveis, municipioNome, estadoGeo, cobertura, rng);
          } else {
            escolhido = selecionarMelhorLocalTSP(menosVisitados, municipioNome, estadoGeo, cobertura, rng);
          }
          return obterLocalEventos(configuracao, focoAtivo, modalidade, escolhido);
        }
      }
    }
  }

  const localPadrao = selecionarLocal(currentMunData, modalidade, cobertura, rng, municipioNome, estadoGeo);
  return obterLocalEventos(configuracao, focoAtivo, modalidade, localPadrao);
}

// ─── Agendamento Crítico de Hotspots ──────────────────────────────────────────

export function tentarReservarHotspot(
  hotspots: Hotspot[],
  tempoAtual: number,
  historico: ModalidadePoliciamento[],
  cobertura: CoberturaMapa
): { modalidade: ModalidadePoliciamento; local: string } | null {
  const horaAtual = Math.floor((tempoAtual % 1440) / 60);

  const candidatos = hotspots.filter(h => {
    if (h.confianca === "a_validar_comando") return false;

    const naJanela =
      h.horaInicioCritico !== null &&
      h.horaFimCritico !== null &&
      (h.horaInicioCritico <= h.horaFimCritico
        ? horaAtual >= h.horaInicioCritico && horaAtual <= h.horaFimCritico
        : horaAtual >= h.horaInicioCritico || horaAtual <= h.horaFimCritico);

    if (!naJanela) return false;

    const chave = `${h.local} (${h.bairro})`;
    const visitasHoje = cobertura.get(chave) ?? 0;
    return visitasHoje < 3;
  });

  if (candidatos.length === 0) return null;

  // Interval Scheduling V21: prioriza o que termina mais cedo, depois por intensidade Poisson
  candidatos.sort((a, b) => {
    const endA = a.horaFimCritico ?? 24;
    const endB = b.horaFimCritico ?? 24;
    if (endA !== endB) return endA - endB;
    return calcularIntensidadeHotspot(b, tempoAtual) - calcularIntensidadeHotspot(a, tempoAtual);
  });

  const melhor = candidatos[0];
  const modalidade = melhor.modalidadesRecomendadas[0] as ModalidadePoliciamento;
  const local = `${melhor.local} (${melhor.bairro})`;
  
  return { modalidade, local };
}

// ─── Cadeia de Markov (Anti-Padrão Tático) ───────────────────────────────────

type TrigramaChave = string;

export function construirPenalizacaoTrigrama(
  historico: ModalidadePoliciamento[]
): Map<ModalidadePoliciamento, number> {
  const penalidades = new Map<ModalidadePoliciamento, number>();
  const tactico = historico.filter(
    m => !["PREL", "DESL", "REF", "REL", "RONDA"].includes(m)
  );
  if (tactico.length < 5) return penalidades;

  const janela = tactico.slice(-10);
  const contagem = new Map<TrigramaChave, number>();
  for (let i = 0; i < janela.length - 2; i++) {
    const chave: TrigramaChave = `${janela[i]}|${janela[i + 1]}|${janela[i + 2]}`;
    contagem.set(chave, (contagem.get(chave) ?? 0) + 1);
  }

  const ultimoTrigrama: TrigramaChave = `${tactico.at(-3)}|${tactico.at(-2)}|${tactico.at(-1)}`;
  const freqUltimo = contagem.get(ultimoTrigrama) ?? 0;

  if (freqUltimo >= 2) {
    const alvoSupressao = tactico.at(-3) as ModalidadePoliciamento;
    penalidades.set(alvoSupressao, freqUltimo * 3);
  }

  return penalidades;
}

export function aplicarPenalizacaoMarkov(
  pesos: Pesos,
  penalidades: Map<ModalidadePoliciamento, number>
): Pesos {
  const novosPesos = { ...pesos };
  for (const [mod, penalidade] of Array.from(penalidades.entries())) {
    const chave = mod as keyof Pesos;
    if (novosPesos[chave] !== undefined) {
      novosPesos[chave] = Math.max(0, novosPesos[chave]! - penalidade);
    }
  }
  return novosPesos;
}

// ─── Matriz de pesos (perfil × período) ──────────────────────────────────────

type Periodo = "manha" | "tarde" | "noite" | "madrugada";
type Pesos = Partial<Record<ModalidadePoliciamento, number>>;

const MATRIZ_PESOS: Record<string, Record<Periodo, Pesos>> = {
  urbano_medio: {
    manha: { POST: 3, PREV: 2, PE: 3, ESC: 3, FISC: 1 },
    tarde: { POST: 2, PREV: 2, PE: 2, ESC: 4, FISC: 1 },
    noite: { FISC: 4, PE: 3, PREV: 2, POST: 1 },
    madrugada: { FISC: 4, PREV: 3, PE: 2 },
  },
  rural_pequeno: {
    manha: { RURAL: 5, PE: 2, FISC: 1 },
    tarde: { RURAL: 4, PE: 2, FISC: 1, PREV: 1 },
    noite: { RURAL: 3, FISC: 4, PE: 1 },
    madrugada: { RURAL: 5, FISC: 2 },
  },
};

function selecionarModalidade(
  pesos: Pesos,
  rng: () => number,
  fallback: ModalidadePoliciamento = "PREV"
): ModalidadePoliciamento {
  const entries = (
    Object.entries(pesos) as [ModalidadePoliciamento, number][]
  ).filter(([, w]) => w > 0);
  if (entries.length === 0) return fallback;
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let r = rng() * total;
  for (const [mod, w] of entries) {
    r -= w;
    if (r <= 0) return mod;
  }
  return entries[entries.length - 1][0];
}

// ─── Cobertura geográfica — prefere locais menos visitados ───────────────────

type CoberturaMapa = Map<string, number>;

function selecionarLocal(
  municipio: MunicipioData,
  modalidade: ModalidadePoliciamento,
  cobertura: CoberturaMapa,
  rng: () => number,
  municipioNome: Municipio,
  estadoGeo: EstadoGeoLocal
): string {
  let candidatos: string[] = [];

  switch (modalidade) {
    case "POST":
      candidatos = municipio.comercio;
      break;
    case "PREV":
      candidatos = municipio.bairros;
      break;
    case "PE":
      candidatos = municipio.pontosPE;
      break;
    case "FISC":
      candidatos = municipio.pontosFisc;
      break;
    case "RURAL":
      candidatos = municipio.rural;
      break;
    case "ESC":
      candidatos = municipio.bairros.map(b => `Entorno de escola — ${b}`);
      break;
    case "SAT":
      candidatos = [...municipio.comercio, ...municipio.bairros];
      break;
    default:
      return "Base do Pelotão PM";
  }

  if (candidatos.length === 0) return "Área do município";

  return selecionarMelhorLocalTSP(candidatos, municipioNome, estadoGeo, cobertura, rng);
}

// ─── Problema e ações por modalidade ─────────────────────────────────────────

function selecionarProblema(
  modalidade: ModalidadePoliciamento,
  periodo: Periodo
): string {
  switch (modalidade) {
    case "POST":
      return "Roubo/furto a comércio; furto/roubo de veículo";
    case "PREV":
      return periodo === "noite" || periodo === "madrugada"
        ? "Furto/roubo a residência"
        : "Prevenção de delitos em bairros residenciais";
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

function selecionarAcoes(modalidade: ModalidadePoliciamento): string {
  return MODALIDADES[modalidade]?.acoesPadrao ?? "Patrulhamento";
}

// ─── Fábrica de bloco ─────────────────────────────────────────────────────────

export function levenshteinDistance(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const matrix = Array.from({ length: b.length + 1 }, (_, i) => [i]);
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

export function obterCoordenadasLocal(
  local: string,
  municipio: Municipio
): { lat: number | null; lng: number | null } {
  const normLocal = local.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  if (
    normLocal.includes("base do pelotao") ||
    normLocal.includes("inicio do servico") ||
    normLocal.includes("preliminares") ||
    normLocal.includes("elaboracao do rso") ||
    normLocal.includes("refeicao")
  ) {
    const referencia = obterCoordenadaReferenciaMunicipio(municipio);
    return referencia
      ? { lat: referencia.lat, lng: referencia.lng }
      : { lat: null, lng: null };
  }

  if (normLocal.includes("deslocamento")) {
    const referencia = obterCoordenadaReferenciaMunicipio(municipio);
    return referencia
      ? { lat: referencia.lat, lng: referencia.lng }
      : { lat: null, lng: null };
  }

  const ppiMun = (PPI_5CIA as any)[municipio];
  if (!ppiMun) {
    return { lat: null, lng: null };
  }

  const keysToSearch: Array<{ key: string; nameField: string }> = [
    { key: "escolas", nameField: "nome" },
    { key: "hotspots", nameField: "local" },
    { key: "saude", nameField: "nome" },
    { key: "instituicoesFinanceiras", nameField: "nome" },
    { key: "pontosAglomeracao", nameField: "nome" },
    { key: "pontosEconomicos", nameField: "nome" },
    { key: "entidadesSociais", nameField: "nome" },
    { key: "unidadesPrisionais", nameField: "nome" }
  ];

  for (const item of keysToSearch) {
    const list = ppiMun[item.key];
    if (Array.isArray(list)) {
      for (const entity of list) {
        if (!entity) continue;
        const nameVal = entity[item.nameField];
        if (typeof nameVal === "string") {
          const normName = nameVal.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
          const isFuzzyMatch = normName.length > 5 && levenshteinDistance(normLocal, normName) <= 3;
          if (normLocal.includes(normName) || normName.includes(normLocal) || isFuzzyMatch) {
            if (typeof entity.lat === "number" && typeof entity.lng === "number") {
              return { lat: entity.lat, lng: entity.lng };
            }
          }
        }
      }
    }
  }

  const coordenadaPonto = obterCoordenadaPonto(municipio, local);
  if (coordenadaPonto) {
    return { lat: coordenadaPonto.lat, lng: coordenadaPonto.lng };
  }

  return { lat: null, lng: null };
}

const pertenceAoMunicipioCache = new Map<string, boolean>();

export function pertenceAoMunicipio(localId: string, municipioNome: Municipio): boolean {
  const cacheKey = `${localId}|${municipioNome}`;
  if (pertenceAoMunicipioCache.has(cacheKey)) {
    return pertenceAoMunicipioCache.get(cacheKey)!;
  }

  const normOriginal = localId.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  
  // 1. Check substring of other municipalities
  const outrosMunicipios = (["Valparaíso", "Guararapes", "Rubiácea", "Bento de Abreu"] as Municipio[])
    .filter(m => m !== municipioNome);
  
  for (const outro of outrosMunicipios) {
    const normOutro = outro.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (normOriginal.includes(normOutro) || normOriginal.includes(outro.toLowerCase())) {
      pertenceAoMunicipioCache.set(cacheKey, false);
      return false;
    }
  }

  // 2. Check if coordinates exist for this point in another municipality but NOT in this one
  const coordsThis = obterCoordenadasLocal(localId, municipioNome);
  const hasCoordsThis = coordsThis.lat !== null && coordsThis.lng !== null;
  
  if (!hasCoordsThis) {
    for (const outro of outrosMunicipios) {
      const coordsOutro = obterCoordenadasLocal(localId, outro);
      if (coordsOutro.lat !== null && coordsOutro.lng !== null) {
        pertenceAoMunicipioCache.set(cacheKey, false);
        return false;
      }
    }
  }

  pertenceAoMunicipioCache.set(cacheKey, true);
  return true;
}

function criarBloco(
  ordem: number,
  inicioMin: number,
  durMin: number,
  modalidade: ModalidadePoliciamento,
  local: string,
  problema: string,
  justificativa: string,
  municipio?: Municipio
): BlocoHorario {
  const coords = municipio ? obterCoordenadasLocal(local, municipio) : { lat: null, lng: null };
  return {
    id: uuidv4(),
    horaInicio: minParaHora(inicioMin),
    horaFim: minParaHora(inicioMin + durMin),
    modalidade,
    local,
    problemaSolucionar: problema,
    modusOperandi: MODUS_OPERANDI_DEFAULT,
    acoesPolicia: selecionarAcoes(modalidade),
    justificativa,
    observacao: "",
    concluido: false,
    ordem,
    municipio,
    lat: coords.lat,
    lng: coords.lng,
  };
}

// ─── Parser de blocos manuais ─────────────────────────────────────────────────

interface AnalisadoManual {
  modalidade: ModalidadePoliciamento;
  localManual: string;
}

// Analisa a descrição do bloco manual: detecta sigla (em qualquer posição) e extrai local.
// Sigla explícita vence keywords; PE não casa dentro de palavras.
export function analisarDescricaoManual(desc: string): AnalisadoManual {
  const siglas: [string, ModalidadePoliciamento][] = [
    ["RURAL", "RURAL"], ["PREL", "PREL"], ["DESL", "DESL"],
    ["POST", "POST"], ["PREV", "PREV"], ["FISC", "FISC"],
    ["REF", "REF"], ["REL", "REL"], ["SAT", "SAT"], ["ESC", "ESC"],
    ["PE", "PE"],
    // RONDA ao final: a palavra "ronda" é comum em português e não deve vencer siglas explícitas
    ["RONDA", "RONDA"],
  ];

  // Limpa separadores iniciais (ex: "- PE - local" → "PE - local")
  const t = desc.trim().replace(/^[-–—:;,\s]+/, "");

  // 1. Procura sigla explícita em qualquer posição, com fronteira segura
  //    Padrão: (início-de-string OU separador) + SIGLA + (fim-de-string OU separador)
  //    Garante que PE não case dentro de "perímetro", "pedestre", "operação" etc.
  for (const [sigla, mod] of siglas) {
    const regex = new RegExp(`(^|[\\s:;,\\-–—])(${sigla})(?=$|[\\s:;,\\-–—])`, "i");
    const m = t.match(regex);
    if (m !== null && m.index !== undefined) {
      // Local = texto após a sigla (e separadores opcionais que a seguem)
      const localManual = t.slice(m.index + m[0].length).replace(/^[\s:;,\-–—]+/, "").trim();
      return { modalidade: mod, localManual };
    }
  }

  // 2. Sem sigla explícita — inferência por palavras-chave expandida; localManual = desc completo
  const norm = t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  let modalidade: ModalidadePoliciamento;
  if (/prel|assuncao|assun|inicio|apresentacao/.test(norm)) modalidade = "PREL";
  else if (/desl|desloc|ida|retorno|indo para/.test(norm)) modalidade = "DESL";
  else if (/ref|janta|almoco|cafe|refeic|aliment|comer/.test(norm)) modalidade = "REF";
  else if (/\brel\b|rso|encer|relator|fechamento|termino/.test(norm)) modalidade = "REL";
  else if (/rural|fazenda|sitio|chacara|estrada de terra/.test(norm)) modalidade = "RURAL";
  else if (/\bsat\b|saturac|arrastao|intensific/.test(norm)) modalidade = "SAT";
  else if (/escol|creche|emeb|etec|aluno/.test(norm) && !/escolt/.test(norm)) modalidade = "ESC";
  else if (/fisc|blitz|bloqueio|comando|transito|infracao|averiguacao/.test(norm)) modalidade = "FISC";
  else if (/\bpe\b|\bpb\b|estacion|ponto base|ponto de parada|visibilidade/.test(norm)) modalidade = "PE";
  else if (/prev|bairr|visita|solidaria|apoio|maria da penha|preventivo/.test(norm)) modalidade = "PREV";
  else modalidade = "POST";

  return { modalidade, localManual: t };
}

export function extrairDuracaoManual(texto: string): { duracaoMin: number | null, textoLimpo: string } {
  const match = texto.match(/\(\s*(?:(\d+)\s*h(?:ora[s]?)?)?\s*(?:e\s*)?(?:(\d+)\s*m(?:in(?:uto[s]?)?)?)?\s*\)/i);
  if (match && (match[1] || match[2])) {
    const h = parseInt(match[1] || "0", 10);
    const m = parseInt(match[2] || "0", 10);
    return { duracaoMin: h * 60 + m, textoLimpo: texto.replace(match[0], "").trim() };
  }
  return { duracaoMin: null, textoLimpo: texto };
}

export interface BlocoManualParsed {
  inicioMin: number | null;
  fimMin: number | null;
  duracaoMin: number | null;
  modalidade: ModalidadePoliciamento;
  desc: string;
  localManual: string;
}

// turnoInicio: minuto absoluto do início do turno (ex: 1410 para 23:30).
// Horários de relógio anteriores ao turno são interpretados como dia seguinte (ex: 00h00 → 1440).
export function parseBlocosManuais(texto: string, turnoInicio: number): BlocoManualParsed[] {
  const linhas = texto
    .split("\n")
    .map(l => l.trim())
    .filter(Boolean);
  const result: BlocoManualParsed[] = [];

  for (const linha of linhas) {
    const comFim = linha.match(
      /^(\d{1,2})[h:](\d{0,2})\s*(?:a\b|as\b|at[eé]\b|às\b|-)\s*(\d{1,2})[h:](\d{0,2})\s+(.*)/i
    );
    if (comFim) {
      const inicioMinRaw = parseInt(comFim[1]) * 60 + parseInt(comFim[2] || "0");
      const fimMinRaw = parseInt(comFim[3]) * 60 + parseInt(comFim[4] || "0");
      const rawDesc = comFim[5].trim();
      const { duracaoMin, textoLimpo } = extrairDuracaoManual(rawDesc);
      const { modalidade, localManual } = analisarDescricaoManual(textoLimpo);
      const inicioMin = clockMinAbsoluto(snapGrid30(inicioMinRaw), turnoInicio);
      const fimMin = clockMinAbsoluto(snapGrid30(fimMinRaw), inicioMin);
      result.push({ inicioMin, fimMin, duracaoMin: duracaoMin || Math.max(30, fimMin - inicioMin), modalidade, desc: textoLimpo, localManual });
      continue;
    }

    const semFim = linha.match(/^(\d{1,2})[h:](\d{0,2})\s+(.*)/i);
    if (semFim) {
      const inicioMinRaw = parseInt(semFim[1]) * 60 + parseInt(semFim[2] || "0");
      const rawDesc = semFim[3].trim();
      const { duracaoMin, textoLimpo } = extrairDuracaoManual(rawDesc);
      const { modalidade, localManual } = analisarDescricaoManual(textoLimpo);
      const inicioMin = clockMinAbsoluto(snapGrid30(inicioMinRaw), turnoInicio);
      result.push({ inicioMin, fimMin: null, duracaoMin, modalidade, desc: textoLimpo, localManual });
      continue;
    }

    // Wishlist: sem horário
    const { duracaoMin, textoLimpo } = extrairDuracaoManual(linha);
    const { modalidade, localManual } = analisarDescricaoManual(textoLimpo);
    result.push({ inicioMin: null, fimMin: null, duracaoMin, modalidade, desc: textoLimpo, localManual });
  }

  return result.sort((a, b) => {
    if (a.inicioMin === null && b.inicioMin === null) return 0;
    if (a.inicioMin === null) return 1;
    if (b.inicioMin === null) return -1;
    return a.inicioMin - b.inicioMin;
  });
}

// ─── Preview puro dos blocos manuais (sem chamar gerarCPP) ───────────────────

export type PreviewBlocoManual = {
  linha: number;
  textoOriginal: string;
  horaInicio?: string;      // exibição em relógio "HH:MM"
  horaFim?: string;         // exibição em relógio "HH:MM"
  inicioMin?: number;       // minuto absoluto (para testes e debug)
  fimMin?: number;          // minuto absoluto (para testes e debug)
  modalidade?: string;
  local?: string;
  status: "ok" | "aviso" | "erro";
  mensagem?: string;
};

// horaTerminoTurno é opcional; se fornecido, detecta blocos fora da janela do turno.
export function analisarBlocosManuaisPreview(
  texto: string,
  horaInicioTurno: string,
  horaTerminoTurno?: string
): PreviewBlocoManual[] {
  const linhasRaw = texto.split("\n");
  const turnoInicioMin = horaParaMin(horaInicioTurno);
  const prelFimMin = turnoInicioMin + 30;
  const prelFimHora = minParaHora(prelFimMin);
  const turnoInicioHora = minParaHora(turnoInicioMin);
  // turnoFimMin: normaliza horário de término para minuto absoluto (cruza meia-noite se preciso)
  const turnoFimMin = horaTerminoTurno
    ? clockMinAbsoluto(horaParaMin(horaTerminoTurno), turnoInicioMin)
    : undefined;
  const result: PreviewBlocoManual[] = [];

  linhasRaw.forEach((linhaRaw, idx) => {
    const linha = linhaRaw.trim();
    if (!linha) return;

    // Linha com horário de início e fim
    const comFim = linha.match(
      /(\d{1,2})[h:](\d{0,2})\s*(?:a\b|as\b|at[eé]\b|às\b|-)\s*(\d{1,2})[h:](\d{0,2})\s+(.*)/i
    );
    if (comFim) {
      const inicioMinRaw = parseInt(comFim[1]) * 60 + parseInt(comFim[2] || "0");
      const fimMinRaw = parseInt(comFim[3]) * 60 + parseInt(comFim[4] || "0");
      const desc = comFim[5].trim();
      const { modalidade, localManual } = analisarDescricaoManual(desc);
      const inicioMin = clockMinAbsoluto(snapGrid30(inicioMinRaw), turnoInicioMin);
      const fimMin = clockMinAbsoluto(snapGrid30(fimMinRaw), inicioMin);
      const isPrelOverlap = inicioMin >= turnoInicioMin && inicioMin < prelFimMin;
      const isForaDeTurno = turnoFimMin !== undefined && inicioMin >= turnoFimMin;
      const semLocal = !localManual.trim();
      result.push({
        linha: idx + 1,
        textoOriginal: linha,
        horaInicio: minParaHora(inicioMin),
        horaFim: minParaHora(fimMin),
        inicioMin,
        fimMin,
        modalidade,
        local: localManual || undefined,
        status: isPrelOverlap || isForaDeTurno || semLocal ? "aviso" : "ok",
        mensagem: isForaDeTurno
          ? `Horário ${minParaHora(inicioMin)} está fora da janela do turno (${turnoInicioHora}–${minParaHora(turnoFimMin!)}). Bloco pode ser ignorado.`
          : isPrelOverlap
            ? `PREL obrigatória ocupa ${turnoInicioHora}–${prelFimHora}. Use ${prelFimHora} para o 1º bloco.`
            : semLocal
              ? "Informe um local/descrição."
              : undefined,
      });
      return;
    }

    // Linha com apenas horário de início
    const semFim = linha.match(/(\d{1,2})[h:](\d{0,2})\s+(.*)/i);
    if (semFim) {
      const inicioMinRaw = parseInt(semFim[1]) * 60 + parseInt(semFim[2] || "0");
      const desc = semFim[3].trim();
      const { modalidade, localManual } = analisarDescricaoManual(desc);
      const inicioMin = clockMinAbsoluto(snapGrid30(inicioMinRaw), turnoInicioMin);
      const isPrelOverlap = inicioMin >= turnoInicioMin && inicioMin < prelFimMin;
      const isForaDeTurno = turnoFimMin !== undefined && inicioMin >= turnoFimMin;
      const semLocal = !localManual.trim();
      result.push({
        linha: idx + 1,
        textoOriginal: linha,
        horaInicio: minParaHora(inicioMin),
        inicioMin,
        modalidade,
        local: localManual || undefined,
        status: isPrelOverlap || isForaDeTurno || semLocal ? "aviso" : "ok",
        mensagem: isForaDeTurno
          ? `Horário ${minParaHora(inicioMin)} está fora da janela do turno (${turnoInicioHora}–${minParaHora(turnoFimMin!)}). Bloco pode ser ignorado.`
          : isPrelOverlap
            ? `PREL obrigatória ocupa ${turnoInicioHora}–${prelFimHora}. Use ${prelFimHora} para o 1º bloco.`
            : semLocal
              ? "Informe um local/descrição."
              : undefined,
      });
      return;
    }

    // Sem horário - Wishlist Flutuante
    const { duracaoMin, textoLimpo } = extrairDuracaoManual(linha);
    const { modalidade, localManual } = analisarDescricaoManual(textoLimpo);
    const semLocal = !localManual.trim();
    result.push({
      linha: idx + 1,
      textoOriginal: linha,
      modalidade,
      local: localManual || undefined,
      status: semLocal ? "aviso" : "ok",
      mensagem: semLocal
        ? "Informe um local/descrição."
        : "Automático: O sistema encaixará no melhor horário." + (duracaoMin ? ` Duração: ${duracaoMin}m` : ""),
    });
  });

  return result;
}

// ─── Rotina exclusiva do Supervisor Regional ──────────────────────────────────
// Estrutura fixa: PREL → DESL(saída) → RONDA(OPM) [→ DESL → RONDA]* → DESL(retorno) → REF → REL
// A REF é inserida no instante exato do alvoMin calculado por planejarRefeicoes.

interface SupRegParams {
  municipiosList: Municipio[];
  municipioBase?: Municipio;
  municipiosRondaOPM?: string[];
  turnoInicio: number;
  turnoFim: number;
  refeicoesPlanejadas: RefeicaoPlanejada[];
  avisos: string[];
}

function gerarBlocosSupReg({
  municipiosList,
  municipioBase,
  municipiosRondaOPM,
  turnoInicio,
  turnoFim,
  refeicoesPlanejadas,
  avisos,
}: SupRegParams): { blocos: BlocoHorario[]; avisos: string[] } {
  // OPMs a rondar: usa lista OPM se fornecida, senão cai nos municípios de patrulha (fuzz/compat)
  const useOPM = municipiosRondaOPM && municipiosRondaOPM.length > 0;
  const rondaTargets: string[] = useOPM ? municipiosRondaOPM : municipiosList;
  const numRondas = rondaTargets.length;

  // Para blocos tipados (PREL/REL/DESL), usa municipiosList como fallback
  const numMuns = municipiosList.length;
  const duracaoTurno = turnoFim - turnoInicio; // 480 para Sup Reg

  // Município de partida e retorno (base do supervisor)
  const base: Municipio = municipioBase ?? municipiosList[0];
  const firstOPM = rondaTargets[0];
  const lastMun = rondaTargets[numRondas - 1];

  const refTotal = refeicoesPlanejadas.reduce((sum, r) => sum + r.duracaoMin, 0);
  // fixedTime = PREL + RONDAs + DESLs_entre + REF + REL
  const fixedTime = 30 + numRondas * 30 + (numRondas - 1) * 30 + refTotal + 30;
  const deslTotal = duracaoTurno - fixedTime; // min disponível para DESL saída + retorno

  // Calcula outbound com base no tempo real de percurso (dados OPM) quando disponível
  let outboundMin: number;
  let inboundMin: number;
  if (useOPM) {
    const baseKey: "A" | "B" = base === "Guararapes" ? "B" : "A";
    const realOut = getTempoParaOPM(baseKey, firstOPM);
    const snapOut = Math.ceil(realOut / 30) * 30;
    outboundMin = Math.min(snapOut, Math.max(0, deslTotal));
    inboundMin = deslTotal - outboundMin;
  } else {
    // Fallback 55 % / 45 % para o caminho do fuzz (municipiosList tipados)
    outboundMin = Math.round((deslTotal * 0.55) / 30) * 30;
    inboundMin = deslTotal - outboundMin;
  }
  const outCount = outboundMin / 30;
  const inCount = inboundMin / 30;

  // Plano de segmentos sem REF (inserida dinamicamente pelo clock)
  interface Seg {
    modalidade: ModalidadePoliciamento;
    duracao: number;
    mun: Municipio;
    local: string;
    problema: string;
    justificativa: string;
    lat?: number | null;
    lng?: number | null;
  }
  const plan: Seg[] = [];

  // PREL — na base do supervisor
  plan.push({
    modalidade: "PREL",
    duracao: 30,
    mun: base,
    local: `Início do serviço / preliminares — ${base}`,
    problema: "Assunção do serviço",
    justificativa: JUSTIFICATIVAS.PREL,
  });

  // Deslocamento saída (múltiplos de 30 min rumo ao 1º município a rondar)
  const localDeslSaida = base !== firstOPM
    ? `Deslocamento — ${base} → ${firstOPM}`
    : `Deslocamento ao setor — ${base}`;
  const justDeslSaida = `Deslocamento ao município de ${firstOPM} para início da Ronda ao Programa de Policiamento.`;
  for (let i = 0; i < outCount; i++) {
    plan.push({
      modalidade: "DESL",
      duracao: 30,
      mun: base, // typed Municipio — destino OPM fica no `local`
      local: localDeslSaida,
      problema: "Deslocamento ao setor",
      justificativa: justDeslSaida,
    });
  }

  // RONDA por OPM + DESL entre municípios
  for (let i = 0; i < numRondas; i++) {
    const munNome = rondaTargets[i];
    // Para blocos tipados, usa municipiosList quando disponível (fuzz path)
    const munTyped: Municipio | undefined = !useOPM ? municipiosList[Math.min(i, numMuns - 1)] : undefined;
    const opmData = useOPM ? getOPM(munNome) : null;

    plan.push({
      modalidade: "RONDA",
      duracao: 30,
      mun: munTyped ?? base,
      local: `Base do Pelotão PM — Ronda ao Programa de Policiamento — ${munNome}`,
      problema: "Supervisão do programa de policiamento; inspeção da OPM e guarnição de serviço",
      justificativa: JUSTIFICATIVAS.RONDA,
      lat: opmData?.lat ?? null,
      lng: opmData?.lng ?? null,
    });

    if (i < numRondas - 1) {
      const proxNome = rondaTargets[i + 1];
      const proxTyped: Municipio | undefined = !useOPM ? municipiosList[Math.min(i + 1, numMuns - 1)] : undefined;
      plan.push({
        modalidade: "DESL",
        duracao: 30,
        mun: proxTyped ?? base,
        local: `Deslocamento ${munNome} → ${proxNome}`,
        problema: "Deslocamento ao setor",
        justificativa: `Deslocamento do município de ${munNome} para o município de ${proxNome}.`,
        lat: null,
        lng: null,
      });
    }
  }

  // Deslocamento retorno — de volta à base
  const localDeslRetorno = base !== lastMun
    ? `Retorno à base — deslocamento de ${lastMun} para ${base}`
    : `Retorno à base — ${base}`;
  const justDeslRetorno = `Retorno à base (${base}) após conclusão da Ronda em ${lastMun}.`;
  for (let i = 0; i < inCount; i++) {
    plan.push({
      modalidade: "DESL",
      duracao: 30,
      mun: base,
      local: localDeslRetorno,
      problema: "Deslocamento ao setor",
      justificativa: justDeslRetorno,
    });
  }

  // REL — na base do supervisor
  plan.push({
    modalidade: "REL",
    duracao: 30,
    mun: base,
    local: `Elaboração do Relatório de Ronda / RSO — ${base}`,
    problema: "Elaboração do Relatório de Ronda e RSO",
    justificativa: JUSTIFICATIVAS.REL,
  });

  // Monta os blocos inserindo REF no instante exato do alvoMin
  const blocos: BlocoHorario[] = [];
  let tempoAtual = turnoInicio;
  let refIdx = 0;
  let ordem = 0;

  for (const seg of plan) {
    // Insere REF pendente antes deste segmento (incluindo antes do REL quando alvoMin cai exatamente aqui)
    while (refIdx < refeicoesPlanejadas.length) {
      const ref = refeicoesPlanejadas[refIdx];
      if (tempoAtual >= ref.alvoMin) {
        blocos.push(
          criarBloco(
            ordem++,
            tempoAtual,
            ref.duracaoMin,
            "REF",
            `Refeição — ${ref.tipo} — ${seg.mun}`,
            "Refeição",
            JUSTIFICATIVAS.REF,
            seg.mun,
          ),
        );
        tempoAtual += ref.duracaoMin;
        refIdx++;
      } else {
        break;
      }
    }

    const bloco = criarBloco(
      ordem++,
      tempoAtual,
      seg.duracao,
      seg.modalidade,
      seg.local,
      seg.problema,
      seg.justificativa,
      seg.mun,
    );
    if (seg.lat !== undefined) bloco.lat = seg.lat;
    if (seg.lng !== undefined) bloco.lng = seg.lng;
    blocos.push(bloco);
    tempoAtual += seg.duracao;
  }

  return { blocos, avisos };
}

// ─── Motor principal ──────────────────────────────────────────────────────────

export function calcularBudgetBackward(
  municipiosList: Municipio[],
  miolo: number
): number[] {
  const numMuns = municipiosList.length;
  if (numMuns <= 1) return [miolo];

  const pesosMuns = municipiosList.map(m => {
    const ppi = PPI_5CIA[m];
    const qtEscolas = ppi?.escolas?.length || 0;
    const qtHotspots = ppi?.hotspots?.length || 0;
    return 1 + qtEscolas + (qtHotspots * 2);
  });

  const somaPesos = pesosMuns.reduce((a, b) => a + b, 0);
  const duracoesSegmento = pesosMuns.map(p => snapGrid30((miolo * p) / somaPesos));

  let somaSegmentos = duracoesSegmento.reduce((s, v) => s + v, 0);
  let idxSoma = 0;
  const indicesOrdenados = pesosMuns.map((p, i) => ({ p, i })).sort((a, b) => b.p - a.p).map(x => x.i);

  while (somaSegmentos < miolo) {
    duracoesSegmento[indicesOrdenados[idxSoma % numMuns]] += 30;
    somaSegmentos += 30;
    idxSoma++;
  }
  while (somaSegmentos > miolo) {
    duracoesSegmento[indicesOrdenados[numMuns - 1 - (idxSoma % numMuns)]] -= 30;
    somaSegmentos -= 30;
    idxSoma++;
  }
  
  return duracoesSegmento;
}

export function aplicarRestricoesDuras(
  blocos: BlocoHorario[],
  timelineHelper: MissionTimelineHelper
): void {
  for (let i = 0; i < blocos.length; i++) {
    const b = blocos[i];
    if (b.modalidade === "PREL" || b.modalidade === "REL") continue;

    const inicioMin = horaParaMin(b.horaInicio);
    const fasesAtivas = timelineHelper.buscarFasesAtivas(inicioMin);
    const restricoes = fasesAtivas.filter(f => f.tipo === "RESTRICAO" && f.restricoesDuras);

    for (const r of restricoes) {
      const rd = r.restricoesDuras!;

      // 1. vetaDeslocamento
      if (rd.vetaDeslocamento) {
        if (b.modalidade === "DESL") {
          b.modalidade = "PE";
          b.acoesPolicia = selecionarAcoes("PE");
          b.justificativa = JUSTIFICATIVAS.PE;
        }
        if (i > 0) {
          const prev = blocos[i - 1];
          b.local = prev.local;
          b.lat = prev.lat;
          b.lng = prev.lng;
          b.municipio = prev.municipio;
        }
      }

      // 2. localFixoId
      if (rd.localFixoId && b.municipio && pertenceAoMunicipio(rd.localFixoId, b.municipio)) {
        const targetCoords = obterCoordenadasLocal(rd.localFixoId, b.municipio);
        b.local = rd.localFixoId;
        b.lat = targetCoords.lat;
        b.lng = targetCoords.lng;
      }

      // 3. modalidadesPermitidas
      if (rd.modalidadesPermitidas && rd.modalidadesPermitidas.length > 0) {
        if (!rd.modalidadesPermitidas.includes(b.modalidade as any)) {
          b.modalidade = rd.modalidadesPermitidas[0] as ModalidadePoliciamento;
          b.acoesPolicia = selecionarAcoes(b.modalidade);
          b.justificativa = JUSTIFICATIVAS[b.modalidade] || "Atividade de policiamento.";
          
          if (!rd.localFixoId && b.municipio) {
            const coords = obterCoordenadasLocal(b.local, b.municipio);
            b.lat = coords.lat;
            b.lng = coords.lng;
          }
        }
      }

      // 4. modalidadesProibidas
      if (rd.modalidadesProibidas && rd.modalidadesProibidas.includes(b.modalidade as any)) {
        const altCandidates: ModalidadePoliciamento[] = ["PE", "PREV", "POST"];
        const selectedAlt = altCandidates.find(m => !rd.modalidadesProibidas!.includes(m as any)) || "PREV";
        b.modalidade = selectedAlt;
        b.acoesPolicia = selecionarAcoes(b.modalidade);
        b.justificativa = JUSTIFICATIVAS[b.modalidade] || "Atividade de policiamento.";
        
        if (!rd.localFixoId && b.municipio) {
          const coords = obterCoordenadasLocal(b.local, b.municipio);
          b.lat = coords.lat;
          b.lng = coords.lng;
        }
      }
    }
  }
}

interface GerarCPPParams {
  configuracao: ConfiguracaoServico;
  municipios: typeof MUNICIPIOS_V33;
  diretivas?: DirectivePayload;
}

export function gerarCPPBase({ configuracao, municipios, diretivas }: GerarCPPParams): {
  blocos: BlocoHorario[];
  avisos: string[];
} {
  let timelineHelper: MissionTimelineHelper | null = null;
  if (diretivas) {
    const focoOS = diretivas.focosDiretivas.find(
      (f) => f.origem === "ORDEM_SERVICO" && f.timeline
    );
    if (focoOS && focoOS.timeline) {
      timelineHelper = new MissionTimelineHelper(focoOS.timeline);
    }
  }

  const municipiosOriginais: Municipio[] = configuracao.municipios && configuracao.municipios.length > 0
    ? configuracao.municipios
    : (configuracao.municipio ? [configuracao.municipio] : []);
  const avisos: string[] = [];
  const isMonoMunicipio = ATIVIDADE_MONO_MUNICIPIO.has(configuracao.tipoAtividade);
  const municipiosList: Municipio[] =
    isMonoMunicipio && municipiosOriginais.length > 0
      ? [municipiosOriginais[0]]
      : municipiosOriginais;
  if (isMonoMunicipio && municipiosOriginais.length > 1) {
    avisos.push(`Atividade Delegada restrita a um município — usado: ${municipiosOriginais[0]}.`);
  }
  if (municipiosList.length === 0) return { blocos: [], avisos: [] };

  const numMuns = municipiosList.length;
  const municipioInicio = municipiosList[0];
  const municipioTermino = municipiosList[municipiosList.length - 1];
  const munsStr = municipiosList.join(",");

  // RNG com seed: mesma config → mesmo roteiro; outra data/hora/municípios → outro
  const rng = mulberry32(
    hashStr(
      `${configuracao.data}|${munsStr}|${configuracao.horaInicio}|${configuracao.tipoAtividade}`
    )
  );

  const diaUtil = ehDiaUtil(configuracao.data);
  const mesData = parseDataLocal(configuracao.data).getMonth() + 1;

  const duracaoTurno = DURACAO_TURNO_MIN[configuracao.tipoAtividade] ?? 480;

  // Grade de 30 min: snap o início e calcular fim = início + duracaoTurno
  const turnoInicio = snapGrid30(horaParaMin(configuracao.horaInicio));
  const turnoFim = turnoInicio + duracaoTurno;
  const fimREL = turnoFim - 30; // REL ocupa os últimos 30 min

  const manuais =
    configuracao.modalidadeGeracao === "manual" &&
    configuracao.blocosManuais.trim()
      ? parseBlocosManuais(configuracao.blocosManuais, turnoInicio)
      : [];

  const manuaisFixos = manuais.filter(m => m.inicioMin !== null);
  const manuaisFlutuantes = manuais.filter(m => m.inicioMin === null);

  // Avisar blocos manuais fora da janela do turno (após normalização noturna)
  manuaisFixos
    .filter(m => m.inicioMin! >= turnoFim)
    .forEach(m => {
      avisos.push(
        `Bloco manual "${m.desc || m.modalidade}" às ${minParaHora(m.inicioMin!)} está fora da janela do turno (${minParaHora(turnoInicio)}–${minParaHora(turnoFim)}) e foi ignorado.`
      );
    });

  const temRefManual = manuais.some(m => m.modalidade === "REF");
  const refeicoesPlanejadas = temRefManual
    ? []
    : planejarRefeicoes(turnoInicio, turnoFim, duracaoTurno, timelineHelper || undefined);

  // Rotina própria do Supervisor Regional (geração automática)
  if (
    CATEGORIA_ATIVIDADE[configuracao.tipoAtividade] === "SUPERVISAO" &&
    configuracao.modalidadeGeracao === "automatica"
  ) {
    return gerarBlocosSupReg({
      municipiosList,
      municipioBase: configuracao.municipioBase,
      municipiosRondaOPM: configuracao.municipiosRondaOPM,
      turnoInicio,
      turnoFim,
      refeicoesPlanejadas,
      avisos,
    });
  }

  // Cálculo de deslocamentos
  const deslEntre = numMuns - 1;
  const totalDESL = deslEntre * 30;

  let totalREF = refeicoesPlanejadas.reduce((total, ref) => total + ref.duracaoMin, 0);
  let miolo = duracaoTurno - 30 - 30 - totalREF - totalDESL;

  if (miolo < numMuns * 30 && refeicoesPlanejadas.length > 0) {
    refeicoesPlanejadas.pop();
    totalREF = refeicoesPlanejadas.reduce((total, ref) => total + ref.duracaoMin, 0);
    miolo = duracaoTurno - 30 - 30 - totalREF - totalDESL;
    avisos.push(`Turno curto para ${numMuns} municípios — refeições/segmentos reduzidos`);
  }
  if (miolo < numMuns * 30 && refeicoesPlanejadas.length > 0) {
    refeicoesPlanejadas.pop();
    totalREF = refeicoesPlanejadas.reduce((total, ref) => total + ref.duracaoMin, 0);
    miolo = duracaoTurno - 30 - 30 - totalREF - totalDESL;
    avisos.push(`Turno curto para ${numMuns} municípios — refeições/segmentos reduzidos`);
  }
  if (miolo < numMuns * 30) {
    miolo = numMuns * 30;
  }

  // Distribuição do miolo entre os segmentos com base na complexidade (Budget Backward-Pass)
  const duracoesSegmento = calcularBudgetBackward(municipiosList, miolo);

  const blocos: BlocoHorario[] = [];
  let ordem = 0;
  let tempoAtual = turnoInicio;

  // Estado Geográfico Global para o turno (TSP Nearest Neighbor)
  const refInicial = obterCoordenadaReferenciaMunicipio(municipioInicio);
  const estadoGeoGlobal: EstadoGeoLocal = {
    lastLat: refInicial?.lat ?? null,
    lastLng: refInicial?.lng ?? null,
  };

  // Mapas de cobertura independentes por município
  const coberturas: Record<string, CoberturaMapa> = {};
  for (const mun of municipiosList) {
    coberturas[mun] = new Map();
  }

  let proximoRefIdx = 0;
  const historico: ModalidadePoliciamento[] = [];

  // ── PREL ───────────────────────────────────────────────────────────────────
  blocos.push(
    criarBloco(
      ordem++,
      tempoAtual,
      30,
      "PREL",
      municipioInicio === "Valparaíso"
        ? "Base do Pelotão PM (Valparaíso)"
        : `Início do serviço / preliminares — ${municipioInicio}`,
      "Assunção do serviço",
      JUSTIFICATIVAS.PREL,
      municipioInicio
    )
  );
  tempoAtual += 30;
  historico.push("PREL");

  let idxManual = 0;

  // ── Miolo Segmentado por Município ─────────────────────────────────────────
  for (let i = 0; i < numMuns; i++) {
    const currentMunName = municipiosList[i];
    const currentMunData = municipios[currentMunName];
    if (!currentMunData) continue;

    let patrolBudget = duracoesSegmento[i];

    while (tempoAtual < fimREL) {
      const disponivel = fimREL - tempoAtual;
      if (disponivel < 30) break;
      const proximaRefeicao = refeicoesPlanejadas[proximoRefIdx] ?? null;
      const refeicaoNoHorario =
        !temRefManual &&
        proximaRefeicao !== null &&
        tempoAtual >= proximaRefeicao.alvoMin;
      if (patrolBudget <= 0 && !refeicaoNoHorario) break;

      const ppiMun = (PPI_5CIA as any)[currentMunName];
      const escolasMun = ppiMun?.escolas ?? [];
      const hotspotsMun = ppiMun?.hotspots ?? [];

      // Backward Induction Real: calcula budget de retorno baseado em tempo restante
      estadoGeoGlobal.backwardBudgetMin = fimREL - tempoAtual;

      const periodo = calcularPeriodo(tempoAtual);
      const progressoTurno = (tempoAtual - turnoInicio) / duracaoTurno;
      const focoAtivo = determinarFocoAtivo(configuracao.focos, configuracao.tipoPoliciamento, progressoTurno);

      const diasSemanaMapa: Record<number, string> = {
        0: "domingo", 1: "segunda", 2: "terca", 3: "quarta", 4: "quinta", 5: "sexta", 6: "sabado"
      };
      const diaSemana = diasSemanaMapa[parseDataLocal(configuracao.data).getDay()];
      const horaAtual = Math.floor((tempoAtual % 1440) / 60);
      const hotspotsAtivosMun = hotspotsAtivos(hotspotsMun, periodo, horaAtual, diaSemana);

      // Bloco manual prioritário para este horário
      if (idxManual < manuaisFixos.length) {
        const bm = manuaisFixos[idxManual];
        if (bm.inicioMin! < tempoAtual) {
          const isPrelOverlap = bm.inicioMin! >= turnoInicio && bm.inicioMin! < turnoInicio + 30;
          if (isPrelOverlap) {
            avisos.push(
              `Bloco manual "${bm.desc || bm.modalidade}" originalmente às ${minParaHora(bm.inicioMin!)} foi movido para ${minParaHora(tempoAtual)} devido à PREL obrigatória.`
            );
          } else {
            avisos.push(
              `Bloco manual "${bm.desc || bm.modalidade}" originalmente às ${minParaHora(bm.inicioMin!)} foi movido para ${minParaHora(tempoAtual)} por sobreposição de agenda.`
            );
          }
          bm.inicioMin = tempoAtual;
        }
        
        if (bm.inicioMin === tempoAtual) {
          const dur = bm.duracaoMin || (bm.fimMin ? Math.max(30, snapGrid30(bm.fimMin - bm.inicioMin!)) : 30);
          const durSafe = Math.min(dur, disponivel);
          
          const localFinal = bm.localManual.trim()
            ? bm.localManual
            : determinarLocalFinal({
                modalidade: bm.modalidade,
                tempoAtual,
                diaUtil,
                escolasMun,
                hotspotsAtivosMun,
                currentMunData,
                cobertura: coberturas[currentMunName],
                rng,
                configuracao,
                focoAtivo,
                ppiMun,
                municipioNome: currentMunName,
                estadoGeo: estadoGeoGlobal
              });
          blocos.push(
            criarBloco(
              ordem++,
              tempoAtual,
              durSafe,
              bm.modalidade,
              localFinal,
              selecionarProblema(bm.modalidade, periodo),
              JUSTIFICATIVAS[bm.modalidade] || "Atividade de policiamento.",
              currentMunName
            )
          );
          tempoAtual += durSafe;
          historico.push(bm.modalidade);
          if (bm.modalidade === "REF") proximoRefIdx++;
          const isPatrol = !["PREL", "DESL", "REF", "REL"].includes(bm.modalidade);
          if (isPatrol) {
            patrolBudget = Math.max(0, patrolBudget - durSafe);
          }
          idxManual++;
          continue;
        }
      }

      // Inserção da Wishlist Flutuante
      if (manuaisFlutuantes.length > 0 && patrolBudget >= 30) {
        if (!refeicaoNoHorario) {
          const bm = manuaisFlutuantes.shift()!;
          const dur = bm.duracaoMin || 30;
          const durSafe = Math.min(dur, disponivel);
          const localFinal = bm.localManual.trim()
            ? bm.localManual
            : determinarLocalFinal({
                modalidade: bm.modalidade,
                tempoAtual,
                diaUtil,
                escolasMun,
                hotspotsAtivosMun,
                currentMunData,
                cobertura: coberturas[currentMunName],
                rng,
                configuracao,
                focoAtivo,
                ppiMun,
                municipioNome: currentMunName,
                estadoGeo: estadoGeoGlobal,
                timelineHelper: timelineHelper || undefined
              });
          blocos.push(
            criarBloco(
              ordem++,
              tempoAtual,
              durSafe,
              bm.modalidade,
              localFinal,
              selecionarProblema(bm.modalidade, periodo),
              JUSTIFICATIVAS[bm.modalidade] || "Atividade de policiamento.",
              currentMunName
            )
          );
          tempoAtual += durSafe;
          historico.push(bm.modalidade);
          if (bm.modalidade === "REF") proximoRefIdx++;
          const isPatrol = !["PREL", "DESL", "REF", "REL"].includes(bm.modalidade);
          if (isPatrol) {
            patrolBudget = Math.max(0, patrolBudget - durSafe);
          }
          continue;
        }
      }

      // REF no ponto alvo de relogio, conforme costume brasileiro.
      if (
        refeicaoNoHorario &&
        proximaRefeicao &&
        tempoAtual + proximaRefeicao.duracaoMin <= fimREL
      ) {
        blocos.push(
          criarBloco(
            ordem++,
            tempoAtual,
            proximaRefeicao.duracaoMin,
            "REF",
            `Refeição — ${proximaRefeicao.tipo} — ${currentMunName}`,
            "Refeição",
            JUSTIFICATIVAS.REF,
            currentMunName
          )
        );
        tempoAtual += proximaRefeicao.duracaoMin;
        proximoRefIdx++;
        historico.push("REF");
        continue;
      }
      if (refeicaoNoHorario) {
        proximoRefIdx++;
      }

      const usaRural =
        focoAtivo === "Rural" ||
        focoAtivo === "Foco Rural" ||
        currentMunData.perfil === "rural_pequeno";
      const perfil: string = numMuns > 1
        ? currentMunData.perfil
        : (usaRural ? "rural_pequeno" : currentMunData.perfil);

      let pesos: Pesos = {
        ...(MATRIZ_PESOS[perfil]?.[periodo] ?? { PREV: 3, PE: 2, FISC: 1 }),
      };

      // Ajuste de pesos pelo Foco de Policiamento Ativo
      pesos = ajustarPesosPorFoco(pesos, focoAtivo, perfil, periodo);

      // Ajustes de Diretivas Táticas V23: CONTEXTO e PREFERENCIA
      if (timelineHelper) {
        const fasesAtivas = timelineHelper.buscarFasesAtivas(tempoAtual);
        for (const fase of fasesAtivas) {
          // 1. CONTEXTO
          if (fase.tipo === "CONTEXTO" && fase.contexto) {
            const ctx = fase.contexto;
            if (ctx.focoEspecifico === "COMERCIAL") {
              if (pesos.POST !== undefined) pesos.POST = Math.round(pesos.POST * 1.5);
              if (pesos.PE !== undefined) pesos.PE = Math.round(pesos.PE * 1.5);
            } else if (ctx.focoEspecifico === "RESIDENCIAL") {
              if (pesos.PREV !== undefined) pesos.PREV = Math.round(pesos.PREV * 1.5);
            } else if (ctx.focoEspecifico === "RURAL") {
              if (pesos.RURAL !== undefined) pesos.RURAL = Math.round(pesos.RURAL * 1.5);
            } else if (ctx.focoEspecifico === "TRANSITO") {
              if (pesos.FISC !== undefined) pesos.FISC = Math.round(pesos.FISC * 1.5);
            }

            if (ctx.riscoAglomeracao) {
              pesos.PE = (pesos.PE ?? 0) + 3;
              pesos.POST = (pesos.POST ?? 0) + 3;
            }

            if (ctx.criticidade === "ALTA") {
              pesos.POST = (pesos.POST ?? 0) + 2;
              pesos.PE = (pesos.PE ?? 0) + 2;
            } else if (ctx.criticidade === "MEDIA") {
              pesos.POST = (pesos.POST ?? 0) + 1;
              pesos.PE = (pesos.PE ?? 0) + 1;
            }
          }

          // 2. PREFERENCIA
          if (fase.tipo === "PREFERENCIA" && fase.modificadores) {
            for (const mod of fase.modificadores) {
              const modKey = mod.modalidade as keyof Pesos;
              if (pesos[modKey] !== undefined) {
                pesos[modKey] = Math.round(pesos[modKey]! * mod.multiplicadorPeso);
              } else {
                pesos[modKey] = Math.round(2 * mod.multiplicadorPeso);
              }
            }
          }
        }
      }

      // Sazonalidade: SAT com peso dinâmico de evento/saturação na data
      const pesoSat = pesoSatNaData(currentMunData.eventos, configuracao.data);
      if (pesoSat > 0) pesos.SAT = (pesos.SAT ?? 0) + pesoSat;

      // ESC por horário real de escola (Fase 2)
      const temEscolasMapeadas = escolasMun.length > 0;
      if (temEscolasMapeadas) {
        if (diaUtil) {
          const boost = obterBoostEscola(escolasMun, tempoAtual % 1440);
          if (boost > 0) {
            pesos.ESC = (pesos.ESC ?? 0) + boost;
          }
        }
      } else {
        // Fallback heurístico anterior
        if (
          diaUtil &&
          (periodo === "manha" || periodo === "tarde") &&
          perfil === "urbano_medio" &&
          !historico.slice(-2).includes("ESC")
        ) {
          pesos.ESC = (pesos.ESC ?? 0) + 3;
        }
      }

      // Hotspots Dirigidos — Intensidade Poisson (Etapa 1 V21)
      for (const h of hotspotsAtivosMun) {
        const intensidade = calcularIntensidadeHotspot(h, tempoAtual);
        const boostPorMod = intensidade / h.modalidadesRecomendadas.length;
        for (const mod of h.modalidadesRecomendadas) {
          pesos[mod] = (pesos[mod] ?? 0) + boostPorMod;
        }
      }

      // Sinistralidade & Alvos de Explosão (Fase 4)
      if (ppiMun) {
        if (ppiMun.transito?.horariosCriticos?.includes(horaAtual)) {
          pesos.FISC = (pesos.FISC ?? 0) + 3;
        }
        if (periodo === "madrugada" && ppiMun.instituicoesFinanceiras?.some((f: any) => f.alvoExplosaoCaixa)) {
          pesos.FISC = (pesos.FISC ?? 0) + 3;
        }
      }

      // Ajuste de pesos por categoria doutrinária
      const categoria = CATEGORIA_ATIVIDADE[configuracao.tipoAtividade] ?? "PATRULHA";
      pesos = ajustarPesosPorCategoria(pesos, categoria);

      // Ponderar por Perfil Criminal (Fase 6)
      pesos = ajustarPesosPorPerfilCriminal(pesos, ppiMun?.perfilCriminal);

      // Fadiga Ergonômica Circadiana e Dinâmica (Fase 3 do Especialista)
      pesos = ajustarPesosPorFadiga(pesos, tempoAtual, turnoInicio);

      // Ronda Escolar (ESC) não ocorre em fim de semana (Fase 0)
      if (!diaUtil) {
        delete pesos.ESC;
      }

      // Tenta reservar slot para um hotspot crítico (Interval Scheduling)
      const hotspotReservado = tentarReservarHotspot(
        hotspotsAtivosMun,
        tempoAtual,
        historico,
        coberturas[currentMunName]
      );

      // Verifica se há objetivo persistente ativo e pendente para este horário e município
      const objetivosAtivos = (diretivas?.focosDiretivas || [])
        .flatMap(f => f.objetivosPersistentes || [])
        .filter(obj => pertenceAoMunicipio(obj.localId, currentMunName) && isObjetivoAtivo(obj, tempoAtual));
      const objPendente = objetivosAtivos.find(obj => !isObjetivoCumprido(obj, blocos));

      let modalidade: ModalidadePoliciamento;
      let localFinalForce: string | undefined;

      if (objPendente) {
        modalidade = objPendente.modalidade;
        localFinalForce = objPendente.localId;
      } else if (hotspotReservado) {
        modalidade = hotspotReservado.modalidade;
        localFinalForce = hotspotReservado.local;
      } else {
        // Fallback = modalidade de maior peso antes do anti-repetição
        const fallback = (
          Object.entries(pesos) as [ModalidadePoliciamento, number][]
        ).reduce<[ModalidadePoliciamento, number]>(
          (best, [m, w]) => (w > best[1] ? [m, w] : best),
          ["PREV", 0]
        )[0];

        // Anti-repetição: zera peso das 2 últimas modalities reais
        for (const m of historico
          .slice(-2)
          .filter(m => m !== "PREL" && m !== "DESL" && m !== "REF")) {
          delete (pesos as Record<string, number>)[m];
        }

        // Anti-repetição estendida: Penalidade Markov 3ª Ordem
        const penalidadesMarkov = construirPenalizacaoTrigrama(historico);
        pesos = aplicarPenalizacaoMarkov(pesos, penalidadesMarkov);

        modalidade = selecionarModalidade(pesos, rng, fallback);
      }

      // Nunca ultrapassa o próximo bloco manual, a próxima REF ou o orçamento de patrulha
      const proxManualInicio =
        idxManual < manuaisFixos.length ? manuaisFixos[idxManual].inicioMin! : fimREL;
      const proxRefInicio =
        !temRefManual && proximaRefeicao && proximaRefeicao.alvoMin > tempoAtual
          ? proximaRefeicao.alvoMin
          : fimREL;
      const disponivelReal = Math.min(
        disponivel,
        proxManualInicio - tempoAtual,
        proxRefInicio - tempoAtual,
        patrolBudget
      );

      // Duração: PE e ESC = 30 min; RURAL = 60-90; demais = 30-60
      let dur: number;
      if (modalidade === "PE" || modalidade === "ESC") {
        dur = 30;
      } else if (modalidade === "RURAL") {
        dur = disponivelReal >= 120 ? (rng() > 0.5 ? 90 : 60) : 60;
      } else {
        dur = disponivelReal >= 90 ? (rng() > 0.6 ? 60 : 30) : 30;
      }

      // Nunca ultrapassa limites
      dur = Math.min(dur, disponivelReal);

      // RURAL que não cabe (gap < 60 min): substitui por PE ou FISC de 30 min
      if (modalidade === "RURAL" && dur < 60) {
        // Se `pesos` estiver definido no escopo de block fallback, ótimo. Mas caso `pesos` local do else não exista:
        const alt: ModalidadePoliciamento = pesos.PE ? "PE" : "FISC";
        const durAlt = Math.min(30, disponivelReal);
        if (durAlt >= 30) {
          const localReal = localFinalForce || determinarLocalFinal({
            modalidade: alt,
            tempoAtual,
            diaUtil,
            escolasMun,
            hotspotsAtivosMun,
            currentMunData,
            cobertura: coberturas[currentMunName],
            rng,
            configuracao,
            focoAtivo,
            ppiMun,
            municipioNome: currentMunName,
            estadoGeo: estadoGeoGlobal,
            timelineHelper: timelineHelper || undefined
          });
          blocos.push(
            criarBloco(
              ordem++,
              tempoAtual,
              durAlt,
              alt,
              localReal,
              selecionarProblema(alt, periodo),
              JUSTIFICATIVAS[alt] || "Atividade de policiamento.",
              currentMunName
            )
          );
          tempoAtual += durAlt;
          patrolBudget -= durAlt;
          historico.push(alt);
        } else {
          patrolBudget = 0;
        }
        continue;
      }

      if (dur < 30) {
        patrolBudget = 0;
        break;
      }

      const localReal = localFinalForce || determinarLocalFinal({
        modalidade,
        tempoAtual,
        diaUtil,
        escolasMun,
        hotspotsAtivosMun,
        currentMunData,
        cobertura: coberturas[currentMunName],
        rng,
        configuracao,
        focoAtivo,
        ppiMun,
        municipioNome: currentMunName,
        estadoGeo: estadoGeoGlobal,
        timelineHelper: timelineHelper || undefined
      });
      blocos.push(
        criarBloco(
          ordem++,
          tempoAtual,
          dur,
          modalidade,
          localReal,
          selecionarProblema(modalidade, periodo),
          JUSTIFICATIVAS[modalidade] || "Atividade de policiamento.",
          currentMunName
        )
      );
      tempoAtual += dur;
      patrolBudget -= dur;
      historico.push(modalidade);
    }

    // Ao terminar o segmento i (se houver i+1), insere DESL entre municípios
    if (i < numMuns - 1 && tempoAtual < fimREL) {
      const proxMun = municipiosList[i + 1];
      blocos.push(
        criarBloco(
          ordem++,
          tempoAtual,
          30,
          "DESL",
          `Deslocamento ${currentMunName} → ${proxMun}`,
          "Deslocamento ao setor",
          `Deslocamento do município de ${currentMunName} para o município de ${proxMun}.`,
          proxMun
        )
      );
      tempoAtual += 30;
      historico.push("DESL");
    }
  }

  // ── REL ────────────────────────────────────────────────────────────────────
  blocos.push(
    criarBloco(
      ordem++,
      fimREL,
      30,
      "REL",
      `Elaboração do RSO — ${municipioTermino}`,
      "Elaboração do RSO",
      JUSTIFICATIVAS.REL,
      municipioTermino
    )
  );
  if (timelineHelper) {
    aplicarRestricoesDuras(blocos, timelineHelper);
  }

  return { blocos, avisos };
}

// ─── Pipeline V21: gerarCPP Base + Otimizador LNS ──────────────────────────────
// Import do otimizador (lazy para não quebrar testes existentes)
import { otimizarPorLNS } from "./otimizadorLNS";
import type { ContextoScore } from "./scoreRoteiro";

export function gerarCPP({ configuracao, municipios, diretivas }: GerarCPPParams): {
  blocos: BlocoHorario[];
  avisos: string[];
  scoreV20?: number;
  scoreV21?: number;
} {
  // Etapa 1: Gerar roteiro base V20
  const resultadoBase = gerarCPPBase({ configuracao, municipios, diretivas });
  if (resultadoBase.blocos.length === 0) return resultadoBase;

  // Supervisor Regional não passa pelo LNS (roteiro fixo)
  if (CATEGORIA_ATIVIDADE[configuracao.tipoAtividade] === "SUPERVISAO") {
    return resultadoBase;
  }

  // Modo manual: não otimizar
  if (configuracao.modalidadeGeracao === "manual" && configuracao.blocosManuais.trim()) {
    return resultadoBase;
  }

  const municipiosList: Municipio[] = configuracao.municipios && configuracao.municipios.length > 0
    ? configuracao.municipios
    : (configuracao.municipio ? [configuracao.municipio] : []);

  const turnoInicioMin = snapGrid30(horaParaMin(configuracao.horaInicio));

  const contextoScore: ContextoScore = {
    municipios: municipiosList,
    turnoInicioMin,
    diretivas,
  };

  // RNG seedado para o otimizador (derivado do mesmo seed, com sufixo)
  const rngOtimizador = mulberry32(
    hashStr(
      `${configuracao.data}|${municipiosList.join(",")}|${configuracao.horaInicio}|${configuracao.tipoAtividade}|LNS`
    )
  );

  const scoreV20 = avaliarScoreGlobal(resultadoBase.blocos, contextoScore);

  // Etapa 2: Otimizar com LNS
  const blocosOtimizados = otimizarPorLNS(
    resultadoBase.blocos,
    contextoScore,
    configuracao,
    rngOtimizador,
    diretivas
  );

  const scoreV21 = avaliarScoreGlobal(blocosOtimizados, contextoScore);

  return {
    blocos: blocosOtimizados,
    avisos: resultadoBase.avisos,
    scoreV20,
    scoreV21,
  };
}

export function gerarFundamentacao(
  configuracao: ConfiguracaoServico,
  ppiDosMunicipios: typeof PPI_5CIA = PPI_5CIA
): string[] {
  const linhas: string[] = [];
  const muns = configuracao.municipios && configuracao.municipios.length > 0
    ? configuracao.municipios
    : (configuracao.municipio ? [configuracao.municipio] : []);

  if (muns.length === 0) return [];

  const diaUtil = ehDiaUtil(configuracao.data);

  muns.forEach((mun) => {
    const ppiMun = (ppiDosMunicipios as any)[mun];
    if (!ppiMun) return;

    // 1. Indicadores criminais oficiais
    const pc = ppiMun.perfilCriminal;
    if (pc && pc.confianca === "oficial" && pc.fonteUrl && (pc.fonteUrl.startsWith("http") || pc.fonteUrl.startsWith("file:///"))) {
      let countText = "";
      if (pc.indicadorDominante === "furto" && typeof pc.furtoOutros === "number") {
        countText = `${pc.furtoOutros} ocorrências`;
      } else if (pc.indicadorDominante === "roubo" && typeof pc.rouboOutros === "number") {
        countText = `${pc.rouboOutros} ocorrências`;
      } else if (pc.indicadorDominante === "letalidade" && typeof pc.homicidioDoloso === "number") {
        countText = `${pc.homicidioDoloso} ocorrências`;
      } else if (pc.indicadorDominante === "furto_veiculo" && typeof pc.furtoVeiculo === "number") {
        countText = `${pc.furtoVeiculo} ocorrências`;
      } else if (pc.indicadorDominante === "roubo_veiculo" && typeof pc.rouboVeiculo === "number") {
        countText = `${pc.rouboVeiculo} ocorrências`;
      } else if (pc.indicadorDominante === "rural" && typeof pc.furtoOutros === "number") {
        countText = `${pc.furtoOutros} ocorrências`;
      }

      if (countText) {
        const indName = pc.indicadorDominante === "furto" ? "furto" :
                        (pc.indicadorDominante === "roubo" ? "roubo" :
                         (pc.indicadorDominante === "letalidade" ? "homicídio doloso" :
                          (pc.indicadorDominante === "furto_veiculo" ? "furto de veículo" :
                           (pc.indicadorDominante === "roubo_veiculo" ? "roubo de veículo" :
                            (pc.indicadorDominante === "rural" ? "delito rural" : pc.indicadorDominante)))));
        linhas.push(
          `Ênfase em preventivo/ostensivo: indicador dominante em ${mun} é ${indName} (${countText}, ano-móvel ${pc.anoMovel}). Fonte: SSP-SP.`
        );
      }
    }

    // 2. Ronda escolar nos horários reais
    if (diaUtil && ppiMun.escolas && ppiMun.escolas.length > 0) {
      ppiMun.escolas.forEach((esc: any) => {
        if (esc.turnoEntrada && esc.turnoSaida) {
          linhas.push(
            `Ronda escolar nos horários reais: ${esc.nome} (entrada ${esc.turnoEntrada}, saída ${esc.turnoSaida}).`
          );
        }
      });
    }

    // 3. Fiscalização priorizada em trechos críticos de trânsito
    const trans = ppiMun.transito;
    if (trans && trans.confianca === "oficial" && trans.fonteUrl && (trans.fonteUrl.startsWith("http") || trans.fonteUrl.startsWith("file:///"))) {
      if (trans.tiposViaCriticos && trans.tiposViaCriticos.length > 0) {
        const trecho = trans.tiposViaCriticos[0];
        const horasText = trans.horariosCriticos ? trans.horariosCriticos.map((h: number) => `${String(h).padStart(2, "0")}h`).join("/") : "";
        linhas.push(
          `Fiscalização priorizada em ${trecho}: maior sinistralidade (${horasText}).`
        );
      }
    }

    // 4. Saturação por eventos reais ativos na data
    if (ppiMun.eventos && ppiMun.eventos.length > 0) {
      const d = parseDataLocal(configuracao.data);
      const mes = d.getMonth() + 1;
      const dia = d.getDate();
      const mmdd = `${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;

      const diasSemanaMapa: Record<number, string> = {
        0: "dom", 1: "seg", 2: "ter", 3: "qua", 4: "qui", 5: "sex", 6: "sab"
      };
      const diaSemana = diasSemanaMapa[d.getDay()];

      ppiMun.eventos.forEach((e: any) => {
        let ativo = false;
        let janela = "";
        if (e.inicio && e.fim) {
          janela = `${e.inicio} a ${e.fim}`;
          ativo = dentroDaJanela(mmdd, e.inicio, e.fim, d);
        } else if (e.mes) {
          janela = `Mês ${e.mes}`;
          ativo = mes === e.mes;
        }

        if (ativo && e.diasSemana && !e.diasSemana.includes(diaSemana)) {
          ativo = false;
        }

        if (ativo) {
          linhas.push(
            `Saturação em período crítico: evento ${e.nome} (${janela}).`
          );
        }
      });
    }
  });

  // 5. Linha neutra de pendências — apenas campos realmente ausentes
  const hasPendingVD = muns.some((mun) => {
    const ppiMun = (ppiDosMunicipios as any)[mun];
    if (!ppiMun) return false;
    const pc = ppiMun.perfilCriminal;
    if (!pc) return true;
    return pc.violenciaDomestica === null;
  });

  if (hasPendingVD) {
    linhas.push(
      "Indicadores de violência doméstica / Maria da Penha pendentes de validação pelo comando (Infocrim)."
    );
  }

  return linhas;
}
