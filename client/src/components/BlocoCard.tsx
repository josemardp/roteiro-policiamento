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

function BlocoCard({
  bloco,
  onMarcarConcluido,
  onEditar,
}: BlocoCardProps) {
  const modalidade = MODALIDADES[bloco.modalidade];
  const badgeClass = modalidade?.badge || "badge-prel";

  return (
    <div
      className={`card-block transition-all ${
        bloco.concluido ? "block-completed opacity-75" : ""
      }`}
    >
      {/* Cabeçalho: Horário + Badge + Checkbox */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-sm font-bold text-[#0a2540]">
              {bloco.horaInicio} — {bloco.horaFim}
            </span>
            <span className={`${badgeClass} text-xs`}>
              {bloco.modalidade}
            </span>
          </div>
          <p className="block-title text-sm font-semibold text-gray-900">
            {modalidade?.nome || "Atividade"}
          </p>
        </div>

        {/* Checkbox Grande */}
        <button
          onClick={onMarcarConcluido}
          className={`checkbox-large flex-shrink-0 ${
            bloco.concluido ? "bg-[#1e7e34] border-[#1e7e34]" : ""
          }`}
          title={bloco.concluido ? "Marcar como incompleto" : "Marcar como concluído"}
        >
          {bloco.concluido && (
            <span className="flex items-center justify-center w-full h-full text-white font-bold">
              ✓
            </span>
          )}
        </button>
      </div>

      {/* Detalhes */}
      <div className="space-y-2 text-sm mb-3">
        <div>
          <p className="text-xs font-semibold text-gray-600">LOCAL</p>
          <p className="text-gray-900 font-medium">{bloco.local}</p>
        </div>

        <div>
          <p className="text-xs font-semibold text-gray-600">PROBLEMA A SOLUCIONAR</p>
          <p className="text-gray-900 font-medium">{bloco.problemaSolucionar}</p>
        </div>

        <div>
          <p className="text-xs font-semibold text-gray-600">AÇÕES DE POLÍCIA</p>
          <p className="text-gray-900 font-medium">{bloco.acoesPolicia}</p>
        </div>

        <div>
          <p className="text-xs font-semibold text-gray-600">JUSTIFICATIVA</p>
          <p className="text-gray-700 text-xs leading-relaxed">{bloco.justificativa}</p>
        </div>

        {bloco.observacao && (
          <div>
            <p className="text-xs font-semibold text-gray-600">OBSERVAÇÃO</p>
            <p className="text-gray-700 text-xs">{bloco.observacao}</p>
          </div>
        )}
      </div>

      {/* Botão Editar */}
      <button
        onClick={onEditar}
        className="w-full btn-tactical-secondary text-sm font-semibold py-2"
      >
        ✏️ Editar
      </button>
    </div>
  );
}

export default memo(BlocoCard);
