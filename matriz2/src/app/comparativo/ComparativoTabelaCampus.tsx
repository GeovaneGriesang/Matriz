"use client";

import { useEffect, useState } from "react";
import { TabelaOrdenavel, type ColunaOrdenavel } from "@/components/TabelaOrdenavel";
import { carregarCursosComparativoCampusAction } from "@/server/actions/comparativoCursos";
import type { CursoLinha } from "@/app/consulta/ConsultaTabelaCursos";

export interface LinhaComparativoCampus {
  unidadeId: number;
  nome: string;
  a: number;
  b: number;
  variacao: number;
}

const reais = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
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
      linhaExpandida={(l) => <CursosDoCampus unidadeId={l.unidadeId} anoA={anoA} anoB={anoB} />}
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
