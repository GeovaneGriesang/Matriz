"use client";

import { Fragment, useMemo, useState } from "react";
import { SinalMaisMenos } from "@/components/SinalMaisMenos";
import { efeitoNaDistribuicao, ROTULO_DA_REGRA } from "@/lib/mdo/distribuicaoInterna";

/** A base da distribuição interna, como vem do servidor (ver server/queries/distribuicaoInterna.ts). */
export interface BaseDaDistribuicaoInterna {
  anoMatriz: number;
  campi: Array<{ id: number; nome: string }>;
  anterior: Record<string, number>;
  oficial: Record<string, number> | null;
  matriz: Record<string, number>;
}

export interface SerieDeGanho {
  rotulo: string;
  /** Quanto a simulação soma à matriz do câmpus em cada ano. */
  ganhos: ReadonlyArray<{ ano: number; valor: number }>;
}

const reais = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const centavos = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const cor = (v: number) => (Math.abs(v) < 1 ? "text-neutral-400" : v > 0 ? "text-if-green" : "text-if-red dark:text-red-400");
const td = "whitespace-nowrap px-2 py-1 text-right tabular-nums";
const normalizar = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/^CAMPUS( AVANCADO)? /, "")
    .trim();
const curto = (nome: string) => nome.replace(/^CAMPUS( AVANÇADO)? /, "");

/**
 * Quanto do ganho que uma simulação traz para a matriz de um câmpus chega a ele na distribuição interna do IFSul.
 * O total repartido entre os câmpus não muda, então o ganho de um sai dos outros, e a complementação pode absorver parte.
 */
export function EfeitoNaDistribuicaoInterna({ dados, campus, series }: { dados: BaseDaDistribuicaoInterna; campus: string; series: SerieDeGanho[] }) {
  const [aberta, setAberta] = useState<number | null>(null);
  const alvo = dados.campi.find((c) => normalizar(c.nome) === normalizar(campus));

  // Com a distribuição oficial do ano da matriz, a conta começa no ano seguinte, a partir dela.
  const temOficial = !!dados.oficial && Object.keys(dados.oficial).length > 0;
  const primeiroAno = temOficial ? dados.anoMatriz + 1 : dados.anoMatriz;
  const ultimoAno = Math.max(primeiroAno, ...series.flatMap((s) => s.ganhos.filter((g) => g.valor !== 0).map((g) => g.ano)));
  const anos = useMemo(() => Array.from({ length: Math.min(12, ultimoAno - primeiroAno + 1) }, (_, k) => primeiroAno + k), [primeiroAno, ultimoAno]);

  const contas = useMemo(() => {
    if (!alvo) return [];
    const base = temOficial ? dados.oficial! : dados.anterior;
    const campi = dados.campi
      .map((c) => ({ id: c.id, nome: c.nome, anterior: base[String(c.id)] ?? 0 }))
      .filter((c) => c.anterior > 0 || (dados.matriz[String(c.id)] ?? 0) > 0);
    const matriz = new Map(Object.entries(dados.matriz).map(([id, v]) => [Number(id), v]));
    return series.map((s) => {
      const ganhoPorAno = anos.map((a) => s.ganhos.filter((g) => g.ano === a).reduce((t, g) => t + g.valor, 0));
      const r = efeitoNaDistribuicao({ anos, campi, matriz }, alvo.id, ganhoPorAno);
      const noCampus = anos.map((_, k) => {
        const com = r.comGanho[k]!.linhas.find((l) => l.id === alvo.id);
        const sem = r.semGanho[k]!.linhas.find((l) => l.id === alvo.id);
        return { valor: (com?.total ?? 0) - (sem?.total ?? 0), regra: com?.regra ?? "acima" };
      });
      return { rotulo: s.rotulo, ganhoPorAno, noCampus, r };
    });
  }, [alvo, dados, series, anos, temOficial]);

  if (!alvo || contas.length === 0 || anos.length === 0) return null;
  const exemplo = contas[0]!;
  const kExemplo = exemplo.ganhoPorAno.findLastIndex((g) => g > 0);

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
      <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">E na distribuição entre os câmpus do IFSul?</h2>
      <p className="text-sm text-neutral-700 dark:text-neutral-300">
        O ganho na matriz não chega inteiro a {curto(alvo.nome)}. O IFSul reparte o total entre os câmpus pela regra da Reitoria: a Matriz 3 é 90% da fatia de cada câmpus (de 2028 em
        diante), e quem cai em relação ao ano anterior é completado. Como o total repartido não muda, o que {curto(alvo.nome)} ganha a mais sai dos outros câmpus; e, se o câmpus está
        sendo completado ou está no piso, parte do ganho só reduz o complemento. A conta parte da distribuição {temOficial ? `oficial de ${dados.anoMatriz}` : `de ${dados.anoMatriz - 1}`}, com a matriz de{" "}
        {dados.anoMatriz} dos outros câmpus parada e o total de cada ano igual ao do ano anterior. A fórmula, passo a passo e com um exemplo resolvido, está em Simulações, Distribuição
        entre câmpus, no quadro &quot;Como fazer a conta&quot;.
        {kExemplo >= 0 &&
          ` Exemplo: em ${anos[kExemplo]}, "${exemplo.rotulo}" soma ${reais.format(exemplo.ganhoPorAno[kExemplo]!)} à matriz, e ${curto(alvo.nome)} recebe ${reais.format(exemplo.noCampus[kExemplo]!.valor)} a mais (${centavos.format(exemplo.ganhoPorAno[kExemplo]! > 0 ? exemplo.noCampus[kExemplo]!.valor / exemplo.ganhoPorAno[kExemplo]! : 0)} por real de matriz).`}
      </p>
      <div className="tabela-rolavel">
        <table className="min-w-full text-xs">
          <thead className="bg-neutral-50 text-neutral-600 dark:bg-neutral-900 dark:text-neutral-400">
            <tr>
              <th className="px-2 py-1.5 text-left font-medium">Simulação</th>
              <th className="px-2 py-1.5 text-left font-medium"></th>
              {anos.map((a) => (
                <th key={a} className="whitespace-nowrap px-2 py-1.5 text-right font-medium">
                  {a}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {contas.map((c, i) => {
              const estaAberta = aberta === i;
              const kFim = anos.length - 1;
              return (
                <Fragment key={i}>
                  <tr>
                    <td rowSpan={3} className="px-2 py-1 align-top">
                      <button type="button" onClick={() => setAberta(estaAberta ? null : i)} aria-expanded={estaAberta} className="inline-flex items-center gap-2 text-left font-medium hover:text-if-green">
                        <SinalMaisMenos aberto={estaAberta} />
                        {c.rotulo}
                      </button>
                    </td>
                    <td className="whitespace-nowrap px-2 py-1 text-neutral-500">Na matriz do câmpus</td>
                    {c.ganhoPorAno.map((g, k) => (
                      <td key={k} className={`${td} ${cor(g)}`}>
                        {Math.abs(g) < 1 ? "-" : reais.format(g)}
                      </td>
                    ))}
                  </tr>
                  <tr className="font-medium">
                    <td className="whitespace-nowrap px-2 py-1">O câmpus recebe a mais</td>
                    {c.noCampus.map((x, k) => (
                      <td key={k} className={`${td} ${cor(x.valor)}`} title={ROTULO_DA_REGRA[x.regra]}>
                        {Math.abs(x.valor) < 1 ? "-" : reais.format(x.valor)}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="whitespace-nowrap px-2 py-1 text-neutral-500">Os outros câmpus</td>
                    {c.noCampus.map((x, k) => {
                      const outros = c.r.comGanho[k]!.somaTotal - c.r.semGanho[k]!.somaTotal - x.valor;
                      return (
                        <td key={k} className={`${td} ${cor(outros)}`}>
                          {Math.abs(outros) < 1 ? "-" : reais.format(outros)}
                        </td>
                      );
                    })}
                  </tr>
                  {estaAberta && (
                    <tr data-detalhe="1">
                      <td colSpan={2 + anos.length} className="bg-neutral-100 p-3 dark:bg-neutral-900/60">
                        <div className="sticky left-0 flex w-[min(88vw,48rem)] flex-col gap-2 whitespace-normal rounded-md border-l-4 border-if-green bg-white p-4 text-left text-sm dark:bg-neutral-950">
                          <h3 className="font-semibold text-neutral-900 dark:text-neutral-100">
                            Em {anos[kFim]}, quem ganha e quem perde com &quot;{c.rotulo}&quot;
                          </h3>
                          <table className="text-xs">
                            <tbody>
                              {c.r.comGanho[kFim]!.linhas
                                .map((l) => ({ l, d: l.total - (c.r.semGanho[kFim]!.linhas.find((x) => x.id === l.id)?.total ?? 0) }))
                                .filter((x) => Math.abs(x.d) >= 1)
                                .sort((a, b) => b.d - a.d)
                                .map(({ l, d }) => (
                                  <tr key={l.id}>
                                    <td className="py-0.5 pr-4">{curto(l.nome)}</td>
                                    <td className={`${td} ${cor(d)}`}>{reais.format(d)}</td>
                                    <td className="py-0.5 pl-3 text-neutral-500">{ROTULO_DA_REGRA[l.regra]}</td>
                                  </tr>
                                ))}
                            </tbody>
                          </table>
                          <p className="text-xs text-neutral-500">
                            Quem está sendo completado ou no piso quase não perde: o que muda nele é o complemento. A soma dos câmpus pode variar um pouco, porque os complementos podem passar da reserva.
                          </p>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
