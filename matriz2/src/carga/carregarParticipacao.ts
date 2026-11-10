import ExcelJS from "exceljs";
import { nomeCanonicoDaUnidade } from "@/lib/nomesDeUnidade";
import type { CategoriaRepasse, Prisma } from "@prisma/client";
import { prisma } from "@/server/db/prisma";
import { candidatosParticipacao, exigirArquivo, planilhaParticipacao } from "./caminhos";
import { checksumArquivo, data, numero, numeroOuZero, texto } from "./planilha";
import { lerParametros, type AbaDeParametros } from "./carregarParticipacaoInstituicao";
import { icqaDoCiclo, matriculaTotalDoCiclo, valorDoCiclo, valorPorMatricula, type CicloParaCalculo } from "@/lib/mdo/matriculaTotal";

/**
 * Carrega a 6ª fase da MDO: a participação de cada ciclo de curso na distribuição.
 *
 * É o nível de detalhe mais fino que existe, e o mais valioso. Em 2027 são 58.242 ciclos, de 42
 * instituições e 639 câmpus. A soma de `Valor (R$)` precisa bater com o total do
 * Bloco Funcionamento distribuído por matrícula (R$ 1.831.831.660,00), e essa
 * conferência roda ao final da carga.
 *
 * A planilha tem 7,6 MB e é lida em FLUXO, linha a linha, em vez de carregada
 * inteira na memória. Medido: 4,2 segundos para as 58.243 linhas.
 *
 * Desde 2026-11-09 a exportação da rede sai em outro formato: abas "Parâmetros" e "CICLOS", com fórmulas e sem os valores gravados.
 * Os dois formatos são aceitos, reconhecidos pelo conteúdo. O novo é lido em `carregarRedeComFormulas`.
 */

/** Ordem das colunas na aba, conferida em 2026-08-31. Base 0 depois de descartar o índice do exceljs. */
const COL = {
  sigla: 0,
  instituicao: 1,
  campus: 2,
  modalidade: 3,
  fonteFinanciamento: 4,
  nivel: 5,
  tipoCurso: 6,
  curso: 7,
  areaEixo: 8,
  agropecuaria: 9,
  codigoCiclo: 10,
  ciclo: 11,
  tipoOferta: 12,
  turno: 13,
  inicio: 14,
  termino: 15,
  jubilamento: 16,
  pesoCursoMatriz: 17,
  chMinimaMec: 18,
  cargaHoraria: 19,
  chMatriz: 20,
  qtdAlunosMatriz: 21,
  matriculaTotal: 22,
  repasse: 23,
  valorReais: 24,
  icqa: 25,
  valorAluno: 26,
  perdaEvasao: 27,
} as const;

/** A planilha escreve "EAD MOOC" e "EAD FP" com espaço; o banco usa o enum do Prisma. */
const REPASSE: Record<string, CategoriaRepasse> = {
  PRESENCIAL: "PRESENCIAL",
  EAD: "EAD",
  "EAD MOOC": "EAD_MOOC",
  "EAD FP": "EAD_FP",
};

type Layout = "valores" | "formulas";

/**
 * A planilha da 6ª fase por ciclo com valores tem a coluna "Sigla" na primeira posição e traz "Código Ciclo"; a com fórmulas abre pela aba
 * "Parâmetros". Outros relatórios da MDO com nome parecido (a participação resumida por curso, com 17 colunas e sem código de ciclo) não
 * servem, e carregá-los apagaria os ciclos sem pôr nada no lugar.
 */
async function layoutDoArquivo(caminho: string): Promise<Layout | null> {
  const leitor = new ExcelJS.stream.xlsx.WorkbookReader(caminho, { entries: "emit", worksheets: "emit", sharedStrings: "cache", styles: "ignore" });
  for await (const planilha of leitor) {
    for await (const linha of planilha) {
      const cabecalho = (linha.values as unknown[]).slice(1).map((c) => String(c ?? "").trim().toLowerCase());
      if (cabecalho[0] === "sigla" && cabecalho.includes("código ciclo") && cabecalho.includes("valor (r$)")) return "valores";
      return cabecalho[0]?.startsWith("parâmetros para cálculos") ? "formulas" : null;
    }
    return null;
  }
  return null;
}

/** O primeiro arquivo, do mais novo para o mais antigo, que tem o layout por ciclo; os que foram pulados vêm junto, para avisar. */
async function escolherPlanilha(ano: number): Promise<{ caminho: string; pulados: string[]; layout: Layout }> {
  const pulados: string[] = [];
  const candidatos = candidatosParticipacao(ano);
  for (const c of candidatos) {
    const layout = await layoutDoArquivo(c);
    if (layout) return { caminho: c, pulados, layout };
    pulados.push(c.split(/[\/]/).pop() ?? c);
  }
  if (candidatos.length === 0) exigirArquivo(planilhaParticipacao(ano), `a planilha da 6ª fase (Participação Orçamentária) de ${ano}`);
  throw new Error(
    `Nenhum arquivo da 6ª fase de ${ano} tem o layout por ciclo de curso (colunas "Sigla" e "Código Ciclo"): ${pulados.join(", ")}. ` +
      "Nada foi apagado do banco.",
  );
}

export interface ResultadoCarga {
  /** Arquivos mais novos que foram pulados por terem outro layout. */
  arquivosPulados: string[];
  ciclos: number;
  instituicoes: number;
  campus: number;
  somaValor: number;
  somaPerdaEvasao: number;
  ignoradas: number;
  fonteDadosId: number;
  avisos: string[];
}

const LOTE = 2_000;

/** Cria o que faltar de instituição e câmpus, guardando o id de cada um para não consultar o banco a cada linha. */
function criarResolvedorDeUnidade() {
  const instituicaoPorSigla = new Map<string, number>();
  const unidadePorChave = new Map<string, number>();

  async function resolver(sigla: string, nomeInstituicao: string, campus: string): Promise<number> {
    let instituicaoId = instituicaoPorSigla.get(sigla);
    if (instituicaoId === undefined) {
      const inst = await prisma.instituicao.upsert({
        where: { sigla },
        // A 6ª fase não traz UF; quem a preenche é a 5ª fase. Fica vazia se esta carga vier primeiro.
        create: { sigla, nome: nomeInstituicao, uf: "" },
        update: { nome: nomeInstituicao },
      });
      instituicaoId = inst.id;
      instituicaoPorSigla.set(sigla, instituicaoId);
    }
    const chave = `${instituicaoId}::${campus}`;
    let unidadeId = unidadePorChave.get(chave);
    if (unidadeId === undefined) {
      const un = await prisma.unidade.upsert({
        where: { instituicaoId_nome: { instituicaoId, nome: nomeCanonicoDaUnidade(campus) } },
        create: { instituicaoId, nome: nomeCanonicoDaUnidade(campus), tipo: "CAMPUS" },
        update: {},
      });
      unidadeId = un.id;
      unidadePorChave.set(chave, unidadeId);
    }
    return unidadeId;
  }

  return { resolver, instituicoes: () => instituicaoPorSigla.size, campus: () => unidadePorChave.size };
}

/** Colunas lidas da aba CICLOS, pelo título: a MDO já acrescentou coluna no meio ("Qtd. Alunos EM CURSO") e deslocou as seguintes. */
const TITULOS_CICLOS = {
  sigla: "sigla",
  instituicao: "instituição",
  campus: "campus",
  modalidade: "modalidade",
  fonteFinanciamento: "fonte financiamento",
  nivel: "nível",
  tipoCurso: "tipo de curso",
  curso: "curso",
  areaEixo: "área/eixo",
  agropecuaria: "agropecuária",
  codigoCiclo: "código ciclo",
  ciclo: "ciclo",
  tipoOferta: "tipo de oferta",
  turno: "turno",
  inicio: "início",
  termino: "término",
  jubilamento: "jubilamento",
  chMec: "ch. mec",
  chCiclo: "ch. ciclo",
  chMatriz: "ch. matriz",
  peso: "peso do curso",
  alunos: "qtd. alunos matriz",
  matriculaTotal: "matrícula total",
  repasse: "repasse",
} as const;
const LINHA_DE_TITULOS_CICLOS = 4;

/** Menos que isto não é a rede inteira: seria apagar as outras instituições sem pôr nada no lugar. */
const MINIMO_DE_INSTITUICOES_DA_REDE = 30;

interface LinhaDaRede {
  sigla: string;
  nomeInstituicao: string;
  campus: string;
  mt: number;
  valor: number;
  custoEvadido: number;
  valorAluno: number;
  repasse: CategoriaRepasse;
  ciclo: CicloParaCalculo;
  campos: Pick<
    Prisma.DistribuicaoCicloCreateManyInput,
    "codigoCiclo" | "ciclo" | "curso" | "areaEixo" | "nivel" | "tipoCurso" | "tipoOferta" | "turno" | "modalidade" | "fonteFinanciamento"
  >;
}

/**
 * Lê a planilha da rede com fórmulas: só as colunas de entrada, refazendo os valores com `lib/mdo/matriculaTotal`, o mesmo motor da planilha do
 * IFSul. Tudo é lido e conferido ANTES de apagar qualquer coisa do banco: as matrículas de cada ciclo somadas precisam fechar com os parâmetros
 * do próprio arquivo.
 */
async function carregarRedeComFormulas(ano: number, caminho: string, pulados: string[]): Promise<ResultadoCarga> {
  const leitor = new ExcelJS.stream.xlsx.WorkbookReader(caminho, { entries: "emit", worksheets: "emit", sharedStrings: "cache", styles: "ignore" });
  const celulasDosParametros = new Map<string, unknown>();
  const linhas: LinhaDaRede[] = [];
  const somaPorRepasse: Record<CategoriaRepasse, number> = { PRESENCIAL: 0, EAD: 0, EAD_MOOC: 0, EAD_FP: 0 };
  const vistos = new Set<string>();
  let lidos: Awaited<ReturnType<typeof lerParametros>> | null = null;
  let valorMatricula: ReturnType<typeof valorPorMatricula> | null = null;
  let aba = 0;
  let ignoradas = 0;
  let divergenciasMotor = 0;

  for await (const planilha of leitor) {
    aba++;
    if (aba > 2) break;
    let col: Record<keyof typeof TITULOS_CICLOS, number> | null = null;
    for await (const linha of planilha) {
      const valores = linha.values as unknown[];
      if (aba === 1) {
        valores.forEach((v, c) => celulasDosParametros.set(`${String.fromCharCode(64 + c)}${linha.number}`, v));
        continue;
      }
      if (!lidos) {
        const abaParametros: AbaDeParametros = { getCell: (ref) => ({ value: celulasDosParametros.get(ref) ?? null }) };
        lidos = await lerParametros(abaParametros, ano);
        valorMatricula = valorPorMatricula(lidos.parametros);
      }
      if (linha.number === LINHA_DE_TITULOS_CICLOS) {
        const titulos = valores.map((t) => String(t ?? "").replace(/\s+/g, " ").trim().toLowerCase());
        const achadas = Object.entries(TITULOS_CICLOS).map(([chave, titulo]) => [chave, titulos.indexOf(titulo)] as const);
        const faltando = achadas.filter(([, c]) => c < 0).map(([chave]) => TITULOS_CICLOS[chave as keyof typeof TITULOS_CICLOS]);
        if (faltando.length > 0) throw new Error(`A aba CICLOS não tem as colunas: ${faltando.join(", ")}. O layout mudou? Nada foi apagado do banco.`);
        col = Object.fromEntries(achadas) as Record<keyof typeof TITULOS_CICLOS, number>;
        continue;
      }
      if (linha.number < LINHA_DE_TITULOS_CICLOS || !col) continue;

      const v = (chave: keyof typeof TITULOS_CICLOS) => valores[col![chave]];
      const sigla = texto(v("sigla"));
      const campus = texto(v("campus"));
      const codigoCiclo = texto(v("codigoCiclo"));
      const repasse = REPASSE[String(texto(v("repasse")) ?? "").toUpperCase()];
      const inicio = data(v("inicio"));
      const termino = data(v("termino"));
      const jubilamento = data(v("jubilamento"));
      if (!sigla || !campus || !codigoCiclo || !repasse || !inicio || !termino || !jubilamento) {
        ignoradas++;
        continue;
      }
      const chave = `${sigla}::${nomeCanonicoDaUnidade(campus)}::${codigoCiclo}`;
      if (vistos.has(chave)) {
        ignoradas++;
        continue;
      }
      vistos.add(chave);

      const ciclo: CicloParaCalculo = {
        inicio,
        termino,
        jubilamento,
        chMec: numeroOuZero(v("chMec")),
        chCiclo: numeroOuZero(v("chCiclo")),
        chMatriz: numeroOuZero(v("chMatriz")),
        peso: numeroOuZero(v("peso")),
        agropecuaria: texto(v("agropecuaria"))?.toUpperCase() === "SIM",
        alunos: numeroOuZero(v("alunos")),
      };
      // A Matrícula Total vem gravada e é o dado oficial; o motor serve de conferência.
      const mt = numeroOuZero(v("matriculaTotal"));
      if (Math.abs(mt - matriculaTotalDoCiclo(ciclo, lidos.periodo)) > 1e-4) divergenciasMotor++;
      const calc = valorDoCiclo(ciclo, mt, valorMatricula![repasse], lidos.periodo);
      somaPorRepasse[repasse] += mt;
      linhas.push({
        sigla,
        nomeInstituicao: texto(v("instituicao")) ?? sigla,
        campus,
        mt,
        valor: calc.valor,
        custoEvadido: calc.custoEvadido,
        valorAluno: valorMatricula![repasse],
        repasse,
        ciclo,
        campos: {
          codigoCiclo,
          ciclo: texto(v("ciclo")) ?? "",
          curso: texto(v("curso")) ?? "",
          areaEixo: texto(v("areaEixo")),
          nivel: texto(v("nivel")),
          tipoCurso: texto(v("tipoCurso")),
          tipoOferta: texto(v("tipoOferta")),
          turno: texto(v("turno")),
          modalidade: texto(v("modalidade")) ?? "",
          fonteFinanciamento: texto(v("fonteFinanciamento")) ?? "",
        },
      });
    }
  }

  if (!lidos || !valorMatricula) throw new Error("A planilha não tem as abas Parâmetros e CICLOS esperadas. Nada foi apagado do banco.");
  const { parametros, periodo, notas } = lidos;
  const totalInstituicoes = new Set(linhas.map((l) => l.sigla)).size;
  if (totalInstituicoes < MINIMO_DE_INSTITUICOES_DA_REDE) {
    throw new Error(`A planilha traz só ${totalInstituicoes} instituição(ões): não é a rede inteira. Nada foi apagado do banco.`);
  }
  for (const repasse of Object.keys(somaPorRepasse) as CategoriaRepasse[]) {
    if (Math.abs(somaPorRepasse[repasse] - parametros.matriculasTotaisRede[repasse]) > 0.01) {
      throw new Error(
        `A soma das Matrículas Totais ${repasse} dos ciclos (${somaPorRepasse[repasse]}) não fecha com a aba Parâmetros (${parametros.matriculasTotaisRede[repasse]}). Nada foi apagado do banco.`,
      );
    }
  }

  const somaPorSigla = new Map<string, number>();
  for (const l of linhas) somaPorSigla.set(l.sigla, (somaPorSigla.get(l.sigla) ?? 0) + l.valor);

  await prisma.distribuicaoCiclo.deleteMany({ where: { ano } });
  const fonte = await prisma.fonteDados.create({
    data: {
      origem: "MDO_IFTM",
      fase: "F6_PARTICIPACAO",
      cicloOrcamento: ano,
      arquivo: caminho.split(/[\\/]/).pop() ?? caminho,
      abrangencia: "REDE",
      checksum: checksumArquivo(caminho),
      ressalva:
        "Planilha da rede exportada com fórmulas e sem os valores gravados; os valores em reais foram refeitos por este sistema com a mesma regra da planilha. " +
        `Parâmetros do arquivo: ajuste de R$ ${parametros.ajuste.toLocaleString("pt-BR")} e valor da matrícula presencial de R$ ${valorMatricula.PRESENCIAL.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}. ` +
        "A coluna Custo Evadido segue a definição em que o aluno retido vale metade, diferente da exportação da rede de 2026-08-31." +
        (notas.length > 0 ? " Ajustes feitos por este sistema ao ler o arquivo: " + notas.join(" ") : ""),
    },
  });

  const unidades = criarResolvedorDeUnidade();
  let buffer: Prisma.DistribuicaoCicloCreateManyInput[] = [];
  let somaValor = 0;
  let somaPerdaEvasao = 0;
  for (const l of linhas) {
    const unidadeId = await unidades.resolver(l.sigla, l.nomeInstituicao, l.campus);
    const calc = valorDoCiclo(l.ciclo, l.mt, l.valorAluno, periodo);
    const totalDaInstituicao = somaPorSigla.get(l.sigla) ?? 0;
    somaValor += l.valor;
    somaPerdaEvasao += l.custoEvadido;
    buffer.push({
      ...l.campos,
      ano,
      unidadeId,
      fonteDadosId: fonte.id,
      repasse: l.repasse,
      inicio: l.ciclo.inicio,
      termino: l.ciclo.termino,
      jubilamento: l.ciclo.jubilamento,
      pesoCursoMatriz: l.ciclo.peso,
      chMinimaMec: l.ciclo.chMec,
      cargaHoraria: l.ciclo.chCiclo,
      chMatriz: l.ciclo.chMatriz,
      qtdAlunosMatriz: l.ciclo.alunos,
      matriculaTotal: l.mt,
      valorReais: l.valor,
      icqa: icqaDoCiclo(l.ciclo, periodo),
      valorAluno: l.valorAluno,
      perdaEvasaoReais: l.custoEvadido,
      agropecuaria: l.ciclo.agropecuaria,
      chExcedente: l.ciclo.chMatriz > l.ciclo.chMec ? l.ciclo.chMatriz - l.ciclo.chMec : 0,
      alunosContabilizados: calc.alunosContabilizados,
      alunosNaoContabilizados: calc.alunosNaoContabilizados,
      contribuicaoInstituicao: totalDaInstituicao > 0 ? l.valor / totalDaInstituicao : 0,
    });
    if (buffer.length >= LOTE) {
      await prisma.distribuicaoCiclo.createMany({ data: buffer });
      buffer = [];
    }
  }
  if (buffer.length > 0) await prisma.distribuicaoCiclo.createMany({ data: buffer });

  const avisos = divergenciasMotor > 0 ? [`${divergenciasMotor} linha(s) em que a Matrícula Total da planilha difere do motor de cálculo por mais de 0,0001: a MDO pode ter mudado a regra.`] : [];
  return {
    ciclos: linhas.length,
    instituicoes: unidades.instituicoes(),
    campus: unidades.campus(),
    somaValor,
    somaPerdaEvasao,
    ignoradas,
    arquivosPulados: pulados,
    fonteDadosId: fonte.id,
    avisos,
  };
}

export async function carregarParticipacao(ano: number): Promise<ResultadoCarga> {
  // Escolhe e confere o arquivo ANTES de apagar qualquer coisa do banco.
  const { caminho, pulados, layout } = await escolherPlanilha(ano);
  if (layout === "formulas") return carregarRedeComFormulas(ano, caminho, pulados);

  // Recarregar o mesmo ciclo substitui o que estava lá: a MDO reexporta a cada rodada
  // de homologação, e manter as duas versões dobraria os totais em silêncio.
  await prisma.distribuicaoCiclo.deleteMany({ where: { ano } });

  const fonte = await prisma.fonteDados.create({
    data: {
      origem: "MDO_IFTM",
      fase: "F6_PARTICIPACAO",
      cicloOrcamento: ano,
      arquivo: caminho.split(/[\\/]/).pop() ?? caminho,
      abrangencia: "REDE",
      checksum: checksumArquivo(caminho),
      ressalva:
        "A 6ª fase estava marcada como Em andamento no painel da MDO quando este arquivo foi exportado; " +
        "os valores ainda podem mudar até a homologação final.",
    },
  });

  const unidades = criarResolvedorDeUnidade();

  const leitor = new ExcelJS.stream.xlsx.WorkbookReader(caminho, {
    entries: "emit",
    worksheets: "emit",
    sharedStrings: "cache",
    styles: "ignore",
  });

  let buffer: Prisma.DistribuicaoCicloCreateManyInput[] = [];
  let ciclos = 0;
  let ignoradas = 0;
  let somaValor = 0;
  let somaPerdaEvasao = 0;
  let primeiraLinha = true;
  // A MDO repete o mesmo Código Ciclo em linhas diferentes quando o ciclo se divide
  // entre fontes de financiamento. A chave única é (ano, unidade, código), então essas
  // linhas precisam ser somadas em vez de gravadas duas vezes.
  const vistos = new Map<string, number>();

  const gravar = async () => {
    if (buffer.length === 0) return;
    await prisma.distribuicaoCiclo.createMany({ data: buffer });
    buffer = [];
  };

  for await (const planilha of leitor) {
    for await (const linha of planilha) {
      if (primeiraLinha) {
        primeiraLinha = false;
        continue;
      }
      const v = (linha.values as unknown[]).slice(1);

      const sigla = texto(v[COL.sigla]);
      const campus = texto(v[COL.campus]);
      const codigoCiclo = texto(v[COL.codigoCiclo]);
      const repasseBruto = texto(v[COL.repasse]);
      if (!sigla || !campus || !codigoCiclo || !repasseBruto) {
        ignoradas++;
        continue;
      }
      const repasse = REPASSE[repasseBruto.toUpperCase()];
      if (!repasse) {
        ignoradas++;
        continue;
      }

      const unidadeId = await unidades.resolver(sigla, texto(v[COL.instituicao]) ?? sigla, campus);
      const chave = `${unidadeId}::${codigoCiclo}`;
      if (vistos.has(chave)) {
        ignoradas++;
        continue;
      }
      vistos.set(chave, 1);

      const valorReais = numeroOuZero(v[COL.valorReais]);
      const perda = numeroOuZero(v[COL.perdaEvasao]);
      somaValor += valorReais;
      somaPerdaEvasao += perda;

      buffer.push({
        ano,
        unidadeId,
        fonteDadosId: fonte.id,
        codigoCiclo,
        ciclo: texto(v[COL.ciclo]) ?? "",
        curso: texto(v[COL.curso]) ?? "",
        areaEixo: texto(v[COL.areaEixo]),
        nivel: texto(v[COL.nivel]),
        tipoCurso: texto(v[COL.tipoCurso]),
        tipoOferta: texto(v[COL.tipoOferta]),
        turno: texto(v[COL.turno]),
        modalidade: texto(v[COL.modalidade]) ?? "",
        fonteFinanciamento: texto(v[COL.fonteFinanciamento]) ?? "",
        repasse,
        inicio: data(v[COL.inicio]),
        termino: data(v[COL.termino]),
        jubilamento: data(v[COL.jubilamento]),
        pesoCursoMatriz: numero(v[COL.pesoCursoMatriz]),
        chMinimaMec: numero(v[COL.chMinimaMec]),
        cargaHoraria: numero(v[COL.cargaHoraria]),
        chMatriz: numero(v[COL.chMatriz]),
        qtdAlunosMatriz: numero(v[COL.qtdAlunosMatriz]),
        matriculaTotal: numeroOuZero(v[COL.matriculaTotal]),
        valorReais,
        icqa: numero(v[COL.icqa]),
        valorAluno: numero(v[COL.valorAluno]),
        perdaEvasaoReais: perda,
      });
      ciclos++;
      if (buffer.length >= LOTE) await gravar();
    }
  }
  await gravar();

  return {
    ciclos,
    instituicoes: unidades.instituicoes(),
    campus: unidades.campus(),
    somaValor,
    somaPerdaEvasao,
    ignoradas,
    arquivosPulados: pulados,
    fonteDadosId: fonte.id,
    avisos: [],
  };
}
