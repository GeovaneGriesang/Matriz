"use client";

import { useEffect, useState } from "react";
import { SeloConfianca } from "@/components/Confianca";
import { TabelaOrdenavel, type ColunaOrdenavel } from "@/components/TabelaOrdenavel";
import { carregarCursosComparativoCampusAction } from "@/server/actions/comparativoCursos";
import { explicarVariacaoCampusAction, type ResultadoExplicacao } from "@/server/actions/explicarVariacao";
import type { CursoLinha } from "@/app/consulta/ConsultaTabelaCursos";

export interface LinhaComparativoCampus {
  unidadeId: number;
  nome: string;
  a: number;
  b: number;
  variacao: number;
  /** Quanto o campus recebeu de fato em cada ciclo, digitado em Valores recebidos. null se nao ha registro. */
  informadoA: number | null;
  informadoB: number | null;
}

const reais = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const doisDecimais = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Client Component só para hospedar `colunas` (com funções `valor`/`render`), pelo
 * mesmo motivo de sempre: `TabelaOrdenavel` é "use client".
 */
export function ComparativoTabelaCampus({
  linhas,
  anoA,
  anoB,
}: {
  linhas: LinhaComparativoCampus[];
  anoA: number;
  anoB: number;
}) {
  return (
    <TabelaOrdenavel
      linhas={linhas}
      chaveLinha={(l) => l.unidadeId}
      linhaExpandida={(l) => (
        <div className="flex flex-col gap-4">
          <ExplicacaoVariacao unidadeId={l.unidadeId} anoA={anoA} anoB={anoB} nome={l.nome} />
          <CursosDoCampus unidadeId={l.unidadeId} anoA={anoA} anoB={anoB} />
        </div>
      )}
      colunas={
        [
          { chave: "nome", rotulo: "Câmpus", valor: (l) => l.nome },
          {
            chave: "anoA",
            rotulo: String(anoA),
            alinhamento: "right",
            valor: (l) => (l.a === 0 && l.b > 0 ? null : l.a),
            render: (l) => (
              <span className="text-neutral-600 dark:text-neutral-400">
                {l.a === 0 && l.b > 0 ? "não havia" : reais.format(l.a)}
              </span>
            ),
          },
          {
            chave: "informadoA",
            rotulo: `Informado ${anoA}`,
            alinhamento: "right",
            valor: (l) => l.informadoA,
            render: (l) =>
              l.informadoA === null ? (
                <span className="text-xs text-neutral-400" title="Ninguem cadastrou o valor recebido em Valores recebidos">sem registro</span>
              ) : (
                <span className="text-neutral-600 dark:text-neutral-400">{reais.format(l.informadoA)}</span>
              ),
          },
          {
            chave: "anoB",
            rotulo: String(anoB),
            alinhamento: "right",
            valor: (l) => l.b,
            render: (l) => reais.format(l.b),
          },
          {
            chave: "variacao",
            rotulo: "Variação",
            alinhamento: "right",
            valor: (l) => (l.a === 0 && l.b > 0 ? null : l.variacao),
            render: (l) =>
              l.a === 0 && l.b > 0 ? (
                <span className="text-xs text-neutral-500">novo no ciclo</span>
              ) : (
                <span className={l.variacao >= 0 ? "text-if-green" : "text-if-red dark:text-red-400"}>
                  {l.variacao >= 0 ? "+" : ""}
                  {doisDecimais.format(l.variacao)}%
                </span>
              ),
          },
          {
            chave: "contraInformado",
            rotulo: `Matriz ${anoB} contra o informado ${anoA}`,
            alinhamento: "right",
            valor: (l) => (l.informadoA === null || l.informadoA === 0 ? null : l.b - l.informadoA),
            render: (l) => {
              if (l.informadoA === null || l.informadoA === 0) return <span className="text-xs text-neutral-400">-</span>;
              const dif = l.b - l.informadoA;
              const pct = (l.b / l.informadoA - 1) * 100;
              return (
                <span className={dif >= 0 ? "text-if-green" : "text-if-red dark:text-red-400"}>
                  {dif >= 0 ? "+" : "-"}
                  {reais.format(Math.abs(dif))} ({dif >= 0 ? "+" : ""}
                  {doisDecimais.format(pct)}%)
                </span>
              );
            },
          },
        ] satisfies ColunaOrdenavel<LinhaComparativoCampus>[]
      }
    />
  );
}

const reaisCurso = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

/**
 * Segundo nível do "+/-": os cursos de um câmpus, carregados só quando a pessoa
 * abre esse câmpus (não faz sentido puxar os cursos de todos os câmpus da rede
 * antecipadamente). Mostra os dois ciclos lado a lado; como o nome de um curso pode
 * mudar de um ciclo para o outro, cada lista é ordenada por valor, sem tentar casar
 * curso a curso.
 */
function CursosDoCampus({ unidadeId, anoA, anoB }: { unidadeId: number; anoA: number; anoB: number }) {
  const [estado, setEstado] = useState<
    { status: "carregando" } | { status: "erro"; mensagem: string } | { status: "pronto"; cursosA: CursoLinha[]; cursosB: CursoLinha[] }
  >({ status: "carregando" });

  useEffect(() => {
    let cancelado = false;
    carregarCursosComparativoCampusAction(unidadeId, anoA, anoB).then((resultado) => {
      if (cancelado) return;
      if (!resultado.ok) {
        setEstado({ status: "erro", mensagem: resultado.errorMessage ?? "Não foi possível carregar os cursos." });
        return;
      }
      setEstado({ status: "pronto", cursosA: resultado.cursosA, cursosB: resultado.cursosB });
    });
    return () => {
      cancelado = true;
    };
  }, [unidadeId, anoA, anoB]);

  if (estado.status === "carregando") {
    return <p className="text-sm text-neutral-500 dark:text-neutral-400">Carregando cursos...</p>;
  }
  if (estado.status === "erro") {
    return <p className="text-sm text-if-red">{estado.mensagem}</p>;
  }
  if (estado.cursosA.length === 0 && estado.cursosB.length === 0) {
    return (
      <p className="text-sm text-neutral-500 dark:text-neutral-400">
        Nenhum curso com 6ª fase carregada para este câmpus em {anoA} nem {anoB}.
      </p>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <ListaCursos ano={anoA} cursos={estado.cursosA} />
      <ListaCursos ano={anoB} cursos={estado.cursosB} />
    </div>
  );
}

function ListaCursos({ ano, cursos }: { ano: number; cursos: CursoLinha[] }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">Cursos em {ano}</span>
      {cursos.length === 0 ? (
        <p className="text-xs text-neutral-500 dark:text-neutral-400">Sem 6ª fase carregada em {ano}.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-neutral-200 rounded-md border border-neutral-200 bg-white text-sm dark:divide-neutral-800 dark:border-neutral-800 dark:bg-neutral-950">
          {cursos.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-3 px-3 py-1.5">
              <span className="text-neutral-700 dark:text-neutral-300">{c.curso}</span>
              <span className="shrink-0 tabular-nums text-neutral-900 dark:text-neutral-100">{reaisCurso.format(c.valor)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const inteiro = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });

function Sinal({ v }: { v: number }) {
  return (
    <span className={Math.abs(v) < 1 ? "text-neutral-500" : v > 0 ? "text-if-green" : "text-if-red dark:text-red-400"}>
      {v >= 0 ? "+" : "-"}
      {reais.format(Math.abs(v))}
    </span>
  );
}

/**
 * O botão "O que ocorreu?": explica por que a MATRIZ do câmpus mudou entre os dois ciclos
 * (só ela; o informado é digitado, não tem um porquê). Busca sob demanda, como os cursos.
 */
function ExplicacaoVariacao({ unidadeId, anoA, anoB, nome }: { unidadeId: number; anoA: number; anoB: number; nome: string }) {
  const [aberto, setAberto] = useState(false);
  const [estado, setEstado] = useState<{ status: "carregando" } | { status: "pronto"; r: ResultadoExplicacao } | null>(null);

  function alternar() {
    const abrir = !aberto;
    setAberto(abrir);
    if (abrir && estado === null) {
      setEstado({ status: "carregando" });
      explicarVariacaoCampusAction(unidadeId, anoA, anoB).then((r) => setEstado({ status: "pronto", r }));
    }
  }

  const e = estado?.status === "pronto" ? estado.r.explicacao : undefined;

  return (
    <div className="flex flex-col gap-2">
      <div>
        <button
          type="button"
          onClick={alternar}
          className="rounded-md border border-if-green px-3 py-1.5 text-sm font-medium text-if-green hover:bg-if-green/10"
        >
          {aberto ? "Esconder" : "O que ocorreu com o valor da matriz?"}
        </button>
      </div>
      {aberto && estado?.status === "carregando" && <p className="text-sm text-neutral-500">Calculando...</p>}
      {aberto && estado?.status === "pronto" && !estado.r.ok && <p className="text-sm text-if-red">{estado.r.errorMessage}</p>}
      {aberto && estado?.status === "pronto" && estado.r.motivoSemExplicacao && (
        <p className="text-sm text-neutral-600 dark:text-neutral-400">{estado.r.motivoSemExplicacao}</p>
      )}
      {aberto && e && (
        <div className="flex flex-col gap-3 rounded-md border border-neutral-200 bg-white p-4 text-sm dark:border-neutral-800 dark:bg-neutral-950">
          <p className="text-neutral-700 dark:text-neutral-300">
            O Funcionamento de <strong>{nome}</strong> foi de {reais.format(e.valorA)} em {e.anoA} para {reais.format(e.valorB)} em{" "}
            {e.anoB}, uma diferença de <Sinal v={e.diferenca} />. Ela se explica por quatro efeitos, que somam exatamente essa
            diferença:
          </p>
          <table className="w-full text-sm">
            <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
              <tr>
                <td className="py-1.5 pr-3">Matriz de {e.anoA}</td>
                <td className="py-1.5 text-right tabular-nums">{reais.format(e.valorA)}</td>
              </tr>
              <tr>
                <td className="py-1.5 pr-3 align-top">
                  <strong>Matrícula:</strong> mais ou menos alunos (já ponderados por peso do curso, carga horária e dias)
                  <ul className="mt-1 list-disc pl-5 text-xs text-neutral-500">
                    {e.efeitoMatriculaPorModalidade
                      .filter((m) => m.matriculaA > 0 || m.matriculaB > 0)
                      .map((m) => (
                        <li key={m.modalidade}>
                          {m.rotulo}: {inteiro.format(m.matriculaA)} para {inteiro.format(m.matriculaB)} matrículas equalizadas
                        </li>
                      ))}
                  </ul>
                </td>
                <td className="py-1.5 text-right align-top tabular-nums">
                  <Sinal v={e.efeitoMatricula} />
                </td>
              </tr>
              <tr>
                <td className="py-1.5 pr-3 align-top">
                  <strong>Orçamento:</strong> o Funcionamento da rede passou de {reais.format(e.fundoRedeA)} para {reais.format(e.fundoRedeB)},
                  o que muda o valor de cada matrícula
                </td>
                <td className="py-1.5 text-right align-top tabular-nums">
                  <Sinal v={e.efeitoOrcamento} />
                </td>
              </tr>
              <tr>
                <td className="py-1.5 pr-3 align-top">
                  <strong>Matrículas da rede:</strong> a rede passou de {inteiro.format(e.matriculaRedeA)} para {inteiro.format(e.matriculaRedeB)}{" "}
                  matrículas equivalentes; mais matrícula dividindo o mesmo dinheiro reduz o valor de cada uma (o valor de uma matrícula
                  presencial foi de {reais.format(e.valorMatriculaPresencialA)} para {reais.format(e.valorMatriculaPresencialB)})
                </td>
                <td className="py-1.5 text-right align-top tabular-nums">
                  <Sinal v={e.efeitoMatriculaRede} />
                </td>
              </tr>
              <tr>
                <td className="py-1.5 pr-3 align-top">
                  <strong>Piso Mínimo e ajustes da fonte:</strong> mudança no quanto o câmpus foi elevado ao piso (em 2027 inclui a diferença de precificação do MOOC, que a 5ª fase publicou a 0,8 em vez de 0,08)
                </td>
                <td className="py-1.5 text-right align-top tabular-nums">
                  <Sinal v={e.efeitoPiso} />
                </td>
              </tr>
              <tr className="font-semibold">
                <td className="py-1.5 pr-3">Matriz de {e.anoB}</td>
                <td className="py-1.5 text-right tabular-nums">{reais.format(e.valorB)}</td>
              </tr>
            </tbody>
          </table>
          <p className="text-xs text-neutral-500">
            Esta explicação vale só para a matriz (Funcionamento por matrícula). O valor informado é digitado por um
            administrador e não tem decomposição.
          </p>
          <div className="flex flex-wrap gap-2">
            <SeloConfianca id="explicacao-variacao" />
            {e.anoB === 2027 && <SeloConfianca id="mooc-2027" />}
          </div>
        </div>
      )}
    </div>
  );
}
