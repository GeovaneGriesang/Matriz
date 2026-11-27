import { describe, expect, it } from "vitest";
import { citaOIfsul, detalheDaEmenda, ehPartido, itensDaLista, textoDoHtml } from "@/lib/orcamento/lerEmendasMunicipais";

const LISTA = `
<div class="pbw_linhatitulo-3">
  <div><span>25/11/2026 10:58</span></div>
  <div><a href="https://www.venancioaires.rs.leg.br/proposicoes/Emendas-Impositivas/0/1/0/37571" onmouseover="Tip('Matéria <strong>em Tramitação</strong>')" onmouseout="UnTip()"><i class="fa fa-spinner"></i>&nbsp;&nbsp;EMENDA IMPOSITIVA À LEI ORÇAMENTÁRIA ANUAL INDIVIDUAL Nº 0004/2026 AO PROJETO DE LEI EXECUTIVO N° 0096/2026</a></div>
</div>
<div class="pbw_materia_conteudo">
  <a href="x" class="pbw_materia_infos"><em>Emenda Impositiva ao Projeto de Lei do Executivo nº 0096/2026. APM EMEI Vó Helma.</em></a>
  <a href="x"><span><strong>Autoria: </strong>Alberto Sausen</span><span><strong>Situação: </strong>25/11/2026 10:59 - Encaminhada para Instrução <em>(Assessoria Jurídica)</em></span></a>
</div>
<div class="pbw_linhatitulo-3">
  <div><span>04/12/2025 15:37</span></div>
  <div><a href="https://www.venancioaires.rs.leg.br/proposicoes/Emendas-Impositivas/0/1/0/34040">EMENDA IMPOSITIVA À LEI ORÇAMENTÁRIA ANUAL DE BANCADA 0299/2025 ao PROJETO DE LEI EXECUTIVO N° 0187/2025</a></div>
</div>
<div class="pbw_materia_conteudo"><em>INCLUI RECURSOS NA EDUCAÇÃO.</em><span><strong>Autoria: </strong>Gilberto dos Santos</span></div>`;

describe("itensDaLista", () => {
  it("lê número, data, título sem a dica do link, objeto, autoria e situação", () => {
    const itens = itensDaLista(LISTA);
    expect(itens.map((i) => i.idExterno)).toEqual([37571, 34040]);
    expect(itens[0]!.titulo).toBe("EMENDA IMPOSITIVA À LEI ORÇAMENTÁRIA ANUAL INDIVIDUAL Nº 0004/2026 AO PROJETO DE LEI EXECUTIVO N° 0096/2026");
    expect(itens[1]!.titulo.startsWith("EMENDA IMPOSITIVA À LEI ORÇAMENTÁRIA ANUAL DE BANCADA 0299/2025")).toBe(true);
    expect(itens[0]!.autoria).toBe("Alberto Sausen");
    expect(itens[0]!.situacao).toContain("Encaminhada para Instrução");
    expect(itens[1]!.situacao).toBeNull();
    expect(itens[0]!.data?.toISOString()).toBe("2026-11-25T13:58:00.000Z");
  });
});

const corpo = (miolo: string) => `<html><nav>Menu IFSul convida para o jantar</nav><p>Emenda: PROJETO DE LEI EXECUTIVO N° 0096/2026 Estima a Receita e Fixa a Despesa do Município para o exercício financeiro de 2027.</p>${miolo}<p>PARECER DA COMISSÃO DE ORÇAMENTO E FINANÇAS</p><footer>Instituto Federal</footer></html>`;

describe("detalheDaEmenda", () => {
  it("lê o formulário atual (desde 2023)", () => {
    const d = detalheDaEmenda(
      corpo(
        "Tipo de Emenda: Individual - Geral Ordem de Prioridade: 11 Autoria: ALBERTO SAUSEN Beneficiário: SECRETARIA DE EDUCAÇÃO CNPJ: Justificativa: Cerca para a APM EMEI Vó Helma. CRÉDITO ORÇAMENTÁRIO Valor da Emenda R$ 19.100,00 Identificação do crédito orçamentário Código Nome Órgão: 05 SECRETARIA DE EDUCAÇÃO Programa: 0008 APRENDER Iniciativa: 085 Reformas Ação: 1014 EQUIPAÇÃO ENSINO FUNDAMENTAL Modalidade de aplicação: 4490 Fonte de Recursos: 0500 RECURSOS NÃO VINCULADOS DE IMPOSTOS CRÉDITO ORÇAMENTÁRIO REDUZIDO PARA COBERTURA DA EMENDA Órgão: 17 RESERVA Vereador Proponente: ALBERTO SAUSEN (PODEMOS)",
      ),
      "EMENDA IMPOSITIVA À LEI ORÇAMENTÁRIA ANUAL INDIVIDUAL Nº 0004/2026 AO PROJETO DE LEI EXECUTIVO N° 0096/2026",
    );
    expect(d).toMatchObject({
      numero: "0004/2026",
      tipo: "Individual",
      projetoDeLei: "0096/2026",
      exercicio: 2027,
      vereador: "ALBERTO SAUSEN",
      partido: "PODEMOS",
      beneficiario: "SECRETARIA DE EDUCAÇÃO",
      orgao: "05 SECRETARIA DE EDUCAÇÃO",
      programa: "0008 APRENDER",
      acao: "1014 EQUIPAÇÃO ENSINO FUNDAMENTAL",
      fonteRecurso: "0500 RECURSOS NÃO VINCULADOS DE IMPOSTOS",
      valor: 19100,
      justificativa: "Cerca para a APM EMEI Vó Helma.",
    });
    // Menu e rodapé da página não contam: só o corpo da emenda.
    expect(d.citaIfsul).toBe(false);
  });

  it("lê o formulário antigo (até 2022), com o valor em 'Emenda ( + )' e o partido na bancada", () => {
    const d = detalheDaEmenda(
      corpo(
        "Tipo de Emenda: Impositiva (Bancada) Ordem de Prioridade: 06 Autoria: Bancada do PDT Beneficiário: Secretaria de Cultura e Esporte Justificativa: Praça modular infantil. EMENDA Valor Aumentado de Dotações R$ 100.000,00 Marcar com um X CRÉDITO ORÇAMENTÁRIO: Órgão: 12 Secretaria de Cultura e Esporte Unidade Orçamentária: 01 Serviços Programa: 0027 Tua Vida Saudável Ação: 1052 Infraestrutura Modalidade de aplicação: 4.4.90 Fonte de Recursos: 001 Recursos Próprios Valores Iniciais: R$ 500,00 Emenda ( + ): R$ 100.000,00",
      ),
      "EMENDA IMPOSITIVA À LEI ORÇAMENTÁRIA ANUAL Nº0181/2021 ao PROJETO DE LEI EXECUTIVO N° 0147/2021",
    );
    expect(d).toMatchObject({
      numero: "0181/2021",
      tipo: "Bancada",
      exercicio: 2022,
      partido: "PDT",
      beneficiario: "Secretaria de Cultura e Esporte",
      orgao: "12 Secretaria de Cultura e Esporte",
      fonteRecurso: "001 Recursos Próprios",
      valor: 100000,
      justificativa: "Praça modular infantil.",
    });
  });

  it("não toma apelido por partido", () => {
    const d = detalheDaEmenda(corpo("Vereador Proponente: ELIGIO WESCHENFELDER (MUCHILA)"), "EMENDA Nº 0010/2023 ao PROJETO DE LEI EXECUTIVO N° 0134/2023");
    expect(d.vereador).toBe("ELIGIO WESCHENFELDER");
    expect(d.partido).toBeNull();
    expect(ehPartido("muchila")).toBe(false);
    expect(ehPartido("Podemos")).toBe(true);
  });
});

describe("textoDoHtml e citaOIfsul", () => {
  it("devolve os acentos das entidades e acha a menção ao IFSul", () => {
    expect(textoDoHtml("Tramita&ccedil;&atilde;o&nbsp;&amp; vota&ccedil;&atilde;o")).toBe("Tramitação & votação");
    expect(citaOIfsul("Convênio com o IFSul câmpus Venâncio Aires")).toBe(true);
    expect(citaOIfsul("Instituto Federal Sul-rio-grandense")).toBe(true);
    expect(citaOIfsul("Escola Estadual")).toBe(false);
  });
});
