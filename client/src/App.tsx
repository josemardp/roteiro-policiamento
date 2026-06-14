/**
 * App.tsx — Orquestração principal
 * Design: Operacional Moderno — Navegação entre 3 telas, persistência offline
 */

import { useState, useEffect } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import ConfiguracaoServico from "@/pages/ConfiguracaoServico";
import CPPTurno from "@/pages/CPPTurno";
import Historico from "@/pages/Historico";
import type { RoteiroDia, ConfiguracaoServico as ConfigType } from "@/lib/types";
import { gerarCPP } from "@/lib/gerarCPP";
import { MUNICIPIOS } from "@/lib/constants";
import { useLocalStorage, useAutoSave } from "@/hooks/useLocalStorage";

type Tela = "configuracao" | "cpp" | "historico";

function AppContent() {
  const [telaAtual, setTelaAtual] = useState<Tela>("configuracao");
  const [roteiroDia, setRoteiroDia] = useLocalStorage<RoteiroDia | null>(
    "roteiro_dia_atual",
    null
  );
  const [historico, setHistorico] = useLocalStorage<RoteiroDia[]>(
    "historico_roteiros",
    []
  );

  // Autosave do roteiro atual
  useAutoSave(roteiroDia, "roteiro_dia_atual", 1000);

  const handleGerarCPP = (config: ConfigType) => {
    const blocos = gerarCPP({
      configuracao: config,
      municipios: MUNICIPIOS,
    });

    const novoRoteiro: RoteiroDia = {
      id: `roteiro-${Date.now()}`,
      configuracao: config,
      blocos,
      dataCriacao: new Date().toISOString(),
      dataAtualizacao: new Date().toISOString(),
      percentualConcluido: 0,
    };

    setRoteiroDia(novoRoteiro);
    setTelaAtual("cpp");
  };

  const handleAtualizarRoteiro = (roteiro: RoteiroDia) => {
    const percentual = Math.round(
      (roteiro.blocos.filter((b) => b.concluido).length / roteiro.blocos.length) * 100
    );
    setRoteiroDia({
      ...roteiro,
      percentualConcluido: percentual,
      dataAtualizacao: new Date().toISOString(),
    });
  };

  const handleSalvarNoHistorico = () => {
    if (roteiroDia) {
      setHistorico([roteiroDia, ...historico]);
      setRoteiroDia(null);
      setTelaAtual("configuracao");
      alert("Roteiro salvo no histórico!");
    }
  };

  const handleReabrir = (roteiro: RoteiroDia) => {
    setRoteiroDia(roteiro);
    setTelaAtual("cpp");
  };

  const handleDuplicar = (roteiro: RoteiroDia) => {
    const novoRoteiro: RoteiroDia = {
      ...roteiro,
      id: `roteiro-${Date.now()}`,
      dataCriacao: new Date().toISOString(),
      dataAtualizacao: new Date().toISOString(),
      blocos: roteiro.blocos.map((b) => ({
        ...b,
        concluido: false,
      })),
      percentualConcluido: 0,
    };
    setRoteiroDia(novoRoteiro);
    setTelaAtual("cpp");
  };

  const handleExcluir = (id: string) => {
    setHistorico(historico.filter((r) => r.id !== id));
  };

  const handleExportarBackup = () => {
    const dados = JSON.stringify(historico, null, 2);
    const blob = new Blob([dados], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `backup-roteiros-${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportarBackup = (novoHistorico: RoteiroDia[]) => {
    setHistorico([...novoHistorico, ...historico]);
  };

  return (
    <>
      {telaAtual === "configuracao" && (
        <div className="flex items-center justify-between fixed top-4 right-4 z-40">
          {historico.length > 0 && (
            <button
              onClick={() => setTelaAtual("historico")}
              className="text-[#0a2540] hover:bg-gray-100 px-3 py-2 rounded-lg transition-colors font-semibold text-sm"
            >
              📋 Histórico ({historico.length})
            </button>
          )}
        </div>
      )}

      {telaAtual === "configuracao" && (
        <ConfiguracaoServico onGerarCPP={handleGerarCPP} />
      )}

      {telaAtual === "cpp" && roteiroDia && (
        <CPPTurno
          roteiroDia={roteiroDia}
          onAtualizar={handleAtualizarRoteiro}
          onVoltar={() => {
            if (
              confirm(
                "Deseja salvar este roteiro no histórico antes de voltar?"
              )
            ) {
              handleSalvarNoHistorico();
            } else {
              setRoteiroDia(null);
              setTelaAtual("configuracao");
            }
          }}
        />
      )}

      {telaAtual === "historico" && (
        <Historico
          historico={historico}
          onReabrir={handleReabrir}
          onDuplicar={handleDuplicar}
          onExcluir={handleExcluir}
          onExportarBackup={handleExportarBackup}
          onImportarBackup={handleImportarBackup}
          onVoltar={() => setTelaAtual("configuracao")}
        />
      )}

      <Toaster />
    </>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <AppContent />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
