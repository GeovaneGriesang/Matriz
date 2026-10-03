/**
 * Carga dos dados oficiais da MDO para dentro do Matriz2.
 *
 * Uso:
 *   npm run carregar -- 2027            carrega tudo que existir do ciclo 2027
 *   npm run carregar -- 2027 2026       carrega os dois ciclos
 *   npm run carregar -- 2027 --so=proposta   recarrega só a 5ª fase (Completo proposta) do ciclo
 *
 * Este script é a única porta de entrada de dado no sistema, e roda a partir do
 * repositório, versionado. Não existe importador na tela por enquanto: os arquivos
 * chegam prontos da MDO e o que precisamos é rastreabilidade, não upload.
 */
import { prisma } from "../src/server/db/prisma";
import { carregarParticipacao } from "../src/carga/carregarParticipacao";
import { carregarProposta } from "../src/carga/carregarProposta";
import { carregarExpansaoPiso } from "../src/carga/carregarExpansaoPiso";
import { carregarComparativo } from "../src/carga/carregarComparativo";
import { carregarConferencia } from "../src/carga/carregarConferencia";
import { carregarConferenciaAluno } from "../src/carga/carregarConferenciaAluno";
import { carregarConferenciaCiclos } from "../src/carga/carregarConferenciaCiclos";
import { carregarParticipacaoInstituicao } from "../src/carga/carregarParticipacaoInstituicao";
import { existe, planilhaParticipacao, planilhaProposta, relatorioIndicadores } from "../src/carga/caminhos";
import { ANO_MINIMO_SISTEMA, anoDentroDoEscopo } from "../src/lib/escopoTemporal";

const reais = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const inteiro = new Intl.NumberFormat("pt-BR");

async function carregarCiclo(ano: number, soProposta: boolean) {
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

  // Correção pontual: câmpus novos da aba EXPANSÃO do arquivo OFICIAL (não a fonte
  // alternativa), que já vêm com o Piso Mínimo definido mesmo quando a matrícula
  // por câmpus da exportação principal saiu zerada. Ver `carregarExpansaoPiso.ts`.
  const exp = await carregarExpansaoPiso(ano);
  if (exp) {
    console.log(`  Correção do Piso Mínimo (aba EXPANSÃO, arquivo oficial)...`);
    console.log(`     ${exp.total} câmpus na lista, ${exp.jaExistiam} já cadastrados, ${exp.criados} novos`);
    for (const a of exp.avisos) console.log(`     AVISO: ${a}`);
  }

  // `--so=proposta`: recarrega só a 5ª fase (e a correção do Piso), sem tocar na 6ª fase nem na 2ª. Serve quando a MDO reexporta só a 5ª.
  if (soProposta) {
    console.log("  (só a 5ª fase, como pedido: 2ª e 6ª fases não foram tocadas)");
    return;
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
    for (const p of r.arquivosPulados) {
      console.log(`     AVISO: ${p} é mais novo, mas tem outro layout (não é por ciclo de curso) e foi pulado.`);
    }
  }

  // 6ª fase de UMA instituição (formato com fórmulas, exportado a partir de 2026-09-29).
  // Vem DEPOIS da 6ª fase da rede: ela só substitui o que é da instituição, e a da rede
  // apaga o ciclo inteiro ao recarregar.
  const pi = await carregarParticipacaoInstituicao(ano, "IFSUL");
  if (!pi) {
    console.log(`  6ª fase, IFSul (formato com fórmulas): sem arquivo para ${ano}, pulando.`);
  } else {
    console.log(`  6ª fase, IFSul (formato com fórmulas, refeito pelo motor de cálculo)...`);
    console.log(`     ${inteiro.format(pi.ciclos)} ciclos, ${pi.campus} câmpus`);
    console.log(`     valor da matrícula presencial .... ${reais.format(pi.valorMatricula.PRESENCIAL)}`);
    console.log(`     soma de Matrícula Total .......... ${inteiro.format(pi.somaMatriculaTotal)}`);
    console.log(`     soma de Valor (R$) ............... ${reais.format(pi.somaValor)}`);
    console.log(`     soma de Custo Evadido ............ ${reais.format(pi.somaPerdaEvasao)}`);
    if (pi.ignoradas > 0) console.log(`     ${pi.ignoradas} linha(s) ignorada(s)`);
    for (const a of pi.avisos) console.log(`     AVISO: ${a}`);
  }

  // 2ª fase por ciclo de curso: liga-se à 6ª fase pelo código do ciclo, então roda depois dela.
  const cc = await carregarConferenciaCiclos(ano, "IFSUL");
  if (!cc) {
    console.log(`  2ª fase (Conferência da Extração, por ciclo): sem arquivo do IFSul para ${ano}, pulando.`);
  } else {
    console.log(`  2ª fase (Conferência da Extração, por ciclo, IFSul)...`);
    console.log(`     ${cc.arquivo}`);
    console.log(`     ${inteiro.format(cc.ciclos)} ciclos, ${cc.campus} câmpus, ${inteiro.format(cc.somaQtdMatriculas)} matrículas, ${cc.indicadores} instituições nos indicadores`);
    for (const a of cc.avisos) console.log(`     AVISO: ${a}`);
  }
}

async function main() {
  const argumentos = process.argv.slice(2).map(Number);
  const anos = argumentos.filter(anoDentroDoEscopo);
  const foraDoEscopo = argumentos.filter((n) => Number.isInteger(n) && !anoDentroDoEscopo(n));
  for (const n of foraDoEscopo) {
    console.error(`Ciclo ${n} ignorado: este sistema controla os ciclos a partir de ${ANO_MINIMO_SISTEMA}.`);
  }
  if (anos.length === 0) {
    console.error("Informe ao menos um ciclo. Exemplo: npm run carregar -- 2027");
    process.exit(1);
  }
  const soProposta = process.argv.includes("--so=proposta");
  for (const ano of anos) {
    await carregarCiclo(ano, soProposta);
  }
  if (soProposta) {
    await prisma.$disconnect();
    console.log("\nCarga concluída.\n");
    return;
  }

  // Relatórios de Indicadores: até 2026-08-31 um arquivo cobria os dois ciclos; desde
  // 2026-09-29 há um arquivo por ano, na pasta do próprio ano. O carregador descobre pelo
  // cabeçalho quais ciclos cada arquivo traz, então roda uma vez por ciclo pedido.
  console.log(`
${"=".repeat(72)}
RELATORIOS DE INDICADORES
${"=".repeat(72)}`);
  for (const ano of anos) {
    if (!existe(relatorioIndicadores(ano, "comparativo-institucional.xlsx"))) {
      console.log(`  pasta "03 - Indicadores/${ano}" sem o comparativo institucional, pulando.`);
      continue;
    }
    const c = await carregarComparativo(ano);
    console.log(`  ${ano}: ${c.registros} registros, ciclo(s) ${c.anos.join(" e ")}`);
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
