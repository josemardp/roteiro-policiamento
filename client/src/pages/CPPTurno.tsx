/**
 * Tela 2 — CPP do Turno (Execução)
 * Design: Operacional Moderno — Cartões com checkbox, edição modal, progresso
 */

import { useState } from "react";
import type { RoteiroDia, BlocoHorario } from "@/lib/types";
import { MODALIDADES, NOTA_SUPERVISAO } from "@/lib/constants";
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

  const percentualConcluido = Math.round(
    (roteiroDia.blocos.filter((b) => b.concluido).length / roteiroDia.blocos.length) * 100
  );

  const handleMarcarConcluido = (blocoId: string) => {
    const novosBlocos = roteiroDia.blocos.map((b) =>
      b.id === blocoId ? { ...b, concluido: !b.concluido } : b
    );
    onAtualizar({
      ...roteiroDia,
      blocos: novosBlocos,
      percentualConcluido,
    });
  };

  const handleEditarBloco = (blocoId: string, novoBloco: BlocoHorario) => {
    const novosBlocos = roteiroDia.blocos.map((b) =>
      b.id === blocoId ? novoBloco : b
    );
    onAtualizar({
      ...roteiroDia,
      blocos: novosBlocos,
    });
    setBlocoEditando(null);
  };

  const handleAdicionarBloco = () => {
    const novoBloco: BlocoHorario = {
      id: `bloco-${Date.now()}`,
      horaInicio: "00:00",
      horaFim: "01:00",
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
    onAtualizar({
      ...roteiroDia,
      blocos: [...roteiroDia.blocos, novoBloco],
    });
  };

  const handleRecalcular = () => {
    // TODO: Regenerar CPP preservando blocos concluídos
    alert("Recalcular CPP — em desenvolvimento");
  };

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
              className="text-white hover:bg-white/20 px-3 py-2 rounded-lg transition-colors"
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
              {new Date(roteiroDia.configuracao.data).toLocaleDateString("pt-BR")}
            </div>
          </div>

          {/* Barra de Progresso */}
          <div className="space-y-1">
            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{ width: `${percentualConcluido}%` }}
              />
            </div>
            <p className="text-xs text-blue-100 font-semibold">
              {roteiroDia.blocos.filter((b) => b.concluido).length} de {roteiroDia.blocos.length} blocos concluídos ({percentualConcluido}%)
            </p>
          </div>
        </div>
      </div>

      {/* Conteúdo */}
      <div className="container py-6 max-w-2xl">
        <div className="space-y-4">
          {/* Blocos Horários */}
          {roteiroDia.blocos.map((bloco) => (
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
              onClick={handleRecalcular}
              className="w-full btn-tactical-secondary text-base font-bold py-3"
            >
              🔄 Recalcular CPP
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
