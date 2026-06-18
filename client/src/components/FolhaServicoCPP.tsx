import React from "react";
import { gerarFundamentacao, parseDataLocal } from "@/lib/gerarCPP";
import { IDENTIDADE_UNIDADE } from "@/lib/identidadeUnidade";
import { MODALIDADES } from "@/lib/constants";
import type { BlocoHorario, ConfiguracaoServico, RoteiroDia } from "@/lib/types";

interface FolhaServicoCPPProps {
  roteiroDia: RoteiroDia;
}

function formatarDataServico(data: string): string {
  const dataLocal = parseDataLocal(data);
  const dataFormatada = dataLocal.toLocaleDateString("pt-BR");
  const diaSemana = dataLocal.toLocaleDateString("pt-BR", { weekday: "long" });
  return `${dataFormatada}, ${diaSemana}`;
}

function formatarDataEmissao(data: Date): string {
  return data.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function listarMunicipios(configuracao: ConfiguracaoServico): string {
  const municipios = configuracao.municipios?.length
    ? configuracao.municipios
    : configuracao.municipio
      ? [configuracao.municipio]
      : [];
  return municipios.join(" → ");
}

function campo(label: string, valor?: string | null): { label: string; valor: string } | null {
  const texto = valor?.trim();
  return texto ? { label, valor: texto } : null;
}

function nomeModalidade(bloco: BlocoHorario): string {
  const nome = MODALIDADES[bloco.modalidade]?.nome ?? bloco.modalidade;
  return `${bloco.modalidade} · ${nome}`;
}

export default function FolhaServicoCPP({ roteiroDia }: FolhaServicoCPPProps) {
  const { configuracao } = roteiroDia;
  const blocosOrdenados = [...roteiroDia.blocos].sort((a, b) => a.ordem - b.ordem);
  const fundamentacao = gerarFundamentacao(configuracao).filter(Boolean);
  const municipios = listarMunicipios(configuracao);
  const emitidoEm = formatarDataEmissao(new Date());
  const faixaServico = [
    campo("Tipo de atividade", configuracao.tipoAtividade),
    campo("Data", formatarDataServico(configuracao.data)),
    campo("Turno", configuracao.horaInicio && configuracao.horaTermino ? `${configuracao.horaInicio}–${configuracao.horaTermino}` : configuracao.horaInicio),
    campo("Município(s)", municipios),
    campo("Efetivo", configuracao.efetivo),
    campo("Viatura", configuracao.viatura),
    campo("Prefixo US", configuracao.prefixoUS),
  ].filter((item): item is { label: string; valor: string } => Boolean(item));

  return (
    <section className="folha-print" aria-label="Folha de serviço do CPP para impressão">
      <header className="folha-cabecalho">
        <div className="folha-identidade">
          <strong>{IDENTIDADE_UNIDADE.instituicao}</strong>
          <span>{IDENTIDADE_UNIDADE.comando}</span>
          <span>{IDENTIDADE_UNIDADE.unidade}</span>
        </div>
        <h1>CPP — CARTÃO DE PRIORIDADE DE PATRULHAMENTO</h1>
      </header>

      <dl className="folha-dados-servico">
        {faixaServico.map(item => (
          <div key={item.label}>
            <dt>{item.label}</dt>
            <dd>{item.valor}</dd>
          </div>
        ))}
      </dl>

      {fundamentacao.length > 0 && (
        <section className="folha-secao">
          <h2>FUNDAMENTAÇÃO (PPI / NORSOP)</h2>
          <ul className="folha-fundamentacao">
            {fundamentacao.map((linha, index) => (
              <li key={`${index}-${linha}`}>{linha}</li>
            ))}
          </ul>
        </section>
      )}

      <section className="folha-secao">
        <h2>QUADRO DE PATRULHAMENTO</h2>
        <table className="folha-tabela">
          <thead>
            <tr>
              <th>Horário</th>
              <th>Mod.</th>
              <th>Município</th>
              <th>Local</th>
              <th>Problema a solucionar</th>
              <th>Ações de polícia</th>
            </tr>
          </thead>
          <tbody>
            {blocosOrdenados.map(bloco => (
              <tr key={bloco.id}>
                <td>{bloco.horaInicio}–{bloco.horaFim}</td>
                <td>{nomeModalidade(bloco)}</td>
                <td>{bloco.municipio ?? ""}</td>
                <td>{bloco.local}</td>
                <td>{bloco.problemaSolucionar}</td>
                <td>{bloco.acoesPolicia}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <footer className="folha-rodape">
        <p>Documento gerado conforme PPI — Diretriz PM3-001/02/20 (NORSOP).</p>
        <div className="folha-assinatura">
          <span />
          <strong>{IDENTIDADE_UNIDADE.assinaturaComando}</strong>
        </div>
        <p>Emitido em {emitidoEm}</p>
      </footer>
    </section>
  );
}
