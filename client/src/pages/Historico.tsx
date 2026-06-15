/**
 * Tela 3 — Histórico
 * Design: Operacional Moderno — Lista de roteiros, backup/import
 */

import { useState } from "react";
import { toast } from "sonner";
import type { RoteiroDia } from "@/lib/types";
import { parseDataLocal } from "@/lib/gerarCPP";

interface HistoricoProps {
  historico: RoteiroDia[];
  onReabrir: (roteiro: RoteiroDia) => void;
  onDuplicar: (roteiro: RoteiroDia) => void;
  onExcluir: (id: string) => void;
  onExportarBackup: () => void;
  onImportarBackup: (historico: RoteiroDia[]) => void;
  onVoltar: () => void;
}

export default function Historico({
  historico,
  onReabrir,
  onDuplicar,
  onExcluir,
  onExportarBackup,
  onImportarBackup,
  onVoltar,
}: HistoricoProps) {
  const [mostraConfirmacao, setMostraConfirmacao] = useState<string | null>(null);

  const handleImportar = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const conteudo = event.target?.result as string;
        const dados = JSON.parse(conteudo);
        if (Array.isArray(dados)) {
          onImportarBackup(dados);
          toast.success("Backup importado com sucesso!");
        } else {
          toast.error("Formato de arquivo inválido");
        }
      } catch {
        toast.error("Erro ao importar arquivo");
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-32">
      {/* Cabeçalho */}
      <div className="header-sticky">
        <div className="container py-4">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              👮 Histórico
            </h1>
            <button
              onClick={onVoltar}
              className="text-white hover:bg-white/20 px-3 py-2 rounded-lg transition-colors min-h-[44px]"
            >
              ← Voltar
            </button>
          </div>
        </div>
      </div>

      {/* Conteúdo */}
      <div className="container py-6 max-w-2xl">
        {/* Botões de Backup */}
        <div className="space-y-2 mb-6">
          <button
            onClick={onExportarBackup}
            className="w-full btn-tactical text-base font-bold py-3"
          >
            💾 Exportar Backup JSON
          </button>
          <label className="w-full btn-tactical-secondary text-base font-bold py-3 block text-center cursor-pointer min-h-[44px] flex items-center justify-center">
            📥 Importar Backup JSON
            <input
              type="file"
              accept=".json"
              onChange={handleImportar}
              className="hidden"
            />
          </label>
        </div>

        {/* Lista de Roteiros */}
        {historico.length === 0 ? (
          <div className="card-block text-center py-8">
            <p className="text-gray-600 text-sm">
              Nenhum roteiro no histórico ainda.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {historico.map((roteiro) => {
              const total = roteiro.blocos.length;
              const percentual = total > 0
                ? Math.round(
                    (roteiro.blocos.filter((b) => b.concluido).length / total) * 100
                  )
                : 0;
              // parseDataLocal evita bug de fuso (UTC vs local)
              const data = parseDataLocal(roteiro.configuracao.data)
                .toLocaleDateString("pt-BR");

              return (
                <div key={roteiro.id} className="card-block">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-gray-900">
                        {roteiro.configuracao.tipoAtividade}
                      </p>
                      <p className="text-xs text-gray-600">
                        {roteiro.configuracao.municipio} • {data}
                      </p>
                      <p className="text-xs text-gray-600 mt-1">
                        {roteiro.configuracao.horaInicio} —{" "}
                        {roteiro.configuracao.horaTermino}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-[#1e7e34]">
                        {percentual}%
                      </p>
                      <p className="text-xs text-gray-600">
                        {roteiro.blocos.filter((b) => b.concluido).length} de{" "}
                        {total}
                      </p>
                    </div>
                  </div>

                  {/* Botões de Ação */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => onReabrir(roteiro)}
                      className="flex-1 btn-tactical-secondary text-xs font-bold py-2"
                    >
                      👁️ Reabrir
                    </button>
                    <button
                      onClick={() => onDuplicar(roteiro)}
                      className="flex-1 btn-tactical-secondary text-xs font-bold py-2"
                    >
                      📋 Duplicar
                    </button>
                    <button
                      onClick={() => setMostraConfirmacao(roteiro.id)}
                      className="flex-1 btn-tactical-secondary text-xs font-bold py-2 text-red-600 hover:bg-red-50"
                    >
                      🗑️ Excluir
                    </button>
                  </div>

                  {/* Confirmação de Exclusão inline */}
                  {mostraConfirmacao === roteiro.id && (
                    <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                      <p className="text-xs text-red-800 font-semibold mb-2">
                        Tem certeza que deseja excluir?
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            onExcluir(roteiro.id);
                            setMostraConfirmacao(null);
                            toast.success("Roteiro excluído.");
                          }}
                          className="flex-1 bg-red-600 text-white text-xs font-bold py-2 rounded-lg hover:bg-red-700 min-h-[44px]"
                        >
                          Sim, excluir
                        </button>
                        <button
                          onClick={() => setMostraConfirmacao(null)}
                          className="flex-1 bg-gray-300 text-gray-900 text-xs font-bold py-2 rounded-lg hover:bg-gray-400 min-h-[44px]"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
