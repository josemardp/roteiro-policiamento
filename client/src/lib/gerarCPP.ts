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

export interface RefeicaoPlanejada {
  tipo: TipoRefeicao;
  alvoMin: number;
  duracaoMin: number;
}

function clockMinAbsoluto(clockMin: number, depoisDeMin: number): number {
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
  duracaoTurno: number
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
  ppiMun
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
}): string {
  if (modalidade === "ESC") {
    const minutoDia = tempoAtual % 1440;
    const escolasAtivas = diaUtil ? obterEscolasEmJanela(escolasMun, minutoDia) : [];
    if (escolasAtivas.length > 0) {
      const candidatos = escolasAtivas.map(e => `Ronda escolar — ${e.nome} (${e.bairro})`);
      const minVisitas = Math.min(...candidatos.map((c: string) => cobertura.get(c) ?? 0));
      const menosVisitados = candidatos.filter((c: string) => (cobertura.get(c) ?? 0) === minVisitas);
      const escolhido = pick(menosVisitados, Math.floor(rng() * menosVisitados.length), candidatos[0]);
      cobertura.set(escolhido, (cobertura.get(escolhido) ?? 0) + 1);
      return escolhido;
    }
  }

  if (modalidade === "FISC" && ppiMun?.transito) {
    const horaAtual = Math.floor((tempoAtual % 1440) / 60);
    const transito = ppiMun.transito;
    if (transito.horariosCriticos?.includes(horaAtual) && transito.tiposViaCriticos?.length > 0) {
      const candidatos = transito.tiposViaCriticos;
      const minVisitas = Math.min(...candidatos.map((c: string) => cobertura.get(c) ?? 0));
      const menosVisitados = candidatos.filter((c: string) => (cobertura.get(c) ?? 0) === minVisitas);
      const escolhido = pick(menosVisitados, Math.floor(rng() * menosVisitados.length), candidatos[0]);
      cobertura.set(escolhido, (cobertura.get(escolhido) ?? 0) + 1);
      return escolhido;
    }
  }

  if (hotspotsAtivosMun.length > 0) {
    const hsRecomendados = hotspotsAtivosMun.filter(h => h.modalidadesRecomendadas.includes(modalidade as any));
    if (hsRecomendados.length > 0) {
      const candidatos = hsRecomendados.map(h => `${h.local} (${h.bairro})`);
      const minVisitas = Math.min(...candidatos.map((c: string) => cobertura.get(c) ?? 0));
      const menosVisitados = candidatos.filter((c: string) => (cobertura.get(c) ?? 0) === minVisitas);
      const escolhido = pick(menosVisitados, Math.floor(rng() * menosVisitados.length), candidatos[0]);
      cobertura.set(escolhido, (cobertura.get(escolhido) ?? 0) + 1);
      return escolhido;
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
            escolhido = pick(
              menosVisitadosVulneraveis,
              Math.floor(rng() * menosVisitadosVulneraveis.length),
              menosVisitadosVulneraveis[0]
            );
          } else {
            escolhido = pick(
              menosVisitados,
              Math.floor(rng() * menosVisitados.length),
              candidatos[0]
            );
          }
          cobertura.set(escolhido, (cobertura.get(escolhido) ?? 0) + 1);
          return obterLocalEventos(configuracao, focoAtivo, modalidade, escolhido);
        }
      }
    }
  }

  const localPadrao = selecionarLocal(currentMunData, modalidade, cobertura, rng);
  return obterLocalEventos(configuracao, focoAtivo, modalidade, localPadrao);
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
          if (normLocal.includes(normName) || normName.includes(normLocal)) {
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

  // 2. Sem sigla explícita — inferência por palavras-chave; localManual = desc completo
  const norm = t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  let modalidade: ModalidadePoliciamento;
  if (/prel|assuncao|assun/.test(norm)) modalidade = "PREL";
  else if (/desl/.test(norm)) modalidade = "DESL";
  else if (/ref|janta|almoco|cafe|refeic|aliment/.test(norm)) modalidade = "REF";
  else if (/\brel\b|rso|encer|relator/.test(norm)) modalidade = "REL";
  else if (/rural/.test(norm)) modalidade = "RURAL";
  else if (/\bsat\b|saturac/.test(norm)) modalidade = "SAT";
  else if (/escol/.test(norm) && !/escolt/.test(norm)) modalidade = "ESC";
  else if (/fisc|blitz|bloqueio/.test(norm)) modalidade = "FISC";
  else if (/\bpe\b|estacion/.test(norm)) modalidade = "PE";
  else if (/prev|bairr/.test(norm)) modalidade = "PREV";
  else modalidade = "POST";

  return { modalidade, localManual: t };
}

interface BlocoManualParsed {
  inicioMin: number;
  fimMin: number | null;
  modalidade: ModalidadePoliciamento;
  desc: string;
  localManual: string;
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
      const desc = comFim[5].trim();
      const { modalidade, localManual } = analisarDescricaoManual(desc);
      result.push({
        inicioMin: snapGrid30(inicioMin),
        fimMin: snapGrid30(fimMin),
        modalidade,
        desc,
        localManual,
      });
      continue;
    }

    const semFim = linha.match(/(\d{1,2})[h:](\d{0,2})\s+(.*)/i);
    if (semFim) {
      const inicioMin = parseInt(semFim[1]) * 60 + parseInt(semFim[2] || "0");
      const desc = semFim[3].trim();
      const { modalidade, localManual } = analisarDescricaoManual(desc);
      result.push({
        inicioMin: snapGrid30(inicioMin),
        fimMin: null,
        modalidade,
        desc,
        localManual,
      });
    }
  }

  return result.sort((a, b) => a.inicioMin - b.inicioMin);
}

// ─── Preview puro dos blocos manuais (sem chamar gerarCPP) ───────────────────

export type PreviewBlocoManual = {
  linha: number;
  textoOriginal: string;
  horaInicio?: string;
  horaFim?: string;
  modalidade?: string;
  local?: string;
  status: "ok" | "aviso" | "erro";
  mensagem?: string;
};

export function analisarBlocosManuaisPreview(
  texto: string,
  horaInicioTurno: string
): PreviewBlocoManual[] {
  const linhasRaw = texto.split("\n");
  const [hh, mm] = horaInicioTurno.split(":").map(Number);
  const turnoInicioMin = hh * 60 + mm;
  const prelFimMin = turnoInicioMin + 30;
  const prelFimHora = minParaHora(prelFimMin);
  const turnoInicioHora = minParaHora(turnoInicioMin);
  const result: PreviewBlocoManual[] = [];

  linhasRaw.forEach((linhaRaw, idx) => {
    const linha = linhaRaw.trim();
    if (!linha) return;

    // Linha com horário de início e fim
    const comFim = linha.match(
      /(\d{1,2})[h:](\d{0,2})\s*(?:a\b|as\b|at[eé]\b|às\b|-)\s*(\d{1,2})[h:](\d{0,2})\s+(.*)/i
    );
    if (comFim) {
      const inicioMin = parseInt(comFim[1]) * 60 + parseInt(comFim[2] || "0");
      const fimMin = parseInt(comFim[3]) * 60 + parseInt(comFim[4] || "0");
      const desc = comFim[5].trim();
      const { modalidade, localManual } = analisarDescricaoManual(desc);
      const isPrelOverlap = inicioMin >= turnoInicioMin && inicioMin < prelFimMin;
      const semLocal = !localManual.trim();
      result.push({
        linha: idx + 1,
        textoOriginal: linha,
        horaInicio: minParaHora(snapGrid30(inicioMin)),
        horaFim: minParaHora(snapGrid30(fimMin)),
        modalidade,
        local: localManual || undefined,
        status: isPrelOverlap || semLocal ? "aviso" : "ok",
        mensagem: isPrelOverlap
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
      const inicioMin = parseInt(semFim[1]) * 60 + parseInt(semFim[2] || "0");
      const desc = semFim[3].trim();
      const { modalidade, localManual } = analisarDescricaoManual(desc);
      const isPrelOverlap = inicioMin >= turnoInicioMin && inicioMin < prelFimMin;
      const semLocal = !localManual.trim();
      result.push({
        linha: idx + 1,
        textoOriginal: linha,
        horaInicio: minParaHora(snapGrid30(inicioMin)),
        modalidade,
        local: localManual || undefined,
        status: isPrelOverlap || semLocal ? "aviso" : "ok",
        mensagem: isPrelOverlap
          ? `PREL obrigatória ocupa ${turnoInicioHora}–${prelFimHora}. Use ${prelFimHora} para o 1º bloco.`
          : semLocal
            ? "Informe um local/descrição."
            : undefined,
      });
      return;
    }

    // Sem horário reconhecível
    result.push({
      linha: idx + 1,
      textoOriginal: linha,
      status: "erro",
      mensagem: "Informe o horário no início da linha (ex: 07h30 PE Banco do Brasil).",
    });
  });

  return result;
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
      ? parseBlocosManuais(configuracao.blocosManuais)
      : [];
  const temRefManual = manuais.some(m => m.modalidade === "REF");
  const refeicoesPlanejadas = temRefManual
    ? []
    : planejarRefeicoes(turnoInicio, turnoFim, duracaoTurno);

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
      if (idxManual < manuais.length) {
        const bm = manuais[idxManual];
        if (bm.inicioMin < tempoAtual) {
          const isPrelOverlap = bm.inicioMin >= turnoInicio && bm.inicioMin < turnoInicio + 30;
          if (isPrelOverlap) {
            avisos.push(
              `Bloco manual "${bm.desc || bm.modalidade}" às ${minParaHora(bm.inicioMin)} foi ignorado: o turno inicia com PREL obrigatória (${minParaHora(turnoInicio)}–${minParaHora(turnoInicio + 30)}). Lance o primeiro bloco manual a partir de ${minParaHora(turnoInicio + 30)}.`
            );
          } else {
            avisos.push(
              `Bloco "${bm.desc || bm.modalidade}" às ${minParaHora(bm.inicioMin)} ignorado por sobreposição.`
            );
          }
          idxManual++;
          continue;
        }
        if (bm.inicioMin === tempoAtual) {
          const dur = bm.fimMin
            ? Math.max(30, snapGrid30(bm.fimMin - bm.inicioMin))
            : 30;
          const proxMin = manuais[idxManual + 1]?.inicioMin ?? fimREL;
          const durSafe = Math.min(dur, disponivel, proxMin - tempoAtual);
          // Usar local informado pelo usuário; só recorrer ao automático se vazio
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

      // Hotspots Dirigidos (Fase 3)
      const RISCO_VALOR = { Alto: 5, Médio: 3, Baixo: 2 };
      for (const h of hotspotsAtivosMun) {
        const valorRisco = RISCO_VALOR[h.risco] ?? 2;
        const boostPorMod = valorRisco / h.modalidadesRecomendadas.length;
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

      // Ronda Escolar (ESC) não ocorre em fim de semana (Fase 0)
      if (!diaUtil) {
        delete pesos.ESC;
      }

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

      // Nunca ultrapassa o próximo bloco manual, a próxima REF ou o orçamento de patrulha
      const proxManualInicio =
        idxManual < manuais.length ? manuais[idxManual].inicioMin : fimREL;
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
        const alt: ModalidadePoliciamento = pesos.PE ? "PE" : "FISC";
        const durAlt = Math.min(30, disponivelReal);
        if (durAlt >= 30) {
          const localReal = determinarLocalFinal({
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
            ppiMun
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

      const localReal = determinarLocalFinal({
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
        ppiMun
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

  return { blocos, avisos };
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
