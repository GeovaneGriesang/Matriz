import Link from "next/link";
import { prisma } from "@/server/db/prisma";
import { PROSE_LINK, TABLE_MAX_WIDTH } from "@/lib/layoutWidths";
import { requireTelaDoCampusOrRedirect } from "@/server/auth/session";
import { CAMPUS_VENANCIO_AIRES } from "@/lib/campusDoUsuario";
import { ContextoDaTela } from "@/components/chat/ChatDaTela";
import { DOCUMENTOS_VENANCIO_AIRES } from "@/lib/orcamento/documentosOficiais";
import { DESPESA_EXECUTIVO_LEGISLATIVO, EMENDAS_IMPOSITIVAS_PREVISTAS_2027, INVESTIMENTOS_2027, PREVIDENCIA_2027, PROJETO_2027 } from "@/lib/orcamento/propostaVenancioAires2027";
import { balancoDoAno, funcoesDoAno, serieDoEnte } from "@/server/queries/orcamentoPublico";
import { ComoFuncionaOOrcamento } from "@/components/orcamentoPublico/ComoFuncionaOOrcamento";
import { ExecucaoPorFuncao } from "@/components/orcamentoPublico/ExecucaoPorFuncao";
import { BalancoDoAno, Cartao, SerieAnual, milhoes, pct } from "@/components/orcamentoPublico/SerieAnual";
import { DocumentosOficiais } from "@/components/orcamentoPublico/DocumentosOficiais";
import { EmendasMunicipais, type EmendaDaTela } from "@/components/orcamentoPublico/EmendasMunicipais";

export const dynamic = "force-dynamic";

const reais = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const td = "whitespace-nowrap px-2 py-1.5 text-right tabular-nums";
const th = "whitespace-nowrap px-2 py-1.5 text-right font-medium";

const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/\s+/g, " ").trim();

/** "05 SECRETARIA DE EDUCAÇÃO" e "05 SECRETARIA DE EDUCACAO" são a mesma secretaria: fica o nome com acento, sem o código. */
function nomesDeSecretaria(orgaos: (string | null)[]): Map<string, string> {
  const porChave = new Map<string, string>();
  for (const o of orgaos) {
    if (!o) continue;
    const nome = o.replace(/^\d+\s*-?\s*/, "").trim();
    const chave = semAcento(nome);
    const atual = porChave.get(chave);
    // Fica a grafia com mais letras acentuadas.
    if (!atual || (nome.match(/[À-ÿ]/g)?.length ?? 0) > (atual.match(/[À-ÿ]/g)?.length ?? 0)) porChave.set(chave, nome);
  }
  return porChave;
}

export default async function OrcamentoMunicipalPage() {
  await requireTelaDoCampusOrRedirect("/orcamento-municipal", CAMPUS_VENANCIO_AIRES);

  const [serie, emendasBanco] = await Promise.all([serieDoEnte("VENANCIO_AIRES"), prisma.emendaMunicipal.findMany({ where: { municipio: "VENANCIO_AIRES" } })]);
  const anoAtual = serie[serie.length - 1];
  const [funcoes, balanco] = anoAtual ? await Promise.all([funcoesDoAno("VENANCIO_AIRES", anoAtual.exercicio), balancoDoAno("VENANCIO_AIRES", anoAtual.exercicio)]) : [[], new Map()];

  // O partido de quem não o informou no formulário daquele ano: o da emenda mais recente do mesmo vereador.
  const nomeDoAutor = (e: (typeof emendasBanco)[number]) => semAcento(e.tipo === "Bancada" ? e.autoria : (e.vereador ?? e.autoria)).replace(/\s*\(.*\)$/, "");
  const partidoConhecido = new Map<string, { partido: string; exercicio: number }>();
  for (const e of emendasBanco) {
    if (!e.partido) continue;
    const k = nomeDoAutor(e);
    const atual = partidoConhecido.get(k);
    if (!atual || e.exercicio > atual.exercicio) partidoConhecido.set(k, { partido: e.partido, exercicio: e.exercicio });
  }
  const secretarias = nomesDeSecretaria(emendasBanco.map((e) => e.orgao ?? e.beneficiario));
  const formatoData = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "America/Sao_Paulo" });
  const emendas: EmendaDaTela[] = emendasBanco.map((e) => {
    const autor = nomeDoAutor(e);
    const inferido = !e.partido ? partidoConhecido.get(autor)?.partido : undefined;
    const org = (e.orgao ?? e.beneficiario ?? "").replace(/^\d+\s*-?\s*/, "").trim();
    return {
      id: e.idExterno,
      exercicio: e.exercicio,
      numero: e.numero,
      tipo: e.tipo,
      autor: autor.replace(/^BANCADA D[OA]S? /, "Bancada do "),
      partido: e.partido ?? inferido ?? null,
      partidoInferido: !e.partido && !!inferido,
      secretaria: secretarias.get(semAcento(org)) ?? (org || "não informada"),
      acao: e.acao,
      valor: Number(e.valor ?? 0),
      objeto: e.objeto,
      justificativa: e.justificativa,
      situacao: e.situacao,
      apresentadaEm: e.apresentadaEm ? formatoData.format(e.apresentadaEm) : null,
      url: e.url,
      citaIfsul: e.citaIfsul,
    };
  });
  const porAnoDeEmenda = [...new Set(emendas.map((e) => e.exercicio))]
    .sort((a, b) => a - b)
    .map((ano) => {
      const es = emendas.filter((e) => e.exercicio === ano);
      return { ano, quantidade: es.length, valor: es.reduce((s, e) => s + e.valor, 0) };
    });
  const emendas2027 = emendas.filter((e) => e.exercicio === 2027);

  const diferenca2027 = PROJETO_2027.receitaEstimada - PROJETO_2027.despesaFixada;
  const textoParaOChat = [
    "Orçamento do município de Venâncio Aires.",
    `Projeto de 2027 (${PROJETO_2027.numero}): receita ${reais.format(PROJETO_2027.receitaEstimada)}, despesa ${reais.format(PROJETO_2027.despesaFixada)}.`,
    ...serie.map((r) => `${r.exercicio} (até o ${r.periodo}º bimestre): receita ${reais.format(r.receita.realizado)}, despesa empenhada ${reais.format(r.despesa.empenhado)}, educação ${reais.format(r.educacao.empenhado)}, saúde ${reais.format(r.saude.empenhado)}.`),
    ...porAnoDeEmenda.map((p) => `Emendas impositivas no orçamento de ${p.ano}: ${p.quantidade}, ${reais.format(p.valor)}.`),
  ].join("\n");

  return (
    <main className={`mx-auto flex ${TABLE_MAX_WIDTH} flex-col gap-8 px-6 py-12 lg:px-12`}>
      <ContextoDaTela texto={textoParaOChat} />
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">Orçamento do município de Venâncio Aires</h1>
        <p className="text-neutral-600 dark:text-neutral-400">
          Quanto a Prefeitura arrecada e gasta, em que áreas, o projeto de 2027 que está na Câmara e as emendas impositivas dos vereadores, desde 2021. Serve para o
          câmpus conhecer o orçamento da cidade: onde há dinheiro para educação, que secretarias recebem emendas e onde uma parceria pode caber.
        </p>
        <p className="rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-2 text-xs text-neutral-600 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400">
          Esta tela abre só para quem pertence ao câmpus Venâncio Aires (o câmpus fica no cadastro de usuários, em Usuários) e para o super-admin.
        </p>
      </div>

      <ComoFuncionaOOrcamento
        quem="O município de Venâncio Aires"
        poderLegislativo="pela Câmara de Vereadores"
        prazos="A Prefeitura envia o projeto da LOA à Câmara (o de 2027 foi em 19 de novembro de 2026) e a Câmara vota até o fim do ano. O PPA em vigor vai de 2026 a 2029. Desde 2021, cada vereador e cada bancada destina uma parte do orçamento por emendas impositivas, que a Prefeitura é obrigada a executar."
      />

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">O projeto para 2027, na Câmara</h2>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          O{" "}
          <a href={PROJETO_2027.url} target="_blank" rel="noreferrer" className={PROSE_LINK}>
            {PROJETO_2027.numero}
          </a>
          , enviado em {PROJETO_2027.enviadoEm}. Os anexos do projeto são PDFs assinados, quase todos em imagem; os números abaixo vêm dos trechos com texto e conferem
          pela soma. Quando a lei for votada e o ano começar, a execução passa a aparecer na seção seguinte, como a dos anos anteriores.
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Cartao titulo="Receita estimada" valor={milhoes(PROJETO_2027.receitaEstimada)} nota="art. 1º do projeto, com o Fundo de Previdência" />
          <Cartao titulo="Despesa fixada" valor={milhoes(PROJETO_2027.despesaFixada)} nota={`${reais.format(DESPESA_EXECUTIVO_LEGISLATIVO.at(-1)!.proposto2027)} da Prefeitura e Câmara e ${reais.format(PREVIDENCIA_2027.total)} da previdência`} />
          <Cartao
            titulo="Diferença"
            valor={milhoes(diferenca2027)}
            destaque="ruim"
            nota="a despesa passa a receita; a justificativa diz que o superávit de 2026 cobre a diferença"
          />
          <Cartao titulo="Saúde e educação" valor={`${PROJETO_2027.saudePercentual}% e ${PROJETO_2027.educacaoPercentual}%`} nota="dos impostos, contra os mínimos de 15% e 25% da Constituição" />
        </div>
        <div className="tabela-rolavel rounded-lg border border-neutral-200 dark:border-neutral-800">
          <table className="min-w-full text-sm">
            <thead className="bg-neutral-50 text-xs text-neutral-600 dark:bg-neutral-900 dark:text-neutral-400">
              <tr>
                <th className="px-2 py-1.5 text-left font-medium">Prefeitura e Câmara, por grupo de despesa</th>
                <th className={th}>Executado em 2025</th>
                <th className={th}>Fixado para 2026</th>
                <th className={th}>Proposto para 2027</th>
                <th className={th}>2027 sobre 2026</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {DESPESA_EXECUTIVO_LEGISLATIVO.map((l) => {
                const d = l.proposto2027 - l.fixado2026;
                return (
                  <tr key={l.grupo} className={l.nivel === "total" ? "bg-neutral-50 font-semibold dark:bg-neutral-900" : l.nivel === "categoria" ? "font-medium" : undefined}>
                    <td className={`px-2 py-1.5 ${l.nivel === "grupo" ? "pl-8" : ""}`}>{l.grupo}</td>
                    <td className={td}>{reais.format(l.executado2025)}</td>
                    <td className={td}>{reais.format(l.fixado2026)}</td>
                    <td className={td}>{reais.format(l.proposto2027)}</td>
                    <td className={`${td} ${d < 0 ? "text-if-red dark:text-red-400" : "text-if-green"}`}>
                      {d >= 0 ? "+" : ""}
                      {reais.format(d)}
                      {l.fixado2026 > 0 && <span className="block text-xs">{pct(d, l.fixado2026)}</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          Além disso, o Fundo de Previdência Social do Município, que paga as aposentadorias dos servidores, tem {reais.format(PREVIDENCIA_2027.total)} propostos, dos
          quais {reais.format(PREVIDENCIA_2027.reserva)} ficam em reserva. Os investimentos caem quase pela metade (de {reais.format(26_187_725.73)} para{" "}
          {reais.format(12_056_950)}): a justificativa explica que as receitas de capital previstas são poucas e que obras de 2026 não concluídas voltam ao orçamento
          de 2027 por crédito adicional.
        </p>
        <details className="rounded-lg border border-neutral-200 p-3 text-sm dark:border-neutral-800">
          <summary className="cursor-pointer font-medium text-neutral-800 dark:text-neutral-200">Os principais investimentos previstos para 2027 e a origem do dinheiro</summary>
          <ul className="mt-2 flex list-disc flex-col gap-1 pl-6 text-neutral-700 dark:text-neutral-300">
            {INVESTIMENTOS_2027.map((i) => (
              <li key={i.objeto}>
                <strong>{i.origem}:</strong> {i.objeto}.
              </li>
            ))}
          </ul>
        </details>
        <p className="text-xs text-neutral-500">
          Fonte: {PROJETO_2027.fonte}; Anexo VIII (despesa executada, fixada e proposta). A justificativa do mesmo projeto cita receita de{" "}
          {reais.format(PROJETO_2027.justificativa.receita)} e despesa de {reais.format(PROJETO_2027.justificativa.despesa)}, um pouco diferentes do art. 1º; a tela usa
          o art. 1º, que é o que se vota.
        </p>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">Emendas impositivas dos vereadores</h2>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          A emenda impositiva é a parte do orçamento que cada vereador (emenda individual) e cada partido (emenda de bancada) destina a uma secretaria, escola,
          associação ou obra. A Prefeitura é obrigada a executá-la, salvo impedimento técnico. Para 2027, a LDO prevê {reais.format(EMENDAS_IMPOSITIVAS_PREVISTAS_2027.total)}{" "}
          ({reais.format(EMENDAS_IMPOSITIVAS_PREVISTAS_2027.bancadas)} de bancada e {reais.format(EMENDAS_IMPOSITIVAS_PREVISTAS_2027.individuais)} individuais, cerca de{" "}
          {reais.format(EMENDAS_IMPOSITIVAS_PREVISTAS_2027.porVereador)} por vereador). {EMENDAS_IMPOSITIVAS_PREVISTAS_2027.observacao}
          {emendas2027.length > 0 &&
            ` Até agora foram apresentadas ${emendas2027.length} emendas ao projeto de 2027, somando ${reais.format(emendas2027.reduce((s, e) => s + e.valor, 0))}; o prazo segue aberto na Câmara.`}
        </p>
        <div className="tabela-rolavel rounded-lg border border-neutral-200 dark:border-neutral-800">
          <table className="min-w-full text-sm">
            <thead className="bg-neutral-50 text-xs text-neutral-600 dark:bg-neutral-900 dark:text-neutral-400">
              <tr>
                <th className="px-2 py-1.5 text-left font-medium">Orçamento de</th>
                {porAnoDeEmenda.map((p) => (
                  <th key={p.ano} className={th}>
                    {p.ano}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="px-2 py-1.5">Emendas</td>
                {porAnoDeEmenda.map((p) => (
                  <td key={p.ano} className={td}>
                    {p.quantidade}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="px-2 py-1.5">Valor</td>
                {porAnoDeEmenda.map((p) => (
                  <td key={p.ano} className={td}>
                    {reais.format(p.valor)}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
        {emendas.length > 0 ? (
          <EmendasMunicipais emendas={emendas} />
        ) : (
          <p className="text-sm text-neutral-500">
            Ainda não carregadas. Rode <code>npm run carregar:emendas-municipais</code>.
          </p>
        )}
        <p className="text-xs text-neutral-500">
          Fonte: Câmara Municipal de Venâncio Aires, página de cada emenda impositiva (formulário da Comissão de Orçamento e Finanças). O valor é o pedido na emenda;
          a execução de cada uma (se a Prefeitura já pagou) não é publicada pela Câmara. Emendas sem valor no formulário (as que só incluem uma iniciativa no orçamento)
          contam como R$ 0.
        </p>
      </section>

      {anoAtual && (
        <section className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
            Como está {anoAtual.exercicio}, até o {anoAtual.periodo}º bimestre
          </h2>
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            Do relatório que a Prefeitura entrega ao Tesouro Nacional a cada dois meses (RREO). Sem o Fundo de Previdência separado: o relatório junta tudo o que é da
            Prefeitura. Na receita, as transferências do Estado são a parte do ICMS e do IPVA que o Estado repassa (veja o{" "}
            <Link href="/orcamento-do-estado" className={PROSE_LINK}>
              orçamento do Estado
            </Link>
            ).
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Cartao titulo="Receita arrecadada" valor={milhoes(anoAtual.receita.realizado)} nota={`${pct(anoAtual.receita.realizado, anoAtual.receita.previsaoAtualizada)} do previsto para o ano`} />
            <Cartao titulo="Despesa empenhada" valor={milhoes(anoAtual.despesa.empenhado)} nota={`${pct(anoAtual.despesa.empenhado, anoAtual.despesa.dotacaoAtualizada)} da dotação atualizada`} />
            <Cartao titulo="Educação (empenhado)" valor={milhoes(anoAtual.educacao.empenhado)} nota={`${pct(anoAtual.educacao.empenhado, anoAtual.despesa.empenhado)} da despesa`} />
            <Cartao titulo="Saúde (empenhado)" valor={milhoes(anoAtual.saude.empenhado)} nota={`${pct(anoAtual.saude.empenhado, anoAtual.despesa.empenhado)} da despesa`} />
          </div>
          <BalancoDoAno balanco={balanco} />
          <h3 className="font-semibold text-neutral-900 dark:text-neutral-100">Por área</h3>
          <ExecucaoPorFuncao funcoes={funcoes} ano={anoAtual.exercicio} periodo={anoAtual.periodo} />
          <p className="text-xs text-neutral-500">Fonte: {anoAtual.fonte}, Anexos 1 e 2.</p>
        </section>
      )}

      {serie.length > 1 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
            Ano a ano, de {serie[0]!.exercicio} a {serie[serie.length - 1]!.exercicio}
          </h2>
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            O fechamento de cada ano (6º bimestre do RREO). A Constituição manda o município aplicar pelo menos 25% dos impostos em educação e 15% em saúde; a conta
            oficial desses mínimos usa só a receita de impostos e transferências de impostos, por isso a parte mostrada aqui (sobre a despesa total) é diferente do
            percentual legal.
          </p>
          <SerieAnual serie={serie} />
        </section>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">Documentos oficiais</h2>
        <DocumentosOficiais documentos={DOCUMENTOS_VENANCIO_AIRES} />
      </section>
    </main>
  );
}
