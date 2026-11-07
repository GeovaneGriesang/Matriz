import { destaqueNaFrente, ehCampusDestaque } from "@/lib/destaque";
import { AvisoPedidoDaDdi } from "@/components/PedidoDaDdi";
import { PainelConfianca } from "@/components/Confianca";
import { prisma } from "@/server/db/prisma";
import { TABLE_MAX_WIDTH } from "@/lib/layoutWidths";
import { requireAcessoPlenoOrRedirect } from "@/server/auth/session";
import { SubmenuSimulador } from "@/components/simulador/SubmenuSimulador";
import { ProjecaoCiclos, type CicloSerial, type TaxasPadrao } from "@/components/simulador/ProjecaoCiclos";
import { SeletorInstituicao } from "@/components/SeletorInstituicao";
import { ComoLerEstaTela } from "@/components/ComoLerEstaTela";
import { taxasDeEvasaoDaInstituicao } from "@/server/queries/taxaEvasaoInstituicao";
import { retencaoObservada } from "@/lib/mdo/projecaoCiclos";
import { chaveDoFatorEsforco, fatorEsforcoPadrao, fatorMatriculaEquivalente } from "@/lib/mdo/matriculaEquivalente";

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
      <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">Cenários: matrícula e matriz projetadas</h1>
      <AvisoPedidoDaDdi>
        A matrícula projetada de cada câmpus e do IFSul, anos à frente, e o efeito de um curso novo. Para olhar só os cursos de elevação de escolaridade, use o botão &quot;Só presenciais e regulares&quot;; para ver alunos em vez de reais, use &quot;Ver em&quot;, no título da tabela.
      </AvisoPedidoDaDdi>
      <p className="text-neutral-600 dark:text-neutral-400">Quantos alunos o câmpus terá e quanto a matriz repassa nos próximos anos, com os cursos de hoje, os que param e os que abrem. Para testar uma mudança, abra os quadros abaixo da tabela.</p>
      <ComoLerEstaTela>
        <p>
          <strong>Matrícula projetada</strong> é quantos alunos estarão matriculados em cada ano: os de hoje, que vão terminando o curso, mais as turmas novas dos cursos que continuam e dos cursos novos. <strong>Matriz projetada</strong> é quanto essas matrículas rendem na matriz, em reais. Para ver uma ou outra, use &quot;Ver em&quot;, no título da tabela. Por exemplo, em Venâncio Aires, a matrícula de 2025 (matriz de 2027) é de 8.891 alunos, ou 658 nos cursos presenciais e regulares.
        </p>
        <p>
          Um curso de 5 anos que começou em 2025 só termina em 2030. Esta tela projeta, ano a ano e pelo número de anos que você escolher, o que cada turma em andamento continua valendo na matriz enquanto os alunos terminam o curso, com a evasão média do instituto na modalidade.
        </p>
        <p>
          Depois você monta o cenário: cursos novos que um câmpus pretende abrir, em anos diferentes, e cursos que deixam de ser ofertados (as turmas em andamento terminam, mas não entram turmas novas), em um ou em vários câmpus. Responde: quanto de orçamento é preciso para que todos terminem o curso e como ficam os anos seguintes com as mudanças planejadas.
        </p>
      </ComoLerEstaTela>
    </div>
  );

  if (!instituicao) {
    return (
      <main className={`mx-auto flex ${TABLE_MAX_WIDTH} flex-col gap-6 px-6 py-12 lg:px-12`}>
        <SubmenuSimulador />
        {cabecalho}
        <p className="text-neutral-600 dark:text-neutral-400">Nenhuma instituição tem turmas com datas carregadas na matriz de {ano}.</p>
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
      codigoCiclo: true,
      unidadeId: true,
      fonteFinanciamento: true,
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

  // A Mateq de cada turma: o fec e a carga horária vêm dos microdados da PNP, ligados à MDO pelo código da turma, que é o mesmo nos dois.
  const daPnp = await prisma.pnpMicrodadoCiclo.findMany({
    where: { tipo: "MATRICULAS", anoBase: anoBase0, instituicaoId: instituicao.id, ciclo: { in: linhas.map((l) => l.codigoCiclo) } },
    select: { ciclo: true, fatorEsforco: true, cargaHoraria: true },
  });
  const pnpPorCiclo = new Map(daPnp.map((p) => [p.ciclo, p]));

  const ciclos: CicloSerial[] = linhas.map((l) => {
    const pnp = pnpPorCiclo.get(l.codigoCiclo);
    const tipoCurso = l.tipoCurso ?? "";
    const fatorDaPnp = pnp?.fatorEsforco != null;
    const fatorMateq = fatorMatriculaEquivalente({
      tipoCurso,
      fatorEsforco: pnp?.fatorEsforco != null ? Number(pnp.fatorEsforco) : fatorEsforcoPadrao(tipoCurso),
      cargaHoraria: pnp?.cargaHoraria ?? l.cargaHoraria ?? l.chMatriz!,
    });
    const mt = Number(l.matriculaTotal);
    const valorPorMT = mt > 0 ? Number(l.valorReais) / mt : Number(l.valorAluno ?? 0);
    return {
      id: l.id,
      codigoCiclo: l.codigoCiclo,
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
      fonteFinanciamento: l.fonteFinanciamento,
      fatorMateq,
      fatorDaPnp,
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
  // O fec de quem abre um curso novo: o que a PNP aplica ao mesmo curso na rede (o mais comum, quando há mais de um).
  const fecDaRede = await prisma.pnpMicrodadoCiclo.groupBy({
    by: ["tipoCurso", "nomeCurso", "fatorEsforco"],
    where: { tipo: "MATRICULAS", anoBase: anoBase0, fatorEsforco: { not: null } },
    _count: { _all: true },
    orderBy: { _count: { id: "asc" } },
  });
  const fecPorCurso = new Map(fecDaRede.map((f) => [chaveDoFatorEsforco(f.tipoCurso, f.nomeCurso), Number(f.fatorEsforco)]));
  const catalogoComFec = catalogo.map((c) => ({ ...c, fatorEsforco: fecPorCurso.get(chaveDoFatorEsforco(c.tipoCurso, c.curso)) ?? fatorEsforcoPadrao(c.tipoCurso) }));

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
      <ProjecaoCiclos
        seletorInstituicao={<SeletorInstituicao instituicoes={instituicoes} siglaEscolhida={instituicao.sigla} urlPorSigla={urlPorSigla} />}
        key={`${instituicao.sigla}-${ano}`}
        instituicao={instituicao.sigla}
        anoCiclo={ano}
        anoBase0={anoBase0}
        campi={unidades}
        ciclos={ciclos}
        catalogo={catalogoComFec}
        valorMatriculaPresencial={valorMatriculaPresencial}
        taxasPadrao={taxasPadrao}
        retencao={retencao}
        campusInicialId={campusInicial}
      />
    </main>
  );
}
