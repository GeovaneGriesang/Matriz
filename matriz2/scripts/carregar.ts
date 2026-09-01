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
import { existe, planilhaParticipacao, planilhaProposta } from "../src/carga/caminhos";

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
  await prisma.$disconnect();
  console.log("\nCarga concluída.\n");
}

main().catch(async (erro) => {
  console.error("\nFalhou:", erro instanceof Error ? erro.message : erro);
  await prisma.$disconnect();
  process.exit(1);
});
