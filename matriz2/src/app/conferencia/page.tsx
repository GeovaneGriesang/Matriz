import Link from "next/link";
import { prisma } from "@/server/db/prisma";
import { TABLE_MAX_WIDTH } from "@/lib/layoutWidths";
import { requireAcessoPlenoOrRedirect } from "@/server/auth/session";
import {
  anosComFaixaIeaDisponivel,
  calcularIea,
  faixaIea,
  faixaRap,
  pesoIea,
  pesoIaplFormacaoProfessores,
  pesoIaplProeja,
  pesoIaplTecnicos,
  pesoRap,
} from "@/lib/qualidadeEficiencia";
import { ConferenciaTabela, type InstituicaoConferida } from "./ConferenciaTabela";

export const dynamic = "force-dynamic";

interface Busca {
  ano?: string;
  instituicao?: string;
}

const reais = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const percentual = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const decimal = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function n(v: unknown): number | null {
  return v === null || v === undefined ? null : Number(v);
}

export default async function ConferenciaPage({ searchParams }: { searchParams: Promise<Busca> }) {
  await requireAcessoPlenoOrRedirect("/conferencia");
  const params = await searchParams;
  const anosComFaixa = anosComFaixaIeaDisponivel();
  const ano = Number(params.ano) || anosComFaixa[anosComFaixa.length - 1] || 2027;

  const registros = await prisma.distribuicaoInstituicao.findMany({
    where: { ano },
    include: { instituicao: { select: { sigla: true, nome: true } } },
  });

  if (registros.length === 0) {
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

  const temFaixaIea = anosComFaixa.includes(ano);

  // Cada instituição já traz, prontos da MDO, os componentes brutos (Conclusão/Evasão/
  // Retenção, RAP Presencial, %ME de cada categoria do IAPL) e o resultado final
  // (ponderado, equalizado, valor em reais). Este módulo refaz a conta com os mesmos
  // componentes brutos e compara o que dá com o que a MDO publicou; nunca o contrário.
  const linhas = registros
    .map((r) => {
      const ieaConclusao = n(r.ieaConclusao);
      const ieaEvasao = n(r.ieaEvasao);
      const ieaRetencao = n(r.ieaRetencao);
      const rapPresencial = n(r.rapPresencial);
      const aplTecnico = n(r.aplTecnico);
      const aplFormacaoProfessor = n(r.aplFormacaoProfessor);
      const aplProeja = n(r.aplProeja);
      if (
        ieaConclusao === null || ieaEvasao === null || ieaRetencao === null ||
        rapPresencial === null || aplTecnico === null || aplFormacaoProfessor === null || aplProeja === null
      ) {
        return null;
      }

      const ieaRecalc = temFaixaIea ? calcularIea(ieaConclusao, ieaEvasao, ieaRetencao) : null;
      const faixaIeaRecalc = ieaRecalc !== null ? faixaIea(ieaRecalc, ano) : null;
      const ieaPonderadoRecalc = ieaRecalc !== null && faixaIeaRecalc ? ieaRecalc * pesoIea(faixaIeaRecalc) : null;

      const faixaRapRecalc = faixaRap(rapPresencial);
      const rapPonderadoRecalc = rapPresencial * pesoRap(faixaRapRecalc);

      const iaplTecnicoPonderadoRecalc = aplTecnico * pesoIaplTecnicos(aplTecnico);
      const iaplFormacaoPonderadoRecalc = aplFormacaoProfessor * pesoIaplFormacaoProfessores(aplFormacaoProfessor);
      const iaplProejaPonderadoRecalc = aplProeja * pesoIaplProeja(aplProeja);

      return {
        sigla: r.instituicao.sigla,
        nome: r.instituicao.nome,
        ieaConclusao, ieaEvasao, ieaRetencao,
        ieaOficial: n(r.ieaEficiencia),
        ieaRecalc,
        ieaPonderadoOficial: n(r.ieaPonderado),
        ieaPonderadoRecalc,
        ieaEqualizadoOficial: n(r.ieaEqualizado),
        vlIeaOficial: n(r.vlIea) ?? 0,
        rapPresencial,
        rapPonderadoOficial: n(r.rapPonderado),
        rapPonderadoRecalc,
        rapEqualizadoOficial: n(r.rapEqualizado),
        vlRapOficial: n(r.vlRap) ?? 0,
        aplTecnico, aplFormacaoProfessor, aplProeja,
        aplTecnicoPonderadoOficial: n(r.aplTecnicoPonderado),
        iaplTecnicoPonderadoRecalc,
        formacaoPonderadoOficial: n(r.ialPonderado),
        iaplFormacaoPonderadoRecalc,
        aplProejaPonderadoOficial: n(r.aplProejaPonderado),
        iaplProejaPonderadoRecalc,
        iaplEqualizadoOficial: n(r.ialEqualizado),
        vlIaplOficial: n(r.vlIapl) ?? 0,
      };
    })
    .filter((l): l is NonNullable<typeof l> => l !== null);

  // Denominadores de rede para reconstruir o "equalizado" (fatia de cada instituição no
  // total do bloco) a partir dos ponderados recalculados, do mesmo jeito que a MDO faz
  // a partir dos ponderados dela: soma de todas as instituições, cada uma dividida pelo
  // total. Como as fatias somam sempre 100%, a soma dos valores oficiais em reais de um
  // bloco É o valor total daquele bloco na rede; não precisamos de nenhuma fonte a mais.
  const somaIeaPonderadoRecalc = linhas.reduce((s, l) => s + (l.ieaPonderadoRecalc ?? 0), 0);
  const somaRapPonderadoRecalc = linhas.reduce((s, l) => s + l.rapPonderadoRecalc, 0);
  const somaIaplTecnicoRecalc = linhas.reduce((s, l) => s + l.iaplTecnicoPonderadoRecalc, 0);
  const somaIaplFormacaoRecalc = linhas.reduce((s, l) => s + l.iaplFormacaoPonderadoRecalc, 0);
  const somaIaplProejaRecalc = linhas.reduce((s, l) => s + l.iaplProejaPonderadoRecalc, 0);
  const totalBlocoIea = linhas.reduce((s, l) => s + l.vlIeaOficial, 0);
  const totalBlocoRap = linhas.reduce((s, l) => s + l.vlRapOficial, 0);
  const totalBlocoIapl = linhas.reduce((s, l) => s + l.vlIaplOficial, 0);

  const conferidas: InstituicaoConferida[] = linhas.map((l) => {
    const ieaEqualizadoRecalc =
      l.ieaPonderadoRecalc !== null && somaIeaPonderadoRecalc > 0 ? l.ieaPonderadoRecalc / somaIeaPonderadoRecalc : null;
    const rapEqualizadoRecalc = somaRapPonderadoRecalc > 0 ? l.rapPonderadoRecalc / somaRapPonderadoRecalc : null;
    const iaplEqualizadoRecalc =
      somaIaplTecnicoRecalc > 0 && somaIaplFormacaoRecalc > 0 && somaIaplProejaRecalc > 0
        ? (l.iaplTecnicoPonderadoRecalc / somaIaplTecnicoRecalc) * 0.7 +
          (l.iaplFormacaoPonderadoRecalc / somaIaplFormacaoRecalc) * 0.2 +
          (l.iaplProejaPonderadoRecalc / somaIaplProejaRecalc) * 0.1
        : null;

    const vlIeaRecalc = ieaEqualizadoRecalc !== null ? ieaEqualizadoRecalc * totalBlocoIea : null;
    const vlRapRecalc = rapEqualizadoRecalc !== null ? rapEqualizadoRecalc * totalBlocoRap : null;
    const vlIaplRecalc = iaplEqualizadoRecalc !== null ? iaplEqualizadoRecalc * totalBlocoIapl : null;

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
    };
  });
  conferidas.sort((a, b) => Math.abs(b.diferenca ?? 0) - Math.abs(a.diferenca ?? 0));

  if (params.instituicao) {
    const detalheBruto = linhas.find((l) => l.sigla === params.instituicao);
    if (detalheBruto) {
      const conferida = conferidas.find((c) => c.sigla === params.instituicao)!;

      const ieaEqualizadoRecalc =
        detalheBruto.ieaPonderadoRecalc !== null && somaIeaPonderadoRecalc > 0
          ? detalheBruto.ieaPonderadoRecalc / somaIeaPonderadoRecalc
          : null;
      const rapEqualizadoRecalc =
        somaRapPonderadoRecalc > 0 ? detalheBruto.rapPonderadoRecalc / somaRapPonderadoRecalc : null;
      const iaplEqualizadoRecalc =
        somaIaplTecnicoRecalc > 0 && somaIaplFormacaoRecalc > 0 && somaIaplProejaRecalc > 0
          ? (detalheBruto.iaplTecnicoPonderadoRecalc / somaIaplTecnicoRecalc) * 0.7 +
            (detalheBruto.iaplFormacaoPonderadoRecalc / somaIaplFormacaoRecalc) * 0.2 +
            (detalheBruto.iaplProejaPonderadoRecalc / somaIaplProejaRecalc) * 0.1
          : null;

      return (
        <main className={`mx-auto flex ${TABLE_MAX_WIDTH} flex-col gap-6 px-6 py-12 lg:px-12`}>
          <div className="flex flex-col gap-2">
            <Link href={`/conferencia?ano=${ano}`} className="text-sm text-neutral-500 underline hover:text-neutral-800 dark:hover:text-neutral-200">
              ← todas as instituições
            </Link>
            <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">
              Conferência, {detalheBruto.nome}, {ano}
            </h1>
            <p className="max-w-3xl text-neutral-600 dark:text-neutral-400">
              Refaz o cálculo dos blocos IEA, RAP e IAPL a partir dos mesmos componentes que a MDO já
              publica (Conclusão, Evasão e Retenção do ciclo; RAP Presencial; %ME de cada categoria do
              IAPL), e compara com o que a MDO calculou. Veja a explicação das fórmulas em{" "}
              <Link href="/como-funciona" className="underline">
                Como funciona
              </Link>
              .
            </p>
          </div>

          <BlocoConferencia
            titulo="IEA, Índice de Eficiência Acadêmica"
            linhas={[
              { rotulo: "Conclusão do ciclo", oficial: percentual.format(detalheBruto.ieaConclusao * 100) + "%" },
              { rotulo: "Evasão do ciclo", oficial: percentual.format(detalheBruto.ieaEvasao * 100) + "%" },
              { rotulo: "Retenção do ciclo", oficial: percentual.format(detalheBruto.ieaRetencao * 100) + "%" },
              {
                rotulo: "IEA (Conclusão + Retenção × Conclusão/(Conclusão+Evasão))",
                oficial: detalheBruto.ieaOficial !== null ? percentual.format(detalheBruto.ieaOficial * 100) + "%" : "não informado",
                recalculado: detalheBruto.ieaRecalc !== null ? percentual.format(detalheBruto.ieaRecalc * 100) + "%" : "não informado",
              },
              {
                rotulo: "IEA ponderado (× peso da faixa)",
                oficial: detalheBruto.ieaPonderadoOficial !== null ? decimal.format(detalheBruto.ieaPonderadoOficial) : "não informado",
                recalculado: detalheBruto.ieaPonderadoRecalc !== null ? decimal.format(detalheBruto.ieaPonderadoRecalc) : "não informado",
              },
              {
                rotulo: "IEA equalizado (fatia na rede)",
                oficial: detalheBruto.ieaEqualizadoOficial !== null ? percentual.format(detalheBruto.ieaEqualizadoOficial * 100) + "%" : "não informado",
                recalculado: ieaEqualizadoRecalc !== null ? percentual.format(ieaEqualizadoRecalc * 100) + "%" : "não informado",
              },
              { rotulo: "Valor recebido (bloco IEA)", oficial: reais.format(detalheBruto.vlIeaOficial) },
            ]}
          />

          <BlocoConferencia
            titulo="RAP, Relação Aluno-Professor Presencial"
            linhas={[
              { rotulo: "RAP Presencial (alunos por professor)", oficial: decimal.format(detalheBruto.rapPresencial) },
              {
                rotulo: "RAP ponderado (× peso da faixa)",
                oficial: detalheBruto.rapPonderadoOficial !== null ? decimal.format(detalheBruto.rapPonderadoOficial) : "não informado",
                recalculado: decimal.format(detalheBruto.rapPonderadoRecalc),
              },
              {
                rotulo: "RAP equalizado (fatia na rede)",
                oficial: detalheBruto.rapEqualizadoOficial !== null ? percentual.format(detalheBruto.rapEqualizadoOficial * 100) + "%" : "não informado",
                recalculado: rapEqualizadoRecalc !== null ? percentual.format(rapEqualizadoRecalc * 100) + "%" : "não informado",
              },
              { rotulo: "Valor recebido (bloco RAP)", oficial: reais.format(detalheBruto.vlRapOficial) },
            ]}
          />

          <BlocoConferencia
            titulo="IAPL, Atendimento a Percentuais Legais"
            linhas={[
              {
                rotulo: "%ME Cursos Técnicos",
                oficial: percentual.format(detalheBruto.aplTecnico * 100) + "%",
                recalculado: `ponderado: ${decimal.format(detalheBruto.iaplTecnicoPonderadoRecalc)}`,
              },
              {
                rotulo: "%ME Formação de Professores",
                oficial: percentual.format(detalheBruto.aplFormacaoProfessor * 100) + "%",
                recalculado: `ponderado: ${decimal.format(detalheBruto.iaplFormacaoPonderadoRecalc)}`,
              },
              {
                rotulo: "%ME Proeja",
                oficial: percentual.format(detalheBruto.aplProeja * 100) + "%",
                recalculado: `ponderado: ${decimal.format(detalheBruto.iaplProejaPonderadoRecalc)}`,
              },
              {
                rotulo: "IAPL equalizado (0,7×Técnicos + 0,2×Formação + 0,1×Proeja, cada um normalizado pela rede)",
                oficial: detalheBruto.iaplEqualizadoOficial !== null ? percentual.format(detalheBruto.iaplEqualizadoOficial * 100) + "%" : "não informado",
                recalculado: iaplEqualizadoRecalc !== null ? percentual.format(iaplEqualizadoRecalc * 100) + "%" : "não informado",
              },
              { rotulo: "Valor recebido (bloco IAPL)", oficial: reais.format(detalheBruto.vlIaplOficial) },
            ]}
          />

          <div className="rounded-lg border border-if-green/40 bg-if-green/5 p-4">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-neutral-900 dark:text-neutral-100">
                Total Qualidade e Eficiência (IEA + RAP + IAPL)
              </span>
              <span className="tabular-nums">
                oficial {reais.format(conferida.valorOficial)}
                {conferida.valorRecalc !== null && (
                  <>
                    {" "}, recalculado {reais.format(conferida.valorRecalc)}, diferença{" "}
                    <strong className={Math.abs(conferida.diferenca ?? 0) > 1 ? "text-if-red" : "text-if-green"}>
                      {reais.format(conferida.diferenca ?? 0)}
                    </strong>
                  </>
                )}
              </span>
            </div>
          </div>
        </main>
      );
    }
  }

  return (
    <main className={`mx-auto flex ${TABLE_MAX_WIDTH} flex-col gap-6 px-6 py-12 lg:px-12`}>
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">Conferência de cálculo</h1>
        <p className="max-w-3xl text-neutral-600 dark:text-neutral-400">
          Refaz o cálculo dos blocos IEA, RAP e IAPL de Qualidade e Eficiência a partir dos mesmos
          componentes que a MDO já publica por instituição, e compara com o valor que a MDO calculou.
          Serve para auditoria: se a diferença for grande, ou a fórmula usada aqui está desatualizada,
          ou algo mudou na metodologia que ainda não foi conferido. O Matriz2 nunca usa este
          recálculo para decidir quanto uma instituição recebe, só para conferir.
        </p>
        {!temFaixaIea && (
          <p className="max-w-3xl rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
            Não há tabela de faixas de IEA cadastrada para {ano} (as faixas mudam a cada ciclo, porque
            são relativas à média da rede daquele ano). O IEA fica sem conferência neste ciclo; RAP e
            IAPL usam faixas fixas e continuam conferidos normalmente.
          </p>
        )}
      </div>

      <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
        <ConferenciaTabela linhas={conferidas} ano={ano} />
      </div>
    </main>
  );
}

function BlocoConferencia({
  titulo,
  linhas,
}: {
  titulo: string;
  linhas: { rotulo: string; oficial: string; recalculado?: string }[];
}) {
  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">{titulo}</h2>
      <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-left dark:bg-neutral-900">
            <tr>
              <th className="px-4 py-2.5 font-medium text-neutral-600 dark:text-neutral-400">Componente</th>
              <th className="px-4 py-2.5 text-right font-medium text-neutral-600 dark:text-neutral-400">Oficial (MDO)</th>
              <th className="px-4 py-2.5 text-right font-medium text-neutral-600 dark:text-neutral-400">Recalculado</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((l) => (
              <tr key={l.rotulo} className="border-t border-neutral-200 dark:border-neutral-800">
                <td className="px-4 py-2.5 text-neutral-600 dark:text-neutral-400">{l.rotulo}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{l.oficial}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{l.recalculado ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
