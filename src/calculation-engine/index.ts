export * from "./types/qualidadeEficiencia.types";

export * from "./constants/qualidadeEficiencia.constants";
export * from "./constants/blocos.constants";

export { calcularBlocoIea } from "./qualidadeEficiencia/iea/calcularBlocoIea";
export { bucketizeIea } from "./qualidadeEficiencia/iea/bucketizeIea";
export { weightIea } from "./qualidadeEficiencia/iea/weightIea";

export { calcularBlocoRap } from "./qualidadeEficiencia/rap/calcularBlocoRap";
export { bucketizeRap, weightRap } from "./qualidadeEficiencia/rap/bucketizeRap";

export { calcularBlocoIapl } from "./qualidadeEficiencia/iapl/calcularBlocoIapl";
export { splitLegal } from "./qualidadeEficiencia/iapl/splitLegal";

export { blocoFuncionamento } from "./blocoFuncionamento";
export type { FuncionamentoInput, FuncionamentoResult } from "./blocoFuncionamento";

export { calcularMatriculaTotalEqualizadaPonderada } from "./matriculaTotalEqualizada";
export type {
  MatriculaTotalEqualizadaRegistro,
  MatriculaTotalEqualizadaPonderada,
} from "./matriculaTotalEqualizada";

export { aplicarPisoMinimoCampusNovo } from "./aplicarPisoMinimoCampusNovo";
export type { PisoMinimoCampusNovoResult } from "./aplicarPisoMinimoCampusNovo";

export { blocoReitorias } from "./blocoReitorias";
export type { ReitoriaInput, ReitoriaResult } from "./blocoReitorias";

export { blocoQualidadeEficiencia } from "./blocoQualidadeEficiencia";
export type { QualidadeEficienciaInstituicaoResult } from "./blocoQualidadeEficiencia";

export { blocoAssistenciaEstudantil } from "./blocoAssistenciaEstudantil";
export type * from "./types/assistenciaEstudantil.types";

export { calcularAnuidadeConif } from "./anuidadeConif";
export type { AnuidadeConifInput, AnuidadeConifResult } from "./anuidadeConif";
