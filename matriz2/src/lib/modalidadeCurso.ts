/**
 * A MODALIDADE de um curso: o grupo em que ele se compara com justiça (técnico integrado, técnico subsequente, Proeja, FIC,
 * superior, pós, educação básica). Comparar um técnico integrado com um bacharelado, ou com um FIC, mistura pesos, cargas
 * horárias e durações que não têm nada a ver, então a comparação entre câmpus deixa filtrar por aqui.
 *
 * Vem de dois campos que a MDO publica por ciclo de curso: o TIPO do curso (técnico, bacharelado, FIC...) e o TIPO DE OFERTA
 * (integrado, subsequente, Proeja...). A forma de ensino (presencial ou a distância) é outra coisa e tem filtro próprio.
 * Funções puras.
 */

export type ChaveModalidade = "tecnico-integrado" | "tecnico-subsequente" | "tecnico-concomitante" | "proeja" | "fic" | "superior" | "pos" | "basico" | "outras";

export const MODALIDADES: { chave: ChaveModalidade; rotulo: string; ajuda: string }[] = [
  { chave: "tecnico-integrado", rotulo: "Técnico integrado", ajuda: "Técnico junto com o ensino médio." },
  { chave: "tecnico-subsequente", rotulo: "Técnico subsequente", ajuda: "Técnico para quem já concluiu o ensino médio." },
  { chave: "tecnico-concomitante", rotulo: "Técnico concomitante", ajuda: "Técnico feito ao mesmo tempo que o ensino médio em outra escola." },
  { chave: "proeja", rotulo: "Proeja (EJA)", ajuda: "Educação de jovens e adultos integrada à formação profissional." },
  { chave: "fic", rotulo: "FIC (qualificação)", ajuda: "Formação inicial e continuada, cursos curtos." },
  { chave: "superior", rotulo: "Superior", ajuda: "Bacharelado, licenciatura e tecnologia." },
  { chave: "pos", rotulo: "Pós-graduação", ajuda: "Especialização, mestrado e doutorado." },
  { chave: "basico", rotulo: "Educação básica", ajuda: "Ensino fundamental, médio e infantil." },
];

export const ROTULO_OUTRAS = "Outras modalidades";

export function ehChaveDeModalidade(v: string | undefined): v is ChaveModalidade {
  return MODALIDADES.some((m) => m.chave === v);
}

function normalizar(texto: string | null | undefined): string {
  return (texto ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().trim();
}

/** A modalidade de um curso, a partir do tipo de curso e do tipo de oferta publicados pela MDO. */
export function modalidadeDoCurso(tipoCurso: string | null | undefined, tipoOferta: string | null | undefined): ChaveModalidade {
  const tipo = normalizar(tipoCurso);
  const oferta = normalizar(tipoOferta);
  if (oferta.startsWith("PROEJA")) return "proeja";
  if (tipo.startsWith("QUALIFICACAO")) return "fic";
  if (tipo === "TECNICO") {
    if (oferta === "INTEGRADO") return "tecnico-integrado";
    if (oferta === "SUBSEQUENTE") return "tecnico-subsequente";
    if (oferta === "CONCOMITANTE") return "tecnico-concomitante";
    return "outras";
  }
  if (["BACHARELADO", "LICENCIATURA", "TECNOLOGIA", "ABI"].includes(tipo)) return "superior";
  if (tipo.startsWith("ESPECIALIZACAO") || tipo.startsWith("MESTRADO") || tipo === "DOUTORADO") return "pos";
  if (tipo.startsWith("ENSINO") || tipo.startsWith("EDUCACAO")) return "basico";
  return "outras";
}

export function rotuloDaModalidade(chave: ChaveModalidade): string {
  return MODALIDADES.find((m) => m.chave === chave)?.rotulo ?? ROTULO_OUTRAS;
}

/** O tipo de curso por extenso, para distinguir bacharelado de licenciatura dentro de "Superior". */
export function tipoDeCursoLegivel(tipoCurso: string | null | undefined): string {
  const t = normalizar(tipoCurso);
  const mapa: Record<string, string> = {
    TECNICO: "técnico",
    BACHARELADO: "bacharelado",
    LICENCIATURA: "licenciatura",
    TECNOLOGIA: "tecnologia",
    ABI: "área básica de ingresso",
    DOUTORADO: "doutorado",
    MESTRADO: "mestrado",
    "MESTRADO PROFISSIONAL": "mestrado profissional",
    "ESPECIALIZACAO (LATO SENSU)": "especialização",
    "ESPECIALIZACAO TECNICA": "especialização técnica",
    "QUALIFICACAO PROFISSIONAL (FIC)": "FIC",
  };
  return mapa[t] ?? t.toLowerCase();
}

export type FormaDeEnsino = "presencial" | "ead";

export function ehFormaDeEnsino(v: string | undefined): v is FormaDeEnsino {
  return v === "presencial" || v === "ead";
}

/** "ENSINO PRESENCIAL" ou "ENSINO A DISTANCIA", como a MDO escreve. */
export function formaDeEnsinoDoCurso(modalidadeMdo: string | null | undefined): FormaDeEnsino {
  return normalizar(modalidadeMdo).includes("DISTANCIA") ? "ead" : "presencial";
}

export const ROTULO_FORMA_DE_ENSINO: Record<FormaDeEnsino, string> = { presencial: "Presencial", ead: "A distância (EAD)" };

/**
 * A condição de banco (`DistribuicaoCiclo`) que seleciona uma modalidade, a mesma regra de `modalidadeDoCurso` escrita para o Prisma.
 * Fica aqui, ao lado da regra, para as duas não divergirem.
 */
export function condicaoDaModalidade(chave: ChaveModalidade): Record<string, unknown> {
  const naoProeja = { NOT: { tipoOferta: { startsWith: "PROEJA" } } };
  switch (chave) {
    case "proeja":
      return { tipoOferta: { startsWith: "PROEJA" } };
    case "fic":
      return { tipoCurso: { startsWith: "QUALIFICACAO" }, ...naoProeja };
    case "tecnico-integrado":
      return { tipoCurso: "TECNICO", tipoOferta: "INTEGRADO" };
    case "tecnico-subsequente":
      return { tipoCurso: "TECNICO", tipoOferta: "SUBSEQUENTE" };
    case "tecnico-concomitante":
      return { tipoCurso: "TECNICO", tipoOferta: "CONCOMITANTE" };
    case "superior":
      return { tipoCurso: { in: ["BACHARELADO", "LICENCIATURA", "TECNOLOGIA", "ABI"] }, ...naoProeja };
    case "pos":
      return { OR: [{ tipoCurso: { startsWith: "ESPECIALIZACAO" } }, { tipoCurso: { startsWith: "MESTRADO" } }, { tipoCurso: "DOUTORADO" }], ...naoProeja };
    case "basico":
      return { OR: [{ tipoCurso: { startsWith: "ENSINO" } }, { tipoCurso: { startsWith: "EDUCACAO" } }], ...naoProeja };
    default:
      return {};
  }
}

export function condicaoDaFormaDeEnsino(forma: FormaDeEnsino): Record<string, unknown> {
  return forma === "ead" ? { modalidade: { contains: "DISTANCIA" } } : { NOT: { modalidade: { contains: "DISTANCIA" } } };
}
