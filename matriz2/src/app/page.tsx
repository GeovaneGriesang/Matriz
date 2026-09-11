import Link from "next/link";
import { prisma } from "@/server/db/prisma";
import { FORM_MAX_WIDTH, TABLE_MAX_WIDTH, PROSE_LINK } from "@/lib/layoutWidths";
import { getAdminSession } from "@/server/auth/session";

export const dynamic = "force-dynamic";

const reais = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const numero = new Intl.NumberFormat("pt-BR");

/**
 * Sem sessão (ou com o papel `PADRAO`) esta tela não menciona a MDO nem mostra
 * nenhum número: tudo que o sistema calcula hoje vem de exportações da MDO obtidas
 * com credenciais pessoais, e não pode circular sem login (ver topo de
 * `schema.prisma`). O painel completo, com números e a explicação de onde vêm,
 * só aparece para quem já tem acesso pleno (admin ou super-admin).
 */
export default async function Home() {
  const usuario = await getAdminSession();
  if (!usuario || usuario.papel === "PADRAO") {
    return (
      <main className={`mx-auto flex ${FORM_MAX_WIDTH} flex-col gap-6 px-6 py-20 text-center`}>
        <h1 className="text-3xl font-semibold text-neutral-900 dark:text-neutral-100">
          Matriz Orçamentária RFEPCT
        </h1>
        <p className="text-lg text-neutral-600 dark:text-neutral-400">
          Sistema de acompanhamento orçamentário com foco no IFSul.
        </p>
        <Link
          href="/admin/login"
          className="mx-auto w-fit rounded-md bg-if-green px-5 py-2.5 text-sm font-medium text-white hover:bg-if-green/90"
        >
          Entrar
        </Link>
      </main>
    );
  }

  // Um resumo POR CICLO, de propósito: 2026 e 2027 vêm de fontes e estados
  // diferentes hoje (ver docs/pnp-matriz/Metodologia_Matriz_Orcamentaria_CONIF.md e
  // README), e uma tela didática não pode esconder isso atrás de um número só.
  const [porInstituicaoRaw, cicloOrcamentos, cicloCursoPorAno, cicloCampusPorAno] = await Promise.all([
    prisma.comparativoInstitucional.groupBy({
      by: ["ano"],
      _sum: { matriculas: true, iqe: true, ae: true },
      _count: { instituicaoId: true },
    }),
    prisma.cicloOrcamento.findMany({ orderBy: { ano: "asc" } }),
    prisma.distribuicaoCiclo.groupBy({ by: ["ano"], _count: { _all: true } }),
    prisma.distribuicaoCampus.groupBy({ by: ["ano"], _count: { _all: true } }),
  ]);

  const anos = Array.from(
    new Set([
      ...porInstituicaoRaw.map((r) => r.ano),
      ...cicloOrcamentos.map((c) => c.ano),
      ...cicloCursoPorAno.map((r) => r.ano),
      ...cicloCampusPorAno.map((r) => r.ano),
    ]),
  ).sort();

  const porInstituicao = new Map(porInstituicaoRaw.map((r) => [r.ano, r]));
  const cursosPorAno = new Map(cicloCursoPorAno.map((r) => [r.ano, r._count._all]));
  const campusPorAno = new Map(cicloCampusPorAno.map((r) => [r.ano, r._count._all]));

  const resumoAnos = anos.map((ano) => {
    const inst = porInstituicao.get(ano);
    const funcionamento = Number(inst?._sum.matriculas ?? 0);
    const iqe = Number(inst?._sum.iqe ?? 0);
    const ae = Number(inst?._sum.ae ?? 0);
    return {
      ano,
      instituicoes: inst?._count.instituicaoId ?? 0,
      funcionamento,
      iqe,
      ae,
      total: funcionamento + iqe + ae,
      cursos: cursosPorAno.get(ano) ?? 0,
      campus: campusPorAno.get(ano) ?? 0,
    };
  });

  const semNenhumDado = resumoAnos.length === 0;

  return (
    <main className={`mx-auto flex ${TABLE_MAX_WIDTH} flex-col gap-8 px-6 py-16 lg:px-12`}>
      <div className="flex flex-col gap-4">
        <h1 className="text-3xl font-semibold text-neutral-900 dark:text-neutral-100">
          Matriz de Distribuição Orçamentária
        </h1>
        <p className="text-lg text-neutral-600 dark:text-neutral-400">
          Consulta e comparação do orçamento da Rede Federal, com foco no IFSul.
        </p>
      </div>

      <div className="flex flex-col gap-3 rounded-lg border border-neutral-200 bg-neutral-50 p-5 dark:border-neutral-800 dark:bg-neutral-900">
        <h2 className="font-semibold text-neutral-900 dark:text-neutral-100">De onde vêm estes números</h2>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          Este sistema <strong>não calcula</strong> a matriz. Quem calcula é a MDO
          (mdo.iftm.edu.br), o sistema oficial da Rede Federal operado pelo IFTM, onde as 42
          instituições homologam os dados em sete etapas. Aqui os resultados já homologados são
          importados e organizados para responder perguntas que a MDO não responde: como um câmpus
          se compara a outro, o que mudou de um ciclo para o próximo, e quanto se deixa de receber
          por evasão.
        </p>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          Todo número exibido carrega uma etiqueta dizendo de onde veio e de quando é.{" "}
          <Link href="/como-funciona" className={PROSE_LINK}>
            Veja como a matriz é calculada
          </Link>
          .
        </p>
      </div>

      {semNenhumDado ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-5 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
          Ainda não há dados carregados. Rode{" "}
          <code className="rounded bg-amber-100 px-1 dark:bg-amber-900">npm run carregar -- 2027</code> para
          trazer o ciclo 2027 a partir das exportações da MDO.
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">Por ciclo</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {resumoAnos.map((r) => (
              <div
                key={r.ano}
                className="flex flex-col gap-3 rounded-lg border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950"
              >
                <div className="flex items-baseline justify-between">
                  <span className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">{r.ano}</span>
                  <span className="text-xs text-neutral-500 dark:text-neutral-400">
                    {r.instituicoes > 0 ? `${r.instituicoes} instituições` : "sem dado por instituição"}
                  </span>
                </div>

                {r.total > 0 ? (
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                    <dt className="text-neutral-500 dark:text-neutral-400">
                      <Link href="/como-funciona#funcionamento" className="hover:underline">
                        Funcionamento
                      </Link>
                    </dt>
                    <dd className="text-right tabular-nums text-neutral-900 dark:text-neutral-100">
                      {reais.format(r.funcionamento)}
                    </dd>
                    <dt className="text-neutral-500 dark:text-neutral-400">
                      <Link href="/como-funciona#qualidade-eficiencia" className="hover:underline">
                        Qualidade e Eficiência
                      </Link>
                    </dt>
                    <dd className="text-right tabular-nums text-neutral-900 dark:text-neutral-100">
                      {reais.format(r.iqe)}
                    </dd>
                    <dt className="text-neutral-500 dark:text-neutral-400">
                      <Link href="/como-funciona#assistencia" className="hover:underline">
                        Assistência Estudantil
                      </Link>
                    </dt>
                    <dd className="text-right tabular-nums text-neutral-900 dark:text-neutral-100">
                      {reais.format(r.ae)}
                    </dd>
                    <dt className="font-medium text-neutral-700 dark:text-neutral-300">Total</dt>
                    <dd className="text-right font-medium tabular-nums text-neutral-900 dark:text-neutral-100">
                      {reais.format(r.total)}
                    </dd>
                  </dl>
                ) : (
                  <p className="text-sm text-amber-700 dark:text-amber-400">
                    Sem valor distribuído por instituição carregado para este ciclo ainda.
                  </p>
                )}

                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  {r.campus > 0 ? `${numero.format(r.campus)} câmpus com dado de entrada (5ª fase)` : "sem 5ª fase carregada"}
                  {" · "}
                  {r.cursos > 0
                    ? `${numero.format(r.cursos)} ciclos de curso (6ª fase, valor por câmpus disponível)`
                    : "sem 6ª fase (Consulta, Evasão e Simulador não descem a câmpus/curso neste ciclo)"}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">Telas</h2>
        {/* Mesma ordem do cabeçalho: começa pelo manual e pela origem dos dados,
            depois segue a mesma sequência da conta da MDO (bloco Funcionamento,
            depois Qualidade e Eficiência), até o Comparativo, que olha tudo isso ao
            longo de vários ciclos. */}
        <div className="grid gap-3 sm:grid-cols-2">
          <Atalho
            href="/como-funciona"
            titulo="Como funciona"
            resumo="O que é cada bloco da matriz (Funcionamento, Qualidade e Eficiência, Assistência) e como é calculado."
          />
          <Atalho
            href="/dados-importados"
            titulo="Dados importados"
            resumo="Quais arquivos alimentam o sistema, de que etapa vieram e de quando são."
          />
          <Atalho
            href="/consulta"
            titulo="Consulta"
            resumo="Quanto cada instituição e câmpus recebe, e de quais cursos esse valor vem."
          />
          <Atalho
            href="/evasao"
            titulo="Perda por evasão"
            resumo="Quanto se deixa de receber por aluno evadido, por instituição, câmpus e curso."
          />
          <Atalho
            href="/conferencia"
            titulo="Conferência"
            resumo="Refaz o cálculo de IEA, RAP e IAPL a partir dos mesmos componentes da MDO, para comparar com o oficial."
          />
          <Atalho
            href="/simulador"
            titulo="Simulador"
            resumo="E se a evasão caísse e a RAP e o IAPL mudassem de faixa, ao mesmo tempo? Veja o efeito combinado."
          />
          <Atalho
            href="/comparativo"
            titulo="Comparativo entre ciclos"
            resumo="O que mudou de um ciclo para o outro, por instituição."
          />
        </div>
      </div>
    </main>
  );
}

function Atalho({ href, titulo, resumo }: { href: string; titulo: string; resumo: string }) {
  return (
    <Link
      href={href}
      className="group flex flex-col gap-1 rounded-lg border border-neutral-200 p-4 transition hover:border-if-green hover:bg-if-green/5 dark:border-neutral-800"
    >
      <span className="font-medium text-neutral-900 group-hover:text-if-green dark:text-neutral-100">{titulo}</span>
      <span className="text-sm text-neutral-600 dark:text-neutral-400">{resumo}</span>
    </Link>
  );
}
