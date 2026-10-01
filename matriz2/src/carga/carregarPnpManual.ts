import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/server/db/prisma";
import { pastaPnpManual } from "./caminhos";
import { apagarFatosDaFonte } from "./apagarFatosPnp";
import { dataDeGeracao } from "./planilha";
import {
  COLUNAS_CATEGORICAS,
  COLUNAS_ESTRUTURA,
  classificarArquivo,
  converterCelula,
  deveIgnorar,
  dividirLinha,
  nivelDoTexto,
  normalizarNome,
  rotulosUnicos,
  type ClasseArquivo,
} from "@/lib/pnp/csvPainel";

/**
 * Carrega o painel "Dados de Ensino" da PNP baixado à mão (pasta `CSV da PNP/Manual/<ciclo>`).
 *
 * São quatro abas (Dados Gerais, Indicadores Acadêmicos, Indicadores Legais, Perfis de
 * Matrículas), 14 subabas e uns 170 CSVs, que juntos passam de 6 milhões de linhas, todas
 * em três níveis (rede, instituição, câmpus) e com os anos-base de 2017 a 2025. Por isso:
 *
 *  - lê em fluxo, linha a linha, e grava em lotes;
 *  - uma `FonteDados` por subaba (com todos os detalhamentos dela), para a tela de Dados
 *    importados não virar uma lista de 170 arquivos;
 *  - recarregar uma subaba cujos arquivos não mudaram (mesmo conteúdo, conferido por
 *    SHA-256) não faz nada, e o que mudou substitui só aquela subaba. Como novos arquivos
 *    vão chegando aos poucos, isso é o que torna rodar de novo barato e seguro.
 */

const LOTE = 4_000;
const ORIGEM = "PNP_MANUAL" as const;

export interface ResultadoGrupo {
  aba: string;
  subaba: string;
  arquivos: number;
  linhas: number;
  ignoradas: number;
  situacao: "carregado" | "idêntico, pulado";
  fonteDadosId: number;
}

export interface ResultadoPnpManual {
  pasta: string;
  grupos: ResultadoGrupo[];
  estruturas: number;
  estruturasLigadasAInstituicao: number;
  estruturasLigadasAUnidade: number;
  campusNaoLigados: number;
  avisos: string[];
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

/** Apaga as linhas de uma fonte (ver `apagarFatosPnp.ts`). */
const apagarFatos = (fonteDadosId: number) => apagarFatosDaFonte("PnpFato", fonteDadosId);

function dataDaExtracao(pasta: string): Date | null {
  const leia = path.join(pasta, "PNP_2027_LEIA-ME.txt");
  const candidatos = fs.existsSync(pasta) ? fs.readdirSync(pasta).filter((f) => /LEIA-ME\.txt$/i.test(f)) : [];
  const arquivo = fs.existsSync(leia) ? leia : candidatos[0] ? path.join(pasta, candidatos[0]) : null;
  if (!arquivo) return null;
  const primeira = fs.readFileSync(arquivo, "utf8").split(/\r?\n/)[0] ?? "";
  return dataDeGeracao(primeira);
}

/**
 * Os dois painéis que têm o mesmo desenho (Nível, Ano Base e as colunas de estrutura): o de ensino e o de
 * pessoal. Cada um tem a própria pasta e o próprio prefixo no nome da fonte de dados.
 */
export const PAINEIS_PNP = {
  ENSINO: { pasta: "Dados do Ensino", rotulo: "Dados de Ensino" },
  PESSOAL: { pasta: "Dados de Pessoal", rotulo: "Dados de Pessoal" },
} as const;

export async function carregarPnpManual(
  ciclo: number,
  aoProgredir: (mensagem: string) => void = () => {},
  painel: keyof typeof PAINEIS_PNP = "ENSINO",
): Promise<ResultadoPnpManual | null> {
  const { pasta: nomePasta, rotulo: rotuloPainel } = PAINEIS_PNP[painel];
  const pasta = pastaPnpManual(ciclo, nomePasta);
  if (!fs.existsSync(pasta)) return null;
  const avisos: string[] = [];
  const geradoEm = dataDaExtracao(pasta);

  // Agrupa os arquivos por (aba, subaba).
  const grupos = new Map<string, { aba: string; subaba: string; arquivos: { caminho: string; classe: ClasseArquivo }[] }>();
  for (const caminho of csvsDaPasta(pasta)) {
    const classe = classificarArquivo(path.relative(pasta, caminho));
    if (!classe) {
      avisos.push(`Arquivo fora do padrão de pastas, ignorado: ${path.relative(pasta, caminho)}`);
      continue;
    }
    const chave = `${classe.aba}::${classe.subaba}`;
    const g = grupos.get(chave) ?? { aba: classe.aba, subaba: classe.subaba, arquivos: [] };
    g.arquivos.push({ caminho, classe });
    grupos.set(chave, g);
  }

  // Estruturas (rede, instituições, câmpus) já conhecidas, para reaproveitar os ids.
  const estruturaPorChave = new Map<string, number>();
  for (const e of await prisma.pnpEstrutura.findMany({ select: { id: true, nivel: true, instituicao: true, campus: true, municipio: true } })) {
    estruturaPorChave.set(`${e.nivel}|${e.instituicao}|${e.campus}|${e.municipio}`, e.id);
  }

  async function estruturaId(c: string[]): Promise<number | null> {
    const nivel = nivelDoTexto(c[0] ?? "");
    if (!nivel) return null;
    const instituicao = (c[2] ?? "").trim();
    const campus = (c[6] ?? "").trim();
    const municipio = (c[7] ?? "").trim();
    const chave = `${nivel}|${instituicao}|${campus}|${municipio}`;
    const conhecido = estruturaPorChave.get(chave);
    if (conhecido !== undefined) return conhecido;
    const criada = await prisma.pnpEstrutura.upsert({
      where: { nivel_instituicao_campus_municipio: { nivel, instituicao, campus, municipio } },
      create: {
        nivel,
        instituicao,
        campus,
        municipio,
        organizacaoAcademica: (c[3] ?? "").trim(),
        regiao: (c[4] ?? "").trim(),
        estado: (c[5] ?? "").trim(),
      },
      update: {},
    });
    estruturaPorChave.set(chave, criada.id);
    return criada.id;
  }

  const resultados: ResultadoGrupo[] = [];

  for (const g of [...grupos.values()].sort((a, b) => `${a.aba}${a.subaba}`.localeCompare(`${b.aba}${b.subaba}`))) {
    const arquivos = g.arquivos.filter((a) => !deveIgnorar(a.classe)).sort((a, b) => a.caminho.localeCompare(b.caminho));
    if (arquivos.length === 0) continue;

    // Assinatura do conteúdo do grupo: o que mudar em qualquer arquivo dele muda o SHA-256.
    const partes: string[] = [];
    for (const a of arquivos) partes.push(`${path.relative(pasta, a.caminho)}:${await sha256Arquivo(a.caminho)}`);
    const checksum = crypto.createHash("sha256").update(partes.join("\n")).digest("hex");
    const rotulo = `${g.aba} / ${g.subaba}`;
    const nomeFonte = `PNP ${rotuloPainel}: ${rotulo} (${arquivos.length} arquivo${arquivos.length > 1 ? "s" : ""})`;

    const anteriores = await prisma.fonteDados.findMany({
      where: { origem: ORIGEM, cicloOrcamento: ciclo, arquivo: { startsWith: `PNP ${rotuloPainel}: ${rotulo} (` } },
      select: { id: true, checksum: true, _count: { select: { pnpFatos: true } } },
    });
    const igual = anteriores.find((f) => f.checksum === checksum && f._count.pnpFatos > 0);
    if (igual) {
      resultados.push({ aba: g.aba, subaba: g.subaba, arquivos: arquivos.length, linhas: igual._count.pnpFatos, ignoradas: 0, situacao: "idêntico, pulado", fonteDadosId: igual.id });
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
          `PNP - Extração manual: tabelas do painel ${rotuloPainel} baixadas à mão,`+
          " em três níveis (rede, instituição, câmpus) " +
          (ciclo >= 2027
            ? "e com anos-base de 2017 a 2025. "
            : `da edição ${ciclo}, só com o ano-base ${ciclo - 2}, como publicado naquela edição (a PNP revisa os números: o mesmo ano-base na edição de 2027 pode ter valores um pouco diferentes). `) +
          "Os indicadores do painel (por exemplo, a Eficiência Acadêmica) são os da PNP e " +
          "não são os que a MDO usa na matriz: no IFSul, a PNP mostra 98% e o IEA da MDO é 45%.",
      },
    });

    let linhas = 0;
    let ignoradas = 0;
    let buffer: Prisma.PnpFatoCreateManyInput[] = [];
    const gravar = async () => {
      if (buffer.length === 0) return;
      await prisma.pnpFato.createMany({ data: buffer });
      buffer = [];
    };

    for (const { caminho, classe } of arquivos) {
      aoProgredir(`    lendo ${path.relative(pasta, caminho)}`);
      const leitor = readline.createInterface({ input: fs.createReadStream(caminho, { encoding: "utf8" }), crlfDelay: Infinity });
      let rotulos: string[] | null = null;
      let ehCategorica: boolean[] = [];
      for await (const linha of leitor) {
        if (!linha) continue;
        const c = dividirLinha(linha);
        if (!rotulos) {
          const cab = c.map((x) => x.trim());
          // Confere o cabeçalho das oito colunas de estrutura: se a PNP mudar o layout, melhor parar.
          for (let i = 0; i < COLUNAS_ESTRUTURA.length; i++) {
            if (cab[i] !== COLUNAS_ESTRUTURA[i]) {
              throw new Error(`${path.relative(pasta, caminho)}: coluna ${i + 1} é "${cab[i]}", esperava "${COLUNAS_ESTRUTURA[i]}".`);
            }
          }
          rotulos = rotulosUnicos(cab);
          ehCategorica = cab.map((r) => COLUNAS_CATEGORICAS.has(r));
          continue;
        }
        const ano = Number(c[1]);
        const id = await estruturaId(c);
        if (!id || !Number.isInteger(ano)) {
          ignoradas++;
          continue;
        }
        // Detalhamento: a coluna 9 é o valor da abertura. Principal: já começa nas métricas.
        const inicio = classe.dimensao ? 9 : 8;
        const valorDimensao = classe.dimensao ? (c[8] ?? "").trim() : "";
        const categorias: string[] = [];
        const valores: Record<string, number | string> = {};
        for (let i = inicio; i < rotulos.length; i++) {
          if (ehCategorica[i]) {
            const t = (c[i] ?? "").trim();
            if (t) categorias.push(t);
            continue;
          }
          const v = converterCelula(c[i]);
          if (v !== undefined) valores[rotulos[i]!] = v;
        }
        buffer.push({
          fonteDadosId: fonte.id,
          estruturaId: id,
          aba: g.aba,
          subaba: g.subaba,
          dimensao: classe.dimensao,
          valorDimensao,
          categoria: categorias.join(" | "),
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
    aoProgredir(`  ${g.aba} / ${g.subaba}: ${linhas} linhas gravadas`);
    resultados.push({ aba: g.aba, subaba: g.subaba, arquivos: arquivos.length, linhas, ignoradas, situacao: "carregado", fonteDadosId: fonte.id });
  }

  const vinculo = await ligarEstruturasAoSistema();

  return {
    pasta,
    grupos: resultados,
    estruturas: vinculo.estruturas,
    estruturasLigadasAInstituicao: vinculo.comInstituicao,
    estruturasLigadasAUnidade: vinculo.comUnidade,
    campusNaoLigados: vinculo.campusNaoLigados,
    avisos,
  };
}

/**
 * Liga cada estrutura da PNP (instituição, câmpus) à `Instituicao` e `Unidade` do sistema por nome
 * normalizado, sem acento nem pontuação ("IF FARROUPILHA" = "IFFARROUPILHA", "Campus Venâncio Aires" =
 * "CAMPUS VENÂNCIO AIRES"). O que não casa fica sem vínculo: os dados da PNP valem sozinhos.
 */
export async function ligarEstruturasAoSistema(): Promise<{
  estruturas: number;
  comInstituicao: number;
  comUnidade: number;
  campusNaoLigados: number;
}> {
  const instituicoes = await prisma.instituicao.findMany({ select: { id: true, sigla: true } });
  const instituicaoPorNome = new Map(instituicoes.map((i) => [normalizarNome(i.sigla), i.id]));
  const unidades = await prisma.unidade.findMany({ select: { id: true, nome: true, instituicaoId: true } });
  const unidadePorNome = new Map(unidades.map((u) => [`${u.instituicaoId}|${normalizarNome(u.nome)}`, u.id]));

  const estruturas = await prisma.pnpEstrutura.findMany({
    select: { id: true, nivel: true, instituicao: true, campus: true, instituicaoId: true, unidadeId: true },
  });
  let comInstituicao = 0;
  let comUnidade = 0;
  let campusNaoLigados = 0;
  for (const e of estruturas) {
    if (e.nivel === "REDE" || e.nivel === "REGIAO" || e.nivel === "ESTADO") continue;
    const instId = instituicaoPorNome.get(normalizarNome(e.instituicao)) ?? null;
    const unidId = e.nivel === "CAMPUS" && instId ? unidadePorNome.get(`${instId}|${normalizarNome(e.campus)}`) ?? null : null;
    if (instId) comInstituicao++;
    if (unidId) comUnidade++;
    if (e.nivel === "CAMPUS" && !unidId) campusNaoLigados++;
    if (instId !== e.instituicaoId || unidId !== e.unidadeId) {
      await prisma.pnpEstrutura.update({ where: { id: e.id }, data: { instituicaoId: instId, unidadeId: unidId } });
    }
  }

  return { estruturas: estruturas.length, comInstituicao, comUnidade, campusNaoLigados };
}
