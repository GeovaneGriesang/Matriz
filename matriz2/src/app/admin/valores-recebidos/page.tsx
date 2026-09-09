import { prisma } from "@/server/db/prisma";
import { requireAcessoPlenoOrRedirect } from "@/server/auth/session";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { TABLE_MAX_WIDTH } from "@/lib/layoutWidths";
import { ValoresRecebidosPainel } from "@/components/admin/ValoresRecebidosPainel";

export const dynamic = "force-dynamic";

interface Busca {
  ano?: string;
}

export default async function ValoresRecebidosPage({ searchParams }: { searchParams: Promise<Busca> }) {
  const usuario = await requireAcessoPlenoOrRedirect("/admin/valores-recebidos");
  const params = await searchParams;

  const anosDisponiveis = await prisma.distribuicaoCiclo.findMany({
    distinct: ["ano"],
    select: { ano: true },
    orderBy: { ano: "desc" },
  });
  const ano = Number(params.ano) || anosDisponiveis[0]?.ano || new Date().getFullYear();

  const [instituicoes, registrados] = await Promise.all([
    prisma.instituicao.findMany({
      orderBy: { sigla: "asc" },
      select: {
        id: true,
        sigla: true,
        nome: true,
        unidades: { orderBy: { nome: "asc" }, select: { id: true, nome: true } },
      },
    }),
    prisma.valorRecebidoCampus.findMany({
      where: { ano },
      include: {
        unidade: { select: { nome: true, instituicao: { select: { sigla: true } } } },
        registradoPor: { select: { nome: true } },
      },
      orderBy: { atualizadoEm: "desc" },
    }),
  ]);

  const registrosLinhas = registrados.map((r) => ({
    id: r.id,
    unidadeId: r.unidadeId,
    campus: r.unidade.nome,
    instituicaoSigla: r.unidade.instituicao.sigla,
    valorRecebido: Number(r.valorRecebido),
    observacao: r.observacao,
    registradoPorNome: r.registradoPor.nome,
    atualizadoEm: r.atualizadoEm.toISOString(),
  }));

  return (
    <main className={`mx-auto flex ${TABLE_MAX_WIDTH} flex-col gap-6 px-6 py-12 lg:px-12`}>
      <AdminHeader usuario={usuario} atual="/admin/valores-recebidos" />

      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">Valores recebidos</h1>
        <p className="text-neutral-600 dark:text-neutral-400">
          O que a matriz da MDO gera para um câmpus (coluna &quot;Gerado pela matriz&quot; na Consulta) é o
          valor de referência, mas nem sempre é o que o Tesouro efetivamente deposita: contingenciamento,
          emenda parlamentar e outras decisões orçamentárias podem mudar o valor real, sem passar pela
          matriz. Informe aqui o valor de fato recebido por câmpus e ano; ele passa a aparecer ao lado do
          gerado na Consulta, sem apagar nem ser apagado pela carga da MDO.
        </p>
      </div>

      <ValoresRecebidosPainel
        ano={ano}
        anosDisponiveis={anosDisponiveis.map((a) => a.ano)}
        instituicoes={instituicoes}
        registros={registrosLinhas}
      />
    </main>
  );
}
