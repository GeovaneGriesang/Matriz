"use client";

import { Fragment, useMemo, useState } from "react";
import { SinalMaisMenos } from "@/components/SinalMaisMenos";
import { ehCampusDestaque } from "@/lib/destaque";
import { aplicarComplementacao, MATRIZ1_DO_DOCUMENTO, PROPOSTA_V01, type LinhaDaComplementacao, type RegraAplicada } from "@/lib/mdo/propostaComplementacao";

export interface CampusDaComplementacao {
  id: number;
  nome: string;
  base: number | null;
  matriz2027: number;
}

type FonteDaMatriz1 = "documento" | "quinta-fase";

const reais = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const pct = new Intl.NumberFormat("pt-BR", { style: "percent", minimumFractionDigits: 2, maximumFractionDigits: 2, signDisplay: "exceptZero" });
const cor = (v: number) => (Math.abs(v) < 0.005 ? "text-neutral-500" : v > 0 ? "text-if-green" : "text-if-red dark:text-red-400");
const th = "whitespace-nowrap px-2 py-1.5 text-right font-medium";
const td = "whitespace-nowrap px-2 py-1 text-right tabular-nums";
const botao = (ativo: boolean) =>
  `rounded px-3 py-1.5 font-medium ${ativo ? "bg-if-green text-white" : "border border-neutral-300 text-neutral-700 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"}`;

const NOME_DA_REGRA: Record<RegraAplicada, string> = {
  "acima-de-2026": "acima de 2026, sem complemento",
  integral: "queda até R$ 1 milhão, completa até 2026",
  "ate-94": "queda acima de R$ 1 milhão, completa até 94% de 2026",
  piso: "piso de R$ 950 mil",
};

/** A Matriz 1 de cada câmpus: a do documento (EaD reclassificado pela Proen) ou a da 5ª fase da MDO. */
export function resultadoDaV01(campi: readonly CampusDaComplementacao[], fonte: FonteDaMatriz1) {
  const comBase = campi.filter((c) => (c.base ?? 0) > 0 && (fonte === "quinta-fase" || MATRIZ1_DO_DOCUMENTO[c.nome] !== undefined));
  return aplicarComplementacao(comBase.map((c) => ({ id: c.id, nome: c.nome, base2026: c.base!, matriz1: fonte === "documento" ? MATRIZ1_DO_DOCUMENTO[c.nome]! : c.matriz2027 })));
}

export function PropostaComplementacao({ campi }: { campi: CampusDaComplementacao[] }) {
  const [fonte, setFonte] = useState<FonteDaMatriz1>("documento");
  const [abertoId, setAbertoId] = useState<number | null>(null);
  const r = useMemo(() => resultadoDaV01(campi, fonte), [campi, fonte]);
  const linhas = useMemo(() => [...r.linhas].sort((a, b) => Number(ehCampusDestaque(b.nome)) - Number(ehCampusDestaque(a.nome)) || a.nome.localeCompare(b.nome, "pt-BR")), [r]);
  const foraDaConta = campi.filter((c) => !r.linhas.some((l) => l.id === c.id) && c.matriz2027 > 0);
  const excesso = r.somaComplemento - r.reserva;
  const exemplo = linhas.find((l) => ehCampusDestaque(l.nome)) ?? linhas[0];

  return (
    <>
      <div className="flex flex-col gap-1 text-sm text-neutral-700 dark:text-neutral-300">
        <p>
          <strong>Documento:</strong> &quot;{PROPOSTA_V01.documento}&quot;, em PDF. Vale só para 2027, e as regras de complementação seriam analisadas de novo para 2028.
        </p>
        <p>
          Matriz 2 reparte o total recebido pelos câmpus em 2026 na proporção da Matriz 1. Matriz 3 é 85% da Matriz 2. Quem fica acima de 2026 recebe a Matriz 3, sem complemento. Quem cai até
          R$ 1 milhão volta ao valor de 2026. Quem cai mais que isso volta a 94% de 2026. Nenhum câmpus fica abaixo de R$ 950 mil.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">Matriz 1</span>
        {(
          [
            ["documento", "A do documento (EaD reclassificado pela Proen)"],
            ["quinta-fase", "A da 5ª fase da MDO"],
          ] as const
        ).map(([valor, rotulo]) => (
          <button key={valor} type="button" onClick={() => setFonte(valor)} aria-pressed={fonte === valor} className={botao(fonte === valor)}>
            {rotulo}
          </button>
        ))}
      </div>
      <p className="text-sm text-neutral-600 dark:text-neutral-400">
        {fonte === "documento"
          ? "Na 5ª fase, a MDO conta as cerca de 8.000 matrículas MOOC de cada câmpus como EaD de fomento próprio, que rende perto de R$ 400 mil por câmpus. O documento as conta como MOOC, que rende perto de R$ 37 mil. Por isso a Matriz 1 do documento soma R$ 34,4 milhões, e a da 5ª fase, R$ 40,4 milhões. Os valores abaixo são os do documento, refeitos pelo sistema."
          : "As mesmas regras aplicadas à matriz de 2027 da 5ª fase da MDO, sem a reclassificação do EaD. Serve para ver quanto da proposta vem da reclassificação e quanto vem das regras."}
      </p>

      <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
        <table className="min-w-full text-xs">
          <thead className="bg-neutral-50 text-neutral-600 dark:bg-neutral-900 dark:text-neutral-400">
            <tr>
              <th className="px-2 py-1.5 text-left font-medium">Câmpus</th>
              <th className={th}>Recebido 2026</th>
              <th className={th}>Matriz 1</th>
              <th className={th}>Matriz 2</th>
              <th className={th}>Matriz 3 (85%)</th>
              <th className={th}>Matriz 3 menos 2026</th>
              <th className={th}>Complemento</th>
              <th className={th}>Total 2027</th>
              <th className={th}>Contra 2026</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {linhas.map((l) => {
              const aberto = l.id === abertoId;
              return (
                <Fragment key={l.id}>
                  <tr className={aberto ? "bg-if-green/10" : ehCampusDestaque(l.nome) ? "bg-if-green/5" : undefined}>
                    <td className="whitespace-nowrap px-2 py-1 text-left">
                      <button type="button" onClick={() => setAbertoId(aberto ? null : l.id)} aria-expanded={aberto} className="inline-flex items-center gap-2 font-medium hover:text-if-green">
                        <SinalMaisMenos aberto={aberto} />
                        {l.nome}
                      </button>
                    </td>
                    <td className={td}>{reais.format(l.base2026)}</td>
                    <td className={`${td} text-neutral-500 dark:text-neutral-400`}>{reais.format(l.matriz1)}</td>
                    <td className={`${td} text-neutral-500 dark:text-neutral-400`}>{reais.format(l.matriz2)}</td>
                    <td className={td}>{reais.format(l.matriz3)}</td>
                    <td className={`${td} ${cor(l.diferenca)}`}>{reais.format(l.diferenca)}</td>
                    <td className={td}>{reais.format(l.complemento)}</td>
                    <td className={`${td} font-medium`}>{reais.format(l.total)}</td>
                    <td className={`${td} ${cor(l.total - l.base2026)}`}>{pct.format(l.total / l.base2026 - 1)}</td>
                  </tr>
                  {aberto && (
                    <tr data-detalhe="1">
                      <td colSpan={9} className="bg-neutral-100 p-3 dark:bg-neutral-900/60">
                        <ContaDoCampus l={l} somaBase={r.somaBase} somaMatriz1={r.somaMatriz1} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
          <tfoot className="bg-neutral-50 font-medium dark:bg-neutral-900">
            <tr>
              <td className="px-2 py-1 text-left">Soma dos câmpus</td>
              <td className={td}>{reais.format(r.somaBase)}</td>
              <td className={td}>{reais.format(r.somaMatriz1)}</td>
              <td className={td}>{reais.format(r.somaBase)}</td>
              <td className={td}>{reais.format(r.somaMatriz3)}</td>
              <td className={td}></td>
              <td className={td}>{reais.format(r.somaComplemento)}</td>
              <td className={td}>{reais.format(r.somaTotal)}</td>
              <td className={`${td} ${cor(r.somaTotal - r.somaBase)}`}>{pct.format(r.somaTotal / r.somaBase - 1)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="text-xs text-neutral-500 dark:text-neutral-400">
        A Matriz 3 deixa {reais.format(r.reserva)} (15%) para a complementação, e os complementos somam {reais.format(r.somaComplemento)}:{" "}
        {Math.abs(excesso) < 0.5 ? "a conta fecha." : excesso > 0 ? `passam da reserva em ${reais.format(excesso)}, e a soma dos câmpus fica acima do total de 2026.` : `sobram ${reais.format(-excesso)} da reserva.`}{" "}
        Quem fica acima de 2026 recebe 85% da própria Matriz 2: na prática, ajuda a pagar a garantia de quem caiu. Só entra o Funcionamento dos câmpus.{" "}
        {foraDaConta.length > 0 && `${foraDaConta.map((c) => c.nome).join(", ")} fica fora da conta, porque não recebeu em 2026; no documento, São Leopoldo recebe à parte os R$ 700 mil do piso da MDO. `}
        O documento também mostra a linha da Reitoria (custeio, fomento e ações institucionais): R$ 9.940.083,30 em 2026 e R$ 9.940.689,89 em 2027.
        {exemplo && ` Clique no + de um câmpus para ver a conta dele logo abaixo da linha, e no − para fechar. Exemplo: o + de ${exemplo.nome} mostra como ${reais.format(exemplo.matriz1)} da Matriz 1 chegam a ${reais.format(exemplo.total)}.`}
      </p>
    </>
  );
}

function ContaDoCampus({ l, somaBase, somaMatriz1 }: { l: LinhaDaComplementacao; somaBase: number; somaMatriz1: number }) {
  return (
    <div className="sticky left-0 flex w-[min(88vw,60rem)] flex-col gap-2 whitespace-normal rounded-md border-l-4 border-if-green bg-white p-4 text-left text-sm dark:bg-neutral-950">
      <h3 className="font-semibold text-neutral-900 dark:text-neutral-100">A conta de {l.nome}, na proposta versão 01</h3>
      <ul className="flex flex-col gap-1 text-neutral-700 dark:text-neutral-300">
        <li>
          <strong>Matriz 2:</strong> {reais.format(l.matriz1)} × {reais.format(somaBase)} ÷ {reais.format(somaMatriz1)} = <strong>{reais.format(l.matriz2)}</strong>
        </li>
        <li>
          <strong>Matriz 3:</strong> 85% × {reais.format(l.matriz2)} = <strong>{reais.format(l.matriz3)}</strong>
        </li>
        <li>
          <strong>Contra 2026:</strong> {reais.format(l.matriz3)} − {reais.format(l.base2026)} = {reais.format(l.diferenca)}
        </li>
        <li>
          <strong>Regra:</strong> {NOME_DA_REGRA[l.regra]}. Complemento de {reais.format(l.complemento)}, total de <strong>{reais.format(l.total)}</strong>.
        </li>
      </ul>
    </div>
  );
}
