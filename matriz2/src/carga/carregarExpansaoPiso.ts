import ExcelJS from "exceljs";
import { prisma } from "@/server/db/prisma";
import { existe, planilhaPropostaOficial } from "./caminhos";

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

export interface ResultadoExpansaoPiso {
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

  for (const linha of linhas) {
    const instituicao = await prisma.instituicao.findUnique({ where: { sigla: linha.siglaInstituicao } });
    if (!instituicao) {
      avisos.push(`Instituição "${linha.siglaInstituicao}" não encontrada; câmpus "${linha.nomeCampus}" ignorado.`);
      continue;
    }

    const nomeNormalizado = linha.nomeCampus.toUpperCase();
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

  return { total: linhas.length, jaExistiam, criados, avisos };
}
