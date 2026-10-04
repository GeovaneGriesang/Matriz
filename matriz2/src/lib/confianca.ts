/**
 * Registro único das marcações de confiança mostradas nas telas: o que está conferido,
 * o que precisa de revisão e o que foi estimado ou definido por nós. Fica num lugar só
 * para o texto não divergir entre a tela e a página "Situação dos dados", e para quem
 * resolver uma pendência mudar uma linha aqui e ver a marca sumir de todas as telas.
 *
 * Última revisão: 2026-09-30, após a reexportação da MDO de 2026-09-29.
 */

export type NivelConfianca = "CONFERIDO" | "ATENCAO" | "ESTIMADO";

export interface ItemConfianca {
  nivel: NivelConfianca;
  titulo: string;
  /** O porquê, em linguagem para quem não é da área de TI. */
  porque: string;
  /** O que precisa acontecer para a marca mudar (só em "atenção" e "estimado"). */
  paraResolver?: string;
}

export const NIVEIS: Record<NivelConfianca, { rotulo: string; descricao: string; classes: string; icone: string }> = {
  CONFERIDO: {
    rotulo: "Conferido",
    icone: "✔",
    descricao: "Bate com o número oficial da MDO ou com o Excel, conferido linha a linha.",
    classes: "border-if-green/50 bg-if-green/10 text-if-green dark:text-green-400",
  },
  ATENCAO: {
    rotulo: "Atenção",
    icone: "!",
    descricao: "Precisa de revisão: há uma inconsistência na fonte ou um dado que falta.",
    classes: "border-amber-400/60 bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  },
  ESTIMADO: {
    rotulo: "Estimado",
    icone: "~",
    descricao: "Não é dado oficial: é uma estimativa ou uma definição nossa, com premissas explicadas.",
    classes: "border-sky-400/60 bg-sky-50 text-sky-800 dark:bg-sky-950 dark:text-sky-300",
  },
};

export const CONFIANCA = {
  "sexta-fase-ifsul": {
    nivel: "CONFERIDO",
    titulo: "6ª fase do IFSul em 2027",
    porque:
      "A planilha veio com fórmulas e sem os valores. Refizemos o cálculo e ele bate ao centavo com o que o Excel calcula ao abrir o arquivo (R$ 39.322.522,89 em 1.352 ciclos).",
  },
  "regra-matricula-total": {
    nivel: "CONFERIDO",
    titulo: "Regra da Matrícula Total por ciclo",
    porque:
      "A regra (alunos, peso, carga horária, dias do ano e ICQA) reproduz exatamente os 1.352 ciclos do IFSul calculados pelo Excel. Está coberta por testes automáticos.",
  },
  "ciclos-conferencia": {
    nivel: "CONFERIDO",
    titulo: "Matrícula por ciclo e por situação (2ª fase)",
    porque: "A soma de matrículas bate com o total da 4ª fase: 134.116 em 2027 e 152.393 em 2026.",
  },
  "comparativo-institucional": {
    nivel: "CONFERIDO",
    titulo: "Comparativo por instituição",
    porque: "A participação de cada instituição soma 100% nos dois anos, como a MDO publica.",
  },
  "ifsul-5a-vs-6a": {
    nivel: "CONFERIDO",
    titulo: "5ª e 6ª fase do IFSul alinhadas aos parâmetros de 03/10",
    porque:
      "A planilha de fórmulas do IFSul (29/09) foi gerada com ajuste de R$ 110,7 mi e matrícula presencial de R$ 1.228,90. O IFTM publicou os parâmetros vigentes de 03/10 (ajuste de R$ 90.708.325,32 e R$ 1.239,7143839 por aluno presencial) e este sistema passou a usá-los no lugar dos do arquivo. O resultado fecha com a 5ª fase: R$ 39.668.716,09 para o IFSul (diferença de 2 centavos), com no máximo 1 centavo por câmpus. O MOOC está a R$ 99,18, o critério da 5ª fase; a 6ª fase online do IFTM ainda o valora a R$ 991,77 (R$ 1,42 mi a mais, em Gravataí, Passo Fundo, Pelotas e Sapiranga).",
    paraResolver: "Pedir ao IFTM que confirme o valor do EAD MOOC na 6ª fase online (R$ 99,18 ou R$ 991,77) e que regenere a planilha de fórmulas do IFSul com os parâmetros de 03/10.",
  },
  "rede-sexta-fase": {
    nivel: "ATENCAO",
    titulo: "6ª fase das outras 41 instituições é de 31/08",
    porque:
      "Só o IFSul tem a 6ª fase de 29/09. As demais instituições continuam com a exportação antiga (31/08), calculada com outros parâmetros (matrícula presencial de R$ 1.201,47, contra R$ 1.239,71 da 5ª fase de 03/10). O arquivo de participação de 03/10 é outro relatório, um resumo por curso sem código de ciclo, e não serve para a carga por ciclo.",
    paraResolver: "Pedir ao IFTM a 6ª fase por ciclo de curso (a de 28 colunas, com Código Ciclo) da rede inteira, com os parâmetros de 03/10.",
  },
  "piso-79-53": {
    nivel: "ATENCAO",
    titulo: "Piso Mínimo: 79 câmpus marcados, piso de 53",
    porque:
      "A 5ª fase de 2027 marca 79 câmpus no piso (todos em R$ 700 mil), mas reserva o piso de só 53 (R$ 37,1 mi). Os valores por câmpus passam do bloco reservado.",
    paraResolver: "Confirmar com o IFTM qual é a lista correta de câmpus no piso.",
  },
  "piso-2026": {
    nivel: "ATENCAO",
    titulo: "Piso Mínimo de 2026 aparece zerado",
    porque:
      "Na 5ª fase de 2026 a fórmula do piso não veio calculada, então nenhum câmpus aparece no piso e o valor reservado é zero.",
    paraResolver: "Reexportar a 5ª fase de 2026 com as fórmulas calculadas.",
  },
  "mooc-2027": {
    nivel: "CONFERIDO",
    titulo: "EAD MOOC em 2027: 5ª fase corrigida a 0,08",
    porque:
      "A regra é 0,8 do presencial em 2026 e 0,08 em 2027. A 5ª fase de 2027 reexportada em 03/10 já traz o MOOC a R$ 99,18 (0,08 de R$ 1.239,71), então os valores por câmpus estão certos. A 6ª fase da rede por ciclo de curso ainda é a de 31/08, de antes da correção.",
  },
  "sem-sexta-fase-2026": {
    nivel: "ATENCAO",
    titulo: "6ª fase de 2026 só existe para o IFSul, com parâmetros derivados",
    porque:
      "Para 2026 só chegou a 6ª fase do IFSul (03/10), e o arquivo veio com as matrículas totais da rede em texto e o período da PNP em 2025. O sistema usou as matrículas somadas do relatório resumido da rede, o período de 2024 e o MOOC a 0,8, e o resultado fecha ao centavo com o 'calculado 2026' que já mostrávamos por câmpus (R$ 39,34 mi, matrícula presencial de R$ 1.173,93). Nas outras 41 instituições, 2026 só vai até o câmpus. A Matrícula Total de 537 ciclos difere da regra do motor (a de 2027): vale o número da planilha. O relatório resumido da MDO de 03/10 usa matrícula presencial de R$ 1.220,35 (3,9% a mais).",
    paraResolver: "Pedir ao IFTM o arquivo do IFSul de 2026 com as matrículas totais da rede preenchidas e o período da PNP em 2024, e o ajuste válido de 2026.",
  },
  "valor-informado": {
    nivel: "ATENCAO",
    titulo: "Valor informado (o que o câmpus recebeu) sem cadastro",
    porque:
      "O valor informado existe só para o IFSul e é digitado por um administrador em Valores recebidos. Onde não há registro, a coluna aparece vazia e a transição usa a matriz do ano anterior no lugar.",
    paraResolver: "Cadastrar o valor recebido por câmpus em Admin, Valores recebidos.",
  },
  "pnp-manual-confere": {
    nivel: "CONFERIDO",
    titulo: "PNP - Extração manual bate com a 2ª fase do IFSul",
    porque:
      "Para o IFSul em 2025, as tabelas da PNP trazem 141.815 matrículas e 2.794 evadidos, exatamente os números da 2ª fase da MDO (e o total de matrículas é o mesmo do arquivo por aluno). Ou seja, a 2ª fase parte desta mesma extração da PNP.",
  },
  "pnp-indicador-diferente-mdo": {
    nivel: "ATENCAO",
    titulo: "Indicadores do painel da PNP não são os da MDO",
    porque:
      "Os indicadores prontos do painel usam outra base que a matriz: a Eficiência Acadêmica do IFSul é 98% no painel e o IEA que a MDO usa é 45%. Os números de contagem (matrículas, evadidos, concluintes) são comparáveis; os índices não. Não use o índice do painel para estimar o valor da matriz.",
    paraResolver: "Comparar sempre contagem com contagem, ou recalcular o índice com a regra da MDO.",
  },
  "pnp-orcamento-por-instituicao": {
    nivel: "ESTIMADO",
    titulo: "Orçamento da PNP não é a matriz da MDO",
    porque:
      "O painel Dados Orçamentários mostra o que a PNP registra de dotação, execução e descentralização por instituição (e por região, estado e rede), nunca por câmpus. Não é a distribuição da matriz, e a relação do órgão (UO, UGE, TED's) muda o total: compare sempre dentro da mesma opção.",
  },
  "peso-efetivo-tabela": {
    nivel: "ESTIMADO",
    titulo: "Tabela de peso efetivo por curso",
    porque:
      "A MDO não publica o peso que realmente aplica. Ele foi deduzido da Matrícula Total publicada, curso a curso, e a dedução concorda com 99,77% dos 49.391 ciclos da 6ª fase de 2027 (rede sem o IFSul). Funciona como regra de leitura, mas foi medida na mesma amostra de onde saiu: em curso novo ou em outro ano ela pode não achar a linha.",
    paraResolver: "Pedir à MDO a tabela oficial de pesos por curso e carga horária mínima, ou conferir a tabela com a 6ª fase de outro ano.",
  },
  "custo-evadido": {
    nivel: "ATENCAO",
    titulo: "Perda por evasão mudou de definição",
    porque:
      "Na 6ª fase nova o Custo Evadido do aluno retido vale metade do que valia na exportação antiga (R$ 0,56 mi contra R$ 1,11 mi no IFSul). Não é comparável entre as duas versões.",
    paraResolver: "Confirmar com o IFTM a definição atual.",
  },
  "simulador-curso": {
    nivel: "ESTIMADO",
    titulo: "Simulador de curso",
    porque:
      "A regra do repasse é a oficial, mas o cenário é hipotético: turma entrando em março, vagas e evasão constantes por ano e valor da matrícula fixo (ou diluído de forma aproximada). Mede só o repasse: custo de professor, sala e permanência não entra.",
  },
  "distribuicao-indices": {
    nivel: "ESTIMADO",
    titulo: "Distribuição entre câmpus, em transição",
    porque:
      "Os índices de qualidade e eficiência por câmpus são uma proposta nossa, calculada com a 2ª fase. A MDO só calcula o IEA por instituição. O plano de transição é simulação, não regra da CONIF. Só o bloco Funcionamento é distribuído.",
    paraResolver: "Validar com a gestão qual índice e qual ritmo de transição serão usados.",
  },
  "valor-aluno-definicoes": {
    nivel: "ESTIMADO",
    titulo: "Valor do aluno em ano cheio e percentual do câmpus",
    porque:
      "O valor efetivo (valor do curso dividido pelos alunos) é direto do dado. O valor em ano cheio e o percentual sobre a soma dos ciclos antes do Piso são definições nossas para facilitar a comparação entre cursos.",
  },
  "agropecuaria-inferida": {
    nivel: "ESTIMADO",
    titulo: "Agropecuária deduzida em outras instituições",
    porque:
      "A exportação da rede não traz a coluna de agropecuária. Para instituições que não são o IFSul ela é deduzida comparando a Matrícula Total publicada com e sem o bônus de 50%, e o ano-base da PNP é suposto como o ciclo menos dois.",
  },
  "explicacao-variacao": {
    nivel: "ESTIMADO",
    titulo: "Explicação da variação da matriz",
    porque:
      "Os quatro efeitos somam exatamente a diferença (conferido por testes). Mas a divisão entre efeito do orçamento e efeito da matrícula da rede é inferida do valor da matrícula, e o efeito do piso absorve diferenças da fonte (como o MOOC de 2027).",
  },
} as const satisfies Record<string, ItemConfianca>;

export type IdConfianca = keyof typeof CONFIANCA;
