/**
 * Modal de Exportação de Relatório
 * Design: Operacional Moderno — Formato RSO, copiar/compartilhar
 */

import { useState } from "react";
import type { RoteiroDia } from "@/lib/types";

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
      : roteiroDia.blocos;

    const linhas: string[] = [];

    // Cabeçalho
    linhas.push(
      `*ÀS ${roteiroDia.configuracao.horaInicio.replace(":", "H")} INÍCIO DA ${roteiroDia.configuracao.tipoAtividade.toUpperCase()} PELO MUNICÍPIO DE ${roteiroDia.configuracao.municipio.toUpperCase()}-SP.`
    );

    // Blocos
    for (const bloco of blocos) {
      const horaInicio = bloco.horaInicio.replace(":", "H");
      const horaFim = bloco.horaFim.replace(":", "H");
      const acao = bloco.modalidade === "PREL"
        ? "PRELEÇÃO E ASSUNÇÃO DO SERVIÇO PELA BASE DO PELOTÃO PM"
        : bloco.modalidade === "REL"
        ? "BASE DO PELOTÃO PARA ELABORAÇÃO DO RSO"
        : bloco.modalidade === "REF"
        ? "ALIMENTAÇÃO PELA BASE DO PELOTÃO PM"
        : `${bloco.modalidade === "POST" ? "PATRULHAMENTO OSTENSIVO" : bloco.modalidade === "PREV" ? "PATRULHAMENTO PREVENTIVO" : bloco.modalidade === "PE" ? "PONTO DE ESTACIONAMENTO/VISIBILIDADE" : bloco.modalidade === "FISC" ? "PONTO DE ESTACIONAMENTO E FISCALIZAÇÃO DE VEÍCULOS" : bloco.modalidade === "ESC" ? "RONDA ESCOLAR" : bloco.modalidade === "RURAL" ? "POLICIAMENTO RURAL" : "SATURAÇÃO PREVENTIVA"} ${bloco.local.toUpperCase()}`;

      linhas.push(`*DAS ${horaInicio} ÀS ${horaFim} ${acao}.`);
    }

    // Encerramento
    linhas.push(
      `*ÀS ${roteiroDia.configuracao.horaTermino.replace(":", "H")} ENCERRAMENTO DA ${roteiroDia.configuracao.tipoAtividade.toUpperCase()}.`
    );

    // Resumo
    linhas.push("");
    linhas.push("OBSERVAÇÕES:");
    linhas.push(
      `MODALIDADES REALIZADAS: ${blocos.map((b) => b.modalidade).join(", ")}`
    );
    linhas.push(
      `BLOCOS CONCLUÍDOS: ${roteiroDia.blocos.filter((b) => b.concluido).length} de ${roteiroDia.blocos.length}`
    );

    return linhas.join("\n");
  };

  const relatorio = gerarRelatorio();

  const handleCopiar = () => {
    navigator.clipboard.writeText(relatorio);
    alert("Relatório copiado para a área de transferência!");
  };

  const handleCompartilhar = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "CPP do Turno",
          text: relatorio,
        });
      } catch (error) {
        console.error("Erro ao compartilhar:", error);
      }
    } else {
      alert("Compartilhamento não suportado neste navegador");
    }
  };

  return (
    <>
      {/* Overlay */}
      <div className="modal-overlay" onClick={onFechar} />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center pointer-events-none">
        <div className="bg-white rounded-t-lg sm:rounded-lg shadow-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto pointer-events-auto">
          {/* Cabeçalho */}
          <div className="sticky top-0 bg-gradient-to-r from-[#0a2540] to-[#1a3a5c] text-white p-4 flex items-center justify-between">
            <h2 className="text-lg font-bold">Exportar Relatório</h2>
            <button
              onClick={onFechar}
              className="text-white hover:bg-white/20 px-2 py-1 rounded transition-colors"
            >
              ✕
            </button>
          </div>

          {/* Conteúdo */}
          <div className="p-4 space-y-4">
            {/* Opção: Só Completos */}
            <label className="flex items-center p-3 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
              <input
                type="checkbox"
                checked={somenteCompletos}
                onChange={(e) => setSomenteCompletos(e.target.checked)}
                className="w-4 h-4"
              />
              <span className="ml-3 text-sm font-medium">
                Exportar apenas blocos concluídos
              </span>
            </label>

            {/* Área de Texto com Relatório */}
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
            <div className="flex gap-2">
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
              <button
                onClick={onFechar}
                className="flex-1 btn-tactical-secondary text-sm font-bold py-3"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
