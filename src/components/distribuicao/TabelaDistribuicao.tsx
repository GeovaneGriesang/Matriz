"use client";

import { Fragment, useState } from "react";
import { ESTRATEGIA_FAIXAS_IEA_INFO } from "@/calculation-engine/constants/qualidadeEficiencia.constants";
import type { EstrategiaFaixasIea } from "@/calculation-engine/types/qualidadeEficiencia.types";

interface DetalheFuncionamento {
  /**
   * "oficial" = Matrícula Total equalizada da CONIF (MatriculaTotalEqualizadaAnual); "placeholder" =
   * "Matrícula Equivalente | Geral" da PNP, usada só quando não há dado oficial para o câmpus/ano.
   * Ausente em execuções anteriores a essa distinção — sempre eram "placeholder".
   */
  fonteMatricula?: "oficial" | "placeholder" | "mista";
  /** Presentes só quando fonteMatricula é "oficial". */
  matriculaOficialPresencial?: number;
  matriculaOficialEad?: number;
  matriculaOficialEadMooc?: number;
  matriculaOficialEadFp?: number;
  matriculaPonderadaCampus: number;
  totalMatriculaPonderadaRede: number;
  /** Matrículas antes da equalização MECHDA da PNP — ausente em execuções anteriores a essa exibição. */
  matriculasBrutasCampus?: number;
  totalMatriculasBrutasRede?: number;
  share: number;
  pesoBloco: number;
  valorBlocoRede: number;
  /**
   * Taxa (MTP, R$ por ponto ponderado) e o adicional de EAD MOOC — pago à mesma MTP, mas somado
   * depois de calculada (não dilui a taxa dos demais câmpus da rede). `share`/`valorBlocoRede` acima
   * já refletem só Presencial/EAD/EAD FP (pesos 1/0,25/0,8); EAD MOOC (peso 0,8) entra separado
   * aqui. Ausentes em execuções anteriores aos pesos por modalidade.
   */
  mtp?: number;
  valorMoocAdicional?: number;
  /** Piso Mínimo do Bloco Funcionamento para câmpus criados a partir de 2018 (0 = regra desativada). */
  pisoMinimoCampusNovo: number;
  pisoAplicado: boolean;
  valorAntesDoPiso: number;
  valorReais: number;
}

interface DetalheIea {
  /**
   * "oficial" = Eficiência Acadêmica informada pela CONIF (EficienciaAcademicaAnual); "aproximado" =
   * calculado agregando Concluídos/Evadidos/Retidos de EficienciaAcademica.csv por instituição (ver
   * MemoriaIea). Ausente em execuções anteriores a essa distinção — sempre eram "aproximado".
   */
  fonte?: "oficial" | "aproximado";
  /** Somas das contagens absolutas (Concluídos/Evadidos/Retidos) de todos os câmpus da instituição. */
  concluidos: number;
  evadidos: number;
  retidos: number;
  /** C_ciclo/Ev_ciclo/R_ciclo institucionais, calculados sobre a soma acima. */
  cCiclo: number;
  evCiclo: number;
  rCiclo: number;
  /** IEA institucional, calculado uma única vez a partir das somas (nunca por câmpus). */
  valorIea: number;
  /** Qual tabela de faixas/pesos enquadrou este IEA — sempre exibido explicitamente na memória de cálculo. */
  estrategia: EstrategiaFaixasIea;
  /** IEA × peso da faixa da instituição (Figura 7 do livro da Matriz). */
  ponderadoInstituicao: number;
  somaPonderadosRede: number;
  share: number;
  pesoSubBloco: number;
  valorSubBlocoRede: number;
  valorReais: number;
}

interface DetalheRap {
  /**
   * "oficial" = RAPP (RAP Presencial) informado pela CONIF (RappAnual); "aproximado" = calculado com
   * matrícula bruta presencial de TaxaEvasao.csv (ver MemoriaRap). Ausente em execuções anteriores
   * a essa distinção — sempre eram "aproximado".
   */
  fonte?: "oficial" | "aproximado";
  /** Somas de matrículas presenciais (aproximação, ver MemoriaRap) e Professor Equivalente de todos os câmpus da instituição. */
  matriculasPresenciais: number;
  professorEquivalente: number;
  /** RAP Presencial institucional (aproximado) = matriculasPresenciais ÷ professorEquivalente, calculado uma única vez. */
  razaoDocenteAluno: number;
  /** RAP × peso da faixa da instituição (Figura 9 do livro da Matriz). */
  ponderadoInstituicao: number;
  somaPonderadosRede: number;
  share: number;
  pesoSubBloco: number;
  valorSubBlocoRede: number;
  valorReais: number;
}

interface DetalheIaplCategoria {
  matriculas: number;
  matriculasGeral: number;
  /** %ME = matriculas ÷ matriculasGeral, enquadrado na tabela de faixas/pesos da categoria. */
  percentualMe: number;
  peso: number;
  /** Ponderado = %ME × peso — base do rateio entre instituições. */
  ponderado: number;
  somaPonderadosRede: number;
  share: number;
  valorCategoriaRede: number;
  valorReais: number;
}

interface DetalheIapl {
  tecnicos: DetalheIaplCategoria;
  formacaoProfessores: DetalheIaplCategoria;
  proeja: DetalheIaplCategoria;
  pesoSubBloco: number;
  valorSubBlocoRede: number;
  valorTotal: number;
}

interface DetalheQualidadeEficiencia {
  iea: DetalheIea | null;
  rap: DetalheRap | null;
  iapl: DetalheIapl | null;
  valorTotal: number;
}

interface DetalheAssistenciaEstudantil {
  vrInstituicao: number;
  /** MECHDA institucional = Matrícula Ponderada Presencial + (Matrícula Ponderada EAD ÷ 4). */
  mechdaInstituicao: number;
  participacaoPonderadaInstituicao: number;
  somaParticipacoesRede: number;
  shareInstituicao: number;
  valorOrcamentoAssistenciaEstudantil: number;
  valorInstituicao: number;
  matriculaPonderadaCampus: number;
  matriculaPonderadaInstituicao: number;
  shareDentroInstituicao: number;
  valorReais: number;
}

interface DetalheReitoria {
  /** Mesma fonte usada no Bloco Funcionamento (ver DetalheFuncionamento), agregada por instituição. */
  fonteMatricula?: "oficial" | "placeholder" | "mista";
  numeroInstituicoes: number;
  matriculaPonderadaInstituicao: number;
  totalMatriculaPonderadaRede: number;
  share: number;
  pesoBloco: number;
  valorBlocoRede: number;
  valorReais: number;
}

interface DetalheAnuidadeConif {
  custeioInstituicao: number;
  percentualAnuidade: number;
  valorReais: number;
}

export interface UnidadeResultado {
  id: number;
  nome: string;
  funcionamentoValorReais: number;
  assistenciaEstudantilValorReais: number;
  subtotalReais: number;
  detalheFuncionamento: DetalheFuncionamento | null;
  detalheAssistenciaEstudantil: DetalheAssistenciaEstudantil | null;
}

export interface InstituicaoResultado {
  id: number;
  sigla: string;
  nome: string;
  reitoriaValorReais: number;
  qualidadeEficienciaValorReais: number;
  /** Percentual sobre o Custeio já distribuído — informativo, não incluído em `subtotalReais`. */
  anuidadeConifValorReais: number;
  unidades: UnidadeResultado[];
  subtotalReais: number;
  detalheReitoria: DetalheReitoria | null;
  detalheQualidadeEficiencia: DetalheQualidadeEficiencia | null;
  detalheAnuidadeConif: DetalheAnuidadeConif | null;
}

export interface CalculationRunDetail {
  run: {
    id: number;
    status: string;
    ano: number | null;
    anoOrcamento: number | null;
    orcamentoTotal: number | null;
    orcamentoAssistenciaEstudantil: number | null;
    percentualAnuidade: number | null;
    pisoMinimoCampusNovo: number | null;
    startedAt: string;
    finishedAt: string | null;
    errorMessage: string | null;
  };
  instituicoes: InstituicaoResultado[];
  totalGeralReais: number;
}

const formatoMoeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const formatoPercentual = new Intl.NumberFormat("pt-BR", { style: "percent", minimumFractionDigits: 2 });
const formatoNumero = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 4 });

function ItemMemoria({ children }: { children: React.ReactNode }) {
  return <li className="text-neutral-700 dark:text-neutral-300">{children}</li>;
}

/**
 * Transparência normativa: explicita que a Matrícula Equivalente (MECHDA) já vem calculada pela
 * PNP — este sistema não reaplica os pesos oficiais (modalidade, laboratórios, retenção etc.),
 * só consome o valor final, para não contá-los em dobro.
 */
function NotaNormativaMechda() {
  return (
    <div className="rounded-md border border-neutral-300 bg-neutral-100 p-3 text-xs text-neutral-700 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
      🩶 <strong>Parâmetro Normativo (fonte: PNP):</strong> a Matrícula Equivalente (MECHDA) já é calculada pela
      Plataforma Nilo Peçanha, aplicando a metodologia oficial de pesos por modalidade de ensino (Presencial,
      EaD Recurso Próprio, EaD Fomento Externo), número de laboratórios, piso de cursos Integrados, bônus de
      cursos agrícolas/pós-graduação e desconto por retenção acima de 1.095 dias. Este sistema consome o valor
      final já equalizado pela PNP por câmpus/curso — não reaplica esses pesos, para evitar contá-los em dobro.
    </div>
  );
}

function MemoriaFuncionamento({ detalhe }: { detalhe: DetalheFuncionamento }) {
  const fonteMatricula = detalhe.fonteMatricula ?? "placeholder";
  const temMatriculasBrutas =
    fonteMatricula !== "oficial" && detalhe.matriculasBrutasCampus !== undefined && detalhe.matriculasBrutasCampus > 0;
  const temPesosPorModalidade = fonteMatricula === "oficial" && detalhe.mtp !== undefined;
  return (
    <div className="flex flex-col gap-2">
      <ul className="list-disc space-y-1 pl-5">
        {fonteMatricula === "oficial" ? (
          temPesosPorModalidade ? (
            <ItemMemoria>
              <strong>Matrícula Total equalizada oficial (informada pela CONIF), pesos por modalidade:</strong>{" "}
              Presencial {formatoNumero.format(detalhe.matriculaOficialPresencial ?? 0)} × 1,0 + EaD{" "}
              {formatoNumero.format(detalhe.matriculaOficialEad ?? 0)} × 0,25 + EaD FP{" "}
              {formatoNumero.format(detalhe.matriculaOficialEadFp ?? 0)} × 0,8 ={" "}
              <strong>{formatoNumero.format(detalhe.matriculaPonderadaCampus)}</strong> (EaD MOOC entra à parte, ver
              abaixo — não dilui a taxa dos demais câmpus)
            </ItemMemoria>
          ) : (
            <ItemMemoria>
              <strong>Matrícula Total equalizada oficial (informada pela CONIF):</strong> Presencial{" "}
              {formatoNumero.format(detalhe.matriculaOficialPresencial ?? 0)} + EaD{" "}
              {formatoNumero.format(detalhe.matriculaOficialEad ?? 0)} + EaD MOOC{" "}
              {formatoNumero.format(detalhe.matriculaOficialEadMooc ?? 0)} + EaD FP{" "}
              {formatoNumero.format(detalhe.matriculaOficialEadFp ?? 0)} ={" "}
              <strong>{formatoNumero.format(detalhe.matriculaPonderadaCampus)}</strong>
            </ItemMemoria>
          )
        ) : (
          <ItemMemoria>
            <strong>Aproximação:</strong> Matrícula Total equalizada oficial ainda não cadastrada para este
            câmpus/ano — usando &quot;Matrícula Equivalente | Geral&quot; (PNP) como placeholder (ver
            /admin/dados-anuais).
          </ItemMemoria>
        )}
        {temMatriculasBrutas && (
          <ItemMemoria>
            Matrículas brutas do câmpus (antes da equalização MECHDA):{" "}
            <strong>{formatoNumero.format(detalhe.matriculasBrutasCampus as number)}</strong> → Matrícula
            Equivalente (após MECHDA, fonte PNP):{" "}
            <strong>{formatoNumero.format(detalhe.matriculaPonderadaCampus)}</strong> (fator médio{" "}
            {formatoNumero.format(detalhe.matriculaPonderadaCampus / (detalhe.matriculasBrutasCampus as number))})
          </ItemMemoria>
        )}
        <ItemMemoria>
          Matrícula Ponderada do câmpus: <strong>{formatoNumero.format(detalhe.matriculaPonderadaCampus)}</strong> ÷
          total da rede <strong>{formatoNumero.format(detalhe.totalMatriculaPonderadaRede)}</strong> = participação{" "}
          <strong>{formatoPercentual.format(detalhe.share)}</strong>
        </ItemMemoria>
        <ItemMemoria>
          Bloco Funcionamento: {formatoPercentual.format(detalhe.pesoBloco)} × Base de cálculo ={" "}
          {formatoMoeda.format(detalhe.valorBlocoRede)}
          {temPesosPorModalidade && (
            <> (Taxa/MTP = {formatoMoeda.format(detalhe.valorBlocoRede)} ÷{" "}
            {formatoNumero.format(detalhe.totalMatriculaPonderadaRede)} ={" "}
            <strong>{formatoMoeda.format(detalhe.mtp as number)}</strong> por ponto ponderado)</>
          )}
        </ItemMemoria>
        <ItemMemoria>
          Valor do câmpus (Presencial/EaD/EaD FP): {formatoPercentual.format(detalhe.share)} ×{" "}
          {formatoMoeda.format(detalhe.valorBlocoRede)} ={" "}
          <strong>
            {formatoMoeda.format(detalhe.share * detalhe.valorBlocoRede)}
          </strong>
        </ItemMemoria>
        {temPesosPorModalidade && (detalhe.valorMoocAdicional ?? 0) > 0 && (
          <ItemMemoria>
            Adicional EaD MOOC: {formatoNumero.format(detalhe.matriculaOficialEadMooc ?? 0)} × 0,8 ×{" "}
            {formatoMoeda.format(detalhe.mtp as number)} ={" "}
            <strong>{formatoMoeda.format(detalhe.valorMoocAdicional as number)}</strong> (mesma Taxa/MTP, somado
            depois — não reduz a taxa dos demais câmpus)
          </ItemMemoria>
        )}
        <ItemMemoria>
          Total do câmpus:{" "}
          <strong>{formatoMoeda.format(detalhe.pisoAplicado ? detalhe.valorAntesDoPiso : detalhe.valorReais)}</strong>
        </ItemMemoria>
        {detalhe.pisoAplicado && (
          <ItemMemoria>
            Piso Mínimo por Câmpus Novo aplicado: valor calculado{" "}
            {formatoMoeda.format(detalhe.valorAntesDoPiso)} ficou abaixo do piso de{" "}
            {formatoMoeda.format(detalhe.pisoMinimoCampusNovo)} — usado o piso.{" "}
            <strong>{formatoMoeda.format(detalhe.valorReais)}</strong>
          </ItemMemoria>
        )}
      </ul>
      {temMatriculasBrutas && <NotaNormativaMechda />}
    </div>
  );
}

/**
 * `detalhe` é um snapshot JSON persistido em `CalculationResult.detalhe` — não tem validação de
 * schema em tempo de execução, então execuções antigas (calculadas por uma versão anterior do
 * motor de cálculo) podem chegar aqui sem os campos que a interface promete. Renderizar direto
 * quebra a página (visto ao rodar o sistema: execuções oficiais #219–#221 travavam a tela de
 * Consulta com "Cannot read properties of undefined"). Em vez de mostrar números incompletos
 * (NaN), avisamos que a memória de cálculo detalhada não está disponível para essa execução.
 */
function MemoriaIndisponivel({ valorReais }: { valorReais: number }) {
  return (
    <p className="text-neutral-500 dark:text-neutral-400">
      Esta execução foi calculada por uma versão anterior do motor de cálculo e não guardou os
      dados necessários para a memória de cálculo detalhada deste sub-bloco. Valor distribuído:{" "}
      <strong>{formatoMoeda.format(valorReais)}</strong>. Recalcule para ver o detalhe completo.
    </p>
  );
}

function MemoriaIea({ detalhe }: { detalhe: DetalheIea }) {
  if (detalhe.estrategia === undefined) {
    return <MemoriaIndisponivel valorReais={detalhe.valorReais} />;
  }
  const fonte = detalhe.fonte ?? "aproximado";
  return (
    <ul className="list-disc space-y-1 pl-5">
      {fonte === "oficial" ? (
        <ItemMemoria>
          <strong>Eficiência Acadêmica oficial (informada pela CONIF):</strong>{" "}
          <strong>{formatoPercentual.format(detalhe.valorIea)}</strong> — cadastrada em /admin/dados-anuais,
          substitui integralmente a agregação aproximada de EficienciaAcademica.csv para esta instituição/ano.
        </ItemMemoria>
      ) : (
        <>
          <ItemMemoria>
            <strong>Eficiência Acadêmica aproximada (agregação de EficienciaAcademica.csv):</strong> a Portaria
            SETEC/MEC 646/2022 exclui cursos FIC do &quot;ciclo&quot;, mas o CSV da PNP não distingue tipo de
            curso — a agregação diverge do valor oficial em redes com muitos câmpus (erro observado de até
            ~53pp/392% em IFSUL/IFRS/IFMG/IFSULDEMINAS). Usado só porque não há Eficiência Acadêmica oficial
            cadastrada em /admin/dados-anuais para esta instituição/ano. Ver Metodologia seção 3.1.
          </ItemMemoria>
          <ItemMemoria>
            Concluídos {formatoNumero.format(detalhe.concluidos)} + Evadidos {formatoNumero.format(detalhe.evadidos)} +
            Retidos {formatoNumero.format(detalhe.retidos)} (soma de todos os câmpus da instituição) → C_ciclo{" "}
            <strong>{formatoPercentual.format(detalhe.cCiclo)}</strong>, Ev_ciclo{" "}
            <strong>{formatoPercentual.format(detalhe.evCiclo)}</strong>, R_ciclo{" "}
            <strong>{formatoPercentual.format(detalhe.rCiclo)}</strong>
          </ItemMemoria>
          <ItemMemoria>
            IEA = C_ciclo + R_ciclo × (C_ciclo ÷ (C_ciclo + Ev_ciclo)) ={" "}
            <strong>{formatoPercentual.format(detalhe.valorIea)}</strong> — calculado uma única vez para a
            instituição (nunca por câmpus)
          </ItemMemoria>
        </>
      )}
      <ItemMemoria>
        Faixas usadas para enquadrar o IEA:{" "}
        <strong>{ESTRATEGIA_FAIXAS_IEA_INFO[detalhe.estrategia].label}</strong>
        <span className="block text-neutral-500 dark:text-neutral-400">
          {ESTRATEGIA_FAIXAS_IEA_INFO[detalhe.estrategia].descricao}
        </span>
      </ItemMemoria>
      <ItemMemoria>
        IEA Ponderado = IEA × peso da faixa: <strong>{formatoNumero.format(detalhe.ponderadoInstituicao)}</strong>
      </ItemMemoria>
      <ItemMemoria>
        IEA Equalizado = ponderado da instituição {formatoNumero.format(detalhe.ponderadoInstituicao)} ÷ soma de
        ponderados da rede {formatoNumero.format(detalhe.somaPonderadosRede)} = participação{" "}
        <strong>{formatoPercentual.format(detalhe.share)}</strong>
      </ItemMemoria>
      <ItemMemoria>
        Sub-bloco IEA: {formatoPercentual.format(detalhe.pesoSubBloco)} × Base de cálculo ={" "}
        {formatoMoeda.format(detalhe.valorSubBlocoRede)}
      </ItemMemoria>
      <ItemMemoria>
        Valor da instituição: {formatoPercentual.format(detalhe.share)} × {formatoMoeda.format(detalhe.valorSubBlocoRede)}{" "}
        = <strong>{formatoMoeda.format(detalhe.valorReais)}</strong>
      </ItemMemoria>
    </ul>
  );
}

function MemoriaRap({ detalhe }: { detalhe: DetalheRap }) {
  if (detalhe.razaoDocenteAluno === undefined) {
    return <MemoriaIndisponivel valorReais={detalhe.valorReais} />;
  }
  const fonte = detalhe.fonte ?? "aproximado";
  return (
    <ul className="list-disc space-y-1 pl-5">
      {fonte === "oficial" ? (
        <ItemMemoria>
          <strong>RAP Presencial oficial (informado pela CONIF):</strong>{" "}
          <strong>{formatoNumero.format(detalhe.razaoDocenteAluno)}</strong> — cadastrado em
          /admin/dados-anuais, substitui integralmente a aproximação via TaxaEvasao.csv para esta
          instituição/ano.
        </ItemMemoria>
      ) : (
        <>
          <ItemMemoria>
            <strong>RAP Presencial aproximado (TaxaEvasao.csv):</strong> calculado com matrícula bruta
            presencial, não com Matrícula-equivalente presencial oficial (Portaria SETEC/MEC nº
            51/2018). Erro esperado entre +0,9% e +53% dependendo da instituição — usado só porque não
            há RAPP oficial cadastrado em /admin/dados-anuais para esta instituição/ano.
          </ItemMemoria>
          <ItemMemoria>
            Matrículas Presenciais {formatoNumero.format(detalhe.matriculasPresenciais)} ÷ Professor Equivalente{" "}
            {formatoNumero.format(detalhe.professorEquivalente)} (somas de todos os câmpus da instituição) = RAP
            Presencial <strong>{formatoNumero.format(detalhe.razaoDocenteAluno)}</strong> — calculado uma única vez
            para a instituição (nunca por câmpus)
          </ItemMemoria>
        </>
      )}
      <ItemMemoria>
        RAP Ponderado = RAP × peso da faixa: <strong>{formatoNumero.format(detalhe.ponderadoInstituicao)}</strong>
      </ItemMemoria>
      <ItemMemoria>
        RAP Equalizado = ponderado da instituição {formatoNumero.format(detalhe.ponderadoInstituicao)} ÷ soma de
        ponderados da rede {formatoNumero.format(detalhe.somaPonderadosRede)} = participação{" "}
        <strong>{formatoPercentual.format(detalhe.share)}</strong>
      </ItemMemoria>
      <ItemMemoria>
        Sub-bloco RAP: {formatoPercentual.format(detalhe.pesoSubBloco)} × Base de cálculo ={" "}
        {formatoMoeda.format(detalhe.valorSubBlocoRede)}
      </ItemMemoria>
      <ItemMemoria>
        Valor da instituição: {formatoPercentual.format(detalhe.share)} × {formatoMoeda.format(detalhe.valorSubBlocoRede)}{" "}
        = <strong>{formatoMoeda.format(detalhe.valorReais)}</strong>
      </ItemMemoria>
    </ul>
  );
}

function MemoriaIaplCategoria({ nome, detalhe }: { nome: string; detalhe: DetalheIaplCategoria }) {
  if (detalhe.percentualMe === undefined) {
    return (
      <ItemMemoria>
        <strong>{nome}</strong>: execução antiga, sem dado detalhado — valor distribuído:{" "}
        <strong>{formatoMoeda.format(detalhe.valorReais)}</strong>.
      </ItemMemoria>
    );
  }
  return (
    <ItemMemoria>
      <strong>{nome}</strong>: matrículas {formatoNumero.format(detalhe.matriculas)} ÷ matrícula geral{" "}
      {formatoNumero.format(detalhe.matriculasGeral)} = %ME <strong>{formatoPercentual.format(detalhe.percentualMe)}</strong>{" "}
      → peso da faixa {formatoNumero.format(detalhe.peso)} → ponderado {formatoNumero.format(detalhe.ponderado)} ÷
      soma da rede {formatoNumero.format(detalhe.somaPonderadosRede)} = participação{" "}
      {formatoPercentual.format(detalhe.share)} × {formatoMoeda.format(detalhe.valorCategoriaRede)} ={" "}
      <strong>{formatoMoeda.format(detalhe.valorReais)}</strong>
    </ItemMemoria>
  );
}

function MemoriaIapl({ detalhe }: { detalhe: DetalheIapl }) {
  return (
    <ul className="list-disc space-y-1 pl-5">
      <ItemMemoria>
        Sub-bloco IAPL: {formatoPercentual.format(detalhe.pesoSubBloco)} × Base de cálculo ={" "}
        {formatoMoeda.format(detalhe.valorSubBlocoRede)}, dividido nas 3 metas legais (Técnicos 70% / Formação de
        Professores 20% / Proeja 10%)
      </ItemMemoria>
      <MemoriaIaplCategoria nome="Técnicos" detalhe={detalhe.tecnicos} />
      <MemoriaIaplCategoria nome="Formação de Professores" detalhe={detalhe.formacaoProfessores} />
      <MemoriaIaplCategoria nome="Proeja" detalhe={detalhe.proeja} />
    </ul>
  );
}

function MemoriaQualidadeEficiencia({ detalhe }: { detalhe: DetalheQualidadeEficiencia }) {
  return (
    <div className="flex flex-col gap-3">
      <div>
        <p className="font-medium text-neutral-900 dark:text-neutral-100">IEA</p>
        {detalhe.iea ? <MemoriaIea detalhe={detalhe.iea} /> : <p className="text-neutral-500">Sem dado de IEA para este câmpus.</p>}
      </div>
      <div>
        <p className="font-medium text-neutral-900 dark:text-neutral-100">RAP</p>
        {detalhe.rap ? <MemoriaRap detalhe={detalhe.rap} /> : <p className="text-neutral-500">Sem dado de RAP para este câmpus.</p>}
      </div>
      <div>
        <p className="font-medium text-neutral-900 dark:text-neutral-100">IAPL</p>
        {detalhe.iapl ? <MemoriaIapl detalhe={detalhe.iapl} /> : <p className="text-neutral-500">Sem dado de IAPL para este câmpus.</p>}
      </div>
    </div>
  );
}

function MemoriaAssistenciaEstudantil({ detalhe }: { detalhe: DetalheAssistenciaEstudantil }) {
  return (
    <ul className="list-disc space-y-1 pl-5">
      <ItemMemoria>
        <strong>Não validado:</strong> a faixa de RFP vem de ClassificacaoRacialRendaSexo.csv — os rótulos
        batem exatamente com as faixas oficiais, mas o VR calculado nunca foi conferido contra a planilha
        oficial nem confirmado com CONIF/SETEC.
      </ItemMemoria>
      <ItemMemoria>
        Passo 1 — VR (RF Ponderada) da instituição (Σ % de matrículas em cada faixa de RFP × peso da faixa):{" "}
        <strong>{formatoNumero.format(detalhe.vrInstituicao)}</strong>
      </ItemMemoria>
      <ItemMemoria>
        Passo 2 — Participação = MECHDA × VR, onde MECHDA = Matrícula Ponderada Presencial + (Matrícula Ponderada EAD
        ÷ 4) = <strong>{formatoNumero.format(detalhe.mechdaInstituicao)}</strong> ×{" "}
        <strong>{formatoNumero.format(detalhe.vrInstituicao)}</strong> ={" "}
        <strong>{formatoNumero.format(detalhe.participacaoPonderadaInstituicao)}</strong> ÷ soma da rede{" "}
        <strong>{formatoNumero.format(detalhe.somaParticipacoesRede)}</strong> = participação{" "}
        <strong>{formatoPercentual.format(detalhe.shareInstituicao)}</strong>
      </ItemMemoria>
      <ItemMemoria>
        Valor da instituição: {formatoPercentual.format(detalhe.shareInstituicao)} ×{" "}
        {formatoMoeda.format(detalhe.valorOrcamentoAssistenciaEstudantil)} ={" "}
        <strong>{formatoMoeda.format(detalhe.valorInstituicao)}</strong>
      </ItemMemoria>
      <ItemMemoria>
        Passo 3 — a PNP só fornece a faixa de RFP por instituição, não por câmpus: o valor acima é subdividido
        entre os câmpus pela Matrícula Ponderada total (Presencial + EAD, sem o desconto de 1/4 do passo 2):
        Matrícula Ponderada do câmpus{" "}
        <strong>{formatoNumero.format(detalhe.matriculaPonderadaCampus)}</strong> ÷ total da instituição{" "}
        <strong>{formatoNumero.format(detalhe.matriculaPonderadaInstituicao)}</strong> = participação{" "}
        <strong>{formatoPercentual.format(detalhe.shareDentroInstituicao)}</strong>
      </ItemMemoria>
      <ItemMemoria>
        Valor do câmpus: {formatoPercentual.format(detalhe.shareDentroInstituicao)} ×{" "}
        {formatoMoeda.format(detalhe.valorInstituicao)} = <strong>{formatoMoeda.format(detalhe.valorReais)}</strong>
      </ItemMemoria>
    </ul>
  );
}

/**
 * Transparência pedagógica (plataforma tem fins didáticos): explicita que a subdivisão por câmpus
 * da Ação 2994 é uma aproximação, já que a PNP só entrega a faixa de RFP por instituição.
 */
function NotaMetodologicaAssistenciaEstudantil() {
  return (
    <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
      💡 <strong>Nota Metodológica sobre a Distribuição por Câmpus:</strong> Os dados oficiais de Renda Familiar Per
      Capita (RFP) extraídos da Plataforma Nilo Peçanha (PNP) são disponibilizados consolidados no nível
      Institucional. Para fins didáticos e de simulação, a verba apurada da Ação 2994 para a Instituição é
      distribuída entre seus câmpus proporcionalmente à Matrícula Ponderada de cada unidade.
    </div>
  );
}

function MemoriaReitoria({ detalhe }: { detalhe: DetalheReitoria }) {
  const fonteMatricula = detalhe.fonteMatricula ?? "placeholder";
  return (
    <ul className="list-disc space-y-1 pl-5">
      {fonteMatricula !== "oficial" && (
        <ItemMemoria>
          <strong>{fonteMatricula === "mista" ? "Fonte mista:" : "Aproximação:"}</strong>{" "}
          {fonteMatricula === "mista"
            ? "parte dos câmpus desta instituição já tem Matrícula Total equalizada oficial (CONIF), parte ainda usa o placeholder (\"Matrícula Equivalente | Geral\" da PNP) por falta de dado oficial para aquele câmpus/ano."
            : "nenhum câmpus desta instituição tem Matrícula Total equalizada oficial cadastrada para este ano — usando o placeholder (\"Matrícula Equivalente | Geral\" da PNP)."}
        </ItemMemoria>
      )}
      <ItemMemoria>
        Matrícula Ponderada da instituição (mesma base do Bloco Funcionamento, agregada por instituição — mas aqui
        EaD MOOC entra normalmente com peso 0,8, diferente do Bloco Funcionamento, que trata EaD MOOC à parte):{" "}
        <strong>{formatoNumero.format(detalhe.matriculaPonderadaInstituicao)}</strong> ÷ total da rede{" "}
        <strong>{formatoNumero.format(detalhe.totalMatriculaPonderadaRede)}</strong> = participação{" "}
        <strong>{formatoPercentual.format(detalhe.share)}</strong>
      </ItemMemoria>
      <ItemMemoria>
        Bloco Reitorias: {formatoPercentual.format(detalhe.pesoBloco)} × Base de cálculo ={" "}
        {formatoMoeda.format(detalhe.valorBlocoRede)}
      </ItemMemoria>
      <ItemMemoria>
        Valor da instituição: {formatoPercentual.format(detalhe.share)} × {formatoMoeda.format(detalhe.valorBlocoRede)} ={" "}
        <strong>{formatoMoeda.format(detalhe.valorReais)}</strong>
      </ItemMemoria>
    </ul>
  );
}

function MemoriaAnuidadeConif({ detalhe }: { detalhe: DetalheAnuidadeConif }) {
  return (
    <ul className="list-disc space-y-1 pl-5">
      <ItemMemoria>
        Custeio (20RL) já distribuído para a instituição (Funcionamento + Reitorias + Qualidade e Eficiência):{" "}
        <strong>{formatoMoeda.format(detalhe.custeioInstituicao)}</strong>
      </ItemMemoria>
      <ItemMemoria>
        Anuidade CONIF: {formatoPercentual.format(detalhe.percentualAnuidade / 100)} ×{" "}
        {formatoMoeda.format(detalhe.custeioInstituicao)} ={" "}
        <strong>{formatoMoeda.format(detalhe.valorReais)}</strong>
      </ItemMemoria>
      <ItemMemoria>
        Valor informativo — não é deduzido do Custeio distribuído acima nem do total geral desta tela.
      </ItemMemoria>
    </ul>
  );
}

function BotaoMemoria({ aberto, onClick }: { aberto: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-xs font-medium text-neutral-500 underline hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-100"
    >
      {aberto ? "Ocultar memória de cálculo" : "Ver memória de cálculo"}
    </button>
  );
}

function ToggleCampiIcon({ expandido }: { expandido: boolean }) {
  return (
    <span
      aria-hidden="true"
      className="flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border border-neutral-400 text-[10px] leading-none text-neutral-600 dark:border-neutral-600 dark:text-neutral-300"
    >
      {expandido ? "−" : "+"}
    </span>
  );
}

export function TabelaDistribuicao({
  detalhe,
  titulo,
  subtitulo,
}: {
  detalhe: CalculationRunDetail;
  /** Sobrescreve o título derivado de `detalhe.run` — usado quando `detalhe` agrega várias instituições/runs. */
  titulo?: string;
  /** Sobrescreve o texto explicativo abaixo do título. */
  subtitulo?: string;
}) {
  const [instituicoesAbertas, setInstituicoesAbertas] = useState<Set<number>>(new Set());
  const [unidadesAbertas, setUnidadesAbertas] = useState<Set<number>>(new Set());
  const [instituicoesExpandidas, setInstituicoesExpandidas] = useState<Set<number>>(new Set());
  const [filtroBloco, setFiltroBloco] = useState<"TUDO" | "20RL" | "2994">("TUDO");

  // Colunas de Reitoria/Funcionamento/Qualidade e Eficiência/Anuidade vêm do orçamento de Custeio
  // (20RL); Assistência Estudantil vem de um orçamento à parte (2994) — ver Metodologia seção 5.
  const mostrar20RL = filtroBloco !== "2994";
  const mostrar2994 = filtroBloco !== "20RL";
  const numeroColunas = 3 + (mostrar20RL ? 4 : 0) + (mostrar2994 ? 1 : 0);

  function alternar(conjunto: Set<number>, setConjunto: (s: Set<number>) => void, id: number) {
    const novo = new Set(conjunto);
    if (novo.has(id)) novo.delete(id);
    else novo.add(id);
    setConjunto(novo);
  }

  const instituicoesComCampi = detalhe.instituicoes.filter((i) => i.unidades.length > 0);
  const todasExpandidas =
    instituicoesComCampi.length > 0 && instituicoesComCampi.every((i) => instituicoesExpandidas.has(i.id));

  const todasUnidades = detalhe.instituicoes.flatMap((i) => i.unidades);
  const totalReitoriaRede = detalhe.instituicoes.reduce((soma, i) => soma + i.reitoriaValorReais, 0);
  const totalFuncionamentoRede = todasUnidades.reduce((soma, u) => soma + u.funcionamentoValorReais, 0);
  const totalQualidadeEficienciaRede = detalhe.instituicoes.reduce(
    (soma, i) => soma + i.qualidadeEficienciaValorReais,
    0,
  );
  const totalAssistenciaEstudantilRede = todasUnidades.reduce((soma, u) => soma + u.assistenciaEstudantilValorReais, 0);
  const totalAnuidadeConifRede = detalhe.instituicoes.reduce((soma, i) => soma + i.anuidadeConifValorReais, 0);

  function alternarTodasInstituicoes() {
    setInstituicoesExpandidas(todasExpandidas ? new Set() : new Set(instituicoesComCampi.map((i) => i.id)));
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
          {titulo ??
            (detalhe.run.anoOrcamento !== null
              ? `Execução #${detalhe.run.id} — orçamento oficial ${detalhe.run.anoOrcamento}`
              : `Execução #${detalhe.run.id} — ano ${detalhe.run.ano ?? "?"}`)}
        </h2>
        {detalhe.run.orcamentoTotal !== null && (
          <span className="text-sm text-neutral-500 dark:text-neutral-400">
            Custeio (20RL): {formatoMoeda.format(detalhe.run.orcamentoTotal)}
            {detalhe.run.orcamentoAssistenciaEstudantil ? (
              <> · Assist. Estudantil (2994): {formatoMoeda.format(detalhe.run.orcamentoAssistenciaEstudantil)}</>
            ) : null}
            {detalhe.run.percentualAnuidade ? (
              <> · Anuidade CONIF: {formatoPercentual.format(detalhe.run.percentualAnuidade / 100)}</>
            ) : null}
            {detalhe.run.pisoMinimoCampusNovo ? (
              <> · Piso Câmpus Novo: {formatoMoeda.format(detalhe.run.pisoMinimoCampusNovo)}</>
            ) : null}
          </span>
        )}
      </div>
      <p className="rounded-md bg-neutral-100 px-3 py-2 text-xs text-neutral-600 dark:bg-neutral-900 dark:text-neutral-400">
        {subtitulo ??
          (detalhe.run.anoOrcamento !== null
            ? `Calculado com base nos dados da PNP de ${detalhe.run.ano ?? "?"} (referência oficial: dois anos antes do orçamento).`
            : `Simulação executada com os dados da PNP de ${detalhe.run.ano ?? "?"}.`)}
      </p>

      {Boolean(detalhe.run.orcamentoAssistenciaEstudantil) && <NotaMetodologicaAssistenciaEstudantil />}

      <div className="flex flex-wrap items-center gap-3">
        {instituicoesComCampi.length > 0 && (
          <button
            type="button"
            onClick={alternarTodasInstituicoes}
            className="w-fit rounded-md border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
          >
            {todasExpandidas ? "Recolher todos os câmpus" : "Expandir todos os câmpus"}
          </button>
        )}
        <div className="flex items-center gap-1 text-xs">
          <span className="text-neutral-500 dark:text-neutral-400">Mostrar:</span>
          {(
            [
              { valor: "TUDO", label: "Tudo" },
              { valor: "20RL", label: "Custeio (20RL)" },
              { valor: "2994", label: "Assist. Estudantil (2994)" },
            ] as const
          ).map((opcao) => (
            <button
              key={opcao.valor}
              type="button"
              onClick={() => setFiltroBloco(opcao.valor)}
              className={`rounded-md border px-2.5 py-1 font-medium ${
                filtroBloco === opcao.valor
                  ? "border-neutral-900 bg-neutral-900 text-white dark:border-neutral-100 dark:bg-neutral-100 dark:text-neutral-900"
                  : "border-neutral-300 text-neutral-700 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
              }`}
            >
              {opcao.label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-h-[75vh] overflow-auto rounded-md">
        <table className="w-full min-w-max border-collapse text-sm">
          <thead>
            <tr className="border-b border-neutral-200 text-left text-neutral-500 dark:border-neutral-800 dark:text-neutral-400">
              <th className="sticky top-0 left-0 z-30 border-r border-neutral-200 bg-neutral-50 py-2 pr-4 dark:border-neutral-800 dark:bg-neutral-950">
                Instituição / Câmpus
              </th>
              <th className="sticky top-0 z-20 bg-neutral-50 py-2 pr-4 text-right dark:bg-neutral-950">
                Total distribuído (20RL + 2994)
              </th>
              {mostrar20RL && (
                <>
                  <th className="sticky top-0 z-20 bg-neutral-50 py-2 pr-4 text-right dark:bg-neutral-950">
                    Reitoria
                  </th>
                  <th className="sticky top-0 z-20 bg-neutral-50 py-2 pr-4 text-right dark:bg-neutral-950">
                    Funcionamento
                  </th>
                  <th className="sticky top-0 z-20 bg-neutral-50 py-2 pr-4 text-right dark:bg-neutral-950">
                    Qualidade e Eficiência
                  </th>
                </>
              )}
              {mostrar2994 && (
                <th className="sticky top-0 z-20 bg-neutral-50 py-2 pr-4 text-right dark:bg-neutral-950">
                  Assistência Estudantil
                </th>
              )}
              {mostrar20RL && (
                <th className="sticky top-0 z-20 bg-neutral-50 py-2 pr-4 text-right dark:bg-neutral-950">
                  Anuidade CONIF
                </th>
              )}
              <th className="sticky top-0 z-20 bg-neutral-50 py-2 pr-4 dark:bg-neutral-950" />
            </tr>
          </thead>
          <tbody>
            {detalhe.instituicoes.map((instituicao) => {
              const instituicaoAberta = instituicoesAbertas.has(instituicao.id);
              const temCampi = instituicao.unidades.length > 0;
              const campiVisiveis = temCampi && instituicoesExpandidas.has(instituicao.id);
              return (
                <Fragment key={`instituicao-frag-${instituicao.id}`}>
                  <tr className="group border-b border-neutral-100 font-medium text-neutral-900 even:bg-neutral-50 dark:border-neutral-900 dark:text-neutral-100 dark:even:bg-neutral-900/40">
                    <td className="sticky left-0 z-10 border-r border-neutral-200 bg-neutral-50 py-2 pr-4 group-even:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-950 dark:group-even:bg-neutral-900">
                      <div className="flex items-center gap-2">
                        {temCampi ? (
                          <button
                            type="button"
                            onClick={() => alternar(instituicoesExpandidas, setInstituicoesExpandidas, instituicao.id)}
                            aria-label={
                              campiVisiveis
                                ? `Recolher câmpus de ${instituicao.nome}`
                                : `Expandir câmpus de ${instituicao.nome}`
                            }
                            className="hover:bg-neutral-100 dark:hover:bg-neutral-800"
                          >
                            <ToggleCampiIcon expandido={campiVisiveis} />
                          </button>
                        ) : (
                          <span className="w-4 shrink-0" />
                        )}
                        <span>
                          {instituicao.sigla} — {instituicao.nome}
                        </span>
                      </div>
                    </td>
                    <td className="py-2 pr-4 text-right">{formatoMoeda.format(instituicao.subtotalReais)}</td>
                    {mostrar20RL && (
                      <>
                        <td className="py-2 pr-4 text-right">{formatoMoeda.format(instituicao.reitoriaValorReais)}</td>
                        <td className="py-2 pr-4 text-right">—</td>
                        <td className="py-2 pr-4 text-right">
                          {formatoMoeda.format(instituicao.qualidadeEficienciaValorReais)}
                        </td>
                      </>
                    )}
                    {mostrar2994 && <td className="py-2 pr-4 text-right">—</td>}
                    {mostrar20RL && (
                      <td className="py-2 pr-4 text-right">
                        {formatoMoeda.format(instituicao.anuidadeConifValorReais)}
                      </td>
                    )}
                    <td className="py-2 pr-4 text-right">
                      {(instituicao.detalheReitoria ||
                        instituicao.detalheQualidadeEficiencia ||
                        instituicao.detalheAnuidadeConif) && (
                        <BotaoMemoria
                          aberto={instituicaoAberta}
                          onClick={() => alternar(instituicoesAbertas, setInstituicoesAbertas, instituicao.id)}
                        />
                      )}
                    </td>
                  </tr>
                  {instituicaoAberta &&
                    (instituicao.detalheReitoria ||
                      instituicao.detalheQualidadeEficiencia ||
                      instituicao.detalheAnuidadeConif) && (
                    <tr className="border-b border-neutral-100 bg-neutral-100 dark:border-neutral-900 dark:bg-neutral-900">
                      <td colSpan={numeroColunas} className="px-4 py-3">
                        <div className="flex flex-col gap-4">
                          {instituicao.detalheReitoria && (
                            <div>
                              <p className="font-medium text-neutral-900 dark:text-neutral-100">Bloco Reitorias</p>
                              <MemoriaReitoria detalhe={instituicao.detalheReitoria} />
                            </div>
                          )}
                          {instituicao.detalheQualidadeEficiencia && (
                            <div>
                              <p className="font-medium text-neutral-900 dark:text-neutral-100">
                                Bloco Qualidade e Eficiência
                              </p>
                              <MemoriaQualidadeEficiencia detalhe={instituicao.detalheQualidadeEficiencia} />
                            </div>
                          )}
                          {instituicao.detalheAnuidadeConif && (
                            <div>
                              <p className="font-medium text-neutral-900 dark:text-neutral-100">Anuidade CONIF</p>
                              <MemoriaAnuidadeConif detalhe={instituicao.detalheAnuidadeConif} />
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                  {campiVisiveis &&
                    instituicao.unidades.map((unidade) => {
                      const unidadeAberta = unidadesAbertas.has(unidade.id);
                      return (
                        <Fragment key={`unidade-frag-${unidade.id}`}>
                          <tr className="group border-b border-neutral-100 text-neutral-700 even:bg-neutral-50 dark:border-neutral-900 dark:text-neutral-300 dark:even:bg-neutral-900/40">
                            <td className="sticky left-0 z-10 border-r border-neutral-200 bg-neutral-50 py-1.5 pr-4 pl-10 group-even:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-950 dark:group-even:bg-neutral-900">
                              {unidade.nome}
                            </td>
                            <td className="py-1.5 pr-4 text-right">{formatoMoeda.format(unidade.subtotalReais)}</td>
                            {mostrar20RL && (
                              <>
                                <td className="py-1.5 pr-4 text-right">—</td>
                                <td className="py-1.5 pr-4 text-right">
                                  {formatoMoeda.format(unidade.funcionamentoValorReais)}
                                </td>
                                <td className="py-1.5 pr-4 text-right">—</td>
                              </>
                            )}
                            {mostrar2994 && (
                              <td className="py-1.5 pr-4 text-right">
                                {formatoMoeda.format(unidade.assistenciaEstudantilValorReais)}
                              </td>
                            )}
                            {mostrar20RL && <td className="py-1.5 pr-4 text-right">—</td>}
                            <td className="py-1.5 pr-4 text-right">
                              {(unidade.detalheFuncionamento || unidade.detalheAssistenciaEstudantil) && (
                                <BotaoMemoria
                                  aberto={unidadeAberta}
                                  onClick={() => alternar(unidadesAbertas, setUnidadesAbertas, unidade.id)}
                                />
                              )}
                            </td>
                          </tr>
                          {unidadeAberta && (
                            <tr className="border-b border-neutral-100 bg-neutral-100 dark:border-neutral-900 dark:bg-neutral-900">
                              <td colSpan={numeroColunas} className="px-4 py-3">
                                <div className="flex flex-col gap-4">
                                  {unidade.detalheFuncionamento && (
                                    <div>
                                      <p className="font-medium text-neutral-900 dark:text-neutral-100">
                                        Bloco Funcionamento
                                      </p>
                                      <MemoriaFuncionamento detalhe={unidade.detalheFuncionamento} />
                                    </div>
                                  )}
                                  {unidade.detalheAssistenciaEstudantil && (
                                    <div>
                                      <p className="font-medium text-neutral-900 dark:text-neutral-100">
                                        Bloco Assistência Estudantil
                                      </p>
                                      <MemoriaAssistenciaEstudantil detalhe={unidade.detalheAssistenciaEstudantil} />
                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                </Fragment>
              );
            })}
          </tbody>
          <tfoot className="sticky bottom-0 z-20 bg-neutral-50 dark:bg-neutral-950">
            {mostrar20RL && (
              <tr className="border-t-2 border-neutral-300 font-medium text-neutral-800 dark:border-neutral-700 dark:text-neutral-200">
                <td className="pt-3 pr-4">Subtotal — Reitorias / Direção-Geral (rede)</td>
                <td className="pt-3 pr-4 text-right">{formatoMoeda.format(totalReitoriaRede)}</td>
                <td className="pt-3 pr-4 text-right">{formatoMoeda.format(totalReitoriaRede)}</td>
                <td className="pt-3 pr-4 text-right">—</td>
                <td className="pt-3 pr-4 text-right">—</td>
                {mostrar2994 && <td className="pt-3 pr-4 text-right">—</td>}
                <td className="pt-3 pr-4 text-right">—</td>
                <td className="pt-3 pr-4" />
              </tr>
            )}
            <tr className="border-t border-neutral-200 font-semibold text-neutral-900 dark:border-neutral-800 dark:text-neutral-100">
              <td className="py-3 pr-4">Total geral (rede)</td>
              <td className="py-3 pr-4 text-right">{formatoMoeda.format(detalhe.totalGeralReais)}</td>
              {mostrar20RL && (
                <>
                  <td className="py-3 pr-4 text-right">{formatoMoeda.format(totalReitoriaRede)}</td>
                  <td className="py-3 pr-4 text-right">{formatoMoeda.format(totalFuncionamentoRede)}</td>
                  <td className="py-3 pr-4 text-right">{formatoMoeda.format(totalQualidadeEficienciaRede)}</td>
                </>
              )}
              {mostrar2994 && (
                <td className="py-3 pr-4 text-right">{formatoMoeda.format(totalAssistenciaEstudantilRede)}</td>
              )}
              {mostrar20RL && (
                <td className="py-3 pr-4 text-right">{formatoMoeda.format(totalAnuidadeConifRede)}</td>
              )}
              <td className="py-3 pr-4" />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
