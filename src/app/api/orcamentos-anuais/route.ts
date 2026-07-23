import { NextResponse } from "next/server";
import { prisma } from "@/server/db/prisma";

/** Lista os orçamentos anuais configurados pelo administrador — usado pela tela de admin e pela Consulta. */
export async function GET() {
  const orcamentos = await prisma.orcamentoAnual.findMany({ orderBy: { ano: "desc" } });

  return NextResponse.json(
    orcamentos.map((o) => ({
      ano: o.ano,
      valorTotal: Number(o.valorTotal),
      updatedAt: o.updatedAt.toISOString(),
    })),
  );
}
