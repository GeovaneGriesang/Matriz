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
 * NÃO VALIDADO CONTRA A PLANILHA OFICIAL: `faixaRfp` vem da dimensão "RendaFamiliar" de
 * `ClassificacaoRacialRendaSexo.csv` — os rótulos batem exatamente com as 6 faixas de RFP da
 * seção 2 da metodologia ("0<RFP<=0,5" ... "RFP>3,5", "Não declarada", "S/I"; confirmado
 * consultando os dados ingeridos), então não é um cruzamento de nome de campo coincidente. Mas
 * a metodologia (seção 4.4) diz que o "VR" da planilha oficial vem de uma "pesquisa de renda per
 * capita dos estudantes" tratada como fonte externa à PNP — e a seção 8/9 da mesma metodologia
 * chega a listar esse CSV como não usado na matriz e a faixa de RFP como dado inexistente nos 17
 * CSVs (desatualizado; foi escrito antes desta implementação, ver Ação 2994 no histórico do
 * projeto). Não existe hoje nenhum teste ou comparação numérica que confirme que o VR calculado
 * aqui bate com o VR (coluna AK) da planilha oficial — só a categoria de renda foi conferida, não
 * o valor final. Ver docs/pnp-matriz/Metodologia_Matriz_Orcamentaria_CONIF.md, seções 2, 4.4, 8 e 9.
 *
 * 1) VR (RF Ponderada) = Σ (% de matrículas da instituição em cada faixa de RFP × peso
 *    da faixa) — índice de vulnerabilidade (0 a 2,5), independente do tamanho da instituição.
 * 2) O porte da instituição entra aqui: Participação ∝ MECHDA × VR, onde MECHDA = Σ Matrícula
 *    Ponderada Presencial + (Σ Matrícula Ponderada EAD ÷ 4) — a Matriz CONIF pondera a matrícula
 *    a distância a um quarto do peso da presencial. O orçamento é rateado entre as instituições
 *    do escopo proporcionalmente a essa participação.
 * 3) O valor de cada instituição é então subdividido entre seus câmpus proporcionalmente à
 *    Matrícula Ponderada total (Presencial + EAD, sem o desconto de 1/4 — essa etapa não tem
 *    fonte de dado de RFP por câmpus, então é só uma aproximação para dar uma linha por câmpus
 *    na tabela).
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

  // ---- Matrícula Ponderada total (Presencial + EAD) por instituição — usada só no passo 3 ----
  const matriculaPonderadaPorInstituicao = new Map<number, number>();
  for (const campus of campusInputs) {
    const totalCampus = campus.matriculaPonderadaPresencial + campus.matriculaPonderadaEad;
    matriculaPonderadaPorInstituicao.set(
      campus.instituicaoId,
      (matriculaPonderadaPorInstituicao.get(campus.instituicaoId) ?? 0) + totalCampus,
    );
  }

  // ---- MECHDA institucional = Presencial + EAD/4 — usado no passo 2 (participação) ----
  const mechdaPorInstituicao = new Map<number, number>();
  for (const campus of campusInputs) {
    const mechdaCampus = campus.matriculaPonderadaPresencial + campus.matriculaPonderadaEad / 4;
    mechdaPorInstituicao.set(campus.instituicaoId, (mechdaPorInstituicao.get(campus.instituicaoId) ?? 0) + mechdaCampus);
  }

  // ---- Passo 2: Participação ∝ MECHDA × VR — o porte da instituição entra só agora ----
  const instituicaoIds = new Set<number>([...vrPorInstituicao.keys(), ...mechdaPorInstituicao.keys()]);
  const participacaoPorInstituicao = new Map<number, number>();
  for (const instituicaoId of instituicaoIds) {
    const vr = vrPorInstituicao.get(instituicaoId) ?? 0;
    const mechda = mechdaPorInstituicao.get(instituicaoId) ?? 0;
    participacaoPorInstituicao.set(instituicaoId, mechda * vr);
  }

  const somaParticipacoesRede = Array.from(participacaoPorInstituicao.values()).reduce((total, v) => total + v, 0);

  const valorPorInstituicao = new Map<
    number,
    { vr: number; mechda: number; participacaoPonderada: number; share: number; valorReais: number }
  >();
  for (const instituicaoId of instituicaoIds) {
    const participacaoPonderada = participacaoPorInstituicao.get(instituicaoId) ?? 0;
    const share = somaParticipacoesRede === 0 ? 0 : participacaoPonderada / somaParticipacoesRede;
    valorPorInstituicao.set(instituicaoId, {
      vr: vrPorInstituicao.get(instituicaoId) ?? 0,
      mechda: mechdaPorInstituicao.get(instituicaoId) ?? 0,
      participacaoPonderada,
      share,
      valorReais: share * orcamentoAssistenciaEstudantil,
    });
  }

  // ---- Passo 3: subdivide o valor de cada instituição entre seus câmpus pela Matrícula Ponderada total ----
  return campusInputs.map((campus) => {
    const daInstituicao = valorPorInstituicao.get(campus.instituicaoId) ?? {
      vr: 0,
      mechda: 0,
      participacaoPonderada: 0,
      share: 0,
      valorReais: 0,
    };
    const matriculaPonderadaCampus = campus.matriculaPonderadaPresencial + campus.matriculaPonderadaEad;
    const matriculaPonderadaInstituicao = matriculaPonderadaPorInstituicao.get(campus.instituicaoId) ?? 0;
    const shareDentroInstituicao =
      matriculaPonderadaInstituicao === 0 ? 0 : matriculaPonderadaCampus / matriculaPonderadaInstituicao;

    return {
      campusId: campus.campusId,
      instituicaoId: campus.instituicaoId,
      vrInstituicao: daInstituicao.vr,
      mechdaInstituicao: daInstituicao.mechda,
      participacaoPonderadaInstituicao: daInstituicao.participacaoPonderada,
      somaParticipacoesRede,
      shareInstituicao: daInstituicao.share,
      valorInstituicao: daInstituicao.valorReais,
      matriculaPonderadaCampus,
      matriculaPonderadaInstituicao,
      shareDentroInstituicao,
      valorReais: shareDentroInstituicao * daInstituicao.valorReais,
    };
  });
}
