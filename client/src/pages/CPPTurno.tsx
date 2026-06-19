/**
 * Tela 2 — CPP do Turno (Execução)
 * Design: Mobile-First Operacional — "Modo Patrulha" ao vivo, navegação inferior, swipe, modo noturno
 */

import { useState, useCallback, useEffect, lazy, Suspense } from "react";
import { toast } from "sonner";
import type { RoteiroDia, BlocoHorario, ExecucaoBloco } from "@/lib/types";
import { NOTA_SUPERVISAO, DURACAO_TURNO_MIN } from "@/lib/constants";
import { parseDataLocal, gerarFundamentacao } from "@/lib/gerarCPP";
import BlocoCard from "@/components/BlocoCard";
import EditBlocoModal from "@/components/EditBlocoModal";
import ExportarRelatorioModal from "@/components/ExportarRelatorioModal";
import FolhaServicoCPP from "@/components/FolhaServicoCPP";
// MapaCPP é lazy: o Leaflet (~150 KB) só é baixado quando a aba Mapa é aberta,
// reduzindo o bundle do carregamento inicial em campo (3G/4G).
const MapaCPP = lazy(() => import("@/components/MapaCPP"));
import ModoPatrulha from "@/components/ModoPatrulha";
import { useTheme } from "@/contexts/ThemeContext";
import { Sun, Moon, Clock, ListTodo, Map, Bell, BellOff, Printer } from "lucide-react";

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
  const [tabAtiva, setTabAtiva] = useState<"agora" | "lista" | "mapa">("agora");
  const [emitidoEmCPP, setEmitidoEmCPP] = useState<Date | null>(null);
  const [blocoEmFocoId, setBlocoEmFocoId] = useState<string | undefined>(undefined);
  const [alertasAtivos, setAlertasAtivos] = useState(() => {
    try {
      return window.localStorage.getItem("alertas_patrulha") === "true";
    } catch {
      return false;
    }
  });
  const { theme, toggleTheme } = useTheme();

  // Online/Offline tracking
  const [isOnline, setIsOnline] = useState(() => typeof navigator !== "undefined" ? navigator.onLine : true);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Swiping state
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const minSwipeDistance = 50;

  const total = roteiroDia.blocos.length;
  const concluidos = roteiroDia.blocos.filter(b => b.concluido).length;
  const percentualConcluido =
    total > 0 ? Math.round((concluidos / total) * 100) : 0;

  const blocosOrdenados = [...roteiroDia.blocos].sort(
    (a, b) => a.ordem - b.ordem
  );

  const dataTurno = parseDataLocal(
    roteiroDia.configuracao.data
  ).toLocaleDateString("pt-BR");

  const startHour = parseInt(roteiroDia.configuracao.horaInicio.split(":")[0]);

  // Auto-dark mode for night shifts: starts >= 18h or < 5h
  useEffect(() => {
    const isNightTurn = startHour >= 18 || startHour < 5;
    const themePreference = localStorage.getItem("theme");
    if (isNightTurn && !themePreference && toggleTheme && theme !== "dark") {
      toggleTheme();
    }
  }, [startHour, theme, toggleTheme]);

  const handleMarcarConcluido = useCallback(
    (blocoId: string) => {
      const novosBlocos = roteiroDia.blocos.map(b =>
        b.id === blocoId ? { ...b, concluido: !b.concluido } : b
      );
      onAtualizar({ ...roteiroDia, blocos: novosBlocos });
    },
    [roteiroDia, onAtualizar]
  );

  const handleRegistrarExecucao = useCallback(
    (blocoId: string, execucao: ExecucaoBloco) => {
      const novosBlocos = roteiroDia.blocos.map(b =>
        b.id === blocoId
          ? { ...b, execucao, concluido: execucao.estado === "cumprido" }
          : b
      );
      onAtualizar({ ...roteiroDia, blocos: novosBlocos });
    },
    [roteiroDia, onAtualizar]
  );

  const handleAbrirMapaNoBloco = useCallback((blocoId: string) => {
    setBlocoEmFocoId(blocoId);
    setTabAtiva("mapa");
  }, []);

  const enviarNotificacao = useCallback(async (title: string, body: string) => {
    if (!("Notification" in window) || Notification.permission !== "granted") return;
    const options: NotificationOptions = {
      body,
      tag: `cpp-${title}-${body}`,
      icon: `${import.meta.env.BASE_URL}icon.svg`,
    };
    try {
      if ("serviceWorker" in navigator) {
        const reg = await navigator.serviceWorker.ready;
        await reg.showNotification(title, options);
        return;
      }
    } catch {
      // fallback abaixo
    }
    new Notification(title, options);
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem("alertas_patrulha", String(alertasAtivos));
    } catch {
      // ignore storage errors
    }
  }, [alertasAtivos]);

  useEffect(() => {
    if (!alertasAtivos || !("Notification" in window) || Notification.permission !== "granted") return;

    const timers: number[] = [];
    const now = Date.now();
    let cursor = new Date(`${roteiroDia.configuracao.data}T${roteiroDia.configuracao.horaInicio}`).getTime();
    const ordenados = [...roteiroDia.blocos].sort((a, b) => a.ordem - b.ordem);

    const min = (hora: string) => {
      const [h, m] = hora.split(":").map(Number);
      return h * 60 + m;
    };

    ordenados.forEach((bloco, idx) => {
      const inicio = cursor;
      let dur = min(bloco.horaFim) - min(bloco.horaInicio);
      if (dur < 0) dur += 1440;
      const fim = inicio + dur * 60 * 1000;
      const proximo = ordenados[idx + 1];
      const avisoTransicao = fim - 5 * 60 * 1000;

      if (proximo && avisoTransicao > now) {
        timers.push(window.setTimeout(() => {
          enviarNotificacao(
            `Proximo: ${proximo.horaInicio} - ${proximo.modalidade}`,
            proximo.local
          );
        }, avisoTransicao - now));
      }

      if ((bloco.modalidade === "ESC" || bloco.modalidade === "SAT") && inicio > now) {
        timers.push(window.setTimeout(() => {
          enviarNotificacao(
            `${bloco.horaInicio} - ${bloco.modalidade}`,
            bloco.local
          );
        }, inicio - now));
      }

      cursor = fim;
    });

    return () => timers.forEach(timer => window.clearTimeout(timer));
  }, [alertasAtivos, enviarNotificacao, roteiroDia.blocos, roteiroDia.configuracao.data, roteiroDia.configuracao.horaInicio]);

  const handleToggleAlertas = useCallback(async () => {
    if (alertasAtivos) {
      setAlertasAtivos(false);
      toast.info("Alertas do turno desligados.");
      return;
    }

    if (!("Notification" in window)) {
      toast.info("Este aparelho não suporta notificações locais.");
      return;
    }

    const permissao =
      Notification.permission === "granted"
        ? "granted"
        : await Notification.requestPermission();

    if (permissao !== "granted") {
      setAlertasAtivos(false);
      toast.info("Sem permissão de notificação. O turno segue normal.");
      return;
    }

    setAlertasAtivos(true);
    toast.success("Alertas do turno ligados.");
  }, [alertasAtivos]);

  const handleEditarBloco = useCallback(
    (blocoId: string, novoBloco: BlocoHorario) => {
      const novosBlocos = roteiroDia.blocos.map(b =>
        b.id === blocoId ? novoBloco : b
      );
      onAtualizar({ ...roteiroDia, blocos: novosBlocos });
      setBlocoEditando(null);
      toast.success("Bloco atualizado!");
    },
    [roteiroDia, onAtualizar]
  );

  const handleAdicionarBloco = useCallback(() => {
    const ultimo = [...roteiroDia.blocos]
      .sort((a, b) => a.ordem - b.ordem)
      .at(-1);

    const horaInicio = ultimo?.horaFim ?? roteiroDia.configuracao.horaInicio;
    const [h, m] = horaInicio.split(":").map(Number);
    const fimMin = (h * 60 + m + 30) % (24 * 60);
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

  const handleEmitirCPP = useCallback(() => {
    if (roteiroDia.blocos.length === 0) {
      toast.info("Gere o roteiro antes de emitir o CPP.");
      return;
    }

    setEmitidoEmCPP(new Date());

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.print();
      });
    });
  }, [roteiroDia.blocos.length]);

  // Touch Swipe handlers for tab transitions (Lista ⇄ Mapa ⇄ Agora)
  const onTouchStart = (e: React.TouchEvent) => {
    // Prevent swiping tab when interacting with Leaflet map
    if ((e.target as HTMLElement).closest(".leaflet-container")) return;
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    // Avoid tracking if swipe is not relevant
    if (touchStart === null) return;
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (touchStart === null || touchEnd === null) return;
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    const tabs: Array<"agora" | "lista" | "mapa"> = ["agora", "lista", "mapa"];
    const currentIndex = tabs.indexOf(tabAtiva);

    if (isLeftSwipe && currentIndex < tabs.length - 1) {
      setTabAtiva(tabs[currentIndex + 1]);
    } else if (isRightSwipe && currentIndex > 0) {
      setTabAtiva(tabs[currentIndex - 1]);
    }
  };

  return (
    <div
      className="min-h-screen bg-gray-50 dark:bg-slate-950 pb-[calc(72px+env(safe-area-inset-bottom))] transition-colors duration-300"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* Cabeçalho Sticky Compacto */}
      <div className="header-sticky select-none">
        <div className="container py-3">
          <div className="flex items-center justify-between gap-2">
            <button
              onClick={onVoltar}
              className="text-white hover:bg-white/20 px-2.5 py-1.5 rounded-lg transition-colors min-h-[40px] text-sm font-semibold flex items-center justify-center cursor-pointer"
            >
              ← Voltar
            </button>

            <h1 className="text-base font-black text-white text-center flex-1 truncate uppercase tracking-wide">
              👮 CPP: {roteiroDia.configuracao.municipios?.join(" → ") || roteiroDia.configuracao.municipio}
            </h1>

            <div className="flex items-center gap-1.5">
              <span className={`px-2 py-1 rounded-md text-[9px] font-black uppercase flex items-center gap-1 border ${
                isOnline 
                  ? "bg-emerald-950/45 text-emerald-400 border-emerald-500/20" 
                  : "bg-amber-950/45 text-amber-400 border-amber-500/20"
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? "bg-emerald-400" : "bg-amber-400"} ${isOnline ? "" : "animate-pulse"}`} />
                {isOnline ? "Online" : "Offline"}
              </span>

              {toggleTheme && (
                <button
                  onClick={toggleTheme}
                  className="text-white hover:bg-white/20 px-2 py-2 rounded-lg transition-colors min-h-[40px] min-w-[40px] flex items-center justify-center cursor-pointer"
                  title="Alternar tema"
                >
                  {theme === "dark" ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                </button>
              )}
              <button
                onClick={handleToggleAlertas}
                className="text-white hover:bg-white/20 px-2 py-2 rounded-lg transition-colors min-h-[40px] min-w-[40px] flex items-center justify-center cursor-pointer"
                title={alertasAtivos ? "Desligar alertas" : "Ligar alertas"}
              >
                {alertasAtivos ? <Bell className="w-5 h-5" /> : <BellOff className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* Compact Details Grid */}
          <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[11px] text-blue-100 mt-2 font-medium">
            <div>
              <span className="font-bold text-white uppercase">
                {roteiroDia.configuracao.tipoAtividade} ({DURACAO_TURNO_MIN[roteiroDia.configuracao.tipoAtividade] / 60}h)
              </span>
            </div>
            <div className="text-right">
              <span>{dataTurno}</span>
            </div>
            <div>
              <span>Horário: {roteiroDia.configuracao.horaInicio} - {roteiroDia.configuracao.horaTermino}</span>
            </div>
            <div className="text-right">
              <span className="text-emerald-400 font-bold">{percentualConcluido}% concluído</span>
            </div>
          </div>
        </div>
      </div>

      {/* Conteúdo Central */}
      <div className="container py-4 max-w-md mx-auto">
        {tabAtiva === "agora" && (
          <ModoPatrulha
            roteiroDia={roteiroDia}
            onMarcarConcluido={handleMarcarConcluido}
            onRegistrarExecucao={handleRegistrarExecucao}
            onAbrirMapa={handleAbrirMapaNoBloco}
          />
        )}

        {tabAtiva === "lista" && (
          <div className="space-y-4">
            {/* Card de Fundamentação (PPI) */}
            <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl p-4 shadow-xs">
              <h3 className="text-xs font-bold text-gray-800 dark:text-white flex items-center gap-1.5 mb-2">
                ⚖️ Fundamentação do Roteiro (PPI)
              </h3>
              <ul className="list-disc list-inside space-y-1 text-[11px] text-gray-500 dark:text-slate-400">
                {gerarFundamentacao(roteiroDia.configuracao).map((linha, idx) => (
                  <li key={idx} className="leading-relaxed pl-1 -indent-4 ml-4">
                    {linha}
                  </li>
                ))}
              </ul>
            </div>

            <div className="space-y-3">
              {blocosOrdenados.map(bloco => (
                <BlocoCard
                  key={bloco.id}
                  bloco={bloco}
                  onMarcarConcluido={() => handleMarcarConcluido(bloco.id)}
                  onEditar={() => setBlocoEditando(bloco)}
                />
              ))}
            </div>

            {/* Nota de Supervisão */}
            <div className="bg-blue-50/50 dark:bg-slate-900/40 border-l-4 border-[#0a2540] dark:border-blue-400 p-4 rounded-r-lg">
              <p className="text-[11px] text-gray-600 dark:text-slate-400 leading-relaxed">
                <span className="font-semibold dark:text-white">Nota de Supervisão:</span>{" "}
                {NOTA_SUPERVISAO}
              </p>
            </div>

            {/* Botões de Ação */}
            <div className="space-y-2 mt-6">
              <button
                onClick={handleAdicionarBloco}
                className="w-full btn-tactical-secondary text-base font-bold py-3 min-h-[48px] cursor-pointer"
              >
                + Adicionar Bloco
              </button>
              <button
                onClick={handleEmitirCPP}
                disabled={roteiroDia.blocos.length === 0}
                className="w-full btn-tactical-secondary text-base font-bold py-3 min-h-[48px] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <Printer className="w-5 h-5" />
                Emitir CPP (imprimir / PDF)
              </button>
              <p className="text-[11px] text-gray-500 dark:text-slate-400 leading-relaxed px-1">
                No diálogo do navegador, use Imprimir ou Salvar como PDF para compartilhar a folha do serviço.
              </p>
              <button
                onClick={() => setMostraExportar(true)}
                className="w-full btn-tactical text-base font-bold py-3 min-h-[48px] cursor-pointer"
              >
                📄 Exportar RSO
              </button>
            </div>
          </div>
        )}

        {tabAtiva === "mapa" && (
          <div className="space-y-4">
            <Suspense
              fallback={
                <div className="flex items-center justify-center h-[420px] rounded-2xl border border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-900 text-gray-500 dark:text-slate-400 text-sm">
                  Carregando mapa…
                </div>
              }
            >
              <MapaCPP blocos={roteiroDia.blocos} blocoEmFocoId={blocoEmFocoId} />
            </Suspense>

            <div className="space-y-2 mt-4">
              <button
                onClick={handleEmitirCPP}
                disabled={roteiroDia.blocos.length === 0}
                className="w-full btn-tactical-secondary text-base font-bold py-3 min-h-[48px] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <Printer className="w-5 h-5" />
                Emitir CPP (imprimir / PDF)
              </button>
              <button
                onClick={() => setMostraExportar(true)}
                className="w-full btn-tactical text-base font-bold py-3 min-h-[48px] cursor-pointer"
              >
                📄 Exportar RSO
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Barra de Navegação Inferior Fixa */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-[#0a2540] dark:bg-slate-950 text-white pb-[env(safe-area-inset-bottom)] border-t border-blue-900/20 dark:border-slate-800/80 shadow-lg">
        <div className="max-w-md mx-auto h-16 flex items-center justify-around">
          <button
            onClick={() => setTabAtiva("agora")}
            className={`flex flex-col items-center justify-center flex-1 h-full py-1 transition-all min-h-[48px] cursor-pointer ${
              tabAtiva === "agora" ? "text-emerald-400 dark:text-emerald-400 scale-105" : "text-gray-400 hover:text-white"
            }`}
          >
            <Clock className="w-5 h-5 mb-0.5" />
            <span className="text-[10px] font-bold uppercase tracking-wider">Agora</span>
          </button>

          <button
            onClick={() => setTabAtiva("lista")}
            className={`flex flex-col items-center justify-center flex-1 h-full py-1 transition-all min-h-[48px] cursor-pointer ${
              tabAtiva === "lista" ? "text-emerald-400 dark:text-emerald-400 scale-105" : "text-gray-400 hover:text-white"
            }`}
          >
            <ListTodo className="w-5 h-5 mb-0.5" />
            <span className="text-[10px] font-bold uppercase tracking-wider">Lista</span>
          </button>

          <button
            onClick={() => setTabAtiva("mapa")}
            className={`flex flex-col items-center justify-center flex-1 h-full py-1 transition-all min-h-[48px] cursor-pointer ${
              tabAtiva === "mapa" ? "text-emerald-400 dark:text-emerald-400 scale-105" : "text-gray-400 hover:text-white"
            }`}
          >
            <Map className="w-5 h-5 mb-0.5" />
            <span className="text-[10px] font-bold uppercase tracking-wider">Mapa</span>
          </button>
        </div>
      </div>

      {/* Modal de Edição */}
      {blocoEditando && (
        <EditBlocoModal
          bloco={blocoEditando}
          onSalvar={novoBloco => handleEditarBloco(blocoEditando.id, novoBloco)}
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

      <FolhaServicoCPP roteiroDia={roteiroDia} emitidoEm={emitidoEmCPP} />
    </div>
  );
}
