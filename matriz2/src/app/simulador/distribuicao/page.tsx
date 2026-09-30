import Link from "next/link";
import { PainelConfianca } from "@/components/Confianca";
import { prisma } from "@/server/db/prisma";
import { TABLE_MAX_WIDTH } from "@/lib/layoutWidths";
import { requireAcessoPlenoOrRedirect } from "@/server/auth/session";
import { SubmenuSimulador } from "@/components/simulador/SubmenuSimulador";
import { SimuladorDistribuicao, type CampusEntrada } from "@/components/simulador/SimuladorDistribuicao";
import { SeletorInstituicao } from "@/components/SeletorInstituicao";
import { indicesDoCampus } from "@/lib/mdo/indicesCampus";

export const dynamic = "force-dynamic";

interface Busca {
  ano?: string;
  instituicao?: string;
}

const n = (v: unknown) => Number(v ?? 0);

export default async function DistribuicaoPage({ searchParams }: { searchParams: Promise<Busca> }) {
  await requireAcessoPlenoOrRedirect("/simulador/distribuicao");
  const params = await searchParams;
  const anoAlvo = Number(params.ano) || 2027;
  const anoBase = anoAlvo - 1;
  const sigla = params.instituicao ?? "IFSUL";

  const instituicoes = await prisma.instituicao.findMany({ orderBy: { sigla: "asc" }, select: { id: true, sigla: true, nome: true } });
  const instituicao = instituicoes.find((i) => i.sigla === sigla) ?? instituicoes[0];
  const urlPorSigla = Object.fromEntries(
    instituicoes.map((i) => [i.sigla, `/simulador/distribuicao?ano=${anoAlvo}&instituicao=${encodeURIComponent(i.sigla)}`]),
  );

  const cabecalho = (
    <div className="flex flex-col gap-2">
      <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">Distribuição entre câmpus, em transição</h1>
      <p className="text-neutral-600 dark:text-neutral-400">
        Como repartir o Funcionamento de uma instituição entre os câmpus sem tirar tudo de quem perde de uma vez: mantém-se uma
        parte (70 a 80%, por exemplo) na proporção do que cada câmpus recebeu no ano anterior, completa-se com a matriz e, se
        quiser, com um índice de qualidade e eficiência, e a cada ano essa parte encolhe até a distribuição ficar 100% pela matriz.
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
    .sort((a, b) => b.matriz - a.matriz);

  const temIndices = campi.every((c) => c.indices !== null);
  const totalPadrao = campi.reduce((s, c) => s + c.matriz, 0);

  return (
    <main className={`mx-auto flex ${TABLE_MAX_WIDTH} flex-col gap-6 px-6 py-12 lg:px-12`}>
      <SubmenuSimulador />
      {cabecalho}
      <PainelConfianca ids={["distribuicao-indices", ...(temInformado ? [] : (["valor-informado"] as const)), "piso-79-53"]} />

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
      />
    </main>
  );
}
