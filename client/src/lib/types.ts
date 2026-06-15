/**
 * Tipos para o sistema de Roteiro de Policiamento (CPP)
 * Design: Operacional Moderno — Legibilidade Tática
 */

export type TipoAtividade = "Atividade Delegada" | "DEJEM";
export type Municipio = "Valparaíso" | "Guararapes" | "Rubiácea" | "Bento de Abreu";
export type TipoPoliciamento = "Urbano" | "Rural";
export type ModalidadePoliciamento =
  | "PREL" // Preleção / Assunção
  | "DESL" // Deslocamento
  | "POST" // Patrulhamento Ostensivo
  | "PREV" // Patrulhamento Preventivo
  | "PE" // Ponto de Estacionamento
  | "FISC" // Fiscalização
  | "ESC" // Ronda Escolar
  | "RURAL" // Policiamento Rural
  | "SAT" // Saturação Preventiva
  | "REF" // Refeição
  | "REL"; // Relatório / Encerramento

export interface BlocoHorario {
  id: string;
  horaInicio: string; // HH:MM
  horaFim: string; // HH:MM
  modalidade: ModalidadePoliciamento;
  local: string;
  problemaSolucionar: string;
  modusOperandi: string;
  acoesPolicia: string;
  justificativa: string;
  observacao: string;
  concluido: boolean;
  ordem: number; // Para reordenação
}

export interface ConfiguracaoServico {
  tipoAtividade: TipoAtividade;
  municipio: Municipio;
  tipoPoliciamento: TipoPoliciamento;
  data: string; // YYYY-MM-DD
  horaInicio: string; // HH:MM
  horaTermino: string; // HH:MM (calculado)
  modalidadeGeracao: "automatica" | "manual";
  blocosManuais: string; // Texto livre do usuário (parser tolerante)
  efetivo: string; // Informativo
  viatura: string; // Informativo
  prefixoUS: string; // Informativo
}

export interface RoteiroDia {
  id: string;
  configuracao: ConfiguracaoServico;
  blocos: BlocoHorario[];
  dataCriacao: string; // ISO timestamp
  dataAtualizacao: string; // ISO timestamp
  percentualConcluido: number; // 0-100
}

export type MunicipioData = {
  perfil: "urbano_medio" | "rural_pequeno";
  tipoPadrao: TipoPoliciamento;
  rodovias: string[];
  comercio: string[];
  bairros: string[];
  pontosPE: string[];
  pontosFisc: string[];
  rural: string[];
  eventos: Array<{ nome: string; mes: number }>;
  obs: string;
};

export type Municipios = Record<Municipio, MunicipioData>;

export type ModalidadeInfo = {
  codigo: ModalidadePoliciamento;
  nome: string;
  duracao: [number, number]; // [min, max] em minutos
  cor: string; // CSS class
  badge: string; // badge-* class
  acoesPadrao: string; // ações de polícia padrão
  descricaoRSO: string; // texto para o relatório RSO
};

export interface AppState {
  roteiroDia: RoteiroDia | null;
  historico: RoteiroDia[];
  municipios: Municipios;
}
