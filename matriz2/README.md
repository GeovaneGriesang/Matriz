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
operado pelo IFTM, já publica o resultado homologado em todos os grãos. Aqui a gente
importa esse resultado e constrói em cima dele o que a MDO não oferece:

- comparação entre ciclos orçamentários;
- simulação de cenários ("e se este curso tivesse menos evasão?");
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

## Conferência que o próprio dado oferece

O total do Bloco Funcionamento aparece de três formas independentes nas exportações,
e as três dão o mesmo número. Vale reproduzir isso depois de cada carga:

```
somando os 58.242 ciclos da 6ª fase ....... R$ 1.831.831.659,98
somando as linhas de câmpus da 5ª fase .... R$ 1.831.831.659,97
somando as linhas de instituição da 5ª ..... R$ 1.831.831.659,97
```

## Duas armadilhas já pagas

**O Piso Mínimo é reservado, não somado.** A CONIF separa R$ 37,1 milhões de dentro
dos 80% do Funcionamento e distribui o resto por matrícula. O sistema anterior usava
`MAX(piso, calculado)`, que inflava o bloco e produzia 67 câmpus no piso onde a
planilha diz 53.

**As linhas da 5ª fase vêm em três tipos.** A coluna TIPO separa `T` (total da
instituição), `R` (reitoria) e `C` (câmpus). Somar sem filtrar duplica todos os
totais.

## Estado atual

Carregado e conferido: ciclo **2027** pela 6ª fase (58.242 ciclos, 42 instituições,
639 câmpus).

Pendente: a 5ª fase (grão de câmpus e instituição) e o ciclo 2026, cuja exportação
de 2026 traz as matrículas por câmpus gravadas como zero, o que zera todo o
Funcionamento derivado dela. Enquanto isso não se resolver com o IFTM, 2026 só
existe no grão de instituição.
