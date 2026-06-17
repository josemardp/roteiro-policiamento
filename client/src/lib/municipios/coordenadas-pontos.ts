import type { Municipio } from "../types";

export type CoordenadaPonto = {
  lat: number;
  lng: number;
  fonte: string;
};

export function normalizarChavePonto(valor: string): string {
  return valor
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function chaveCoordenadaPonto(municipio: Municipio, ponto: string): string {
  return `${normalizarChavePonto(municipio)}|${normalizarChavePonto(ponto)}`;
}

export const COORDENADAS_REFERENCIA_MUNICIPIO: Record<Municipio, CoordenadaPonto> = {
  "Valparaíso": {
    lat: -21.2272,
    lng: -50.866,
    fonte: "Cadastro existente do app: Base do Pelotao PM em Valparaiso",
  },
  Guararapes: {
    lat: -21.2542739,
    lng: -50.6440083,
    fonte: "Nominatim/OSM: Guararapes, Sao Paulo, Brasil",
  },
  "Rubiácea": {
    lat: -21.2996334,
    lng: -50.7298698,
    fonte: "Nominatim/OSM: Rubiacea, Sao Paulo, Brasil",
  },
  "Bento de Abreu": {
    lat: -21.2715723,
    lng: -50.8117225,
    fonte: "Nominatim/OSM: Bento de Abreu, Sao Paulo, Brasil",
  },
};

// Coordenadas aceitas somente quando o Nominatim/OSM retornou ponto ou via
// plausivel dentro do municipio informado. Pontos genericos ou ambiguos ficam null.
export const COORDENADAS_PONTOS: Record<string, CoordenadaPonto> = {
  [chaveCoordenadaPonto("Guararapes", "Av. Rio Branco (eixo comercial central)")]: {
    lat: -21.2616981,
    lng: -50.6468503,
    fonte: "Nominatim/OSM: Avenida Rio Branco, Guararapes, Sao Paulo, Brasil",
  },
  [chaveCoordenadaPonto("Guararapes", "Av. Marechal Floriano (eixo comercial central)")]: {
    lat: -21.2558419,
    lng: -50.6382621,
    fonte: "Nominatim/OSM: Avenida Marechal Floriano, Guararapes, Sao Paulo, Brasil",
  },
  [chaveCoordenadaPonto("Guararapes", "Praça Nossa Senhora da Conceição (Centro)")]: {
    lat: -21.2542111,
    lng: -50.6439953,
    fonte: "Nominatim/OSM: Praca Nossa Senhora da Conceicao, Guararapes, Sao Paulo, Brasil",
  },
  [chaveCoordenadaPonto("Guararapes", "Banco do Brasil (Praça Nossa Senhora da Conceição, 308)")]: {
    lat: -21.2549467,
    lng: -50.6443255,
    fonte: "Nominatim/OSM: Banco do Brasil, Praca Nossa Senhora da Conceicao, Guararapes, Sao Paulo, Brasil",
  },
  [chaveCoordenadaPonto("Guararapes", "Bradesco (Rua Marechal Deodoro, 1021)")]: {
    lat: -21.2566996,
    lng: -50.6394254,
    fonte: "Nominatim/OSM: Rua Marechal Deodoro da Fonseca, Guararapes, Sao Paulo, Brasil",
  },
  [chaveCoordenadaPonto("Guararapes", "Caixa Econômica Federal (Av. Marechal Floriano, 675)")]: {
    lat: -21.2548136,
    lng: -50.6413524,
    fonte: "Nominatim/OSM: Caixa Economica Federal, Rua Dom Pedro I, Guararapes, Sao Paulo, Brasil",
  },
  [chaveCoordenadaPonto("Guararapes", "Santa Casa de Guararapes (Av. Marechal Floriano, 1602)")]: {
    lat: -21.2558419,
    lng: -50.6382621,
    fonte: "Nominatim/OSM: Avenida Marechal Floriano, Guararapes, Sao Paulo, Brasil",
  },
  [chaveCoordenadaPonto("Valparaíso", "Av. Nove de Julho (centro comercial)")]: {
    lat: -21.2235424,
    lng: -50.8716019,
    fonte: "Nominatim/OSM: Avenida Nove de Julho, Valparaiso, Sao Paulo, Brasil",
  },
  [chaveCoordenadaPonto("Valparaíso", "Rua Bartolomeu Bueno (zona comercial central)")]: {
    lat: -21.2312985,
    lng: -50.8620339,
    fonte: "Nominatim/OSM: Rua Bartolomeu Bueno, Valparaiso, Sao Paulo, Brasil",
  },
  [chaveCoordenadaPonto("Valparaíso", "Centro (zona comercial de comércio geral)")]: {
    lat: -21.2235249,
    lng: -50.8669227,
    fonte: "Nominatim/OSM: Praca Oscar de Arruda, Valparaiso, Sao Paulo, Brasil",
  },
  [chaveCoordenadaPonto("Valparaíso", "Centro")]: {
    lat: -21.2235249,
    lng: -50.8669227,
    fonte: "Nominatim/OSM: Praca Oscar de Arruda, Valparaiso, Sao Paulo, Brasil",
  },
  [chaveCoordenadaPonto("Valparaíso", "Santa Casa")]: {
    lat: -21.2306549,
    lng: -50.8611954,
    fonte: "Nominatim/OSM: Santa Casa de Misericordia de Valparaiso, Valparaiso, Sao Paulo, Brasil",
  },
  [chaveCoordenadaPonto("Valparaíso", "Ecoville")]: {
    lat: -21.215926,
    lng: -50.8787781,
    fonte: "Nominatim/OSM: Condominio Ecoville II, Valparaiso, Sao Paulo, Brasil",
  },
  [chaveCoordenadaPonto("Valparaíso", "Praça Oscar de Arruda (Praça Central)")]: {
    lat: -21.2235249,
    lng: -50.8669227,
    fonte: "Nominatim/OSM: Praca Oscar de Arruda, Valparaiso, Sao Paulo, Brasil",
  },
  [chaveCoordenadaPonto("Valparaíso", "Banco do Brasil (Rua Quinze de Novembro, 70)")]: {
    lat: -21.2228676,
    lng: -50.8664846,
    fonte: "Nominatim/OSM: Banco do Brasil, Valparaiso, Sao Paulo, Brasil",
  },
  [chaveCoordenadaPonto("Valparaíso", "Bradesco (Rua Quinze de Novembro, 41)")]: {
    lat: -21.2318599,
    lng: -50.8675977,
    fonte: "Nominatim/OSM: Rua Quinze de Novembro, Valparaiso, Sao Paulo, Brasil",
  },
  [chaveCoordenadaPonto("Valparaíso", "Santander (Avenida Nove de Julho, 580)")]: {
    lat: -21.2235424,
    lng: -50.8716019,
    fonte: "Nominatim/OSM: Avenida Nove de Julho, Valparaiso, Sao Paulo, Brasil",
  },
  [chaveCoordenadaPonto("Valparaíso", "Caixa Econômica Federal (Rua Quinze de Novembro, s/n)")]: {
    lat: -21.2318599,
    lng: -50.8675977,
    fonte: "Nominatim/OSM: Rua Quinze de Novembro, Valparaiso, Sao Paulo, Brasil",
  },
  [chaveCoordenadaPonto("Valparaíso", "Santa Casa de Misericórdia (Rua Bartolomeu Bueno, 241)")]: {
    lat: -21.2306549,
    lng: -50.8611954,
    fonte: "Nominatim/OSM: Santa Casa de Misericordia de Valparaiso, Valparaiso, Sao Paulo, Brasil",
  },
  [chaveCoordenadaPonto("Valparaíso", "Terminal Rodoviário (Avenida Nove de Julho)")]: {
    lat: -21.2292408,
    lng: -50.8656612,
    fonte: "Nominatim/OSM: Terminal Rodoviario de Valparaiso, Valparaiso, Sao Paulo, Brasil",
  },
  [chaveCoordenadaPonto("Valparaíso", "Complexo Penal - Entorno do CPP Valparaíso (Estrada VPS 012)")]: {
    lat: -21.2322131,
    lng: -50.8758833,
    fonte: "Nominatim/OSM: Estrada Municipal VPS-453, Valparaiso, Sao Paulo, Brasil",
  },
  [chaveCoordenadaPonto("Valparaíso", "Aguapeí")]: {
    lat: -21.2033553,
    lng: -50.9496439,
    fonte: "Nominatim/OSM: Aguapei, Valparaiso, Sao Paulo, Brasil",
  },
  [chaveCoordenadaPonto("Valparaíso", "Nova Serrinha")]: {
    lat: -21.1366659,
    lng: -50.7826388,
    fonte: "Nominatim/OSM: Nova Serrinha, Valparaiso, Sao Paulo, Brasil",
  },
  [chaveCoordenadaPonto("Rubiácea", "Caramuru (ex-distrito)")]: {
    lat: -21.4239706,
    lng: -50.8260951,
    fonte: "Nominatim/OSM: Caramuru, Rubiacea, Sao Paulo, Brasil",
  },
  [chaveCoordenadaPonto("Bento de Abreu", "UBS Dr. José Rosseto (Rua José Rosseto, 58)")]: {
    lat: -21.2714546,
    lng: -50.8152485,
    fonte: "Nominatim/OSM: Rua Jose Rosseto, Bento de Abreu, Sao Paulo, Brasil",
  },
  [chaveCoordenadaPonto("Bento de Abreu", "SP-300 km ~568 / Trevo de acesso a Bento de Abreu (Infosiga)")]: {
    lat: -21.2084711,
    lng: -50.7462247,
    fonte: "Nominatim/OSM: Rodovia Marechal Rondon, Bento de Abreu, Sao Paulo, Brasil",
  },
};

export function obterCoordenadaPonto(
  municipio: Municipio,
  local: string
): CoordenadaPonto | null {
  return COORDENADAS_PONTOS[chaveCoordenadaPonto(municipio, local)] ?? null;
}

export function obterCoordenadaReferenciaMunicipio(
  municipio: Municipio
): CoordenadaPonto | null {
  return COORDENADAS_REFERENCIA_MUNICIPIO[municipio] ?? null;
}
