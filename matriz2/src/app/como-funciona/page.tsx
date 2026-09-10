import Link from "next/link";
import { FORM_MAX_WIDTH, PROSE_LINK } from "@/lib/layoutWidths";
import { requireAcessoPlenoOrRedirect } from "@/server/auth/session";
import { prisma } from "@/server/db/prisma";
import { CalculoAoVivo } from "./CalculoAoVivo";
import { TabelaPesos } from "./TabelaPesos";

export const dynamic = "force-dynamic";

const reaisPorMatricula = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default async function ComoFuncionaPage() {
  await requireAcessoPlenoOrRedirect("/como-funciona");

  // Pelo menos os dois últimos ciclos (pedido do usuário: "vamos vendo as coisas
  // acontecerem" com números reais, não só descrição em texto), mais recente
  // primeiro na consulta e depois invertido pra a barra mais antiga aparecer em
  // cima, na ordem que se lê.
  const ciclosBrutos = await prisma.cicloOrcamento.findMany({
    orderBy: { ano: "desc" },
    take: 2,
    select: {
      ano: true,
      valorReferenciaSpo: true,
      ajuste: true,
      assistenciaTotal: true,
      funcionamentoTotal: true,
      reitoriasTotal: true,
      qualidadeEficienciaTotal: true,
      valorMatriculaPresencial: true,
      valorMatriculaEad: true,
      valorMatriculaEadMooc: true,
      valorMatriculaEadFp: true,
    },
  });
  const ciclos = ciclosBrutos
    .map((c) => ({
      ano: c.ano,
      valorReferenciaSpo: Number(c.valorReferenciaSpo),
      ajuste: Number(c.ajuste),
      assistenciaTotal: Number(c.assistenciaTotal),
      funcionamentoTotal: Number(c.funcionamentoTotal),
      reitoriasTotal: Number(c.reitoriasTotal),
      qualidadeEficienciaTotal: Number(c.qualidadeEficienciaTotal),
    }))
    .reverse();
  const taxasModalidade = ciclosBrutos
    .map((c) => ({
      ano: c.ano,
      presencial: c.valorMatriculaPresencial === null ? null : Number(c.valorMatriculaPresencial),
      ead: c.valorMatriculaEad === null ? null : Number(c.valorMatriculaEad),
      eadMooc: c.valorMatriculaEadMooc === null ? null : Number(c.valorMatriculaEadMooc),
      eadFp: c.valorMatriculaEadFp === null ? null : Number(c.valorMatriculaEadFp),
    }))
    .reverse();

  return (
    <main className={`mx-auto flex ${FORM_MAX_WIDTH} flex-col gap-8 px-6 py-16`}>
      <div className="flex flex-col gap-3">
        <h1 className="text-3xl font-semibold text-neutral-900 dark:text-neutral-100">Como funciona a matriz</h1>
        <p className="text-neutral-600 dark:text-neutral-400">
          A Matriz de Distribuição Orçamentária é calculada pela MDO (mdo.iftm.edu.br), sistema oficial da Rede
          Federal operado pelo IFTM. Este sistema <strong>não recalcula</strong> nada disso: importa o resultado
          já homologado. Esta página explica o que cada bloco significa e, a grosso modo, como a MDO chega a
          esse número, para que os valores que você vê nas outras telas façam sentido, mesmo sem reproduzir a
          conta aqui dentro.
        </p>
      </div>

      <div className="flex flex-col gap-2 rounded-lg border border-neutral-200 bg-neutral-50 p-5 dark:border-neutral-800 dark:bg-neutral-900">
        <h2 className="font-semibold text-neutral-900 dark:text-neutral-100">A ideia geral</h2>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          Todo ano, o Congresso aprova um valor total para a Rede Federal de Educação Profissional, Científica e
          Tecnológica (42 institutos e centros federais, mais de 600 câmpus). Esse valor único precisa ser
          repartido entre todas as instituições, e a MDO faz isso em blocos, cada um com uma lógica própria de
          rateio.
        </p>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          A conta acontece em duas etapas, não uma só. Primeiro, tira-se do total a{" "}
          <Link href="#assistencia" className={PROSE_LINK}>
            Assistência Estudantil
          </Link>{" "}
          (a ação orçamentária 2994, com regras próprias de rateio, explicada mais abaixo) e um pequeno ajuste;
          só então o que sobra é o que de fato vira 80% Funcionamento, 10% Reitorias e 10% Qualidade e
          Eficiência. Por isso a Assistência nunca aparece como uma fatia desses três: ela já foi separada antes
          de os 80/10/10 existirem, não depois.
        </p>

        {ciclos.length > 0 && (
          <div className="mt-2 flex flex-col gap-1">
            <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">
              A conta acontecendo, com números reais
            </span>
            <CalculoAoVivo ciclos={ciclos} />
          </div>
        )}
      </div>

      <Bloco
        id="funcionamento"
        titulo="Funcionamento"
        fatia="A maior fatia do orçamento (por volta de 80%)"
        resumo="Custeia o dia a dia de cada câmpus: energia, água, manutenção, materiais, contratos de serviço. É rateado essencialmente por matrícula."
      >
        <p>
          A MDO conta, para cada câmpus, quantos alunos ele tem em cada modalidade (presencial, EAD, EAD MOOC,
          EAD com financiamento próprio), mas não a matrícula bruta simples: cada aluno entra com um peso
          diferente conforme o curso (um curso técnico de carga horária longa pesa mais que um curso rápido de
          qualificação, por exemplo), numa conta que a MDO chama de <strong>matrícula equalizada</strong>.
        </p>
        <p>
          O valor total do bloco Funcionamento é dividido pela matrícula equalizada de toda a rede, dando um
          "valor por matrícula" diferente para cada modalidade. Multiplicando o valor da modalidade certa pela
          matrícula equalizada de um câmpus específico, chega-se ao Funcionamento daquele câmpus:
        </p>
        {taxasModalidade.length > 0 && (
          <TabelaPesos
            anos={taxasModalidade.map((t) => t.ano)}
            formatar={(v) => reaisPorMatricula.format(v)}
            linhas={[
              { rotulo: "Presencial", valores: taxasModalidade.map((t) => t.presencial) },
              { rotulo: "EAD", valores: taxasModalidade.map((t) => t.ead) },
              { rotulo: "EAD MOOC", valores: taxasModalidade.map((t) => t.eadMooc) },
              { rotulo: "EAD com financiamento próprio", valores: taxasModalidade.map((t) => t.eadFp) },
            ]}
          />
        )}
        <p>
          <strong>Piso Mínimo:</strong> câmpus criados a partir de 2018 (marcados pela MDO, não deduzido
          automaticamente pela data) têm garantia de receber pelo menos um valor mínimo fixo, mesmo que a conta
          da matrícula desse um valor menor, para não penalizar um câmpus novo que ainda está crescendo. Esse
          piso é reservado de dentro do próprio bloco Funcionamento antes de ratear o resto, não somado por
          cima.
        </p>
        <p>
          <strong>Reitorias</strong> recebem uma fatia à parte (cerca de 10% do total, antes do rateio por
          câmpus), proporcional ao peso de matrícula de cada instituição na rede.
        </p>
      </Bloco>

      <Bloco
        id="qualidade-eficiencia"
        titulo="Qualidade e Eficiência"
        fatia="Uma fatia menor (por volta de 10%)"
        resumo="Premia instituições (não câmpus individualmente) por três indicadores de desempenho acadêmico e de gestão."
      >
        <p>Divide-se em três indicadores, cada um com seu próprio peso dentro deste bloco:</p>
        <ul className="list-disc pl-5">
          <li>
            <strong>IEA (Índice de Eficiência Acadêmica)</strong>: mede, para cada ciclo de curso, quantos alunos
            concluíram no prazo e quantos ficaram retidos além do previsto. Quanto melhor a eficiência da
            instituição, maior a faixa de peso que ela recebe.
          </li>
          <li>
            <strong>RAP (Relação Aluno-Professor)</strong>: mede quantos alunos presenciais existem por
            professor equivalente. Faixas de peso recompensam uma relação mais alta (mais alunos por professor,
            até um limite), como sinal de uso eficiente do corpo docente.
          </li>
          <li>
            <strong>IAPL (Atendimento aos Percentuais Legais)</strong>: mede se a instituição atinge patamares
            mínimos de oferta em três categorias (cursos técnicos, formação de professores, PROEJA), definidos
            em lei. Também opera em faixas: só a partir de um patamar mínimo a instituição começa a pontuar.
          </li>
        </ul>
        <p>
          Cada indicador é calculado uma vez por <strong>instituição</strong> (nunca por câmpus isoladamente:
          somam-se primeiro os números de todos os câmpus, e só então se calcula o indicador da rede daquele
          instituto), enquadrado numa faixa de peso, e o valor resultante é o que aparece no Comparativo e na
          Consulta em nível de instituição.
        </p>
      </Bloco>

      <Bloco
        id="assistencia"
        titulo="Assistência Estudantil"
        fatia="Separada do total ANTES do 80/10/10, não uma fatia de dentro dele"
        resumo="Custeia bolsas, moradia estudantil, alimentação e outros apoios diretos ao estudante."
      >
        <p>
          É rateada por uma lógica parecida com o Funcionamento (matrícula equalizada por câmpus, separada por
          modalidade), mas com um ingrediente a mais: um peso por faixa de renda per capita das famílias dos
          estudantes de cada instituição; quanto menor a renda, maior o peso. Existe também uma parcela
          específica para alunos em Regime de Internato Pleno (RIP), ratada à parte pela quantidade desses
          alunos em cada câmpus.
        </p>
        <p>
          Esses dois ingredientes (faixa de renda e RIP) não vêm dos microdados públicos de matrícula da PNP;
          são levantamentos próprios da MDO/CONIF, o que é mais um motivo para este sistema nunca tentar
          recalculá-los: só a MDO tem esse dado de origem.
        </p>
        <p>
          A ordem importa: a MDO separa a Assistência (e um pequeno ajuste) do valor de referência total antes
          de dividir o restante em Funcionamento/Reitorias/Qualidade e Eficiência, não depois. Some as duas
          etapas e o total bate: valor de referência = Assistência + ajuste + (Funcionamento + Reitorias +
          Qualidade e Eficiência).
        </p>
      </Bloco>

      <div className="flex flex-col gap-2 rounded-lg border border-amber-300 bg-amber-50 p-5 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
        <h2 className="font-semibold">Por que este sistema não recalcula nada disso</h2>
        <p>
          Reconstruir essa conta inteira a partir dos microdados públicos da PNP não funciona: pelo menos três
          ingredientes centrais (a tabela de peso por curso usada na matrícula equalizada, a faixa de renda por
          instituição, e a quantidade de alunos RIP) não existem em nenhum arquivo público da PNP, só a própria
          MDO tem esses dados de origem, e alguns fecham apenas no fim do ano, depois de sete etapas de
          homologação entre as instituições e o IFTM. Por isso este sistema importa diretamente o resultado que
          a MDO já homologou, em vez de tentar reproduzir a fórmula, com uma exceção: em{" "}
          <Link href="/conferencia" className={PROSE_LINK}>
            Conferência
          </Link>
          , os blocos IEA, RAP e IAPL são refeitos a partir dos mesmos componentes que a MDO publica, só para
          comparar com o oficial e apontar divergência, nunca para decidir quanto uma instituição recebe.
        </p>
      </div>
    </main>
  );
}

function Bloco({
  id,
  titulo,
  fatia,
  resumo,
  children,
}: {
  id?: string;
  titulo: string;
  fatia: string;
  resumo: string;
  children: React.ReactNode;
}) {
  return (
    <div id={id} className="flex scroll-mt-8 flex-col gap-3 rounded-lg border border-neutral-200 p-5 dark:border-neutral-800">
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">{titulo}</h2>
        <p className="text-xs font-medium uppercase tracking-wide text-if-green">{fatia}</p>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">{resumo}</p>
      </div>
      <div className="flex flex-col gap-3 border-t border-neutral-100 pt-3 text-sm text-neutral-700 dark:border-neutral-800 dark:text-neutral-300">
        {children}
      </div>
    </div>
  );
}
