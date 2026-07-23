import { NextResponse } from "next/server";
import { uploadCsvAction } from "@/server/actions/uploadCsv";
import { requireAdminSessionOrResponse } from "@/server/auth/session";

export async function POST(request: Request) {
  const naoAutenticado = await requireAdminSessionOrResponse();
  if (naoAutenticado) return naoAutenticado;

  const formData = await request.formData();
  const resultado = await uploadCsvAction(formData);
  return NextResponse.json(resultado, { status: resultado.ok ? 200 : 400 });
}
