/**
 * O menu do sistema, num lugar só: o cabeçalho (`SiteNav`) e a página inicial leem daqui, para o texto de cada tela não
 * divergir. Reorganizado em 2026-10-01 de 11 itens soltos para 4 grupos por pergunta que a pessoa quer responder
 * (consultar, simular, conferir, ver os dados), mais "Como funciona".
 */

export interface ItemMenu {
  href: string;
  rotulo: string;
  /** Uma frase, em linguagem de quem não é de TI: o que se faz nesta tela. */
  descricao: string;
}

export interface GrupoMenu {
  id: string;
  rotulo: string;
  /** Pergunta que o grupo responde, mostrada na página inicial. */
  pergunta: string;
  itens: ItemMenu[];
}

export const GRUPOS_MENU: GrupoMenu[] = [
  {
    id: "consultar",
    rotulo: "Consultar",
    pergunta: "Quanto recebe?",
    itens: [
      {
        href: "/consulta",
        rotulo: "Valor por instituição, câmpus e curso",
        descricao: "Quanto cada instituição, câmpus e curso recebe no bloco Funcionamento.",
      },
      {
        href: "/consulta/valor-do-aluno",
        rotulo: "Quanto vale um aluno",
        descricao: "Para cada curso de um câmpus: o valor de um aluno em reais e em percentual do orçamento do câmpus.",
      },
      {
        href: "/consulta/comparar",
        rotulo: "Comparar cursos entre câmpus",
        descricao: "O mesmo curso em câmpus diferentes, lado a lado.",
      },
      {
        href: "/comparativo",
        rotulo: "Comparativo entre ciclos",
        descricao: "O que mudou de um ciclo para o outro, com a explicação do que ocorreu em cada instituição.",
      },
    ],
  },
  {
    id: "simular",
    rotulo: "Simular",
    pergunta: "E se mudar?",
    itens: [
      {
        href: "/simulador/curso",
        rotulo: "Curso de 3 ou 4 anos",
        descricao: "Quanto um curso rende em 3 anos contra 4, ano a ano, no câmpus escolhido.",
      },
      {
        href: "/simulador/distribuicao",
        rotulo: "Distribuição entre câmpus",
        descricao: "A transição de 3 anos para a matriz: manter parte do valor anterior e completar com um índice de qualidade.",
      },
      {
        href: "/simulador",
        rotulo: "Evasão, RAP e IAPL",
        descricao: "Quanto o valor muda se a evasão cair ou se a instituição mudar de faixa nos indicadores.",
      },
    ],
  },
  {
    id: "conferir",
    rotulo: "Conferir",
    pergunta: "A conta fecha?",
    itens: [
      {
        href: "/conferencia",
        rotulo: "Conferência de cálculo",
        descricao: "IEA, RAP e IAPL de cada instituição, refeitos e comparados com o que a MDO publicou.",
      },
      {
        href: "/evasao",
        rotulo: "Perda por evasão",
        descricao: "Quanto cada instituição, câmpus e curso deixa de receber por causa da evasão.",
      },
    ],
  },
  {
    id: "dados",
    rotulo: "Dados",
    pergunta: "De onde vem?",
    itens: [
      {
        href: "/dados-importados",
        rotulo: "Dados importados",
        descricao: "Cada arquivo carregado, de que fonte, de que data e quantas linhas.",
      },
      {
        href: "/pnp",
        rotulo: "PNP: ensino e pessoal",
        descricao: "Matrículas, eficiência, evasão, docentes e técnicos da Plataforma Nilo Peçanha.",
      },
      {
        href: "/pnp/orcamento",
        rotulo: "PNP: orçamento",
        descricao: "Dotação, execução e descentralização como a PNP registra.",
      },
      {
        href: "/peso-efetivo",
        rotulo: "Peso por curso",
        descricao: "O peso que a MDO aplicou a cada curso, com a fonte de cada linha.",
      },
      {
        href: "/situacao-dos-dados",
        rotulo: "Situação dos dados",
        descricao: "O que está conferido, o que precisa de revisão e o que é estimativa.",
      },
    ],
  },
];

export const ITEM_INICIO: ItemMenu = { href: "/", rotulo: "Início", descricao: "A visão geral dos ciclos carregados." };
export const ITEM_COMO_FUNCIONA: ItemMenu = {
  href: "/como-funciona",
  rotulo: "Como funciona",
  descricao: "O manual: como a matriz é calculada, bloco a bloco.",
};

/** Todos os itens, achatados, para saber qual tela está aberta. */
export const TODOS_OS_ITENS: ItemMenu[] = [ITEM_INICIO, ...GRUPOS_MENU.flatMap((g) => g.itens), ITEM_COMO_FUNCIONA];

/**
 * O item da tela aberta: o de endereço mais longo que coincide com o começo do caminho, para `/simulador` não valer
 * quando a tela aberta é `/simulador/curso`.
 */
export function itemAtivo(pathname: string): ItemMenu | null {
  let melhor: ItemMenu | null = null;
  for (const item of TODOS_OS_ITENS) {
    const coincide = item.href === "/" ? pathname === "/" : pathname === item.href || pathname.startsWith(`${item.href}/`);
    if (coincide && (!melhor || item.href.length > melhor.href.length)) melhor = item;
  }
  return melhor;
}
