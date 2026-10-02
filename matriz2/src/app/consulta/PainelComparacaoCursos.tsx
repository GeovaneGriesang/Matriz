"use client";

import Link from "next/link";
import { PROSE_LINK } from "@/lib/layoutWidths";
import { diferencaParaPrincipal, diferencasContra } from "@/lib/compararCursos";
import type { CursoLinha } from "./ConsultaTabelaCursos";

export interface CursoComparavel extends CursoLinha {
  /** Só usado quando os cursos comparados vêm de câmpus diferentes (ver
   * `/consulta/comparar`); dentro de um único câmpus fica de fora. */
  campus?: string;
  instituicaoSigla?: string;
}

const reais = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const decimal = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const inteiro = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
const percentual = new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 0 });
// As datas do ciclo são dias do calendário guardados à meia-noite UTC: formatar no fuso do navegador (Brasil, UTC-3) mostraria o dia anterior.
const data = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" });

function formatarData(iso: string | null): string {
  return iso ? data.format(new Date(iso)) : "não informado";
}

function diasEntre(inicioIso: string | null, terminoIso: string | null): number | null {
  if (!inicioIso || !terminoIso) return null;
  const dias = (new Date(terminoIso).getTime() - new Date(inicioIso).getTime()) / 86_400_000;
  return dias > 0 ? Math.round(dias) : null;
}

type Linha = {
  rotulo: string;
  valor: (c: CursoComparavel) => string;
  /** Para a diferença contra o principal: o número da linha, o jeito de escrevê-lo e se mais é melhor, pior ou indiferente. */
  numero?: (c: CursoComparavel) => number | null;
  formatar?: (n: number) => string;
  melhor?: "mais" | "menos";
};

/** Abaixo disto (0,5%) a diferença é só arredondamento: não vale pintar de verde nem de vermelho. */
const LIMIAR_DE_IGUAL = 0.005;

function textoDaDiferenca(abs: number, pct: number | null, formatar: (n: number) => string): string {
  const sinal = abs > 0 ? "+" : abs < 0 ? "−" : "";
  const quase = pct !== null && Math.abs(pct) < LIMIAR_DE_IGUAL;
  const parte = pct !== null && abs !== 0 ? (quase ? " (≈0%)" : ` (${sinal}${percentual.format(Math.abs(pct))})`) : "";
  return `${sinal}${formatar(Math.abs(abs))}${parte}`;
}

/**
 * Ledger comparativo de dois ou mais cursos lado a lado, usado tanto dentro de um único câmpus (`ConsultaTabelaCursos`)
 * quanto entre câmpus diferentes (`/consulta/comparar`). Com `principalId`, o curso principal fica em destaque e cada um
 * dos outros mostra, linha a linha, o que o principal ganha ou perde em relação a ele.
 */
export function PainelComparacaoCursos({
  cursos,
  onRemover,
  onLimpar,
  principalId,
}: {
  cursos: CursoComparavel[];
  onRemover?: (id: number) => void;
  onLimpar?: () => void;
  principalId?: number;
}) {
  const principal = principalId !== undefined ? cursos.find((c) => c.id === principalId) : undefined;
  const outros = principal ? cursos.filter((c) => c.id !== principal.id) : [];

  const linhas: Linha[] = [
    { rotulo: "Nível", valor: (c) => c.nivel ?? "não informado" },
    { rotulo: "Repasse", valor: (c) => c.repasse.replace("_", " ") },
    { rotulo: "Início do ciclo", valor: (c) => formatarData(c.inicio) },
    { rotulo: "Término do ciclo", valor: (c) => formatarData(c.termino) },
    {
      rotulo: "Dias do ciclo",
      valor: (c) => {
        const dias = diasEntre(c.inicio, c.termino);
        return dias !== null ? `${dias} dias (≈${decimal.format(dias / 365)} anos)` : "não informado";
      },
    },
    { rotulo: "CH mínima MEC", valor: (c) => (c.chMinimaMec !== null ? `${c.chMinimaMec} h` : "não informado") },
    { rotulo: "CH Matriz", valor: (c) => (c.chMatriz !== null ? `${c.chMatriz} h` : "não informado"), numero: (c) => c.chMatriz, formatar: (n) => `${inteiro.format(n)} h`, melhor: "mais" },
    {
      rotulo: "CH Matriz ÷ CH mínima MEC",
      valor: (c) => (c.chMatriz !== null && c.chMinimaMec ? decimal.format(c.chMatriz / c.chMinimaMec) : "não informado"),
    },
    { rotulo: "Peso do curso na matriz", valor: (c) => (c.peso !== null ? decimal.format(c.peso) : "não informado"), numero: (c) => c.peso, formatar: (n) => decimal.format(n), melhor: "mais" },
    { rotulo: "Alunos (matriz)", valor: (c) => (c.alunos !== null ? decimal.format(c.alunos) : "não informado"), numero: (c) => c.alunos, formatar: (n) => decimal.format(n), melhor: "mais" },
    { rotulo: "Matrícula equalizada gerada", valor: (c) => decimal.format(c.matricula), numero: (c) => c.matricula, formatar: (n) => decimal.format(n), melhor: "mais" },
    {
      rotulo: "Matrícula equalizada por aluno",
      valor: (c) => (c.alunos ? decimal.format(c.matricula / c.alunos) : "não informado"),
      numero: (c) => (c.alunos ? c.matricula / c.alunos : null),
      formatar: (n) => decimal.format(n),
      melhor: "mais",
    },
    { rotulo: "Valor recebido", valor: (c) => reais.format(c.valor), numero: (c) => c.valor, formatar: (n) => reais.format(n), melhor: "mais" },
    {
      rotulo: "Valor recebido por aluno",
      valor: (c) => (c.alunos ? reais.format(c.valor / c.alunos) : "não informado"),
      numero: (c) => (c.alunos ? c.valor / c.alunos : null),
      formatar: (n) => reais.format(n),
      melhor: "mais",
    },
    { rotulo: "Perda por evasão", valor: (c) => reais.format(c.perda), numero: (c) => c.perda, formatar: (n) => reais.format(n), melhor: "menos" },
  ];

  /** A diferença do principal contra `outro`, na linha, com a cor (verde, o principal se sai melhor; vermelho, pior). */
  function diferencaNaLinha(linha: Linha, outro: CursoComparavel): { texto: string; classe: string } | null {
    if (!principal || !linha.numero || !linha.formatar) return null;
    const d = diferencaParaPrincipal(linha.numero(principal), linha.numero(outro));
    if (!d) return null;
    if (d.absoluta === 0) return { texto: "igual ao principal", classe: "text-neutral-400" };
    const texto = textoDaDiferenca(d.absoluta, d.percentual, linha.formatar);
    const quaseIgual = d.percentual !== null && Math.abs(d.percentual) < LIMIAR_DE_IGUAL;
    const bom = linha.melhor === undefined || quaseIgual ? null : linha.melhor === "mais" ? d.absoluta > 0 : d.absoluta < 0;
    const classe = bom === null ? "text-neutral-500" : bom ? "text-if-green dark:text-green-400" : "text-if-red dark:text-red-400";
    return { texto: `principal ${texto}`, classe };
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-if-green/40 bg-if-green/5 p-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-neutral-900 dark:text-neutral-100">Comparando {cursos.length} cursos</h3>
        {onLimpar && (
          <button type="button" onClick={onLimpar} className="text-sm text-neutral-500 underline hover:text-neutral-800 dark:hover:text-neutral-200">
            limpar comparação
          </button>
        )}
      </div>

      {principal && outros.length > 0 && (
        <div className="flex flex-col gap-2 rounded-md border border-if-green/40 bg-white p-3 dark:bg-neutral-950">
          <h4 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
            O que {principal.curso}
            {principal.campus ? ` (${principal.instituicaoSigla}, ${principal.campus})` : ""} ganha ou perde em relação a cada um
          </h4>
          <ul className="flex flex-col gap-1.5 text-sm text-neutral-700 dark:text-neutral-300">
            {outros.map((o) => {
              const d = diferencasContra(principal, o);
              const frases: string[] = [];
              if (d.valor) {
                frases.push(
                  d.valor.absoluta === 0
                    ? "recebe o mesmo valor"
                    : `recebe ${reais.format(Math.abs(d.valor.absoluta))} a ${d.valor.absoluta > 0 ? "mais" : "menos"}${d.valor.percentual !== null ? ` (${percentual.format(Math.abs(d.valor.percentual))})` : ""}`,
                );
              }
              if (d.valorPorAluno && d.valorPorAluno.absoluta !== 0) {
                frases.push(`cada aluno rende ${reais.format(Math.abs(d.valorPorAluno.absoluta))} a ${d.valorPorAluno.absoluta > 0 ? "mais" : "menos"}`);
              }
              if (d.peso) frases.push(d.peso.absoluta === 0 ? "tem o mesmo peso" : `tem peso ${decimal.format(Math.abs(d.peso.absoluta))} a ${d.peso.absoluta > 0 ? "mais" : "menos"}`);
              if (d.alunos && d.alunos.absoluta !== 0) frases.push(`${decimal.format(Math.abs(d.alunos.absoluta))} alunos a ${d.alunos.absoluta > 0 ? "mais" : "menos"}`);
              if (d.perda && d.perda.absoluta !== 0) frases.push(`perde ${reais.format(Math.abs(d.perda.absoluta))} a ${d.perda.absoluta > 0 ? "mais" : "menos"} com a evasão`);
              return (
                <li key={o.id}>
                  <strong>Contra {o.curso}</strong>
                  {o.campus ? ` (${o.instituicaoSigla}, ${o.campus})` : ""}: {frases.join("; ")}.
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <p className="text-xs text-neutral-500 dark:text-neutral-400">
        Os valores vêm prontos da 6ª fase da MDO; a{" "}
        <Link href="/como-funciona#funcionamento" className={PROSE_LINK}>
          matrícula equalizada
        </Link>{" "}
        já considera duração do ciclo, peso do curso e carga horária, mas este sistema não refaz essa conta, só mostra os componentes que a própria MDO
        publica por ciclo de curso.
        {principal && " Nas colunas dos outros cursos, a linha pequena diz o que o principal ganha (verde) ou perde (vermelho) em relação a eles."}
      </p>
      <div className="tabela-rolavel">
        <table className="w-full text-sm">
          <thead className="bg-white/60 text-left dark:bg-neutral-950/40">
            <tr>
              <th className="px-3 py-2 font-medium text-neutral-500"></th>
              {cursos.map((c) => {
                const ehPrincipal = principal?.id === c.id;
                return (
                  <th key={c.id} className={`px-3 py-2 font-medium text-neutral-900 dark:text-neutral-100 ${ehPrincipal ? "border-b-2 border-if-green bg-if-green/15" : ""}`}>
                    <div className="flex items-start justify-between gap-2">
                      <span>
                        {ehPrincipal && <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-if-green dark:text-green-400">principal</span>}
                        {c.curso}
                        {c.campus && (
                          <span className="block text-xs font-normal text-neutral-500">
                            {c.instituicaoSigla}, {c.campus}
                          </span>
                        )}
                      </span>
                      {onRemover && (
                        <button type="button" onClick={() => onRemover(c.id)} aria-label={`Remover ${c.curso} da comparação`} className="text-neutral-400 hover:text-if-red">
                          ×
                        </button>
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {linhas.map((linha) => (
              <tr key={linha.rotulo} className="border-t border-neutral-200 dark:border-neutral-800">
                <td className="px-3 py-2 text-neutral-500 dark:text-neutral-400">{linha.rotulo}</td>
                {cursos.map((c) => {
                  const dif = principal && principal.id !== c.id ? diferencaNaLinha(linha, c) : null;
                  return (
                    <td key={c.id} className={`px-3 py-2 tabular-nums ${principal?.id === c.id ? "bg-if-green/10 font-medium" : ""}`}>
                      {linha.valor(c)}
                      {dif && <span className={`block text-xs ${dif.classe}`}>{dif.texto}</span>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
