"use client";

import { useState, type FormEvent } from "react";
import { salvarCicloOrcamentoManualAction } from "@/server/actions/cicloOrcamento";

export interface CicloOrcamentoPlano {
  ano: number;
  valorReferenciaSpo: number;
  ajuste: number;
  assistenciaTotal: number;
  funcionamentoTotal: number;
  pisoTotal: number;
  pisoPorCampus: number;
  campusComPiso: number;
  reitoriasTotal: number;
  qualidadeEficienciaTotal: number;
  valorIea: number;
  valorRap: number;
  valorIapl: number;
  valorMatriculaPresencial: number | null;
  valorMatriculaEad: number | null;
  valorMatriculaEadFp: number | null;
  valorMatriculaEadMooc: number | null;
  percentualAnuidade: number;
}

interface Campo {
  chave: keyof CicloOrcamentoPlano;
  rotulo: string;
  passo?: string;
  /** Campos em reais mostram "R$ 30.777.157,70" quando não estão em edição. */
  moeda?: boolean;
}

const GRUPOS: { titulo: string; campos: Campo[] }[] = [
  {
    titulo: "Referência e ajuste",
    campos: [
      { chave: "valorReferenciaSpo", rotulo: "Valor referência (SPO)", moeda: true },
      { chave: "ajuste", rotulo: "Ajuste", moeda: true },
      { chave: "assistenciaTotal", rotulo: "Assistência Estudantil (2994)", moeda: true },
    ],
  },
  {
    titulo: "Bloco Funcionamento (80%)",
    campos: [
      { chave: "funcionamentoTotal", rotulo: "Funcionamento, total", moeda: true },
      { chave: "pisoTotal", rotulo: "Reservado ao Piso Mínimo", moeda: true },
      { chave: "pisoPorCampus", rotulo: "Piso, por câmpus", moeda: true },
      { chave: "campusComPiso", rotulo: "Câmpus elegíveis ao piso", passo: "1" },
    ],
  },
  {
    titulo: "Reitorias e Qualidade e Eficiência (10% + 10%)",
    campos: [
      { chave: "reitoriasTotal", rotulo: "Reitorias, total", moeda: true },
      { chave: "qualidadeEficienciaTotal", rotulo: "Qualidade e Eficiência, total", moeda: true },
      { chave: "valorIea", rotulo: "IEA (25% do bloco)", moeda: true },
      { chave: "valorRap", rotulo: "RAP (25% do bloco)", moeda: true },
      { chave: "valorIapl", rotulo: "IAPL (50% do bloco)", moeda: true },
    ],
  },
  {
    titulo: "Valor de uma matrícula, por modalidade",
    campos: [
      { chave: "valorMatriculaPresencial", rotulo: "Presencial", moeda: true },
      { chave: "valorMatriculaEad", rotulo: "EAD", moeda: true },
      { chave: "valorMatriculaEadFp", rotulo: "EAD FP", moeda: true },
      { chave: "valorMatriculaEadMooc", rotulo: "EAD MOOC", moeda: true },
    ],
  },
  {
    titulo: "Anuidade CONIF",
    campos: [{ chave: "percentualAnuidade", rotulo: "Percentual (fração, ex.: 0,0015 = 0,15%)", passo: "0.0001" }],
  },
];

const formatoReais = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function formatarMoeda(valorBruto: string): string {
  if (valorBruto.trim() === "") return "";
  const n = Number(valorBruto);
  return Number.isFinite(n) ? formatoReais.format(n) : valorBruto;
}

export function CicloOrcamentoForm({ ciclo }: { ciclo: CicloOrcamentoPlano }) {
  const [valores, setValores] = useState<Record<string, string>>(
    Object.fromEntries(
      Object.entries(ciclo).map(([chave, valor]) => [chave, valor === null ? "" : String(valor)]),
    ),
  );
  const [salvando, setSalvando] = useState(false);
  const [resultado, setResultado] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  // Só o campo em edição no momento mostra o número puro; os demais (e este, antes de
  // focar e depois de sair) mostram "R$ 30.777.157,70" — formatar todos ao mesmo
  // tempo exigiria uma máscara que reescreve o texto a cada tecla, e isso atropela o
  // cursor. Trocar a representação só ao focar/desfocar evita esse problema.
  const [campoFocado, setCampoFocado] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSalvando(true);
    setResultado(null);
    try {
      const formData = new FormData();
      formData.set("ano", String(ciclo.ano));
      for (const [chave, valor] of Object.entries(valores)) {
        if (chave === "ano") continue;
        formData.set(chave, valor);
      }
      const r = await salvarCicloOrcamentoManualAction(formData);
      if (!r.ok) throw new Error(r.errorMessage ?? "Não foi possível salvar.");
      setResultado({ tipo: "ok", texto: `Ciclo ${ciclo.ano} corrigido. A origem passou a ser "administrador".` });
    } catch (erro) {
      setResultado({ tipo: "erro", texto: erro instanceof Error ? erro.message : "Erro desconhecido." });
    } finally {
      setSalvando(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      {GRUPOS.map((grupo) => (
        <fieldset key={grupo.titulo} className="flex flex-col gap-3 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
          <legend className="px-1 text-sm font-semibold text-neutral-900 dark:text-neutral-100">{grupo.titulo}</legend>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {grupo.campos.map((campo) => {
              const bruto = valores[campo.chave] ?? "";
              const emEdicao = campoFocado === campo.chave;
              const mostrarFormatado = campo.moeda && !emEdicao;
              return (
                <label key={campo.chave} className="flex flex-col gap-1 text-sm">
                  <span className="text-neutral-600 dark:text-neutral-400">{campo.rotulo}</span>
                  <input
                    type={mostrarFormatado ? "text" : "number"}
                    inputMode={campo.moeda ? "decimal" : undefined}
                    step={campo.passo ?? "0.01"}
                    value={mostrarFormatado ? formatarMoeda(bruto) : bruto}
                    onFocus={() => campo.moeda && setCampoFocado(campo.chave)}
                    onBlur={() => campo.moeda && setCampoFocado(null)}
                    onChange={(e) => setValores((atual) => ({ ...atual, [campo.chave]: e.target.value }))}
                    className="rounded-md border border-neutral-300 px-3 py-2 text-sm tabular-nums dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
                  />
                </label>
              );
            })}
          </div>
        </fieldset>
      ))}

      {resultado && (
        <p
          className={`rounded-md px-3 py-2 text-sm ${
            resultado.tipo === "ok"
              ? "bg-if-green/10 text-if-green dark:text-green-400"
              : "bg-red-50 text-red-900 dark:bg-red-950 dark:text-red-200"
          }`}
        >
          {resultado.texto}
        </p>
      )}

      <button
        type="submit"
        disabled={salvando}
        className="w-fit rounded-md bg-if-green px-4 py-2 text-sm font-medium text-white hover:bg-if-green/90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {salvando ? "Salvando..." : "Salvar correção manual"}
      </button>
    </form>
  );
}
