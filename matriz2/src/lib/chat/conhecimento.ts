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

Salvar simulações: nas telas de simulação e de consulta há, no alto, a lista de simulações (ou consultas) salvas com Carregar, Salvar, Salvar como, Renomear, Compartilhar e Excluir. O que se salva é só do usuário; ele pode compartilhar com outras pessoas (com Marcar todos, Desmarcar todos e Inverter seleção), que só carregam e podem salvar uma cópia. Duas pessoas não salvam a mesma ao mesmo tempo: o sistema recusa o salvamento de quem carregou uma versão antiga. O super-administrador vê as de todos, com o dono.

Imprimir e exportar: toda tela tem, no alto, os botões Imprimir / PDF e CSV das tabelas; cada quadro tem Imprimir / PDF e cada tabela tem CSV e Imprimir / PDF. O PDF sai da janela de impressão do navegador (Salvar como PDF); o CSV abre no Excel, com valores em reais como número puro.

Marcas de confiança nas telas: Conferido (bate com o oficial), Atenção (há inconsistência na fonte) e Estimado (hipótese nossa, com premissas explicadas).
`.trim();

/** Texto extra por tela, além da descrição do menu. A chave é o começo do caminho; vale a mais longa que coincidir. */
export const CONHECIMENTO_POR_TELA: Record<string, string> = {
  "/": "A página inicial lista os ciclos carregados e leva às telas por pergunta: consultar, simular, conferir e ver os dados.",
  "/consulta": "Mostra o valor do bloco Funcionamento por instituição, câmpus e curso, com variação em relação ao ciclo anterior. O IFSul e o Câmpus Venâncio Aires aparecem em destaque.",
  "/consulta/curso":
    "Busca um curso pelo nome e mostra o peso, a carga horária mínima do MEC, a carga horária que vale na matriz e quanto a MDO paga por um aluno que faz o curso inteiro (peso x carga horária / 800 x valor da matrícula). É valor de referência, não o que o câmpus recebe.",
  "/consulta/valor-do-aluno": "O valor de um aluno em cada curso é o valor do ciclo dividido pelos alunos, mostrado em reais e em percentual do orçamento do câmpus.",
  "/conferencia/quarta-fase":
    "Carrega a planilha da 4ª fase da MDO (Checagem de Matrículas Totais, versão 8.5) e refaz as 16 colunas calculadas com as fórmulas do Excel: CHM, QDTC, CHMD, CHA, FECH, DACP1 a DACP5, FEDA, FECHDA, MECHDA, MP, BA e MT. Na planilha da DDI (matriz 2025, ano-base 2023), os 1.986 ciclos do IFSul conferem em todas as colunas. Na exportação de 2027 (só fórmulas), a referência é a 6ª fase: a maioria confere, e os que não conferem têm peso ou carga horária mínima diferente na 4ª fase. Em quatro colunas (CHMD, FECH, FEDA e MECHDA) o texto do cabeçalho não diz o mesmo que a fórmula; vale a fórmula.",
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
    "Simulador de cenários: projeta, ano a ano e pelo número de anos escolhido (de 1 a 20), quanto os ciclos em andamento rendem na matriz até os alunos terminarem, com a evasão média do instituto e a retenção observada. Permite acrescentar cursos novos (em qualquer câmpus, com ano e mês de início, ingressantes, repetição anual ou semestral e duração) e fazer cursos deixarem de ser ofertados a partir de um ano (as turmas em andamento terminam). Mostra já matriculados, reposição das turmas que continuam, cursos novos, o total do cenário e a diferença sobre manter tudo como está. O valor da matrícula fica fixo no de hoje, então é ordem de grandeza e não promessa de repasse.",
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

/**
 * Conhecimento a mais, só para o modelo grande (Gemini), que tem janela de contexto larga: perfis, telas novas e pendências. O modelo
 * pequeno da VM continua só com o CONHECIMENTO_GERAL, que é enxuto de propósito.
 */
export const CONHECIMENTO_COMPLEMENTAR = `
Quem fez o sistema: a Comissão de Estudos e Análise da Matriz Orçamentária do IFSul, Câmpus Venâncio Aires (Portaria nº 1284, de 21 de maio de 2026), presidida por Geovane Griesang. Os dados vêm da MDO, o sistema do IFTM que calcula a matriz da rede, e da Plataforma Nilo Peçanha (PNP).

Perfis de usuário:
- Super-admin: altera a Correção manual e os Valores recebidos, cadastra administradores e usuários padrão, muda o perfil dos outros e vê a Auditoria.
- Admin: vê todos os dados e simulações, consulta (sem alterar) a Correção manual e os Valores recebidos, cadastra e administra usuários de perfil padrão, e usa este chat com o Gemini.
- Padrão: vê os dados e faz as simulações; não vê Correção manual nem Valores recebidos; usa o chat com o modelo do próprio servidor.
- Todos alteram os dados da própria conta (senha) em Minha conta.

O menu tem três grupos: Entender a matriz, Onde melhorar e, só para administradores, Dados e conferência.

Telas e o que respondem:
- Entender a matriz > Valor por instituição, câmpus e curso: o Funcionamento gerado pela matriz (5ª fase, já com o Piso Mínimo), a matrícula e a perda por evasão. Cada tabela tem "Como ler esta tabela" com a conta de cada coluna.
- Entender a matriz > Quanto vale um aluno: para cada curso de um câmpus, quanto um aluno rende, com a conta turma a turma (carga horária ÷ 800, dias no ano-base ÷ dias da turma, ICQA, Matrícula Total, valor da turma, valor por aluno). Dá para escolher o ciclo 2027 (PNP 2025) ou 2026 (PNP 2024).
- Entender a matriz > Comparar cursos entre câmpus: cursos lado a lado; o "?" de cada item explica o que é e mostra a conta com os números do curso principal.
- Entender a matriz > Comparativo entre ciclos: 2026 contra 2027, por bloco (Total, Funcionamento, Qualidade e Eficiência, Assistência Estudantil). Por câmpus só existem Funcionamento e Assistência; a Reitoria e a Qualidade e Eficiência ficam com a instituição.
- Onde melhorar > Abrir ou mudar um curso: uma tela com três abas, Quanto vale um curso (peso, carga horária mínima e quanto a MDO paga por um aluno que faz o curso inteiro), Curso novo ano a ano, e Integrado: 3 ou 4 anos.
- Aba Integrado: 3 ou 4 anos: vale só para o integrado. Com a mesma carga horária total, 3 e 4 anos rendem o mesmo repasse por ingressante e, com todas as turmas em andamento, ocupam as mesmas salas e professores; o curso de 3 anos tem mais horas por dia (pode exigir contraturno) e chega antes ao total. A tela calcula a rotina com os minutos por período, os períodos por turno, os dias letivos, o intervalo (Venâncio Aires conta 15 minutos de intervalo como carga horária: 5 períodos de 45 minutos mais 15 dá 4 horas por turno) e a parte EAD.
- Onde melhorar > Onde o câmpus pode ganhar: uma tela com três abas, Comparar alternativas (curso novo, turma FIC, RAP, evasão, vagas, lado a lado), Ideias de cursos e horas não pagas, e Indicadores e evasão.
- Onde melhorar > Cenários, anos à frente: quanto os ciclos rendem nos próximos anos, com cursos novos e cursos que deixam de ser ofertados. Nas simulações, o padrão é 32 estudantes por ano.
- Distribuição entre câmpus: EM DESENVOLVIMENTO, aguardando a regra interna do IFSul; fica fora do menu até lá.
- Dados e conferência (só administradores): PNP, Orçamento da União, Peso por curso, Perda por evasão, Conferência de cálculo e Situação dos dados, que mostra o grau de confiança de cada número (Conferido, Atenção, Estimado).
- Toda tela tem Imprimir / PDF e CSV das tabelas.

Pontos ainda em aberto com o IFTM (não afirme como definitivos): o valor do EAD MOOC (R$ 99,18 na 5ª fase contra R$ 991,77 na 6ª fase online), se Triunfo e Rosário do Sul entram no piso de 2027, o Câmpus Complexo do Alemão (IFRJ) repetido no resumo da 5ª fase, e a exportação da 6ª fase da rede inteira, que não gera o arquivo.
`;
