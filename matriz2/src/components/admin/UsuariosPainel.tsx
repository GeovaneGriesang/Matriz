"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { Papel } from "@prisma/client";
import {
  criarUsuarioAction,
  resetarSenhaUsuarioAction,
  alternarAtivoUsuarioAction,
} from "@/server/actions/usuarios";
import { TabelaOrdenavel, type ColunaOrdenavel } from "@/components/TabelaOrdenavel";

interface UsuarioLinha {
  id: number;
  nome: string;
  email: string;
  papel: Papel;
  ativo: boolean;
  criadoEm: Date;
  ultimoLoginEm: Date | null;
}

const formatoData = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });

const ROTULO_PAPEL: Record<Papel, string> = {
  SUPER_ADMIN: "super-admin",
  ADMIN: "admin",
  PADRAO: "padrão",
};

/**
 * Painel de gestão de usuários: criar (manda e-mail de primeiro acesso), resetar
 * senha manualmente (reserva sem e-mail, gera senha temporária) e ativar/desativar.
 * A senha do reset manual só existe nesta resposta — não fica salva em lugar nenhum
 * — por isso fica destacada até o super-admin fechar o aviso.
 */
export function UsuariosPainel({ usuarios, meuId }: { usuarios: UsuarioLinha[]; meuId: number }) {
  const router = useRouter();
  const [avisoSegredo, setAvisoSegredo] = useState<{ email: string; rotulo: string; valor: string } | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState<string | null>(null);

  async function handleCriar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErro(null);
    setEnviando("criar");
    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email"));
    const resultado = await criarUsuarioAction(formData);
    setEnviando(null);
    if (!resultado.ok) {
      setErro(resultado.errorMessage ?? "Não foi possível criar o usuário.");
      return;
    }
    if (resultado.codigoGerado) {
      // E-mail falhou: resultado.aviso explica o motivo, sem impedir o cadastro.
      setErro(resultado.aviso ?? null);
      setAvisoSegredo({ email, rotulo: "Código de primeiro acesso", valor: resultado.codigoGerado });
    } else {
      setAvisoSegredo(null);
    }
    event.currentTarget.reset();
    router.refresh();
  }

  async function handleResetar(usuarioId: number, email: string) {
    setErro(null);
    setEnviando(`reset-${usuarioId}`);
    const formData = new FormData();
    formData.set("usuarioId", String(usuarioId));
    const resultado = await resetarSenhaUsuarioAction(formData);
    setEnviando(null);
    if (!resultado.ok) {
      setErro(resultado.errorMessage ?? "Não foi possível resetar a senha.");
      return;
    }
    setAvisoSegredo({ email, rotulo: "Senha temporária", valor: resultado.senhaGerada! });
    router.refresh();
  }

  async function handleAlternarAtivo(usuarioId: number) {
    setErro(null);
    setEnviando(`ativo-${usuarioId}`);
    const formData = new FormData();
    formData.set("usuarioId", String(usuarioId));
    const resultado = await alternarAtivoUsuarioAction(formData);
    setEnviando(null);
    if (!resultado.ok) {
      setErro(resultado.errorMessage ?? "Não foi possível alterar o status.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      {avisoSegredo && (
        <div className="flex flex-col gap-2 rounded-lg border border-if-green bg-green-50 p-4 text-sm dark:bg-green-950">
          <p className="text-neutral-900 dark:text-neutral-100">
            {avisoSegredo.rotulo} para <strong>{avisoSegredo.email}</strong> (anote agora, não será mostrada de
            novo):
          </p>
          <p className="w-fit rounded bg-white px-3 py-2 font-mono text-base dark:bg-neutral-900">
            {avisoSegredo.valor}
          </p>
          <button
            type="button"
            onClick={() => setAvisoSegredo(null)}
            className="w-fit text-xs text-neutral-500 underline hover:text-neutral-800 dark:hover:text-neutral-100"
          >
            Fechar
          </button>
        </div>
      )}

      {erro && (
        <p className="rounded-md bg-red-50 p-3 text-sm text-red-900 dark:bg-red-950 dark:text-red-200">{erro}</p>
      )}

      <form
        onSubmit={handleCriar}
        className="flex flex-wrap items-end gap-3 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800"
      >
        <div className="flex flex-col gap-1">
          <label htmlFor="nome" className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
            Nome
          </label>
          <input
            id="nome"
            name="nome"
            required
            className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="email" className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
            E-mail
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="papel" className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
            Papel
          </label>
          <select
            id="papel"
            name="papel"
            defaultValue="ADMIN"
            className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
          >
            <option value="PADRAO">Padrão</option>
            <option value="ADMIN">Admin</option>
            <option value="SUPER_ADMIN">Super-admin</option>
          </select>
        </div>
        <button
          type="submit"
          disabled={enviando === "criar"}
          className="rounded-md bg-if-green px-4 py-1.5 text-sm font-medium text-white hover:bg-if-green/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {enviando === "criar" ? "Criando..." : "Criar usuário"}
        </button>
      </form>
      <p className="-mt-3 text-xs text-neutral-500 dark:text-neutral-400">
        Ao criar, mandamos um e-mail com o código de primeiro acesso — a pessoa escolhe a própria senha em{" "}
        <code className="rounded bg-neutral-100 px-1 dark:bg-neutral-800">/admin/definir-senha</code>.
      </p>

      <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
        <TabelaOrdenavel
          className="w-full min-w-[720px] text-sm"
          linhas={usuarios}
          chaveLinha={(u) => u.id}
          colunas={
            [
              { chave: "nome", rotulo: "Nome", valor: (u) => u.nome, render: (u) => <span className="text-neutral-900 dark:text-neutral-100">{u.nome}</span> },
              { chave: "email", rotulo: "E-mail", valor: (u) => u.email, render: (u) => <span className="text-neutral-600 dark:text-neutral-400">{u.email}</span> },
              {
                chave: "perfil",
                rotulo: "Perfil",
                valor: (u) => u.papel,
                render: (u) => (
                  <span className={u.papel === "SUPER_ADMIN" ? "text-if-green" : undefined}>
                    {ROTULO_PAPEL[u.papel]}
                  </span>
                ),
              },
              {
                chave: "status",
                rotulo: "Status",
                valor: (u) => (u.ativo ? 1 : 0),
                render: (u) => (u.ativo ? "ativo" : <span className="text-red-600 dark:text-red-400">desativado</span>),
              },
              {
                chave: "ultimoLogin",
                rotulo: "Último login",
                valor: (u) => u.ultimoLoginEm?.getTime() ?? 0,
                render: (u) => (
                  <span className="text-neutral-500 dark:text-neutral-400">
                    {u.ultimoLoginEm ? formatoData.format(u.ultimoLoginEm) : "nunca"}
                  </span>
                ),
              },
              {
                chave: "acoes",
                rotulo: "Ações",
                ordenavel: false,
                valor: () => null,
                render: (u) => (
                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => handleResetar(u.id, u.email)}
                      disabled={enviando === `reset-${u.id}`}
                      className="text-xs font-medium text-neutral-600 underline hover:text-neutral-900 disabled:cursor-not-allowed disabled:opacity-50 dark:text-neutral-400 dark:hover:text-neutral-100"
                    >
                      Resetar senha
                    </button>
                    {u.id !== meuId && (
                      <button
                        type="button"
                        onClick={() => handleAlternarAtivo(u.id)}
                        disabled={enviando === `ativo-${u.id}`}
                        className="text-xs font-medium text-neutral-600 underline hover:text-neutral-900 disabled:cursor-not-allowed disabled:opacity-50 dark:text-neutral-400 dark:hover:text-neutral-100"
                      >
                        {u.ativo ? "Desativar" : "Reativar"}
                      </button>
                    )}
                  </div>
                ),
              },
            ] satisfies ColunaOrdenavel<(typeof usuarios)[number]>[]
          }
        />
      </div>
    </div>
  );
}
