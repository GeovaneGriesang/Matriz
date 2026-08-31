# Carga Horária Mínima por Tipo de Curso e Nível de Ensino (CNCT/CNCST/DCNs/FIC)

Documento de referência, fornecido pelo usuário em 05/08/2026, combinando exigências do Catálogo
Nacional de Cursos Técnicos (CNCT), Catálogo Nacional de Cursos Superiores de Tecnologia (CNCST),
Diretrizes Curriculares Nacionais (CNE/MEC) e normativas de FIC. **Ainda não verificado célula a
célula contra os textos normativos primários por esta sessão** — tratar como candidato a fonte, não
como fórmula já validada (mesmo padrão de ressalva usado para outras tabelas normativas neste
projeto, ver `Metodologia_Matriz_Orcamentaria_CONIF.md`).

## Tabela

| Nível / Tipo de Curso | Formato / Modalidade | Regra de Carga Horária Mínima | Fonte Normativa |
|---|---|---|---|
| Formação Inicial e Continuada (FIC) | Qualificação Profissional Básica | Mínimo de 160h | Guia Pronatec / Portaria SETEC/MEC |
| Técnico de Nível Médio (Subsequente / Concorrente) | Gestão / Negócios / Turismo | Mínimo de 800h | CNCT / MEC |
| Técnico de Nível Médio (Subsequente / Concorrente) | Informática / Segurança | Mínimo de 1.000h | CNCT / MEC |
| Técnico de Nível Médio (Subsequente / Concorrente) | Indústria / Agro / Saúde / Infraestrutura | Mínimo de 1.200h | CNCT / MEC |
| Técnico Integrado ao Ensino Médio (EMI) | Cursos de 800h técnicas (ex.: Administração) | 3.000h total (2.200h FGB + 800h Técnica) | Resolução CNE/CP nº 1/2021 e LDB |
| Técnico Integrado ao Ensino Médio (EMI) | Cursos de 1.000h técnicas (ex.: Informática) | 3.000h a 3.200h total | Resolução CNE/CP nº 1/2021 e LDB |
| Técnico Integrado ao Ensino Médio (EMI) | Cursos de 1.200h técnicas (ex.: Refrigeração/Mecânica) | 3.200h a 3.600h total | Resolução CNE/CP nº 1/2021 e LDB |
| Ensino Médio Integrado - PROEJA | Educação de Jovens e Adultos com Técnico | Mínimo de 2.400h (1.200h FGB + 1.200h Profissional) | Decreto nº 5.840/2006 / CNE |
| Especialização Técnica de Nível Médio | Pós-Técnico | Mínimo de 300h (ou 25% da CH do curso base) | Resolução CNE/CP nº 1/2021 |
| Superior de Tecnologia (CST) | Eixo Gestão / Negócios | Mínimo de 1.600h | CNCST / MEC |
| Superior de Tecnologia (CST) | Eixo Informação / Infraestrutura | Mínimo de 2.000h | CNCST / MEC |
| Superior de Tecnologia (CST) | Eixo Controle / Processos Industriais | Mínimo de 2.400h | CNCST / MEC |
| Graduação - Licenciatura | Formação de Professores / Pedagogia | Mínimo de 3.200h (4 anos) | Resolução CNE/CP nº 2/2019 e DCNs |
| Graduação - Bacharelado | Áreas das Ciências Sociais / Gestão | Mínimo de 2.400h a 3.000h | Resolução CNE/CES nº 2/2007 |
| Graduação - Bacharelado | Engenharias / Agronomia / Computação | Mínimo de 3.600h (5 anos) | DCNs de Engenharia / CNE |
| Pós-Graduação Lato Sensu | Especialização / MBA | Mínimo de 360h | Resolução CNE/CES nº 1/2018 |
| Pós-Graduação Stricto Sensu | Mestrado Acadêmico / Profissional | Definido por créditos (geralmente ~360h a 450h de disciplinas + dissertação) | CAPES / MEC |
| Pós-Graduação Stricto Sensu | Doutorado | Definido por créditos (geralmente ~720h de disciplinas + tese) | CAPES / MEC |

## Observações sobre Estágio e Atividades Complementares

- **Cursos Técnicos e Tecnólogos**: quando o estágio curricular for obrigatório segundo o PPC e o
  CNCT/CNCST, a carga horária do estágio é adicionada à carga mínima do curso (não pode ser
  descontada da carga horária de aulas teórico-práticas).
- **Ensino Médio Integrado (EMI)**: a Formação Geral Básica (FGB) possui teto fixado em lei de
  1.800h a 2.400h, devendo a carga técnica do CNCT ser somada ou articulada de forma a respeitar
  tanto os limites mínimos do CNCT quanto a carga total exigida pelas normativas institucionais.

## Relação com os gaps já mapeados (ver `Metodologia_Matriz_Orcamentaria_CONIF.md`, seção 9, item 2)

Candidato a fonte para o "fator de equalização" residual (~1,57× de mediana, faixa 0,39×–4,66×) que
fica sobre a Matrícula-equivalente oficial (`Mateq = Mat × fech × fec`, Portaria 51/2018/146/2021) na
coluna Q/AI ("Matrícula Total equalizada") de `COMPLETO PROPOSTA` — hoje sem fonte documentada
identificada. **Duas limitações a resolver antes de tentar aplicar esta tabela a esse gap:**

1. **Granularidade**: esta tabela agrupa por categoria ampla ("Indústria/Agro/Saúde/Infraestrutura",
   "Eixo Gestão/Negócios"), não por curso/eixo tecnológico específico como a tabela FEC da Portaria
   146/2021 (>490 combinações exatas). Aplicá-la aos dados reais da PNP (`DadosGerais.csv`, que tem
   nome de curso + eixo tecnológico) exigiria um mapeamento curso→categoria, potencialmente
   ambíguo/heurístico, não uma junção direta por chave.
2. **Não é uma tabela de peso**: dá cargas horárias mínimas exigidas (compliance), não um fator
   multiplicador pronto. Qualquer fórmula de peso derivada dela (ex. `CH_curso / CH_referência`)
   seria uma construção nova desta sessão, não uma fórmula extraída diretamente da fonte normativa —
   precisaria ser tratada com a mesma ressalva "não validado" usada para outras aproximações do
   projeto até ser testada contra o fator residual observado.

Ainda não testada contra os dados reais. Próximo passo, se o usuário quiser avançar nessa frente: um
teste exploratório de correlação, análogo ao que já foi feito para a tabela FEC da Portaria 146/2021
(seção 3.2.1 de `Metodologia_Matriz_Orcamentaria_CONIF.md`).
