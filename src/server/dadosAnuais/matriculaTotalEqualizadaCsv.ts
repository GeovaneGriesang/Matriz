/**
 * Leitura e casamento do CSV de Matrícula Total equalizada publicado pela CONIF.
 *
 * Mora fora da Server Action de propósito: um módulo `"use server"` só pode exportar funções
 * assíncronas, então nada puro declarado lá dentro pode ser exportado — nem para teste. Aqui a
 * classificação fica testável sem banco e sem sessão (ver
 * tests/unit/server/matriculaTotalEqualizadaCsv.test.ts).
 */
import { indexarComAmbiguidade, normalizarNomeInstituicao, normalizarNomeUnidade } from "@/server/dadosAnuais/normalizacao";
import { ehUnidadeAdministrativa } from "@/server/unidades/unidadeAdministrativa";

export interface LinhaMatriculaNaoImportada {
  linha: number;
  instituicao: string;
  campus: string;
  motivo:
    | "instituicao_nao_encontrada"
    | "instituicao_ambigua"
    | "campus_nao_encontrado"
    | "campus_ambiguo"
    | "unidade_administrativa";
  candidatos?: { id: number; nome: string }[];
}

/**
 * Câmpus que a planilha do ciclo traz e o sistema ainda não tem. Não é erro de digitação: um câmpus
 * recém-criado não tem matrícula, logo não aparece em nenhum arquivo da PNP e nunca nasceria da
 * ingestão — mas a matriz da CONIF já o contempla pelo Piso Mínimo por Câmpus Novo. A planilha é a
 * única fonte que conhece esses câmpus, e traz junto o ano de criação deles.
 */
export interface CampusAusenteNaPlanilha {
  linha: number;
  instituicaoId: number;
  instituicaoNome: string;
  campus: string;
  anoCriacao: number | null;
}

/** Câmpus cujo ano de criação já cadastrado no sistema difere do que a planilha informa. */
export interface AnoCriacaoDivergente {
  unidadeId: number;
  instituicao: string;
  campus: string;
  anoNoSistema: number;
  anoNaPlanilha: number;
}

export interface ImportarMatriculaTotalEqualizadaAnualResult {
  ok: boolean;
  errorMessage?: string;
  importadas?: number;
  atualizadas?: number;
  naoImportadas?: LinhaMatriculaNaoImportada[];
  /** Preenchido quando o import roda sem `criarCampusAusentes` — é a lista que a tela oferece criar. */
  campusAusentes?: CampusAusenteNaPlanilha[];
  campusCriados?: number;
  anosCriacaoPreenchidos?: number;
  anosCriacaoDivergentes?: AnoCriacaoDivergente[];
}

export interface LinhaCsv {
  Instituicao?: string;
  UF?: string;
  Campus?: string;
  AnoCriacaoCampus?: string;
  MatriculaTotalPresencialEqualizada?: string;
  MatriculaTotalEadEqualizada?: string;
  MatriculaTotalEadMoocEqualizada?: string;
  MatriculaTotalEadFpEqualizada?: string;
}

export function paraNumero(valor: string | undefined): number {
  if (valor === undefined) return 0;
  const limpo = valor.trim();
  if (limpo === "") return 0;
  const n = Number(limpo.replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

/**
 * Ano de criação vindo da planilha. Vazio e `0` significam a mesma coisa — "a CONIF não informou" —
 * e viram `null`: são 12 linhas em 2026 e 13 em 2027 (quase todas Centros de Referência do
 * IFSULDEMINAS e alguns Câmpus Avançados), que seguem dependendo de digitação na tela de Câmpus.
 * Gravar `0` faria o câmpus parecer cadastrado e, pior, nunca elegível ao Piso Mínimo — um erro
 * silencioso em vez de um campo visivelmente em branco.
 */
export function paraAnoCriacao(valor: string | undefined): number | null {
  if (valor === undefined) return null;
  const limpo = valor.trim();
  if (limpo === "") return null;
  const n = Number(limpo);
  if (!Number.isInteger(n) || n < 1900 || n > 2100) return null;
  return n;
}

export interface InstituicaoParaCasamento {
  id: number;
  nome: string;
  uf: string;
}

export interface UnidadeParaCasamento {
  id: number;
  nome: string;
  instituicaoId: number;
  anoCriacao: number | null;
}

export interface IndicesDeCasamento {
  indiceInstituicao: Map<string, InstituicaoParaCasamento[]>;
  indiceUnidade: Map<string, UnidadeParaCasamento[]>;
}

export function construirIndicesDeCasamento(
  instituicoes: InstituicaoParaCasamento[],
  unidades: UnidadeParaCasamento[],
): IndicesDeCasamento {
  return {
    indiceInstituicao: indexarComAmbiguidade(instituicoes, (i) => `${i.uf}::${normalizarNomeInstituicao(i.nome)}`),
    indiceUnidade: indexarComAmbiguidade(unidades, (u) => `${u.instituicaoId}::${normalizarNomeUnidade(u.nome)}`),
  };
}

export interface LinhaResolvida {
  unidadeId: number;
  instituicao: string;
  campus: string;
  anoNoSistema: number | null;
  anoNaPlanilha: number | null;
  matriculaTotalPresencialEqualizada: number;
  matriculaTotalEadEqualizada: number;
  matriculaTotalEadMoocEqualizada: number;
  matriculaTotalEadFpEqualizada: number;
}

export interface Classificacao {
  resolvidas: LinhaResolvida[];
  campusAusentes: CampusAusenteNaPlanilha[];
  naoImportadas: LinhaMatriculaNaoImportada[];
}

/**
 * Casa cada linha do CSV contra Instituição/Unidade já existentes. Separada da Server Action porque
 * roda **duas vezes** quando o administrador manda criar os câmpus ausentes: a primeira descobre
 * quem falta, a segunda reclassifica com os câmpus já criados. Reclassificar é mais seguro do que
 * remendar o índice em memória — a segunda passada usa exatamente o mesmo casamento por nome
 * normalizado que qualquer outro import usaria depois.
 */
export function classificarLinhas(linhas: LinhaCsv[], indices: IndicesDeCasamento): Classificacao {
  const resolvidas: LinhaResolvida[] = [];
  const campusAusentes: CampusAusenteNaPlanilha[] = [];
  const naoImportadas: LinhaMatriculaNaoImportada[] = [];

  linhas.forEach((linha, indice) => {
    const numeroLinha = indice + 2; // +1 cabeçalho, +1 base 1

    const instituicaoNome = (linha.Instituicao ?? "").trim();
    const uf = (linha.UF ?? "").trim();
    const campus = (linha.Campus ?? "").trim().replace(/\s+/g, " ");

    // Linha de rodapé/lixo de exportação (ex.: cabeçalho duplicado "\instituicao_ds_nome;...") — não é dado real.
    if (!instituicaoNome || instituicaoNome.startsWith("\\") || !campus) {
      return;
    }

    const candidatosInstituicao =
      indices.indiceInstituicao.get(`${uf}::${normalizarNomeInstituicao(instituicaoNome)}`) ?? [];
    if (candidatosInstituicao.length === 0) {
      naoImportadas.push({
        linha: numeroLinha,
        instituicao: instituicaoNome,
        campus,
        motivo: "instituicao_nao_encontrada",
      });
      return;
    }
    if (candidatosInstituicao.length > 1) {
      naoImportadas.push({
        linha: numeroLinha,
        instituicao: instituicaoNome,
        campus,
        motivo: "instituicao_ambigua",
        candidatos: candidatosInstituicao.map((c) => ({ id: c.id, nome: c.nome })),
      });
      return;
    }
    const instituicaoId = candidatosInstituicao[0]!.id;
    const anoNaPlanilha = paraAnoCriacao(linha.AnoCriacaoCampus);

    const candidatosUnidade = indices.indiceUnidade.get(`${instituicaoId}::${normalizarNomeUnidade(campus)}`) ?? [];
    if (candidatosUnidade.length === 0) {
      // Reitoria/Direção Geral não são câmpus e não podem ser criadas por este caminho. A planilha
      // da CONIF não as traz (conferido em 2026 e 2027), mas criar uma por engano poluiria o Piso
      // Mínimo com uma unidade que não tem Bloco Funcionamento.
      naoImportadas.push({
        linha: numeroLinha,
        instituicao: instituicaoNome,
        campus,
        motivo: ehUnidadeAdministrativa(campus) ? "unidade_administrativa" : "campus_nao_encontrado",
      });
      if (!ehUnidadeAdministrativa(campus)) {
        campusAusentes.push({
          linha: numeroLinha,
          instituicaoId,
          instituicaoNome,
          campus,
          anoCriacao: anoNaPlanilha,
        });
      }
      return;
    }
    if (candidatosUnidade.length > 1) {
      naoImportadas.push({
        linha: numeroLinha,
        instituicao: instituicaoNome,
        campus,
        motivo: "campus_ambiguo",
        candidatos: candidatosUnidade.map((c) => ({ id: c.id, nome: c.nome })),
      });
      return;
    }

    resolvidas.push({
      unidadeId: candidatosUnidade[0]!.id,
      instituicao: instituicaoNome,
      campus,
      anoNoSistema: candidatosUnidade[0]!.anoCriacao,
      anoNaPlanilha,
      matriculaTotalPresencialEqualizada: paraNumero(linha.MatriculaTotalPresencialEqualizada),
      matriculaTotalEadEqualizada: paraNumero(linha.MatriculaTotalEadEqualizada),
      matriculaTotalEadMoocEqualizada: paraNumero(linha.MatriculaTotalEadMoocEqualizada),
      matriculaTotalEadFpEqualizada: paraNumero(linha.MatriculaTotalEadFpEqualizada),
    });
  });

  return { resolvidas, campusAusentes, naoImportadas };
}
