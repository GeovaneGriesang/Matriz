"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface Aba {
  href: string;
  rotulo: string;
  descricao: string;
}

/**
 * "Onde o câmpus pode ganhar" junta três telas que respondiam à mesma pergunta (decisão de 2026-10-26: menos opções no menu):
 * comparar alternativas, ideias de cursos e horas que a MDO não paga, e indicadores e evasão. Cada aba continua no próprio
 * endereço, então links antigos e simulações salvas valem como antes.
 */
export const ABAS_ONDE_GANHAR: Aba[] = [
  { href: "/simulador/alternativas", rotulo: "Comparar alternativas", descricao: "curso novo, turma FIC, RAP, evasão e vagas, lado a lado" },
  { href: "/simulador/oportunidades", rotulo: "Ideias de cursos e horas não pagas", descricao: "que curso rende mais por vaga e onde há horas acima do teto" },
  { href: "/simulador", rotulo: "Indicadores e evasão", descricao: "quanto muda se a evasão cair ou a RAP e o IAPL mudarem de faixa" },
];

/**
 * "Abrir ou mudar um curso" junta, do mesmo modo (2026-10-27), as três telas sobre um curso só: quanto ele vale, quanto rende
 * ano a ano se for aberto, e o integrado em 3 ou 4 anos.
 */
export const ABAS_UM_CURSO: Aba[] = [
  { href: "/consulta/curso", rotulo: "Quanto vale um curso", descricao: "peso, carga horária mínima e quanto a MDO paga por um aluno que faz o curso inteiro" },
  { href: "/simulador/novo-curso", rotulo: "Curso novo, ano a ano", descricao: "quanto um curso novo rende do primeiro ingresso até todas as turmas em andamento" },
  { href: "/simulador/curso", rotulo: "Integrado: 3 ou 4 anos", descricao: "o repasse e a rotina (horas por dia, turnos, salas e professores) em 3 ou em 4 anos" },
];

const GRUPOS: { rotulo: string; abas: Aba[] }[] = [
  { rotulo: "Onde o câmpus pode ganhar", abas: ABAS_ONDE_GANHAR },
  { rotulo: "Abrir ou mudar um curso", abas: ABAS_UM_CURSO },
  { rotulo: "Cenários, anos à frente", abas: [{ href: "/simulador/projecao", rotulo: "Cenários, anos à frente", descricao: "" }] },
];

const classe = (ativa: boolean) =>
  `rounded-md px-3 py-1.5 text-sm font-medium ${
    ativa ? "bg-if-green text-white" : "text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
  }`;

/** Abas das simulações, repetidas no topo de cada uma para não ser preciso voltar ao menu. */
export function SubmenuSimulador() {
  const pathname = usePathname();
  const grupoAtivo = GRUPOS.find((g) => g.abas.some((a) => a.href === pathname));
  return (
    <div className="flex flex-col gap-2 border-b border-neutral-200 pb-3 dark:border-neutral-800">
      <div className="flex flex-wrap gap-1">
        {GRUPOS.map((g) => {
          const ativa = g === grupoAtivo;
          return (
            <Link key={g.rotulo} href={g.abas[0]?.href ?? "/simulador"} aria-current={ativa ? "page" : undefined} className={classe(ativa)}>
              {g.rotulo}
            </Link>
          );
        })}
      </div>
      {grupoAtivo && grupoAtivo.abas.length > 1 && (
        <div className="flex flex-col gap-1 rounded-lg border border-if-green/30 bg-if-green/5 p-2">
          <div className="flex flex-wrap gap-1">
            {grupoAtivo.abas.map((a) => {
              const ativa = a.href === pathname;
              return (
                <Link
                  key={a.href}
                  href={a.href}
                  aria-current={ativa ? "page" : undefined}
                  title={a.descricao}
                  className={`rounded-md px-3 py-1 text-sm ${ativa ? "bg-white font-semibold text-if-green shadow-sm dark:bg-neutral-900" : "text-neutral-600 hover:bg-white/70 dark:text-neutral-400 dark:hover:bg-neutral-900"}`}
                >
                  {a.rotulo}
                </Link>
              );
            })}
          </div>
          <span className="px-1 text-xs text-neutral-500 dark:text-neutral-400">{grupoAtivo.abas.find((a) => a.href === pathname)?.descricao}</span>
        </div>
      )}
    </div>
  );
}
