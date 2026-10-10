"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { montarCsv, nomeDeArquivo, normalizarCelula } from "@/lib/exportar/csv";
import { PainelSalvos } from "@/components/configuracoes/PainelSalvos";

/**
 * Imprimir, salvar em PDF e baixar CSV em qualquer tela, sem editar página por página.
 *
 * Três níveis, todos pelo mesmo componente (montado uma vez no layout):
 *  1. a página inteira: uma barra no topo (Imprimir / PDF e CSV de todas as tabelas);
 *  2. cada tabela: botões CSV e Imprimir / PDF logo acima dela;
 *  3. cada quadro (as caixas das telas): um botão Imprimir / PDF na borda superior.
 *
 * Os botões de tabela e de quadro são colocados no DOM depois que a página aparece: um observador procura as tabelas (a classe
 * `tabela-rolavel` ou qualquer `<table>`) e os quadros (`<section>` dentro de `<main>`) e refaz a busca quando a tela muda, então
 * telas novas ganham os botões de graça. Imprimir é a impressão do navegador, e "Salvar como PDF" é uma das destinações dela.
 * Imprimir um bloco só copia o bloco para uma área própria e imprime essa área; o resto da página fica de fora.
 */

const BOTAO =
  "rounded border border-neutral-300 bg-white px-2 py-0.5 text-xs font-medium text-neutral-700 hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800";

function textoDaCelula(cel: HTMLTableCellElement): string {
  const campo = cel.querySelector("input, select");
  if (campo instanceof HTMLSelectElement) return campo.selectedOptions[0]?.text ?? "";
  if (campo instanceof HTMLInputElement) return campo.type === "checkbox" ? (campo.checked ? "sim" : "não") : campo.value;
  // Os pedaços de texto de elementos diferentes são separados por espaço ("2027" e "hoje" não viram "2027hoje").
  const partes: string[] = [];
  const andador = document.createTreeWalker(cel, NodeFilter.SHOW_TEXT);
  while (andador.nextNode()) partes.push(andador.currentNode.textContent ?? "");
  return partes.join(" ");
}

/** As linhas da tabela como texto, com as células mescladas (colunas e linhas) espalhadas: a célula grande fica na primeira posição e as outras ficam vazias. */
function extrairLinhas(tabela: HTMLTableElement): string[][] {
  const grade: Array<Array<string | undefined>> = [];
  Array.from(tabela.rows).forEach((tr, r) => {
    const linha = (grade[r] ??= []);
    let c = 0;
    for (const cel of Array.from(tr.cells)) {
      while (linha[c] !== undefined) c++;
      const texto = normalizarCelula(textoDaCelula(cel));
      for (let i = 0; i < Math.max(1, cel.rowSpan); i++) {
        const destino = (grade[r + i] ??= []);
        for (let j = 0; j < Math.max(1, cel.colSpan); j++) destino[c + j] = i === 0 && j === 0 ? texto : "";
      }
      c += Math.max(1, cel.colSpan);
    }
  });
  return grade.map((l) => Array.from(l, (v) => v ?? ""));
}

/** O título de um bloco: o cabeçalho do quadro que o contém, o cabeçalho que vem antes dele, ou o título da página. */
function tituloDe(alvo: Element): string {
  const quadro = alvo.closest("section, details");
  const dentro = quadro?.querySelector("h2, h3, summary");
  if (dentro?.textContent?.trim()) return dentro.textContent.trim();
  const principal = document.querySelector("main");
  let no: Element | null = alvo;
  while (no && no !== principal) {
    let irmao = no.previousElementSibling;
    while (irmao) {
      const cab = irmao.matches("h1, h2, h3, summary") ? irmao : irmao.querySelector("h1, h2, h3, summary");
      if (cab?.textContent?.trim()) return cab.textContent.trim();
      irmao = irmao.previousElementSibling;
    }
    no = no.parentElement;
  }
  return document.querySelector("h1")?.textContent?.trim() || document.title || "tabela";
}

function baixar(nome: string, conteudo: string) {
  const url = URL.createObjectURL(new Blob([conteudo], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function cabecalhoDeImpressao(titulo: string): string {
  const quando = new Date().toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
  return `${titulo}. Impresso em ${quando}. ${location.origin}${location.pathname}`;
}

/** Copia os valores digitados (campos, listas, caixas de marcar) do original para a cópia, que não os guarda. */
function copiarValores(origem: Element, copia: Element) {
  const a = origem.querySelectorAll("input, select, textarea");
  const b = copia.querySelectorAll("input, select, textarea");
  a.forEach((campo, i) => {
    const destino = b[i];
    if (!destino) return;
    if (campo instanceof HTMLInputElement && destino instanceof HTMLInputElement) {
      destino.value = campo.value;
      destino.checked = campo.checked;
      destino.setAttribute("value", campo.value);
    } else if (campo instanceof HTMLSelectElement && destino instanceof HTMLSelectElement) {
      destino.selectedIndex = campo.selectedIndex;
    } else if (campo instanceof HTMLTextAreaElement && destino instanceof HTMLTextAreaElement) {
      destino.value = campo.value;
    }
  });
}

/** Imprime a página inteira (alvo nulo) ou só um bloco, que é copiado para uma área de impressão. O PDF sai da própria janela de impressão. */
function imprimir(alvo: HTMLElement | null, titulo: string) {
  const escuro = document.documentElement.classList.contains("dark");
  const fechados = Array.from(document.querySelectorAll("details")).filter((d) => !d.open);
  let area: HTMLElement | null = null;
  const cabecalho = document.getElementById("cabecalho-impressao");

  if (escuro) document.documentElement.classList.remove("dark");
  fechados.forEach((d) => (d.open = true));

  if (alvo) {
    area = document.createElement("div");
    area.id = "area-impressao";
    const titulo1 = document.createElement("p");
    titulo1.className = "cabecalho-do-bloco";
    titulo1.textContent = cabecalhoDeImpressao(titulo);
    const copia = alvo.cloneNode(true) as HTMLElement;
    copia.querySelectorAll(".nao-imprimir").forEach((e) => e.remove());
    copiarValores(alvo, copia);
    // O bloco sai com a marca do sistema no alto e o crédito institucional no fim, como a página inteira.
    const topo = document.querySelector("body > header")?.cloneNode(true) as HTMLElement | undefined;
    const rodape = document.querySelector("body > footer")?.cloneNode(true) as HTMLElement | undefined;
    area.append(...[topo, titulo1, copia, rodape].filter((e): e is HTMLElement => Boolean(e)));
    document.body.appendChild(area);
    document.body.setAttribute("data-imprimindo", "bloco");
  } else if (cabecalho) {
    cabecalho.textContent = cabecalhoDeImpressao(titulo);
  }

  const limpar = () => {
    window.removeEventListener("afterprint", limpar);
    area?.remove();
    document.body.removeAttribute("data-imprimindo");
    fechados.forEach((d) => (d.open = false));
    if (escuro) document.documentElement.classList.add("dark");
    if (cabecalho) cabecalho.textContent = "";
  };
  window.addEventListener("afterprint", limpar);
  // As imagens que o navegador só carrega quando chegam à tela (o logotipo do rodapé) são carregadas antes de imprimir.
  document.querySelectorAll<HTMLImageElement>('img[loading="lazy"]').forEach((i) => (i.loading = "eager"));
  setTimeout(() => window.print(), 500);
}

function criarBotao(rotulo: string, dica: string, aoClicar: () => void): HTMLButtonElement {
  const b = document.createElement("button");
  b.type = "button";
  b.textContent = rotulo;
  b.title = dica;
  b.className = BOTAO;
  b.addEventListener("click", aoClicar);
  return b;
}

type ComAlvo = HTMLElement & { __alvo?: Element };

function barraDaTabela(alvo: HTMLElement, tabela: HTMLTableElement) {
  const barra: ComAlvo = document.createElement("div");
  barra.className = "nao-imprimir flex justify-end gap-1.5 pb-1";
  barra.setAttribute("data-barra-de-saida", "1");
  barra.append(
    criarBotao("CSV", "Baixar esta tabela em CSV (abre no Excel)", () => baixar(nomeDeArquivo(tituloDe(alvo)), montarCsv(extrairLinhas(tabela)))),
    criarBotao("Imprimir / PDF", "Imprimir só esta tabela, ou salvar em PDF", () => imprimir(alvo, tituloDe(alvo))),
  );
  barra.__alvo = alvo;
  alvo.insertAdjacentElement("beforebegin", barra);
  // Em coluna com espaçamento (a maioria das telas), a barra encosta na tabela em vez de ficar solta acima dela.
  const pai = alvo.parentElement && getComputedStyle(alvo.parentElement);
  const espaco = pai && (pai.display === "flex" || pai.display === "grid") ? parseFloat(pai.rowGap) || 0 : 0;
  if (espaco > 4) barra.style.marginBottom = `${-(espaco - 4)}px`;
  alvo.setAttribute("data-com-barra", "1");
}

function barraDoQuadro(quadro: HTMLElement) {
  if (getComputedStyle(quadro).position === "static") quadro.style.position = "relative";
  const barra: ComAlvo = document.createElement("div");
  barra.className = "nao-imprimir absolute z-20 flex gap-1.5";
  barra.style.top = "-12px";
  barra.style.right = "12px";
  barra.setAttribute("data-barra-de-saida", "1");
  barra.append(criarBotao("Imprimir / PDF", "Imprimir só este quadro, ou salvar em PDF", () => imprimir(quadro, tituloDe(quadro))));
  barra.__alvo = quadro;
  quadro.appendChild(barra);
  quadro.setAttribute("data-com-barra", "1");
}

/** Procura tabelas e quadros ainda sem botões, tira os botões de blocos que saíram da tela e devolve quantas tabelas há. */
function varrer(): number {
  const principal = document.querySelector("main");
  if (!principal) return 0;

  document.querySelectorAll<ComAlvo>("[data-barra-de-saida]").forEach((b) => {
    if (b.__alvo && !b.__alvo.isConnected) b.remove();
  });

  const tabelas = Array.from(principal.querySelectorAll("table")).filter((t) => !t.closest("[data-sem-ferramentas], .nao-imprimir"));
  for (const t of tabelas) {
    const alvo = (t.closest(".tabela-rolavel") as HTMLElement | null) ?? t;
    if (alvo.hasAttribute("data-com-barra")) continue;
    barraDaTabela(alvo, t);
  }

  const quadros = Array.from(principal.querySelectorAll<HTMLElement>("section")).filter(
    (q) => !q.parentElement?.closest("section") && !q.closest("[data-sem-ferramentas]") && q.offsetHeight > 80,
  );
  for (const q of quadros) {
    if (q.hasAttribute("data-com-barra")) continue;
    barraDoQuadro(q);
  }
  return tabelas.length;
}

/** A página Início e as telas de entrada e de conta: não há o que imprimir nem exportar nelas, e os botões só atrapalhariam. */
const SEM_FERRAMENTAS = [/^\/$/, /^\/admin\/(login|definir-senha|recuperar-senha|conta|inicio)/];

export function FerramentasDeSaida() {
  const pathname = usePathname();
  const [tabelas, setTabelas] = useState(0);
  const semFerramentas = SEM_FERRAMENTAS.some((r) => r.test(pathname));

  useEffect(() => {
    if (semFerramentas) return;
    let espera: ReturnType<typeof setTimeout> | undefined;
    const agendar = () => {
      clearTimeout(espera);
      espera = setTimeout(() => setTabelas(varrer()), 250);
    };
    agendar();
    const observador = new MutationObserver(agendar);
    observador.observe(document.body, { childList: true, subtree: true });
    return () => {
      clearTimeout(espera);
      observador.disconnect();
    };
  }, [pathname, semFerramentas]);

  function csvDaPagina() {
    const principal = document.querySelector("main");
    if (!principal) return;
    const linhas: string[][] = [];
    for (const t of Array.from(principal.querySelectorAll("table")).filter((x) => !x.closest(".nao-imprimir"))) {
      if (linhas.length > 0) linhas.push([]);
      linhas.push([`# ${tituloDe(t)}`]);
      linhas.push(...extrairLinhas(t));
    }
    baixar(nomeDeArquivo(document.querySelector("h1")?.textContent?.trim() || "tabelas"), montarCsv(linhas));
  }

  if (semFerramentas) return null;

  const tituloDaPagina = () => document.querySelector("h1")?.textContent?.trim() || document.title;

  return (
    <>
      <div id="cabecalho-impressao" className="hidden border-b border-neutral-400 px-2 pb-2 text-xs text-neutral-700 print:block" />
      <div className="nao-imprimir mx-auto flex max-w-screen-2xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-6 pt-3 text-xs text-neutral-500 lg:px-12">
        <PainelSalvos />
        <div className="ml-auto flex items-center gap-2">
        <span>Esta página:</span>
        <button type="button" className={BOTAO} onClick={() => imprimir(null, tituloDaPagina())} title="Imprimir a página inteira, ou salvar em PDF (escolha &quot;Salvar como PDF&quot; na janela de impressão)">
          Imprimir / PDF
        </button>
        {tabelas > 0 && (
          <button type="button" className={BOTAO} onClick={csvDaPagina} title="Baixar todas as tabelas desta página em um arquivo CSV (abre no Excel)">
            CSV das tabelas ({tabelas})
          </button>
        )}
        </div>
      </div>
    </>
  );
}
