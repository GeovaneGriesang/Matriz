# Dá para calcular a matriz a partir da PNP?

Análise de 2026-09-30, com os microdados da PNP de 2025 (ciclo orçamentário 2027) contra a 6ª fase publicada pela MDO.

## Resposta curta

**Dá, em grande parte.** Os microdados de matrículas da PNP trazem, para todas as 42 instituições, o que antes só existia na MDO: o ciclo de curso, a carga horária, as datas, a carga horária mínima regulamentada e a situação de cada matrícula. Com isso, a Matrícula Total de um ciclo se reconstrói sem a MDO em **96,7% dos 58.242 ciclos** (a soma erra 0,7%), usando só duas tabelas pequenas de apoio (peso do curso e carga horária mínima do MEC).

O que ainda não se calcula sozinho: o **peso do curso**, a **carga horária mínima do MEC** de alguns cursos e quatro regras de exceção que ainda não decifrei (abaixo).

## O que bate com a MDO (conferido)

| Item | Resultado em 2025 (ciclo 2027) |
|---|---|
| Ciclos da 6ª fase presentes na PNP | 58.242 de 58.242 (100%); a PNP tem ainda 1.191 que a MDO não usa |
| Código do ciclo | igual nas duas fontes |
| Carga horária do ciclo | 58.242 de 58.242 (100%) |
| Data de início do ciclo | 58.242 de 58.242 (100%) |
| Data de término do ciclo | 58.241 de 58.242 |
| IFSul: matrículas | 141.815, igual ao total da 2ª fase (e 2.794 evadidos, igual) |
| IFSul: ciclos | 1.352 de 1.352 |

## Regras que os dados revelaram

1. **Prazo de jubilamento**: término mais 1.095 dias (3 anos) em todos os tipos de curso, e **zero dias** na Qualificação Profissional (FIC). Vale para os 58.242 ciclos.
2. **Quantidade de alunos que a MDO conta** (a coluna "Qtd. Alunos"): as matrículas do ciclo, se o ciclo não está jubilado no início do período da PNP (1º de janeiro do ano-base); senão, zero. Em 50.575 ciclos com aluno a quantidade é exatamente a da PNP; dos 7.667 ciclos zerados, 7.664 estão jubilados.
3. **Carga horária da matriz**: FIC e doutorado usam a do ciclo; Proeja, 2.400 h; integrado, 3.000, 3.100 ou 3.200 h conforme a mínima do MEC (800, 1.000 ou 1.200 h); os demais, a mínima do MEC. Vale para os 58.242 ciclos, **dada a carga horária mínima da MDO**.
4. **Matrícula Total**: a regra de `lib/mdo/matriculaTotal.ts` (alunos, ICQA, peso, bônus de agropecuária, carga horária e dias), que já reproduz ao centavo os 1.352 ciclos do IFSul calculados pelo Excel.

## O que a PNP não entrega

| Lacuna | Quanto é derivável | Como fechar |
|---|---|---|
| **Peso do curso** (1,0 a 3,75) | Aprendido da 6ª fase, acerta 96,9% dos ciclos por (tipo de curso, tipo de oferta, curso); 70% só por tipo e oferta | Tabela do CNCT por curso (laboratórios) e as regras de mínimo do integrado. O "Fator de Esforço do Curso" da PNP (1,00 a 1,25) **não é** o peso da MDO |
| **Carga horária mínima do MEC** | A PNP discorda da MDO em 16.979 ciclos (29%): FIC e licenciatura, em geral com valor menor | Tabela de CH mínima (CNCT, CNCST, diretrizes, guia FIC); aprendida da MDO, acerta 93,6% dos ciclos |
| **Agropecuária** (bônus de 50%) | A PNP não traz a coluna | Lista de cursos de agropecuária; no IFSul vem na 6ª fase |

## Reconstrução da Matrícula Total, ciclo a ciclo

Três níveis de ajuda da MDO, comparados com a Matrícula Total publicada (soma da rede: 1.668.775):

| Nível | Peso do curso | CH mínima | Ciclos exatos | Soma contra a MDO |
|---|---|---|---|---|
| A | da MDO | da MDO | 96,7% | −0,70% |
| B | por (tipo, oferta, curso) | da PNP | 80,1% | −0,56% |
| C | por (tipo, oferta, curso) | aprendida por (tipo, curso) | 93,6% | −1,59% |

O erro de soma é pequeno porque os ciclos errados são, em geral, pequenos. Mesmo assim, ele muda o valor de uma matrícula em cerca de 1%.

## Resíduos ainda sem regra (1.909 ciclos no nível A)

- **FIC "não se aplica" e concomitante com mínima de 3.200 h** (cerca de 1.485 ciclos): a MDO publica 2,5 vezes o que a regra dá; o peso gravado nas colunas da 6ª fase da rede parece não ser o que entrou na conta.
- **Especialização lato sensu** (cerca de 240 ciclos): a MDO publica 40% do que a regra dá.
- **Doutorado e mestrado profissional** (cerca de 35 ciclos): a MDO publica 26,7% do que a regra dá.
- **Cursos com mais de 4 anos de carga horária** (ensino fundamental I e alguns bacharelados, cerca de 115 ciclos): o teto parece ser 4.000 h, e não a carga horária da matriz.

No formato novo da 6ª fase (IFSul, calculado pelo Excel), nenhum desses resíduos aparece: os 1.352 ciclos fecham. Isso sugere que são resíduos da exportação antiga da rede, e que a 6ª fase nova de todas as instituições os dissolveria.

## O que falta para calcular a matriz inteira

1. A **6ª fase nova da rede** (hoje só o IFSul tem), para comparar sem os resíduos.
2. As **tabelas de peso e de CH mínima** como dado do sistema, com a fonte de cada linha, em vez de aprendidas da MDO.
3. Os **cinco blocos que não vêm dos ciclos** e que também têm dados agora: Qualidade e Eficiência (IEA, RAP e IAPL), Reitorias, Assistência Estudantil (renda por câmpus), piso mínimo e anuidade. O painel da PNP já traz RAP, percentuais legais e renda por câmpus e instituição, de 2017 a 2025.
4. A decisão de **qual é a verdade** quando a PNP e a MDO divergem (hoje: a MDO homologa, a PNP informa).

## Como isto está guardado no sistema

Os microdados não entram linha a linha (são mais de 20 milhões de estudantes). Entram **agregados por ciclo de curso** (`PnpMicrodadoCiclo`), que é o grão da matriz e não carrega dado pessoal. Os arquivos originais ficam no disco, e `npm run carregar:pnp -- 2027` refaz só o que mudou.
