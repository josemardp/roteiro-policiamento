/**
 * Testes de regressão do modo manual (V15)
 * Valida: reconhecimento de siglas, preservação de local, ausência de falsos positivos com PE.
 * Uso: ./node_modules/.bin/tsx client/test_manual_mode.ts
 */
import { gerarCPP } from "./src/lib/gerarCPP";
import { MUNICIPIOS_V33 } from "./src/lib/constants";
import type { ConfiguracaoServico } from "./src/lib/types";

function criarConfig(blocosManuais: string): ConfiguracaoServico {
  return {
    data: "2025-08-20",
    horaInicio: "07:00",
    horaTermino: "19:00",
    tipoAtividade: "Radiopatrulha (RP)",
    municipios: ["Guararapes"],
    municipio: "Guararapes",
    tipoPoliciamento: "Misto (Urbano e Rural)",
    modalidadeGeracao: "manual",
    blocosManuais,
    efetivo: "2",
    viatura: "VTR-01",
    prefixoUS: "01",
    focos: [],
    nomeEvento: "",
    localEvento: "",
  };
}

let totalOk = 0;
let totalFail = 0;

function checar(descricao: string, entrada: string, hora: string, modEsperada: string, localEsperado: string) {
  const { blocos, avisos } = gerarCPP({ configuracao: criarConfig(entrada), municipios: MUNICIPIOS_V33 });
  const bloco = blocos.find(b => b.horaInicio === hora);

  if (!bloco) {
    console.error(`❌ ${descricao}: bloco às ${hora} não encontrado`);
    if (avisos.length) console.error(`   Avisos: ${avisos.join(" | ")}`);
    totalFail++;
    return;
  }

  const modOk = bloco.modalidade === modEsperada;
  const localOk = bloco.local === localEsperado;

  if (modOk && localOk) {
    console.log(`✅ ${descricao}: ${hora} ${bloco.modalidade} "${bloco.local}"`);
    totalOk++;
  } else {
    if (!modOk) console.error(`❌ ${descricao}: modalidade esperada "${modEsperada}", obtida "${bloco.modalidade}"`);
    if (!localOk) console.error(`❌ ${descricao}: local esperado "${localEsperado}", obtido "${bloco.local}"`);
    totalFail++;
  }
}

function checarNegativo(descricao: string, entrada: string, hora: string, modNaoEsperada: string) {
  const { blocos } = gerarCPP({ configuracao: criarConfig(entrada), municipios: MUNICIPIOS_V33 });
  const bloco = blocos.find(b => b.horaInicio === hora);

  if (!bloco) {
    console.error(`❌ ${descricao}: bloco às ${hora} não encontrado`);
    totalFail++;
    return;
  }

  if (bloco.modalidade === modNaoEsperada) {
    console.error(`❌ ${descricao}: modalidade ${modNaoEsperada} não deveria ter sido inferida (obtida: "${bloco.modalidade}")`);
    totalFail++;
  } else {
    console.log(`✅ ${descricao}: corretamente NÃO inferiu ${modNaoEsperada} (obtida ${bloco.modalidade})`);
    totalOk++;
  }
}

// ─── Fase B + C: siglas e local preservado ────────────────────────────────────

console.log("\n=== TESTES DE SIGLA E LOCAL PRESERVADO ===\n");

// Nota: PREL automático ocupa 07:00–07:30, então blocos manuais usam 07:30+
checar("PE com local",            "07h30 PE Banco do Brasil",             "07:30", "PE",   "Banco do Brasil");
checar("ESC com escola",          "08h30 a 09h30 ESC EE Prof. Aimone Sala", "08:30", "ESC",  "EE Prof. Aimone Sala");
checar("FISC com rodovia",        "09h FISC SP-300 km 553",               "09:00", "FISC", "SP-300 km 553");
checar("PREV com bairro",         "10h PREV Jardim Aeroporto",            "10:00", "PREV", "Jardim Aeroporto");
checar("POST com avenida",        "11h POST Av. Rio Branco",              "11:00", "POST", "Av. Rio Branco");
checar("REF com tipo",            "12h REF almoço",                       "12:00", "REF",  "almoço");
checar("RURAL com vicinal",       "13h RURAL Vicinal Geraldo Stringhetta","13:00", "RURAL","Vicinal Geraldo Stringhetta");
checar("SAT com local",           "14h SAT Jardim Aeroporto",             "14:00", "SAT",  "Jardim Aeroporto");
checar("PE com separador",        "07h30 - PE - Banco do Brasil",         "07:30", "PE",   "Banco do Brasil");

// PE em modo Delegada (8h, mono-município) — sem DESL
const configDelegada: ConfiguracaoServico = {
  data: "2025-08-20",
  horaInicio: "07:00",
  horaTermino: "15:00",
  tipoAtividade: "Atividade Delegada",
  municipios: ["Guararapes"],
  municipio: "Guararapes",
  tipoPoliciamento: "Urbano",
  modalidadeGeracao: "manual",
  blocosManuais: "07h30 PE Centro Comercial\n09h ESC EE Dom Pedro II",
  efetivo: "2",
  viatura: "VTR-02",
  prefixoUS: "02",
  focos: [],
  nomeEvento: "",
  localEvento: "",
};
const { blocos: blocosDel } = gerarCPP({ configuracao: configDelegada, municipios: MUNICIPIOS_V33 });
const bPE = blocosDel.find(b => b.horaInicio === "07:30");
const bESC = blocosDel.find(b => b.horaInicio === "09:00");
const temDESL = blocosDel.some(b => b.modalidade === "DESL");
console.log(`${bPE?.local === "Centro Comercial" ? "✅" : "❌"} Delegada PE preserva local: "${bPE?.local}"`);
console.log(`${bESC?.local === "EE Dom Pedro II" ? "✅" : "❌"} Delegada ESC preserva local: "${bESC?.local}"`);
console.log(`${!temDESL ? "✅" : "❌"} Delegada mono-município sem DESL`);
if (bPE?.local === "Centro Comercial") totalOk++; else { console.error("❌"); totalFail++; }
if (bESC?.local === "EE Dom Pedro II") totalOk++; else { console.error("❌"); totalFail++; }
if (!temDESL) totalOk++; else { console.error("❌"); totalFail++; }

// ─── Fase B: negativos — PE não deve casar dentro de palavras ─────────────────

console.log("\n=== TESTES NEGATIVOS (PE não casa em palavras) ===\n");

checarNegativo("perímetro central",  "07h30 perímetro central",  "07:30", "PE");
checarNegativo("pedestre em via",    "07h30 pedestre em via pública", "07:30", "PE");
checarNegativo("operação presença",  "07h30 operação presença",  "07:30", "PE");

// ─── Resultado ────────────────────────────────────────────────────────────────

console.log(`\n=== RESULTADO: ${totalOk} OK, ${totalFail} FALHAS ===\n`);
if (totalFail > 0) process.exit(1);
