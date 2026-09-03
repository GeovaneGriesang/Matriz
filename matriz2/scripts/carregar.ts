/**
 * Carga dos dados oficiais da MDO para dentro do Matriz2.
 *
 * Uso:
 *   npm run carregar -- 2027            carrega tudo que existir do ciclo 2027
 *   npm run carregar -- 2027 2026       carrega os dois ciclos
 *
 * Este script é a única porta de entrada de dado no sistema, e roda a partir do
 * repositório, versionado. Não existe importador na tela por enquanto: os arquivos
 * chegam prontos da MDO e o que precisamos é rastreabilidade, não upload.
 */
import { prisma } from "../src/server/db/prisma";
import { carregarParticipacao } from "../src/carga/carregarParticipacao";
import { carregarProposta } from "../src/carga/carregarProposta";
import { carregarComparativo } from "../src/carga/carregarComparativo";
import { carregarConferencia } from "../src/carga/carregarConferencia";
import { carregarConferenciaAluno } from "../src/carga/carregarConferenciaAluno";
import { existe, planilhaParticipacao, planilhaProposta, relatorioIndicadores } from "../src/carga/caminhos";

const reais = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const inteiro = new Intl.NumberFormat("pt-BR");

async function carregarCiclo(ano: number) {
  console.log(`\n${"=".repeat(72)}\nCICLO ${ano}\n${"=".repeat(72)}`);

  // A 5ª fase vem primeiro: é ela que traz a UF das instituições, o tipo de cada
  // unidade e o ano de criação dos câmpus. A 6ª fase, se rodar antes, cria as
  // instituições sem UF.
  if (!existe(planilhaProposta(ano))) {
    console.log(`  5ª fase (Completo proposta): arquivo não existe para ${ano}, pulando.`);
  } else {
    console.log(`  5ª fase (Completo proposta)...`);
    const p = await carregarProposta(ano);
    console.log(`     ${p.instituicoes} instituições, ${inteiro.format(p.campus)} câmpus, ${p.reitorias} reitorias`);
    console.log(`     câmpus elegíveis ao Piso Mínimo ... ${p.elegiveisPiso}`);
    console.log(`     Funcionamento somado por câmpus ... ${reais.format(p.somaVlMatr)}`);
    console.log(`     Funcionamento declarado (80%) ..... ${reais.format(p.funcionamentoTotalDeclarado)}`);
    console.log(`     Piso reservado do bloco ........... ${reais.format(p.pisoTotalDeclarado)}`);
    console.log(`     Assistência somada por câmpus ..... ${reais.format(p.somaAssistencia)}`);
    for (const a of p.avisos) console.log(`     AVISO: ${a}`);
  }

  // 2ª fase: só existe para o IFSul. Depende da 5ª, que cria as unidades.
  const conf = await carregarConferencia(ano, "IFSUL");
  if (!conf) {
    console.log(`  2ª fase (Conferência da Extração): sem arquivo do IFSul para ${ano}, pulando.`);
  } else {
    console.log(`  2ª fase (Conferência da Extração, IFSul)...`);
    console.log(`     ${conf.campus} câmpus | matrícula Matriz ${inteiro.format(conf.somaMatriz)} | evasão ${inteiro.format(conf.somaEvasao)}`);
    for (const a of conf.avisos) console.log(`     AVISO: ${a}`);
  }

  // 2ª fase, por aluno: dado pessoal (LGPD), nunca exposto em tela pública — só
  // carregado para auditoria interna. O console mostra apenas contagens agregadas,
  // nunca uma linha individual.
  const confAluno = await carregarConferenciaAluno(ano, "IFSUL");
  if (!confAluno) {
    console.log(`  2ª fase (Conferência da Extração, por aluno): sem arquivo do IFSul para ${ano}, pulando.`);
  } else {
    console.log(`  2ª fase (Conferência da Extração, por aluno, IFSul) [dado pessoal, uso interno]...`);
    console.log(`     ${inteiro.format(confAluno.registros)} registros | ${confAluno.campus} câmpus | ${inteiro.format(confAluno.alunosDistintos)} alunos distintos`);
    for (const a of confAluno.avisos) console.log(`     AVISO: ${a}`);
  }

  if (!existe(planilhaParticipacao(ano))) {
    console.log(`  6ª fase (Participação Orçamentária): arquivo não existe para ${ano}, pulando.`);
    console.log(`     Só o ciclo 2027 tem essa exportação até agora; sem ela não há dado por curso.`);
  } else {
    console.log(`  6ª fase (Participação Orçamentária), lendo em fluxo...`);
    const r = await carregarParticipacao(ano);
    console.log(`     ${inteiro.format(r.ciclos)} ciclos de curso gravados`);
    console.log(`     ${r.instituicoes} instituições, ${r.campus} câmpus`);
    console.log(`     soma de Valor (R$) ....... ${reais.format(r.somaValor)}`);
    console.log(`     soma de Perda Evasão ..... ${reais.format(r.somaPerdaEvasao)}`);
    if (r.ignoradas > 0) console.log(`     ${r.ignoradas} linha(s) ignorada(s)`);
  }
}

async function main() {
  const anos = process.argv.slice(2).map(Number).filter((n) => Number.isInteger(n) && n > 2000);
  if (anos.length === 0) {
    console.error("Informe ao menos um ciclo. Exemplo: npm run carregar -- 2027");
    process.exit(1);
  }
  for (const ano of anos) {
    await carregarCiclo(ano);
  }

  // Os relatórios de Indicadores são interanuais: um arquivo só cobre todos os
  // ciclos, então roda uma vez ao final, a partir da pasta do ano mais recente.
  const maisRecente = Math.max(...anos);
  console.log(`
${"=".repeat(72)}
RELATORIOS DE INDICADORES (interanuais)
${"=".repeat(72)}`);
  if (!existe(relatorioIndicadores(maisRecente, "comparativo-institucional.xlsx"))) {
    console.log(`  pasta "03 - Indicadores/${maisRecente}" sem o comparativo institucional, pulando.`);
  } else {
    const c = await carregarComparativo(maisRecente);
    console.log(`  ${c.registros} registros, ciclos ${c.anos.join(" e ")}`);
    for (const s of c.somaPorAno) {
      console.log(`     ${s.ano}: Funcionamento ${reais.format(s.matriculas)} | IQE ${reais.format(s.iqe)} | Assistencia ${reais.format(s.ae)} | participacao ${s.participacao.toFixed(2)}%`);
    }
    for (const a of c.avisos) console.log(`     AVISO: ${a}`);
  }
  await prisma.$disconnect();
  console.log("\nCarga concluída.\n");
}

main().catch(async (erro) => {
  console.error("\nFalhou:", erro instanceof Error ? erro.message : erro);
  await prisma.$disconnect();
  process.exit(1);
});
