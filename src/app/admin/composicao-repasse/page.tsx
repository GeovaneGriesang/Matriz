import { ComposicaoRepassePanel } from "@/components/admin/ComposicaoRepassePanel";
import { TABLE_MAX_WIDTH } from "@/lib/layoutWidths";

export default function ComposicaoRepassePage() {
  return (
    <main className={`mx-auto flex ${TABLE_MAX_WIDTH} flex-col gap-6 px-6 py-16 lg:px-12`}>
      <div className="flex flex-col gap-3">
        <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">Composição de Repasse</h1>
        <p className="text-neutral-600 dark:text-neutral-400">
          A PNP registra apenas duas modalidades de ensino: <strong>Presencial</strong> e{" "}
          <strong>a Distância</strong>. Só que, no cálculo da matriz, nem toda matrícula a distância vale o
          mesmo — é a <strong>fonte de financiamento</strong> (o programa ao qual o curso está associado) que
          separa a Distância em três grupos com pesos bem diferentes. Essa correspondência entre programa e
          peso é o que a CONIF publica a cada ciclo na planilha &quot;Composição de Repasse&quot;, e é o que
          se cadastra aqui.
        </p>
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
          <p className="font-medium">Por que este cadastro é por ano</p>
          <p>
            Os pesos <strong>mudam entre ciclos orçamentários</strong>. O EAD MOOC valia{" "}
            <strong>0,8 em 2026</strong> e passou a valer <strong>0,08 em 2027</strong> — dez vezes menos.
            Guardando os pesos de cada ano separadamente, recalcular um ano anterior continua reproduzindo o
            resultado publicado na época, em vez de aplicar a regra nova a um ano antigo.
          </p>
          <p className="mt-2">
            Se o ano do cálculo não tiver composição cadastrada, o sistema usa os pesos do ciclo 2026 e{" "}
            <strong>avisa na memória de cálculo</strong> — exceto para o próprio 2026, em que esses pesos são
            os corretos e conferidos.
          </p>
        </div>
      </div>
      <ComposicaoRepassePanel />
    </main>
  );
}
