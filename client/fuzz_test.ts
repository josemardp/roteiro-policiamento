import { gerarCPP } from "./src/lib/gerarCPP";
import { MUNICIPIOS_V33, DURACAO_TURNO_MIN } from "./src/lib/constants";
import type { ConfiguracaoServico, Municipio, TipoAtividade } from "./src/lib/types";

function toMin(h: string): number {
  const [hrs, mins] = h.split(":").map(Number);
  return hrs * 60 + mins;
}

function runFuzzTests() {
  const munsList: Municipio[] = ["Valparaíso", "Guararapes", "Rubiácea", "Bento de Abreu"];
  const atividades: TipoAtividade[] = [
    "Radiopatrulha (RP)",
    "CGP",
    "CFP",
    "Supervisor Regional",
    "Atividade Delegada",
    "Comando Delegada",
    "CGP Delegada",
    "DEJEM",
    "Comando DEJEM",
    "CGP DEJEM",
  ];

  let testCount = 0;
  let violations = 0;

  console.log("=== INICIANDO FUZZ DE INVARIANTES DO CPP ===");

  for (const tipo of atividades) {
    const duracaoEsperada = DURACAO_TURNO_MIN[tipo];
    for (let numMuns = 1; numMuns <= 4; numMuns++) {
      for (const horaInicio of ["07:00", "19:00", "22:00", "00:00", "04:30"]) {
        for (const data of ["2026-03-15", "2026-08-15", "2026-11-20"]) {
          testCount++;

          const selectedMuns: Municipio[] = [];
          const tempMuns = [...munsList];
          for (let m = 0; m < numMuns; m++) {
            const idx = (tipo.length + numMuns + m) % tempMuns.length;
            selectedMuns.push(tempMuns.splice(idx, 1)[0]);
          }

          // Test with single focus
          const configSingle: ConfiguracaoServico = {
            tipoAtividade: tipo,
            municipios: selectedMuns,
            tipoPoliciamento: "Urbano",
            data,
            horaInicio,
            horaTermino: "",
            modalidadeGeracao: "automatica",
            blocosManuais: "",
            efetivo: "3 PMs",
            viatura: "I-02501",
            prefixoUS: "US-01",
          };

          // Test with multi focuses
          const configMulti: ConfiguracaoServico = {
            ...configSingle,
            tipoPoliciamento: "Urbano",
            focos: [
              { id: "1", tipo: "Foco Escolar", posicao: "Começo", percentual: 30 },
              { id: "2", tipo: "Foco Rural", posicao: "Fim", percentual: 70 }
            ]
          };

          for (const config of [configSingle, configMulti]) {
            const result = gerarCPP({ configuracao: config, municipios: MUNICIPIOS_V33 });
            const { blocos, avisos } = result;

            let erroRoteiro = false;

            let somaTotal = 0;
            for (const b of blocos) {
              const hInicioMin = toMin(b.horaInicio);
              const hFimMin = toMin(b.horaFim);
              const dur = (hFimMin - hInicioMin + 1440) % 1440;
              somaTotal += dur === 0 && (b.modalidade === "REF" || b.modalidade === "POST" || b.modalidade === "RURAL") ? 0 : (dur || 1440);
            }
            if (somaTotal !== duracaoEsperada) {
              console.error(`[FALHA DE SOMA] Tipo: ${tipo}. Soma = ${somaTotal}, Esperado = ${duracaoEsperada}`);
              erroRoteiro = true;
            }

            for (let i = 0; i < blocos.length; i++) {
              const b = blocos[i];
              if (i > 0 && blocos[i - 1].horaFim !== b.horaInicio) {
                console.error(`[FALHA DE CONTIGUIDADE] Desconexão entre blocos: ${blocos[i - 1].horaFim} -> ${b.horaInicio}`);
                erroRoteiro = true;
              }
            }

            if (erroRoteiro) violations++;
          }
        }
      }
    }
  }

  console.log(`Total de Roteiros Testados (Multiplicado por 2 modos): ${testCount * 2}`);
  console.log(`Total de Violações de Invariantes: ${violations}`);

  // Teste especifico Multi-Focos
  console.log(`\n=== TESTE MULTI-FOCOS ===`);
  const configMultiCheck: ConfiguracaoServico = {
    tipoAtividade: "Radiopatrulha (RP)",
    municipios: ["Valparaíso"],
    tipoPoliciamento: "Urbano",
    data: "2026-08-15",
    horaInicio: "19:00",
    horaTermino: "",
    modalidadeGeracao: "automatica",
    blocosManuais: "",
    efetivo: "",
    viatura: "",
    prefixoUS: "",
    focos: [
      { id: "1", tipo: "Foco Escolar", posicao: "Começo", percentual: 30 },
      { id: "2", tipo: "Rural", posicao: "Fim", percentual: 70 }
    ]
  };
  const resMulti = gerarCPP({ configuracao: configMultiCheck, municipios: MUNICIPIOS_V33 });
  
  // 12h = 720 min. 30% = ~216 min.
  // Bloco PREL é 30 min. Sobra 186.
  // Pelo menos os 2 primeiros blocos patrulhamento devem ser muito provavelmente ESC.
  // Os ultimos antes do REL (ultimos 70% ~ 500 min) devem ter forte presença de RURAL.
  
  const modalidadesInicio = resMulti.blocos.slice(1, 4).map(b => b.modalidade);
  const modalidadesFim = resMulti.blocos.slice(-5, -1).map(b => b.modalidade);
  
  console.log("Inicio do turno:", modalidadesInicio);
  console.log("Fim do turno:", modalidadesFim);
  
  if (modalidadesInicio.includes("ESC")) {
    console.log("-> OK: Foco Escolar no começo presente.");
  } else {
    console.log("-> AVISO: Foco Escolar não detectado no começo.");
  }
  
  if (modalidadesFim.includes("RURAL")) {
    console.log("-> OK: Foco Rural no fim presente.");
  } else {
    console.log("-> AVISO: Foco Rural não detectado no fim.");
  }

  console.log(`\nFuzz finalizado com ${violations} falhas.`);
  process.exit(violations > 0 ? 1 : 0);
}

runFuzzTests();
