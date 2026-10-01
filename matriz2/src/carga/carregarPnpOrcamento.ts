import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/server/db/prisma";
import { pastaPnpOrcamento } from "./caminhos";
import { apagarFatosDaFonte } from "./apagarFatosPnp";
import { ligarEstruturasAoSistema } from "./carregarPnpManual";
import { dataDeGeracao } from "./planilha";
import {
  COLUNAS_DIMENSAO_ORCAMENTO,
  COLUNAS_FIXAS_ORCAMENTO,
  classificarArquivoOrcamento,
  converterCelula,
  dividirLinha,
  nivelDoTexto,
  rotulosUnicos,
  type ClasseArquivo,
} from "@/lib/pnp/csvPainel";

/**
 * Carrega o painel "Dados Orçamentários" da PNP baixado à mão (`CSV da PNP/Manual/<ciclo>/Dados Orçamentários`):
 * execução do exercício, programação, restos a pagar, descentralizações, indicadores de execução, série
 * mensal e gastos por matrícula equivalente, de 2013 a 2025, por instituição (UO), região, estado e rede.
 * Não existe por câmpus.
 *
 * Mesmo desenho do painel de ensino (`carregarPnpManual.ts`): fluxo linha a linha, uma `FonteDados` por
 * subaba, e recarga que só refaz o que mudou. A diferença é que aqui as colunas são lidas pelo NOME do
 * cabeçalho (as fixas, as aberturas e as medidas variam de arquivo para arquivo), em vez de por posição.
 */

const LOTE = 4_000;
const ORIGEM = "PNP_MANUAL" as const;

export interface ResultadoGrupoOrcamento {
  aba: string;
  subaba: string;
  arquivos: number;
  linhas: number;
  ignoradas: number;
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

const apagarFatos = (fonteDadosId: number) => apagarFatosDaFonte("PnpOrcamentoFato", fonteDadosId);

export async function carregarPnpOrcamento(
  ciclo: number,
  aoProgredir: (mensagem: string) => void = () => {},
): Promise<{ pasta: string; grupos: ResultadoGrupoOrcamento[]; avisos: string[] } | null> {
  const pasta = pastaPnpOrcamento(ciclo);
  if (!fs.existsSync(pasta)) return null;
  const avisos: string[] = [];

  const leia = fs.readdirSync(pasta).find((f) => /LEIA-ME\.txt$/i.test(f));
  const geradoEm = leia ? dataDeGeracao(fs.readFileSync(path.join(pasta, leia), "utf8").split(/\r?\n/)[0] ?? "") : null;

  const grupos = new Map<string, { aba: string; subaba: string; arquivos: { caminho: string; classe: ClasseArquivo }[] }>();
  for (const caminho of csvsDaPasta(pasta)) {
    const classe = classificarArquivoOrcamento(path.relative(pasta, caminho));
    if (!classe) {
      avisos.push(`Arquivo fora do padrão de pastas, ignorado: ${path.relative(pasta, caminho)}`);
      continue;
    }
    const chave = `${classe.aba}::${classe.subaba}`;
    const g = grupos.get(chave) ?? { aba: classe.aba, subaba: classe.subaba, arquivos: [] };
    g.arquivos.push({ caminho, classe });
    grupos.set(chave, g);
  }

  const estruturaPorChave = new Map<string, number>();
  for (const e of await prisma.pnpEstrutura.findMany({ select: { id: true, nivel: true, instituicao: true, campus: true, municipio: true } })) {
    estruturaPorChave.set(`${e.nivel}|${e.instituicao}|${e.campus}|${e.municipio}`, e.id);
  }
  async function estruturaId(nivelTexto: string, instituicao: string, org: string, regiao: string, estado: string): Promise<number | null> {
    const nivel = nivelDoTexto(nivelTexto);
    if (!nivel || nivel === "CAMPUS") return null;
    // Região e estado não têm instituição: o nome da região (ou do estado) faz o papel de nome.
    const nome = nivel === "REGIAO" ? regiao : nivel === "ESTADO" ? estado : nivel === "INSTITUICAO" ? instituicao : "";
    if (nivel !== "REDE" && !nome) return null;
    const chave = `${nivel}|${nome}||`;
    const conhecido = estruturaPorChave.get(chave);
    if (conhecido !== undefined) return conhecido;
    const criada = await prisma.pnpEstrutura.upsert({
      where: { nivel_instituicao_campus_municipio: { nivel, instituicao: nome, campus: "", municipio: "" } },
      create: { nivel, instituicao: nome, campus: "", municipio: "", organizacaoAcademica: org, regiao, estado },
      update: {},
    });
    estruturaPorChave.set(chave, criada.id);
    return criada.id;
  }

  const resultados: ResultadoGrupoOrcamento[] = [];

  for (const g of [...grupos.values()].sort((a, b) => `${a.aba}${a.subaba}`.localeCompare(`${b.aba}${b.subaba}`))) {
    const arquivos = [...g.arquivos].sort((a, b) => a.caminho.localeCompare(b.caminho));
    const partes: string[] = [];
    for (const a of arquivos) partes.push(`${path.relative(pasta, a.caminho)}:${await sha256Arquivo(a.caminho)}`);
    const checksum = crypto.createHash("sha256").update(partes.join("\n")).digest("hex");
    const rotulo = `${g.aba} / ${g.subaba}`;
    const prefixo = `PNP Dados Orçamentários: ${rotulo} (`;
    const nomeFonte = `${prefixo}${arquivos.length} arquivo${arquivos.length > 1 ? "s" : ""})`;

    const anteriores = await prisma.fonteDados.findMany({
      where: { origem: ORIGEM, cicloOrcamento: ciclo, arquivo: { startsWith: prefixo } },
      select: { id: true, checksum: true, _count: { select: { pnpOrcamentoFatos: true } } },
    });
    const igual = anteriores.find((f) => f.checksum === checksum && f._count.pnpOrcamentoFatos > 0);
    if (igual) {
      resultados.push({ aba: g.aba, subaba: g.subaba, arquivos: arquivos.length, linhas: igual._count.pnpOrcamentoFatos, ignoradas: 0, situacao: "idêntico, pulado" });
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
        arquivo: nomeFonte,
        geradoEm,
        abrangencia: "REDE",
        // O SHA-256 só entra quando o grupo termina de carregar: sem ele, a fonte é tratada como incompleta
        // e refeita, e uma carga interrompida no meio não é confundida com uma carga completa.
        checksum: null,
        ressalva:
          "PNP - Extração manual: painel Dados Orçamentários da PNP (valores em reais, " +
          (ciclo >= 2027 ? "de 2013 a 2025" : `edição ${ciclo}, só o ano-base ${ciclo - 2}`) +
          "), por instituição, " +
          "região, estado e rede; não existe por câmpus. É o orçamento executado e descentralizado como a PNP o registra, " +
          "e não a matriz de distribuição da MDO.",
      },
    });

    let linhas = 0;
    let ignoradas = 0;
    let buffer: Prisma.PnpOrcamentoFatoCreateManyInput[] = [];
    const gravar = async () => {
      if (buffer.length === 0) return;
      await prisma.pnpOrcamentoFato.createMany({ data: buffer });
      buffer = [];
    };

    for (const { caminho, classe } of arquivos) {
      aoProgredir(`    lendo ${path.relative(pasta, caminho)}`);
      const leitor = readline.createInterface({ input: fs.createReadStream(caminho, { encoding: "utf8" }), crlfDelay: Infinity });
      let cab: string[] | null = null;
      let rotulos: string[] = [];
      let idx: Record<string, number> = {};
      let colunasDimensao: number[] = [];
      let colunasMedida: number[] = [];
      for await (const linha of leitor) {
        if (!linha) continue;
        const c = dividirLinha(linha);
        if (!cab) {
          cab = c.map((x) => x.trim());
          rotulos = rotulosUnicos(cab);
          idx = {};
          cab.forEach((r, i) => {
            if (COLUNAS_FIXAS_ORCAMENTO.has(r)) idx[r] = i;
          });
          if (idx["Nível"] === undefined || idx["Ano Base"] === undefined) {
            throw new Error(`${path.relative(pasta, caminho)}: sem as colunas Nível e Ano Base.`);
          }
          colunasDimensao = [];
          colunasMedida = [];
          cab.forEach((r, i) => {
            if (COLUNAS_FIXAS_ORCAMENTO.has(r)) return;
            if (COLUNAS_DIMENSAO_ORCAMENTO.has(r)) colunasDimensao.push(i);
            else colunasMedida.push(i);
          });
          continue;
        }
        const pega = (nome: string) => (idx[nome] === undefined ? "" : (c[idx[nome]!] ?? "").trim());
        const ano = Number(pega("Ano Base"));
        const id = await estruturaId(pega("Nível"), pega("Instituição"), pega("Organização Acadêmica"), pega("Região"), pega("Estado"));
        if (!id || !Number.isInteger(ano)) {
          ignoradas++;
          continue;
        }
        const valores: Record<string, number | string> = {};
        for (const i of colunasMedida) {
          const v = converterCelula(c[i]);
          if (v !== undefined) valores[rotulos[i]!] = v;
        }
        buffer.push({
          fonteDadosId: fonte.id,
          estruturaId: id,
          aba: g.aba,
          subaba: g.subaba,
          // Uma linha pode ter duas aberturas ao mesmo tempo (RP e GND): o nome e o valor se juntam por " | ".
          dimensao: colunasDimensao.length > 0 ? colunasDimensao.map((i) => cab![i]).join(" | ") : classe.dimensao,
          valorDimensao: colunasDimensao.map((i) => (c[i] ?? "").trim()).join(" | "),
          relacaoOrgao: pega("Relação do Órgão"),
          mes: pega("Mês"),
          tipoValor: pega("Tipo de Valor"),
          anoBase: ano,
          valores,
        });
        linhas++;
        if (buffer.length >= LOTE) {
          await gravar();
          if (linhas % 100_000 < LOTE) aoProgredir(`      ${linhas} linhas...`);
        }
      }
    }
    await gravar();
    await prisma.fonteDados.update({ where: { id: fonte.id }, data: { checksum } });
    aoProgredir(`  ${rotulo}: ${linhas} linhas gravadas`);
    resultados.push({ aba: g.aba, subaba: g.subaba, arquivos: arquivos.length, linhas, ignoradas, situacao: "carregado" });
  }

  await ligarEstruturasAoSistema();
  return { pasta, grupos: resultados, avisos };
}
