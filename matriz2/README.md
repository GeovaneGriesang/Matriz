# Matriz2

Consulta, comparação e simulação da Matriz de Distribuição Orçamentária da RFEPCT,
com foco no IFSul e no Câmpus Venâncio Aires.

> **Duas aplicações, um repositório.** O Matriz2 vive em `matriz2/`, com
> `package.json`, banco e ciclo de vida próprios. A aplicação original continua na
> raiz e é ela que roda em produção; as duas não compartilham código nem dados. O
> `tsconfig.json` da raiz exclui esta pasta, para que o build de produção não tente
> compilar a aplicação nova. Quando o Matriz2 substituir o Matriz, a raiz é que sai.

## A premissa, que é diferente da do projeto anterior

O sistema Matriz tentava **recalcular** a matriz a partir dos microdados da PNP. Não
funciona: três insumos centrais (Matrícula Total equalizada, RAPP e Eficiência
Acadêmica de ciclo) não são deriváveis da PNP, e os dados só fecham no fim do ano,
depois das seis fases de homologação.

O Matriz2 parte de outro lugar. A **MDO** (mdo.iftm.edu.br), sistema oficial da rede
operado pelo IFTM, já publica o resultado homologado em todos os níveis de detalhe.
Aqui a gente importa esse resultado e constrói em cima dele o que a MDO não oferece:

- comparação entre ciclos orçamentários (`/comparativo`);
- simulação de cenários de evasão (`/simulador`, primeira versão: reduzir a evasão de
  um câmpus e ver quanto ele recuperaria, em cima do valor que a MDO já publica);
- recorte pelo interesse do IFSul e de Venâncio Aires;
- cruzamento da distribuição com os microdados da PNP.

Consultar por consultar, a MDO já faz. O valor está no que vem depois.

## As sete etapas da MDO

Cada dado guarda em qual fase foi homologado, e por quem.

| Fase | Produz | Homologa |
|---|---|---|
| 1ª (a) Obtenção | Microdados da PNP | PNP |
| 1ª (b) Importação | Integração na base da MDO | MDO |
| 2ª Conferência da extração | Integridade das informações | Cada instituição |
| 3ª Parâmetros por câmpus | Tipologia e alunos RIP | Cada instituição |
| 4ª Checagem de matrículas | Matrículas totais | Cada instituição |
| 5ª Geração da proposta | Todos os blocos por câmpus | MDO |
| 6ª Participação | Valor de cada ciclo de curso | MDO |

## Procedência, que é requisito e não enfeite

Todo registro aponta para uma `FonteDados`, com quatro informações que a interface
mostra ao lado do número:

- **origem**: PNP, MDO do IFTM, calculado pelo sistema, ou informado pelo administrador;
- **data do dado**: a que a planilha declara ("Gerado em 30/08/2026"), diferente da data da carga;
- **abrangência**: rede completa, uma instituição, ou um câmpus;
- **ressalva**: por exemplo, que a 6ª fase de 2027 ainda estava em andamento na MDO.

A abrangência não é detalhe. Metade do material da MDO cobre apenas o IFSul; sem esse
campo, uma consulta de rede somaria 14 câmpus achando que somou 639.

## Como rodar

```bash
cd matriz2                    # a partir da raiz do repositório
npm install
npx prisma migrate dev
npm run carregar -- 2027      # carrega o ciclo 2027 a partir dos arquivos da MDO
npm run dev
```

O MySQL é o mesmo container da aplicação da raiz (`docker compose up -d` lá
resolve), em outro banco: `matriz2_dev`. Os dois nunca se tocam.

Os arquivos da MDO ficam **fora do repositório**, em
`_Matriz orçamentária - CONIF`. Aponte para outro lugar com a variável
`MATRIZ2_DADOS`.

`.env` também precisa de `ADMIN_PASSWORD` e `ADMIN_SESSION_SECRET`, só usados pela
área administrativa (ver abaixo). O resto do sistema é público e não exige login.

## Área administrativa

`/admin/login` autentica por senha (cookie assinado por HMAC, 8h de validade,
mesmo desenho do Matriz original). O cookie se chama `matriz2_admin_session`,
deliberadamente diferente do `admin_session` de lá: em produção os dois sistemas
respondem no mesmo domínio (`movaci.com.br/matriz` e `/matriz2`), e um nome igual
faria um login sobrescrever o cookie do outro sistema no navegador.

`/admin/orcamento` corrige à mão os 17 parâmetros de um `CicloOrcamento`, para
quando a MDO ainda não publicou algo ou publicou algo que já se sabe estar errado.
Salvar sobrescreve o ciclo inteiro e cria uma `FonteDados` com origem
`ADMINISTRADOR`; não há rastro de qual campo mudou, só de que o ciclo passou por
uma correção humana. A próxima carga (`npm run carregar`) daquele ano apaga a
correção e traz o valor da MDO de volta — de propósito: é uma ponte, não uma
decisão permanente.

## Conferência que o próprio dado oferece

O total do Bloco Funcionamento aparece de três formas independentes nas exportações,
e as três dão o mesmo número. Vale reproduzir isso depois de cada carga:

```
somando os 58.242 ciclos da 6ª fase ....... R$ 1.831.831.659,98
somando as linhas de câmpus da 5ª fase .... R$ 1.831.831.659,97
somando as linhas de instituição da 5ª ..... R$ 1.831.831.659,97
```

## Três armadilhas já pagas

**O Piso Mínimo é reservado do bolo, e a regra por câmpus é MAX.** A CONIF separa
R$ 37,1 milhões (53 × R$ 700.000) de dentro dos 80% e distribui o restante por
matrícula entre todos os câmpus; depois os 53 marcados recebem R$ 700.000 no lugar
do que calcularam. O sistema anterior aplica o mesmo `MAX`, mas **sem reservar o
piso antes de ratear**, então infla o bloco em R$ 40,4 milhões.

**A elegibilidade ao piso é uma bandeira, não uma regra.** A planilha marca com `S`
os câmpus elegíveis, e não há como deduzi-la do ano de criação: os 53 de 2027 foram
criados entre 2022 e 2026, e existem 21 câmpus criados de 2018 em diante que a
planilha não marca. O sistema anterior deduzia de `anoCriacao >= 2018` e chegava a 67.

**As linhas da 5ª fase vêm em três tipos.** A coluna TIPO separa `T` (total da
instituição), `R` (reitoria) e `C` (câmpus). Somar sem filtrar duplica todos os
totais, e a coluna do nome muda de significado conforme o tipo.

## Estado atual

Ciclo **2027** carregado e conferido nas duas fases:

| | |
|---|---|
| 6ª fase, por ciclo de curso | 58.242 registros, 42 instituições, 639 câmpus |
| 5ª fase, por câmpus | 706 câmpus, 42 reitorias, 53 elegíveis ao piso |
| 5ª fase, por instituição | 42, com IEA, RAP e IAPL homologados |
| Funcionamento distribuído | R$ 1.867.171.219,07 (80% declarado: R$ 1.868.931.660,00) |
| Assistência Estudantil | R$ 651.560.247,24 |

Pendente: o ciclo **2026**, cuja exportação traz as matrículas por câmpus gravadas
como zero, o que zera todo o Funcionamento derivado dela. Enquanto isso não se
resolver com o IFTM, 2026 só existe no nível de instituição, e a comparação entre
ciclos não desce ao câmpus.

Em aberto: a coluna `PORCENTAGEM` da aba RESUMO PROPOSTA é carregada mas não é
exibida, porque o significado dela não está confirmado (a soma das 42 instituições
dá 487%, então não é participação na rede).
