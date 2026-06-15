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
} from "./types";
import { MODALIDADES, MUNICIPIOS, JUSTIFICATIVAS, MODUS_OPERANDI_DEFAULT } from "./constants";

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

export function calcularHoraTermino(horaInicio: string): string {
  return minParaHora(horaParaMin(horaInicio) + 480);
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
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
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
    manha:    { POST: 3, PREV: 2, PE: 3, ESC: 3, FISC: 1 },
    tarde:    { POST: 2, PREV: 2, PE: 2, ESC: 4, FISC: 1 },
    noite:    { FISC: 4, PE: 3, PREV: 2, POST: 1 },
    madrugada:{ FISC: 4, PREV: 3, PE: 2 },
  },
  rural_pequeno: {
    manha:    { RURAL: 5, PE: 2, FISC: 1 },
    tarde:    { RURAL: 4, PE: 2, FISC: 1, PREV: 1 },
    noite:    { RURAL: 3, FISC: 4, PE: 1 },
    madrugada:{ RURAL: 5, FISC: 2 },
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
      candidatos = municipio.bairros.map((b) => `Entorno de escola — ${b}`);
      break;
    case "SAT":
      candidatos = [...municipio.comercio, ...municipio.bairros];
      break;
    default:
      return "Base do Pelotão PM";
  }

  if (candidatos.length === 0) return "Área do município";

  const minVisitas = Math.min(...candidatos.map((c) => cobertura.get(c) ?? 0));
  const menosVisitados = candidatos.filter(
    (c) => (cobertura.get(c) ?? 0) === minVisitas
  );
  const escolhido = pick(menosVisitados, Math.floor(rng() * menosVisitados.length), candidatos[0]);
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
  justificativa: string
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
  };
}

// ─── Parser de blocos manuais ─────────────────────────────────────────────────

function inferirModalidade(texto: string): ModalidadePoliciamento {
  const t = texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
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
    .map((l) => l.trim())
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
  municipios: typeof MUNICIPIOS;
}

export function gerarCPP({ configuracao, municipios }: GerarCPPParams): { blocos: BlocoHorario[]; avisos: string[] } {
  const municipio = municipios[configuracao.municipio];
  if (!municipio) return { blocos: [], avisos: [] };

  // RNG com seed: mesma config → mesmo roteiro; outra data/hora/município → outro
  const rng = mulberry32(
    hashStr(`${configuracao.data}|${configuracao.municipio}|${configuracao.horaInicio}`)
  );

  const diaUtil = ehDiaUtil(configuracao.data);
  const mesData = parseDataLocal(configuracao.data).getMonth() + 1;
  const temEvento = municipio.eventos.some((e) => e.mes === mesData);

  const usaRural =
    configuracao.tipoPoliciamento === "Rural" ||
    municipio.perfil === "rural_pequeno";
  const foraDeValparaiso = configuracao.municipio !== "Valparaíso";

  // Grade de 30 min: snap o início e calcular fim = início + 8h
  const turnoInicio = snapGrid30(horaParaMin(configuracao.horaInicio));
  const turnoFim = turnoInicio + 480;
  const fimREL = turnoFim - 30;          // REL ocupa os últimos 30 min
  const refAlvo = snapGrid30(turnoInicio + 192); // ~40% de 480 min

  const blocos: BlocoHorario[] = [];
  const avisos: string[] = [];
  let ordem = 0;
  let tempoAtual = turnoInicio;
  const cobertura: CoberturaMapa = new Map();
  let refInserida = false;
  const historico: ModalidadePoliciamento[] = [];

  // ── PREL ───────────────────────────────────────────────────────────────────
  blocos.push(criarBloco(
    ordem++, tempoAtual, 30, "PREL",
    "Base do Pelotão PM", "Assunção do serviço", JUSTIFICATIVAS.PREL
  ));
  tempoAtual += 30;
  historico.push("PREL");

  // ── DESL (se fora de Valparaíso) ───────────────────────────────────────────
  if (foraDeValparaiso) {
    blocos.push(criarBloco(
      ordem++, tempoAtual, 30, "DESL",
      `Deslocamento para ${configuracao.municipio}`,
      "Deslocamento ao setor", "Deslocamento ao setor de policiamento."
    ));
    tempoAtual += 30;
    historico.push("DESL");
  }

  // Blocos manuais pré-analisados
  const manuais =
    configuracao.modalidadeGeracao === "manual" && configuracao.blocosManuais.trim()
      ? parseBlocosManuais(configuracao.blocosManuais)
      : [];
  const temRefManual = manuais.some((m) => m.modalidade === "REF");
  let idxManual = 0;

  // ── Miolo ──────────────────────────────────────────────────────────────────
  while (tempoAtual < fimREL) {
    const disponivel = fimREL - tempoAtual;
    if (disponivel < 30) break;

    // Bloco manual prioritário para este horário
    if (idxManual < manuais.length) {
      const bm = manuais[idxManual];
      // Avança se o bloco manual já passou
      if (bm.inicioMin < tempoAtual) {
        avisos.push(`Bloco "${bm.desc || bm.modalidade}" às ${String(Math.floor(bm.inicioMin / 60)).padStart(2, "0")}:${String(bm.inicioMin % 60).padStart(2, "0")} ignorado por sobreposição.`);
        idxManual++;
        continue;
      }
      // Encaixa bloco manual
      if (bm.inicioMin === tempoAtual) {
        const dur = bm.fimMin
          ? Math.max(30, snapGrid30(bm.fimMin - bm.inicioMin))
          : 30;
        const proxMin = manuais[idxManual + 1]?.inicioMin ?? fimREL;
        const durSafe = Math.min(dur, disponivel, proxMin - tempoAtual);
        const local = selecionarLocal(municipio, bm.modalidade, cobertura, rng);
        const periodo = calcularPeriodo(tempoAtual);
        blocos.push(criarBloco(
          ordem++, tempoAtual, durSafe, bm.modalidade, local,
          selecionarProblema(bm.modalidade, periodo),
          JUSTIFICATIVAS[bm.modalidade] || "Atividade de policiamento."
        ));
        tempoAtual += durSafe;
        historico.push(bm.modalidade);
        if (bm.modalidade === "REF") refInserida = true;
        idxManual++;
        continue;
      }
    }

    // REF no ponto alvo (40% do turno) — apenas uma vez, e só se não há REF manual
    if (!refInserida && !temRefManual && tempoAtual >= refAlvo && disponivel >= 90) {
      blocos.push(criarBloco(
        ordem++, tempoAtual, 60, "REF",
        "Base do Pelotão PM", "Refeição", JUSTIFICATIVAS.REF
      ));
      tempoAtual += 60;
      refInserida = true;
      historico.push("REF");
      continue;
    }

    // Seleção de modalidade com pesos
    const periodo = calcularPeriodo(tempoAtual);
    const perfil: string = usaRural ? "rural_pequeno" : municipio.perfil;
    const pesos: Pesos = { ...MATRIZ_PESOS[perfil]?.[periodo] ?? { PREV: 3, PE: 2, FISC: 1 } };

    // Sazonalidade: SAT com peso alto em mês de evento
    if (temEvento) pesos.SAT = (pesos.SAT ?? 0) + 5;

    // Força ESC em dia útil manhã/tarde (urbano) — só se ainda não está nos últimos 2
    if (
      diaUtil &&
      (periodo === "manha" || periodo === "tarde") &&
      perfil === "urbano_medio" &&
      !historico.slice(-2).includes("ESC")
    ) {
      pesos.ESC = (pesos.ESC ?? 0) + 3;
    }

    // Fallback = modalidade de maior peso antes do anti-repetição
    const fallback = (
      Object.entries(pesos) as [ModalidadePoliciamento, number][]
    ).reduce<[ModalidadePoliciamento, number]>(
      (best, [m, w]) => (w > best[1] ? [m, w] : best),
      ["PREV", 0]
    )[0];

    // Anti-repetição: zera peso das 2 últimas modalidades reais
    for (const m of historico.slice(-2).filter(
      (m) => m !== "PREL" && m !== "DESL" && m !== "REF"
    )) {
      delete (pesos as Record<string, number>)[m];
    }

    const modalidade = selecionarModalidade(pesos, rng, fallback);

    // Nunca ultrapassa o início do próximo bloco manual
    const proxManualInicio =
      idxManual < manuais.length ? manuais[idxManual].inicioMin : fimREL;
    const disponivelReal = Math.min(disponivel, proxManualInicio - tempoAtual);

    // Duração: PE e ESC = 30 min; RURAL = 60-90; demais = 30-60
    let dur: number;
    if (modalidade === "PE" || modalidade === "ESC") {
      dur = 30;
    } else if (modalidade === "RURAL") {
      dur = disponivelReal >= 120 ? (rng() > 0.5 ? 90 : 60) : 60;
    } else {
      dur = disponivelReal >= 90 ? (rng() > 0.6 ? 60 : 30) : 30;
    }

    // Nunca ultrapassa fimREL nem próximo bloco manual
    dur = Math.min(dur, disponivelReal);

    // RURAL que não cabe (gap < 60 min): substitui por PE ou FISC de 30 min
    if (modalidade === "RURAL" && dur < 60) {
      const alt: ModalidadePoliciamento = pesos.PE ? "PE" : "FISC";
      blocos.push(criarBloco(
        ordem++, tempoAtual, 30, alt,
        selecionarLocal(municipio, alt, cobertura, rng),
        selecionarProblema(alt, periodo),
        JUSTIFICATIVAS[alt] || "Atividade de policiamento."
      ));
      tempoAtual += 30;
      historico.push(alt);
      continue;
    }

    if (dur < 30) break;

    const local = selecionarLocal(municipio, modalidade, cobertura, rng);
    blocos.push(criarBloco(
      ordem++, tempoAtual, dur, modalidade, local,
      selecionarProblema(modalidade, periodo),
      JUSTIFICATIVAS[modalidade] || "Atividade de policiamento."
    ));
    tempoAtual += dur;
    historico.push(modalidade);
  }

  // ── REL ────────────────────────────────────────────────────────────────────
  blocos.push(criarBloco(
    ordem++, fimREL, 30, "REL",
    "Base do Pelotão PM", "Elaboração do RSO", JUSTIFICATIVAS.REL
  ));

  return { blocos, avisos };
}
