import { gerarCPP, planejarRefeicoes } from "./src/lib/gerarCPP";
import { ATIVIDADE_MONO_MUNICIPIO, MUNICIPIOS_V33, DURACAO_TURNO_MIN } from "./src/lib/constants";
import type { ConfiguracaoServico, Municipio, TipoAtividade } from "./src/lib/types";

function toMin(h: string): number {
  const [hrs, mins] = h.split(":").map(Number);
  return hrs * 60 + mins;
}

function semIds(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value, (key, val) => key === "id" ? undefined : val));
}

function minToHora(min: number): string {
  const normalizado = ((min % 1440) + 1440) % 1440;
  const h = Math.floor(normalizado / 60);
  const m = normalizado % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

const horasInicio = Array.from({ length: 48 }, (_, index) => {
  const min = index * 30;
  return minToHora(min);
});

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
      for (const horaInicio of horasInicio) {
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
            const resultRepetido = gerarCPP({ configuracao: config, municipios: MUNICIPIOS_V33 });
            const municipiosEfetivos = ATIVIDADE_MONO_MUNICIPIO.has(config.tipoAtividade)
              ? [config.municipios[0]]
              : config.municipios;

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
              if (b.ordem !== i) {
                console.error(`[FALHA DE ORDEM] Ordem ${b.ordem} fora da posição ${i}`);
                erroRoteiro = true;
              }
              const dur = (toMin(b.horaFim) - toMin(b.horaInicio) + 1440) % 1440;
              if (dur % 30 !== 0) {
                console.error(`[FALHA DE GRADE] Bloco ${b.modalidade} com duração ${dur}`);
                erroRoteiro = true;
              }
            }

            const primeiro = blocos[0];
            const ultimo = blocos[blocos.length - 1];
            // Para Supervisor Regional, PREL e REL ficam na base (municipioBase ?? municipiosEfetivos[0])
            const isSupReg = config.tipoAtividade === "Supervisor Regional";
            const baseMun = isSupReg
              ? (config.municipioBase ?? municipiosEfetivos[0])
              : municipiosEfetivos[0];
            if (primeiro?.modalidade !== "PREL" || primeiro?.municipio !== baseMun) {
              console.error(`[FALHA PREL] Esperado PREL em ${baseMun}, veio ${primeiro?.modalidade}/${primeiro?.municipio}`);
              erroRoteiro = true;
            }
            const expectedRelMun = isSupReg
              ? baseMun
              : municipiosEfetivos[municipiosEfetivos.length - 1];
            if (ultimo?.modalidade !== "REL" || ultimo?.municipio !== expectedRelMun) {
              console.error(`[FALHA REL] Esperado REL em ${expectedRelMun}, veio ${ultimo?.modalidade}/${ultimo?.municipio}`);
              erroRoteiro = true;
            }
            if (ATIVIDADE_MONO_MUNICIPIO.has(config.tipoAtividade)) {
              const munUnico = municipiosEfetivos[0];
              if (blocos.some(b => b.municipio !== munUnico) || blocos.some(b => b.modalidade === "DESL")) {
                console.error(`[FALHA DELEGADA] ${config.tipoAtividade} deve ficar em ${munUnico} e sem DESL`);
                erroRoteiro = true;
              }
              if (config.municipios.length > 1 && !avisos.some(a => a.includes("restrita a um município"))) {
                console.error(`[FALHA AVISO DELEGADA] Sem aviso para municípios extras em ${config.tipoAtividade}`);
                erroRoteiro = true;
              }
            }
            const turnoInicio = toMin(config.horaInicio);
            const turnoFim = turnoInicio + duracaoEsperada;
            const refsEsperadas = planejarRefeicoes(turnoInicio, turnoFim, duracaoEsperada);
            const refsGeradas = blocos.filter(b => b.modalidade === "REF");
            if (refsGeradas.length !== refsEsperadas.length) {
              console.error(`[FALHA REF] ${tipo} ${horaInicio}: esperadas ${refsEsperadas.length}, geradas ${refsGeradas.length}`);
              erroRoteiro = true;
            }
            refsGeradas.forEach((ref, index) => {
              const esperada = refsEsperadas[index];
              const refInicioAbs = turnoInicio + ((toMin(ref.horaInicio) - (turnoInicio % 1440) + 1440) % 1440);
              const refFimAbs = refInicioAbs + ((toMin(ref.horaFim) - toMin(ref.horaInicio) + 1440) % 1440 || 1440);
              if (!esperada || refInicioAbs !== esperada.alvoMin || !ref.local.includes(esperada.tipo)) {
                console.error(`[FALHA REF HORÁRIO] ${tipo} ${horaInicio}: REF ${ref.horaInicio}/${ref.local}, esperado ${esperada ? `${minToHora(esperada.alvoMin)} ${esperada.tipo}` : "nenhuma"}`);
                erroRoteiro = true;
              }
              if (
                refInicioAbs < turnoInicio + 30 ||
                refFimAbs > turnoFim - 30 ||
                refInicioAbs % 30 !== 0 ||
                refFimAbs % 30 !== 0
              ) {
                console.error(`[FALHA REF BOUNDS] ${tipo} ${horaInicio}: ${ref.horaInicio}-${ref.horaFim}`);
                erroRoteiro = true;
              }
            });
            if (JSON.stringify(semIds(blocos)) !== JSON.stringify(semIds(resultRepetido.blocos))) {
              console.error("[FALHA REPRODUTIBILIDADE] Mesma config gerou blocos diferentes ignorando id");
              erroRoteiro = true;
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
