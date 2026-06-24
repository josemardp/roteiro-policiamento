import { gerarCPP } from "./src/lib/gerarCPP";
import { MUNICIPIOS_V33 } from "./src/lib/constants";
import type { DirectivePayload } from "./src/lib/domain/directivePayload";
import type { ConfiguracaoServico } from "./src/lib/types";

let failures = 0;

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`✕ FALHA: ${message}`);
    failures++;
  } else {
    console.log(`✓ OK: ${message}`);
  }
}

function runTests() {
  console.log("=== INICIANDO TESTES DO MOTOR V23 (PREFERÊNCIAS E DOUTRINA) ===");

  // ─── Cenário A: PREFERENCIA com Multiplicador Extremo e Alvo Único ───
  console.log("\n--- Cenário A: Peso Extremo e Alvo Único para PE (17:00 - 20:00) ---");

  const targetLocal = "Caixa Econômica Federal (Av. Marechal Floriano, 675)";

  const configCenarioA: ConfiguracaoServico = {
    data: "2026-06-24",
    horaInicio: "15:00",
    horaTermino: "23:00",
    tipoAtividade: "Radiopatrulha (RP)",
    municipios: ["Guararapes"],
    municipio: "Guararapes",
    tipoPoliciamento: "Misto (Urbano e Rural)",
    modalidadeGeracao: "automatica",
    blocosManuais: "",
    efetivo: "2",
    viatura: "VTR-01",
    prefixoUS: "01",
    focos: [],
  };

  const diretivasCenarioA: DirectivePayload = {
    versaoSchema: "1.1",
    criadoEmISO: "2026-06-24T17:00:00Z",
    focosDiretivas: [
      {
        id: "f_pref",
        tipo: "Foco Evento",
        posicao: "Automático",
        origem: "ORDEM_SERVICO",
        timeline: {
          id: "t_pref",
          nome: "Timeline Preferencia",
          fases: [
            {
              nome: "Foco CEF",
              tipo: "PREFERENCIA",
              inicio: "17:00",
              fim: "20:00",
              modificadores: [
                {
                  modalidade: "PE",
                  multiplicadorPeso: 100.0, // peso extremo para garantir a escolha de PE
                  prioridade: "CRITICA",
                  alvos: [
                    {
                      tipo: "PONTO_EXISTENTE",
                      textoOriginal: targetLocal,
                      confiancaMatch: 1.0,
                    }
                  ]
                }
              ]
            }
          ]
        }
      }
    ]
  };

  const resA = gerarCPP({
    configuracao: configCenarioA,
    municipios: MUNICIPIOS_V33,
    diretivas: diretivasCenarioA
  });

  assert(resA.blocos.length > 0, "Roteiro do Cenário A gerado com sucesso");
  console.log("Cenário A Blocos:", resA.blocos.map(b => `${b.horaInicio}-${b.horaFim} (${b.modalidade}): ${b.local}`));

  // Validar blocos iniciados na janela 17:00 - 20:00 (17:00 = 1020 min, 20:00 = 1200 min)
  // Devido ao multiplicador extremo, a modalidade deve ser PE e o local deve ser a Caixa Econômica.
  let todosPE = true;
  let todosNaCEF = true;
  let blocosNaJanela = 0;

  for (const b of resA.blocos) {
    const [h, m] = b.horaInicio.split(":").map(Number);
    const min = h * 60 + m;
    if (min >= 1020 && min < 1200) {
      // Exclui refeição ou blocos fixos se caírem no meio (embora com peso 100 de PE a prioridade é total)
      if (b.modalidade === "REF") continue;
      
      blocosNaJanela++;
      if (b.modalidade !== "PE") {
        todosPE = false;
        console.error(`Bloco às ${b.horaInicio} tem modalidade "${b.modalidade}", esperava "PE"`);
      }
      if (b.local !== targetLocal) {
        todosNaCEF = false;
        console.error(`Bloco às ${b.horaInicio} tem local "${b.local}", esperava "${targetLocal}"`);
      }
    }
  }

  assert(blocosNaJanela > 0, `Encontrados ${blocosNaJanela} blocos na janela preferencial`);
  assert(todosPE, "Multiplicador de peso de 100.0 garantiu a seleção da modalidade PE na janela");
  assert(todosNaCEF, "Filtragem de alvos da diretriz forçou a escolha do local preferencial Caixa Econômica Federal");


  // ─── Cenário B: CONTEXTO com Foco Comercial e Risco de Aglomeração ───
  console.log("\n--- Cenário B: CONTEXTO Comercial e Criticidade Alta (16:00 - 19:00) ---");

  const configCenarioB: ConfiguracaoServico = {
    data: "2026-06-24",
    horaInicio: "15:00",
    horaTermino: "23:00",
    tipoAtividade: "Radiopatrulha (RP)",
    municipios: ["Guararapes"],
    municipio: "Guararapes",
    tipoPoliciamento: "Misto (Urbano e Rural)",
    modalidadeGeracao: "automatica",
    blocosManuais: "",
    efetivo: "2",
    viatura: "VTR-01",
    prefixoUS: "01",
    focos: [],
  };

  const diretivasCenarioB: DirectivePayload = {
    versaoSchema: "1.1",
    criadoEmISO: "2026-06-24T17:00:00Z",
    focosDiretivas: [
      {
        id: "f_ctx",
        tipo: "Foco Evento",
        posicao: "Automático",
        origem: "ORDEM_SERVICO",
        timeline: {
          id: "t_ctx",
          nome: "Timeline Contexto",
          fases: [
            {
              nome: "Turno Comercial",
              tipo: "CONTEXTO",
              inicio: "16:00",
              fim: "19:00",
              contexto: {
                evento: "Grande fluxo comercial",
                criticidade: "ALTA",
                riscoAglomeracao: true,
                focoEspecifico: "COMERCIAL",
              }
            }
          ]
        }
      }
    ]
  };

  const resB = gerarCPP({
    configuracao: configCenarioB,
    municipios: MUNICIPIOS_V33,
    diretivas: diretivasCenarioB
  });

  assert(resB.blocos.length > 0, "Roteiro do Cenário B gerado com sucesso");
  console.log("Cenário B Blocos:", resB.blocos.map(b => `${b.horaInicio}-${b.horaFim} (${b.modalidade}): ${b.local}`));

  // No contexto comercial com criticidade alta e risco de aglomeração,
  // os pesos de POST e PE são multiplicados por 1.5 e aumentados em +5 (+3 do risco de aglomeração, +2 de criticidade ALTA).
  // Esperamos que a maioria dos blocos na janela sejam de policiamento urbano ostensivo/estacionamento (POST ou PE)
  let blocosDoutrina = 0;
  let blocosPostOuPe = 0;

  for (const b of resB.blocos) {
    const [h, m] = b.horaInicio.split(":").map(Number);
    const min = h * 60 + m;
    if (min >= 16 * 60 && min < 19 * 60) {
      if (b.modalidade === "REF") continue;
      blocosDoutrina++;
      if (b.modalidade === "POST" || b.modalidade === "PE") {
        blocosPostOuPe++;
      }
    }
  }

  const taxaPostPe = blocosPostOuPe / blocosDoutrina;
  assert(taxaPostPe >= 0.5, `Taxa de blocos de POST/PE na janela comercial foi de ${(taxaPostPe * 100).toFixed(1)}% (esperado >= 50%)`);

  console.log(`\n=== Testes de preferências finalizados com ${failures} falhas. ===`);
  process.exit(failures > 0 ? 1 : 0);
}

runTests();
