"use client";

import { Fragment, useMemo, useState } from "react";
import { ehInstituicaoDestaque } from "@/lib/destaque";
import { SinalMaisMenos } from "@/components/SinalMaisMenos";

export interface EmendaDoPainel {
  numero: string;
  modalidade: string;
  tipoAutor: string;
  autor: string;
  ementa: string;
  uoCodigo: string;
  uoNome: string;
  sigla: string | null;
  instituicao: string | null;
  uf: string | null;
  funcional: string;
  acao: string;
  acaoDescricao: string;
  subtitulo: string;
  gnd3: number;
  gnd4: number;
  outros: number;
  total: number;
  comRecibo: boolean | null;
  justificativa: string;
}

const reais = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const compacto = new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 });
const inteiro = new Intl.NumberFormat("pt-BR");
const umDecimal = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

const REGIAO: Record<string, string> = {
  AC: "Norte", AM: "Norte", AP: "Norte", PA: "Norte", RO: "Norte", RR: "Norte", TO: "Norte",
  AL: "Nordeste", BA: "Nordeste", CE: "Nordeste", MA: "Nordeste", PB: "Nordeste", PE: "Nordeste", PI: "Nordeste", RN: "Nordeste", SE: "Nordeste",
  DF: "Centro-Oeste", GO: "Centro-Oeste", MS: "Centro-Oeste", MT: "Centro-Oeste",
  ES: "Sudeste", MG: "Sudeste", RJ: "Sudeste", SP: "Sudeste",
  PR: "Sul", RS: "Sul", SC: "Sul",
};

type Escopo = "diretas" | "mec" | "todas";
type Visao = "graficos" | "lista" | "resumo";
type Gnd = "" | "3" | "4" | "misto";
type Recibo = "" | "sim" | "nao" | "coletiva";

interface Filtros {
  busca: string;
  regiao: string;
  uf: string;
  sigla: string;
  modalidade: string;
  acao: string;
  gnd: Gnd;
  recibo: Recibo;
  autor: string;
}

const SEM_FILTRO: Filtros = { busca: "", regiao: "", uf: "", sigla: "", modalidade: "", acao: "", gnd: "", recibo: "", autor: "" };

function gndDa(e: EmendaDoPainel): Exclude<Gnd, ""> {
  if (e.gnd3 > 0 && e.gnd4 > 0) return "misto";
  return e.gnd4 > 0 ? "4" : "3";
}

const ROTULO_GND: Record<Exclude<Gnd, "">, string> = { "3": "Custeio (GND 3)", "4": "Investimento (GND 4)", misto: "Custeio e investimento" };

function semAcento(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/** O nome da instituição (ou "MEC, a repartir") que aparece nas listas. */
function quemRecebe(e: EmendaDoPainel): string {
  return e.sigla ?? "MEC, a repartir";
}

function Barras({
  titulo,
  nota,
  itens,
  ativo,
  aoClicar,
}: {
  titulo: string;
  nota: string;
  itens: { chave: string; rotulo: string; valor: number; partes?: { valor: number; classe: string }[]; destaque?: boolean }[];
  ativo: string;
  aoClicar: (chave: string) => void;
}) {
  const max = Math.max(1, ...itens.map((i) => i.valor));
  return (
    <section className="flex flex-col gap-2 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
      <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">{titulo}</h3>
      <p className="text-xs text-neutral-500">{nota}</p>
      {itens.length === 0 ? (
        <p className="text-sm text-neutral-500">Nenhuma emenda com estes filtros.</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {itens.map((i) => (
            <li key={i.chave}>
              <button
                type="button"
                onClick={() => aoClicar(i.chave)}
                title={`${i.rotulo}: ${reais.format(i.valor)}. Clique para filtrar.`}
                className={`grid w-full grid-cols-[7rem_1fr_6rem] items-center gap-2 rounded px-1 py-0.5 text-left text-xs hover:bg-neutral-100 dark:hover:bg-neutral-900 ${
                  ativo === i.chave ? "bg-if-green/10 font-semibold" : ""
                } ${i.destaque ? "font-semibold text-if-green" : "text-neutral-700 dark:text-neutral-300"}`}
              >
                <span className="truncate">{i.rotulo}</span>
                <span className="flex h-3 overflow-hidden rounded bg-neutral-100 dark:bg-neutral-800">
                  {(i.partes ?? [{ valor: i.valor, classe: i.destaque ? "bg-if-green" : "bg-if-green/60" }]).map((p, k) => (
                    <span key={k} className={p.classe} style={{ width: `${(p.valor / max) * 100}%` }} />
                  ))}
                </span>
                <span className="text-right tabular-nums">{compacto.format(i.valor)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Cartao({ titulo, valor, detalhe, destaque }: { titulo: string; valor: string; detalhe: string; destaque?: boolean }) {
  return (
    <div className={`flex flex-col gap-1 rounded-lg border p-4 ${destaque ? "border-if-green/50 bg-if-green/5" : "border-neutral-200 dark:border-neutral-800"}`}>
      <span className="text-xs uppercase tracking-wide text-neutral-500">{titulo}</span>
      <span className={`text-2xl font-semibold tabular-nums ${destaque ? "text-if-green" : "text-neutral-900 dark:text-neutral-100"}`}>{valor}</span>
      <span className="text-xs text-neutral-600 dark:text-neutral-400">{detalhe}</span>
    </div>
  );
}

function Seletor({ rotulo, valor, aoMudar, opcoes }: { rotulo: string; valor: string; aoMudar: (v: string) => void; opcoes: { valor: string; rotulo: string }[] }) {
  return (
    <label className="flex flex-col gap-1 text-xs text-neutral-600 dark:text-neutral-400">
      {rotulo}
      <select
        value={valor}
        onChange={(e) => aoMudar(e.target.value)}
        className="rounded border border-neutral-300 bg-white px-2 py-1.5 text-sm text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
      >
        <option value="">Todos</option>
        {opcoes.map((o) => (
          <option key={o.valor} value={o.valor}>
            {o.rotulo}
          </option>
        ))}
      </select>
    </label>
  );
}

function DetalheDaEmenda({ e }: { e: EmendaDoPainel }) {
  return (
    <div className="flex flex-col gap-2 text-sm text-neutral-700 dark:text-neutral-300">
      <p>
        <strong>Ementa:</strong> {e.ementa || "-"}
      </p>
      <p>
        <strong>Unidade orçamentária:</strong> {e.uoCodigo} - {e.uoNome}. <strong>Funcional:</strong> <span className="font-mono">{e.funcional || "-"}</span>.{" "}
        <strong>Subtítulo:</strong> {e.subtitulo}.
      </p>
      <p>
        <strong>Ação:</strong> {e.acao} - {e.acaoDescricao}. <strong>Valor:</strong> {reais.format(e.gnd3)} em custeio (GND 3) e {reais.format(e.gnd4)} em investimento
        (GND 4){e.outros > 0 ? `, mais ${reais.format(e.outros)} em outros grupos` : ""}.
      </p>
      <p>
        <strong>Justificativa:</strong> {e.justificativa || "sem justificativa no espelho"}
      </p>
    </div>
  );
}

export function EmendasPainel({ emendas, exercicio }: { emendas: EmendaDoPainel[]; exercicio: number }) {
  const [escopo, setEscopo] = useState<Escopo>("diretas");
  const [visao, setVisao] = useState<Visao>("graficos");
  const [f, setF] = useState<Filtros>(SEM_FILTRO);
  const [abertas, setAbertas] = useState<Set<string>>(new Set());
  const [verTodas, setVerTodas] = useState(false);

  const mudar = <K extends keyof Filtros>(k: K, v: Filtros[K]) => setF((a) => ({ ...a, [k]: v }));
  const alternar = (k: string) =>
    setAbertas((a) => {
      const n = new Set(a);
      if (n.has(k)) n.delete(k);
      else n.add(k);
      return n;
    });

  const doEscopo = useMemo(
    () => emendas.filter((e) => (escopo === "todas" ? true : escopo === "mec" ? e.uoCodigo === "26101" : e.uoCodigo !== "26101")),
    [emendas, escopo],
  );

  const passa = (e: EmendaDoPainel, ignorar?: keyof Filtros) => {
    const ok = (k: keyof Filtros, cond: boolean) => ignorar === k || cond;
    const busca = semAcento(f.busca.trim());
    return (
      ok("busca", !busca || semAcento([e.numero, e.autor, e.sigla ?? "", e.instituicao ?? "", e.acao, e.ementa, e.subtitulo, e.justificativa].join(" ")).includes(busca)) &&
      ok("regiao", !f.regiao || (e.uf !== null && REGIAO[e.uf] === f.regiao)) &&
      ok("uf", !f.uf || e.uf === f.uf) &&
      ok("sigla", !f.sigla || quemRecebe(e) === f.sigla) &&
      ok("modalidade", !f.modalidade || e.modalidade === f.modalidade) &&
      ok("acao", !f.acao || e.acao === f.acao) &&
      ok("gnd", !f.gnd || gndDa(e) === f.gnd) &&
      ok("recibo", !f.recibo || (f.recibo === "coletiva" ? e.comRecibo === null : f.recibo === "sim" ? e.comRecibo === true : e.comRecibo === false)) &&
      ok("autor", !f.autor || e.autor === f.autor)
    );
  };

  const filtradas = doEscopo.filter((e) => passa(e));
  const totalEscopo = doEscopo.reduce((s, e) => s + e.total, 0);
  const total = filtradas.reduce((s, e) => s + e.total, 0);
  const gnd3 = filtradas.reduce((s, e) => s + e.gnd3, 0);
  const gnd4 = filtradas.reduce((s, e) => s + e.gnd4, 0);
  const contar = (m: string) => filtradas.filter((e) => e.modalidade === m).length;
  const instituicoesNoFiltro = new Set(filtradas.filter((e) => e.sigla).map((e) => e.sigla));
  const ufsNoFiltro = new Set(filtradas.map((e) => e.uf).filter(Boolean));
  const filtrosAtivos = Object.entries(f).filter(([, v]) => v !== "").length;

  // As opções de cada seletor vêm do escopo inteiro, para nenhuma sumir quando outro filtro está ligado.
  const opcoes = (valor: (e: EmendaDoPainel) => string | null, rotulo?: (v: string) => string) =>
    [...new Set(doEscopo.map(valor).filter((v): v is string => !!v))]
      .sort((a, b) => a.localeCompare(b, "pt-BR"))
      .map((v) => ({ valor: v, rotulo: rotulo ? rotulo(v) : v }));

  // Por instituição, com os filtros de agora (menos o de instituição): a posição do IFSul e o resumo.
  const porInstituicao = useMemo(() => {
    const m = new Map<string, { sigla: string; nome: string; uf: string; n: number; individuais: number; coletivas: number; gnd3: number; gnd4: number; total: number; emendas: EmendaDoPainel[] }>();
    for (const e of doEscopo) {
      if (!passa(e, "sigla")) continue;
      const k = quemRecebe(e);
      const l = m.get(k) ?? { sigla: k, nome: e.instituicao ?? "Ministério da Educação, a repartir entre as instituições", uf: e.sigla ? (e.uf ?? "") : "", n: 0, individuais: 0, coletivas: 0, gnd3: 0, gnd4: 0, total: 0, emendas: [] };
      l.n++;
      if (e.modalidade === "Individual") l.individuais++;
      else l.coletivas++;
      l.gnd3 += e.gnd3;
      l.gnd4 += e.gnd4;
      l.total += e.total;
      l.emendas.push(e);
      m.set(k, l);
    }
    return [...m.values()].sort((a, b) => b.total - a.total);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doEscopo, f]);
  const somaInstituicoes = porInstituicao.reduce((s, l) => s + l.total, 0);
  const somaSoInstituicoes = porInstituicao.filter((l) => l.sigla !== "MEC, a repartir").reduce((s, l) => s + l.total, 0);
  const posIfsul = porInstituicao.filter((l) => l.sigla !== "MEC, a repartir").findIndex((l) => ehInstituicaoDestaque(l.sigla));
  const ifsul = posIfsul >= 0 ? porInstituicao.filter((l) => l.sigla !== "MEC, a repartir")[posIfsul] : undefined;
  const nInstituicoes = porInstituicao.filter((l) => l.sigla !== "MEC, a repartir").length;

  const agrupar = (chave: (e: EmendaDoPainel) => string | null) => {
    const m = new Map<string, { valor: number; g3: number; g4: number }>();
    for (const e of filtradas) {
      const k = chave(e);
      if (!k) continue;
      const a = m.get(k) ?? { valor: 0, g3: 0, g4: 0 };
      a.valor += e.total;
      a.g3 += e.gnd3;
      a.g4 += e.gnd4;
      m.set(k, a);
    }
    return [...m.entries()].sort((a, b) => b[1].valor - a[1].valor);
  };
  const partesGnd = (g3: number, g4: number) => [
    { valor: g4, classe: "bg-if-green" },
    { valor: g3, classe: "bg-if-green/40" },
  ];

  const ordenadas = [...filtradas].sort((a, b) => {
    const da = a.sigla && ehInstituicaoDestaque(a.sigla) ? 1 : 0;
    const db = b.sigla && ehInstituicaoDestaque(b.sigla) ? 1 : 0;
    return db - da || b.total - a.total;
  });
  const visiveis = verTodas ? ordenadas : ordenadas.slice(0, 50);

  const contagemEscopo = (s: Escopo) => emendas.filter((e) => (s === "todas" ? true : s === "mec" ? e.uoCodigo === "26101" : e.uoCodigo !== "26101")).length;
  const botaoAba = (ativo: boolean) =>
    `rounded px-3 py-1.5 text-sm font-medium ${ativo ? "bg-if-green text-white" : "border border-neutral-300 text-neutral-700 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-900"}`;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs uppercase tracking-wide text-neutral-500">Quais emendas</span>
        {(
          [
            ["diretas", "Diretas às instituições"],
            ["mec", "Pelo MEC, sem instituição definida"],
            ["todas", "Todas"],
          ] as [Escopo, string][]
        ).map(([s, r]) => (
          <button key={s} type="button" onClick={() => setEscopo(s)} className={botaoAba(escopo === s)}>
            {r} ({contagemEscopo(s)})
          </button>
        ))}
      </div>

      <section className="flex flex-col gap-3 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
            Filtros {filtrosAtivos > 0 ? <span className="ml-1 rounded bg-if-green px-1.5 py-0.5 text-xs font-normal text-white">{filtrosAtivos} ligado(s)</span> : null}
          </h2>
          <button type="button" onClick={() => setF(SEM_FILTRO)} className="rounded border border-neutral-300 px-3 py-1 text-xs dark:border-neutral-700">
            Limpar filtros
          </button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <label className="flex flex-col gap-1 text-xs text-neutral-600 dark:text-neutral-400 sm:col-span-2">
            Procurar (número, autor, instituição, ação, câmpus, justificativa)
            <input
              value={f.busca}
              onChange={(e) => mudar("busca", e.target.value)}
              placeholder="ex.: Venâncio Aires, laboratório, 20RG"
              className="rounded border border-neutral-300 bg-white px-2 py-1.5 text-sm text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
            />
          </label>
          <Seletor rotulo="Região" valor={f.regiao} aoMudar={(v) => mudar("regiao", v)} opcoes={opcoes((e) => (e.uf ? (REGIAO[e.uf] ?? null) : null))} />
          <Seletor rotulo="UF" valor={f.uf} aoMudar={(v) => mudar("uf", v)} opcoes={opcoes((e) => e.uf)} />
          <Seletor rotulo="Instituição" valor={f.sigla} aoMudar={(v) => mudar("sigla", v)} opcoes={opcoes((e) => quemRecebe(e))} />
          <Seletor rotulo="Modalidade" valor={f.modalidade} aoMudar={(v) => mudar("modalidade", v)} opcoes={opcoes((e) => e.modalidade)} />
          <Seletor
            rotulo="Ação"
            valor={f.acao}
            aoMudar={(v) => mudar("acao", v)}
            opcoes={opcoes(
              (e) => e.acao,
              (v) => `${v} - ${doEscopo.find((e) => e.acao === v)?.acaoDescricao.slice(0, 60) ?? ""}`,
            )}
          />
          <Seletor
            rotulo="Grupo de despesa"
            valor={f.gnd}
            aoMudar={(v) => mudar("gnd", v as Gnd)}
            opcoes={(["3", "4", "misto"] as const).map((g) => ({ valor: g, rotulo: ROTULO_GND[g] }))}
          />
          <Seletor
            rotulo="Recibo de entrega"
            valor={f.recibo}
            aoMudar={(v) => mudar("recibo", v as Recibo)}
            opcoes={[
              { valor: "sim", rotulo: "Individual, com recibo" },
              { valor: "nao", rotulo: "Individual, sem recibo" },
              { valor: "coletiva", rotulo: "Bancada ou comissão" },
            ]}
          />
          <Seletor rotulo="Autor" valor={f.autor} aoMudar={(v) => mudar("autor", v)} opcoes={opcoes((e) => e.autor)} />
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Cartao
          titulo="Valor das emendas"
          valor={reais.format(total)}
          detalhe={`${totalEscopo > 0 ? umDecimal.format((total / totalEscopo) * 100) : "0"}% de ${reais.format(totalEscopo)} neste grupo de emendas.`}
        />
        <Cartao
          titulo="Emendas"
          valor={inteiro.format(filtradas.length)}
          detalhe={`${contar("Individual")} individuais, ${contar("Bancada Estadual")} de bancada e ${contar("Comissão")} de comissão.`}
        />
        <Cartao titulo="Instituições e UFs" valor={inteiro.format(instituicoesNoFiltro.size)} detalhe={`instituições com emenda, em ${ufsNoFiltro.size} UFs.`} />
        <Cartao
          titulo="Investimento e custeio"
          valor={total > 0 ? `${Math.round((gnd4 / total) * 100)}% e ${Math.round((gnd3 / total) * 100)}%` : "-"}
          detalhe={`${reais.format(gnd4)} em investimento (GND 4) e ${reais.format(gnd3)} em custeio (GND 3).`}
        />
        <Cartao
          titulo="IFSul"
          destaque
          valor={ifsul ? reais.format(ifsul.total) : "nenhuma"}
          detalhe={
            ifsul
              ? `${ifsul.n} emenda(s), ${posIfsul + 1}º lugar entre ${nInstituicoes} instituições; ${umDecimal.format((ifsul.total / Math.max(1, somaSoInstituicoes)) * 100)}% do valor destinado às instituições.`
              : "Nenhuma emenda do IFSul com estes filtros."
          }
        />
      </div>

      <div className="flex flex-wrap gap-2 border-b border-neutral-200 pb-2 dark:border-neutral-800">
        {(
          [
            ["graficos", "Gráficos"],
            ["lista", "Lista das emendas"],
            ["resumo", "Resumo por instituição"],
          ] as [Visao, string][]
        ).map(([v, r]) => (
          <button key={v} type="button" onClick={() => setVisao(v)} className={botaoAba(visao === v)}>
            {r}
          </button>
        ))}
      </div>

      {visao === "graficos" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Barras
            titulo="Instituições, por valor"
            nota="As 15 maiores, com o IFSul sempre na lista. Verde forte: investimento; verde claro: custeio. Clique numa barra para filtrar."
            ativo={f.sigla}
            aoClicar={(k) => mudar("sigla", f.sigla === k ? "" : k)}
            itens={(() => {
              const todas = agrupar((e) => quemRecebe(e));
              const top = todas.slice(0, 15);
              const ifs = todas.find(([k]) => ehInstituicaoDestaque(k));
              if (ifs && !top.includes(ifs)) top.push(ifs);
              return top.map(([k, a]) => ({ chave: k, rotulo: k, valor: a.valor, partes: partesGnd(a.g3, a.g4), destaque: ehInstituicaoDestaque(k) }));
            })()}
          />
          <Barras
            titulo="Por UF"
            nota="UF da instituição ou do subtítulo da emenda. Clique para filtrar."
            ativo={f.uf}
            aoClicar={(k) => mudar("uf", f.uf === k ? "" : k)}
            itens={agrupar((e) => e.uf).map(([k, a]) => ({ chave: k, rotulo: `${k} (${REGIAO[k] ?? ""})`, valor: a.valor, partes: partesGnd(a.g3, a.g4), destaque: k === "RS" }))}
          />
          <Barras
            titulo="Por ação orçamentária"
            nota="20RL é funcionamento, a mesma ação da matriz; 20RG, reestruturação e modernização; 219U e 15R4 vão pelo MEC."
            ativo={f.acao}
            aoClicar={(k) => mudar("acao", f.acao === k ? "" : k)}
            itens={agrupar((e) => e.acao).map(([k, a]) => ({
              chave: k,
              rotulo: `${k} ${filtradas.find((e) => e.acao === k)?.acaoDescricao ?? ""}`,
              valor: a.valor,
              partes: partesGnd(a.g3, a.g4),
            }))}
          />
          <Barras
            titulo="Por modalidade da emenda"
            nota="Individual (de um parlamentar), de bancada estadual ou de comissão. Clique para filtrar."
            ativo={f.modalidade}
            aoClicar={(k) => mudar("modalidade", f.modalidade === k ? "" : k)}
            itens={agrupar((e) => e.modalidade).map(([k, a]) => ({ chave: k, rotulo: k, valor: a.valor, partes: partesGnd(a.g3, a.g4) }))}
          />
        </div>
      )}

      {visao === "lista" && (
        <section className="flex flex-col gap-2">
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            {filtradas.length} emenda(s), do maior valor para o menor, com as do IFSul primeiro. O + abre logo abaixo a ementa, a funcional e a justificativa.
          </p>
          <div className="tabela-rolavel rounded-lg border border-neutral-200 dark:border-neutral-800">
            <table className="w-full text-left text-sm">
              <thead className="bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500 dark:bg-neutral-900">
                <tr>
                  <th className="px-3 py-2">Emenda</th>
                  <th className="px-3 py-2">Autor</th>
                  <th className="px-3 py-2">Modalidade</th>
                  <th className="px-3 py-2">Instituição</th>
                  <th className="px-3 py-2">UF</th>
                  <th className="px-3 py-2">Ação</th>
                  <th className="px-3 py-2">Grupo</th>
                  <th className="px-3 py-2 text-right">Valor</th>
                  <th className="px-3 py-2">Recibo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                {visiveis.map((e) => {
                  const aberta = abertas.has(e.numero);
                  const destaque = !!e.sigla && ehInstituicaoDestaque(e.sigla);
                  return (
                    <Fragment key={e.numero}>
                      <tr className={destaque ? "bg-if-green/10" : ""}>
                        <td className="px-3 py-2">
                          <button type="button" onClick={() => alternar(e.numero)} aria-expanded={aberta} className="flex items-center gap-2 font-mono text-xs hover:text-if-green">
                            <SinalMaisMenos aberto={aberta} />
                            {e.numero}
                          </button>
                        </td>
                        <td className="px-3 py-2">
                          {e.autor}
                          <span className="block text-xs text-neutral-500">{e.tipoAutor}</span>
                        </td>
                        <td className="px-3 py-2 text-xs">{e.modalidade}</td>
                        <td className={`px-3 py-2 ${destaque ? "font-semibold text-if-green" : ""}`}>{quemRecebe(e)}</td>
                        <td className="px-3 py-2">{e.uf ?? "-"}</td>
                        <td className="px-3 py-2 font-mono text-xs" title={e.acaoDescricao}>
                          {e.acao}
                        </td>
                        <td className="px-3 py-2 text-xs">{ROTULO_GND[gndDa(e)]}</td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {reais.format(e.total)}
                          {e.total <= 10 ? <span className="block text-xs text-amber-700 dark:text-amber-400">valor simbólico</span> : null}
                        </td>
                        <td className="px-3 py-2 text-xs">{e.comRecibo === null ? <span className="text-neutral-400">coletiva</span> : e.comRecibo ? "sim" : <span className="text-if-red">não</span>}</td>
                      </tr>
                      {aberta && (
                        <tr data-detalhe="1">
                          <td colSpan={99} className="bg-neutral-50 px-4 py-3 dark:bg-neutral-900">
                            <DetalheDaEmenda e={e} />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-neutral-300 bg-neutral-50 font-semibold dark:border-neutral-700 dark:bg-neutral-900">
                  <td className="px-3 py-2" colSpan={7}>
                    Total, {filtradas.length} emenda(s)
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{reais.format(total)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
          {ordenadas.length > 50 && (
            <button type="button" onClick={() => setVerTodas((v) => !v)} className="self-start text-sm font-medium text-if-green underline">
              {verTodas ? "Mostrar só as 50 maiores" : `Mostrar as ${ordenadas.length} emendas`}
            </button>
          )}
        </section>
      )}

      {visao === "resumo" && (
        <section className="flex flex-col gap-2">
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            Cada instituição com o número de emendas e o valor, do maior para o menor, com o IFSul primeiro. O + abre as emendas da instituição logo abaixo da linha.
            &quot;Fatia&quot; é a parte de cada uma no valor destinado às instituições com estes filtros.
          </p>
          <div className="tabela-rolavel rounded-lg border border-neutral-200 dark:border-neutral-800">
            <table className="w-full text-left text-sm">
              <thead className="bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500 dark:bg-neutral-900">
                <tr>
                  <th className="px-3 py-2">Posição</th>
                  <th className="px-3 py-2">Instituição</th>
                  <th className="px-3 py-2">UF</th>
                  <th className="px-3 py-2 text-right">Emendas</th>
                  <th className="px-3 py-2 text-right">Individuais</th>
                  <th className="px-3 py-2 text-right">Bancada e comissão</th>
                  <th className="px-3 py-2 text-right">Custeio (GND 3)</th>
                  <th className="px-3 py-2 text-right">Investimento (GND 4)</th>
                  <th className="px-3 py-2 text-right">Total</th>
                  <th className="px-3 py-2 text-right">Fatia</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                {[...porInstituicao.filter((l) => ehInstituicaoDestaque(l.sigla)), ...porInstituicao.filter((l) => !ehInstituicaoDestaque(l.sigla))].map((l) => {
                  const chave = `inst:${l.sigla}`;
                  const aberta = abertas.has(chave);
                  const destaque = ehInstituicaoDestaque(l.sigla);
                  const mec = l.sigla === "MEC, a repartir";
                  const posicao = mec ? null : porInstituicao.filter((x) => x.sigla !== "MEC, a repartir").indexOf(l) + 1;
                  return (
                    <Fragment key={chave}>
                      <tr className={destaque ? "bg-if-green/10 font-medium" : mec ? "bg-neutral-50 dark:bg-neutral-900" : ""}>
                        <td className="px-3 py-2 tabular-nums">{posicao ?? "-"}</td>
                        <td className="px-3 py-2">
                          <button type="button" onClick={() => alternar(chave)} aria-expanded={aberta} className="flex items-start gap-2 text-left hover:text-if-green">
                            <SinalMaisMenos aberto={aberta} />
                            <span>
                              <span className={destaque ? "text-if-green" : "font-medium"}>{l.sigla}</span>
                              <span className="block text-xs font-normal text-neutral-500">{l.nome}</span>
                            </span>
                          </button>
                        </td>
                        <td className="px-3 py-2">{l.uf || "-"}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{l.n}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{l.individuais}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{l.coletivas}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{reais.format(l.gnd3)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{reais.format(l.gnd4)}</td>
                        <td className="px-3 py-2 text-right font-medium tabular-nums">{reais.format(l.total)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{mec ? "-" : `${umDecimal.format((l.total / Math.max(1, somaSoInstituicoes)) * 100)}%`}</td>
                      </tr>
                      {aberta && (
                        <tr data-detalhe="1">
                          <td colSpan={99} className="bg-neutral-50 px-4 py-3 dark:bg-neutral-900">
                            <ul className="flex flex-col gap-2 text-sm">
                              {l.emendas
                                .sort((a, b) => b.total - a.total)
                                .map((e) => (
                                  <li key={e.numero} className="flex flex-col gap-0.5">
                                    <span>
                                      <span className="font-mono text-xs">{e.numero}</span> · {e.autor} ({e.modalidade.toLowerCase()}) · {e.acao} · {ROTULO_GND[gndDa(e)]} ·{" "}
                                      <strong className="tabular-nums">{reais.format(e.total)}</strong>
                                      {e.comRecibo === false ? <span className="text-if-red"> · sem recibo</span> : null}
                                    </span>
                                    <span className="text-xs text-neutral-600 dark:text-neutral-400">
                                      {e.subtitulo}. {e.ementa}
                                    </span>
                                  </li>
                                ))}
                            </ul>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-neutral-300 bg-neutral-50 font-semibold dark:border-neutral-700 dark:bg-neutral-900">
                  <td className="px-3 py-2" colSpan={3}>
                    Total
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{porInstituicao.reduce((s, l) => s + l.n, 0)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{porInstituicao.reduce((s, l) => s + l.individuais, 0)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{porInstituicao.reduce((s, l) => s + l.coletivas, 0)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{reais.format(porInstituicao.reduce((s, l) => s + l.gnd3, 0))}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{reais.format(porInstituicao.reduce((s, l) => s + l.gnd4, 0))}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{reais.format(somaInstituicoes)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </section>
      )}

      <p className="text-xs text-neutral-500">
        Emendas apresentadas ao PLOA {exercicio}. O total de &quot;Todas&quot; soma as diretas e as que vão pelo MEC; as do MEC não têm instituição definida e por
        isso ficam fora da posição e da fatia de cada instituição.
      </p>
    </div>
  );
}
