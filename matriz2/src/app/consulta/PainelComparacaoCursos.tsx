"use client";

import Link from "next/link";
import { PROSE_LINK } from "@/lib/layoutWidths";
import type { CursoLinha } from "./ConsultaTabelaCursos";

export interface CursoComparavel extends CursoLinha {
  /** Só usado quando os cursos comparados vêm de câmpus diferentes (ver
   * `/consulta/comparar`); dentro de um único câmpus fica de fora. */
  campus?: string;
  instituicaoSigla?: string;
}

const reais = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const decimal = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const data = new Intl.DateTimeFormat("pt-BR");

function formatarData(iso: string | null): string {
  return iso ? data.format(new Date(iso)) : "não informado";
}

function diasEntre(inicioIso: string | null, terminoIso: string | null): number | null {
  if (!inicioIso || !terminoIso) return null;
  const dias = (new Date(terminoIso).getTime() - new Date(inicioIso).getTime()) / 86_400_000;
  return dias > 0 ? Math.round(dias) : null;
}

/**
 * Ledger comparativo de dois ou mais cursos lado a lado, usado tanto dentro de um
 * único câmpus (`ConsultaTabelaCursos`) quanto entre câmpus diferentes
 * (`/consulta/comparar`). Fica num arquivo à parte porque as duas telas precisam do
 * mesmo desenho de tabela, e duplicar essas ~15 linhas de ledger seria o primeiro
 * lugar em que as duas divergiriam sem querer.
 */
export function PainelComparacaoCursos({
  cursos,
  onRemover,
  onLimpar,
}: {
  cursos: CursoComparavel[];
  onRemover?: (id: number) => void;
  onLimpar?: () => void;
}) {
  const linhas: { rotulo: string; valor: (c: CursoComparavel) => string }[] = [
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
    { rotulo: "CH Matriz", valor: (c) => (c.chMatriz !== null ? `${c.chMatriz} h` : "não informado") },
    {
      rotulo: "CH Matriz ÷ CH mínima MEC",
      valor: (c) =>
        c.chMatriz !== null && c.chMinimaMec ? decimal.format(c.chMatriz / c.chMinimaMec) : "não informado",
    },
    { rotulo: "Peso do curso na matriz", valor: (c) => (c.peso !== null ? decimal.format(c.peso) : "não informado") },
    { rotulo: "Alunos (matriz)", valor: (c) => (c.alunos !== null ? decimal.format(c.alunos) : "não informado") },
    { rotulo: "Matrícula equalizada gerada", valor: (c) => decimal.format(c.matricula) },
    {
      rotulo: "Matrícula equalizada por aluno",
      valor: (c) => (c.alunos ? decimal.format(c.matricula / c.alunos) : "não informado"),
    },
    { rotulo: "Valor recebido", valor: (c) => reais.format(c.valor) },
    { rotulo: "Perda por evasão", valor: (c) => reais.format(c.perda) },
  ];

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-if-green/40 bg-if-green/5 p-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-neutral-900 dark:text-neutral-100">
          Comparando {cursos.length} cursos
        </h3>
        {onLimpar && (
          <button
            type="button"
            onClick={onLimpar}
            className="text-sm text-neutral-500 underline hover:text-neutral-800 dark:hover:text-neutral-200"
          >
            limpar comparação
          </button>
        )}
      </div>
      <p className="text-xs text-neutral-500 dark:text-neutral-400">
        Os valores vêm prontos da 6ª fase da MDO; a{" "}
        <Link href="/como-funciona#funcionamento" className={PROSE_LINK}>
          matrícula equalizada
        </Link>{" "}
        já considera duração do ciclo, peso do curso e carga horária, mas este sistema não refaz essa
        conta, só mostra os componentes que a própria MDO publica por ciclo de curso.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-white/60 text-left dark:bg-neutral-950/40">
            <tr>
              <th className="px-3 py-2 font-medium text-neutral-500"></th>
              {cursos.map((c) => (
                <th key={c.id} className="px-3 py-2 font-medium text-neutral-900 dark:text-neutral-100">
                  <div className="flex items-start justify-between gap-2">
                    <span>
                      {c.curso}
                      {c.campus && (
                        <span className="block text-xs font-normal text-neutral-500">
                          {c.instituicaoSigla}, {c.campus}
                        </span>
                      )}
                    </span>
                    {onRemover && (
                      <button
                        type="button"
                        onClick={() => onRemover(c.id)}
                        aria-label={`Remover ${c.curso} da comparação`}
                        className="text-neutral-400 hover:text-if-red"
                      >
                        ×
                      </button>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {linhas.map((linha) => (
              <tr key={linha.rotulo} className="border-t border-neutral-200 dark:border-neutral-800">
                <td className="px-3 py-2 text-neutral-500 dark:text-neutral-400">{linha.rotulo}</td>
                {cursos.map((c) => (
                  <td key={c.id} className="px-3 py-2 tabular-nums">
                    {linha.valor(c)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
