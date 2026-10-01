import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import zlib from "node:zlib";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/server/db/prisma";
import { pastaPnpProduto } from "./caminhos";
import { apagarFatosDaFonte } from "./apagarFatosPnp";
import { converterCelula, dividirLinha, normalizarNome } from "@/lib/pnp/csvPainel";
import { AgregadorMatriculas } from "@/lib/pnp/microdados";

/**
 * Carrega os microdados da PNP (`Produtos de dados/Microdados/microdados_<tipo>_<ano>.csv.gz`).
 *
 * Os quatro conjuntos NÃO entram linha a linha:
 *  - matrículas e eficiência acadêmica (uma linha por estudante, 79 colunas, mais de 2,3 milhões por ano)
 *    entram agregados por ciclo de curso, que é o grão da matriz;
 *  - servidores (uma linha por servidor) entram agrupados por lotação, classe, jornada, titulação e vínculo;
 *  - financeiro (liquidações por unidade orçamentária, ação e GND) entra somado.
 * Assim a análise não perde nada do que o cálculo usa e o banco não guarda dado pessoal. Os arquivos
 * originais seguem no disco, e recarregar só refaz o que mudou (SHA-256 do .gz).
 */

const LOTE = 2_000;
const ORIGEM = "PNP_MANUAL" as const;
type Tipo = "matriculas" | "eficiencia_academica" | "financeiro" | "servidores";

export interface ResultadoMicrodado {
  tipo: Tipo;
  ano: number;
  linhasLidas: number;
  linhasGravadas: number;
  situacao: "carregado" | "idêntico, pulado";
}

function sha256Arquivo(caminho: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const h = crypto.createHash("sha256");
    fs.createReadStream(caminho)
      .on("data", (d) => h.update(d))
      .on("end", () => resolve(h.digest("hex")))
      .on("error", reject);
  });
}

function linhasDoGz(caminho: string): readline.Interface {
  return readline.createInterface({ input: fs.createReadStream(caminho).pipe(zlib.createGunzip()), crlfDelay: Infinity });
}

const apagarDaFonte = (tabela: "PnpMicrodadoCiclo" | "PnpMicrodadoFinanceiro" | "PnpMicrodadoServidor", fonteDadosId: number) =>
  apagarFatosDaFonte(tabela, fonteDadosId);

const TEXTO_TIPO: Record<Tipo, string> = {
  matriculas: "matrículas (agregado por ciclo de curso)",
  eficiencia_academica: "eficiência acadêmica (agregado por ciclo de curso)",
  financeiro: "financeiro (somado por UO, ação e GND)",
  servidores: "servidores (agrupado por lotação e vínculo)",
};

export async function carregarPnpMicrodados(
  ciclo: number,
  aoProgredir: (mensagem: string) => void = () => {},
  filtro: { tipos?: Tipo[]; anos?: number[] } = {},
): Promise<{ pasta: string; resultados: ResultadoMicrodado[] } | null> {
  const pasta = pastaPnpProduto(ciclo, "Microdados");
  if (!fs.existsSync(pasta)) return null;

  const instituicoes = await prisma.instituicao.findMany({ select: { id: true, sigla: true } });
  const instituicaoPorNome = new Map(instituicoes.map((i) => [normalizarNome(i.sigla), i.id]));
  const unidades = await prisma.unidade.findMany({ select: { id: true, nome: true, instituicaoId: true } });
  const unidadePorNome = new Map(unidades.map((u) => [`${u.instituicaoId}|${normalizarNome(u.nome)}`, u.id]));

  const arquivos = fs
    .readdirSync(pasta)
    .map((nome) => ({ nome, m: nome.match(/^microdados_(matriculas|eficiencia_academica|financeiro|servidores)_(\d{4})\.csv\.gz$/) }))
    .filter((a): a is { nome: string; m: RegExpMatchArray } => a.m !== null)
    .map((a) => ({ caminho: path.join(pasta, a.nome), tipo: a.m[1] as Tipo, ano: Number(a.m[2]) }))
    .filter((a) => (!filtro.tipos || filtro.tipos.includes(a.tipo)) && (!filtro.anos || filtro.anos.includes(a.ano)))
    // Do ano mais recente para o mais antigo: o arquivo de 2025 escreve a instituição pela sigla, e os antigos pelo
    // nome por extenso; com os recentes primeiro, o código da instituição (Co Inst) já está aprendido quando chegam os antigos.
    .sort((a, b) => a.tipo.localeCompare(b.tipo) || b.ano - a.ano);

  const siglaPorId = new Map(instituicoes.map((i) => [i.id, i.sigla]));
  const instituicaoPorCoInst = new Map<string, number>();
  const resultados: ResultadoMicrodado[] = [];
  for (const { caminho, tipo, ano } of arquivos) {
    const nomeFonte = `PNP Microdados: ${TEXTO_TIPO[tipo]}, ano-base ${ano}`;
    const checksum = await sha256Arquivo(caminho);
    const anteriores = await prisma.fonteDados.findMany({
      where: { origem: ORIGEM, cicloOrcamento: ciclo, arquivo: nomeFonte },
      select: {
        id: true,
        checksum: true,
        _count: { select: { pnpMicrodadoCiclos: true, pnpMicrodadoFinanceiro: true, pnpMicrodadoServidores: true } },
      },
    });
    const registros = (f: (typeof anteriores)[number]) =>
      f._count.pnpMicrodadoCiclos + f._count.pnpMicrodadoFinanceiro + f._count.pnpMicrodadoServidores;
    const igual = anteriores.find((f) => f.checksum === checksum && registros(f) > 0);
    if (igual) {
      resultados.push({ tipo, ano, linhasLidas: 0, linhasGravadas: registros(igual), situacao: "idêntico, pulado" });
      continue;
    }
    for (const f of anteriores) {
      await apagarDaFonte("PnpMicrodadoCiclo", f.id);
      await apagarDaFonte("PnpMicrodadoFinanceiro", f.id);
      await apagarDaFonte("PnpMicrodadoServidor", f.id);
      await prisma.fonteDados.delete({ where: { id: f.id } });
    }
    const fonte = await prisma.fonteDados.create({
      data: {
        origem: ORIGEM,
        cicloOrcamento: ciclo,
        arquivo: nomeFonte,
        geradoEm: fs.statSync(caminho).mtime,
        abrangencia: "REDE",
        // O SHA-256 só entra quando o grupo termina de carregar: sem ele, a fonte é tratada como incompleta
        // e refeita, e uma carga interrompida no meio não é confundida com uma carga completa.
        checksum: null,
        ressalva:
          "PNP - Microdados, agregados antes de entrar no banco: não há uma linha por estudante ou servidor, só o que o cálculo da matriz usa. " +
          "A data é a de modificação do arquivo.",
      },
    });
    aoProgredir(`    ${path.basename(caminho)}`);

    let lidas = 0;
    let gravadas = 0;

    if (tipo === "matriculas" || tipo === "eficiencia_academica") {
      const ag = new AgregadorMatriculas();
      for await (const l of linhasDoGz(caminho)) ag.adicionar(l);
      lidas = ag.linhas;
      const lista = [...ag.ciclos.values()];
      for (let i = 0; i < lista.length; i += LOTE) {
        const dados: Prisma.PnpMicrodadoCicloCreateManyInput[] = lista.slice(i, i + LOTE).map((c) => {
          let instituicaoId = instituicaoPorNome.get(normalizarNome(c.instituicao)) ?? null;
          if (instituicaoId !== null && c.coInst) instituicaoPorCoInst.set(c.coInst, instituicaoId);
          else if (instituicaoId === null && c.coInst) instituicaoId = instituicaoPorCoInst.get(c.coInst) ?? null;
          const siglaDaInstituicao = instituicaoId !== null ? (siglaPorId.get(instituicaoId) ?? c.instituicao) : c.instituicao;
          return {
            fonteDadosId: fonte.id,
            tipo: tipo === "matriculas" ? "MATRICULAS" : "EFICIENCIA",
            anoBase: c.ano,
            ciclo: c.ciclo,
            coInst: c.coInst,
            codUnidade: c.codUnidade,
            codUnidadeSistec: c.codUnidadeSistec,
            instituicao: siglaDaInstituicao.slice(0, 60),
            unidadeEnsino: c.unidadeEnsino.slice(0, 191),
            uf: c.uf.slice(0, 4),
            codMunicipio: c.codMunicipio.slice(0, 12),
            cursoEmec: c.cursoEmec.slice(0, 20),
            nomeCurso: c.nomeCurso.slice(0, 255),
            tipoCurso: c.tipoCurso.slice(0, 80),
            tipoOferta: c.tipoOferta.slice(0, 60),
            modalidade: c.modalidade.slice(0, 60),
            fonteFinanciamento: c.fonteFinanciamento.slice(0, 100),
            programa: c.programa.slice(0, 150),
            eixo: c.eixo.slice(0, 120),
            subeixo: c.subeixo.slice(0, 120),
            turno: c.turno.slice(0, 30),
            formacaoProfessores: c.formacaoProfessores,
            cargaHoraria: c.cargaHoraria,
            cargaHorariaMinima: c.cargaHorariaMinima,
            fatorEsforco: c.fatorEsforco,
            inicio: c.inicio ? new Date(`${c.inicio}T00:00:00Z`) : null,
            fimPrevisto: c.fimPrevisto ? new Date(`${c.fimPrevisto}T00:00:00Z`) : null,
            vagas: c.vagas,
            inscritos: c.inscritos,
            matriculas: c.matriculas,
            atendidas: c.atendidas,
            porSituacao: c.porSituacao,
            porRenda: c.porRenda,
            instituicaoId,
            unidadeId: instituicaoId ? (unidadePorNome.get(`${instituicaoId}|${normalizarNome(c.unidadeEnsino)}`) ?? null) : null,
          };
        });
        await prisma.pnpMicrodadoCiclo.createMany({ data: dados });
        gravadas += dados.length;
      }
    } else if (tipo === "financeiro") {
      const soma = new Map<string, number>();
      let cab: string[] | null = null;
      for await (const l of linhasDoGz(caminho)) {
        if (!l) continue;
        const c = dividirLinha(l);
        if (!cab) {
          cab = c.map((x) => x.trim());
          continue;
        }
        lidas++;
        const g = (nome: string) => (c[cab!.indexOf(nome)] ?? "").trim();
        const valorBruto = c[cab.findIndex((n) => n.toUpperCase().startsWith("LIQUIDACOES"))] ?? "";
        const v = converterCelula(valorBruto);
        if (typeof v !== "number") continue;
        const k = `${g("Ano")}|${g("Unidade Orçamentária")}|${g("Ação Governo")}|${g("Grupo de Natureza de Despesa")}`;
        soma.set(k, (soma.get(k) ?? 0) + v);
      }
      const dados: Prisma.PnpMicrodadoFinanceiroCreateManyInput[] = [...soma].map(([k, v]) => {
        const [a, uo, acao, gnd] = k.split("|");
        return { fonteDadosId: fonte.id, anoBase: Number(a), unidadeOrcamentaria: uo!.slice(0, 20), acao: acao!.slice(0, 20), gnd: gnd!.slice(0, 10), liquidacoes: Math.round(v * 100) / 100 };
      });
      for (let i = 0; i < dados.length; i += LOTE) await prisma.pnpMicrodadoFinanceiro.createMany({ data: dados.slice(i, i + LOTE) });
      gravadas = dados.length;
    } else {
      const grupos = new Map<string, Prisma.PnpMicrodadoServidorCreateManyInput>();
      let cab: string[] | null = null;
      for await (const l of linhasDoGz(caminho)) {
        if (!l) continue;
        const c = dividirLinha(l);
        if (!cab) {
          cab = c.map((x) => x.trim());
          continue;
        }
        lidas++;
        const g = (nome: string, max = 191) => (c[cab!.indexOf(nome)] ?? "").trim().slice(0, max);
        const registros = Number((c[cab.indexOf("Número de registros")] ?? "1").trim()) || 1;
        const item = {
          codUnidade: g("Cod Unidade", 20),
          codUnidadeSistec: g("Código da Unidade de Ensino - SISTEC", 20),
          instituicao: g("Instituição", 60),
          unidadeLotacao: g("Unidade de Lotação"),
          municipio: g("Município", 120),
          codMunicipio: g("Código Municipio com DV", 12),
          regiao: g("Região", 30),
          classe: g("Classe", 20),
          jornada: g("Jornada de Trabalho", 20),
          rsc: g("RSC", 40),
          titulacao: g("Titulação", 60),
          vinculoCarreira: g("Vinculo Carreira", 40),
          vinculoContrato: g("Vinculo Contrato", 40),
          vinculoProfessor: g("Vinculo Professor", 10),
        };
        const k = JSON.stringify(item);
        const atual = grupos.get(k);
        if (atual) atual.registros += registros;
        else grupos.set(k, { fonteDadosId: fonte.id, anoBase: ano, ...item, registros });
      }
      const dados = [...grupos.values()];
      for (let i = 0; i < dados.length; i += LOTE) await prisma.pnpMicrodadoServidor.createMany({ data: dados.slice(i, i + LOTE) });
      gravadas = dados.length;
    }
    await prisma.fonteDados.update({ where: { id: fonte.id }, data: { checksum } });
    aoProgredir(`  ${tipo} ${ano}: ${lidas} linhas lidas, ${gravadas} gravadas`);
    resultados.push({ tipo, ano, linhasLidas: lidas, linhasGravadas: gravadas, situacao: "carregado" });
  }
  return { pasta, resultados };
}
