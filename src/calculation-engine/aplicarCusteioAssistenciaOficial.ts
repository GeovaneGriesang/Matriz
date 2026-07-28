import type { PisoMinimoCampusNovoResult } from "./aplicarPisoMinimoCampusNovo";
import type { AssistenciaEstudantilCampusResultado } from "./types/assistenciaEstudantil.types";

export interface FuncionamentoComCusteioOficial extends PisoMinimoCampusNovoResult {
  /** true quando esta instituição tem Custeio oficial cadastrado para o ano (CusteioDistribuidoOficial). */
  custeioOficialAplicado: boolean;
  /** Valor deste câmpus antes de escalar proporcionalmente para bater com o Custeio oficial da instituição. */
  valorAntesDoCusteioOficial: number;
}

export interface AssistenciaComAssistenciaOficial extends AssistenciaEstudantilCampusResultado {
  /** true quando esta instituição tem Assistência oficial cadastrada para o ano (AssistenciaDistribuidoOficial). */
  assistenciaOficialAplicada: boolean;
  /** Valor deste câmpus antes de escalar proporcionalmente para bater com a Assistência oficial da instituição. */
  valorAntesDaAssistenciaOficial: number;
}

export interface CusteioOficialInstituicaoResumo {
  instituicaoId: number;
  /** O que a fórmula (Funcionamento + Reitoria + Qualidade e Eficiência) calcularia, sem a trava. */
  custeioCalculado: number;
  /** Valor final publicado pela CONIF (VALOR SPO), já com o complemento da trava embutido. */
  custeioOficial: number;
  /**
   * Base calculada pela CONIF ANTES da trava (aba COMPARATIVO, coluna AF) — `null` quando o CSV
   * importado não trouxe essa coluna para esta instituição/ano (import mais antigo, só com o valor
   * final). Sem essa base não dá pra separar "complemento real da trava" de "diferença do nosso
   * modelo" — ver `complementoReal`/`diferencaCalculoBase`.
   */
  custeioBaseOficial: number | null;
  /**
   * custeioOficial - custeioBaseOficial — GROUND TRUTH direto da planilha oficial: quanto a CONIF
   * de fato aplicou de complemento pelo Art. 7º da Portaria SETEC/MEC nº 51/2018 (trava de
   * não-decréscimo), independente do nosso próprio cálculo. `null` quando `custeioBaseOficial` é
   * `null`.
   */
  complementoReal: number | null;
  /**
   * custeioCalculado - custeioBaseOficial — o quanto o NOSSO cálculo por fórmula diverge da base
   * oficial da CONIF (mesmo ano-base, antes da trava). Isso é imprecisão do nosso modelo (Assistência
   * Estudantil não validada, Piso Mínimo etc.), NÃO é trava nem complemento — não deve ser
   * apresentado como tal na memória de cálculo. `null` quando `custeioBaseOficial` é `null`.
   */
  diferencaCalculoBase: number | null;
  /** Fator aplicado ao Funcionamento calculado de cada câmpus desta instituição, para que o Custeio
   *  da instituição bata com `custeioOficial` (Reitoria/Qualidade e Eficiência não são escalados: não
   *  são detalhados por câmpus, e a CONIF não abre o complemento por sub-bloco). Sempre calculado
   *  contra `custeioOficial`/`custeioCalculado` — não muda dependendo de `custeioBaseOficial` estar
   *  disponível ou não. */
  fatorEscala: number;
}

export interface AssistenciaOficialInstituicaoResumo {
  instituicaoId: number;
  assistenciaCalculada: number;
  assistenciaOficial: number;
  /** Idem CusteioOficialInstituicaoResumo.custeioBaseOficial (aba COMPARATIVO, coluna AK). */
  assistenciaBaseOficial: number | null;
  /** Idem CusteioOficialInstituicaoResumo.complementoReal. */
  complementoReal: number | null;
  /** Idem CusteioOficialInstituicaoResumo.diferencaCalculoBase. */
  diferencaCalculoBase: number | null;
  fatorEscala: number;
}

/**
 * Substitui o Custeio (Funcionamento + Reitoria + Qualidade e Eficiência) calculado por fórmula
 * pelo valor FINAL publicado pela CONIF (já com o complemento da trava de não-decréscimo do Art. 7º
 * da Portaria SETEC/MEC nº 51/2018 embutido) — só para as instituições com `CusteioDistribuidoOficial`
 * cadastrado para o ano. Este sistema NÃO reimplementa o algoritmo da trava (ver Metodologia seção 6):
 * importa o valor final diretamente enquanto houver planilha oficial publicada.
 *
 * Reitoria e Qualidade e Eficiência são apurados só em nível de instituição (não têm detalhamento
 * por câmpus a preservar) e continuam com o valor calculado, sem alteração. Todo o ajuste necessário
 * para o Custeio da instituição bater com o valor oficial é absorvido pelo Bloco Funcionamento,
 * escalando proporcionalmente o valor calculado de cada câmpus da instituição pelo mesmo fator —
 * mesma técnica de equalização usada para dividir a Assistência Estudantil entre câmpus (ver
 * blocoAssistenciaEstudantil.ts). Por construção, `Σ funcionamento_escalado + reitoria + qualidadeEficiencia
 * = custeioOficial` sempre que a soma do Funcionamento calculado da instituição for maior que zero —
 * essa conta NUNCA muda, independente de `custeioBaseOficialPorInstituicao` estar disponível ou não
 * (a base pré-trava só alimenta números NOVOS para a memória de cálculo, não entra no dinheiro).
 */
export function aplicarCusteioOficial(
  funcionamento: PisoMinimoCampusNovoResult[],
  instituicaoIdPorCampus: Map<number, number>,
  reitoriaPorInstituicao: Map<number, number>,
  qualidadeEficienciaPorInstituicao: Map<number, number>,
  custeioOficialPorInstituicao: Map<number, number>,
  custeioBaseOficialPorInstituicao: Map<number, number> = new Map(),
): { funcionamento: FuncionamentoComCusteioOficial[]; resumoPorInstituicao: Map<number, CusteioOficialInstituicaoResumo> } {
  const funcionamentoPorInstituicao = new Map<number, PisoMinimoCampusNovoResult[]>();
  for (const f of funcionamento) {
    const instituicaoId = instituicaoIdPorCampus.get(f.campusId);
    if (instituicaoId === undefined) continue;
    const atual = funcionamentoPorInstituicao.get(instituicaoId) ?? [];
    atual.push(f);
    funcionamentoPorInstituicao.set(instituicaoId, atual);
  }

  const fatorPorInstituicao = new Map<number, number>();
  const resumoPorInstituicao = new Map<number, CusteioOficialInstituicaoResumo>();

  for (const [instituicaoId, custeioOficial] of custeioOficialPorInstituicao) {
    const campiDaInstituicao = funcionamentoPorInstituicao.get(instituicaoId) ?? [];
    const somaFuncionamentoCalculado = campiDaInstituicao.reduce((soma, f) => soma + f.valorReais, 0);
    const reitoria = reitoriaPorInstituicao.get(instituicaoId) ?? 0;
    const qualidadeEficiencia = qualidadeEficienciaPorInstituicao.get(instituicaoId) ?? 0;
    const custeioCalculado = reitoria + qualidadeEficiencia + somaFuncionamentoCalculado;

    const alvoFuncionamento = Math.max(0, custeioOficial - reitoria - qualidadeEficiencia);
    const fator = somaFuncionamentoCalculado === 0 ? 0 : alvoFuncionamento / somaFuncionamentoCalculado;

    const custeioBaseOficial = custeioBaseOficialPorInstituicao.get(instituicaoId) ?? null;

    fatorPorInstituicao.set(instituicaoId, fator);
    resumoPorInstituicao.set(instituicaoId, {
      instituicaoId,
      custeioCalculado,
      custeioOficial,
      custeioBaseOficial,
      complementoReal: custeioBaseOficial === null ? null : custeioOficial - custeioBaseOficial,
      diferencaCalculoBase: custeioBaseOficial === null ? null : custeioCalculado - custeioBaseOficial,
      fatorEscala: fator,
    });
  }

  const funcionamentoFinal: FuncionamentoComCusteioOficial[] = funcionamento.map((f) => {
    const instituicaoId = instituicaoIdPorCampus.get(f.campusId);
    const fator = instituicaoId !== undefined ? fatorPorInstituicao.get(instituicaoId) : undefined;
    if (fator === undefined) {
      return { ...f, custeioOficialAplicado: false, valorAntesDoCusteioOficial: f.valorReais };
    }
    return {
      ...f,
      valorReais: f.valorReais * fator,
      custeioOficialAplicado: true,
      valorAntesDoCusteioOficial: f.valorReais,
    };
  });

  return { funcionamento: funcionamentoFinal, resumoPorInstituicao };
}

/**
 * Mesma técnica de `aplicarCusteioOficial`, para a Assistência Estudantil (Ação 2994) — aqui todo o
 * valor calculado já é por câmpus (ver blocoAssistenciaEstudantil.ts), então o fator de escala se
 * aplica a 100% do valor, sem nenhum resto institucional a preservar.
 */
export function aplicarAssistenciaOficial(
  assistencia: AssistenciaEstudantilCampusResultado[],
  assistenciaOficialPorInstituicao: Map<number, number>,
  assistenciaBaseOficialPorInstituicao: Map<number, number> = new Map(),
): {
  assistencia: AssistenciaComAssistenciaOficial[];
  resumoPorInstituicao: Map<number, AssistenciaOficialInstituicaoResumo>;
} {
  const assistenciaPorInstituicao = new Map<number, AssistenciaEstudantilCampusResultado[]>();
  for (const a of assistencia) {
    const atual = assistenciaPorInstituicao.get(a.instituicaoId) ?? [];
    atual.push(a);
    assistenciaPorInstituicao.set(a.instituicaoId, atual);
  }

  const fatorPorInstituicao = new Map<number, number>();
  const resumoPorInstituicao = new Map<number, AssistenciaOficialInstituicaoResumo>();

  for (const [instituicaoId, assistenciaOficial] of assistenciaOficialPorInstituicao) {
    const campiDaInstituicao = assistenciaPorInstituicao.get(instituicaoId) ?? [];
    const assistenciaCalculada = campiDaInstituicao.reduce((soma, a) => soma + a.valorReais, 0);
    const fator = assistenciaCalculada === 0 ? 0 : assistenciaOficial / assistenciaCalculada;

    const assistenciaBaseOficial = assistenciaBaseOficialPorInstituicao.get(instituicaoId) ?? null;

    fatorPorInstituicao.set(instituicaoId, fator);
    resumoPorInstituicao.set(instituicaoId, {
      instituicaoId,
      assistenciaCalculada,
      assistenciaOficial,
      assistenciaBaseOficial,
      complementoReal: assistenciaBaseOficial === null ? null : assistenciaOficial - assistenciaBaseOficial,
      diferencaCalculoBase: assistenciaBaseOficial === null ? null : assistenciaCalculada - assistenciaBaseOficial,
      fatorEscala: fator,
    });
  }

  const assistenciaFinal: AssistenciaComAssistenciaOficial[] = assistencia.map((a) => {
    const fator = fatorPorInstituicao.get(a.instituicaoId);
    if (fator === undefined) {
      return { ...a, assistenciaOficialAplicada: false, valorAntesDaAssistenciaOficial: a.valorReais };
    }
    return {
      ...a,
      valorReais: a.valorReais * fator,
      assistenciaOficialAplicada: true,
      valorAntesDaAssistenciaOficial: a.valorReais,
    };
  });

  return { assistencia: assistenciaFinal, resumoPorInstituicao };
}
