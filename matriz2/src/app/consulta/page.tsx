import Link from "next/link";
import { prisma } from "@/server/db/prisma";
import { TABLE_MAX_WIDTH } from "@/lib/layoutWidths";
import { PainelProcedencia } from "@/components/Procedencia";
import { SeletorInstituicao } from "@/components/SeletorInstituicao";
import { ConsultaTabelaCampus } from "./ConsultaTabelaCampus";
import { ConsultaTabelaCursos } from "./ConsultaTabelaCursos";
import { carregarCursosDoCampus } from "@/server/queries/cursosCampus";
import { carregarTaxasFuncionamento, calcularFuncionamentoCampus } from "@/server/queries/funcionamentoCampus";
import { ConsultaTabelaInstituicoes } from "./ConsultaTabelaInstituicoes";
import { requireAcessoPlenoOrRedirect } from "@/server/auth/session";

export const dynamic = "force-dynamic";

const reais = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const numero = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });

interface Busca {
  ano?: string;
  instituicao?: string;
  campus?: string;
}

export default async function ConsultaPage({ searchParams }: { searchParams: Promise<Busca> }) {
  await requireAcessoPlenoOrRedirect("/consulta");
  const params = await searchParams;
  const ano = Number(params.ano) || 2027;
  const modoMacro = !params.instituicao;
  const siglaEscolhida = params.instituicao ?? "IFSUL";
  const campusEscolhido = params.campus ? Number(params.campus) : null;

  // Ciclos disponíveis: união da 6ª fase (por curso) com a 5ª (por câmpus), porque um
  // ciclo pode ter só a 5ª (caso de 2026, sem Participação Orçamentária ainda) e ainda
  // assim ter Funcionamento por câmpus para mostrar.
  const [anosCiclo, anosCampus, instituicoes] = await Promise.all([
    prisma.distribuicaoCiclo.findMany({ distinct: ["ano"], select: { ano: true } }),
    prisma.distribuicaoCampus.findMany({ distinct: ["ano"], select: { ano: true } }),
    prisma.instituicao.findMany({ orderBy: { sigla: "asc" }, select: { id: true, sigla: true, nome: true } }),
  ]);
  const anosDisponiveis = Array.from(new Set([...anosCiclo, ...anosCampus].map((a) => a.ano)))
    .sort((a, b) => b - a)
    .map((ano) => ({ ano }));

  if (instituicoes.length === 0) {
    return (
      <main className={`mx-auto ${TABLE_MAX_WIDTH} px-6 py-16 lg:px-12`}>
        <h1 className="text-2xl font-semibold">Consulta</h1>
        <p className="mt-3 text-neutral-600 dark:text-neutral-400">
          Ainda não há dados carregados. Rode <code className="rounded bg-neutral-100 px-1 dark:bg-neutral-800">npm run carregar -- 2027</code>{" "}
          para trazer o ciclo 2027 das exportações da MDO.
        </p>
      </main>
    );
  }

  // Visão macro (rede inteira): uma linha por instituição, sem exigir escolher uma
  // primeiro. É a porta de entrada: clicar numa instituição leva ao detalhamento
  // por câmpus abaixo.
  if (modoMacro) {
    const [porCampusRede, distribuicaoCampusRede] = await Promise.all([
      prisma.distribuicaoCiclo.groupBy({
        by: ["unidadeId"],
        where: { ano },
        _sum: { valorReais: true, perdaEvasaoReais: true, matriculaTotal: true },
      }),
      // `vlMatrFinal` (5ª fase, já com o Piso Mínimo aplicado) em vez da soma dos
      // cursos (6ª fase): a 6ª fase traz a participação de cada curso ANTES do piso, e
      // para os câmpus elegíveis a soma fica bem abaixo do que o câmpus de fato
      // recebe. Além disso, um ciclo pode não ter 6ª fase nenhuma (2026): por isso a
      // lista de câmpus é a UNIÃO das duas fontes, não só quem tem curso.
      prisma.distribuicaoCampus.findMany({
        where: { ano },
        select: { unidadeId: true, vlMatrFinal: true },
      }),
    ]);
    const unidadesRede = await prisma.unidade.findMany({ select: { id: true, instituicaoId: true } });
    const instituicaoPorUnidade = new Map(unidadesRede.map((u) => [u.id, u.instituicaoId]));

    const somaCicloPorId = new Map(porCampusRede.map((c) => [c.unidadeId, c._sum]));
    const vlMatrFinalPorId = new Map(
      distribuicaoCampusRede.map((d) => [d.unidadeId, d.vlMatrFinal !== null ? Number(d.vlMatrFinal) : null]),
    );
    const idsCampusRede = new Set<number>([
      ...porCampusRede.map((c) => c.unidadeId),
      ...distribuicaoCampusRede.map((d) => d.unidadeId),
    ]);
    const semSextaFase = porCampusRede.length === 0 && distribuicaoCampusRede.length > 0;

    const recebidosRede = await prisma.valorRecebidoCampus.findMany({
      where: { ano },
      select: { unidadeId: true, valorRecebido: true },
    });

    const acumulado = new Map<
      number,
      { campus: number; valor: number; perda: number; matricula: number; recebidoReal: number; campusComRecebido: number }
    >();
    for (const unidadeId of idsCampusRede) {
      const instId = instituicaoPorUnidade.get(unidadeId);
      if (instId === undefined) continue;
      const a = acumulado.get(instId) ?? { campus: 0, valor: 0, perda: 0, matricula: 0, recebidoReal: 0, campusComRecebido: 0 };
      a.campus += 1;
      const somaCiclo = somaCicloPorId.get(unidadeId);
      a.valor += vlMatrFinalPorId.get(unidadeId) ?? Number(somaCiclo?.valorReais ?? 0);
      a.perda += Number(somaCiclo?.perdaEvasaoReais ?? 0);
      a.matricula += Number(somaCiclo?.matriculaTotal ?? 0);
      acumulado.set(instId, a);
    }
    for (const r of recebidosRede) {
      const instId = instituicaoPorUnidade.get(r.unidadeId);
      if (instId === undefined) continue;
      const a = acumulado.get(instId);
      if (!a) continue;
      a.recebidoReal += Number(r.valorRecebido);
      a.campusComRecebido += 1;
    }

    const linhasInstituicoes = instituicoes
      .map((i) => {
        const a = acumulado.get(i.id) ?? { campus: 0, valor: 0, perda: 0, matricula: 0, recebidoReal: 0, campusComRecebido: 0 };
        return {
          sigla: i.sigla,
          nome: i.nome,
          campus: a.campus,
          valor: a.valor,
          perda: a.perda,
          matricula: a.matricula,
          recebidoReal: a.campusComRecebido > 0 ? a.recebidoReal : null,
          campusComRecebido: a.campusComRecebido,
        };
      })
      .filter((l) => l.campus > 0)
      .sort((a, b) => b.valor - a.valor);

    const totalRede = linhasInstituicoes.reduce((s, l) => s + l.valor, 0);

    return (
      <main className={`mx-auto flex ${TABLE_MAX_WIDTH} flex-col gap-6 px-6 py-12 lg:px-12`}>
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">Consulta</h1>
          <p className="max-w-3xl text-neutral-600 dark:text-neutral-400">
            Quanto cada instituição recebe no bloco{" "}
            <Link href="/como-funciona#funcionamento" className="underline">
              Funcionamento
            </Link>{" "}
            da Matriz de Distribuição Orçamentária (cerca de 80% do total; não inclui Qualidade e
            Eficiência, Reitorias nem Assistência, que não são valores por câmpus). Clique numa
            instituição para descer a câmpus e, dentro de um câmpus, a curso. &quot;Gerado pela
            matriz&quot; é o valor homologado pela MDO; &quot;Recebido&quot; é o que foi de fato
            informado em{" "}
            <Link href="/admin/valores-recebidos" className="underline">
              Valores recebidos
            </Link>{" "}
            e pode ser diferente, porque contingenciamento e outras decisões orçamentárias não passam pela
            matriz. Para comparar cursos de câmpus diferentes lado a lado, veja{" "}
            <Link href={`/consulta/comparar?ano=${ano}`} className="underline">
              Comparar entre câmpus
            </Link>
            .
          </p>
        </div>

        <div className="flex gap-1">
          {anosDisponiveis.map((a) => (
            <Link
              key={a.ano}
              href={`/consulta?ano=${a.ano}`}
              className={`rounded px-3 py-1.5 text-sm font-medium ${
                a.ano === ano
                  ? "bg-if-green text-white"
                  : "border border-neutral-300 text-neutral-700 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
              }`}
            >
              {a.ano}
            </Link>
          ))}
        </div>

        {semSextaFase && (
          <p className="max-w-3xl rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
            O ciclo {ano} ainda não tem a 6ª fase da MDO (participação por curso): sem ela, não há
            detalhamento por curso nem perda por evasão. Os valores abaixo vêm da 5ª fase (Funcionamento
            por câmpus).
          </p>
        )}

        {linhasInstituicoes.length === 0 ? (
          <p className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
            Nenhuma instituição com dado de Funcionamento (5ª ou 6ª fase) neste ciclo ainda.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
            <ConsultaTabelaInstituicoes linhas={linhasInstituicoes} ano={ano} totalRede={totalRede} />
          </div>
        )}
      </main>
    );
  }

  const instituicao = instituicoes.find((i) => i.sigla === siglaEscolhida) ?? instituicoes[0]!;

  // Totais por câmpus da instituição escolhida. A lista de câmpus é a UNIÃO da 6ª fase
  // (`DistribuicaoCiclo`, por curso) com a 5ª (`DistribuicaoCampus`, por câmpus): um
  // ciclo pode não ter 6ª fase nenhuma (2026, sem Participação Orçamentária ainda) e
  // mesmo assim ter Funcionamento por câmpus para mostrar.
  const [porCampus, distribuicaoCampus] = await Promise.all([
    prisma.distribuicaoCiclo.groupBy({
      by: ["unidadeId"],
      where: { ano, unidade: { instituicaoId: instituicao.id } },
      _count: { _all: true },
      _sum: { valorReais: true, perdaEvasaoReais: true, matriculaTotal: true },
    }),
    // `vlMatrFinal` (5ª fase, já com o Piso Mínimo aplicado) em vez da soma dos
    // cursos (6ª fase): a 6ª fase traz a participação de cada curso ANTES do piso, e
    // para os câmpus elegíveis a soma fica bem abaixo do que o câmpus de fato recebe
    // (o piso substitui, não soma, ver comentário de `CicloOrcamento`). Confirmado
    // comparando com `vlMatrFinal`: um câmpus elegível chegou a mostrar R$ 72 mil
    // somando os cursos contra R$ 700 mil reais.
    prisma.distribuicaoCampus.findMany({
      where: { ano, unidade: { instituicaoId: instituicao.id } },
      select: {
        unidadeId: true, vlMatrFinal: true, elegivelPiso: true,
        mtPresencial: true, mtEad: true, mtEadMooc: true, mtEadFp: true,
      },
    }),
  ]);

  const somaCicloPorId = new Map(porCampus.map((c) => [c.unidadeId, c]));
  const idsCampus = Array.from(
    new Set([...porCampus.map((c) => c.unidadeId), ...distribuicaoCampus.map((d) => d.unidadeId)]),
  );
  const semSextaFaseInstituicao = porCampus.length === 0 && distribuicaoCampus.length > 0;

  const unidades = await prisma.unidade.findMany({
    where: { id: { in: idsCampus } },
    select: { id: true, nome: true },
  });
  const nomePorId = new Map(unidades.map((u) => [u.id, u.nome]));

  const recebidos = await prisma.valorRecebidoCampus.findMany({
    where: { ano, unidadeId: { in: idsCampus } },
    select: { unidadeId: true, valorRecebido: true, observacao: true },
  });
  const recebidoPorId = new Map(recebidos.map((r) => [r.unidadeId, Number(r.valorRecebido)]));

  const vlMatrFinalPorId = new Map(
    distribuicaoCampus.map((d) => [d.unidadeId, d.vlMatrFinal !== null ? Number(d.vlMatrFinal) : null]),
  );

  // Funcionamento calculado: refeito a partir da matrícula equalizada por modalidade
  // e das taxas oficiais (DADOS BASE), não copiado de `vlMatrFinal`. Só existe quando
  // o ciclo tem essas taxas (não em 2026, que saiu sem o valor final por matrícula).
  const taxasFuncionamento = await carregarTaxasFuncionamento(ano);
  const funcionamentoPorId = new Map(
    taxasFuncionamento
      ? distribuicaoCampus.map((d) => [
          d.unidadeId,
          calcularFuncionamentoCampus(taxasFuncionamento, {
            mtPresencial: Number(d.mtPresencial ?? 0),
            mtEad: Number(d.mtEad ?? 0),
            mtEadMooc: Number(d.mtEadMooc ?? 0),
            mtEadFp: Number(d.mtEadFp ?? 0),
            elegivelPiso: d.elegivelPiso,
          }),
        ])
      : [],
  );

  const linhas = idsCampus
    .map((unidadeId) => {
      const c = somaCicloPorId.get(unidadeId);
      return {
        unidadeId,
        nome: nomePorId.get(unidadeId) ?? `Unidade ${unidadeId}`,
        ciclos: c?._count._all ?? 0,
        valor: vlMatrFinalPorId.get(unidadeId) ?? Number(c?._sum.valorReais ?? 0),
        perda: Number(c?._sum.perdaEvasaoReais ?? 0),
        matricula: Number(c?._sum.matriculaTotal ?? 0),
        recebidoReal: recebidoPorId.get(unidadeId) ?? null,
        funcionamentoCalculado: funcionamentoPorId.get(unidadeId) ?? null,
      };
    })
    .sort((a, b) => b.valor - a.valor);

  const total = linhas.reduce(
    (acc, l) => ({
      ciclos: acc.ciclos + l.ciclos,
      valor: acc.valor + l.valor,
      perda: acc.perda + l.perda,
      matricula: acc.matricula + l.matricula,
      recebidoReal: acc.recebidoReal + (l.recebidoReal ?? 0),
      campusComRecebido: acc.campusComRecebido + (l.recebidoReal !== null ? 1 : 0),
      funcionamentoCalculado: acc.funcionamentoCalculado + (l.funcionamentoCalculado ?? 0),
      campusComFuncionamento: acc.campusComFuncionamento + (l.funcionamentoCalculado !== null ? 1 : 0),
    }),
    { ciclos: 0, valor: 0, perda: 0, matricula: 0, recebidoReal: 0, campusComRecebido: 0, funcionamentoCalculado: 0, campusComFuncionamento: 0 },
  );

  // Rede inteira, para situar a participação da instituição. `vlMatrFinal` (5ª fase,
  // já com o Piso Mínimo aplicado), pelo mesmo motivo do `valor` de cada câmpus acima.
  const rede = await prisma.distribuicaoCampus.aggregate({ where: { ano }, _sum: { vlMatrFinal: true } });
  const totalRede = Number(rede._sum.vlMatrFinal ?? 0);

  // Detalhe por ciclo de curso, quando um câmpus está selecionado.
  const cursos = campusEscolhido ? await carregarCursosDoCampus(ano, campusEscolhido) : [];
  const cursoDestaque = cursos[0] ?? null;

  const fonte = await prisma.fonteDados.findFirst({
    where: { cicloOrcamento: ano, fase: "F6_PARTICIPACAO" },
    orderBy: { carregadoEm: "desc" },
  });

  function href(mudanca: Partial<Busca>) {
    const q = new URLSearchParams({
      ano: String(ano),
      instituicao: siglaEscolhida,
      ...(campusEscolhido ? { campus: String(campusEscolhido) } : {}),
      ...Object.fromEntries(Object.entries(mudanca).filter(([, v]) => v !== undefined)),
    } as Record<string, string>);
    return `/consulta?${q.toString()}`;
  }

  return (
    <main className={`mx-auto flex ${TABLE_MAX_WIDTH} flex-col gap-6 px-6 py-12 lg:px-12`}>
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <Link href={`/consulta?ano=${ano}`} className="text-sm text-neutral-500 underline hover:text-neutral-800 dark:hover:text-neutral-200">
            ← todas as instituições
          </Link>
        </div>
        <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">Consulta</h1>
        <p className="max-w-3xl text-neutral-600 dark:text-neutral-400">
          Quanto cada câmpus recebe da Matriz de Distribuição Orçamentária, e de quais cursos esse
          valor vem. &quot;Gerado pela matriz&quot; é o bloco{" "}
          <Link href="/como-funciona#funcionamento" className="underline">
            Funcionamento
          </Link>{" "}
          (cerca de 80% do total, já com o Piso Mínimo aplicado), homologado pela MDO; não inclui
          Qualidade e Eficiência, Reitorias nem Assistência, que não são valores por câmpus. A coluna
          &quot;Funcionamento calculado&quot; refaz esse mesmo bloco a partir da matrícula equalizada por
          modalidade e das taxas oficiais, para conferência: as duas colunas devem ficar bem próximas, e
          uma diferença grande é sinal de algo errado, na fórmula ou nos dados. &quot;Recebido&quot; é
          diferente dos dois: é o que foi de fato depositado, informado à mão em{" "}
          <Link href="/admin/valores-recebidos" className="underline">
            Valores recebidos
          </Link>
          , porque contingenciamento e outras decisões orçamentárias podem mudar o valor real sem passar
          pela matriz.
        </p>
        {semSextaFaseInstituicao && (
          <p className="max-w-3xl rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
            O ciclo {ano} ainda não tem a 6ª fase da MDO (participação por curso): sem ela, não há
            detalhamento por curso nem perda por evasão para {instituicao.sigla}. Os valores abaixo vêm
            da 5ª fase (Funcionamento por câmpus).
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-end gap-4 rounded-lg border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">Ciclo</span>
          <div className="flex gap-1">
            {anosDisponiveis.map((a) => (
              <Link
                key={a.ano}
                href={href({ ano: String(a.ano), campus: undefined })}
                className={`rounded px-3 py-1.5 text-sm font-medium ${
                  a.ano === ano
                    ? "bg-if-green text-white"
                    : "border border-neutral-300 text-neutral-700 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
                }`}
              >
                {a.ano}
              </Link>
            ))}
          </div>
        </div>
        <div className="flex min-w-64 flex-1 flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">Instituição</span>
          <SeletorInstituicao
            instituicoes={instituicoes}
            siglaEscolhida={siglaEscolhida}
            urlPorSigla={Object.fromEntries(
              instituicoes.map((i) => [i.sigla, href({ instituicao: i.sigla, campus: undefined })]),
            )}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
        <Cartao rotulo="Gerado pela matriz" valor={reais.format(total.valor)} />
        <Cartao
          rotulo="Recebido (real)"
          valor={total.campusComRecebido > 0 ? reais.format(total.recebidoReal) : "não informado"}
        />
        <Cartao
          rotulo="Funcionamento calculado"
          valor={total.campusComFuncionamento > 0 ? reais.format(total.funcionamentoCalculado) : "não informado"}
        />
        <Cartao
          rotulo="Participação na rede"
          valor={totalRede > 0 ? `${decimal.format((total.valor / totalRede) * 100)}%` : "não informado"}
        />
        <Cartao rotulo="Matrícula total" valor={numero.format(total.matricula)} />
        <Cartao
          rotulo="Perda por evasão"
          valor={reais.format(total.perda)}
          destaque="text-if-red dark:text-red-400"
        />
      </div>

      <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
        <ConsultaTabelaCampus
          linhas={linhas}
          campusEscolhido={campusEscolhido}
          ano={ano}
          sigla={siglaEscolhida}
          instituicaoSigla={instituicao.sigla}
          totalCiclos={total.ciclos}
          totalValor={total.valor}
          totalPerda={total.perda}
          totalMatricula={total.matricula}
          totalRecebidoReal={total.campusComRecebido > 0 ? total.recebidoReal : null}
          totalFuncionamentoCalculado={total.campusComFuncionamento > 0 ? total.funcionamentoCalculado : null}
        />
      </div>

      {campusEscolhido && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
              {nomePorId.get(campusEscolhido)}, por ciclo de curso
            </h2>
            <Link href={href({ campus: undefined })} className="text-sm text-neutral-500 underline hover:text-neutral-800 dark:hover:text-neutral-200">
              limpar seleção
            </Link>
          </div>
          {cursoDestaque && (
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              O curso com maior participação no orçamento é <strong className="text-neutral-900 dark:text-neutral-100">{cursoDestaque.curso}</strong>,
              com aproximadamente <strong className="text-neutral-900 dark:text-neutral-100">{reais.format(cursoDestaque.valor)}</strong>.
              Marque as caixas da coluna &quot;Comparar&quot; para ver dois ou mais cursos lado a lado.
            </p>
          )}
          {cursos.length === 0 ? (
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              Sem detalhamento por curso: o ciclo {ano} não tem a 6ª fase da MDO (participação por
              curso) carregada.
            </p>
          ) : (
            <div className="max-h-[32rem] overflow-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
              <ConsultaTabelaCursos cursos={cursos} ano={ano} unidadeId={campusEscolhido} />
            </div>
          )}
        </div>
      )}

      {fonte && <PainelProcedencia fonte={fonte} />}
    </main>
  );
}

function Cartao({ rotulo, valor, destaque }: { rotulo: string; valor: string; destaque?: string }) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
      <div className="text-xs font-medium uppercase tracking-wide text-neutral-500">{rotulo}</div>
      <div className={`mt-1 text-2xl font-semibold tabular-nums ${destaque ?? "text-neutral-900 dark:text-neutral-100"}`}>
        {valor}
      </div>
    </div>
  );
}
