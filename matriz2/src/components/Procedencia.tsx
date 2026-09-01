import type { Abrangencia, FaseMdo, OrigemDados } from "@prisma/client";

/**
 * A etiqueta de procedência, que acompanha todo número exibido no sistema.
 *
 * Existe porque um valor orçamentário sem origem não se defende numa reunião. Quem
 * olha a tela precisa saber, sem perguntar, se aquele número veio homologado da MDO,
 * foi somado aqui, ou foi digitado por alguém.
 */

const ROTULO_ORIGEM: Record<OrigemDados, string> = {
  PNP: "PNP",
  MDO_IFTM: "MDO",
  CALCULADO: "Calculado",
  ADMINISTRADOR: "Informado",
};

/** As cores seguem a mesma lógica da legenda da memória de cálculo: verde para o
 *  oficial, âmbar para o derivado, vermelho para o digitado à mão. */
const COR_ORIGEM: Record<OrigemDados, string> = {
  PNP: "border-if-green/40 bg-if-green/10 text-if-green dark:text-green-400",
  MDO_IFTM: "border-if-green/40 bg-if-green/10 text-if-green dark:text-green-400",
  CALCULADO: "border-amber-400/50 bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  ADMINISTRADOR: "border-if-red/40 bg-if-red/10 text-if-red dark:text-red-400",
};

const ROTULO_FASE: Record<FaseMdo, string> = {
  F1A_OBTENCAO: "1ª fase, obtenção dos dados",
  F1B_IMPORTACAO: "1ª fase, importação",
  F2_CONFERENCIA_EXTRACAO: "2ª fase, conferência da extração",
  F3_PARAMETROS_CAMPUS: "3ª fase, parâmetros por câmpus",
  F4_CHECAGEM_MATRICULAS: "4ª fase, checagem de matrículas",
  F5_PROPOSTA: "5ª fase, geração da proposta",
  F6_PARTICIPACAO: "6ª fase, participação na distribuição",
};

const ROTULO_ABRANGENCIA: Record<Abrangencia, string> = {
  REDE: "rede completa",
  INSTITUICAO: "uma instituição",
  CAMPUS: "um câmpus",
};

export interface DadosProcedencia {
  origem: OrigemDados;
  fase: FaseMdo | null;
  arquivo: string;
  geradoEm: Date | null;
  carregadoEm: Date;
  abrangencia: Abrangencia;
  ressalva: string | null;
}

const dataCurta = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });

export function EtiquetaProcedencia({ fonte }: { fonte: DadosProcedencia }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded border px-2 py-0.5 text-xs font-medium ${COR_ORIGEM[fonte.origem]}`}
      title={`${fonte.arquivo}${fonte.fase ? ` — ${ROTULO_FASE[fonte.fase]}` : ""}`}
    >
      {ROTULO_ORIGEM[fonte.origem]}
      {fonte.geradoEm && <span className="font-normal opacity-80">{dataCurta.format(fonte.geradoEm)}</span>}
    </span>
  );
}

/** Bloco explicativo completo, para o rodapé de uma tela de consulta. */
export function PainelProcedencia({ fonte }: { fonte: DadosProcedencia }) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4 text-sm dark:border-neutral-800 dark:bg-neutral-900">
      <div className="flex flex-wrap items-center gap-2">
        <EtiquetaProcedencia fonte={fonte} />
        <span className="text-neutral-600 dark:text-neutral-400">
          De onde vêm os números desta tela.
        </span>
      </div>
      <dl className="mt-3 grid gap-x-8 gap-y-1.5 text-neutral-600 sm:grid-cols-2 dark:text-neutral-400">
        <div className="flex gap-2">
          <dt className="font-medium text-neutral-800 dark:text-neutral-200">Arquivo</dt>
          <dd className="truncate font-mono text-xs leading-5">{fonte.arquivo}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="font-medium text-neutral-800 dark:text-neutral-200">Etapa</dt>
          <dd>{fonte.fase ? ROTULO_FASE[fonte.fase] : "não se aplica"}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="font-medium text-neutral-800 dark:text-neutral-200">Data do dado</dt>
          <dd>{fonte.geradoEm ? dataCurta.format(fonte.geradoEm) : "a planilha não informa"}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="font-medium text-neutral-800 dark:text-neutral-200">Carregado em</dt>
          <dd>{dataCurta.format(fonte.carregadoEm)}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="font-medium text-neutral-800 dark:text-neutral-200">Abrange</dt>
          <dd>{ROTULO_ABRANGENCIA[fonte.abrangencia]}</dd>
        </div>
      </dl>
      {fonte.ressalva && (
        <p className="mt-3 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
          <strong>Ressalva.</strong> {fonte.ressalva}
        </p>
      )}
    </div>
  );
}
