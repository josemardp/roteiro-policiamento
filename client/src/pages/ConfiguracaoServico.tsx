/**
 * Tela 1 — Configuração do Serviço
 * Design: Operacional Moderno — Formulário com campos grandes, mobile-first
 */

import { useState } from "react";
import { z } from "zod";
import type {
  ConfiguracaoServico,
  TipoAtividade,
  Municipio,
  TipoPoliciamento,
} from "@/lib/types";
import { calcularHoraTermino, parseDataLocal } from "@/lib/gerarCPP";
import { DURACAO_TURNO_MIN } from "@/lib/constants";

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

  // parseDataLocal evita bug de fuso: new Date("YYYY-MM-DD") interpreta como UTC
  const diaSemana = data
    ? parseDataLocal(data).toLocaleDateString("pt-BR", { weekday: "long" })
    : "";

  const handleToggleMunicipio = (mun: Municipio) => {
    if (municipiosSel.includes(mun)) {
      setMunicipiosSel(municipiosSel.filter(m => m !== mun));
    } else {
      setMunicipiosSel([...municipiosSel, mun]);
    }
  };

  const validacao = schema.safeParse({ data, horaInicio });
  const camposValidos = validacao.success && municipiosSel.length > 0;
  const erros = !validacao.success ? validacao.error.flatten().fieldErrors : {};

  const handleGerarCPP = () => {
    if (!camposValidos) return;
    const config: ConfiguracaoServico = {
      tipoAtividade,
      municipios: municipiosSel,
      municipio: municipiosSel[0],
      tipoPoliciamento,
      data,
      horaInicio,
      horaTermino,
      modalidadeGeracao,
      blocosManuais,
      efetivo,
      viatura,
      prefixoUS,
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
              onChange={e => setTipoAtividade(e.target.value as TipoAtividade)}
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

          {/* Municípios (Multi-seleção) */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Municípios de Atuação (Selecione na ordem de patrulhamento)
            </label>
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
          </div>

          {/* Tipo de Policiamento */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Foco / Tipo de Policiamento
            </label>
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
            </select>
          </div>

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
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Insira as atividades fixas (o app preenche os buracos)
              </label>
              <textarea
                value={blocosManuais}
                onChange={e => setBlocosManuais(e.target.value)}
                placeholder={
                  "17h00 a 17h30 prelecao assuncao\n19h00 as 21h00 bloqueio de transito\n21h00 janta pel pm"
                }
                className="w-full px-4 py-3 rounded-lg border border-gray-300 text-base font-medium focus:outline-none focus:ring-2 focus:ring-[#0a2540] h-28 resize-none"
              />
              <p className="text-xs text-gray-600 mt-1">
                Aceita: 19h00, 19:00, "19h00 a 21h00 bloqueio", "21h00 janta",
                etc.
              </p>
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
