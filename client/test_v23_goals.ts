import { gerarCPP, obterCoordenadasLocal } from "./src/lib/gerarCPP";
import { avaliarScoreGlobal, isObjetivoCumprido } from "./src/lib/scoreRoteiro";
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
  console.log("=== INICIANDO TESTES DO MOTOR V23 (CORREDORES, METAS E OBJETIVOS) ===");

  const targetLocal = "Caixa Econômica Federal (Av. Marechal Floriano, 675)";
  const altLocal = "Bradesco (Rua Marechal Deodoro, 1021)";
  
  const coordCEF = obterCoordenadasLocal(targetLocal, "Guararapes");
  const coordBradesco = obterCoordenadasLocal(altLocal, "Guararapes");

  // ─── Cenário A: Corredores Operacionais e Metas ───
  console.log("\n--- Cenário A: Corredor Operacional Bancário e Meta de Mínimo de Visitas ---");

  const configA: ConfiguracaoServico = {
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

  const diretivasA: DirectivePayload = {
    versaoSchema: "1.1",
    criadoEmISO: "2026-06-24T17:00:00Z",
    focosDiretivas: [
      {
        id: "f_corredor_meta",
        tipo: "Foco Evento",
        posicao: "Automático",
        origem: "ORDEM_SERVICO",
        // Corredor operacional contendo CEF e Bradesco
        corredoresOperacionais: [
          {
            id: "corr_bancario",
            nome: "Corredor Bancário",
            origem: { lat: coordCEF.lat ?? -21.26, lng: coordCEF.lng ?? -50.64 },
            destino: { lat: coordBradesco.lat ?? -21.262, lng: coordBradesco.lng ?? -50.641 },
            raioMetros: 500,
            prioridade: "ALTA",
          }
        ],
        // Preferência e meta na mesma janela
        timeline: {
          id: "t_meta",
          nome: "Timeline Meta e Pref",
          fases: [
            {
              nome: "Foco CEF",
              tipo: "PREFERENCIA",
              inicio: "17:00",
              fim: "20:00",
              modificadores: [
                {
                  modalidade: "PE",
                  multiplicadorPeso: 10.0,
                  prioridade: "ALTA",
                  alvos: [
                    {
                      tipo: "PONTO_EXISTENTE",
                      textoOriginal: targetLocal,
                      confiancaMatch: 1.0,
                    }
                  ]
                }
              ]
            },
            {
              nome: "Visitas Minimas Guararapes",
              tipo: "META",
              inicio: "17:00",
              fim: "20:00",
              metas: {
                minimoVisitas: 3,
                municipioPreferencial: "Guararapes"
              }
            }
          ]
        }
      }
    ]
  };

  const resA = gerarCPP({
    configuracao: configA,
    municipios: MUNICIPIOS_V33,
    diretivas: diretivasA
  });

  assert(resA.blocos.length > 0, "Roteiro do Cenário A gerado com sucesso");
  console.log("Cenário A Blocos:", resA.blocos.map(b => `${b.horaInicio}-${b.horaFim} (${b.modalidade}) lat=${b.lat} lng=${b.lng}: ${b.local}`));

  // Validar se os blocos próximos ao corredor receberam bonificação no score
  // E validar se a meta de visitas foi pontuada.
  let blocosNoCorredor = 0;
  for (const b of resA.blocos) {
    if (b.modalidade === "PREL" || b.modalidade === "REL" || b.modalidade === "DESL" || b.modalidade === "REF") {
      continue;
    }
    // O corredor cobre CEF e Bradesco. Como demos prioridade extrema para CEF no PE, a maioria dos blocos na janela serão lá.
    if (b.local.includes("Caixa Econômica") || b.local.includes("Bradesco")) {
      blocosNoCorredor++;
    }
  }

  assert(blocosNoCorredor >= 2, `Cenário A: Esperava pelo menos 2 blocos de patrulhamento no corredor, obteve ${blocosNoCorredor}`);

  const ctxScoreA = {
    municipios: ["Guararapes" as any],
    turnoInicioMin: 900, // 15:00
    diretivas: diretivasA
  };
  const scoreComDiretivas = avaliarScoreGlobal(resA.blocos, ctxScoreA);
  const scoreSemDiretivas = avaliarScoreGlobal(resA.blocos, { ...ctxScoreA, diretivas: undefined });

  console.log(`Score com diretivas: ${scoreComDiretivas.toFixed(1)}, sem diretivas: ${scoreSemDiretivas.toFixed(1)}`);
  assert(scoreComDiretivas > scoreSemDiretivas + 100, "Cenário A: O score com diretivas é substancialmente maior devido ao bônus do corredor e meta");


  // ─── Cenário B: Objetivo de Permanência Persistente (Contiguidade) ───
  console.log("\n--- Cenário B: Objetivo Persistente de Permanência Contínua (PE Caixa Econômica, 18:00 - 21:00, 120 min) ---");

  const configB: ConfiguracaoServico = {
    data: "2026-06-24",
    horaInicio: "16:00",
    horaTermino: "00:00",
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

  const diretivasB: DirectivePayload = {
    versaoSchema: "1.1",
    criadoEmISO: "2026-06-24T17:00:00Z",
    focosDiretivas: [
      {
        id: "f_persistente",
        tipo: "Foco Evento",
        posicao: "Automático",
        origem: "ORDEM_SERVICO",
        // Objetivo de permanecer pelo menos 120 minutos (4 blocos) no PE CEF
        objetivosPersistentes: [
          {
            id: "obj_cef_120m",
            localId: targetLocal,
            inicio: "18:00",
            fim: "21:00",
            permanenciaMinimaMinutos: 120,
            modalidade: "PE"
          }
        ],
        timeline: {
          id: "t_restricao",
          nome: "Timeline Restrição",
          fases: [
            // Suspende refeição no miolo para garantir que refeições não quebrem a contiguidade do objetivo de 120min
            {
              nome: "Sem Refeição no Pico",
              tipo: "RESTRICAO",
              inicio: "18:00",
              fim: "21:00",
              restricoesDuras: {
                suspendeRefeicao: true
              }
            }
          ]
        }
      }
    ]
  };

  const resB = gerarCPP({
    configuracao: configB,
    municipios: MUNICIPIOS_V33,
    diretivas: diretivasB
  });

  assert(resB.blocos.length > 0, "Roteiro do Cenário B gerado com sucesso");
  console.log("Cenário B Blocos:", resB.blocos.map(b => `${b.horaInicio}-${b.horaFim} (${b.modalidade}): ${b.local}`));

  // Verificar se o objetivo persistente foi cumprido e se há contiguidade
  const objetivoObj = diretivasB.focosDiretivas[0].objetivosPersistentes![0];
  const cumprido = isObjetivoCumprido(objetivoObj, resB.blocos);
  
  assert(cumprido, "Cenário B: O objetivo de permanência contínua de 120 min na Caixa Econômica foi satisfeito");

  // Validar manualmente que há pelo menos 120 min contínuos de PE na Caixa Econômica
  let maxStretch = 0;
  let currentStretch = 0;
  for (const b of resB.blocos) {
    if (b.modalidade === "PE" && b.local === targetLocal) {
      currentStretch += 30;
      if (currentStretch > maxStretch) {
        maxStretch = currentStretch;
      }
    } else {
      currentStretch = 0;
    }
  }

  assert(maxStretch >= 120, `Cenário B: A maior sequência contígua de PE na CEF foi de ${maxStretch} minutos (esperado >= 120)`);

  console.log(`\n=== Testes de metas finalizados com ${failures} falhas. ===`);
  process.exit(failures > 0 ? 1 : 0);
}

runTests();
