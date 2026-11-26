"use client";

import { Fragment, useMemo, useState } from "react";
import { SinalMaisMenos } from "@/components/SinalMaisMenos";
import { ehCampusDestaque } from "@/lib/destaque";
import { ROTULO_DA_REGRA, fatorDaMatriz3, projetarDistribuicao, REGRA_INTERNA, type AnoInterno, type RegraDoCampus } from "@/lib/mdo/distribuicaoInterna";

/** O que a pessoa muda na distribuição: total e fração de cada ano, mudança de alunos de cada câmpus e se o primeiro ano usa o valor oficial. */
export interface ConfigDaDistribuicao {
  totais: Record<string, number>;
  fatores: Record<string, number>;
  /** Mudança no número de alunos de cada câmpus, em %, pelo id do câmpus. */
  alunos: Record<string, number>;
  usarOficial: boolean;
}

export const CONFIG_DISTRIBUICAO_PADRAO: ConfigDaDistribuicao = { totais: {}, fatores: {}, alunos: {}, usarOficial: true };

export function normalizarConfigDaDistribuicao(bruto: unknown): ConfigDaDistribuicao {
  if (!bruto || typeof bruto !== "object") return CONFIG_DISTRIBUICAO_PADRAO;
  const o = bruto as Partial<ConfigDaDistribuicao>;
  const numeros = (r: unknown) =>
    Object.fromEntries(Object.entries(r && typeof r === "object" ? (r as Record<string, unknown>) : {}).filter(([, v]) => typeof v === "number" && Number.isFinite(v))) as Record<string, number>;
  return { totais: numeros(o.totais), fatores: numeros(o.fatores), alunos: numeros(o.alunos), usarOficial: o.usarOficial !== false };
}

export interface CampusDaDistribuicao {
  id: number;
  nome: string;
  /** O que recebeu no ano anterior ao primeiro ano da tabela. */
  anterior: number;
}

const formato = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const reais = { format: (v: number) => formato.format(Math.abs(v) < 0.5 ? 0 : v) };
const pct = new Intl.NumberFormat("pt-BR", { style: "percent", minimumFractionDigits: 1, maximumFractionDigits: 1, signDisplay: "exceptZero" });
const cor = (v: number) => (Math.abs(v) < 1 ? "text-neutral-500" : v > 0 ? "text-if-green" : "text-if-red dark:text-red-400");
const th = "whitespace-nowrap px-2 py-1.5 text-right font-medium";
const td = "whitespace-nowrap px-2 py-1 text-right tabular-nums";
const entrada = "w-28 rounded border border-neutral-300 px-2 py-1 text-right text-xs tabular-nums dark:border-neutral-700 dark:bg-neutral-900";

const COR_DA_REGRA: Record<RegraDoCampus, string> = {
  oficial: "bg-neutral-200 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300",
  acima: "bg-if-green/15 text-if-green",
  integral: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300",
  "ate-94": "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300",
  piso: "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300",
};
const SIGLA_DA_REGRA: Record<RegraDoCampus, string> = { oficial: "of", acima: "M3", integral: "100", "ate-94": "94", piso: "piso" };

const curto = (nome: string) => nome.replace(/^CAMPUS( AVANÇADO)? /, "");

export function DistribuicaoProjetada({
  anos,
  campi,
  matriz,
  oficial,
  origemDaMatriz,
  config: configExterna,
  onConfig,
  titulo = "Como ficaria a distribuição entre os câmpus do IFSul",
}: {
  anos: readonly number[];
  campi: readonly CampusDaDistribuicao[];
  /** A Matriz 1 de cada câmpus em cada ano, pelo id do câmpus, na ordem de `anos`. */
  matriz: Readonly<Record<string, readonly number[]>>;
  /** A distribuição já decidida do primeiro ano, pelo id do câmpus (a proposta oficial de 2027). */
  oficial?: Readonly<Record<string, number>> | null;
  /** De onde vem a Matriz 1, numa frase. */
  origemDaMatriz: string;
  config?: ConfigDaDistribuicao;
  onConfig?: (c: ConfigDaDistribuicao) => void;
  titulo?: string;
}) {
  const [configInterna, setConfigInterna] = useState<ConfigDaDistribuicao>(CONFIG_DISTRIBUICAO_PADRAO);
  const config = configExterna ?? configInterna;
  const mudar = (c: Partial<ConfigDaDistribuicao>) => {
    const novo = { ...config, ...c };
    if (onConfig) onConfig(novo);
    else setConfigInterna(novo);
  };
  const [aberto, setAberto] = useState<number | null>(null);

  const temOficial = !!oficial && Object.keys(oficial).length > 0;
  const usarOficial = temOficial && config.usarOficial;
  const anoAnterior = anos[0]! - 1;

  const calcular = (alunos: Record<string, number>) =>
    projetarDistribuicao({
      anos,
      campi,
      matrizPorAno: (id, k) => matriz[String(id)]?.[k] ?? 0,
      totais: anos.map((a) => config.totais[String(a)]),
      fatores: anos.map((a) => (config.fatores[String(a)] !== undefined ? config.fatores[String(a)]! / 100 : undefined)),
      oficiais: usarOficial ? new Map([[anos[0]!, new Map(Object.entries(oficial!).map(([id, v]) => [Number(id), v]))]]) : undefined,
      ajusteDeAlunos: Object.fromEntries(Object.entries(alunos).map(([id, v]) => [id, v / 100])),
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const resultado = useMemo(() => calcular(config.alunos), [anos, campi, matriz, config, oficial, usarOficial]);
  const temMudancaDeAlunos = Object.values(config.alunos).some((v) => v !== 0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const semMudanca = useMemo(() => (temMudancaDeAlunos ? calcular({}) : null), [anos, campi, matriz, config, oficial, usarOficial, temMudancaDeAlunos]);

  const ordem = useMemo(
    () => [...campi].sort((a, b) => Number(ehCampusDestaque(b.nome)) - Number(ehCampusDestaque(a.nome)) || a.nome.localeCompare(b.nome, "pt-BR")),
    [campi],
  );
  const linhaDe = (a: AnoInterno, id: number) => a.linhas.find((l) => l.id === id);
  const ultimo = resultado[resultado.length - 1]!;
  const somaAnterior = campi.reduce((s, c) => s + c.anterior, 0);
  const destaque = ordem.find((c) => ehCampusDestaque(c.nome));
  const primeiroCalculado = resultado.find((a) => a.linhas.every((l) => l.regra !== "oficial"));

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
      <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">{titulo}</h2>
      <div className="flex flex-col gap-2 text-sm text-neutral-700 dark:text-neutral-300">
        <p>
          O IFSul não repassa a cada câmpus a matriz dele: reparte o total do ano pela regra da Reitoria. A <strong>Matriz 2</strong> divide o total na proporção da matriz de cada câmpus
          (a Matriz 1). A <strong>Matriz 3</strong> é uma parte dela: <strong>85% em 2027</strong> e <strong>90% de 2028 em diante</strong>. O resto paga a complementação, sempre sobre o que o
          câmpus recebeu no ano anterior: quem fica acima recebe só a Matriz 3; quem cai até {reais.format(REGRA_INTERNA.limiteIntegral)} volta ao valor do ano anterior; quem cai mais volta a
          94% dele; e ninguém fica abaixo de {reais.format(REGRA_INTERNA.piso)}.
        </p>
        <p>
          {origemDaMatriz} Cada ano parte do que o câmpus recebeu no ano anterior, por isso os anos se encadeiam. Sem outro número, o total de um ano é o total do ano anterior; troque na
          primeira tabela para simular um orçamento maior ou menor. Na coluna &quot;Alunos&quot;, aumente ou diminua o número de alunos de um câmpus (em %) para ver quanto ele e os outros
          ganham ou perdem. O + de um câmpus abre, logo abaixo da linha, a conta de cada ano.
        </p>
      </div>

      {temOficial && (
        <label className="flex items-center gap-2 text-sm text-neutral-700 dark:text-neutral-300">
          <input type="checkbox" checked={config.usarOficial} onChange={(e) => mudar({ usarOficial: e.target.checked })} />
          Em {anos[0]}, usar a distribuição oficial (a proposta da Reitoria, como foi aprovada). Desmarcado, {anos[0]} também é calculado pela regra, com a matriz desta tela.
        </label>
      )}

      <div className="tabela-rolavel rounded-lg border border-neutral-200 dark:border-neutral-800">
        <table className="min-w-full text-xs">
          <thead className="bg-neutral-50 text-neutral-600 dark:bg-neutral-900 dark:text-neutral-400">
            <tr>
              <th className="px-2 py-1.5 text-left font-medium">O ano</th>
              {resultado.map((a) => (
                <th key={a.ano} className={th}>
                  {a.ano}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
            <tr>
              <td className="px-2 py-1 text-left">Total a distribuir entre os câmpus</td>
              {resultado.map((a, k) => {
                const oficialDoAno = a.linhas.every((l) => l.regra === "oficial");
                const chave = String(a.ano);
                return (
                  <td key={a.ano} className={td}>
                    {oficialDoAno ? (
                      reais.format(a.somaTotal)
                    ) : (
                      <input
                        type="number"
                        step={10000}
                        min={0}
                        aria-label={`Total a distribuir em ${a.ano}`}
                        className={entrada}
                        value={config.totais[chave] ?? Math.round(a.totalDistribuido)}
                        onChange={(e) => {
                          const v = e.target.value === "" ? undefined : Number(e.target.value);
                          const totais = { ...config.totais };
                          if (v === undefined || !Number.isFinite(v)) delete totais[chave];
                          else totais[chave] = v;
                          mudar({ totais });
                        }}
                      />
                    )}
                    {config.totais[chave] !== undefined && !oficialDoAno && (
                      <button type="button" className="ml-1 text-neutral-400 hover:text-if-red" title="Voltar ao total do ano anterior" onClick={() => {
                        const totais = { ...config.totais };
                        delete totais[chave];
                        mudar({ totais });
                      }}>
                        ×
                      </button>
                    )}
                    {k > 0 && <div className="text-[10px] text-neutral-500">{pct.format(a.totalDistribuido / (resultado[k - 1]!.totalDistribuido || 1) - 1)} sobre {resultado[k - 1]!.ano}</div>}
                  </td>
                );
              })}
            </tr>
            <tr>
              <td className="px-2 py-1 text-left">Parte da Matriz 2 que vai para a Matriz 3</td>
              {resultado.map((a) => {
                const oficialDoAno = a.linhas.every((l) => l.regra === "oficial");
                const chave = String(a.ano);
                return (
                  <td key={a.ano} className={td}>
                    {oficialDoAno ? (
                      "85% (oficial)"
                    ) : (
                      <>
                        <input
                          type="number"
                          step={1}
                          min={0}
                          max={100}
                          aria-label={`Parte da Matriz 3 em ${a.ano}`}
                          className="w-16 rounded border border-neutral-300 px-2 py-1 text-right text-xs tabular-nums dark:border-neutral-700 dark:bg-neutral-900"
                          value={config.fatores[chave] ?? Math.round(fatorDaMatriz3(a.ano) * 100)}
                          onChange={(e) => {
                            const fatores = { ...config.fatores };
                            const v = Number(e.target.value);
                            if (e.target.value === "" || !Number.isFinite(v) || v === Math.round(fatorDaMatriz3(a.ano) * 100)) delete fatores[chave];
                            else fatores[chave] = Math.min(100, Math.max(0, v));
                            mudar({ fatores });
                          }}
                        />
                        %
                      </>
                    )}
                  </td>
                );
              })}
            </tr>
            <tr>
              <td className="px-2 py-1 text-left">Reserva para a complementação</td>
              {resultado.map((a) => (
                <td key={a.ano} className={td}>
                  {a.linhas.every((l) => l.regra === "oficial") ? "-" : reais.format(a.reserva)}
                </td>
              ))}
            </tr>
            <tr>
              <td className="px-2 py-1 text-left">Complementos pagos</td>
              {resultado.map((a) => (
                <td key={a.ano} className={td}>
                  {a.linhas.every((l) => l.regra === "oficial") ? "-" : reais.format(a.somaComplemento)}
                </td>
              ))}
            </tr>
            <tr className="font-medium">
              <td className="px-2 py-1 text-left">Sobra da reserva (falta, se negativo)</td>
              {resultado.map((a) => (
                <td key={a.ano} className={`${td} ${cor(a.reserva - a.somaComplemento)}`}>
                  {a.linhas.every((l) => l.regra === "oficial") ? "-" : reais.format(a.reserva - a.somaComplemento)}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      <div className="tabela-rolavel rounded-lg border border-neutral-200 dark:border-neutral-800">
        <table className="min-w-full text-xs">
          <thead className="bg-neutral-50 text-neutral-600 dark:bg-neutral-900 dark:text-neutral-400">
            <tr>
              <th className="px-2 py-1.5 text-left font-medium">Câmpus</th>
              <th className={th} title="Mudança no número de alunos do câmpus, em %, em todos os anos calculados">
                Alunos (%)
              </th>
              <th className={th}>Recebido {anoAnterior}</th>
              {resultado.map((a) => (
                <th key={a.ano} className={th}>
                  {a.ano}
                </th>
              ))}
              <th className={th}>{ultimo.ano} sobre {anoAnterior}</th>
              {semMudanca && <th className={th}>Efeito dos alunos em {ultimo.ano}</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {ordem.map((c) => {
              const estaAberto = aberto === c.id;
              const fim = linhaDe(ultimo, c.id)?.total ?? 0;
              const efeito = semMudanca ? fim - (linhaDe(semMudanca[semMudanca.length - 1]!, c.id)?.total ?? 0) : 0;
              return (
                <Fragment key={c.id}>
                  <tr className={estaAberto ? "bg-if-green/10" : ehCampusDestaque(c.nome) ? "bg-if-green/5" : undefined}>
                    <td className="whitespace-nowrap px-2 py-1 text-left">
                      <button type="button" onClick={() => setAberto(estaAberto ? null : c.id)} aria-expanded={estaAberto} className="inline-flex items-center gap-2 font-medium hover:text-if-green">
                        <SinalMaisMenos aberto={estaAberto} />
                        {curto(c.nome)}
                      </button>
                    </td>
                    <td className={td}>
                      <input
                        type="number"
                        step={5}
                        min={-100}
                        aria-label={`Mudança no número de alunos de ${c.nome}, em %`}
                        className="w-16 rounded border border-neutral-300 px-2 py-1 text-right text-xs tabular-nums dark:border-neutral-700 dark:bg-neutral-900"
                        value={config.alunos[String(c.id)] ?? 0}
                        onChange={(e) => {
                          const alunos = { ...config.alunos };
                          const v = Number(e.target.value);
                          if (!Number.isFinite(v) || v === 0) delete alunos[String(c.id)];
                          else alunos[String(c.id)] = Math.max(-100, v);
                          mudar({ alunos });
                        }}
                      />
                    </td>
                    <td className={td}>{reais.format(c.anterior)}</td>
                    {resultado.map((a) => {
                      const l = linhaDe(a, c.id);
                      return (
                        <td key={a.ano} className={td}>
                          {reais.format(l?.total ?? 0)}{" "}
                          {l && (
                            <span title={ROTULO_DA_REGRA[l.regra]} className={`ml-1 rounded px-1 text-[10px] font-semibold ${COR_DA_REGRA[l.regra]}`}>
                              {SIGLA_DA_REGRA[l.regra]}
                            </span>
                          )}
                        </td>
                      );
                    })}
                    <td className={`${td} ${cor(fim - c.anterior)}`}>{c.anterior > 0 ? pct.format(fim / c.anterior - 1) : "novo"}</td>
                    {semMudanca && <td className={`${td} ${cor(efeito)}`}>{Math.abs(efeito) < 1 ? "-" : reais.format(efeito)}</td>}
                  </tr>
                  {estaAberto && (
                    <tr data-detalhe="1">
                      <td colSpan={4 + resultado.length + (semMudanca ? 1 : 0)} className="bg-neutral-100 p-3 dark:bg-neutral-900/60">
                        <ContaDoCampusNosAnos nome={c.nome} resultado={resultado} id={c.id} />
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
              <td className={td}></td>
              <td className={td}>{reais.format(somaAnterior)}</td>
              {resultado.map((a) => (
                <td key={a.ano} className={td}>
                  {reais.format(a.somaTotal)}
                </td>
              ))}
              <td className={`${td} ${cor(ultimo.somaTotal - somaAnterior)}`}>{pct.format(ultimo.somaTotal / (somaAnterior || 1) - 1)}</td>
              {semMudanca && <td className={td}></td>}
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="text-xs text-neutral-500 dark:text-neutral-400">
        Etiquetas: <span className={`rounded px-1 font-semibold ${COR_DA_REGRA.acima}`}>M3</span> acima do ano anterior, recebe a Matriz 3;{" "}
        <span className={`rounded px-1 font-semibold ${COR_DA_REGRA.integral}`}>100</span> caiu até R$ 1 milhão e foi completado até o ano anterior;{" "}
        <span className={`rounded px-1 font-semibold ${COR_DA_REGRA["ate-94"]}`}>94</span> caiu mais e foi completado até 94%;{" "}
        <span className={`rounded px-1 font-semibold ${COR_DA_REGRA.piso}`}>piso</span> ficou no piso de R$ 950 mil
        {temOficial && (
          <>
            ; <span className={`rounded px-1 font-semibold ${COR_DA_REGRA.oficial}`}>of</span> valor oficial
          </>
        )}
        . Só entra o Funcionamento dos câmpus; a Reitoria tem linha própria. A regra não diz o que fazer com a sobra da reserva (a primeira tabela mostra quanto sobra ou falta em cada ano): aqui ela fica sem destino, e o total do ano seguinte continua o mesmo.
        {destaque && primeiroCalculado && (() => {
          const l = linhaDe(primeiroCalculado, destaque.id);
          return l ? ` Exemplo: em ${primeiroCalculado.ano}, ${curto(destaque.nome)} tem ${reais.format(l.matriz1)} de matriz, fica com ${reais.format(l.matriz3)} na Matriz 3 e recebe ${reais.format(l.total)} (${ROTULO_DA_REGRA[l.regra]}).` : "";
        })()}
        {semMudanca && " A última coluna mostra quanto cada câmpus ganha ou perde no último ano por causa da mudança de alunos: como o total não muda, o que um câmpus ganha sai dos outros."}
      </p>
    </section>
  );
}

function ContaDoCampusNosAnos({ nome, resultado, id }: { nome: string; resultado: AnoInterno[]; id: number }) {
  return (
    <div className="sticky left-0 flex w-[min(88vw,64rem)] flex-col gap-2 whitespace-normal rounded-md border-l-4 border-if-green bg-white p-4 text-left text-sm dark:bg-neutral-950">
      <h3 className="font-semibold text-neutral-900 dark:text-neutral-100">A conta de {nome}, ano a ano</h3>
      <ul className="flex flex-col gap-1 text-neutral-700 dark:text-neutral-300">
        {resultado.map((a) => {
          const l = a.linhas.find((x) => x.id === id);
          if (!l) return null;
          if (l.regra === "oficial")
            return (
              <li key={a.ano}>
                <strong>{a.ano}:</strong> valor oficial da proposta da Reitoria, {reais.format(l.total)}.
              </li>
            );
          const somaMatriz1 = a.linhas.reduce((s, x) => s + Math.max(0, x.matriz1), 0);
          return (
            <li key={a.ano}>
              <strong>{a.ano}:</strong> Matriz 2 = {reais.format(l.matriz1)} × {reais.format(a.totalDistribuido)} ÷ {reais.format(somaMatriz1)} = {reais.format(l.matriz2)}; Matriz 3 ={" "}
              {Math.round(a.fator * 100)}% = {reais.format(l.matriz3)}; contra {reais.format(l.anterior)} do ano anterior, {ROTULO_DA_REGRA[l.regra]}; complemento de {reais.format(l.complemento)},
              total de <strong>{reais.format(l.total)}</strong>.
            </li>
          );
        })}
      </ul>
    </div>
  );
}
