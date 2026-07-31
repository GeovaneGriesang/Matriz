import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/server/db/prisma";
import { PNP_FILE_TYPES, type PnpFileType } from "@/ingestion/config/fileTypes";

const PAGE_SIZE = 50;

export interface FatoImportadoLinha {
  id: number;
  ano: number;
  instituicaoSigla: string;
  instituicaoNome: string;
  unidadeNome: string | null;
  medida: string;
  valor: number;
  dimensoesExtra: Record<string, unknown> | null;
}

export interface FatosImportadosResponse {
  total: number;
  page: number;
  pageSize: number;
  rows: FatoImportadoLinha[];
}

function parseIntParam(value: string | null): number | undefined {
  if (!value) return undefined;
  const n = Number(value);
  return Number.isInteger(n) ? n : undefined;
}

/**
 * Navegador genérico de `FatoIndicador` filtrado por tipo de arquivo PNP (obrigatório, é o que
 * define o significado de `medida`) e, opcionalmente, ano/instituição/câmpus/medida — usado pela
 * tela /admin/fatos-importados ("ver o que foi importado").
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const fileTypeParam = params.get("fileType");
  if (!fileTypeParam || !PNP_FILE_TYPES.includes(fileTypeParam as PnpFileType)) {
    return NextResponse.json(
      { errorMessage: "Parâmetro 'fileType' é obrigatório e deve ser um tipo de arquivo PNP válido." },
      { status: 400 },
    );
  }
  const fileType = fileTypeParam as PnpFileType;
  const ano = parseIntParam(params.get("ano"));
  const instituicaoId = parseIntParam(params.get("instituicaoId"));
  const unidadeId = parseIntParam(params.get("unidadeId"));
  const medida = params.get("medida") || undefined;
  const page = Math.max(1, parseIntParam(params.get("page")) ?? 1);

  const where = {
    fileType,
    ...(ano !== undefined ? { ano } : {}),
    ...(instituicaoId !== undefined ? { instituicaoId } : {}),
    ...(unidadeId !== undefined ? { unidadeId } : {}),
    ...(medida ? { medida } : {}),
  };

  const [total, rows] = await Promise.all([
    prisma.fatoIndicador.count({ where }),
    prisma.fatoIndicador.findMany({
      where,
      select: {
        id: true,
        ano: true,
        medida: true,
        valor: true,
        dimensoesExtra: true,
        instituicao: { select: { sigla: true, nome: true } },
        unidade: { select: { nome: true } },
      },
      orderBy: [{ ano: "desc" }, { instituicaoId: "asc" }, { unidadeId: "asc" }, { medida: "asc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
  ]);

  const resposta: FatosImportadosResponse = {
    total,
    page,
    pageSize: PAGE_SIZE,
    rows: rows.map((r) => ({
      id: r.id,
      ano: r.ano,
      instituicaoSigla: r.instituicao.sigla,
      instituicaoNome: r.instituicao.nome,
      unidadeNome: r.unidade?.nome ?? null,
      medida: r.medida,
      valor: Number(r.valor),
      dimensoesExtra: r.dimensoesExtra as Record<string, unknown> | null,
    })),
  };

  return NextResponse.json(resposta);
}
