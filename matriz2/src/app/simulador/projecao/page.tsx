import { destaqueNaFrente, ehCampusDestaque } from "@/lib/destaque";
import { PainelConfianca } from "@/components/Confianca";
import { prisma } from "@/server/db/prisma";
import { TABLE_MAX_WIDTH } from "@/lib/layoutWidths";
import { requireAcessoPlenoOrRedirect } from "@/server/auth/session";
import { SubmenuSimulador } from "@/components/simulador/SubmenuSimulador";
import { ProjecaoCiclos, type CicloSerial, type TaxasPadrao } from "@/components/simulador/ProjecaoCiclos";
import { SeletorInstituicao } from "@/components/SeletorInstituicao";
import { taxasDeEvasaoDaInstituicao } from "@/server/queries/taxaEvasaoInstituicao";
import { retencaoObservada } from "@/lib/mdo/projecaoCiclos";

export const dynamic = "force-dynamic";

interface Busca {
  ano?: string;
  instituicao?: string;
}

/** Valores de partida quando a PNP não traz a evasão da instituição; a tela avisa e o usuário pode trocar. */
const EVASAO_SEM_DADO = { presencial: 0.15, ead: 0.1 };

export default async function ProjecaoPage({ searchParams }: { searchParams: Promise<Busca> }) {
  await requireAcessoPlenoOrRedirect("/simulador/projecao");
  const params = await searchParams;
  const ano = Number(params.ano) || 2027;
  const anoBase0 = ano - 2;
  const sigla = params.instituicao ?? "IFSUL";

  // Só as instituições cujos ciclos trazem datas, peso e carga horária (a regra da Matrícula Total precisa deles).
  const comDados = await prisma.$queryRaw<Array<{ id: number }>>`
    SELECT DISTINCT u.instituicaoId AS id
    FROM DistribuicaoCiclo c JOIN Unidade u ON u.id = c.unidadeId
    WHERE c.ano = ${ano} AND c.inicio IS NOT NULL AND c.termino IS NOT NULL AND c.jubilamento IS NOT NULL
      AND c.pesoCursoMatriz IS NOT NULL AND c.chMatriz IS NOT NULL`;
  const idsComDados = new Set(comDados.map((r) => Number(r.id)));
  const instituicoes = await prisma.instituicao
    .findMany({ where: { id: { in: [...idsComDados] } }, orderBy: { sigla: "asc" }, select: { id: true, sigla: true, nome: true } })
    .then((l) => destaqueNaFrente(l, (i) => i.sigla));
  const instituicao = instituicoes.find((i) => i.sigla === sigla) ?? instituicoes[0];

  const cabecalho = (
    <div className="flex flex-col gap-2">
      <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">Simulador de cenários: o que os ciclos rendem nos próximos anos</h1>
      <p className="text-neutral-600 dark:text-neutral-400">
        Um curso de 5 anos que começou em 2025 só termina em 2030. Esta tela projeta, ano a ano e pelo número de anos que você escolher, o que cada ciclo em andamento continua
        valendo na matriz enquanto os alunos terminam o curso, com a evasão média do instituto na modalidade. Depois você monta o cenário: cursos novos que um câmpus pretende
        abrir, em anos diferentes, e cursos que deixam de ser ofertados (as turmas em andamento terminam, mas não entram turmas novas), em um ou em vários câmpus. Responde:
        quanto de orçamento é preciso para que todos completem o ciclo e como ficam os anos seguintes com as mudanças planejadas.
      </p>
    </div>
  );

  if (!instituicao) {
    return (
      <main className={`mx-auto flex ${TABLE_MAX_WIDTH} flex-col gap-6 px-6 py-12 lg:px-12`}>
        <SubmenuSimulador />
        {cabecalho}
        <p className="text-neutral-600 dark:text-neutral-400">Nenhuma instituição tem ciclos com datas carregados no ciclo {ano}.</p>
      </main>
    );
  }

  const urlPorSigla = Object.fromEntries(instituicoes.map((i) => [i.sigla, `/simulador/projecao?ano=${ano}&instituicao=${encodeURIComponent(i.sigla)}`]));

  const linhas = await prisma.distribuicaoCiclo.findMany({
    where: {
      ano,
      unidade: { instituicaoId: instituicao.id },
      qtdAlunosMatriz: { gt: 0 },
      inicio: { not: null },
      termino: { not: null },
      jubilamento: { not: null },
      pesoCursoMatriz: { not: null },
      chMatriz: { not: null },
    },
    select: {
      id: true,
      unidadeId: true,
      curso: true,
      tipoCurso: true,
      tipoOferta: true,
      repasse: true,
      inicio: true,
      termino: true,
      jubilamento: true,
      cargaHoraria: true,
      chMinimaMec: true,
      chMatriz: true,
      pesoCursoMatriz: true,
      agropecuaria: true,
      qtdAlunosMatriz: true,
      matriculaTotal: true,
      valorReais: true,
      valorAluno: true,
    },
  });

  const ciclos: CicloSerial[] = linhas.map((l) => {
    const mt = Number(l.matriculaTotal);
    const valorPorMT = mt > 0 ? Number(l.valorReais) / mt : Number(l.valorAluno ?? 0);
    return {
      id: l.id,
      unidadeId: l.unidadeId,
      curso: l.curso,
      tipoCurso: l.tipoCurso ?? "",
      tipoOferta: l.tipoOferta ?? "",
      repasse: l.repasse,
      inicio: l.inicio!.toISOString(),
      termino: l.termino!.toISOString(),
      jubilamento: l.jubilamento!.toISOString(),
      chCiclo: l.cargaHoraria ?? l.chMatriz!,
      chMec: l.chMinimaMec ?? l.chMatriz!,
      chMatriz: l.chMatriz!,
      peso: Number(l.pesoCursoMatriz),
      agropecuaria: l.agropecuaria === true,
      alunos: Number(l.qtdAlunosMatriz),
      valorPorMT,
    };
  });

  const unidades = await prisma.unidade.findMany({
    where: { id: { in: [...new Set(ciclos.map((c) => c.unidadeId))] } },
    select: { id: true, nome: true },
    orderBy: { nome: "asc" },
  });
  unidades.sort((a, b) => Number(ehCampusDestaque(b.nome)) - Number(ehCampusDestaque(a.nome)));

  const taxas = await taxasDeEvasaoDaInstituicao(instituicao.id);
  const taxasPadrao: TaxasPadrao = taxas
    ? {
        presencial: taxas.presencial,
        ead: taxas.ead,
        porAno: taxas.porAno,
        semDado: false,
        origem: `Média ponderada de ${taxas.anos.join(", ")} da Taxa de Evasão Anual da PNP de ${instituicao.sigla}, por modalidade de ensino (evadidos ÷ matrículas). A modalidade a distância inclui os cursos MOOC, que quase não têm evasão registrada.`,
      }
    : {
        ...EVASAO_SEM_DADO,
        porAno: [],
        semDado: true,
        origem: `A PNP carregada não tem a Taxa de Evasão Anual de ${instituicao.sigla}; a tela partiu de ${EVASAO_SEM_DADO.presencial * 100}% (presencial) e ${EVASAO_SEM_DADO.ead * 100}% (a distância). Troque pelos valores que preferir.`,
      };

  const retencao = retencaoObservada(
    ciclos.map((c) => ({ termino: new Date(c.termino), alunos: c.alunos, tipoCurso: c.tipoCurso })),
    anoBase0,
  );

  const campusInicial = unidades.find((u) => ehCampusDestaque(u.nome))?.id ?? null;

  // Os cursos que se podem abrir num cenário vêm da tabela de pesos, e o valor de uma matrícula presencial é o mais comum entre os ciclos presenciais.
  const anoDosPesos = (await prisma.pesoEfetivoCurso.aggregate({ _max: { anoReferencia: true } }))._max.anoReferencia;
  const catalogo = anoDosPesos
    ? (await prisma.pesoEfetivoCurso.findMany({ where: { anoReferencia: anoDosPesos }, orderBy: [{ curso: "asc" }, { tipoCurso: "asc" }] })).map((p) => ({
        curso: p.curso,
        tipoCurso: p.tipoCurso,
        tipoOferta: p.tipoOferta,
        chMinimaMec: p.chMinimaMec,
        pesoEfetivo: Number(p.pesoEfetivo),
      }))
    : [];
  const contagemDeValores = new Map<number, number>();
  for (const l of linhas) {
    if (l.repasse !== "PRESENCIAL") continue;
    const v = Math.round(Number(l.valorAluno ?? 0) * 100) / 100;
    if (v > 0) contagemDeValores.set(v, (contagemDeValores.get(v) ?? 0) + 1);
  }
  const valorMatriculaPresencial = [...contagemDeValores.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 0;

  return (
    <main className={`mx-auto flex ${TABLE_MAX_WIDTH} flex-col gap-6 px-6 py-12 lg:px-12`}>
      <SubmenuSimulador />
      {cabecalho}
      <PainelConfianca ids={["regra-matricula-total", "projecao-ciclos"]} />
      <div className="max-w-md">
        <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">Instituição</span>
        <SeletorInstituicao instituicoes={instituicoes} siglaEscolhida={instituicao.sigla} urlPorSigla={urlPorSigla} />
      </div>
      <ProjecaoCiclos
        key={`${instituicao.sigla}-${ano}`}
        instituicao={instituicao.sigla}
        anoCiclo={ano}
        anoBase0={anoBase0}
        campi={unidades}
        ciclos={ciclos}
        catalogo={catalogo}
        valorMatriculaPresencial={valorMatriculaPresencial}
        taxasPadrao={taxasPadrao}
        retencao={retencao}
        campusInicialId={campusInicial}
      />
    </main>
  );
}
