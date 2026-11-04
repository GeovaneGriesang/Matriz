import Link from "next/link";
import type { ReactNode } from "react";
import { SeletorInstituicao } from "@/components/SeletorInstituicao";
import { SeletorQueNavega } from "@/components/SeletorQueNavega";

interface Instituicao {
  sigla: string;
  nome: string;
}

const ROTULO = "text-xs font-medium uppercase tracking-wide text-neutral-500";

/** O nome do câmpus sem a palavra "CAMPUS", como nas listas. */
export const nomeCurtoDoCampus = (nome: string) => nome.replace(/^CAMPUS( AVANÇADO)? /, "");

/**
 * O seletor único do sistema: ano da matriz, instituição e câmpus, sempre nesta ordem e no alto da tela (revisão de 2026-11-04). Cada tela passa só o que ela
 * usa, com o endereço de cada opção já montado, porque uma função não atravessa a fronteira de Server para Client Component.
 */
export function SeletorDeContexto({
  anos,
  anoEscolhido,
  instituicao,
  campus,
  children,
}: {
  anos?: { ano: number; href: string; titulo?: string }[];
  anoEscolhido?: number;
  instituicao?: { instituicoes: Instituicao[]; sigla: string; urlPorSigla: Record<string, string>; opcaoVazia?: string; rolar?: boolean };
  campus?: { opcoes: { id: number; nome: string; href: string }[]; escolhido: number };
  /** Outra escolha da tela, no mesmo quadro (o curso de referência, por exemplo). */
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start gap-4 rounded-lg border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900">
      {anos && (
        <div className="flex flex-col gap-1">
          <span className={ROTULO} title="Cada matriz usa os alunos da PNP de dois anos antes (o ano-base).">
            Ano da matriz
          </span>
          <div className="flex gap-1">
            {anos.map((a) => (
              <Link
                key={a.ano}
                href={a.href}
                title={a.titulo ?? `A matriz de ${a.ano} usa os alunos de ${a.ano - 2}.`}
                aria-current={a.ano === anoEscolhido ? "true" : undefined}
                className={`rounded px-3 py-2 text-sm font-medium ${
                  a.ano === anoEscolhido
                    ? "bg-if-green text-white"
                    : "border border-neutral-300 text-neutral-700 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
                }`}
              >
                {a.ano}
              </Link>
            ))}
          </div>
        </div>
      )}
      {instituicao && (
        <div className="flex min-w-64 flex-1 flex-col gap-1">
          <span className={ROTULO}>Instituição</span>
          <SeletorInstituicao instituicoes={instituicao.instituicoes} siglaEscolhida={instituicao.sigla} urlPorSigla={instituicao.urlPorSigla} opcaoVazia={instituicao.opcaoVazia} rolar={instituicao.rolar} />
        </div>
      )}
      {campus && (
        <div className="flex min-w-56 flex-1 flex-col gap-1">
          <span className={ROTULO}>Câmpus</span>
          <SeletorQueNavega rotulo="Câmpus" valor={String(campus.escolhido)} opcoes={campus.opcoes.map((c) => ({ valor: String(c.id), rotulo: nomeCurtoDoCampus(c.nome), href: c.href }))} />
        </div>
      )}
      {children}
    </div>
  );
}
