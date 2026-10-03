# Os dois arquivos de 2026 de 03/10: o que são e por que ainda não foram carregados

Análise de 2026-10-03 dos arquivos `20261003_participacao_orcamentaria_2026.xlsx` (rede) e `20261003_participacao_orcamentaria_2026_IFSul.xlsx`, ambos salvos na pasta da 5ª fase de 2026. Nada foi carregado no banco.

## O que cada um é

| Arquivo | Layout | Serve para |
|---|---|---|
| `..._2026.xlsx` (rede) | Relatório **resumido por curso**: 17 colunas, sem código de ciclo, 10.196 linhas, abas "Participação 2026", "Totais por instituição" e "Como na tela". | Conferir totais por instituição e por câmpus. **Não** serve para a carga por ciclo (o carregador agora o pula de propósito). |
| `..._2026_IFSul.xlsx` | Planilha **por ciclo com fórmulas** (1.743 ciclos), abas Parâmetros, CICLOS, CURSOS e CLASSIFICAÇÕES, o mesmo formato do arquivo do IFSul de 2027. | Daria a 6ª fase de 2026 do IFSul, hoje inexistente. |

## Por que o do IFSul não pode ser carregado como está

1. Na aba Parâmetros, as **matrículas totais da rede** são texto, não número ("MT_PRESENCIAL", "MT_EAD", "MT_MOOC", "MT_FP"). Sem elas não há valor da matrícula. O carregador para com "Aba Parâmetros sem número em B10".
2. O **período da PNP** está em 2025 (01/01/2025 a 31/12/2025). Para o ciclo 2026 o ano-base é 2024. Com 2025, o motor do sistema erra feio (Matrícula Total de 27.188 contra 38.642 da MDO); com 2024, erra 2,4% (37.729).
3. A Matrícula Total de cada ciclo vem como **valor** na planilha (soma 38.641,93, igual ao total do IFSul no resumo da rede), então o carregador usaria esse número e não o do motor. Já o valor em reais é fórmula sem resultado guardado: depende dos parâmetros acima.

As matrículas totais da rede dá para derivar do resumo (soma da Matrícula Total por forma de repasse: presencial 1.370.408,93; EAD 66.306,48; MOOC 23.139,69; FP 72.954,87). Foi assim que se confirmou que, em 2027, os parâmetros do arquivo do IFSul batem com o resumo (soma 1.594.996,32).

## O que o resumo da rede diz sobre os parâmetros de 2026

Valor por unidade de Matrícula Total, por forma de repasse (valor ÷ MT), com as razões em relação ao presencial:

| Repasse | 2026 | 2027 (resumo de 03/10) |
|---|---|---|
| Presencial | R$ 1.220,35 | R$ 1.239,71 |
| EAD | 0,25 | 0,25 |
| EAD FP | 0,80 | 0,80 |
| EAD MOOC | **0,80** | **0,80** |

- Em 2026 o MOOC a 0,8 é o esperado. **Em 2027 o resumo também usa 0,8**, enquanto a 5ª fase reexportada em 03/10 e o arquivo do IFSul de fórmulas usam 0,08. A diferença (R$ 50,4 mi) é exatamente o que faz o resumo de 2027 somar R$ 1.881,7 mi contra R$ 1.831,3 mi de fundo para matrículas.
- O valor da matrícula presencial de 2026 no resumo (R$ 1.220,35) é **3,9% maior** que o que o sistema usa hoje em 2026 (cerca de R$ 1.174, de ajuste R$ 148,8 mi, o do arquivo do IFSul). Por câmpus do IFSul a diferença é uniforme: Venâncio Aires R$ 1.630.467 no resumo contra R$ 1.568.448 no sistema, Pelotas R$ 9.924.290 contra R$ 9.546.793. O total do IFSul no resumo é R$ 40.898.767, sem o piso (os três câmpus só de piso, de R$ 700 mil, não aparecem nele).
- O resumo de 2026 distribui R$ 1.786,4 mi, mais que o que os parâmetros do arquivo do IFSul permitem (R$ 1.718,5 mi), o que implica um ajuste bem menor que os R$ 148,8 mi. Os arquivos de 2026 não são da mesma rodada.

## O que pedir ao IFTM

- O arquivo do IFSul de 2026 com as matrículas totais da rede preenchidas e o período da PNP em 2024.
- Qual é o ajuste (e o valor da matrícula presencial) válido para 2026: os R$ 148,8 mi do arquivo do IFSul ou o que o resumo implica.
- O MOOC de 2027 nos relatórios de participação (resumo e por ciclo): 0,08 como na 5ª fase, e não 0,8.

## Scripts desta análise

`scripts/_analise_participacao_resumida.ts` (valor por MT e soma de MT por repasse de um relatório resumido), `scripts/_analise_ifsul_2026.ts` (refaz a Matrícula Total do IFSul de 2026 com o motor), `scripts/_analise_5a_vs_6a.ts` (retrato da 5ª e da 6ª fase do IFSul no banco).
