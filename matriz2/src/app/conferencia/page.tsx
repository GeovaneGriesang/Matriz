import Link from "next/link";
import { TABLE_MAX_WIDTH } from "@/lib/layoutWidths";
import { requireAcessoPlenoOrRedirect } from "@/server/auth/session";
import {
  calcularQualidadeEficienciaRede,
  iaplEqualizadoRecalc,
  ieaEqualizadoRecalc,
  rapEqualizadoRecalc,
} from "@/server/queries/qualidadeEficienciaRede";
import { ConferenciaTabela, type InstituicaoConferida } from "./ConferenciaTabela";

export const dynamic = "force-dynamic";

interface Busca {
  ano?: string;
  instituicao?: string;
}

const reais = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const percentual = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const decimal = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

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

  const conferidas: InstituicaoConferida[] = linhas.map((l) => {
    const ieaEq = ieaEqualizadoRecalc(rede, l.ieaPonderadoRecalc);
    const rapEq = rapEqualizadoRecalc(rede, l.rapPonderadoRecalc);
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
    };
  });
  conferidas.sort((a, b) => Math.abs(b.diferenca ?? 0) - Math.abs(a.diferenca ?? 0));

  if (params.instituicao) {
    const detalheBruto = linhas.find((l) => l.sigla === params.instituicao);
    if (detalheBruto) {
      const conferida = conferidas.find((c) => c.sigla === params.instituicao)!;

      const ieaEqRecalc = ieaEqualizadoRecalc(rede, detalheBruto.ieaPonderadoRecalc);
      const rapEqRecalc = rapEqualizadoRecalc(rede, detalheBruto.rapPonderadoRecalc);
      const iaplEqRecalc = iaplEqualizadoRecalc(
        rede,
        detalheBruto.iaplTecnicoPonderadoRecalc,
        detalheBruto.iaplFormacaoPonderadoRecalc,
        detalheBruto.iaplProejaPonderadoRecalc,
      );

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
              IAPL), e compara com o que a MDO calculou. Veja o que cada indicador significa em{" "}
              <Link href="/como-funciona#qualidade-eficiencia" className="underline">
                Qualidade e Eficiência
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
                recalculado: ieaEqRecalc !== null ? percentual.format(ieaEqRecalc * 100) + "%" : "não informado",
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
                recalculado: rapEqRecalc !== null ? percentual.format(rapEqRecalc * 100) + "%" : "não informado",
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
                recalculado: iaplEqRecalc !== null ? percentual.format(iaplEqRecalc * 100) + "%" : "não informado",
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
          Refaz o cálculo dos blocos{" "}
          <Link href="/como-funciona#qualidade-eficiencia" className="underline">
            IEA, RAP e IAPL de Qualidade e Eficiência
          </Link>{" "}
          a partir dos mesmos componentes que a MDO já publica por instituição, e compara com o valor
          que a MDO calculou. Serve para auditoria: se a diferença for grande, ou a fórmula usada aqui
          está desatualizada, ou algo mudou na metodologia que ainda não foi conferido. Este recálculo
          nunca decide quanto uma instituição recebe, só serve para conferir.
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
