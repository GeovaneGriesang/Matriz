import fs from "node:fs";
import { prisma } from "@/server/db/prisma";
import { getAdminSession } from "@/server/auth/session";
import { localizarArquivoOriginal } from "@/carga/caminhos";

/**
 * Baixa o arquivo original que gerou uma `FonteDados`, pelo link em "Dados
 * importados" (pedido do usuário: conferir o dado direto na planilha da MDO, sem
 * pedir pra outra pessoa reenviar). Nunca serve o arquivo de uma fonte com dado
 * pessoal por aluno (LGPD) — essas ficam de fora mesmo que alguém chegue direto
 * nesta URL sem passar pelo link da tela (a tela já esconde o link, mas a
 * proteção de verdade é aqui, não lá).
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const usuario = await getAdminSession();
  if (!usuario || usuario.papel === "PADRAO") {
    return new Response("Não autorizado.", { status: 403 });
  }

  const { id } = await params;
  const fonteId = Number(id);
  if (!Number.isInteger(fonteId) || fonteId <= 0) {
    return new Response("Fonte inválida.", { status: 400 });
  }

  const fonte = await prisma.fonteDados.findUnique({
    where: { id: fonteId },
    include: { _count: { select: { conferenciasExtracaoAluno: true } } },
  });
  if (!fonte) {
    return new Response("Fonte não encontrada.", { status: 404 });
  }
  if (fonte._count.conferenciasExtracaoAluno > 0) {
    return new Response(
      "Este arquivo traz dado pessoal por aluno (LGPD) e não pode ser baixado; só os agregados aparecem no sistema.",
      { status: 403 },
    );
  }

  const caminho = localizarArquivoOriginal(fonte.fase, fonte.arquivo);
  if (!caminho) {
    return new Response("Não encontrei o arquivo original neste servidor.", { status: 404 });
  }

  const conteudo = fs.readFileSync(caminho);
  const nomeCodificado = encodeURIComponent(fonte.arquivo);
  return new Response(new Uint8Array(conteudo), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${fonte.arquivo}"; filename*=UTF-8''${nomeCodificado}`,
      "Content-Length": String(conteudo.length),
    },
  });
}
