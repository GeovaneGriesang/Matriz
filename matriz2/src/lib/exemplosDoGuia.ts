import { GRUPOS_MENU, visivelNaPreConfiguracao } from "@/lib/menu";

/**
 * Os exemplos do Guia das telas, com números reais de Venâncio Aires e do IFSul. A busca está em `server/queries/exemplosDoGuia.ts`; aqui só se monta
 * o texto, para o teste poder conferir que toda ficha tem exemplo. Um dado que falta no banco tira o exemplo daquela ficha, sem inventar número.
 */

export interface DadosDosExemplos {
  ano: number;
  rede: { referencia: number; assistencia: number; funcionamento: number } | null;
  /** Funcionamento de Venâncio Aires pela matriz, no ciclo e no anterior. */
  matriz: number | null;
  matrizAnterior: number | null;
  /** O que o câmpus recebeu no ciclo anterior, informado em Valores recebidos: a base da proposta da Reitoria. */
  recebidoAnterior: number | null;
  /** O que o câmpus recebe no ciclo, informado em Valores recebidos (em 2027, o total da proposta da Reitoria). */
  recebidoAtual: number | null;
  turmas: { quantidade: number; somaValor: number; somaPerda: number; retidas: number; valorRetidas: number } | null;
  /** A turma de maior valor do câmpus, entre as que pegam o ano-base. */
  turma: { curso: string; alunos: number; valor: number; peso: number; chMatriz: number; valorMatricula: number } | null;
  /** Um curso de Venâncio Aires que também existe em outro câmpus do IFSul: a turma de maior valor de cada um. */
  outroCampus: { curso: string; valorAqui: number; campus: string; valor: number } | null;
  /** A turma de término mais distante do câmpus. */
  ultimaTurma: { curso: string; termino: string } | null;
  ciclosDaQuartaFase: number | null;
  ifsul: { eficiencia: number | null; rap: number | null } | null;
  arquivosImportados: number | null;
  loa: { exercicio: number; valor: number } | null;
  pnp: { anoBase: number; matriculas: number } | null;
  pnpOrcamento: { anoBase: number; empenhado: number; acao: string } | null;
  confianca: { conferidos: number; atencao: number; estimados: number };
  usuarios: number | null;
  registrosDeAuditoria: number | null;
}

const reais = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dec = (n: number, casas = 2) => n.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
const int = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
const pct = (n: number, casas = 2) => `${dec(n * 100, casas)}%`;
const dia = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { timeZone: "UTC" });
const sinal = (n: number) => `${n >= 0 ? "+" : "-"}${reais(Math.abs(n))}`;

const VA = "Venâncio Aires";

export function montarExemplos(d: DadosDosExemplos): Record<string, string> {
  const { ano, matriz, matrizAnterior, recebidoAnterior, recebidoAtual, turmas, turma, outroCampus, ultimaTurma, ifsul, loa, pnp, pnpOrcamento, rede } = d;
  const anoBase = ano - 2;
  const e: Record<string, string> = {};

  if (turmas) e["/"] = `A matriz de ${ano} tem ${int(turmas.quantidade)} turmas de ${VA} que geram valor, com alunos do ano-base ${anoBase}.`;
  if (rede) {
    e["/como-funciona"] = `Em ${ano}, a referência da Rede é ${reais(rede.referencia)}. Saem ${reais(rede.assistencia)} de Assistência Estudantil, e o bloco Funcionamento fica com ${reais(rede.funcionamento)}.`;
  }
  if (outroCampus) {
    e["/consulta/comparar"] = `${outroCampus.curso}: a turma de maior valor de ${VA} gera ${reais(outroCampus.valorAqui)} em ${ano}, e a de maior valor em ${outroCampus.campus} gera ${reais(outroCampus.valor)}.`;
  }
  if (matriz !== null && matrizAnterior !== null) {
    e["/comparativo"] = `No bloco Funcionamento, ${VA} passa de ${reais(matrizAnterior)} em ${ano - 1} para ${reais(matriz)} em ${ano}: ${sinal(matriz - matrizAnterior)}.`;
  }
  if (d.ciclosDaQuartaFase !== null) e["/conferencia/quarta-fase"] = `São ${int(d.ciclosDaQuartaFase)} ciclos do IFSul na planilha, cada um refeito coluna a coluna ao lado do que o arquivo traz.`;
  if (turma && turma.alunos > 0) {
    e["/consulta/valor-do-aluno"] = `${turma.curso}, em ${VA}: ${reais(turma.valor)} ÷ ${int(turma.alunos)} alunos = ${reais(turma.valor / turma.alunos)} por aluno, em ${ano}.`;
  }
  if (matriz !== null) {
    e["/consulta"] = `${VA} recebe ${reais(matriz)} de Funcionamento em ${ano}.${turmas && turmas.retidas > 0 ? ` Desse valor, ${reais(turmas.valorRetidas)} vêm de ${int(turmas.retidas)} turmas já encerradas, com alunos retidos.` : ""}`;
  }
  if (turma) {
    const matriculas = turma.peso * (turma.chMatriz / 800);
    e["/consulta/curso"] = `${turma.curso}: peso ${dec(turma.peso)} × (${int(turma.chMatriz)} h ÷ 800) = ${dec(matriculas)} matrículas por aluno. × ${reais(turma.valorMatricula)} = ${reais(matriculas * turma.valorMatricula)} por um aluno que faz o curso inteiro.`;
  }
  if (ultimaTurma) {
    e["/simulador/projecao"] = `Em ${VA}, uma turma de ${ultimaTurma.curso} termina em ${dia(ultimaTurma.termino)}. Até lá, ela segue contando na matriz de cada ano, conforme os alunos que permanecem.`;
  }
  if (recebidoAnterior !== null && recebidoAtual !== null) {
    e["/simulador/distribuicao"] = `${VA} recebeu ${reais(recebidoAnterior)} em ${ano - 1}. Na proposta oficial da Reitoria, recebe ${reais(recebidoAtual)} em ${ano}: ${sinal(recebidoAtual - recebidoAnterior)}.`;
  }
  if (turmas) {
    e["/simulador/alternativas"] = `${VA} perde ${reais(turmas.somaPerda)} com a evasão em ${ano}. Reduzir essa perda pela metade recuperaria cerca de ${reais(turmas.somaPerda / 2)} por ano.`;
    if (turmas.somaValor > 0) e["/evasao"] = `${VA} perde ${reais(turmas.somaPerda)} sobre ${reais(turmas.somaValor)} recebidos em ${ano}: ${pct(turmas.somaPerda / turmas.somaValor)}.`;
  }
  if (ifsul && ifsul.eficiencia !== null && ifsul.rap !== null) {
    e["/conferencia"] = `Para o IFSul em ${ano}, a MDO publicou eficiência acadêmica de ${pct(ifsul.eficiencia)} e RAP presencial de ${dec(ifsul.rap)}. A tela compara os blocos calculados a partir desses componentes.`;
  }
  if (d.arquivosImportados !== null) e["/dados-importados"] = `Hoje há ${int(d.arquivosImportados)} arquivos importados registrados no sistema, cada um com fonte e data.`;
  if (loa) e["/orcamento-da-uniao"] = `A LOA de ${loa.exercicio} traz ${reais(loa.valor)} para o IFSul, somando todas as ações e fontes de recurso.`;
  if (turma) e["/peso-efetivo"] = `${turma.curso}, em ${VA}: a MDO aplicou peso ${dec(turma.peso)}. Cada aluno conta ${dec(turma.peso)} vez o aluno de peso 1,00.`;
  if (pnp) e["/pnp"] = `No ano-base ${pnp.anoBase}, a PNP registra ${int(pnp.matriculas)} matrículas no IFSul, somando os eixos tecnológicos.`;
  if (pnpOrcamento) e["/pnp/orcamento"] = `No ano-base ${pnpOrcamento.anoBase}, a PNP registra ${reais(pnpOrcamento.empenhado)} de despesa empenhada pelo IFSul na ação ${pnpOrcamento.acao}, na relação de órgão UO.`;
  e["/situacao-dos-dados"] = `Hoje a tela lista ${d.confianca.conferidos} itens conferidos, ${d.confianca.atencao} em atenção e ${d.confianca.estimados} estimados.`;

  if (rede) e["/admin/orcamento"] = `Um dos parâmetros de ${ano} é o valor de referência da Rede: ${reais(rede.referencia)}.`;
  if (recebidoAnterior !== null) e["/admin/valores-recebidos"] = `${VA} tem ${reais(recebidoAnterior)} informados para ${ano - 1}.`;
  if (d.usuarios !== null) e["/admin/usuarios"] = `Hoje o sistema tem ${int(d.usuarios)} ${d.usuarios === 1 ? "conta ativa" : "contas ativas"}.`;
  const telas = GRUPOS_MENU.flatMap((g) => g.itens);
  e["/admin/telas-por-perfil"] = `Na pré-configuração, o perfil Padrão vê ${int(telas.filter((t) => visivelNaPreConfiguracao(t, "PADRAO")).length)} das ${int(telas.length)} telas do menu, e o Administrador vê todas.`;
  if (d.registrosDeAuditoria !== null) e["/admin/auditoria"] = `Hoje há ${int(d.registrosDeAuditoria)} ${d.registrosDeAuditoria === 1 ? "ação registrada" : "ações registradas"}.`;
  return e;
}
