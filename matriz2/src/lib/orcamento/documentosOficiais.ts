/** Os documentos oficiais do orçamento do Estado do RS e do município de Venâncio Aires, com o endereço de onde cada um foi baixado. */

export interface DocumentoOficial {
  tipo: "PPA" | "LDO" | "PLOA" | "LOA" | "Execução";
  exercicio: string;
  titulo: string;
  url: string;
  formato: string;
}

const RS = "https://admin.planejamento.rs.gov.br/upload/arquivos";

export const DOCUMENTOS_RS: DocumentoOficial[] = [
  { tipo: "PLOA", exercicio: "2027", titulo: "Projeto de lei orçamentária: mensagem do governador", url: `${RS}/202609/15140701-ploa-2027-mensagem.pdf`, formato: "PDF" },
  { tipo: "PLOA", exercicio: "2027", titulo: "Projeto de lei orçamentária: volume I", url: `${RS}/202609/15140747-ploa-2027-volume-i.pdf`, formato: "PDF" },
  { tipo: "PLOA", exercicio: "2027", titulo: "Projeto de lei orçamentária: volume II", url: `${RS}/202609/15140832-ploa-2027-volume-ii.pdf`, formato: "PDF" },
  { tipo: "PLOA", exercicio: "2027", titulo: "Despesa do projeto, linha a linha (usada nesta tela)", url: `${RS}/202609/15140953-ploa-2027-despesas.xlsx`, formato: "Planilha" },
  { tipo: "PLOA", exercicio: "2027", titulo: "Receita do projeto, linha a linha (usada nesta tela)", url: `${RS}/202609/15141037-ploa-2027-receitas.xlsx`, formato: "Planilha" },
  { tipo: "PLOA", exercicio: "2027", titulo: "Orçamento das empresas estatais", url: `${RS}/202609/15140913-ploa-2027-empresas-estatais.pdf`, formato: "PDF" },
  { tipo: "LDO", exercicio: "2027", titulo: "Lei de Diretrizes Orçamentárias", url: `${RS}/202607/22103105-lei-de-diretrizes-orcamentarias-2027.PDF`, formato: "PDF" },
  { tipo: "LOA", exercicio: "2026", titulo: "Lei orçamentária: mensagem", url: `${RS}/202512/17145739-mensagem-ploa-2026.pdf`, formato: "PDF" },
  { tipo: "LOA", exercicio: "2026", titulo: "Lei orçamentária: volume I", url: `${RS}/202512/17150112-volume-i-2026-17-12-2025.pdf`, formato: "PDF" },
  { tipo: "LOA", exercicio: "2026", titulo: "Lei orçamentária: volume II", url: `${RS}/202512/17150151-volumeii-2026-17-12-2025.pdf`, formato: "PDF" },
  { tipo: "Execução", exercicio: "2015 em diante", titulo: "Relatórios bimestrais (RREO) no Tesouro Nacional (usados nesta tela)", url: "https://siconfi.tesouro.gov.br/siconfi/pages/public/consulta_finbra_rreo/finbra_rreo_list.jsf", formato: "Dados abertos" },
];

const PMVA = "https://pmva.com.br/arquivo?link=";
const CAMARA = "https://www.venancioaires.rs.leg.br";

export const DOCUMENTOS_VENANCIO_AIRES: DocumentoOficial[] = [
  { tipo: "PLOA", exercicio: "2027", titulo: "Projeto de Lei nº 96/2026, anexos e emendas, na Câmara de Vereadores", url: `${CAMARA}/proposicoes/0/0/1/0/37523`, formato: "Página com PDFs" },
  { tipo: "LDO", exercicio: "2027", titulo: "Audiência pública da LDO 2027 e as emendas impositivas previstas (notícia da Câmara)", url: `${CAMARA}/imprensa/noticias/0/1/2026/9114`, formato: "Página" },
  { tipo: "LOA", exercicio: "2026", titulo: "Lei nº 7.681/2025, lei orçamentária", url: `${PMVA}60552`, formato: "PDF" },
  { tipo: "LOA", exercicio: "2026", titulo: "Anexos da lei orçamentária (20 demonstrativos)", url: `${PMVA}60553`, formato: "ZIP com PDFs" },
  { tipo: "LDO", exercicio: "2026", titulo: "Lei nº 7.647, diretrizes orçamentárias", url: `${PMVA}59350`, formato: "PDF" },
  { tipo: "LDO", exercicio: "2026", titulo: "Anexos da LDO (metas e riscos fiscais)", url: `${PMVA}59351`, formato: "ZIP com PDFs" },
  { tipo: "PPA", exercicio: "2026 a 2029", titulo: "Lei nº 7.630, plano plurianual", url: `${PMVA}59450`, formato: "PDF" },
  { tipo: "PPA", exercicio: "2026 a 2029", titulo: "Anexos do plano plurianual (programas e metas)", url: `${PMVA}59454`, formato: "ZIP com PDFs" },
  { tipo: "PPA", exercicio: "2026 a 2029", titulo: "Mapa estratégico", url: `${PMVA}59445`, formato: "PDF" },
  { tipo: "LOA", exercicio: "2025", titulo: "Lei nº 7.445/2024, lei orçamentária, e anexos", url: `${PMVA}48218`, formato: "PDF" },
  { tipo: "LOA", exercicio: "2024", titulo: "Lei nº 7.301/2023, lei orçamentária, e anexos", url: `${PMVA}38169`, formato: "PDF" },
  { tipo: "Execução", exercicio: "2015 em diante", titulo: "Relatórios bimestrais (RREO) no Tesouro Nacional (usados nesta tela)", url: "https://siconfi.tesouro.gov.br/siconfi/pages/public/consulta_finbra_rreo/finbra_rreo_list.jsf", formato: "Dados abertos" },
  { tipo: "Execução", exercicio: "todas", titulo: "Emendas impositivas dos vereadores, na Câmara (usadas nesta tela)", url: `${CAMARA}/proposicoes/Emendas-Impositivas`, formato: "Página" },
];
