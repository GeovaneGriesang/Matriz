import { destaqueNaFrente, ehCampusDestaque, ehInstituicaoDestaque } from "@/lib/destaque";
import Link from "next/link";
import { PainelConfianca } from "@/components/Confianca";
import { prisma } from "@/server/db/prisma";
import { TABLE_MAX_WIDTH } from "@/lib/layoutWidths";
import { requireAcessoPlenoOrRedirect } from "@/server/auth/session";
import { SubmenuSimulador } from "@/components/simulador/SubmenuSimulador";
import { SimuladorDistribuicao, type CampusEntrada } from "@/components/simulador/SimuladorDistribuicao";
import { SeletorInstituicao } from "@/components/SeletorInstituicao";
import { indicesDoCampus } from "@/lib/mdo/indicesCampus";
import { TransicaoProposta, type CampusDaTransicao } from "@/components/simulador/TransicaoProposta";
import { matrizesProjetadas } from "@/lib/mdo/transicaoCumulativa";
import { retencaoObservada, valorPorCampusNosAnos, type CicloProjetavel } from "@/lib/mdo/projecaoCiclos";
import { taxasDeEvasaoDaInstituicao } from "@/server/queries/taxaEvasaoInstituicao";

export const dynamic = "force-dynamic";

interface Busca {
  ano?: string;
  instituicao?: string;
}

const n = (v: unknown) => Number(v ?? 0);

/** A proposta do Câmpus Sapucaia do Sul vale para o IFSul e parte de 2026: base informada de 2026, matriz da 5ª fase de 2027, projeção a partir do ano-base 2025. */
async function dadosDaTransicao(instituicaoId: number): Promise<CampusDaTransicao[]> {
  const [matrizes, bases, linhas, taxas] = await Promise.all([
    prisma.distribuicaoCampus.findMany({
      where: { ano: 2027, unidade: { instituicaoId, tipo: "CAMPUS" } },
      select: { unidadeId: true, vlMatrFinal: true, unidade: { select: { nome: true } } },
    }),
    prisma.valorRecebidoCampus.findMany({ where: { ano: 2026, unidade: { instituicaoId } }, select: { unidadeId: true, valorRecebido: true } }),
    prisma.distribuicaoCiclo.findMany({
      where: {
        ano: 2027,
        unidade: { instituicaoId },
        qtdAlunosMatriz: { gt: 0 },
        inicio: { not: null },
        termino: { not: null },
        jubilamento: { not: null },
        pesoCursoMatriz: { not: null },
        chMatriz: { not: null },
      },
    }),
    taxasDeEvasaoDaInstituicao(instituicaoId),
  ]);
  const ciclos: CicloProjetavel[] = linhas.map((l) => {
    const mt = n(l.matriculaTotal);
    return {
      id: l.id,
      unidadeId: l.unidadeId,
      curso: l.curso,
      tipoCurso: l.tipoCurso ?? "",
      tipoOferta: l.tipoOferta ?? "",
      repasse: l.repasse,
      inicio: l.inicio!,
      termino: l.termino!,
      jubilamento: l.jubilamento!,
      chCiclo: l.cargaHoraria ?? l.chMatriz!,
      chMec: l.chMinimaMec ?? l.chMatriz!,
      chMatriz: l.chMatriz!,
      peso: n(l.pesoCursoMatriz),
      agropecuaria: l.agropecuaria === true,
      alunos: n(l.qtdAlunosMatriz),
      valorPorMT: mt > 0 ? n(l.valorReais) / mt : n(l.valorAluno),
    };
  });
  const retencao = retencaoObservada(ciclos, 2025);
  const projecao = valorPorCampusNosAnos(ciclos, 2025, 3, {
    evasao: { presencial: taxas?.presencial ?? 0.15, ead: taxas?.ead ?? 0.1 },
    retencao: retencao.retencao,
  });
  const basePorId = new Map(bases.map((b) => [b.unidadeId, n(b.valorRecebido)]));
  return matrizes
    .filter((m) => n(m.vlMatrFinal) > 0 || (basePorId.get(m.unidadeId) ?? 0) > 0)
    .map((m) => ({
      id: m.unidadeId,
      nome: m.unidade.nome,
      base: basePorId.get(m.unidadeId) ?? null,
      matriz2027: n(m.vlMatrFinal),
      matrizesPelaProjecao: matrizesProjetadas(n(m.vlMatrFinal), projecao.get(m.unidadeId), 3),
      temCiclos: projecao.has(m.unidadeId),
    }))
    .sort((a, b) => Number(ehCampusDestaque(b.nome)) - Number(ehCampusDestaque(a.nome)) || a.nome.localeCompare(b.nome, "pt-BR"));
}

export default async function DistribuicaoPage({ searchParams }: { searchParams: Promise<Busca> }) {
  await requireAcessoPlenoOrRedirect("/simulador/distribuicao");
  const params = await searchParams;
  const anoAlvo = Number(params.ano) || 2027;
  const anoBase = anoAlvo - 1;
  const sigla = params.instituicao ?? "IFSUL";

  const instituicoes = await prisma.instituicao.findMany({ orderBy: { sigla: "asc" }, select: { id: true, sigla: true, nome: true } }).then((l) => destaqueNaFrente(l, (i) => i.sigla));
  const instituicao = instituicoes.find((i) => i.sigla === sigla) ?? instituicoes[0];
  const urlPorSigla = Object.fromEntries(
    instituicoes.map((i) => [i.sigla, `/simulador/distribuicao?ano=${anoAlvo}&instituicao=${encodeURIComponent(i.sigla)}`]),
  );

  const cabecalho = (
    <div className="flex flex-col gap-2">
      <div
        role="status"
        className="flex flex-col gap-1 rounded-lg border-2 border-amber-500 bg-amber-50 px-4 py-3 text-amber-900 dark:border-amber-600 dark:bg-amber-950 dark:text-amber-200"
      >
        <span className="text-sm font-bold uppercase tracking-wide">Proposta do Câmpus Sapucaia do Sul: não é a regra do IFSul</span>
        <span className="text-sm">
          Esta tela simula o documento &quot;Proposta de adoção da Matriz Orçamentária SETEC-CONIF para distribuição de orçamento entre Câmpus do IFSul&quot;, do Câmpus Sapucaia do Sul.
          Os valores abaixo são simulação dessa proposta, não o que cada câmpus vai receber.
        </span>
      </div>
      <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">Distribuição entre câmpus: a proposta do Câmpus Sapucaia do Sul</h1>
      <p className="text-neutral-600 dark:text-neutral-400">
        A proposta sai do que cada câmpus recebeu em 2026 e chega à distribuição pela matriz em três anos. Em 2027, o câmpus incorpora 33% da diferença até a matriz de 2027; em 2028, 66%
        da diferença que restou até a matriz de 2028; em 2029, adota a matriz inteira. Vale tanto para quem ganha quanto para quem perde. Clique num câmpus para ver a conta.
      </p>
    </div>
  );

  if (!instituicao) {
    return (
      <main className={`mx-auto flex ${TABLE_MAX_WIDTH} flex-col gap-6 px-6 py-12 lg:px-12`}>
        <SubmenuSimulador />
        {cabecalho}
        <p className="text-neutral-600 dark:text-neutral-400">Nenhum dado carregado ainda.</p>
      </main>
    );
  }

  const [alvo, anterior, recebidos, conferencias] = await Promise.all([
    prisma.distribuicaoCampus.findMany({
      where: { ano: anoAlvo, unidade: { instituicaoId: instituicao.id, tipo: "CAMPUS" } },
      select: { unidadeId: true, vlMatrFinal: true, unidade: { select: { nome: true } } },
    }),
    prisma.distribuicaoCampus.findMany({
      where: { ano: anoBase, unidade: { instituicaoId: instituicao.id, tipo: "CAMPUS" } },
      select: { unidadeId: true, vlMatrFinal: true },
    }),
    prisma.valorRecebidoCampus.findMany({
      where: { ano: anoBase, unidade: { instituicaoId: instituicao.id } },
      select: { unidadeId: true, valorRecebido: true },
    }),
    prisma.conferenciaExtracao.findMany({
      where: { ano: anoAlvo, unidade: { instituicaoId: instituicao.id } },
      select: {
        unidadeId: true, concluido: true, integralizado: true, retido: true, abandono: true,
        desligado: true, reprovado: true, transfExterna: true, transfInterna: true,
      },
    }),
  ]);

  const campusComMatriz = alvo.filter((c) => n(c.vlMatrFinal) > 0);
  if (campusComMatriz.length === 0) {
    return (
      <main className={`mx-auto flex ${TABLE_MAX_WIDTH} flex-col gap-6 px-6 py-12 lg:px-12`}>
        <SubmenuSimulador />
        {cabecalho}
        <div className="max-w-md">
          <SeletorInstituicao instituicoes={instituicoes} siglaEscolhida={instituicao.sigla} urlPorSigla={urlPorSigla} />
        </div>
        <p className="text-neutral-600 dark:text-neutral-400">
          {instituicao.sigla} não tem Funcionamento por câmpus em {anoAlvo}.
        </p>
      </main>
    );
  }

  const informadoPorId = new Map(recebidos.map((r) => [r.unidadeId, n(r.valorRecebido)]));
  const anteriorPorId = new Map(anterior.map((r) => [r.unidadeId, n(r.vlMatrFinal)]));
  const temInformado = informadoPorId.size > 0;
  const confPorId = new Map(conferencias.map((c) => [c.unidadeId, c]));

  const campi: CampusEntrada[] = campusComMatriz
    .map((c) => {
      const base = temInformado ? informadoPorId.get(c.unidadeId) : anteriorPorId.get(c.unidadeId);
      const conf = confPorId.get(c.unidadeId);
      return {
        id: c.unidadeId,
        nome: c.unidade.nome,
        informado: base !== undefined && base > 0 ? base : null,
        matriz: n(c.vlMatrFinal),
        indices: conf
          ? indicesDoCampus({
              concluido: n(conf.concluido), integralizado: n(conf.integralizado), retido: n(conf.retido),
              abandono: n(conf.abandono), desligado: n(conf.desligado), reprovado: n(conf.reprovado),
              transfExterna: n(conf.transfExterna), transfInterna: n(conf.transfInterna),
            })
          : null,
      };
    })
    .sort((a, b) => Number(ehCampusDestaque(b.nome)) - Number(ehCampusDestaque(a.nome)) || b.matriz - a.matriz);

  const temIndices = campi.every((c) => c.indices !== null);
  const transicao = ehInstituicaoDestaque(instituicao.sigla) ? await dadosDaTransicao(instituicao.id) : [];
  const temBase2026 = transicao.some((c) => c.base !== null);
  const totalPadrao = campi.reduce((s, c) => s + c.matriz, 0);

  return (
    <main className={`mx-auto flex ${TABLE_MAX_WIDTH} flex-col gap-6 px-6 py-12 lg:px-12`}>
      <SubmenuSimulador />
      {cabecalho}
      <PainelConfianca ids={["transicao-proposta", ...(temInformado || !ehInstituicaoDestaque(instituicao.sigla) ? [] : (["valor-informado"] as const)), "piso-79-53"]} />

      {ehInstituicaoDestaque(instituicao.sigla) &&
        (temBase2026 ? (
          <TransicaoProposta campi={transicao} />
        ) : (
          <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
            Falta o valor de 2026 de cada câmpus, a base da transição. Cadastre em Administração, Valores recebidos, ou rode <code>npx tsx scripts/carregarBase2026Ifsul.ts</code>.
          </p>
        ))}

      <details className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
        <summary className="cursor-pointer text-sm font-medium text-neutral-700 dark:text-neutral-300">Ensaio com outras regras (parte mantida e índice de qualidade)</summary>
        <div className="mt-4 flex flex-col gap-6">
          <PainelConfianca ids={["distribuicao-indices"]} />

      <div className="flex flex-wrap items-end gap-4 rounded-lg border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900">
        <div className="flex min-w-72 flex-1 flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">Instituição</span>
          <SeletorInstituicao instituicoes={instituicoes} siglaEscolhida={instituicao.sigla} urlPorSigla={urlPorSigla} />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">Primeiro ano da transição</span>
          <div className="flex gap-1">
            {[2026, 2027].map((a) => (
              <Link
                key={a}
                href={`/simulador/distribuicao?ano=${a}&instituicao=${instituicao.sigla}`}
                className={`rounded px-3 py-1.5 text-sm font-medium ${
                  a === anoAlvo
                    ? "bg-if-green text-white"
                    : "border border-neutral-300 text-neutral-700 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
                }`}
              >
                {a}
              </Link>
            ))}
          </div>
        </div>
      </div>

      <SimuladorDistribuicao
        key={`${instituicao.sigla}-${anoAlvo}`}
        campi={campi}
        anoBase={anoBase}
        anoAlvo={anoAlvo}
        fonteInformado={temInformado ? "informado" : "matriz-anterior"}
        temIndices={temIndices}
        totalPadrao={totalPadrao}
        instituicao={instituicao.sigla}
        valorInformadoExiste={ehInstituicaoDestaque(instituicao.sigla)}
      />
        </div>
      </details>
    </main>
  );
}
