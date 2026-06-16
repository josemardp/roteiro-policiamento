import type { Municipio } from "../types";

export type Periodo = "manha" | "tarde" | "noite" | "madrugada";
export type ModalidadeValida =
  | "POST"
  | "PREV"
  | "PE"
  | "FISC"
  | "ESC"
  | "RURAL"
  | "SAT"; // só estas em recomendações

export interface Hotspot {
  local: string;
  endereco: string; // ou "[DADO_NÃO_ENCONTRADO]"
  bairro: string;
  crimePrincipal: string;
  periodosCriticos: Periodo[];
  horaInicioCritico: number | null; // 0-23 ou null se desconhecido
  horaFimCritico: number | null; // 0-23 ou null
  diasCriticos: string[]; // [] se desconhecido
  frequenciaAnual: number | null; // null se não houver dado — NUNCA chutar
  modalidadesRecomendadas: ModalidadeValida[];
  risco: "Alto" | "Médio" | "Baixo";
  fonte: string; // "comando_5cia" quando vier do comando
  confianca: "verificado" | "estimado" | "a_validar_comando";
  lat?: number | null;
  lng?: number | null;
}

export interface Escola {
  nome: string;
  endereco: string; // ou "[DADO_NÃO_ENCONTRADO]"
  bairro: string;
  tipo: "Estadual" | "Municipal" | "Privada";
  turnoEntrada: string | null; // "HH:MM" ou null
  turnoSaida: string | null;
  turnoEntradaTarde: string | null;
  turnoSaidaTarde: string | null;
  dependencia?: "Federal" | "Estadual" | "Municipal" | "Privada";
  etapas?: Array<
    "Creche" | "Pre-escola" | "Fundamental" | "Medio" | "EJA" | "Tecnico"
  >;
  lat?: number | null;
  lng?: number | null;
}

interface Local {
  nome: string;
  endereco: string;
  telefone: string;
}

export interface SinistralidadeTransito {
  periodoReferencia: string; // ex.: "2025-06 a 2026-05"
  totalComVitima: number | null;
  totalSemVitima: number | null;
  totalFatais: number | null;
  veiculoMaisEnvolvido:
    | "automovel"
    | "motocicleta"
    | "pedestre"
    | "bicicleta"
    | "caminhao"
    | null;
  tiposViaCriticos: string[]; // ex.: ["SP-300 km 318-322", "Vicinal RB-001"]
  horariosCriticos: number[]; // horas 0-23 de pico de sinistros
  diasCriticos: string[]; // ex.: ["sexta","sabado"]
  observacao: string;
  fonte: string; // "Infosiga-SP"
  confianca: "oficial" | "estimado" | "a_validar_comando";
  fonteUrl: string | null;
}

export interface FrotaMunicipio {
  total: number | null;
  automoveis: number | null;
  motocicletas: number | null;
  caminhoes: number | null;
  percentualMotos: number | null; // motocicletas / total
  dataReferencia: string; // "YYYY-MM"
  fonte: string;
  confianca: "oficial" | "estimado" | "a_validar_comando";
  fonteUrl: string | null;
}

export interface UnidadeSaude {
  nome: string;
  tipo:
    | "Hospital"
    | "SantaCasa"
    | "UPA"
    | "UBS"
    | "ProntoSocorro"
    | "CAPS"
    | "Outro";
  endereco: string; // ou "[DADO_NÃO_ENCONTRADO]"
  telefone: string; // ou "[DADO_NÃO_ENCONTRADO]"
  funciona24h: boolean | null;
  fonte: string;
  lat?: number | null;
  lng?: number | null;
}

export interface InstituicaoFinanceira {
  tipo: "Agencia" | "PostoBancario" | "Loterica" | "ATM24h" | "Correspondente";
  nome: string;
  banco: string;
  endereco: string; // ou "[DADO_NÃO_ENCONTRADO]"
  alvoExplosaoCaixa: boolean; // true para agências/ATM isolados de madrugada
  fonte: string;
  lat?: number | null;
  lng?: number | null;
}

export interface RuralDetalhe {
  totalPropriedades: number | null; // contagem agregada (Censo Agro/CAR)
  clustersAcesso: string[]; // vicinais que servem aglomerados de propriedades
  producaoPrincipal: string[]; // ex.: ["cana","pasto"]
  alvosFurtoRural: string[]; // tipos: defensivos, semoventes, fios de cobre, combustível, implementos
  fonte: string;
}

export interface PontoAglomeracao {
  nome: string; // "Terminal Rodoviário", "Feira Livre Centro", "Recinto de Rodeio"
  tipo: "Terminal" | "FeiraLivre" | "Recinto" | "Praca" | "Outro";
  endereco: string;
  diasHorarios: string; // "Quarta e sábado 06:00-13:00" ou "[DADO_NÃO_ENCONTRADO]"
  fonte: string;
  lat?: number | null;
  lng?: number | null;
}

export interface PontoEconomico {
  nome: string;
  tipo: "EixoComercial" | "Supermercado" | "Posto" | "Farmacia" | "Mercado" | "Feira" | "Industria" | "Outro";
  endereco: string;
  bairro: string;
  lat: number | null;
  lng: number | null;
  fonte: string;
  fonteUrl: string | null;
}

export interface EntidadeSocial {
  nome: string;
  tipo: "CRAS" | "CREAS" | "ConselhoTutelar" | "AssociacaoBairro" | "Igreja" | "ONG" | "ProjetoSocial" | "CentroJuventude" | "Outro";
  endereco: string;
  bairro: string;
  lat: number | null;
  lng: number | null;
  publicoAlvo: string;          // ex.: "crianças e adolescentes", "mulheres", "idosos"
  relevanciaPrevencao: string;  // como conecta à prevenção primária / parceria PM
  fonte: string;
  fonteUrl: string | null;
}

export interface PerfilCriminal {
  anoMovel: string;                 // ex.: "2024-01 a 2024-12"
  homicidioDoloso: number | null;
  rouboOutros: number | null;
  furtoOutros: number | null;
  furtoVeiculo: number | null;
  rouboVeiculo: number | null;
  // Foco comunitário / naturezas adicionais
  violenciaDomestica: number | null;
  lesaoCorporalDolosa: number | null;
  trafico: number | null;
  perturbacaoSossego: number | null;
  danoVandalismo: number | null;
  embriaguezVolante: number | null;
  // indicador dominante calculado a partir dos números reais
  indicadorDominante: "letalidade" | "roubo" | "furto" | "furto_veiculo" | "roubo_veiculo" | "rural" | null;
  tendencia: "alta" | "estavel" | "queda" | null;
  confianca: "oficial" | "estimado" | "a_validar_comando";
  fonte: string;                    // Descrição da fonte
  fonteUrl: string | null;          // URL real verificável
}

export interface DadosPPI {
  aisp: string[]; // AISP/Subáreas do município (unidade doutrinária do CPP)
  hotspots: Hotspot[];
  escolas: Escola[];
  infraestruturaCritica: {
    delegacia: Local | null;
    upa: Local | null;
    bombeiros: Local | null;
  };
  policiaComunitaria: {
    programas: Array<{
      nome: string;
      ativo: boolean | null;
      fonte: string;
      fonteUrl: string | null;
    }>;
  };
  metadata: {
    versao: "3.3";
    dataLevantamento: string; // YYYY-MM-DD
    responsavel: string;
    fontes: string[];
    statusValidacao: "pendente" | "parcial" | "validado";
    camposNaoEncontrados: string[]; // caminho de cada placeholder
  };
  // Campos complementares opcionais
  perfilCriminal?: PerfilCriminal;
  transito?: SinistralidadeTransito;
  frota?: FrotaMunicipio;
  saude?: UnidadeSaude[];
  instituicoesFinanceiras?: InstituicaoFinanceira[];
  ruralDetalhe?: RuralDetalhe;
  pontosAglomeracao?: PontoAglomeracao[];
  pontosEconomicos?: PontoEconomico[];
  entidadesSociais?: EntidadeSocial[];
  unidadesPrisionais?: Array<{
    nome: string;
    tipo: string;
    endereco: string;
    lat?: number | null;
    lng?: number | null;
  }> | null;
}
