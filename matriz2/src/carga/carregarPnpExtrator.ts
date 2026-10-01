import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/server/db/prisma";
import { pastaPnpProduto } from "./caminhos";
import { apagarFatosDaFonte } from "./apagarFatosPnp";
import { converterCelula, dividirLinha, normalizarNome } from "@/lib/pnp/csvPainel";

/**
 * Carrega o "Extrator" da PNP (`Produtos de dados/Extrator`): as tabelas planas que a plataforma oferece
 * para baixar, uma por assunto (dados gerais por curso e câmpus, situação de matrícula, evasão por curso,
 * indicadores de gestão, pessoal, panorama orçamentário), de 2017 a 2025.
 *
 * Cada arquivo tem as próprias colunas. As que identificam a linha (ano, instituição, câmpus) viram colunas
 * da tabela; as demais se separam sozinhas em numéricas (`valores`) e de texto (`dimensoes`), olhando as
 * primeiras linhas do arquivo: uma coluna é numérica se quase tudo que ela tem é número.
 */

const LOTE = 4_000;
const AMOSTRA = 3_000;
const ORIGEM = "PNP_MANUAL" as const;
const IDENTIFICACAO = new Set(["Ano", "Região", "UF", "Estado", "Organização Acadêmica PNP", "Instituição (Nome)"]);

export interface ResultadoExtrator {
  grupo: string;
  tabela: string;
  linhas: number;
  situacao: "carregado" | "idêntico, pulado";
}

function* csvsDaPasta(pasta: string): Generator<string> {
  for (const item of fs.readdirSync(pasta, { withFileTypes: true })) {
    const caminho = path.join(pasta, item.name);
    if (item.isDirectory()) yield* csvsDaPasta(caminho);
    else if (item.name.toLowerCase().endsWith(".csv")) yield caminho;
  }
}

function sha256Arquivo(caminho: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const h = crypto.createHash("sha256");
    fs.createReadStream(caminho)
      .on("data", (d) => h.update(d))
      .on("end", () => resolve(h.digest("hex")))
      .on("error", reject);
  });
}

const apagarFatos = (fonteDadosId: number) => apagarFatosDaFonte("PnpExtratorFato", fonteDadosId);

export async function carregarPnpExtrator(
  ciclo: number,
  aoProgredir: (mensagem: string) => void = () => {},
): Promise<{ pasta: string; tabelas: ResultadoExtrator[] } | null> {
  const pasta = pastaPnpProduto(ciclo, "Extrator");
  if (!fs.existsSync(pasta)) return null;

  const instituicoes = await prisma.instituicao.findMany({ select: { id: true, sigla: true } });
  const instituicaoPorNome = new Map(instituicoes.map((i) => [normalizarNome(i.sigla), i.id]));
  const unidades = await prisma.unidade.findMany({ select: { id: true, nome: true, instituicaoId: true } });
  const unidadePorNome = new Map(unidades.map((u) => [`${u.instituicaoId}|${normalizarNome(u.nome)}`, u.id]));

  const resultados: ResultadoExtrator[] = [];
  const arquivos = [...csvsDaPasta(pasta)].sort();
  for (const caminho of arquivos) {
    const relativo = path.relative(pasta, caminho);
    const grupo = path.dirname(relativo) === "." ? "" : path.dirname(relativo).replace(/\\/g, "/");
    const tabela = path.basename(caminho, ".csv");
    const checksum = await sha256Arquivo(caminho);
    const prefixo = `PNP Extrator: ${grupo ? `${grupo} / ` : ""}${tabela}`;

    const anteriores = await prisma.fonteDados.findMany({
      where: { origem: ORIGEM, cicloOrcamento: ciclo, arquivo: prefixo },
      select: { id: true, checksum: true, _count: { select: { pnpExtratorFatos: true } } },
    });
    const igual = anteriores.find((f) => f.checksum === checksum && f._count.pnpExtratorFatos > 0);
    if (igual) {
      resultados.push({ grupo, tabela, linhas: igual._count.pnpExtratorFatos, situacao: "idêntico, pulado" });
      continue;
    }
    for (const f of anteriores) {
      await apagarFatos(f.id);
      await prisma.fonteDados.delete({ where: { id: f.id } });
    }

    const fonte = await prisma.fonteDados.create({
      data: {
        origem: ORIGEM,
        cicloOrcamento: ciclo,
        arquivo: prefixo,
        geradoEm: fs.statSync(caminho).mtime,
        abrangencia: "REDE",
        // O SHA-256 só entra quando o grupo termina de carregar: sem ele, a fonte é tratada como incompleta
        // e refeita, e uma carga interrompida no meio não é confundida com uma carga completa.
        checksum: null,
        ressalva:
          "PNP - Extrator: arquivo plano baixado do Extrator da PNP (não é o painel). Os percentuais vêm em pontos (38,55 = 38,55%). " +
          "A data é a de modificação do arquivo, porque o Extrator não declara a de geração.",
      },
    });

    aoProgredir(`    lendo ${relativo}`);
    const leitor = readline.createInterface({ input: fs.createReadStream(caminho, { encoding: "utf8" }), crlfDelay: Infinity });
    let cab: string[] | null = null;
    let numericas: boolean[] = [];
    const amostra: string[][] = [];
    let decidido = false;
    let linhas = 0;
    let buffer: Prisma.PnpExtratorFatoCreateManyInput[] = [];

    const gravar = async () => {
      if (buffer.length === 0) return;
      await prisma.pnpExtratorFato.createMany({ data: buffer });
      buffer = [];
    };
    const converter = (c: string[]) => {
      const idx = (nome: string) => (cab ? cab.indexOf(nome) : -1);
      const iAno = idx("Ano");
      const iInst = idx("Instituicao");
      const iUnid = idx("nomeUnidadeRecente");
      const ano = Number((c[iAno] ?? "").trim());
      if (!Number.isInteger(ano)) return;
      const instituicao = (iInst >= 0 ? (c[iInst] ?? "").trim() : "").slice(0, 60);
      const unidade = (iUnid >= 0 ? (c[iUnid] ?? "").trim() : "").slice(0, 191);
      const instituicaoId = instituicao ? (instituicaoPorNome.get(normalizarNome(instituicao)) ?? null) : null;
      const unidadeId = instituicaoId && unidade ? (unidadePorNome.get(`${instituicaoId}|${normalizarNome(unidade)}`) ?? null) : null;
      const dimensoes: Record<string, string> = {};
      const valores: Record<string, number | string> = {};
      cab!.forEach((nome, i) => {
        if (IDENTIFICACAO.has(nome) || nome === "Instituicao" || nome === "nomeUnidadeRecente") return;
        const bruto = (c[i] ?? "").trim();
        if (bruto === "") return;
        if (numericas[i]) {
          const v = converterCelula(bruto);
          if (v !== undefined) valores[nome] = v;
        } else dimensoes[nome] = bruto;
      });
      buffer.push({
        fonteDadosId: fonte.id,
        grupo,
        tabela,
        anoBase: ano,
        instituicao,
        unidade,
        instituicaoId,
        unidadeId,
        dimensoes,
        valores,
      });
      linhas++;
    };
    const decidirColunas = () => {
      numericas = cab!.map((_, i) => {
        let preenchidas = 0;
        let numeros = 0;
        for (const c of amostra) {
          const t = (c[i] ?? "").trim();
          if (t === "") continue;
          preenchidas++;
          if (typeof converterCelula(t) === "number") numeros++;
        }
        return preenchidas > 0 && numeros / preenchidas >= 0.98;
      });
    };

    for await (const linha of leitor) {
      if (!linha) continue;
      const c = dividirLinha(linha);
      if (!cab) {
        cab = c.map((x) => x.trim());
        continue;
      }
      if (!decidido) {
        amostra.push(c);
        if (amostra.length >= AMOSTRA) {
          decidirColunas();
          for (const a of amostra) converter(a);
          amostra.length = 0;
          decidido = true;
        }
        continue;
      }
      converter(c);
      if (buffer.length >= LOTE) await gravar();
    }
    if (cab && !decidido) {
      // Arquivo menor que a amostra: decide agora e converte tudo.
      decidirColunas();
      for (const a of amostra) converter(a);
    }
    await gravar();
    await prisma.fonteDados.update({ where: { id: fonte.id }, data: { checksum } });
    aoProgredir(`  ${tabela}: ${linhas} linhas gravadas`);
    resultados.push({ grupo, tabela, linhas, situacao: "carregado" });
  }
  return { pasta, tabelas: resultados };
}
