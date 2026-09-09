import Link from "next/link";
import { prisma } from "@/server/db/prisma";
import { TABLE_MAX_WIDTH } from "@/lib/layoutWidths";
import { requireAcessoPlenoOrRedirect } from "@/server/auth/session";
import { carregarCursosDoCampus } from "@/server/queries/cursosCampus";
import { PainelComparacaoCursos, type CursoComparavel } from "../PainelComparacaoCursos";
import { SeletorSlotCurso, type CampusOpcao } from "./SeletorSlotCurso";

export const dynamic = "force-dynamic";

const MAX_SLOTS = 4;

interface Busca {
  ano?: string;
  campus1?: string; curso1?: string;
  campus2?: string; curso2?: string;
  campus3?: string; curso3?: string;
  campus4?: string; curso4?: string;
}

export default async function CompararCursosPage({ searchParams }: { searchParams: Promise<Busca> }) {
  await requireAcessoPlenoOrRedirect("/consulta/comparar");
  const params = await searchParams;
  const ano = Number(params.ano) || 2027;

  // Câmpus da rede inteira com curso carregado neste ano, agrupados por instituição,
  // igual ao seletor de câmpus do Simulador. Só nome e sigla: os cursos de cada um só
  // são buscados quando esse câmpus está de fato num dos slots, para não carregar os
  // cursos de mais de 600 câmpus de uma vez.
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
          Depende da 6ª fase da MDO, que ainda não foi carregada para {ano}.
        </p>
      </main>
    );
  }
  const unidades = await prisma.unidade.findMany({
    where: { id: { in: porCampusRede.map((c) => c.unidadeId) } },
    select: { id: true, nome: true, instituicao: { select: { sigla: true } } },
  });
  const campiRede: CampusOpcao[] = unidades
    .map((u) => ({ id: u.id, nome: u.nome, instituicaoSigla: u.instituicao.sigla }))
    .sort((a, b) => a.instituicaoSigla.localeCompare(b.instituicaoSigla) || a.nome.localeCompare(b.nome));
  const nomePorCampus = new Map(campiRede.map((c) => [c.id, c]));

  // Sem nada escolhido ainda, abre já comparando os dois câmpus que mais recebem na
  // rede, para a tela não abrir vazia.
  const rankeados = [...porCampusRede].sort(
    (a, b) => Number(b._sum.valorReais ?? 0) - Number(a._sum.valorReais ?? 0),
  );
  const padraoCampus1 = rankeados[0]?.unidadeId;
  const padraoCampus2 = rankeados.find((r) => r.unidadeId !== padraoCampus1)?.unidadeId;

  const campusPorSlot: (number | undefined)[] = [
    Number(params.campus1) || padraoCampus1,
    Number(params.campus2) || padraoCampus2,
    params.campus3 ? Number(params.campus3) : undefined,
    params.campus4 ? Number(params.campus4) : undefined,
  ];
  // Quantidade de slots visíveis: contíguos a partir do 1, sempre pelo menos 2.
  let quantosSlots = 2;
  for (let i = 2; i < MAX_SLOTS; i++) {
    if (campusPorSlot[i] !== undefined) quantosSlots = i + 1;
  }

  const cursoParamPorSlot = [params.curso1, params.curso2, params.curso3, params.curso4];

  const slots = await Promise.all(
    campusPorSlot.slice(0, quantosSlots).map(async (unidadeId, i) => {
      if (unidadeId === undefined || !nomePorCampus.has(unidadeId)) return null;
      const cursos = await carregarCursosDoCampus(ano, unidadeId);
      if (cursos.length === 0) return null;
      const cursoIdParam = cursoParamPorSlot[i] ? Number(cursoParamPorSlot[i]) : null;
      const cursoEscolhido = cursos.find((c) => c.id === cursoIdParam) ?? cursos[0]!;
      return { indice: i + 1, unidadeId, cursos, cursoEscolhido };
    }),
  );

  const paramsAtuais: Record<string, string> = { ano: String(ano) };
  for (let i = 0; i < quantosSlots; i++) {
    const slot = slots[i];
    if (!slot) continue;
    paramsAtuais[`campus${i + 1}`] = String(slot.unidadeId);
    paramsAtuais[`curso${i + 1}`] = String(slot.cursoEscolhido.id);
  }

  const comparaveis: CursoComparavel[] = slots
    .filter((s): s is NonNullable<typeof s> => s !== null)
    .map((s) => {
      const campus = nomePorCampus.get(s.unidadeId)!;
      return { ...s.cursoEscolhido, campus: campus.nome, instituicaoSigla: campus.instituicaoSigla };
    });

  const proximoCampusPadrao = campiRede.find(
    (c) => !slots.some((s) => s?.unidadeId === c.id),
  )?.id;

  function hrefAno(novoAno: number) {
    const q = new URLSearchParams({ ...paramsAtuais, ano: String(novoAno) });
    return `/consulta/comparar?${q.toString()}`;
  }

  return (
    <main className={`mx-auto flex ${TABLE_MAX_WIDTH} flex-col gap-6 px-6 py-12 lg:px-12`}>
      <div className="flex flex-col gap-2">
        <Link href={`/consulta?ano=${ano}`} className="text-sm text-neutral-500 underline hover:text-neutral-800 dark:hover:text-neutral-200">
          ← Consulta
        </Link>
        <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">
          Comparar cursos entre câmpus
        </h1>
        <p className="text-neutral-600 dark:text-neutral-400">
          Escolha até {MAX_SLOTS} pares de câmpus e curso, de qualquer instituição da rede, para comparar
          lado a lado (duração do ciclo, carga horária, peso, matrícula equalizada e valor recebido).
        </p>
      </div>

      <div className="flex gap-1">
        {[2026, 2027].map((a) => (
          <Link
            key={a}
            href={hrefAno(a)}
            className={`rounded px-3 py-1.5 text-sm font-medium ${
              a === ano
                ? "bg-if-green text-white"
                : "border border-neutral-300 text-neutral-700 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
            }`}
          >
            {a}
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {slots.map((slot, i) =>
          slot ? (
            <SeletorSlotCurso
              key={i}
              indice={i + 1}
              campiRede={campiRede}
              campusEscolhido={slot.unidadeId}
              cursosDoCampus={slot.cursos.map((c) => ({ id: c.id, curso: c.curso, valor: c.valor }))}
              cursoEscolhido={slot.cursoEscolhido.id}
              paramsAtuais={paramsAtuais}
              podeRemover={quantosSlots > 2 && i === quantosSlots - 1}
            />
          ) : null,
        )}
      </div>

      {quantosSlots < MAX_SLOTS && proximoCampusPadrao !== undefined && (
        <Link
          href={`/consulta/comparar?${new URLSearchParams({
            ...paramsAtuais,
            [`campus${quantosSlots + 1}`]: String(proximoCampusPadrao),
          }).toString()}`}
          className="w-fit text-sm text-if-green underline hover:text-if-green/80"
        >
          + adicionar outro câmpus
        </Link>
      )}

      {comparaveis.length >= 2 ? (
        <PainelComparacaoCursos cursos={comparaveis} />
      ) : (
        <p className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
          Escolha pelo menos dois câmpus com curso carregado para comparar.
        </p>
      )}
    </main>
  );
}
