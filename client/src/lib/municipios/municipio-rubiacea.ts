import type { MunicipioData } from "../types";

export const RUBIACEA: MunicipioData = {
  perfil: "rural_pequeno",
  tipoPadrao: "Rural",
  rodovias: [
    "SP-300 (Rodovia Marechal Rondon) — km ~562 (praça de pedágio)",
    "Estradas vicinais intermunicipais",
  ],
  comercio: ["Centro (pequeno comércio no entorno da praça principal)"],
  bairros: ["Centro", "Zona Rural"],
  pontosPE: [
    "Praça central (Igreja Matriz)",
    "UBS III de Rubiácea (Rua Francisco de Paula Leite Nogueira, 208)",
    "Banco do Brasil (Avenida Min. Konder, 107)",
  ],
  pontosFisc: [
    "Trevo de acesso à SP-300 (km 562)",
    "Saída sentido Vicinal Geraldo Stringhetta",
    "Praça de Pedágio da SP-300 (km 562)",
    "Trecho crítico de sinistros SP-300 km ~562",
    "Prevenção a roubo a banco (madrugada) — Entorno do Banco do Brasil (Av. Min. Konder)",
  ],
  rural: [
    "Caramuru (ex-distrito)",
    "Vicinal Geraldo Stringhetta (Rubiácea a Caramuru)",
    "Vicinal Rubiácea a Bento de Abreu",
    "Vicinal Rubiácea a Bilac",
    "Vicinal Geraldo Stringhetta — cluster de propriedades rurais",
  ],
  eventos: [
    {
      nome: "Safra de Cana (Pico de Moagem)",
      inicio: "07-01",
      fim: "10-15",
      pesoSAT: 4,
    },
  ],
  obs: "Município de perfil essencialmente rural (~2.700 hab. Censo 2022); priorizar policiamento rural e fiscalização em vicinais. Bairros devem ser apenas Centro e Zona Rural.",
};
