import type { MunicipioData } from "../types";

export const GUARARAPES: MunicipioData = {
  perfil: "urbano_medio",
  tipoPadrao: "Urbano",
  rodovias: [
    "SP-300 (Rodovia Marechal Rondon) — corta a cidade, km ~553",
    "SP-473 (Rodovia Deputado Jorge Maluly Neto) — acesso a Bilac",
  ],
  comercio: [
    "Av. Rio Branco (eixo comercial central)",
    "Av. Marechal Floriano (eixo comercial central)",
    "Centro (zona comercial de comércio geral)",
    "Zona Comercial do Jardim Acapulco (Rua Baguassu)",
  ],
  bairros: [
    "Centro",
    "Bairro Industrial",
    "Residencial Zancaner",
    "Jardim Dom Luiz Orione",
    "Conjunto Habitacional Dr. Clineu Almeida",
    "Conjunto Habitacional Guararapes III",
    "Jardim Aeroporto",
    "Jardim Continental",
  ],
  pontosPE: [
    "Praça Nossa Senhora da Conceição (Centro)",
    "Banco do Brasil (Praça Nossa Senhora da Conceição, 308)",
    "Bradesco (Rua Marechal Deodoro, 1021)",
    "Caixa Econômica Federal (Av. Marechal Floriano, 675)",
    "Lotérica Guararapes (Rua Prudente de Morais, s/n)",
    "Supermercado Bandeirantes (Centro)",
    "Santa Casa de Guararapes (Av. Marechal Floriano, 1602)",
  ],
  pontosFisc: [
    "Trevo de acesso à SP-300 (km 553)",
    "Trevo de acesso à SP-473",
    "Entrada principal pela Av. Rio Branco",
    "SP-300 km ~553 (Trecho crítico de acidentes - Infosiga)",
    "Rotas de fuga - Saídas para SP-300 (Prevenção a roubo a bancos de madrugada)",
  ],
  rural: [
    "Distrito de Ribeiro do Vale",
    "Estrada da Usina Unialco",
    "Estrada da Fazenda JBS",
    "Estrada Vicinal GRP-010 — Acesso a clusters agrícolas (cana/pasto)",
  ],
  eventos: [
    {
      nome: "FAPIG (Feira Agropecuária de Guararapes)",
      inicio: "11-15",
      fim: "11-23",
      pesoSAT: 5,
    },
    {
      nome: "Safra de Cana (Pico de Moagem - Entorno Industrial)",
      inicio: "07-01",
      fim: "10-15",
      pesoSAT: 3,
    },
  ],
  obs: "Cidade mais urbana e populosa (~31.043 hab. Censo 2022); possui o distrito de Ribeiro do Vale; sedia a Usina Unialco e frigorífico JBS. Pontos de trânsito e bancos integrados.",
};
