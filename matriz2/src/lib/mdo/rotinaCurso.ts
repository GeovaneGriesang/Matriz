/**
 * A rotina que uma turma de técnico integrado exige no câmpus: quantas horas por dia, quantos períodos de aula, quantos turnos, e
 * o que isso ocupa de salas e de professores quando todas as turmas do curso estão em andamento. Não mexe no repasse: responde à
 * pergunta "cabe no câmpus?", que a regra da MDO não enxerga (ela paga pela carga horária total, não pelo número de anos).
 *
 * Supõe a carga horária em horas-relógio (60 minutos). Quando o câmpus conta o intervalo como parte da carga horária (Venâncio
 * Aires: 5 períodos de 45 minutos mais 15 de intervalo = 4 horas por turno), cada turno entrega mais horas com o mesmo número
 * de períodos de aula. A parte EAD da carga horária não ocupa sala nem turno.
 */

export interface RotinaDoCampus {
  /** Duração de um período de aula, em minutos (45 em Venâncio Aires). */
  minutosPorPeriodo: number;
  /** Períodos de aula em um turno (5 em Venâncio Aires, 6 em Lajeado). */
  periodosPorTurno: number;
  /** Dias letivos no ano (200 é o mínimo legal). */
  diasLetivos: number;
  /** O intervalo do turno conta como carga horária? */
  contarIntervalo: boolean;
  /** Minutos de intervalo por turno. */
  minutosDeIntervalo: number;
  /** Parte da carga horária a distância, de 0 a 1 (fora da sala e do turno). */
  fracaoEad: number;
}

export const ROTINA_PADRAO: RotinaDoCampus = {
  minutosPorPeriodo: 45,
  periodosPorTurno: 5,
  diasLetivos: 200,
  contarIntervalo: false,
  minutosDeIntervalo: 15,
  fracaoEad: 0,
};

export interface RotinaCalculada {
  horasPorAno: number;
  /** Horas presenciais por ano (tirada a parte EAD). */
  horasPresenciaisPorAno: number;
  /** Horas de carga horária que um turno entrega (períodos × minutos, mais o intervalo se contar). */
  horasPorTurno: number;
  horasPorDia: number;
  periodosPorDia: number;
  turnosPorDia: number;
  periodosPorSemana: number;
  /** Turnos além do turno diário, por semana (contraturnos); zero quando cabe em um turno. */
  contraturnosPorSemana: number;
  /** Quando todas as turmas estão em andamento (uma por ano de curso). */
  turmasAoMesmoTempo: number;
  periodosDeSalaPorSemana: number;
  /** Períodos de aula que os professores dão por ano, somando as turmas (sem dividir turma em laboratório). */
  periodosDeProfessorPorAno: number;
}

const DIAS_POR_SEMANA = 5;

export function calcularRotina(chTotal: number, anosDuracao: number, r: RotinaDoCampus): RotinaCalculada {
  const anos = Math.max(1, anosDuracao);
  const horasPorAno = chTotal / anos;
  const horasPresenciaisPorAno = horasPorAno * (1 - Math.min(1, Math.max(0, r.fracaoEad)));
  const minutosPorTurno = r.periodosPorTurno * r.minutosPorPeriodo + (r.contarIntervalo ? r.minutosDeIntervalo : 0);
  const horasPorTurno = minutosPorTurno / 60;
  const dias = Math.max(1, r.diasLetivos);
  const horasPorDia = horasPresenciaisPorAno / dias;
  const turnosPorDia = horasPorTurno > 0 ? horasPorDia / horasPorTurno : 0;
  const periodosPorDia = turnosPorDia * r.periodosPorTurno;
  const periodosPorSemana = periodosPorDia * DIAS_POR_SEMANA;
  const contraturnosPorSemana = Math.max(0, (turnosPorDia - 1) * DIAS_POR_SEMANA);
  const turmasAoMesmoTempo = anos;
  return {
    horasPorAno,
    horasPresenciaisPorAno,
    horasPorTurno,
    horasPorDia,
    periodosPorDia,
    turnosPorDia,
    periodosPorSemana,
    contraturnosPorSemana,
    turmasAoMesmoTempo,
    periodosDeSalaPorSemana: periodosPorSemana * turmasAoMesmoTempo,
    periodosDeProfessorPorAno: periodosPorDia * dias * turmasAoMesmoTempo,
  };
}
