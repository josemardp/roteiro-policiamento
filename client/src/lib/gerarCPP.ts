/**
 * Motor de Geração de CPP (Cartão de Prioridade de Patrulhamento)
 * Regras determinísticas baseadas em NORSOP e doutrina operacional PMESP
 * Design: Operacional Moderno — Determinístico, Auditável, Sem IA
 */

import type {
  BlocoHorario,
  ConfiguracaoServico,
  ModalidadePoliciamento,
  Municipio,
} from "./types";
import { MODALIDADES, MUNICIPIOS, JUSTIFICATIVAS, MODUS_OPERANDI_DEFAULT } from "./constants";

interface GerarCPPParams {
  configuracao: ConfiguracaoServico;
  municipios: typeof MUNICIPIOS;
}

/**
 * Calcula o período do dia baseado na hora
 */
function calcularPeriodo(hora: number): "manha" | "tarde" | "noite" | "madrugada" {
  if (hora >= 6 && hora < 12) return "manha";
  if (hora >= 12 && hora < 18) return "tarde";
  if (hora >= 18 && hora < 24) return "noite";
  return "madrugada"; // 00:00 a 06:00
}

/**
 * Verifica se é dia útil
 */
function ehDiaUtil(data: string): boolean {
  const date = new Date(data);
  const diaSemana = date.getDay();
  return diaSemana !== 0 && diaSemana !== 6; // 0=domingo, 6=sábado
}

/**
 * Calcula hora de término (+8h)
 */
export function calcularHoraTermino(horaInicio: string): string {
  const [h, m] = horaInicio.split(":").map(Number);
  let horaFim = h + 8;
  let minutoFim = m;

  if (horaFim >= 24) {
    horaFim -= 24;
  }

  return `${String(horaFim).padStart(2, "0")}:${String(minutoFim).padStart(2, "0")}`;
}

/**
 * Converte string de hora para minutos desde meia-noite
 */
function horaParaMinutos(hora: string): number {
  const [h, m] = hora.split(":").map(Number);
  return h * 60 + m;
}

/**
 * Converte minutos desde meia-noite para string HH:MM
 */
function minutosParaHora(minutos: number): string {
  let h = Math.floor(minutos / 60);
  const m = minutos % 60;
  if (h >= 24) h -= 24;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * Gera UUID simples (v4-like)
 */
function uuidv4(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Gera blocos horários para o turno
 */
export function gerarCPP(params: GerarCPPParams): BlocoHorario[] {
  const { configuracao, municipios } = params;
  const blocos: BlocoHorario[] = [];

  const horaInicioMin = horaParaMinutos(configuracao.horaInicio);
  const horaFimMin = horaParaMinutos(configuracao.horaTermino);

  const municipio = municipios[configuracao.municipio];
  const diaUtil = ehDiaUtil(configuracao.data);

  let tempoAtual = horaInicioMin;
  let ordem = 0;
  let refeicaoInserida = false;
  let modalidadeAnterior: ModalidadePoliciamento | null = null;
  let indiceBairro = 0;

  // Calcular pontos de interesse para refeição
  const duracao8h = 8 * 60; // 480 minutos
  const tempoRefeicaoMin = horaInicioMin + Math.floor(duracao8h * 0.4); // 40% do turno
  const tempoRefeicaoMax = horaInicioMin + Math.floor(duracao8h * 0.6); // 60% do turno
  const tempoREL = horaInicioMin + duracao8h - 30; // 30 min antes do fim

  // 1. PRELEÇÃO (sempre primeiro, 30 min)
  blocos.push(criarBloco(
    ordem++,
    tempoAtual,
    30,
    "PREL",
    "Base do Pelotão PM",
    "Assunção do serviço",
    JUSTIFICATIVAS.PREL
  ));
  tempoAtual += 30;
  modalidadeAnterior = "PREL";

  // 2. DESLOCAMENTO (se necessário, 20 min)
  if (configuracao.municipio !== "Valparaíso") {
    blocos.push(criarBloco(
      ordem++,
      tempoAtual,
      20,
      "DESL",
      `Deslocamento para ${configuracao.municipio}`,
      "Deslocamento ao setor",
      "Deslocamento ao setor de policiamento."
    ));
    tempoAtual += 20;
    modalidadeAnterior = "DESL";
  }

  // 3. Preencher o miolo com alternância de móvel e fixo
  while (tempoAtual < tempoREL) {
    // Inserir refeição no terço médio (60 min)
    if (
      !refeicaoInserida &&
      tempoAtual >= tempoRefeicaoMin &&
      tempoAtual < tempoRefeicaoMax &&
      tempoREL - tempoAtual > 90
    ) {
      blocos.push(criarBloco(
        ordem++,
        tempoAtual,
        60,
        "REF",
        "Base do Pelotão PM",
        "Refeição",
        JUSTIFICATIVAS.REF
      ));
      tempoAtual += 60;
      refeicaoInserida = true;
      modalidadeAnterior = "REF";
      continue;
    }

    // Verificar se há tempo suficiente
    if (tempoREL - tempoAtual <= 30) break;

    // Calcular hora atual para determinar período
    const horaAtual = Math.floor((tempoAtual % (24 * 60)) / 60);
    const periodo = calcularPeriodo(horaAtual);

    // Selecionar próxima modalidade
    const modalidade = selecionarProximaModalidade(
      configuracao,
      municipio,
      periodo,
      modalidadeAnterior,
      diaUtil
    );

    // Calcular duração
    const [minDur, maxDur] = MODALIDADES[modalidade]?.duracao || [60, 90];
    const tempoDisponivel = tempoREL - tempoAtual;
    const duracaoBloco = Math.min(maxDur, Math.max(minDur, tempoDisponivel - 30));

    if (duracaoBloco < minDur) break;

    // Selecionar local
    const local = selecionarLocal(
      configuracao,
      municipio,
      modalidade,
      indiceBairro++
    );

    // Selecionar problema
    const problema = selecionarProblema(modalidade, periodo, local);

    blocos.push(criarBloco(
      ordem++,
      tempoAtual,
      duracaoBloco,
      modalidade,
      local,
      problema,
      JUSTIFICATIVAS[modalidade] || "Atividade de policiamento."
    ));

    tempoAtual += duracaoBloco;
    modalidadeAnterior = modalidade;
  }

  // 4. RELATÓRIO (sempre último, 30 min)
  blocos.push(criarBloco(
    ordem++,
    tempoREL,
    30,
    "REL",
    "Base do Pelotão PM",
    "Elaboração do RSO",
    JUSTIFICATIVAS.REL
  ));

  return blocos;
}

/**
 * Cria um bloco horário
 */
function criarBloco(
  ordem: number,
  horaInicioMin: number,
  duracao: number,
  modalidade: ModalidadePoliciamento,
  local: string,
  problema: string,
  justificativa: string
): BlocoHorario {
  const horaFimMin = horaInicioMin + duracao;
  return {
    id: uuidv4(),
    horaInicio: minutosParaHora(horaInicioMin),
    horaFim: minutosParaHora(horaFimMin),
    modalidade,
    local,
    problemaSolucionar: problema,
    modusOperandi: MODUS_OPERANDI_DEFAULT,
    acoesPolicia: selecionarAcoesPolicia(modalidade),
    justificativa,
    observacao: "",
    concluido: false,
    ordem,
  };
}

/**
 * Seleciona a próxima modalidade (alternância móvel/fixo)
 */
function selecionarProximaModalidade(
  configuracao: ConfiguracaoServico,
  municipio: typeof MUNICIPIOS[Municipio],
  periodo: string,
  modalidadeAnterior: ModalidadePoliciamento | null,
  diaUtil: boolean
): ModalidadePoliciamento {
  // Priorizar FISC à noite em saídas
  if (periodo === "noite") {
    return "FISC";
  }

  // Ronda escolar em dia útil, horários de entrada/saída
  if (diaUtil && municipio.perfil === "urbano_medio") {
    return "ESC";
  }

  // Alternar móvel e fixo
  const ehMovel =
    modalidadeAnterior === null ||
    modalidadeAnterior === "PREL" ||
    modalidadeAnterior === "DESL" ||
    modalidadeAnterior === "REF" ||
    ["PE", "FISC", "SAT"].includes(modalidadeAnterior);

  if (ehMovel) {
    // Selecionar modalidade móvel
    if (configuracao.tipoPoliciamento === "Rural" || municipio.perfil === "rural_pequeno") {
      return "RURAL";
    }
    if (periodo === "manha" || periodo === "tarde") {
      return "POST";
    }
    return "PREV";
  } else {
    // Selecionar modalidade fixa
    if (periodo === "noite" || periodo === "madrugada") {
      return "FISC";
    }
    return "PE";
  }
}

/**
 * Seleciona local baseado na modalidade e rotação
 */
function selecionarLocal(
  configuracao: ConfiguracaoServico,
  municipio: typeof MUNICIPIOS[Municipio],
  modalidade: ModalidadePoliciamento,
  indice: number
): string {
  switch (modalidade) {
    case "POST":
      return municipio.comercio[indice % municipio.comercio.length];
    case "PREV":
      return municipio.bairros[indice % municipio.bairros.length];
    case "PE":
      return municipio.pontosPE[indice % municipio.pontosPE.length];
    case "FISC":
      return municipio.pontosFisc[indice % municipio.pontosFisc.length];
    case "RURAL":
      return municipio.rural[indice % municipio.rural.length];
    case "ESC":
      return `Entorno de escola — ${municipio.bairros[indice % municipio.bairros.length]}`;
    default:
      return "Base do Pelotão PM";
  }
}

/**
 * Seleciona problema a solucionar baseado na modalidade e período
 */
function selecionarProblema(
  modalidade: ModalidadePoliciamento,
  periodo: string,
  local: string
): string {
  switch (modalidade) {
    case "POST":
      return "Roubo/furto a comércio; furto/roubo de veículo";
    case "PREV":
      if (periodo === "noite" || periodo === "madrugada") {
        return "Furto/roubo a residência";
      }
      return "Prevenção de delitos em bairros";
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

/**
 * Seleciona ações de polícia baseado na modalidade
 */
function selecionarAcoesPolicia(modalidade: ModalidadePoliciamento): string {
  switch (modalidade) {
    case "POST":
    case "PREV":
      return "Patrulhamento, Abordagem";
    case "PE":
      return "Permanência, Abordagem";
    case "FISC":
      return "Abordagem, Fiscalização de trânsito";
    case "ESC":
      return "Patrulhamento, Orientação";
    case "RURAL":
      return "Patrulhamento, Abordagem, ronda em propriedades";
    case "SAT":
      return "Saturação, Abordagem";
    default:
      return "Patrulhamento";
  }
}
