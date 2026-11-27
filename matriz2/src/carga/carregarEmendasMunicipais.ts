import { prisma } from "@/server/db/prisma";
import { detalheDaEmenda, itensDaLista, type ItemDaLista } from "@/lib/orcamento/lerEmendasMunicipais";

/**
 * Carrega as emendas impositivas de vereadores e bancadas ao orçamento de Venâncio Aires, da página da Câmara de Vereadores.
 * Percorre a lista da mais nova para a mais antiga e abre cada emenda; uma emenda já gravada com a mesma situação não é aberta
 * de novo. Pode ser repetido.
 */
const BASE = "https://www.venancioaires.rs.leg.br";
// O site da Câmara recusa pedidos que não pareçam vir de um navegador (responde 406).
const CABECALHOS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml",
  "Accept-Language": "pt-BR,pt;q=0.9",
};

const espera = (ms: number) => new Promise((ok) => setTimeout(ok, ms));

async function baixar(url: string): Promise<string> {
  let ultimo: unknown;
  for (let tentativa = 1; tentativa <= 4; tentativa++) {
    try {
      const r = await fetch(url, { headers: CABECALHOS, signal: AbortSignal.timeout(60_000) });
      if (r.ok) {
        const html = await r.text();
        // Para alguns endereços (como o servidor de produção, fora do Brasil) a Câmara responde com uma verificação de robô.
        if (/Bot Verification|grecaptcha/i.test(html) && html.length < 5000)
          throw new Error("A Câmara respondeu com uma verificação de robô (reCAPTCHA). Rode esta carga de uma máquina no Brasil e copie a tabela EmendaMunicipal para o servidor.");
        return html;
      }
      ultimo = new Error(`HTTP ${r.status} em ${url}`);
    } catch (e) {
      ultimo = e;
    }
    await espera(3000 * tentativa);
  }
  throw ultimo instanceof Error ? ultimo : new Error(String(ultimo));
}

/** O exercício que a emenda altera, pelo número do projeto no título (projeto de 2025 = LOA de 2026). */
const exercicioDoTitulo = (titulo: string) => {
  const m = /PROJETO DE LEI(?: DO)? EXECUTIVO N[º°o]?\s*\d{1,4}\/(\d{4})/i.exec(titulo);
  return m ? Number(m[1]) + 1 : null;
};

export interface ResultadoEmendasMunicipais {
  paginas: number;
  novas: number;
  atualizadas: number;
  semMudanca: number;
  porExercicio: Map<number, { quantidade: number; valor: number }>;
}

export async function carregarEmendasMunicipais(opcoes: { desde?: number; tudo?: boolean } = {}): Promise<ResultadoEmendasMunicipais> {
  const r: ResultadoEmendasMunicipais = { paginas: 0, novas: 0, atualizadas: 0, semMudanca: 0, porExercicio: new Map() };
  const gravadas = new Map((await prisma.emendaMunicipal.findMany({ select: { idExterno: true, situacao: true } })).map((e) => [e.idExterno, e.situacao]));
  const vistos = new Set<number>();

  for (let pagina = 1; pagina <= 200; pagina++) {
    const itens: ItemDaLista[] = itensDaLista(await baixar(`${BASE}/proposicoes/Emendas-Impositivas/0/${pagina}/0`)).filter((i) => !vistos.has(i.idExterno));
    r.paginas = pagina;
    if (itens.length === 0) break;
    let antigas = 0;
    for (const item of itens) {
      vistos.add(item.idExterno);
      const exercicioPrevisto = exercicioDoTitulo(item.titulo);
      if (opcoes.desde && exercicioPrevisto !== null && exercicioPrevisto < opcoes.desde) {
        antigas++;
        continue;
      }
      if (!opcoes.tudo && gravadas.has(item.idExterno) && gravadas.get(item.idExterno) === item.situacao) {
        r.semMudanca++;
        continue;
      }
      const url = `${BASE}/proposicoes/0/0/1/0/${item.idExterno}`;
      const d = detalheDaEmenda(await baixar(url), item.titulo);
      await espera(400);
      const exercicio = d.exercicio ?? exercicioPrevisto ?? (item.data ? item.data.getUTCFullYear() + 1 : 0);
      const dados = {
        municipio: "VENANCIO_AIRES",
        exercicio,
        numero: d.numero.slice(0, 20),
        tipo: d.tipo,
        tipoDetalhe: d.tipoDetalhe?.slice(0, 100) ?? null,
        projetoDeLei: d.projetoDeLei?.slice(0, 20) ?? null,
        autoria: (d.autoria ?? item.autoria).slice(0, 200),
        vereador: d.vereador?.slice(0, 200) ?? (d.tipo === "Individual" ? item.autoria.slice(0, 200) : null),
        partido: d.partido?.slice(0, 30) ?? null,
        beneficiario: d.beneficiario?.slice(0, 300) ?? null,
        orgao: d.orgao?.slice(0, 200) ?? null,
        programa: d.programa?.slice(0, 200) ?? null,
        acao: d.acao?.slice(0, 300) ?? null,
        fonteRecurso: d.fonteRecurso?.slice(0, 200) ?? null,
        valor: d.valor,
        objeto: item.objeto || item.titulo,
        justificativa: d.justificativa,
        situacao: item.situacao?.slice(0, 500) ?? null,
        apresentadaEm: item.data,
        citaIfsul: d.citaIfsul || /\bIFSUL\b|INSTITUTO FEDERAL/i.test(item.objeto),
        url,
        fonte: "Câmara Municipal de Venâncio Aires, Emendas Impositivas (venancioaires.rs.leg.br)",
      };
      if (gravadas.has(item.idExterno)) r.atualizadas++;
      else r.novas++;
      await prisma.emendaMunicipal.upsert({ where: { idExterno: item.idExterno }, create: { idExterno: item.idExterno, ...dados }, update: dados });
    }
    // A lista vem da mais nova para a mais antiga: uma página inteira de emendas antigas encerra a busca.
    if (opcoes.desde && antigas === itens.length) break;
    await espera(400);
  }

  for (const e of await prisma.emendaMunicipal.groupBy({ by: ["exercicio"], _count: true, _sum: { valor: true } })) {
    r.porExercicio.set(e.exercicio, { quantidade: e._count, valor: Number(e._sum.valor ?? 0) });
  }
  return r;
}
