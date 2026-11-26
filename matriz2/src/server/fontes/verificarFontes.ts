import { createHash } from "node:crypto";
import { prisma } from "@/server/db/prisma";
import { arquivosDaPagina, diferencas } from "@/lib/fontes/leituraDeFontes";

export { arquivosDaPagina, diferencas };

/**
 * As fontes oficiais que alimentam o sistema, conferidas toda semana na internet, sem baixar nada para as pastas.
 * Uma página muda quando aparece ou some um arquivo publicado nela (PDF, planilha, CSV, ZIP); o Portal da Transparência,
 * quando sai um mês que ainda não foi carregado; as listas da Câmara e do Senado, quando um parlamentar troca de partido
 * ou entra e sai do mandato. O que mudou fica registrado, e a tela Situação dos dados mostra.
 */
export interface FonteDoCatalogo {
  chave: string;
  nome: string;
  url: string;
  tipo: "pagina" | "portal" | "parlamentares";
  assunto: string;
}

export const FONTES: readonly FonteDoCatalogo[] = [
  {
    chave: "pnp",
    nome: "Plataforma Nilo Peçanha (MEC)",
    url: "https://www.gov.br/mec/pt-br/pnp",
    tipo: "pagina",
    assunto: "Matrículas, cursos, evasão, pessoal e microdados da Rede Federal (telas PNP, Cenários, Evasão).",
  },
  {
    chave: "mdo-online",
    nome: "MDO online (IFTM): Matriz de Distribuição Orçamentária",
    url: "https://mdo.iftm.edu.br/",
    tipo: "pagina",
    assunto: "As fases da matriz, parâmetros e exportações (Matriz, Comparativo, Distribuição, Cenários).",
  },
  {
    chave: "congresso-loa",
    nome: "Congresso Nacional: Lei Orçamentária de 2027",
    url: "https://www.congressonacional.leg.br/web/orcamento/acompanhe/orcamento-anual/-/loa/2027",
    tipo: "pagina",
    assunto: "PLOA, espelho e recibos de emendas, pareceres e a LOA aprovada (telas Emendas e Orçamento da União).",
  },
  {
    chave: "planejamento-loa",
    nome: "Ministério do Planejamento: orçamentos anuais de 2027",
    url: "https://www.gov.br/planejamento/pt-br/assuntos/orcamento/orcamentos-anuais/2027",
    tipo: "pagina",
    assunto: "Projeto e lei orçamentária da União, volumes e anexos (tela Orçamento da União).",
  },
  {
    chave: "portal-despesas",
    nome: "Portal da Transparência: execução da despesa",
    url: "https://portaldatransparencia.gov.br/download-de-dados/despesas-execucao",
    tipo: "portal",
    assunto: "Empenhado, liquidado e pago por câmpus, mês a mês, e as emendas executadas (tela Orçamento da União).",
  },
  {
    chave: "camara-deputados",
    nome: "Câmara dos Deputados: deputados em exercício",
    url: "https://dadosabertos.camara.leg.br/api/v2/deputados?itens=1000",
    tipo: "parlamentares",
    assunto: "Partido e UF de quem destinou as emendas (tela Emendas).",
  },
  {
    chave: "senado-senadores",
    nome: "Senado Federal: senadores em exercício",
    url: "https://legis.senado.leg.br/dadosabertos/senador/lista/atual.json",
    tipo: "parlamentares",
    assunto: "Partido e UF de quem destinou as emendas (tela Emendas).",
  },
  {
    chave: "rs-orcamento",
    nome: "Governo do RS: orçamento do Estado",
    url: "https://planejamento.rs.gov.br/orcamento-estado",
    tipo: "pagina",
    assunto: "Projeto e lei orçamentária do Estado do Rio Grande do Sul.",
  },
  {
    chave: "pmva-orcamento",
    nome: "Prefeitura de Venâncio Aires: leis orçamentárias",
    url: "https://pmva.com.br/?pag=18",
    tipo: "pagina",
    assunto: "LOA, LDO e PPA do município.",
  },
  {
    chave: "camara-va",
    nome: "Câmara de Vereadores de Venâncio Aires",
    url: "https://www.venancioaires.rs.leg.br/",
    tipo: "pagina",
    assunto: "Projeto de lei orçamentária do município e emendas impositivas.",
  },
];

const AGENTE = "Mozilla/5.0 (compatible; verificador-de-fontes)";

async function baixarTexto(url: string, accept = "text/html,application/json"): Promise<string> {
  const r = await fetch(url, { headers: { "User-Agent": AGENTE, Accept: accept }, redirect: "follow", signal: AbortSignal.timeout(60_000) });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.text();
}

const hash = (s: string) => createHash("sha256").update(s).digest("hex");

interface Leitura {
  assinatura: string;
  conteudo: string[];
}

async function lerPagina(f: FonteDoCatalogo): Promise<Leitura> {
  const html = await baixarTexto(f.url);
  const arquivos = arquivosDaPagina(html, f.url);
  if (arquivos.length > 0) return { assinatura: hash(arquivos.join("\n")), conteudo: arquivos };
  // Sem arquivo na página: compara o texto visível, sem scripts nem estilos.
  const texto = html
    .replace(/<(script|style|noscript)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return { assinatura: hash(texto), conteudo: [`(sem arquivos; texto com ${texto.length} caracteres)`] };
}

/** Os meses do Portal publicados depois do último mês carregado, até o mês corrente. */
async function lerPortal(): Promise<Leitura> {
  const ultimo = await prisma.execucaoDespesaUg.findFirst({ orderBy: [{ ano: "desc" }, { mes: "desc" }], select: { ano: true, mes: true } });
  const hoje = new Date();
  const disponiveis: string[] = [];
  let ano = ultimo?.ano ?? hoje.getFullYear();
  let mes = ultimo?.mes ?? 0;
  for (let i = 0; i < 14; i++) {
    mes += 1;
    if (mes > 12) [ano, mes] = [ano + 1, 1];
    if (ano > hoje.getFullYear() || (ano === hoje.getFullYear() && mes > hoje.getMonth() + 1)) break;
    const am = `${ano}${String(mes).padStart(2, "0")}`;
    const r = await fetch(`https://portaldatransparencia.gov.br/download-de-dados/despesas-execucao/${am}`, {
      method: "HEAD",
      headers: { "User-Agent": AGENTE },
      redirect: "follow",
      signal: AbortSignal.timeout(60_000),
    });
    if (r.ok && Number(r.headers.get("content-length") ?? 0) > 1000) disponiveis.push(`${am} publicado, ainda não carregado`);
  }
  const ultimoTexto = ultimo ? `${ultimo.ano}${String(ultimo.mes).padStart(2, "0")}` : "nenhum";
  const conteudo = [`último mês carregado: ${ultimoTexto}`, ...disponiveis];
  return { assinatura: hash(conteudo.join("\n")), conteudo };
}

async function lerParlamentares(f: FonteDoCatalogo): Promise<Leitura> {
  let lista: string[];
  if (f.chave === "camara-deputados") {
    const j = JSON.parse(await baixarTexto(f.url, "application/json")) as { dados: Array<{ nome: string; siglaPartido: string; siglaUf: string }> };
    lista = j.dados.map((d) => `${d.nome} (${d.siglaPartido}/${d.siglaUf})`);
  } else {
    const j = JSON.parse(await baixarTexto(f.url, "application/json")) as {
      ListaParlamentarEmExercicio: { Parlamentares: { Parlamentar: Array<{ IdentificacaoParlamentar: { NomeParlamentar: string; SiglaPartidoParlamentar: string; UfParlamentar: string } }> } };
    };
    lista = j.ListaParlamentarEmExercicio.Parlamentares.Parlamentar.map((p) => {
      const i = p.IdentificacaoParlamentar;
      return `${i.NomeParlamentar} (${i.SiglaPartidoParlamentar}/${i.UfParlamentar})`;
    });
  }
  lista = [...new Set(lista)].sort((a, b) => a.localeCompare(b, "pt-BR"));
  return { assinatura: hash(lista.join("\n")), conteudo: lista };
}

export interface ResultadoDaVerificacao {
  chave: string;
  nome: string;
  mudou: boolean;
  primeira: boolean;
  erro?: string;
  novidades?: string;
}

/** Confere todas as fontes (ou só uma) e grava o resultado. A primeira conferência de uma fonte só guarda o ponto de partida. */
export async function verificarFontes(so?: string): Promise<ResultadoDaVerificacao[]> {
  const resultados: ResultadoDaVerificacao[] = [];
  for (const f of FONTES.filter((x) => !so || x.chave === so)) {
    const fonte = await prisma.fonteMonitorada.upsert({
      where: { chave: f.chave },
      create: { chave: f.chave, nome: f.nome, url: f.url, tipo: f.tipo, assunto: f.assunto },
      update: { nome: f.nome, url: f.url, tipo: f.tipo, assunto: f.assunto },
    });
    const agora = new Date();
    try {
      const l = f.tipo === "portal" ? await lerPortal() : f.tipo === "parlamentares" ? await lerParlamentares(f) : await lerPagina(f);
      const primeira = !fonte.assinatura;
      const mudou = !primeira && fonte.assinatura !== l.assinatura;
      const antes: string[] = fonte.conteudo ? (JSON.parse(fonte.conteudo) as string[]) : [];
      const novidades = mudou ? diferencas(antes, l.conteudo) || "O conteúdo da página mudou." : primeira ? "Primeira conferência: ponto de partida guardado." : null;
      await prisma.fonteMonitorada.update({
        where: { id: fonte.id },
        data: { assinatura: l.assinatura, conteudo: JSON.stringify(l.conteudo), verificadoEm: agora, erro: null, ...(mudou ? { mudouEm: agora } : {}) },
      });
      await prisma.verificacaoFonte.create({ data: { fonteId: fonte.id, em: agora, mudou, novidades } });
      resultados.push({ chave: f.chave, nome: f.nome, mudou, primeira, novidades: novidades ?? undefined });
    } catch (e) {
      const erro = (e instanceof Error ? e.message : String(e)).slice(0, 500);
      await prisma.fonteMonitorada.update({ where: { id: fonte.id }, data: { verificadoEm: agora, erro } });
      await prisma.verificacaoFonte.create({ data: { fonteId: fonte.id, em: agora, mudou: false, erro } });
      resultados.push({ chave: f.chave, nome: f.nome, mudou: false, primeira: false, erro });
    }
  }
  return resultados;
}
