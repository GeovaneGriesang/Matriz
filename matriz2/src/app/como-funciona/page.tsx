import Link from "next/link";
import { FORM_MAX_WIDTH, PROSE_LINK } from "@/lib/layoutWidths";
import { requireAcessoPlenoOrRedirect } from "@/server/auth/session";
import { prisma } from "@/server/db/prisma";
import { CalculoAoVivo } from "./CalculoAoVivo";
import { TabelaPesos } from "./TabelaPesos";

export const dynamic = "force-dynamic";

const reaisPorMatricula = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const numero = new Intl.NumberFormat("pt-BR");
const umaCasa = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

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
  // Distribuição real dos pesos de curso técnico no ciclo mais recente (pedido do
  // usuário: ver o critério de laboratórios do CNCT acontecendo de verdade, não só
  // descrito). "TÉCNICO" é o nível mais direto pra isso: os quatro pesos (1,0 a 2,5)
  // vêm exatamente da quantidade de laboratórios do curso, sem outra regra
  // misturada (diferente de GRADUAÇÃO, que mistura Licenciatura fixa com
  // Tecnologia/Bacharelado por verticalização).
  const anoMaisRecente = ciclosBrutos[0]?.ano;
  const pesosCursoTecnico = anoMaisRecente
    ? await prisma.distribuicaoCiclo.groupBy({
        by: ["pesoCursoMatriz"],
        where: { ano: anoMaisRecente, nivel: "TÉCNICO", pesoCursoMatriz: { not: null } },
        _count: true,
      })
    : [];
  const totalCursosTecnicos = pesosCursoTecnico.reduce((s, p) => s + p._count, 0);
  const pesosCursoTecnicoOrdenado = pesosCursoTecnico
    .map((p) => ({ peso: Number(p.pesoCursoMatriz), quantidade: p._count }))
    .sort((a, b) => a.peso - b.peso);

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
          EAD com financiamento próprio), mas não a matrícula bruta simples: cada aluno entra com um valor
          ajustado em quatro etapas, numa conta que a MDO chama de <strong>Matrícula Total</strong>. As duas
          primeiras etapas acontecem por curso; a terceira, quando é o caso; a quarta soma tudo.
        </p>

        <p>
          <strong>Etapa 1, Equalização:</strong> antes de qualquer peso, a matrícula de cada curso é ajustada
          por dois fatores: a carga horária do curso em relação a uma carga horária padrão de 800 horas por
          ano, e os dias ativos do curso dentro do "período analisado" (o ano do ciclo). Um curso com mais
          carga horária por ano do que o padrão pesa mais; um curso que só existiu parte do ano (começou,
          terminou, ou tem alunos retidos há muito tempo) conta proporcionalmente menos dias. O resultado é a
          MECHDA (Matrículas Equalizadas por Carga Horária e Dias Ativos), a base sobre a qual o peso do curso
          (Etapa 2, logo abaixo) é multiplicado.
        </p>
        <p className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 dark:border-neutral-800 dark:bg-neutral-900">
          <strong>A conta exata, por ciclo de curso:</strong> Matrícula Total = alunos × ICQA × peso do curso × bônus de
          agropecuária (1,5) × (CH que conta ÷ 800) × (dias do ciclo dentro do ano-base ÷ dias do ciclo). A CH que conta é a
          menor entre a do ciclo e a da matriz (nos ciclos de até um ano, é a da matriz), e o ICQA é 1 para o aluno regular,
          0,5 para o retido dentro do prazo (que ainda conta só 182,5 dias) e 0 para o jubilado. Esta regra reproduz, ao centavo,
          os 1.352 ciclos do IFSul de 2027. Para ver a conta de cada turma, abra{" "}
          <Link href="/consulta/valor-do-aluno" className={PROSE_LINK}>
            Quanto vale um aluno
          </Link>
          ; para comparar formas de ofertar um curso (por exemplo 3 ou 4 anos), o{" "}
          <Link href="/simulador/curso" className={PROSE_LINK}>
            Simulador de curso
          </Link>
          .
        </p>
        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          Um detalhe pouco óbvio sobre dias ativos: se o curso já devia ter terminado mas ainda tem aluno
          matriculado (retenção), esse aluno conta só 182,5 dias (metade do ano) se a retenção tem até 3 anos, e
          não conta nada se passou de 3 anos, mesmo que continue matriculado oficialmente. Os campos "Início do
          ciclo", "Término do ciclo" e "Dias do ciclo" que aparecem ao comparar cursos em Consulta vêm
          exatamente desse cálculo.
        </p>
        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          Duas cargas horárias diferentes, não confundir: a "carga horária padrão de 800 horas" acima é só a
          referência usada nesta conta, igual pra qualquer curso; a "CH mínima MEC" que aparece ao comparar
          cursos em Consulta é outra coisa, o mínimo de horas que o MEC exige daquele tipo específico de curso, e
          vem pronta da MDO, não é algo que este sistema calcule.
        </p>

        <p>
          <strong>Etapa 2, Ponderação:</strong> a matrícula equalizada de cada curso (resultado da Etapa 1) é
          multiplicada por um peso que depende do tipo de curso, conforme o anexo da Portaria MEC 243/2026
          (que revogou a 646/2022 e manteve esses critérios). Cursos técnicos e a graduação tecnológica/bacharelado seguem um "critério de referência": o
          peso vem da quantidade de laboratórios previstos no Catálogo Nacional de Cursos Técnicos (CNCT,
          edição 2014).
        </p>
        <div className="tabela-rolavel rounded-md border border-neutral-200 dark:border-neutral-800">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-left dark:bg-neutral-900">
              <tr>
                <th className="px-3 py-2 font-medium text-neutral-600 dark:text-neutral-400">Curso ou critério</th>
                <th className="px-3 py-2 text-right font-medium text-neutral-600 dark:text-neutral-400">Peso</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
              <tr><td className="px-3 py-2">FIC</td><td className="px-3 py-2 text-right tabular-nums">1,0</td></tr>
              <tr><td className="px-3 py-2">Ensino Básico</td><td className="px-3 py-2 text-right tabular-nums">2,0</td></tr>
              <tr><td className="px-3 py-2">Ensino Fundamental I</td><td className="px-3 py-2 text-right tabular-nums">2,0</td></tr>
              <tr><td className="px-3 py-2">Ensino Fundamental II</td><td className="px-3 py-2 text-right tabular-nums">1,5</td></tr>
              <tr><td className="px-3 py-2">Ensino Médio</td><td className="px-3 py-2 text-right tabular-nums">1,5</td></tr>
              <tr><td className="px-3 py-2">Técnico, 1 laboratório</td><td className="px-3 py-2 text-right tabular-nums">1,0</td></tr>
              <tr><td className="px-3 py-2">Técnico, 2 laboratórios</td><td className="px-3 py-2 text-right tabular-nums">1,5</td></tr>
              <tr><td className="px-3 py-2">Técnico, 3 laboratórios</td><td className="px-3 py-2 text-right tabular-nums">2,0</td></tr>
              <tr><td className="px-3 py-2">Técnico, 4 ou mais laboratórios (integrado, no mínimo 1,5)</td><td className="px-3 py-2 text-right tabular-nums">2,5</td></tr>
              <tr><td className="px-3 py-2">Proeja</td><td className="px-3 py-2 text-right tabular-nums">2,5</td></tr>
              <tr><td className="px-3 py-2">Superior, Tecnologia e Bacharelado</td><td className="px-3 py-2 text-right tabular-nums">1,0 a 2,5 (mesmo critério de laboratórios)</td></tr>
              <tr><td className="px-3 py-2">Superior, Licenciatura</td><td className="px-3 py-2 text-right tabular-nums">2,5</td></tr>
              <tr><td className="px-3 py-2">Pós-graduação Lato Sensu</td><td className="px-3 py-2 text-right tabular-nums">pelo critério de referência</td></tr>
              <tr><td className="px-3 py-2">Pós-graduação Stricto Sensu</td><td className="px-3 py-2 text-right tabular-nums">3,75 (2,5 + bônus de 50%)</td></tr>
            </tbody>
          </table>
        </div>
        {totalCursosTecnicos > 0 && (
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            Isso acontece de verdade: no ciclo {anoMaisRecente}, dos {numero.format(totalCursosTecnicos)} ciclos
            de curso técnico carregados,{" "}
            {pesosCursoTecnicoOrdenado
              .map((p) => `${numero.format(p.quantidade)} têm peso ${umaCasa.format(p.peso)}`)
              .join(", ")}
            , as quatro faixas de laboratório do guia, todas presentes.
          </p>
        )}
        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          Área/eixo tecnológico e tipo de oferta não têm peso próprio: são campos que classificam o curso (a
          área/eixo é o que decide, por exemplo, o eixo do CNCT usado pra contar os laboratórios acima) e
          aparecem noutros indicadores (o IAPL, no bloco Qualidade e Eficiência, mede %ME por categoria de
          curso), mas não multiplicam a matrícula por fora do Peso do Curso já explicado.
        </p>

        <p>
          <strong>Etapa 3, Bonificação:</strong> cursos da área de agropecuária recebem mais 50% sobre a
          matrícula já ponderada (Etapa 2), por cima de qualquer um dos pesos acima, pela necessidade de manter
          a fazenda em funcionamento.
        </p>
        <p>
          <strong>Etapa 4, Consolidação:</strong> soma-se a matrícula de todos os cursos de um câmpus, já
          equalizada, ponderada e bonificada, chegando à Matrícula Total daquele câmpus, separada por
          modalidade. É essa Matrícula Total, e não a matrícula bruta, que multiplica o "valor por matrícula" de
          cada modalidade (o valor total do bloco Funcionamento dividido pela Matrícula Total de toda a rede)
          para chegar ao Funcionamento daquele câmpus:
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

      <Bloco
        id="execucao"
        titulo="Do valor da matriz ao dinheiro gasto"
        fatia="Depois da matriz: orçamento aprovado, empenho e pagamento"
        resumo="Em Orçamento da União, a execução de cada ação e de cada câmpus no ano, lida do Portal da Transparência."
      >
        <p>
          A matriz diz quanto cabe a cada câmpus. O dinheiro, porém, só vira gasto em três passos: o <strong>empenho</strong> (a unidade
          reserva o valor para uma despesa), a <strong>liquidação</strong> (o serviço ou bem foi entregue e conferido) e o{" "}
          <strong>pagamento</strong>. O Portal da Transparência da CGU publica esses três valores todo mês, por unidade gestora (UG) e por
          ação orçamentária. Cada câmpus e a Reitoria têm a sua UG.
        </p>
        <p>
          As ações que interessam à matriz são a <strong>20RL</strong> (funcionamento das instituições), a <strong>2994</strong>{" "}
          (assistência aos estudantes) e a <strong>20RG</strong> (reestruturação). O sistema guarda, mês a mês, o empenhado, o liquidado e o
          pago dessas três por UG, e mostra em{" "}
          <Link href="/orcamento-da-uniao" className={PROSE_LINK}>
            Orçamento da União
          </Link>{" "}
          dois quadros: a execução de cada ação (inicial, atualizado, empenhado, realizado) e a comparação por câmpus entre o valor da matriz
          e o que a UG pagou.
        </p>
        <p>
          <strong>Cuidado ao comparar:</strong> o valor da matriz e o gasto da UG não são a mesma coisa. A matriz é uma referência de
          distribuição; a UG também executa emenda parlamentar, crédito suplementar e dinheiro descentralizado, e paga conforme o calendário do ano. Um câmpus com
          pago abaixo do valor da matriz em setembro ainda pode fechar o ano dentro dele, e um acima não gastou "a mais" por isso. A Reitoria concentra
          despesas centrais da instituição, então não é comparada com a matriz. Os restos a pagar, que são despesas de anos anteriores pagas neste ano, ficam
          fora da conta.
        </p>
      </Bloco>

      <Bloco
        id="salvar-simulacoes"
        titulo="Salvar simulações e consultas, e compartilhar"
        fatia="Para não refazer toda a configuração, e para trabalhar junto"
        resumo="Na barra do alto de cada tela de simulação ou de consulta com filtros."
      >
        <p>
          Nas telas de simulação (cenários, curso novo, 3 ou 4 anos, comparação de alternativas, distribuição entre câmpus, evasão, RAP e IAPL) e nas consultas com filtros, a barra do alto tem a
          lista <strong>Simulações salvas</strong> (ou <strong>Consultas salvas</strong>). <strong>Salvar como…</strong> guarda o que está na tela com o nome que você der; <strong>Carregar</strong>{" "}
          traz de volta tudo como estava; <strong>Salvar</strong> grava por cima da que está em uso; <strong>Renomear</strong> muda o nome. Numa consulta, o que se guarda são os filtros escolhidos.
        </p>
        <p>
          O que você salva é <strong>só seu</strong>. Com <strong>Compartilhar…</strong> você escolhe quem também a verá: há <em>Marcar todos</em>, <em>Desmarcar todos</em> e{" "}
          <em>Inverter seleção</em>, e a busca por nome ou e-mail vale para essas ações (quem está marcado fora da busca não é desmarcado sem querer). Quem recebe vê a simulação na lista dela,
          em &quot;Compartilhadas comigo&quot;, e pode carregá-la, mas não pode alterá-la: se quiser mexer, usa <strong>Salvar como…</strong> e fica com uma cópia sua.
        </p>
        <p>
          <strong>Duas pessoas não salvam a mesma simulação ao mesmo tempo.</strong> Cada salvamento informa a versão que foi carregada; se outra pessoa (ou outra janela sua) salvou no meio, o
          sistema recusa o seu salvamento, avisa quem salvou e oferece carregar a versão salva ou salvar a sua como cópia. Assim ninguém apaga o trabalho do outro sem perceber. O super-administrador
          vê as simulações de todos nas mesmas telas, com o nome de quem as criou, e pode excluí-las, mas não sobrescrevê-las.
        </p>
      </Bloco>

      <Bloco
        id="imprimir-e-exportar"
        titulo="Imprimir, salvar em PDF e baixar CSV"
        fatia="Em todas as telas, para levar os números para uma reunião ou para o Excel"
        resumo="Botões na página, em cada quadro e em cada tabela."
      >
        <p>
          No alto de cada tela há a barra <strong>Esta página</strong>: <strong>Imprimir / PDF</strong> imprime a tela inteira, e <strong>CSV das tabelas</strong> baixa todas as
          tabelas da página em um só arquivo, cada uma com o seu título. Cada <strong>quadro</strong> (as caixas das telas) tem um botão Imprimir / PDF na borda de cima, e cada{" "}
          <strong>tabela</strong> tem os botões CSV e Imprimir / PDF logo acima dela. Assim dá para levar só o que interessa.
        </p>
        <p>
          O sistema não gera o PDF sozinho: ele abre a janela de impressão do navegador, e na lista de impressoras você escolhe <strong>Salvar como PDF</strong>. A impressão sai
          sem o menu e os botões, com a tabela inteira (sem barra de rolagem) e em fundo claro, na horizontal.
        </p>
        <p>
          O CSV abre direto no Excel em português: separador ponto e vírgula e acentos corretos. Os valores em reais saem como número puro (sem &quot;R$&quot; e sem ponto de milhar),
          para você somar e ordenar, e os percentuais mantêm o &quot;%&quot;. O que a tela mostra com filtro ou escolha (um câmpus, um ano) é o que vai para o arquivo.
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
