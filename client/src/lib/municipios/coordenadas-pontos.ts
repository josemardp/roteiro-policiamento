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
  [chaveCoordenadaPonto("Guararapes", "Centro")]: {
    lat: -21.2620857,
    lng: -50.6415857,
    fonte: "PPI 5CIA: centroide de 7 pontos georreferenciados no bairro Centro",
  },
  [chaveCoordenadaPonto("Guararapes", "Centro (zona comercial de comércio geral)")]: {
    lat: -21.2620857,
    lng: -50.6415857,
    fonte: "PPI 5CIA: centroide de 7 pontos georreferenciados no bairro Centro",
  },
  [chaveCoordenadaPonto("Guararapes", "Bairro Industrial")]: {
    lat: -21.2592,
    lng: -50.6492,
    fonte: "PPI 5CIA: EMEB Professora Brigida Cagnin Zancaner, Bairro Industrial",
  },
  [chaveCoordenadaPonto("Guararapes", "Jardim Dom Luiz Orione")]: {
    lat: -21.2655,
    lng: -50.6358,
    fonte: "PPI 5CIA: CRAS Guararapes, Jardim Dom Luiz Orione",
  },
  [chaveCoordenadaPonto("Guararapes", "Jardim Aeroporto")]: {
    lat: -21.255,
    lng: -50.635,
    fonte: "PPI 5CIA: EE Prof. Waldemar Queiroz, Jardim Aeroporto",
  },
  [chaveCoordenadaPonto("Guararapes", "Jardim Continental")]: {
    lat: -21.2531,
    lng: -50.6515,
    fonte: "PPI 5CIA: EMEB Professora Ivete Abdo Theodoro de Oliveira, Jardim Continental",
  },
  [chaveCoordenadaPonto("Guararapes", "Zona Comercial do Jardim Acapulco (Rua Baguassu)")]: {
    lat: -21.2536,
    lng: -50.6415,
    fonte: "PPI 5CIA: Supermercado Big Mart - Loja Baguassu, Jardim Acapulco",
  },
  [chaveCoordenadaPonto("Guararapes", "Entrada principal pela Av. Rio Branco")]: {
    lat: -21.2616981,
    lng: -50.6468503,
    fonte: "Nominatim/OSM: Avenida Rio Branco, Guararapes, Sao Paulo, Brasil",
  },
  [chaveCoordenadaPonto("Guararapes", "Trevo de acesso à SP-300 (km 553)")]: {
    lat: -21.2094573,
    lng: -50.6667356,
    fonte: "Nominatim/OSM: Rodovia Marechal Rondon, Guararapes, Sao Paulo, Brasil (km 553 consultado em 2026-06-17)",
  },
  [chaveCoordenadaPonto("Guararapes", "SP-300 km ~553 (Trecho crítico de acidentes - Infosiga)")]: {
    lat: -21.2094573,
    lng: -50.6667356,
    fonte: "Nominatim/OSM: Rodovia Marechal Rondon, Guararapes, Sao Paulo, Brasil (km 553 consultado em 2026-06-17)",
  },
  [chaveCoordenadaPonto("Guararapes", "SP-300 km 550-555")]: {
    lat: -21.2094573,
    lng: -50.6667356,
    fonte: "Nominatim/OSM: Rodovia Marechal Rondon, Guararapes, Sao Paulo, Brasil (km 550 consultado em 2026-06-17)",
  },
  [chaveCoordenadaPonto("Guararapes", "Distrito de Ribeiro do Vale")]: {
    lat: -21.070596,
    lng: -50.7100267,
    fonte: "OSM/Overpass: node Ribeiro do Vale, place=village, Guararapes",
  },
  [chaveCoordenadaPonto("Guararapes", "Estrada da Usina Unialco")]: {
    lat: -21.2185,
    lng: -50.695,
    fonte: "PPI 5CIA: hotspot Area Industrial - Entorno da Usina Unialco",
  },
  [chaveCoordenadaPonto("Valparaíso", "Conj. Hab. Miguel Villar")]: {
    lat: -21.223,
    lng: -50.861,
    fonte: "PPI 5CIA: EE Prof. David Golias, Conj. Hab. Miguel Villar",
  },
  [chaveCoordenadaPonto("Valparaíso", "Zona Comercial da Rua Eduardo Geraldi")]: {
    lat: -21.2248,
    lng: -50.8662,
    fonte: "PPI 5CIA: Emporio Redepas - Valparaiso, Rua Eduardo Geraldi",
  },
  [chaveCoordenadaPonto("Valparaíso", "Saída do município sentido SP-300 (km 576)")]: {
    lat: -21.2072866,
    lng: -50.8166771,
    fonte: "Nominatim/OSM: Rodovia Marechal Rondon, Valparaiso, Sao Paulo, Brasil (km 576 consultado em 2026-06-17)",
  },
  [chaveCoordenadaPonto("Valparaíso", "SP-300 km ~576 (Trecho crítico de acidentes - Infosiga)")]: {
    lat: -21.2072866,
    lng: -50.8166771,
    fonte: "Nominatim/OSM: Rodovia Marechal Rondon, Valparaiso, Sao Paulo, Brasil (km 576 consultado em 2026-06-17)",
  },
  [chaveCoordenadaPonto("Valparaíso", "SP-300 km 573-578")]: {
    lat: -21.2072866,
    lng: -50.8166771,
    fonte: "Nominatim/OSM: Rodovia Marechal Rondon, Valparaiso, Sao Paulo, Brasil (km 573 consultado em 2026-06-17)",
  },
  [chaveCoordenadaPonto("Valparaíso", "Vicinal Eugênio Salesse")]: {
    lat: -21.2332061,
    lng: -50.8264067,
    fonte: "Nominatim/OSM: Estrada Vicinal Eugenio Salesse, Valparaiso, Sao Paulo, Brasil",
  },
  [chaveCoordenadaPonto("Valparaíso", "Acessos principais pela Vicinal Eugênio Salesse")]: {
    lat: -21.2332061,
    lng: -50.8264067,
    fonte: "Nominatim/OSM: Estrada Vicinal Eugenio Salesse, Valparaiso, Sao Paulo, Brasil",
  },
  [chaveCoordenadaPonto("Rubiácea", "Centro")]: {
    lat: -21.298975,
    lng: -50.727825,
    fonte: "PPI 5CIA: centroide de 4 pontos georreferenciados no bairro Centro",
  },
  [chaveCoordenadaPonto("Rubiácea", "Centro (pequeno comércio no entorno da praça principal)")]: {
    lat: -21.298975,
    lng: -50.727825,
    fonte: "PPI 5CIA: centroide de 4 pontos georreferenciados no bairro Centro",
  },
  [chaveCoordenadaPonto("Rubiácea", "Praça central (Igreja Matriz)")]: {
    lat: -21.298975,
    lng: -50.727825,
    fonte: "PPI 5CIA: centroide operacional do Centro de Rubiacea",
  },
  [chaveCoordenadaPonto("Rubiácea", "UBS III de Rubiácea (Rua Francisco de Paula Leite Nogueira, 208)")]: {
    lat: -21.3005,
    lng: -50.7265,
    fonte: "PPI 5CIA: UBS III de Rubiacea, CNES/DATASUS",
  },
  [chaveCoordenadaPonto("Rubiácea", "Banco do Brasil (Avenida Min. Konder, 107)")]: {
    lat: -21.2982,
    lng: -50.7288,
    fonte: "PPI 5CIA: Banco do Brasil Rubiacea, ESTBAN/BCB",
  },
  [chaveCoordenadaPonto("Rubiácea", "Trevo de acesso à SP-300 (km 562)")]: {
    lat: -21.2912,
    lng: -50.755,
    fonte: "PPI 5CIA: Trevo de Acesso a SP-300 / Praca de Pedagio",
  },
  [chaveCoordenadaPonto("Rubiácea", "Praça de Pedágio da SP-300 (km 562)")]: {
    lat: -21.2912,
    lng: -50.755,
    fonte: "PPI 5CIA: Trevo de Acesso a SP-300 / Praca de Pedagio",
  },
  [chaveCoordenadaPonto("Rubiácea", "Trecho crítico de sinistros SP-300 km ~562")]: {
    lat: -21.2912,
    lng: -50.755,
    fonte: "PPI 5CIA: Trevo de Acesso a SP-300 / Praca de Pedagio",
  },
  [chaveCoordenadaPonto("Rubiácea", "SP-300 km 560-564")]: {
    lat: -21.2104657,
    lng: -50.7310561,
    fonte: "Nominatim/OSM: Rodovia Marechal Rondon, Rubiacea, Sao Paulo, Brasil (km 560 consultado em 2026-06-17)",
  },
  [chaveCoordenadaPonto("Rubiácea", "Prevenção a roubo a banco (madrugada) — Entorno do Banco do Brasil (Av. Min. Konder)")]: {
    lat: -21.2982,
    lng: -50.7288,
    fonte: "PPI 5CIA: Banco do Brasil Rubiacea, ESTBAN/BCB",
  },
  [chaveCoordenadaPonto("Bento de Abreu", "Centro")]: {
    lat: -21.2683,
    lng: -50.8121,
    fonte: "PPI 5CIA: centroide de 5 pontos georreferenciados no bairro Centro",
  },
  [chaveCoordenadaPonto("Bento de Abreu", "Centro (pequeno comércio na Av. Dr. José Rosseto)")]: {
    lat: -21.2683,
    lng: -50.8121,
    fonte: "PPI 5CIA: centroide de 5 pontos georreferenciados no bairro Centro",
  },
  [chaveCoordenadaPonto("Bento de Abreu", "Praça central (Igreja Matriz)")]: {
    lat: -21.2683,
    lng: -50.8121,
    fonte: "PPI 5CIA: centroide operacional do Centro de Bento de Abreu",
  },
  [chaveCoordenadaPonto("Bento de Abreu", "Trevo de acesso SP-300 / SP-568")]: {
    lat: -21.2652,
    lng: -50.8285,
    fonte: "PPI 5CIA: Trevo de Bento de Abreu (SP-300 / SP-568)",
  },
  [chaveCoordenadaPonto("Bento de Abreu", "Entrada da cidade pela SP-568")]: {
    lat: -21.2652,
    lng: -50.8285,
    fonte: "PPI 5CIA: Trevo de Bento de Abreu (SP-300 / SP-568)",
  },
  [chaveCoordenadaPonto("Bento de Abreu", "SP-300 km 566-570")]: {
    lat: -21.2084711,
    lng: -50.7462247,
    fonte: "Nominatim/OSM: Rodovia Marechal Rondon, Bento de Abreu, Sao Paulo, Brasil (km 566 consultado em 2026-06-17)",
  },
};

export function obterCoordenadaPonto(
  municipio: Municipio,
  local: string
): CoordenadaPonto | null {
  const coordenadaExata = COORDENADAS_PONTOS[chaveCoordenadaPonto(municipio, local)];
  if (coordenadaExata) {
    return coordenadaExata;
  }

  const municipioNormalizado = normalizarChavePonto(municipio);
  const localNormalizado = normalizarChavePonto(local);
  let melhorMatch: { tamanho: number; coordenada: CoordenadaPonto } | null = null;

  for (const [chave, coordenada] of Object.entries(COORDENADAS_PONTOS)) {
    const [municipioChave, pontoChave] = chave.split("|");
    if (municipioChave !== municipioNormalizado || !pontoChave) {
      continue;
    }
    if (!localNormalizado.includes(pontoChave)) {
      continue;
    }
    if (!melhorMatch || pontoChave.length > melhorMatch.tamanho) {
      melhorMatch = { tamanho: pontoChave.length, coordenada };
    }
  }

  return melhorMatch?.coordenada ?? null;
}

export function obterCoordenadaReferenciaMunicipio(
  municipio: Municipio
): CoordenadaPonto | null {
  return COORDENADAS_REFERENCIA_MUNICIPIO[municipio] ?? null;
}
