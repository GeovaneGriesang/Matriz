import Link from "next/link";
import { prisma } from "@/server/db/prisma";
import { requireAdminOrRedirect } from "@/server/auth/session";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { CicloOrcamentoForm } from "@/components/admin/CicloOrcamentoForm";
import { TABLE_MAX_WIDTH } from "@/lib/layoutWidths";

export const dynamic = "force-dynamic";

export default async function AdminOrcamentoPage({
  searchParams,
}: {
  searchParams: Promise<{ ano?: string }>;
}) {
  const usuario = await requireAdminOrRedirect("/admin/orcamento");

  const ciclos = await prisma.cicloOrcamento.findMany({
    orderBy: { ano: "desc" },
    include: { fonteDados: { select: { origem: true, arquivo: true, geradoEm: true, carregadoEm: true } } },
  });

  const params = await searchParams;
  const anoEscolhido = Number(params.ano) || ciclos[0]?.ano;
  const ciclo = ciclos.find((c) => c.ano === anoEscolhido) ?? null;

  return (
    <main className={`mx-auto flex ${TABLE_MAX_WIDTH} flex-col gap-6 px-6 py-12 lg:px-12`}>
      <AdminHeader usuario={usuario} atual="/admin/orcamento" />

      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">Correção manual</h1>
        <p className="max-w-2xl text-neutral-600 dark:text-neutral-400">
          Para quando a MDO ainda não publicou um parâmetro do ciclo, ou publicou algo que já se sabe
          estar errado. Salvar aqui sobrescreve os 17 parâmetros do ciclo escolhido e registra a origem
          como &quot;administrador&quot;, até a próxima carga da MDO trazer o valor de volta.
        </p>
      </div>

      {ciclos.length === 0 ? (
        <p className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
          Nenhum ciclo carregado ainda. Rode <code>npm run carregar -- 2027</code> antes de corrigir algo à mão.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap gap-1">
            {ciclos.map((c) => (
              <Link
                key={c.ano}
                href={`/admin/orcamento?ano=${c.ano}`}
                className={`rounded px-3 py-1.5 text-sm font-medium ${
                  c.ano === anoEscolhido
                    ? "bg-if-green text-white"
                    : "border border-neutral-300 text-neutral-700 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
                }`}
              >
                {c.ano}
              </Link>
            ))}
          </div>

          {ciclo && (
            <>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Origem atual: <strong>{ciclo.fonteDados.origem === "ADMINISTRADOR" ? "corrigido à mão" : "MDO"}</strong>
                {" · "}
                {ciclo.fonteDados.arquivo}
              </p>
              <CicloOrcamentoForm
                ciclo={{
                  ano: ciclo.ano,
                  valorReferenciaSpo: Number(ciclo.valorReferenciaSpo),
                  ajuste: Number(ciclo.ajuste),
                  assistenciaTotal: Number(ciclo.assistenciaTotal),
                  funcionamentoTotal: Number(ciclo.funcionamentoTotal),
                  pisoTotal: Number(ciclo.pisoTotal),
                  pisoPorCampus: Number(ciclo.pisoPorCampus),
                  campusComPiso: ciclo.campusComPiso,
                  reitoriasTotal: Number(ciclo.reitoriasTotal),
                  qualidadeEficienciaTotal: Number(ciclo.qualidadeEficienciaTotal),
                  valorIea: Number(ciclo.valorIea),
                  valorRap: Number(ciclo.valorRap),
                  valorIapl: Number(ciclo.valorIapl),
                  valorMatriculaPresencial:
                    ciclo.valorMatriculaPresencial === null ? null : Number(ciclo.valorMatriculaPresencial),
                  valorMatriculaEad: ciclo.valorMatriculaEad === null ? null : Number(ciclo.valorMatriculaEad),
                  valorMatriculaEadFp:
                    ciclo.valorMatriculaEadFp === null ? null : Number(ciclo.valorMatriculaEadFp),
                  valorMatriculaEadMooc:
                    ciclo.valorMatriculaEadMooc === null ? null : Number(ciclo.valorMatriculaEadMooc),
                  percentualAnuidade: Number(ciclo.percentualAnuidade),
                }}
              />
            </>
          )}
        </>
      )}
    </main>
  );
}
