import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { atualizar, compartilhar, criar, destinatarios, excluir, listar, obter } from "@/server/configuracoes";

/**
 * Simulações e consultas salvas contra o banco: permissões, compartilhamento e a trava de edição simultânea.
 * Cria três usuários temporários (dono, colega, super-administrador) e apaga tudo no fim. Se não houver banco, os testes se declaram pulados.
 */

const prisma = new PrismaClient();
const TELA = "teste/configuracoes";
const emails = ["teste-config-dono@localhost.test", "teste-config-colega@localhost.test", "teste-config-super@localhost.test", "teste-config-padrao@localhost.test"];
let disponivel = false;
let dono: { id: number; papel: "ADMIN" };
let colega: { id: number; papel: "ADMIN" };
let superAdmin: { id: number; papel: "SUPER_ADMIN" };
let padrao: { id: number; papel: "PADRAO" };

async function limpar() {
  const us = await prisma.usuario.findMany({ where: { email: { in: emails } }, select: { id: true } });
  const ids = us.map((u) => u.id);
  await prisma.configuracaoSalva.deleteMany({ where: { donoId: { in: ids } } });
  await prisma.usuario.deleteMany({ where: { id: { in: ids } } });
}

beforeAll(async () => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    await prisma.configuracaoSalva.count();
    disponivel = true;
  } catch {
    return;
  }
  await limpar();
  const mk = (email: string, papel: "ADMIN" | "SUPER_ADMIN" | "PADRAO") => prisma.usuario.create({ data: { email, nome: email.split("@")[0]!, papel } });
  dono = { id: (await mk(emails[0]!, "ADMIN")).id, papel: "ADMIN" };
  colega = { id: (await mk(emails[1]!, "ADMIN")).id, papel: "ADMIN" };
  superAdmin = { id: (await mk(emails[2]!, "SUPER_ADMIN")).id, papel: "SUPER_ADMIN" };
  padrao = { id: (await mk(emails[3]!, "PADRAO")).id, papel: "PADRAO" };
});

afterAll(async () => {
  if (disponivel) await limpar();
  await prisma.$disconnect();
});

describe("simulações salvas", () => {
  it("o dono salva, lista e carrega; o nome não se repete na mesma tela", async () => {
    if (!disponivel) return;
    const criada = await criar(dono, { tela: TELA, nome: "  Meu cenário  ", dados: { anos: 7 } });
    expect(criada.ok).toBe(true);
    if (!criada.ok) return;
    expect(criada.valor.nome).toBe("Meu cenário");
    expect(criada.valor.versao).toBe(1);
    expect(criada.valor.origem).toBe("propria");

    const repetida = await criar(dono, { tela: TELA, nome: "Meu cenário", dados: {} });
    expect(repetida.ok).toBe(false);
    if (!repetida.ok) expect(repetida.status).toBe(409);

    const lista = await listar(dono, TELA);
    expect(lista.ok && lista.valor.map((c) => c.nome)).toEqual(["Meu cenário"]);
    const completa = await obter(dono, criada.valor.id);
    expect(completa.ok && completa.valor.dados).toEqual({ anos: 7 });
  });

  it("outro usuário não vê nem carrega, até o dono compartilhar; depois só carrega", async () => {
    if (!disponivel) return;
    const lista = await listar(dono, TELA);
    if (!lista.ok) throw new Error("lista");
    const id = lista.valor[0]!.id;

    expect((await listar(colega, TELA)).ok && (await listar(colega, TELA)).ok).toBe(true);
    const antes = await listar(colega, TELA);
    expect(antes.ok && antes.valor.length).toBe(0);
    const semAcesso = await obter(colega, id);
    expect(!semAcesso.ok && semAcesso.status).toBe(404);

    const comp = await compartilhar(dono, id, [colega.id, dono.id, padrao.id, 999999]);
    // Só entra quem é usuário ativo com acesso pleno e diferente do dono.
    expect(comp.ok && comp.valor.map((u) => u.id)).toEqual([colega.id]);

    const depois = await listar(colega, TELA);
    expect(depois.ok && depois.valor[0]?.origem).toBe("compartilhada");
    expect(depois.ok && depois.valor[0]?.compartilhadaCom).toBeNull();
    expect((await obter(colega, id)).ok).toBe(true);

    // Quem recebeu não sobrescreve, não renomeia, não compartilha e não exclui.
    const tentativa = await atualizar(colega, id, { versaoEsperada: 1, dados: { anos: 1 } });
    expect(!tentativa.ok && tentativa.status).toBe(403);
    expect((await compartilhar(colega, id, [dono.id])).ok).toBe(false);
    expect((await excluir(colega, id)).ok).toBe(false);
  });

  it("a trava de edição simultânea: a segunda gravação com a mesma versão é recusada", async () => {
    if (!disponivel) return;
    const lista = await listar(dono, TELA);
    if (!lista.ok) throw new Error("lista");
    const id = lista.valor[0]!.id;
    const versaoCarregada = lista.valor[0]!.versao;

    // Duas janelas do mesmo usuário carregaram a mesma versão e salvam ao mesmo tempo.
    const [a, b] = await Promise.all([
      atualizar(dono, id, { versaoEsperada: versaoCarregada, dados: { anos: 10 } }),
      atualizar(dono, id, { versaoEsperada: versaoCarregada, dados: { anos: 12 } }),
    ]);
    const oks = [a, b].filter((r) => r.ok);
    const conflitos = [a, b].filter((r) => !r.ok && r.status === 409);
    expect(oks).toHaveLength(1);
    expect(conflitos).toHaveLength(1);
    const conflito = conflitos[0]!;
    if (!conflito.ok) {
      expect(conflito.conflito?.versaoAtual).toBe(versaoCarregada + 1);
      expect(conflito.erro).toMatch(/salvou esta simulação/);
    }

    // Quem recarrega (versão nova) consegue salvar.
    const atual = await obter(dono, id);
    if (!atual.ok) throw new Error("obter");
    const salvou = await atualizar(dono, id, { versaoEsperada: atual.valor.versao, dados: { anos: 15 } });
    expect(salvou.ok && salvou.valor.versao).toBe(atual.valor.versao + 1);
  });

  it("renomear respeita a trava e a unicidade do nome", async () => {
    if (!disponivel) return;
    const outra = await criar(dono, { tela: TELA, nome: "Outro cenário", dados: {} });
    if (!outra.ok) throw new Error("criar");
    const colide = await atualizar(dono, outra.valor.id, { versaoEsperada: outra.valor.versao, nome: "Meu cenário" });
    expect(!colide.ok && colide.status).toBe(409);
    const renomeou = await atualizar(dono, outra.valor.id, { versaoEsperada: outra.valor.versao, nome: "Terceiro nome" });
    expect(renomeou.ok && renomeou.valor.nome).toBe("Terceiro nome");
    const semVersao = await atualizar(dono, outra.valor.id, { versaoEsperada: undefined, nome: "x" });
    expect(!semVersao.ok && semVersao.status).toBe(400);
  });

  it("o super-administrador vê a de todos com o nome do dono, mas não sobrescreve; pode excluir", async () => {
    if (!disponivel) return;
    const lista = await listar(superAdmin, TELA);
    if (!lista.ok) throw new Error("lista");
    expect(lista.valor.length).toBeGreaterThanOrEqual(2);
    const item = lista.valor.find((c) => c.nome === "Meu cenário")!;
    expect(item.origem).toBe("de-outro-usuario");
    expect(item.dono.id).toBe(dono.id);
    expect(item.dono.email).toBe(emails[0]);
    expect((await obter(superAdmin, item.id)).ok).toBe(true);
    const sobrescreve = await atualizar(superAdmin, item.id, { versaoEsperada: item.versao, dados: {} });
    expect(!sobrescreve.ok && sobrescreve.status).toBe(403);
    const outra = lista.valor.find((c) => c.nome === "Terceiro nome")!;
    expect((await excluir(superAdmin, outra.id)).ok).toBe(true);
  });

  it("o usuário PADRAO não usa o recurso e a lista de destinatários não traz ele", async () => {
    if (!disponivel) return;
    const l = await listar(padrao, TELA);
    expect(!l.ok && l.status).toBe(403);
    expect((await criar(padrao, { tela: TELA, nome: "x", dados: {} })).ok).toBe(false);
    const d = await destinatarios(dono);
    expect(d.ok && d.valor.some((u) => u.id === padrao.id)).toBe(false);
    expect(d.ok && d.valor.some((u) => u.id === dono.id)).toBe(false);
    expect(d.ok && d.valor.some((u) => u.id === colega.id)).toBe(true);
  });

  it("excluir remove a simulação e os compartilhamentos dela", async () => {
    if (!disponivel) return;
    const lista = await listar(dono, TELA);
    if (!lista.ok) throw new Error("lista");
    const id = lista.valor.find((c) => c.nome === "Meu cenário")!.id;
    expect((await excluir(dono, id)).ok).toBe(true);
    expect(await prisma.configuracaoCompartilhada.count({ where: { configuracaoId: id } })).toBe(0);
    expect((await obter(dono, id)).ok).toBe(false);
  });
});
