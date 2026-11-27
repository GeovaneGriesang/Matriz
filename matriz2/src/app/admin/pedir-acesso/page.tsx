import Link from "next/link";
import { prisma } from "@/server/db/prisma";
import { nomeCurtoDaUnidade } from "@/lib/campusDoUsuario";
import { DOMINIO_INSTITUCIONAL } from "@/lib/emailInstitucional";
import { PedirAcessoForm } from "@/components/auth/PedirAcessoForm";

export const dynamic = "force-dynamic";

/** "Venâncio Aires" e "venancio-aires" dão a mesma chave, para o link já vir com o câmpus marcado (?campus=venancio-aires). */
const chave = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export default async function PedirAcessoPage({ searchParams }: { searchParams: Promise<{ campus?: string }> }) {
  const sp = await searchParams;
  const unidades = await prisma.unidade.findMany({ where: { instituicao: { sigla: "IFSUL" } }, select: { id: true, nome: true }, orderBy: { nome: "asc" } });
  const opcoes = unidades.map((u) => ({ id: u.id, nome: nomeCurtoDaUnidade(u.nome) })).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  const marcado = sp.campus ? opcoes.find((o) => chave(o.nome) === chave(sp.campus!))?.id : undefined;

  return (
    <main className="mx-auto flex max-w-xl flex-col gap-6 px-6 py-16">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">Pedir acesso</h1>
        <p className="text-neutral-600 dark:text-neutral-400">
          O acesso ao sistema é para servidoras e servidores do IFSul, sempre com o e-mail institucional (@{DOMINIO_INSTITUCIONAL}). Preencha o pedido e
          aguarde: a administração confere e, se aprovar, você recebe no e-mail um código para criar a sua senha. Se não for aprovado, a resposta também chega por e-mail.
        </p>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          Já tem conta?{" "}
          <Link href="/admin/login" className="font-medium text-if-green underline hover:text-if-green/80 dark:text-green-400">
            Entre
          </Link>
          .
        </p>
      </div>
      <PedirAcessoForm unidades={opcoes} unidadeMarcada={marcado} />
    </main>
  );
}
