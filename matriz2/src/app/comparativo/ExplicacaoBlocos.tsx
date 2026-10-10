import Link from "next/link";
import { PROSE_LINK } from "@/lib/layoutWidths";

/** Os números de uma instituição (o IFSul) no ciclo mais recente, para a explicação usar dado real em vez de exemplo inventado. */
export interface ExemploBlocos {
  sigla: string;
  ano: number;
  funcionamento: number;
  qualidade: number;
  assistencia: number;
  total: number;
  /** Soma do Funcionamento dos câmpus (sem a Reitoria). */
  funcionamentoCampi: number;
  assistenciaCampi: number;
  quantosCampi: number;
  campus: { nome: string; funcionamento: number; assistencia: number } | null;
}

const reais = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const pct = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

const CAIXA = "rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 dark:border-neutral-800 dark:bg-neutral-900";

/**
 * O que é cada bloco do comparativo, com a fórmula e um exemplo com os números reais do IFSul. O bloco escolhido na tela abre
 * aberto; os outros ficam fechados, para não empurrar a tabela para baixo.
 */
export function ExplicacaoBlocos({ bloco, exemplo }: { bloco: string; exemplo: ExemploBlocos | null }) {
  const e = exemplo;
  const reitoria = e ? e.funcionamento - e.funcionamentoCampi : 0;
  const nomeCampus = e?.campus?.nome.replace(/^CAMPUS( AVANÇADO)? /, "") ?? "";
  const fatia = (v: number) => (e && e.total > 0 ? `${pct.format((v / e.total) * 100)}%` : "");

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-neutral-200 p-4 text-sm text-neutral-700 dark:border-neutral-800 dark:text-neutral-300">
      <h2 className="font-semibold text-neutral-900 dark:text-neutral-100">Como se forma cada bloco</h2>
      <p>
        O orçamento de cada instituição chega em três blocos, e o <strong>Total</strong> é a soma deles. A conta começa pela rede inteira: do
        valor de referência tira-se a Assistência Estudantil (ação 2994, com regra própria) e um ajuste; o que sobra é dividido em 80%
        Funcionamento dos câmpus, 10% Reitorias e 10% Qualidade e Eficiência (Portaria MEC 243/2026). A explicação completa, etapa por etapa,
        está em{" "}
        <Link href="/como-funciona" className={PROSE_LINK}>
          Como funciona
        </Link>
        .
      </p>

      <Detalhe titulo="Total" aberto={bloco === "totalSpo"}>
        <p className={CAIXA}>
          <strong>Total = Funcionamento + Qualidade e Eficiência + Assistência Estudantil</strong>
        </p>
        {e && (
          <p>
            {e.sigla} em {e.ano}: {reais.format(e.funcionamento)} + {reais.format(e.qualidade)} + {reais.format(e.assistencia)} ={" "}
            <strong>{reais.format(e.total)}</strong>. O Funcionamento é {fatia(e.funcionamento)} do total, a Qualidade e Eficiência{" "}
            {fatia(e.qualidade)} e a Assistência {fatia(e.assistencia)}.
          </p>
        )}
        <p>
          Por câmpus, o Total é o Funcionamento mais a Assistência do câmpus. A Reitoria e a Qualidade e Eficiência não são distribuídas por
          câmpus, por isso a soma dos câmpus fica abaixo do Total da instituição (a diferença aparece logo abaixo da lista de câmpus).
        </p>
      </Detalhe>

      <Detalhe titulo="Funcionamento" aberto={bloco === "matriculas"}>
        <p className={CAIXA}>
          <strong>Funcionamento do câmpus = Matrícula Total do câmpus × valor de uma matrícula</strong>, com o Piso Mínimo garantido para câmpus
          novo. A Matrícula Total soma os ciclos de curso: alunos × peso do curso × (carga horária ÷ 800) × (dias do ciclo no ano ÷ dias do
          ciclo). O valor de uma matrícula é o dinheiro do bloco dividido pela Matrícula Total da rede inteira.
        </p>
        <p className={CAIXA}>
          <strong>Funcionamento da instituição = soma dos câmpus + Reitoria</strong>. A Reitoria recebe o bloco de 10%, rateado entre as
          instituições na proporção da matrícula ponderada de cada uma.
        </p>
        {e && (
          <p>
            {e.sigla} em {e.ano}: os {e.quantosCampi} câmpus somam {reais.format(e.funcionamentoCampi)} e a Reitoria{" "}
            {reais.format(reitoria)}, o que dá {reais.format(e.funcionamento)}.
            {e.campus && (
              <>
                {" "}
                Só {nomeCampus} recebe {reais.format(e.campus.funcionamento)}; para ver a conta de cada curso dele, abra{" "}
                <Link href="/consulta/valor-do-aluno" className={PROSE_LINK}>
                  Quanto vale um aluno
                </Link>
                .
              </>
            )}
          </p>
        )}
      </Detalhe>

      <Detalhe titulo="Qualidade e Eficiência" aberto={bloco === "iqe"}>
        <p className={CAIXA}>
          <strong>Qualidade e Eficiência = parcela do IEA + parcela da RAP + parcela do IAPL</strong>. Cada indicador é calculado para a
          instituição inteira e enquadrado numa faixa de pontuação; o dinheiro do bloco (10% da rede) se reparte pela pontuação de cada
          instituição.
        </p>
        <ul className="list-disc pl-5">
          <li>
            <strong>IEA</strong>, Índice de Eficiência Acadêmica: quantos alunos concluem no prazo, quantos evadem e quantos ficam retidos.
          </li>
          <li>
            <strong>RAP</strong>, Relação Aluno por Professor: alunos presenciais por professor equivalente.
          </li>
          <li>
            <strong>IAPL</strong>, Atendimento aos Percentuais Legais: se a instituição cumpre os percentuais mínimos de cursos técnicos,
            licenciaturas e Proeja.
          </li>
        </ul>
        {e && (
          <p>
            {e.sigla} em {e.ano}: <strong>{reais.format(e.qualidade)}</strong>. Este bloco não tem valor por câmpus: fica com a instituição.
          </p>
        )}
      </Detalhe>

      <Detalhe titulo="Assistência Estudantil" aberto={bloco === "ae"}>
        <p className={CAIXA}>
          <strong>Assistência do câmpus = parcela presencial + parcela EAD + parcela do Regime de Internato Pleno (RIP)</strong>. As duas
          primeiras seguem a matrícula do câmpus, com um peso maior onde a renda das famílias dos estudantes é menor; a parcela RIP vai só aos
          câmpus com alunos internos.
        </p>
        {e && (
          <p>
            {e.sigla} em {e.ano}: <strong>{reais.format(e.assistencia)}</strong>, e os câmpus somam {reais.format(e.assistenciaCampi)}
            {Math.abs(e.assistencia - e.assistenciaCampi) < 1 ? " (a Assistência inteira é distribuída aos câmpus)" : ""}.
            {e.campus && (
              <>
                {" "}
                {nomeCampus} recebe {reais.format(e.campus.assistencia)}.
              </>
            )}
          </p>
        )}
      </Detalhe>
    </section>
  );
}

function Detalhe({ titulo, aberto, children }: { titulo: string; aberto: boolean; children: React.ReactNode }) {
  return (
    <details open={aberto} className="rounded-md border border-neutral-200 px-3 py-2 dark:border-neutral-800">
      <summary className="cursor-pointer font-medium text-neutral-900 dark:text-neutral-100">{titulo}</summary>
      <div className="mt-2 flex flex-col gap-2">{children}</div>
    </details>
  );
}
