import { apiUrl } from "@/lib/basePath";

/** O que a API de simulações salvas devolve, como o navegador usa. */

export type Origem = "propria" | "compartilhada" | "de-outro-usuario";

export interface ItemSalvo {
  id: number;
  nome: string;
  tela: string;
  versao: number;
  atualizadoEm: string;
  origem: Origem;
  dono: { id: number; nome: string; email: string };
  atualizadoPor: string;
  compartilhadaCom: Array<{ id: number; nome: string }> | null;
}

export interface SalvoCompleto extends ItemSalvo {
  dados: unknown;
}

export interface Destinatario {
  id: number;
  nome: string;
  email: string;
}

export type RespostaApi<T> = { ok: true; dados: T } | { ok: false; status: number; erro: string; conflito?: { versaoAtual: number; atualizadoPor: string; atualizadoEm: string } };

async function chamar<T>(caminho: string, opcoes?: { metodo?: string; corpo?: unknown }): Promise<RespostaApi<T>> {
  try {
    const r = await fetch(apiUrl(caminho), {
      method: opcoes?.metodo ?? "GET",
      headers: opcoes?.corpo !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: opcoes?.corpo !== undefined ? JSON.stringify(opcoes.corpo) : undefined,
      cache: "no-store",
    });
    const json = (await r.json().catch(() => null)) as (T & { erro?: string; conflito?: { versaoAtual: number; atualizadoPor: string; atualizadoEm: string } }) | null;
    if (!r.ok) return { ok: false, status: r.status, erro: json?.erro ?? "Não consegui concluir. Tente de novo.", conflito: json?.conflito };
    return { ok: true, dados: json as T };
  } catch {
    return { ok: false, status: 0, erro: "Sem conexão com o servidor. Tente de novo." };
  }
}

export const salvos = {
  listar: (tela: string) => chamar<ItemSalvo[]>(`/api/configuracoes?tela=${encodeURIComponent(tela)}`),
  obter: (id: number) => chamar<SalvoCompleto>(`/api/configuracoes/${id}`),
  criar: (tela: string, nome: string, dados: unknown) => chamar<SalvoCompleto>("/api/configuracoes", { metodo: "POST", corpo: { tela, nome, dados } }),
  atualizar: (id: number, versaoEsperada: number, mudanca: { nome?: string; dados?: unknown }) =>
    chamar<SalvoCompleto>(`/api/configuracoes/${id}`, { metodo: "PUT", corpo: { versaoEsperada, ...mudanca } }),
  excluir: (id: number) => chamar<null>(`/api/configuracoes/${id}`, { metodo: "DELETE" }),
  destinatarios: () => chamar<Destinatario[]>("/api/configuracoes/destinatarios"),
  compartilhar: (id: number, usuarioIds: number[]) => chamar<Array<{ id: number; nome: string }>>(`/api/configuracoes/${id}/compartilhar`, { metodo: "PUT", corpo: { usuarioIds } }),
};
