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
            A CONIF <strong>republica esta tabela a cada ciclo</strong>, e tanto os pesos quanto a lista de
            programas podem mudar. Entre 2026 e 2027, por exemplo, os quatro pesos continuaram iguais, mas os
            nomes dos programas mudaram bastante (o que era &quot;APRENDA MAIS&quot; e &quot;OUTROS MOOC&quot;
            virou &quot;MOOC - Aprenda Mais&quot; e &quot;MOOC - Outros&quot;, e a lista passou de 12 para 25
            programas). Guardando cada ano separadamente, recalcular um ciclo anterior continua reproduzindo o
            que foi publicado na época.
          </p>
          <p className="mt-2">
            Sem composição cadastrada para o ano, o cálculo usa os pesos padrão da CONIF (Presencial 1 · EAD
            0,25 · EAD MOOC 0,08 · EAD FP 0,8), que são os mesmos em 2026 e 2027, e{" "}
            <strong>avisa na memória de cálculo</strong> que não houve confirmação para aquele ciclo.
          </p>
        </div>
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          <p className="font-medium">Correção aplicada em 28/08/2026 — peso do EAD MOOC</p>
          <p>
            Até esta data o sistema usava <strong>0,8</strong> para o EAD MOOC. O valor correto é{" "}
            <strong>0,08</strong> — dez vezes menor. O 0,8 é o peso do EAD FP, que havia sido copiado por
            engano a partir de uma anotação da metodologia que já trazia a ressalva &quot;ver nuance MOOC na
            planilha original&quot;. As quatro fontes oficiais conferidas (planilhas da matriz de 2026 e 2027 e
            as composições de repasse dos dois anos) trazem 0,08. O erro inflava em cerca de{" "}
            <strong>1,15%</strong> o Bloco Funcionamento dos 60 câmpus que ofertam MOOC. Cálculos oficiais
            gerados antes desta data e que ainda estejam publicados precisam ser refeitos.
          </p>
        </div>
      </div>
      <ComposicaoRepassePanel />
    </main>
  );
}
