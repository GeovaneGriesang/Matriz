import fs from "node:fs";
import path from "node:path";
import { Prisma } from "@prisma/client";
import { prisma } from "@/server/db/prisma";
import { RAIZ_DADOS } from "./caminhos";
import { lerEspelhoEmendas, lerRecibos, type EmendaDoEspelho } from "./lerEspelhoEmendas";

/**
 * Carrega as emendas de despesa apresentadas ao PLOA que interessam à Rede Federal, a partir do espelho oficial da Comissão Mista de
 * Orçamento e do recibo de entrega das emendas individuais, ambos em PDF no portal do Congresso Nacional e convertidos em texto
 * (`pdftotext -enc UTF-8 -raw`) na pasta `Emendas/<exercício>/_texto`.
 *
 * Entram as emendas cuja unidade orçamentária é uma instituição da rede (IFs 26402 a 26439, CEFETs 26256 e 26257, Colégio Pedro II
 * 26201) e as do MEC (26101) nas ações da rede (219U e 15R4), que ainda não dizem qual instituição recebe.
 */

const UO_DA_REDE = /^26(4[0-3]\d|25[67]|201)$/;
const ACOES_DA_REDE_NO_MEC = new Set(["219U", "15R4"]);

/** Nome sem acento, em maiúsculas, sem "do/de/da" e sem pontuação: "Instituto Federal do Mato Grosso do Sul" = "INSTITUTO FEDERAL DE MATO GROSSO DO SUL". */
function normalizar(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z ]/g, " ")
    .split(/\s+/)
    .filter((p) => p && !["DO", "DE", "DA", "DOS", "DAS"].includes(p))
    .join(" ");
}

/** A UF da localidade beneficiada ("4300000 - Rio Grande do Sul") ou do subtítulo ("No Município de Matão - SP"). */
const UF_POR_ESTADO: Record<string, string> = {
  ACRE: "AC", ALAGOAS: "AL", AMAPA: "AP", AMAZONAS: "AM", BAHIA: "BA", CEARA: "CE", "DISTRITO FEDERAL": "DF", "ESPIRITO SANTO": "ES",
  GOIAS: "GO", MARANHAO: "MA", "MATO GROSSO": "MT", "MATO GROSSO SUL": "MS", "MINAS GERAIS": "MG", PARA: "PA", PARAIBA: "PB",
  PARANA: "PR", PERNAMBUCO: "PE", PIAUI: "PI", "RIO JANEIRO": "RJ", "RIO GRANDE NORTE": "RN", "RIO GRANDE SUL": "RS", RONDONIA: "RO",
  RORAIMA: "RR", "SANTA CATARINA": "SC", "SAO PAULO": "SP", SERGIPE: "SE", TOCANTINS: "TO",
};

function ufDa(e: EmendaDoEspelho, ufDaInstituicao: string | undefined): string | null {
  const m = e.subtitulo.match(/ - ([A-Z]{2})$/);
  if (m) return m[1]!;
  const estado = normalizar(e.localidade.replace(/^\d+ - /, "")).replace(/^ESTADO /, "");
  if (UF_POR_ESTADO[estado]) return UF_POR_ESTADO[estado]!;
  const noSubtitulo = normalizar(e.subtitulo.replace(/^\d+ - /, "")).replace(/^NO ESTADO /, "").replace(/^NO /, "");
  return UF_POR_ESTADO[noSubtitulo] ?? ufDaInstituicao ?? null;
}

interface Parlamentar {
  nome: string;
  partido: string;
  uf: string;
}

/** As listas oficiais de deputados (Câmara, legislatura atual) e senadores (Senado, em exercício), guardadas em Emendas/<exercício>/_autores. */
function listaDeParlamentares(pasta: string, arquivo: string): Map<string, Parlamentar> {
  const caminho = path.join(pasta, arquivo);
  const m = new Map<string, Parlamentar>();
  if (!fs.existsSync(caminho)) return m;
  for (const p of JSON.parse(fs.readFileSync(caminho, "utf8")) as Parlamentar[]) m.set(normalizar(p.nome), p);
  return m;
}

/** Partido e UF de quem apresentou a emenda: deputado e senador pelas listas oficiais; bancada estadual pela UF do nome; comissão fica sem. */
function partidoEUfDoAutor(e: EmendaDoEspelho, deputados: Map<string, Parlamentar>, senadores: Map<string, Parlamentar>): { partido: string | null; uf: string | null } {
  if (e.tipoAutor === "Bancada Estadual") {
    const estado = normalizar(e.autor.replace(/^Bancada (do|da|de|dos|das)? ?/i, "")).replace(/^ESTADO /, "");
    return { partido: null, uf: UF_POR_ESTADO[estado] ?? null };
  }
  const lista = e.tipoAutor === "Senador" ? senadores : e.tipoAutor === "Deputado Federal" ? deputados : null;
  // Alguns autores vêm com o tratamento no nome ("Dep. Josivaldo JP").
  const p = lista?.get(normalizar(e.autor.replace(/^(Dep|Sen)\. ?/i, "")));
  return p ? { partido: p.partido, uf: p.uf } : { partido: null, uf: null };
}

export interface ResultadoEmendasApresentadas {
  exercicio: number;
  noEspelho: number;
  gravadas: number;
  diretas: number;
  viaMec: number;
  total: number;
  semInstituicao: string[];
  autoresSemPartido: string[];
}

export async function carregarEmendasApresentadas(exercicio: number): Promise<ResultadoEmendasApresentadas> {
  const pasta = path.join(RAIZ_DADOS, "Emendas", String(exercicio), "_texto");
  const arqEspelho = path.join(pasta, "espelho_despesa.txt");
  const arqRecibos = path.join(pasta, "recibos_individuais.txt");
  if (!fs.existsSync(arqEspelho)) throw new Error(`Espelho das emendas não encontrado: ${arqEspelho}`);
  const textoDoEspelho = fs.readFileSync(arqEspelho, "utf8");
  const todas = lerEspelhoEmendas(textoDoEspelho);
  // O número do projeto de lei vem no cabeçalho de cada página do espelho ("PLN 29/2023 - Projeto de Lei Orçamentária Anual para 2024").
  const pln = new RegExp(`PLN (\\d+/\\d{4}) - Projeto de Lei Or[çc]ament[áa]ria Anual para ${exercicio}`).exec(textoDoEspelho)?.[1];
  const recibos = fs.existsSync(arqRecibos) ? lerRecibos(fs.readFileSync(arqRecibos, "utf8")) : null;
  const pastaAutores = path.join(RAIZ_DADOS, "Emendas", String(exercicio), "_autores");
  const deputados = listaDeParlamentares(pastaAutores, "deputados.json");
  const senadores = listaDeParlamentares(pastaAutores, "senadores.json");
  const autoresSemPartido = new Set<string>();

  // As instituições em uso (as que têm comparativo): o cadastro tem linhas repetidas de cargas antigas.
  const instituicoes = await prisma.instituicao.findMany({ where: { comparativos: { some: {} } }, select: { id: true, nome: true, uf: true } });
  const porNome = instituicoes.map((i) => ({ ...i, chave: normalizar(i.nome) }));
  const semInstituicao = new Set<string>();

  const fonte =
    `Congresso Nacional, Comissão Mista de Planos, Orçamentos Públicos e Fiscalização: ${pln ? `PLN ${pln} ` : ""}(PLOA ${exercicio}), ` +
    `"Espelho - Emendas de Despesa" e recibo de entrega das emendas individuais (RECIBOS-Individuais), portal congressonacional.leg.br. ` +
    `Partido e UF dos parlamentares: dados abertos da Câmara dos Deputados e do Senado Federal, da legislatura em que a emenda foi apresentada.`;

  const dados: Prisma.EmendaApresentadaCreateManyInput[] = [];
  for (const e of todas) {
    const direta = UO_DA_REDE.test(e.uoCodigo);
    const viaMec = e.uoCodigo === "26101" && ACOES_DA_REDE_NO_MEC.has(e.acao);
    if (!direta && !viaMec) continue;
    let inst: (typeof porNome)[number] | undefined;
    if (direta) {
      // O nome da UO pode vir cortado na quebra de linha do PDF ("Centro Federal de Educação Tecnológica Celso"): basta o começo bater.
      const chave = normalizar(e.uoNome);
      inst = porNome.find((i) => i.chave === chave) ?? porNome.find((i) => i.chave.startsWith(chave));
      if (!inst) semInstituicao.add(`${e.uoCodigo} - ${e.uoNome}`);
    }
    const autorInfo = partidoEUfDoAutor(e, deputados, senadores);
    if (!autorInfo.uf && e.tipoAutor !== "Comissão" && !e.tipoAutor.startsWith("Comissão")) autoresSemPartido.add(`${e.tipoAutor}: ${e.autor}`);
    const soma = (g: (n: number) => boolean) => e.acrescimos.filter((a) => g(a.gnd)).reduce((s, a) => s + a.valor, 0);
    dados.push({
      exercicio,
      numero: e.numero,
      modalidade: e.modalidade,
      tipoAutor: e.tipoAutor,
      autorCodigo: e.autorCodigo,
      autor: e.autor.slice(0, 160),
      partidoAutor: autorInfo.partido,
      ufAutor: autorInfo.uf,
      ementa: e.ementa,
      uoCodigo: e.uoCodigo,
      uoNome: e.uoNome.slice(0, 255),
      instituicaoId: inst?.id ?? null,
      uf: ufDa(e, inst?.uf),
      funcional: e.funcional.slice(0, 40),
      acao: e.acao,
      acaoDescricao: e.acaoDescricao.slice(0, 255),
      subtitulo: e.subtitulo.slice(0, 255),
      localidade: e.localidade.slice(0, 120),
      valorGnd3: soma((g) => g === 3),
      valorGnd4: soma((g) => g === 4),
      valorOutros: soma((g) => g !== 3 && g !== 4),
      valorTotal: e.total,
      comRecibo: e.modalidade === "Individual" && recibos ? recibos.has(e.numero) : null,
      justificativa: e.justificativa,
      fonte,
    });
  }

  await prisma.$transaction([
    prisma.emendaApresentada.deleteMany({ where: { exercicio } }),
    prisma.emendaApresentada.createMany({ data: dados }),
  ]);

  return {
    exercicio,
    noEspelho: todas.length,
    gravadas: dados.length,
    diretas: dados.filter((d) => d.uoCodigo !== "26101").length,
    viaMec: dados.filter((d) => d.uoCodigo === "26101").length,
    total: dados.reduce((s, d) => s + Number(d.valorTotal), 0),
    semInstituicao: [...semInstituicao],
    autoresSemPartido: [...autoresSemPartido],
  };
}
