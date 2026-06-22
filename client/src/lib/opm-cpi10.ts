/**
 * Dados das OPMs do CPI-10 — 2º BPM/I (Araçatuba) + 28º BPM/I (Andradina)
 * 43 municípios. Endereços CENTRO_MPAL = praça central estimada; confirmar com Cmte de Cia.
 * Dist/Tempo: null = calculado via Haversine × 1,30 × (60/75 km/h). Substituir por dados reais.
 */

export interface OPMData {
  municipio: string;
  unidade: string;
  endereco: string;
  lat: number;
  lng: number;
  tipoEndereco: "REAL" | "CENTRO_MPAL";
  tempoAMin: number | null; // De Valparaíso — null = estimar
  tempoBMin: number | null; // De Guararapes — null = estimar
}

export const BASE_A = { lat: -21.2258, lng: -50.8718, municipio: "Valparaíso" };
export const BASE_B = { lat: -21.2580, lng: -50.6425, municipio: "Guararapes" };

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(a));
}

export function estimarTempoMin(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const direta = haversineKm(lat1, lng1, lat2, lng2);
  return Math.round((direta * 1.30) / 75 * 60);
}

export function tempoDeA(opm: OPMData): number {
  return opm.tempoAMin ?? estimarTempoMin(BASE_A.lat, BASE_A.lng, opm.lat, opm.lng);
}

export function tempoDeB(opm: OPMData): number {
  return opm.tempoBMin ?? estimarTempoMin(BASE_B.lat, BASE_B.lng, opm.lat, opm.lng);
}

export function getOPM(municipio: string): OPMData | undefined {
  return OPM_CPI10.find(o => o.municipio === municipio);
}

/** Retorna tempo estimado (min) da base informada até o município. */
export function getTempoParaOPM(base: "A" | "B", municipio: string): number {
  const opm = getOPM(municipio);
  if (!opm) return 60;
  return base === "A" ? tempoDeA(opm) : tempoDeB(opm);
}

// ─── Dados — 2º BPM/I (31 municípios) ───────────────────────────────────────

export const OPM_CPI10: OPMData[] = [
  { municipio: "Valparaíso",               unidade: "1º Pel / 5ª Cia / 2º BPM/I",       endereco: "Av. Nove de Julho, 61 — Centro, Valparaíso/SP",                    lat: -21.2258, lng: -50.8718, tipoEndereco: "REAL",        tempoAMin: 0,    tempoBMin: null },
  { municipio: "Guararapes",               unidade: "Sede 5ª Cia / 2º BPM/I",            endereco: "Rua Duque de Caxias, 1000 — Centro, Guararapes/SP",                lat: -21.2580, lng: -50.6425, tipoEndereco: "REAL",        tempoAMin: null, tempoBMin: 0    },
  { municipio: "Araçatuba",                unidade: "Sede CPI-10 / 1ª Cia / 2º BPM/I",  endereco: "Praça Rui Barbosa, s/n — Centro, Araçatuba/SP",                    lat: -21.2087, lng: -50.4330, tipoEndereco: "CENTRO_MPAL", tempoAMin: null, tempoBMin: null },
  { municipio: "Alto Alegre",              unidade: "Gp PM / 2ª Cia / 2º BPM/I",        endereco: "Praça Manoel Gomes da Pena, 42 — Centro, Alto Alegre/SP",          lat: -21.0117, lng: -50.2842, tipoEndereco: "CENTRO_MPAL", tempoAMin: null, tempoBMin: null },
  { municipio: "Auriflama",               unidade: "Sede Pel / 3ª Cia / 2º BPM/I",      endereco: "Praça Cel. Djalma Gonçalves, s/n — Centro, Auriflama/SP",          lat: -20.6892, lng: -50.5539, tipoEndereco: "CENTRO_MPAL", tempoAMin: null, tempoBMin: null },
  { municipio: "Avanhandava",             unidade: "Gp PM / 2ª Cia / 2º BPM/I",         endereco: "Praça dos Três Poderes, s/n — Centro, Avanhandava/SP",             lat: -21.4606, lng: -49.9497, tipoEndereco: "CENTRO_MPAL", tempoAMin: null, tempoBMin: null },
  { municipio: "Barbosa",                 unidade: "Gp PM / 2ª Cia / 2º BPM/I",         endereco: "Praça Marechal Deodoro, s/n — Centro, Barbosa/SP",                 lat: -21.2325, lng: -49.9764, tipoEndereco: "CENTRO_MPAL", tempoAMin: null, tempoBMin: null },
  { municipio: "Bento de Abreu",          unidade: "Gp PM / 5ª Cia / 2º BPM/I",         endereco: "Praça Cornélio Alves, s/n — Centro, Bento de Abreu/SP",           lat: -21.0478, lng: -51.0142, tipoEndereco: "CENTRO_MPAL", tempoAMin: null, tempoBMin: null },
  { municipio: "Bilac",                   unidade: "Gp PM / 1ª Cia / 2º BPM/I",         endereco: "Praça Getúlio Vargas, s/n — Centro, Bilac/SP",                     lat: -21.2939, lng: -50.0861, tipoEndereco: "CENTRO_MPAL", tempoAMin: null, tempoBMin: null },
  { municipio: "Birigui",                 unidade: "Sede 4ª Cia / 2º BPM/I",            endereco: "Praça das Bandeiras, s/n — Centro, Birigui/SP",                    lat: -21.2869, lng: -50.3394, tipoEndereco: "CENTRO_MPAL", tempoAMin: null, tempoBMin: null },
  { municipio: "Braúna",                  unidade: "Gp PM / 2ª Cia / 2º BPM/I",         endereco: "Praça Augusto de Carvalho, s/n — Centro, Braúna/SP",               lat: -21.4853, lng: -50.1003, tipoEndereco: "CENTRO_MPAL", tempoAMin: null, tempoBMin: null },
  { municipio: "Brejo Alegre",            unidade: "Gp PM / 4ª Cia / 2º BPM/I",         endereco: "Praça Dr. Arnaldo Rodrigues, s/n — Centro, Brejo Alegre/SP",       lat: -21.2317, lng: -50.2511, tipoEndereco: "CENTRO_MPAL", tempoAMin: null, tempoBMin: null },
  { municipio: "Buritama",               unidade: "Sede Pel / 4ª Cia / 2º BPM/I",       endereco: "Praça Dr. Waldemar Gonçalves, s/n — Centro, Buritama/SP",          lat: -21.0714, lng: -50.1428, tipoEndereco: "CENTRO_MPAL", tempoAMin: null, tempoBMin: null },
  { municipio: "Clementina",             unidade: "Gp PM / 4ª Cia / 2º BPM/I",          endereco: "Praça Rui Barbosa, s/n — Centro, Clementina/SP",                   lat: -21.5581, lng: -50.0514, tipoEndereco: "CENTRO_MPAL", tempoAMin: null, tempoBMin: null },
  { municipio: "Coroados",               unidade: "Gp PM / 4ª Cia / 2º BPM/I",          endereco: "Praça Comendador Gomes da Costa, s/n — Centro, Coroados/SP",       lat: -21.1372, lng: -50.0806, tipoEndereco: "CENTRO_MPAL", tempoAMin: null, tempoBMin: null },
  { municipio: "Gabriel Monteiro",       unidade: "Gp PM / 1ª Cia / 2º BPM/I",          endereco: "Praça Rodrigues Alves, s/n — Centro, Gabriel Monteiro/SP",         lat: -21.5569, lng: -50.5708, tipoEndereco: "CENTRO_MPAL", tempoAMin: null, tempoBMin: null },
  { municipio: "Gastão Vidigal",         unidade: "Gp PM / 3ª Cia / 2º BPM/I",          endereco: "Praça Santos Dumont, s/n — Centro, Gastão Vidigal/SP",             lat: -20.7675, lng: -50.6978, tipoEndereco: "CENTRO_MPAL", tempoAMin: null, tempoBMin: null },
  { municipio: "General Salgado",        unidade: "Sede 3ª Cia / 2º BPM/I",             endereco: "Praça Comendador Lacerda, s/n — Centro, General Salgado/SP",       lat: -20.6408, lng: -50.3636, tipoEndereco: "CENTRO_MPAL", tempoAMin: null, tempoBMin: null },
  { municipio: "Glicério",              unidade: "Gp PM / 2ª Cia / 2º BPM/I",           endereco: "Praça Dr. Rodrigues Salles, s/n — Centro, Glicério/SP",            lat: -21.5747, lng: -50.0039, tipoEndereco: "CENTRO_MPAL", tempoAMin: null, tempoBMin: null },
  { municipio: "Guzolândia",            unidade: "Gp PM / 3ª Cia / 2º BPM/I",           endereco: "Praça Carlos Gomes, s/n — Centro, Guzolândia/SP",                  lat: -20.6328, lng: -50.5633, tipoEndereco: "CENTRO_MPAL", tempoAMin: null, tempoBMin: null },
  { municipio: "Lourdes",               unidade: "Gp PM / 4ª Cia / 2º BPM/I",           endereco: "Praça da Matriz, s/n — Centro, Lourdes/SP",                        lat: -20.9758, lng: -50.2372, tipoEndereco: "CENTRO_MPAL", tempoAMin: null, tempoBMin: null },
  { municipio: "Luiziânia",            unidade: "Gp PM / 2ª Cia / 2º BPM/I",            endereco: "Praça da República, s/n — Centro, Luiziânia/SP",                   lat: -21.6650, lng: -50.0817, tipoEndereco: "CENTRO_MPAL", tempoAMin: null, tempoBMin: null },
  { municipio: "Nova Castilho",         unidade: "Gp PM / 3ª Cia / 2º BPM/I",           endereco: "Praça Central, s/n — Centro, Nova Castilho/SP",                    lat: -20.5764, lng: -50.5703, tipoEndereco: "CENTRO_MPAL", tempoAMin: null, tempoBMin: null },
  { municipio: "Nova Luzitânia",       unidade: "Gp PM / 3ª Cia / 2º BPM/I",            endereco: "Praça Cel. João Telles, s/n — Centro, Nova Luzitânia/SP",          lat: -20.8303, lng: -50.5553, tipoEndereco: "CENTRO_MPAL", tempoAMin: null, tempoBMin: null },
  { municipio: "Penápolis",            unidade: "Sede 2ª Cia / 2º BPM/I",               endereco: "Praça Cel. Barbosa, s/n — Centro, Penápolis/SP",                   lat: -21.4194, lng: -50.0786, tipoEndereco: "CENTRO_MPAL", tempoAMin: null, tempoBMin: null },
  { municipio: "Piacatu",              unidade: "Gp PM / 1ª Cia / 2º BPM/I",            endereco: "Praça Antônio de Araújo, s/n — Centro, Piacatu/SP",                lat: -21.5572, lng: -50.6075, tipoEndereco: "CENTRO_MPAL", tempoAMin: null, tempoBMin: null },
  { municipio: "Rubiácea",             unidade: "Gp PM / 5ª Cia / 2º BPM/I",            endereco: "Praça Cel. João Pinto, s/n — Centro, Rubiácea/SP",                 lat: -21.4144, lng: -50.7822, tipoEndereco: "CENTRO_MPAL", tempoAMin: null, tempoBMin: null },
  { municipio: "Santo Antônio do Aracanguá", unidade: "Gp PM / 1ª Cia / 2º BPM/I",    endereco: "Praça da Matriz, s/n — Centro, Sto. Antônio do Aracanguá/SP",       lat: -20.9211, lng: -50.5133, tipoEndereco: "CENTRO_MPAL", tempoAMin: null, tempoBMin: null },
  { municipio: "Santópolis do Aguapeí", unidade: "Gp PM / 1ª Cia / 2º BPM/I",          endereco: "Praça Central, s/n — Centro, Santópolis do Aguapeí/SP",             lat: -21.1942, lng: -50.5833, tipoEndereco: "CENTRO_MPAL", tempoAMin: null, tempoBMin: null },
  { municipio: "São João de Iracema",  unidade: "Gp PM / 3ª Cia / 2º BPM/I",           endereco: "Praça Dr. José Lopes, s/n — Centro, São João de Iracema/SP",        lat: -20.8453, lng: -50.8411, tipoEndereco: "CENTRO_MPAL", tempoAMin: null, tempoBMin: null },
  { municipio: "Turiúba",             unidade: "Gp PM / 4ª Cia / 2º BPM/I",             endereco: "Praça Central, s/n — Centro, Turiúba/SP",                          lat: -21.1558, lng: -50.0086, tipoEndereco: "CENTRO_MPAL", tempoAMin: null, tempoBMin: null },

  // ─── 28º BPM/I (12 municípios) ──────────────────────────────────────────────
  { municipio: "Andradina",            unidade: "Sede 28º BPM/I",                        endereco: "Praça Central, s/n — Centro, Andradina/SP",                        lat: -20.8975, lng: -51.3797, tipoEndereco: "CENTRO_MPAL", tempoAMin: null, tempoBMin: null },
  { municipio: "Castilho",             unidade: "Sede Pel / 1ª Cia / 28º BPM/I",        endereco: "Praça Cel. Seraphim Pereira, s/n — Centro, Castilho/SP",           lat: -20.8717, lng: -51.4894, tipoEndereco: "CENTRO_MPAL", tempoAMin: null, tempoBMin: null },
  { municipio: "Guaraçaí",            unidade: "Gp PM / 3ª Cia / 28º BPM/I",            endereco: "Praça da Independência, s/n — Centro, Guaraçaí/SP",                lat: -21.0078, lng: -51.2103, tipoEndereco: "CENTRO_MPAL", tempoAMin: null, tempoBMin: null },
  { municipio: "Ilha Solteira",        unidade: "Sede 2ª Cia / 28º BPM/I",              endereco: "Praça Nelson de Abreu, s/n — Centro, Ilha Solteira/SP",            lat: -20.4297, lng: -51.3408, tipoEndereco: "CENTRO_MPAL", tempoAMin: null, tempoBMin: null },
  { municipio: "Itapura",             unidade: "Gp PM / 2ª Cia / 28º BPM/I",            endereco: "Praça Pinheiro Machado, s/n — Centro, Itapura/SP",                 lat: -20.6361, lng: -51.5131, tipoEndereco: "CENTRO_MPAL", tempoAMin: null, tempoBMin: null },
  { municipio: "Lavínia",             unidade: "Gp PM / 3ª Cia / 28º BPM/I",            endereco: "Praça dos Expedicionários, s/n — Centro, Lavínia/SP",              lat: -21.1600, lng: -51.0561, tipoEndereco: "CENTRO_MPAL", tempoAMin: null, tempoBMin: null },
  { municipio: "Mirandópolis",        unidade: "Sede 3ª Cia / 28º BPM/I",               endereco: "Praça da Independência, s/n — Centro, Mirandópolis/SP",            lat: -21.1336, lng: -51.1022, tipoEndereco: "CENTRO_MPAL", tempoAMin: null, tempoBMin: null },
  { municipio: "Murutinga do Sul",    unidade: "Gp PM / 1ª Cia / 28º BPM/I",            endereco: "Praça Central, s/n — Centro, Murutinga do Sul/SP",                 lat: -20.9892, lng: -51.3428, tipoEndereco: "CENTRO_MPAL", tempoAMin: null, tempoBMin: null },
  { municipio: "Nova Independência",  unidade: "Gp PM / 1ª Cia / 28º BPM/I",            endereco: "Praça Central, s/n — Centro, Nova Independência/SP",               lat: -21.0933, lng: -51.4797, tipoEndereco: "CENTRO_MPAL", tempoAMin: null, tempoBMin: null },
  { municipio: "Pereira Barreto",     unidade: "Sede Pel / 2ª Cia / 28º BPM/I",         endereco: "Praça Cel. Gentil de Moura, s/n — Centro, Pereira Barreto/SP",     lat: -20.6369, lng: -51.1064, tipoEndereco: "CENTRO_MPAL", tempoAMin: null, tempoBMin: null },
  { municipio: "Sud Mennucci",        unidade: "Gp PM / 2ª Cia / 28º BPM/I",            endereco: "Praça Dr. Jonas Duarte, s/n — Centro, Sud Mennucci/SP",            lat: -20.7839, lng: -51.0314, tipoEndereco: "CENTRO_MPAL", tempoAMin: null, tempoBMin: null },
  { municipio: "Suzanápolis",        unidade: "Gp PM / 2ª Cia / 28º BPM/I",             endereco: "Praça Central, s/n — Centro, Suzanápolis/SP",                      lat: -20.4908, lng: -51.0264, tipoEndereco: "CENTRO_MPAL", tempoAMin: null, tempoBMin: null },
];
