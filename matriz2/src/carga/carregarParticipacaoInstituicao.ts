import ExcelJS from "exceljs";
import type { CategoriaRepasse, Prisma } from "@prisma/client";
import { prisma } from "@/server/db/prisma";
import fs from "node:fs";
import { candidatosResumoDaRede, exigirArquivo, parametrosMdoCsv, planilhaParticipacaoInstituicao } from "./caminhos";
import { checksumArquivo, data, numero, numeroOuZero, texto } from "./planilha";
import {
  icqaDoCiclo,
  matriculaTotalDoCiclo,
  valorDoCiclo,
  valorPorMatricula,
  type CicloParaCalculo,
  type ParametrosValorMatricula,
  type PeriodoPnp,
  type Repasse,
} from "@/lib/mdo/matriculaTotal";

/**
 * Carrega a 6ª fase de UMA instituição, no formato que a MDO passou a exportar em
 * 2026-09-29: uma planilha com FÓRMULAS, sem os valores calculados gravados (abrir
 * no Excel calcula; ler por programa devolve as fórmulas em branco). Traz três abas
 * de resultado (CICLOS, CURSOS, CLASSIFICAÇÕES), que são agrupamentos da mesma tabela,
 * e a aba "Parâmetros", que é o que torna o arquivo diferente do da rede inteira: ela
 * carrega o orçamento e as matrículas totais da rede usados no cálculo.
 *
 * Lê da aba CICLOS só as colunas de ENTRADA (A a Y, valores digitados/importados) e
 * refaz o resto com `lib/mdo/matriculaTotal`, motor conferido linha a linha contra o
 * Excel: das 1.352 linhas do IFSul, a Matrícula Total bate em todas, e a soma dos
 * valores (R$ 39.322.522,89) e do Custo Evadido (R$ 564.754,95) bate ao centavo com o
 * que o Excel calculou ao abrir o arquivo.
 *
 * SUBSTITUI só o que for desta instituição no ciclo. O arquivo da rede inteira
 * (`carregarParticipacao`) continua valendo para as demais 41; recarregá-lo apaga o
 * ano todo, então esta carga deve rodar DEPOIS dele.
 */

const COL = {
  uf: 1,
  sigla: 2,
  instituicao: 3,
  campus: 4,
  modalidade: 5,
  fonteFinanciamento: 6,
  nivel: 7,
  tipoCurso: 8,
  curso: 9,
  areaEixo: 10,
  agropecuaria: 11,
  codigoCiclo: 12,
  ciclo: 13,
  tipoOferta: 14,
  turno: 15,
  inicio: 16,
  termino: 17,
  jubilamento: 18,
  chMec: 19,
  chCiclo: 20,
  chMatriz: 21,
  peso: 22,
  alunos: 23,
  matriculaTotal: 24,
  repasse: 25,
} as const;

const REPASSE: Record<string, CategoriaRepasse> = {
  PRESENCIAL: "PRESENCIAL",
  EAD: "EAD",
  "EAD MOOC": "EAD_MOOC",
  "EAD FP": "EAD_FP",
};

export interface ResultadoCargaInstituicao {
  sigla: string;
  ciclos: number;
  campus: number;
  somaValor: number;
  somaPerdaEvasao: number;
  somaMatriculaTotal: number;
  valorMatricula: Record<Repasse, number>;
  parametros: ParametrosValorMatricula;
  /** Linhas em que a Matrícula Total da planilha diverge do motor por mais de 1e-4. */
  divergenciasMotor: number;
  ignoradas: number;
  avisos: string[];
  fonteDadosId: number;
}

const COLUNA_RESUMO = { repasse: 10, matriculaTotal: 13 } as const;

/**
 * As matrículas totais da rede por forma de repasse, somadas do relatório RESUMIDO da rede do mesmo ciclo (soma da Matrícula Total por repasse).
 * Em 2027 essa soma bate com os parâmetros do arquivo do IFSul (1.594.996,32); serve quando o arquivo traz marcadores de texto no lugar deles
 * (o de 2026 trouxe "MT_PRESENCIAL"...). Confere o layout do relatório (primeira coluna "Instituição", com "% Participação") e usa o mais novo que serve.
 */
async function matriculasTotaisDoResumo(ano: number): Promise<{ totais: Record<CategoriaRepasse, number>; arquivo: string } | null> {
  for (const caminho of candidatosResumoDaRede(ano)) {
    const leitor = new ExcelJS.stream.xlsx.WorkbookReader(caminho, { entries: "emit", worksheets: "emit", sharedStrings: "cache", styles: "ignore" });
    const totais: Record<CategoriaRepasse, number> = { PRESENCIAL: 0, EAD: 0, EAD_MOOC: 0, EAD_FP: 0 };
    let primeira = true;
    let servePorLayout = false;
    for await (const planilha of leitor) {
      for await (const linha of planilha) {
        const v = (linha.values as unknown[]).slice(1);
        if (primeira) {
          primeira = false;
          const cab = v.map((c) => String(c ?? "").trim().toLowerCase());
          servePorLayout = cab[0] === "instituição" && cab.includes("% participação") && !cab.includes("código ciclo");
          if (!servePorLayout) break;
          continue;
        }
        const repasse = REPASSE[String(v[COLUNA_RESUMO.repasse] ?? "").toUpperCase()];
        if (repasse) totais[repasse] += Number(v[COLUNA_RESUMO.matriculaTotal] ?? 0);
      }
      break; // só a primeira aba, a detalhada
    }
    if (servePorLayout) return { totais, arquivo: caminho.split(/[\\/]/).pop() ?? caminho };
  }
  return null;
}

/**
 * Lê a aba Parâmetros: células soltas num painel, então as coordenadas são fixas. O arquivo de 2026 chegou com três problemas, tratados aqui e
 * devolvidos como notas (que vão para a ressalva da fonte): matrículas totais da rede em texto (derivadas do resumo da rede), período da PNP no
 * ano errado (o ano-base do ciclo é o ano menos 2) e peso do MOOC a 0,08 (a regra é 0,8 até 2026).
 */
async function lerParametros(
  ws: ExcelJS.Worksheet,
  ano: number,
): Promise<{ periodo: PeriodoPnp; parametros: ParametrosValorMatricula; notas: string[] }> {
  const notas: string[] = [];
  const n = (ref: string) => {
    const v = numero(ws.getCell(ref).value);
    if (v === null) throw new Error(`Aba Parâmetros sem número em ${ref}; o layout mudou?`);
    return v;
  };
  let inicio = data(ws.getCell("C3").value);
  let fim = data(ws.getCell("D3").value);
  if (!inicio || !fim) throw new Error("Aba Parâmetros sem o período da PNP em C3:D3; o layout mudou?");
  const anoBase = ano - 2;
  if (inicio.getUTCFullYear() !== anoBase) {
    notas.push(
      `O período da PNP do arquivo era ${inicio.toISOString().slice(0, 10)} a ${fim.toISOString().slice(0, 10)}; para o ciclo ${ano} o ano-base é ${anoBase}, e foi usado 01/01/${anoBase} a 31/12/${anoBase}.`,
    );
    inicio = new Date(Date.UTC(anoBase, 0, 1));
    fim = new Date(Date.UTC(anoBase, 11, 31));
  }

  const mtTexto = ["B10", "B11", "B12", "B13"].some((ref) => numero(ws.getCell(ref).value) === null);
  let mtRede: Record<CategoriaRepasse, number>;
  if (mtTexto) {
    const resumo = await matriculasTotaisDoResumo(ano);
    if (!resumo) {
      throw new Error(
        "Aba Parâmetros sem as matrículas totais da rede (B10:B13 são texto) e nenhum relatório resumido da rede do mesmo ciclo para derivá-las.",
      );
    }
    mtRede = resumo.totais;
    notas.push(`As matrículas totais da rede não estavam preenchidas no arquivo (marcadores de texto); foram somadas do relatório resumido da rede (${resumo.arquivo}).`);
  } else {
    mtRede = { PRESENCIAL: n("B10"), EAD: n("B11"), EAD_MOOC: n("B12"), EAD_FP: n("B13") };
  }

  // Os rótulos da coluna C guardam a modalidade de cada peso; conferir evita trocar
  // MOOC por FP em silêncio caso a MDO reordene as linhas.
  const rotulos = [15, 16, 17, 18].map((l) => texto(ws.getCell(`C${l}`).value)?.toUpperCase());
  const esperado = ["PRESENCIAL", "EAD", "EAD MOOC", "EAD FP"];
  if (rotulos.some((r, i) => r !== esperado[i])) {
    throw new Error(`Aba Parâmetros com modalidades em outra ordem (${rotulos.join(", ")}); ajuste a leitura.`);
  }

  // O MOOC vale 0,8 do presencial até 2026 e 0,08 depois (regra do usuário, a mesma de `carregarProposta`); o arquivo de 2026 trouxe 0,08.
  const pesoMoocArquivo = n("B17");
  const pesoMoocDoAno = ano <= 2026 ? 0.8 : pesoMoocArquivo;
  if (pesoMoocDoAno !== pesoMoocArquivo) notas.push(`O peso do MOOC no arquivo era ${pesoMoocArquivo}; a regra para ${ano} é ${pesoMoocDoAno}, e esta foi usada.`);

  return {
    periodo: { inicio, fim },
    parametros: {
      valorOrcamento: n("B4"),
      ajuste: n("B5"),
      assistenciaEstudantil: n("B6"),
      novosCampi: n("B7"),
      percentualFuncionamento: n("B8"),
      matriculasTotaisRede: mtRede,
      pesos: { PRESENCIAL: n("B15"), EAD: n("B16"), EAD_MOOC: pesoMoocDoAno, EAD_FP: n("B18") },
    },
    notas,
  };
}

const LOTE = 1_000;

/** Lê o CSV de parâmetros do IFTM (constante;parametro;valor;...) para um mapa constante → número. */
function lerCsvDeParametros(caminho: string): Map<string, number> {
  const conteudo = fs.readFileSync(caminho, "utf8").replace(/^﻿/, "");
  const mapa = new Map<string, number>();
  for (const linha of conteudo.split(/\r?\n/).slice(1)) {
    const c = linha.split(";");
    if (c.length < 3) continue;
    const valor = Number(c[2]!.trim().replace(/\./g, "").replace(",", "."));
    if (Number.isFinite(valor)) mapa.set(c[0]!.trim(), valor);
  }
  return mapa;
}

/**
 * Quando o IFTM publica os parâmetros do ciclo num CSV (mais novos que os do arquivo do IFSul), eles valem: ajuste, matrículas totais da rede e
 * valor por aluno de cada repasse. O MOOC fica a 0,08 do presencial (VL_MOOC), que é o critério da 5ª fase.
 */
function aplicarParametrosDoCsv(
  parametros: ParametrosValorMatricula,
  valorMatricula: Record<Repasse, number>,
  csv: Map<string, number>,
  nomeArquivo: string,
): { parametros: ParametrosValorMatricula; valorMatricula: Record<Repasse, number>; nota: string } {
  const pega = (k: string) => {
    const v = csv.get(k);
    if (v === undefined) throw new Error(`O CSV de parâmetros ${nomeArquivo} não tem a constante ${k}.`);
    return v;
  };
  const vl: Record<Repasse, number> = { PRESENCIAL: pega("VL_PRESENCIAL"), EAD: pega("VL_EAD"), EAD_MOOC: pega("VL_MOOC"), EAD_FP: pega("VL_FP") };
  const novos: ParametrosValorMatricula = {
    ...parametros,
    ajuste: pega("AJUSTE"),
    matriculasTotaisRede: { PRESENCIAL: pega("MT_PRESENCIAL"), EAD: pega("MT_EAD"), EAD_MOOC: pega("MT_MOOC"), EAD_FP: pega("MT_FP") },
    pesos: { PRESENCIAL: 1, EAD: vl.EAD / vl.PRESENCIAL, EAD_MOOC: vl.EAD_MOOC / vl.PRESENCIAL, EAD_FP: vl.EAD_FP / vl.PRESENCIAL },
  };
  return {
    parametros: novos,
    valorMatricula: vl,
    nota:
      `Os parâmetros do arquivo (ajuste de R$ ${parametros.ajuste.toLocaleString("pt-BR")}, matrícula presencial de R$ ${valorMatricula.PRESENCIAL.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}) ` +
      `foram trocados pelos do IFTM em ${nomeArquivo} (ajuste de R$ ${novos.ajuste.toLocaleString("pt-BR")}, matrícula presencial de R$ ${vl.PRESENCIAL.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}, MOOC a R$ ${vl.EAD_MOOC.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}).`,
  };
}

export async function carregarParticipacaoInstituicao(
  ano: number,
  sigla: string,
): Promise<ResultadoCargaInstituicao | null> {
  const arquivo = planilhaParticipacaoInstituicao(ano, sigla);
  if (!arquivo) return null;
  const caminho = exigirArquivo(arquivo, `a 6ª fase (Participação Orçamentária) de ${sigla} em ${ano}`);
  const avisos: string[] = [];

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(caminho);
  const wsCiclos = wb.getWorksheet("CICLOS");
  const wsParametros = wb.getWorksheet("Parâmetros");
  if (!wsCiclos || !wsParametros) {
    throw new Error("A planilha não tem as abas CICLOS e Parâmetros esperadas.");
  }

  const lidos = await lerParametros(wsParametros, ano);
  const { periodo, notas } = lidos;
  let parametros = lidos.parametros;
  let valorMatricula = valorPorMatricula(parametros);
  const csvParametros = parametrosMdoCsv(ano);
  if (csvParametros) {
    const r = aplicarParametrosDoCsv(parametros, valorMatricula, lerCsvDeParametros(csvParametros), csvParametros.split(/[\\/]/).pop() ?? csvParametros);
    parametros = r.parametros;
    valorMatricula = r.valorMatricula;
    notas.push(r.nota);
  }

  const siglaEmCaixaAlta = sigla.toUpperCase();
  const instituicao = await prisma.instituicao.findUnique({ where: { sigla: siglaEmCaixaAlta } });
  if (!instituicao) {
    throw new Error(`Instituição ${siglaEmCaixaAlta} ainda não existe no banco; carregue a 5ª fase antes.`);
  }
  const unidades = await prisma.unidade.findMany({
    where: { instituicaoId: instituicao.id },
    select: { id: true, nome: true },
  });
  const unidadePorNome = new Map(unidades.map((u) => [u.nome.trim().toUpperCase(), u.id]));

  // Só o que é desta instituição neste ciclo. As outras 41 ficam como estão.
  await prisma.distribuicaoCiclo.deleteMany({ where: { ano, unidade: { instituicaoId: instituicao.id } } });
  await prisma.parametrosParticipacao.deleteMany({ where: { ano, instituicaoId: instituicao.id } });

  const fonte = await prisma.fonteDados.create({
    data: {
      origem: "MDO_IFTM",
      fase: "F6_PARTICIPACAO",
      cicloOrcamento: ano,
      arquivo: caminho.split(/[\\/]/).pop() ?? caminho,
      abrangencia: "INSTITUICAO",
      instituicaoId: instituicao.id,
      checksum: checksumArquivo(caminho),
      ressalva:
        "Planilha exportada com fórmulas e sem os valores gravados; os valores em reais foram refeitos " +
        "por este sistema com a mesma regra da planilha (conferida ao centavo contra o Excel). " +
        "Os parâmetros desta fase (ajuste de R$ " +
        parametros.ajuste.toLocaleString("pt-BR") +
        ", valor da matrícula presencial de R$ " +
        valorMatricula.PRESENCIAL.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) +
        (csvParametros ? ")" : ") diferem dos da 5ª fase exportada no mesmo dia") + ". " +
        "A coluna Custo Evadido mudou de definição em relação à exportação da rede de 2026-08-31 " +
        "(o aluno retido passou a valer metade), então a perda por evasão não é comparável entre as duas." +
        (notas.length > 0 ? " Ajustes feitos por este sistema ao ler o arquivo: " + notas.join(" ") : ""),
    },
  });

  await prisma.parametrosParticipacao.create({
    data: {
      ano,
      instituicaoId: instituicao.id,
      fonteDadosId: fonte.id,
      periodoInicio: periodo.inicio,
      periodoFim: periodo.fim,
      valorOrcamento: parametros.valorOrcamento,
      ajuste: parametros.ajuste,
      assistenciaEstudantil: parametros.assistenciaEstudantil,
      novosCampi: parametros.novosCampi,
      percentualFuncionamento: parametros.percentualFuncionamento,
      matriculasPresencial: parametros.matriculasTotaisRede.PRESENCIAL,
      matriculasEad: parametros.matriculasTotaisRede.EAD,
      matriculasEadMooc: parametros.matriculasTotaisRede.EAD_MOOC,
      matriculasEadFp: parametros.matriculasTotaisRede.EAD_FP,
      pesoEad: parametros.pesos.EAD,
      pesoEadMooc: parametros.pesos.EAD_MOOC,
      pesoEadFp: parametros.pesos.EAD_FP,
      valorMatriculaPresencial: valorMatricula.PRESENCIAL,
      valorMatriculaEad: valorMatricula.EAD,
      valorMatriculaEadMooc: valorMatricula.EAD_MOOC,
      valorMatriculaEadFp: valorMatricula.EAD_FP,
    },
  });

  let buffer: Prisma.DistribuicaoCicloCreateManyInput[] = [];
  const campusVistos = new Set<number>();
  const naoEncontrados = new Set<string>();
  let ciclos = 0;
  let ignoradas = 0;
  let divergenciasMotor = 0;
  let somaValor = 0;
  let somaPerdaEvasao = 0;
  let somaMatriculaTotal = 0;

  const gravar = async () => {
    if (buffer.length === 0) return;
    await prisma.distribuicaoCiclo.createMany({ data: buffer });
    buffer = [];
  };

  // Primeira passada: monta as linhas e soma o valor por instituição, porque a
  // "Contribuição Instituição" (fatia do ciclo no total) precisa do total fechado.
  const linhas: { ciclo: CicloParaCalculo; repasse: CategoriaRepasse; entrada: Prisma.DistribuicaoCicloCreateManyInput; mt: number; valor: number }[] = [];

  wsCiclos.eachRow((linha, numeroLinha) => {
    if (numeroLinha < 5) return;
    const v = (c: number) => linha.getCell(c).value;
    const campus = texto(v(COL.campus));
    const codigoCiclo = texto(v(COL.codigoCiclo));
    const repasseBruto = texto(v(COL.repasse));
    if (!campus || !codigoCiclo || !repasseBruto) {
      ignoradas++;
      return;
    }
    const repasse = REPASSE[repasseBruto.toUpperCase()];
    const inicio = data(v(COL.inicio));
    const termino = data(v(COL.termino));
    const jubilamento = data(v(COL.jubilamento));
    if (!repasse || !inicio || !termino || !jubilamento) {
      ignoradas++;
      return;
    }
    const unidadeId = unidadePorNome.get(campus.toUpperCase());
    if (unidadeId === undefined) {
      naoEncontrados.add(campus);
      ignoradas++;
      return;
    }
    campusVistos.add(unidadeId);

    const ciclo: CicloParaCalculo = {
      inicio,
      termino,
      jubilamento,
      chMec: numeroOuZero(v(COL.chMec)),
      chCiclo: numeroOuZero(v(COL.chCiclo)),
      chMatriz: numeroOuZero(v(COL.chMatriz)),
      peso: numeroOuZero(v(COL.peso)),
      agropecuaria: texto(v(COL.agropecuaria))?.toUpperCase() === "SIM",
      alunos: numeroOuZero(v(COL.alunos)),
    };

    // A Matrícula Total da planilha é o dado oficial (vem gravada, arredondada em 6
    // casas); o motor serve de conferência. Divergência acima de 1e-4 quer dizer que a
    // MDO mudou a regra e o motor precisa ser revisto.
    const mtPlanilha = numeroOuZero(v(COL.matriculaTotal));
    const mtMotor = matriculaTotalDoCiclo(ciclo, periodo);
    if (Math.abs(mtPlanilha - mtMotor) > 1e-4) divergenciasMotor++;

    const calc = valorDoCiclo(ciclo, mtPlanilha, valorMatricula[repasse], periodo);
    somaValor += calc.valor;
    somaPerdaEvasao += calc.custoEvadido;
    somaMatriculaTotal += mtPlanilha;

    linhas.push({
      ciclo,
      repasse,
      mt: mtPlanilha,
      valor: calc.valor,
      entrada: {
        ano,
        unidadeId,
        fonteDadosId: fonte.id,
        codigoCiclo,
        ciclo: texto(v(COL.ciclo)) ?? "",
        curso: texto(v(COL.curso)) ?? "",
        areaEixo: texto(v(COL.areaEixo)),
        nivel: texto(v(COL.nivel)),
        tipoCurso: texto(v(COL.tipoCurso)),
        tipoOferta: texto(v(COL.tipoOferta)),
        turno: texto(v(COL.turno)),
        modalidade: texto(v(COL.modalidade)) ?? "",
        fonteFinanciamento: texto(v(COL.fonteFinanciamento)) ?? "",
        repasse,
        inicio,
        termino,
        jubilamento,
        pesoCursoMatriz: ciclo.peso,
        chMinimaMec: ciclo.chMec,
        cargaHoraria: ciclo.chCiclo,
        chMatriz: ciclo.chMatriz,
        qtdAlunosMatriz: ciclo.alunos,
        matriculaTotal: mtPlanilha,
        valorReais: calc.valor,
        icqa: icqaDoCiclo(ciclo, periodo),
        valorAluno: valorMatricula[repasse],
        perdaEvasaoReais: calc.custoEvadido,
        agropecuaria: ciclo.agropecuaria,
        chExcedente: ciclo.chMatriz > ciclo.chMec ? ciclo.chMatriz - ciclo.chMec : 0,
        alunosContabilizados: calc.alunosContabilizados,
        alunosNaoContabilizados: calc.alunosNaoContabilizados,
      },
    });
  });

  for (const l of linhas) {
    l.entrada.contribuicaoInstituicao = somaValor > 0 ? l.valor / somaValor : 0;
    buffer.push(l.entrada);
    ciclos++;
    if (buffer.length >= LOTE) await gravar();
  }
  await gravar();

  if (naoEncontrados.size > 0) {
    avisos.push(`Câmpus da planilha sem unidade no banco (linhas ignoradas): ${[...naoEncontrados].join(", ")}. Carregue a 5ª fase antes.`);
  }
  if (divergenciasMotor > 0) {
    avisos.push(
      `${divergenciasMotor} linha(s) em que a Matrícula Total da planilha difere do motor de cálculo por mais de 0,0001: ` +
        "a MDO pode ter mudado a regra.",
    );
  }

  return {
    sigla: siglaEmCaixaAlta,
    ciclos,
    campus: campusVistos.size,
    somaValor,
    somaPerdaEvasao,
    somaMatriculaTotal,
    valorMatricula,
    parametros,
    divergenciasMotor,
    ignoradas,
    avisos,
    fonteDadosId: fonte.id,
  };
}
