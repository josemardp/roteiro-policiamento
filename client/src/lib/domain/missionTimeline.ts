import type { Modalidade, Prioridade, ModificadorModalidade } from "./directivePayload";

export type TipoFase = "CONTEXTO" | "PREFERENCIA" | "META" | "RESTRICAO";

export interface FaseOperacional {
  nome: string;
  tipo: TipoFase;
  inicio: string; // "HH:MM"
  fim: string;    // "HH:MM"

  // tipo === "PREFERENCIA"
  modificadores?: ModificadorModalidade[];

  // tipo === "META"
  metas?: {
    minimoVisitas?: number;
    maximoVisitas?: number;
    municipioPreferencial?: string;
  };

  // tipo === "RESTRICAO"
  restricoesDuras?: {
    vetaDeslocamento?: boolean;
    suspendeRefeicao?: boolean;
    localFixoId?: string;
    modalidadesPermitidas?: Modalidade[];
    modalidadesProibidas?: Modalidade[];
  };

  // tipo === "CONTEXTO"
  contexto?: {
    evento: string;
    criticidade: "BAIXA" | "MEDIA" | "ALTA";
    riscoAglomeracao?: boolean;
    focoEspecifico?: "COMERCIAL" | "RESIDENCIAL" | "RURAL" | "TRANSITO";
  };
}

export interface MissionTimeline {
  id: string;
  nome: string;
  fases: FaseOperacional[];
}

// ─── Helpers de Horário ───────────────────────────────────────────────────────

export function horaParaMin(hora: string): number {
  const [h, m] = hora.split(":").map(Number);
  return h * 60 + m;
}

export class MissionTimelineHelper {
  private fasesOrdenadas: FaseOperacional[];

  constructor(timeline?: MissionTimeline) {
    this.fasesOrdenadas = timeline
      ? [...timeline.fases].sort((a, b) => a.inicio.localeCompare(b.inicio))
      : [];
  }

  /**
   * Retorna a lista de todas as fases ativas para um determinado minuto do turno
   */
  public buscarFasesAtivas(minutosAtuais: number): FaseOperacional[] {
    const currentMin = minutosAtuais % 1440;

    return this.fasesOrdenadas.filter((fase) => {
      const start = horaParaMin(fase.inicio);
      const endOriginal = horaParaMin(fase.fim);
      
      // Se o fim for menor ou igual ao início, a janela cruza a meia-noite
      const end = endOriginal <= start ? endOriginal + 1440 : endOriginal;

      // Se a janela cruza a meia-noite e estamos na parte do dia seguinte (minutos < início),
      // normalizamos a hora atual somando 1440 para cair na mesma janela lógica
      const current =
        currentMin < start && end > 1440
          ? currentMin + 1440
          : currentMin;

      return current >= start && current < end;
    });
  }
}
