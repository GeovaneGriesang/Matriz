"use client";

const reais = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const inteiro = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
const dec1 = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const pct = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 3, maximumFractionDigits: 3 });

/**
 * O marcador "descontar a diluição", com a explicação e a conta com os números da simulação. O orçamento da rede é fixo:
 * cada matrícula a mais na rede divide o mesmo dinheiro por mais matrículas, e o valor de cada uma cai um pouco, para todos.
 */
export function MarcadorDiluicao({
  marcado,
  onChange,
  matriculasRede,
  matriculaDoCurso,
  valorMatricula,
}: {
  marcado: boolean;
  onChange: (v: boolean) => void;
  /** Matrícula total equivalente da rede inteira. */
  matriculasRede: number;
  /** Matrícula Total que o curso simulado acrescenta, com todas as turmas em andamento. */
  matriculaDoCurso: number;
  valorMatricula: number;
}) {
  const novoValor = matriculasRede > 0 ? (valorMatricula * matriculasRede) / (matriculasRede + matriculaDoCurso) : valorMatricula;
  const queda = valorMatricula > 0 ? (1 - novoValor / valorMatricula) * 100 : 0;
  return (
    <div className="flex flex-col gap-1 text-sm text-neutral-700 dark:text-neutral-300 sm:col-span-2">
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={marcado} onChange={(e) => onChange(e.target.checked)} />
        Descontar o efeito do curso novo sobre o valor de cada matrícula da rede
      </label>
      <details className="text-xs text-neutral-500">
        <summary className="cursor-pointer">O que isso quer dizer?</summary>
        <p className="mt-1">
          O dinheiro do Funcionamento da rede é fixo e é dividido pela matrícula de todos os institutos. Quando um câmpus abre um curso, a
          matrícula da rede aumenta, e o mesmo dinheiro passa a ser dividido por mais matrículas: o valor de cada uma cai um pouco, para
          todos os câmpus, inclusive o que abriu o curso. Desmarcado, a simulação mantém o valor da matrícula fixo (boa aproximação para um
          curso só); marcado, desconta essa queda.
        </p>
        <p className="mt-1">
          Com os números desta simulação: a rede tem {inteiro.format(matriculasRede)} matrículas equivalentes e este curso, com todas as turmas
          em andamento, soma {dec1.format(matriculaDoCurso)}. O valor de uma matrícula passaria de {reais.format(valorMatricula)} para{" "}
          {reais.format(valorMatricula)} × {inteiro.format(matriculasRede)} ÷ ({inteiro.format(matriculasRede)} + {dec1.format(matriculaDoCurso)}) ={" "}
          <strong>{reais.format(novoValor)}</strong>, uma queda de {pct.format(queda)}%.
        </p>
      </details>
    </div>
  );
}
