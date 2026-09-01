/**
 * Símbolo da marca Instituto Federal, reconstruído em SVG a partir da grade
 * descrita no Manual de Aplicação da Marca IF (Setec/MEC nº 31/2015): módulo
 * x, espaçamento de 20% de x entre módulos, raio de arredondamento de 10% de
 * x, círculo 10% maior que x. Usa apenas as cores oficiais da rede (verde,
 * vermelho, preto) — nunca deve ser recolorido, distorcido ou rotacionado.
 */
interface InstitutoFederalMarkProps {
  size?: number;
  className?: string;
}

const MODULE = 18;
const GAP = MODULE * 0.2;
const STEP = MODULE + GAP;
const RADIUS = MODULE * 0.1;
const CIRCLE_R = (MODULE * 1.1) / 2;

const GREEN_CELLS: Array<[number, number]> = [
  [1, 0],
  [2, 0],
  [0, 1],
  [1, 1],
  [0, 2],
  [1, 2],
  [2, 2],
  [0, 3],
  [1, 3],
];

// A marca ocupa 3 colunas e 4 linhas — não é quadrada. O viewBox precisa
// cobrir as 4 linhas inteiras, senão a última linha fica cortada.
const COLS = 3;
const ROWS = 4;
const VIEWBOX_WIDTH = (COLS - 1) * STEP + MODULE;
const VIEWBOX_HEIGHT = (ROWS - 1) * STEP + MODULE;
const ASPECT_RATIO = VIEWBOX_WIDTH / VIEWBOX_HEIGHT;

export function InstitutoFederalMark({ size = 32, className }: InstitutoFederalMarkProps) {
  return (
    <svg
      role="img"
      aria-label="Símbolo do Instituto Federal"
      width={size * ASPECT_RATIO}
      height={size}
      viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
      className={className}
    >
      {GREEN_CELLS.map(([col, row]) => (
        <rect
          key={`${col}-${row}`}
          x={col * STEP}
          y={row * STEP}
          width={MODULE}
          height={MODULE}
          rx={RADIUS}
          className="fill-if-green"
        />
      ))}
      <circle cx={MODULE / 2} cy={MODULE / 2} r={CIRCLE_R} className="fill-if-red" />
    </svg>
  );
}
