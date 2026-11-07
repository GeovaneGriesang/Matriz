import type { Papel } from "@prisma/client";
import Link from "next/link";
import { FICHAS_DAS_TELAS, PERGUNTAS_DO_GUIA, TELAS_DE_ADMINISTRACAO, idDaFicha, type FichaDaTela } from "@/lib/guiaDasTelas";
import { TABLE_MAX_WIDTH, PROSE_LINK } from "@/lib/layoutWidths";
import { ITEM_INICIO, TODOS_OS_ITENS, gruposVisiveis } from "@/lib/menu";
import { podeVerValores } from "@/lib/permissoes";
import { requireAcessoPlenoOrRedirect } from "@/server/auth/session";
import { carregarAjustesDeTelas } from "@/server/queries/ajustesDeTelas";
import { carregarDadosDosExemplos } from "@/server/queries/exemplosDoGuia";
import { montarExemplos } from "@/lib/exemplosDoGuia";

export const dynamic = "force-dynamic";

const AVISOS = [
  {
    titulo: "Os números oficiais vêm da MDO",
    texto: "A matriz é calculada na MDO (mdo.iftm.edu.br), o sistema oficial da Rede Federal. Este sistema importa os resultados e os organiza para responder o que a MDO não mostra numa tela só.",
  },
  {
    titulo: "Simulação não é previsão",
    texto: 'As telas de "Simulações" estimam o efeito de uma decisão. Servem para dimensionar e comparar caminhos. O valor oficial continua sendo o que a MDO publicar.',
  },
  {
    titulo: "Calculado não é recebido",
    texto: "O valor gerado pela matriz é uma referência. Contingenciamento e emendas podem mudar o que chega ao câmpus. Por isso, no IFSul, os dois valores aparecem lado a lado.",
  },
];

/** Da menor para a maior permissão. Cada perfil lê só a própria linha e as de baixo: o que ele não acessa não entra no guia. */
const PERFIS: { papel: Papel; nome: string; acesso: string }[] = [
  { papel: "PADRAO", nome: "Padrão", acesso: "As telas definidas para o perfil, normalmente Início, Quanto recebemos?, Posso confiar?, Simulações, parte de Mais e Como funciona, além da própria conta." },
  { papel: "ADMIN", nome: "Administrador", acesso: "As telas definidas para o perfil, normalmente também as telas técnicas de Mais. Vê Valores recebidos e Correção manual sem alterar, e cadastra usuários de perfil padrão." },
  { papel: "SUPER_ADMIN", nome: "Super-admin", acesso: "Vê todas as telas, altera Valores recebidos e Correção manual, muda perfis, vê a Auditoria e escolhe as telas de cada perfil." },
];

function Ficha({ href, rotulo, ficha, exemplo }: { href: string; rotulo: string; ficha: FichaDaTela; exemplo?: string }) {
  const linha = "grid gap-x-4 gap-y-0.5 sm:grid-cols-[7rem_1fr]";
  const titulo = "text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400 sm:pt-0.5";
  return (
    <article id={idDaFicha(href)} className="flex scroll-mt-24 flex-col gap-2 rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4">
        <h3 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">{rotulo}</h3>
        <Link href={href} className={`text-sm ${PROSE_LINK}`}>
          Abrir a tela
        </Link>
      </div>
      <p className="text-sm font-medium text-if-green dark:text-green-400">{ficha.responde}</p>
      <dl className="flex flex-col gap-2 text-sm text-neutral-700 dark:text-neutral-300">
        {ficha.mostra && (
          <div className={linha}>
            <dt className={titulo}>O que mostra</dt>
            <dd>{ficha.mostra}</dd>
          </div>
        )}
        {ficha.abas && (
          <div className={linha}>
            <dt className={titulo}>Abas</dt>
            <dd>
              <ul className="flex list-disc flex-col gap-1 pl-4">
                {ficha.abas.map((a) => (
                  <li key={a.nome}>
                    <strong>{a.nome}:</strong> {a.texto}
                  </li>
                ))}
              </ul>
            </dd>
          </div>
        )}
        {ficha.usar && (
          <div className={linha}>
            <dt className={titulo}>Como usar</dt>
            <dd>{ficha.usar}</dd>
          </div>
        )}
        {exemplo && (
          <div className={linha}>
            <dt className={titulo}>Exemplo</dt>
            <dd className="rounded-md bg-if-green/10 px-2 py-1 text-neutral-800 dark:text-neutral-200">{exemplo}</dd>
          </div>
        )}
        {ficha.atencao && (
          <div className={linha}>
            <dt className={`${titulo} text-amber-800 dark:text-amber-300`}>Atenção</dt>
            <dd className="rounded-md bg-amber-50 px-2 py-1 text-amber-900 dark:bg-amber-950 dark:text-amber-200">{ficha.atencao}</dd>
          </div>
        )}
      </dl>
    </article>
  );
}

function Grupo({ titulo, pergunta, children }: { titulo: string; pergunta?: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <div className="border-t-2 border-if-green pt-3">
        <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">{titulo}</h2>
        {pergunta && <p className="text-sm text-neutral-500 dark:text-neutral-400">{pergunta}</p>}
      </div>
      {children}
    </section>
  );
}

/** O guia explica só o que o perfil de quem está lendo vê no menu: as telas dos outros perfis não entram (pedido do usuário em 2026-11-04). */
export default async function GuiaDasTelasPage() {
  const usuario = await requireAcessoPlenoOrRedirect("/como-funciona/telas");
  const grupos = gruposVisiveis(usuario.papel, await carregarAjustesDeTelas());
  const visiveis = new Set(grupos.flatMap((g) => g.itens.map((i) => i.href)));
  const perguntas = PERGUNTAS_DO_GUIA.filter((p) => visiveis.has(p.href));
  const perfis = PERFIS.slice(0, PERFIS.findIndex((p) => p.papel === usuario.papel) + 1);
  const administracao = podeVerValores(usuario.papel) ? TELAS_DE_ADMINISTRACAO.filter((t) => !t.somenteSuperAdmin || usuario.papel === "SUPER_ADMIN") : [];
  const exemplos = montarExemplos(await carregarDadosDosExemplos());
  const nomeDaTela = (href: string) => TODOS_OS_ITENS.find((i) => i.href === href)?.rotulo ?? href;

  return (
    <main data-sem-ferramentas className={`mx-auto flex w-full ${TABLE_MAX_WIDTH} flex-col gap-8 px-6 py-10 lg:px-12`}>
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold text-neutral-900 dark:text-neutral-100">Guia das telas</h1>
        <p className="text-neutral-600 dark:text-neutral-400">
          O que cada tela responde, como usar, um exemplo com números reais e que cuidado ter ao ler os números. As fichas seguem a ordem do menu e explicam as telas do seu perfil. Para entender o cálculo, veja{" "}
          <Link href="/como-funciona" className={PROSE_LINK}>
            Como a matriz é calculada
          </Link>
          .
        </p>
      </div>

      <section className="grid gap-3 md:grid-cols-3">
        {AVISOS.map((a) => (
          <div key={a.titulo} className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
            <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">{a.titulo}</h2>
            <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">{a.texto}</p>
          </div>
        ))}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">Por onde começar, conforme a pergunta</h2>
        <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-left text-xs uppercase text-neutral-500 dark:bg-neutral-900 dark:text-neutral-400">
              <tr>
                <th scope="col" className="px-4 py-2 font-medium">A pergunta</th>
                <th scope="col" className="px-4 py-2 font-medium">A tela</th>
              </tr>
            </thead>
            <tbody>
              {perguntas.map((p) => (
                <tr key={p.pergunta} className="border-t border-neutral-200 dark:border-neutral-800">
                  <td className="px-4 py-2 text-neutral-700 dark:text-neutral-300">{p.pergunta}</td>
                  <td className="px-4 py-2">
                    <a href={`#${idDaFicha(p.href)}`} className={PROSE_LINK}>
                      {nomeDaTela(p.href)}
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">{perfis.length > 1 ? "Quem vê o quê" : "O que o seu perfil vê"}</h2>
        <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-left text-xs uppercase text-neutral-500 dark:bg-neutral-900 dark:text-neutral-400">
              <tr>
                <th scope="col" className="w-36 px-4 py-2 font-medium">Perfil</th>
                <th scope="col" className="px-4 py-2 font-medium">Acesso</th>
              </tr>
            </thead>
            <tbody>
              {perfis.map((p) => (
                <tr key={p.papel} className="border-t border-neutral-200 dark:border-neutral-800">
                  <td className="whitespace-nowrap px-4 py-2 font-medium text-neutral-900 dark:text-neutral-100">{p.nome}</td>
                  <td className="px-4 py-2 text-neutral-700 dark:text-neutral-300">{p.acesso}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          Em quase todas as telas há botões para imprimir, gerar PDF e exportar CSV. O sistema também tem um assistente de chat para dúvidas. Ele é uma ajuda para encontrar informações, e os números de referência continuam sendo os das telas.
        </p>
      </section>

      <Grupo titulo="Início">
        <Ficha href="/" rotulo={ITEM_INICIO.rotulo} ficha={FICHAS_DAS_TELAS["/"]!} exemplo={exemplos["/"]} />
      </Grupo>

      {grupos.map((g) => (
        <Grupo key={g.id} titulo={g.rotulo} pergunta={g.pergunta}>
          {g.itens.map((i) => {
            const ficha = FICHAS_DAS_TELAS[i.href];
            return ficha ? <Ficha key={i.href} href={i.href} rotulo={i.rotulo} ficha={ficha} exemplo={exemplos[i.href]} /> : null;
          })}
        </Grupo>
      ))}

      {administracao.length > 0 && (
        <Grupo titulo="Administração" pergunta="Quem mantém os valores e os acessos?">
          {administracao.map((t) => (
            <Ficha key={t.href} href={t.href} rotulo={t.rotulo} ficha={t.ficha} exemplo={exemplos[t.href]} />
          ))}
        </Grupo>
      )}

      <p className="border-t border-neutral-200 pt-4 text-xs text-neutral-500 dark:border-neutral-800 dark:text-neutral-400">
        Termos: MDO, Matriz de Distribuição Orçamentária; PNP, Plataforma Nilo Peçanha; RAP, relação aluno-professor; IEA, Índice de Eficiência Acadêmica; IAPL, Atendimento aos Percentuais Legais; FIC, formação inicial e continuada; LOA e PLOA, Lei Orçamentária Anual e seu projeto.
      </p>
    </main>
  );
}
