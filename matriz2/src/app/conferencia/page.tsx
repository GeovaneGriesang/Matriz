import Link from "next/link";
import { TABLE_MAX_WIDTH, PROSE_LINK } from "@/lib/layoutWidths";
import { requireAcessoPlenoOrRedirect } from "@/server/auth/session";
import { prisma } from "@/server/db/prisma";
import { calcularFuncionamentoCampus, carregarTaxasFuncionamento } from "@/server/queries/funcionamentoCampus";
import type { BlocoDaConferencia } from "./ConferenciaTabela";
import {
  calcularQualidadeEficienciaRede,
  iaplEqualizadoRecalc,
  ieaEqualizadoRecalc,
  rapEqualizadoRecalc,
} from "@/server/queries/qualidadeEficienciaRede";
import { ConferenciaTabela, type InstituicaoConferida } from "./ConferenciaTabela";
import { ComoLerEstaTela } from "@/components/ComoLerEstaTela";

export const dynamic = "force-dynamic";

interface Busca {
  ano?: string;
  instituicao?: string;
}

const reais = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const percentual = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const decimal = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pct = (v: number) => `${percentual.format(v * 100)}%`;

export default async function ConferenciaPage({ searchParams }: { searchParams: Promise<Busca> }) {
  await requireAcessoPlenoOrRedirect("/conferencia");
  const params = await searchParams;
  const anoEscolhido = Number(params.ano) || 2027;

  const rede = await calcularQualidadeEficienciaRede(anoEscolhido);
  const { ano, temFaixaIea, instituicoes: linhas } = rede;

  if (linhas.length === 0) {
    return (
      <main className={`mx-auto ${TABLE_MAX_WIDTH} px-6 py-16 lg:px-12`}>
        <h1 className="text-2xl font-semibold">Conferência de cálculo</h1>
        <p className="mt-3 text-neutral-600 dark:text-neutral-400">
          Depende dos indicadores da aba &quot;INDICADORES&quot; da MDO (IEA, RAP, IAPL por instituição), que
          ainda não foram carregados para {ano}.
        </p>
      </main>
    );
  }

  // O Funcionamento de cada câmpus, refeito a partir da matrícula equalizada por modalidade e das taxas oficiais. As duas colunas devem ficar bem próximas:
  // uma diferença grande é sinal de algo errado, na fórmula ou nos dados. Sem as taxas do ano (2026 saiu sem o valor final por matrícula), fica só o gerado.
  const [taxas, campi] = await Promise.all([
    carregarTaxasFuncionamento(ano),
    prisma.distribuicaoCampus.findMany({
      where: { ano },
      select: { vlMatrFinal: true, elegivelPiso: true, mtPresencial: true, mtEad: true, mtEadMooc: true, mtEadFp: true, unidade: { select: { nome: true, instituicao: { select: { sigla: true } } } } },
      orderBy: { vlMatrFinal: "desc" },
    }),
  ]);
  const funcionamentoPorSigla = new Map<string, BlocoDaConferencia["linhas"]>();
  for (const c of campi) {
    const calculado = taxas
      ? calcularFuncionamentoCampus(taxas, { mtPresencial: Number(c.mtPresencial ?? 0), mtEad: Number(c.mtEad ?? 0), mtEadMooc: Number(c.mtEadMooc ?? 0), mtEadFp: Number(c.mtEadFp ?? 0), elegivelPiso: c.elegivelPiso })
      : null;
    if (Number(c.vlMatrFinal ?? 0) <= 0 && !calculado) continue;
    const lista = funcionamentoPorSigla.get(c.unidade.instituicao.sigla) ?? [];
    lista.push({ rotulo: c.unidade.nome, oficial: reais.format(Number(c.vlMatrFinal ?? 0)), recalculado: calculado !== null ? reais.format(calculado) : "não informado" });
    funcionamentoPorSigla.set(c.unidade.instituicao.sigla, lista);
  }

  const conferidas: InstituicaoConferida[] = linhas.map((l) => {
    const ieaEq = ieaEqualizadoRecalc(rede, l.ieaPonderadoRecalc);
    // Institução sem RAP confiável (ver `rapConfiavel`): não entra na conferência,
    // pra não fingir bater um recálculo que na verdade nem foi feito para ela.
    const rapEq = l.rapConfiavel ? rapEqualizadoRecalc(rede, l.rapPonderadoRecalc) : null;
    const iaplEq = iaplEqualizadoRecalc(
      rede,
      l.iaplTecnicoPonderadoRecalc,
      l.iaplFormacaoPonderadoRecalc,
      l.iaplProejaPonderadoRecalc,
    );

    const vlIeaRecalc = ieaEq !== null ? ieaEq * rede.totalBlocoIea : null;
    const vlRapRecalc = rapEq !== null ? rapEq * rede.totalBlocoRap : null;
    const vlIaplRecalc = iaplEq !== null ? iaplEq * rede.totalBlocoIapl : null;

    const valorOficial = l.vlIeaOficial + l.vlRapOficial + l.vlIaplOficial;
    const valorRecalc =
      vlIeaRecalc !== null && vlRapRecalc !== null && vlIaplRecalc !== null ? vlIeaRecalc + vlRapRecalc + vlIaplRecalc : null;

    return {
      sigla: l.sigla,
      nome: l.nome,
      ieaOficial: l.ieaOficial,
      ieaRecalc: l.ieaRecalc,
      rapPresencial: l.rapPresencial,
      valorOficial,
      valorRecalc,
      diferenca: valorRecalc !== null ? valorRecalc - valorOficial : null,
      funcionamento: funcionamentoPorSigla.has(l.sigla)
        ? { titulo: "Funcionamento por câmpus: o gerado pela matriz e o refeito pela Matrícula Total de cada modalidade × valor da matrícula", linhas: funcionamentoPorSigla.get(l.sigla)! }
        : null,
      blocos: [
        {
          titulo: "IEA, Índice de Eficiência Acadêmica",
          linhas: [
            { rotulo: "Conclusão do ciclo", oficial: pct(l.ieaConclusao) },
            { rotulo: "Evasão do ciclo", oficial: pct(l.ieaEvasao) },
            { rotulo: "Retenção do ciclo", oficial: pct(l.ieaRetencao) },
            {
              rotulo: "IEA (Conclusão + Retenção × Conclusão/(Conclusão+Evasão))",
              oficial: l.ieaOficial !== null ? pct(l.ieaOficial) : "não informado",
              recalculado: l.ieaRecalc !== null ? pct(l.ieaRecalc) : "não informado",
            },
            {
              rotulo: "IEA ponderado (× peso da faixa)",
              oficial: l.ieaPonderadoOficial !== null ? decimal.format(l.ieaPonderadoOficial) : "não informado",
              recalculado: l.ieaPonderadoRecalc !== null ? decimal.format(l.ieaPonderadoRecalc) : "não informado",
            },
            {
              rotulo: "IEA equalizado (fatia na rede)",
              oficial: l.ieaEqualizadoOficial !== null ? pct(l.ieaEqualizadoOficial) : "não informado",
              recalculado: ieaEq !== null ? pct(ieaEq) : "não informado",
            },
            { rotulo: "Valor recebido (bloco IEA)", oficial: reais.format(l.vlIeaOficial) },
          ],
        },
        {
          titulo: "RAP, Relação Aluno-Professor Presencial",
          linhas: [
            { rotulo: "RAP Presencial (alunos por professor)", oficial: decimal.format(l.rapPresencial) },
            {
              rotulo: "RAP ponderado (× peso da faixa)",
              oficial: l.rapPonderadoOficial !== null ? decimal.format(l.rapPonderadoOficial) : "não informado",
              recalculado: l.rapConfiavel ? decimal.format(l.rapPonderadoRecalc) : "não conferido",
            },
            {
              rotulo: "RAP equalizado (fatia na rede)",
              oficial: l.rapEqualizadoOficial !== null ? pct(l.rapEqualizadoOficial) : "não informado",
              recalculado: rapEq !== null ? pct(rapEq) : "não conferido",
            },
            { rotulo: "Valor recebido (bloco RAP)", oficial: reais.format(l.vlRapOficial) },
          ],
          aviso: l.rapConfiavel
            ? undefined
            : `O RAP ponderado oficial desta instituição (${decimal.format(l.rapPonderadoOficial ?? 0)}) não bate com o que a fórmula de faixas prevê para RAP Presencial ${decimal.format(l.rapPresencial)} (${decimal.format(l.rapPonderadoRecalc)}): provavelmente esta instituição segue uma regra própria que este sistema ainda não reproduz. Por isso o RAP dela fica de fora da conferência, para não distorcer o recálculo das outras instituições também.`,
        },
        {
          titulo: "IAPL, Atendimento a Percentuais Legais",
          linhas: [
            { rotulo: "%ME Cursos Técnicos", oficial: pct(l.aplTecnico), recalculado: `ponderado: ${decimal.format(l.iaplTecnicoPonderadoRecalc)}` },
            { rotulo: "%ME Formação de Professores", oficial: pct(l.aplFormacaoProfessor), recalculado: `ponderado: ${decimal.format(l.iaplFormacaoPonderadoRecalc)}` },
            { rotulo: "%ME Proeja", oficial: pct(l.aplProeja), recalculado: `ponderado: ${decimal.format(l.iaplProejaPonderadoRecalc)}` },
            {
              rotulo: "IAPL equalizado (0,7×Técnicos + 0,2×Formação + 0,1×Proeja, cada um normalizado pela rede)",
              oficial: l.iaplEqualizadoOficial !== null ? pct(l.iaplEqualizadoOficial) : "não informado",
              recalculado: iaplEq !== null ? pct(iaplEq) : "não informado",
            },
            { rotulo: "Valor recebido (bloco IAPL)", oficial: reais.format(l.vlIaplOficial) },
          ],
        },
      ],
    };
  });
  conferidas.sort((a, b) => Math.abs(b.diferenca ?? 0) - Math.abs(a.diferenca ?? 0));
  // O exemplo da explicação: a instituição de maior diferença, a que mais vale abrir primeiro.
  const exemplo = conferidas[0]!;

  return (
    <main className={`mx-auto flex ${TABLE_MAX_WIDTH} flex-col gap-6 px-6 py-12 lg:px-12`}>
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">Conferência de cálculo</h1>
        <p className="text-neutral-600 dark:text-neutral-400">
          O sistema refaz os blocos de cada instituição e compara com o valor da MDO. Clique no <strong>+</strong> para ver a conta.
        </p>
        <ComoLerEstaTela>
          <p>
            Refaz o Funcionamento de cada câmpus e o cálculo dos blocos{" "}
            <Link href="/como-funciona#qualidade-eficiencia" className={PROSE_LINK}>
              IEA, RAP e IAPL de Qualidade e Eficiência
            </Link>{" "}
            a partir dos mesmos componentes que a MDO já publica. Serve para auditoria: se a diferença for grande, ou a fórmula usada aqui está desatualizada, ou algo mudou na metodologia que ainda não foi conferido. Este recálculo nunca decide quanto uma instituição recebe.
          </p>
          <p>
            Exemplo: a tabela começa por {exemplo.sigla},{exemplo.diferenca !== null ? ` com diferença de ${reais.format(exemplo.diferenca)}` : " que não pôde ser conferida"}; o + dela mostra de qual bloco isso vem.
          </p>
        </ComoLerEstaTela>
        {!temFaixaIea && (
          <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
            Não há tabela de faixas de IEA cadastrada para {ano} (as faixas mudam a cada ciclo, porque
            são relativas à média da rede daquele ano). O IEA fica sem conferência neste ciclo; RAP e
            IAPL usam faixas fixas e continuam conferidos normalmente.
          </p>
        )}
      </div>

      <div className="tabela-rolavel rounded-lg border border-neutral-200 dark:border-neutral-800">
        <ConferenciaTabela linhas={conferidas} abertaDeInicio={params.instituicao} />
      </div>
    </main>
  );
}
