import { describe, expect, it } from "vitest";
import {
  LIMITE_DE_DADOS,
  nomeParaCopia,
  origemDaConfiguracao,
  podeCompartilhar,
  podeExcluir,
  podeSobrescrever,
  podeUsar,
  podeVer,
  validarDados,
  validarNome,
  validarTela,
} from "@/lib/configuracoes/regras";
import { alternar, desmarcarTodos, diferencaDeCompartilhamento, inverterSelecao, marcarTodos } from "@/lib/configuracoes/selecao";

const dono = { id: 1, papel: "ADMIN" as const };
const outro = { id: 2, papel: "ADMIN" as const };
const recebedor = { id: 3, papel: "ADMIN" as const };
const superAdmin = { id: 9, papel: "SUPER_ADMIN" as const };
const padrao = { id: 5, papel: "PADRAO" as const };
const config = { donoId: 1, compartilhadaComIds: [3] };

describe("permissões", () => {
  it("o dono faz tudo", () => {
    expect(origemDaConfiguracao(dono, config)).toBe("propria");
    expect(podeVer(dono, config)).toBe(true);
    expect(podeSobrescrever(dono, config)).toBe(true);
    expect(podeCompartilhar(dono, config)).toBe(true);
    expect(podeExcluir(dono, config)).toBe(true);
  });

  it("quem recebeu o compartilhamento só vê e carrega", () => {
    expect(origemDaConfiguracao(recebedor, config)).toBe("compartilhada");
    expect(podeVer(recebedor, config)).toBe(true);
    expect(podeSobrescrever(recebedor, config)).toBe(false);
    expect(podeCompartilhar(recebedor, config)).toBe(false);
    expect(podeExcluir(recebedor, config)).toBe(false);
  });

  it("outro usuário não vê nada", () => {
    expect(origemDaConfiguracao(outro, config)).toBeNull();
    expect(podeVer(outro, config)).toBe(false);
    expect(podeExcluir(outro, config)).toBe(false);
  });

  it("o super-administrador vê e exclui a de todos, mas não sobrescreve a de outra pessoa", () => {
    expect(origemDaConfiguracao(superAdmin, config)).toBe("de-outro-usuario");
    expect(podeVer(superAdmin, config)).toBe(true);
    expect(podeExcluir(superAdmin, config)).toBe(true);
    expect(podeSobrescrever(superAdmin, config)).toBe(false);
    expect(podeCompartilhar(superAdmin, config)).toBe(false);
  });

  it("o usuário PADRAO usa o recurso como o ADMIN (decisão de 2026-10-08, ver lib/permissoes)", () => {
    expect(podeUsar(padrao)).toBe(true);
    expect(podeVer(padrao, { donoId: 5, compartilhadaComIds: [] })).toBe(true);
    expect(podeSobrescrever(padrao, { donoId: 5, compartilhadaComIds: [] })).toBe(true);
  });
});

describe("validações", () => {
  it("nome: tira espaços sobrando e recusa vazio ou longo", () => {
    expect(validarNome("  Minha   simulação ")).toEqual({ ok: true, valor: "Minha simulação" });
    expect(validarNome("   ").ok).toBe(false);
    expect(validarNome(42).ok).toBe(false);
    expect(validarNome("x".repeat(121)).ok).toBe(false);
  });

  it("tela: aceita caminhos e chaves, recusa lixo", () => {
    expect(validarTela("simulador/projecao:IFSUL:2027").ok).toBe(true);
    expect(validarTela("/consulta/curso").ok).toBe(true);
    expect(validarTela("").ok).toBe(false);
    expect(validarTela("simulador/curso:12:2027:TECNICO EM INFORMÁTICA (integrado)").ok).toBe(true);
    expect(validarTela("a b<script>").ok).toBe(false);
    expect(validarTela("a\nb").ok).toBe(false);
    expect(validarTela("x".repeat(161)).ok).toBe(false);
  });

  it("dados: aceita objeto, recusa o que não vira JSON ou passa do limite", () => {
    expect(validarDados({ anos: 5, lista: [1, 2] }).ok).toBe(true);
    expect(validarDados(undefined).ok).toBe(false);
    expect(validarDados({ texto: "x".repeat(LIMITE_DE_DADOS) }).ok).toBe(false);
    const circular: Record<string, unknown> = {};
    circular.eu = circular;
    expect(validarDados(circular).ok).toBe(false);
  });

  it("nome para a cópia: acrescenta (cópia) e numera quando já existe", () => {
    expect(nomeParaCopia("Cenário A", [])).toBe("Cenário A (cópia)");
    expect(nomeParaCopia("Cenário A", ["Cenário A (cópia)"])).toBe("Cenário A (cópia 2)");
    expect(nomeParaCopia("Cenário A (cópia)", ["Cenário A (cópia)", "Cenário A (cópia 2)"])).toBe("Cenário A (cópia 3)");
    expect(nomeParaCopia("Cenário A", ["cenário a (cópia)"])).toBe("Cenário A (cópia 2)");
  });
});

describe("seleção para compartilhar", () => {
  const todos = [1, 2, 3, 4];

  it("marcar todos, desmarcar todos e inverter", () => {
    expect([...marcarTodos(new Set([2]), todos)].sort()).toEqual([1, 2, 3, 4]);
    expect([...desmarcarTodos(new Set([1, 2, 3, 4]), todos)]).toEqual([]);
    expect([...inverterSelecao(new Set([1, 2]), todos)].sort()).toEqual([3, 4]);
  });

  it("as operações só valem para quem está visível na busca e preservam o resto", () => {
    const visiveis = [3, 4];
    expect([...marcarTodos(new Set([1]), visiveis)].sort()).toEqual([1, 3, 4]);
    expect([...desmarcarTodos(new Set([1, 3, 4]), visiveis)]).toEqual([1]);
    expect([...inverterSelecao(new Set([1, 3]), visiveis)].sort()).toEqual([1, 4]);
  });

  it("alternar uma pessoa e a diferença para o que já estava compartilhado", () => {
    expect([...alternar(new Set([1]), 2)].sort()).toEqual([1, 2]);
    expect([...alternar(new Set([1, 2]), 2)]).toEqual([1]);
    expect(diferencaDeCompartilhamento([1, 2], new Set([2, 3]))).toEqual({ adicionados: [3], removidos: [1] });
  });
});
