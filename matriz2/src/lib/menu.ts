import type { Papel } from "@prisma/client";

/**
 * O menu do sistema, num lugar só: o cabeçalho (`SiteNav`) e a página inicial leem daqui, para o texto de cada tela não
 * divergir. Reorganizado em 2026-10-25 pelos objetivos do sistema (pedido do usuário: "opções demais"): entender como a matriz
 * reparte o orçamento, descobrir onde o câmpus pode melhorar, e, só para administradores, os dados e a conferência. Nenhuma
 * tela saiu; só mudou de lugar. Antes eram 4 grupos (Consultar, Simular, Conferir, Dados).
 */

export interface ItemMenu {
  href: string;
  rotulo: string;
  /** Uma frase, em linguagem de quem não é de TI: o que se faz nesta tela. */
  descricao: string;
  /** Tela que ainda não está pronta: aparece só para o super-admin (ex.: a distribuição entre câmpus, à espera da regra interna). */
  somenteSuperAdmin?: boolean;
  /** Outros endereços que pertencem a este item (abas da mesma tela): o menu marca o item como ativo neles. */
  abas?: string[];
}

export interface GrupoMenu {
  id: string;
  rotulo: string;
  /** Pergunta que o grupo responde, mostrada na página inicial. */
  pergunta: string;
  /** Grupo técnico: só administradores e super-admin veem no menu. */
  somenteAdmin?: boolean;
  itens: ItemMenu[];
}

export const GRUPOS_MENU: GrupoMenu[] = [
  {
    id: "entender",
    rotulo: "Entender a matriz",
    pergunta: "Como o orçamento é repartido e quanto cada um recebe?",
    itens: [
      {
        href: "/consulta",
        rotulo: "Valor por instituição, câmpus e curso",
        descricao: "Quanto cada instituição, câmpus e curso recebe no bloco Funcionamento, com a conta de cada coluna.",
      },
      {
        href: "/consulta/valor-do-aluno",
        rotulo: "Quanto vale um aluno",
        descricao: "Para cada curso de um câmpus: o valor de um aluno e a conta turma a turma.",
      },
      {
        href: "/comparativo",
        rotulo: "Comparativo entre ciclos",
        descricao: "O que mudou de 2026 para 2027, bloco a bloco, com a explicação do que ocorreu.",
      },
      {
        href: "/consulta/comparar",
        rotulo: "Comparar cursos entre câmpus",
        descricao: "O mesmo curso em câmpus diferentes, lado a lado.",
      },
    ],
  },
  {
    id: "melhorar",
    rotulo: "Onde melhorar",
    pergunta: "O que o câmpus pode fazer para o orçamento crescer?",
    itens: [
      {
        href: "/simulador/alternativas",
        rotulo: "Onde o câmpus pode ganhar",
        descricao: "Três abas: comparar alternativas (curso novo, FIC, RAP, evasão, vagas), ideias de cursos e horas não pagas, e indicadores e evasão.",
        abas: ["/simulador/oportunidades", "/simulador"],
      },
      {
        href: "/consulta/curso",
        rotulo: "Abrir ou mudar um curso",
        descricao: "Três abas: quanto vale um curso (peso e carga horária), quanto um curso novo rende ano a ano, e o integrado em 3 ou 4 anos.",
        abas: ["/simulador/novo-curso", "/simulador/curso"],
      },
      {
        href: "/simulador/projecao",
        rotulo: "Cenários, anos à frente",
        descricao: "Quanto os ciclos rendem nos próximos anos, com cursos novos e cursos que deixam de ser ofertados.",
      },
      {
        href: "/simulador/distribuicao",
        rotulo: "Distribuição entre câmpus",
        descricao: "Em desenvolvimento, aguardando a regra interna. Ensaio da transição para a matriz.",
        somenteSuperAdmin: true,
      },
    ],
  },
  {
    id: "dados",
    rotulo: "Dados e conferência",
    pergunta: "De onde vêm os números e a conta fecha?",
    somenteAdmin: true,
    itens: [
      {
        href: "/situacao-dos-dados",
        rotulo: "Situação dos dados",
        descricao: "O que está conferido, o que precisa de revisão e o que é estimativa.",
      },
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
        href: "/orcamento-da-uniao",
        rotulo: "Orçamento da União (LOA)",
        descricao: "O IFSul na LOA e no PLOA, ação por ação, as emendas e a execução por câmpus.",
      },
      {
        href: "/peso-efetivo",
        rotulo: "Peso por curso",
        descricao: "O peso que a MDO aplicou a cada curso, com a fonte de cada linha.",
      },
    ],
  },
];

/** Os grupos e itens que cada perfil vê no menu e no Início. As telas continuam abertas pelo endereço; só saem da vista. */
export function gruposVisiveis(papel: Papel | null | undefined): GrupoMenu[] {
  const admin = papel === "ADMIN" || papel === "SUPER_ADMIN";
  return GRUPOS_MENU.filter((g) => !g.somenteAdmin || admin)
    .map((g) => ({ ...g, itens: g.itens.filter((i) => !i.somenteSuperAdmin || papel === "SUPER_ADMIN") }))
    .filter((g) => g.itens.length > 0);
}

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
  let tamanho = -1;
  for (const item of TODOS_OS_ITENS) {
    // As abas valem pelo endereço exato (a aba "/simulador" não pode marcar "/simulador/curso").
    if (item.abas?.includes(pathname) && pathname.length > tamanho) {
      melhor = item;
      tamanho = pathname.length;
      continue;
    }
    const coincide = item.href === "/" ? pathname === "/" : pathname === item.href || pathname.startsWith(`${item.href}/`);
    if (coincide && item.href.length > tamanho) {
      melhor = item;
      tamanho = item.href.length;
    }
  }
  return melhor;
}
