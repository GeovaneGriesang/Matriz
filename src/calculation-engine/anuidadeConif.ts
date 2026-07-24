export interface AnuidadeConifInput {
  instituicaoId: number;
  custeioInstituicao: number;
}

export interface AnuidadeConifResult {
  instituicaoId: number;
  custeioInstituicao: number;
  /** Escala 0-100, igual ao valor bruto informado pelo administrador (é dividido por 100 internamente). */
  percentualAnuidade: number;
  valorReais: number;
}

/**
 * Calcula a anuidade CONIF de cada instituição como um percentual sobre o seu próprio Custeio
 * (20RL) já distribuído — soma de Funcionamento + Reitorias + Qualidade e Eficiência daquela
 * instituição. É um valor informativo (o que a instituição deve repassar ao CONIF): não é
 * deduzido do Custeio distribuído, nem rateado a partir de um bolo de rede como os demais blocos.
 */
export function calcularAnuidadeConif(
  inputs: AnuidadeConifInput[],
  percentualAnuidade: number,
): AnuidadeConifResult[] {
  return inputs.map((input) => ({
    instituicaoId: input.instituicaoId,
    custeioInstituicao: input.custeioInstituicao,
    percentualAnuidade,
    valorReais: (percentualAnuidade / 100) * input.custeioInstituicao,
  }));
}
