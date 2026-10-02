# O que realmente precisa ficar no sistema e no banco de dados

Levantamento de 2026-10-01, feito sobre o banco de produção (`matriz2_prod`), a máquina virtual e o repositório. Nada foi apagado: este relatório só propõe, e cada decisão que mexe em produção fica com você.

## Resumo

- O banco de produção tem **4,0 GB**. **Quase 80% (3,2 GB) são só duas tabelas**: os painéis de ensino e pessoal da PNP (2,2 GB) e o painel orçamentário da PNP (0,9 GB). As telas "PNP: ensino e pessoal" e "PNP: orçamento" usam essas duas, então elas ficam.
- O que realmente faz a matriz funcionar (usuários, fontes, instituições, câmpus, ciclos, valores por curso, conferência, pesos) ocupa **menos de 100 MB**. Isso é o núcleo e não se mexe.
- Há **cerca de 0,8 GB carregado que nenhuma tela mostra**: o Extrator da PNP (280 MB), os microdados de matrículas por ciclo de curso (335 MB), o microdado por aluno da 2ª fase (180 MB) e o de servidores e financeiro (27 MB). Parte é base da análise de calcular a matriz pela PNP (vale manter), parte é candidata a sair.
- Fora do banco atual, há **um banco antigo de 0,8 GB** (`matriz_prod`, do Matriz antigo parado) e **8,4 GB de cache de construção do Docker** que podem ser limpos sem risco.

## 1. O núcleo: manter sempre (menos de 100 MB)

| Grupo | Tabelas | Para que serve |
|---|---|---|
| Acesso | Usuario, Sessao, CodigoVerificacao, RegistroAuditoria | Login, sessão, recuperação de senha e registro de quem fez o quê. |
| Cadastro | FonteDados, Instituicao, Unidade, CicloOrcamento | De onde veio cada número, as 42 instituições, os câmpus e os parâmetros de cada ciclo. |
| Valores da matriz | DistribuicaoCiclo (35 MB), DistribuicaoCampus, DistribuicaoInstituicao, ComparativoInstitucional, ConferenciaExtracao, ValorRecebidoCampus | O que cada curso, câmpus e instituição recebe, o comparativo entre ciclos e os valores informados. |
| Regras | ParametrosParticipacao, PesoEfetivoCurso (2 MB) | Parâmetros da fórmula e a tabela de peso efetivo, com a fonte de cada linha. |

Todas são lidas por telas ou pela conferência. Não há nada aqui que sobre.

## 2. Os painéis da PNP: usados, mas são o grosso do banco

| Tabela | Tamanho | Linhas | Usada por |
|---|---|---|---|
| PnpFato (ensino e pessoal) | 2,2 GB | cerca de 7,2 milhões | Tela "PNP: ensino e pessoal" |
| PnpOrcamentoFato | 0,9 GB | cerca de 2,3 milhões | Tela "PNP: orçamento" |

O que pesa, por assunto:

- **Situação de Matrícula** tem 2,4 milhões de linhas, um terço do painel de ensino. É onde estão as aberturas por curso, carga horária e modalidade, câmpus a câmpus.
- **Reserva de Vagas** (0,66 milhão), **Eficiência Acadêmica** (0,56 milhão) e **Matrículas por Professor** (0,36 milhão) vêm em seguida.
- No orçamento, as cinco subabas de "Explorar Dados" (Exercício e RP, Execução, Descentralizações, Restos a Pagar e Programação) respondem por quase tudo.

**A edição 2026 da PNP repete o ano-base 2024 da edição 2027.** Conferi no banco: as linhas em comum são idênticas (97% no ensino e no pessoal, só com rótulos renomeados nas demais; 100% no orçamento). Ela soma cerca de 0,92 milhão de linhas (em torno de 12% dos painéis). Foi carregada a seu pedido e serve de prova de que a PNP não revisou o 2024. Se um dia faltar espaço, é a primeira a sair dos painéis, porque os arquivos continuam em disco e recarregam com um comando.

**Recomendação:** manter os dois painéis como estão. Só se o espaço apertar vale cortar as aberturas mais finas de "Situação de Matrícula" ou as subabas de execução orçamentária que ninguém consulta.

## 3. Carregado, mas nenhuma tela usa

Estas tabelas só aparecem na contagem de "Dados importados". Quem as lê são os scripts de análise.

| Tabela | Tamanho | O que é | Recomendação |
|---|---|---|---|
| PnpMicrodadoCiclo | 335 MB | Matrículas agregadas por ciclo de curso, de 2017 a 2025 | **Manter.** É a base de calcular a Matrícula Total pela PNP (reconstrói 99,6% dos ciclos). Sem ela, o plano de reduzir a dependência da MDO morre. |
| PnpMicrodadoServidor e PnpMicrodadoFinanceiro | 27 MB | Servidores agrupados e financeiro somado | **Manter.** Pequenas, e entram nos blocos de Reitorias e Assistência. |
| PnpExtratorFato | 280 MB | As tabelas planas do "Extrator" da PNP (percentuais legais, evasão, reserva de vagas, orçamento e outras), mesmo assunto dos painéis em outro formato | **Candidata nº 1 a sair da produção.** Nenhuma tela a usa, e os CSVs continuam em disco para recarregar quando houver tela. |
| ConferenciaExtracaoAluno | 180 MB | Dado individual de cada aluno (2ª fase do IFSul) | **Candidata a sair da produção.** É dado por pessoa, sem tela, e o risco (LGPD) supera o uso. Já existe um teste que impede expor isso, mas dado que não é lido não precisa ficar no servidor. Manter só no computador de quem audita. |
| ConferenciaCiclo e IndicadoresPnpInstituicao | cerca de 2 MB | 2ª fase por ciclo e indicadores da PNP por instituição | **Manter.** Pequenas e usadas na conferência com a PNP. |

Se as duas candidatas saírem, o banco cai de 4,0 GB para cerca de 3,5 GB, e o MySQL fica mais leve para cargas futuras (foi a memória dele que inflou e exigiu quatro reinícios na carga dos painéis).

## 4. Fora do banco atual

- **`matriz_prod` (0,8 GB)**: banco do Matriz antigo, que está parado. Guardado como rede de segurança desde a virada. Como ninguém usa o Matriz antigo (não há usuário real em nenhum dos dois), a proposta é **gerar um arquivo de cópia (dump) compactado, guardá-lo fora da máquina virtual e remover o banco** quando você se sentir seguro com o novo.
- **Cache de construção do Docker (10,7 GB, dos quais 8,4 GB recuperáveis)**: lixo de compilações antigas. Limpar (`docker builder prune`) não afeta nenhum site. O disco está em 65% (47 GB de 72 GB), então não é urgente.
- **Arquivos originais em disco (`/opt/matriz-dados`, 2 GB)**: **manter**. São os CSVs que permitem recarregar qualquer tabela acima.
- **Registros de carga em `/root` (alguns KB cada)**: podem ser apagados quando quiser, sem efeito.

## 5. No repositório

- **A raiz do repositório ainda tem o Matriz antigo** (cerca de 145 arquivos em `src`, mais `prisma`, `tests` e `docker`), e a pasta `matriz2` é o sistema que está no ar. Enquanto o antigo ficar como rede de segurança, vale manter; quando o banco antigo for removido, o código antigo perde a razão de existir.
- **15 scripts de análise** (`matriz2/scripts/_analise_*.ts`): são exploratórios, não fazem parte do sistema. Os de resíduos, peso e reconstrução (cinco de resíduo, três de peso, dois de reconstrução, mais o de carga horária) já cumpriram o papel e estão documentados em `docs/calculo-da-matriz-a-partir-da-pnp.md`. Podem ir para uma pasta `scripts/analises` ou ser apagados, mantendo só os três de edições da PNP e o de microdados.
- **`docs/pnp-matriz`**: manter. São os valores de referência (planilhas oficiais da CONIF) contra os quais o cálculo é conferido.

## 6. Telas

Nada a cortar agora. O menu foi reorganizado em quatro grupos (Consultar, Simular, Conferir, Dados), e cada tela tem uma frase dizendo o que faz. "Perda por evasão" e "Consulta" têm estrutura parecida (instituição, câmpus, curso), mas respondem perguntas diferentes (quanto se recebe e quanto se perde), então não vale juntá-las.

## O que eu faria, em ordem

1. **Agora, sem risco:** limpar o cache do Docker (recupera 8,4 GB).
2. **Quando você decidir:** tirar `ConferenciaExtracaoAluno` e `PnpExtratorFato` da produção (cerca de 0,5 GB, e reduz o risco de dado pessoal no servidor).
3. **Quando se sentir seguro com o novo sistema:** dump do `matriz_prod` e remoção do banco antigo.
4. **Só se o espaço apertar:** cortar a edição 2026 dos painéis (12%) e as aberturas mais finas de "Situação de Matrícula".
5. **Nunca:** os microdados por ciclo (`PnpMicrodadoCiclo`) e a tabela de peso efetivo, que são a base de calcular a matriz sem depender da MDO.
