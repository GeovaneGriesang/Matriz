import { prisma } from "@/server/db/prisma";
import { TABLE_MAX_WIDTH } from "@/lib/layoutWidths";
import { PainelProcedencia } from "@/components/Procedencia";

export const dynamic = "force-dynamic";

const reais = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const doisDecimais = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const DESTAQUE = "IFSUL";

interface Linha {
  sigla: string;
  nome: string;
  a: number;
  b: number;
  variacao: number;
  participacaoA: number | null;
  participacaoB: number | null;
  posicaoB: number | null;
}

export default async function ComparativoPage({
  searchParams,
}: {
  searchParams: Promise<{ bloco?: string }>;
}) {
  const params = await searchParams;
  const bloco = (["matriculas", "iqe", "ae", "totalSpo"] as const).includes(params.bloco as never)
    ? (params.bloco as "matriculas" | "iqe" | "ae" | "totalSpo")
    : "totalSpo";

  const registros = await prisma.comparativoInstitucional.findMany({
    include: { instituicao: { select: { sigla: true, nome: true } } },
    orderBy: { ano: "asc" },
  });

  if (registros.length === 0) {
    return (
      <main className={`mx-auto ${TABLE_MAX_WIDTH} px-6 py-16 lg:px-12`}>
        <h1 className="text-2xl font-semibold">Comparativo entre ciclos</h1>
        <p className="mt-3 text-neutral-600 dark:text-neutral-400">
          Depende dos relatórios da pasta &quot;03 - Indicadores&quot; da MDO, que ainda não foram carregados.
        </p>
      </main>
    );
  }

  const anos = Array.from(new Set(registros.map((r) => r.ano))).sort();
  const anoA = anos[0]!;
  const anoB = anos[anos.length - 1]!;

  const porSigla = new Map<string, { nome: string; [ano: number]: (typeof registros)[number] }>();
  for (const r of registros) {
    const atual = porSigla.get(r.instituicao.sigla) ?? { nome: r.instituicao.nome };
    atual[r.ano] = r;
    porSigla.set(r.instituicao.sigla, atual);
  }

  const linhas: Linha[] = Array.from(porSigla.entries())
    .map(([sigla, d]) => {
      const ra = d[anoA];
      const rb = d[anoB];
      const a = Number(ra?.[bloco] ?? 0);
      const b = Number(rb?.[bloco] ?? 0);
      return {
        sigla,
        nome: d.nome,
        a,
        b,
        variacao: a > 0 ? (b / a - 1) * 100 : Number.NaN,
        participacaoA: ra?.participacaoPercentual ? Number(ra.participacaoPercentual) : null,
        participacaoB: rb?.participacaoPercentual ? Number(rb.participacaoPercentual) : null,
        posicaoB: rb?.posicaoRede ?? null,
      };
    })
    .sort((x, y) => y.b - x.b);

  const totalA = linhas.reduce((s, l) => s + l.a, 0);
  const totalB = linhas.reduce((s, l) => s + l.b, 0);
  const variacaoRede = totalA > 0 ? (totalB / totalA - 1) * 100 : 0;
  const destaque = linhas.find((l) => l.sigla === DESTAQUE);

  const fonte = await prisma.fonteDados.findFirst({
    where: { cicloOrcamento: anoB, arquivo: { contains: "comparativo" } },
    orderBy: { carregadoEm: "desc" },
  });

  const BLOCOS = [
    { chave: "totalSpo", rotulo: "Total" },
    { chave: "matriculas", rotulo: "Funcionamento" },
    { chave: "iqe", rotulo: "Qualidade e Eficiência" },
    { chave: "ae", rotulo: "Assistência Estudantil" },
  ] as const;

  return (
    <main className={`mx-auto flex ${TABLE_MAX_WIDTH} flex-col gap-6 px-6 py-12 lg:px-12`}>
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">
          Comparativo {anoA} e {anoB}
        </h1>
        <p className="max-w-3xl text-neutral-600 dark:text-neutral-400">
          Quanto cada instituição recebeu em cada ciclo, e o que mudou entre eles. É a pergunta que a
          MDO não responde numa tela só, porque lá cada ciclo se consulta separado.
        </p>
        <p className="max-w-3xl text-sm text-neutral-500 dark:text-neutral-400">
          Só o nível de instituição. O relatório que desce a câmpus tem valores atribuídos à unidade
          errada (no IFSul, o Câmpus Pelotas aparece com o valor do Pelotas Visconde da Graça), então
          ele não foi carregado.
        </p>
      </div>

      <div className="flex flex-wrap gap-1">
        {BLOCOS.map((b) => (
          <a
            key={b.chave}
            href={`/comparativo?bloco=${b.chave}`}
            className={`rounded px-3 py-1.5 text-sm font-medium ${
              b.chave === bloco
                ? "bg-if-green text-white"
                : "border border-neutral-300 text-neutral-700 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
            }`}
          >
            {b.rotulo}
          </a>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Cartao rotulo={`Rede em ${anoA}`} valor={reais.format(totalA)} />
        <Cartao rotulo={`Rede em ${anoB}`} valor={reais.format(totalB)} />
        <Cartao
          rotulo="Variação da rede"
          valor={`${variacaoRede >= 0 ? "+" : ""}${doisDecimais.format(variacaoRede)}%`}
          destaque={variacaoRede >= 0 ? "text-if-green" : "text-if-red dark:text-red-400"}
        />
        {destaque && (
          <Cartao
            rotulo={`Variação do ${DESTAQUE}`}
            valor={`${destaque.variacao >= 0 ? "+" : ""}${doisDecimais.format(destaque.variacao)}%`}
            destaque={destaque.variacao >= variacaoRede ? "text-if-green" : "text-if-red dark:text-red-400"}
            nota={
              destaque.variacao >= variacaoRede
                ? "acima da variação da rede"
                : "abaixo da variação da rede"
            }
          />
        )}
      </div>

      <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-left dark:bg-neutral-900">
            <tr>
              <th className="px-4 py-2.5 font-medium text-neutral-600 dark:text-neutral-400">Instituição</th>
              <th className="px-4 py-2.5 text-right font-medium text-neutral-600 dark:text-neutral-400">{anoA}</th>
              <th className="px-4 py-2.5 text-right font-medium text-neutral-600 dark:text-neutral-400">{anoB}</th>
              <th className="px-4 py-2.5 text-right font-medium text-neutral-600 dark:text-neutral-400">Variação</th>
              <th className="px-4 py-2.5 text-right font-medium text-neutral-600 dark:text-neutral-400">
                Fatia {anoB}
              </th>
              <th className="px-4 py-2.5 text-right font-medium text-neutral-600 dark:text-neutral-400">Posição</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((l) => {
              const novo = l.a === 0 && l.b > 0;
              return (
                <tr
                  key={l.sigla}
                  className={`border-t border-neutral-200 dark:border-neutral-800 ${
                    l.sigla === DESTAQUE ? "bg-if-green/5 font-medium" : ""
                  }`}
                >
                  <td className="px-4 py-2.5">
                    <span className="font-medium">{l.sigla}</span>
                    <span className="ml-2 text-xs text-neutral-500">{l.nome}</span>
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-neutral-600 dark:text-neutral-400">
                    {novo ? "—" : reais.format(l.a)}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{reais.format(l.b)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {novo ? (
                      <span className="text-xs text-neutral-500">novo no ciclo</span>
                    ) : (
                      <span className={l.variacao >= variacaoRede ? "text-if-green" : "text-if-red dark:text-red-400"}>
                        {l.variacao >= 0 ? "+" : ""}
                        {doisDecimais.format(l.variacao)}%
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-neutral-600 dark:text-neutral-400">
                    {l.participacaoB !== null ? `${doisDecimais.format(l.participacaoB)}%` : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-neutral-600 dark:text-neutral-400">
                    {l.posicaoB ?? "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-neutral-300 bg-neutral-50 font-semibold dark:border-neutral-700 dark:bg-neutral-900">
              <td className="px-4 py-2.5">Rede, {linhas.length} instituições</td>
              <td className="px-4 py-2.5 text-right tabular-nums">{reais.format(totalA)}</td>
              <td className="px-4 py-2.5 text-right tabular-nums">{reais.format(totalB)}</td>
              <td className="px-4 py-2.5 text-right tabular-nums">
                {variacaoRede >= 0 ? "+" : ""}
                {doisDecimais.format(variacaoRede)}%
              </td>
              <td className="px-4 py-2.5" />
              <td className="px-4 py-2.5" />
            </tr>
          </tfoot>
        </table>
      </div>

      <p className="text-sm text-neutral-500 dark:text-neutral-400">
        A cor da variação compara cada instituição com a variação da rede, não com zero: crescer menos
        que a rede significa perder fatia, mesmo com o valor em reais subindo.
      </p>

      {fonte && <PainelProcedencia fonte={fonte} />}
    </main>
  );
}

function Cartao({ rotulo, valor, destaque, nota }: { rotulo: string; valor: string; destaque?: string; nota?: string }) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
      <div className="text-xs font-medium uppercase tracking-wide text-neutral-500">{rotulo}</div>
      <div className={`mt-1 text-2xl font-semibold tabular-nums ${destaque ?? "text-neutral-900 dark:text-neutral-100"}`}>
        {valor}
      </div>
      {nota && <div className="mt-0.5 text-xs text-neutral-500">{nota}</div>}
    </div>
  );
}
