import { NextResponse } from "next/server";
import { runCalculation, type CampusOverride } from "@/server/actions/runCalculation";

const CAMPOS_OVERRIDE: (keyof CampusOverride)[] = [
  "matriculaPonderada",
  "valorIeaPercentual",
  "razaoDocenteAluno",
  "matriculasTecnicos",
  "matriculasFormacaoProfessores",
  "matriculasProeja",
];

/** Aceita só um objeto `{[unidadeId]: {...números opcionais...}}` — chaves/valores fora desse formato são ignorados. */
function parseOverrides(raw: unknown): Record<number, CampusOverride> {
  const overrides: Record<number, CampusOverride> = {};
  if (typeof raw !== "object" || raw === null) return overrides;

  for (const [chave, valorBruto] of Object.entries(raw as Record<string, unknown>)) {
    const unidadeId = Number(chave);
    if (!Number.isInteger(unidadeId) || typeof valorBruto !== "object" || valorBruto === null) continue;

    const override: CampusOverride = {};
    for (const campo of CAMPOS_OVERRIDE) {
      const valorCampo = (valorBruto as Record<string, unknown>)[campo];
      if (typeof valorCampo === "number" && Number.isFinite(valorCampo)) {
        override[campo] = valorCampo;
      }
    }
    if (Object.keys(override).length > 0) overrides[unidadeId] = override;
  }

  return overrides;
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const orcamentoTotal = Number(body?.orcamentoTotal);
  const ano = Number(body?.ano);

  if (!Number.isFinite(orcamentoTotal) || orcamentoTotal <= 0) {
    return NextResponse.json({ error: "orcamentoTotal deve ser um número positivo." }, { status: 400 });
  }
  if (!Number.isInteger(ano) || ano <= 0) {
    return NextResponse.json({ error: "ano deve ser um ano de referência válido." }, { status: 400 });
  }

  const overridesPorUnidade = parseOverrides(body?.overridesPorUnidade);

  const resultado = await runCalculation({ orcamentoTotal, ano, overridesPorUnidade });
  return NextResponse.json(resultado);
}
