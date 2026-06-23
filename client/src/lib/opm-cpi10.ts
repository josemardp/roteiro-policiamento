/**
 * Dados das OPMs do CPI-10 — 2º BPM/I (Araçatuba) + 28º BPM/I (Andradina)
 * 43 municípios. CENTRO_MPAL = endereço a confirmar com Cmte de Cia (marcado VERIFICAR no guia).
 * Tempos calculados via guia de roteamento CPI-10 (Haversine × 1,30, 80 km/h, mín 12 min).
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
  { municipio: "Valparaíso",                 unidade: "1º Pel / 5ª Cia / 2º BPM/I",      endereco: "Av. Nove de Julho, 61 — Centro, Valparaíso/SP",                             lat: -21.2258, lng: -50.8718, tipoEndereco: "REAL",        tempoAMin: 0,   tempoBMin: 23  },
  { municipio: "Guararapes",                 unidade: "Sede 5ª Cia / 2º BPM/I",           endereco: "Rua Duque de Caxias, 1000 — Centro, Guararapes/SP",                         lat: -21.2580, lng: -50.6425, tipoEndereco: "REAL",        tempoAMin: 23,  tempoBMin: 0   },
  { municipio: "Araçatuba",                  unidade: "Sede CPI-10 / 1ª Cia / 2º BPM/I", endereco: "Rua Vereador Silva Grota, 664 — Aviação, Araçatuba/SP",                      lat: -21.2087, lng: -50.4330, tipoEndereco: "REAL",        tempoAMin: 44,  tempoBMin: 22  },
  { municipio: "Alto Alegre",                unidade: "Gp PM / 2ª Cia / 2º BPM/I",       endereco: "Rua Miguel Rivera, 545 — Centro, Alto Alegre/SP",                           lat: -21.0117, lng: -50.2842, tipoEndereco: "REAL",        tempoAMin: 64,  tempoBMin: 45  },
  { municipio: "Auriflama",                  unidade: "Sede Pel / 3ª Cia / 2º BPM/I",    endereco: "Rua Natal Mateus, 6043 — Jardim Alvorada, Auriflama/SP",                    lat: -20.6892, lng: -50.5539, tipoEndereco: "REAL",        tempoAMin: 66,  tempoBMin: 62  },
  { municipio: "Avanhandava",                unidade: "Gp PM / 2ª Cia / 2º BPM/I",       endereco: "Praça da Bandeira, 78 — Centro, Avanhandava/SP",                            lat: -21.4606, lng: -49.9497, tipoEndereco: "REAL",        tempoAMin: 97,  tempoBMin: 73  },
  { municipio: "Barbosa",                    unidade: "Gp PM / 2ª Cia / 2º BPM/I",       endereco: "Rua Sete de Setembro, 867 — Centro, Barbosa/SP",                            lat: -21.2325, lng: -49.9764, tipoEndereco: "REAL",        tempoAMin: 91,  tempoBMin: 67  },
  { municipio: "Bento de Abreu",             unidade: "Gp PM / 5ª Cia / 2º BPM/I",       endereco: "Rua João Belmiro de Brito, 202 — Centro, Bento de Abreu/SP",                lat: -21.0478, lng: -51.0142, tipoEndereco: "REAL",        tempoAMin: 24,  tempoBMin: 44  },
  { municipio: "Bilac",                      unidade: "Gp PM / 1ª Cia / 2º BPM/I",       endereco: "Rua Marechal Deodoro da Fonseca, 1001 — Centro, Bilac/SP",                  lat: -21.2939, lng: -50.0861, tipoEndereco: "REAL",        tempoAMin: 80,  tempoBMin: 56  },
  { municipio: "Birigui",                    unidade: "Sede 4ª Cia / 2º BPM/I",           endereco: "Rua Anchieta, 857 — Vila Angélica, Birigui/SP",                             lat: -21.2869, lng: -50.3394, tipoEndereco: "REAL",        tempoAMin: 54,  tempoBMin: 31  },
  { municipio: "Braúna",                     unidade: "Gp PM / 2ª Cia / 2º BPM/I",       endereco: "Rua Floriano Peixoto, 520 — Vila Nova, Braúna/SP",                          lat: -21.4853, lng: -50.1003, tipoEndereco: "REAL",        tempoAMin: 83,  tempoBMin: 60  },
  { municipio: "Brejo Alegre",               unidade: "Gp PM / 4ª Cia / 2º BPM/I",       endereco: "Av. Pedro de Paula Castilho, 1030 — Centro, Brejo Alegre/SP",               lat: -21.2317, lng: -50.2511, tipoEndereco: "REAL",        tempoAMin: 63,  tempoBMin: 40  },
  { municipio: "Buritama",                   unidade: "Sede Pel / 4ª Cia / 2º BPM/I",    endereco: "Rua Maria Florinda, 1142 — Centro, Buritama/SP",                            lat: -21.0714, lng: -50.1428, tipoEndereco: "REAL",        tempoAMin: 76,  tempoBMin: 54  },
  { municipio: "Clementina",                 unidade: "Gp PM / 4ª Cia / 2º BPM/I",       endereco: "Rua Bahia, 36 — Centro, Clementina/SP",                                    lat: -21.5581, lng: -50.0514, tipoEndereco: "REAL",        tempoAMin: 90,  tempoBMin: 68  },
  { municipio: "Coroados",                   unidade: "Gp PM / 4ª Cia / 2º BPM/I",       endereco: "Rua Treze de Maio, 19 — Centro, Coroados/SP",                               lat: -21.1372, lng: -50.0806, tipoEndereco: "REAL",        tempoAMin: 81,  tempoBMin: 58  },
  { municipio: "Gabriel Monteiro",           unidade: "Gp PM / 1ª Cia / 2º BPM/I",       endereco: "Av. Padre Tiago Jacobus Bunner, 1195 — Centro, Gabriel Monteiro/SP",        lat: -21.5569, lng: -50.5708, tipoEndereco: "REAL",        tempoAMin: 47,  tempoBMin: 33  },
  { municipio: "Gastão Vidigal",             unidade: "Gp PM / 3ª Cia / 2º BPM/I",       endereco: "Rua José de Oliveira Marques, 265 — Centro, Gastão Vidigal/SP",             lat: -20.7675, lng: -50.6978, tipoEndereco: "REAL",        tempoAMin: 53,  tempoBMin: 53  },
  { municipio: "General Salgado",            unidade: "Sede 3ª Cia / 2º BPM/I",           endereco: "Rua Ulderico Valese, 800 — Bela Vista, General Salgado/SP",                 lat: -20.6408, lng: -50.3636, tipoEndereco: "REAL",        tempoAMin: 82,  tempoBMin: 73  },
  { municipio: "Glicério",                   unidade: "Gp PM / 2ª Cia / 2º BPM/I",       endereco: "Rua Prefeito Fuad Eid, 510 — Centro, Glicério/SP",                          lat: -21.5747, lng: -50.0039, tipoEndereco: "REAL",        tempoAMin: 95,  tempoBMin: 73  },
  { municipio: "Guzolândia",                 unidade: "Gp PM / 3ª Cia / 2º BPM/I",       endereco: "Rua Augusto Donegar, 476 — Centro, Guzolândia/SP",                          lat: -20.6328, lng: -50.5633, tipoEndereco: "REAL",        tempoAMin: 71,  tempoBMin: 68  },
  { municipio: "Lourdes",                    unidade: "Gp PM / 4ª Cia / 2º BPM/I",       endereco: "Rua Cinco de Março, 4 — Novo Milênio, Lourdes/SP",                          lat: -20.9758, lng: -50.2372, tipoEndereco: "REAL",        tempoAMin: 70,  tempoBMin: 51  },
  { municipio: "Luiziânia",                  unidade: "Gp PM / 2ª Cia / 2º BPM/I",       endereco: "Av. Padre Anchieta, 212 — Centro, Luiziânia/SP",                            lat: -21.6650, lng: -50.0817, tipoEndereco: "REAL",        tempoAMin: 93,  tempoBMin: 72  },
  { municipio: "Nova Castilho",              unidade: "Gp PM / 3ª Cia / 2º BPM/I",       endereco: "Rua Euclydes Cunha, 196 — Centro, Nova Castilho/SP",                        lat: -20.5764, lng: -50.5703, tipoEndereco: "REAL",        tempoAMin: 77,  tempoBMin: 74  },
  { municipio: "Nova Luzitânia",             unidade: "Gp PM / 3ª Cia / 2º BPM/I",       endereco: "Rua Pedro Pereira Dias, 1871 — Bela Vista, Nova Luzitânia/SP",              lat: -20.8303, lng: -50.5553, tipoEndereco: "REAL",        tempoAMin: 54,  tempoBMin: 47  },
  { municipio: "Penápolis",                  unidade: "Sede 2ª Cia / 2º BPM/I",           endereco: "Rua Nain Eid, 31 — Jardim Ipê, Penápolis/SP",                               lat: -21.4194, lng: -50.0786, tipoEndereco: "REAL",        tempoAMin: 83,  tempoBMin: 60  },
  { municipio: "Piacatu",                    unidade: "Gp PM / 1ª Cia / 2º BPM/I",       endereco: "Rua Domingos Pestana Garcez, 931 — Centro, Piacatu/SP",                     lat: -21.5572, lng: -50.6075, tipoEndereco: "REAL",        tempoAMin: 45,  tempoBMin: 33  },
  { municipio: "Rubiácea",                   unidade: "Gp PM / 5ª Cia / 2º BPM/I",       endereco: "Rua Ministro Konder, 112 — Centro, Rubiácea/SP",                            lat: -21.4144, lng: -50.7822, tipoEndereco: "REAL",        tempoAMin: 22,  tempoBMin: 22  },
  { municipio: "Santo Antônio do Aracanguá", unidade: "Gp PM / 1ª Cia / 2º BPM/I",       endereco: "Rua Thomaz Mendonça, 259 — Centro, Sto. Antônio do Aracanguá/SP",           lat: -20.9211, lng: -50.5133, tipoEndereco: "REAL",        tempoAMin: 49,  tempoBMin: 39  },
  { municipio: "Santópolis do Aguapeí",      unidade: "Gp PM / 1ª Cia / 2º BPM/I",       endereco: "Rua Teolino José Correia, 410 — Centro, Santópolis do Aguapeí/SP",          lat: -21.1942, lng: -50.5833, tipoEndereco: "REAL",        tempoAMin: 29,  tempoBMin: 12  },
  { municipio: "São João de Iracema",        unidade: "Gp PM / 3ª Cia / 2º BPM/I",       endereco: "Rua Sebastião Batista dos Santos, 480 — Centro, São João de Iracema/SP",    lat: -20.8453, lng: -50.8411, tipoEndereco: "REAL",        tempoAMin: 41,  tempoBMin: 49  },
  { municipio: "Turiúba",                    unidade: "Gp PM / 4ª Cia / 2º BPM/I",       endereco: "Rua Belizário Goulart dos Santos, 480 — Centro, Turiúba/SP",                lat: -21.1558, lng: -50.0086, tipoEndereco: "REAL",        tempoAMin: 88,  tempoBMin: 65  },

  // ─── 28º BPM/I (12 municípios) ──────────────────────────────────────────────
  { municipio: "Andradina",                  unidade: "Sede 28º BPM/I",                   endereco: "Av. Barão do Rio Branco, 405 — Parque Santo Antônio, Andradina/SP",          lat: -20.8972, lng: -51.3800, tipoEndereco: "REAL",        tempoAMin: 63,  tempoBMin: 84  },
  { municipio: "Castilho",                   unidade: "Sede Pel / 1ª Cia / 28º BPM/I",   endereco: "R. Manoel Ribeiro, 926, Castilho - SP, 16920-000",                    lat: -20.8717, lng: -51.4894, tipoEndereco: "REAL", tempoAMin: 73,  tempoBMin: 95  },
  { municipio: "Guaraçaí",                   unidade: "Gp PM / 3ª Cia / 28º BPM/I",      endereco: "Rua Benedito Ben Hur Louzada, 1195 — Centro, Guaraçaí/SP",                  lat: -21.0078, lng: -51.2103, tipoEndereco: "REAL",        tempoAMin: 42,  tempoBMin: 64  },
  { municipio: "Ilha Solteira",              unidade: "Sede 2ª Cia / 28º BPM/I",          endereco: "Alameda Goiás, 256 — Centro, Ilha Solteira/SP",                             lat: -20.4297, lng: -51.3408, tipoEndereco: "REAL",        tempoAMin: 99,  tempoBMin: 114 },
  { municipio: "Itapura",                    unidade: "Gp PM / 2ª Cia / 28º BPM/I",      endereco: "Rua Barão do Rio Branco, 426 — Centro, Itapura/SP",                         lat: -20.6361, lng: -51.5131, tipoEndereco: "REAL",        tempoAMin: 91,  tempoBMin: 111 },
  { municipio: "Lavínia",                    unidade: "Gp PM / 3ª Cia / 28º BPM/I",      endereco: "Av. Perobal, 930 - Lavínia, SP, 16850-000",                       lat: -21.1600, lng: -51.0561, tipoEndereco: "REAL", tempoAMin: 20,  tempoBMin: 43  },
  { municipio: "Mirandópolis",               unidade: "Sede 3ª Cia / 28º BPM/I",          endereco: "Av. São Paulo, 272 — Bairro Pauliceia, Mirandópolis/SP",                    lat: -21.1336, lng: -51.1022, tipoEndereco: "REAL",        tempoAMin: 25,  tempoBMin: 48  },
  { municipio: "Murutinga do Sul",           unidade: "Gp PM / 1ª Cia / 28º BPM/I",      endereco: "Av. Prefeito Romeu Cestari, 56 — Centro, Murutinga do Sul/SP",              lat: -20.9892, lng: -51.3428, tipoEndereco: "REAL",        tempoAMin: 54,  tempoBMin: 77  },
  { municipio: "Nova Independência",         unidade: "Gp PM / 1ª Cia / 28º BPM/I",      endereco: "Rua Santa Maria, 597 — Centro, Nova Independência/SP",                      lat: -21.0933, lng: -51.4797, tipoEndereco: "REAL",        tempoAMin: 63,  tempoBMin: 86  },
  { municipio: "Pereira Barreto",            unidade: "Sede Pel / 2ª Cia / 28º BPM/I",   endereco: "Av. Coronel Jonas Alves de Mello, 1550 — Vila Carvalho, Pereira Barreto/SP", lat: -20.6369, lng: -51.1064, tipoEndereco: "REAL",       tempoAMin: 68,  tempoBMin: 82  },
  { municipio: "Sud Mennucci",               unidade: "Gp PM / 2ª Cia / 28º BPM/I",      endereco: "Av. Bento Alves Natel, 728 — Centro, Sud Mennucci/SP",                      lat: -20.7839, lng: -51.0314, tipoEndereco: "REAL",        tempoAMin: 51,  tempoBMin: 65  },
  { municipio: "Suzanápolis",                unidade: "Gp PM / 2ª Cia / 28º BPM/I",      endereco: "Rua Duque de Caxias, 740 — Centro, Suzanápolis/SP",                         lat: -20.4908, lng: -51.0264, tipoEndereco: "REAL",        tempoAMin: 81,  tempoBMin: 92  },
];
