import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import ExcelJS from "exceljs";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/server/db/prisma";
import { exigirArquivo, pastaLoa } from "./caminhos";
import { NOME_DA_ACAO, lerCreditos, lerTotaisDoQuadroSintese, type TotalQuadro } from "@/lib/orcamento/lerQuadroLoa";

/**
 * Carrega o orçamento da União de UMA instituição a partir dos PDFs da LOA e do PLOA (volume 5, "Detalhamento das Ações") e as emendas
 * individuais do relatório do SIOP. Os PDFs só detalham até a instituição e o estado: não há valor por câmpus.
 *
 * O texto é extraído com `pdftotext` (poppler) e guardado em `PLOA e LOA/_texto/`; onde o `pdftotext` não existe (a VM de produção),
 * a carga usa esse texto guardado. Cada documento é conferido: a soma dos créditos tem de fechar com o total do próprio Quadro Síntese.
 */

interface Documento {
  documento: "LOA" | "PLOA";
  exercicio: number;
  /** Caminho do PDF dentro de "PLOA e LOA". */
  pdf: string[];
  /** Páginas da unidade orçamentária no volume (primeira e última). */
  paginas: [number, number];
  nome: string;
  /** Ordem das colunas da linha Total do Quadro Síntese deste documento. */
  ordem: Parameters<typeof lerTotaisDoQuadroSintese>[1];
}

const DOCUMENTOS: Documento[] = [
  {
    documento: "PLOA",
    exercicio: 2026,
    pdf: ["2026", "1 - PLOA", "1 - Projeto de Lei Orçamentária Anual - PLOA", "Volume5PLOA2026.pdf"],
    paginas: [506, 508],
    nome: "PLOA 2026, Volume V (Detalhamento das Ações)",
    ordem: {
      colunas: [["LEI_CREDITOS", 2024], ["EMPENHADO", 2024], ["PLOA", 2025], ["PLOA", 2026]],
      solto: ["LOA", 2025],
    },
  },
  {
    documento: "LOA",
    exercicio: 2026,
    pdf: ["2026", "2 - LOA", "1 - Volumes", "l15346-26-anexo-volume5.pdf"],
    paginas: [384, 386],
    nome: "LOA 2026 (Lei nº 15.346/2026), Volume V (Detalhamento das Ações)",
    ordem: {
      colunas: [["PLOA", 2025], ["LOA", 2025], ["PLOA", 2026], ["LOA", 2026]],
      solto: ["EMPENHADO", 2024],
    },
  },
  {
    documento: "PLOA",
    exercicio: 2027,
    pdf: ["2027", "1 - PLOA", "1 - Projeto de Lei Orçamentária Anual - PLOA", "Volume5FinalPLOA2027_Momento5000_SiopProducao202608281858.pdf"],
    paginas: [511, 513],
    nome: "PLOA 2027 (versão de 28/08/2026), Volume V (Detalhamento das Ações)",
    ordem: {
      colunas: [["LEI_CREDITOS", 2025], ["EMPENHADO", 2025], ["PLOA", 2026], ["PLOA", 2027]],
      solto: ["LOA", 2026],
    },
  },
];

function textoDoDocumento(d: Documento, unidade: string): string {
  const cache = pastaLoa("_texto", `${unidade}_${d.documento}_${d.exercicio}.txt`);
  const pdf = pastaLoa(...d.pdf);
  if (fs.existsSync(pdf)) {
    const r = spawnSync("pdftotext", ["-f", String(d.paginas[0]), "-l", String(d.paginas[1]), "-raw", pdf, "-"], {
      encoding: "latin1",
      maxBuffer: 64 * 1024 * 1024,
    });
    if (r.status === 0 && r.stdout.length > 0) {
      fs.mkdirSync(path.dirname(cache), { recursive: true });
      fs.writeFileSync(cache, r.stdout, "latin1");
      return r.stdout;
    }
  }
  return fs.readFileSync(exigirArquivo(cache, `o texto extraído de ${d.nome} (o PDF não está aqui ou o pdftotext não existe)`), "latin1");
}

export interface ResultadoLoa {
  linhas: number;
  totais: number;
  avisos: string[];
}

export async function carregarOrcamentoLoa(sigla: string, unidadeOrcamentaria: string): Promise<ResultadoLoa> {
  const instituicao = await prisma.instituicao.findUnique({ where: { sigla: sigla.toUpperCase() } });
  if (!instituicao) throw new Error(`Instituição ${sigla} não existe no banco.`);

  const avisos: string[] = [];
  const linhasParaGravar: Prisma.OrcamentoLoaLinhaCreateManyInput[] = [];
  const totais = new Map<string, TotalQuadro & { fonte: string }>();

  for (const d of DOCUMENTOS) {
    const texto = textoDoDocumento(d, sigla.toUpperCase());
    const creditos = lerCreditos(texto);
    const quadro = lerTotaisDoQuadroSintese(texto, d.ordem);
    const proprio = quadro.find((t) => t.documento === d.documento && t.exercicio === d.exercicio);
    const soma = creditos.reduce((s, c) => s + c.valor, 0);
    if (!proprio || Math.abs(soma - proprio.valor) > 1) {
      throw new Error(`${d.nome}: a soma dos créditos lidos (${soma}) não fecha com o total do Quadro Síntese (${proprio?.valor}).`);
    }
    const fonte = `${d.nome}, unidade ${unidadeOrcamentaria}, páginas ${d.paginas[0]} a ${d.paginas[1]}`;
    for (const c of creditos) {
      if (!NOME_DA_ACAO[c.acao]) avisos.push(`${d.nome}: ação ${c.acao} sem nome cadastrado; gravada só com o código.`);
      linhasParaGravar.push({
        instituicaoId: instituicao.id,
        documento: d.documento,
        exercicio: d.exercicio,
        programa: c.programa,
        acao: c.acao,
        acaoDescricao: NOME_DA_ACAO[c.acao] ?? c.acao,
        localizador: c.localizador,
        gnd: c.gnd,
        resultadoPrimario: c.resultadoPrimario,
        modalidade: c.modalidade,
        fonteRecurso: c.fonteRecurso,
        valor: c.valor,
        produto: c.produto,
        meta: c.meta,
        fonte,
      });
    }
    for (const t of quadro) {
      const chave = `${t.documento}:${t.exercicio}`;
      const ja = totais.get(chave);
      if (ja && Math.abs(ja.valor - t.valor) > 1) avisos.push(`${chave}: ${d.nome} diz ${t.valor}, mas outro documento disse ${ja.valor}; ficou o primeiro.`);
      if (!ja) totais.set(chave, { ...t, fonte: `${d.nome}, Quadro Síntese da unidade ${unidadeOrcamentaria}` });
    }
  }

  await prisma.$transaction([
    prisma.orcamentoLoaLinha.deleteMany({ where: { instituicaoId: instituicao.id } }),
    prisma.orcamentoLoaTotal.deleteMany({ where: { instituicaoId: instituicao.id } }),
    prisma.orcamentoLoaLinha.createMany({ data: linhasParaGravar }),
    prisma.orcamentoLoaTotal.createMany({
      data: [...totais.values()].map((t) => ({ instituicaoId: instituicao.id, documento: t.documento, exercicio: t.exercicio, valor: t.valor, fonte: t.fonte })),
    }),
  ]);
  return { linhas: linhasParaGravar.length, totais: totais.size, avisos };
}

// ---------------------------------------------------------------------------
// Emendas individuais (SIOP)
// ---------------------------------------------------------------------------

const COL_EMENDA = {
  exercicio: 0,
  autor: 1,
  numero: 2,
  uoDesc: 8,
  acao: 12,
  acaoDesc: 13,
  localizadorDesc: 15,
  beneficiarioNome: 21,
  aprovado: 22,
  indicado: 23,
  impedido: 24,
  tipoImpedimento: 25,
  justificativa: 26,
} as const;

function valorDaCelula(c: unknown): unknown {
  return c && typeof c === "object" && "result" in (c as object) ? (c as { result: unknown }).result : c;
}
const textoDaCelula = (c: unknown) => String(valorDaCelula(c) ?? "").trim();
const numeroDaCelula = (c: unknown) => Number(valorDaCelula(c) ?? 0) || 0;

export interface ResultadoEmendas {
  linhas: number;
  arquivo: string;
}

/** Lê o relatório de emendas do SIOP e grava as linhas em que a instituição é a unidade orçamentária ou a beneficiária. */
export async function carregarEmendas(sigla: string, unidadeOrcamentaria: string, nomeNoRelatorio: RegExp): Promise<ResultadoEmendas | null> {
  const pasta = pastaLoa("2026", "3 - Emendas");
  if (!fs.existsSync(pasta)) return null;
  const nome = fs.readdirSync(pasta).filter((n) => n.toLowerCase().endsWith(".xlsx")).sort().pop();
  if (!nome) return null;
  const caminho = path.join(pasta, nome);

  const instituicao = await prisma.instituicao.findUnique({ where: { sigla: sigla.toUpperCase() } });
  if (!instituicao) throw new Error(`Instituição ${sigla} não existe no banco.`);

  const leitor = new ExcelJS.stream.xlsx.WorkbookReader(caminho, { entries: "emit", worksheets: "emit", sharedStrings: "cache", styles: "ignore" });
  const dados: Prisma.EmendaParlamentarCreateManyInput[] = [];
  let geracao = "";
  for await (const planilha of leitor) {
    let n = 0;
    for await (const linha of planilha) {
      n++;
      const v = (linha.values as unknown[]).slice(1);
      if (n === 3) geracao = textoDaCelula(v[0]);
      if (n < 6) continue;
      const uo = textoDaCelula(v[COL_EMENDA.uoDesc]);
      const beneficiario = textoDaCelula(v[COL_EMENDA.beneficiarioNome]);
      if (!uo.includes(unidadeOrcamentaria) && !nomeNoRelatorio.test(beneficiario)) continue;
      dados.push({
        instituicaoId: instituicao.id,
        exercicio: numeroDaCelula(v[COL_EMENDA.exercicio]),
        autor: textoDaCelula(v[COL_EMENDA.autor]),
        numeroEmenda: textoDaCelula(v[COL_EMENDA.numero]),
        acao: textoDaCelula(v[COL_EMENDA.acao]).slice(0, 10),
        acaoDescricao: textoDaCelula(v[COL_EMENDA.acaoDesc]).replace(/^[0-9A-Z]{4} - /, ""),
        localizador: textoDaCelula(v[COL_EMENDA.localizadorDesc]),
        beneficiario,
        valorAprovado: numeroDaCelula(v[COL_EMENDA.aprovado]),
        valorIndicado: numeroDaCelula(v[COL_EMENDA.indicado]),
        valorImpedido: numeroDaCelula(v[COL_EMENDA.impedido]),
        tipoImpedimento: textoDaCelula(v[COL_EMENDA.tipoImpedimento]),
        justificativa: textoDaCelula(v[COL_EMENDA.justificativa]) || null,
        fonte: `SIOP Gerencial, Emendas Individuais: ${nome} (${geracao.toLowerCase()})`,
      });
    }
    break; // só a primeira aba ("Dados")
  }
  await prisma.$transaction([
    prisma.emendaParlamentar.deleteMany({ where: { instituicaoId: instituicao.id } }),
    prisma.emendaParlamentar.createMany({ data: dados }),
  ]);
  return { linhas: dados.length, arquivo: nome };
}
