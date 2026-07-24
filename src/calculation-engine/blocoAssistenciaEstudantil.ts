import { pesoRfp } from "./constants/assistenciaEstudantil.constants";
import type {
  AssistenciaEstudantilCampusInput,
  AssistenciaEstudantilCampusResultado,
  AssistenciaEstudantilRfpInput,
} from "./types/assistenciaEstudantil.types";

/**
 * Distribui o orçamento da Ação 2994 (Assistência Estudantil / PNAES) — isolado do
 * Custeio 20RL, não fatiado em 80/10/10. Metodologia oficial em duas etapas, feita em
 * três passos aqui porque a PNP só entrega a faixa de RFP (Renda Familiar Per Capita)
 * por instituição, não por câmpus:
 *
 * 1) VR (RF Ponderada) = Σ (% de matrículas da instituição em cada faixa de RFP × peso
 *    da faixa) — índice de vulnerabilidade (0 a 2,5), independente do tamanho da instituição.
 * 2) O porte da instituição entra aqui: Participação ∝ MECHDA × VR, onde MECHDA é a mesma
 *    Matrícula Ponderada (Matrícula Equivalente) usada nos Blocos Funcionamento/Reitorias —
 *    evita contar o tamanho duas vezes (não entra no VR, só nesta multiplicação). O orçamento
 *    é rateado entre as instituições do escopo proporcionalmente a essa participação.
 * 3) O valor de cada instituição é então subdividido entre seus câmpus proporcionalmente à
 *    Matrícula Ponderada (mesma base do passo 2) — não usa RFP nessa etapa, porque o dado não
 *    existe nesse grão; é só uma aproximação para dar uma linha por câmpus na tabela.
 */
export function blocoAssistenciaEstudantil(
  rfpInputs: AssistenciaEstudantilRfpInput[],
  campusInputs: AssistenciaEstudantilCampusInput[],
  orcamentoAssistenciaEstudantil: number,
): AssistenciaEstudantilCampusResultado[] {
  if (campusInputs.length === 0) {
    return [];
  }

  // ---- Passo 1: VR (RF Ponderada) por instituição — índice de vulnerabilidade, não soma absoluta ----
  const matriculasPorInstituicaoFaixa = new Map<number, Map<string, number>>();
  const totalMatriculasRfpPorInstituicao = new Map<number, number>();
  for (const input of rfpInputs) {
    const porFaixa = matriculasPorInstituicaoFaixa.get(input.instituicaoId) ?? new Map<string, number>();
    porFaixa.set(input.faixaRfp, (porFaixa.get(input.faixaRfp) ?? 0) + input.numeroMatriculas);
    matriculasPorInstituicaoFaixa.set(input.instituicaoId, porFaixa);
    totalMatriculasRfpPorInstituicao.set(
      input.instituicaoId,
      (totalMatriculasRfpPorInstituicao.get(input.instituicaoId) ?? 0) + input.numeroMatriculas,
    );
  }

  const vrPorInstituicao = new Map<number, number>();
  for (const [instituicaoId, porFaixa] of matriculasPorInstituicaoFaixa) {
    const totalInstituicao = totalMatriculasRfpPorInstituicao.get(instituicaoId) ?? 0;
    let vr = 0;
    for (const [faixa, matriculas] of porFaixa) {
      const percentualNaFaixa = totalInstituicao === 0 ? 0 : matriculas / totalInstituicao;
      vr += percentualNaFaixa * pesoRfp(faixa);
    }
    vrPorInstituicao.set(instituicaoId, vr);
  }

  // ---- MECHDA (Matrícula Ponderada) por instituição — mesma base do Bloco Funcionamento/Reitorias ----
  const matriculaPonderadaPorInstituicao = new Map<number, number>();
  for (const campus of campusInputs) {
    matriculaPonderadaPorInstituicao.set(
      campus.instituicaoId,
      (matriculaPonderadaPorInstituicao.get(campus.instituicaoId) ?? 0) + campus.matriculaPonderada,
    );
  }

  // ---- Passo 2: Participação ∝ MECHDA × VR — o porte da instituição entra só agora ----
  const instituicaoIds = new Set<number>([...vrPorInstituicao.keys(), ...matriculaPonderadaPorInstituicao.keys()]);
  const participacaoPorInstituicao = new Map<number, number>();
  for (const instituicaoId of instituicaoIds) {
    const vr = vrPorInstituicao.get(instituicaoId) ?? 0;
    const mechda = matriculaPonderadaPorInstituicao.get(instituicaoId) ?? 0;
    participacaoPorInstituicao.set(instituicaoId, mechda * vr);
  }

  const somaParticipacoesRede = Array.from(participacaoPorInstituicao.values()).reduce((total, v) => total + v, 0);

  const valorPorInstituicao = new Map<
    number,
    { vr: number; participacaoPonderada: number; share: number; valorReais: number }
  >();
  for (const instituicaoId of instituicaoIds) {
    const participacaoPonderada = participacaoPorInstituicao.get(instituicaoId) ?? 0;
    const share = somaParticipacoesRede === 0 ? 0 : participacaoPonderada / somaParticipacoesRede;
    valorPorInstituicao.set(instituicaoId, {
      vr: vrPorInstituicao.get(instituicaoId) ?? 0,
      participacaoPonderada,
      share,
      valorReais: share * orcamentoAssistenciaEstudantil,
    });
  }

  // ---- Passo 3: subdivide o valor de cada instituição entre seus câmpus pela Matrícula Ponderada ----
  return campusInputs.map((campus) => {
    const daInstituicao = valorPorInstituicao.get(campus.instituicaoId) ?? {
      vr: 0,
      participacaoPonderada: 0,
      share: 0,
      valorReais: 0,
    };
    const matriculaPonderadaInstituicao = matriculaPonderadaPorInstituicao.get(campus.instituicaoId) ?? 0;
    const shareDentroInstituicao =
      matriculaPonderadaInstituicao === 0 ? 0 : campus.matriculaPonderada / matriculaPonderadaInstituicao;

    return {
      campusId: campus.campusId,
      instituicaoId: campus.instituicaoId,
      vrInstituicao: daInstituicao.vr,
      participacaoPonderadaInstituicao: daInstituicao.participacaoPonderada,
      somaParticipacoesRede,
      shareInstituicao: daInstituicao.share,
      valorInstituicao: daInstituicao.valorReais,
      matriculaPonderadaCampus: campus.matriculaPonderada,
      matriculaPonderadaInstituicao,
      shareDentroInstituicao,
      valorReais: shareDentroInstituicao * daInstituicao.valorReais,
    };
  });
}
