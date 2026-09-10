export interface CicloResumoCalculo {
  ano: number;
  valorReferenciaSpo: number;
  ajuste: number;
  assistenciaTotal: number;
  funcionamentoTotal: number;
  reitoriasTotal: number;
  qualidadeEficienciaTotal: number;
}

const reais = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const percentual = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const SEGMENTOS = [
  { chave: "assistenciaTotal", rotulo: "Assistência Estudantil", cor: "bg-amber-400 dark:bg-amber-600" },
  { chave: "ajuste", rotulo: "Ajuste", cor: "bg-neutral-400 dark:bg-neutral-600" },
  { chave: "funcionamentoTotal", rotulo: "Funcionamento", cor: "bg-if-green" },
  { chave: "reitoriasTotal", rotulo: "Reitorias", cor: "bg-if-green/70" },
  { chave: "qualidadeEficienciaTotal", rotulo: "Qualidade e Eficiência", cor: "bg-if-green/40" },
] as const;

/**
 * A conta acontecendo, com números reais de pelo menos dois ciclos lado a lado
 * (pedido do usuário: "temos que enxergar o cálculo ocorrendo"). Cada barra é o
 * valor de referência de um ano, dividido nos cinco pedaços em que ele de fato se
 * torna; quando um ciclo ainda não tem os blocos homologados pela MDO (2026 no
 * momento em que isto foi escrito), a barra mostra só o que existe e o texto abaixo
 * dela explica a lacuna, em vez de fingir um "R$ 0" que não é real.
 */
export function CalculoAoVivo({ ciclos }: { ciclos: CicloResumoCalculo[] }) {
  return (
    <div className="flex flex-col gap-6">
      {ciclos.map((c) => {
        const somaBlocos = c.funcionamentoTotal + c.reitoriasTotal + c.qualidadeEficienciaTotal;
        const blocosPublicados = somaBlocos > 0;
        const restante = c.valorReferenciaSpo - c.assistenciaTotal - c.ajuste;

        return (
          <div key={c.ano} className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">Ciclo {c.ano}</span>
              <span className="text-xs tabular-nums text-neutral-500 dark:text-neutral-400">
                referência {reais.format(c.valorReferenciaSpo)}
              </span>
            </div>

            <div className="flex h-6 w-full overflow-hidden rounded-md">
              {SEGMENTOS.map((s) => {
                const valor = c[s.chave];
                if (valor <= 0) return null;
                const largura = (valor / c.valorReferenciaSpo) * 100;
                return (
                  <div
                    key={s.chave}
                    className={s.cor}
                    style={{ width: `${largura}%` }}
                    title={`${s.rotulo}: ${reais.format(valor)} (${percentual.format(largura)}% do total)`}
                  />
                );
              })}
              {!blocosPublicados && (
                <div
                  className="flex-1 bg-[repeating-linear-gradient(45deg,theme(colors.neutral.200),theme(colors.neutral.200)_6px,transparent_6px,transparent_12px)] dark:bg-[repeating-linear-gradient(45deg,theme(colors.neutral.700),theme(colors.neutral.700)_6px,transparent_6px,transparent_12px)]"
                  title="Funcionamento, Reitorias e Qualidade e Eficiência ainda não homologados pela MDO neste ciclo"
                />
              )}
            </div>

            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-3">
              {SEGMENTOS.map((s) => {
                const valor = c[s.chave];
                const semDado = !blocosPublicados && s.chave !== "assistenciaTotal" && s.chave !== "ajuste";
                return (
                  <div key={s.chave} className="flex items-center gap-1.5">
                    <span className={`h-2.5 w-2.5 shrink-0 rounded-sm ${s.cor}`} />
                    <span className="text-neutral-600 dark:text-neutral-400">{s.rotulo}:</span>
                    <span className="font-medium tabular-nums text-neutral-900 dark:text-neutral-100">
                      {semDado ? "ainda não publicado" : reais.format(valor)}
                    </span>
                  </div>
                );
              })}
            </div>

            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              {blocosPublicados ? (
                <>
                  Da referência de {reais.format(c.valorReferenciaSpo)}, tiram-se{" "}
                  {reais.format(c.assistenciaTotal)} de Assistência e {reais.format(c.ajuste)} de ajuste; sobram{" "}
                  {reais.format(restante)}, que viram 80% Funcionamento, 10% Reitorias e 10% Qualidade e
                  Eficiência.
                </>
              ) : (
                <>
                  Este ciclo já tem o valor de referência e o ajuste, mas a MDO ainda não homologou os blocos
                  Funcionamento, Reitorias e Qualidade e Eficiência aqui — por isso a barra fica sem essa parte,
                  em vez de mostrar um zero que não corresponde à realidade.
                </>
              )}
            </p>
          </div>
        );
      })}
    </div>
  );
}
