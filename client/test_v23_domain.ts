import { MissionTimelineHelper, type MissionTimeline, type FaseOperacional } from "./src/lib/domain/missionTimeline";
import { calcularHashPayload, type DirectivePayload } from "./src/lib/domain/directivePayload";

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
  console.log("=== INICIANDO TESTES DO DOMÍNIO DA V23 ===");

  // ─── Teste 1: Virada de Meia-Noite ──────────────────────────────────────────

  const faseMeiaNoite: FaseOperacional = {
    nome: "Turno Noturno",
    tipo: "RESTRICAO",
    inicio: "23:00",
    fim: "02:00",
  };

  const timelineMeiaNoite: MissionTimeline = {
    id: "t1",
    nome: "Timeline Noturna",
    fases: [faseMeiaNoite],
  };

  const helperMeiaNoite = new MissionTimelineHelper(timelineMeiaNoite);

  // 23:30 = 23 * 60 + 30 = 1410
  assert(
    helperMeiaNoite.buscarFasesAtivas(1410).length === 1,
    "Fase ativa às 23:30 (dentro da janela antes da meia-noite)"
  );

  // 01:00 = 60
  assert(
    helperMeiaNoite.buscarFasesAtivas(60).length === 1,
    "Fase ativa às 01:00 (dentro da janela após a meia-noite)"
  );

  // 03:00 = 180
  assert(
    helperMeiaNoite.buscarFasesAtivas(180).length === 0,
    "Nenhuma fase ativa às 03:00 (fora da janela)"
  );

  // ─── Teste 2: Sobreposição de Fases ─────────────────────────────────────────

  const faseMeta: FaseOperacional = {
    nome: "Meta Geral",
    tipo: "META",
    inicio: "15:00",
    fim: "23:00",
  };

  const faseRestricao: FaseOperacional = {
    nome: "QRV Total",
    tipo: "RESTRICAO",
    inicio: "20:45",
    fim: "21:30",
  };

  const timelineSobreposta: MissionTimeline = {
    id: "t2",
    nome: "Timeline Sobreposta",
    fases: [faseMeta, faseRestricao],
  };

  const helperSobreposta = new MissionTimelineHelper(timelineSobreposta);

  // 21:00 = 1260
  const ativas21 = helperSobreposta.buscarFasesAtivas(1260);
  assert(
    ativas21.length === 2,
    "Duas fases ativas simultaneamente às 21:00"
  );
  assert(
    ativas21.some(f => f.tipo === "META") && ativas21.some(f => f.tipo === "RESTRICAO"),
    "Sobreposição contém tanto a META quanto a RESTRICAO"
  );

  // 16:00 = 960
  const ativas16 = helperSobreposta.buscarFasesAtivas(960);
  assert(
    ativas16.length === 1,
    "Apenas uma fase ativa às 16:00"
  );
  assert(
    ativas16[0].tipo === "META",
    "Fase ativa às 16:00 é do tipo META"
  );

  // ─── Teste 3: Hashing Canônico Determinístico ────────────────────────────────

  const payloadA: DirectivePayload = {
    versaoSchema: "1.1",
    criadoEmISO: "2026-06-24T17:00:00Z",
    focosDiretivas: [
      {
        id: "f1",
        nome: "Diretriz 1",
        origem: "ORDEM_SERVICO",
        posicao: "MEIO",
      }
    ]
  };

  // Objeto idêntico mas com chaves declaradas em outra ordem
  const payloadB: DirectivePayload = {
    focosDiretivas: [
      {
        nome: "Diretriz 1",
        origem: "ORDEM_SERVICO",
        posicao: "MEIO",
        id: "f1",
      }
    ],
    versaoSchema: "1.1",
    criadoEmISO: "2026-06-24T17:00:00Z",
  };

  const hashA = calcularHashPayload(payloadA);
  const hashB = calcularHashPayload(payloadB);

  assert(
    hashA === hashB,
    `Hashes idênticos para payloads semanticamente iguais (Hash: ${hashA})`
  );

  // Payload modificado
  const payloadC: DirectivePayload = {
    ...payloadA,
    criadoEmISO: "2026-06-24T17:01:00Z", // modificação
  };

  const hashC = calcularHashPayload(payloadC);

  assert(
    hashA !== hashC,
    `Hashes diferentes para payloads modificados (Hash A: ${hashA}, Hash C: ${hashC})`
  );

  // ─── Fim dos Testes ──────────────────────────────────────────────────────────

  console.log(`\n=== Testes de domínio finalizados com ${failures} falhas. ===`);
  process.exit(failures > 0 ? 1 : 0);
}

runTests();
