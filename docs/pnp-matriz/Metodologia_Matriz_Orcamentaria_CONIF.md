# Metodologia de Cálculo da Matriz Orçamentária CONIF/SETEC — Especificação para Implementação

Este documento descreve, com base na engenharia reversa da planilha `5ª Fase - MATRIZ CONIF 2026 - Modelo.xlsx` (abas `DADOS BASE`, `INDICADORES`, `COMPLETO PROPOSTA`, `RESUMO PROPOSTA`, `COMPARATIVO`, `VALOR SPO`), como a matriz orçamentária é calculada, quais dados vêm dos CSVs exportados da PNP (`DadosGerais.csv`, `EficienciaAcademica.csv`, `PercentuaisLegais.csv`, `RelacaoAlunoProfessorRAP.csv`) e quais **não** vêm — e por isso precisam de outra fonte.

**Antes de implementar, ver a seção "Problemas conhecidos nos CSVs atuais" no final** — há inconsistências confirmadas entre os CSVs e a metodologia oficial que precisam ser corrigidas na exportação/ingestão, não apenas no cálculo.

---

## 1. Visão geral do fluxo

```
DADOS BASE (parâmetros/pesos/tetos)
        │
        ▼
INDICADORES (IEA, RAP, %ME por Instituição — ano-base 2024)
        │  (SUMIF por nome da instituição)
        ▼
COMPLETO PROPOSTA (1 linha por campus + 1 linha de total por instituição + 1 linha "REITORIA")
        │  (SUM/SUMIF por instituição)
        ▼
RESUMO PROPOSTA (Matriz Custeio + Assistência Estudantil + Anuidade CONIF, por campus/instituição)
        │
        ▼
COMPARATIVO (2024 vs 2025 vs 2026, aplica trava de "sem decréscimo" e complementação)
        │
        ▼
VALOR SPO (valor final por instituição, custeio + assistência, comparado ao SPO oficial)
```

A unidade de distribuição de recursos é o **campus** (ou "REITORIA" como unidade separada por instituição). Cada instituição (rede/IF) tem uma linha "Total" (tipo `T`), uma linha "REITORIA" (tipo `R`) e N linhas de campus (tipo `C`).

---

## 2. Parâmetros globais (`DADOS BASE`)

Estes valores são digitados manualmente todo ano e **não vêm de nenhum CSV da PNP**:

| Parâmetro | Célula | Valor 2026 (exemplo) | Observação |
|---|---|---|---|
| Índice de correção IPCA 2024→2025 | `I10` | 0,04831296 | Fonte: IBGE |
| Valor da Matriz do ano anterior | `I25` | 2.815.950.000 | Valor MEC distribuído |
| Valor referência (SPO) | `M25` | 2.951.996.879,71 | |
| Percentual para cálculo da Anuidade CONIF | `I22` | 0,0015 (0,15%) | Aplicado sobre o Custeio de cada instituição |
| % Proposto Qualidade e Eficiência – IEA | `I80` | 2,5% | Parcela do orçamento total distribuída por IEA |
| % Proposto Qualidade e Eficiência – RAP | `I85` | 2,5% | Parcela distribuída por RAP |
| % Proposto Qualidade e Eficiência – IAPL | `I90` | 5% | Parcela distribuída por Atendimento a Percentuais Legais |
| % Proposto Matrículas para Reitoria | `J94` | 10% | Parcela reservada às reitorias |
| Valor "Funcionamento Campus Novo" | `I97` | `700.000 × (1+IPCA)` | Piso mínimo para campus criado a partir de 2018 |
| Valor da Assistência Estudantil do ano anterior | `W44` | 569.717.136 | |
| % IDH vs. % Renda na Assistência Estudantil | `AD10` | (peso IDH) | Divide a Assistência entre critério IDH e critério Renda |
| Faixas de Renda per capita e peso por faixa | linhas 69–70 | 2,5 / 2 / 1,5 / 1 / 0,5 / 0 | 6 faixas: 0–0,5 RFP até >3,5 RFP — **não vem dos 4 CSVs** |

### 2.1 Faixas (tiers) de peso — IEA, RAP e IAPL

A distribuição de "Qualidade e Eficiência" usa faixas com pesos crescentes. Uma instituição multiplicadora o próprio indicador pelo peso da faixa em que se encaixa (não é um bônus fixo, é `indicador × peso`).

**IEA** (`DADOS BASE!Q77:V81`) — tiers definidos com base no IEA médio da rede (0,461 no ano-base):

| IEA (Índice Eficiência Acadêmica) | Peso |
|---|---|
| < 0,4149 | 0,5× |
| 0,4149 – 0,461 | 1× |
| 0,461 – 0,5071 | 1,5× |
| 0,5071 – 0,5532 | 2× |
| ≥ 0,5532 | 2,5× |

**Atenção — conflito de fonte detectado (26/07/2026)**: ao auditar um sistema que implementa esta metodologia, foi encontrada uma segunda tabela de faixas de IEA, citada no código como vinda do livro "A Matriz Orçamentária da Rede Federal de EPCT" (CONIF/Forplan, 2025) — com **4 faixas** (pisos 47,07% / 51,78% / 56,48%, pesos 0,5× / 1,5× / 2,0× / 2,5×), diferente da tabela de **5 faixas** acima (extraída de `DADOS BASE!Q77:V81` da planilha "5ª Fase - MATRIZ CONIF 2026 - Modelo.xlsx"). Não há como saber, só com os arquivos que tenho, qual das duas é a vigente para o ciclo orçamentário em curso — podem ser edições/anos diferentes da mesma metodologia. **Decisão registrada**: por padrão, usar a tabela de 5 faixas desta seção (fonte: planilha-modelo oficial do ciclo 2026); a tabela do livro Forplan/2025 deve ficar disponível como opção alternativa selecionável no sistema, nunca aplicada silenciosamente — ver Prompt 2 revisado em `Prompts_Claude_Code_Matriz_CONIF.md` para como isso deve ser implementado (com explicação didática de qual faixa está em uso a cada cálculo).

**RAP** (`DADOS BASE!Q95:V97`) — tiers em valor absoluto de alunos/professor:

| RAP Presencial | Peso |
|---|---|
| < 18 | 0 |
| 18 – 20 | 1× |
| 20 – 22 | 2× |
| ≥ 22 | 2,5× |

**IAPL / Atendimento a Percentuais Legais** (`DADOS BASE!Q87:AA89`) — 3 categorias somadas (Técnicos, Formação de Professores, Proeja), cada uma com seus próprios tiers de %ME:

| Categoria | Piso 1 → Peso | Piso 2 → Peso | Piso 3 → Peso |
|---|---|---|---|
| Cursos Técnicos | ≥0% → 0 | ≥50% → 1× | ≥60% → 2× |
| Formação de Professores | ≥10% → 1× | ≥15% → 2× | ≥20% → 2,5× |
| Proeja | ≥2,5% → 1× | ≥5% → 2× | ≥10% → 2,5× |

O IAPL final por instituição é a soma ponderada das 3 categorias, cada uma normalizada pelo total da rede: `IAPL = (U_i/U_total)*peso_tecnico + (W_i/W_total)*peso_fp + (Y_i/Y_total)*peso_proeja`.

**Pesos de categoria confirmados (`DADOS BASE!N87:N89`)**: peso_tecnico = 0,7 · peso_fp (Formação de Professores) = 0,2 · peso_proeja = 0,1. Ou seja, a fórmula completa do IAPL Equalizado por instituição é:
```
IAPL_i = (U_i / SUM(U)) × 0,7 + (W_i / SUM(W)) × 0,2 + (Y_i / SUM(Y)) × 0,1
```
onde U, W, Y são os valores já enquadrados na faixa de peso (0/1x/2x/2,5x) de cada categoria — **o enquadramento em faixa (tier) é obrigatório e acontece antes dessa soma ponderada**; não é uma distribuição proporcional à matrícula bruta da categoria. Uma implementação que pule a etapa de enquadramento em faixa e distribua o IAPL proporcionalmente ao volume de matrículas de cada categoria (sem checar se a instituição atinge os pisos legais de %ME) não está seguindo a metodologia documentada aqui — mesmo que a agregação por instituição (soma de valores absolutos antes de dividir) esteja correta.

---

## 3. `INDICADORES` — cálculo por instituição (não por campus)

Uma linha por instituição/rede (não por campus), ano-base 2024. **Estes valores hoje são colados manualmente na planilha** (não são fórmulas ligadas a nenhum CSV dentro do arquivo) — o sistema precisa recriá-los a partir dos CSVs, respeitando os pontos abaixo:

**Ponto crítico de implementação (achado em auditoria de código, 26/07/2026)**: o enquadramento em faixa de peso (seção 2.1) do IEA e do RAP acontece **uma única vez, no nível da instituição**, sobre um único valor de IEA/RAP já calculado para a instituição inteira — nunca por campus. Uma implementação que calcule o IEA (ou RAP) de cada campus, enquadre cada campus na sua própria faixa de peso, e depois some os valores já ponderados dos campi para "formar" o valor da instituição, está introduzindo um erro de metodologia: um campus pequeno com IEA ruim e um campus grande com IEA bom podem, somados dessa forma, gerar um resultado diferente do que dá calcular o IEA da instituição inteira (agregando as contagens brutas primeiro) e só então enquadrar esse único número numa faixa. A sequência correta é sempre: 1) somar contagens/matrículas absolutas de todos os campi da instituição; 2) calcular o indicador (IEA ou RAP) uma vez, no nível da instituição, a partir dessas somas; 3) só então enquadrar esse valor único na tabela de faixas/pesos da seção 2.1.

### 3.1 Índice de Eficiência Acadêmica (colunas G, H, I, J) — FÓRMULA OFICIAL CONFIRMADA

Confirmado no Guia de Referência Metodológica da PNP (MEC/SETEC): o IEA é mesmo baseado em **ciclo de matrícula** (coorte), não em contagem anual isolada. Um "ciclo de matrícula" é o conjunto de alunos que ingressaram numa oferta específica de curso (mesma data de início/término prevista); o indicador do ano de referência N avalia os ciclos com término previsto em N-1, dando +1 ano de tolerância antes de classificar alguém como retido.

Fórmula oficial:
```
IEA [%] = C_ciclo + R_ciclo × ( C_ciclo / (C_ciclo + Ev_ciclo) )
```
onde `C_ciclo` = % Conclusão-Ciclo, `Ev_ciclo` = % Evasão-Ciclo, `R_ciclo` = % Retenção-Ciclo.

**Confirmado por teste direto**: aplicando essa fórmula às colunas `Eficiência Acadêmica | Concluídos %`, `Taxa de Evasão %` e `Retidos %` de `EficienciaAcademica.csv` para um campus específico (Campus Cruzeiro do Sul, IFAC, 2024: C=36,30%, Ev=55,56%, R=8,15%), o resultado bate **exatamente** com o `Índice de Eficiência Acadêmica %` já presente no CSV para aquele campus (39,52%). Ou seja, **`EficienciaAcademica.csv` já vem com o IEA oficial calculado por ciclo, por campus — não é preciso recalcular a fórmula, só agregar corretamente para o nível de instituição.**

- **Agregação correta por instituição**: somar `Concluídos`, `Número de Evadidos` e `Retidos` (contagens absolutas) de todos os campi da instituição; calcular `C_ciclo`, `Ev_ciclo`, `R_ciclo` no nível da instituição a partir dessas somas; **só então** aplicar a fórmula do IEA uma única vez. Nunca fazer média (simples ou ponderada) dos `Índice de Eficiência Acadêmica %` já calculados por campus — a fórmula não é linear, então a média dos resultados por campus não é igual ao resultado calculado sobre o total da instituição.
- Testando essa agregação para IFAC/2024: resultado de 42,73% contra 41,57% da planilha — diferença de ~1,15 ponto percentual, bem menor que o erro de agregação ingênua (que dava 43,70%). **Essa validação cobriu só o IFAC (poucos câmpus) e foi indevidamente generalizada como "defasagem de data, ~1-2pp para toda a rede" — isso estava errado (ver ressalva abaixo).**
- IEA ponderado (`K`) = aplica o peso da faixa (seção 2.1) sobre a Eficiência Acadêmica (`J`).
- IEA Equalizado (`L`) = `K_instituição / SUM(K de todas as instituições)`.

**⚠️ RESSALVA CRÍTICA (achado em teste de regressão contra as 41 instituições, 26/07/2026): o erro de agregação cresce com o número de câmpus da instituição, e não é pequeno.** Rodando a mesma agregação (soma de contagens brutas → fórmula única) para todas as 41 instituições da matriz, o desvio contra o valor oficial da planilha passa de ~1pp (IFAC) para até **53pp em IFSUL, 44pp em IFMG, 41pp em IFRS, 27pp em IFSULDEMINAS e 17pp no CEFET-MG** — ou seja, cresce claramente com redes maiores/mais pulverizadas, não é ruído aleatório. Não é bug de soma: os valores por câmpus batem exatamente com `EficienciaAcademica.csv` linha a linha; o problema é que o CSV, para essas redes, mostra Índice de Eficiência Acadêmica % próximo de ~98% por câmpus, enquanto a planilha oficial espera ~44% para a instituição — uma divergência grande demais para ser defasagem de data.

Hipótese não confirmada (precisa de checagem adicional, não é conclusão): redes com muitos câmpus tendem a ter proporcionalmente mais câmpus novos (expansão da Rede Federal, ano de criação ≥ 2018 — mesmo corte usado no piso de Funcionamento Campus Novo, seção 2.3). Um câmpus novo pode ainda não ter nenhum "ciclo de matrícula" encerrado, ou ter pouquíssimos concluintes avaliados; se a definição de ciclo conta poucos alunos "prematuramente" concluídos, o % de Eficiência Acadêmica daquele câmpus fica artificialmente perto de 100%, e isso se propaga para a soma da instituição. A métrica oficial da planilha provavelmente pondera isso de forma diferente (ou usa uma janela de tempo distinta). Isso não foi confirmado e exigiria checar a distribuição de "ciclos encerrados"/ano de criação por câmpus, e idealmente confirmação direta com CONIF/SETEC/PNP sobre a metodologia de agregação em rede.

**Conclusão prática**: a fórmula de agregação de IEA por instituição (seção acima) está confirmada e validada apenas para instituições pequenas/poucos câmpus (ex.: IFAC). **Não é confiável para redes grandes** e não deve ser usada para decisões reais de alocação de recursos sem confirmação externa. O sistema/testes devem tratar isso como informativo (reportar o erro observado por instituição), não como um valor validado universalmente.

*Fonte: Guia de Referência Metodológica PNP (MEC/SETEC), seção "Indicador de Eficiência Acadêmica" e definição de "ciclo de matrícula"; achado de divergência por regressão própria contra as 41 instituições, ainda sem confirmação da fonte oficial.*

### 3.2 RAP (colunas N, O, P, Q, R) — FÓRMULA OFICIAL CONFIRMADA (Portaria SETEC/MEC nº 51/2018)

A Portaria nº 51/2018 (Art. 5º) define oficialmente:
```
RMP (=RAP) = [ (Mateq_graduação × fcg) + Mateq_demais_cursos ] / ProfEq
fcg (Fator de Correção de Graduação) = 20/18 = 1,111...
ProfEq = (Prof_20h × 0,5) + Prof_40h + Prof_DE
```
E a versão **presencial** (a usada na matriz) troca só o numerador, mantendo o mesmo `ProfEq`:
```
RAP Presencial = [ (MateqP_graduação × fcg) + MateqP_demais_cursos ] / ProfEq
```
onde `MateqP_*` usa só Matrícula-equivalente de cursos **presenciais** (exclui EaD). Isso confirma formalmente, na fonte oficial, que a diferença entre RAP e RAP Presencial é exatamente restringir o numerador à matrícula-equivalente presencial — mantendo o mesmo denominador de professores.

- **Confirmado**: `ProfEq` (Professor Equivalente) não precisa de correção — validado contra `ProfessoresPorInstituicao.csv` (headcount por titulação/jornada, com a mesma fórmula de ponderação 0,5/1,0/1,0 para 20h/40h/DE): para o IFAC 2024 o headcount bruto é 388 e o `RAP | Professor Equivalente` do CSV é 353, muito próximo do valor hardcoded na planilha (351,5). **O problema do RAP está inteiramente no numerador** (`RelacaoAlunoProfessorRAP.csv` usa Mateq de todas as modalidades, não só presencial).
- **Mitigação recomendada usando dados hoje disponíveis**: recalcular o numerador do RAP como a soma de `Número de Matrículas` de `Outros arquivos/TaxaEvasao.csv` filtrando `ModalidadeEnsino = Educação Presencial` (esse CSV tem granularidade de curso com a coluna de modalidade, que falta em `RelacaoAlunoProfessorRAP.csv`). Testado em 4 instituições: reduz o erro de +157%/+52%/+42% para +53%/+2%/+0,9%. Ainda não é exato — a fórmula oficial usa Matrícula-**equivalente** (ponderada por FEC/FECH, seção 3.2.1) e o Fator de Correção de Graduação, não a matrícula simples — mas é bem melhor que usar o CSV de RAP sem filtro.
- RAP ponderado (`Q`) = aplica peso da faixa (seção 2.1) sobre RAP Presencial (`N`).
- RAP Equalizado (`R`) = `Q_instituição / SUM(Q de todas as instituições)`.

*Fonte: [Portaria SETEC/MEC nº 51, de 21/11/2018](https://www.in.gov.br/materia/-/asset_publisher/Kujrw0TZC2Mb/content/id/51283320/do1-2018-11-22-portaria-n-51-de-21-de-novembro-de-2018-51283076), Art. 5º e Anexo I (glossário).*

### 3.2.1 Matrícula-Equivalente (Mateq) — fórmula oficial e tabela de pesos por curso

A mesma Portaria 51/2018 (Art. 2º e Anexo II) define:
```
Mateq = Mat × fech × fec
fech (Fator de Equiparação de Carga Horária) = 1 para todos os cursos, EXCETO qualificação profissional (FIC): fech = chmr / 800
fec (Fator de Esforço de Curso) = valor tabelado por Tipo de Curso × Eixo Tecnológico × Curso (Anexo II)
```
A tabela completa do Anexo II de 2018 (mais de 400 combinações de curso/eixo com seu FEC e CHMR) foi salva em `Outros arquivos/FEC_Portaria51_2018_AnexoII.csv`.

**✅ RESOLVIDO (26/07/2026): a tabela de 2018 estava mesmo desatualizada — a vigente é a da Portaria SETEC/MEC nº 146, de 25/03/2021**, que "define conceitos e estabelece fatores para uso na Plataforma Nilo Peçanha" e traz seu próprio Anexo II ("TABELA DE FATOR DE ESFORÇO DE CURSO (FEC)"), substituindo a de 2018 (a própria Portaria 51/2018, Art. 3º, já previa revisão a cada 2 anos). Extraída e salva em `FEC_Portaria146_2021_AnexoII.csv` (491 combinações de Tipo de Curso × Eixo Tecnológico × Curso).

**Confirmado por teste estatístico, não só exemplo pontual**: comparando a razão `Matrícula Equivalente / Número de Matrículas` de `DadosGerais.csv` (ano-base 2024) contra o FEC tabelado, para 3.624 ofertas de curso Técnico (onde FECH=1, então a razão observada deveria ser exatamente o FEC): com a tabela de 2018 o erro médio absoluto era de 0,136 (só 8,6% das amostras batiam com erro < 0,02); com a tabela de 2021 o erro médio caiu para **0,00096**, com **98,76%** das amostras batendo quase exatas. Exemplos pontuais que não fechavam antes: Técnico em Agropecuária (2018: 1,2 / observado: 1,018 / 2021: **1,018** ✓), Técnico em Zootecnia (2018: 1,2 / observado: 1,08 / 2021: **1,080** ✓).

**Ação**: usar `FEC_Portaria146_2021_AnexoII.csv` (não mais o de 2018) em `aplicarFatorEsforcoCurso()` — o bloqueio por `NotImplementedError` do Prompt 5 pode ser removido para o FEC especificamente (a Matrícula Total equalizada, item separado, continua bloqueada, ver seção 9 item 2).

**Fonte**: PDF oficial da Portaria 146/2021 publicado no DOU (fornecido pelo usuário), Anexo II. Também foi encontrado, na versão completa do Guia de Referência Metodológica da PNP (`grm-2020-isbn-revisado.pdf`, fornecido pelo usuário), a fórmula geral confirmada `Meq = M × FECH × FEC` (implementação Tableau oficial da PNP) e a definição exata de FECH (= 1 para todos os cursos exceto Qualificação Profissional/FIC, onde FECH = CHMR/800) — sem nenhum fator de "duração do ciclo" na fórmula geral do Meq, o que descarta a hipótese de que a duração do curso entraria diretamente no FECH.
- **Atualização (26/07/2026)**: isso não resolve o mistério da "Matrícula Total equalizada" (Q/AI de `COMPLETO PROPOSTA`, seção 4.1) — e agora temos certeza de que a resposta não está nem no Guia de Referência Metodológica da PNP. O usuário conseguiu a versão completa do livro (`grm-2020-isbn-revisado.pdf`, ISBN, 132 páginas, todas as que faltavam antes) e uma busca por "equalizada", "Matrícula Total", "COMPLETO PROPOSTA" e "matriz orçamentária" no texto inteiro não retornou nenhuma ocorrência — esse documento só define os indicadores de gestão da própria PNP (Meq, RAP, IEA/Ciclo, %ME), sem nenhum conceito de "matriz orçamentária" do CONIF. Confirma-se que a equalização usada na coluna Q é específica da metodologia orçamentária do CONIF (provavelmente do livro "A Matriz Orçamentária da Rede Federal de EPCT", Forplan 2025, ou de documentação interna do CONIF), não um indicador padrão da PNP — a fonte certa para resolver isso é CONIF/Forplan, não a PNP/SETEC.

*Fonte: [Portaria SETEC/MEC nº 51/2018](https://www.in.gov.br/materia/-/asset_publisher/Kujrw0TZC2Mb/content/id/51283320/do1-2018-11-22-portaria-n-51-de-21-de-novembro-de-2018-51283076), Art. 2º, Art. 3º e Anexo II.*

### 3.3 Percentuais Legais / IAPL (colunas T, U, V, W, X, Y, Z)
- **Fonte**: `PercentuaisLegais.csv` — **confirmado que bate com a planilha quando agregado corretamente.**
- `%ME Técnicos = SUM(Matrícula Equivalente | Técnicos) / SUM(Matrícula Equivalente | Geral)` por instituição/ano (idem para Formação de Professores e Proeja). Sempre somar os valores absolutos de todos os campi da instituição antes de dividir — nunca fazer média das porcentagens por campus.
- **Atenção — bug de escala confirmado**: os valores absolutos de "Matrícula Equivalente" em `PercentuaisLegais.csv` estão 100× maiores que o valor real (confirmado cruzando com `DadosGerais.csv` em 4 campi de 2 instituições diferentes — proporção de exatamente 100× em todos os casos). Isso não afeta o `%ME` (numerador e denominador inflados igualmente), mas **qualquer uso do valor absoluto precisa dividir por 100 antes**.
- Aplicar tiers da seção 2.1 em cada categoria, normalizar pelo total da rede e somar as 3 (`Z` = IAPL Equalizado).

---

## 4. `COMPLETO PROPOSTA` — cálculo por campus

Uma linha por campus + uma linha "REITORIA" por instituição + uma linha de total por instituição (`SUM`/`SUMIF` das linhas de campus, marcada com tipo `T`).

### 4.1 Dados de entrada por campus (hoje colados manualmente)

| Coluna | Descrição | Fonte pretendida | Observação |
|---|---|---|---|
| L | Quantidade de alunos Presencial (bruto) | `DadosGerais.csv`, soma de `Número de Matrículas` filtrando `ModalidadeEnsino = Educação Presencial` | Bate com o CSV (pequena defasagem de poucos %, provavelmente por data de extração) |
| M, N, O | Quantidade de alunos EAD / EAD MOOC / EAD Financiamento Próprio | `DadosGerais.csv`, filtrando modalidade e sub-tipo de EAD | O CSV atual não distingue "EAD comum" de "EAD MOOC" de "EAD Financiamento Próprio" — **é preciso confirmar com a PNP como essa segmentação é feita**, pois não há essa granularidade explícita nos CSVs atuais |
| Q | Matrículas Totais Presencial **equalizadas** | **NÃO é `Matrícula Equivalente \| Geral` do CSV** | Ver "Problemas conhecidos" — os valores não guardam proporção fixa com a Matrícula Equivalente do CSV (variação de 1,37× a 2,6× observada), indicando uma tabela de pesos por curso/carga-horária diferente, ausente dos 4 CSVs |
| R, S, T | Matrículas Totais EAD / EAD MOOC / EAD FP equalizadas | idem Q, mas para EAD | mesmo problema |
| AH | QACP — Quantidade de alunos presenciais | igual a L | |
| AI | MECHDA — Matrículas Equalizadas Presenciais | igual a Q (mesma fonte/problema) | |
| AK | VR — Valor de Ponderação de Renda | **não vem de nenhum CSV da PNP** | Vem de pesquisa de renda per capita dos estudantes (faixas da seção 2.1) |
| AX | QRIP — Alunos em Regime de Internato Pleno | **não vem de nenhum CSV da PNP** | Precisa de fonte externa |
| E | Ano de criação do campus | **não vem de nenhum CSV da PNP** | Usado para aplicar piso de campus novo (ativo se `ano >= 2018`) |

### 4.2 Fórmulas de cálculo (a partir dos dados acima)

```
Valor da Matrícula Total Presencial (MTP) =
    Valor_Matriz_Rede_liquido_Assistência / (Q_total_rede + R_total_rede*0,25 + T_total_rede*0,8)

Valor da Matrícula Total UAB/ETEC (25% do MTP) = MTP * 0,25
Valor da Matrícula Total Financiamento Próprio (80% do MTP) = MTP * 0,8

V (Valor Matriz Presencial do campus) = Q_campus * MTP
W (Valor Matriz EAD do campus)        = R_campus * (MTP * 0,25)
X (Valor Matriz EAD MOOC do campus)   = S_campus * (MTP * 0,8)   [ver nuance MOOC na planilha original]
Y (Valor Matriz EAD FP do campus)     = T_campus * MTP

H (Valor Matrículas Totais, com piso) =
    SE ano_criação_campus >= 2018:
        MAX(piso_campus_novo, J_campus)
    SENÃO:
        J_campus
    onde J_campus = V+W+X+Y (soma dos 4 valores de matriz do campus)
```

O "Valor da Matriz Rede líquido de Assistência" é o valor total anual da matriz (corrigido pelo IPCA, ver `DADOS BASE!I27`) **menos** o valor total da Assistência Estudantil do ano (`DADOS BASE!W42`), e menos a parcela reservada às Reitorias.

### 4.3 Distribuição de IEA / RAP / IAPL por campus

Os valores calculados em `INDICADORES` são por **instituição**, e são distribuídos aos campi **proporcionalmente à matrícula equalizada de cada campus dentro da instituição** (na prática, a planilha traz o valor total da instituição repetido na linha de "Total" tipo `T`, não distribuído campus a campus dentro de `COMPLETO PROPOSTA`):

```
AA (IEA Equalizado, linha de Total da instituição) = SUMIF(INDICADORES.Instituição = nome, INDICADORES.L)
AB (Valor IEA da instituição) = AA * (Valor_total_para_IEA_da_rede)
AC (RAP Proporcional) = SUMIF(INDICADORES.Instituição = nome, INDICADORES.R)
AD (Valor RAP da instituição) = AC * (Valor_total_para_RAP_da_rede)
AE (IAPL Equalizado) = SUMIF(INDICADORES.Instituição = nome, INDICADORES.Z)
AF (Valor IAPL da instituição) = AE * (Valor_total_para_IAPL_da_rede)
```

onde `Valor_total_para_IEA_da_rede = (Valor_Matriz_liquido_Assistência) * %_Proposto_IEA` (2,5%), e análogo para RAP (2,5%) e IAPL (5%).

### 4.4 Assistência Estudantil (colunas AH–AY)

Cálculo por campus, dividido por critério de Renda e IDH, e por modalidade (Presencial / EAD / RIP):

```
MECHDA (AI) = matrícula equalizada presencial do campus (mesma métrica de Q/AI, não CSV puro)
VR (AK) = peso médio de renda do campus (faixas da seção 2.1) — fonte externa
MECHDA*VR (AM) = AI * AK
Índice de Distribuição (AN) = AM_campus / SUM(AM de todos os campi presenciais)
Assistência Estudantil Presencial "% RENDA" (AO) = AN * Valor_Assistência_parcela_Renda_Presencial
[idem para "% IDH", e para EAD dividindo AI/AK por 4 — ver colunas AQ-AV]

Assistência Estudantil RIP (AY) = (QRIP_campus / SUM(QRIP rede)) * Valor_Assistência_RIP
```

**Nenhuma dessas variáveis de renda/IDH/RIP está nos 4 CSVs da PNP** — precisam vir de outra fonte (provavelmente uma pesquisa socioeconômica interna do CONIF/SETEC).

---

## 5. `RESUMO PROPOSTA` — consolidação por campus/instituição

```
Matriz Custeio (K) = Valor_Matrícula (G) + Valor_IEA (H) + Valor_RAP (I) + Valor_IAPL (J)
Anuidade CONIF (O) = Matriz_Custeio_da_instituição (K, linha Total) * 0,15%
Matriz Assistência Estudantil (M) = soma das parcelas de assistência do campus (Renda+IDH Presencial e EAD + RIP)
```

A linha "REITORIA" de cada instituição recebe uma fração fixa da matriz de custeio da rede, proporcional ao peso das matrículas da instituição na rede total, conforme o percentual de 10% reservado a reitorias (`DADOS BASE!J94`):

```
Matriz Reitoria (G, linha REITORIA) =
    (Matrículas_Totais_da_instituição / Matrículas_Totais_da_rede) * Valor_Total_Reservado_Reitorias
```

---

## 6. `COMPARATIVO` — comparação 2024/2025/2026 e trava de não-decréscimo

Compara, por instituição, Custeio e Assistência Estudantil de 2025 vs. 2026 calculado. Se o valor de 2026 for **menor** que o de 2025 para alguma instituição (`AG` ou `AL` negativos), a diferença negativa é somada como "complemento" (`AQ`, `AX`) — ou seja, **nenhuma instituição pode receber menos em 2026 do que recebeu em 2025**; o valor a complementar é somado ao total do orçamento antes de fechar a proposta (ver `DADOS BASE!M26/M27`, que ajusta o "Valor da Matriz 2025" pelo total a complementar).

## 7. `VALOR SPO` — conferência final

Junta Custeio + Assistência de 2025 (coluna `H`) e de 2026 (coluna `L`) por instituição, calcula a diferença (`M`) e a Anuidade CONIF final (`O` = Custeio 2026 × 0,15%). Serve como conferência do valor final por instituição frente ao SPO oficial.

---

## 8. CSVs adicionais disponíveis (pasta `Outros arquivos`) e para que servem

Além dos 4 CSVs principais, há mais 13 exportados da PNP. Utilidade de cada um para este sistema:

| Arquivo | Granularidade | Utilidade para a matriz |
|---|---|---|
| `TaxaEvasao.csv` | por curso, com `ModalidadeEnsino` | **Único arquivo com modalidade explícita a nível de curso** — usar para isolar matrículas presenciais no cálculo do RAP (ver seção 3.2). Também tem Taxa de Evasão por curso, útil para métricas auxiliares. |
| `ProfessoresPorInstituicao.csv` | por instituição, Titulação × Jornada de Trabalho | Confirma que o "Professor Equivalente" de `RelacaoAlunoProfessorRAP.csv` está correto (headcount ponderado por jornada bate). Não tem granularidade de campus nem separa por modalidade. |
| `SituacaoMatricula.csv` | por campus, `categoriaSituacao`/`nomeSituacao`/`FluxoRetido` | Situação anual de cada matrícula (Concluída/Em curso/Evadida, Em fluxo/Retido). Bate com o concluintes anual de `DadosGerais.csv`, **não** com o "ciclo" de `EficienciaAcademica.csv` — confirma que o indicador de ciclo não é reproduzível com os dados disponíveis. |
| `IndicadoresGastos.csv` | por instituição | Traz "Gastos Correntes por matrícula equivalente"; a Matrícula Equivalente implícita bate com `DadosGerais.csv` (não com a equalização Q/AI da matriz). Útil só para métricas de custo por aluno, não para replicar a matriz. |
| `PanoramaOrcamentario.csv` | por instituição | Execução orçamentária (dotação, empenhado, liquidado, pago) — útil para conferência do "Valor de Referência SPO", não entra na fórmula da matriz. |
| `CargosCarreira.csv`, `TecnicosAdmNivel.csv`, `TitulacaoDocente.csv` | por instituição | Quadro de pessoal (TAE, carreira, titulação). Não usados em nenhuma fórmula da matriz orçamentária mapeada. |
| `IndiceVerticalizacao.csv`, `OfertaVagasNoturnas.csv`, `RelacaoInscritosVagas.csv`, `ReservaVagas.csv`, `TaxaOcupacao.csv` | por campus/curso | Indicadores PNP não referenciados em nenhuma célula da planilha `5ª Fase`. Podem servir a outros painéis, mas não à matriz orçamentária. |

**Atualização (26/07/2026, auditoria de paridade)**: `CassificacaoRacialRendaSexo.csv` **foi removido da lista acima porque passou a ser usado**, fora do escopo desta auditoria original — um trabalho paralelo do usuário com o Claude Code (commit `4e4c809`, 24/07/2026, antes desta sessão de diagnóstico) ligou a dimensão `RendaFamiliar` desse CSV ao cálculo de VR (Valor de Ponderação de Renda) da Assistência Estudantil (seção 4.4). Confirmado: os valores de `RendaFamiliar` no banco batem exatamente com a notação das 6 faixas de RFP da seção 2 (`"0<RFP<=0,5"` etc.), a granularidade é por instituição (não por campus — `unidadeId` sempre nulo nesse CSV), e não é coincidência de nome de campo. **Porém não existe nenhuma validação desse cálculo contra o valor oficial da planilha** — nem a planilha nem o `golden_values_indicadores.csv` trazem Assistência Estudantil para comparar. Tratado no código com o mesmo padrão de aviso "não validado" usado para RAP/IEA (`blocoAssistenciaEstudantil.ts`, `TabelaDistribuicao.tsx`).

Nenhum desses 13 arquivos traz a tabela de pesos por curso/carga-horária necessária para reproduzir a "Matrícula Total equalizada" (Q/AI). **Mas essa tabela existe e é pública**: é o Anexo II da Portaria SETEC/MEC nº 51/2018, salva em `Outros arquivos/FEC_Portaria51_2018_AnexoII.csv` (>400 combinações de curso/eixo tecnológico com seus fatores de esforço). Da mesma forma, o indicador de eficiência acadêmica por ciclo/coorte **está documentado e já implementado** em `EficienciaAcademica.csv` — não precisava de fonte externa, só da fórmula certa (seção 3.1). O que ainda falta confirmar com CONIF/SETEC é como a "Matrícula Total equalizada" da matriz (Q/AI) se relaciona com a Matrícula-equivalente oficial — ver seção 9, item 2.

| Arquivo adicional | Fonte | Utilidade |
|---|---|---|
| `FEC_Portaria51_2018_AnexoII.csv` | [Portaria SETEC/MEC nº 51/2018](https://www.in.gov.br/materia/-/asset_publisher/Kujrw0TZC2Mb/content/id/51283320/do1-2018-11-22-portaria-n-51-de-21-de-novembro-de-2018-51283076), Anexo II | Tabela oficial de Fator de Esforço de Curso (FEC) e Carga Horária Mínima Regulamentada (CHMR) por Tipo de Curso × Eixo Tecnológico × Curso — usada na fórmula oficial de Matrícula-equivalente (seção 3.2.1). Nota: pode estar desatualizada (a Portaria prevê revisão a cada 2 anos); ao testar contra `DadosGerais.csv` a conciliação não fechou exatamente — ver ressalva na seção 3.2.1. |

## 8.1 Dataset de referência para testes automatizados (`golden_values_indicadores.csv`)

Arquivo extraído diretamente da aba `INDICADORES` da planilha (valores hardcoded, ano-base 2024), com uma linha por instituição: `Conclusao_Ciclo`, `Evasao_Ciclo`, `Retencao_Ciclo`, `Eficiencia_Academica`, `RAP_Presencial`, `MEqRAP_Pres`, `Professor_Equivalente`, `pctME_Tecnicos`, `pctME_FormProf`, `pctME_Proeja`. Use este arquivo como **golden dataset** para testes automatizados: depois de implementar a ingestão/cálculo a partir dos CSVs da PNP, gerar os mesmos indicadores por instituição e comparar contra este arquivo linha a linha, com tolerância pequena (ex.: 1–2% para RAP/IEA reconstruídos por aproximação, praticamente 0% para %ME). CEFET-MG, CEFET-RJ e CPII aparecem com 0 nos `pctME` porque a fórmula original da planilha (`Z39`/`Z40`) referencia outra célula em vez de calcular localmente — não é erro de dado, é particularidade da planilha original.

## 9. Problemas conhecidos nos CSVs atuais (confirmados por comparação numérica)

Ver relatório completo em `Comparacao_CSV_vs_Matriz_5aFase.md`. Resumo do que precisa de correção antes ou durante a ingestão:

1. **RAP**: `RelacaoAlunoProfessorRAP.csv` não separa presencial de EaD; a matriz usa RAP presencial, exatamente como definido no Art. 5º da Portaria SETEC/MEC nº 51/2018 (ver seção 3.2 — fórmula oficial confirmada). Usar o CSV como está superestima o RAP em até +157% (média +13,4% entre 40 instituições comparadas), inflando indevidamente a faixa de peso do RAP na distribuição de recursos. **Ação**: usar `TaxaEvasao.csv` para filtrar matrículas presenciais no numerador (reduz o erro para a faixa de +0,9% a +53% nos casos testados) como aproximação; para fechar 100%, recalcular a Matrícula-equivalente presencial com a fórmula oficial (Mateq = Mat×fech×fec, seção 3.2.1) em vez de matrícula simples. O "Professor Equivalente" (denominador) já está correto, não precisa de ajuste.

2. **Matrículas Totais equalizadas** (coluna Q/AI de `COMPLETO PROPOSTA`, a base do maior componente da matriz — Valor da Matrícula): não é igual a `Matrícula Equivalente | Geral` de nenhum CSV disponível, nem à Matrícula-equivalente oficial recalculada com a tabela do Anexo II da Portaria 51/2018 (seção 3.2.1) — a razão entre Q/AI e a Matrícula Equivalente do CSV varia por campus (1,37× a 2,6× observado). **Ação**: confirmar com CONIF/SETEC a fonte/fórmula exata dessa equalização — provavelmente incorpora um fator adicional de duração do ciclo do curso (mencionado no glossário da Portaria 51/2018 mas não detalhado na fórmula operacional que conseguimos acessar), ou vem de uma seção do Guia de Referência Metodológica da PNP não disponível publicamente na busca (páginas 65–104, sobre composição de painéis de matrícula).

3. **Eficiência Acadêmica (IEA)**: **fórmula oficial confirmada e já implementada corretamente em `EficienciaAcademica.csv`** (ver seção 3.1) — o indicador de "ciclo" (coorte) é real, documentado no Guia de Referência Metodológica da PNP, e o CSV já traz o IEA calculado por essa fórmula, por campus. O problema não é a fórmula em si, é a **agregação para instituições com muitos campi**: some as contagens absolutas (Concluídos/Evadidos/Retidos) de todos os campi da instituição antes de calcular os percentuais e aplicar a fórmula — nunca calcule a média dos IEA% já prontos por campus. Essa agregação bate quase exatamente (~1pp) para instituições pequenas (ex.: IFAC), mas **diverge fortemente para redes grandes — até 53pp em IFSUL, 44pp em IFMG, 41pp em IFRS, 27pp em IFSULDEMINAS** (achado por teste de regressão contra as 41 instituições, 26/07/2026; ver ressalva crítica na seção 3.1). Duas hipóteses testadas (câmpus novo, baixo volume de registros) foram descartadas — causa raiz ainda não identificada, precisa de confirmação com CONIF/SETEC/PNP. Tratado no código como indicador informativo (sem tolerância rígida de pass/fail), não como valor validado universalmente.

4. **Percentuais Legais**: `PercentuaisLegais.csv`, agregado corretamente por instituição (soma dos valores absolutos, não média de percentuais), bate quase exatamente com a planilha **em termos percentuais**. Porém **os valores absolutos de "Matrícula Equivalente" nesse arquivo estão inflados em exatamente 100×** (confirmado cruzando com `DadosGerais.csv` em 4 campi) — dividir por 100 sempre que usar o valor absoluto, não apenas a razão.

5. **Dados inexistentes em qualquer um dos 17 CSVs**: alunos RIP, distinção EAD comum/MOOC/Financiamento Próprio, ano de criação do campus, IPCA, valor de referência SPO, valor de assistência do ano anterior, tabela de pesos por curso para equalização de matrículas. Todos precisam de fonte separada — não tentar derivá-los dos CSVs da PNP.

   **Correção (26/07/2026)**: faixa/peso de renda per capita (RFP) da Assistência Estudantil **não é mais um dado inexistente** — está em `CassificacaoRacialRendaSexo.csv` (dimensão `RendaFamiliar`, granularidade por instituição), e já foi ligado ao cálculo de VR (ver seção 8, nota de atualização, e item 6 abaixo). O que falta não é o dado, é a **validação**.

6. **Assistência Estudantil — VR (peso de renda) e divisão por câmpus**: o VR por instituição já é calculado com dado real (`CassificacaoRacialRendaSexo.csv`), mas sem nenhuma validação contra o valor oficial da planilha (não há como comparar hoje — nem a planilha nem o golden dataset trazem Assistência Estudantil). Além disso, esse CSV só tem granularidade por **instituição**, não por campus — a divisão do valor entre os câmpus de uma mesma instituição usa matrícula ponderada como proxy do peso de renda real de cada câmpus, o que pode distorcer a distribuição interna mesmo que o total da instituição esteja certo. Ambos os pontos estão avisados no código (`blocoAssistenciaEstudantil.ts`, memória de cálculo em `TabelaDistribuicao.tsx`), não escondidos, mas seguem sem confirmação externa.
