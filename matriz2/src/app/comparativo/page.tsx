import Link from "next/link";
import { prisma } from "@/server/db/prisma";
import { TABLE_MAX_WIDTH } from "@/lib/layoutWidths";
import { PainelProcedencia } from "@/components/Procedencia";
import { ComparativoTabela } from "./ComparativoTabela";
import { ComparativoTabelaCampus } from "./ComparativoTabelaCampus";
import { requireAcessoPlenoOrRedirect } from "@/server/auth/session";

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

interface LinhaCampus {
  unidadeId: number;
  nome: string;
  a: number;
  b: number;
  variacao: number;
}

export default async function ComparativoPage({
  searchParams,
}: {
  searchParams: Promise<{ bloco?: string; instituicao?: string }>;
}) {
  await requireAcessoPlenoOrRedirect("/comparativo");
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

  // Detalhe por câmpus, só quando uma instituição é escolhida. Usa `DistribuicaoCampus`
  // (a mesma fonte que a Consulta passou a usar), NÃO o relatório de comparativo que
  // desce a câmpus: esse relatório troca o valor entre câmpus "irmãos" de nome
  // parecido (ver comentário de `ComparativoInstitucional` no schema), então nunca
  // foi carregado. `vlMatrFinal` (5ª fase, já com o Piso Mínimo aplicado), não a soma
  // dos cursos da 6ª fase: essa soma vem ANTES do piso, e para um câmpus elegível fica
  // bem abaixo do que ele de fato recebe (confirmado em produção: R$ 72 mil somando
  // os cursos contra R$ 700 mil reais). Por vir de outra fonte, o Total por câmpus
  // pode não bater ao centavo com o Total da instituição acima.
  let linhasCampus: LinhaCampus[] = [];
  let instituicaoEscolhida: { sigla: string; nome: string } | null = null;
  if (params.instituicao) {
    const instituicao = await prisma.instituicao.findUnique({ where: { sigla: params.instituicao } });
    if (instituicao) {
      instituicaoEscolhida = { sigla: instituicao.sigla, nome: instituicao.nome };
      const [porCampusA, porCampusB] = await Promise.all([
        prisma.distribuicaoCampus.findMany({
          where: { ano: anoA, unidade: { instituicaoId: instituicao.id } },
          select: { unidadeId: true, vlMatrFinal: true },
        }),
        prisma.distribuicaoCampus.findMany({
          where: { ano: anoB, unidade: { instituicaoId: instituicao.id } },
          select: { unidadeId: true, vlMatrFinal: true },
        }),
      ]);
      const unidadeIds = Array.from(new Set([...porCampusA, ...porCampusB].map((c) => c.unidadeId)));
      const unidades = await prisma.unidade.findMany({
        where: { id: { in: unidadeIds } },
        select: { id: true, nome: true },
      });
      const nomePorId = new Map(unidades.map((u) => [u.id, u.nome]));
      const aPorId = new Map(porCampusA.map((c) => [c.unidadeId, Number(c.vlMatrFinal ?? 0)]));
      const bPorId = new Map(porCampusB.map((c) => [c.unidadeId, Number(c.vlMatrFinal ?? 0)]));

      linhasCampus = unidadeIds
        .map((id) => {
          const a = aPorId.get(id) ?? 0;
          const b = bPorId.get(id) ?? 0;
          return {
            unidadeId: id,
            nome: nomePorId.get(id) ?? `Unidade ${id}`,
            a,
            b,
            variacao: a > 0 ? (b / a - 1) * 100 : Number.NaN,
          };
        })
        .sort((x, y) => y.b - x.b);
    }
  }

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
          Este bloco (Total, Funcionamento, Qualidade e Eficiência, Assistência) só existe por
          instituição: o relatório que abre por bloco e desce a câmpus tem valores atribuídos à unidade
          errada (no IFSul, o Câmpus Pelotas aparece com o valor do Pelotas Visconde da Graça), então
          ele não foi carregado. Clique numa instituição para ver o Total por câmpus, vindo de outra
          fonte (a mesma da Consulta).
        </p>
      </div>

      <div className="flex flex-wrap gap-1">
        {BLOCOS.map((b) => (
          <Link
            key={b.chave}
            href={`/comparativo?bloco=${b.chave}`}
            className={`rounded px-3 py-1.5 text-sm font-medium ${
              b.chave === bloco
                ? "bg-if-green text-white"
                : "border border-neutral-300 text-neutral-700 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
            }`}
          >
            {b.rotulo}
          </Link>
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
        <ComparativoTabela
          linhas={linhas}
          anoA={anoA}
          anoB={anoB}
          bloco={bloco}
          variacaoRede={variacaoRede}
          destaqueSigla={DESTAQUE}
          totalA={totalA}
          totalB={totalB}
        />
      </div>

      <p className="text-sm text-neutral-500 dark:text-neutral-400">
        A cor da variação compara cada instituição com a variação da rede, não com zero: crescer menos
        que a rede significa perder fatia, mesmo com o valor em reais subindo.
      </p>

      {instituicaoEscolhida && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
              {instituicaoEscolhida.sigla}, por câmpus, {anoA} e {anoB}
            </h2>
            <Link
              href={`/comparativo?bloco=${bloco}`}
              className="text-sm text-neutral-500 underline hover:text-neutral-800 dark:hover:text-neutral-200"
            >
              ← todas as instituições
            </Link>
          </div>
          {linhasCampus.length === 0 ? (
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              Nenhum câmpus com Funcionamento (5ª fase) carregado em {anoA} ou {anoB}.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
              <ComparativoTabelaCampus linhas={linhasCampus} anoA={anoA} anoB={anoB} />
            </div>
          )}
        </div>
      )}

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
