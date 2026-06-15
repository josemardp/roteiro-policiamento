/**
 * Modal de Edição de Bloco
 * Design: Operacional Moderno — Bottom-sheet mobile, Radix Dialog (focus-trap, ESC, aria)
 */

import { useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Dialog, DialogPortal, DialogOverlay } from "@/components/ui/dialog";
import type { BlocoHorario, ModalidadePoliciamento } from "@/lib/types";
import { MODALIDADES } from "@/lib/constants";

interface EditBlocoModalProps {
  bloco: BlocoHorario;
  onSalvar: (bloco: BlocoHorario) => void;
  onFechar: () => void;
}

const MODALIDADES_EDITAVEIS: ModalidadePoliciamento[] = [
  "PREL",
  "DESL",
  "POST",
  "PREV",
  "PE",
  "FISC",
  "ESC",
  "RURAL",
  "SAT",
  "REF",
  "REL",
];

export default function EditBlocoModal({
  bloco,
  onSalvar,
  onFechar,
}: EditBlocoModalProps) {
  const [modalidade, setModalidade] = useState<ModalidadePoliciamento>(
    bloco.modalidade
  );
  const [local, setLocal] = useState(bloco.local);
  const [problema, setProblema] = useState(bloco.problemaSolucionar);
  const [modus, setModus] = useState(bloco.modusOperandi);
  const [acoes, setAcoes] = useState(bloco.acoesPolicia);
  const [observacao, setObservacao] = useState(bloco.observacao);
  const [horaInicio, setHoraInicio] = useState(bloco.horaInicio);
  const [horaFim, setHoraFim] = useState(bloco.horaFim);

  const toMin = (s: string) => {
    const [h, m] = s.split(":").map(Number);
    return h * 60 + m;
  };
  const durMin = (toMin(horaFim) - toMin(horaInicio) + 1440) % 1440;
  const horaValida = durMin > 0;

  const handleSalvar = () => {
    if (!horaValida) return;
    onSalvar({
      ...bloco,
      modalidade,
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
    <Dialog
      open
      onOpenChange={open => {
        if (!open) onFechar();
      }}
    >
      <DialogPortal>
        <DialogOverlay />
        {/* Content customizado: bottom-sheet mobile, centrado desktop */}
        <DialogPrimitive.Content
          aria-labelledby="edit-bloco-title"
          aria-describedby="edit-bloco-desc"
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center focus:outline-none"
        >
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl max-w-2xl w-full max-h-[92vh] overflow-y-auto">
            {/* Cabeçalho */}
            <div className="sticky top-0 bg-gradient-to-r from-[#0a2540] to-[#1a3a5c] text-white p-4 flex items-center justify-between rounded-t-2xl">
              <h2 id="edit-bloco-title" className="text-lg font-bold">
                Editar Bloco
              </h2>
              <DialogPrimitive.Close
                aria-label="Fechar"
                className="text-white hover:bg-white/20 w-11 h-11 flex items-center justify-center rounded-lg transition-colors"
              >
                ✕
              </DialogPrimitive.Close>
            </div>

            {/* Conteúdo */}
            <div className="p-4 space-y-4">
              <p id="edit-bloco-desc" className="sr-only">
                Formulário para editar os dados do bloco horário
              </p>

              {/* Horário */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">
                    Hora Início
                  </label>
                  <input
                    type="time"
                    value={horaInicio}
                    onChange={e => setHoraInicio(e.target.value)}
                    className="w-full px-3 py-3 rounded-lg border border-gray-300 text-base focus:outline-none focus:ring-2 focus:ring-[#0a2540]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">
                    Hora Fim
                  </label>
                  <input
                    type="time"
                    value={horaFim}
                    onChange={e => setHoraFim(e.target.value)}
                    className={`w-full px-3 py-3 rounded-lg border text-base focus:outline-none focus:ring-2 focus:ring-[#0a2540] ${!horaValida ? "border-red-400 bg-red-50" : "border-gray-300"}`}
                  />
                  {!horaValida && (
                    <p className="text-xs text-red-600 mt-1">
                      Fim deve ser após o início
                    </p>
                  )}
                </div>
              </div>

              {/* Modalidade */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  Modalidade
                </label>
                <select
                  value={modalidade}
                  onChange={e =>
                    setModalidade(e.target.value as ModalidadePoliciamento)
                  }
                  className="w-full px-3 py-3 rounded-lg border border-gray-300 text-base focus:outline-none focus:ring-2 focus:ring-[#0a2540]"
                >
                  {MODALIDADES_EDITAVEIS.map(m => (
                    <option key={m} value={m}>
                      {m} — {MODALIDADES[m]?.nome ?? m}
                    </option>
                  ))}
                </select>
              </div>

              {/* Local */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  Local
                </label>
                <input
                  type="text"
                  value={local}
                  onChange={e => setLocal(e.target.value)}
                  className="w-full px-3 py-3 rounded-lg border border-gray-300 text-base focus:outline-none focus:ring-2 focus:ring-[#0a2540]"
                />
              </div>

              {/* Problema */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  Problema a Solucionar
                </label>
                <textarea
                  value={problema}
                  onChange={e => setProblema(e.target.value)}
                  className="w-full px-3 py-3 rounded-lg border border-gray-300 text-base focus:outline-none focus:ring-2 focus:ring-[#0a2540] h-20 resize-none"
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
                  onChange={e => setModus(e.target.value)}
                  className="w-full px-3 py-3 rounded-lg border border-gray-300 text-base focus:outline-none focus:ring-2 focus:ring-[#0a2540]"
                />
              </div>

              {/* Ações */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  Ações de Polícia
                </label>
                <input
                  type="text"
                  value={acoes}
                  onChange={e => setAcoes(e.target.value)}
                  className="w-full px-3 py-3 rounded-lg border border-gray-300 text-base focus:outline-none focus:ring-2 focus:ring-[#0a2540]"
                />
              </div>

              {/* Observação */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  Observação
                </label>
                <textarea
                  value={observacao}
                  onChange={e => setObservacao(e.target.value)}
                  placeholder="Registre ocorrências, talões, alterações..."
                  className="w-full px-3 py-3 rounded-lg border border-gray-300 text-base focus:outline-none focus:ring-2 focus:ring-[#0a2540] h-20 resize-none"
                />
              </div>

              {/* Botões */}
              <div className="flex gap-2 pt-2 pb-2">
                <button
                  onClick={handleSalvar}
                  disabled={!horaValida}
                  className="flex-1 btn-tactical text-sm font-bold py-3 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Salvar
                </button>
                <DialogPrimitive.Close className="flex-1 btn-tactical-secondary text-sm font-bold py-3">
                  Cancelar
                </DialogPrimitive.Close>
              </div>
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}
