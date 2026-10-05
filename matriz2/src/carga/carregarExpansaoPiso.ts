import fs from "node:fs";
import { nomeCanonicoDaUnidade } from "@/lib/nomesDeUnidade";
import ExcelJS from "exceljs";
import { prisma } from "@/server/db/prisma";
import { existe, listaPisoMdoCsv, planilhaPropostaOficial } from "./caminhos";

/**
 * A aba EXPANSÃO da planilha oficial da 5ª fase é uma lista fixa (sem fórmula, sem
 * depender da matrícula por câmpus) dos câmpus criados por portaria recente, cada um
 * com o Piso Mínimo (R$ 700.000) já definido. Existe porque, pelo menos em 2026, a
 * exportação oficial saiu com a matrícula por câmpus zerada (ver `carregarProposta.ts`):
 * sem matrícula, o cálculo por câmpus não dá pra fazer, mas para os câmpus desta lista
 * o valor final NÃO depende do cálculo, é o piso cravado. Por isso este módulo é
 * separado de `carregarProposta`: não é a carga normal do ciclo, é uma correção pontual
 * para os câmpus que esta lista cobre; os outros continuam sem solução.
 *
 * Casamento por nome é o mesmo tipo de risco já visto nestes dados (câmpus "irmãos"
 * trocados no relatório comparativo, ver `ComparativoInstitucional` no schema): aqui o
 * nome vem em Title Case ("Campus Rosário do Sul") e o cadastro existente em CAIXA
 * ALTA ("CAMPUS ROSÁRIO DO SUL"), então a comparação normaliza para maiúsculas antes de
 * casar. Câmpus que não existirem ainda (expansão recente demais para qualquer carga
 * anterior) são criados agora, com `anoCriacao` tirado do ano da portaria.
 */

export interface CampusExpansao {
  siglaInstituicao: string;
  nomeCampus: string;
  portaria: string;
  valor: number;
}

/** Instituição e câmpus sem acento, caixa alta e só letras e números, para casar nomes escritos de jeitos diferentes. */
function normalizar(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** Lê o CSV da lista do piso (colunas instituicao e campus) como um conjunto de chaves "INSTITUICAO|CAMPUS" normalizadas. */
export function lerListaPiso(csv: string): Set<string> {
  const linhas = csv.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim() !== "");
  const cab =linhas[0]!.split(";").map((c) => c.trim().toLowerCase());
  const iInst = cab.indexOf("instituicao");
  const iCampus = cab.indexOf("campus");
  if (iInst < 0 || iCampus < 0) throw new Error("O CSV da lista do piso precisa das colunas instituicao e campus.");
  const chaves = new Set<string>();
  for (const l of linhas.slice(1)) {
    const c = l.split(";");
    chaves.add(`${normalizar(c[iInst] ?? "")}|${normalizar(c[iCampus] ?? "")}`);
  }
  return chaves;
}

export interface ResultadoExpansaoPiso {
  /** Câmpus da lista da aba EXPANSÃO que não recebem o piso neste ciclo (fora da lista do MDO, ou criados no próprio ano do ciclo). */
  foraDoPiso: number;
  total: number;
  jaExistiam: number;
  criados: number;
  avisos: string[];
}

const COL = { instituicao: 3, sigla: 4, campus: 5, portaria: 6, valor: 7 } as const;

function texto(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

function numero(v: unknown): number | null {
  if (typeof v === "number") return v;
  if (v && typeof v === "object" && "result" in v) return numero((v as { result: unknown }).result);
  return null;
}

/** Ano de criação do câmpus, a partir do número da portaria ("591/2026" → 2026). */
function anoDaPortaria(portaria: string): number | null {
  const m = portaria.match(/(\d{4})\s*$/);
  return m ? Number(m[1]) : null;
}

export async function carregarExpansaoPiso(ano: number): Promise<ResultadoExpansaoPiso | null> {
  const caminho = planilhaPropostaOficial(ano);
  if (!existe(caminho)) return null;

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(caminho);
  const aba = wb.getWorksheet("EXPANSÃO");
  if (!aba) return null;

  const linhas: CampusExpansao[] = [];
  aba.eachRow((linha, numeroLinha) => {
    if (numeroLinha < 4) return; // linhas 1-3 são título/cabeçalho
    const siglaInstituicao = texto(linha.getCell(COL.sigla).value);
    const nomeCampus = texto(linha.getCell(COL.campus).value);
    const portaria = texto(linha.getCell(COL.portaria).value);
    const valor = numero(linha.getCell(COL.valor).value);
    if (!siglaInstituicao || !nomeCampus || valor === null) return;
    linhas.push({ siglaInstituicao, nomeCampus, portaria: portaria ?? "", valor });
  });

  const avisos: string[] = [];
  let jaExistiam = 0;
  let criados = 0;

  const fonte = await prisma.fonteDados.create({
    data: {
      origem: "MDO_IFTM",
      fase: "F5_PROPOSTA",
      cicloOrcamento: ano,
      arquivo: `Matriz Distribuição Orçamentária ${ano}.xlsx (aba EXPANSÃO)`,
      abrangencia: "REDE",
      ressalva:
        "Lista fixa de câmpus criados por portaria recente, cada um já no Piso Mínimo (R$ 700.000), " +
        "recuperada da aba EXPANSÃO porque a matrícula por câmpus desta exportação saiu zerada (ver " +
        "ressalva da carga principal deste ciclo) e sem matrícula não dá para calcular o Funcionamento " +
        "normalmente. Aqui não precisa: o valor final destes câmpus é o piso, não depende do cálculo.",
    },
  });

  // Quem recebe o piso, em ordem de confiança: (1) a lista que a 5ª fase ONLINE do MDO mostra (CSV baixado à mão); (2) sem ela, só os câmpus
  // criados ANTES do ciclo (um câmpus criado por portaria no próprio ano do ciclo ainda não estava na matriz: em 2026 o MDO mostra os 43 criados
  // em 2026 sem valor nenhum). A aba EXPANSÃO lista mais câmpus do que o MDO paga.
  const caminhoLista = listaPisoMdoCsv(ano);
  const lista = caminhoLista ? lerListaPiso(fs.readFileSync(caminhoLista, "utf8")) : null;
  let foraDoPiso = 0;

  for (const linha of linhas) {
    if (lista) {
      if (!lista.has(`${normalizar(linha.siglaInstituicao)}|${normalizar(linha.nomeCampus)}`)) {
        foraDoPiso++;
        continue;
      }
    } else {
      const criadoEm = anoDaPortaria(linha.portaria);
      if (criadoEm !== null && criadoEm >= ano) {
        foraDoPiso++;
        continue;
      }
    }
    const instituicao = await prisma.instituicao.findUnique({ where: { sigla: linha.siglaInstituicao } });
    if (!instituicao) {
      avisos.push(`Instituição "${linha.siglaInstituicao}" não encontrada; câmpus "${linha.nomeCampus}" ignorado.`);
      continue;
    }

    const nomeNormalizado = nomeCanonicoDaUnidade(linha.nomeCampus).toUpperCase();
    const unidades = await prisma.unidade.findMany({ where: { instituicaoId: instituicao.id } });
    let unidade = unidades.find((u) => u.nome.toUpperCase() === nomeNormalizado);

    if (unidade) {
      jaExistiam++;
    } else {
      const anoCriacao = anoDaPortaria(linha.portaria);
      unidade = await prisma.unidade.create({
        data: {
          instituicaoId: instituicao.id,
          nome: nomeNormalizado,
          tipo: "CAMPUS",
          anoCriacao,
        },
      });
      criados++;
      avisos.push(`Câmpus novo cadastrado: "${nomeNormalizado}" (${linha.siglaInstituicao}), portaria ${linha.portaria}.`);
    }

    await prisma.distribuicaoCampus.upsert({
      where: { ano_unidadeId: { ano, unidadeId: unidade.id } },
      create: {
        ano,
        unidadeId: unidade.id,
        fonteDadosId: fonte.id,
        elegivelPiso: true,
        vlMatrFinal: linha.valor,
      },
      update: {
        fonteDadosId: fonte.id,
        elegivelPiso: true,
        vlMatrFinal: linha.valor,
      },
    });
  }

  if (foraDoPiso > 0) {
    avisos.push(
      `${foraDoPiso} câmpus da aba EXPANSÃO ficaram sem o piso: ${
        lista ? "não constam na lista do piso da 5ª fase online do MDO" : "foram criados no próprio ano do ciclo, quando a matriz já estava montada"
      }.`,
    );
  }
  return { foraDoPiso, total: linhas.length, jaExistiam, criados, avisos };
}
