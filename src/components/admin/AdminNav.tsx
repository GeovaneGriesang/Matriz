import Link from "next/link";
import { logoutAction } from "@/server/actions/adminAuth";
import { TABLE_MAX_WIDTH } from "@/lib/layoutWidths";

/**
 * As etapas da área administrativa, **na ordem em que devem ser feitas**. A numeração não é
 * decoração: cada passo depende do anterior, e pular a ordem produz resultado errado em silêncio —
 * calcular sem os Dados anuais do ciclo, por exemplo, faz o sistema cair numa aproximação a partir
 * dos dados brutos da PNP, com aviso apenas na memória de cálculo.
 *
 * "Dados importados" não entra aqui: é uma tela **pública**, de consulta, já acessível pelo menu do
 * topo em qualquer página. Repeti-la nesta barra dava a impressão de ser mais um passo da
 * configuração.
 */
export const ETAPAS_ADMIN = [
  {
    href: "/upload",
    titulo: "Extratos da PNP",
    resumo: "Os dados brutos de matrícula, evasão e docentes. É deles que nascem as instituições e os câmpus.",
  },
  {
    href: "/admin/unidades",
    titulo: "Câmpus",
    resumo:
      "Ano de criação de cada câmpus (a PNP não informa) e cadastro dos câmpus novos, que ainda não têm matrícula e por isso não vêm nos extratos.",
  },
  {
    href: "/admin/dados-anuais",
    titulo: "Dados anuais",
    resumo:
      "Matrícula Total equalizada, RAPP e Eficiência Acadêmica publicados pela CONIF para o ciclo — não são deriváveis da PNP.",
  },
  {
    href: "/admin/composicao-repasse",
    titulo: "Composição de Repasse",
    resumo: "Os pesos por modalidade do ciclo (Presencial, EAD, EAD MOOC, EAD FP).",
  },
  {
    href: "/admin/orcamento",
    titulo: "Orçamento anual",
    resumo: "Os valores do ciclo e o botão que calcula a distribuição oficial. É o último passo.",
  },
] as const;

export type EtapaAdmin = (typeof ETAPAS_ADMIN)[number]["href"];

/**
 * Barra de navegação da área administrativa, idêntica em todas as telas — antes cada layout tinha a
 * sua própria lista, em ordens diferentes e omitindo a tela atual, o que escondia justamente a
 * sequência que o usuário precisa seguir.
 */
export function AdminNav({ atual }: { atual: EtapaAdmin }) {
  const indiceAtual = ETAPAS_ADMIN.findIndex((e) => e.href === atual);
  const etapaAtual = ETAPAS_ADMIN[indiceAtual];

  return (
    <div className={`mx-auto flex ${TABLE_MAX_WIDTH} flex-col gap-2 px-6 pt-4 lg:px-12`}>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <nav aria-label="Etapas da configuração" className="flex flex-wrap items-center gap-x-1 gap-y-2">
          {ETAPAS_ADMIN.map((etapa, indice) => {
            const ehAtual = etapa.href === atual;
            return (
              <span key={etapa.href} className="flex items-center gap-1">
                {indice > 0 && (
                  <span aria-hidden className="px-1 text-neutral-300 dark:text-neutral-700">
                    ›
                  </span>
                )}
                <Link
                  href={etapa.href}
                  aria-current={ehAtual ? "page" : undefined}
                  className={`rounded-md px-2 py-1 text-xs font-medium ${
                    ehAtual
                      ? "bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900"
                      : "text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
                  }`}
                >
                  <span className="tabular-nums opacity-70">{indice + 1}.</span> {etapa.titulo}
                </Link>
              </span>
            );
          })}
        </nav>
        <form action={logoutAction}>
          <button
            type="submit"
            className="text-xs font-medium text-neutral-500 underline hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-100"
          >
            Sair
          </button>
        </form>
      </div>
      {etapaAtual && (
        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          <strong>
            Passo {indiceAtual + 1} de {ETAPAS_ADMIN.length}
          </strong>{" "}
          — {etapaAtual.resumo} Os passos estão na ordem em que devem ser feitos: cada um depende do anterior.
        </p>
      )}
    </div>
  );
}
