import { TABLE_MAX_WIDTH } from "@/lib/layoutWidths";
import { requireAcessoPlenoOrRedirect } from "@/server/auth/session";
import { CONFIANCA, NIVEIS, type NivelConfianca } from "@/lib/confianca";
import { SeloConfianca } from "@/components/Confianca";
import { prisma } from "@/server/db/prisma";
import { temAcessoPleno } from "@/lib/permissoes";
import { FontesMonitoradas, type FonteNaTela } from "./FontesMonitoradas";
import { FONTES } from "@/server/fontes/verificarFontes";

export const dynamic = "force-dynamic";

const ORDEM: NivelConfianca[] = ["CONFERIDO", "ATENCAO", "ESTIMADO"];

export default async function SituacaoDosDadosPage() {
  const usuario = await requireAcessoPlenoOrRedirect("/situacao-dos-dados");
  const fontes: FonteNaTela[] = (
    await prisma.fonteMonitorada.findMany({ where: { chave: { in: FONTES.map((f) => f.chave) } }, orderBy: { id: "asc" }, include: { verificacoes: { orderBy: { em: "desc" }, take: 6 } } })
  ).map((f) => ({
    id: f.id,
    nome: f.nome,
    url: f.url,
    assunto: f.assunto,
    verificadoEm: f.verificadoEm?.toISOString() ?? null,
    mudouEm: f.mudouEm?.toISOString() ?? null,
    erro: f.erro,
    historico: f.verificacoes.map((v) => ({ em: v.em.toISOString(), mudou: v.mudou, novidades: v.novidades, erro: v.erro })),
  }));
  const itens = Object.entries(CONFIANCA) as [keyof typeof CONFIANCA, (typeof CONFIANCA)[keyof typeof CONFIANCA]][];

  return (
    <main className={`mx-auto flex ${TABLE_MAX_WIDTH} flex-col gap-6 px-6 py-12 lg:px-12`}>
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">Situação dos dados</h1>
        <p className="text-neutral-600 dark:text-neutral-400">
          Nem todo número do sistema tem o mesmo grau de certeza. Aqui está, num lugar só, o que foi conferido, o que precisa de
          revisão e o que é estimativa ou definição nossa, com o motivo de cada um. As mesmas marcas aparecem no topo das telas
          que dependem delas.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {ORDEM.map((n) => {
          const nivel = NIVEIS[n];
          const total = itens.filter(([, i]) => i.nivel === n).length;
          return (
            <div key={n} className={`rounded-lg border p-4 ${nivel.classes}`}>
              <div className="text-sm font-semibold">
                <span aria-hidden>{nivel.icone}</span> {nivel.rotulo} ({total})
              </div>
              <p className="mt-1 text-xs text-neutral-700 dark:text-neutral-300">{nivel.descricao}</p>
            </div>
          );
        })}
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">As fontes oficiais, conferidas toda semana</h2>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          Toda segunda-feira de manhã, o sistema visita na internet as fontes oficiais que o alimentam e anota o que mudou, sem baixar nada. Numa página, conta como mudança
          um arquivo novo publicado (ou um que saiu); no Portal da Transparência, um mês publicado que ainda não foi carregado; nas listas da Câmara e do Senado, um parlamentar
          que trocou de partido, entrou ou saiu. Em amarelo, o que mudou na última semana. O + abre o endereço da fonte e as últimas conferências, com o que apareceu de novo.
          Quando algo muda, é a hora de carregar a versão nova.
        </p>
        {fontes.length === 0 ? (
          <p className="text-sm text-neutral-500">Ainda não houve conferência.</p>
        ) : (
          <FontesMonitoradas fontes={fontes} podeVerificar={temAcessoPleno(usuario.papel)} />
        )}
      </section>

      {ORDEM.map((n) => (
        <section key={n} className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">{NIVEIS[n].rotulo}</h2>
          <div className="flex flex-col gap-2">
            {itens
              .filter(([, i]) => i.nivel === n)
              .map(([id]) => (
                <SeloConfianca key={id} id={id} />
              ))}
          </div>
        </section>
      ))}
    </main>
  );
}
