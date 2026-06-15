/**
 * Modal de Exportação de Relatório
 * Design: Operacional Moderno — Formato RSO, copiar/compartilhar
 */

import { useState } from "react";
import { toast } from "sonner";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Dialog, DialogPortal, DialogOverlay } from "@/components/ui/dialog";
import type { RoteiroDia } from "@/lib/types";
import { MODALIDADES } from "@/lib/constants";

interface ExportarRelatorioModalProps {
  roteiroDia: RoteiroDia;
  onFechar: () => void;
}

export default function ExportarRelatorioModal({
  roteiroDia,
  onFechar,
}: ExportarRelatorioModalProps) {
  const [somenteCompletos, setSomenteCompletos] = useState(false);

  const gerarRelatorio = (): string => {
    const blocos = somenteCompletos
      ? roteiroDia.blocos.filter((b) => b.concluido)
      : [...roteiroDia.blocos].sort((a, b) => a.horaInicio.localeCompare(b.horaInicio));

    const linhas: string[] = [];

    linhas.push(
      `*ÀS ${roteiroDia.configuracao.horaInicio.replace(":", "H")} INÍCIO DA ${roteiroDia.configuracao.tipoAtividade.toUpperCase()} PELO MUNICÍPIO DE ${roteiroDia.configuracao.municipio.toUpperCase()}-SP.`
    );

    for (const bloco of blocos) {
      const hi = bloco.horaInicio.replace(":", "H");
      const hf = bloco.horaFim.replace(":", "H");
      const descRSO = MODALIDADES[bloco.modalidade]?.descricaoRSO ?? bloco.modalidade;
      const temLocal = !["PREL", "REL", "REF", "DESL"].includes(bloco.modalidade);
      const acao = temLocal ? `${descRSO} ${bloco.local.toUpperCase()}` : descRSO;
      linhas.push(`*DAS ${hi} ÀS ${hf} ${acao}.`);
    }

    linhas.push(
      `*ÀS ${roteiroDia.configuracao.horaTermino.replace(":", "H")} ENCERRAMENTO DA ${roteiroDia.configuracao.tipoAtividade.toUpperCase()}.`
    );

    linhas.push("");
    linhas.push("OBSERVAÇÕES:");
    linhas.push(`MODALIDADES REALIZADAS: ${blocos.map((b) => b.modalidade).join(", ")}`);
    linhas.push(
      `BLOCOS CONCLUÍDOS: ${roteiroDia.blocos.filter((b) => b.concluido).length} de ${roteiroDia.blocos.length}`
    );

    return linhas.join("\n");
  };

  const relatorio = gerarRelatorio();

  const handleCopiar = async () => {
    try {
      await navigator.clipboard.writeText(relatorio);
      toast.success("Relatório copiado para a área de transferência!");
    } catch {
      try {
        const el = document.createElement("textarea");
        el.value = relatorio;
        el.style.position = "fixed";
        el.style.opacity = "0";
        document.body.appendChild(el);
        el.focus();
        el.select();
        document.execCommand("copy");
        document.body.removeChild(el);
        toast.success("Relatório copiado!");
      } catch {
        toast.error("Não foi possível copiar. Selecione o texto manualmente.");
      }
    }
  };

  const handleCompartilhar = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: "CPP do Turno", text: relatorio });
      } catch {
        // usuário cancelou — ignora
      }
    } else {
      toast.info("Compartilhamento não suportado — use Copiar.");
    }
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onFechar(); }}>
      <DialogPortal>
        <DialogOverlay />
        {/* Content customizado: bottom-sheet mobile, centrado desktop */}
        <DialogPrimitive.Content
          aria-labelledby="exportar-title"
          aria-describedby="exportar-desc"
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center focus:outline-none"
        >
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl max-w-2xl w-full max-h-[92vh] overflow-y-auto">
            {/* Cabeçalho */}
            <div className="sticky top-0 bg-gradient-to-r from-[#0a2540] to-[#1a3a5c] text-white p-4 flex items-center justify-between rounded-t-2xl">
              <h2 id="exportar-title" className="text-lg font-bold">Exportar Relatório</h2>
              <DialogPrimitive.Close
                aria-label="Fechar"
                className="text-white hover:bg-white/20 w-11 h-11 flex items-center justify-center rounded-lg transition-colors"
              >
                ✕
              </DialogPrimitive.Close>
            </div>

            {/* Conteúdo */}
            <div className="p-4 space-y-4">
              <p id="exportar-desc" className="sr-only">
                Relatório do turno em formato RSO para copiar ou compartilhar
              </p>

              {/* Opção: Só Completos */}
              <label className="flex items-center p-3 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 min-h-[44px]">
                <input
                  type="checkbox"
                  checked={somenteCompletos}
                  onChange={(e) => setSomenteCompletos(e.target.checked)}
                  className="w-5 h-5"
                />
                <span className="ml-3 text-base font-medium">
                  Exportar apenas blocos concluídos
                </span>
              </label>

              {/* Área de Texto */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-2">
                  Relatório (formato RSO)
                </label>
                <textarea
                  value={relatorio}
                  readOnly
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-xs font-mono bg-gray-50 h-64 resize-none"
                />
                <p className="text-xs text-gray-600 mt-1">
                  Pronto para colar no campo RELATÓRIO do RSO
                </p>
              </div>

              {/* Botões */}
              <div className="flex gap-2 pb-2">
                <button
                  onClick={handleCopiar}
                  className="flex-1 btn-tactical text-sm font-bold py-3"
                >
                  📋 Copiar
                </button>
                <button
                  onClick={handleCompartilhar}
                  className="flex-1 btn-tactical-secondary text-sm font-bold py-3"
                >
                  📤 Compartilhar
                </button>
                <DialogPrimitive.Close
                  className="flex-1 btn-tactical-secondary text-sm font-bold py-3"
                >
                  Fechar
                </DialogPrimitive.Close>
              </div>
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}
