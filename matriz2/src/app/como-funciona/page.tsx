import { FORM_MAX_WIDTH } from "@/lib/layoutWidths";
import { requireAcessoPlenoOrRedirect } from "@/server/auth/session";

export const dynamic = "force-dynamic";

export default async function ComoFuncionaPage() {
  await requireAcessoPlenoOrRedirect("/como-funciona");

  return (
    <main className={`mx-auto flex ${FORM_MAX_WIDTH} flex-col gap-8 px-6 py-16`}>
      <div className="flex flex-col gap-3">
        <h1 className="text-3xl font-semibold text-neutral-900 dark:text-neutral-100">Como funciona a matriz</h1>
        <p className="text-neutral-600 dark:text-neutral-400">
          A Matriz de Distribuição Orçamentária é calculada pela MDO (mdo.iftm.edu.br), sistema oficial da Rede
          Federal operado pelo IFTM. O Matriz2 <strong>não recalcula</strong> nada disso: importa o resultado já
          homologado. Esta página explica o que cada bloco significa e, a grosso modo, como a MDO chega a esse
          número — para que os valores que você vê nas outras telas façam sentido, mesmo sem reproduzir a conta
          aqui dentro.
        </p>
      </div>

      <div className="flex flex-col gap-2 rounded-lg border border-neutral-200 bg-neutral-50 p-5 dark:border-neutral-800 dark:bg-neutral-900">
        <h2 className="font-semibold text-neutral-900 dark:text-neutral-100">A ideia geral</h2>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          Todo ano, o Congresso aprova um valor total para a Rede Federal de Educação Profissional, Científica e
          Tecnológica (42 institutos e centros federais, mais de 600 câmpus). Esse valor único precisa ser
          repartido entre todas as instituições, e a MDO faz isso em blocos, cada um com uma lógica própria de
          rateio. Praticamente todo o dinheiro é distribuído por dois grandes blocos, mais uma verba separada de
          assistência estudantil.
        </p>
      </div>

      <Bloco
        titulo="Funcionamento"
        fatia="A maior fatia do orçamento (por volta de 80%)"
        resumo="Custeia o dia a dia de cada câmpus: energia, água, manutenção, materiais, contratos de serviço. É rateado essencialmente por matrícula."
      >
        <p>
          A MDO conta, para cada câmpus, quantos alunos ele tem em cada modalidade (presencial, EAD, EAD MOOC,
          EAD com financiamento próprio) — mas não a matrícula bruta simples: cada aluno entra com um peso
          diferente conforme o curso (um curso técnico de carga horária longa pesa mais que um curso rápido de
          qualificação, por exemplo), numa conta que a MDO chama de <strong>matrícula equalizada</strong>.
        </p>
        <p>
          O valor total do bloco Funcionamento é dividido pela matrícula equalizada de toda a rede, dando um
          "valor por matrícula". Multiplicando esse valor pela matrícula equalizada de um câmpus específico
          (com pesos diferentes para presencial, EAD, EAD MOOC e EAD com financiamento próprio — o EAD MOOC pesa
          bem menos, cerca de 8% do peso do presencial), chega-se ao Funcionamento daquele câmpus.
        </p>
        <p>
          <strong>Piso Mínimo:</strong> câmpus criados a partir de 2018 (marcados pela MDO, não deduzido
          automaticamente pela data) têm garantia de receber pelo menos um valor mínimo fixo, mesmo que a conta
          da matrícula desse um valor menor — para não penalizar um câmpus novo que ainda está crescendo. Esse
          piso é reservado de dentro do próprio bloco Funcionamento antes de ratear o resto, não somado por
          cima.
        </p>
        <p>
          <strong>Reitorias</strong> recebem uma fatia à parte (cerca de 10% do total, antes do rateio por
          câmpus), proporcional ao peso de matrícula de cada instituição na rede.
        </p>
      </Bloco>

      <Bloco
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
        titulo="Assistência Estudantil"
        fatia="Verba orçamentária separada (ação 2994), não uma fatia do Funcionamento"
        resumo="Custeia bolsas, moradia estudantil, alimentação e outros apoios diretos ao estudante."
      >
        <p>
          É rateada por uma lógica parecida com o Funcionamento (matrícula equalizada por câmpus, separada por
          modalidade), mas com um ingrediente a mais: um peso por faixa de renda per capita das famílias dos
          estudantes de cada instituição — quanto menor a renda, maior o peso. Existe também uma parcela
          específica para alunos em Regime de Internato Pleno (RIP), ratada à parte pela quantidade desses
          alunos em cada câmpus.
        </p>
        <p>
          Esses dois ingredientes (faixa de renda e RIP) não vêm dos microdados públicos de matrícula da PNP —
          são levantamentos próprios da MDO/CONIF, o que é mais um motivo para este sistema nunca tentar
          recalculá-los: só a MDO tem esse dado de origem.
        </p>
      </Bloco>

      <div className="flex flex-col gap-2 rounded-lg border border-amber-300 bg-amber-50 p-5 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
        <h2 className="font-semibold">Por que o Matriz2 não recalcula nada disso</h2>
        <p>
          Um projeto anterior tentou reconstruir essa conta inteira a partir dos microdados públicos da PNP.
          Não funcionou: pelo menos três ingredientes centrais (a tabela de peso por curso usada na matrícula
          equalizada, a faixa de renda por instituição, e a quantidade de alunos RIP) não existem em nenhum
          arquivo público da PNP — só a própria MDO tem esses dados de origem, e alguns fecham só no fim do ano,
          depois de sete etapas de homologação entre as instituições e o IFTM. Por isso o Matriz2 importa
          diretamente o resultado que a MDO já homologou, em vez de tentar reproduzir a fórmula.
        </p>
      </div>
    </main>
  );
}

function Bloco({
  titulo,
  fatia,
  resumo,
  children,
}: {
  titulo: string;
  fatia: string;
  resumo: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-neutral-200 p-5 dark:border-neutral-800">
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
