import { prisma } from "@/server/db/prisma";
import { TABLE_MAX_WIDTH } from "@/lib/layoutWidths";
import { EtiquetaProcedencia } from "@/components/Procedencia";
import { TabelaOrdenavel, type ColunaOrdenavel } from "@/components/TabelaOrdenavel";
import { requireAcessoPlenoOrRedirect } from "@/server/auth/session";

export const dynamic = "force-dynamic";

const numero = new Intl.NumberFormat("pt-BR");
const reais = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const dataHora = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });

const ROTULO_FASE: Record<string, string> = {
  F1A_OBTENCAO: "1ª fase, obtenção dos dados",
  F1B_IMPORTACAO: "1ª fase, importação",
  F2_CONFERENCIA_EXTRACAO: "2ª fase, conferência da extração",
  F3_PARAMETROS_CAMPUS: "3ª fase, parâmetros por câmpus",
  F4_CHECAGEM_MATRICULAS: "4ª fase, checagem de matrículas",
  F5_PROPOSTA: "5ª fase, geração da proposta",
  F6_PARTICIPACAO: "6ª fase, participação na distribuição",
};

const ROTULO_ABRANGENCIA: Record<string, string> = {
  REDE: "Rede completa",
  INSTITUICAO: "Uma instituição",
  CAMPUS: "Um câmpus",
};

export default async function DadosImportadosPage() {
  await requireAcessoPlenoOrRedirect("/dados-importados");
  const fontes = await prisma.fonteDados.findMany({
    orderBy: [{ cicloOrcamento: "desc" }, { carregadoEm: "desc" }],
    include: {
      instituicao: { select: { sigla: true } },
      _count: { select: { distribuicoesCiclo: true, distribuicoesCampus: true, distribuicoesInstituicao: true } },
    },
  });

  const somasPorFonte = await prisma.distribuicaoCiclo.groupBy({
    by: ["fonteDadosId"],
    _sum: { valorReais: true },
  });
  const somaPorFonte = new Map(somasPorFonte.map((s) => [s.fonteDadosId, Number(s._sum.valorReais ?? 0)]));

  return (
    <main className={`mx-auto flex ${TABLE_MAX_WIDTH} flex-col gap-6 px-6 py-12 lg:px-12`}>
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">Dados importados</h1>
        <p className="max-w-3xl text-neutral-600 dark:text-neutral-400">
          Tudo que alimenta este sistema, com a etapa da MDO que homologou cada conjunto, a data que
          o próprio arquivo declara e o que ele abrange. Nada aqui é digitado à mão.
        </p>
        <p className="max-w-3xl text-sm text-neutral-500 dark:text-neutral-400">
          A coluna <strong>Abrange</strong> merece atenção. Metade do material da MDO cobre apenas uma
          instituição; somar conjuntos de abrangências diferentes produz um total que parece de rede,
          mas não é.
        </p>
      </div>

      {fontes.length === 0 ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-5 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
          Nenhum arquivo carregado ainda.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
          <TabelaOrdenavel
            linhas={fontes}
            chaveLinha={(f) => f.id}
            colunas={
              [
                { chave: "ciclo", rotulo: "Ciclo", alinhamento: "right", valor: (f) => f.cicloOrcamento, render: (f) => <span className="font-medium">{f.cicloOrcamento}</span> },
                {
                  chave: "origem",
                  rotulo: "Origem",
                  valor: (f) => f.origem,
                  render: (f) => <EtiquetaProcedencia fonte={f} />,
                },
                {
                  chave: "etapa",
                  rotulo: "Etapa",
                  valor: (f) => (f.fase ? (ROTULO_FASE[f.fase] ?? f.fase) : ""),
                  render: (f) => <span className="text-neutral-600 dark:text-neutral-400">{f.fase ? ROTULO_FASE[f.fase] : "—"}</span>,
                },
                {
                  chave: "arquivo",
                  rotulo: "Arquivo",
                  valor: (f) => f.arquivo,
                  render: (f) => <span className="font-mono text-xs text-neutral-600 dark:text-neutral-400">{f.arquivo}</span>,
                },
                {
                  chave: "abrange",
                  rotulo: "Abrange",
                  valor: (f) => ROTULO_ABRANGENCIA[f.abrangencia] + (f.instituicao ? `, ${f.instituicao.sigla}` : ""),
                  render: (f) => (
                    <span className="text-neutral-600 dark:text-neutral-400">
                      {ROTULO_ABRANGENCIA[f.abrangencia]}
                      {f.instituicao && `, ${f.instituicao.sigla}`}
                    </span>
                  ),
                },
                {
                  chave: "registros",
                  rotulo: "Registros",
                  alinhamento: "right",
                  valor: (f) => f._count.distribuicoesCiclo + f._count.distribuicoesCampus + f._count.distribuicoesInstituicao,
                  render: (f) =>
                    numero.format(
                      f._count.distribuicoesCiclo + f._count.distribuicoesCampus + f._count.distribuicoesInstituicao,
                    ),
                },
                {
                  chave: "soma",
                  rotulo: "Soma",
                  alinhamento: "right",
                  valor: (f) => somaPorFonte.get(f.id) ?? null,
                  render: (f) => {
                    const soma = somaPorFonte.get(f.id);
                    return soma !== undefined ? reais.format(soma) : "—";
                  },
                },
                {
                  chave: "carregado",
                  rotulo: "Carregado",
                  valor: (f) => f.carregadoEm.getTime(),
                  render: (f) => <span className="text-neutral-600 dark:text-neutral-400">{dataHora.format(f.carregadoEm)}</span>,
                },
              ] satisfies ColunaOrdenavel<(typeof fontes)[number]>[]
            }
          />
        </div>
      )}

      {fontes.some((f) => f.ressalva) && (
        <div className="flex flex-col gap-2">
          <h2 className="font-semibold text-neutral-900 dark:text-neutral-100">Ressalvas</h2>
          {fontes
            .filter((f) => f.ressalva)
            .map((f) => (
              <p
                key={f.id}
                className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200"
              >
                <strong>
                  {f.cicloOrcamento}, {f.fase ? ROTULO_FASE[f.fase] : f.arquivo}.
                </strong>{" "}
                {f.ressalva}
              </p>
            ))}
        </div>
      )}
    </main>
  );
}
