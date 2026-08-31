import { UnidadesAnoCriacaoPanel } from "@/components/admin/UnidadesAnoCriacaoPanel";
import { TABLE_MAX_WIDTH } from "@/lib/layoutWidths";

export default function UnidadesPage() {
  return (
    <main className={`mx-auto flex ${TABLE_MAX_WIDTH} flex-col gap-6 px-6 py-16 lg:px-12`}>
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">Câmpus</h1>
        <p className="text-neutral-600 dark:text-neutral-400">
          Ano de criação de cada câmpus — essa informação não existe em nenhum arquivo da PNP; foi pré-carregada a
          partir da planilha oficial (aba &quot;Completo Proposta&quot;) e pode ser revisada aqui. É usada só pelo
          Piso Mínimo do Bloco Funcionamento (
          <a href="/admin/orcamento" className="underline hover:text-neutral-900 dark:hover:text-neutral-100">
            configurado em Orçamento anual
          </a>
          ) para câmpus criados a partir de 2018. Reitorias e Direções Gerais não aparecem aqui — são unidades
          administrativas, sem Bloco Funcionamento.
        </p>
        <p className="mt-2 text-neutral-600 dark:text-neutral-400">
          A lista abaixo nasce dos arquivos da PNP. Como um câmpus recém-criado ainda não tem matrícula, ele não
          aparece em nenhum arquivo da PNP e <strong>não surge aqui sozinho</strong> — mas a matriz da CONIF já o
          contempla, porque ele recebe o Piso Mínimo mesmo sem alunos. Para dimensionar: no ciclo 2027, dos 53
          câmpus que recebem o piso, <strong>41 não existiam no sistema</strong> (todos criados em 2026) — R$ 28,7
          milhões que a planilha distribui e o sistema não conseguia atribuir a ninguém.
        </p>
        <p className="mt-2 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">
          <strong>Você quase não precisa digitar nada aqui.</strong> A planilha de Matrícula Total equalizada, que
          você já envia em{" "}
          <a href="/admin/dados-anuais" className="underline">
            Dados anuais
          </a>
          , traz a coluna <code className="rounded bg-emerald-100 px-1 dark:bg-emerald-900">AnoCriacaoCampus</code> e
          a lista completa de câmpus do ciclo — inclusive os que ainda não têm matrícula. Ao importá-la, o sistema
          preenche sozinho o ano de criação que estiver em branco e <em>oferece</em> criar os câmpus que faltam
          (não cria por conta própria: isso redistribui o Piso Mínimo, então a decisão é sua). Sobram para
          digitação apenas os câmpus que a própria planilha manda sem ano — cerca de uma dúzia por ciclo, quase
          todos Centros de Referência. O formulário abaixo continua disponível para esses casos e para correções.
        </p>
      </div>
      <UnidadesAnoCriacaoPanel />
    </main>
  );
}
