# Dá para calcular a matriz a partir da PNP?

Análise de 2026-09-30, com os microdados da PNP de 2025 (ciclo orçamentário 2027) contra a 6ª fase publicada pela MDO.

## Resposta curta

**Dá, em grande parte.** Os microdados de matrículas da PNP trazem, para todas as 42 instituições, o que antes só existia na MDO: o ciclo de curso, a carga horária, as datas, a carga horária mínima regulamentada e a situação de cada matrícula. Com isso, a Matrícula Total de um ciclo se reconstrói em **99,6% dos 58.242 ciclos** quando se dispõe da tabela de peso efetivo e da carga horária mínima do MEC (a soma erra 0,2%), e em 94,3% se a mínima do MEC for prevista a partir da PNP (a soma erra 2,8%).

O que ainda não se calcula sozinho: o **peso do curso** (que tem de vir de uma tabela por curso e carga horária mínima) e a **carga horária mínima do MEC**, sobretudo a do FIC. Os "resíduos" que pareciam regras de exceção eram o peso (abaixo).

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

## Os resíduos: eram o peso, não regras novas

Dos 58.242 ciclos, 1.909 não fechavam no nível A. Todos os grupos tinham a mesma causa: **o peso que a MDO aplicou não é o que a coluna "Peso do Curso" da exportação antiga da rede mostra.** Deduzindo o peso da própria Matrícula Total publicada (o "peso efetivo", já com o bônus de agropecuária), cada grupo se explica:

| Grupo (ciclos) | O que a MDO aplicou | O que a coluna diz |
|---|---|---|
| FIC com mínima de 3.200 h (1.488) | peso **2,5**, em todos os 3.129 ciclos do FIC com essa mínima | 1 |
| Especialização lato sensu (242) | peso **1** | 2,5 ou 1,5 |
| Mestrado e doutorado (42) | peso **1** | 3,75 |
| Ensino fundamental I e bacharelados (122) | peso **2,5**, com 3.200 h (a "razão 1,25" era 2,5 x 3.200 = 2 x 4.000) | 2 ou 1 |

O FIC é uma regra: o curso que a MDO não achou no catálogo recebe a carga horária mínima "padrão" de 3.200 h e o peso 2,5. Os demais são específicos de curso: com a carga horária mínima do MEC na chave, **o peso efetivo é função de (tipo de curso, tipo de oferta, curso, CH mínima) em 99,77% dos 49.391 ciclos** (115 erros). Sem a CH mínima na chave são 93,5%; só por (tipo, curso), 89,8%. Em `src/lib/mdo/regrasCiclo.ts`.

### Reconstrução da Matrícula Total depois disso

| Nível | Peso | CH mínima do MEC | Ciclos exatos | Soma contra a MDO |
|---|---|---|---|---|
| A | da coluna | da MDO | 96,72% | −0,70% |
| **A2** | **efetivo, por tabela** | da MDO | **99,57%** | **+0,23%** |
| B2 | efetivo, por tabela | prevista por tabela com a mínima da PNP | 94,32% | −2,77% |

(Medidas na própria amostra: as tabelas foram aprendidas da 6ª fase de 2027, então servem para dizer se a regra se sustenta, não como teste fora da amostra.)

A diferença entre A2 e B2 é a **carga horária mínima do MEC**. A PNP traz uma mínima própria, que difere da usada pela MDO em 29% dos ciclos. O que dá para prever: Técnico e Bacharelado, por curso (99,8% e 99,9%); Licenciatura, pela carga horária do ciclo (99,7%). O que **não** dá: o FIC (77% por qualquer campo da PNP), porque o curso FIC específico, que é o que a MDO consulta no catálogo, não está nos microdados (só o nome genérico do eixo).

## O que falta para calcular a matriz inteira

1. A **6ª fase nova da rede** (hoje só o IFSul tem), para comparar sem os resíduos.
2. As **tabelas de peso e de CH mínima** como dado do sistema, com a fonte de cada linha, em vez de aprendidas da MDO.
3. Os **cinco blocos que não vêm dos ciclos** e que também têm dados agora: Qualidade e Eficiência (IEA, RAP e IAPL), Reitorias, Assistência Estudantil (renda por câmpus), piso mínimo e anuidade. O painel da PNP já traz RAP, percentuais legais e renda por câmpus e instituição, de 2017 a 2025.
4. A decisão de **qual é a verdade** quando a PNP e a MDO divergem (hoje: a MDO homologa, a PNP informa).

## Como isto está guardado no sistema

Os microdados não entram linha a linha (são mais de 20 milhões de estudantes). Entram **agregados por ciclo de curso** (`PnpMicrodadoCiclo`), que é o grão da matriz e não carrega dado pessoal. Os arquivos originais ficam no disco, e `npm run carregar:pnp -- 2027` refaz só o que mudou.
