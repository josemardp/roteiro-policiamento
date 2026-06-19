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

const schema = z.object({
  data: z.string().min(1, "Data é obrigatória"),
  horaInicio: z.string().regex(/^\d{2}:\d{2}$/, "Hora inválida"),
});

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
  const [efetivo, setEfetivo] = useState("");
  const [viatura, setViatura] = useState("");
  const [prefixoUS, setPrefixoUS] = useState("");

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
  const camposValidos =
    validacao.success &&
    municipiosSel.length > 0 &&
    (!temFocoEvento || (nomeEvento.trim() !== "" && localEvento.trim() !== ""));
  const erros = !validacao.success ? validacao.error.flatten().fieldErrors : {};

  const handleGerarCPP = () => {
    if (!camposValidos) return;
    const config: ConfiguracaoServico = {
      tipoAtividade,
      municipios: municipiosSel,
      municipio: municipiosSel[0],
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

          {/* Municípios */}
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
              />
            </div>
          )}

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
