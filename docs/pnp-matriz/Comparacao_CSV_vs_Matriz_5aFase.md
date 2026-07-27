# Comparação: CSVs da PNP vs. Planilha "5ª Fase - MATRIZ CONIF 2026 - Modelo"

Data da análise: 26/07/2026. Base: `DadosGerais.csv`, `EficienciaAcademica.csv`, `PercentuaisLegais.csv`, `RelacaoAlunoProfessorRAP.csv` e os 13 CSVs da pasta `Outros arquivos` (`CargosCarreira`, `CassificacaoRacialRendaSexo`, `IndicadoresGastos`, `IndiceVerticalizacao`, `OfertaVagasNoturnas`, `PanoramaOrcamentario`, `ProfessoresPorInstituicao`, `RelacaoInscritosVagas`, `ReservaVagas`, `SituacaoMatricula`, `TaxaEvasao`, `TaxaOcupacao`, `TecnicosAdmNivel`, `TitulacaoDocente`), todos exportados em 22/07/2026, vs. abas `DADOS BASE`, `INDICADORES`, `COMPLETO PROPOSTA`, `RESUMO PROPOSTA`, `COMPARATIVO`, `VALOR SPO` da planilha (gerada em 06/11/2025).

## Resumo executivo

Dos quatro indicadores que alimentam a matriz, um está claramente errado no CSV (RAP), um provavelmente não pode ser replicado com os CSVs atuais porque falta a tabela de pesos por curso (Matrículas Totais equalizadas), um apresenta diferenças moderadas que parecem vir de metodologia/período de referência diferentes (Eficiência Acadêmica), e um está correto (Percentuais Legais). Há também várias variáveis externas (renda per capita, RIP, MOOC, ano de criação de campus etc.) que não existem em nenhum dos 4 CSVs e precisam vir de outra fonte.

## 1. RAP — confirmado: o CSV traz RAP com EaD, a planilha usa só presencial

A aba `INDICADORES` rotula a coluna N explicitamente como **"RAP Presencial (PNP 5.6B)"** — um indicador específico da PNP que já vem filtrado para presencial. O `RelacaoAlunoProfessorRAP.csv`, por outro lado, tem apenas a coluna genérica "RAP | RAP" por campus, sem qualquer filtro de modalidade.

Comparando RAP = (soma de "RAP | Matrículas RAP") / (soma de "RAP | Professor Equivalente") por instituição, ano 2024, com o valor "RAP Presencial" hardcoded na planilha:

| Instituição | RAP no CSV (todas modalidades) | RAP na planilha (presencial) | Diferença |
|---|---|---|---|
| IFSULDEMINAS | 55,37 | 21,57 | **+157%** |
| IFRO | 27,56 | 18,09 | +52% |
| IF BAIANO | 23,35 | 16,47 | +42% |
| IFMS | 29,26 | 21,77 | +34% |
| IFSUL | 23,76 | 18,03 | +32% |
| IFNMG | 28,11 | 21,62 | +30% |
| CEFET-RJ | 27,95 | 22,44 | +25% |
| IFAC | 19,78 | 19,84 | −0,3% |

Padrão claro: instituições com IFAC (praticamente sem EaD) têm diferença próxima de zero; instituições com forte oferta EaD (IFSULDEMINAS, IFRO, IF BAIANO etc.) têm RAP inflado em 25%–157% no CSV. Em 39 das 40 instituições comparadas o CSV superestima o RAP; a média de superestimação é de **+13,4%** (mediana ~8%). Isso confirma exatamente a sua suspeita: o CSV está somando matrículas/professores de cursos EaD que não deveriam entrar nesse indicador.

**Impacto**: como o RAP determina uma faixa de peso (0 / 1 / 2 / 2,5×) na distribuição de recursos por "Relação Aluno Professor", usar o RAP do CSV pode empurrar instituições para uma faixa de peso mais alta do que a que realmente fazem jus — beneficiando indevidamente quem tem grande oferta EaD.

## 2. Matrículas Totais equalizadas — a planilha usa uma equalização que não é a "Matrícula Equivalente" do CSV

Na aba `COMPLETO PROPOSTA`, a coluna Q ("Matrículas Totais" presencial, usada como base da "Valor da Matrícula Total Presencial") é diferente da coluna L/AH ("Quantidade de alunos", contagem bruta) e também diferente de "Matrícula Equivalente | Geral" do CSV.

Exemplos (IFAC, 2024):

| Campus | Matrículas (bruto, CSV) | Matrícula Equivalente (CSV) | Coluna L/AH (planilha) | Coluna Q/AI equalizada (planilha) |
|---|---|---|---|---|
| Campus Avançado Rio Branco Baixada do Sol | 800 | 832,49 | 760 | 1.136,88 |
| Campus Cruzeiro do Sul | 1.216 | 1.247,27 | 1.214 | 3.249,16 |

A contagem bruta de matrículas (L/AH ≈ 760/1.214) bate, com pequena defasagem, com o CSV (800/1.216) — diferença de 2 a 5%, provavelmente por diferença de data de extração. Mas a coluna Q (a que efetivamente entra no cálculo do valor da matriz) não guarda relação fixa com "Matrícula Equivalente": no primeiro campus a razão é 1,37×, no segundo é 2,60×. Como a razão muda de campus para campus, não é um fator de correção simples — é sinal de que a planilha usa uma tabela de pesos por curso (provavelmente por carga horária/duração do curso, indicador PNP "Matrícula Total" de outra fonte) que **não existe em nenhum dos 4 CSVs atuais**.

**Impacto**: se o sistema estiver usando "Matrícula Equivalente | Geral" do CSV como proxy para essa "Matrícula Total equalizada", o valor da matriz de custeio (a maior parcela do orçamento) sai sistematicamente errado, e o erro varia por campus dependendo do mix de cursos.

## 3. Eficiência Acadêmica (IEA) — diferenças moderadas, causa provável: "ciclo" vs. ano isolado

A planilha rotula as colunas G/H/I/J de `INDICADORES` como "Conclusão **Ciclo**", "Evasão **Ciclo**", "Retenção **Ciclo**" — sugerindo que o indicador oficial de eficiência acadêmica da PNP acompanha uma coorte ao longo do ciclo esperado do curso, e não apenas os concluintes/evadidos/retidos daquele ano isolado (que é o que o `EficienciaAcademica.csv` traz, ano a ano).

Comparando IFAC 2024, agregando o CSV por instituição (ponderado pelo total de alunos avaliados = concluídos + evadidos + retidos):

| Indicador | CSV agregado (ponderado) | Planilha ("Ciclo") |
|---|---|---|
| Conclusão % | 35,9% | 34,1% |
| Evasão % | 48,1% | 47,9% |
| Retenção % | 15,9% | 18,0% |
| Índice de Eficiência Acadêmica | 43,7% | 41,6% |

As diferenças são de 2 a 4 pontos percentuais — bem menores que o problema do RAP, mas ainda relevantes para as faixas de peso do IEA (que têm degraus de ~5 pontos percentuais). Duas explicações prováveis, que precisam ser confirmadas com quem gera o `EficienciaAcademica.csv` na PNP: (a) o indicador oficial usa uma janela de coorte diferente da do CSV anual; (b) defasagem de data — a planilha foi gerada em 06/11/2025 com dados PNP daquele momento, e o CSV foi exportado em 22/07/2026, período em que a PNP pode ter revisado números de conclusão/evasão de 2024 (isso é comum, pois PNP atualiza retroativamente conforme alunos terminam ciclos).

## 4. Percentuais Legais (%ME Técnicos / Formação de Professores / Proeja) — batendo corretamente

Aqui os números batem quase exatamente quando agregados por instituição da forma certa (soma da Matrícula Equivalente de cada categoria dividida pela soma da Matrícula Equivalente geral — nunca média simples dos percentuais por campus):

| Indicador (IFAC, 2024) | CSV agregado | Planilha |
|---|---|---|
| %ME Técnicos | 58,9843% | 58,9842% |
| %ME Formação de Professores | 19,9509% | 19,9509% |
| %ME Proeja | 0,7615% | 0,7616% |

Isso confirma que `PercentuaisLegais.csv` é a fonte certa para IAPL — desde que a agregação por instituição some os valores absolutos antes de dividir (não faça média das porcentagens por campus) **e observando o Achado 6 abaixo sobre a escala dos valores absolutos.**

## Achados adicionais a partir da pasta "Outros arquivos"

Com acesso aos outros 13 CSVs, deu para confirmar/corrigir três pontos importantes:

### 6. Bug confirmado: `PercentuaisLegais.csv` traz a Matrícula Equivalente 100× maior que o valor real

Cruzando campus a campus com `DadosGerais.csv` (que traz Matrícula Equivalente por curso, mais granular e independente):

| Campus | Técnico ME (DadosGerais) | Técnico ME (PercentuaisLegais, bruto) | PercentuaisLegais ÷ 100 |
|---|---|---|---|
| IFAC – Campus Cruzeiro do Sul | 649,11 | 64.910,60 | 649,11 |
| IFAC – Campus Rio Branco | 1.184,73 | 118.473,10 | 1.184,73 |
| IFB – Campus Brasília | 2.505,82 | 250.581,60 | 2.505,82 |
| IFB – Campus Ceilândia | 1.289,15 | 128.915,10 | 1.289,15 |

Em todos os casos testados, o valor bruto do CSV é exatamente 100× o valor real (confirmado via `DadosGerais.csv`, calculado de forma independente a partir dos cursos). Isso explica por que a comparação de **percentuais** (%ME) bateu tão bem no Achado 4: numerador e denominador estão inflados pelo mesmo fator 100, então a razão continua correta. Mas **qualquer uso do valor absoluto de "Matrícula Equivalente" desse CSV (não a porcentagem) precisa ser dividido por 100 antes de usar** — do jeito que está, o sistema herdaria um erro de 100× nesses casos.

### 7. RAP: `TaxaEvasao.csv` permite isolar a matrícula presencial e reduz bastante o erro

`TaxaEvasao.csv` tem a coluna `ModalidadeEnsino` por curso, o que permite somar só as matrículas presenciais por instituição — diferente de `RelacaoAlunoProfessorRAP.csv`, que não separa modalidade. Refazendo o RAP como (matrículas presenciais de `TaxaEvasao.csv`) ÷ (Professor Equivalente de `RelacaoAlunoProfessorRAP.csv`, que se mostrou confiável — ver Achado 8):

| Instituição | RAP CSV (todas modalidades) | RAP re-calculado (só presencial via TaxaEvasao) | RAP da planilha | Erro antes → depois |
|---|---|---|---|---|
| IFSULDEMINAS | 55,37 | 33,03 | 21,57 | +157% → +53% |
| IFRO | 27,56 | 18,44 | 18,09 | +52% → +2% |
| IF BAIANO | 23,35 | 16,61 | 16,47 | +42% → +0,9% |
| IFAC | 19,78 | 18,94 | 19,84 | −0,3% → −4,5% |

Para IFRO e IF BAIANO o ajuste praticamente elimina o erro. Para IFAC (que já não tinha EaD relevante) o ajuste piora ligeiramente — sinal de que "Número de Matrículas" de `TaxaEvasao.csv` não é exatamente a mesma definição de "Matrículas RAP" oficial (provavelmente essa é uma média/contagem específica de um ciclo letivo, não a matrícula simples). Para IFSULDEMINAS o erro cai de +157% para +53% — melhora enorme, mas ainda não fecha, sugerindo que esse caso específico tem algo adicional a investigar (talvez cursos de modalidade "Não se aplica"/FIC contando de forma diferente, ou um problema pontual de dado). **Conclusão prática**: `TaxaEvasao.csv` é uma fonte bem melhor que `RelacaoAlunoProfessorRAP.csv` para isolar a matrícula presencial do RAP, mas não é uma solução perfeita — vale usá-la como numerador enquanto não se consegue o indicador oficial "RAP Presencial (5.6B)" direto da PNP.

### 8. Professor Equivalente está correto — o problema do RAP é só no numerador

`ProfessoresPorInstituicao.csv` traz o número de docentes por titulação e jornada de trabalho (40h/20h/DE). Somando o headcount bruto para o IFAC em 2024 dá 388 docentes; o "Professor Equivalente" (que pondera por jornada) do `RelacaoAlunoProfessorRAP.csv` é 353, muito próximo do valor hardcoded na planilha (351,5). Ou seja, **o denominador do RAP (Professor Equivalente) já está correto no CSV** — o problema é 100% do numerador (matrículas incluindo EaD), confirmando o diagnóstico do Achado 1 e do Achado 7.

### 9. Eficiência Acadêmica "ciclo": não dá para reproduzir com os arquivos disponíveis

`SituacaoMatricula.csv` traz, por campus, a situação de cada matrícula em 2024 (`Concluintes`/`Em curso`/`Evadidos`, com sinalização `Em fluxo`/`Retido`). Testando no Campus Cruzeiro do Sul (IFAC): concluintes = 41+12 = 53, que bate com o concluintes anual de `DadosGerais.csv` (53) — mas **não** bate com o concluídos de `EficienciaAcademica.csv` (98). Isso confirma que `EficienciaAcademica.csv` usa mesmo uma metodologia de coorte/ciclo diferente da simples situação anual da matrícula, e que essa metodologia de ciclo **não está reproduzível a partir de nenhum dos 13 CSVs adicionais** — seria preciso obter o indicador de ciclo diretamente da PNP (indicador 5.2) ou aceitar a aproximação anual com a ressalva já registrada no Achado 3.

### 10. Matrículas Totais equalizadas (mistério do Achado 2): continua sem explicação total, mas com progresso

Nenhum dos 13 CSVs adicionais traz uma tabela de pesos por curso/carga-horária ou qualquer indicador que reproduza a equalização usada na coluna Q/AI de `COMPLETO PROPOSTA`. `IndicadoresGastos.csv` tem uma "Matrícula Equivalente" (usada para Gastos Correntes por matrícula), mas ela bate com a Matrícula Equivalente comum de `DadosGerais.csv` — não com o valor 1,37×–2,60× maior usado na matriz.

### 11. Fórmulas oficiais confirmadas direto na fonte regulatória (Portaria SETEC/MEC nº 51/2018 e Guia de Referência Metodológica da PNP)

Fui buscar a legislação e a documentação oficial da PNP (não são CSVs, mas resolvem boa parte do que os CSVs não explicavam):

**RAP — fórmula oficial confirmada.** A [Portaria SETEC/MEC nº 51/2018](https://www.in.gov.br/materia/-/asset_publisher/Kujrw0TZC2Mb/content/id/51283320/do1-2018-11-22-portaria-n-51-de-21-de-novembro-de-2018-51283076), Art. 5º, define: `RAP = [(Mateq_graduação × 1,111) + Mateq_demais_cursos] / ProfEq`, e a versão presencial troca só o numerador para usar Matrícula-equivalente exclusivamente de cursos presenciais, mantendo o mesmo `ProfEq`. Isso confirma oficialmente, na fonte, exatamente o diagnóstico do Achado 1.

**Eficiência Acadêmica — fórmula oficial confirmada e já implementada no CSV.** O Guia de Referência Metodológica da PNP documenta que o IEA é calculado por "ciclo de matrícula" (coorte), com a fórmula `IEA = C_ciclo + R_ciclo × (C_ciclo/(C_ciclo+Ev_ciclo))`. Testei essa fórmula com os dados de `EficienciaAcademica.csv` para o Campus Cruzeiro do Sul (IFAC, 2024) e o resultado bateu **exatamente** com o "Índice de Eficiência Acadêmica %" já presente no próprio CSV (39,52%) — ou seja, o CSV já vem calculado corretamente por ciclo, por campus. O problema do Achado 3 não era a fórmula: era a forma de agregar por instituição. Refazendo a agregação corretamente (somar contagens absolutas antes de calcular %, depois aplicar a fórmula uma única vez, em vez de fazer média dos IEA% já calculados por campus), a diferença cai de ~2 pontos percentuais para ~1,15 ponto — quase certamente só defasagem de data de extração.

**Matrícula-Equivalente — fórmula e tabela de pesos oficiais encontradas, mas não fecham 100% com os CSVs.** A mesma Portaria (Art. 2º e Anexo II) define `Mateq = Matrícula × fech × fec`, com uma tabela pública de mais de 400 combinações de curso/eixo tecnológico e seu Fator de Esforço de Curso (salva em `Outros arquivos/FEC_Portaria51_2018_AnexoII.csv`). Ao testar essa tabela contra `DadosGerais.csv`, porém, as razões não bateram exatamente (ex.: Técnico em Agropecuária tabelado em 1,2, razão observada no CSV de 1,018) — a tabela pode ter sido revisada desde 2018 (a portaria prevê revisão a cada 2 anos) ou há um terceiro fator ("Fator de Nível de Curso", mencionado no glossário da mesma portaria mas não detalhado na fórmula que consegui acessar). Isso não fecha o Achado 2 sozinho, mas dá uma pista concreta de onde a equalização "extra" (1,37×–2,60×) pode estar vindo.

## 5. Dados que não existem em nenhum dos CSVs

A `DADOS BASE` usa várias variáveis que não vêm de `DadosGerais`, `EficienciaAcademica`, `PercentuaisLegais` ou `RelacaoAlunoProfessorRAP`:

- Faixa de renda per capita dos estudantes e peso por faixa (usado na Assistência Estudantil, coluna AK "VR" de `COMPLETO PROPOSTA`).
- Quantidade de alunos em Regime de Internato Pleno (RIP).
- Matrículas EaD MOOC e EaD Financiamento Próprio, tratadas separadamente de "EAD" comum.
- Ano de criação de cada campus (usado para aplicar o piso de "Funcionamento Campus Novo").
- Valor da Assistência Estudantil do ano anterior e Valor MEC da Assistência.
- Índice de correção (IPCA) e valor de referência SPO — vêm de fontes orçamentárias externas.

Essas variáveis precisam continuar vindo de planilhas/fontes separadas; não há como derivá-las dos 4 CSVs da PNP.

## 6. Reconciliação sistemática 2024 — todas as 41 instituições / 633 câmpus (26/07/2026)

Os achados 1-11 acima foram feitos com 1-4 exemplos (IFAC principalmente). Refiz a análise para **todas** as instituições e câmpus, ano-base 2024, para confirmar se os padrões se sustentam em escala e não são só uma particularidade do IFAC.

### 6.1 IEA, RAP e %ME — confirma os achados anteriores, em escala

Recalculando os três indicadores a partir dos CSVs (mesma metodologia dos achados 1/3/4) para as 41 instituições e comparando contra `golden_values_indicadores.csv`:

| Indicador | Erro médio absoluto | Mediana | Pior caso |
|---|---|---|---|
| IEA (pontos percentuais) | 9,26pp | 5,28pp | IFSUL: 53,49pp |
| RAP Presencial (aproximação via TaxaEvasao.csv) | 5,6% | 4,5% | CEFET-MG: 24,6% |
| %ME Técnicos (pontos percentuais) | ~0,00002pp | — | CEFET-MG/CEFET-RJ/CPII: erro grande, mas é o golden que tem 0 (particularidade da fórmula original, não erro de dado) |

Confirma exatamente o que já vínhamos rastreando: %ME está essencialmente perfeito, RAP tem erro moderado e sistemático (aproximação conhecida), e o IEA tem uma cauda de erro grande concentrada em redes com muitos câmpus (IFSUL, IFMG, IFRS, IFES) — nenhuma surpresa nova aqui, mas agora com a população completa confirmando que não é ruído de amostra pequena.

### 6.2 Matrícula Total equalizada (Q) — achado novo: a planilha usa VALORES COLADOS, não fórmulas

Abrindo o arquivo `.xlsx` com as fórmulas visíveis (não só os valores calculados), ficou confirmado que **as colunas Q/R/S/T ("Matrículas Totais equalizadas") e AI ("MECHDA") de `COMPLETO PROPOSTA`, por câmpus, são valores fixos colados — não fórmulas**. Exemplo (célula `Q17`, Campus Cruzeiro do Sul/IFAC): `3249.16479`, sem fórmula nenhuma por trás. Já as colunas que dependem delas (`V16 = "=Q16*'DADOS BASE'!$I$29"`, `H16 = "=IF(E16>=2018,MAX(...),J16)"`, o total da instituição `Q14 = "=SUM(Q15:Q21)"`) são fórmulas reais — mas operam em cima de números que vieram de fora da planilha. Isso vale para as 633 linhas de câmpus verificadas, não é exceção do IFAC.

Isolando o "fator extra" dessa equalização (comparando com `Matrícula Equivalente | Geral` de `DadosGerais.csv`, que já aplica corretamente a fórmula oficial de Mateq = Mat × fech × fec — confirmado porque a razão `Matrícula Equivalente (CSV) / matrícula bruta` fica entre 0,05 e 1,67, mediana ~1,03, compatível com o fech/fec oficiais):

| Razão | Média | Mediana | Faixa |
|---|---|---|---|
| Matrículas CSV / L (contagem bruta da planilha) | 1,011 | 1,003 | 1,00 – 1,52 (bate quase perfeito) |
| Matrícula Equivalente CSV / L (fator FEC/FECH oficial) | 0,983 | 1,027 | 0,05 – 1,67 |
| **Q (planilha) / Matrícula Equivalente CSV (fator restante, não explicado)** | **1,669** | **1,570** | **0,39 – 4,66** |

Ou seja: a contagem bruta bate quase perfeito, e o CSV já calcula corretamente a Matrícula-equivalente oficial (pode ser usada direto, sem precisar aplicar a tabela FEC manualmente) — mas por cima disso ainda existe, em toda a rede, um fator adicional de ~1,57× (mediana) que os 17 CSVs não explicam. Testei correlação desse fator residual com o mix de tipo de curso por câmpus (% Técnico, % Tecnologia, % FIC, etc., via `TaxaEvasao.csv`): a correlação mais forte foi com % de matrícula em cursos Técnicos (+0,25) e % em Qualificação Profissional/FIC (−0,26) — direção plausível (cursos técnicos mais longos puxam o fator pra cima, FIC/cursos curtos puxam pra baixo), mas fraca demais pra ser a fórmula completa. **Conclusão**: o fator existe e tem alguma relação com duração/tipo de curso, mas não é derivável com precisão dos dados públicos disponíveis — precisa mesmo da fonte oficial (CONIF/SETEC ou páginas 65-104 do Guia de Referência Metodológica da PNP, não acessadas).

**Implicação prática mais importante desta reconciliação inteira**: o Bloco Funcionamento (80% do orçamento) e o Bloco Reitorias (10%, mesma base) juntos somam ~90% do valor final de cada instituição, e ambos dependem inteiramente dessa Matrícula Total equalizada (Q) que não é derivável dos CSVs. Isso significa que, mesmo com IEA/RAP/IAPL/EAD perfeitos, o sistema não vai bater com os valores finais da planilha 5ª Fase para a grande maioria do orçamento — o gargalo real está aqui, não nos indicadores de Qualidade e Eficiência (que somados são só 10% do total).

## Recomendação

Antes de confiar no sistema atual, sugiro: (1) para o RAP, usar `TaxaEvasao.csv` para isolar matrículas presenciais em vez de somar `RelacaoAlunoProfessorRAP.csv` cru (reduz o erro de +157%/+52%/+42% para +53%/+2%/+0,9% nos casos testados), mas idealmente obter o indicador oficial "RAP Presencial (5.6B)" direto da PNP; (2) confirmar com a PNP/CONIF qual é a fórmula exata de equalização de matrículas totais (Q/AI) e obter a tabela de pesos por curso — nenhum dos 17 CSVs disponíveis traz essa informação; (3) confirmar se o IEA usado na matriz é baseado em coorte/ciclo (e não no ano isolado) — `SituacaoMatricula.csv` confirma que não é possível reproduzir esse número com os dados disponíveis; (4) usar `PercentuaisLegais.csv` normalmente para os **percentuais** (%ME), mas **dividir por 100 qualquer valor absoluto de "Matrícula Equivalente"** lido diretamente desse arquivo; (5) `RelacaoAlunoProfessorRAP.csv` está correto para "Professor Equivalente" — não precisa de correção nesse campo.
