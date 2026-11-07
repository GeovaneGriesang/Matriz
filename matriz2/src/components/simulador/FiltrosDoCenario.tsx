"use client";

import { FUNDO_DDI, SeloDdi } from "@/components/PedidoDaDdi";
import {
  FILTROS_PRESENCIAIS_REGULARES,
  FILTROS_TODOS,
  GRUPOS_FINANCIAMENTO,
  GRUPOS_MODALIDADE,
  GRUPOS_OFERTA,
  GRUPOS_SITUACAO,
  GRUPOS_TIPO,
  filtroAtivo,
  type FiltrosCenario,
} from "@/lib/filtrosCenario";

const GRUPOS: { chave: keyof FiltrosCenario; titulo: string; opcoes: readonly { valor: string; rotulo: string }[] }[] = [
  { chave: "modalidade", titulo: "Modalidade", opcoes: GRUPOS_MODALIDADE },
  { chave: "tipo", titulo: "Tipo de curso", opcoes: GRUPOS_TIPO },
  { chave: "oferta", titulo: "Forma de oferta", opcoes: GRUPOS_OFERTA },
  { chave: "financiamento", titulo: "Financiamento", opcoes: GRUPOS_FINANCIAMENTO },
  { chave: "situacao", titulo: "Situação da turma", opcoes: GRUPOS_SITUACAO },
];

const botao = "rounded-md border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-100 disabled:opacity-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800";

/** Quais turmas entram na conta. O resumo diz quanto ficou de fora, para ninguém ler um número filtrado como se fosse o total. */
export function FiltrosDoCenario({ filtros, onChange, resumo }: { filtros: FiltrosCenario; onChange: (f: FiltrosCenario) => void; resumo: string }) {
  const ativo = filtroAtivo(filtros);
  const deFora = GRUPOS.flatMap((g) => g.opcoes.filter((o) => !filtros[g.chave].includes(o.valor)).map((o) => o.rotulo));

  function alternar(chave: keyof FiltrosCenario, valor: string) {
    const lista = filtros[chave];
    onChange({ ...filtros, [chave]: lista.includes(valor) ? lista.filter((v) => v !== valor) : [...lista, valor] });
  }

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="mr-2 text-sm font-semibold text-neutral-900 dark:text-neutral-100">Quais turmas entram na conta</h2>
        <button type="button" className={`${botao} ${FUNDO_DDI}`} onClick={() => onChange({ ...FILTROS_PRESENCIAIS_REGULARES })}>
          Só presenciais e regulares
          <SeloDdi />
        </button>
        <button type="button" className={botao} disabled={!ativo} onClick={() => onChange({ ...FILTROS_TODOS })}>
          Todas as turmas
        </button>
      </div>
      <p role="status" className={`rounded-md px-3 py-2 text-sm ${ativo ? "bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-200" : "bg-neutral-50 text-neutral-600 dark:bg-neutral-900 dark:text-neutral-400"}`}>
        {resumo}
        {deFora.length > 0 && <> Ficaram de fora: {deFora.join(", ")}.</>}
      </p>
      <details className="text-sm">
        <summary className="font-medium text-neutral-700 dark:text-neutral-300">Escolher os filtros, um a um</summary>
        <div className="mt-3 flex flex-col gap-3">
      <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-5">
        {GRUPOS.map((g) => (
          <fieldset key={g.chave} className="flex flex-col gap-1">
            <legend className="mb-1 text-xs font-medium uppercase tracking-wide text-neutral-500">{g.titulo}</legend>
            {g.opcoes.map((o) => (
              <label key={o.valor} className="flex items-start gap-2 text-sm text-neutral-700 dark:text-neutral-300">
                <input type="checkbox" checked={filtros[g.chave].includes(o.valor)} onChange={() => alternar(g.chave, o.valor)} className="mt-1 accent-if-green" />
                {o.rotulo}
              </label>
            ))}
          </fieldset>
        ))}
      </div>
      <p className="text-xs text-neutral-500 dark:text-neutral-400">
        Regulares são os cursos presenciais de integrado, concomitante, subsequente, EJA, superiores, pós-graduações e educação básica. Só a qualificação (FIC) comum fica de fora; a qualificação no Proeja entra, por ser EJA. Os filtros valem para os cartões, as tabelas e os cursos novos. O valor da matrícula não muda: filtrar mostra só uma parte do que a matriz repassa, não refaz a matriz.
      </p>
        </div>
      </details>
    </section>
  );
}
