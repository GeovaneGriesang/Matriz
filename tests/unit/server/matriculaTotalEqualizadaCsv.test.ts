import { describe, expect, it } from "vitest";
import {
  classificarLinhas,
  construirIndicesDeCasamento,
  paraAnoCriacao,
  type LinhaCsv,
} from "@/server/dadosAnuais/matriculaTotalEqualizadaCsv";

const INSTITUICOES = [{ id: 1, nome: "Instituto Federal do Sul de Minas Gerais", uf: "MG" }];

const UNIDADES = [
  { id: 10, nome: "Campus Pouso Alegre", instituicaoId: 1, anoCriacao: 2010 },
  { id: 11, nome: "Campus Machado", instituicaoId: 1, anoCriacao: null },
];

const indices = () => construirIndicesDeCasamento(INSTITUICOES, UNIDADES);

function linha(parcial: Partial<LinhaCsv>): LinhaCsv {
  return {
    Instituicao: "INSTITUTO FEDERAL DO SUL MINAS GERAIS",
    UF: "MG",
    MatriculaTotalPresencialEqualizada: "100",
    ...parcial,
  };
}

describe("paraAnoCriacao", () => {
  it("aceita um ano plausível", () => {
    expect(paraAnoCriacao("2026")).toBe(2026);
    expect(paraAnoCriacao(" 1909 ")).toBe(1909);
  });

  it('trata vazio e "0" como "a CONIF não informou", nunca como ano zero', () => {
    // Gravar 0 faria o câmpus parecer cadastrado e o tornaria permanentemente inelegível ao Piso
    // Mínimo — um erro silencioso em vez de um campo visivelmente em branco na tela de Câmpus.
    expect(paraAnoCriacao("")).toBeNull();
    expect(paraAnoCriacao("0")).toBeNull();
    expect(paraAnoCriacao(undefined)).toBeNull();
  });

  it("recusa valores fora de faixa ou não numéricos", () => {
    expect(paraAnoCriacao("1899")).toBeNull();
    expect(paraAnoCriacao("2101")).toBeNull();
    expect(paraAnoCriacao("2026,5")).toBeNull();
    expect(paraAnoCriacao("n/d")).toBeNull();
  });
});

describe("classificarLinhas", () => {
  it("casa o câmpus ignorando acento e caixa, e reporta os dois anos lado a lado", () => {
    const { resolvidas, campusAusentes, naoImportadas } = classificarLinhas(
      [linha({ Campus: "CAMPUS POUSO ALEGRE", AnoCriacaoCampus: "2010" })],
      indices(),
    );

    expect(naoImportadas).toEqual([]);
    expect(campusAusentes).toEqual([]);
    expect(resolvidas).toHaveLength(1);
    expect(resolvidas[0]).toMatchObject({
      unidadeId: 10,
      anoNoSistema: 2010,
      anoNaPlanilha: 2010,
      matriculaTotalPresencialEqualizada: 100,
    });
  });

  it("expõe o ano da planilha para um câmpus que está sem ano no sistema", () => {
    const { resolvidas } = classificarLinhas(
      [linha({ Campus: "CAMPUS MACHADO", AnoCriacaoCampus: "2008" })],
      indices(),
    );

    // Quem decide preencher é a Server Action; aqui só se garante que a informação chega até ela.
    expect(resolvidas[0]).toMatchObject({ unidadeId: 11, anoNoSistema: null, anoNaPlanilha: 2008 });
  });

  it("oferece para criação o câmpus que a planilha traz e o sistema não tem, com o ano junto", () => {
    const { campusAusentes, naoImportadas, resolvidas } = classificarLinhas(
      [linha({ Campus: "CAMPUS INCONFIDENTES", AnoCriacaoCampus: "2026" })],
      indices(),
    );

    expect(resolvidas).toEqual([]);
    expect(campusAusentes).toEqual([
      { linha: 2, instituicaoId: 1, instituicaoNome: "INSTITUTO FEDERAL DO SUL MINAS GERAIS", campus: "CAMPUS INCONFIDENTES", anoCriacao: 2026 },
    ]);
    // Continua contando como não importada: sem criar o câmpus, a matrícula dele não foi gravada.
    expect(naoImportadas).toHaveLength(1);
    expect(naoImportadas[0]!.motivo).toBe("campus_nao_encontrado");
  });

  it("nunca oferece criar Reitoria/Direção Geral, que não são câmpus", () => {
    const { campusAusentes, naoImportadas } = classificarLinhas(
      [linha({ Campus: "REITORIA DO IFSULDEMINAS", AnoCriacaoCampus: "2008" })],
      indices(),
    );

    // Criar uma unidade administrativa poluiria o Piso Mínimo com quem não tem Bloco Funcionamento.
    expect(campusAusentes).toEqual([]);
    expect(naoImportadas[0]!.motivo).toBe("unidade_administrativa");
  });

  it("não cria nada quando a instituição é desconhecida", () => {
    const { campusAusentes, naoImportadas } = classificarLinhas(
      [linha({ Instituicao: "INSTITUTO FEDERAL DO SERTAO PARAIBANO", UF: "PB", Campus: "CAMPUS SOUSA" })],
      indices(),
    );

    expect(campusAusentes).toEqual([]);
    expect(naoImportadas[0]!.motivo).toBe("instituicao_nao_encontrada");
  });

  it("ignora a linha de rodapé que a exportação da planilha deixa no fim do arquivo", () => {
    const { resolvidas, campusAusentes, naoImportadas } = classificarLinhas(
      [linha({ Instituicao: "\\instituicao_ds_nome", Campus: "\\unidade_ds_nome" })],
      indices(),
    );

    expect(resolvidas).toEqual([]);
    expect(campusAusentes).toEqual([]);
    expect(naoImportadas).toEqual([]);
  });
});
