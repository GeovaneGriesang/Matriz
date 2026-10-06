import type { ReactNode } from "react";

/**
 * Os termos das telas da PNP, explicados na própria tela (o sistema é didático: nada de sigla solta). Os textos resumem conceitos do orçamento
 * público e do painel da PNP; a definição oficial de cada indicador está no glossário da própria PNP.
 */

/** O que cada "Relação do órgão" quer dizer, para mostrar junto do filtro. */
export const DESCRICAO_RELACAO_ORGAO: Record<string, string> = {
  "Órgão da UO":
    "Valores contados pela Unidade Orçamentária (UO): o órgão a que a lei orçamentária destina a dotação. Para o IFSul, é a UO 26436, que reúne todos os câmpus e a Reitoria.",
  "Órgão da UGE":
    "Valores contados pela Unidade Gestora Executora (UGE): a unidade que de fato executa a despesa. Cada câmpus e a Reitoria têm a sua. A soma das UGEs de uma instituição pode diferir da UO, porque a UGE também executa crédito recebido de outros órgãos.",
  "TED's":
    "Créditos recebidos por Termo de Execução Descentralizada (TED): o instrumento pelo qual um órgão repassa crédito a outro para executar um projeto ou programa. Não é o orçamento próprio da instituição.",
  "TED's do MEC":
    "As TEDs em que quem repassa o crédito é o Ministério da Educação (MEC), por exemplo para projetos e programas da Secretaria de Educação Profissional e Tecnológica.",
};

function Termo({ nome, children }: { nome: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="font-medium text-neutral-900 dark:text-neutral-100">{nome}</dt>
      <dd className="text-neutral-600 dark:text-neutral-400">{children}</dd>
    </div>
  );
}

function Quadro({ titulo, children, aberto }: { titulo: string; children: ReactNode; aberto?: boolean }) {
  return (
    <details open={aberto} className="rounded-lg border border-neutral-200 p-4 text-sm dark:border-neutral-800">
      <summary className="cursor-pointer text-sm font-semibold text-neutral-900 dark:text-neutral-100">{titulo}</summary>
      <dl className="mt-3 flex flex-col gap-3">{children}</dl>
    </details>
  );
}

export function GlossarioPnpOrcamento({ aberto }: { aberto?: boolean }) {
  return (
    <div className="flex flex-col gap-3">
      <Quadro titulo="Como ler esta tela: as tabelas do painel orçamentário" aberto={aberto}>
        <Termo nome="Execução do Exercício">
          O que aconteceu com o orçamento do ano: a dotação (o valor autorizado), o que foi empenhado, liquidado e pago, e o crédito que ainda está disponível.
        </Termo>
        <Termo nome="Exercício e RP">A execução do ano somada aos restos a pagar, para ver o gasto total que pesou sobre o caixa.</Termo>
        <Termo nome="Restos a Pagar (RP)">
          Despesas que foram empenhadas num ano e ficaram para ser pagas depois. A tabela mostra o que foi inscrito, cancelado e pago.
        </Termo>
        <Termo nome="Descentralizações">
          Crédito que a instituição recebeu de outros órgãos, ou repassou, para executar um objeto (destaques, provisões e TEDs). Não faz parte do orçamento
          que a matriz distribui.
        </Termo>
        <Termo nome="Programação Orçamentária">O que estava programado para gastar, antes da execução.</Termo>
        <Termo nome="Gastos Totais da Rede e Indicadores Orçamentários">
          O gasto total da Rede Federal e indicadores derivados, como o gasto por matrícula equivalente (o gasto dividido pelas matrículas ajustadas por carga
          horária e peso do curso).
        </Termo>
        <Termo nome="Panorama Orçamentário e Série Histórica">
          O resumo do orçamento e a sua evolução mês a mês. Na série, o &quot;Valor Acumulado&quot; soma desde janeiro até o mês, e o &quot;Valor Nominal&quot; é o
          valor da época, sem correção pela inflação.
        </Termo>
      </Quadro>

      <Quadro titulo="Relação do órgão: sob que ótica o valor é contado" aberto={aberto}>
        {Object.entries(DESCRICAO_RELACAO_ORGAO).map(([nome, texto]) => (
          <Termo key={nome} nome={nome}>
            {texto}
          </Termo>
        ))}
        <Termo nome="UO e UGE, em uma frase">
          A UO é &quot;de quem é o dinheiro&quot; na lei do orçamento; a UGE é &quot;quem gasta&quot;. Uma instituição tem uma UO e várias UGEs (uma por câmpus e uma para a Reitoria).
        </Termo>
      </Quadro>

      <Quadro titulo="Os estágios da despesa" aberto={aberto}>
        <Termo nome="Dotação atualizada">O valor autorizado para o ano, com os créditos abertos durante ele.</Termo>
        <Termo nome="Despesa empenhada">O valor que a instituição reservou para uma despesa. É o primeiro estágio.</Termo>
        <Termo nome="Despesa liquidada">A entrega do serviço ou do bem foi conferida e a despesa pode ser paga.</Termo>
        <Termo nome="Despesa paga">O dinheiro saiu.</Termo>
        <Termo nome="Empenhada a liquidar">O que foi reservado mas ainda não foi entregue ou conferido.</Termo>
        <Termo nome="Crédito disponível">A parte da dotação que ainda não foi empenhada.</Termo>
      </Quadro>

      <Quadro titulo='O que "Detalhar por" abre' aberto={aberto}>
        <Termo nome="Ação Orçamentária">A finalidade da despesa na lei orçamentária, por exemplo 20RL (funcionamento das instituições) e 2994 (assistência aos estudantes).</Termo>
        <Termo nome="Grupo de Despesas (GND)">Se a despesa é com pessoal, com outras despesas correntes (custeio) ou com investimentos.</Termo>
        <Termo nome="Elemento, Item e Natureza de Despesa Detalhada">Três níveis cada vez mais finos do que foi comprado ou pago (diárias, material de consumo, obras...).</Termo>
        <Termo nome="Plano Orçamentário">Uma divisão interna de uma ação, para acompanhar uma finalidade específica.</Termo>
        <Termo nome="Programa Orçamentário">O conjunto de ações da lei orçamentária ao qual a despesa pertence.</Termo>
        <Termo nome="Fonte de Recursos">De onde vem o dinheiro: tesouro, recursos próprios, convênios.</Termo>
        <Termo nome="Identificador de Resultado (RP)">Classifica a despesa como obrigatória, discricionária ou vinda de emenda parlamentar.</Termo>
        <Termo nome="Unidade Orçamentária">A instituição que recebe a dotação na lei (a UO).</Termo>
      </Quadro>
    </div>
  );
}

export function GlossarioPnpEnsino({ aberto }: { aberto?: boolean }) {
  return (
    <div className="flex flex-col gap-3">
      <Quadro titulo="Como ler esta tela: o que cada tabela mostra" aberto={aberto}>
        <Termo nome="Situação de Matrícula">Quantos alunos estão em curso, concluíram, evadiram ou estão retidos, ano a ano.</Termo>
        <Termo nome="Eficiência Acadêmica">De quem teve um desfecho, quantos concluíram: conclusão dividida por conclusão mais evasão. É a base do indicador IEA da matriz.</Termo>
        <Termo nome="Taxa de Evasão Anual">Quantos dos matriculados no ano saíram sem concluir (evadidos dividido por matrículas).</Termo>
        <Termo nome="Curso, Matrícula e Oferta">Os cursos, as matrículas e as vagas oferecidas.</Termo>
        <Termo nome="Matrículas por Professor (RAP)">Quantos alunos presenciais há por professor equivalente; a meta legal é 20.</Termo>
        <Termo nome="Percentuais Legais (apenas IFs)">
          Quanto da oferta é de cursos técnicos, de formação de professores e de educação de jovens e adultos, para conferir os mínimos que a lei exige dos Institutos Federais.
        </Termo>
        <Termo nome="Índice de Verticalização, Taxa de Ocupação e Relação Inscritos-Vagas">
          Verticalização: quanto da oferta vai do ensino médio à graduação num mesmo eixo. Ocupação: vagas preenchidas. Relação inscritos-vagas: a procura por vaga.
        </Termo>
        <Termo nome="Reserva de Vagas e Vagas Noturnas">Quanto das vagas é reservado por lei (cotas) e quanto é ofertado à noite.</Termo>
        <Termo nome="Perfis de Matrículas, Docentes, Técnicos-administrativos, Titulação docente">
          Quem são os alunos (idade, sexo, raça, renda, deficiência), e os servidores da instituição, com a titulação dos docentes.
        </Termo>
      </Quadro>
      <Quadro titulo="Níveis, edição e ano-base" aberto={aberto}>
        <Termo nome="Rede, Instituição e Câmpus">O nível diz o tamanho do recorte: toda a Rede Federal, uma instituição ou um câmpus. Nem toda tabela existe nos três níveis.</Termo>
        <Termo nome="Detalhar por">Abre a tabela por uma característica (modalidade, tipo de curso, eixo tecnológico, renda, sexo...). &quot;Sem detalhamento&quot; mostra só o total.</Termo>
        <Termo nome="Ano-base">O ano a que os números se referem. A matriz de um ano usa a PNP de dois anos antes.</Termo>
        <Termo nome="Edição da PNP">A PNP revisa os números a cada edição. Cada edição é uma carga separada; a tela mostra uma por vez para não somar o mesmo ano duas vezes.</Termo>
      </Quadro>
    </div>
  );
}
