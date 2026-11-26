const EXTENSOES = /\.(pdf|xlsx?|csv|zip|ods|odt|docx?)(\?|#|$)/i;

/** Os arquivos publicados numa página: os links para PDF, planilha, CSV, ZIP e documentos, sem repetição e em ordem. */
export function arquivosDaPagina(html: string, base: string): string[] {
  const links = new Set<string>();
  for (const m of html.matchAll(/href\s*=\s*["']([^"'#]+)["']/gi)) {
    const bruto = m[1]!.replace(/&amp;/g, "&").trim();
    let url: string;
    try {
      const u = new URL(bruto, base);
      // Carimbos de horário no endereço mudam a cada visita sem o arquivo mudar.
      for (const p of ["ts", "_", "t", "timestamp", "disposition"]) u.searchParams.delete(p);
      url = u.toString();
    } catch {
      continue;
    }
    // Links de download sem extensão (ex.: "arquivo?link=123") também contam.
    if (EXTENSOES.test(url) || /[?&](link|arquivo|download)=/i.test(url) || /\/download\//i.test(url)) links.add(url);
  }
  return [...links].sort();
}

/** O que entrou e o que saiu entre duas leituras, em texto curto. */
export function diferencas(antes: readonly string[], depois: readonly string[], limite = 30): string {
  const a = new Set(antes);
  const d = new Set(depois);
  const novos = depois.filter((x) => !a.has(x));
  const sairam = antes.filter((x) => !d.has(x));
  const partes: string[] = [];
  if (novos.length) partes.push(`Novo (${novos.length}):\n` + novos.slice(0, limite).join("\n") + (novos.length > limite ? `\n... e mais ${novos.length - limite}` : ""));
  if (sairam.length) partes.push(`Saiu (${sairam.length}):\n` + sairam.slice(0, limite).join("\n") + (sairam.length > limite ? `\n... e mais ${sairam.length - limite}` : ""));
  return partes.join("\n\n");
}
