/**
 * Normalização de nome/sigla de instituição e câmpus para casar linhas de CSVs externos à PNP (ex.:
 * MatriculaTotalEqualizadaAnual, RappAnual — publicados pela CONIF) contra os registros já ingeridos.
 * Grafia diverge mesmo tratando-se da mesma instituição/câmpus (ex.: CSV "INSTITUTO FEDERAL DE
 * TOCANTINS" vs banco "Instituto Federal do Tocantins"; CSV sigla "IFSERTAO-PE" vs banco
 * "IF SERTÃO-PE") — ver comentários de matching em src/server/actions/matriculaTotalEqualizadaAnual.ts
 * e src/server/actions/rappAnual.ts para os números reais medidos.
 */

const PREPOSICOES = /\b(de|do|da|dos|das)\b/g;
// Faixa Unicode "Combining Diacritical Marks" (U+0300 a U+036F).
const DIACRITICOS_INICIO = 0x0300;
const DIACRITICOS_FIM = 0x036f;

function semAcento(valor: string): string {
  let resultado = "";
  for (const char of valor.normalize("NFD")) {
    const codigo = char.codePointAt(0) ?? 0;
    if (codigo < DIACRITICOS_INICIO || codigo > DIACRITICOS_FIM) {
      resultado += char;
    }
  }
  return resultado;
}

/**
 * Nome de instituição: minúsculas, sem acento, sem espaço duplicado, e sem as preposições
 * "de/do/da/dos/das" — removidas por completo, não canonicalizadas, porque fontes externas às vezes
 * as omitem inteiramente (ex.: "Sul Minas Gerais" em vez de "Sul de Minas Gerais" para o IFSULDEMINAS;
 * substituir por uma forma canônica não ajudaria, pois a palavra simplesmente não existe de um dos lados).
 */
export function normalizarNomeInstituicao(nome: string): string {
  return semAcento(nome.trim().toLowerCase())
    .replace(PREPOSICOES, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Nome de câmpus: só acento/caixa/espaço — ao contrário do nome de instituição, palavras como
 * "Avançado" ou "Centro de Referência" aqui DEVEM continuar distinguindo unidades diferentes.
 */
export function normalizarNomeUnidade(nome: string): string {
  return semAcento(nome.trim().toLowerCase())
    .replace(/\s+/g, " ")
    .trim();
}

/** Sigla de instituição: maiúsculas, sem espaço/hífen/acento (ex.: "IFSERTAO-PE" ⇄ "IF SERTÃO-PE"). */
export function normalizarSigla(sigla: string): string {
  return semAcento(sigla.trim().toUpperCase()).replace(/[\s-]/g, "");
}

/**
 * Indexa uma lista por uma chave normalizada, preservando colisões em vez de sobrescrever o
 * primeiro/último — quem consome o índice decide o que fazer com uma chave que aponta para mais de
 * um item (aqui: tratar como "ambíguo" e não adivinhar, ver `naoImportadas` nas Server Actions de
 * import). Nunca escolher o primeiro candidato silenciosamente.
 */
export function indexarComAmbiguidade<T>(itens: T[], chave: (item: T) => string): Map<string, T[]> {
  const mapa = new Map<string, T[]>();
  for (const item of itens) {
    const k = chave(item);
    const existentes = mapa.get(k);
    if (existentes) {
      existentes.push(item);
    } else {
      mapa.set(k, [item]);
    }
  }
  return mapa;
}
