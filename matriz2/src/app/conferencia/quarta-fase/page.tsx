import Link from "next/link";
import { PROSE_LINK, TABLE_MAX_WIDTH } from "@/lib/layoutWidths";
import { requireAcessoPlenoOrRedirect } from "@/server/auth/session";
import { PainelProcedencia } from "@/components/Procedencia";
import { ehCampusDestaque } from "@/lib/destaque";
import { COLUNAS_QUARTA_FASE, contaDaColuna, valorDaColuna } from "@/lib/mdo/quartaFase";
import { arquivosQuartaFase, conferenciaQuartaFase, SITUACOES, type LinhaConferida } from "@/server/queries/quartaFase";

export const dynamic = "force-dynamic";

interface Busca {
  arquivo?: string;
  unidade?: string;
  linha?: string;
  q?: string;
  so?: string;
}

const inteiro = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fator = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 4 });
const exato = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 6 });
const dia = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });

const OK = <span className="font-semibold text-if-green" title="Confere">✓</span>;
const NAO = <span className="font-semibold text-if-red" title="Não confere">✗</span>;

const th = "whitespace-nowrap px-2 py-1.5 text-right font-medium";
const thE = "whitespace-nowrap px-2 py-1.5 text-left font-medium";
const td = "whitespace-nowrap px-2 py-1 text-right tabular-nums";
const tdE = "px-2 py-1 text-left";

function rotuloArquivo(a: { ciclo: number; arquivo: string; geradoEm: Date | null }, temResultados: boolean) {
  const gerado = a.geradoEm ? `, gerada em ${dia.format(a.geradoEm)}` : "";
  return `Matriz ${a.ciclo}: ${temResultados ? "planilha salva no Excel (com os resultados)" : "exportação da MDO (só fórmulas)"}${gerado}`;
}

export default async function QuartaFasePage({ searchParams }: { searchParams: Promise<Busca> }) {
  await requireAcessoPlenoOrRedirect("/conferencia/quarta-fase");
  const params = await searchParams;
  const arquivos = await arquivosQuartaFase();

  const cabecalho = (
    <div className="flex flex-col gap-2">
      <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">Conferência da 4ª fase: a Matrícula Total, coluna a coluna</h1>
      <p className="max-w-4xl text-neutral-600 dark:text-neutral-400">
        A 4ª fase da MDO (&quot;Checagem de Matrículas Totais&quot;) é a planilha em que cada instituição confere a Matrícula Total de cada ciclo de curso, a
        base de tudo o que a matriz distribui. Esta tela carrega essa planilha e refaz <strong>todas as colunas calculadas</strong>, com as mesmas fórmulas do
        Excel, ciclo a ciclo. Ao lado, mostra o que o arquivo traz e se os dois números são iguais. Assim dá para ver, sem abrir o Excel, que o sistema usa os
        mesmos dados e a mesma regra que a planilha.
      </p>
    </div>
  );

  if (arquivos.length === 0) {
    return (
      <main className={`mx-auto flex ${TABLE_MAX_WIDTH} flex-col gap-4 px-6 py-12 lg:px-12`}>
        {cabecalho}
        <p className="text-neutral-600 dark:text-neutral-400">
          Nenhuma planilha da 4ª fase foi carregada. Rode <code>npm run carregar:quarta-fase</code>.
        </p>
      </main>
    );
  }

  // Por padrão, a planilha com resultados gravados (a que a DDI usa); senão, a mais recente.
  const escolhido = arquivos.find((a) => String(a.id) === params.arquivo) ?? arquivos.find((a) => a.temResultados) ?? arquivos[arquivos.length - 1]!;
  const dados = await conferenciaQuartaFase(escolhido);
  const { totais, temResultados } = dados;

  const unidadesDoArquivo = dados.unidades.map((u) => u.unidade);
  const unidade = unidadesDoArquivo.find((u) => u === params.unidade) ?? unidadesDoArquivo.find((u) => ehCampusDestaque(u)) ?? unidadesDoArquivo[0]!;
  const busca = (params.q ?? "").trim().toUpperCase();
  const soDiferentes = params.so === "diferentes";
  const daUnidade = dados.linhas.filter(
    (l) =>
      l.unidade === unidade &&
      (!busca || l.curso.toUpperCase().includes(busca) || l.codigoCiclo.includes(busca)) &&
      (!soDiferentes || !l.confere),
  );
  const selecionada = dados.linhas.find((l) => String(l.linha) === params.linha) ?? null;

  const url = (extra: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const base: Record<string, string | undefined> = { arquivo: String(escolhido.id), unidade, q: params.q, so: params.so, ...extra };
    for (const [k, v] of Object.entries(base)) if (v) p.set(k, v);
    return `/conferencia/quarta-fase?${p.toString()}`;
  };

  return (
    <main className={`mx-auto flex ${TABLE_MAX_WIDTH} flex-col gap-8 px-6 py-12 lg:px-12`}>
      {cabecalho}

      {/* Arquivo */}
      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          {arquivos.map((a) => (
            <Link
              key={a.id}
              href={`/conferencia/quarta-fase?arquivo=${a.id}`}
              className={`rounded-md border px-3 py-1.5 text-sm ${a.id === escolhido.id ? "border-if-green bg-if-green text-white" : "border-neutral-300 text-neutral-700 hover:border-if-green dark:border-neutral-700 dark:text-neutral-300"}`}
            >
              {rotuloArquivo(a, a.temResultados)}
            </Link>
          ))}
        </div>
        <PainelProcedencia
          fonte={{
            id: escolhido.id,
            origem: "MDO_IFTM",
            fase: "F4_CHECAGEM_MATRICULAS",
            arquivo: escolhido.arquivo,
            geradoEm: escolhido.geradoEm,
            carregadoEm: escolhido.carregadoEm,
            abrangencia: "INSTITUICAO",
            ressalva: escolhido.ressalva,
          }}
        />
      </section>

      {/* Placar */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Cartao titulo="Ciclos na planilha" valor={inteiro.format(totais.linhas)} texto={`linhas da aba "Ciclos de Matrículas", de ${dados.unidades.length} unidades`} />
        {temResultados ? (
          <Cartao
            titulo="Ciclos iguais à planilha"
            valor={`${inteiro.format(totais.linhasQueConferem)} de ${inteiro.format(totais.linhas)}`}
            texto={`nas ${totais.colunasConferidas} colunas calculadas (CHM até MT), não só no resultado final`}
            destaque={totais.linhasQueConferem === totais.linhas}
          />
        ) : (
          <Cartao
            titulo="Ciclos iguais à 6ª fase publicada"
            valor={`${inteiro.format(totais.ciclosQueConferemSextaFase)} de ${inteiro.format(totais.ciclosNaSextaFase)}`}
            texto="a exportação veio só com fórmulas; a referência é a Matrícula Total que a MDO publicou depois, na 6ª fase"
            destaque={totais.ciclosQueConferemSextaFase === totais.ciclosNaSextaFase}
          />
        )}
        <Cartao
          titulo="Matrícula Total do arquivo"
          valor={exato.format(totais.mtSistema)}
          texto={
            temResultados
              ? `na planilha: ${exato.format(totais.mtPlanilha ?? 0)}; no sistema: ${exato.format(totais.mtSistema)}`
              : `pelas fórmulas da planilha; a 6ª fase publicou ${exato.format(totais.mtSextaFase ?? 0)} para os mesmos ciclos`
          }
          destaque={temResultados && Math.abs((totais.mtPlanilha ?? 0) - totais.mtSistema) < 1e-6}
        />
        <Cartao
          titulo="Motor do sistema"
          valor={`${inteiro.format(totais.motorIgualFormulas)} de ${inteiro.format(totais.linhas)}`}
          texto="ciclos em que a conta usada nas outras telas (Quanto vale um aluno, simuladores) dá o mesmo número que as fórmulas da planilha"
          destaque={totais.motorIgualFormulas === totais.linhas}
        />
      </section>

      {!temResultados && (
        <p className="max-w-4xl rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
          Por que nem todos os ciclos batem com a 6ª fase: esta exportação é anterior à 6ª fase, e nela a MDO ainda trazia, em alguns ciclos, um{" "}
          <strong>peso</strong> ou uma <strong>carga horária mínima do MEC</strong> diferente da que aplicou depois. A conta é a mesma; muda o dado de entrada.
          Cada ciclo que difere diz qual foi a diferença (coluna &quot;Por que difere&quot;). O sistema usa os valores da 6ª fase, que são os que a MDO
          aplicou. A exportação também lista alguns ciclos em duas linhas; a comparação soma as linhas do mesmo ciclo.
        </p>
      )}

      {/* Aba Instituíção */}
      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">Aba &quot;Instituição&quot;: alunos e Matrícula Total por unidade</h2>
        <p className="max-w-4xl text-sm text-neutral-600 dark:text-neutral-400">
          Como na planilha: a soma dos alunos (coluna QTM) e da Matrícula Total (coluna MT) dos ciclos de cada unidade, separada pela situação de
          financiamento (coluna AP). {temResultados ? "Os números são os que o Excel gravou; a última coluna diz se a soma refeita pelo sistema é igual." : "Como o arquivo não traz os resultados, os números são os refeitos pelo sistema, e a última coluna compara com a 6ª fase."}
        </p>
        <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
          <table className="min-w-full text-xs">
            <thead className="bg-neutral-50 text-neutral-600 dark:bg-neutral-900 dark:text-neutral-400">
              <tr>
                <th className={thE} rowSpan={2}>Unidade</th>
                <th className="border-l border-neutral-200 px-2 py-1 text-center font-medium dark:border-neutral-800" colSpan={5}>Alunos (QTM)</th>
                <th className="border-l border-neutral-200 px-2 py-1 text-center font-medium dark:border-neutral-800" colSpan={4}>Matrícula Total</th>
                <th className="border-l border-neutral-200 px-2 py-1 text-center font-medium dark:border-neutral-800" colSpan={2}>{temResultados ? "Sistema" : "6ª fase"}</th>
              </tr>
              <tr>
                {SITUACOES.map((s) => (
                  <th key={`a-${s}`} className={th}>{s}</th>
                ))}
                <th className={th}>Total</th>
                {SITUACOES.map((s) => (
                  <th key={`m-${s}`} className={th}>{s}</th>
                ))}
                <th className={th}>MT total</th>
                <th className={th}>Confere</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {dados.unidades.map((u) => {
                const alunos = (s: string) => (u.planilha ? u.planilha.alunos[s] ?? 0 : u.alunos[s] ?? 0);
                const mt = (s: string) => (u.planilha ? u.planilha.mt[s] ?? 0 : u.mt[s] ?? 0);
                const totalAlunos = SITUACOES.reduce((s, x) => s + alunos(x), 0);
                const mtSistema = SITUACOES.reduce((s, x) => s + (u.mt[x] ?? 0), 0);
                const confere = temResultados ? u.confere : u.mtSextaFase === null ? null : Math.abs(u.mtSextaFase - mtSistema) < 1e-3;
                return (
                  <tr key={u.unidade} className={ehCampusDestaque(u.unidade) ? "bg-if-green/5" : undefined}>
                    <td className={`${tdE} whitespace-nowrap`}>
                      <Link href={url({ unidade: u.unidade, linha: undefined })} className={PROSE_LINK}>
                        {u.unidade}
                      </Link>
                    </td>
                    {SITUACOES.map((s) => (
                      <td key={`a-${s}`} className={td}>{alunos(s) ? inteiro.format(alunos(s)) : ""}</td>
                    ))}
                    <td className={`${td} font-medium`}>{inteiro.format(totalAlunos)}</td>
                    {SITUACOES.map((s) => (
                      <td key={`m-${s}`} className={td}>{mt(s) ? decimal.format(mt(s)) : ""}</td>
                    ))}
                    <td className={`${td} font-medium`}>{decimal.format(temResultados ? mtSistema : (u.mtSextaFase ?? 0))}</td>
                    <td className="px-2 py-1 text-center">{confere === null ? "" : confere ? OK : NAO}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Fórmulas */}
      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">Como cada coluna é calculada</h2>
        <p className="max-w-4xl text-sm text-neutral-600 dark:text-neutral-400">
          As fórmulas são as da linha 4 do arquivo, copiadas do Excel (as letras são as colunas da planilha). Em quatro colunas, o texto do cabeçalho da planilha
          não diz o mesmo que a fórmula da própria coluna; o número sai da fórmula, e o sistema segue a fórmula. Essas quatro estão marcadas em amarelo.
        </p>
        <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
          <table className="min-w-full text-xs">
            <thead className="bg-neutral-50 text-neutral-600 dark:bg-neutral-900 dark:text-neutral-400">
              <tr>
                <th className={thE}>Coluna</th>
                <th className={thE}>O que é</th>
                <th className={thE}>Fórmula no Excel</th>
                <th className={thE}>Em palavras</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {COLUNAS_QUARTA_FASE.map((c) => (
                <tr key={c.chave} className={c.cabecalhoDiferente ? "bg-amber-50 dark:bg-amber-950/40" : undefined}>
                  <td className={`${tdE} whitespace-nowrap font-medium`}>
                    {c.letra} · {c.sigla}
                  </td>
                  <td className={tdE}>{c.nome}</td>
                  <td className={`${tdE} font-mono text-[11px]`}>{c.formulaExcel}</td>
                  <td className={tdE}>
                    {c.explicacao}
                    {c.cabecalhoDiferente && <span className="mt-1 block text-amber-900 dark:text-amber-200">Atenção: {c.cabecalhoDiferente}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          Letras das entradas: G tipo de curso, J agropecuária, K tipo de oferta, N início do ciclo (DIC), O término previsto (DTC), Q carga horária do ciclo
          (CHC), R mínima do MEC (CHMC), T peso (PC), U apto (jubilamento do início do período em diante), AB e AC início e fim do período (DIP e DFP), AD
          matrículas (QTM).
        </p>
      </section>

      {/* Ciclos */}
      <section className="flex flex-col gap-3" id="ciclos">
        <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">Aba &quot;Ciclos de Matrículas&quot;: {unidade}</h2>
        <form method="get" action="" className="flex flex-wrap items-end gap-3 text-sm">
          <input type="hidden" name="arquivo" value={escolhido.id} />
          <label className="flex flex-col gap-1">
            <span className="text-xs text-neutral-500">Unidade</span>
            <select name="unidade" defaultValue={unidade} className="rounded-md border border-neutral-300 bg-white px-2 py-1.5 dark:border-neutral-700 dark:bg-neutral-900">
              {unidadesDoArquivo.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-neutral-500">Curso ou código do ciclo</span>
            <input name="q" defaultValue={params.q ?? ""} className="rounded-md border border-neutral-300 bg-white px-2 py-1.5 dark:border-neutral-700 dark:bg-neutral-900" />
          </label>
          <label className="flex items-center gap-2 pb-1.5">
            <input type="checkbox" name="so" value="diferentes" defaultChecked={soDiferentes} />
            <span>Só os que não conferem</span>
          </label>
          <button type="submit" className="rounded-md bg-if-green px-3 py-1.5 font-medium text-white">
            Mostrar
          </button>
        </form>

        {selecionada && <DetalheDoCiclo l={selecionada} temResultados={temResultados} fechar={url({ linha: undefined })} />}

        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          {inteiro.format(daUnidade.length)} ciclo(s). Os valores calculados são os do sistema; a coluna &quot;{temResultados ? "MT na planilha" : "MT na 6ª fase"}&quot;
          traz o número de referência. Clique em &quot;ver a conta&quot; para ver cada coluna com os números do ciclo.
        </p>
        <div className="max-h-[70vh] overflow-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
          <table className="min-w-full text-xs">
            <thead className="sticky top-0 bg-neutral-50 text-neutral-600 dark:bg-neutral-900 dark:text-neutral-400">
              <tr>
                <th className={th}>Linha</th>
                <th className={thE}>Ciclo</th>
                <th className={thE}>Curso</th>
                <th className={thE}>Oferta</th>
                <th className={thE}>Situação</th>
                <th className={th}>DIC</th>
                <th className={th}>DTC</th>
                <th className={th}>CHC</th>
                <th className={th}>CHMC</th>
                <th className={th}>CHM</th>
                <th className={th}>PC</th>
                <th className={th}>QTM</th>
                <th className={th}>QDTC</th>
                <th className={th}>CHMD</th>
                <th className={th}>CHA</th>
                <th className={th}>FECH</th>
                <th className={th}>DACP1</th>
                <th className={th}>DACP2</th>
                <th className={th}>DACP3</th>
                <th className={th}>DACP4</th>
                <th className={th}>DACP5</th>
                <th className={th}>FEDA</th>
                <th className={th}>FECHDA</th>
                <th className={th}>MECHDA</th>
                <th className={th}>MP</th>
                <th className={th}>BA</th>
                <th className={th}>MT sistema</th>
                <th className={th}>{temResultados ? "MT na planilha" : "MT na 6ª fase"}</th>
                <th className={th}>Confere</th>
                {!temResultados && <th className={thE}>Por que difere</th>}
                <th className={thE}></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {daUnidade.map((l) => {
                const c = l.colunas;
                const referencia = temResultados ? l.planilha?.mt ?? 0 : l.sextaFase?.matriculaTotal ?? null;
                return (
                  <tr key={l.id} className={l.linha === selecionada?.linha ? "bg-if-green/10" : !l.confere ? "bg-if-red/5" : undefined}>
                    <td className={td}>{l.linha}</td>
                    <td className={`${tdE} whitespace-nowrap`}>{l.codigoCiclo}</td>
                    <td className={`${tdE} min-w-56`}>{l.curso}</td>
                    <td className={`${tdE} whitespace-nowrap`}>{l.tipoOferta}</td>
                    <td className={`${tdE} whitespace-nowrap`}>{l.situacao}</td>
                    <td className={td}>{dia.format(l.entrada.inicio)}</td>
                    <td className={td}>{dia.format(l.entrada.termino)}</td>
                    <td className={td}>{inteiro.format(l.entrada.chCiclo)}</td>
                    <td className={td}>{inteiro.format(l.entrada.chMec)}</td>
                    <td className={td}>{inteiro.format(c.chm)}</td>
                    <td className={td}>{fator.format(l.entrada.peso)}</td>
                    <td className={td}>{inteiro.format(l.entrada.matriculas)}</td>
                    <td className={td}>{inteiro.format(c.qdtc)}</td>
                    <td className={td}>{fator.format(c.chmd)}</td>
                    <td className={td}>{decimal.format(c.cha)}</td>
                    <td className={td}>{fator.format(c.fech)}</td>
                    {c.dacp.map((x, i) => (
                      <td key={i} className={td}>{x ? exato.format(x) : ""}</td>
                    ))}
                    <td className={td}>{fator.format(c.feda)}</td>
                    <td className={td}>{fator.format(c.fechda)}</td>
                    <td className={td}>{fator.format(c.mechda)}</td>
                    <td className={td}>{fator.format(c.mp)}</td>
                    <td className={td}>{c.ba ? fator.format(c.ba) : ""}</td>
                    <td className={`${td} font-medium`}>{fator.format(c.mt)}</td>
                    <td className={td}>
                      {referencia === null ? "sem par" : fator.format(referencia)}
                      {!temResultados && l.sextaFase && l.sextaFase.linhasNaQuartaFase > 1 && (
                        <span className="block text-[10px] text-neutral-500">ciclo em {l.sextaFase.linhasNaQuartaFase} linhas</span>
                      )}
                    </td>
                    <td className="px-2 py-1 text-center">{l.confere ? OK : NAO}</td>
                    {!temResultados && <td className={`${tdE} min-w-56 text-[11px]`}>{l.sextaFase?.motivos.join("; ")}</td>}
                    <td className={`${tdE} whitespace-nowrap`}>
                      <Link href={`${url({ linha: String(l.linha) })}#conta`} className={PROSE_LINK}>
                        ver a conta
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

function Cartao({ titulo, valor, texto, destaque }: { titulo: string; valor: string; texto: string; destaque?: boolean }) {
  return (
    <div className={`flex flex-col gap-1 rounded-lg border p-4 ${destaque ? "border-if-green/50 bg-if-green/5" : "border-neutral-200 dark:border-neutral-800"}`}>
      <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">{titulo}</span>
      <span className={`text-xl font-semibold tabular-nums ${destaque ? "text-if-green" : "text-neutral-900 dark:text-neutral-100"}`}>
        {destaque && "✓ "}
        {valor}
      </span>
      <span className="text-xs text-neutral-600 dark:text-neutral-400">{texto}</span>
    </div>
  );
}

function DetalheDoCiclo({ l, temResultados, fechar }: { l: LinhaConferida; temResultados: boolean; fechar: string }) {
  const e = l.entrada;
  return (
    <div id="conta" className="flex flex-col gap-3 rounded-lg border border-if-green/40 bg-if-green/5 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold text-neutral-900 dark:text-neutral-100">
            Linha {l.linha} · ciclo {l.codigoCiclo}
          </h3>
          <p className="text-sm text-neutral-600 dark:text-neutral-400">{l.nomeCiclo ?? l.curso}</p>
          <p className="mt-1 text-xs text-neutral-600 dark:text-neutral-400">
            Entradas: {l.tipoCurso}, {l.tipoOferta}; início {dia.format(e.inicio)}, término previsto {dia.format(e.termino)}, jubilamento{" "}
            {dia.format(l.colunas.jubilamento)}; CHC {inteiro.format(e.chCiclo)} h, mínima do MEC {inteiro.format(e.chMec)} h; peso {fator.format(e.peso)};{" "}
            {e.agropecuaria ? "agropecuária; " : ""}
            {inteiro.format(e.matriculas)} matrículas; ano-base de {dia.format(e.inicioPeriodo)} a {dia.format(e.fimPeriodo)}.
          </p>
        </div>
        <Link href={`${fechar}#ciclos`} className="text-sm text-neutral-500 underline hover:text-neutral-800 dark:hover:text-neutral-200">
          fechar
        </Link>
      </div>
      <div className="overflow-x-auto rounded-md border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
        <table className="min-w-full text-xs">
          <thead className="bg-neutral-50 text-neutral-600 dark:bg-neutral-900 dark:text-neutral-400">
            <tr>
              <th className={thE}>Coluna</th>
              <th className={thE}>A conta, com os números deste ciclo</th>
              <th className={th}>No sistema</th>
              {temResultados && <th className={th}>Na planilha</th>}
              {temResultados && <th className={th}>Confere</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {COLUNAS_QUARTA_FASE.map((c) => {
              const sistema = valorDaColuna(l.colunas, c.chave);
              const planilha = l.planilha?.[c.chave];
              return (
                <tr key={c.chave}>
                  <td className={`${tdE} whitespace-nowrap font-medium`}>
                    {c.letra} · {c.sigla}
                  </td>
                  <td className={tdE}>{contaDaColuna(c.chave, e, l.colunas)}</td>
                  <td className={td}>{exato.format(sistema)}</td>
                  {temResultados && <td className={td}>{planilha === undefined ? "" : exato.format(planilha)}</td>}
                  {temResultados && <td className="px-2 py-1 text-center">{l.colunasDiferentes.includes(c.chave) ? NAO : OK}</td>}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-sm text-neutral-700 dark:text-neutral-300">
        Pelo motor do sistema (a conta das outras telas: alunos × fração contada × peso × bônus × CH ÷ 800 × dias ativos), a Matrícula Total deste ciclo
        é <strong>{exato.format(l.mtMotor)}</strong>
        {Math.abs(l.mtMotor - l.colunas.mt) < 1e-6 ? ", o mesmo número das colunas da planilha." : `, diferente das colunas da planilha (${exato.format(l.colunas.mt)}).`}
        {!temResultados && l.sextaFase && (
          <>
            {" "}
            Na 6ª fase, a MDO publicou <strong>{exato.format(l.sextaFase.matriculaTotal)}</strong> para este ciclo
            {l.sextaFase.linhasNaQuartaFase > 1 ? ` (soma das ${l.sextaFase.linhasNaQuartaFase} linhas dele aqui: ${exato.format(l.sextaFase.somaDasLinhas)})` : ""}
            {l.sextaFase.confere ? ": confere." : `: ${l.sextaFase.motivos.join("; ") || "difere"}.`}
          </>
        )}
      </p>
    </div>
  );
}
