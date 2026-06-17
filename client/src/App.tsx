/**
 * App.tsx — Orquestração principal
 * Design: Operacional Moderno — Navegação entre 3 telas, persistência offline
 */

import { useState, lazy, Suspense } from "react";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import ConfiguracaoServico from "@/pages/ConfiguracaoServico";
import CPPTurno from "@/pages/CPPTurno";
const Historico = lazy(() => import("@/pages/Historico"));
import type {
  RoteiroDia,
  ConfiguracaoServico as ConfigType,
} from "@/lib/types";
import { gerarCPP } from "@/lib/gerarCPP";
import { MUNICIPIOS_V33 } from "@/lib/constants";
import { useLocalStorage } from "@/hooks/useLocalStorage";

type Tela = "configuracao" | "cpp" | "historico";

function AppContent() {
  const [telaAtual, setTelaAtual] = useState<Tela>(() => {
    try {
      const item = window.localStorage.getItem("roteiro_dia_atual");
      return item && item !== "null" ? "cpp" : "configuracao";
    } catch (e) {
      return "configuracao";
    }
  });
  const [roteiroDia, setRoteiroDia] = useLocalStorage<RoteiroDia | null>(
    "roteiro_dia_atual",
    null
  );
  const [historico, setHistorico] = useLocalStorage<RoteiroDia[]>(
    "historico_roteiros",
    []
  );
  const [mostraDialogVoltar, setMostraDialogVoltar] = useState(false);

  // Normalizador para retrocompatibilidade
  const normalizarRoteiro = (r: any): RoteiroDia => {
    if (!r) return r;
    if (r.configuracao && !r.configuracao.municipios && r.configuracao.municipio) {
      return {
        ...r,
        configuracao: {
          ...r.configuracao,
          municipios: [r.configuracao.municipio],
        },
      };
    }
    return r;
  };

  const roteiroDiaNormalizado = roteiroDia ? normalizarRoteiro(roteiroDia) : null;
  const historicoNormalizado = historico.map(normalizarRoteiro);

  const handleGerarCPP = (config: ConfigType) => {
    const { blocos, avisos } = gerarCPP({
      configuracao: config,
      municipios: MUNICIPIOS_V33,
    });
    avisos.forEach(a => toast.warning(a));

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
    const total = roteiro.blocos.length;
    const percentual =
      total > 0
        ? Math.round(
            (roteiro.blocos.filter(b => b.concluido).length / total) * 100
          )
        : 0;
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
      toast.success("Roteiro salvo no histórico!");
    }
  };

  const handleSairSemSalvar = () => {
    setRoteiroDia(null);
    setTelaAtual("configuracao");
    setMostraDialogVoltar(false);
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
      blocos: roteiro.blocos.map(b => ({ ...b, concluido: false, execucao: undefined })),
      percentualConcluido: 0,
    };
    setRoteiroDia(novoRoteiro);
    setTelaAtual("cpp");
  };

  const handleExcluir = (id: string) => {
    setHistorico(historico.filter(r => r.id !== id));
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
      {telaAtual === "configuracao" && historico.length > 0 && (
        <div className="fixed top-4 right-4 z-40">
          <button
            onClick={() => setTelaAtual("historico")}
            className="text-[#0a2540] hover:bg-gray-100 px-3 py-2 rounded-lg transition-colors font-semibold text-sm"
          >
            📋 Histórico ({historico.length})
          </button>
        </div>
      )}

      {telaAtual === "configuracao" && (
        <ConfiguracaoServico onGerarCPP={handleGerarCPP} />
      )}

      {telaAtual === "cpp" && roteiroDiaNormalizado && (
        <CPPTurno
          roteiroDia={roteiroDiaNormalizado}
          onAtualizar={handleAtualizarRoteiro}
          onVoltar={() => setMostraDialogVoltar(true)}
        />
      )}

      {telaAtual === "historico" && (
        <Suspense
          fallback={
            <div className="min-h-screen flex items-center justify-center text-gray-500">
              Carregando...
            </div>
          }
        >
          <Historico
            historico={historicoNormalizado}
            onReabrir={handleReabrir}
            onDuplicar={handleDuplicar}
            onExcluir={handleExcluir}
            onExportarBackup={handleExportarBackup}
            onImportarBackup={handleImportarBackup}
            onVoltar={() => setTelaAtual("configuracao")}
          />
        </Suspense>
      )}

      {/* Dialog de confirmação ao sair do turno */}
      <AlertDialog
        open={mostraDialogVoltar}
        onOpenChange={setMostraDialogVoltar}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sair do turno?</AlertDialogTitle>
            <AlertDialogDescription>
              Deseja salvar este roteiro no histórico antes de sair?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <button
              onClick={handleSairSemSalvar}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-red-700 hover:bg-red-50 transition-colors"
            >
              Sair sem salvar
            </button>
            <AlertDialogAction
              onClick={() => {
                setMostraDialogVoltar(false);
                handleSalvarNoHistorico();
              }}
            >
              Salvar e sair
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Toaster />
    </>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light" switchable={true}>
        <TooltipProvider>
          <AppContent />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
