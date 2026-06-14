/**
 * Constantes para o sistema de Roteiro de Policiamento (CPP)
 * Baseado na NORSOP e doutrina operacional PMESP
 */

import type { ModalidadeInfo, Municipios } from "./types";

export const MODALIDADES: Record<string, ModalidadeInfo> = {
  PREL: {
    codigo: "PREL",
    nome: "Preleção / Assunção do serviço",
    duracao: [30, 30],
    cor: "bg-slate-600",
    badge: "badge-prel",
  },
  DESL: {
    codigo: "DESL",
    nome: "Deslocamento ao setor",
    duracao: [15, 20],
    cor: "bg-gray-500",
    badge: "badge-prel",
  },
  POST: {
    codigo: "POST",
    nome: "Patrulhamento ostensivo — comércio/centro",
    duracao: [60, 90],
    cor: "bg-blue-600",
    badge: "badge-post",
  },
  PREV: {
    codigo: "PREV",
    nome: "Patrulhamento preventivo — bairros",
    duracao: [60, 90],
    cor: "bg-blue-800",
    badge: "badge-prev",
  },
  PE: {
    codigo: "PE",
    nome: "Ponto de Estacionamento / Visibilidade",
    duracao: [30, 45],
    cor: "bg-teal-600",
    badge: "badge-pe",
  },
  FISC: {
    codigo: "FISC",
    nome: "Ponto de Estacionamento na saída — fiscalização",
    duracao: [60, 90],
    cor: "bg-red-700",
    badge: "badge-fisc",
  },
  ESC: {
    codigo: "ESC",
    nome: "Ronda Escolar",
    duracao: [30, 45],
    cor: "bg-purple-600",
    badge: "badge-esc",
  },
  RURAL: {
    codigo: "RURAL",
    nome: "Policiamento Rural — propriedades",
    duracao: [90, 120],
    cor: "bg-amber-700",
    badge: "badge-rural",
  },
  SAT: {
    codigo: "SAT",
    nome: "Saturação Preventiva (evento/sazonal)",
    duracao: [60, 90],
    cor: "bg-orange-600",
    badge: "badge-sat",
  },
  REF: {
    codigo: "REF",
    nome: "Refeição",
    duracao: [60, 60],
    cor: "bg-amber-500",
    badge: "badge-ref",
  },
  REL: {
    codigo: "REL",
    nome: "Relatório / Encerramento (RSO)",
    duracao: [30, 30],
    cor: "bg-gray-600",
    badge: "badge-rel",
  },
};

export const MUNICIPIOS: Municipios = {
  Valparaíso: {
    perfil: "urbano_medio",
    tipoPadrao: "Urbano",
    rodovias: ["SP-300 (Marechal Rondon)", "Saídas do município"],
    comercio: ["Centro", "Área comercial central"],
    bairros: [
      "Jardim Primavera",
      "Jardim Flamboyant",
      "Jardim Morumbi",
      "Jardim Cristal",
      "Conj. Hab. Agrovila",
      "Conj. Hab. Rezende Nery",
      "Conj. Hab. Santana",
      "Conj. Hab. Valdivino de Souza Pacheco",
      "Conj. Hab. Valparaíso C",
      "Conj. Hab. Bela Vista",
      "Santa Casa",
      "Riviera",
      "Lambari",
      "Valdivino",
      "Ecoville",
    ],
    pontosPE: ["Centro (agências bancárias)", "Praça central", "Lotérica"],
    pontosFisc: [
      "Saída do município sentido SP-300",
      "Acessos principais",
    ],
    rural: [
      "AISP I rural",
      "AISP II rural",
      "AISP III rural",
      "Estrada da Usina da Mata",
      "Madalena",
      "Divisa",
      "Vila Messias",
      "Aguapeí",
      "Nova Serrinha",
      "Sergipe",
    ],
    eventos: [],
    obs: "Município mais detalhado; usar as 4 AISPs para rotação.",
  },
  Guararapes: {
    perfil: "urbano_medio",
    tipoPadrao: "Urbano",
    rodovias: [
      "SP-300 (Marechal Rondon) — corta a cidade",
      "Av. Marechal Floriano",
      "Av. Marechal Rondon",
    ],
    comercio: ["Centro (traçado em xadrez)", "Eixos comerciais centrais"],
    bairros: [
      "Centro",
      "Região Norte",
      "Região Sul",
      "Região Leste",
      "Região Oeste",
    ],
    pontosPE: [
      "Centro (agências bancárias)",
      "Lotérica",
      "Entorno de polos industriais (JBS, Usina Unialco, curtume)",
    ],
    pontosFisc: ["Trevos/saídas da SP-300", "Entradas da cidade"],
    rural: ["Ribeiro do Vale"],
    eventos: [{ nome: "FAPIG (Feira Agropecuária)", mes: 11 }],
    obs: "Cidade mais urbana e populosa; explorar malha em xadrez e SP-300.",
  },
  Rubiácea: {
    perfil: "rural_pequeno",
    tipoPadrao: "Rural",
    rodovias: [
      "Vicinais de acesso (Guararapes/Bilac)",
      "Região entre rio Aguapeí e Tietê",
    ],
    comercio: ["Centro (pequeno)"],
    bairros: ["Caramuru (ex-distrito)"],
    pontosPE: ["Praça central", "Igreja matriz"],
    pontosFisc: ["Entrada da cidade", "Vicinais"],
    rural: [
      "Propriedades rurais",
      "Estradas vicinais",
      "Zona rural extensa",
    ],
    eventos: [],
    obs: "Essencialmente rural; priorizar policiamento rural e fiscalização em vicinais.",
  },
  "Bento de Abreu": {
    perfil: "rural_pequeno",
    tipoPadrao: "Rural",
    rodovias: ["Acessos vicinais", "Bacia do rio Aguapeí"],
    comercio: ["Centro (pequeno)"],
    bairros: [],
    pontosPE: ["Praça central", "Igreja matriz"],
    pontosFisc: ["Entrada da cidade", "Vicinais"],
    rural: ["Propriedades rurais", "Zona rural extensa"],
    eventos: [],
    obs: "O menor e mais rural; roteiro simples com peso em rural e visibilidade.",
  },
};

export const PROBLEMAS_SOLUCIONAR: Record<string, string> = {
  "Comércio/Centro (diurno)":
    "Roubo/furto a comércio; furto/roubo de veículo",
  "Bairro residencial (noite/madrugada)": "Furto/roubo a residência",
  "Saída/rodovia (FISC)":
    "Furto/roubo de veículo; evasão de autores; infrações de trânsito",
  "Ponto de Estacionamento (PE)":
    "Sensação de segurança; dissuasão de delitos no entorno",
  "Ronda Escolar (ESC)":
    "Proteção do entorno escolar; uso/tráfico de drogas; lesão",
  "Rural (RURAL)":
    "Furto em propriedade rural (defensivos, semoventes, fios, implementos)",
  "Saturação (SAT)":
    "Prevenção em evento/data de relevância (ex.: feira, evento de grande público)",
};

export const ACOES_POLICIA: Record<string, string> = {
  "Comércio/Centro": "Patrulhamento, Abordagem",
  "Bairro residencial": "Patrulhamento, Abordagem",
  "Saída/rodovia": "Abordagem, Fiscalização de trânsito",
  "Ponto de Estacionamento": "Permanência, Abordagem",
  "Ronda Escolar": "Patrulhamento, Orientação",
  Rural: "Patrulhamento, Abordagem, ronda em propriedades",
  Saturação: "Saturação, Abordagem",
};

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
