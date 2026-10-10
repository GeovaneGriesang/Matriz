"use client";

import { ehCampusDestaque } from "@/lib/destaque";
import { useEffect, useState } from "react";
import { SeloConfianca } from "@/components/Confianca";
import { TabelaOrdenavel, type ColunaOrdenavel } from "@/components/TabelaOrdenavel";
import { carregarCursosComparativoCampusAction } from "@/server/actions/comparativoCursos";
import { explicarVariacaoCampusAction, type ResultadoExplicacao } from "@/server/actions/explicarVariacao";
import type { CursoLinha } from "@/app/consulta/ConsultaTabelaCursos";
import { VARIACOES, totalDaVariacao, variacaoDoCampus, type ValoresDoCampus, type Variacao } from "@/lib/variacoesComparativo";

export interface LinhaComparativoCampus {
  unidadeId: number;
  nome: string;
  a: number;
  b: number;
  variacao: number;
  /** Quanto o campus recebeu de fato em cada ciclo, digitado em Valores recebidos. null se nao ha registro. */
  informadoA: number | null;
  informadoB: number | null;
}

const reais = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const doisDecimais = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Um valor de variação para a célula: "+R$ 1.234 (+4,5%)", verde se subiu e vermelho se caiu (quase zero fica cinza). */
function CelulaVariacao({ v }: { v: Variacao | null }) {
  if (v === null) return <span className="text-xs text-neutral-400">-</span>;
  const classe = Math.abs(v.absoluta) < 1 ? "text-neutral-500" : v.absoluta > 0 ? "text-if-green" : "text-if-red dark:text-red-400";
  const sinal = v.absoluta >= 0 ? "+" : "-";
  return (
    <span className={classe}>
      {sinal}
      {reais.format(Math.abs(v.absoluta))}
      {v.percentual !== null && (
        <span className="block text-xs">
          {v.absoluta >= 0 ? "+" : ""}
          {doisDecimais.format(v.percentual * 100)}%
        </span>
      )}
    </span>
  );
}

function rotuloDoPonto(p: { tipo: "calculado" | "informado"; ciclo: "A" | "B" }, anoA: number, anoB: number): string {
  return `${p.tipo === "calculado" ? "Calculado" : "Informado"} ${p.ciclo === "A" ? anoA : anoB}`;
}

/**
 * O comparativo por câmpus, com os dois valores de cada ciclo, o CALCULADO (a matriz) e o INFORMADO (o que o câmpus de fato recebeu),
 * e as cinco variações entre eles (ver `variacoesComparativo.ts`). Client Component só para hospedar `colunas` (com funções
 * `valor`/`render`), pelo mesmo motivo de sempre: `TabelaOrdenavel` é "use client".
 */
export function ComparativoTabelaCampus({
  linhas,
  anoA,
  anoB,
  bloco = "matriculas",
  instituicao,
  comInformado = true,
}: {
  linhas: LinhaComparativoCampus[];
  anoA: number;
  anoB: number;
  /** O bloco escolhido na tela: os valores dos câmpus já chegam filtrados por ele. */
  bloco?: string;
  /** O valor da instituição no mesmo bloco, para mostrar quanto dele fica fora dos câmpus. */
  instituicao?: { sigla: string; a: number; b: number };
  /** O valor informado existe só para o IFSul; nas outras instituições as colunas e variações que dependem dele não aparecem. */
  comInformado?: boolean;
}) {
  if (bloco === "iqe") {
    return (
      <p className="rounded-md border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-600 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-400">
        A MDO não distribui o bloco <strong>Qualidade e Eficiência</strong> por câmpus: os três indicadores (IEA, RAP e IAPL) são calculados para a
        instituição inteira, e o valor fica com ela{instituicao ? ` (${instituicao.sigla}: ${reais.format(instituicao.a)} em ${anoA} e ${reais.format(instituicao.b)} em ${anoB})` : ""}.
        A divisão desse dinheiro entre os câmpus, se houver, é uma decisão interna da instituição. Escolha Funcionamento, Assistência Estudantil ou Total para ver os câmpus.
      </p>
    );
  }
  const somaA = linhas.reduce((s, l) => s + l.a, 0);
  const somaB = linhas.reduce((s, l) => s + l.b, 0);
  const foraA = instituicao ? instituicao.a - somaA : 0;
  const foraB = instituicao ? instituicao.b - somaB : 0;
  const oQueFicaFora =
    bloco === "matriculas"
      ? "a Reitoria (o bloco de 10% das reitorias entra no Funcionamento da instituição)"
      : bloco === "totalSpo"
        ? "a Reitoria e o bloco Qualidade e Eficiência, que a MDO não distribui por câmpus"
        : "o que a MDO não atribui a nenhum câmpus";
  const valores = (l: LinhaComparativoCampus): ValoresDoCampus => ({ calculadoA: l.a, informadoA: l.informadoA, calculadoB: l.b, informadoB: l.informadoB });
  const variacoesUsadas = comInformado ? VARIACOES : VARIACOES.filter((v) => v.chave === "calcA_calcB");
  const totais = variacoesUsadas.map((def) => totalDaVariacao(def, linhas.map(valores)));
  const somaInformadoA = linhas.reduce((s, l) => s + (l.informadoA ?? 0), 0);
  const somaInformadoB = linhas.reduce((s, l) => s + (l.informadoB ?? 0), 0);
  const comInformadoA = linhas.filter((l) => l.informadoA !== null).length;
  const comInformadoB = linhas.filter((l) => l.informadoB !== null).length;

  const celulaInformado = (v: number | null) =>
    v === null ? (
      <span className="text-xs text-neutral-400" title="Ninguém cadastrou o valor recebido em Valores recebidos">
        sem registro
      </span>
    ) : (
      <span className="text-neutral-600 dark:text-neutral-400">{reais.format(v)}</span>
    );

  const colunasDeVariacao: ColunaOrdenavel<LinhaComparativoCampus>[] = variacoesUsadas.map((def) => ({
    chave: def.chave,
    rotulo: (
      <span className="block leading-tight">
        {rotuloDoPonto(def.de, anoA, anoB)}
        <span className="block text-neutral-400">para {rotuloDoPonto(def.para, anoA, anoB).toLowerCase()}</span>
      </span>
    ),
    alinhamento: "right",
    valor: (l) => variacaoDoCampus(def, valores(l))?.absoluta ?? null,
    render: (l) =>
      def.chave === "calcA_calcB" && l.a === 0 && l.b > 0 ? (
        <span className="text-xs text-neutral-500">novo no ciclo</span>
      ) : (
        <CelulaVariacao v={variacaoDoCampus(def, valores(l))} />
      ),
  }));

  return (
    <div className="flex flex-col gap-2">
      <TabelaOrdenavel
        linhas={linhas}
        chaveLinha={(l) => l.unidadeId}
        linhaDestaque={(l) => ehCampusDestaque(l.nome)}
        linhaExpandida={(l) => (
          <div className="flex flex-col gap-4">
            <ExplicacaoVariacao unidadeId={l.unidadeId} anoA={anoA} anoB={anoB} nome={l.nome} />
            <CursosDoCampus unidadeId={l.unidadeId} anoA={anoA} anoB={anoB} />
          </div>
        )}
        colunas={[
          { chave: "nome", rotulo: "Câmpus", valor: (l) => l.nome },
          {
            chave: "calculadoA",
            rotulo: `Calculado ${anoA}`,
            alinhamento: "right",
            valor: (l) => (l.a === 0 && l.b > 0 ? null : l.a),
            render: (l) => <span className="text-neutral-600 dark:text-neutral-400">{l.a === 0 && l.b > 0 ? "não havia" : reais.format(l.a)}</span>,
          },
          ...(comInformado
            ? [{ chave: "informadoA", rotulo: `Informado ${anoA}`, alinhamento: "right" as const, valor: (l: LinhaComparativoCampus) => l.informadoA, render: (l: LinhaComparativoCampus) => celulaInformado(l.informadoA) }]
            : []),
          { chave: "calculadoB", rotulo: `Calculado ${anoB}`, alinhamento: "right", valor: (l) => l.b, render: (l) => reais.format(l.b) },
          ...(comInformado
            ? [{ chave: "informadoB", rotulo: `Informado ${anoB}`, alinhamento: "right" as const, valor: (l: LinhaComparativoCampus) => l.informadoB, render: (l: LinhaComparativoCampus) => celulaInformado(l.informadoB) }]
            : []),
          ...colunasDeVariacao,
        ]}
        rodape={
          <tfoot>
            <tr className="border-t-2 border-neutral-300 bg-neutral-50 font-semibold dark:border-neutral-700 dark:bg-neutral-900">
              <td className="px-2 py-2.5" />
              <td className="px-4 py-2.5">Soma dos {linhas.length} câmpus</td>
              <td className="px-4 py-2.5 text-right tabular-nums">{reais.format(somaA)}</td>
              {comInformado && (
                <td className="px-4 py-2.5 text-right tabular-nums">
                  {reais.format(somaInformadoA)}
                  <span className="block text-xs font-normal text-neutral-500">
                    {comInformadoA} de {linhas.length} com registro
                  </span>
                </td>
              )}
              <td className="px-4 py-2.5 text-right tabular-nums">{reais.format(somaB)}</td>
              {comInformado && (
                <td className="px-4 py-2.5 text-right tabular-nums">
                  {reais.format(somaInformadoB)}
                  <span className="block text-xs font-normal text-neutral-500">
                    {comInformadoB} de {linhas.length} com registro
                  </span>
                </td>
              )}
              {totais.map((t, i) => (
                <td key={variacoesUsadas[i]!.chave} className="px-4 py-2.5 text-right tabular-nums">
                  <CelulaVariacao v={t?.variacao ?? null} />
                  {t && t.comparados < t.total && (
                    <span className="block text-xs font-normal text-neutral-500">
                      em {t.comparados} de {t.total} câmpus
                    </span>
                  )}
                </td>
              ))}
            </tr>
          </tfoot>
        }
      />
      {instituicao && (
        <div className="tabela-rolavel">
          <table className="w-full text-sm" data-sem-ferramentas>
            <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
              <tr>
                <td className="py-1.5 pr-3 text-neutral-600 dark:text-neutral-400">{instituicao.sigla}, valor da instituição neste bloco</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{reais.format(instituicao.a)} <span className="text-xs text-neutral-500">em {anoA}</span></td>
                <td className="px-3 py-1.5 text-right tabular-nums">{reais.format(instituicao.b)} <span className="text-xs text-neutral-500">em {anoB}</span></td>
              </tr>
              <tr>
                <td className="py-1.5 pr-3 text-neutral-600 dark:text-neutral-400">Soma dos {linhas.length} câmpus</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{reais.format(somaA)}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{reais.format(somaB)}</td>
              </tr>
              <tr className="font-medium">
                <td className="py-1.5 pr-3">Fica com a instituição: {oQueFicaFora}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{reais.format(foraA)}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{reais.format(foraB)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-neutral-500 dark:text-neutral-400">
        <strong>Calculado</strong> é o que a matriz da MDO diz que o câmpus recebe{bloco === "ae" ? " de Assistência Estudantil (presencial, EAD e RIP)" : bloco === "totalSpo" ? ", somando Funcionamento e Assistência Estudantil" : " de Funcionamento (já com o Piso Mínimo)"}.
        {comInformado
          ? " Informado é o que ele de fato recebeu, digitado em Valores recebidos. Cada variação vai do primeiro valor para o segundo (verde: o segundo é maior; vermelho: é menor). Na linha de soma, cada variação só soma os câmpus que têm os dois valores, para que a falta de registro do informado não pareça diferença."
          : " Aqui só há a variação entre os dois ciclos calculados. O valor informado (o que o câmpus de fato recebeu) existe só para o IFSul e aparece quando a opção \"Considerar dados informados para o IFSul\" está marcada."}
      </p>
    </div>
  );
}

const reaisCurso = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

/**
 * Segundo nível do "+/-": os cursos de um câmpus, carregados só quando a pessoa
 * abre esse câmpus (não faz sentido puxar os cursos de todos os câmpus da rede
 * antecipadamente). Mostra os dois ciclos lado a lado; como o nome de um curso pode
 * mudar de um ciclo para o outro, cada lista é ordenada por valor, sem tentar casar
 * curso a curso.
 */
function CursosDoCampus({ unidadeId, anoA, anoB }: { unidadeId: number; anoA: number; anoB: number }) {
  const [estado, setEstado] = useState<
    { status: "carregando" } | { status: "erro"; mensagem: string } | { status: "pronto"; cursosA: CursoLinha[]; cursosB: CursoLinha[] }
  >({ status: "carregando" });

  useEffect(() => {
    let cancelado = false;
    carregarCursosComparativoCampusAction(unidadeId, anoA, anoB).then((resultado) => {
      if (cancelado) return;
      if (!resultado.ok) {
        setEstado({ status: "erro", mensagem: resultado.errorMessage ?? "Não foi possível carregar os cursos." });
        return;
      }
      setEstado({ status: "pronto", cursosA: resultado.cursosA, cursosB: resultado.cursosB });
    });
    return () => {
      cancelado = true;
    };
  }, [unidadeId, anoA, anoB]);

  if (estado.status === "carregando") {
    return <p className="text-sm text-neutral-500 dark:text-neutral-400">Carregando cursos...</p>;
  }
  if (estado.status === "erro") {
    return <p className="text-sm text-if-red">{estado.mensagem}</p>;
  }
  if (estado.cursosA.length === 0 && estado.cursosB.length === 0) {
    return (
      <p className="text-sm text-neutral-500 dark:text-neutral-400">
        Nenhum curso com 6ª fase carregada para este câmpus em {anoA} nem {anoB}.
      </p>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <ListaCursos ano={anoA} cursos={estado.cursosA} />
      <ListaCursos ano={anoB} cursos={estado.cursosB} />
    </div>
  );
}

function ListaCursos({ ano, cursos }: { ano: number; cursos: CursoLinha[] }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">Cursos em {ano}</span>
      {cursos.length === 0 ? (
        <p className="text-xs text-neutral-500 dark:text-neutral-400">Sem 6ª fase carregada em {ano}.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-neutral-200 rounded-md border border-neutral-200 bg-white text-sm dark:divide-neutral-800 dark:border-neutral-800 dark:bg-neutral-950">
          {cursos.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-3 px-3 py-1.5">
              <span className="text-neutral-700 dark:text-neutral-300">{c.curso}</span>
              <span className="shrink-0 tabular-nums text-neutral-900 dark:text-neutral-100">{reaisCurso.format(c.valor)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const inteiro = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });

function Sinal({ v }: { v: number }) {
  return (
    <span className={Math.abs(v) < 1 ? "text-neutral-500" : v > 0 ? "text-if-green" : "text-if-red dark:text-red-400"}>
      {v >= 0 ? "+" : "-"}
      {reais.format(Math.abs(v))}
    </span>
  );
}

/**
 * O botão "O que ocorreu?": explica por que a MATRIZ do câmpus mudou entre os dois ciclos
 * (só ela; o informado é digitado, não tem um porquê). Busca sob demanda, como os cursos.
 */
function ExplicacaoVariacao({ unidadeId, anoA, anoB, nome }: { unidadeId: number; anoA: number; anoB: number; nome: string }) {
  const [aberto, setAberto] = useState(false);
  const [estado, setEstado] = useState<{ status: "carregando" } | { status: "pronto"; r: ResultadoExplicacao } | null>(null);

  function alternar() {
    const abrir = !aberto;
    setAberto(abrir);
    if (abrir && estado === null) {
      setEstado({ status: "carregando" });
      explicarVariacaoCampusAction(unidadeId, anoA, anoB).then((r) => setEstado({ status: "pronto", r }));
    }
  }

  const e = estado?.status === "pronto" ? estado.r.explicacao : undefined;

  return (
    <div className="flex flex-col gap-2">
      <div>
        <button
          type="button"
          onClick={alternar}
          className="rounded-md border border-if-green px-3 py-1.5 text-sm font-medium text-if-green hover:bg-if-green/10"
        >
          {aberto ? "Esconder" : "O que ocorreu com o valor da matriz?"}
        </button>
      </div>
      {aberto && estado?.status === "carregando" && <p className="text-sm text-neutral-500">Calculando...</p>}
      {aberto && estado?.status === "pronto" && !estado.r.ok && <p className="text-sm text-if-red">{estado.r.errorMessage}</p>}
      {aberto && estado?.status === "pronto" && estado.r.motivoSemExplicacao && (
        <p className="text-sm text-neutral-600 dark:text-neutral-400">{estado.r.motivoSemExplicacao}</p>
      )}
      {aberto && e && (
        <div className="flex flex-col gap-3 rounded-md border border-neutral-200 bg-white p-4 text-sm dark:border-neutral-800 dark:bg-neutral-950">
          <p className="text-neutral-700 dark:text-neutral-300">
            O Funcionamento de <strong>{nome}</strong> foi de {reais.format(e.valorA)} em {e.anoA} para {reais.format(e.valorB)} em{" "}
            {e.anoB}, uma diferença de <Sinal v={e.diferenca} />. Ela se explica por quatro efeitos, que somam exatamente essa
            diferença:
          </p>
          <table className="w-full text-sm">
            <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
              <tr>
                <td className="py-1.5 pr-3">Matriz de {e.anoA}</td>
                <td className="py-1.5 text-right tabular-nums">{reais.format(e.valorA)}</td>
              </tr>
              <tr>
                <td className="py-1.5 pr-3 align-top">
                  <strong>Matrícula:</strong> mais ou menos alunos (já ponderados por peso do curso, carga horária e dias)
                  <ul className="mt-1 list-disc pl-5 text-xs text-neutral-500">
                    {e.efeitoMatriculaPorModalidade
                      .filter((m) => m.matriculaA > 0 || m.matriculaB > 0)
                      .map((m) => (
                        <li key={m.modalidade}>
                          {m.rotulo}: {inteiro.format(m.matriculaA)} para {inteiro.format(m.matriculaB)} matrículas equalizadas
                        </li>
                      ))}
                  </ul>
                </td>
                <td className="py-1.5 text-right align-top tabular-nums">
                  <Sinal v={e.efeitoMatricula} />
                </td>
              </tr>
              <tr>
                <td className="py-1.5 pr-3 align-top">
                  <strong>Orçamento:</strong> o Funcionamento da rede passou de {reais.format(e.fundoRedeA)} para {reais.format(e.fundoRedeB)},
                  o que muda o valor de cada matrícula
                </td>
                <td className="py-1.5 text-right align-top tabular-nums">
                  <Sinal v={e.efeitoOrcamento} />
                </td>
              </tr>
              <tr>
                <td className="py-1.5 pr-3 align-top">
                  <strong>Matrículas da rede:</strong> a rede passou de {inteiro.format(e.matriculaRedeA)} para {inteiro.format(e.matriculaRedeB)}{" "}
                  matrículas equivalentes; mais matrícula dividindo o mesmo dinheiro reduz o valor de cada uma (o valor de uma matrícula
                  presencial foi de {reais.format(e.valorMatriculaPresencialA)} para {reais.format(e.valorMatriculaPresencialB)})
                </td>
                <td className="py-1.5 text-right align-top tabular-nums">
                  <Sinal v={e.efeitoMatriculaRede} />
                </td>
              </tr>
              <tr>
                <td className="py-1.5 pr-3 align-top">
                  <strong>Piso Mínimo e ajustes da fonte:</strong> mudança no quanto o câmpus foi elevado ao piso e demais ajustes da fonte
                </td>
                <td className="py-1.5 text-right align-top tabular-nums">
                  <Sinal v={e.efeitoPiso} />
                </td>
              </tr>
              <tr className="font-semibold">
                <td className="py-1.5 pr-3">Matriz de {e.anoB}</td>
                <td className="py-1.5 text-right tabular-nums">{reais.format(e.valorB)}</td>
              </tr>
            </tbody>
          </table>
          <p className="text-xs text-neutral-500">
            Esta explicação vale só para a matriz (Funcionamento por matrícula). O valor informado é digitado por um
            administrador e não tem decomposição.
          </p>
          <div className="flex flex-wrap gap-2">
            <SeloConfianca id="explicacao-variacao" />
            {e.anoB === 2027 && <SeloConfianca id="mooc-2027" />}
          </div>
        </div>
      )}
    </div>
  );
}
