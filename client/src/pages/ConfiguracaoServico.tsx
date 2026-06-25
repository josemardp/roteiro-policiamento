/**
 * Tela 1 — Configuração do Serviço
 * Design: Operacional Moderno — Formulário com campos grandes, mobile-first
 */

import { useState } from "react";
import { z } from "zod";
import ModoManualUI from "@/components/ModoManualUI";
import type {
  ConfiguracaoServico,
  TipoAtividade,
  Municipio,
  TipoPoliciamento,
  FocoDistribuicao,
} from "@/lib/types";
import { calcularHoraTermino, parseDataLocal } from "@/lib/gerarCPP";
import { ATIVIDADE_MONO_MUNICIPIO, DURACAO_TURNO_MIN } from "@/lib/constants";
import { OPM_CPI10 } from "@/lib/opm-cpi10";
import type { DirectivePayload } from "@/lib/domain/directivePayload";


const schema = z.object({
  data: z.string().min(1, "Data é obrigatória"),
  horaInicio: z.string().regex(/^\d{2}:\d{2}$/, "Hora inválida"),
});

const TEMPLATES_DIRETIVAS = {
  operacaoBancaria: {
    versaoSchema: "1.1" as const,
    criadoEmISO: "2026-06-24T17:00:00Z",
    observacoes: ["Foco em aglomeração e trânsito na região bancária (CEF / Bradesco)"],
    focosDiretivas: [
      {
        id: "f_corredor_meta",
        tipo: "Foco Evento" as const,
        posicao: "Automático" as const,
        origem: "ORDEM_SERVICO" as const,
        corredoresOperacionais: [
          {
            id: "corr_bancario",
            nome: "Corredor Bancário (Guararapes)",
            origem: { lat: -21.26, lng: -50.64 },
            destino: { lat: -21.262, lng: -50.641 },
            raioMetros: 500,
            prioridade: "ALTA" as const,
          }
        ],
        timeline: {
          id: "t_meta",
          nome: "Timeline Meta e Pref",
          fases: [
            {
              nome: "Foco CEF",
              tipo: "PREFERENCIA" as const,
              inicio: "17:00",
              fim: "20:00",
              modificadores: [
                {
                  modalidade: "PE" as const,
                  multiplicadorPeso: 10.0,
                  prioridade: "ALTA" as const,
                  alvos: [
                    {
                      tipo: "PONTO_EXISTENTE" as const,
                      textoOriginal: "Caixa Econômica Federal (Av. Marechal Floriano, 675)",
                      confiancaMatch: 1.0,
                    }
                  ]
                }
              ]
            },
            {
              nome: "Visitas Minimas Guararapes",
              tipo: "META" as const,
              inicio: "17:00",
              fim: "20:00",
              metas: {
                minimoVisitas: 3,
                municipioPreferencial: "Guararapes"
              }
            }
          ]
        }
      }
    ]
  },
  permanenciaCEF: {
    versaoSchema: "1.1" as const,
    criadoEmISO: "2026-06-24T17:00:00Z",
    observacoes: ["Permanência mínima de 120min contínuos na Caixa Econômica"],
    focosDiretivas: [
      {
        id: "f_persistente",
        tipo: "Foco Evento" as const,
        posicao: "Automático" as const,
        origem: "ORDEM_SERVICO" as const,
        objetivosPersistentes: [
          {
            id: "obj_cef_120m",
            localId: "Caixa Econômica Federal (Av. Marechal Floriano, 675)",
            inicio: "18:00",
            fim: "21:00",
            permanenciaMinimaMinutos: 120,
            modalidade: "PE" as const
          }
        ],
        timeline: {
          id: "t_restricao",
          nome: "Timeline Restrição",
          fases: [
            {
              nome: "Sem Refeição no Pico",
              tipo: "RESTRICAO" as const,
              inicio: "18:00",
              fim: "21:00",
              restricoesDuras: {
                suspendeRefeicao: true
              }
            }
          ]
        }
      }
    ]
  }
};

interface ConfiguracaoServicioProps {
  onGerarCPP: (config: ConfiguracaoServico) => void;
}

export default function ConfiguracaoServico({
  onGerarCPP,
}: ConfiguracaoServicioProps) {
  const [tipoAtividade, setTipoAtividade] =
    useState<TipoAtividade>("Atividade Delegada");
  const [municipiosSel, setMunicipiosSel] = useState<Municipio[]>(["Valparaíso"]);

  const [tipoPoliciamento, setTipoPoliciamento] =
    useState<TipoPoliciamento>("Urbano");
  const [modoAvancadoFoco, setModoAvancadoFoco] = useState(false);
  const [focosAvancados, setFocosAvancados] = useState<FocoDistribuicao[]>([
    { id: "1", tipo: "Urbano", posicao: "Automático" }
  ]);
  const [nomeEvento, setNomeEvento] = useState("");
  const [tipoEvento, setTipoEvento] = useState("");
  const [localEvento, setLocalEvento] = useState("");
  const [data, setData] = useState(new Date().toISOString().split("T")[0]);
  const [horaInicio, setHoraInicio] = useState("17:00");
  const [modalidadeGeracao, setModalidadeGeracao] = useState<
    "automatica" | "manual"
  >("automatica");
  const [blocosManuais, setBlocosManuais] = useState("");
  const [municipioBase, setMunicipioBase] = useState<Municipio>("Valparaíso");
  const [municipiosRondaOPM, setMunicipiosRondaOPM] = useState<string[]>(["Valparaíso", "Guararapes"]);
  const [opmSearch, setOpmSearch] = useState("");
  const [efetivo, setEfetivo] = useState("");
  const [viatura, setViatura] = useState("");
  const [prefixoUS, setPrefixoUS] = useState("");

  const [diretivaCarregada, setDiretivaCarregada] = useState<DirectivePayload | null>(null);
  const [showJsonInput, setShowJsonInput] = useState(false);
  const [jsonText, setJsonText] = useState("");
  const [errorDiretiva, setErrorDiretiva] = useState<string | null>(null);
  const [previewCollapsed, setPreviewCollapsed] = useState(false);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        validarETransmitirDiretiva(parsed);
      } catch (err: any) {
        setErrorDiretiva("Falha ao ler o arquivo JSON: " + err.message);
      }
    };
    reader.readAsText(file);
  };

  const validarETransmitirDiretiva = (payload: any) => {
    if (!payload || typeof payload !== "object") {
      setErrorDiretiva("O payload de diretivas deve ser um objeto JSON válido.");
      return;
    }
    if (payload.versaoSchema !== "1.1") {
      setErrorDiretiva("A versão do schema de diretiva deve ser '1.1'.");
      return;
    }
    if (!Array.isArray(payload.focosDiretivas)) {
      setErrorDiretiva("O campo 'focosDiretivas' deve ser um array.");
      return;
    }
    
    setDiretivaCarregada(payload);
    setErrorDiretiva(null);
    setJsonText(JSON.stringify(payload, null, 2));
    setShowJsonInput(false);
  };

  const handleApplyJsonText = () => {
    try {
      const parsed = JSON.parse(jsonText);
      validarETransmitirDiretiva(parsed);
    } catch (err: any) {
      setErrorDiretiva("JSON inválido: " + err.message);
    }
  };

  const horaTermino = calcularHoraTermino(horaInicio, tipoAtividade);

  const atividadeMonoMunicipio = ATIVIDADE_MONO_MUNICIPIO.has(tipoAtividade);

  // parseDataLocal evita bug de fuso: new Date("YYYY-MM-DD") interpreta como UTC
  const diaSemana = data
    ? parseDataLocal(data).toLocaleDateString("pt-BR", { weekday: "long" })
    : "";

  const handleToggleMunicipio = (mun: Municipio) => {
    if (atividadeMonoMunicipio) {
      setMunicipiosSel([mun]);
      return;
    }
    if (municipiosSel.includes(mun)) {
      setMunicipiosSel(municipiosSel.filter(m => m !== mun));
    } else {
      setMunicipiosSel([...municipiosSel, mun]);
    }
  };

  const moverMunicipio = (index: number, direction: -1 | 1) => {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= municipiosSel.length) return;
    const novos = [...municipiosSel];
    [novos[index], novos[nextIndex]] = [novos[nextIndex], novos[index]];
    setMunicipiosSel(novos);
  };

  const temFocoEvento = modoAvancadoFoco
    ? focosAvancados.some(f => f.tipo === "Foco Evento")
    : tipoPoliciamento === "Foco Evento";

  const validacao = schema.safeParse({ data, horaInicio });
  const isSupReg = tipoAtividade === "Supervisor Regional";
  const camposValidos =
    validacao.success &&
    (isSupReg ? municipiosRondaOPM.length > 0 : municipiosSel.length > 0) &&
    (!temFocoEvento || (nomeEvento.trim() !== "" && localEvento.trim() !== ""));
  const erros = !validacao.success ? validacao.error.flatten().fieldErrors : {};

  const handleGerarCPP = () => {
    if (!camposValidos) return;
    const config: ConfiguracaoServico = {
      tipoAtividade,
      municipios: isSupReg ? [municipioBase] : municipiosSel,
      municipio: isSupReg ? municipioBase : municipiosSel[0],
      tipoPoliciamento,
      focos: modoAvancadoFoco ? focosAvancados : undefined,
      data,
      horaInicio,
      horaTermino,
      modalidadeGeracao,
      blocosManuais,
      efetivo,
      viatura,
      prefixoUS,
      nomeEvento: temFocoEvento ? nomeEvento : undefined,
      tipoEvento: temFocoEvento ? tipoEvento : undefined,
      localEvento: temFocoEvento ? localEvento : undefined,
      municipioBase: isSupReg ? municipioBase : undefined,
      municipiosRondaOPM: isSupReg ? municipiosRondaOPM : undefined,
      diretivas: diretivaCarregada || undefined,
    };
    onGerarCPP(config);
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-32">
      {/* Cabeçalho */}
      <div className="header-sticky">
        <div className="container py-4">
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            👮 PMESP — 5ª Cia
          </h1>
          <p className="text-blue-100 text-sm mt-1">Gerador de CPP do Turno</p>
        </div>
      </div>

      {/* Conteúdo */}
      <div className="container py-6 max-w-2xl">
        <div className="space-y-6">
          {/* Tipo de Atividade */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Tipo de Atividade
            </label>
            <select
              value={tipoAtividade}
              onChange={e => {
                const novoTipo = e.target.value as TipoAtividade;
                setTipoAtividade(novoTipo);
                if (ATIVIDADE_MONO_MUNICIPIO.has(novoTipo) && municipiosSel.length > 1) {
                  setMunicipiosSel([municipiosSel[0]]);
                }
              }}
              className="w-full px-4 py-3 rounded-lg border border-gray-300 text-base font-medium focus:outline-none focus:ring-2 focus:ring-[#0a2540]"
            >
              <optgroup label="Ordinário 12h">
                <option value="Radiopatrulha (RP)">Radiopatrulha (RP)</option>
                <option value="CGP">CGP (Comando de Grupo de Patrulha)</option>
                <option value="CFP">CFP (Comando de Força de Patrulha)</option>
              </optgroup>
              <optgroup label="Supervisão 8h">
                <option value="Supervisor Regional">Supervisor Regional</option>
              </optgroup>
              <optgroup label="Delegada 8h">
                <option value="Atividade Delegada">Atividade Delegada</option>
                <option value="Comando Delegada">Comando Delegada</option>
                <option value="CGP Delegada">CGP Delegada</option>
              </optgroup>
              <optgroup label="DEJEM 8h">
                <option value="DEJEM">DEJEM</option>
                <option value="Comando DEJEM">Comando DEJEM</option>
                <option value="CGP DEJEM">CGP DEJEM</option>
              </optgroup>
            </select>
          </div>

          {/* Municípios — seletor OPM para Supervisor Regional, grid 4 para demais */}
          {isSupReg ? (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Municípios de Ronda (OPMs a inspecionar)
              </label>
              <p className="text-xs text-gray-600 mb-3">
                Selecione as OPMs do CPI-10 e ordene a sequência de visitas.
              </p>
              {/* Busca */}
              <input
                type="text"
                placeholder="Buscar município..."
                value={opmSearch}
                onChange={e => setOpmSearch(e.target.value)}
                className="w-full px-3 py-2 mb-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              {/* Lista filtrável */}
              <div className="max-h-52 overflow-y-auto border border-gray-200 rounded-lg bg-white divide-y divide-gray-100">
                {OPM_CPI10
                  .filter(opm =>
                    opm.municipio.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
                      .includes(opmSearch.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""))
                  )
                  .map(opm => {
                    const selected = municipiosRondaOPM.includes(opm.municipio);
                    return (
                      <label
                        key={opm.municipio}
                        className={`flex items-center gap-3 px-3 py-2 cursor-pointer transition-colors ${selected ? "bg-indigo-50" : "hover:bg-gray-50"}`}
                      >
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => {
                            setMunicipiosRondaOPM(prev =>
                              selected
                                ? prev.filter(m => m !== opm.municipio)
                                : [...prev, opm.municipio]
                            );
                          }}
                          className="accent-indigo-700"
                        />
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-medium text-gray-800">{opm.municipio}</span>
                          <span className="block text-xs text-gray-400 truncate">{opm.unidade}</span>
                        </div>
                        {opm.tipoEndereco === "CENTRO_MPAL" && (
                          <span className="text-xs text-amber-600 shrink-0">est.</span>
                        )}
                      </label>
                    );
                  })}
              </div>
              {/* Sequência selecionada */}
              {municipiosRondaOPM.length > 0 && (
                <div className="mt-3 rounded-xl border border-indigo-100 bg-indigo-50/50 p-3 space-y-2">
                  <p className="text-xs font-bold text-indigo-900">
                    Sequência de ronda: {municipiosRondaOPM.join(" → ")}
                  </p>
                  {municipiosRondaOPM.map((mun, idx) => (
                    <div key={mun} className="flex items-center justify-between gap-2 rounded-lg bg-white border border-indigo-100 px-3 py-2 text-sm">
                      <span className="font-semibold text-gray-800">{idx + 1}. {mun}</span>
                      <div className="flex gap-1">
                        <button type="button"
                          onClick={() => {
                            if (idx === 0) return;
                            const n = [...municipiosRondaOPM];
                            [n[idx - 1], n[idx]] = [n[idx], n[idx - 1]];
                            setMunicipiosRondaOPM(n);
                          }}
                          disabled={idx === 0}
                          className="min-h-[32px] min-w-[32px] rounded border border-gray-200 text-gray-600 disabled:opacity-40 text-xs"
                        >↑</button>
                        <button type="button"
                          onClick={() => {
                            if (idx === municipiosRondaOPM.length - 1) return;
                            const n = [...municipiosRondaOPM];
                            [n[idx], n[idx + 1]] = [n[idx + 1], n[idx]];
                            setMunicipiosRondaOPM(n);
                          }}
                          disabled={idx === municipiosRondaOPM.length - 1}
                          className="min-h-[32px] min-w-[32px] rounded border border-gray-200 text-gray-600 disabled:opacity-40 text-xs"
                        >↓</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {municipiosRondaOPM.length === 0 && (
                <p className="text-xs text-red-600 mt-1">Selecione pelo menos uma OPM.</p>
              )}
            </div>
          ) : (
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              {atividadeMonoMunicipio
                ? "Município da Atividade Delegada"
                : "Sequência de Municípios (início → término)"}
            </label>
            <p className="text-xs text-gray-600 mb-3">
              {atividadeMonoMunicipio
                ? "Atividade Delegada é municipal e usa exatamente um município."
                : "A ordem selecionada define onde o serviço começa, por onde passa e onde termina."}
            </p>
            <div className="grid grid-cols-2 gap-3">
              {(["Valparaíso", "Guararapes", "Rubiácea", "Bento de Abreu"] as Municipio[]).map(mun => {
                const orderIdx = municipiosSel.indexOf(mun);
                const isSelected = orderIdx !== -1;
                return (
                  <button
                    key={mun}
                    type="button"
                    onClick={() => handleToggleMunicipio(mun)}
                    className={`relative p-4 rounded-xl border-2 text-left font-semibold transition-all duration-200 ${
                      isSelected
                        ? "border-[#0a2540] bg-blue-50/50 text-[#0a2540] shadow-sm"
                        : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
                    }`}
                  >
                    <span>{mun}</span>
                    {isSelected && (
                      <span className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center rounded-full bg-[#0a2540] text-white text-xs font-bold">
                        {orderIdx + 1}º
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            {municipiosSel.length === 0 && (
              <p className="text-xs text-red-600 mt-1">Selecione pelo menos um município.</p>
            )}
            {municipiosSel.length > 0 && (
              <div className="mt-3 rounded-xl border border-blue-100 bg-blue-50/50 p-3">
                <p className="text-xs font-bold text-[#0a2540]">
                  {atividadeMonoMunicipio
                    ? `Município: ${municipiosSel[0]}`
                    : `Início: ${municipiosSel[0]} · Término: ${municipiosSel[municipiosSel.length - 1]}`}
                </p>
                {!atividadeMonoMunicipio && municipiosSel.length > 1 && (
                  <div className="mt-2 space-y-2">
                    {municipiosSel.map((mun, index) => (
                      <div
                        key={mun}
                        className="flex items-center justify-between gap-2 rounded-lg bg-white border border-blue-100 px-3 py-2 text-sm"
                      >
                        <span className="font-semibold text-gray-800">
                          {index + 1}. {mun}
                        </span>
                        <div className="flex gap-1">
                          <button
                            type="button"
                            onClick={() => moverMunicipio(index, -1)}
                            disabled={index === 0}
                            className="min-h-[36px] min-w-[36px] rounded-md border border-gray-200 text-gray-700 disabled:opacity-40"
                            title="Mover para cima"
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            onClick={() => moverMunicipio(index, 1)}
                            disabled={index === municipiosSel.length - 1}
                            className="min-h-[36px] min-w-[36px] rounded-md border border-gray-200 text-gray-700 disabled:opacity-40"
                            title="Mover para baixo"
                          >
                            ↓
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          )} {/* fim else (não SupReg) */}

          {/* Município de saída — exclusivo Supervisor Regional */}
          {tipoAtividade === "Supervisor Regional" && (
            <div className="rounded-xl border-2 border-indigo-200 bg-indigo-50/50 p-4 space-y-3">
              <p className="text-sm font-bold text-indigo-900">
                De qual município você vai sair?
              </p>
              <p className="text-xs text-indigo-700">
                Defina a base de onde o supervisor parte e para onde retorna ao final do turno (onde elabora o RSO).
              </p>
              <div className="grid grid-cols-2 gap-3">
                {(["Valparaíso", "Guararapes", "Rubiácea", "Bento de Abreu"] as Municipio[]).map(mun => (
                  <button
                    key={mun}
                    type="button"
                    onClick={() => setMunicipioBase(mun)}
                    className={`p-4 rounded-xl border-2 text-left font-semibold transition-all duration-200 text-sm ${
                      municipioBase === mun
                        ? "border-indigo-700 bg-indigo-100 text-indigo-900 shadow-sm"
                        : "border-gray-200 bg-white text-gray-700 hover:border-indigo-300"
                    }`}
                  >
                    {mun}
                    {municipioBase === mun && (
                      <span className="block text-xs font-normal text-indigo-600 mt-0.5">Base de saída</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Tipo de Policiamento / Focos */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="block text-sm font-semibold text-gray-700">
                Foco / Tipo de Policiamento
              </label>
              <button
                type="button"
                onClick={() => setModoAvancadoFoco(!modoAvancadoFoco)}
                className="text-xs font-bold text-blue-600 hover:text-blue-800"
              >
                {modoAvancadoFoco ? "Voltar ao Modo Simples" : "Modo Avançado (Múltiplos Focos)"}
              </button>
            </div>

            {!modoAvancadoFoco ? (
              <select
                value={tipoPoliciamento}
                onChange={e =>
                  setTipoPoliciamento(e.target.value as TipoPoliciamento)
                }
                className="w-full px-4 py-3 rounded-lg border border-gray-300 text-base font-medium focus:outline-none focus:ring-2 focus:ring-[#0a2540]"
              >
                <option value="Misto (Urbano e Rural)">Misto (Urbano e Rural)</option>
                <option value="Urbano">Urbano</option>
                <option value="Rural">Rural</option>
                <option value="Foco Urbano">Foco Urbano</option>
                <option value="Foco Rural">Foco Rural</option>
                <option value="Foco Escolar">Foco Escolar</option>
                <option value="Foco Fiscalização">Foco Fiscalização de Trânsito</option>
                <option value="Foco Evento">Foco em Evento</option>
              </select>
            ) : (
              <div className="space-y-3">
                {focosAvancados.map((foco, index) => (
                  <div key={foco.id} className="flex gap-2 items-start bg-gray-50 p-3 rounded-xl border border-gray-200">
                    <div className="flex-1 space-y-2">
                      <select
                        value={foco.tipo}
                        onChange={e => {
                          const newFocos = [...focosAvancados];
                          newFocos[index].tipo = e.target.value as TipoPoliciamento;
                          setFocosAvancados(newFocos);
                        }}
                        className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#0a2540]"
                      >
                        <option value="Urbano">Urbano</option>
                        <option value="Rural">Rural</option>
                        <option value="Foco Urbano">Foco Urbano</option>
                        <option value="Foco Rural">Foco Rural</option>
                        <option value="Foco Escolar">Foco Escolar</option>
                        <option value="Foco Fiscalização">Foco Fiscalização</option>
                        <option value="Foco Evento">Foco em Evento</option>
                      </select>
                      <div className="flex gap-2">
                        <select
                          value={foco.posicao}
                          onChange={e => {
                            const newFocos = [...focosAvancados];
                            newFocos[index].posicao = e.target.value as any;
                            setFocosAvancados(newFocos);
                          }}
                          className="flex-1 px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#0a2540]"
                        >
                          <option value="Automático">Automático</option>
                          <option value="Começo">Começo do Turno</option>
                          <option value="Meio">Meio do Turno</option>
                          <option value="Fim">Final do Turno</option>
                        </select>
                        <input
                          type="number"
                          placeholder="% (opc)"
                          value={foco.percentual || ""}
                          onChange={e => {
                            const newFocos = [...focosAvancados];
                            newFocos[index].percentual = e.target.value ? parseInt(e.target.value, 10) : undefined;
                            setFocosAvancados(newFocos);
                          }}
                          className="w-24 px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#0a2540]"
                          min="1"
                          max="100"
                        />
                      </div>
                    </div>
                    {focosAvancados.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setFocosAvancados(focosAvancados.filter(f => f.id !== foco.id))}
                        className="text-red-500 hover:text-red-700 p-2 text-xl font-bold rounded-lg hover:bg-red-50"
                        title="Remover foco"
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setFocosAvancados([...focosAvancados, { id: Date.now().toString(), tipo: "Urbano", posicao: "Automático" }])}
                  className="w-full py-3 border-2 border-dashed border-gray-300 text-gray-600 rounded-xl text-sm font-bold hover:border-gray-400 hover:text-[#0a2540] hover:bg-gray-50 transition-colors"
                >
                  + Adicionar Foco
                </button>
              </div>
            )}
          </div>

          {/* Inputs do Evento (Condicional) */}
          {temFocoEvento && (
            <div className="space-y-3 p-4 bg-blue-50/50 border border-blue-100 rounded-xl">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Nome do Evento
                </label>
                <input
                  type="text"
                  placeholder="Ex: Festa do Peão, Show na Praça"
                  value={nomeEvento}
                  onChange={e => setNomeEvento(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#0a2540] bg-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Tipo de Evento
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Rodeio, Show, Religioso"
                    value={tipoEvento}
                    onChange={e => setTipoEvento(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#0a2540] bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Local do Evento
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Recinto, Praça Matriz"
                    value={localEvento}
                    onChange={e => setLocalEvento(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#0a2540] bg-white"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Data */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Data
            </label>
            <input
              type="date"
              value={data}
              onChange={e => setData(e.target.value)}
              className="w-full px-4 py-3 rounded-lg border border-gray-300 text-base font-medium focus:outline-none focus:ring-2 focus:ring-[#0a2540]"
            />
            {diaSemana && (
              <p className="text-xs text-gray-600 mt-1 capitalize">
                {diaSemana}
              </p>
            )}
            {erros.data && (
              <p className="text-xs text-red-600 mt-1">{erros.data[0]}</p>
            )}
          </div>

          {/* Hora de Início */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Hora de Início
            </label>
            <input
              type="time"
              value={horaInicio}
              onChange={e => setHoraInicio(e.target.value)}
              className="w-full px-4 py-3 rounded-lg border border-gray-300 text-base font-medium focus:outline-none focus:ring-2 focus:ring-[#0a2540]"
            />
            {erros.horaInicio && (
              <p className="text-xs text-red-600 mt-1">{erros.horaInicio[0]}</p>
            )}
          </div>

          {/* Hora de Término (calculada) */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Hora de Término (Turno: {DURACAO_TURNO_MIN[tipoAtividade] / 60}h)
            </label>
            <div className="px-4 py-3 rounded-lg border border-gray-300 bg-gray-100 text-base font-medium text-gray-700">
              {horaTermino}
            </div>
          </div>

          {/* Modalidade de Geração */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Modalidade de Geração
            </label>
            <div className="space-y-2">
              <label className="flex items-center p-3 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 min-h-[44px]">
                <input
                  type="radio"
                  name="modalidade"
                  value="automatica"
                  checked={modalidadeGeracao === "automatica"}
                  onChange={() => setModalidadeGeracao("automatica")}
                  className="w-5 h-5"
                />
                <span className="ml-3 text-base font-medium">
                  Gerar CPP automático
                </span>
              </label>
              <label className="flex items-center p-3 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 min-h-[44px]">
                <input
                  type="radio"
                  name="modalidade"
                  value="manual"
                  checked={modalidadeGeracao === "manual"}
                  onChange={() => setModalidadeGeracao("manual")}
                  className="w-5 h-5"
                />
                <span className="ml-3 text-base font-medium">
                  Vou detalhar e o app completa
                </span>
              </label>
            </div>
          </div>

          {/* Blocos Manuais */}
          {modalidadeGeracao === "manual" && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                Atividades fixas — o app preenche os espaços restantes
              </label>
              <ModoManualUI
                value={blocosManuais}
                onChange={setBlocosManuais}
                horaInicio={horaInicio}
                horaTermino={horaTermino}
              />
            </div>
          )}

          {/* Diretivas Táticas V23 */}
          <div className="border border-blue-200 bg-white rounded-xl shadow-sm overflow-hidden mt-6">
            <div className="bg-[#0a2540] px-4 py-3 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-lg">📋</span>
                <span className="font-semibold text-sm tracking-wide">DIRETIVAS TÁTICAS V23 / OS</span>
              </div>
              {diretivaCarregada ? (
                <span className="bg-emerald-500 text-white text-xs font-bold px-2 py-0.5 rounded-full animate-pulse">
                  ATIVA
                </span>
              ) : (
                <span className="bg-gray-700 text-gray-300 text-xs font-bold px-2 py-0.5 rounded-full">
                  NENHUMA
                </span>
              )}
            </div>

            <div className="p-4 space-y-4">
              <p className="text-xs text-gray-500 leading-relaxed">
                Anexe um arquivo de Diretiva/Ordem de Serviço (JSON) para que o motor calcule automaticamente pesos, objetivos de permanência e restrições operacionais.
              </p>

              {/* Upload e Ações */}
              {!diretivaCarregada && !showJsonInput && (
                <div className="space-y-3">
                  <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-lg p-5 hover:bg-gray-50 transition-colors cursor-pointer text-center">
                    <span className="text-2xl mb-1">📂</span>
                    <span className="text-sm font-semibold text-gray-700">Importar arquivo .json</span>
                    <span className="text-xs text-gray-400 mt-1">Selecione o payload da Ordem de Serviço</span>
                    <input
                      type="file"
                      accept=".json"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>

                  <div className="flex flex-wrap gap-2 justify-center">
                    <button
                      type="button"
                      onClick={() => {
                        setJsonText("");
                        setErrorDiretiva(null);
                        setShowJsonInput(true);
                      }}
                      className="px-3 py-1.5 rounded bg-gray-100 hover:bg-gray-200 text-xs font-bold text-gray-700 transition-all border border-gray-300"
                    >
                      Colar JSON
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        validarETransmitirDiretiva(TEMPLATES_DIRETIVAS.operacaoBancaria);
                        setMunicipiosSel(["Guararapes"]);
                      }}
                      className="px-3 py-1.5 rounded bg-blue-50 hover:bg-blue-100 text-xs font-bold text-blue-700 transition-all border border-blue-200"
                    >
                      Exemplo: Op. Bancária
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        validarETransmitirDiretiva(TEMPLATES_DIRETIVAS.permanenciaCEF);
                        setMunicipiosSel(["Guararapes"]);
                      }}
                      className="px-3 py-1.5 rounded bg-indigo-50 hover:bg-indigo-100 text-xs font-bold text-indigo-700 transition-all border border-indigo-200"
                    >
                      Exemplo: Permanência CEF
                    </button>
                  </div>
                </div>
              )}

              {/* Input JSON de Texto */}
              {showJsonInput && (
                <div className="space-y-3">
                  <label className="block text-xs font-bold text-gray-700">Cole o JSON da Diretiva abaixo:</label>
                  <textarea
                    rows={6}
                    value={jsonText}
                    onChange={(e) => setJsonText(e.target.value)}
                    placeholder='{ "versaoSchema": "1.1", ... }'
                    className="w-full p-2 text-xs font-mono border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:outline-none"
                  />
                  <div className="flex gap-2 justify-end">
                    <button
                      type="button"
                      onClick={() => setShowJsonInput(false)}
                      className="px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={handleApplyJsonText}
                      className="px-3 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded shadow-sm"
                    >
                      Aplicar
                    </button>
                  </div>
                </div>
              )}

              {/* Mensagem de Erro */}
              {errorDiretiva && (
                <div className="bg-red-50 border border-red-200 rounded p-3 text-xs text-red-700 flex gap-2">
                  <span className="font-bold">⚠️</span>
                  <span>{errorDiretiva}</span>
                </div>
              )}

              {/* Preview de Diretiva Carregada */}
              {diretivaCarregada && (
                <div className="space-y-3 border border-emerald-100 rounded-lg p-3 bg-emerald-50/20">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
                      Diretiva Carregada (Schema {diretivaCarregada.versaoSchema})
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setDiretivaCarregada(null);
                        setErrorDiretiva(null);
                      }}
                      className="text-xs text-red-600 hover:underline font-bold"
                    >
                      Remover
                    </button>
                  </div>

                  {diretivaCarregada.observacoes && diretivaCarregada.observacoes.length > 0 && (
                    <div className="text-xs text-gray-600 bg-white/70 p-2 rounded border border-gray-100">
                      <strong>Obs:</strong> {diretivaCarregada.observacoes.join(", ")}
                    </div>
                  )}

                  {/* Detalhes Colapsáveis */}
                  <div className="border border-gray-100 rounded bg-white overflow-hidden shadow-xs">
                    <button
                      type="button"
                      onClick={() => setPreviewCollapsed(!previewCollapsed)}
                      className="w-full px-3 py-2 bg-gray-50 hover:bg-gray-100 text-left text-xs font-bold text-gray-700 flex justify-between items-center"
                    >
                      <span>Visualizar Fases e Artefatos ({diretivaCarregada.focosDiretivas.flatMap(f => f.timeline?.fases || []).length} Fases)</span>
                      <span>{previewCollapsed ? "▼" : "▲"}</span>
                    </button>

                    {!previewCollapsed && (
                      <div className="p-3 space-y-3 max-h-72 overflow-y-auto divide-y divide-gray-100">
                        {diretivaCarregada.focosDiretivas.map((foco, focoIdx) => (
                          <div key={focoIdx} className="space-y-2 pt-2 first:pt-0">
                            {/* Fases Timeline */}
                            {foco.timeline?.fases.map((fase, phaseIdx) => {
                              const badgeColors = {
                                CONTEXTO: "bg-blue-100 border-blue-200 text-blue-800",
                                PREFERENCIA: "bg-emerald-100 border-emerald-200 text-emerald-800",
                                META: "bg-purple-100 border-purple-200 text-purple-800",
                                RESTRICAO: "bg-rose-100 border-rose-200 text-rose-800"
                              };
                              return (
                                <div key={phaseIdx} className="flex flex-col gap-1 p-2 rounded border border-gray-50 bg-gray-50/50 font-sans">
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold text-gray-800">{fase.nome}</span>
                                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${badgeColors[fase.tipo]}`}>
                                      {fase.tipo}
                                    </span>
                                  </div>
                                  <div className="text-[11px] text-gray-500 font-medium">
                                    Horário: {fase.inicio} - {fase.fim}
                                  </div>
                                  
                                  {fase.contexto && (
                                    <div className="text-[10px] text-gray-650 mt-1 pl-1 border-l-2 border-blue-400 font-medium">
                                      Evento: {fase.contexto.evento} | Foco: {fase.contexto.focoEspecifico || "Geral"} | Criticidade: {fase.contexto.criticidade}
                                    </div>
                                  )}
                                  {fase.modificadores && fase.modificadores.map((mod, modIdx) => (
                                    <div key={modIdx} className="text-[10px] text-gray-650 mt-1 pl-1 border-l-2 border-emerald-400 font-medium">
                                      Modifica: <span className="font-bold">{mod.modalidade}</span> (Multiplicador: x{mod.multiplicadorPeso}) em {mod.alvos.map(a => a.textoOriginal).join(', ')}
                                    </div>
                                  ))}
                                  {fase.metas && (
                                    <div className="text-[10px] text-gray-650 mt-1 pl-1 border-l-2 border-purple-400 font-medium">
                                      Meta: Mínimo {fase.metas.minimoVisitas || 0} visitas em {fase.metas.municipioPreferencial || "qualquer"}
                                    </div>
                                  )}
                                  {fase.restricoesDuras && (
                                    <div className="text-[10px] text-gray-650 mt-1 pl-1 border-l-2 border-rose-400 font-medium">
                                      Veta deslocamento: {fase.restricoesDuras.vetaDeslocamento ? "Sim" : "Não"} | Suspende refeição: {fase.restricoesDuras.suspendeRefeicao ? "Sim" : "Não"}
                                    </div>
                                  )}
                                </div>
                              );
                            })}

                            {/* Corredores Operacionais */}
                            {foco.corredoresOperacionais && foco.corredoresOperacionais.length > 0 && (
                              <div className="space-y-1.5 mt-2">
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Corredores Operacionais</span>
                                {foco.corredoresOperacionais.map((corr, corrIdx) => (
                                  <div key={corrIdx} className="text-[11px] text-gray-700 bg-blue-50/30 border border-blue-100/50 rounded p-1.5 pl-2 font-sans font-medium">
                                    <span className="font-bold text-blue-900">📍 {corr.nome}</span> (Raio: {corr.raioMetros}m, Prioridade: {corr.prioridade})
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Objetivos Persistentes */}
                            {foco.objetivosPersistentes && foco.objetivosPersistentes.length > 0 && (
                              <div className="space-y-1.5 mt-2">
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Objetivos de Permanência</span>
                                {foco.objetivosPersistentes.map((obj, objIdx) => (
                                  <div key={objIdx} className="text-[11px] text-gray-700 bg-indigo-50/30 border border-indigo-100/50 rounded p-1.5 pl-2 font-sans font-medium">
                                    <span className="font-bold text-indigo-950">⏱️ {obj.modalidade}</span> em {obj.localId} ({obj.permanenciaMinimaMinutos}m contínuos das {obj.inicio} às {obj.fim})
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Informações Adicionais */}
          <div className="border-t pt-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">
              Informações Adicionais (Opcional)
            </h3>
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Efetivo (ex: 3 PMs)"
                value={efetivo}
                onChange={e => setEfetivo(e.target.value)}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 text-base font-medium focus:outline-none focus:ring-2 focus:ring-[#0a2540]"
              />
              <input
                type="text"
                placeholder="Viatura (ex: Viatura 01)"
                value={viatura}
                onChange={e => setViatura(e.target.value)}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 text-base font-medium focus:outline-none focus:ring-2 focus:ring-[#0a2540]"
              />
              <input
                type="text"
                placeholder="Prefixo da US (ex: US-01)"
                value={prefixoUS}
                onChange={e => setPrefixoUS(e.target.value)}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 text-base font-medium focus:outline-none focus:ring-2 focus:ring-[#0a2540]"
              />
            </div>
          </div>

          {/* Botão Gerar CPP */}
          <button
            onClick={handleGerarCPP}
            disabled={!camposValidos}
            className="w-full btn-tactical text-lg font-bold py-4 mt-8 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Gerar CPP do Turno
          </button>
        </div>
      </div>
    </div>
  );
}
