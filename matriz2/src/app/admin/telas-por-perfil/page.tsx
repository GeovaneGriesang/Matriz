import { AdminHeader } from "@/components/admin/AdminHeader";
import { TelasPorPerfilPainel } from "@/components/admin/TelasPorPerfilPainel";
import { ComoLerEstaTela } from "@/components/ComoLerEstaTela";
import { TABLE_MAX_WIDTH } from "@/lib/layoutWidths";
import { GRUPOS_MENU, PERFIS_CONFIGURAVEIS, chaveDaMarcacao, marcacoesAtuais, visivelNaPreConfiguracao } from "@/lib/menu";
import { requireSuperAdminOrRedirect } from "@/server/auth/session";
import { carregarAjustesDeTelas } from "@/server/queries/ajustesDeTelas";

export const dynamic = "force-dynamic";

export default async function TelasPorPerfilPage() {
  const usuario = await requireSuperAdminOrRedirect("/admin/telas-por-perfil");
  const ajustes = await carregarAjustesDeTelas();

  const grupos = GRUPOS_MENU.map((g) => ({
    id: g.id,
    rotulo: g.rotulo,
    telas: g.itens.filter((i) => !i.somenteSuperAdmin).map((i) => ({ href: i.href, rotulo: i.rotulo, descricao: i.descricao })),
  })).filter((g) => g.telas.length > 0);
  const preConfiguracao = GRUPOS_MENU.flatMap((g) => g.itens).flatMap((i) =>
    PERFIS_CONFIGURAVEIS.filter((p) => visivelNaPreConfiguracao(i, p)).map((p) => chaveDaMarcacao(p, i.href)),
  );

  return (
    <main data-sem-ferramentas className={`mx-auto flex w-full ${TABLE_MAX_WIDTH} flex-col gap-6 px-6 py-12 lg:px-12`}>
      <AdminHeader usuario={usuario} atual="/admin/telas-por-perfil" />

      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">Telas por perfil</h1>
        <p className="text-neutral-600 dark:text-neutral-400">Marque as telas que cada perfil vê no menu e clique em Salvar. A pré-configuração é a que o sistema já usava.</p>
      </div>

      <ComoLerEstaTela>
        <p>
          <strong>O que muda:</strong> o menu, a página inicial e o Guia das telas daquele perfil. Por exemplo, ao desmarcar Comparativo entre anos na coluna Padrão, quem tem esse perfil deixa de ver essa tela nos três lugares, incluindo os atalhos da página inicial. Se um grupo
          do menu ficar sem nenhuma tela, ele some.
        </p>
        <p>
          <strong>O que não muda:</strong> quem tem o endereço de uma tela continua conseguindo abri-la. Links dentro do texto de outras telas também continuam. Esta configuração organiza o que cada perfil vê, mas não é uma trava de segurança. As permissões de Valores recebidos, Correção manual,
          Usuários e Auditoria também não passam por aqui.
        </p>
        <p>
          <strong>Abas:</strong> uma tela com abas conta como uma só, então as abas acompanham a tela. Início aparece sempre, e o super-admin vê todas as telas, para ninguém perder o acesso a esta configuração.
        </p>
        <p>
          <strong>Telas novas:</strong> a marca &quot;alterada&quot; indica o que está diferente da pré-configuração. Só essas diferenças ficam gravadas, então uma tela nova entra no sistema com a pré-configuração dela.
        </p>
      </ComoLerEstaTela>

      <TelasPorPerfilPainel grupos={grupos} preConfiguracao={preConfiguracao} marcadasIniciais={marcacoesAtuais(ajustes)} />
    </main>
  );
}
