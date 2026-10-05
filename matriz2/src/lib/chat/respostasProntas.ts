import { itemAtivo } from "@/lib/menu";
import { conhecimentoDaTela } from "./conhecimento";

/**
 * Respostas prontas para as perguntas mais comuns sobre a regra da matriz. São escritas a partir do que o sistema já tem conferido (Portaria
 * MEC 243/2026 e a página "Como funciona"), aparecem na hora e não passam pelo modelo de linguagem, que em CPU é lento e erra número simples.
 * O que não casa aqui segue para o modelo.
 *
 * Cada resposta pronta exige palavras-chave bem específicas, para não responder uma pergunta parecida com o texto errado. Perguntas sobre um
 * valor de uma instituição, câmpus ou ano ("quanto o IFSul recebe no Funcionamento em 2027?") NÃO casam com as de percentual de bloco.
 */

function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9%$ ,.]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

interface Contexto {
  rota: string;
  modelo?: string;
}

interface Pronta {
  id: string;
  casa: (t: string) => boolean;
  resposta: (c: Contexto, t: string) => string;
}

const tem = (t: string, re: RegExp) => re.test(t);
/** Pergunta sobre um valor em reais de uma instituição, câmpus, curso ou ano: não é sobre a regra geral. */
const ESPECIFICA = /(campus|instituto|ifsul|ifrs|iffar|ifsc|ifpr|curso|reais|r\$|202[0-9]|ug |unidade gestora|empenh|pago|execucao)/;
const PERCENTUAL = /(quanto|quantos|percent|por cento|%|fatia|parte|proporcao)/;

const PRONTAS: Pronta[] = [
  {
    id: "blocos",
    casa: (t) => tem(t, /(quais|quantos|que|os) blocos|blocos da matriz|como (se )?divide o orcamento|divisao do orcamento/) && !tem(t, ESPECIFICA),
    resposta: () =>
      "A matriz tem quatro blocos. A Assistência Estudantil sai primeiro. Do restante, 80% é o Funcionamento (por câmpus, pela Matrícula Total), 10% é a Reitoria/Direção-Geral (mesma base, por instituição) e 10% é Qualidade e Eficiência (indicadores IEA, RAPP e IAML, por instituição).",
  },
  {
    id: "funcionamento",
    casa: (t) => tem(t, /funcionamento/) && tem(t, PERCENTUAL) && !tem(t, ESPECIFICA) && !tem(t, /20rl/),
    resposta: () => "O bloco Funcionamento fica com 80% do orçamento a distribuir, depois de tirar a Assistência Estudantil. Os outros 20% são 10% para a Reitoria/Direção-Geral e 10% para Qualidade e Eficiência.",
  },
  {
    id: "reitoria",
    casa: (t) => tem(t, /reitoria|direcao.geral/) && tem(t, PERCENTUAL) && !tem(t, ESPECIFICA) && !tem(t, /(ug|execucao|gast)/),
    resposta: () => "O bloco Reitoria/Direção-Geral recebe 10% do orçamento, depois de tirar a Assistência Estudantil. Usa a mesma base do Funcionamento (a Matrícula Total), mas é calculado por instituição.",
  },
  {
    id: "qualidade",
    casa: (t) => tem(t, /qualidade e eficiencia/) && tem(t, PERCENTUAL) && !tem(t, ESPECIFICA),
    resposta: () => "O bloco Qualidade e Eficiência recebe 10% do orçamento, depois de tirar a Assistência Estudantil. É distribuído por instituição, pelos indicadores IEA (eficiência acadêmica), RAPP (relação aluno-professor) e IAML (atendimento ao marco legal).",
  },
  {
    id: "piso",
    casa: (t) => tem(t, /piso/) && !tem(t, /(salarial|salario)/),
    resposta: () =>
      "O Piso Mínimo é de R$ 700 mil por câmpus novo, por 5 anos a contar da autorização. Câmpus autorizado depois da publicação da PNP só entra na matriz no exercício seguinte. Em 2027, 53 câmpus recebem o piso.",
  },
  {
    id: "mooc",
    casa: (t) => tem(t, /mooc/),
    resposta: () => "O curso MOOC (a distância, on-line) vale 8% do presencial na matriz. A distância com financiamento externo vale 25% e com financiamento próprio, 80%.",
  },
  {
    id: "ead",
    casa: (t) => tem(t, /(a distancia|ead)/) && tem(t, /(quanto|vale|valor|peso|financiamento|proporcao)/) && !tem(t, ESPECIFICA),
    resposta: () => "Em relação ao presencial, a educação a distância vale 80% quando tem financiamento próprio, 25% quando tem financiamento externo e 8% no caso dos cursos MOOC.",
  },
  {
    id: "icqa",
    casa: (t) => tem(t, /icqa/),
    resposta: () => "O ICQA é a fração dos alunos de um ciclo que a MDO conta: 1 para o aluno regular, 0,5 para o retido que passou do término mas está dentro do prazo de jubilamento, e 0 depois desse prazo.",
  },
  {
    id: "retido",
    casa: (t) =>
      (tem(t, /(retid|jubila)/) && tem(t, /(tempo|quanto|prazo|conta|anos|ate quando|quando)/)) ||
      (tem(t, /(passaram|passou|alem|apos|depois)( do| de)? (o )?(prazo|termino|fim)/) && tem(t, /(alun|conta|matriz)/)),
    resposta: () => "O aluno retido (que passou do término do ciclo) conta pela metade, com ICQA 0,5, até 3 anos depois do término; depois disso deixa de contar. O curso FIC (qualificação profissional) não tem esse prazo.",
  },
  {
    id: "pnp-ano",
    casa: (t) => tem(t, /pnp/) && tem(t, /(qual ano|que ano|defasagem|dois anos|usa|utiliza|base)/) && tem(t, /(matriz|dados|ciclo)/),
    resposta: () => "A matriz de um ano usa os dados da PNP de dois anos antes: a matriz de 2027 usa a PNP de 2025.",
  },
  {
    id: "loa-campus",
    casa: (t) => tem(t, /(loa|ploa)/) && tem(t, /(por campus|valor por campus|tem valor|detalha|campus)/) && tem(t, /(campus)/),
    resposta: () =>
      "Não. A LOA e o PLOA vão só até a instituição e o estado; não existe valor por câmpus nesses documentos. O valor por câmpus vem da matriz (MDO) e, na execução, das unidades gestoras de cada câmpus.",
  },
  {
    id: "acoes",
    casa: (t) => tem(t, /(20rl|2994|20rg)/) && tem(t, /(o que|qual|significa|e a acao)/) && !tem(t, /(gast|quanto|reitoria|ifsul|campus|empenh|pago|valor|202[0-9])/),
    resposta: (_c, t) => {
      const partes: string[] = [];
      if (/20rl/.test(t)) partes.push("A ação 20RL é o funcionamento das instituições da Rede Federal (o dinheiro que a matriz distribui por câmpus).");
      if (/2994/.test(t)) partes.push("A ação 2994 é a assistência aos estudantes (assistência estudantil).");
      if (/20rg/.test(t)) partes.push("A ação 20RG é a reestruturação e modernização das instituições.");
      return partes.join(" ");
    },
  },
  {
    id: "pesos",
    casa: (t) => tem(t, /peso/) && tem(t, /(licenciatura|mestrado|doutorado|agropecuaria|curso|laboratorio)/) && !tem(t, /(campus|instituto|ifsul|reais|r\$|202[0-9])/),
    resposta: () =>
      "O peso do curso vai de 1,0 a 2,5 conforme os laboratórios previstos; a licenciatura tem peso 2,5; mestrado e doutorado, 3,75. Curso de agropecuária tem ainda um bônus de 50%.",
  },
  {
    id: "matricula-total",
    casa: (t) => tem(t, /matricula total/) && tem(t, /(o que|como|calcul|formula|significa)/) && !tem(t, ESPECIFICA),
    resposta: () =>
      "A Matrícula Total de um ciclo de curso é: alunos x peso do curso x carga horária dividida por 800 horas por ano x a fração dos dias do ano em que o ciclo esteve ativo. Cursos de agropecuária ganham bônus de 50%, e o aluno retido conta pela metade (ICQA 0,5) até 3 anos.",
  },
  {
    id: "o-que-e-a-matriz",
    casa: (t) => tem(t, /(o que (e|significa)|para que serve) (a |o )?(matriz|mdo)/),
    resposta: () =>
      "A Matriz de Distribuição Orçamentária (MDO) reparte o orçamento da Rede Federal (IFs, Cefets e Colégio Pedro II) entre as instituições e os câmpus, conforme a Portaria MEC 243/2026. Quem calcula e homologa é a MDO, coordenada pelo IFTM com a Comissão Paritária; este sistema importa o resultado oficial, para conferir, comparar e simular.",
  },
  {
    id: "ciclo",
    casa: (t) => tem(t, /ciclo/) && tem(t, /(o que (e|significa)|diferenca|quer dizer)/),
    resposta: () =>
      "Há dois sentidos. Ciclo de curso é uma turma, com início, término e alunos. Ciclo orçamentário é o ano da matriz (2027, por exemplo), que usa os dados da PNP de dois anos antes.",
  },
  {
    id: "confianca",
    casa: (t) => tem(t, /(conferido|atencao|estimado)/) && tem(t, /(marca|selo|etiqueta|significa|o que)/),
    resposta: () =>
      "As marcas dizem o quanto confiar no número. Conferido: bate com o oficial da MDO ou com o Excel. Atenção: há uma inconsistência na fonte ou um dado que falta. Estimado: é uma hipótese nossa, com as premissas explicadas na própria marca.",
  },
  {
    id: "quem-calcula",
    casa: (t) => tem(t, /quem (calcula|faz|define|homologa)/) && tem(t, /(matriz|mdo)/),
    resposta: () => "A matriz é calculada e homologada pela MDO, coordenada pelo IFTM com a Comissão Paritária. Este sistema não recalcula nada: importa o resultado oficial para conferir, comparar e simular.",
  },
  {
    id: "que-ia",
    casa: (t) => tem(t, /(que|qual) (ia|modelo|llm|inteligencia artificial)|voce e (uma )?(ia|robo|inteligencia)|quem e voce|o que voce e/),
    resposta: (c) =>
      `Sou um assistente de inteligência artificial${c.modelo ? ` que usa o modelo ${c.modelo}` : ""}. Respondo com base no texto do sistema; posso errar, por isso confira os números na tela.`,
  },
  {
    id: "esta-tela",
    casa: (t) => tem(t, /(o que|para que|qual).*(esta|essa|desta|dessa|a) (tela|pagina)|(o que|para que) (serve|mostra)/) && tem(t, /(tela|pagina|serve|mostra)/),
    resposta: (c) => {
      const item = itemAtivo(c.rota);
      if (!item) return "Esta é a página inicial: ela lista os ciclos carregados e leva às telas por pergunta (consultar, simular, conferir e ver os dados).";
      return `${item.rotulo}: ${item.descricao} ${conhecimentoDaTela(c.rota)}`.trim();
    },
  },
];

/** A resposta pronta para a pergunta, ou null se nenhuma casar (e então a pergunta vai ao modelo). */
export function respostaPronta(pergunta: string, rota: string, modelo?: string): string | null {
  const t = normalizar(pergunta);
  if (t.length === 0 || t.length > 220) return null;
  const achada = PRONTAS.find((p) => p.casa(t));
  return achada ? achada.resposta({ rota, modelo }, t) : null;
}

/** Os identificadores das respostas prontas, para os testes saberem quais existem. */
export const IDS_DAS_RESPOSTAS_PRONTAS = PRONTAS.map((p) => p.id);
