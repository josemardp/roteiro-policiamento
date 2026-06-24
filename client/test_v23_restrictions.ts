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
  console.log("=== INICIANDO TESTES DE INTEGRAÇÃO V23 (RESTRIÇÕES DURAS) ===");

  // ─── Cenário 1: QRV Total das 20h45 às 21h30 (suspende refeições e veta deslocamento) ───
  console.log("\n--- Cenário 1: QRV Total (20:45 - 21:30) ---");

  const configCenario1: ConfiguracaoServico = {
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

  const diretivasCenario1: DirectivePayload = {
    versaoSchema: "1.1",
    criadoEmISO: "2026-06-24T17:00:00Z",
    focosDiretivas: [
      {
        id: "f1",
        tipo: "Foco Evento",
        posicao: "Automático",
        origem: "ORDEM_SERVICO",
        timeline: {
          id: "t1",
          nome: "Timeline QRV Total",
          fases: [
            {
              nome: "QRV Total",
              tipo: "RESTRICAO",
              inicio: "20:45",
              fim: "21:30",
              restricoesDuras: {
                vetaDeslocamento: true,
                suspendeRefeicao: true,
              }
            }
          ]
        }
      }
    ]
  };

  const res1 = gerarCPP({
    configuracao: configCenario1,
    municipios: MUNICIPIOS_V33,
    diretivas: diretivasCenario1
  });

  assert(res1.blocos.length > 0, "Roteiro do Cenário 1 gerado com sucesso");
  console.log("Cenário 1 Blocos:", res1.blocos.map(b => `${b.horaInicio}-${b.horaFim} (${b.modalidade}): ${b.local}`));

  // 1. Validar que nenhuma refeição (REF) ocorre na janela 20:45 - 21:30
  // 20:45 = 1245 min, 21:30 = 1290 min
  const refNaJanela = res1.blocos.filter(b => {
    if (b.modalidade !== "REF") return false;
    const [h, m] = b.horaInicio.split(":").map(Number);
    const min = h * 60 + m;
    return min >= 1245 && min < 1290;
  });
  assert(refNaJanela.length === 0, "Nenhuma refeição (REF) agendada na janela 20:45 - 21:30 (suspensa pela diretriz)");

  // 2. Validar que qualquer bloco iniciado dentro da janela (20:45 - 21:30) tem o mesmo local e coordenadas que o bloco anterior
  let vetoDeslocamentoOk = true;
  let blocoEncontrado = false;
  for (let i = 0; i < res1.blocos.length; i++) {
    const b = res1.blocos[i];
    const [h, m] = b.horaInicio.split(":").map(Number);
    const min = h * 60 + m;
    if (min >= 1245 && min < 1290) {
      blocoEncontrado = true;
      if (i > 0) {
        const prev = res1.blocos[i - 1];
        if (b.local !== prev.local || b.lat !== prev.lat || b.lng !== prev.lng || b.modalidade === "DESL") {
          vetoDeslocamentoOk = false;
          console.error(`Erro no veto de deslocamento às ${b.horaInicio}: local "${b.local}" vs anterior "${prev.local}"`);
        }
      }
    }
  }
  assert(blocoEncontrado, "Bloco(s) iniciado(s) dentro da janela 20:45 - 21:30 encontrado(s)");
  assert(vetoDeslocamentoOk, "Veto de deslocamento e preservação de local/coordenadas respeitados em todos os blocos na janela");


  // ─── Cenário 2: Prefeitura como PE Contínuo das 18h30 às 21h30 (localFixoId) ───
  console.log("\n--- Cenário 2: Prefeitura como PE Contínuo (18:30 - 21:30) ---");

  // Local fixo no PPI de Guararapes: "Praça Nossa Senhora da Conceição (Centro)"
  const targetLocal = "Praça Nossa Senhora da Conceição (Centro)";

  const configCenario2: ConfiguracaoServico = {
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

  const diretivasCenario2: DirectivePayload = {
    versaoSchema: "1.1",
    criadoEmISO: "2026-06-24T17:00:00Z",
    focosDiretivas: [
      {
        id: "f2",
        tipo: "Foco Evento",
        posicao: "Automático",
        origem: "ORDEM_SERVICO",
        timeline: {
          id: "t2",
          nome: "Timeline Local Fixo",
          fases: [
            {
              nome: "Prefeitura PE",
              tipo: "RESTRICAO",
              inicio: "18:30",
              fim: "21:30",
              restricoesDuras: {
                localFixoId: targetLocal,
                modalidadesPermitidas: ["PE"],
              }
            }
          ]
        }
      }
    ]
  };

  const res2 = gerarCPP({
    configuracao: configCenario2,
    municipios: MUNICIPIOS_V33,
    diretivas: diretivasCenario2
  });

  assert(res2.blocos.length > 0, "Roteiro do Cenário 2 gerado com sucesso");
  console.log("Cenário 2 Blocos:", res2.blocos.map(b => `${b.horaInicio}-${b.horaFim} (${b.modalidade}): ${b.local}`));

  // Verificar todos os blocos iniciados na janela 18:30 - 21:30
  // 18:30 = 1110 min, 21:30 = 1290 min
  let todosPesticinados = true;
  let todosNoLocalCorreto = true;
  let coordenadasCorretas = true;
  let blocosNaJanelaContador = 0;

  // Obter coordenadas esperadas do local
  const { lat: latEsp, lng: lngEsp } = { lat: -21.2542111, lng: -50.6439953 };

  for (const bloco of res2.blocos) {
    const [h, m] = bloco.horaInicio.split(":").map(Number);
    const min = h * 60 + m;
    if (min >= 1110 && min < 1290) {
      blocosNaJanelaContador++;
      if (bloco.modalidade !== "PE") {
        console.error(`Bloco às ${bloco.horaInicio} tem modalidade "${bloco.modalidade}", esperava "PE"`);
        todosPesticinados = false;
      }
      if (bloco.local !== targetLocal) {
        console.error(`Bloco às ${bloco.horaInicio} tem local "${bloco.local}", esperava "${targetLocal}"`);
        todosNoLocalCorreto = false;
      }
      if (bloco.lat !== latEsp || bloco.lng !== lngEsp) {
        console.error(`Bloco às ${bloco.horaInicio} tem coordenadas (${bloco.lat}, ${bloco.lng}), esperava (${latEsp}, ${lngEsp})`);
        coordenadasCorretas = false;
      }
    }
  }

  assert(blocosNaJanelaContador > 0, `Encontrados ${blocosNaJanelaContador} blocos iniciados dentro da janela 18:30 - 21:30`);
  assert(todosPesticinados, "Todos os blocos da janela têm a modalidade permitida PE");
  assert(todosNoLocalCorreto, `Todos os blocos da janela estão alocados no local fixo "${targetLocal}"`);
  assert(coordenadasCorretas, "Todos os blocos da janela têm as coordenadas do local fixo");

  console.log(`\n=== Testes de integração finalizados com ${failures} falhas. ===`);
  process.exit(failures > 0 ? 1 : 0);
}

runTests();
