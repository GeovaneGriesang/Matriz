"use client";

import { TabelaOrdenavel, type ColunaOrdenavel } from "@/components/TabelaOrdenavel";

interface RegistroLinha {
  id: number;
  criadoEm: Date;
  usuario: { nome: string; email: string } | null;
  acao: string;
  detalhe: unknown;
  ip: string | null;
}

const formatoData = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "medium" });

/**
 * Client Component só para hospedar `colunas` (com funções `valor`/`render`):
 * `TabelaOrdenavel` é "use client", e uma função não atravessa a fronteira de
 * Server para Client Component como prop — precisa nascer já do lado do cliente.
 * A página (Server Component) só entrega os dados, sem nenhuma função nas props.
 */
export function AuditoriaTabela({ registros }: { registros: RegistroLinha[] }) {
  return (
    <TabelaOrdenavel
      className="w-full min-w-[720px] text-sm"
      linhas={registros}
      chaveLinha={(r) => r.id}
      corpoVazio={
        <tr>
          <td colSpan={5} className="px-4 py-6 text-center text-neutral-500 dark:text-neutral-400">
            Nenhum registro para este filtro.
          </td>
        </tr>
      }
      colunas={
        [
          {
            chave: "quando",
            rotulo: "Quando",
            valor: (r) => r.criadoEm.getTime(),
            render: (r) => (
              <span className="whitespace-nowrap text-neutral-500 dark:text-neutral-400">
                {formatoData.format(r.criadoEm)}
              </span>
            ),
          },
          {
            chave: "quem",
            rotulo: "Quem",
            valor: (r) => r.usuario?.nome ?? "(sistema)",
            render: (r) => (
              <span className="text-neutral-900 dark:text-neutral-100">{r.usuario ? r.usuario.nome : "(sistema)"}</span>
            ),
          },
          {
            chave: "acao",
            rotulo: "Ação",
            valor: (r) => r.acao,
            render: (r) => <span className="font-mono text-xs text-neutral-700 dark:text-neutral-300">{r.acao}</span>,
          },
          {
            chave: "detalhe",
            rotulo: "Detalhe",
            ordenavel: false,
            valor: () => null,
            render: (r) => (
              <span className="font-mono text-xs text-neutral-500 dark:text-neutral-400">
                {r.detalhe ? JSON.stringify(r.detalhe) : ""}
              </span>
            ),
          },
          {
            chave: "ip",
            rotulo: "IP",
            valor: (r) => r.ip ?? "",
            render: (r) => <span className="text-neutral-500 dark:text-neutral-400">{r.ip ?? ""}</span>,
          },
        ] satisfies ColunaOrdenavel<RegistroLinha>[]
      }
    />
  );
}
