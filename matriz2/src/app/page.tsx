import Link from "next/link";
import { prisma } from "@/server/db/prisma";
import { FORM_MAX_WIDTH } from "@/lib/layoutWidths";

export const dynamic = "force-dynamic";

const numero = new Intl.NumberFormat("pt-BR");
const reais = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export default async function Home() {
  const [ciclos, instituicoes, campus, soma, anos] = await Promise.all([
    prisma.distribuicaoCiclo.count(),
    prisma.instituicao.count(),
    prisma.unidade.count(),
    prisma.distribuicaoCiclo.aggregate({ _sum: { valorReais: true } }),
    prisma.distribuicaoCiclo.findMany({ distinct: ["ano"], select: { ano: true }, orderBy: { ano: "asc" } }),
  ]);

  return (
    <main className={`mx-auto flex ${FORM_MAX_WIDTH} flex-col gap-8 px-6 py-16`}>
      <div className="flex flex-col gap-4">
        <h1 className="text-3xl font-semibold text-neutral-900 dark:text-neutral-100">
          Matriz de Distribuição Orçamentária
        </h1>
        <p className="text-lg text-neutral-600 dark:text-neutral-400">
          Consulta e comparação do orçamento da Rede Federal, com foco no IFSul e no Câmpus
          Venâncio Aires.
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
          Todo número exibido carrega uma etiqueta dizendo de onde veio e de quando é.
        </p>
      </div>

      {ciclos === 0 ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-5 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
          Ainda não há dados carregados. Rode{" "}
          <code className="rounded bg-amber-100 px-1 dark:bg-amber-900">npm run carregar -- 2027</code> para
          trazer o ciclo 2027 a partir das exportações da MDO.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Numero rotulo="Ciclos de curso" valor={numero.format(ciclos)} />
          <Numero rotulo="Instituições" valor={numero.format(instituicoes)} />
          <Numero rotulo="Câmpus" valor={numero.format(campus)} />
          <Numero rotulo="Distribuído" valor={reais.format(Number(soma._sum.valorReais ?? 0))} />
        </div>
      )}

      <div className="flex flex-col gap-3">
        <Atalho
          href="/consulta"
          titulo="Consulta"
          resumo="Quanto cada câmpus recebe, e de quais cursos esse valor vem."
        />
        <Atalho
          href="/evasao"
          titulo="Perda por evasão"
          resumo="Quanto se deixa de receber por aluno evadido, por câmpus e por curso."
        />
        <Atalho
          href="/dados-importados"
          titulo="Dados importados"
          resumo="Quais arquivos alimentam o sistema, de que etapa vieram e de quando são."
        />
      </div>

      {anos.length > 0 && (
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          Ciclos carregados: {anos.map((a) => a.ano).join(", ")}.
          {anos.length === 1 && " A comparação entre ciclos fica disponível quando houver dois."}
        </p>
      )}
    </main>
  );
}

function Numero({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
      <div className="text-xs font-medium uppercase tracking-wide text-neutral-500">{rotulo}</div>
      <div className="mt-1 text-xl font-semibold tabular-nums text-neutral-900 dark:text-neutral-100">{valor}</div>
    </div>
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
