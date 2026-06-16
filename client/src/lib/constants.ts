/**
 * Constantes para o sistema de Roteiro de Policiamento (CPP)
 * Baseado na NORSOP e doutrina operacional PMESP
 */

import type { ModalidadeInfo, Municipios, TipoAtividade } from "./types";

export const DURACAO_TURNO_MIN: Record<TipoAtividade, number> = {
  "Radiopatrulha (RP)": 720,
  "CGP": 720,
  "CFP": 720,
  "Supervisor Regional": 480,
  "Atividade Delegada": 480,
  "Comando Delegada": 480,
  "CGP Delegada": 480,
  "DEJEM": 480,
  "Comando DEJEM": 480,
  "CGP DEJEM": 480,
};

export type CategoriaAtividade = "PATRULHA" | "CGP" | "COMANDO" | "SUPERVISAO";
export const CATEGORIA_ATIVIDADE: Record<TipoAtividade, CategoriaAtividade> = {
  "Radiopatrulha (RP)": "PATRULHA",
  "Atividade Delegada": "PATRULHA",
  "DEJEM": "PATRULHA",
  "CGP": "CGP",
  "CGP Delegada": "CGP",
  "CGP DEJEM": "CGP",
  "CFP": "COMANDO",
  "Comando Delegada": "COMANDO",
  "Comando DEJEM": "COMANDO",
  "Supervisor Regional": "SUPERVISAO",
};

export const MODALIDADES: Record<string, ModalidadeInfo> = {
  PREL: {
    codigo: "PREL",
    nome: "Preleção / Assunção do serviço",
    duracao: [30, 30],
    cor: "bg-slate-600",
    badge: "badge-prel",
    acoesPadrao: "Assunção do serviço",
    descricaoRSO: "PRELEÇÃO E ASSUNÇÃO DO SERVIÇO PELA BASE DO PELOTÃO PM",
  },
  DESL: {
    codigo: "DESL",
    nome: "Deslocamento ao setor",
    duracao: [30, 30],
    cor: "bg-gray-500",
    badge: "badge-prel",
    acoesPadrao: "Deslocamento",
    descricaoRSO: "DESLOCAMENTO AO SETOR",
  },
  POST: {
    codigo: "POST",
    nome: "Patrulhamento ostensivo — comércio/centro",
    duracao: [30, 60],
    cor: "bg-blue-600",
    badge: "badge-post",
    acoesPadrao: "Patrulhamento, Abordagem",
    descricaoRSO: "PATRULHAMENTO OSTENSIVO",
  },
  PREV: {
    codigo: "PREV",
    nome: "Patrulhamento preventivo — bairros",
    duracao: [30, 60],
    cor: "bg-blue-800",
    badge: "badge-prev",
    acoesPadrao: "Patrulhamento, Abordagem",
    descricaoRSO: "PATRULHAMENTO PREVENTIVO",
  },
  PE: {
    codigo: "PE",
    nome: "Ponto de Estacionamento / Visibilidade",
    duracao: [30, 30],
    cor: "bg-teal-600",
    badge: "badge-pe",
    acoesPadrao: "Permanência, Abordagem",
    descricaoRSO: "PONTO DE ESTACIONAMENTO/VISIBILIDADE",
  },
  FISC: {
    codigo: "FISC",
    nome: "Ponto de Estacionamento na saída — fiscalização",
    duracao: [30, 60],
    cor: "bg-red-700",
    badge: "badge-fisc",
    acoesPadrao: "Abordagem, Fiscalização de trânsito",
    descricaoRSO: "PONTO DE ESTACIONAMENTO E FISCALIZAÇÃO DE VEÍCULOS",
  },
  ESC: {
    codigo: "ESC",
    nome: "Ronda Escolar",
    duracao: [30, 30],
    cor: "bg-purple-600",
    badge: "badge-esc",
    acoesPadrao: "Patrulhamento, Orientação",
    descricaoRSO: "RONDA ESCOLAR",
  },
  RURAL: {
    codigo: "RURAL",
    nome: "Policiamento Rural — propriedades",
    duracao: [60, 90],
    cor: "bg-amber-700",
    badge: "badge-rural",
    acoesPadrao: "Patrulhamento, Abordagem, ronda em propriedades",
    descricaoRSO: "POLICIAMENTO RURAL",
  },
  SAT: {
    codigo: "SAT",
    nome: "Saturação Preventiva (evento/sazonal)",
    duracao: [30, 60],
    cor: "bg-orange-600",
    badge: "badge-sat",
    acoesPadrao: "Saturação, Abordagem",
    descricaoRSO: "SATURAÇÃO PREVENTIVA",
  },
  REF: {
    codigo: "REF",
    nome: "Refeição",
    duracao: [60, 60],
    cor: "bg-amber-500",
    badge: "badge-ref",
    acoesPadrao: "Refeição",
    descricaoRSO: "ALIMENTAÇÃO PELA BASE DO PELOTÃO PM",
  },
  REL: {
    codigo: "REL",
    nome: "Relatório / Encerramento (RSO)",
    duracao: [30, 30],
    cor: "bg-gray-600",
    badge: "badge-rel",
    acoesPadrao: "Elaboração do RSO",
    descricaoRSO: "BASE DO PELOTÃO PARA ELABORAÇÃO DO RSO",
  },
};

import { MUNICIPIOS_V33 } from "./municipios/municipios-index";
export { MUNICIPIOS_V33 };

export const JUSTIFICATIVAS: Record<string, string> = {
  PREL: "Assunção do serviço, leitura de novidades e orientação da guarnição (US).",
  POST: "Presença ostensiva no comércio/centro no horário de maior fluxo — dissuasão de roubo/furto.",
  PREV: "Patrulhamento preventivo em bairro residencial — coibir furto/roubo a residência.",
  PE: "Ponto de Estacionamento desembarcado, ver e ser visto, atento ao rádio e high light ligado — presença ostensiva e pronta-resposta (Anexo D, 1.1.3 e 4.3).",
  FISC: "PE na saída/rodovia — abordagem e fiscalização de veículos, coibir evasão na rota de fuga; identificar vias de desvio (Anexo D, 4.14.5).",
  ESC: "Ronda Escolar no horário de entrada/saída de alunos — proteção do entorno escolar (Programa de Policiamento Escolar).",
  RURAL:
    "Policiamento ostensivo geral rural — ronda em propriedades (mínimo 4); coibir furto em zona rural.",
  SAT: "Saturação preventiva em razão de evento/sazonalidade/data de relevância (Glossário NORSOP).",
  REF: "Refeição da guarnição (base do Pelotão PM).",
  REL: "Retorno à base, confecção do RSO e encerramento da atividade (Anexo D, 1.1.12).",
};

export const NOTA_SUPERVISAO =
  "A guarnição somente poderá sair das AISP/rotas estipuladas para atendimento de ocorrência ou mediante autorização do CFP (Ten) ou CGP (Subten/Sgt). Pessoas abordadas e veículos vistoriados devem ser lançados no RSO.";

export const MODUS_OPERANDI_DEFAULT = "Utilização de armas e ameaças";
