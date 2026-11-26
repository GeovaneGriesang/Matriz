"use client";

import { Fragment, useState } from "react";
import { SinalMaisMenos } from "@/components/SinalMaisMenos";
import { MOTIVOS, type Motivo, type VariacaoDoAno } from "@/lib/mdo/porQueMuda";

const decimal = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export const COR_MOTIVO: Record<Motivo, string> = {
  formaram: "bg-if-red/70",
  retidos: "bg-if-red/40",
  evasao: "bg-if-red/55",
  anoCompleto: "bg-sky-400",
  reposicao: "bg-sky-500",
  novos: "bg-amber-500",
  reformulados: "bg-violet-500",
  mooc: "bg-sky-300",
};

/**
 * Por que o valor sobe ou desce de um ano da matriz para o seguinte: uma linha por passagem de ano, com o que cada causa somou ou tirou. O + abre logo abaixo
 * a conta em cascata (do total de um ano ao do outro) e os cursos que mais ganharam e perderam.
 */
export function PorQueMuda({
  variacoes,
  manterTudo,
  anoCiclo,
  formatar,
  formatarComSinal,
  nomeDaMedida,
  nomeDoRecorte,
}: {
  variacoes: VariacaoDoAno[];
  manterTudo: number[];
  anoCiclo: number;
  formatar: (v: number) => string;
  formatarComSinal: (v: number) => string;
  nomeDaMedida: string;
  nomeDoRecorte: string;
}) {
  const [aberto, setAberto] = useState<number | null>(null);
  if (variacoes.length === 0) return null;
  const presentes = MOTIVOS.filter((m) => variacoes.some((v) => Math.abs(v.porMotivo[m.chave]) >= 0.5));
  const cor = (v: number) => (Math.abs(v) < 0.5 ? "text-neutral-400" : v > 0 ? "text-if-green" : "text-if-red dark:text-red-400");
  const celula = "px-3 py-2 text-right tabular-nums";
  return (
    <section className="flex flex-col gap-3 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
      <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
        Por que o valor sobe ou desce, {nomeDoRecorte}, em {nomeDaMedida}
      </h2>
      <p className="text-sm text-neutral-600 dark:text-neutral-400">
        Cada linha é a passagem de um ano da matriz para o seguinte: o que as turmas que se formam e a evasão tiram, e o que as turmas que entram trazem. A soma das colunas é a variação. O + abre a conta em
        cascata e os cursos que mais pesaram.
      </p>
      <div className="tabela-rolavel">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wide text-neutral-500">
            <tr>
              <th className="px-3 py-2">De um ano para o outro</th>
              <th className="px-3 py-2 text-right">Ano anterior</th>
              {presentes.map((m) => (
                <th key={m.chave} className="px-3 py-2 text-right" title={m.explicacao}>
                  <span className="inline-flex items-center gap-1">
                    <span aria-hidden className={`inline-block h-2 w-2 rounded-sm ${COR_MOTIVO[m.chave]}`} />
                    {m.rotulo}
                  </span>
                </th>
              ))}
              <th className="px-3 py-2 text-right">Ano seguinte</th>
              <th className="px-3 py-2 text-right">Variação</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
            {variacoes.map((v) => {
              const dif = v.depois - v.antes;
              const estaAberto = aberto === v.k;
              return (
                <Fragment key={v.k}>
                  <tr>
                    <td className="px-3 py-2 font-medium">
                      <button type="button" onClick={() => setAberto(estaAberto ? null : v.k)} aria-expanded={estaAberto} className="flex items-center gap-2 hover:text-if-green">
                        <SinalMaisMenos aberto={estaAberto} />
                        {anoCiclo + v.k - 1} para {anoCiclo + v.k}
                      </button>
                    </td>
                    <td className={celula}>{formatar(v.antes)}</td>
                    {presentes.map((m) => (
                      <td key={m.chave} className={`${celula} ${cor(v.porMotivo[m.chave])}`}>
                        {Math.abs(v.porMotivo[m.chave]) < 0.5 ? "-" : formatarComSinal(v.porMotivo[m.chave])}
                      </td>
                    ))}
                    <td className={`${celula} font-medium`}>{formatar(v.depois)}</td>
                    <td className={`${celula} font-medium ${cor(dif)}`}>
                      {Math.abs(dif) < 0.5 ? "-" : formatarComSinal(dif)}
                      {v.antes > 0 && Math.abs(dif) >= 0.5 ? (
                        <span className="block text-xs font-normal">
                          {dif > 0 ? "+" : "-"}
                          {decimal.format(Math.abs(dif / v.antes) * 100)}%
                        </span>
                      ) : null}
                    </td>
                  </tr>
                  {estaAberto && (
                    <tr data-detalhe="1">
                      <td colSpan={99} className="bg-neutral-50 px-3 py-3 dark:bg-neutral-900">
                        <CascataDoAno v={v} manterTudo={manterTudo[v.k] ?? v.depois} ano={anoCiclo + v.k} formatar={formatar} formatarComSinal={formatarComSinal} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-neutral-500">
        Passe o mouse sobre o título de uma coluna para ver o que ela quer dizer. Sobre &quot;Turmas recentes contam o ano inteiro&quot;: a matriz conta os dias de cada turma no ano, e a turma que entrou em março
        conta, no ano em que entrou, só de março a dezembro.
      </p>
    </section>
  );
}

function CascataDoAno({
  v,
  manterTudo,
  ano,
  formatar,
  formatarComSinal,
}: {
  v: VariacaoDoAno;
  manterTudo: number;
  ano: number;
  formatar: (v: number) => string;
  formatarComSinal: (v: number) => string;
}) {
  const passos = MOTIVOS.filter((m) => Math.abs(v.porMotivo[m.chave]) >= 0.5);
  let acumulado = v.antes;
  const barras = [
    { rotulo: `Total de ${ano - 1}`, de: 0, ate: v.antes, classe: "bg-neutral-400 dark:bg-neutral-500", valor: formatar(v.antes) },
    ...passos.map((m) => {
      const de = acumulado;
      acumulado += v.porMotivo[m.chave];
      return { rotulo: m.rotulo, de, ate: acumulado, classe: COR_MOTIVO[m.chave], valor: formatarComSinal(v.porMotivo[m.chave]) };
    }),
    { rotulo: `Total de ${ano}`, de: 0, ate: v.depois, classe: "bg-if-green", valor: formatar(v.depois) },
  ];
  const max = Math.max(1, ...barras.map((b) => Math.max(b.de, b.ate)));
  const dif = v.depois - v.antes;
  const perdas = passos.filter((m) => v.porMotivo[m.chave] < 0).sort((a, b) => v.porMotivo[a.chave] - v.porMotivo[b.chave]);
  const ganhos = passos.filter((m) => v.porMotivo[m.chave] > 0).sort((a, b) => v.porMotivo[b.chave] - v.porMotivo[a.chave]);
  const sobreManter = manterTudo - v.depois;
  const cursos = [...v.porCurso.entries()].map(([curso, d]) => ({ curso, total: Object.values(d).reduce((s, x) => s + x, 0), d }));
  const maioresPerdas = cursos.filter((c) => c.total < -0.5).sort((a, b) => a.total - b.total).slice(0, 6);
  const maioresGanhos = cursos.filter((c) => c.total > 0.5).sort((a, b) => b.total - a.total).slice(0, 6);
  const principal = (d: Record<Motivo, number>, sinal: 1 | -1) =>
    MOTIVOS.filter((m) => d[m.chave] * sinal > 0.5)
      .sort((a, b) => sinal * (d[b.chave] - d[a.chave]))
      .map((m) => m.rotulo.toLowerCase())[0] ?? "";

  return (
    <div className="flex flex-col gap-3 text-sm text-neutral-700 dark:text-neutral-300">
      <p>
        De {ano - 1} para {ano}, o total {Math.abs(dif) < 0.5 ? "fica igual" : dif > 0 ? `sobe ${formatarComSinal(dif)}` : `cai ${formatarComSinal(dif)}`}.{" "}
        {perdas[0] ? (
          <>
            A maior saída vem de <strong>{perdas[0].rotulo.toLowerCase()}</strong> ({formatarComSinal(v.porMotivo[perdas[0].chave])}).{" "}
          </>
        ) : null}
        {ganhos[0] ? (
          <>
            A maior entrada vem de <strong>{ganhos[0].rotulo.toLowerCase()}</strong> ({formatarComSinal(v.porMotivo[ganhos[0].chave])}).{" "}
          </>
        ) : null}
        {sobreManter >= 0.5 ? <>Se nenhum curso parasse e nenhum curso novo abrisse, o ano teria {formatar(manterTudo)}.</> : null}
        {sobreManter <= -0.5 ? <>Mantendo tudo como está, o ano teria {formatar(manterTudo)}: o cenário fica {formatarComSinal(-sobreManter)} acima.</> : null}
      </p>
      <div className="flex flex-col gap-1">
        {barras.map((b, i) => (
          <div key={i} className="grid grid-cols-[minmax(8rem,16rem)_1fr_8rem] items-center gap-2 text-xs">
            <span className="truncate" title={b.rotulo}>
              {b.rotulo}
            </span>
            <span className="relative h-4 rounded bg-neutral-100 dark:bg-neutral-800">
              <span
                className={`absolute top-0 h-4 rounded ${b.classe}`}
                style={{ left: `${(Math.min(b.de, b.ate) / max) * 100}%`, width: `${Math.max(0.4, (Math.abs(b.ate - b.de) / max) * 100)}%` }}
              />
            </span>
            <span className="text-right tabular-nums">{b.valor}</span>
          </div>
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <ListaDeCursos titulo="Cursos que mais perdem" cursos={maioresPerdas} principal={(d) => principal(d, -1)} classe="text-if-red dark:text-red-400" formatarComSinal={formatarComSinal} />
        <ListaDeCursos titulo="Cursos que mais ganham" cursos={maioresGanhos} principal={(d) => principal(d, 1)} classe="text-if-green" formatarComSinal={formatarComSinal} />
      </div>
      <p className="text-xs text-neutral-500">
        O saldo de cada curso soma as turmas dele (as de hoje, as que entram e as dos cursos novos); entre parênteses, a causa que mais pesou. Uma turma que se forma e outra que entra no mesmo curso se
        compensam no saldo, por isso um curso estável fica perto de zero.
      </p>
    </div>
  );
}

function ListaDeCursos({
  titulo,
  cursos,
  principal,
  classe,
  formatarComSinal,
}: {
  titulo: string;
  cursos: { curso: string; total: number; d: Record<Motivo, number> }[];
  principal: (d: Record<Motivo, number>) => string;
  classe: string;
  formatarComSinal: (v: number) => string;
}) {
  return (
    <div>
      <p className="font-medium">{titulo}</p>
      {cursos.length === 0 ? (
        <p className="text-xs text-neutral-500">Nenhum.</p>
      ) : (
        <ul className="mt-1 flex flex-col gap-1 text-xs">
          {cursos.map((c) => (
            <li key={c.curso} className="flex justify-between gap-2">
              <span>
                {c.curso} <span className="text-neutral-500">({principal(c.d)})</span>
              </span>
              <span className={`shrink-0 tabular-nums ${classe}`}>{formatarComSinal(c.total)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
