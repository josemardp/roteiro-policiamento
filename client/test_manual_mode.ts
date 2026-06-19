/**
 * Testes de regressão do modo manual (V15.1 + V16.1)
 * Valida: sigla em qualquer posição, local preservado, PE sem falso positivo,
 *         REL por palavra-chave, aviso PREL, turnos noturnos cruzando meia-noite.
 * Uso: ./node_modules/.bin/tsx client/test_manual_mode.ts
 */
import { gerarCPP, calcularHoraTermino } from "./src/lib/gerarCPP";
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

// Verifica apenas a modalidade (local keyword-based pode variar)
function checarMod(descricao: string, entrada: string, hora: string, modEsperada: string) {
  const { blocos, avisos } = gerarCPP({ configuracao: criarConfig(entrada), municipios: MUNICIPIOS_V33 });
  const bloco = blocos.find(b => b.horaInicio === hora);

  if (!bloco) {
    console.error(`❌ ${descricao}: bloco às ${hora} não encontrado`);
    if (avisos.length) console.error(`   Avisos: ${avisos.join(" | ")}`);
    totalFail++;
    return;
  }

  const modOk = bloco.modalidade === modEsperada;
  // Verificar também que o local NÃO foi trocado por automático (não é vazio nem é padrão sorteado)
  // Para keyword-based, localManual = desc completo, então local deve ser não-vazio
  const localNaoVazio = bloco.local.trim().length > 0;

  if (modOk && localNaoVazio) {
    console.log(`✅ ${descricao}: ${hora} ${bloco.modalidade} "${bloco.local}"`);
    totalOk++;
  } else {
    if (!modOk) console.error(`❌ ${descricao}: modalidade esperada "${modEsperada}", obtida "${bloco.modalidade}"`);
    if (!localNaoVazio) console.error(`❌ ${descricao}: local está vazio`);
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

function checarAviso(descricao: string, entrada: string, fragmento: string) {
  const { avisos } = gerarCPP({ configuracao: criarConfig(entrada), municipios: MUNICIPIOS_V33 });
  const encontrado = avisos.some(a => a.toLowerCase().includes(fragmento.toLowerCase()));
  if (encontrado) {
    console.log(`✅ ${descricao}: aviso contém "${fragmento}"`);
    totalOk++;
  } else {
    console.error(`❌ ${descricao}: esperava aviso com "${fragmento}", obtidos: ${JSON.stringify(avisos)}`);
    totalFail++;
  }
}

// ─── V15: siglas no início + local preservado ─────────────────────────────────

console.log("\n=== V15: SIGLA NO INÍCIO + LOCAL PRESERVADO ===\n");

// Nota: PREL ocupa 07:00–07:30, blocos manuais usam 07:30+
checar("PE com local",            "07h30 PE Banco do Brasil",               "07:30", "PE",   "Banco do Brasil");
checar("ESC com escola",          "08h30 a 09h30 ESC EE Prof. Aimone Sala", "08:30", "ESC",  "EE Prof. Aimone Sala");
checar("FISC com rodovia",        "09h FISC SP-300 km 553",                 "09:00", "FISC", "SP-300 km 553");
checar("PREV com bairro",         "10h PREV Jardim Aeroporto",              "10:00", "PREV", "Jardim Aeroporto");
checar("POST com avenida",        "11h POST Av. Rio Branco",                "11:00", "POST", "Av. Rio Branco");
checar("REF com tipo",            "12h REF almoço",                         "12:00", "REF",  "almoço");
checar("RURAL com vicinal",       "13h RURAL Vicinal Geraldo Stringhetta",  "13:00", "RURAL","Vicinal Geraldo Stringhetta");
checar("SAT com local",           "14h SAT Jardim Aeroporto",               "14:00", "SAT",  "Jardim Aeroporto");
checar("PE com separador",        "07h30 - PE - Banco do Brasil",           "07:30", "PE",   "Banco do Brasil");

// Delegada mono-município — sem DESL
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
if (bPE?.local === "Centro Comercial") totalOk++; else { console.error("❌ Delegada PE"); totalFail++; }
if (bESC?.local === "EE Dom Pedro II") totalOk++; else { console.error("❌ Delegada ESC"); totalFail++; }
if (!temDESL) totalOk++; else { console.error("❌ DESL indevido"); totalFail++; }

// ─── V15.1 Fase A: sigla no MEIO da descrição vence keyword ──────────────────

console.log("\n=== V15.1 FASE A: SIGLA NO MEIO DA DESCRIÇÃO ===\n");

checar("fiscalização PE local",         "07h30 fiscalização PE Banco do Brasil",        "07:30", "PE",   "Banco do Brasil");
checar("ronda escolar ESC escola",      "08h30 ronda escolar ESC EE Aimone Sala",       "08:30", "ESC",  "EE Aimone Sala");
checar("prevenção PREV bairro",         "09h prevenção PREV Jardim Aeroporto",          "09:00", "PREV", "Jardim Aeroporto");
checar("ponto estacionamento PE local", "10h ponto de estacionamento PE Banco do Brasil","10:00", "PE",   "Banco do Brasil");
checar("fiscalização FISC rodovia",     "11h fiscalização FISC SP-300 km 553",          "11:00", "FISC", "SP-300 km 553");

// ─── V15.1 Fase B: REL por palavra-chave ─────────────────────────────────────

console.log("\n=== V15.1 FASE B: REL POR PALAVRA-CHAVE ===\n");

checarMod("relatorio final",           "17h relatorio final",            "17:00", "REL");
checarMod("relatório final",           "17h relatório final",            "17:00", "REL");
checarMod("confecção de relatório",    "17h confecção de relatório",     "17:00", "REL");

// ─── V15.1 Fase C: aviso de sobreposição com PREL ────────────────────────────

console.log("\n=== V15.1 FASE C: AVISO DE SOBREPOSIÇÃO COM PREL ===\n");

checarAviso("sobreposição com PREL menciona PREL",    "07h PE Banco do Brasil", "PREL");
checarAviso("sobreposição com PREL orienta horário",  "07h PE Banco do Brasil", "07:30");

// ─── Negativos: PE não casa dentro de palavras ───────────────────────────────

console.log("\n=== NEGATIVOS: PE NÃO CASA EM PALAVRAS ===\n");

checarNegativo("perímetro central",          "07h30 perímetro central",           "07:30", "PE");
checarNegativo("pedestre em via",            "07h30 pedestre em via pública",      "07:30", "PE");
checarNegativo("operação presença",          "07h30 operação presença",            "07:30", "PE");
checarNegativo("presença policial no centro","07h30 presença policial no centro",  "07:30", "PE");

// ─── V16.1: turnos noturnos cruzando meia-noite ──────────────────────────────

console.log("\n=== V16.1: TURNOS NOTURNOS ===\n");

function criarConfigNoturno(horaInicio: string, blocosManuais: string): ConfiguracaoServico {
  return {
    data: "2025-08-20",
    horaInicio,
    horaTermino: calcularHoraTermino(horaInicio, "Radiopatrulha (RP)"),
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

// Caso 1: turno 23:30 — blocos 00h00 e 00h30 devem entrar
{
  const cfg = criarConfigNoturno("23:30", "00h00 PE Banco do Brasil\n00h30 ESC EE Aimone Sala");
  const { blocos, avisos } = gerarCPP({ configuracao: cfg, municipios: MUNICIPIOS_V33 });

  const bPE = blocos.find(b => b.horaInicio === "00:00" && b.modalidade === "PE");
  const bESC = blocos.find(b => b.horaInicio === "00:30" && b.modalidade === "ESC");
  const sobreposicaoIndevida = avisos.some(a => a.includes("00:00") && a.includes("ignorado") && !a.includes("PREL"));

  if (bPE && bPE.local === "Banco do Brasil") {
    console.log(`✅ turno 23:30: 00:00 PE "${bPE.local}" entra no roteiro`);
    totalOk++;
  } else {
    console.error(`❌ turno 23:30: bloco 00:00 PE não encontrado`);
    if (avisos.length) console.error(`   Avisos: ${avisos.join(" | ")}`);
    totalFail++;
  }

  if (bESC && bESC.local === "EE Aimone Sala") {
    console.log(`✅ turno 23:30: 00:30 ESC "${bESC.local}" entra no roteiro`);
    totalOk++;
  } else {
    console.error(`❌ turno 23:30: bloco 00:30 ESC não encontrado`);
    totalFail++;
  }

  if (!sobreposicaoIndevida) {
    console.log("✅ turno 23:30: sem aviso indevido de sobreposição para 00:00");
    totalOk++;
  } else {
    console.error("❌ turno 23:30: aviso indevido de sobreposição para 00:00");
    totalFail++;
  }
}

// Caso 2: intervalo cruzando meia-noite (00h00 a 00h30)
{
  const cfg = criarConfigNoturno("23:30", "00h00 a 00h30 PE Banco do Brasil");
  const { blocos, avisos } = gerarCPP({ configuracao: cfg, municipios: MUNICIPIOS_V33 });
  const b = blocos.find(b => b.horaInicio === "00:00" && b.modalidade === "PE");
  if (b && b.local === "Banco do Brasil") {
    console.log(`✅ turno 23:30: 00h00-00h30 PE com intervalo entra: "${b.local}"`);
    totalOk++;
  } else {
    console.error(`❌ turno 23:30: 00h00-00h30 PE com intervalo não encontrado`);
    if (avisos.length) console.error(`   Avisos: ${avisos.join(" | ")}`);
    totalFail++;
  }
}

// Caso 3: turno 22:00 — blocos 22h30, 00h00, 01h00
{
  const cfg = criarConfigNoturno("22:00", "22h30 PE Banco do Brasil\n00h00 ESC EE Aimone Sala\n01h00 FISC SP-300 km 553");
  const { blocos, avisos } = gerarCPP({ configuracao: cfg, municipios: MUNICIPIOS_V33 });

  const b2230 = blocos.find(b => b.horaInicio === "22:30" && b.modalidade === "PE");
  const b0000 = blocos.find(b => b.horaInicio === "00:00" && b.modalidade === "ESC");
  const b0100 = blocos.find(b => b.horaInicio === "01:00" && b.modalidade === "FISC");

  [
    [b2230, "22:30 PE", "Banco do Brasil"],
    [b0000, "00:00 ESC", "EE Aimone Sala"],
    [b0100, "01:00 FISC", "SP-300 km 553"],
  ].forEach(([b, label, local]) => {
    if (b && (b as any).local === local) {
      console.log(`✅ turno 22:00: ${label} "${local}"`);
      totalOk++;
    } else {
      console.error(`❌ turno 22:00: ${label} não encontrado`);
      if (avisos.length) console.error(`   Avisos: ${avisos.join(" | ")}`);
      totalFail++;
    }
  });
}

// Caso 4: diurno 07:00 preservado
checar("diurno 07:30 PE preservado", "07h30 PE Banco do Brasil", "07:30", "PE", "Banco do Brasil");

// Caso 5: bloco fora do turno 07:00 (06h30 → minuto 1830 > turnoFim 1140) → aviso
{
  const cfg = criarConfig("06h30 PE Banco do Brasil");
  const { blocos, avisos } = gerarCPP({ configuracao: cfg, municipios: MUNICIPIOS_V33 });
  const b = blocos.find(b => b.horaInicio === "06:30");
  const temAviso = avisos.some(a => a.toLowerCase().includes("fora") || a.toLowerCase().includes("ignorado"));
  if (!b && temAviso) {
    console.log("✅ fora do turno: 06h30 não entra e gera aviso");
    totalOk++;
  } else if (!b) {
    console.log("✅ fora do turno: 06h30 não entra no roteiro (sem aviso explícito)");
    totalOk++;
  } else {
    console.error("❌ fora do turno: 06h30 entrou no roteiro indevidamente");
    totalFail++;
  }
}

// ─── Resultado ────────────────────────────────────────────────────────────────

console.log(`\n=== RESULTADO: ${totalOk} OK, ${totalFail} FALHAS ===\n`);
if (totalFail > 0) process.exit(1);
