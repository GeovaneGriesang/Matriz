import { NotImplementedError } from "../errors/NotImplementedError";

/**
 * A Portaria SETEC/MEC nº 51/2018 (Art. 2º e Anexo II) define oficialmente:
 *   Mateq = Mat × fech × fec
 *   fech (Fator de Equiparação de Carga Horária) = 1, exceto FIC: fech = chmr / 800
 *   fec (Fator de Esforço de Curso) = valor tabelado por Tipo de Curso × Eixo Tecnológico × Curso
 *   (Anexo II, salvo em FEC_Portaria51_2018_AnexoII.csv)
 *
 * Temos a tabela do Anexo II de 2018, mas ao testar contra os CSVs atuais da PNP os números não
 * bateram (a Portaria prevê revisão do FEC a cada 2 anos — a tabela de 2018 provavelmente está
 * desatualizada para o ciclo vigente) — ver seção 3.2.1 e seção 9 (item 1) de
 * docs/pnp-matriz/Metodologia_Matriz_Orcamentaria_CONIF.md.
 *
 * Pendente de confirmação com CONIF/SETEC de uma tabela de FEC vigente e validada. NÃO usar a
 * tabela de 2018 como aproximação silenciosa — isso afetaria tanto o numerador do RAP Presencial
 * quanto qualquer recálculo de Matrícula-equivalente, com um fator que hoje sabemos estar errado
 * em algum grau não medido.
 */
export function aplicarFatorEsforcoCurso(
  _tipoCurso: string,
  _eixoTecnologico: string,
  _curso: string,
  _cargaHorariaMinimaRegulamentada: number,
  _matriculas: number,
): number {
  throw new NotImplementedError(
    "Pendente de confirmação com CONIF/SETEC — ver seção 9 de Metodologia_Matriz_Orcamentaria_CONIF.md. Não implementar sem a fórmula oficial confirmada.",
  );
}
