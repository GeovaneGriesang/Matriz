"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { Papel } from "@prisma/client";
import { aprovarPedidoAcessoAction, recusarPedidoAcessoAction } from "@/server/actions/pedidosAcesso";
import { TabelaOrdenavel, type ColunaOrdenavel } from "@/components/TabelaOrdenavel";

export interface PedidoLinha {
  id: number;
  nome: string;
  email: string;
  unidadeId: number | null;
  motivo: string | null;
  criadoEm: Date;
}

export interface PedidoDecidido {
  id: number;
  nome: string;
  email: string;
  situacao: "APROVADO" | "RECUSADO";
  decididoEm: Date | null;
  decididoPor: string | null;
}

const formatoData = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });
const CAMPO = "rounded-md border border-neutral-300 px-2 py-1 text-sm dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100";
const BOTAO_LINK =
  "text-xs font-medium text-neutral-600 underline hover:text-neutral-900 disabled:cursor-not-allowed disabled:opacity-50 dark:text-neutral-400 dark:hover:text-neutral-100";

/**
 * Os pedidos de acesso feitos pelas próprias pessoas em /admin/pedir-acesso. A tabela só mostra; Aprovar abre logo abaixo da linha a
 * escolha do perfil (Padrão, salvo mudança) e do câmpus (o informado, salvo mudança); Recusar pede confirmação. Os dois avisam a
 * pessoa por e-mail.
 */
export function PedidosAcessoPainel({
  pedidos,
  decididos,
  campi,
  perfisQueCrio,
}: {
  pedidos: PedidoLinha[];
  decididos: PedidoDecidido[];
  campi: { id: number; nome: string }[];
  perfisQueCrio: Papel[];
}) {
  const router = useRouter();
  const nomeDoCampus = new Map(campi.map((c) => [c.id, c.nome]));
  const [aprovando, setAprovando] = useState<number | null>(null);
  const [enviando, setEnviando] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<{ texto: string; codigo?: string; email: string } | null>(null);

  async function handleAprovar(event: FormEvent<HTMLFormElement>, p: PedidoLinha) {
    event.preventDefault();
    setErro(null);
    setEnviando(`aprovar-${p.id}`);
    const formData = new FormData(event.currentTarget);
    formData.set("pedidoId", String(p.id));
    const r = await aprovarPedidoAcessoAction(formData);
    setEnviando(null);
    if (!r.ok) {
      setErro(r.errorMessage ?? "Não foi possível aprovar o pedido.");
      return;
    }
    setAprovando(null);
    setAviso(r.codigoGerado ? { texto: r.aviso ?? "", codigo: r.codigoGerado, email: p.email } : { texto: `Aprovado: ${p.nome} recebeu o código de primeiro acesso em ${p.email}.`, email: p.email });
    router.refresh();
  }

  async function handleRecusar(p: PedidoLinha) {
    if (!window.confirm(`Recusar o pedido de ${p.nome} (${p.email})? A pessoa recebe um e-mail dizendo que o pedido não foi aprovado.`)) return;
    setErro(null);
    setEnviando(`recusar-${p.id}`);
    const formData = new FormData();
    formData.set("pedidoId", String(p.id));
    const r = await recusarPedidoAcessoAction(formData);
    setEnviando(null);
    if (!r.ok) {
      setErro(r.errorMessage ?? "Não foi possível recusar o pedido.");
      return;
    }
    if (aprovando === p.id) setAprovando(null);
    setAviso({ texto: r.aviso ?? `Recusado: ${p.nome} recebeu o aviso em ${p.email}.`, email: p.email });
    router.refresh();
  }

  const emAprovacao = pedidos.find((p) => p.id === aprovando);

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
        Pedidos de acesso {pedidos.length > 0 && <span className="ml-1 rounded bg-amber-200 px-2 py-0.5 text-sm text-amber-900 dark:bg-amber-800 dark:text-amber-100">{pedidos.length} aguardando</span>}
      </h2>
      <p className="text-sm text-neutral-600 dark:text-neutral-400">
        Quem é do IFSul pede acesso em <code className="rounded bg-neutral-100 px-1 dark:bg-neutral-800">/admin/pedir-acesso</code>, sempre com o e-mail
        institucional (@ifsul.edu.br): pedido com outro e-mail é recusado na hora, com o aviso de que precisa ser o institucional. O pedido não é conta.
        Ao aprovar, a conta nasce com o perfil Padrão e o câmpus que a pessoa informou, a não ser que você mude antes de confirmar, e a pessoa recebe o
        código de primeiro acesso no e-mail. Ao recusar, ela recebe um e-mail dizendo que o pedido não foi aprovado. Para divulgar a um câmpus, o link
        pode já vir com ele marcado: <code className="rounded bg-neutral-100 px-1 dark:bg-neutral-800">/admin/pedir-acesso?campus=venancio-aires</code>.
      </p>

      {aviso && (
        <div className="flex flex-col gap-2 rounded-lg border border-if-green bg-green-50 p-3 text-sm dark:bg-green-950">
          <p className="text-neutral-900 dark:text-neutral-100">{aviso.texto}</p>
          {aviso.codigo && (
            <p className="w-fit rounded bg-white px-3 py-2 font-mono text-base dark:bg-neutral-900">
              {aviso.codigo} <span className="ml-2 font-sans text-xs text-neutral-500">(para {aviso.email}; não será mostrado de novo)</span>
            </p>
          )}
          <button type="button" onClick={() => setAviso(null)} className="w-fit text-xs text-neutral-500 underline hover:text-neutral-800 dark:hover:text-neutral-100">
            Fechar
          </button>
        </div>
      )}
      {erro && <p className="rounded-md bg-red-50 p-3 text-sm text-red-900 dark:bg-red-950 dark:text-red-200">{erro}</p>}

      {pedidos.length === 0 ? (
        <p className="text-sm text-neutral-500">Nenhum pedido aguardando.</p>
      ) : (
        <div className="tabela-rolavel rounded-lg border border-neutral-200 dark:border-neutral-800">
          <TabelaOrdenavel
            className="w-full min-w-[720px] text-sm"
            linhas={pedidos}
            chaveLinha={(p) => p.id}
            detalhe={
              emAprovacao
                ? {
                    chave: emAprovacao.id,
                    conteudo: (
                      <form key={emAprovacao.id} onSubmit={(e) => handleAprovar(e, emAprovacao)} className="flex flex-wrap items-end gap-3 bg-neutral-50 p-3 dark:bg-neutral-900">
                        <label className="flex flex-col gap-1 text-xs font-medium text-neutral-700 dark:text-neutral-300">
                          Perfil
                          <select name="papel" defaultValue="PADRAO" className={CAMPO}>
                            {perfisQueCrio.map((p) => (
                              <option key={p} value={p}>
                                {p === "ADMIN" ? "Admin" : "Padrão"}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="flex flex-col gap-1 text-xs font-medium text-neutral-700 dark:text-neutral-300">
                          Câmpus
                          <select name="unidadeId" required defaultValue={emAprovacao.unidadeId ?? ""} className={CAMPO}>
                            <option value="" disabled>
                              Escolha
                            </option>
                            {campi.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.nome}
                              </option>
                            ))}
                          </select>
                        </label>
                        <button
                          type="submit"
                          disabled={enviando === `aprovar-${emAprovacao.id}`}
                          className="rounded-md bg-if-green px-3 py-1.5 text-sm font-medium text-white hover:bg-if-green/90 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {enviando === `aprovar-${emAprovacao.id}` ? "Aprovando..." : "Aprovar e enviar o código"}
                        </button>
                        <button type="button" onClick={() => setAprovando(null)} className={BOTAO_LINK}>
                          Cancelar
                        </button>
                      </form>
                    ),
                  }
                : null
            }
            colunas={
              [
                { chave: "data", rotulo: "Pedido em", valor: (p) => p.criadoEm.getTime(), render: (p) => <span className="text-neutral-500">{formatoData.format(p.criadoEm)}</span> },
                { chave: "nome", rotulo: "Nome", valor: (p) => p.nome },
                { chave: "email", rotulo: "E-mail", valor: (p) => p.email, render: (p) => <span className="text-neutral-600 dark:text-neutral-400">{p.email}</span> },
                { chave: "campus", rotulo: "Câmpus informado", valor: (p) => (p.unidadeId !== null ? (nomeDoCampus.get(p.unidadeId) ?? "") : "") },
                { chave: "motivo", rotulo: "Setor ou motivo", valor: (p) => p.motivo ?? "", render: (p) => <span className="text-xs text-neutral-600 dark:text-neutral-400">{p.motivo ?? ""}</span> },
                {
                  chave: "acoes",
                  rotulo: "Ações",
                  ordenavel: false,
                  valor: () => null,
                  render: (p) => (
                    <div className="flex flex-wrap gap-3">
                      <button type="button" onClick={() => setAprovando(aprovando === p.id ? null : p.id)} className={BOTAO_LINK}>
                        {aprovando === p.id ? "Fechar" : "Aprovar"}
                      </button>
                      <button type="button" onClick={() => handleRecusar(p)} disabled={enviando === `recusar-${p.id}`} className={BOTAO_LINK}>
                        Recusar
                      </button>
                    </div>
                  ),
                },
              ] satisfies ColunaOrdenavel<PedidoLinha>[]
            }
          />
        </div>
      )}

      {decididos.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer text-neutral-600 dark:text-neutral-400">Últimos pedidos decididos ({decididos.length})</summary>
          <ul className="mt-2 flex flex-col gap-1 text-neutral-700 dark:text-neutral-300">
            {decididos.map((d) => (
              <li key={d.id}>
                {d.decididoEm ? formatoData.format(d.decididoEm) : ""}: {d.nome} ({d.email}),{" "}
                <span className={d.situacao === "APROVADO" ? "text-if-green" : "text-red-600 dark:text-red-400"}>{d.situacao === "APROVADO" ? "aprovado" : "recusado"}</span>
                {d.decididoPor ? ` por ${d.decididoPor}` : ""}
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
