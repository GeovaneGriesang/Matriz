import { destaqueNaFrente, ehInstituicaoDestaque } from "@/lib/destaque";
import Link from "next/link";
import { prisma } from "@/server/db/prisma";
import { TABLE_MAX_WIDTH, PROSE_LINK } from "@/lib/layoutWidths";
import { PainelProcedencia } from "@/components/Procedencia";
import { SeletorDeContexto } from "@/components/SeletorDeContexto";
import { ComoLerEstaTela } from "@/components/ComoLerEstaTela";
import { ConsultaTabelaCampus } from "./ConsultaTabelaCampus";
import { ConsultaTabelaCursos } from "./ConsultaTabelaCursos";
import { CICLO_QUE_CONTRIBUI, carregarCursosDoCampus } from "@/server/queries/cursosCampus";
import { rotuloDoCiclo } from "@/lib/identificacaoCiclo";
import { ConsultaTabelaInstituicoes } from "./ConsultaTabelaInstituicoes";
import { requireAcessoPlenoOrRedirect } from "@/server/auth/session";

export const dynamic = "force-dynamic";

const reais = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const numero = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

interface Busca {
  ano?: string;
  instituicao?: string;
  campus?: string;
}

export default async function ConsultaPage({ searchParams }: { searchParams: Promise<Busca> }) {
  await requireAcessoPlenoOrRedirect("/consulta");
  const params = await searchParams;
  const ano = Number(params.ano) || 2027;
  const siglaEscolhida = params.instituicao ?? "IFSUL";
  const campusEscolhido = params.campus ? Number(params.campus) : null;

  // Ciclos disponíveis: união da 6ª fase (por curso) com a 5ª (por câmpus), porque um
  // ciclo pode ter só a 5ª (caso de 2026, sem Participação Orçamentária ainda) e ainda
  // assim ter Funcionamento por câmpus para mostrar.
  const [anosCiclo, anosCampus, instituicoes] = await Promise.all([
    prisma.distribuicaoCiclo.findMany({ distinct: ["ano"], select: { ano: true } }),
    prisma.distribuicaoCampus.findMany({ distinct: ["ano"], select: { ano: true } }),
    prisma.instituicao.findMany({ orderBy: { sigla: "asc" }, select: { id: true, sigla: true, nome: true } }).then((l) => destaqueNaFrente(l, (i) => i.sigla)),
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
          para trazer a matriz de 2027 das exportações da MDO.
        </p>
      </main>
    );
  }

  // A rede inteira: uma linha por instituição, que abre os câmpus dela logo abaixo, pelo +.
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

  const somaDaRedePorId = new Map(porCampusRede.map((c) => [c.unidadeId, c._sum]));
  const vlDaRedePorId = new Map(
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
    const somaCiclo = somaDaRedePorId.get(unidadeId);
    a.valor += vlDaRedePorId.get(unidadeId) ?? Number(somaCiclo?.valorReais ?? 0);
    a.perda += Number(somaCiclo?.perdaEvasaoReais ?? 0);
    a.matricula += Number(somaCiclo?.matriculaTotal ?? 0);
    acumulado.set(instId, a);
  }
  for (const r of recebidosRede) {
    // Só câmpus com matriz: a Reitoria também tem valor informado, mas não entra no Funcionamento dos câmpus com que o Recebido se compara.
    if (!idsCampusRede.has(r.unidadeId)) continue;
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

  const totalDaRede = linhasInstituicoes.reduce((s, l) => s + l.valor, 0);

  const instituicao = instituicoes.find((i) => i.sigla === siglaEscolhida) ?? instituicoes[0]!;

  // Totais por câmpus da instituição escolhida. A lista de câmpus é a UNIÃO da 6ª fase
  // (`DistribuicaoCiclo`, por curso) com a 5ª (`DistribuicaoCampus`, por câmpus): um
  // ciclo pode não ter 6ª fase nenhuma (2026, sem Participação Orçamentária ainda) e
  // mesmo assim ter Funcionamento por câmpus para mostrar.
  const [porCampus, distribuicaoCampus] = await Promise.all([
    prisma.distribuicaoCiclo.groupBy({
      by: ["unidadeId"],
      where: { ano, ...CICLO_QUE_CONTRIBUI, unidade: { instituicaoId: instituicao.id } },
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
    }),
    { ciclos: 0, valor: 0, perda: 0, matricula: 0, recebidoReal: 0, campusComRecebido: 0 },
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

  // O valor recebido (informado) existe só para o IFSul.
  const ehIfsul = ehInstituicaoDestaque(instituicao.sigla);

  function href(mudanca: Partial<Busca>) {
    const q = new URLSearchParams({
      ano: String(ano),
      instituicao: siglaEscolhida,
      ...(campusEscolhido ? { campus: String(campusEscolhido) } : {}),
      ...Object.fromEntries(Object.entries(mudanca).filter(([, v]) => v !== undefined)),
    } as Record<string, string>);
    return `/consulta?${q.toString()}`;
  }

  const instituicaoAberta = params.instituicao && linhasInstituicoes.some((l) => l.sigla === params.instituicao) ? params.instituicao : null;
  const exemploDaRede = linhasInstituicoes.find((l) => ehInstituicaoDestaque(l.sigla)) ?? linhasInstituicoes[0];
  const detalheDaInstituicao = params.instituicao ? (
    <div className="flex w-0 min-w-full flex-col gap-4 rounded-md border-l-4 border-if-green bg-white p-4 font-normal dark:bg-neutral-950">
        {semSextaFaseInstituicao && (
          <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
            A matriz de {ano} ainda não tem a 6ª fase da MDO (participação por curso): sem ela, não há
            detalhamento por curso nem perda por evasão para {instituicao.sigla}. Os valores abaixo vêm
            da 5ª fase (Funcionamento por câmpus).
          </p>
        )}
      <div className={`grid gap-4 sm:grid-cols-2 ${ehIfsul ? "lg:grid-cols-5" : "lg:grid-cols-4"}`}>
        <Cartao rotulo="Gerado pela matriz" valor={reais.format(total.valor)} />
        {ehIfsul && (
          <Cartao
            rotulo="Recebido (real)"
            valor={total.campusComRecebido > 0 ? reais.format(total.recebidoReal) : "não informado"}
          />
        )}
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

      <p className="text-sm text-neutral-600 dark:text-neutral-400">Clique no <strong>+</strong> de um câmpus para abrir os cursos dele logo abaixo da linha, e no <strong>−</strong> para fechar.</p>

      <div className="tabela-rolavel rounded-lg border border-neutral-200 dark:border-neutral-800">
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
          comRecebido={ehIfsul}
          detalheDoCampus={
            campusEscolhido && (
              // w-0 min-w-full: o quadro fica da largura da tabela de câmpus, em vez de alargá-la; a tabela de cursos rola dentro dele.
              <div className="flex w-0 min-w-full flex-col gap-3 rounded-md border-l-4 border-if-green bg-white p-4 font-normal dark:bg-neutral-950">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
                    {nomePorId.get(campusEscolhido)}, por ciclo de curso
                  </h2>
                  <Link href={href({ campus: undefined })} className="text-sm text-neutral-500 underline hover:text-neutral-800 dark:hover:text-neutral-200">
                    fechar
                  </Link>
                </div>
                {cursoDestaque && (
                  <p className="text-sm text-neutral-600 dark:text-neutral-400">
                    A turma com maior participação no orçamento é <strong className="text-neutral-900 dark:text-neutral-100">{cursoDestaque.curso}</strong> ({rotuloDoCiclo(cursoDestaque)}),
                    com aproximadamente <strong className="text-neutral-900 dark:text-neutral-100">{reais.format(cursoDestaque.valor)}</strong>.
                    Marque as caixas da coluna &quot;Comparar&quot; para ver dois ou mais cursos lado a lado.
                  </p>
                )}
                {cursos.length > 0 && (
                  <p className="text-sm text-neutral-600 dark:text-neutral-400">
                    Aparecem só as turmas que contribuem para o orçamento de {ano}, ou seja, as que têm alunos no ano-base {ano - 2}. As demais não geram valor.
                  </p>
                )}
                {cursos.length === 0 ? (
                  <p className="text-sm text-neutral-500 dark:text-neutral-400">
                    {semSextaFaseInstituicao
                      ? `Sem detalhamento por curso: a matriz de ${ano} não tem a 6ª fase da MDO (participação por curso) carregada.`
                      : `Este câmpus não tem turmas que contribuam para o orçamento de ${ano} (nenhuma com alunos no ano-base ${ano - 2}), por isso não há cursos para mostrar. O valor dele está na linha acima.`}
                  </p>
                ) : (
                  <div className="tabela-rolavel isolate max-h-[60vh] rounded-lg border border-neutral-200 dark:border-neutral-800">
                    <ConsultaTabelaCursos cursos={cursos} ano={ano} unidadeId={campusEscolhido} />
                  </div>
                )}
              </div>
            )
          }
        />
      </div>

    </div>
  ) : null;

  return (
    <main className={`mx-auto flex ${TABLE_MAX_WIDTH} flex-col gap-6 px-6 py-12 lg:px-12`}>
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">Quanto recebemos?</h1>
        <p className="text-neutral-600 dark:text-neutral-400">
          Quanto cada instituição, câmpus e turma recebe no bloco Funcionamento da matriz de {ano}. Clique no <strong>+</strong> para abrir, e no <strong>−</strong> para fechar.
        </p>
      </div>

      <SeletorDeContexto
        anos={anosDisponiveis.map((a) => ({ ano: a.ano, href: `/consulta?ano=${a.ano}${params.instituicao ? `&instituicao=${encodeURIComponent(params.instituicao)}` : ""}` }))}
        anoEscolhido={ano}
        instituicao={{
          instituicoes,
          sigla: params.instituicao ?? "",
          opcaoVazia: "Escolha uma instituição para abrir",
          rolar: true,
          urlPorSigla: Object.fromEntries(instituicoes.map((i) => [i.sigla, `/consulta?ano=${ano}&instituicao=${encodeURIComponent(i.sigla)}#instituicao-${i.sigla}`])),
        }}
      />

      <ComoLerEstaTela>
        <p>
          O{" "}
          <Link href="/como-funciona#funcionamento" className={PROSE_LINK}>
            Funcionamento
          </Link>{" "}
          é cerca de 80% da matriz, já com o Piso Mínimo aplicado. Qualidade e Eficiência, Reitorias e Assistência Estudantil não entram aqui, porque não são valores por câmpus.
        </p>
        <p>
          &quot;Gerado pela matriz&quot; é o valor homologado pela MDO. &quot;Recebido&quot; existe só para o IFSul: é o que foi de fato depositado, informado em{" "}
          <Link href="/admin/valores-recebidos" className={PROSE_LINK}>
            Valores recebidos
          </Link>
          , e pode ser diferente porque contingenciamento e outras decisões orçamentárias não passam pela matriz.
        </p>
        {exemploDaRede && (
          <p>
            Exemplo: {exemploDaRede.sigla} gera {reais.format(exemploDaRede.valor)} em {ano}. Abra o + dele para ver cada câmpus; no + de um câmpus aparecem as turmas, com os alunos de {ano - 2}.
          </p>
        )}
        <p>
          Para ver cursos lado a lado, use{" "}
          <Link href={`/consulta/comparar?ano=${ano}`} className={PROSE_LINK}>
            Comparar cursos entre câmpus
          </Link>
          . Para o valor de um aluno de cada curso, use{" "}
          <Link href={`/consulta/valor-do-aluno?ano=${ano}`} className={PROSE_LINK}>
            Quanto vale um aluno
          </Link>
          . Os dois estão no menu Consultas.
        </p>
      </ComoLerEstaTela>

      {semSextaFase && (
        <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
          A matriz de {ano} ainda não tem a 6ª fase da MDO (participação por curso): sem ela, não há detalhamento por curso nem perda por evasão. Os valores vêm da 5ª fase (Funcionamento por câmpus).
        </p>
      )}

      {linhasInstituicoes.length === 0 ? (
        <p className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
          Nenhuma instituição com dado de Funcionamento (5ª ou 6ª fase) neste ano ainda.
        </p>
      ) : (
        <div className={`${instituicaoAberta ? "overflow-x-auto" : "tabela-rolavel"} rounded-lg border border-neutral-200 dark:border-neutral-800`}>
          <ConsultaTabelaInstituicoes linhas={linhasInstituicoes} ano={ano} totalRede={totalDaRede} aberta={instituicaoAberta} detalhe={instituicaoAberta ? detalheDaInstituicao : null} />
        </div>
      )}
      {!instituicaoAberta && detalheDaInstituicao}
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
