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
    nivel: "ATENCAO",
    titulo: "5ª e 6ª fase do IFSul não coincidem",
    porque:
      "Foram exportadas com parâmetros diferentes: a 6ª usa ajuste de R$ 110,7 mi e matrícula presencial de R$ 1.228,90; a 5ª, R$ 90,0 mi e R$ 1.154,24. O IFSul tem 37.080 de matrícula total numa e 40.505 na outra. Por isso o total do IFSul muda conforme a tela.",
    paraResolver: "Pedir ao IFTM a 5ª fase regenerada com os mesmos dados da 6ª.",
  },
  "rede-sexta-fase": {
    nivel: "ATENCAO",
    titulo: "6ª fase das outras 41 instituições é de 31/08",
    porque:
      "Só o IFSul tem a 6ª fase de 29/09. As demais instituições continuam com a exportação antiga, calculada com outros parâmetros.",
    paraResolver: "Pedir a 6ª fase completa nova (rede inteira) ao IFTM.",
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
    nivel: "ATENCAO",
    titulo: "EAD MOOC em 2027: valores por câmpus a 0,8",
    porque:
      "A regra é 0,8 do presencial em 2026 e 0,08 em 2027. A taxa está corrigida, mas os valores por câmpus de 2027 foram publicados pela MDO a 0,8 e seguem assim: câmpus com aluno MOOC aparecem com valor acima do devido.",
    paraResolver: "Regenerar a 5ª fase de 2027 na MDO com o peso 0,08, ou recalcular aqui (deixaria de bater com o oficial).",
  },
  "sem-sexta-fase-2026": {
    nivel: "ATENCAO",
    titulo: "Não existe 6ª fase de 2026",
    porque: "O detalhe por curso de 2026 não foi publicado pela MDO. Em 2026 só se vai até o câmpus.",
    paraResolver: "Pedir a 6ª fase de 2026, ou estimar o detalhe a partir dos CSVs da PNP (seria marcado como estimado).",
  },
  "valor-informado": {
    nivel: "ATENCAO",
    titulo: "Valor informado (o que o câmpus recebeu) sem cadastro",
    porque:
      "O valor informado é digitado por um administrador em Valores recebidos. Onde não há registro, a coluna aparece vazia e a transição usa a matriz do ano anterior no lugar.",
    paraResolver: "Cadastrar o valor recebido por câmpus em Admin, Valores recebidos.",
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
