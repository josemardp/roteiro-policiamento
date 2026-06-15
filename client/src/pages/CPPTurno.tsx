/**
 * Tela 2 — CPP do Turno (Execução)
 * Design: Operacional Moderno — Cartões com checkbox, edição modal, progresso
 */

import { useState, useCallback } from "react";
import { toast } from "sonner";
import type { RoteiroDia, BlocoHorario } from "@/lib/types";
import { MODALIDADES, NOTA_SUPERVISAO } from "@/lib/constants";
import { parseDataLocal } from "@/lib/gerarCPP";
import BlocoCard from "@/components/BlocoCard";
import EditBlocoModal from "@/components/EditBlocoModal";
import ExportarRelatorioModal from "@/components/ExportarRelatorioModal";

interface CPPTurnoProps {
  roteiroDia: RoteiroDia;
  onAtualizar: (roteiro: RoteiroDia) => void;
  onVoltar: () => void;
}

export default function CPPTurno({
  roteiroDia,
  onAtualizar,
  onVoltar,
}: CPPTurnoProps) {
  const [blocoEditando, setBlocoEditando] = useState<BlocoHorario | null>(null);
  const [mostraExportar, setMostraExportar] = useState(false);

  const total = roteiroDia.blocos.length;
  const concluidos = roteiroDia.blocos.filter((b) => b.concluido).length;
  const percentualConcluido = total > 0 ? Math.round((concluidos / total) * 100) : 0;

  const blocosOrdenados = [...roteiroDia.blocos].sort((a, b) => a.ordem - b.ordem);

  const dataTurno = parseDataLocal(roteiroDia.configuracao.data)
    .toLocaleDateString("pt-BR");

  const handleMarcarConcluido = useCallback((blocoId: string) => {
    const novosBlocos = roteiroDia.blocos.map((b) =>
      b.id === blocoId ? { ...b, concluido: !b.concluido } : b
    );
    onAtualizar({ ...roteiroDia, blocos: novosBlocos });
  }, [roteiroDia, onAtualizar]);

  const handleEditarBloco = useCallback((blocoId: string, novoBloco: BlocoHorario) => {
    const novosBlocos = roteiroDia.blocos.map((b) =>
      b.id === blocoId ? novoBloco : b
    );
    onAtualizar({ ...roteiroDia, blocos: novosBlocos });
    setBlocoEditando(null);
    toast.success("Bloco atualizado!");
  }, [roteiroDia, onAtualizar]);

  const handleAdicionarBloco = useCallback(() => {
    // Calcula horário a partir do último bloco
    const ultimo = [...roteiroDia.blocos].sort((a, b) => a.ordem - b.ordem).at(-1);

    const horaInicio = ultimo?.horaFim ?? roteiroDia.configuracao.horaInicio;
    const [h, m] = horaInicio.split(":").map(Number);
    const fimMin = ((h * 60 + m + 30) % (24 * 60));
    const horaFim = `${String(Math.floor(fimMin / 60)).padStart(2, "0")}:${String(fimMin % 60).padStart(2, "0")}`;

    const novoBloco: BlocoHorario = {
      id: `bloco-${Date.now()}`,
      horaInicio,
      horaFim,
      modalidade: "PREV",
      local: "Local a definir",
      problemaSolucionar: "A definir",
      modusOperandi: "Utilização de armas e ameaças",
      acoesPolicia: "Patrulhamento",
      justificativa: "Atividade de policiamento.",
      observacao: "",
      concluido: false,
      ordem: roteiroDia.blocos.length,
    };

    onAtualizar({ ...roteiroDia, blocos: [...roteiroDia.blocos, novoBloco] });
    toast.success("Bloco adicionado — edite para detalhar.");
  }, [roteiroDia, onAtualizar]);

  return (
    <div className="min-h-screen bg-gray-50 pb-32">
      {/* Cabeçalho Sticky */}
      <div className="header-sticky">
        <div className="container py-4">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              👮 CPP do Turno
            </h1>
            <button
              onClick={onVoltar}
              className="text-white hover:bg-white/20 px-3 py-2 rounded-lg transition-colors min-h-[44px]"
            >
              ← Voltar
            </button>
          </div>

          {/* Resumo do Turno */}
          <div className="grid grid-cols-2 gap-2 text-sm text-blue-100 mb-3">
            <div>
              <span className="font-semibold">{roteiroDia.configuracao.tipoAtividade}</span>
              <br />
              {roteiroDia.configuracao.municipio}
            </div>
            <div>
              <span className="font-semibold">
                {roteiroDia.configuracao.horaInicio} — {roteiroDia.configuracao.horaTermino}
              </span>
              <br />
              {dataTurno}
            </div>
          </div>

          {/* Barra de Progresso */}
          <div className="space-y-1">
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${percentualConcluido}%` }} />
            </div>
            <p className="text-xs text-blue-100 font-semibold">
              {concluidos} de {total} blocos concluídos ({percentualConcluido}%)
            </p>
          </div>
        </div>
      </div>

      {/* Conteúdo */}
      <div className="container py-6 max-w-2xl">
        <div className="space-y-4">
          {blocosOrdenados.map((bloco) => (
            <BlocoCard
              key={bloco.id}
              bloco={bloco}
              onMarcarConcluido={() => handleMarcarConcluido(bloco.id)}
              onEditar={() => setBlocoEditando(bloco)}
            />
          ))}

          {/* Nota de Supervisão */}
          <div className="bg-blue-50 border-l-4 border-[#0a2540] p-4 rounded-r-lg">
            <p className="text-xs text-gray-700 leading-relaxed">
              <span className="font-semibold">Nota de Supervisão:</span> {NOTA_SUPERVISAO}
            </p>
          </div>

          {/* Botões de Ação */}
          <div className="space-y-2 mt-6">
            <button
              onClick={handleAdicionarBloco}
              className="w-full btn-tactical-secondary text-base font-bold py-3"
            >
              + Adicionar Bloco
            </button>
            <button
              onClick={() => setMostraExportar(true)}
              className="w-full btn-tactical text-base font-bold py-3"
            >
              📄 Exportar Relatório
            </button>
          </div>
        </div>
      </div>

      {/* Modal de Edição */}
      {blocoEditando && (
        <EditBlocoModal
          bloco={blocoEditando}
          onSalvar={(novoBloco) => handleEditarBloco(blocoEditando.id, novoBloco)}
          onFechar={() => setBlocoEditando(null)}
        />
      )}

      {/* Modal de Exportação */}
      {mostraExportar && (
        <ExportarRelatorioModal
          roteiroDia={roteiroDia}
          onFechar={() => setMostraExportar(false)}
        />
      )}
    </div>
  );
}
