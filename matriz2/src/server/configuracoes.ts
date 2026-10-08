import { Prisma } from "@prisma/client";
import { prisma } from "@/server/db/prisma";
import {
  LIMITE_POR_USUARIO,
  origemDaConfiguracao,
  podeCompartilhar,
  podeExcluir,
  podeSobrescrever,
  podeUsar,
  podeVer,
  validarDados,
  validarNome,
  validarTela,
  type Ator,
  type OrigemDaConfiguracao,
} from "@/lib/configuracoes/regras";

/**
 * Simulações e consultas salvas: as operações no banco, com as regras de permissão e a trava de edição simultânea.
 *
 * A trava é otimista: cada configuração tem uma `versao`, e quem salva informa a versão que carregou. O salvamento só vale se ninguém
 * salvou no meio (a comparação e o incremento acontecem num único UPDATE). Se alguém salvou, o salvamento é recusado com os dados de
 * quem salvou e quando, e a pessoa escolhe entre recarregar ou salvar uma cópia. Assim duas pessoas (ou duas janelas) nunca
 * sobrescrevem o trabalho uma da outra sem perceber.
 */

export interface ItemDeLista {
  id: number;
  nome: string;
  tela: string;
  versao: number;
  atualizadoEm: string;
  origem: OrigemDaConfiguracao;
  dono: { id: number; nome: string; email: string };
  atualizadoPor: string;
  /** Com quem foi compartilhada; só aparece para o dono e para o super-administrador. */
  compartilhadaCom: Array<{ id: number; nome: string }> | null;
}

export interface ConfiguracaoCompleta extends ItemDeLista {
  dados: unknown;
}

export type Resultado<T> =
  | { ok: true; valor: T }
  | { ok: false; status: number; erro: string; conflito?: { versaoAtual: number; atualizadoPor: string; atualizadoEm: string } };

const falha = (status: number, erro: string): { ok: false; status: number; erro: string } => ({ ok: false, status, erro });

const incluir = {
  dono: { select: { id: true, nome: true, email: true } },
  atualizadoPor: { select: { nome: true } },
  compartilhadaCom: { select: { usuarioId: true, usuario: { select: { id: true, nome: true } } } },
} satisfies Prisma.ConfiguracaoSalvaInclude;

type Linha = Prisma.ConfiguracaoSalvaGetPayload<{ include: typeof incluir }>;

function paraItem(ator: Ator, c: Linha): ItemDeLista {
  const origem = origemDaConfiguracao(ator, { donoId: c.donoId, compartilhadaComIds: c.compartilhadaCom.map((x) => x.usuarioId) }) ?? "de-outro-usuario";
  return {
    id: c.id,
    nome: c.nome,
    tela: c.tela,
    versao: c.versao,
    atualizadoEm: c.atualizadoEm.toISOString(),
    origem,
    dono: c.dono,
    atualizadoPor: c.atualizadoPor.nome,
    compartilhadaCom: origem === "compartilhada" ? null : c.compartilhadaCom.map((x) => x.usuario),
  };
}

const paraPermissao = (c: Linha) => ({ donoId: c.donoId, compartilhadaComIds: c.compartilhadaCom.map((x) => x.usuarioId) });

/** As configurações de uma tela que a pessoa pode ver: as suas, as compartilhadas com ela e, para o super-administrador, as de todos. */
export async function listar(ator: Ator, tela: string): Promise<Resultado<ItemDeLista[]>> {
  if (!podeUsar(ator)) return falha(403, "Sem acesso.");
  const t = validarTela(tela);
  if (!t.ok) return falha(400, t.erro);
  const linhas = await prisma.configuracaoSalva.findMany({
    where: {
      tela: t.valor,
      ...(ator.papel === "SUPER_ADMIN" ? {} : { OR: [{ donoId: ator.id }, { compartilhadaCom: { some: { usuarioId: ator.id } } }] }),
    },
    include: incluir,
    orderBy: [{ atualizadoEm: "desc" }],
  });
  return { ok: true, valor: linhas.map((l) => paraItem(ator, l)) };
}

export async function obter(ator: Ator, id: number): Promise<Resultado<ConfiguracaoCompleta>> {
  if (!podeUsar(ator)) return falha(403, "Sem acesso.");
  const c = await prisma.configuracaoSalva.findUnique({ where: { id }, include: incluir });
  if (!c || !podeVer(ator, paraPermissao(c))) return falha(404, "Não encontrei essa simulação.");
  return { ok: true, valor: { ...paraItem(ator, c), dados: c.dados } };
}

export async function criar(ator: Ator, entrada: { tela: unknown; nome: unknown; dados: unknown }): Promise<Resultado<ConfiguracaoCompleta>> {
  if (!podeUsar(ator)) return falha(403, "Sem acesso.");
  const tela = validarTela(entrada.tela);
  if (!tela.ok) return falha(400, tela.erro);
  const nome = validarNome(entrada.nome);
  if (!nome.ok) return falha(400, nome.erro);
  const dados = validarDados(entrada.dados);
  if (!dados.ok) return falha(400, dados.erro);
  if ((await prisma.configuracaoSalva.count({ where: { donoId: ator.id } })) >= LIMITE_POR_USUARIO) {
    return falha(400, `Você já tem ${LIMITE_POR_USUARIO} simulações salvas. Exclua alguma para salvar outra.`);
  }
  try {
    const c = await prisma.configuracaoSalva.create({
      data: { donoId: ator.id, tela: tela.valor, nome: nome.valor, dados: dados.valor as Prisma.InputJsonValue, atualizadoPorId: ator.id },
      include: incluir,
    });
    return { ok: true, valor: { ...paraItem(ator, c), dados: c.dados } };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return falha(409, "Você já tem uma simulação com esse nome nesta tela. Escolha outro nome ou salve por cima dela.");
    throw e;
  }
}

/** Salva por cima (dados) e/ou renomeia, só o dono, só se a versão carregada ainda for a atual. */
export async function atualizar(
  ator: Ator,
  id: number,
  entrada: { versaoEsperada: unknown; nome?: unknown; dados?: unknown },
): Promise<Resultado<ConfiguracaoCompleta>> {
  if (!podeUsar(ator)) return falha(403, "Sem acesso.");
  const atual = await prisma.configuracaoSalva.findUnique({ where: { id }, include: incluir });
  if (!atual || !podeVer(ator, paraPermissao(atual))) return falha(404, "Não encontrei essa simulação.");
  if (!podeSobrescrever(ator, paraPermissao(atual))) return falha(403, "Só quem criou a simulação pode alterá-la. Salve uma cópia sua.");
  if (typeof entrada.versaoEsperada !== "number" || !Number.isInteger(entrada.versaoEsperada)) return falha(400, "Falta a versão carregada.");

  const data: Prisma.ConfiguracaoSalvaUncheckedUpdateManyInput = {};
  if (entrada.nome !== undefined) {
    const nome = validarNome(entrada.nome);
    if (!nome.ok) return falha(400, nome.erro);
    data.nome = nome.valor;
  }
  if (entrada.dados !== undefined) {
    const dados = validarDados(entrada.dados);
    if (!dados.ok) return falha(400, dados.erro);
    data.dados = dados.valor as Prisma.InputJsonValue;
  }
  if (Object.keys(data).length === 0) return falha(400, "Nada a alterar.");

  try {
    // A comparação da versão e o incremento são um só UPDATE: dois salvamentos ao mesmo tempo não passam os dois.
    const r = await prisma.configuracaoSalva.updateMany({
      where: { id, donoId: ator.id, versao: entrada.versaoEsperada },
      data: { ...data, versao: { increment: 1 }, atualizadoPorId: ator.id },
    });
    if (r.count === 0) {
      const agora = await prisma.configuracaoSalva.findUnique({ where: { id }, include: incluir });
      if (!agora) return falha(404, "A simulação foi excluída.");
      return {
        ok: false,
        status: 409,
        erro: `Outra pessoa ou outra janela salvou esta simulação depois de você a carregar (${agora.atualizadoPor.nome}, versão ${agora.versao}). Carregue de novo para ver a versão dela, ou salve a sua como cópia.`,
        conflito: { versaoAtual: agora.versao, atualizadoPor: agora.atualizadoPor.nome, atualizadoEm: agora.atualizadoEm.toISOString() },
      };
    }
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return falha(409, "Você já tem uma simulação com esse nome nesta tela.");
    throw e;
  }
  const depois = await prisma.configuracaoSalva.findUniqueOrThrow({ where: { id }, include: incluir });
  return { ok: true, valor: { ...paraItem(ator, depois), dados: depois.dados } };
}

export async function excluir(ator: Ator, id: number): Promise<Resultado<null>> {
  if (!podeUsar(ator)) return falha(403, "Sem acesso.");
  const c = await prisma.configuracaoSalva.findUnique({ where: { id }, include: incluir });
  if (!c || !podeVer(ator, paraPermissao(c))) return falha(404, "Não encontrei essa simulação.");
  if (!podeExcluir(ator, paraPermissao(c))) return falha(403, "Só quem criou a simulação pode excluí-la.");
  await prisma.configuracaoSalva.delete({ where: { id } });
  return { ok: true, valor: null };
}

/** Quem pode receber um compartilhamento: usuários ativos com acesso pleno, menos a própria pessoa. */
export async function destinatarios(ator: Ator): Promise<Resultado<Array<{ id: number; nome: string; email: string }>>> {
  if (!podeUsar(ator)) return falha(403, "Sem acesso.");
  const u = await prisma.usuario.findMany({
    where: { ativo: true, id: { not: ator.id } },
    select: { id: true, nome: true, email: true },
    orderBy: { nome: "asc" },
  });
  return { ok: true, valor: u };
}

/** Define, de uma vez, com quem a configuração é compartilhada (substitui a lista anterior). */
export async function compartilhar(ator: Ator, id: number, usuarioIds: unknown): Promise<Resultado<Array<{ id: number; nome: string }>>> {
  if (!podeUsar(ator)) return falha(403, "Sem acesso.");
  if (!Array.isArray(usuarioIds) || !usuarioIds.every((n) => Number.isInteger(n))) return falha(400, "Lista de usuários inválida.");
  const c = await prisma.configuracaoSalva.findUnique({ where: { id }, include: incluir });
  if (!c || !podeVer(ator, paraPermissao(c))) return falha(404, "Não encontrei essa simulação.");
  if (!podeCompartilhar(ator, paraPermissao(c))) return falha(403, "Só quem criou a simulação pode compartilhá-la.");

  const validos = await prisma.usuario.findMany({
    where: { id: { in: usuarioIds as number[], not: ator.id }, ativo: true },
    select: { id: true, nome: true },
  });
  const ids = validos.map((v) => v.id);
  await prisma.$transaction([
    prisma.configuracaoCompartilhada.deleteMany({ where: { configuracaoId: id, usuarioId: { notIn: ids } } }),
    prisma.configuracaoCompartilhada.createMany({ data: ids.map((usuarioId) => ({ configuracaoId: id, usuarioId })), skipDuplicates: true }),
  ]);
  return { ok: true, valor: validos };
}
