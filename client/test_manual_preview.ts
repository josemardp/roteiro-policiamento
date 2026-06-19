/**
 * Testes da função analisarBlocosManuaisPreview (V16)
 * Uso: ./node_modules/.bin/tsx client/test_manual_preview.ts
 */
import { analisarBlocosManuaisPreview } from "./src/lib/gerarCPP";

let ok = 0;
let fail = 0;

function checar(
  desc: string,
  resultado: ReturnType<typeof analisarBlocosManuaisPreview>[number] | undefined,
  esperado: {
    status?: "ok" | "aviso" | "erro";
    modalidade?: string;
    local?: string;
    horaInicio?: string;
    mensagemContem?: string;
  }
) {
  if (!resultado) {
    console.error(`❌ ${desc}: linha não encontrada no resultado`);
    fail++;
    return;
  }
  const erros: string[] = [];
  if (esperado.status && resultado.status !== esperado.status)
    erros.push(`status: esperado "${esperado.status}", obtido "${resultado.status}"`);
  if (esperado.modalidade && resultado.modalidade !== esperado.modalidade)
    erros.push(`modalidade: esperado "${esperado.modalidade}", obtido "${resultado.modalidade}"`);
  if (esperado.local !== undefined && resultado.local !== esperado.local)
    erros.push(`local: esperado "${esperado.local}", obtido "${resultado.local}"`);
  if (esperado.horaInicio && resultado.horaInicio !== esperado.horaInicio)
    erros.push(`horaInicio: esperado "${esperado.horaInicio}", obtido "${resultado.horaInicio}"`);
  if (esperado.mensagemContem && !resultado.mensagem?.toLowerCase().includes(esperado.mensagemContem.toLowerCase()))
    erros.push(`mensagem deveria conter "${esperado.mensagemContem}", obtida: "${resultado.mensagem}"`);

  if (erros.length === 0) {
    console.log(`✅ ${desc}`);
    ok++;
  } else {
    erros.forEach(e => console.error(`❌ ${desc}: ${e}`));
    fail++;
  }
}

const TURNO = "07:00";

// ─── Caso 1: bloco PE válido ─────────────────────────────────────────────────

{
  const r = analisarBlocosManuaisPreview("07h30 PE Banco do Brasil", TURNO);
  checar("PE válido → ok", r[0], { status: "ok", modalidade: "PE", local: "Banco do Brasil", horaInicio: "07:30" });
}

// ─── Caso 2: bloco com horário de início e fim ────────────────────────────────

{
  const r = analisarBlocosManuaisPreview("08h30 a 09h30 ESC EE Aimone Sala", TURNO);
  checar("ESC com intervalo → ok", r[0], { status: "ok", modalidade: "ESC", local: "EE Aimone Sala", horaInicio: "08:30" });
}

// ─── Caso 3: PREL overlap (07h00) ───────────────────────────────────────────

{
  const r = analisarBlocosManuaisPreview("07h00 PE Banco do Brasil", TURNO);
  checar("PE às 07h → aviso PREL", r[0], { status: "aviso", mensagemContem: "PREL" });
}

// ─── Caso 4: PREL overlap (07h15) ───────────────────────────────────────────

{
  const r = analisarBlocosManuaisPreview("07h15 PREV Jardim", TURNO);
  checar("PREV às 07h15 → aviso PREL (mid-window)", r[0], { status: "aviso", mensagemContem: "07:30" });
}

// ─── Caso 5: sem horário → erro ──────────────────────────────────────────────

{
  const r = analisarBlocosManuaisPreview("PE Banco do Brasil", TURNO);
  checar("sem horário → erro", r[0], { status: "erro", mensagemContem: "horário" });
}

// ─── Caso 6: sem local → aviso ───────────────────────────────────────────────

{
  const r = analisarBlocosManuaisPreview("10h PREV", TURNO);
  checar("sem local → aviso", r[0], { status: "aviso", modalidade: "PREV", mensagemContem: "local" });
}

// ─── Caso 7: sigla no meio da descrição ──────────────────────────────────────

{
  const r = analisarBlocosManuaisPreview("11h fiscalização FISC SP-300 km 553", TURNO);
  checar("sigla no meio → FISC", r[0], { status: "ok", modalidade: "FISC", local: "SP-300 km 553" });
}

// ─── Caso 8: REL por keyword ─────────────────────────────────────────────────

{
  const r = analisarBlocosManuaisPreview("17h relatorio final", TURNO);
  checar("relatorio keyword → REL", r[0], { status: "ok", modalidade: "REL" });
}

// ─── Caso 9: múltiplas linhas → conta linhas ─────────────────────────────────

{
  const texto = "07h30 PE Banco do Brasil\n08h30 ESC EE Aimone Sala\n10h PREV Jardim Aeroporto";
  const r = analisarBlocosManuaisPreview(texto, TURNO);
  if (r.length === 3) {
    console.log(`✅ múltiplas linhas: ${r.length} itens`);
    ok++;
  } else {
    console.error(`❌ múltiplas linhas: esperado 3, obtido ${r.length}`);
    fail++;
  }
  checar("linha 2 ESC", r[1], { status: "ok", modalidade: "ESC" });
}

// ─── Caso 10: linha vazia ignorada ───────────────────────────────────────────

{
  const texto = "07h30 PE Banco do Brasil\n\n10h PREV Jardim";
  const r = analisarBlocosManuaisPreview(texto, TURNO);
  if (r.length === 2) {
    console.log(`✅ linha vazia ignorada: ${r.length} itens`);
    ok++;
  } else {
    console.error(`❌ linha vazia ignorada: esperado 2, obtido ${r.length}`);
    fail++;
  }
}

// ─── Caso 11: turno noturno (22:00) – PREL às 22h, bloco às 22h → aviso ─────

{
  const r = analisarBlocosManuaisPreview("22h PE Centro", "22:00");
  checar("turno noturno PREL overlap", r[0], { status: "aviso", mensagemContem: "PREL" });
}

// ─── Caso 12: turno noturno, bloco pós-PREL → ok ────────────────────────────

{
  const r = analisarBlocosManuaisPreview("22h30 PE Centro", "22:00");
  checar("turno noturno 22h30 → ok", r[0], { status: "ok", modalidade: "PE", local: "Centro" });
}

// ─── Resultado ───────────────────────────────────────────────────────────────

console.log(`\n=== PREVIEW: ${ok} OK, ${fail} FALHAS ===\n`);
if (fail > 0) process.exit(1);
