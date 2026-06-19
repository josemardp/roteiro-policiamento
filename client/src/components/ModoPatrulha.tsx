import { useState, useEffect, useMemo } from "react";
import type { RoteiroDia, BlocoHorario, EstadoExecucaoBloco, ExecucaoBloco } from "@/lib/types";
import { DURACAO_TURNO_MIN } from "@/lib/constants";
import { gerarFundamentacao } from "@/lib/gerarCPP";
import { CheckCircle2, ChevronDown, ChevronUp, MapPin, Shield, Clock, HelpCircle, Navigation, AlertTriangle, CircleDashed } from "lucide-react";
import { toast } from "sonner";

interface ModoPatrulhaProps {
  roteiroDia: RoteiroDia;
  onMarcarConcluido: (blocoId: string) => void;
  onRegistrarExecucao: (blocoId: string, execucao: ExecucaoBloco) => void;
  onAbrirMapa: (blocoId: string) => void;
}

const horaParaMin = (hora: string): number => {
  const [h, m] = hora.split(":").map(Number);
  return h * 60 + m;
};

const formatRemainingTime = (totalSeconds: number): string => {
  if (totalSeconds <= 0) return "Encerrando...";
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}min`;
  }
  if (minutes > 0) {
    return `${minutes}min ${seconds}s`;
  }
  return `${seconds}s`;
};

export default function ModoPatrulha({
  roteiroDia,
  onRegistrarExecucao,
  onAbrirMapa,
}: ModoPatrulhaProps) {
  const [currentTime, setCurrentTime] = useState(() => new Date());
  const [mostrarFundamentacao, setMostrarFundamentacao] = useState(false);
  const [notaCampo, setNotaCampo] = useState("");
  const [motivoCampo, setMotivoCampo] = useState("");

  // Update clock every second for precise countdowns
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const turnStart = useMemo(() => {
    return new Date(`${roteiroDia.configuracao.data}T${roteiroDia.configuracao.horaInicio}`);
  }, [roteiroDia.configuracao.data, roteiroDia.configuracao.horaInicio]);

  const durationMin = useMemo(() => {
    return DURACAO_TURNO_MIN[roteiroDia.configuracao.tipoAtividade] ?? 480;
  }, [roteiroDia.configuracao.tipoAtividade]);

  const turnEnd = useMemo(() => {
    return new Date(turnStart.getTime() + durationMin * 60 * 1000);
  }, [turnStart, durationMin]);

  // Compute absolute start/end times for each block along a continuous timeline
  const blocksWithTimes = useMemo(() => {
    let currentOffset = 0;
    return roteiroDia.blocos
      .slice()
      .sort((a, b) => a.ordem - b.ordem)
      .map((bloco) => {
        const startMin = horaParaMin(bloco.horaInicio);
        const endMin = horaParaMin(bloco.horaFim);
        let duration = endMin - startMin;
        if (duration < 0) duration += 1440; // crosses midnight

        const start = new Date(turnStart.getTime() + currentOffset * 60 * 1000);
        const end = new Date(start.getTime() + duration * 60 * 1000);

        currentOffset += duration;
        return { bloco, start, end };
      });
  }, [roteiroDia.blocos, turnStart]);

  // Determine the active state based on device clock
  const status = useMemo(() => {
    const nowMs = currentTime.getTime();
    const startMs = turnStart.getTime();
    const endMs = turnEnd.getTime();

    if (nowMs < startMs) {
      const secondsToStart = Math.floor((startMs - nowMs) / 1000);
      return { type: "before", secondsToStart };
    }

    if (nowMs >= endMs) {
      return { type: "after" };
    }

    // Find active block
    const activeIndex = blocksWithTimes.findIndex(
      (item) => nowMs >= item.start.getTime() && nowMs < item.end.getTime()
    );

    if (activeIndex === -1) {
      // Fallback if there is a small gap or overshoot
      return { type: "after" };
    }

    const activeItem = blocksWithTimes[activeIndex];
    const nextItem = blocksWithTimes[activeIndex + 1] || null;

    const remainingSec = Math.max(0, Math.floor((activeItem.end.getTime() - nowMs) / 1000));
    const totalSec = (activeItem.end.getTime() - activeItem.start.getTime()) / 1000;
    const elapsedSec = (nowMs - activeItem.start.getTime()) / 1000;
    const progressPct = Math.min(100, Math.max(0, (elapsedSec / totalSec) * 100));

    // Turn progress
    const turnElapsedSec = (nowMs - startMs) / 1000;
    const turnTotalSec = durationMin * 60;
    const turnProgressPct = Math.min(100, Math.max(0, (turnElapsedSec / turnTotalSec) * 100));

    return {
      type: "active",
      activeItem,
      nextItem,
      remainingSec,
      progressPct,
      turnProgressPct,
    };
  }, [currentTime, turnStart, turnEnd, blocksWithTimes, durationMin]);

  const activeBlockForForm =
    status.type === "active" ? (status as { activeItem: { bloco: BlocoHorario } }).activeItem.bloco : null;

  useEffect(() => {
    setNotaCampo(activeBlockForForm?.execucao?.nota ?? "");
    setMotivoCampo(activeBlockForForm?.execucao?.motivo ?? "");
  }, [activeBlockForForm?.id, activeBlockForForm?.execucao?.nota, activeBlockForForm?.execucao?.motivo]);

  const capturarGPS = (): Promise<Pick<ExecucaoBloco, "lat" | "lng" | "gpsStatus">> => {
    if (!navigator.geolocation) {
      return Promise.resolve({ lat: null, lng: null, gpsStatus: "indisponivel" });
    }

    return new Promise(resolve => {
      navigator.geolocation.getCurrentPosition(
        pos => resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          gpsStatus: "capturado",
        }),
        err => resolve({
          lat: null,
          lng: null,
          gpsStatus: err.code === err.PERMISSION_DENIED ? "negado" : "indisponivel",
        }),
        { enableHighAccuracy: true, maximumAge: 15000, timeout: 8000 }
      );
    });
  };

  const registrarExecucao = async (bloco: BlocoHorario, estado: EstadoExecucaoBloco) => {
    // Haptic feedback if supported
    if ("vibrate" in navigator) {
      try {
        navigator.vibrate(60);
      } catch (e) {
        // ignore vibrate blocks
      }
    }

    const gps = await capturarGPS();
    onRegistrarExecucao(bloco.id, {
      estado,
      nota: notaCampo.trim() || undefined,
      motivo: motivoCampo.trim() || undefined,
      horarioEfetivo: new Date().toISOString(),
      ...gps,
    });

    const labels: Record<EstadoExecucaoBloco, string> = {
      cumprido: "cumprido",
      parcial: "parcial",
      nao_realizado: "não realizado",
    };
    toast.success(`Bloco registrado como ${labels[estado]}.`);
  };

  const getModalityStyles = (mod: string) => {
    switch (mod) {
      case "PREL":
      case "REL":
        return {
          bg: "bg-blue-900/10 dark:bg-blue-900/35 border-blue-600/30",
          text: "text-blue-700 dark:text-blue-400",
          badgeBg: "bg-blue-700 text-white",
        };
      case "REF":
        return {
          bg: "bg-emerald-600/10 dark:bg-emerald-600/20 border-emerald-600/30",
          text: "text-emerald-700 dark:text-emerald-400",
          badgeBg: "bg-emerald-600 text-white",
        };
      case "DESL":
        return {
          bg: "bg-slate-500/10 dark:bg-slate-500/20 border-slate-500/30",
          text: "text-slate-700 dark:text-slate-400",
          badgeBg: "bg-slate-500 text-white",
        };
      case "POST":
        return {
          bg: "bg-red-600/10 dark:bg-red-600/20 border-red-600/30",
          text: "text-red-700 dark:text-red-400",
          badgeBg: "bg-red-600 text-white",
        };
      case "PREV":
        return {
          bg: "bg-sky-600/10 dark:bg-sky-600/20 border-sky-600/30",
          text: "text-sky-700 dark:text-sky-400",
          badgeBg: "bg-sky-600 text-white",
        };
      case "PE":
        return {
          bg: "bg-amber-600/10 dark:bg-amber-600/20 border-amber-600/30",
          text: "text-amber-700 dark:text-amber-400",
          badgeBg: "bg-amber-600 text-white",
        };
      case "FISC":
        return {
          bg: "bg-purple-600/10 dark:bg-purple-600/20 border-purple-600/30",
          text: "text-purple-700 dark:text-purple-400",
          badgeBg: "bg-purple-600 text-white",
        };
      case "ESC":
        return {
          bg: "bg-pink-600/10 dark:bg-pink-600/20 border-pink-600/30",
          text: "text-pink-700 dark:text-pink-400",
          badgeBg: "bg-pink-600 text-white",
        };
      case "RURAL":
        return {
          bg: "bg-teal-600/10 dark:bg-teal-600/20 border-teal-600/30",
          text: "text-teal-700 dark:text-teal-400",
          badgeBg: "bg-teal-600 text-white",
        };
      case "SAT":
        return {
          bg: "bg-orange-600/10 dark:bg-orange-600/20 border-orange-600/30",
          text: "text-orange-700 dark:text-orange-400",
          badgeBg: "bg-orange-600 text-white",
        };
      default:
        return {
          bg: "bg-gray-500/10 dark:bg-gray-500/20 border-gray-500/30",
          text: "text-gray-700 dark:text-gray-400",
          badgeBg: "bg-gray-500 text-white",
        };
    }
  };

  const ppiFundamentacao = useMemo(() => {
    return gerarFundamentacao(roteiroDia.configuracao);
  }, [roteiroDia.configuracao]);

  if (status.type === "before") {
    const firstBlock = blocksWithTimes[0]?.bloco;
    return (
      <div className="flex flex-col items-center justify-center p-6 text-center h-full min-h-[50vh] dark:text-slate-100 animate-fade-in">
        <Clock className="w-16 h-16 text-blue-600 dark:text-blue-400 mb-4 animate-pulse" />
        <h2 className="text-xl font-bold mb-2">Turno ainda não iniciado</h2>
        <p className="text-gray-500 dark:text-slate-400 max-w-xs mb-6 text-sm">
          O turno está agendado para iniciar às <span className="font-semibold text-gray-800 dark:text-white">{roteiroDia.configuracao.horaInicio}</span>.
        </p>
        <div className="bg-blue-50 dark:bg-slate-800 border border-blue-100 dark:border-slate-800 rounded-2xl p-4 w-full max-w-sm mb-6 shadow-inner">
          <p className="text-xs text-blue-600 dark:text-blue-400 uppercase tracking-wider font-bold mb-1">
            Tempo para início
          </p>
          <p className="text-2xl font-black text-blue-900 dark:text-white">
            {formatRemainingTime(status.secondsToStart!)}
          </p>
        </div>
        {firstBlock && (
          <div className="w-full max-w-sm border border-gray-200 dark:border-slate-800 rounded-xl p-4 text-left bg-white dark:bg-slate-900 shadow-xs">
            <p className="text-xs text-gray-400 mb-1 font-semibold uppercase">Primeiro Bloco</p>
            <p className="font-bold text-gray-800 dark:text-white text-base">
              {firstBlock.horaInicio} às {firstBlock.horaFim} - {firstBlock.modalidade}
            </p>
            <p className="text-sm text-gray-600 dark:text-slate-400 mt-0.5">{firstBlock.local}</p>
          </div>
        )}
      </div>
    );
  }

  if (status.type === "after") {
    return (
      <div className="flex flex-col items-center justify-center p-6 text-center h-full min-h-[50vh] dark:text-slate-100 animate-fade-in">
        <CheckCircle2 className="w-16 h-16 text-emerald-600 dark:text-emerald-400 mb-4" />
        <h2 className="text-xl font-bold mb-2">Turno encerrado</h2>
        <p className="text-gray-500 dark:text-slate-400 max-w-xs mb-6 text-sm">
          O horário limite do turno era <span className="font-semibold text-gray-800 dark:text-white">{roteiroDia.configuracao.horaTermino}</span>.
        </p>
        <div className="w-full max-w-sm border border-gray-200 dark:border-slate-800 rounded-xl p-4 bg-white dark:bg-slate-900 mb-6 shadow-xs">
          <div className="flex justify-between items-center text-sm">
            <span className="text-gray-500 dark:text-slate-400">Total de blocos:</span>
            <span className="font-bold">{roteiroDia.blocos.length}</span>
          </div>
          <div className="flex justify-between items-center text-sm mt-2">
            <span className="text-gray-500 dark:text-slate-400">Cumpridos:</span>
            <span className="font-bold text-emerald-600 dark:text-emerald-400">
              {roteiroDia.blocos.filter((b) => b.concluido).length}
            </span>
          </div>
        </div>
      </div>
    );
  }

  const { activeItem, nextItem, remainingSec, progressPct, turnProgressPct } = status as {
    activeItem: { bloco: BlocoHorario; start: Date; end: Date };
    nextItem: { bloco: BlocoHorario; start: Date; end: Date } | null;
    remainingSec: number;
    progressPct: number;
    turnProgressPct: number;
  };

  const activeStyles = getModalityStyles(activeItem.bloco.modalidade);

  return (
    <div className="space-y-4 px-2 select-none dark:text-slate-100 animate-fade-in">
      {/* Turn Progress Summary */}
      <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl p-3 shadow-xs">
        <div className="flex justify-between items-center text-xs text-gray-400 dark:text-slate-500 font-semibold mb-1">
          <span>PROGRESSO DO TURNO</span>
          <span>
            {roteiroDia.blocos.filter((b) => b.concluido).length} de {roteiroDia.blocos.length} blocos
          </span>
        </div>
        <div className="w-full bg-gray-200 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
          <div
            className="bg-emerald-500 h-full rounded-full transition-all duration-500"
            style={{ width: `${turnProgressPct}%` }}
          />
        </div>
      </div>

      {/* Main ACTIVE Block Card */}
      <div
        className={`border-2 rounded-2xl p-5 shadow-sm transition-all duration-300 relative overflow-hidden bg-white dark:bg-slate-900 ${activeStyles.bg}`}
      >
        {/* Modality Tag */}
        <div className="flex justify-between items-start mb-3">
          <span
            className={`px-3 py-1 rounded-full text-xs font-black tracking-wide uppercase shadow-xs ${activeStyles.badgeBg}`}
          >
            {activeItem.bloco.modalidade}
          </span>
          <span className="text-sm font-bold text-gray-500 dark:text-slate-400 flex items-center gap-1.5">
            <Clock className="w-4 h-4" /> {activeItem.bloco.horaInicio} - {activeItem.bloco.horaFim}
          </span>
        </div>

        {/* Location - High Contrast */}
        <h2 className="text-2xl font-black text-gray-900 dark:text-white leading-tight tracking-tight mb-4 flex items-start gap-1.5">
          <MapPin className="w-6 h-6 text-red-600 dark:text-red-500 flex-shrink-0 mt-0.5" />
          <span>{activeItem.bloco.local}</span>
        </h2>

        {/* Countdown & Local Progress Bar */}
        <div className="space-y-2 mb-5">
          <div className="flex justify-between items-end">
            <span className="text-xs text-gray-400 dark:text-slate-500 font-bold uppercase">Tempo Restante</span>
            <span className={`text-xl font-black ${activeStyles.text}`}>
              {formatRemainingTime(remainingSec)}
            </span>
          </div>
          <div className="w-full bg-gray-200/50 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden">
            <div
              className="bg-current h-full rounded-full transition-all duration-1000"
              style={{ width: `${progressPct}%`, color: getModalityColorRaw(activeItem.bloco.modalidade) }}
            />
          </div>
        </div>

        {/* Action Button - Giant Checkmark */}
        <div className="mt-4">
          <button
            onClick={() => registrarExecucao(activeItem.bloco, "cumprido")}
            className={`w-full py-4 px-6 rounded-xl text-base font-black flex items-center justify-center gap-2 transition-all min-h-[52px] select-none shadow-md ${
              activeItem.bloco.concluido
                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/45 dark:text-emerald-400 border border-emerald-500/20"
                : "bg-emerald-600 hover:bg-emerald-700 text-white active:scale-97 cursor-pointer"
            }`}
          >
            <CheckCircle2 className="w-5 h-5" />
            {activeItem.bloco.concluido ? "✓ CUMPRIDO" : "MARCAR COMO CUMPRIDO"}
          </button>
        </div>

        <div className="mt-3 space-y-3">
          {typeof activeItem.bloco.lat === "number" && typeof activeItem.bloco.lng === "number" ? (
            <div className="grid grid-cols-3 gap-2">
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${activeItem.bloco.lat},${activeItem.bloco.lng}`}
                target="_blank"
                rel="noopener noreferrer"
                className="min-h-[48px] rounded-xl bg-[#0a2540] text-white text-xs font-black flex items-center justify-center gap-1.5"
              >
                <Navigation className="w-4 h-4" /> Maps
              </a>
              <a
                href={`waze://?ll=${activeItem.bloco.lat},${activeItem.bloco.lng}&navigate=yes`}
                className="min-h-[48px] rounded-xl bg-emerald-600 text-white text-xs font-black flex items-center justify-center gap-1.5"
              >
                <Navigation className="w-4 h-4" /> Waze
              </a>
              <button
                onClick={() => onAbrirMapa(activeItem.bloco.id)}
                className="min-h-[48px] rounded-xl bg-white/80 dark:bg-slate-950 border border-gray-200 dark:border-slate-800 text-gray-800 dark:text-white text-xs font-black flex items-center justify-center gap-1.5"
              >
                <MapPin className="w-4 h-4" /> Mapa
              </button>
            </div>
          ) : (
            <div className="rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/40 px-3 py-2 text-xs font-bold text-amber-900 dark:text-amber-300 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>Ponto sem localização cadastrada.</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => registrarExecucao(activeItem.bloco, "parcial")}
              className={`min-h-[48px] rounded-xl text-xs font-black flex items-center justify-center gap-1.5 border ${
                activeItem.bloco.execucao?.estado === "parcial"
                  ? "bg-amber-600 text-white border-amber-600"
                  : "bg-white dark:bg-slate-950 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-900/50"
              }`}
            >
              <CircleDashed className="w-5 h-5" /> Parcial
            </button>
            <button
              onClick={() => registrarExecucao(activeItem.bloco, "nao_realizado")}
              className={`min-h-[48px] rounded-xl text-xs font-black flex items-center justify-center gap-1.5 border ${
                activeItem.bloco.execucao?.estado === "nao_realizado"
                  ? "bg-red-600 text-white border-red-600"
                  : "bg-white dark:bg-slate-950 text-red-700 dark:text-red-400 border-red-200 dark:border-red-900/50"
              }`}
            >
              <AlertTriangle className="w-5 h-5" /> Não realizado
            </button>
          </div>

          <div className="space-y-2">
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              {["Ponto sem movimento", "Abordagem realizada", "Ocorrência atendida", "Orientação ao público"].map(nota => (
                <button
                  key={nota}
                  type="button"
                  onClick={() => setNotaCampo(nota)}
                  className="shrink-0 min-h-[36px] px-3 rounded-full border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-[11px] font-bold text-gray-700 dark:text-slate-300"
                >
                  {nota}
                </button>
              ))}
            </div>
            <textarea
              value={notaCampo}
              onChange={e => setNotaCampo(e.target.value)}
              maxLength={160}
              placeholder="Nota rápida opcional"
              className="w-full min-h-[68px] rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-gray-900 dark:text-white resize-none"
            />
            <input
              value={motivoCampo}
              onChange={e => setMotivoCampo(e.target.value)}
              maxLength={120}
              placeholder="Motivo, se parcial ou não realizado"
              className="w-full min-h-[44px] rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-gray-900 dark:text-white"
            />
            {activeItem.bloco.execucao && (
              <p className="text-[11px] font-bold text-gray-500 dark:text-slate-400">
                Registrado {activeItem.bloco.execucao.horarioEfetivo ? new Date(activeItem.bloco.execucao.horarioEfetivo).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : ""} · GPS {activeItem.bloco.execucao.gpsStatus === "capturado" ? "capturado" : "sem coordenada"}
              </p>
            )}
          </div>
        </div>

        {/* COLLAPSIBLE DOUTRINA / JUSTIFICATION */}
        <div className="mt-4 pt-3 border-t border-gray-200/50 dark:border-slate-800">
          <button
            onClick={() => setMostrarFundamentacao(!mostrarFundamentacao)}
            className="flex items-center justify-between w-full text-xs font-bold text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:hover:text-white transition-colors py-1 cursor-pointer"
          >
            <span className="flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              DOUTRINA & FUNDAMENTAÇÃO
            </span>
            {mostrarFundamentacao ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {mostrarFundamentacao && (
            <div className="mt-2 text-xs space-y-2 bg-gray-50 dark:bg-slate-950/50 border border-gray-100 dark:border-slate-800 rounded-lg p-3 animate-in fade-in slide-in-from-top-1">
              <div>
                <p className="font-bold text-gray-400 dark:text-slate-500 mb-0.5">PROBLEMA A SOLUCIONAR:</p>
                <p className="text-gray-700 dark:text-slate-300 leading-normal">
                  {activeItem.bloco.problemaSolucionar}
                </p>
              </div>
              <div>
                <p className="font-bold text-gray-400 dark:text-slate-500 mb-0.5">AÇÕES OPERACIONAIS:</p>
                <p className="text-gray-700 dark:text-slate-300 leading-normal">
                  {activeItem.bloco.acoesPolicia}
                </p>
              </div>
              {activeItem.bloco.justificativa && (
                <div>
                  <p className="font-bold text-gray-400 dark:text-slate-500 mb-0.5">MOTIVAÇÃO TÉCNICA (PPI):</p>
                  <p className="text-gray-700 dark:text-slate-300 leading-normal">
                    {activeItem.bloco.justificativa}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* A Seguir Card */}
      {nextItem && (
        <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl p-4 shadow-xs">
          <p className="text-xs text-gray-400 dark:text-slate-500 font-bold uppercase mb-2">A Seguir</p>
          <div className="flex justify-between items-start mb-2">
            <div>
              <span
                className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold text-white uppercase mb-1.5 ${
                  getModalityStyles(nextItem.bloco.modalidade).badgeBg
                }`}
              >
                {nextItem.bloco.modalidade}
              </span>
              <h4 className="font-bold text-gray-800 dark:text-white text-base leading-tight">
                {nextItem.bloco.local}
              </h4>
            </div>
            <span className="text-xs font-black text-gray-400 dark:text-slate-500 ml-2 whitespace-nowrap bg-gray-50 dark:bg-slate-950 border border-gray-200 dark:border-slate-800 px-2 py-1 rounded-md">
              {nextItem.bloco.horaInicio} - {nextItem.bloco.horaFim}
            </span>
          </div>

          {/* Quick Deep Link Navigation */}
          {typeof nextItem.bloco.lat === "number" && typeof nextItem.bloco.lng === "number" && (
            <div className="mt-3 pt-3 border-t border-gray-100 dark:border-slate-800/80 flex gap-2">
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${nextItem.bloco.lat},${nextItem.bloco.lng}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 py-2 px-3 bg-[#0a2540] dark:bg-blue-900/40 border border-blue-800/10 hover:bg-[#12365a] text-white rounded-lg text-xs font-bold text-center flex items-center justify-center gap-1.5 min-h-[38px] cursor-pointer"
              >
                🗺️ Google Maps
              </a>
              <a
                href={`waze://?ll=${nextItem.bloco.lat},${nextItem.bloco.lng}&navigate=yes`}
                className="flex-1 py-2 px-3 bg-[#10b981] dark:bg-emerald-900/40 border border-emerald-800/10 hover:bg-[#13cf92] text-white rounded-lg text-xs font-bold text-center flex items-center justify-center gap-1.5 min-h-[38px] cursor-pointer"
              >
                🚗 Waze
              </a>
            </div>
          )}
        </div>
      )}

      {/* Bulleted Rationale Drawer (Trigger) */}
      <div className="bg-blue-900/5 dark:bg-slate-900 border border-blue-900/10 dark:border-slate-800 rounded-xl p-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <HelpCircle className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          <div>
            <p className="text-xs font-bold text-gray-700 dark:text-slate-300">Justificativas Gerais (PPI)</p>
            <p className="text-[10px] text-gray-400 dark:text-slate-500">Citação de indicadores criminais oficiais</p>
          </div>
        </div>
        <button
          onClick={() => {
            // Collapsible drawer of the whole ppi rationale list
            setMostrarFundamentacao(false); // Close item rationale first
            const dialog = document.getElementById("general-rationale-dialog") as HTMLDialogElement;
            if (dialog) dialog.showModal();
          }}
          className="text-xs font-bold text-blue-700 dark:text-blue-400 hover:underline px-3 py-1.5 rounded-lg bg-blue-600/10 dark:bg-blue-600/20 cursor-pointer min-h-[36px]"
        >
          Visualizar
        </button>
      </div>

      {/* GENERAL RATIONALE MODAL DIALOG */}
      <dialog
        id="general-rationale-dialog"
        className="modal-overlay backdrop:bg-black/50 p-4 w-full max-w-sm rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl m-auto"
      >
        <div className="flex flex-col max-h-[80vh]">
          <div className="flex justify-between items-center pb-3 border-b border-gray-100 dark:border-slate-800 mb-3">
            <h3 className="text-sm font-bold flex items-center gap-1.5">
              ⚖️ Fundamentação do Roteiro (PPI)
            </h3>
            <button
              onClick={() => {
                const dialog = document.getElementById("general-rationale-dialog") as HTMLDialogElement;
                if (dialog) dialog.close();
              }}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-white font-bold min-h-[36px] min-w-[36px] text-base"
            >
              ✕
            </button>
          </div>
          <div className="overflow-y-auto pr-1 text-xs text-gray-600 dark:text-slate-400 space-y-2">
            <ul className="list-disc list-inside space-y-2">
              {ppiFundamentacao.map((linha, idx) => (
                <li key={idx} className="leading-relaxed pl-1 -indent-5 ml-5">
                  {linha}
                </li>
              ))}
            </ul>
          </div>
          <button
            onClick={() => {
              const dialog = document.getElementById("general-rationale-dialog") as HTMLDialogElement;
              if (dialog) dialog.close();
            }}
            className="mt-4 w-full btn-tactical text-xs font-bold py-2.5"
          >
            Fechar
          </button>
        </div>
      </dialog>
    </div>
  );
}

function getModalityColorRaw(mod: string): string {
  switch (mod) {
    case "PREL":
    case "REL":
      return "#1e3a8a";
    case "REF":
      return "#10b981";
    case "DESL":
      return "#6b7280";
    case "POST":
      return "#ef4444";
    case "PREV":
      return "#3b82f6";
    case "PE":
      return "#f59e0b";
    case "FISC":
      return "#8b5cf6";
    case "ESC":
      return "#ec4899";
    case "RURAL":
      return "#059669";
    case "SAT":
      return "#dc2626";
    default:
      return "#4b5563";
  }
}
