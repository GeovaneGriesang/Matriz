/**
 * Regras das simulações e consultas salvas, sem banco nem tela, para poderem ser testadas.
 *
 * Quem pode o quê:
 *  - o dono vê, carrega, salva de novo, renomeia, compartilha e exclui;
 *  - quem recebeu o compartilhamento vê e carrega (e pode salvar uma cópia dele, com outro nome);
 *  - o super-administrador vê e carrega a de todos (com o nome do dono) e pode excluir, mas não sobrescrever a de outra pessoa.
 */

export type PapelDoUsuario = "SUPER_ADMIN" | "ADMIN" | "PADRAO";

export interface Ator {
  id: number;
  papel: PapelDoUsuario;
}

export interface ConfiguracaoParaPermissao {
  donoId: number;
  /** Ids de quem recebeu o compartilhamento. */
  compartilhadaComIds: number[];
}

export type OrigemDaConfiguracao = "propria" | "compartilhada" | "de-outro-usuario";

export const LIMITE_DE_NOME = 120;
export const LIMITE_DE_TELA = 160;
/** Tamanho máximo do estado guardado, em caracteres do JSON: uma simulação grande ocupa dezenas de milhares. */
export const LIMITE_DE_DADOS = 200_000;
export const LIMITE_POR_USUARIO = 200;

/** Só quem tem acesso pleno usa as telas que se salvam; o usuário PADRAO não vê nenhuma delas. */
export function podeUsar(ator: Ator): boolean {
  return ator.papel !== "PADRAO";
}

export function origemDaConfiguracao(ator: Ator, c: ConfiguracaoParaPermissao): OrigemDaConfiguracao | null {
  if (c.donoId === ator.id) return "propria";
  if (c.compartilhadaComIds.includes(ator.id)) return "compartilhada";
  if (ator.papel === "SUPER_ADMIN") return "de-outro-usuario";
  return null;
}

export const podeVer = (ator: Ator, c: ConfiguracaoParaPermissao) => podeUsar(ator) && origemDaConfiguracao(ator, c) !== null;
export const podeSobrescrever = (ator: Ator, c: ConfiguracaoParaPermissao) => podeUsar(ator) && c.donoId === ator.id;
export const podeCompartilhar = podeSobrescrever;
export const podeExcluir = (ator: Ator, c: ConfiguracaoParaPermissao) => podeUsar(ator) && (c.donoId === ator.id || ator.papel === "SUPER_ADMIN");

export type Validacao<T> = { ok: true; valor: T } | { ok: false; erro: string };

export function validarNome(nome: unknown): Validacao<string> {
  if (typeof nome !== "string") return { ok: false, erro: "Informe um nome." };
  const limpo = nome.replace(/\s+/g, " ").trim();
  if (limpo.length === 0) return { ok: false, erro: "Informe um nome." };
  if (limpo.length > LIMITE_DE_NOME) return { ok: false, erro: `O nome pode ter no máximo ${LIMITE_DE_NOME} caracteres.` };
  return { ok: true, valor: limpo };
}

export function validarTela(tela: unknown): Validacao<string> {
  if (typeof tela !== "string" || tela.length === 0 || tela.length > LIMITE_DE_TELA) return { ok: false, erro: "Tela inválida." };
  // A chave é só um identificador; alguns simuladores incluem o nome do curso nela (com espaços, acentos e parênteses).
  if (/[\u0000-\u001f\u007f<>]/.test(tela)) return { ok: false, erro: "Tela inválida." };
  return { ok: true, valor: tela };
}

export function validarDados(dados: unknown): Validacao<unknown> {
  if (dados === undefined) return { ok: false, erro: "Faltam os dados a salvar." };
  let texto: string;
  try {
    texto = JSON.stringify(dados);
  } catch {
    return { ok: false, erro: "Os dados não podem ser salvos." };
  }
  if (texto === undefined) return { ok: false, erro: "Faltam os dados a salvar." };
  if (texto.length > LIMITE_DE_DADOS) return { ok: false, erro: "A simulação é grande demais para ser salva. Reduza o número de cursos novos ou de paradas." };
  return { ok: true, valor: dados };
}

/** Um nome livre para uma cópia: "Nome (cópia)", "Nome (cópia 2)"... */
export function nomeParaCopia(nome: string, existentes: string[]): string {
  const usados = new Set(existentes.map((n) => n.toLowerCase()));
  const base = nome.replace(/ \(cópia( \d+)?\)$/, "");
  let candidato = `${base} (cópia)`;
  for (let i = 2; usados.has(candidato.toLowerCase()); i++) candidato = `${base} (cópia ${i})`;
  return candidato.slice(0, LIMITE_DE_NOME);
}
