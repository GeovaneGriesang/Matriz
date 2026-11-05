import type { Papel } from "@prisma/client";

/**
 * O menu do sistema, num lugar só: o cabeçalho (`SiteNav`) e a página inicial leem daqui, para o texto de cada tela não
 * divergir. Reorganizado em 2026-11-04 por três perguntas e seis telas (revisão do sistema: "tenho dificuldade de me achar"). O resto foi para
 * "Mais", e nenhuma tela saiu. "Como funciona" fica à parte porque é a ajuda.
 */

export interface ItemMenu {
  href: string;
  rotulo: string;
  /** Uma frase, em linguagem de quem não é de TI: o que se faz nesta tela. */
  descricao: string;
  /** Tela que ainda não está pronta: aparece só para o super-admin (ex.: a distribuição entre câmpus, à espera da regra interna). */
  somenteSuperAdmin?: boolean;
  /** Tela técnica: só administradores e super-admin veem no menu. Continua aberta pelo endereço. */
  somenteAdmin?: boolean;
  /** Outros endereços que pertencem a este item (abas da mesma tela): o menu marca o item como ativo neles. */
  abas?: string[];
}

export interface GrupoMenu {
  id: string;
  rotulo: string;
  /** Pergunta que o grupo responde, mostrada na página inicial. */
  pergunta: string;
  /** Não entra nos quadros da página inicial, que mostra só as perguntas principais e a ajuda. */
  foraDoInicio?: boolean;
  itens: ItemMenu[];
}

const GRUPOS: GrupoMenu[] = [
  {
    id: "recebemos",
    rotulo: "Quanto recebemos?",
    pergunta: "Quanto o instituto, cada câmpus e cada curso recebem, e o que mudou de um ano para o outro.",
    itens: [
      {
        href: "/consulta",
        rotulo: "Valor por instituição, câmpus e curso",
        descricao: "Quanto cada instituição, câmpus e curso recebe no bloco Funcionamento, com a conta de cada coluna.",
      },
      {
        href: "/comparativo",
        rotulo: "Comparativo entre anos",
        descricao: "O que mudou de 2026 para 2027, bloco a bloco, com a explicação do que ocorreu.",
      },
    ],
  },
  {
    id: "confiar",
    rotulo: "Posso confiar?",
    pergunta: "Se os números conferem com a planilha oficial e o que ainda é estimativa.",
    itens: [
      {
        href: "/conferencia/quarta-fase",
        rotulo: "Matrícula Total, como na planilha da 4ª fase",
        descricao: "A planilha da 4ª fase da MDO refeita coluna a coluna, turma a turma, e comparada com o arquivo.",
      },
      {
        href: "/situacao-dos-dados",
        rotulo: "Situação dos dados",
        descricao: "O que está conferido, o que precisa de revisão e o que é estimativa.",
      },
    ],
  },
  {
    id: "e-se",
    rotulo: "E se...?",
    pergunta: "O que acontece no orçamento se abrirmos ou mudarmos um curso.",
    itens: [
      {
        href: "/consulta/curso",
        rotulo: "Quanto vale um curso",
        descricao: "Três abas: quanto vale um curso (peso e carga horária), quanto um curso novo rende ano a ano, e o integrado em 3 ou 4 anos.",
        abas: ["/simulador/novo-curso", "/simulador/curso"],
      },
      {
        href: "/simulador/projecao",
        rotulo: "Cenários, anos à frente",
        descricao: "Quanto as turmas rendem nos próximos anos, com cursos novos e cursos que deixam de ser ofertados.",
      },
    ],
  },
  {
    id: "mais",
    rotulo: "Mais",
    pergunta: "As demais telas, para aprofundar ou auditar.",
    foraDoInicio: true,
    itens: [
      {
        href: "/consulta/comparar",
        rotulo: "Comparar cursos entre câmpus",
        descricao: "O mesmo curso em câmpus diferentes, lado a lado.",
      },
      {
        href: "/simulador/distribuicao",
        rotulo: "Distribuição entre câmpus",
        descricao: "As propostas dos câmpus Sapucaia do Sul e Venâncio Aires, câmpus a câmpus, com a conta de cada ano e a comparação entre elas.",
      },
      {
        href: "/simulador/alternativas",
        rotulo: "Onde o câmpus pode ganhar",
        descricao: "Três abas: comparar alternativas (curso novo, FIC, RAP, evasão, vagas), ideias de cursos e horas não pagas, e indicadores e evasão.",
        abas: ["/simulador/oportunidades", "/simulador"],
      },
      {
        href: "/consulta/valor-do-aluno",
        rotulo: "Quanto vale um aluno",
        descricao: "Para cada curso de um câmpus: o valor de um aluno e a conta turma a turma.",
      },
      {
        href: "/conferencia",
        rotulo: "Conferência de cálculo",
        descricao: "IEA, RAP, IAPL e o Funcionamento dos câmpus de cada instituição, refeitos e comparados com o que a MDO publicou.",
        somenteAdmin: true,
      },
      {
        href: "/evasao",
        rotulo: "Perda por evasão",
        descricao: "Quanto cada instituição, câmpus e curso deixa de receber por causa da evasão.",
        somenteAdmin: true,
      },
      {
        href: "/dados-importados",
        rotulo: "Dados importados",
        descricao: "Cada arquivo carregado, de que fonte, de que data e quantas linhas.",
        somenteAdmin: true,
      },
      {
        href: "/pnp",
        rotulo: "PNP: ensino e pessoal",
        descricao: "Matrículas, eficiência, evasão, docentes e técnicos da Plataforma Nilo Peçanha.",
        somenteAdmin: true,
      },
      {
        href: "/pnp/orcamento",
        rotulo: "PNP: orçamento",
        descricao: "Dotação, execução e descentralização como a PNP registra.",
        somenteAdmin: true,
      },
      {
        href: "/orcamento-da-uniao",
        rotulo: "Orçamento da União (LOA)",
        descricao: "O IFSul na LOA e no PLOA, ação por ação, as emendas e a execução por câmpus.",
        somenteAdmin: true,
      },
      {
        href: "/peso-efetivo",
        rotulo: "Peso por curso",
        descricao: "O peso que a MDO aplicou a cada curso, com a fonte de cada linha.",
        somenteAdmin: true,
      },
    ],
  },
  {
    id: "como-funciona",
    rotulo: "Como funciona",
    pergunta: "Como a matriz é calculada e para que serve cada tela.",
    itens: [
      {
        href: "/como-funciona",
        rotulo: "Como a matriz é calculada",
        descricao: "O manual: como a matriz reparte o orçamento, bloco a bloco.",
      },
      {
        href: "/como-funciona/telas",
        rotulo: "Guia das telas",
        descricao: "O que cada tela do sistema responde, como usar e que cuidado ter ao ler os números.",
      },
    ],
  },
];

/** Dentro de cada grupo, as telas ficam em ordem alfabética (pedido do usuário em 2026-10-29), para achar pelo nome. */
const alfabetica = (a: ItemMenu, b: ItemMenu) => a.rotulo.localeCompare(b.rotulo, "pt-BR", { sensitivity: "base" });

export const GRUPOS_MENU: GrupoMenu[] = GRUPOS.map((g) => ({ ...g, itens: [...g.itens].sort(alfabetica) }));

/** As telas que o super-admin pode dar ou tirar de um perfil. "Início" fica fora: é a porta de entrada e aparece sempre. */
const TELAS_CONFIGURAVEIS: ItemMenu[] = GRUPOS_MENU.flatMap((g) => g.itens).filter((i) => !i.somenteSuperAdmin);

/** Os perfis cujas telas o super-admin escolhe. O próprio super-admin vê sempre todas, para ninguém perder o acesso à configuração. */
export const PERFIS_CONFIGURAVEIS = ["ADMIN", "PADRAO"] as const;
export type PerfilConfiguravel = (typeof PERFIS_CONFIGURAVEIS)[number];

/** O que o super-admin mudou em relação à pré-configuração. Sem ajuste para uma tela, vale a pré-configuração. */
export interface AjusteDeTela {
  papel: PerfilConfiguravel;
  href: string;
  visivel: boolean;
}

/** A pré-configuração: o que cada perfil vê enquanto o super-admin não mudar nada. */
export function visivelNaPreConfiguracao(item: ItemMenu, papel: PerfilConfiguravel): boolean {
  if (item.somenteSuperAdmin) return false;
  return !item.somenteAdmin || papel === "ADMIN";
}

function telaAparece(item: ItemMenu, papel: Papel, ajustes: AjusteDeTela[]): boolean {
  if (papel === "SUPER_ADMIN") return true;
  if (item.somenteSuperAdmin) return false;
  const ajuste = ajustes.find((a) => a.papel === papel && a.href === item.href);
  return ajuste ? ajuste.visivel : visivelNaPreConfiguracao(item, papel);
}

/** Os grupos e itens que cada perfil vê no menu e no Início. As telas continuam abertas pelo endereço; só saem da vista. Grupo sem nenhuma tela some. */
export function gruposVisiveis(papel: Papel | null | undefined, ajustes: AjusteDeTela[] = []): GrupoMenu[] {
  const perfil = papel ?? "PADRAO";
  return GRUPOS_MENU.map((g) => ({ ...g, itens: g.itens.filter((i) => telaAparece(i, perfil, ajustes)) })).filter((g) => g.itens.length > 0);
}

/** A chave de uma marcação na tela Telas por perfil. */
export const chaveDaMarcacao = (papel: PerfilConfiguravel, href: string) => `${papel}|${href}`;

/** O que fica marcado na tela, dados os ajustes gravados. */
export function marcacoesAtuais(ajustes: AjusteDeTela[]): string[] {
  return PERFIS_CONFIGURAVEIS.flatMap((papel) => TELAS_CONFIGURAVEIS.filter((i) => telaAparece(i, papel, ajustes)).map((i) => chaveDaMarcacao(papel, i.href)));
}

/** Transforma as marcações da tela no que se grava: só o que difere da pré-configuração. Chave desconhecida é ignorada. */
export function ajustesDasMarcacoes(marcadas: Iterable<string>): AjusteDeTela[] {
  const conjunto = new Set(marcadas);
  return PERFIS_CONFIGURAVEIS.flatMap((papel) =>
    TELAS_CONFIGURAVEIS.flatMap((item) => {
      const visivel = conjunto.has(chaveDaMarcacao(papel, item.href));
      return visivel === visivelNaPreConfiguracao(item, papel) ? [] : [{ papel, href: item.href, visivel }];
    }),
  );
}

export const ITEM_INICIO: ItemMenu = { href: "/", rotulo: "Início", descricao: "A visão geral dos anos carregados." };

/** Todos os itens, achatados, para saber qual tela está aberta. */
export const TODOS_OS_ITENS: ItemMenu[] = [ITEM_INICIO, ...GRUPOS_MENU.flatMap((g) => g.itens)];

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
