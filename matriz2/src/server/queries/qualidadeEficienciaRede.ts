import { prisma } from "@/server/db/prisma";
import {
  anosComFaixaIeaDisponivel,
  calcularIea,
  faixaIea,
  faixaRap,
  pesoIea,
  pesoIaplFormacaoProfessores,
  pesoIaplProeja,
  pesoIaplTecnicos,
  pesoRap,
} from "@/lib/qualidadeEficiencia";

export interface InstituicaoQE {
  sigla: string;
  nome: string;
  ieaConclusao: number;
  ieaEvasao: number;
  ieaRetencao: number;
  ieaOficial: number | null;
  ieaRecalc: number | null;
  ieaPonderadoOficial: number | null;
  ieaPonderadoRecalc: number | null;
  ieaEqualizadoOficial: number | null;
  vlIeaOficial: number;
  rapPresencial: number;
  rapPonderadoOficial: number | null;
  rapPonderadoRecalc: number;
  rapEqualizadoOficial: number | null;
  vlRapOficial: number;
  aplTecnico: number;
  aplFormacaoProfessor: number;
  aplProeja: number;
  aplTecnicoPonderadoOficial: number | null;
  iaplTecnicoPonderadoRecalc: number;
  formacaoPonderadoOficial: number | null;
  iaplFormacaoPonderadoRecalc: number;
  aplProejaPonderadoOficial: number | null;
  iaplProejaPonderadoRecalc: number;
  iaplEqualizadoOficial: number | null;
  vlIaplOficial: number;
}

export interface QualidadeEficienciaRede {
  ano: number;
  /** Falso quando não há tabela de faixas de IEA cadastrada para o ano (ver `qualidadeEficiencia.ts`); IEA fica sem recálculo, RAP e IAPL continuam. */
  temFaixaIea: boolean;
  instituicoes: InstituicaoQE[];
  somaIeaPonderadoRecalc: number;
  somaRapPonderadoRecalc: number;
  somaIaplTecnicoRecalc: number;
  somaIaplFormacaoRecalc: number;
  somaIaplProejaRecalc: number;
  /** Soma dos valores oficiais em reais do bloco na rede inteira; como as fatias
   * equalizadas somam sempre 100%, essa soma É o valor total do bloco, sem precisar
   * de nenhuma fonte a mais (`CicloOrcamento` ou similar). */
  totalBlocoIea: number;
  totalBlocoRap: number;
  totalBlocoIapl: number;
}

function n(v: unknown): number | null {
  return v === null || v === undefined ? null : Number(v);
}

/**
 * Refaz, para toda a rede num ano, o cálculo dos blocos IEA/RAP/IAPL a partir dos
 * componentes brutos que a MDO já publica por instituição (`DistribuicaoInstituicao`).
 * Fonte única usada por `/conferencia` (compara recalculado com oficial) e pelo
 * simulador de RAP em `/simulador` (usa a mesma soma de rede para reencaixar uma
 * instituição numa faixa hipotética). Ver `qualidadeEficiencia.ts` para as fórmulas.
 */
export async function calcularQualidadeEficienciaRede(ano: number): Promise<QualidadeEficienciaRede> {
  const anosComFaixa = anosComFaixaIeaDisponivel();
  const temFaixaIea = anosComFaixa.includes(ano);

  const registros = await prisma.distribuicaoInstituicao.findMany({
    where: { ano },
    include: { instituicao: { select: { sigla: true, nome: true } } },
  });

  const instituicoes = registros
    .map((r): InstituicaoQE | null => {
      const ieaConclusao = n(r.ieaConclusao);
      const ieaEvasao = n(r.ieaEvasao);
      const ieaRetencao = n(r.ieaRetencao);
      const rapPresencial = n(r.rapPresencial);
      const aplTecnico = n(r.aplTecnico);
      const aplFormacaoProfessor = n(r.aplFormacaoProfessor);
      const aplProeja = n(r.aplProeja);
      if (
        ieaConclusao === null || ieaEvasao === null || ieaRetencao === null ||
        rapPresencial === null || aplTecnico === null || aplFormacaoProfessor === null || aplProeja === null
      ) {
        return null;
      }

      const ieaRecalc = temFaixaIea ? calcularIea(ieaConclusao, ieaEvasao, ieaRetencao) : null;
      const faixaIeaRecalc = ieaRecalc !== null ? faixaIea(ieaRecalc, ano) : null;
      const ieaPonderadoRecalc = ieaRecalc !== null && faixaIeaRecalc ? ieaRecalc * pesoIea(faixaIeaRecalc) : null;

      const faixaRapRecalc = faixaRap(rapPresencial);
      const rapPonderadoRecalc = rapPresencial * pesoRap(faixaRapRecalc);

      const iaplTecnicoPonderadoRecalc = aplTecnico * pesoIaplTecnicos(aplTecnico);
      const iaplFormacaoPonderadoRecalc = aplFormacaoProfessor * pesoIaplFormacaoProfessores(aplFormacaoProfessor);
      const iaplProejaPonderadoRecalc = aplProeja * pesoIaplProeja(aplProeja);

      return {
        sigla: r.instituicao.sigla,
        nome: r.instituicao.nome,
        ieaConclusao, ieaEvasao, ieaRetencao,
        ieaOficial: n(r.ieaEficiencia),
        ieaRecalc,
        ieaPonderadoOficial: n(r.ieaPonderado),
        ieaPonderadoRecalc,
        ieaEqualizadoOficial: n(r.ieaEqualizado),
        vlIeaOficial: n(r.vlIea) ?? 0,
        rapPresencial,
        rapPonderadoOficial: n(r.rapPonderado),
        rapPonderadoRecalc,
        rapEqualizadoOficial: n(r.rapEqualizado),
        vlRapOficial: n(r.vlRap) ?? 0,
        aplTecnico, aplFormacaoProfessor, aplProeja,
        aplTecnicoPonderadoOficial: n(r.aplTecnicoPonderado),
        iaplTecnicoPonderadoRecalc,
        formacaoPonderadoOficial: n(r.ialPonderado),
        iaplFormacaoPonderadoRecalc,
        aplProejaPonderadoOficial: n(r.aplProejaPonderado),
        iaplProejaPonderadoRecalc,
        iaplEqualizadoOficial: n(r.ialEqualizado),
        vlIaplOficial: n(r.vlIapl) ?? 0,
      };
    })
    .filter((l): l is InstituicaoQE => l !== null);

  return {
    ano,
    temFaixaIea,
    instituicoes,
    somaIeaPonderadoRecalc: instituicoes.reduce((s, l) => s + (l.ieaPonderadoRecalc ?? 0), 0),
    somaRapPonderadoRecalc: instituicoes.reduce((s, l) => s + l.rapPonderadoRecalc, 0),
    somaIaplTecnicoRecalc: instituicoes.reduce((s, l) => s + l.iaplTecnicoPonderadoRecalc, 0),
    somaIaplFormacaoRecalc: instituicoes.reduce((s, l) => s + l.iaplFormacaoPonderadoRecalc, 0),
    somaIaplProejaRecalc: instituicoes.reduce((s, l) => s + l.iaplProejaPonderadoRecalc, 0),
    totalBlocoIea: instituicoes.reduce((s, l) => s + l.vlIeaOficial, 0),
    totalBlocoRap: instituicoes.reduce((s, l) => s + l.vlRapOficial, 0),
    totalBlocoIapl: instituicoes.reduce((s, l) => s + l.vlIaplOficial, 0),
  };
}

export function ieaEqualizadoRecalc(rede: QualidadeEficienciaRede, ponderado: number | null): number | null {
  return ponderado !== null && rede.somaIeaPonderadoRecalc > 0 ? ponderado / rede.somaIeaPonderadoRecalc : null;
}

export function rapEqualizadoRecalc(rede: QualidadeEficienciaRede, ponderado: number): number | null {
  return rede.somaRapPonderadoRecalc > 0 ? ponderado / rede.somaRapPonderadoRecalc : null;
}

export function iaplEqualizadoRecalc(
  rede: QualidadeEficienciaRede,
  tecnicoPonderado: number,
  formacaoPonderado: number,
  proejaPonderado: number,
): number | null {
  if (rede.somaIaplTecnicoRecalc <= 0 || rede.somaIaplFormacaoRecalc <= 0 || rede.somaIaplProejaRecalc <= 0) {
    return null;
  }
  return (
    (tecnicoPonderado / rede.somaIaplTecnicoRecalc) * 0.7 +
    (formacaoPonderado / rede.somaIaplFormacaoRecalc) * 0.2 +
    (proejaPonderado / rede.somaIaplProejaRecalc) * 0.1
  );
}
