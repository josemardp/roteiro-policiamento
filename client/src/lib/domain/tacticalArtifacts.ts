import type { Modalidade, Prioridade } from "./directivePayload";

export interface Coordenada {
  lat: number;
  lng: number;
}

export interface CorredorOperacional {
  id: string;
  nome: string;
  origem: Coordenada;
  destino: Coordenada;
  raioMetros: number;
  prioridade: Prioridade;
}

export interface ObjetivoPersistente {
  id: string;
  localId: string; // ID do ponto no PPI ou ponto temporário
  inicio: string;  // "HH:MM"
  fim: string;     // "HH:MM"
  permanenciaMinimaMinutos: number; // Ex: 120 (4 blocos contíguos de 30m)
  modalidade: Modalidade;
}
