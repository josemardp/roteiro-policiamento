/**
 * Tipos para o sistema de Roteiro de Policiamento (CPP)
 * Design: Operacional Moderno — Legibilidade Tática
 */

// Nota de Design: Existe uma colisão de siglas. No contexto do sistema,
// CPP = Cartão de Prioridade de Patrulhamento.
// No contexto prisional/operacional local (como o CPP Valparaíso),
// CPP = Centro de Progressão Penitenciária (unidade prisional).
export type TipoAtividade =
  // Ordinário — turno de 12h
  | "Radiopatrulha (RP)"
  | "CGP"
  | "CFP"
  // Supervisão — turno de 8h
  | "Supervisor Regional"
  // Jornada extraordinária DELEGADA — turno de 8h
  | "Atividade Delegada"
  | "Comando Delegada"
  | "CGP Delegada"
  // Jornada extraordinária DEJEM — turno de 8h
  | "DEJEM"
  | "Comando DEJEM"
  | "CGP DEJEM";
export type Municipio =
  | "Valparaíso"
  | "Guararapes"
  | "Rubiácea"
  | "Bento de Abreu";
export type TipoPoliciamento =
  | "Misto (Urbano e Rural)"
  | "Urbano"
  | "Rural"
  | "Foco Urbano"
  | "Foco Rural"
  | "Foco Escolar"
  | "Foco Fiscalização"
  | "Foco Evento";

export interface FocoDistribuicao {
  id: string; // Para React key
  tipo: TipoPoliciamento;
  percentual?: number; // Opcional, o motor preenche se faltar
  posicao: "Começo" | "Meio" | "Fim" | "Automático";
}

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
  municipio?: Municipio;
  lat?: number | null;
  lng?: number | null;
}

export interface ConfiguracaoServico {
  tipoAtividade: TipoAtividade;
  municipio?: Municipio; // Mantido como opcional para retrocompatibilidade direta
  municipios: Municipio[];
  tipoPoliciamento: TipoPoliciamento; // Mantido para UI simples e fallback
  focos?: FocoDistribuicao[]; // Modo avançado: distribuição dinâmica
  data: string; // YYYY-MM-DD
  horaInicio: string; // HH:MM
  horaTermino: string; // HH:MM (calculado)
  modalidadeGeracao: "automatica" | "manual";
  blocosManuais: string; // Texto livre do usuário (parser tolerante)
  efetivo: string; // Informativo
  viatura: string; // Informativo
  prefixoUS: string; // Informativo
  nomeEvento?: string;
  tipoEvento?: string;
  localEvento?: string;
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
  eventos: Array<{
    nome: string;
    inicio?: string; // MM-DD ou YYYY-MM-DD
    fim?: string;    // MM-DD ou YYYY-MM-DD
    mes?: number;    // retrocompatibilidade (1-12)
    pesoSAT?: number;
    diasSemana?: Array<"dom" | "seg" | "ter" | "qua" | "qui" | "sex" | "sab">;
  }>;
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
