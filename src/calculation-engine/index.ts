export * from "./types/alunoMatriz.types";
export * from "./types/qualidadeEficiencia.types";

export * from "./constants/alunoMatriz.constants";
export * from "./constants/qualidadeEficiencia.constants";
export * from "./constants/blocos.constants";

export { calcularMatriculaPonderada } from "./alunoMatriz/calcularMatriculaPonderada";
export { modalidadeWeight } from "./alunoMatriz/modalidadeWeight";
export { eixoAgricolaBonus } from "./alunoMatriz/eixoAgricolaBonus";
export { labInfraWeight } from "./alunoMatriz/labInfraWeight";
export { tecnicoIntegradoMinimo } from "./alunoMatriz/tecnicoIntegradoMinimo";
export { retencaoJanela, pesoRetencao } from "./alunoMatriz/retencaoJanela";
export { strictoSensuFactor, isStrictoSensu } from "./alunoMatriz/strictoSensuFactor";

export { calcularBlocoIea } from "./qualidadeEficiencia/iea/calcularBlocoIea";
export { bucketizeIea } from "./qualidadeEficiencia/iea/bucketizeIea";
export { weightIea } from "./qualidadeEficiencia/iea/weightIea";

export { calcularBlocoRap } from "./qualidadeEficiencia/rap/calcularBlocoRap";
export { calcularRazaoDocenteAluno } from "./qualidadeEficiencia/rap/calcularRazaoDocenteAluno";
export { weightRegimeTrabalho } from "./qualidadeEficiencia/rap/weightRegimeTrabalho";
export { bucketizeRap, weightRap } from "./qualidadeEficiencia/rap/bucketizeRap";

export { calcularBlocoIapl } from "./qualidadeEficiencia/iapl/calcularBlocoIapl";
export { splitLegal } from "./qualidadeEficiencia/iapl/splitLegal";

export { blocoFuncionamento } from "./blocoFuncionamento";
export type { FuncionamentoInput, FuncionamentoResult } from "./blocoFuncionamento";

export { blocoReitorias } from "./blocoReitorias";
export type { ReitoriaResult } from "./blocoReitorias";

export { blocoQualidadeEficiencia } from "./blocoQualidadeEficiencia";
export type { QualidadeEficienciaCampusResult } from "./blocoQualidadeEficiencia";
