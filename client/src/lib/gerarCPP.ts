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
} from "./types";
import {
  MODALIDADES,
  MUNICIPIOS_V33,
  JUSTIFICATIVAS,
  MODUS_OPERANDI_DEFAULT,
  DURACAO_TURNO_MIN,
  CATEGORIA_ATIVIDADE,
  type CategoriaAtividade,
} from "./constants";

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
  }
  return novosPesos;
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
  rng: () => number
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

  const minVisitas = Math.min(...candidatos.map(c => cobertura.get(c) ?? 0));
  const menosVisitados = candidatos.filter(
    c => (cobertura.get(c) ?? 0) === minVisitas
  );
  const escolhido = pick(
    menosVisitados,
    Math.floor(rng() * menosVisitados.length),
    candidatos[0]
  );
  cobertura.set(escolhido, (cobertura.get(escolhido) ?? 0) + 1);
  return escolhido;
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
  };
}

// ─── Parser de blocos manuais ─────────────────────────────────────────────────

function inferirModalidade(texto: string): ModalidadePoliciamento {
  const t = texto.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  if (/prel|assuncao|assun/.test(t)) return "PREL";
  if (/desl/.test(t)) return "DESL";
  if (/ref|janta|almoco|cafe|refeic|aliment/.test(t)) return "REF";
  if (/rel\b|rso|encer/.test(t)) return "REL";
  if (/rural/.test(t)) return "RURAL";
  if (/sat\b|saturac/.test(t)) return "SAT";
  if (/escol/.test(t) && !/escolt/.test(t)) return "ESC";
  if (/fisc|blitz|bloqueio/.test(t)) return "FISC";
  if (/\bpe\b|estacion/.test(t)) return "PE";
  if (/prev|bairr/.test(t)) return "PREV";
  return "POST";
}

interface BlocoManualParsed {
  inicioMin: number;
  fimMin: number | null;
  modalidade: ModalidadePoliciamento;
  desc: string;
}

function parseBlocosManuais(texto: string): BlocoManualParsed[] {
  const linhas = texto
    .split("\n")
    .map(l => l.trim())
    .filter(Boolean);
  const result: BlocoManualParsed[] = [];

  for (const linha of linhas) {
    const comFim = linha.match(
      /(\d{1,2})[h:](\d{0,2})\s*(?:a\b|as\b|at[eé]\b|às\b|-)\s*(\d{1,2})[h:](\d{0,2})\s+(.*)/i
    );
    if (comFim) {
      const inicioMin = parseInt(comFim[1]) * 60 + parseInt(comFim[2] || "0");
      const fimMin = parseInt(comFim[3]) * 60 + parseInt(comFim[4] || "0");
      result.push({
        inicioMin: snapGrid30(inicioMin),
        fimMin: snapGrid30(fimMin),
        modalidade: inferirModalidade(comFim[5]),
        desc: comFim[5].trim(),
      });
      continue;
    }

    const semFim = linha.match(/(\d{1,2})[h:](\d{0,2})\s+(.*)/i);
    if (semFim) {
      const inicioMin = parseInt(semFim[1]) * 60 + parseInt(semFim[2] || "0");
      result.push({
        inicioMin: snapGrid30(inicioMin),
        fimMin: null,
        modalidade: inferirModalidade(semFim[3]),
        desc: semFim[3].trim(),
      });
    }
  }

  return result.sort((a, b) => a.inicioMin - b.inicioMin);
}

// ─── Motor principal ──────────────────────────────────────────────────────────

interface GerarCPPParams {
  configuracao: ConfiguracaoServico;
  municipios: typeof MUNICIPIOS_V33;
}

export function gerarCPP({ configuracao, municipios }: GerarCPPParams): {
  blocos: BlocoHorario[];
  avisos: string[];
} {
  const municipiosList: Municipio[] = configuracao.municipios && configuracao.municipios.length > 0
    ? configuracao.municipios
    : (configuracao.municipio ? [configuracao.municipio] : []);
  if (municipiosList.length === 0) return { blocos: [], avisos: [] };

  const numMuns = municipiosList.length;
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

  // Cálculo de deslocamentos
  const deslEntre = numMuns - 1;
  const deslInicial = (municipiosList[0] !== "Valparaíso") ? 1 : 0;
  const totalDESL = (deslEntre + deslInicial) * 30;

  // Refeições: 12h (>= 600 min) -> 2 refeições, 8h (< 600 min) -> 1 refeição
  let numRefeicoes = duracaoTurno >= 600 ? 2 : 1;
  let miolo = duracaoTurno - 30 - 30 - numRefeicoes * 60 - totalDESL;
  const avisos: string[] = [];

  if (miolo < numMuns * 30 && numRefeicoes > 1) {
    numRefeicoes = 1;
    miolo = duracaoTurno - 30 - 30 - numRefeicoes * 60 - totalDESL;
    avisos.push(`Turno curto para ${numMuns} municípios — refeições/segmentos reduzidos`);
  }
  if (miolo < numMuns * 30 && numRefeicoes > 0) {
    numRefeicoes = 0;
    miolo = duracaoTurno - 30 - 30 - numRefeicoes * 60 - totalDESL;
    avisos.push(`Turno curto para ${numMuns} municípios — refeições/segmentos reduzidos`);
  }
  if (miolo < numMuns * 30) {
    miolo = numMuns * 30;
  }

  const alvosRef = numRefeicoes === 2
    ? [snapGrid30(turnoInicio + duracaoTurno * 0.33), snapGrid30(turnoInicio + duracaoTurno * 0.66)]
    : (numRefeicoes === 1 ? [snapGrid30(turnoInicio + duracaoTurno * 0.40)] : []);

  // Distribuição do miolo entre os segmentos (multiplos de 30 min)
  const duracoesSegmento = Array(numMuns).fill(snapGrid30(miolo / numMuns));
  let somaSegmentos = duracoesSegmento.reduce((s, v) => s + v, 0);
  let idxSoma = 0;
  while (somaSegmentos < miolo) {
    duracoesSegmento[idxSoma % numMuns] += 30;
    somaSegmentos += 30;
    idxSoma++;
  }
  while (somaSegmentos > miolo) {
    duracoesSegmento[idxSoma % numMuns] -= 30;
    somaSegmentos -= 30;
    idxSoma++;
  }

  const blocos: BlocoHorario[] = [];
  let ordem = 0;
  let tempoAtual = turnoInicio;

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
      "Base do Pelotão PM",
      "Assunção do serviço",
      JUSTIFICATIVAS.PREL,
      "Valparaíso"
    )
  );
  tempoAtual += 30;
  historico.push("PREL");

  // ── DESL Inicial ───────────────────────────────────────────────────────────
  if (deslInicial === 1) {
    const primMun = municipiosList[0];
    blocos.push(
      criarBloco(
        ordem++,
        tempoAtual,
        30,
        "DESL",
        `Deslocamento para ${primMun}`,
        "Deslocamento ao setor",
        "Deslocamento ao setor de policiamento.",
        primMun
      )
    );
    tempoAtual += 30;
    historico.push("DESL");
  }

  // Blocos manuais pré-analisados
  const manuais =
    configuracao.modalidadeGeracao === "manual" &&
    configuracao.blocosManuais.trim()
      ? parseBlocosManuais(configuracao.blocosManuais)
      : [];
  const temRefManual = manuais.some(m => m.modalidade === "REF");
  let idxManual = 0;

  // ── Miolo Segmentado por Município ─────────────────────────────────────────
  for (let i = 0; i < numMuns; i++) {
    const currentMunName = municipiosList[i];
    const currentMunData = municipios[currentMunName];
    if (!currentMunData) continue;

    let patrolBudget = duracoesSegmento[i];

    while (patrolBudget > 0 && tempoAtual < fimREL) {
      const disponivel = fimREL - tempoAtual;
      if (disponivel < 30) break;

      // Bloco manual prioritário para este horário
      if (idxManual < manuais.length) {
        const bm = manuais[idxManual];
        if (bm.inicioMin < tempoAtual) {
          avisos.push(
            `Bloco "${bm.desc || bm.modalidade}" às ${String(Math.floor(bm.inicioMin / 60)).padStart(2, "0")}:${String(bm.inicioMin % 60).padStart(2, "0")} ignorado por sobreposição.`
          );
          idxManual++;
          continue;
        }
        if (bm.inicioMin === tempoAtual) {
          const dur = bm.fimMin
            ? Math.max(30, snapGrid30(bm.fimMin - bm.inicioMin))
            : 30;
          const proxMin = manuais[idxManual + 1]?.inicioMin ?? fimREL;
          const durSafe = Math.min(dur, disponivel, proxMin - tempoAtual);
          const local = selecionarLocal(currentMunData, bm.modalidade, coberturas[currentMunName], rng);
          const periodo = calcularPeriodo(tempoAtual);
          blocos.push(
            criarBloco(
              ordem++,
              tempoAtual,
              durSafe,
              bm.modalidade,
              local,
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

      // REF no ponto alvo — apenas se não há REF manual e se o espaço restante comporta a refeição
      if (
        !temRefManual &&
        proximoRefIdx < alvosRef.length &&
        tempoAtual >= alvosRef[proximoRefIdx] &&
        disponivel >= 90
      ) {
        blocos.push(
          criarBloco(
            ordem++,
            tempoAtual,
            60,
            "REF",
            "Base do Pelotão PM",
            "Refeição",
            JUSTIFICATIVAS.REF,
            "Valparaíso"
          )
        );
        tempoAtual += 60;
        proximoRefIdx++;
        historico.push("REF");
        continue;
      }

      // Seleção de modalidade com pesos
      const periodo = calcularPeriodo(tempoAtual);
      const usaRural =
        configuracao.tipoPoliciamento === "Rural" ||
        configuracao.tipoPoliciamento === "Foco Rural" ||
        currentMunData.perfil === "rural_pequeno";
      const perfil: string = numMuns > 1
        ? currentMunData.perfil
        : (usaRural ? "rural_pequeno" : currentMunData.perfil);

      let pesos: Pesos = {
        ...(MATRIZ_PESOS[perfil]?.[periodo] ?? { PREV: 3, PE: 2, FISC: 1 }),
      };

      // Ajuste de pesos pelo Foco de Policiamento
      pesos = ajustarPesosPorFoco(pesos, configuracao.tipoPoliciamento, perfil, periodo);

      // Sazonalidade: SAT com peso dinâmico de evento/saturação na data
      const pesoSat = pesoSatNaData(currentMunData.eventos, configuracao.data);
      if (pesoSat > 0) pesos.SAT = (pesos.SAT ?? 0) + pesoSat;

      // Força ESC em dia útil manhã/tarde (urbano) — só se ainda não está nos últimos 2
      if (
        diaUtil &&
        (periodo === "manha" || periodo === "tarde") &&
        perfil === "urbano_medio" &&
        !historico.slice(-2).includes("ESC")
      ) {
        pesos.ESC = (pesos.ESC ?? 0) + 3;
      }

      // Ajuste de pesos por categoria doutrinária
      const categoria = CATEGORIA_ATIVIDADE[configuracao.tipoAtividade] ?? "PATRULHA";
      pesos = ajustarPesosPorCategoria(pesos, categoria);

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

      const modalidade = selecionarModalidade(pesos, rng, fallback);

      // Nunca ultrapassa o início do próximo bloco manual ou o orçamento de patrulha
      const proxManualInicio =
        idxManual < manuais.length ? manuais[idxManual].inicioMin : fimREL;
      const disponivelReal = Math.min(disponivel, proxManualInicio - tempoAtual, patrolBudget);

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
        const alt: ModalidadePoliciamento = pesos.PE ? "PE" : "FISC";
        const durAlt = Math.min(30, disponivelReal);
        if (durAlt >= 30) {
          blocos.push(
            criarBloco(
              ordem++,
              tempoAtual,
              durAlt,
              alt,
              selecionarLocal(currentMunData, alt, coberturas[currentMunName], rng),
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

      const local = selecionarLocal(currentMunData, modalidade, coberturas[currentMunName], rng);
      blocos.push(
        criarBloco(
          ordem++,
          tempoAtual,
          dur,
          modalidade,
          local,
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
      "Base do Pelotão PM",
      "Elaboração do RSO",
      JUSTIFICATIVAS.REL,
      "Valparaíso"
    )
  );

  return { blocos, avisos };
}
