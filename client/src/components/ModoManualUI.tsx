/**
 * ModoManualUI — Painel de criação guiada de blocos manuais
 * Contém: guia visual, formulário, botões rápidos, textarea e prévia.
 * Não chama gerarCPP: apenas monta texto no textarea.
 */

import { useState, useMemo } from "react";
import { analisarBlocosManuaisPreview } from "@/lib/gerarCPP";

const SIGLAS = [
  { sigla: "PE",    nome: "Ponto de Estacionamento" },
  { sigla: "ESC",   nome: "Ronda Escolar" },
  { sigla: "FISC",  nome: "Fiscalização" },
  { sigla: "PREV",  nome: "Prevenção" },
  { sigla: "POST",  nome: "Postura/Visibilidade" },
  { sigla: "RURAL", nome: "Patrulhamento Rural" },
  { sigla: "SAT",   nome: "Saturação" },
  { sigla: "REF",   nome: "Refeição" },
  { sigla: "REL",   nome: "Relatório/RSO" },
  { sigla: "DESL",  nome: "Deslocamento" },
] as const;

const PLACEHOLDER_LOCAL: Record<string, string> = {
  PE:    "Banco do Brasil",
  ESC:   "EE Aimone Sala",
  FISC:  "SP-300 km 553",
  PREV:  "Jardim Aeroporto",
  POST:  "Av. Rio Branco",
  RURAL: "Vicinal Geraldo Stringhetta",
  SAT:   "Jardim Aeroporto",
  REF:   "almoço",
  REL:   "relatório final",
  DESL:  "para Valparaíso",
};

interface ModoManualUIProps {
  value: string;
  onChange: (v: string) => void;
  horaInicio: string; // HH:MM — usado para cálculo da prévia e sugestão de horário
}

function calcProximoHorario(texto: string, horaInicio: string): string {
  const [hh, mm] = horaInicio.split(":").map(Number);
  let maxMin = hh * 60 + mm + 30; // após PREL
  for (const linha of texto.split("\n")) {
    const comFim = linha.match(
      /\d{1,2}[h:]\d{0,2}\s*(?:a\b|as\b|às\b|-)\s*(\d{1,2})[h:](\d{0,2})/i
    );
    if (comFim) {
      maxMin = Math.max(maxMin, parseInt(comFim[1]) * 60 + parseInt(comFim[2] || "0"));
      continue;
    }
    const semFim = linha.match(/(\d{1,2})[h:](\d{0,2})/);
    if (semFim) {
      maxMin = Math.max(maxMin, parseInt(semFim[1]) * 60 + parseInt(semFim[2] || "0") + 30);
    }
  }
  const h = Math.floor(maxMin / 60) % 24;
  const m = maxMin % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export default function ModoManualUI({ value, onChange, horaInicio }: ModoManualUIProps) {
  const [guiaAberto, setGuiaAberto] = useState(false);
  const [formInicio, setFormInicio] = useState("");
  const [formFim, setFormFim] = useState("");
  const [formMod, setFormMod] = useState<string>("POST");
  const [formLocal, setFormLocal] = useState("");
  const [formErro, setFormErro] = useState("");

  const proximoHorario = useMemo(() => calcProximoHorario(value, horaInicio), [value, horaInicio]);

  const prelFimHora = useMemo(() => {
    const [h, m] = horaInicio.split(":").map(Number);
    const fim = h * 60 + m + 30;
    return `${String(Math.floor(fim / 60) % 24).padStart(2, "0")}:${String(fim % 60).padStart(2, "0")}`;
  }, [horaInicio]);

  const preview = useMemo(
    () => (value.trim() ? analisarBlocosManuaisPreview(value, horaInicio) : []),
    [value, horaInicio]
  );

  const inserirLinha = (linha: string) => {
    onChange(value.trimEnd() ? `${value.trimEnd()}\n${linha}` : linha);
  };

  const inserirExemplo = (sigla: string) => {
    const [hh, mm] = proximoHorario.split(":").map(Number);
    const horaStr = `${String(hh).padStart(2, "0")}h${String(mm).padStart(2, "0")}`;
    inserirLinha(`${horaStr} ${sigla} ${PLACEHOLDER_LOCAL[sigla] ?? "local"}`);
  };

  const handleAdicionar = () => {
    const inicio = formInicio || proximoHorario;
    if (!inicio) { setFormErro("Informe o horário de início."); return; }
    if (!formLocal.trim()) { setFormErro("Informe o local/descrição."); return; }
    const [h, m] = inicio.split(":").map(Number);
    const horaStr = `${String(h).padStart(2, "0")}h${String(m).padStart(2, "0")}`;
    let linha: string;
    if (formFim) {
      const [hf, mf] = formFim.split(":").map(Number);
      const fimStr = `${String(hf).padStart(2, "0")}h${String(mf).padStart(2, "0")}`;
      linha = `${horaStr} a ${fimStr} ${formMod} ${formLocal.trim()}`;
    } else {
      linha = `${horaStr} ${formMod} ${formLocal.trim()}`;
    }
    inserirLinha(linha);
    setFormErro("");
    setFormInicio("");
    setFormFim("");
    setFormLocal("");
  };

  return (
    <div className="space-y-4">

      {/* ── Guia visual colapsível ── */}
      <div className="border border-blue-200 rounded-xl overflow-hidden">
        <button
          type="button"
          onClick={() => setGuiaAberto(v => !v)}
          className="w-full flex items-center justify-between px-4 py-3 bg-blue-50/70 text-sm font-semibold text-[#0a2540] text-left min-h-[48px]"
        >
          <span>? Guia rápido — formato dos blocos manuais</span>
          <span className="text-xs text-blue-600 shrink-0 ml-2">{guiaAberto ? "▲ fechar" : "▼ ver"}</span>
        </button>

        {guiaAberto && (
          <div className="p-4 space-y-3 bg-white text-sm border-t border-blue-100">
            <p className="text-gray-700 text-xs">
              Digite uma atividade por linha: <strong>horário + sigla + local.</strong>
            </p>
            <pre className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs leading-6 text-gray-800 overflow-x-auto">{
`07h30 PE Banco do Brasil
08h30 ESC EE Aimone Sala
09h FISC SP-300 km 553
10h PREV Jardim Aeroporto
12h REF almoço
17h REL relatório final`
            }</pre>

            <div className="bg-amber-50 border-l-4 border-amber-400 p-3 rounded-r-lg text-xs text-amber-800">
              A <strong>PREL</strong> ocupa automaticamente os primeiros 30 min do turno.
              Se o turno começa às <strong>{horaInicio}</strong>, lance o primeiro bloco
              a partir das <strong>{prelFimHora}</strong>.
            </div>

            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs text-gray-700 mt-1">
              {SIGLAS.map(s => (
                <div key={s.sigla} className="flex gap-1.5 items-baseline">
                  <span className="font-mono font-bold text-[#0a2540] w-10 shrink-0">{s.sigla}</span>
                  <span className="text-gray-600">{s.nome}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Formulário guiado ── */}
      <div className="border border-gray-200 rounded-xl p-4 bg-white space-y-3">
        <p className="text-sm font-semibold text-gray-700">Adicionar bloco manual</p>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs text-gray-500 mb-1">
              Início *
              {!formInicio && (
                <span className="ml-1 text-blue-600">sugestão: {proximoHorario}</span>
              )}
            </label>
            <input
              type="time"
              value={formInicio}
              onChange={e => { setFormInicio(e.target.value); setFormErro(""); }}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#0a2540]"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Fim (opcional)</label>
            <input
              type="time"
              value={formFim}
              onChange={e => setFormFim(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#0a2540]"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs text-gray-500 mb-1">Modalidade *</label>
          <select
            value={formMod}
            onChange={e => { setFormMod(e.target.value); setFormLocal(""); setFormErro(""); }}
            className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#0a2540]"
          >
            {SIGLAS.map(s => (
              <option key={s.sigla} value={s.sigla}>{s.sigla} — {s.nome}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs text-gray-500 mb-1">Local / Descrição *</label>
          <input
            type="text"
            value={formLocal}
            onChange={e => { setFormLocal(e.target.value); setFormErro(""); }}
            placeholder={PLACEHOLDER_LOCAL[formMod] ?? "Descreva o local"}
            className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#0a2540]"
            onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleAdicionar(); } }}
          />
        </div>

        {formErro && <p className="text-xs text-red-600">{formErro}</p>}

        <button
          type="button"
          onClick={handleAdicionar}
          className="w-full py-2.5 rounded-lg bg-[#0a2540] text-white text-sm font-bold hover:bg-[#0d2e52] min-h-[44px] transition-colors"
        >
          + Adicionar linha
        </button>
      </div>

      {/* ── Botões rápidos ── */}
      <div>
        <p className="text-xs text-gray-500 mb-2">Inserir exemplo rápido (edite depois):</p>
        <div className="flex flex-wrap gap-2">
          {SIGLAS.filter(s => s.sigla !== "DESL").map(s => (
            <button
              key={s.sigla}
              type="button"
              onClick={() => inserirExemplo(s.sigla)}
              className="px-3 py-1.5 rounded-lg border border-gray-300 text-xs font-bold text-gray-700 hover:border-[#0a2540] hover:text-[#0a2540] hover:bg-blue-50/60 min-h-[36px] transition-colors"
            >
              + {s.sigla}
            </button>
          ))}
        </div>
      </div>

      {/* ── Textarea livre ── */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1">
          Blocos manuais (edite livremente)
        </label>
        <textarea
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={"07h30 PE Banco do Brasil\n08h30 ESC EE Aimone Sala\n09h FISC SP-300 km 553"}
          className="w-full px-4 py-3 rounded-lg border border-gray-300 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#0a2540] h-28 resize-y font-mono leading-6"
        />
      </div>

      {/* ── Prévia ── */}
      {preview.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-700 mb-2">Prévia dos blocos</p>
          <div className="space-y-1.5">
            {preview.map(p => (
              <div
                key={p.linha}
                className={`rounded-lg border px-3 py-2 flex items-start gap-2.5 text-xs ${
                  p.status === "erro"
                    ? "border-red-200 bg-red-50"
                    : p.status === "aviso"
                    ? "border-amber-200 bg-amber-50"
                    : "border-gray-200 bg-white"
                }`}
              >
                <span className={`mt-0.5 text-sm font-bold leading-none shrink-0 ${
                  p.status === "ok" ? "text-emerald-500" :
                  p.status === "aviso" ? "text-amber-500" : "text-red-500"
                }`}>
                  {p.status === "ok" ? "✓" : p.status === "aviso" ? "⚠" : "✕"}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-baseline gap-1.5">
                    <span className="font-mono font-bold text-[#0a2540]">
                      {p.horaInicio ?? "?"}
                      {p.horaFim ? `–${p.horaFim}` : ""}
                    </span>
                    {p.modalidade && (
                      <span className="font-bold text-gray-800">{p.modalidade}</span>
                    )}
                    {p.local && (
                      <span className="text-gray-600 truncate">{p.local}</span>
                    )}
                    {!p.local && p.horaInicio && (
                      <span className="text-gray-400 italic">sem local</span>
                    )}
                  </div>
                  {p.mensagem && (
                    <p className={`mt-0.5 text-[11px] leading-snug ${
                      p.status === "erro" ? "text-red-700" : "text-amber-700"
                    }`}>
                      {p.mensagem}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
