"use client";

import Link from "next/link";
import type { FaseMdo, Abrangencia, OrigemDados } from "@prisma/client";
import { EtiquetaProcedencia } from "@/components/Procedencia";
import { TabelaOrdenavel, type ColunaOrdenavel } from "@/components/TabelaOrdenavel";
import { PROSE_LINK } from "@/lib/layoutWidths";

export interface FonteLinha {
  id: number;
  origem: OrigemDados;
  cicloOrcamento: number;
  fase: FaseMdo | null;
  arquivo: string;
  abrangencia: Abrangencia;
  instituicao: { sigla: string } | null;
  geradoEm: Date | null;
  carregadoEm: Date;
  ressalva: string | null;
  registros: number;
  soma: number | null;
  /** Dado pessoal por aluno (LGPD): nunca oferece o arquivo original pra baixar,
   * só os agregados que já aparecem no sistema. */
  temDadoPessoal: boolean;
}

const numero = new Intl.NumberFormat("pt-BR");
const reais = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const dataHora = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });

const ROTULO_FASE: Record<string, string> = {
  F1A_OBTENCAO: "1ª fase, obtenção dos dados",
  F1B_IMPORTACAO: "1ª fase, importação",
  F2_CONFERENCIA_EXTRACAO: "2ª fase, conferência da extração",
  F3_PARAMETROS_CAMPUS: "3ª fase, parâmetros por câmpus",
  F4_CHECAGEM_MATRICULAS: "4ª fase, checagem de matrículas",
  F5_PROPOSTA: "5ª fase, geração da proposta",
  F6_PARTICIPACAO: "6ª fase, participação na distribuição",
};

const ROTULO_ABRANGENCIA: Record<string, string> = {
  REDE: "Rede completa",
  INSTITUICAO: "Uma instituição",
  CAMPUS: "Um câmpus",
};

/**
 * Client Component só para hospedar `colunas` (com funções `valor`/`render`):
 * `TabelaOrdenavel` é "use client", e uma função não atravessa a fronteira de
 * Server para Client Component como prop. `soma` já vem pronta em cada linha
 * (mesclada na página, Server Component) em vez de um `Map` separado, para não
 * precisar de outra função de busca aqui.
 */
export function DadosImportadosTabela({ fontes }: { fontes: FonteLinha[] }) {
  return (
    <TabelaOrdenavel
      linhas={fontes}
      chaveLinha={(f) => f.id}
      colunas={
        [
          {
            chave: "ciclo",
            rotulo: "Ciclo",
            alinhamento: "right",
            valor: (f) => f.cicloOrcamento,
            render: (f) => <span className="font-medium">{f.cicloOrcamento}</span>,
          },
          {
            chave: "origem",
            rotulo: "Origem",
            valor: (f) => f.origem,
            render: (f) => <EtiquetaProcedencia fonte={f} />,
          },
          {
            chave: "etapa",
            rotulo: "Etapa",
            valor: (f) => (f.fase ? (ROTULO_FASE[f.fase] ?? f.fase) : ""),
            render: (f) => (
              <span className="text-neutral-600 dark:text-neutral-400">{f.fase ? ROTULO_FASE[f.fase] : "-"}</span>
            ),
          },
          {
            chave: "arquivo",
            rotulo: "Arquivo",
            valor: (f) => f.arquivo,
            render: (f) =>
              f.temDadoPessoal ? (
                <span
                  className="font-mono text-xs text-neutral-600 dark:text-neutral-400"
                  title="Dado pessoal por aluno (LGPD): não disponível para baixar, só os agregados aparecem no sistema."
                >
                  {f.arquivo}
                </span>
              ) : (
                <Link
                  href={`/api/dados-importados/${f.id}/baixar`}
                  className={`font-mono text-xs ${PROSE_LINK}`}
                  prefetch={false}
                >
                  {f.arquivo}
                </Link>
              ),
          },
          {
            chave: "abrange",
            rotulo: "Abrange",
            valor: (f) => ROTULO_ABRANGENCIA[f.abrangencia] + (f.instituicao ? `, ${f.instituicao.sigla}` : ""),
            render: (f) => (
              <span className="text-neutral-600 dark:text-neutral-400">
                {ROTULO_ABRANGENCIA[f.abrangencia]}
                {f.instituicao && `, ${f.instituicao.sigla}`}
              </span>
            ),
          },
          {
            chave: "registros",
            rotulo: "Registros",
            alinhamento: "right",
            valor: (f) => f.registros,
            render: (f) => numero.format(f.registros),
          },
          {
            chave: "soma",
            rotulo: "Soma",
            alinhamento: "right",
            valor: (f) => f.soma,
            render: (f) => (f.soma !== null ? reais.format(f.soma) : "-"),
          },
          {
            chave: "carregado",
            rotulo: "Carregado",
            valor: (f) => f.carregadoEm.getTime(),
            render: (f) => (
              <span className="text-neutral-600 dark:text-neutral-400">{dataHora.format(f.carregadoEm)}</span>
            ),
          },
        ] satisfies ColunaOrdenavel<FonteLinha>[]
      }
    />
  );
}
