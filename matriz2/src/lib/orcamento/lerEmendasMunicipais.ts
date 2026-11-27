/**
 * Leitura das emendas impositivas ao orçamento do município, como a Câmara de Vereadores de Venâncio Aires as publica: a lista
 * (25 por página, da mais nova para a mais antiga) e a página de cada emenda, com o formulário da Comissão de Orçamento e
 * Finanças (autor, tipo, valor, secretaria, ação e justificativa).
 */

const ENTIDADES: Record<string, string> = { "&nbsp;": " ", "&amp;": "&", "&quot;": '"', "&#39;": "'", "&lt;": "<", "&gt;": ">", "&ordm;": "º", "&ordf;": "ª", "&deg;": "°" };

/** O HTML em texto corrido: sem scripts, estilos e marcas, com os acentos de volta. */
export function textoDoHtml(html: string): string {
  return html
    .replace(/<(script|style|noscript)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z]+;|&#\d+;/gi, (e) => {
      if (ENTIDADES[e]) return ENTIDADES[e]!;
      const n = /^&#(\d+);$/.exec(e);
      if (n) return String.fromCharCode(Number(n[1]));
      // As entidades de letra acentuada (&ccedil;, &atilde;...) viram a letra pela tabela do navegador; as poucas que a Câmara usa:
      const letras: Record<string, string> = { ccedil: "ç", atilde: "ã", otilde: "õ", aacute: "á", eacute: "é", iacute: "í", oacute: "ó", uacute: "ú", acirc: "â", ecirc: "ê", ocirc: "ô", agrave: "à", Ccedil: "Ç", Atilde: "Ã", Aacute: "Á", Eacute: "É", Iacute: "Í", Oacute: "Ó", Uacute: "Ú" };
      return letras[e.slice(1, -1)] ?? " ";
    })
    .replace(/\s+/g, " ")
    .trim();
}

export interface ItemDaLista {
  idExterno: number;
  data: Date | null;
  titulo: string;
  objeto: string;
  autoria: string;
  situacao: string | null;
}

function dataBr(s: string | undefined): Date | null {
  const m = /(\d{2})\/(\d{2})\/(\d{4})(?: (\d{2}):(\d{2}))?/.exec(s ?? "");
  if (!m) return null;
  return new Date(Date.UTC(Number(m[3]), Number(m[2]) - 1, Number(m[1]), Number(m[4] ?? 12) + 3, Number(m[5] ?? 0)));
}

/** Os itens de uma página da lista de emendas impositivas. */
export function itensDaLista(html: string): ItemDaLista[] {
  const itens: ItemDaLista[] = [];
  const blocos = html.split('<div class="pbw_linhatitulo-3">').slice(1);
  for (const b of blocos) {
    const id = /Emendas-Impositivas\/\d+\/\d+\/\d+\/(\d+)"/.exec(b);
    if (!id) continue;
    const data = /<span>(\d{2}\/\d{2}\/\d{4} \d{2}:\d{2})<\/span>/.exec(b)?.[1];
    // O link do título traz uma dica (onmouseover) com marcas HTML dentro; o título é o que vem a partir de "EMENDA".
    const titulo = textoDoHtml(/<div><a [\s\S]*?<\/a><\/div>/.exec(b)?.[0] ?? "")
      .replace(/^[\s\S]*?(?=EMENDA)/i, "")
      .trim();
    const objeto = textoDoHtml(/<em>([\s\S]*?)<\/em>/.exec(b)?.[1] ?? "");
    const autoria = textoDoHtml(/<strong>Autoria: <\/strong>([\s\S]*?)<\/span>/.exec(b)?.[1] ?? "");
    const situacao = /<strong>Situação: <\/strong>([\s\S]*?)<\/span>/.exec(b)?.[1];
    itens.push({ idExterno: Number(id[1]), data: dataBr(data), titulo, objeto, autoria, situacao: situacao ? textoDoHtml(situacao) : null });
  }
  return itens;
}

export interface DetalheDaEmenda {
  numero: string;
  tipo: "Individual" | "Bancada";
  tipoDetalhe: string | null;
  projetoDeLei: string | null;
  exercicio: number | null;
  autoria: string | null;
  vereador: string | null;
  partido: string | null;
  beneficiario: string | null;
  orgao: string | null;
  programa: string | null;
  acao: string | null;
  fonteRecurso: string | null;
  valor: number | null;
  justificativa: string | null;
  citaIfsul: boolean;
}

const entre = (t: string, re: RegExp) => {
  const m = re.exec(t);
  const v = m?.[1]?.trim();
  return v ? v : null;
};

const reaisParaNumero = (s: string | null) => (s ? Number(s.replace(/\./g, "").replace(",", ".")) : null);

/** As siglas dos partidos com registro no TSE desde 2016 (inclui os que se fundiram ou mudaram de nome). */
const PARTIDOS = new Set(
  "AGIR AVANTE CIDADANIA DC DEM MDB MOBILIZA NOVO PATRIOTA PCB PCDOB PCO PDT PL PMB PMDB PMN PODE PODEMOS PP PPL PPS PR PRB PRD PROS PRP PRTB PSB PSC PSD PSDB PSL PSOL PSTU PT PTB PTC PTN PV REDE REPUBLICANOS SOLIDARIEDADE UNIÃO UNIAO UP"
    .split(" "),
);
export const ehPartido = (s: string) => PARTIDOS.has(s.trim().toUpperCase());

/** Cita o IFSul, o Instituto Federal ou o câmpus de Venâncio Aires. */
export function citaOIfsul(texto: string): boolean {
  return /\bIFSUL\b|INSTITUTO FEDERAL|IF SUL-?RIO|CAMPUS VEN[AÂ]NCIO|C[AÂ]MPUS VEN[AÂ]NCIO/i.test(texto);
}

/**
 * Os campos da página de uma emenda. O formulário da Comissão de Orçamento e Finanças é o mesmo desde 2021; nas emendas mais
 * antigas parte dos campos não existe, e eles ficam vazios.
 */
export function detalheDaEmenda(html: string, titulo: string): DetalheDaEmenda {
  // Só o corpo da emenda: do projeto a que ela se refere até o parecer da comissão (o resto da página é menu e notícias).
  const completo = textoDoHtml(html);
  const inicio = completo.search(/Emenda:\s*PROJETO DE LEI/i);
  const fim = completo.search(/PARECER DA COMISS[AÃ]O/i);
  const t = completo.slice(Math.max(0, inicio), fim > inicio ? fim : undefined);
  const cab = titulo.toUpperCase();
  const numero = /N[º°o]?\s*(\d{1,4}\/\d{4})/i.exec(titulo)?.[1] ?? /(\d{1,4}\/\d{4})/.exec(titulo)?.[1] ?? "";
  const tipoDetalhe = entre(t, /Tipo de Emenda:\s*(.+?)\s+Ordem de Prioridade/i);
  const tipo = /BANCADA/.test(cab) || /bancada/i.test(tipoDetalhe ?? "") ? "Bancada" : "Individual";
  const projetoDeLei = /PROJETO DE LEI(?: DO)? EXECUTIVO N[º°o]?\s*(\d{1,4}\/\d{4})/i.exec(titulo)?.[1] ?? entre(t, /Projeto de Lei N\s*o\s*:\s*(\d{1,4}\/\d{4})/i);
  // A emenda altera a lei do ano seguinte ao do projeto (o projeto 0096/2026 é a LOA de 2027). Sem projeto, vale o ano do texto.
  const exercicioTexto = /exerc[ií]cio(?: financeiro)? de (\d{4})/i.exec(t)?.[1];
  const exercicio = projetoDeLei ? Number(projetoDeLei.split("/")[1]) + 1 : exercicioTexto ? Number(exercicioTexto) : null;
  // "NOME (PARTIDO)"; o parêntese às vezes traz um apelido ("ELIGIO WESCHENFELDER (MUCHILA)"), que não é partido.
  const vereadorEPartido = /Vereador Proponente:\s*([^()]+?)\s*\(([^)]+)\)/i.exec(t);
  const autoria = entre(t, /Autoria:\s*(.+?)\s+Benefici[aá]rio:/i);
  // Sem o partido ao lado do nome, a emenda de bancada o traz na autoria ("Bancada do PDT").
  const partidoDoNome = vereadorEPartido?.[2]?.trim() ?? null;
  const partidoDaBancada = /Bancada d[oa]s?\s+(\S+)/i.exec(autoria ?? "")?.[1] ?? null;
  const partido = [partidoDoNome, partidoDaBancada].find((p) => p && ehPartido(p))?.toUpperCase() ?? null;
  // O formulário mudou em 2023: antes, o valor vinha em "Emenda ( + ): R$" ou "Valor Aumentado de Dotações"; depois, em "Valor da Emenda".
  const valor = reaisParaNumero(
    entre(t, /Valor da Emenda\s*R\$\s*([\d.]+,\d{2})/i) ?? entre(t, /Emenda\s*\(\s*\+\s*\):\s*R\$\s*([\d.]+,\d{2})/i) ?? entre(t, /Valor Aumentado de Dota[çc][õo]es\s*R\$\s*([\d.]+,\d{2})/i),
  );
  const credito = t.split(/CRÉDITO ORÇAMENTÁRIO REDUZIDO/i)[0] ?? t;
  return {
    numero,
    tipo,
    tipoDetalhe,
    projetoDeLei,
    exercicio,
    autoria,
    vereador: vereadorEPartido?.[1]?.trim() ?? null,
    partido,
    beneficiario: entre(t, /Benefici[aá]rio:\s*(.+?)\s+(?:CNPJ:|Justificativa:)/i),
    orgao: entre(credito, /Órgão:\s*(.+?)\s+(?:Unidade Orçamentária:|Programa:)/i),
    programa: entre(credito, /Programa:\s*(.+?)\s+(?:Iniciativa:|Ação:)/i),
    acao: entre(credito, /Ação:\s*(.+?)\s+Modalidade/i),
    fonteRecurso: entre(credito, /Fonte de Recursos?:\s*(.+?)\s*(?:Valores Iniciais|$)/i),
    valor: valor !== null && Number.isFinite(valor) ? valor : null,
    justificativa: entre(t, /Justificativa:\s*(.+?)\s+(?:EMENDA Valor|Marcar com|CRÉDITO ORÇAMENTÁRIO)/i),
    citaIfsul: citaOIfsul(t),
  };
}
