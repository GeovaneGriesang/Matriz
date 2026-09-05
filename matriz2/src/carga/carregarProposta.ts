import ExcelJS from "exceljs";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/server/db/prisma";
import { exigirArquivo, planilhaProposta } from "./caminhos";
import { checksumArquivo, dataDeGeracao, numero, texto } from "./planilha";

/**
 * Carrega a 5ª fase da MDO: a proposta compilada, com todos os blocos por câmpus e
 * por instituição, mais os parâmetros do ciclo e os indicadores homologados.
 *
 * É a fase que traz o que o sistema antigo nunca conseguiu derivar da PNP: o RAPP
 * oficial, a Eficiência Acadêmica de ciclo e o RIP da Assistência Estudantil.
 *
 * A planilha tem 1 MB e cabe na memória, ao contrário da 6ª fase; aqui o leitor
 * comum do exceljs serve, e dá acesso por coordenada, que a aba DADOS BASE exige.
 */

/** Colunas da aba COMPLETO PROPOSTA (1-indexadas, como na planilha). */
const CP = {
  uf: 2,
  unidade: 3,
  tipo: 4,
  anoCriacao: 5,
  sigla: 6,
  piso: 7,
  matrPresencialAjustada: 8,
  matrEadAjustada: 10,
  qtAlPresencial: 12,
  qtAlEad: 13,
  qtAlMooc: 14,
  qtAlEadFp: 15,
  mtPresencial: 17,
  mtEad: 18,
  mtEadMooc: 19,
  mtEadFp: 20,
  vlMatrizPresencial: 22,
  vlMatrizEad: 23,
  vlMatrizEadMooc: 24,
  vlMatrizEadFp: 25,
  aePresencial: 41,
  aeEad: 48,
  aeRip: 51,
} as const;

/** Colunas da aba RESUMO PROPOSTA. */
const RP = {
  unidade: 3,
  categoria: 4,
  sigla: 5,
  vlMatr: 7,
  vlIea: 8,
  vlRap: 9,
  vlIapl: 10,
  matrizCusteio: 11,
  matrizAe: 13,
  anuidadeConif: 15,
  porcentagem: 17,
} as const;

/** Colunas da aba INDICADORES. */
const IND = {
  unidade: 4,
  sigla: 6,
  ieaConclusao: 7,
  ieaEvasao: 8,
  ieaRetencao: 9,
  ieaEficiencia: 10,
  ieaPonderado: 11,
  ieaEqualizado: 12,
  rapPresencial: 14,
  rapMecPresencial: 15,
  rapEquivalente: 16,
  rapPonderado: 17,
  rapEqualizado: 18,
  aplTecnico: 20,
  aplTecnicoPonderado: 21,
  aplFormacaoProfessor: 22,
  ialPonderado: 23,
  aplProeja: 24,
  aplProejaPonderado: 25,
  ialEqualizado: 26,
  matrEquivalente: 27,
} as const;

/**
 * Coordenadas dos parâmetros na aba DADOS BASE. São células soltas num painel, sem
 * cabeçalho de tabela, então não há como descobri-las por nome de coluna; ficam
 * fixadas aqui, conferidas em 2026-09-01 contra a planilha de 2027.
 */
const DB = {
  valorReferenciaSpo: "M23",
  ajuste: "M24",
  assistenciaTotal: "W42",
  funcionamentoTotal: "W29",
  pisoTotal: "W28",
  reitoriasTotal: "W32",
  qualidadeEficienciaTotal: "W20",
  valorIea: "W17",
  valorRap: "W18",
  valorIapl: "W19",
  valorMatriculaPresencial: "I29",
  valorMatriculaEad: "I33",
  valorMatriculaEadFp: "I37",
  valorMatriculaEadMooc: "I41",
  percentualAnuidade: "I21",
} as const;

/**
 * DADOS BASE de 2026 tem outro layout — confirma o que o usuário já esperava
 * ("tivemos alterações na forma de gerar a matriz de 2026 para 2027"). Conferido em
 * 2026-09-05 contra a fonte alternativa de 2026 (ver `caminhos.ts`).
 *
 * Só três parâmetros têm célula própria aqui; os demais (funcionamentoTotal,
 * assistenciaTotal, pisoTotal, reitoriasTotal, qualidadeEficienciaTotal, valorIea,
 * valorRap, valorIapl, valorMatricula*) não existem preenchidos nesta planilha — as
 * fórmulas de valor por câmpus em COMPLETO PROPOSTA (colunas V/W/X/Y e AO/AV) todas
 * multiplicam a matrícula ponderada pelo "valor por matrícula", que fica justamente
 * em I29/I33/I37/I41 no layout de 2027 — e essas quatro células estão vazias aqui.
 * A MDO nunca calculou o valor final para esta versão do arquivo: o que ele traz são
 * os INSUMOS (matrícula, indicadores brutos), não o resultado distribuído. Por isso
 * ficam de fora deste mapa (a chave ausente é lida como "sem célula", nunca como uma
 * célula errada de outro layout).
 */
const DB_2026: Partial<Record<keyof typeof DB, string>> = {
  valorReferenciaSpo: "M25",
  ajuste: "M26",
  percentualAnuidade: "I22",
};

export interface ResultadoProposta {
  campus: number;
  reitorias: number;
  instituicoes: number;
  elegiveisPiso: number;
  somaVlMatr: number;
  somaAssistencia: number;
  funcionamentoTotalDeclarado: number;
  pisoTotalDeclarado: number;
  fonteDadosId: number;
  avisos: string[];
}

type Linha = { getCell(c: number): { value: unknown } };

function celula(ws: { getCell(ref: string): { value: unknown } }, ref: string | undefined): number | null {
  return ref ? numero(ws.getCell(ref).value) : null;
}

export async function carregarProposta(ano: number): Promise<ResultadoProposta> {
  const caminho = exigirArquivo(planilhaProposta(ano), `a planilha da 5ª fase (Completo proposta) de ${ano}`);
  const avisos: string[] = [];

  // Ver comentário de DB_2026: o layout de DADOS BASE (e a coluna de sigla em
  // INDICADORES) mudou entre os ciclos 2026 e 2027.
  const layout2026 = ano === 2026;
  function db(chave: keyof typeof DB): string | undefined {
    return layout2026 ? DB_2026[chave] : DB[chave];
  }

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(caminho);
  const completo = wb.getWorksheet("COMPLETO PROPOSTA");
  const resumo = wb.getWorksheet("RESUMO PROPOSTA");
  const indicadores = wb.getWorksheet("INDICADORES");
  const dadosBase = wb.getWorksheet("DADOS BASE");
  if (!completo || !resumo || !indicadores || !dadosBase) {
    throw new Error("A planilha não tem as quatro abas esperadas (DADOS BASE, COMPLETO PROPOSTA, RESUMO PROPOSTA, INDICADORES).");
  }

  // A data de geração vive num texto solto do cabeçalho ("Gerado em 30/08/2026, 12:07:47").
  const geradoEm =
    dataDeGeracao(texto(completo.getCell("C3").value)) ?? dataDeGeracao(texto(resumo.getCell("C3").value));
  if (!geradoEm) avisos.push("Não achei a data de geração no cabeçalho da planilha.");

  await prisma.distribuicaoCampus.deleteMany({ where: { ano } });
  await prisma.distribuicaoInstituicao.deleteMany({ where: { ano } });
  await prisma.cicloOrcamento.deleteMany({ where: { ano } });

  const fonte = await prisma.fonteDados.create({
    data: {
      origem: "MDO_IFTM",
      fase: "F5_PROPOSTA",
      cicloOrcamento: ano,
      arquivo: caminho.split(/[\\/]/).pop() ?? caminho,
      geradoEm,
      abrangencia: "REDE",
      checksum: checksumArquivo(caminho),
      ressalva: layout2026
        ? "Não é a exportação oficial do usuário na MDO (essa saiu com a matrícula por câmpus " +
          "zerada): veio por outro canal, com matrícula e indicadores reais. Mas a MDO nunca " +
          "calculou, nesta versão, o valor final por matrícula (DADOS BASE não traz esse número), " +
          "então o Funcionamento e a Assistência Estudantil por câmpus ficam em zero aqui também, " +
          "por um motivo diferente do da exportação oficial. A marcação de elegibilidade ao Piso " +
          "Mínimo também não veio preenchida nesta versão."
        : null,
    },
  });

  // ---- Parâmetros do ciclo (aba DADOS BASE) ----
  const funcionamentoTotal = celula(dadosBase, db("funcionamentoTotal")) ?? 0;
  const pisoTotal = celula(dadosBase, db("pisoTotal")) ?? 0;

  // ---- Instituições, unidades e o nível de câmpus (aba COMPLETO PROPOSTA) ----
  const instituicaoPorSigla = new Map<string, number>();
  const unidadePorChave = new Map<string, number>();
  const campusParaGravar: Prisma.DistribuicaoCampusCreateManyInput[] = [];
  let reitorias = 0;
  let elegiveisPiso = 0;

  /**
   * Registra a instituição a partir da linha TIPO = T, a única em que a coluna
   * UNIDADE traz o nome do instituto. Nas linhas R e C essa mesma coluna traz o nome
   * da reitoria ou do câmpus; usá-la aqui renomearia a instituição para "REITORIA DO
   * INSTITUTO FEDERAL ...", que foi exatamente o engano que este comentário evita.
   */
  async function registrarInstituicao(sigla: string, nome: string, uf: string): Promise<number> {
    const inst = await prisma.instituicao.upsert({
      where: { sigla },
      create: { sigla, nome, uf },
      // A 6ª fase cria a instituição sem UF; esta fase é quem a completa.
      update: { nome, uf },
    });
    instituicaoPorSigla.set(sigla, inst.id);
    return inst.id;
  }

  const linhasCompleto: { linha: Linha; sigla: string; nome: string; uf: string; tipo: string }[] = [];
  completo.eachRow((linha) => {
    const tipo = texto((linha as Linha).getCell(CP.tipo).value);
    if (tipo !== "T" && tipo !== "R" && tipo !== "C") return;
    const sigla = texto((linha as Linha).getCell(CP.sigla).value);
    const nome = texto((linha as Linha).getCell(CP.unidade).value);
    const uf = texto((linha as Linha).getCell(CP.uf).value) ?? "";
    if (!sigla || !nome) return;
    linhasCompleto.push({ linha: linha as Linha, sigla, nome, uf, tipo });
  });

  // Primeira passada: só as linhas TIPO = T, para que toda instituição exista com o
  // nome e a UF certos antes de qualquer unidade se pendurar nela.
  for (const { sigla, nome, uf, tipo } of linhasCompleto) {
    if (tipo === "T") await registrarInstituicao(sigla, nome, uf);
  }

  // Segunda passada: reitorias e câmpus.
  for (const { linha, sigla, nome, tipo } of linhasCompleto) {
    if (tipo === "T") continue;

    const instituicaoId = instituicaoPorSigla.get(sigla);
    if (instituicaoId === undefined) {
      avisos.push(`Unidade "${nome}" (${sigla}) sem linha de instituição correspondente; ignorada.`);
      continue;
    }
    const chave = `${instituicaoId}::${nome}`;
    let unidadeId = unidadePorChave.get(chave);
    if (unidadeId === undefined) {
      const anoCriacao = numero(linha.getCell(CP.anoCriacao).value);
      const un = await prisma.unidade.upsert({
        where: { instituicaoId_nome: { instituicaoId, nome } },
        create: {
          instituicaoId,
          nome,
          tipo: tipo === "R" ? "REITORIA" : "CAMPUS",
          anoCriacao: anoCriacao && anoCriacao > 1900 ? Math.round(anoCriacao) : null,
        },
        update: {
          tipo: tipo === "R" ? "REITORIA" : "CAMPUS",
          ...(anoCriacao && anoCriacao > 1900 ? { anoCriacao: Math.round(anoCriacao) } : {}),
        },
      });
      unidadeId = un.id;
      unidadePorChave.set(chave, unidadeId);
    }

    if (tipo === "R") {
      reitorias++;
      continue;
    }

    // A coluna Piso não é um valor: é a bandeira "S" que a MDO usa para marcar
    // elegibilidade. O valor final já com a regra aplicada vem do RESUMO PROPOSTA.
    const elegivel = texto(linha.getCell(CP.piso).value)?.toUpperCase() === "S";
    if (elegivel) elegiveisPiso++;

    campusParaGravar.push({
      ano,
      unidadeId,
      fonteDadosId: fonte.id,
      elegivelPiso: elegivel,
      matrPresencialAjustada: numero(linha.getCell(CP.matrPresencialAjustada).value),
      matrEadAjustada: numero(linha.getCell(CP.matrEadAjustada).value),
      qtAlPresencial: numero(linha.getCell(CP.qtAlPresencial).value),
      qtAlEad: numero(linha.getCell(CP.qtAlEad).value),
      qtAlMooc: numero(linha.getCell(CP.qtAlMooc).value),
      qtAlEadFp: numero(linha.getCell(CP.qtAlEadFp).value),
      mtPresencial: numero(linha.getCell(CP.mtPresencial).value),
      mtEad: numero(linha.getCell(CP.mtEad).value),
      mtEadMooc: numero(linha.getCell(CP.mtEadMooc).value),
      mtEadFp: numero(linha.getCell(CP.mtEadFp).value),
      vlMatrizPresencial: numero(linha.getCell(CP.vlMatrizPresencial).value),
      vlMatrizEad: numero(linha.getCell(CP.vlMatrizEad).value),
      vlMatrizEadMooc: numero(linha.getCell(CP.vlMatrizEadMooc).value),
      vlMatrizEadFp: numero(linha.getCell(CP.vlMatrizEadFp).value),
      aePresencial: numero(linha.getCell(CP.aePresencial).value),
      aeEad: numero(linha.getCell(CP.aeEad).value),
      aeRip: numero(linha.getCell(CP.aeRip).value),
    });
  }

  // ---- VL_MATR final por câmpus e os totais por instituição (aba RESUMO PROPOSTA) ----
  // A chave é (sigla, nome do câmpus): há nomes de câmpus repetidos entre instituições,
  // e casar só pelo nome mistura unidades de institutos diferentes.
  const vlMatrPorChave = new Map<string, number>();
  const instituicaoParaGravar = new Map<string, Prisma.DistribuicaoInstituicaoCreateManyInput>();

  resumo.eachRow((linha) => {
    const l = linha as Linha;
    const categoria = texto(l.getCell(RP.categoria).value);
    const sigla = texto(l.getCell(RP.sigla).value);
    const nome = texto(l.getCell(RP.unidade).value);
    if (!sigla || !nome) return;
    if (categoria === "C") {
      vlMatrPorChave.set(`${sigla}::${nome}`, numero(l.getCell(RP.vlMatr).value) ?? 0);
    } else if (categoria === "T") {
      const instituicaoId = instituicaoPorSigla.get(sigla);
      if (instituicaoId === undefined) return;
      instituicaoParaGravar.set(sigla, {
        ano,
        instituicaoId,
        fonteDadosId: fonte.id,
        vlMatr: numero(l.getCell(RP.vlMatr).value),
        vlIea: numero(l.getCell(RP.vlIea).value),
        vlRap: numero(l.getCell(RP.vlRap).value),
        vlIapl: numero(l.getCell(RP.vlIapl).value),
        matrizCusteio: numero(l.getCell(RP.matrizCusteio).value),
        matrizAe: numero(l.getCell(RP.matrizAe).value),
        anuidadeConif: numero(l.getCell(RP.anuidadeConif).value),
        porcentagem: numero(l.getCell(RP.porcentagem).value),
      });
    }
  });

  // Liga o VL_MATR final a cada câmpus já montado.
  const unidadeIdParaChave = new Map<number, string>();
  for (const { sigla, nome, tipo } of linhasCompleto) {
    if (tipo !== "C") continue;
    const instituicaoId = instituicaoPorSigla.get(sigla);
    if (instituicaoId === undefined) continue;
    const unidadeId = unidadePorChave.get(`${instituicaoId}::${nome}`);
    if (unidadeId !== undefined) unidadeIdParaChave.set(unidadeId, `${sigla}::${nome}`);
  }
  let semVlMatr = 0;
  for (const item of campusParaGravar) {
    const chave = unidadeIdParaChave.get(item.unidadeId);
    const v = chave ? vlMatrPorChave.get(chave) : undefined;
    if (v === undefined) semVlMatr++;
    else item.vlMatrFinal = v;
  }
  if (semVlMatr > 0) avisos.push(`${semVlMatr} câmpus sem VL_MATR correspondente na aba RESUMO PROPOSTA.`);

  // ---- Indicadores homologados (aba INDICADORES) ----
  // Em 2026 a sigla fica na coluna E (5), não F (6): a coluna F desta versão é
  // "ds_abreviatura" só de exibição, vazia em algumas linhas; a sigla de verdade,
  // usada para casar com a instituição, está uma coluna antes.
  const colSiglaIndicadores = layout2026 ? 5 : IND.sigla;
  indicadores.eachRow((linha) => {
    const l = linha as Linha;
    const sigla = texto(l.getCell(colSiglaIndicadores).value);
    if (!sigla) return;
    const alvo = instituicaoParaGravar.get(sigla);
    if (!alvo) return;
    alvo.ieaConclusao = numero(l.getCell(IND.ieaConclusao).value);
    alvo.ieaEvasao = numero(l.getCell(IND.ieaEvasao).value);
    alvo.ieaRetencao = numero(l.getCell(IND.ieaRetencao).value);
    alvo.ieaEficiencia = numero(l.getCell(IND.ieaEficiencia).value);
    alvo.ieaPonderado = numero(l.getCell(IND.ieaPonderado).value);
    alvo.ieaEqualizado = numero(l.getCell(IND.ieaEqualizado).value);
    alvo.rapPresencial = numero(l.getCell(IND.rapPresencial).value);
    alvo.rapMecPresencial = numero(l.getCell(IND.rapMecPresencial).value);
    alvo.rapEquivalente = numero(l.getCell(IND.rapEquivalente).value);
    alvo.rapPonderado = numero(l.getCell(IND.rapPonderado).value);
    alvo.rapEqualizado = numero(l.getCell(IND.rapEqualizado).value);
    alvo.aplTecnico = numero(l.getCell(IND.aplTecnico).value);
    alvo.aplTecnicoPonderado = numero(l.getCell(IND.aplTecnicoPonderado).value);
    alvo.aplFormacaoProfessor = numero(l.getCell(IND.aplFormacaoProfessor).value);
    alvo.ialPonderado = numero(l.getCell(IND.ialPonderado).value);
    alvo.aplProeja = numero(l.getCell(IND.aplProeja).value);
    alvo.aplProejaPonderado = numero(l.getCell(IND.aplProejaPonderado).value);
    alvo.ialEqualizado = numero(l.getCell(IND.ialEqualizado).value);
    alvo.matrEquivalente = numero(l.getCell(IND.matrEquivalente).value);
  });

  // ---- Grava ----
  await prisma.cicloOrcamento.create({
    data: {
      ano,
      fonteDadosId: fonte.id,
      valorReferenciaSpo: celula(dadosBase, db("valorReferenciaSpo")) ?? 0,
      ajuste: celula(dadosBase, db("ajuste")) ?? 0,
      assistenciaTotal: celula(dadosBase, db("assistenciaTotal")) ?? 0,
      funcionamentoTotal,
      pisoTotal,
      pisoPorCampus: elegiveisPiso > 0 ? pisoTotal / elegiveisPiso : 0,
      campusComPiso: elegiveisPiso,
      reitoriasTotal: celula(dadosBase, db("reitoriasTotal")) ?? 0,
      qualidadeEficienciaTotal: celula(dadosBase, db("qualidadeEficienciaTotal")) ?? 0,
      valorIea: celula(dadosBase, db("valorIea")) ?? 0,
      valorRap: celula(dadosBase, db("valorRap")) ?? 0,
      valorIapl: celula(dadosBase, db("valorIapl")) ?? 0,
      valorMatriculaPresencial: celula(dadosBase, db("valorMatriculaPresencial")),
      valorMatriculaEad: celula(dadosBase, db("valorMatriculaEad")),
      valorMatriculaEadFp: celula(dadosBase, db("valorMatriculaEadFp")),
      valorMatriculaEadMooc: celula(dadosBase, db("valorMatriculaEadMooc")),
      percentualAnuidade: celula(dadosBase, db("percentualAnuidade")) ?? 0,
    },
  });

  if (campusParaGravar.length > 0) {
    await prisma.distribuicaoCampus.createMany({ data: campusParaGravar });
  }
  const instituicoes = Array.from(instituicaoParaGravar.values());
  if (instituicoes.length > 0) {
    await prisma.distribuicaoInstituicao.createMany({ data: instituicoes });
  }

  const somaVlMatr = campusParaGravar.reduce((acc, c) => acc + Number(c.vlMatrFinal ?? 0), 0);
  const somaAssistencia = campusParaGravar.reduce(
    (acc, c) => acc + Number(c.aePresencial ?? 0) + Number(c.aeEad ?? 0) + Number(c.aeRip ?? 0),
    0,
  );

  // A fonte alternativa de 2026 nunca teve o valor por matrícula calculado (ver
  // DB_2026): Funcionamento e Assistência Estudantil somam zero por um motivo
  // diferente do da exportação oficial (que zerou por matrícula ausente), mas o
  // resultado prático é o mesmo. Aviso próprio, em vez de deixar o sistema publicar
  // zero com cara de dado.
  if (layout2026) {
    avisos.push(
      "Ciclo 2026 carregado a partir da fonte alternativa (ver ressalva da fonte de dados). " +
        `Matrícula e indicadores por instituição são reais, mas o Funcionamento (R$ ${somaVlMatr.toFixed(2)}) ` +
        `e a Assistência Estudantil (R$ ${somaAssistencia.toFixed(2)}) por câmpus ficam em zero: ` +
        "a MDO não calculou o valor por matrícula nesta versão do arquivo. Não usar este ciclo " +
        "para valores em R$ por câmpus ou instituição até que essa lacuna se resolva.",
    );
  }

  // Uma exportação incompleta é o caso real da fonte OFICIAL de 2026: a planilha saiu
  // sem NENHUM dado de matrícula, nem por câmpus nem nos totais de rede da aba DADOS
  // BASE, e por isso o Funcionamento derivado dela zerou. Comparar contra zero não
  // basta, porque os câmpus do piso continuam somando (em 2026, R$ 38,5 milhões de um
  // bloco de R$ 1,9 bilhão); a conferência precisa ser contra o total que a própria
  // planilha declara. Não dispara para o layout de 2026 acima, que já tem seu próprio
  // aviso: ali `funcionamentoTotal` fica em zero por falta de célula, não por ela
  // declarar um total maior que zero e a soma não bater.
  const LIMITE_INCOMPLETO = 0.5;
  if (funcionamentoTotal > 0 && somaVlMatr < funcionamentoTotal * LIMITE_INCOMPLETO) {
    const pct = ((somaVlMatr / funcionamentoTotal) * 100).toFixed(1);
    avisos.push(
      `A soma do Funcionamento por câmpus cobre apenas ${pct}% do total que a planilha declara. ` +
        "É o sintoma da exportação de 2026, que saiu sem nenhum dado de matrícula (o Valor da " +
        "Matrícula na aba DADOS BASE é zero, e tudo que multiplica por ele zera junto). " +
        "Este ciclo não deve ser usado no nível de câmpus.",
    );
  }
  if (somaAssistencia > 0 && somaAssistencia < 1_000_000) {
    avisos.push(
      `A Assistência Estudantil somada por câmpus é de apenas ${somaAssistencia.toFixed(2)}, ` +
        "ordem de grandeza incompatível com um ciclo completo. Mesma causa da matrícula zerada.",
    );
  }

  return {
    campus: campusParaGravar.length,
    reitorias,
    instituicoes: instituicoes.length,
    elegiveisPiso,
    somaVlMatr,
    somaAssistencia,
    funcionamentoTotalDeclarado: funcionamentoTotal,
    pisoTotalDeclarado: pisoTotal,
    fonteDadosId: fonte.id,
    avisos,
  };
}
