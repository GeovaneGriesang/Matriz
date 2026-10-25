import Link from "next/link";
import { PROSE_LINK } from "@/lib/layoutWidths";
import { ehCampusDestaque, ehInstituicaoDestaque } from "@/lib/destaque";
import type { ItemDeLegenda } from "./LegendaDaTabela";

/**
 * Os textos de "Como ler esta tabela" das telas Consulta e Evasão: o que cada coluna é e a conta com os números de uma linha real
 * (o IFSul ou o Câmpus Venâncio Aires quando estão na tabela; senão, a primeira linha).
 */

const reais = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const dec2 = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const inteiro = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });

const nomeCurto = (nome: string) => nome.replace(/^CAMPUS( AVANÇADO)? /, "");

const MATRICULA_TOTAL = (
  <>
    a soma da Matrícula Total dos ciclos (turmas): alunos × ICQA × peso do curso × (carga horária ÷ 800) × (dias do ciclo no ano-base ÷
    dias do ciclo), como a MDO publica na 6ª fase. A conta turma a turma está em{" "}
    <Link href="/consulta/valor-do-aluno" className={PROSE_LINK}>
      Quanto vale um aluno
    </Link>
  </>
);

export function exemploDeInstituicao<T extends { sigla: string }>(linhas: T[]): T | undefined {
  return linhas.find((l) => ehInstituicaoDestaque(l.sigla)) ?? linhas[0];
}
export function exemploDeCampus<T extends { nome: string }>(linhas: T[]): T | undefined {
  return linhas.find((l) => ehCampusDestaque(l.nome)) ?? linhas[0];
}

export function legendaConsultaInstituicoes(
  l: { sigla: string; campus: number; matricula: number; valor: number; perda: number } | undefined,
  totalRede: number,
): ItemDeLegenda[] {
  if (!l) return [];
  return [
    { coluna: "Câmpus", texto: <>quantos câmpus da instituição têm valor na matriz deste ciclo. {l.sigla}: {inteiro.format(l.campus)}.</> },
    { coluna: "Matrícula", texto: <>{MATRICULA_TOTAL}. {l.sigla}: {dec2.format(l.matricula)}.</> },
    {
      coluna: "Gerado pela matriz",
      texto: (
        <>
          o Funcionamento que a matriz da MDO gera para os câmpus (5ª fase, já com o Piso Mínimo), somado. Não inclui a Reitoria, a Qualidade e
          Eficiência nem a Assistência Estudantil (essas estão no Comparativo). {l.sigla}: {reais.format(l.valor)}.
        </>
      ),
    },
    {
      coluna: "Fatia da rede",
      texto: (
        <>
          gerado pela matriz ÷ total da rede: {reais.format(l.valor)} ÷ {reais.format(totalRede)} ={" "}
          <strong>{totalRede > 0 ? dec2.format((l.valor / totalRede) * 100) : "0,00"}%</strong>.
        </>
      ),
    },
    {
      coluna: "Perda por evasão",
      texto: <>quanto deixou de receber pelos alunos que evadiram ou ficaram retidos além do prazo (o Custo Evadido da 6ª fase, somado). {l.sigla}: {reais.format(l.perda)}.</>,
    },
  ];
}

export function legendaConsultaCampus(
  l: { nome: string; ciclos: number; matricula: number; valor: number; perda: number; recebidoReal: number | null; funcionamentoCalculado: number | null } | undefined,
  comRecebido: boolean,
): ItemDeLegenda[] {
  if (!l) return [];
  const n = nomeCurto(l.nome);
  const itens: ItemDeLegenda[] = [
    { coluna: "Ciclos", texto: <>quantas turmas (ciclos de curso) do câmpus estão na 6ª fase. {n}: {inteiro.format(l.ciclos)}.</> },
    { coluna: "Matrícula", texto: <>{MATRICULA_TOTAL}. {n}: {dec2.format(l.matricula)}.</> },
    {
      coluna: "Gerado pela matriz",
      texto: <>o Funcionamento que a matriz da MDO gera para o câmpus (5ª fase, já com o Piso Mínimo garantido ao câmpus novo). {n}: {reais.format(l.valor)}.</>,
    },
  ];
  if (comRecebido) {
    itens.push(
      {
        coluna: "Recebido (real)",
        texto: (
          <>
            o que o câmpus de fato recebeu, cadastrado em Valores recebidos (pode ser diferente da matriz por decisão interna, contingenciamento
            ou emenda). {n}: {l.recebidoReal !== null ? reais.format(l.recebidoReal) : "sem registro"}.
          </>
        ),
      },
      {
        coluna: "Variação",
        texto:
          l.recebidoReal !== null ? (
            <>
              recebido − gerado pela matriz: {reais.format(l.recebidoReal)} − {reais.format(l.valor)} = <strong>{reais.format(l.recebidoReal - l.valor)}</strong>
              {l.valor > 0 ? ` (${dec2.format((l.recebidoReal / l.valor - 1) * 100)}%)` : ""}.
            </>
          ) : (
            <>recebido − gerado pela matriz; vazia quando não há valor recebido cadastrado.</>
          ),
      },
    );
  }
  itens.push(
    {
      coluna: "Funcionamento calculado",
      texto: (
        <>
          a mesma conta refeita por este sistema: Matrícula Total de cada modalidade × valor de uma matrícula da modalidade. Serve para conferir o
          gerado pela matriz; a diferença costuma vir do Piso Mínimo. {n}:{" "}
          {l.funcionamentoCalculado !== null ? reais.format(l.funcionamentoCalculado) : "não informado"}.
        </>
      ),
    },
    { coluna: "Perda por evasão", texto: <>o Custo Evadido da 6ª fase, somado dos cursos do câmpus. {n}: {reais.format(l.perda)}.</> },
  );
  return itens;
}

export function legendaConsultaCursos(c: { curso: string; nivel: string | null; repasse: string; peso: number | null; matricula: number; valor: number; perda: number } | undefined): ItemDeLegenda[] {
  if (!c) return [];
  return [
    { coluna: "Nível", texto: <>como a PNP classifica o curso: educação básica (técnico, Proeja, FIC), graduação ou pós-graduação. {c.curso}: {c.nivel ?? "não informado"}.</> },
    {
      coluna: "Repasse",
      texto: <>a categoria em que a MDO paga o ciclo: presencial, EAD (25% do presencial), EAD MOOC (8%) ou EAD com financiamento próprio (80%). {c.curso}: {c.repasse.replace("_", " ")}.</>,
    },
    {
      coluna: "Peso",
      texto: <>multiplicador pelo custo do curso, pela quantidade de laboratórios do catálogo (1,0 a 2,5; 3,75 na pós stricto sensu). {c.curso}: {c.peso !== null ? dec2.format(c.peso) : "não informado"}.</>,
    },
    { coluna: "Matrícula", texto: <>{MATRICULA_TOTAL}. {c.curso}: {dec2.format(c.matricula)}.</> },
    {
      coluna: "Recebido",
      texto: (
        <>
          matrícula × valor de uma matrícula na categoria de repasse
          {c.matricula > 0 ? (
            <>
              : {dec2.format(c.matricula)} × {reais.format(c.valor / c.matricula)} = <strong>{reais.format(c.valor)}</strong>
            </>
          ) : null}
          .
        </>
      ),
    },
    { coluna: "Perda", texto: <>o Custo Evadido: quanto o curso deixou de receber pelos alunos que evadiram ou ficaram retidos além do prazo. {c.curso}: {reais.format(c.perda)}.</> },
  ];
}

/** Evasão: as colunas se repetem nas três tabelas (instituições, câmpus, cursos). */
export function legendaEvasao(
  rotuloDoExemplo: string,
  l: { recebido: number; perda: number; taxa: number } | undefined,
  extra: { redePct?: number; posicao?: number | null } = {},
): ItemDeLegenda[] {
  if (!l) return [];
  const itens: ItemDeLegenda[] = [];
  if (extra.posicao !== undefined && extra.posicao !== null) {
    itens.push({ coluna: "Posição", texto: <>a ordem na rede, da menor taxa de perda para a maior. {rotuloDoExemplo}: {inteiro.format(extra.posicao)}ª.</> });
  }
  itens.push(
    { coluna: "Recebido", texto: <>o que a 6ª fase da MDO atribui aos ciclos de curso. {rotuloDoExemplo}: {reais.format(l.recebido)}.</> },
    { coluna: "Perda", texto: <>o Custo Evadido: o que deixou de receber pelos alunos que evadiram ou ficaram retidos além do prazo. {rotuloDoExemplo}: {reais.format(l.perda)}.</> },
    {
      coluna: "Taxa",
      texto: (
        <>
          perda ÷ recebido: {reais.format(l.perda)} ÷ {reais.format(l.recebido)} = <strong>{dec2.format(l.taxa)}%</strong>. Quanto menor, melhor.
        </>
      ),
    },
  );
  if (extra.redePct !== undefined) {
    itens.push({
      coluna: "Contra a rede",
      texto: (
        <>
          a barra compara a taxa com a da rede inteira ({dec2.format(extra.redePct)}%). {rotuloDoExemplo}: {dec2.format(l.taxa)}%,{" "}
          {l.taxa <= extra.redePct ? "abaixo da rede (melhor)" : "acima da rede (pior)"}.
        </>
      ),
    });
  }
  return itens;
}
