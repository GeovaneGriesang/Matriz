import { NextResponse } from "next/server";
import { uploadCsvAction } from "@/server/actions/uploadCsv";

export async function POST(request: Request) {
  const formData = await request.formData();
  const resultado = await uploadCsvAction(formData);
  return NextResponse.json(resultado, { status: resultado.ok ? 200 : 400 });
}
