import type { LinhaDoBalanco, ResumoDoAno } from "@/server/queries/orcamentoPublico";

const reais = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const milhoes = (v: number) => (Math.abs(v) >= 1e9 ? `R$ ${(v / 1e9).toFixed(2).replace(".", ",")} bi` : `R$ ${(v / 1e6).toFixed(1).replace(".", ",")} mi`);
const pct = (parte: number, todo: number) => (todo > 0 ? `${((parte / todo) * 100).toFixed(1).replace(".", ",")}%` : "-");
const td = "whitespace-nowrap px-2 py-1.5 text-right tabular-nums";
const th = "whitespace-nowrap px-2 py-1.5 text-right font-medium";

/**
 * Ano a ano: o que entrou (receita arrecadada), o que se gastou (despesa empenhada e liquidada), o resultado e a parte da educação e
 * da saúde. A barra mostra o tamanho da despesa de cada ano em relação ao maior da série.
 */
export function SerieAnual({ serie }: { serie: ResumoDoAno[] }) {
  const maior = Math.max(...serie.map((r) => r.despesa.empenhado), 1);
  return (
    <div className="tabela-rolavel rounded-lg border border-neutral-200 dark:border-neutral-800">
      <table className="min-w-full text-sm">
        <thead className="bg-neutral-50 text-xs text-neutral-600 dark:bg-neutral-900 dark:text-neutral-400">
          <tr>
            <th className="px-2 py-1.5 text-left font-medium">Ano</th>
            <th className={th}>Receita arrecadada</th>
            <th className={th}>Despesa empenhada</th>
            <th className="px-2 py-1.5 text-left font-medium">Tamanho</th>
            <th className={th} title="Receita arrecadada menos despesa empenhada">
              Resultado
            </th>
            <th className={th}>Educação (empenhado)</th>
            <th className={th}>Parte da educação</th>
            <th className={th}>Saúde (empenhado)</th>
            <th className={th}>Parte da saúde</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
          {serie.map((r) => {
            const resultado = r.receita.realizado - r.despesa.empenhado;
            return (
              <tr key={r.exercicio} title={r.fonte}>
                <td className="whitespace-nowrap px-2 py-1.5">
                  {r.exercicio}
                  {r.periodo < 6 && <span className="ml-1 text-xs text-amber-700 dark:text-amber-400">(até o {r.periodo}º bimestre)</span>}
                </td>
                <td className={td}>{milhoes(r.receita.realizado)}</td>
                <td className={td}>{milhoes(r.despesa.empenhado)}</td>
                <td className="px-2 py-1.5">
                  <div className="h-2 w-32 rounded bg-neutral-100 dark:bg-neutral-800">
                    <div className={`h-2 rounded ${r.periodo < 6 ? "bg-amber-400" : "bg-if-green"}`} style={{ width: `${(r.despesa.empenhado / maior) * 100}%` }} />
                  </div>
                </td>
                <td className={`${td} ${resultado < 0 ? "text-if-red dark:text-red-400" : "text-if-green"}`}>{milhoes(resultado)}</td>
                <td className={td}>{milhoes(r.educacao.empenhado)}</td>
                <td className={td}>{pct(r.educacao.empenhado, r.despesa.empenhado)}</td>
                <td className={td}>{milhoes(r.saude.empenhado)}</td>
                <td className={td}>{pct(r.saude.empenhado, r.despesa.empenhado)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const RECEITAS: { cod: string; nome: string; nota?: string }[] = [
  { cod: "ReceitaTributaria", nome: "Impostos, taxas e contribuição de melhoria", nota: "o que o próprio governo cobra (ICMS e IPVA no Estado; IPTU, ISS e ITBI no município)" },
  { cod: "ReceitaDeContribuicoes", nome: "Contribuições", nota: "a contribuição previdenciária dos servidores e a da iluminação pública" },
  { cod: "ReceitaPatrimonial", nome: "Receita patrimonial", nota: "rendimento de aplicações, aluguéis e concessões" },
  { cod: "ReceitaDeServicos", nome: "Receita de serviços" },
  { cod: "TransferenciasCorrentes", nome: "Transferências correntes", nota: "o dinheiro que vem de outros governos para o dia a dia" },
  { cod: "TransferenciasCorrentesDaUniaoEDeSuasEntidades", nome: "da União", nota: "FPM ou FPE, SUS, FNDE, FUNDEB" },
  { cod: "TransferenciasCorrentesDosEstadosEDoDistritoFederalEDeSuasEntidades", nome: "do Estado", nota: "a parte do ICMS e do IPVA que cabe ao município" },
  { cod: "TransferenciasCorrentesDosMunicipiosEDeSuasEntidades", nome: "de municípios" },
  { cod: "OutrasReceitasCorrentes", nome: "Outras receitas correntes", nota: "multas, indenizações, dívida ativa" },
  { cod: "ReceitasDeCapital", nome: "Receitas de capital", nota: "empréstimos, venda de bens e transferências para obras" },
];
const DESPESAS: { cod: string; nome: string; nota?: string; sub?: boolean }[] = [
  { cod: "PessoalEEncargosSociais", nome: "Pessoal e encargos sociais", nota: "salários, aposentadorias e contribuições" },
  { cod: "JurosEEncargosDaDivida", nome: "Juros e encargos da dívida" },
  { cod: "OutrasDespesasCorrentes", nome: "Outras despesas correntes", nota: "custeio: materiais, serviços, contratos, repasses e auxílios" },
  { cod: "Investimentos", nome: "Investimentos", nota: "obras e equipamentos" },
  { cod: "InversoesFinanceiras", nome: "Inversões financeiras", nota: "compra de imóveis, empréstimos concedidos, capital em empresas" },
  { cod: "AmortizacaoDaDivida", nome: "Amortização da dívida", nota: "o pagamento do principal dos empréstimos" },
  { cod: "ReservaDeContingencia", nome: "Reserva de contingência", nota: "reservada para imprevistos; quando usada, aparece no grupo em que foi gasta" },
];

/** De onde vem o dinheiro (receita por origem) e no que ele é gasto (despesa por grupo), no ano. */
export function BalancoDoAno({ balanco }: { balanco: Map<string, LinhaDoBalanco> }) {
  const totalReceita = balanco.get("ReceitasExcetoIntraOrcamentarias")?.receita;
  const totalDespesa = balanco.get("DespesasExcetoIntraOrcamentarias")?.despesa;
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <div className="tabela-rolavel rounded-lg border border-neutral-200 dark:border-neutral-800">
        <table className="min-w-full text-sm">
          <thead className="bg-neutral-50 text-xs text-neutral-600 dark:bg-neutral-900 dark:text-neutral-400">
            <tr>
              <th className="px-2 py-1.5 text-left font-medium">De onde vem (receita)</th>
              <th className={th}>Prevista no ano</th>
              <th className={th}>Arrecadada</th>
              <th className={th}>Parte</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {RECEITAS.map((c) => {
              const r = balanco.get(c.cod)?.receita;
              if (!r || (r.realizado === 0 && r.previsaoAtualizada === 0)) return null;
              const sub = c.cod.startsWith("TransferenciasCorrentesD");
              return (
                <tr key={c.cod}>
                  <td className={`px-2 py-1.5 ${sub ? "pl-8 text-neutral-600 dark:text-neutral-400" : ""}`}>
                    {c.nome}
                    {c.nota && <span className="block text-xs text-neutral-500">{c.nota}</span>}
                  </td>
                  <td className={td}>{reais.format(r.previsaoAtualizada)}</td>
                  <td className={td}>{reais.format(r.realizado)}</td>
                  <td className={td}>{pct(r.realizado, totalReceita?.realizado ?? 0)}</td>
                </tr>
              );
            })}
          </tbody>
          {totalReceita && (
            <tfoot className="bg-neutral-50 font-medium dark:bg-neutral-900">
              <tr>
                <td className="px-2 py-1.5">Total</td>
                <td className={td}>{reais.format(totalReceita.previsaoAtualizada)}</td>
                <td className={td}>{reais.format(totalReceita.realizado)}</td>
                <td className={td}>100%</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      <div className="tabela-rolavel rounded-lg border border-neutral-200 dark:border-neutral-800">
        <table className="min-w-full text-sm">
          <thead className="bg-neutral-50 text-xs text-neutral-600 dark:bg-neutral-900 dark:text-neutral-400">
            <tr>
              <th className="px-2 py-1.5 text-left font-medium">No que se gasta (grupo de despesa)</th>
              <th className={th}>Dotação atualizada</th>
              <th className={th}>Empenhado</th>
              <th className={th}>Pago</th>
              <th className={th}>Parte</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {DESPESAS.map((c) => {
              const d = balanco.get(c.cod)?.despesa;
              if (!d || (d.dotacaoAtualizada === 0 && d.empenhado === 0)) return null;
              return (
                <tr key={c.cod}>
                  <td className="px-2 py-1.5">
                    {c.nome}
                    {c.nota && <span className="block text-xs text-neutral-500">{c.nota}</span>}
                  </td>
                  <td className={td}>{reais.format(d.dotacaoAtualizada)}</td>
                  <td className={td}>{reais.format(d.empenhado)}</td>
                  <td className={td}>{reais.format(d.pago)}</td>
                  <td className={td}>{pct(d.empenhado, totalDespesa?.empenhado ?? 0)}</td>
                </tr>
              );
            })}
          </tbody>
          {totalDespesa && (
            <tfoot className="bg-neutral-50 font-medium dark:bg-neutral-900">
              <tr>
                <td className="px-2 py-1.5">Total</td>
                <td className={td}>{reais.format(totalDespesa.dotacaoAtualizada)}</td>
                <td className={td}>{reais.format(totalDespesa.empenhado)}</td>
                <td className={td}>{reais.format(totalDespesa.pago)}</td>
                <td className={td}>100%</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}

/** Um número grande com legenda, para o topo de cada seção. */
export function Cartao({ titulo, valor, nota, destaque }: { titulo: string; valor: string; nota?: string; destaque?: "bom" | "ruim" }) {
  return (
    <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
      <div className="text-xs font-medium uppercase tracking-wide text-neutral-500">{titulo}</div>
      <div className={`mt-1 text-xl font-semibold tabular-nums ${destaque === "ruim" ? "text-if-red dark:text-red-400" : destaque === "bom" ? "text-if-green" : "text-neutral-900 dark:text-neutral-100"}`}>{valor}</div>
      {nota && <div className="mt-1 text-xs text-neutral-500">{nota}</div>}
    </div>
  );
}

export { milhoes, pct };
