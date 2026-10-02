import Link from "next/link";
import { prisma } from "@/server/db/prisma";
import { TABLE_MAX_WIDTH } from "@/lib/layoutWidths";
import { ehInstituicaoDestaque } from "@/lib/destaque";
import { modoDoParametro, passaNoFiltro } from "@/lib/compararCursos";
import { ehChaveDeModalidade, ehFormaDeEnsino, rotuloDaModalidade, type ChaveModalidade } from "@/lib/modalidadeCurso";
import { requireAcessoPlenoOrRedirect } from "@/server/auth/session";
import { carregarCampiComCursosAfins, carregarCampiComFiltro, carregarCursosDoCampus, type FiltroDeCursos } from "@/server/queries/cursosCampus";
import type { CursoLinha } from "../ConsultaTabelaCursos";
import { PainelComparacaoCursos, type CursoComparavel } from "../PainelComparacaoCursos";
import { AjustesDaSelecao } from "./AjustesDaSelecao";
import { FiltroComparacao } from "./FiltroComparacao";
import { FiltroDeModalidade } from "./FiltroDeModalidade";
import { SeletorSlotCurso, type CampusOpcao } from "./SeletorSlotCurso";

export const dynamic = "force-dynamic";

const MAX_SLOTS = 4;

interface Busca {
  ano?: string;
  filtro?: string;
  mesmoCampus?: string;
  modalidade?: string;
  ensino?: string;
  campus1?: string; curso1?: string;
  campus2?: string; curso2?: string;
  campus3?: string; curso3?: string;
  campus4?: string; curso4?: string;
}

/** O IFSul primeiro, depois as demais instituições e câmpus em ordem alfabética. */
function ordenarCampi(campi: CampusOpcao[]): CampusOpcao[] {
  return [...campi].sort(
    (a, b) =>
      Number(ehInstituicaoDestaque(b.instituicaoSigla)) - Number(ehInstituicaoDestaque(a.instituicaoSigla)) ||
      a.instituicaoSigla.localeCompare(b.instituicaoSigla) ||
      a.nome.localeCompare(b.nome),
  );
}

function instituicoesDos(campi: CampusOpcao[]): string[] {
  return Array.from(new Set(campi.map((c) => c.instituicaoSigla)));
}

export default async function CompararCursosPage({ searchParams }: { searchParams: Promise<Busca> }) {
  await requireAcessoPlenoOrRedirect("/consulta/comparar");
  const params = await searchParams;
  const ano = Number(params.ano) || 2027;
  const filtro = modoDoParametro(params.filtro);
  const mesmoCampus = params.mesmoCampus === "1";
  // O recorte por modalidade (técnico integrado, Proeja, superior...) e por forma de ensino (presencial ou a distância): vale para todos os blocos.
  const modalidade = ehChaveDeModalidade(params.modalidade) ? params.modalidade : undefined;
  const ensino = ehFormaDeEnsino(params.ensino) ? params.ensino : undefined;
  const filtroDeCursos: FiltroDeCursos | undefined = modalidade || ensino ? { modalidade, ensino } : undefined;

  // Os ciclos que têm a 6ª fase carregada: são os únicos que fazem sentido como opção, e a escolha do ciclo precisa
  // continuar à vista mesmo quando o ciclo da URL não tem dado (senão a pessoa fica sem como voltar).
  const anosComCiclo = (await prisma.distribuicaoCiclo.findMany({ distinct: ["ano"], select: { ano: true }, orderBy: { ano: "desc" } })).map((a) => a.ano);
  const seletorDeAno = (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">Ciclo</span>
      <div className="flex gap-1">
        {anosComCiclo.map((a) => (
          <Link
            key={a}
            href={`/consulta/comparar?${new URLSearchParams({ ano: String(a) }).toString()}`}
            className={`rounded px-3 py-1.5 text-sm font-medium ${
              a === ano ? "bg-if-green text-white" : "border border-neutral-300 text-neutral-700 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
            }`}
          >
            {a}
          </Link>
        ))}
      </div>
    </div>
  );

  // Câmpus da rede inteira com curso carregado neste ano. Só nome e sigla: os cursos de cada um só são buscados quando
  // esse câmpus está de fato num dos slots, para não carregar os cursos de mais de 600 câmpus de uma vez.
  const porCampusRede = await prisma.distribuicaoCiclo.groupBy({
    by: ["unidadeId"],
    where: { ano },
    _sum: { valorReais: true },
  });
  if (porCampusRede.length === 0) {
    return (
      <main className={`mx-auto ${TABLE_MAX_WIDTH} px-6 py-16 lg:px-12`}>
        <h1 className="text-2xl font-semibold">Comparar cursos entre câmpus</h1>
        <p className="mt-3 text-neutral-600 dark:text-neutral-400">
          Esta tela depende da 6ª fase da MDO, que ainda não foi carregada para {ano}.
          {anosComCiclo.length > 0 ? " Escolha um dos ciclos que têm dado:" : " Nenhum ciclo tem a 6ª fase carregada."}
        </p>
        <div className="mt-4">{seletorDeAno}</div>
      </main>
    );
  }
  const unidades = await prisma.unidade.findMany({
    where: { id: { in: porCampusRede.map((c) => c.unidadeId) } },
    select: { id: true, nome: true, instituicao: { select: { sigla: true } } },
  });
  const campiRede = ordenarCampi(unidades.map((u) => ({ id: u.id, nome: u.nome, instituicaoSigla: u.instituicao.sigla })));
  const nomePorCampus = new Map(campiRede.map((c) => [c.id, c]));
  const valorPorCampus = new Map(porCampusRede.map((r) => [r.unidadeId, Number(r._sum.valorReais ?? 0)]));

  // Só os câmpus que têm curso no recorte escolhido (modalidade e forma de ensino) entram nas opções.
  const comFiltro = filtroDeCursos ? await carregarCampiComFiltro(ano, filtroDeCursos) : null;
  const campiBase = comFiltro ? campiRede.filter((c) => comFiltro.has(c.id)) : campiRede;

  // Sem nada escolhido, abre comparando os dois câmpus do IFSul que mais recebem (o foco do sistema).
  const maisRecebem = [...campiBase].sort((a, b) => (valorPorCampus.get(b.id) ?? 0) - (valorPorCampus.get(a.id) ?? 0));
  const doIfsul = maisRecebem.filter((c) => ehInstituicaoDestaque(c.instituicaoSigla));
  const base = doIfsul.length >= 2 ? doIfsul : maisRecebem;
  const padraoCampus1 = base[0]?.id;
  const padraoCampus2 = base.find((c) => c.id !== padraoCampus1)?.id;

  const campusParam = [params.campus1, params.campus2, params.campus3, params.campus4];
  const cursoParam = [params.curso1, params.curso2, params.curso3, params.curso4];
  // Quantidade de slots visíveis: contíguos a partir do 1, sempre pelo menos 2.
  let quantosSlots = 2;
  for (let i = 2; i < MAX_SLOTS; i++) if (campusParam[i]) quantosSlots = i + 1;

  // O curso principal (slot 1).
  const campus1 = campiBase.some((c) => c.id === Number(campusParam[0])) ? Number(campusParam[0]) : padraoCampus1;
  const cursos1 = campus1 === undefined ? [] : await carregarCursosDoCampus(ano, campus1, filtroDeCursos);
  const principal: CursoLinha | undefined = cursos1.find((c) => c.id === Number(cursoParam[0])) ?? cursos1[0];

  // Câmpus que servem para os outros slots, segundo o filtro: os que têm o mesmo curso ou curso de mesmo peso.
  const afins = principal && filtro !== "todos" ? await carregarCampiComCursosAfins(ano, { curso: principal.curso, peso: principal.peso }, filtro, filtroDeCursos) : null;
  const campiOutros: CampusOpcao[] = mesmoCampus
    ? campiBase.filter((c) => c.id === campus1)
    : afins
      ? campiBase.filter((c) => afins.has(c.id))
      : campiBase;

  interface Slot {
    indice: number;
    unidadeId: number;
    cursos: CursoLinha[];
    cursoEscolhido: CursoLinha | undefined;
    campi: CampusOpcao[];
    travado: boolean;
    aviso?: string;
  }
  const slots: Slot[] = [];
  if (principal && campus1 !== undefined) slots.push({ indice: 1, unidadeId: campus1, cursos: cursos1, cursoEscolhido: principal, campi: campiBase, travado: false });

  // Dentro do laço há principal e, portanto, campus1.
  const usados = new Set<number>(campus1 === undefined ? [] : [campus1]);
  for (let i = 1; i < quantosSlots && principal; i++) {
    const pedido = Number(campusParam[i]);
    // No filtro "só o mesmo curso" cada câmpus entra uma vez só: o mesmo curso tem várias turmas num câmpus, e duas colunas do
    // mesmo câmpus pareceriam uma comparação repetida. Para comparar turmas de um câmpus, use "Só o mesmo câmpus".
    const umPorCampus = filtro === "curso" && !mesmoCampus;
    const permitido = (id: number) => campiOutros.some((c) => c.id === id) && !(umPorCampus && usados.has(id));
    let unidadeId: number | undefined;
    if (mesmoCampus) unidadeId = campus1!;
    else if (permitido(pedido)) unidadeId = pedido;
    else if (i === 1 && padraoCampus2 !== undefined && permitido(padraoCampus2)) unidadeId = padraoCampus2;
    else {
      // O primeiro câmpus permitido ainda não usado, preferindo o IFSul.
      const candidatos = campiOutros.filter((c) => !usados.has(c.id));
      unidadeId = (candidatos.find((c) => ehInstituicaoDestaque(c.instituicaoSigla)) ?? candidatos[0] ?? campiOutros[0])?.id;
    }
    if (unidadeId === undefined) {
      slots.push({ indice: i + 1, unidadeId: campus1!, cursos: [], cursoEscolhido: undefined, campi: campiOutros, travado: mesmoCampus, aviso: "Nenhum câmpus tem curso comparável com o principal." });
      continue;
    }
    usados.add(unidadeId);
    const todos = await carregarCursosDoCampus(ano, unidadeId, filtroDeCursos);
    const cursos = todos.filter((c) => c.id !== principal.id && passaNoFiltro(filtro, principal, c));
    const escolhido = cursos.find((c) => c.id === Number(cursoParam[i])) ?? cursos[0];
    slots.push({
      indice: i + 1,
      unidadeId,
      cursos,
      cursoEscolhido: escolhido,
      campi: campiOutros,
      travado: mesmoCampus,
      aviso: cursos.length === 0 ? "Este câmpus não tem curso comparável com o principal." : undefined,
    });
  }

  // As opções de câmpus de cada bloco não repetem câmpus já usados em outro bloco (quando o filtro é "só o mesmo curso").
  if (filtro === "curso" && !mesmoCampus) {
    for (const s of slots) {
      const dosOutros = new Set(slots.filter((o) => o.indice !== s.indice).map((o) => o.unidadeId));
      s.campi = s.campi.filter((c) => c.id === s.unidadeId || !dosOutros.has(c.id));
    }
  }

  const paramsAtuais: Record<string, string> = { ano: String(ano) };
  if (filtro !== "todos") paramsAtuais.filtro = filtro;
  if (mesmoCampus) paramsAtuais.mesmoCampus = "1";
  if (modalidade) paramsAtuais.modalidade = modalidade;
  if (ensino) paramsAtuais.ensino = ensino;
  for (const s of slots) {
    paramsAtuais[`campus${s.indice}`] = String(s.unidadeId);
    if (s.cursoEscolhido) paramsAtuais[`curso${s.indice}`] = String(s.cursoEscolhido.id);
  }

  const comparaveis: CursoComparavel[] = slots
    .filter((s): s is Slot & { cursoEscolhido: CursoLinha } => s.cursoEscolhido !== undefined)
    .map((s) => {
      const campus = nomePorCampus.get(s.unidadeId)!;
      return { ...s.cursoEscolhido, campus: campus.nome, instituicaoSigla: campus.instituicaoSigla };
    });

  const modalidadesDiferentes = Array.from(new Set(comparaveis.map((c) => c.modalidadeRotulo).filter((m): m is string => Boolean(m))));

  const proximoCampusPadrao = campiOutros.find((c) => !slots.some((s) => s.unidadeId === c.id))?.id ?? campiOutros[0]?.id;

  return (
    <main className={`mx-auto flex ${TABLE_MAX_WIDTH} flex-col gap-6 px-6 py-12 lg:px-12`}>
      <div className="flex flex-col gap-2">
        <Link href={`/consulta?ano=${ano}`} className="text-sm text-neutral-500 underline hover:text-neutral-800 dark:hover:text-neutral-200">
          ← Consulta
        </Link>
        <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">Comparar cursos entre câmpus</h1>
        <p className="text-neutral-600 dark:text-neutral-400">
          Escolha até {MAX_SLOTS} cursos, de qualquer instituição da rede (o IFSul vem primeiro), para comparar lado a lado: duração do ciclo, carga horária, peso, matrícula equalizada e valor
          recebido. Em cada um, escolha primeiro a instituição, depois o câmpus e então o curso. <strong>O primeiro é o principal</strong>: a tela mostra o que ele ganha ou perde em relação aos
          outros.
        </p>
      </div>

      {seletorDeAno}

      <FiltroDeModalidade modalidade={modalidade} ensino={ensino} paramsAtuais={paramsAtuais} />

      {principal && (
        <FiltroComparacao modo={filtro} mesmoCampus={mesmoCampus} paramsAtuais={paramsAtuais} rotuloPrincipal={principal.curso} pesoPrincipal={principal.peso} />
      )}

      <AjustesDaSelecao>
        {slots.map((slot) => (
          <SeletorSlotCurso
            key={slot.indice}
            indice={slot.indice}
            ehPrincipal={slot.indice === 1}
            instituicoes={instituicoesDos(slot.campi)}
            campi={slot.campi}
            instituicaoEscolhida={nomePorCampus.get(slot.unidadeId)?.instituicaoSigla ?? ""}
            campusEscolhido={slot.unidadeId}
            campusTravado={slot.travado}
            cursos={slot.cursos.map((c) => ({ id: c.id, curso: c.curso, valor: c.valor, peso: c.peso, repasse: c.repasse, inicio: c.inicio, modalidade: c.modalidadeRotulo ?? "", tipoCurso: c.tipoCursoLegivel ?? "" }))}
            cursoEscolhido={slot.cursoEscolhido?.id ?? null}
            paramsAtuais={paramsAtuais}
            podeRemover={quantosSlots > 2 && slot.indice === quantosSlots}
            aviso={slot.aviso}
          />
        ))}
      </AjustesDaSelecao>

      {quantosSlots < MAX_SLOTS && proximoCampusPadrao !== undefined && (
        <Link
          href={`/consulta/comparar?${new URLSearchParams({ ...paramsAtuais, [`campus${quantosSlots + 1}`]: String(proximoCampusPadrao) }).toString()}`}
          scroll={false}
          className="w-fit text-sm text-if-green underline hover:text-if-green/80"
        >
          + adicionar outro curso
        </Link>
      )}

      {modalidadesDiferentes.length > 1 && principal?.modalidade && (
        <p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
          <strong>Atenção: estes cursos são de modalidades diferentes</strong> ({modalidadesDiferentes.join(", ")}). Peso, carga horária e duração não são comparáveis entre elas.{" "}
          <Link
            href={`/consulta/comparar?${new URLSearchParams({ ...paramsAtuais, modalidade: principal.modalidade }).toString()}`}
            scroll={false}
            className="font-medium underline"
          >
            Ver só {principal.modalidadeRotulo?.toLowerCase()}
          </Link>
          , a modalidade do curso principal.
        </p>
      )}

      {comparaveis.length >= 2 ? (
        <PainelComparacaoCursos cursos={comparaveis} principalId={principal?.id} />
      ) : (
        <p className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
          {modalidade || ensino
            ? `Nenhum câmpus tem dois cursos ${modalidade ? `da modalidade "${rotuloDaModalidade(modalidade as ChaveModalidade)}"` : ""}${modalidade && ensino ? " " : ""}${ensino ? (ensino === "ead" ? "a distância" : "presenciais") : ""} para comparar em ${ano}. Escolha outra modalidade ou "Todas".`
            : "Escolha pelo menos dois cursos para comparar. Se o filtro estiver marcado, talvez nenhum outro câmpus tenha curso comparável com o principal: tente \"Todos os cursos\"."}
        </p>
      )}
    </main>
  );
}
