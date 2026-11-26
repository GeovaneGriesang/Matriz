import Link from "next/link";
import { prisma } from "@/server/db/prisma";
import { PROSE_LINK, TABLE_MAX_WIDTH } from "@/lib/layoutWidths";
import { requireAcessoPlenoOrRedirect } from "@/server/auth/session";
import { RoboAzul } from "@/components/icons/RoboAzul";
import { ROTULO_DO_AVISO, type TipoDeAviso } from "@/server/avisos/avisos";

export const dynamic = "force-dynamic";

const COR: Record<TipoDeAviso, string> = {
  fonte: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300",
  carga: "bg-blue-100 text-blue-900 dark:bg-blue-950 dark:text-blue-300",
  versao: "bg-if-green/15 text-if-green",
};

const quando = (d: Date) => d.toLocaleString("pt-BR", { dateStyle: "long", timeStyle: "short", timeZone: "America/Sao_Paulo" });

export default async function AvisosPage({ searchParams }: { searchParams: Promise<{ tipo?: string }> }) {
  const usuario = await requireAcessoPlenoOrRedirect("/avisos");
  const { tipo } = await searchParams;
  const filtro = tipo === "fonte" || tipo === "carga" || tipo === "versao" ? tipo : undefined;
  const conta = await prisma.usuario.findUnique({ where: { id: usuario.id }, select: { avisosVistosEm: true, criadoEm: true } });
  const vistosAte = conta?.avisosVistosEm ?? conta?.criadoEm ?? new Date(0);
  const avisos = await prisma.avisoDoSistema.findMany({ where: filtro ? { tipo: filtro } : {}, orderBy: { criadoEm: "desc" }, take: 200 });
  // Abrir a tela conta como ter visto tudo: o número do robô no topo zera.
  await prisma.usuario.update({ where: { id: usuario.id }, data: { avisosVistosEm: new Date() } });

  return (
    <main className={`mx-auto flex ${TABLE_MAX_WIDTH} flex-col gap-6 px-6 py-12 lg:px-12`}>
      <div className="flex flex-col gap-2">
        <h1 className="flex items-center gap-3 text-2xl font-semibold text-neutral-900 dark:text-neutral-100">
          <RoboAzul tamanho={34} /> Avisos do sistema
        </h1>
        <p className="text-neutral-600 dark:text-neutral-400">
          O robô azul avisa o que foi atualizado no sistema: quando uma fonte oficial muda (a conferência de toda segunda-feira achou arquivo novo, mês novo no Portal ou troca de
          partido), quando dados novos são carregados e quando uma versão nova do sistema é publicada. Cada aviso também vai por e-mail aos super-admins, com o robô no assunto, para
          não se misturar com memorandos e mensagens agendadas. O número no robô do topo mostra quantos avisos chegaram desde a última vez que esta tela foi aberta.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 text-sm">
        {([undefined, "fonte", "carga", "versao"] as const).map((t) => (
          <Link
            key={t ?? "todos"}
            href={t ? `/avisos?tipo=${t}` : "/avisos"}
            className={`rounded px-3 py-1.5 font-medium ${filtro === t ? "bg-blue-700 text-white" : "border border-neutral-300 text-neutral-700 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"}`}
          >
            {t ? ROTULO_DO_AVISO[t] : "Todos"}
          </Link>
        ))}
      </div>

      {avisos.length === 0 ? (
        <p className="text-neutral-600 dark:text-neutral-400">Nenhum aviso ainda.</p>
      ) : (
        <ol className="flex flex-col gap-3">
          {avisos.map((a) => {
            const novo = a.criadoEm > vistosAte;
            return (
              <li key={a.id} className={`flex flex-col gap-2 rounded-lg border p-4 ${novo ? "border-blue-400 bg-blue-50/60 dark:border-blue-700 dark:bg-blue-950/40" : "border-neutral-200 dark:border-neutral-800"}`}>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className={`rounded px-2 py-0.5 font-semibold ${COR[a.tipo as TipoDeAviso] ?? COR.carga}`}>{ROTULO_DO_AVISO[a.tipo as TipoDeAviso] ?? a.tipo}</span>
                  <span className="text-neutral-500">{quando(a.criadoEm)}</span>
                  {novo && <span className="rounded bg-blue-600 px-2 py-0.5 font-semibold text-white">novo</span>}
                </div>
                <h2 className="font-semibold text-neutral-900 dark:text-neutral-100">{a.titulo}</h2>
                <pre className="whitespace-pre-wrap break-words font-sans text-sm text-neutral-700 dark:text-neutral-300">{a.texto}</pre>
                {a.link && (
                  <Link href={a.link} className={`text-sm ${PROSE_LINK}`}>
                    Abrir a tela
                  </Link>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </main>
  );
}
