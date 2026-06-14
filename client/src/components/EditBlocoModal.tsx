/**
 * Modal de Edição de Bloco
 * Design: Operacional Moderno — Diálogo com campos editáveis
 */

import { useState } from "react";
import type { BlocoHorario } from "@/lib/types";

interface EditBlocoModalProps {
  bloco: BlocoHorario;
  onSalvar: (bloco: BlocoHorario) => void;
  onFechar: () => void;
}

export default function EditBlocoModal({
  bloco,
  onSalvar,
  onFechar,
}: EditBlocoModalProps) {
  const [local, setLocal] = useState(bloco.local);
  const [problema, setProblema] = useState(bloco.problemaSolucionar);
  const [modus, setModus] = useState(bloco.modusOperandi);
  const [acoes, setAcoes] = useState(bloco.acoesPolicia);
  const [observacao, setObservacao] = useState(bloco.observacao);
  const [horaInicio, setHoraInicio] = useState(bloco.horaInicio);
  const [horaFim, setHoraFim] = useState(bloco.horaFim);

  const handleSalvar = () => {
    onSalvar({
      ...bloco,
      horaInicio,
      horaFim,
      local,
      problemaSolucionar: problema,
      modusOperandi: modus,
      acoesPolicia: acoes,
      observacao,
    });
  };

  return (
    <>
      {/* Overlay */}
      <div
        className="modal-overlay"
        onClick={onFechar}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center pointer-events-none">
        <div className="bg-white rounded-t-lg sm:rounded-lg shadow-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto pointer-events-auto">
          {/* Cabeçalho */}
          <div className="sticky top-0 bg-gradient-to-r from-[#0a2540] to-[#1a3a5c] text-white p-4 flex items-center justify-between">
            <h2 className="text-lg font-bold">Editar Bloco</h2>
            <button
              onClick={onFechar}
              className="text-white hover:bg-white/20 px-2 py-1 rounded transition-colors"
            >
              ✕
            </button>
          </div>

          {/* Conteúdo */}
          <div className="p-4 space-y-4">
            {/* Horário */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  Hora Início
                </label>
                <input
                  type="time"
                  value={horaInicio}
                  onChange={(e) => setHoraInicio(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#0a2540]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  Hora Fim
                </label>
                <input
                  type="time"
                  value={horaFim}
                  onChange={(e) => setHoraFim(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#0a2540]"
                />
              </div>
            </div>

            {/* Local */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">
                Local
              </label>
              <input
                type="text"
                value={local}
                onChange={(e) => setLocal(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#0a2540]"
              />
            </div>

            {/* Problema a Solucionar */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">
                Problema a Solucionar
              </label>
              <textarea
                value={problema}
                onChange={(e) => setProblema(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#0a2540] h-20 resize-none"
              />
            </div>

            {/* Modus Operandi */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">
                Modus Operandi
              </label>
              <input
                type="text"
                value={modus}
                onChange={(e) => setModus(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#0a2540]"
              />
            </div>

            {/* Ações de Polícia */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">
                Ações de Polícia
              </label>
              <input
                type="text"
                value={acoes}
                onChange={(e) => setAcoes(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#0a2540]"
              />
            </div>

            {/* Observação */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">
                Observação
              </label>
              <textarea
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                placeholder="Registre ocorrências, talões, alterações..."
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#0a2540] h-20 resize-none"
              />
            </div>

            {/* Botões */}
            <div className="flex gap-2 pt-4">
              <button
                onClick={handleSalvar}
                className="flex-1 btn-tactical text-sm font-bold py-3"
              >
                Salvar
              </button>
              <button
                onClick={onFechar}
                className="flex-1 btn-tactical-secondary text-sm font-bold py-3"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
