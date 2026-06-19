/**
 * Componente BlocoCard — Cartão de bloco horário
 * Design: Operacional Moderno — Checkbox grande, badges coloridas, edição
 */

import { memo } from "react";
import type { BlocoHorario } from "@/lib/types";
import { MODALIDADES } from "@/lib/constants";

interface BlocoCardProps {
  bloco: BlocoHorario;
  onMarcarConcluido: () => void;
  onEditar: () => void;
}

function BlocoCard({ bloco, onMarcarConcluido, onEditar }: BlocoCardProps) {
  const modalidade = MODALIDADES[bloco.modalidade];
  const badgeClass = modalidade?.badge || "badge-prel";

  return (
    <div
      className={`card-block bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 transition-all ${
        bloco.concluido ? "block-completed opacity-75" : ""
      }`}
    >
      {/* Cabeçalho: Horário + Badge + Checkbox */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className="font-mono text-sm font-bold text-[#0a2540] dark:text-blue-400">
              {bloco.horaInicio} — {bloco.horaFim}
            </span>
            <span className={`${badgeClass} text-xs`}>{bloco.modalidade}</span>
            {bloco.municipio && (
              <span className="bg-blue-50 dark:bg-blue-950/40 text-[#0a2540] dark:text-blue-400 border border-blue-100 dark:border-blue-900/30 px-2 py-0.5 rounded text-[10px] font-bold">
                {bloco.municipio.toUpperCase()}
              </span>
            )}
          </div>
          <p className="block-title text-sm font-black text-gray-900 dark:text-white">
            {modalidade?.nome || "Atividade"}
          </p>
        </div>

        {/* Checkbox Grande */}
        <button
          onClick={onMarcarConcluido}
          className={`checkbox-large flex-shrink-0 flex items-center justify-center ${
            bloco.concluido 
              ? "bg-[#1e7e34] border-[#1e7e34] dark:bg-emerald-600 dark:border-emerald-600" 
              : "border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800"
          } min-h-[48px] min-w-[48px] rounded-xl shadow-xs`}
          title={
            bloco.concluido ? "Marcar como incompleto" : "Marcar como concluído"
          }
        >
          {bloco.concluido && (
            <span className="text-white font-black text-lg">
              ✓
            </span>
          )}
        </button>
      </div>

      {/* Detalhes */}
      <div className="space-y-2.5 text-sm mb-4 border-t border-gray-100 dark:border-slate-800 pt-2.5">
        <div>
          <p className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase">LOCAL</p>
          <p className="text-gray-900 dark:text-slate-200 font-bold text-sm">{bloco.local}</p>
        </div>

        <div>
          <p className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase">
            PROBLEMA A SOLUCIONAR
          </p>
          <p className="text-gray-800 dark:text-slate-400 text-xs leading-normal">
            {bloco.problemaSolucionar}
          </p>
        </div>

        <div>
          <p className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase">
            AÇÕES DE POLÍCIA
          </p>
          <p className="text-gray-800 dark:text-slate-400 text-xs leading-normal">{bloco.acoesPolicia}</p>
        </div>

        <div>
          <p className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase">JUSTIFICATIVA</p>
          <p className="text-gray-700 dark:text-slate-400 text-xs leading-relaxed">
            {bloco.justificativa}
          </p>
        </div>

        {bloco.observacao && (
          <div>
            <p className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase">OBSERVAÇÃO</p>
            <p className="text-gray-700 dark:text-slate-400 text-xs">{bloco.observacao}</p>
          </div>
        )}
      </div>

      {/* Botão Editar */}
      <button
        onClick={onEditar}
        className="w-full btn-tactical-secondary text-sm font-bold py-2.5 cursor-pointer flex items-center justify-center gap-1.5"
      >
        <span>✏️</span> Editar Bloco
      </button>
    </div>
  );
}

export default memo(BlocoCard);
