"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { PERFIS_CONFIGURAVEIS, chaveDaMarcacao } from "@/lib/menu";
import { salvarTelasPorPerfilAction } from "@/server/actions/telasPorPerfil";

const NOME_DO_PERFIL = { ADMIN: "Administrador", PADRAO: "Padrão" } as const;

const mesmoConjunto = (a: Set<string>, b: Set<string>) => a.size === b.size && [...a].every((x) => b.has(x));

interface GrupoDaTela {
  id: string;
  rotulo: string;
  telas: { href: string; rotulo: string; descricao: string }[];
}

/** A grade de marcações: uma linha por tela do menu, uma coluna por perfil. Nada vale até clicar em Salvar. */
export function TelasPorPerfilPainel({ grupos, preConfiguracao, marcadasIniciais }: { grupos: GrupoDaTela[]; preConfiguracao: string[]; marcadasIniciais: string[] }) {
  const router = useRouter();
  const [gravadas, setGravadas] = useState(() => new Set(marcadasIniciais));
  const [marcadas, setMarcadas] = useState(() => new Set(marcadasIniciais));
  const [mensagem, setMensagem] = useState<{ ok: boolean; texto: string } | null>(null);
  const [salvando, iniciar] = useTransition();
  const pre = useMemo(() => new Set(preConfiguracao), [preConfiguracao]);

  const semSalvar = !mesmoConjunto(marcadas, gravadas);
  const naPreConfiguracao = mesmoConjunto(marcadas, pre);

  function alternar(chave: string) {
    setMensagem(null);
    setMarcadas((atual) => {
      const nova = new Set(atual);
      if (nova.has(chave)) nova.delete(chave);
      else nova.add(chave);
      return nova;
    });
  }

  function salvar() {
    iniciar(async () => {
      const copia = new Set(marcadas);
      const r = await salvarTelasPorPerfilAction([...copia]);
      if (!r.ok) {
        setMensagem({ ok: false, texto: r.errorMessage ?? "Não foi possível salvar." });
        return;
      }
      setGravadas(copia);
      setMensagem({ ok: true, texto: "Salvo. O menu de cada perfil já segue esta escolha." });
      router.refresh();
    });
  }

  const botoes = (
    <div className="flex flex-wrap items-center gap-3">
      <button type="button" onClick={salvar} disabled={!semSalvar || salvando} className="rounded-md bg-if-green px-4 py-2 text-sm font-medium text-white hover:bg-if-green/90 disabled:opacity-50">
        {salvando ? "Salvando..." : "Salvar"}
      </button>
      <button
        type="button"
        onClick={() => {
          setMensagem(null);
          setMarcadas(new Set(pre));
        }}
        disabled={naPreConfiguracao || salvando}
        className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100 disabled:opacity-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
      >
        Voltar à pré-configuração
      </button>
      {semSalvar && <span className="text-sm text-amber-800 dark:text-amber-300">Há mudanças ainda não salvas.</span>}
      {mensagem && (
        <span role="status" className={`text-sm ${mensagem.ok ? "text-if-green dark:text-green-400" : "text-if-red dark:text-red-400"}`}>
          {mensagem.texto}
        </span>
      )}
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      {botoes}
      <div className="tabela-rolavel rounded-lg border border-neutral-200 dark:border-neutral-800">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wide text-neutral-500">
            <tr className="border-b border-neutral-200 dark:border-neutral-800">
              <th className="px-3 py-2">Tela</th>
              {PERFIS_CONFIGURAVEIS.map((p) => (
                <th key={p} className="w-32 px-3 py-2 text-center">
                  {NOME_DO_PERFIL[p]}
                </th>
              ))}
              <th className="w-28 px-3 py-2 text-center">Super-admin</th>
            </tr>
          </thead>
          {grupos.map((g) => (
            <tbody key={g.id} className="divide-y divide-neutral-200 border-b border-neutral-200 last:border-b-0 dark:divide-neutral-800 dark:border-neutral-800">
              <tr className="bg-neutral-50 dark:bg-neutral-900">
                <th colSpan={4} scope="colgroup" className="px-3 py-2 text-left font-semibold text-neutral-900 dark:text-neutral-100">
                  {g.rotulo}
                </th>
              </tr>
              {g.telas.map((t) => {
                const alterada = PERFIS_CONFIGURAVEIS.some((p) => marcadas.has(chaveDaMarcacao(p, t.href)) !== pre.has(chaveDaMarcacao(p, t.href)));
                return (
                  <tr key={t.href}>
                    <td className="px-3 py-2">
                      <span className="font-medium text-neutral-900 dark:text-neutral-100">{t.rotulo}</span>
                      {alterada && <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-900 dark:bg-amber-950 dark:text-amber-200">alterada</span>}
                      <p className="text-xs text-neutral-500 dark:text-neutral-400">{t.descricao}</p>
                    </td>
                    {PERFIS_CONFIGURAVEIS.map((p) => {
                      const chave = chaveDaMarcacao(p, t.href);
                      return (
                        <td key={p} className="px-3 py-2 text-center">
                          <input
                            type="checkbox"
                            checked={marcadas.has(chave)}
                            onChange={() => alternar(chave)}
                            aria-label={`${t.rotulo}, perfil ${NOME_DO_PERFIL[p]}`}
                            className="h-4 w-4 accent-if-green"
                          />
                        </td>
                      );
                    })}
                    <td className="px-3 py-2 text-center text-xs text-neutral-500 dark:text-neutral-400">sempre</td>
                  </tr>
                );
              })}
            </tbody>
          ))}
        </table>
      </div>
      {botoes}
    </div>
  );
}
