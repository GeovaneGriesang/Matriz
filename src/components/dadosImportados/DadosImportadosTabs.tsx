"use client";

import { useState } from "react";
import { FatosImportadosPanel } from "./FatosImportadosPanel";
import { DadosAnuaisConsultaPanel } from "./DadosAnuaisConsultaPanel";

type Aba = "pnp" | "dados-anuais";

const ABAS: { chave: Aba; label: string }[] = [
  { chave: "pnp", label: "PNP (dados brutos)" },
  { chave: "dados-anuais", label: "Dados anuais (CONIF)" },
];

const badgeClass =
  "w-fit rounded-md bg-neutral-100 px-3 py-1.5 text-xs text-neutral-600 dark:bg-neutral-900 dark:text-neutral-400";
const linkClass = "underline hover:text-neutral-900 dark:hover:text-neutral-100";

/** Alterna entre os dois grupos de dados consultáveis nesta tela, cada um com uma origem diferente:
 *  PNP (sempre CSV bruto importado em /upload) e Dados anuais (publicados pela CONIF, cada linha
 *  marcada como Planilha oficial ou Configurado à mão). */
export function DadosImportadosTabs() {
  const [aba, setAba] = useState<Aba>("pnp");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-1 border-b border-neutral-200 dark:border-neutral-800">
        {ABAS.map((a) => (
          <button
            key={a.chave}
            type="button"
            onClick={() => setAba(a.chave)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
              aba === a.chave
                ? "border-neutral-900 text-neutral-900 dark:border-neutral-100 dark:text-neutral-100"
                : "border-transparent text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200"
            }`}
          >
            {a.label}
          </button>
        ))}
      </div>

      {aba === "pnp" ? (
        <div className="flex flex-col gap-4">
          <p className={badgeClass}>
            Fonte:{" "}
            <a href="https://www.gov.br/mec/pt-br/pnp" target="_blank" rel="noreferrer" className={linkClass}>
              PNP — Plataforma Nilo Peçanha
            </a>
            . CSVs oficiais enviados em /upload, sem edição manual.
          </p>
          <FatosImportadosPanel />
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <p className={badgeClass}>
            Fonte: CONIF (Conselho Nacional das Instituições da Rede Federal). Cada linha mostra se o valor veio de
            uma planilha oficial importada ou foi configurado manualmente por um administrador; para RAPP,
            Eficiência Acadêmica e Matrícula Total equalizada, também dá pra ver como o sistema chegaria nesse
            valor a partir dos dados brutos da{" "}
            <a href="https://www.gov.br/mec/pt-br/pnp" target="_blank" rel="noreferrer" className={linkClass}>
              PNP
            </a>
            .
          </p>
          <DadosAnuaisConsultaPanel />
        </div>
      )}
    </div>
  );
}
