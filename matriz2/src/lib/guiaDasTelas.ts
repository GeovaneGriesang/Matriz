/**
 * O texto do Guia das telas (`/como-funciona/telas`), uma ficha por endereço do menu. O nome e a ordem das telas vêm de `lib/menu.ts`, para o guia não
 * divergir do menu; um teste falha se uma tela nova do menu ficar sem ficha.
 */

export interface FichaDaTela {
  /** A pergunta que a tela responde. */
  responde: string;
  mostra?: string;
  usar?: string;
  /** Telas com abas: uma entrada por aba, no lugar de `mostra`. */
  abas?: { nome: string; texto: string }[];
  atencao?: string;
}

export const FICHAS_DAS_TELAS: Record<string, FichaDaTela> = {
  "/": {
    responde: "O que o sistema oferece e o que já está carregado?",
    mostra: "O resumo de cada ciclo carregado, de onde vêm os números e a lista de telas, com uma frase sobre cada uma.",
    usar: 'Comece por "O que você quer fazer?" e siga para a tela indicada.',
  },
  "/como-funciona": {
    responde: "Como a matriz reparte o orçamento?",
    mostra:
      "O manual da matriz, bloco a bloco, com números reais. Primeiro sai a Assistência Estudantil (ação 2994) e um pequeno ajuste. O restante é dividido em 80% para Funcionamento, 10% para Reitorias e 10% para Qualidade e Eficiência.",
    usar: "Leia antes das outras telas, ou volte aqui quando um termo não estiver claro, como Matrícula Total ou Piso Mínimo.",
  },
  "/consulta/comparar": {
    responde: "O mesmo curso rende igual em outro câmpus?",
    mostra: "Cursos de qualquer instituição da rede, lado a lado: duração do ciclo, carga horária, peso, matrícula equalizada e valor recebido.",
    usar: "Escolha instituição, câmpus e curso. A lista traz só as turmas com valor no ano, cada uma com o código do ciclo e o período. O primeiro curso é o principal, e a tela mostra o que ele ganha ou perde em relação aos outros. As turmas já encerradas, com alunos retidos, ficam num grupo à parte.",
    atencao: "Peso, carga horária e duração não são comparáveis entre modalidades diferentes. A tela avisa quando isso ocorre.",
  },
  "/comparativo": {
    responde: "O que mudou de 2026 para 2027?",
    mostra: "Quanto cada instituição recebeu em cada ciclo e a variação, com abertura por câmpus e por curso. Para os câmpus do IFSul, mostra o valor calculado e o informado.",
    usar: "Escolha o bloco (Total, Funcionamento, Qualidade e Eficiência ou Assistência Estudantil). Clique no + para abrir os câmpus e depois os cursos, que aparecem turma a turma, com os dois anos lado a lado. Uma célula em branco indica que a turma não contribuiu naquele ano, e a marca de alunos retidos indica turma já encerrada antes do ano-base.",
    atencao: "A cor compara cada instituição com a variação da rede, e não com zero. Quem cresce menos que a rede perde fatia, mesmo com o valor em reais subindo.",
  },
  "/conferencia/quarta-fase": {
    responde: "O sistema usa os mesmos dados e as mesmas fórmulas da planilha?",
    mostra: 'A planilha "Checagem de Matrículas Totais" do IFSul, refeita coluna a coluna (CHM, FECH, FEDA, MECHDA, MT) e comparada com o arquivo. Nos 1.986 ciclos, todas as colunas calculadas conferem.',
    usar: 'Veja a soma por unidade na aba "Instituição". O + de uma unidade abre os ciclos com valor no ano, logo abaixo da linha, e o + de um ciclo abre a conta dele, sem precisar do Excel. O quadro "Como cada coluna é calculada" explica as fórmulas.',
    atencao: 'Alguns ciclos diferem da 6ª fase porque a exportação é anterior a ela e traz outro peso ou outra carga horária mínima. A coluna "Por que difere" dá o motivo de cada um.',
  },
  "/consulta/valor-do-aluno": {
    responde: "Quanto um aluno de cada curso rende no orçamento do câmpus?",
    mostra: "O valor de um aluno em reais e em percentual do orçamento do câmpus, com a conta: peso × ICQA × (CH ÷ 800) × dias × valor de uma matrícula.",
    usar: 'Clique num curso para abrir as turmas e a conta de cada uma. Use a coluna "Ano cheio" para comparar cursos sem a distorção de turmas que começaram ou terminaram no meio do ano-base. As turmas já encerradas, com alunos retidos, aparecem separadas.',
    atencao: "No câmpus que está no Piso Mínimo, cada aluno vale menos para o orçamento real do que a tabela indica, porque o piso já cobre o que a matrícula não cobre.",
  },
  "/consulta": {
    responde: "Quanto cada um recebe, e de quais cursos vem esse valor?",
    mostra: 'O bloco Funcionamento de cada instituição, câmpus e curso. "Gerado pela matriz" é o valor homologado na MDO. No IFSul, aparece também o "Recebido", informado pela gestão.',
    usar: "Escolha o ciclo e a instituição. Clique no + de um câmpus para abrir os cursos dele logo abaixo da linha, e no − para fechar. Aparecem só as turmas que contribuem para o ano, cada uma com o código do ciclo e o período. As turmas que terminaram antes do ano-base, mas ainda têm alunos retidos, ficam num grupo à parte.",
    atencao: "O Funcionamento é cerca de 80% da matriz. Qualidade e Eficiência, Reitorias e Assistência Estudantil não entram aqui, porque não são valores por câmpus.",
  },
  "/consulta/curso": {
    responde: "O que acontece no orçamento se abrirmos ou mudarmos este curso?",
    abas: [
      { nome: "Quanto vale um curso", texto: "pesquise um curso e veja o peso, a carga horária mínima do MEC, a carga que vale na matriz e o valor por um aluno que faz o curso inteiro." },
      { nome: "Curso novo, ano a ano", texto: "informe câmpus, curso parecido, ano de início, duração, carga horária e vagas. A tela mostra o repasse de cada ano até todas as turmas estarem em andamento." },
      { nome: "Integrado, 3 ou 4 anos", texto: "compara as duas formas no repasse e na rotina do câmpus (horas por dia, turnos, salas e professores). Vale só para o técnico integrado." },
    ],
    atencao: "O valor por aluno é uma referência para comparar cursos, porque o aluno que evade deixa de contar. O custo do curso e a demanda por vagas ficam fora da conta.",
  },
  "/simulador/projecao": {
    responde: "Quanto os cursos atuais e os planejados rendem nos próximos anos?",
    mostra: "Ano a ano, o que cada ciclo em andamento continua valendo na matriz enquanto os alunos terminam o curso, com a evasão média da instituição em cada modalidade.",
    usar: "Escolha quantos anos projetar e monte o cenário: cursos novos, em anos diferentes, e cursos que deixam de ser ofertados. As turmas em andamento terminam, mas não entram turmas novas.",
    atencao: "É uma projeção com evasão média. O resultado real depende do orçamento aprovado e da matrícula de toda a rede em cada ano.",
  },
  "/simulador/distribuicao": {
    responde: "Como cada câmpus ficaria nas propostas apresentadas?",
    mostra: "A transição de cada câmpus, do valor de 2026 em direção à matriz de 2027 da 5ª fase, conforme duas propostas: Câmpus Sapucaia do Sul (33%, 66% e 100%, de 2027 a 2029) e Câmpus Venâncio Aires (0%, 5%, 10% e 20%, de 2027 a 2030).",
    usar: 'Selecione uma proposta ou "Comparar". Depois escolha se a matriz fica constante ou segue a projeção dos cursos de cada câmpus. A tela traz a conta de cada ano, câmpus a câmpus, e um ensaio com outras regras (parte mantida e índice de qualidade).',
    atencao: "As duas são propostas de câmpus, e nenhuma é regra do IFSul. As matrizes depois de 2027 ainda não existem: os valores desses anos são ilustrativos.",
  },
  "/simulador/alternativas": {
    responde: "Qual ação rende mais para o câmpus, e o que ela exige?",
    abas: [
      { nome: "Comparar alternativas", texto: "coloca lado a lado curso novo, turma FIC, RAP, evasão e vagas, com o ganho em reais por ano, quando começa e quantos alunos novos exige." },
      { nome: "Ideias de cursos e horas não pagas", texto: "mostra que tipo de curso rende mais por vaga e onde o câmpus tem carga horária acima do que a MDO paga." },
      { nome: "Indicadores e evasão", texto: "simula RAP e IAPL da instituição, e evasão e matrícula de cada câmpus, com efeito no total da instituição e da rede." },
    ],
    atencao: "São estimativas para dimensionar o efeito, e não um recálculo da metodologia. Um câmpus no Piso Mínimo pode não ganhar nada até o valor calculado passar do piso.",
  },
  "/conferencia": {
    responde: "Os indicadores publicados pela MDO fecham com a fórmula?",
    mostra: "IEA, RAP e IAPL de cada instituição, refeitos a partir dos componentes publicados e comparados com o valor da MDO.",
    usar: "Clique no + de uma instituição para abrir a conta de cada bloco logo abaixo da linha, e no − para fechar.",
    atencao: "Serve só para auditoria: esse recálculo nunca decide quanto uma instituição recebe. Uma diferença grande indica fórmula desatualizada ou mudança de metodologia a conferir.",
  },
  "/dados-importados": {
    responde: "Qual arquivo alimenta o sistema hoje, e de quando ele é?",
    mostra: "A versão em uso em cada etapa da MDO, com a data do arquivo e o que ele abrange. Clique no nome para baixar o original.",
    atencao: 'Observe a coluna "Abrange": parte do material cobre uma só instituição, e somar abrangências diferentes gera um falso total de rede. Arquivos com dado pessoal por aluno não são baixados, por causa da LGPD.',
  },
  "/orcamento-da-uniao": {
    responde: "O que foi proposto, aprovado e executado para o IFSul?",
    mostra: "PLOA e LOA do IFSul, ação por ação, as emendas parlamentares e a execução da despesa por ação e por câmpus, com a fonte de cada número.",
    atencao: "LOA e PLOA vão só até a instituição. Esses documentos não trazem valor por câmpus, portanto não confirmam, por exemplo, o pagamento do piso a um câmpus novo.",
  },
  "/evasao": {
    responde: "Quanto se deixa de receber por causa da evasão?",
    mostra: "A perda de cada instituição, em reais e em proporção do que recebe, com abertura por câmpus e por curso. O valor vem pronto da 6ª fase da MDO.",
    usar: "Clique numa instituição para ver os câmpus, e no + de um câmpus para abrir os cursos dele logo abaixo da linha. O + de um curso abre as turmas, com o código do ciclo e o período. É o dado mais acionável da matriz, porque responde ao que a instituição faz com os alunos que já tem.",
    atencao: 'Nos câmpus marcados "no piso", reduzir a evasão pode não aumentar o que recebem.',
  },
  "/peso-efetivo": {
    responde: "Que peso a MDO aplicou de fato a cada curso?",
    mostra: "O peso efetivo de cada combinação de tipo de curso, oferta, curso e carga horária mínima, com a fonte de cada linha.",
    atencao: 'A coluna "Peso do Curso" da exportação nem sempre é o peso aplicado. O peso efetivo é obtido de trás para frente a partir da Matrícula Total publicada, já com o bônus de 50% da agropecuária.',
  },
  "/pnp": {
    responde: "O que a Plataforma Nilo Peçanha registra?",
    mostra: "Matrícula, situação, eficiência, evasão, percentuais legais, perfil dos alunos, docentes e técnicos, por rede, instituição e câmpus, nos anos-base de 2017 a 2025.",
    usar: 'Escolha a tabela, o nível e o ano-base e clique em "Mostrar". Nem toda tabela existe em todos os níveis.',
    atencao: "São números da PNP, e não da MDO. Servem para conferir a matriz e olhar o que a MDO não publica.",
  },
  "/pnp/orcamento": {
    responde: "Como a PNP registra a execução do orçamento?",
    mostra: "Dotação, execução, restos a pagar, descentralizações e gastos por matrícula equivalente, de 2013 a 2025, por instituição, região, estado e rede.",
    usar: 'Escolha a tabela, a instituição, o ano-base e a relação do órgão (UO, UGE ou TED, explicadas na tela) e clique em "Mostrar".',
    atencao: "Não existe por câmpus. É o orçamento executado, e não a matriz de distribuição.",
  },
  "/situacao-dos-dados": {
    responde: "Quanto posso confiar em cada número?",
    mostra: "Num lugar só, o que está conferido, o que precisa de revisão e o que é estimativa ou definição própria, com o motivo de cada um.",
    usar: "Consulte antes de levar um número a uma decisão. As mesmas marcas aparecem no topo das telas que dependem desses dados.",
  },
};

/** As telas de administração não estão no menu principal: têm o próprio cabeçalho. */
export const TELAS_DE_ADMINISTRACAO: { href: string; rotulo: string; somenteSuperAdmin?: boolean; ficha: FichaDaTela }[] = [
  {
    href: "/admin/orcamento",
    rotulo: "Correção manual",
    ficha: {
      responde: "E se a MDO ainda não publicou um parâmetro, ou publicou algo errado?",
      mostra: 'Os 17 parâmetros de cada ciclo e a origem de cada valor. Salvar registra a origem como "administrador", até a próxima carga da MDO trazer o valor de volta. Só o super-admin altera.',
    },
  },
  {
    href: "/admin/valores-recebidos",
    rotulo: "Valores recebidos",
    ficha: {
      responde: "Quanto cada câmpus do IFSul recebeu de fato?",
      mostra: "O valor informado por câmpus e ano. Ele aparece ao lado do valor gerado nas outras telas e não é apagado pelas cargas da MDO. Só o super-admin altera.",
      atencao: "Existe apenas para o IFSul. As outras instituições não têm esse cadastro.",
    },
  },
  {
    href: "/admin/usuarios",
    rotulo: "Usuários",
    ficha: {
      responde: "Quem tem acesso, e com qual perfil?",
      mostra: "As contas do sistema. Quem é cadastrado recebe um código por e-mail para o primeiro acesso, e a tela também permite resetar a senha. O administrador cria perfis padrão, e o super-admin cria administradores e muda perfis.",
    },
  },
  {
    href: "/admin/auditoria",
    rotulo: "Auditoria",
    somenteSuperAdmin: true,
    ficha: {
      responde: "Quem fez o quê, e quando?",
      mostra: "Os registros mais recentes de login, logout, troca e reset de senha, criação de usuário e correção manual de dados.",
    },
  },
];

/** A tabela "por onde começar": cada pergunta leva à tela que a responde. */
export const PERGUNTAS_DO_GUIA: { pergunta: string; href: string }[] = [
  { pergunta: "Quanto meu câmpus recebe, e de quais cursos vem esse valor?", href: "/consulta" },
  { pergunta: "O que mudou de 2026 para 2027?", href: "/comparativo" },
  { pergunta: "O que meu câmpus pode fazer para receber mais?", href: "/simulador/alternativas" },
  { pergunta: "Vale a pena abrir este curso? Integrado em 3 ou em 4 anos?", href: "/consulta/curso" },
  { pergunta: "Como fica o orçamento nos próximos anos?", href: "/simulador/projecao" },
  { pergunta: "Como ficaria cada câmpus nas propostas de distribuição?", href: "/simulador/distribuicao" },
  { pergunta: "Quanto perdemos com a evasão?", href: "/evasao" },
  { pergunta: "Os dados do sistema são os mesmos da planilha?", href: "/conferencia/quarta-fase" },
  { pergunta: "Quanto posso confiar neste número?", href: "/situacao-dos-dados" },
];

/** O id da ficha na página, para os links da tabela "por onde começar". */
export function idDaFicha(href: string): string {
  return `tela${href.replace(/\W+/g, "-")}`;
}
