import Link from "next/link";

export default function HomePage() {
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-4 px-6 py-16">
      <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">Matriz Orçamentária RFEPCT</h1>
      <p className="text-neutral-600 dark:text-neutral-400">
        Plataforma de cálculo, auditoria e simulação da Matriz Orçamentária da Rede Federal.
      </p>
      <div className="flex flex-wrap gap-3">
        <Link
          href="/consulta"
          className="w-fit rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300"
        >
          Consultar distribuição oficial
        </Link>
        <Link
          href="/simulador"
          className="w-fit rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-900 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-100 dark:hover:bg-neutral-800"
        >
          Simular distribuição da matriz
        </Link>
        <Link
          href="/dados-importados"
          className="w-fit rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-900 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-100 dark:hover:bg-neutral-800"
        >
          Ver dados importados
        </Link>
      </div>

      {/*
        A área administrativa fica separada de propósito: é a única que exige senha e a única que
        ALTERA dados. As três ações acima são de leitura e abertas a qualquer pessoa.
      */}
      <hr className="mt-4 border-neutral-200 dark:border-neutral-800" />

      <div className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-neutral-900 dark:text-neutral-100">Área administrativa</h2>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          Alimenta o sistema: os extratos da PNP e também os valores publicados pela CONIF a cada ciclo, que não
          existem na PNP — Matrícula Total equalizada, RAPP, Eficiência Acadêmica, pesos de repasse e os valores do
          orçamento. Exige senha, e é o único lugar em que os dados mudam.
        </p>
        <Link
          href="/upload"
          className="w-fit rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-900 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-100 dark:hover:bg-neutral-800"
        >
          Configurar e importar dados
        </Link>
      </div>
    </main>
  );
}
