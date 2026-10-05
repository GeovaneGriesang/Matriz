/**
 * O que o assistente do chat sabe sobre o sistema. Um modelo pequeno (3 bilhões de parâmetros) rodando na própria VM tem janela de
 * contexto curta e erra conta, então o texto é enxuto, só com o que já está conferido no sistema, e o modelo é instruído a não
 * inventar número: o que ele sabe vem daqui, da descrição da tela e dos "dados da tela" que a página entrega.
 *
 * Mantenha este texto curto. Cada palavra a mais disputa lugar com a pergunta e com os dados da tela.
 */

export const CONHECIMENTO_GERAL = `
FATOS PRINCIPAIS (use estes números exatamente como estão):
- Bloco Funcionamento: 80% do orçamento, depois de tirar a Assistência Estudantil.
- Bloco Reitoria/Direção-Geral: 10%. Bloco Qualidade e Eficiência: 10%.
- Assistência Estudantil: sai antes da divisão em blocos (é a ação orçamentária 2994).
- Piso Mínimo de câmpus novo: R$ 700 mil, por 5 anos a contar da autorização.
- Educação a distância vale, em relação ao presencial: 80% (financiamento próprio), 25% (financiamento externo) e 8% (MOOC).
- Pesos de curso: 1,0 a 2,5 (laboratórios), licenciatura 2,5, mestrado e doutorado 3,75; agropecuária tem bônus de 50%.
- ICQA: 1 para aluno regular, 0,5 para retido até 3 anos depois do término, 0 depois disso.
- A matriz de um ano usa a PNP de dois anos antes (a de 2027 usa a de 2025).
- Ações do orçamento: 20RL funcionamento, 2994 assistência estudantil, 20RG reestruturação.

O que é: a Matriz de Distribuição Orçamentária (MDO) reparte o orçamento da Rede Federal (IFs, Cefets e Colégio Pedro II) entre as instituições e os câmpus. Está na Portaria MEC 243/2026, que revogou a 646/2022. Quem calcula e homologa é a MDO, coordenada pelo IFTM com a Comissão Paritária. Este sistema NÃO recalcula a matriz: importa o resultado oficial, deixa conferir, comparar e simular.

Blocos: primeiro sai a Assistência Estudantil. Do restante, 80% é o Funcionamento (por câmpus, pela Matrícula Total), 10% é a Reitoria/Direção-Geral (mesma base, por instituição) e 10% é Qualidade e Eficiência (indicadores IEA, RAPP e IAML, por instituição).

Matrícula Total de um ciclo de curso: alunos x peso do curso x carga horária / 800 h por ano x fração dos dias do ano em que o ciclo esteve ativo. Pesos: 1,0 a 2,5 conforme os laboratórios, licenciatura 2,5, mestrado e doutorado 3,75; cursos de agropecuária têm bônus de 50%. Aluno retido depois do término do ciclo conta metade (ICQA 0,5) até 3 anos, depois sai; curso FIC não tem esse prazo. Modalidade a distância vale 80% (financiamento próprio), 25% (financiamento externo) ou 8% (MOOC) do presencial.

ICQA é a fração dos alunos de um ciclo que a MDO conta: 1 para o aluno regular, 0,5 para o retido que passou do término mas está dentro do prazo de jubilamento, e 0 depois desse prazo. Não explique a sigla por extenso.

Dois sentidos de "ciclo": ciclo de curso é uma turma (início, término, alunos); ciclo orçamentário é o ano da matriz (2027, por exemplo). A matriz de um ano usa os dados da PNP de dois anos antes (a de 2027 usa a PNP de 2025).

Piso Mínimo: R$ 700 mil por câmpus novo, por 5 anos a contar da autorização; câmpus autorizado depois da publicação da PNP só entra na matriz no ano seguinte. Em 2027 são 53 câmpus.

Assistência Estudantil: rateada pela renda familiar per capita dos alunos e por quem está em Regime de Internato Pleno (RIP).

Orçamento da União: a LOA é o orçamento aprovado pelo Congresso e o PLOA a proposta do governo. Só vai até a instituição, não há valor por câmpus. Ações: 20RL funcionamento, 2994 assistência estudantil, 20RG reestruturação.

Marcas de confiança nas telas: Conferido (bate com o oficial), Atenção (há inconsistência na fonte) e Estimado (hipótese nossa, com premissas explicadas).
`.trim();

/** Texto extra por tela, além da descrição do menu. A chave é o começo do caminho; vale a mais longa que coincidir. */
export const CONHECIMENTO_POR_TELA: Record<string, string> = {
  "/": "A página inicial lista os ciclos carregados e leva às telas por pergunta: consultar, simular, conferir e ver os dados.",
  "/consulta": "Mostra o valor do bloco Funcionamento por instituição, câmpus e curso, com variação em relação ao ciclo anterior. O IFSul e o Câmpus Venâncio Aires aparecem em destaque.",
  "/consulta/valor-do-aluno": "O valor de um aluno em cada curso é o valor do ciclo dividido pelos alunos, mostrado em reais e em percentual do orçamento do câmpus.",
  "/consulta/comparar": "Põe o mesmo curso de câmpus diferentes lado a lado, para ver quem recebe mais por aluno.",
  "/evasao":
    "O custo evadido é o quanto um ciclo deixa de receber por alunos que a MDO não conta (evadidos ou retidos além do prazo de jubilamento). A definição mudou na 6ª fase do IFSul de setembro de 2026; não some números de versões diferentes.",
  "/dados-importados": "Navegador dos dados importados: as planilhas da MDO e os arquivos da PNP carregados, com a origem de cada um.",
  "/pnp/orcamento": "Dotação, execução e descentralização como a PNP registra. O painel é por instituição, não existe por câmpus.",
  "/simulador/oportunidades": "Mostra que tipo de curso rende mais por vaga e onde o câmpus tem carga horária que a MDO não paga (acima da carga horária da matriz).",
  "/comparativo":"Compara dois ciclos orçamentários e explica o que mudou em cada instituição: matrícula, valor da matrícula e indicadores.",
  "/simulador": "Simula o efeito de mudar a evasão, a RAP ou o IAPL de uma instituição sobre o valor que ela recebe. É simulação, não regra.",
  "/simulador/curso": "Compara oferecer um curso em 3 ou em 4 anos: o que a MDO paga depende da carga horária total, não do número de anos em si.",
  "/simulador/novo-curso": "Mostra quanto um curso novo rende ano a ano no câmpus, do primeiro ingresso até o regime.",
  "/simulador/alternativas": "Compara lado a lado alternativas: curso de 3 ou 4 anos, curso novo, turma FIC, melhorar a RAP, reduzir a evasão, ocupar vagas.",
  "/simulador/distribuicao": "Simula a transição de 3 anos entre manter o valor do ano anterior e passar à distribuição pela matriz, entre os câmpus de uma instituição. O dinheiro total se conserva.",
  "/simulador/projecao":
    "Projeta, ano a ano, quanto os ciclos em andamento ainda rendem na matriz até os alunos terminarem, com a evasão média do instituto e a retenção observada. Há duas leituras: só os matriculados hoje (o que é preciso para todos terminarem) e com reposição das turmas (o regime de quem segue ofertando). O valor da matrícula fica fixo no de hoje, então é ordem de grandeza e não promessa de repasse.",
  "/orcamento-da-uniao":
    "Mostra o IFSul na LOA e no PLOA por ação, as emendas parlamentares e a execução de 2026 (empenhado, liquidado e pago) do Portal da Transparência, por ação e por câmpus. Valor da matriz e gasto da UG não são a mesma coisa: a UG também executa emenda e crédito suplementar.",
  "/pnp": "Dados da Plataforma Nilo Peçanha (matrículas, eficiência, evasão, docentes). A PNP é a base de que a matriz parte, com dois anos de defasagem.",
  "/peso-efetivo": "O peso que a MDO aplicou a cada curso, com a fonte de cada linha.",
  "/conferencia": "Refaz IEA, RAP e IAPL de cada instituição e compara com o que a MDO publicou, só para apontar divergência.",
  "/situacao-dos-dados": "Lista o que está conferido, o que precisa de revisão e o que é estimativa.",
  "/como-funciona": "O manual do cálculo da matriz, bloco a bloco.",
};

export function conhecimentoDaTela(rota: string): string {
  let melhor = "";
  for (const chave of Object.keys(CONHECIMENTO_POR_TELA)) {
    const coincide = chave === "/" ? rota === "/" : rota === chave || rota.startsWith(`${chave}/`);
    if (coincide && chave.length > melhor.length) melhor = chave;
  }
  return melhor ? CONHECIMENTO_POR_TELA[melhor]! : "";
}
