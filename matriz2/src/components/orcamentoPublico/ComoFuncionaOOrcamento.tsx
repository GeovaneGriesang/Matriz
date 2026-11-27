/**
 * A explicação do ciclo do orçamento público, para quem nunca leu uma lei orçamentária: as três leis (PPA, LDO e LOA) e as fases
 * da despesa (dotação, empenho, liquidação e pagamento). Vale para a União, o Estado e o município, que seguem as mesmas regras.
 */
export function ComoFuncionaOOrcamento({ quem, poderLegislativo, prazos }: { quem: string; poderLegislativo: string; prazos: string }) {
  const leis = [
    { sigla: "PPA", nome: "Plano Plurianual", texto: "O plano de quatro anos: os programas de governo e as metas de cada um. Vale do segundo ano de um mandato ao primeiro do seguinte." },
    { sigla: "LDO", nome: "Lei de Diretrizes Orçamentárias", texto: "As regras do orçamento do ano seguinte: prioridades, metas fiscais, riscos e, no município, o valor das emendas impositivas dos vereadores." },
    { sigla: "LOA", nome: "Lei Orçamentária Anual", texto: "O orçamento do ano: quanto se espera arrecadar (receita estimada) e quanto se pode gastar em cada área (despesa fixada). Enquanto tramita, chama-se projeto (PLOA)." },
  ];
  const fases = [
    { nome: "Dotação inicial", texto: "o que a LOA autorizou gastar" },
    { nome: "Dotação atualizada", texto: "a dotação com os créditos abertos durante o ano (mais ou menos dinheiro numa área)" },
    { nome: "Empenhado", texto: "o dinheiro reservado para uma compra, obra ou folha já contratada" },
    { nome: "Liquidado", texto: "o serviço foi prestado ou o bem entregue, e a conferência foi feita" },
    { nome: "Pago", texto: "o dinheiro saiu do caixa" },
  ];
  return (
    <details className="rounded-lg border border-if-green/40 bg-if-green/5 p-4 text-sm" open>
      <summary className="cursor-pointer font-semibold text-neutral-900 dark:text-neutral-100">Como o orçamento público funciona (leia antes dos números)</summary>
      <div className="mt-3 flex flex-col gap-3 text-neutral-700 dark:text-neutral-300">
        <p>
          {quem} tem três leis de orçamento, todas propostas pelo Executivo e votadas {poderLegislativo}. {prazos}
        </p>
        <div className="grid gap-3 md:grid-cols-3">
          {leis.map((l) => (
            <div key={l.sigla} className="rounded-md border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-950">
              <div className="font-semibold text-if-green">
                {l.sigla} <span className="font-normal text-neutral-600 dark:text-neutral-400">{l.nome}</span>
              </div>
              <p className="mt-1">{l.texto}</p>
            </div>
          ))}
        </div>
        <p>
          <strong>As fases da despesa.</strong> Cada real passa por cinco passos, e é por eles que se acompanha o ano:
        </p>
        <ol className="flex flex-wrap items-stretch gap-2">
          {fases.map((f, i) => (
            <li key={f.nome} className="flex items-center gap-2">
              <span className="rounded-md border border-neutral-200 bg-white px-3 py-2 dark:border-neutral-800 dark:bg-neutral-950">
                <span className="mr-1 font-mono text-xs text-neutral-500">{i + 1}</span>
                <strong>{f.nome}</strong>: {f.texto}
              </span>
              {i < fases.length - 1 && <span aria-hidden className="text-neutral-400">→</span>}
            </li>
          ))}
        </ol>
        <p>
          <strong>Função</strong> é a área de governo (educação, saúde, segurança...), igual em todo o país, o que permite comparar o Estado com o município.{" "}
          <strong>Subfunção</strong> é a parte dentro da área (ensino fundamental, atenção básica...). Os números desta tela deixam de fora as despesas{" "}
          <em>intraorçamentárias</em>, que são pagamentos de um órgão a outro do mesmo governo e contariam duas vezes. Os valores são nominais, sem correção pela
          inflação.
        </p>
      </div>
    </details>
  );
}
