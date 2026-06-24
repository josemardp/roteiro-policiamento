import type { ModalidadePoliciamento, FocoDistribuicao as FocoBase } from "../types";
import type { MissionTimeline } from "./missionTimeline";
import type { CorredorOperacional, ObjetivoPersistente } from "./tacticalArtifacts";

export type Modalidade = ModalidadePoliciamento;

export type Prioridade = "BAIXA" | "MEDIA" | "ALTA" | "CRITICA";

export type TipoAlvoGeografico =
  | "PONTO_EXISTENTE"
  | "AREA"
  | "CATEGORIA"
  | "ROTA"
  | "PONTO_TEMPORARIO";

export interface GeoTarget {
  id?: string; // id do ponto no PPI se for PONTO_EXISTENTE
  tipo: TipoAlvoGeografico;
  textoOriginal: string;
  municipio?: string;
  categorias?: string[];
  coordenadas?: {
    lat: number;
    lng: number;
  };
  raioMetros?: number;
  idsPPI?: string[];
  confiancaMatch: number; // 0 a 1. Se < 0.75, exige verificação humana
}

export interface ModificadorModalidade {
  modalidade: Modalidade;
  multiplicadorPeso: number;
  prioridade: Prioridade;
  alvos: GeoTarget[];
  minimoVisitas?: number;
  maximoVisitas?: number;
}

// Extensão do FocoDistribuicao legado para a V23
export interface FocoDistribuicao extends FocoBase {
  origem: "USUARIO" | "PPI" | "ORDEM_SERVICO";
  timeline?: MissionTimeline;
  objetivosPersistentes?: ObjetivoPersistente[];
  corredoresOperacionais?: CorredorOperacional[];
}

export interface DirectivePayload {
  versaoSchema: "1.1";
  hashConteudo?: string; // Cache do hash, opcional
  focosDiretivas: FocoDistribuicao[];
  criadoEmISO: string;
  observacoes?: string[];
}

// ─── Helpers de Hashing Canônico ──────────────────────────────────────────────

function canonicalStringify(obj: any): string {
  if (obj === null || obj === undefined) return "null";
  if (typeof obj !== "object") return String(obj);
  if (Array.isArray(obj)) {
    return "[" + obj.map(canonicalStringify).join(",") + "]";
  }
  const sortedKeys = Object.keys(obj).sort();
  const pairs = sortedKeys.map(k => `"${k}":${canonicalStringify(obj[k])}`);
  return "{" + pairs.join(",") + "}";
}

function hashStr(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * Calcula o hash canônico determinístico de um DirectivePayload
 */
export function calcularHashPayload(payload: DirectivePayload): string {
  // Ignora o campo hashConteudo existente para evitar auto-referência circular
  const cleanPayload = {
    ...payload,
    hashConteudo: undefined,
  };
  const canonicalJson = canonicalStringify(cleanPayload);
  const hashValue = hashStr(canonicalJson);
  return hashValue.toString(16).padStart(8, "0");
}
