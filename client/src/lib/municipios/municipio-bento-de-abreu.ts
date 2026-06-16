import type { MunicipioData } from "../types";

export const BENTO_DE_ABREU: MunicipioData = {
  perfil: "rural_pequeno",
  tipoPadrao: "Rural",
  rodovias: [
    "SP-300 (Rodovia Marechal Rondon)",
    "SP-568 (Rodovia Ezequiel Paulo Pereira)",
  ],
  comercio: ["Centro (pequeno comércio na Av. Dr. José Rosseto)"],
  bairros: ["Centro", "Zona Rural"],
  pontosPE: [
    "Praça central (Igreja Matriz)",
    "UBS Dr. José Rosseto (Rua José Rosseto, 58)",
  ],
  pontosFisc: [
    "Trevo de acesso SP-300 / SP-568",
    "Entrada da cidade pela SP-568",
    "SP-300 km ~568 / Trevo de acesso a Bento de Abreu (Infosiga)",
  ],
  rural: [
    "Vicinal Eugênio Salesse (Bento de Abreu a Valparaíso)",
    "Vicinal Bento de Abreu a Lucélia — cluster de propriedades rurais",
    "Bacia do Rio Aguapeí",
  ],
  eventos: [
    {
      nome: "Safra de Cana (Pico de Moagem)",
      inicio: "07-01",
      fim: "10-15",
      pesoSAT: 4,
    },
  ],
  obs: "O menor município da Companhia (~2.606 hab. Censo 2022); roteiro simplificado focado em rural e visibilidade no trevo de acesso. Bairros devem ser apenas Centro e Zona Rural. Sem agências bancárias.",
};
