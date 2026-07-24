import { describe, it, expect } from "vitest";
import { blocoAssistenciaEstudantil } from "@/calculation-engine/blocoAssistenciaEstudantil";

describe("blocoAssistenciaEstudantil", () => {
  it("rateia entre instituições por MECHDA × VR (Passo 1: % na faixa × peso; Passo 2: Matrícula Ponderada × VR) e depois subdivide por câmpus pela Matrícula Ponderada", () => {
    const orcamentoAssistenciaEstudantil = 1_000_000;

    // Instituição 187: 100% das matrículas na faixa de peso 2,5 => VR = 1 × 2,5 = 2,5
    // Instituição 181: 1149 matrículas no total; só 100 (peso 0,5) contam, o resto tem peso 0.
    const rfpInputs = [
      { instituicaoId: 187, faixaRfp: "0<RFP<=0,5", numeroMatriculas: 100 },
      { instituicaoId: 181, faixaRfp: "2,5<RFP<=3,5", numeroMatriculas: 100 },
      { instituicaoId: 181, faixaRfp: "RFP>3,5", numeroMatriculas: 50 },
      { instituicaoId: 181, faixaRfp: "Não declarada", numeroMatriculas: 999 },
    ];

    // Instituição 187 tem 2 câmpus (MECHDA = 3000+1000 = 4000); instituição 181 tem 1 câmpus (MECHDA = 500).
    // Só matrícula presencial neste teste (EAD = 0), pra isolar o comportamento já coberto antes do desconto de 1/4.
    const campusInputs = [
      { campusId: 1, instituicaoId: 187, matriculaPonderadaPresencial: 3000, matriculaPonderadaEad: 0 },
      { campusId: 2, instituicaoId: 187, matriculaPonderadaPresencial: 1000, matriculaPonderadaEad: 0 },
      { campusId: 3, instituicaoId: 181, matriculaPonderadaPresencial: 500, matriculaPonderadaEad: 0 },
    ];

    const resultado = blocoAssistenciaEstudantil(rfpInputs, campusInputs, orcamentoAssistenciaEstudantil);

    const vr187 = (100 / 100) * 2.5; // = 2.5
    const vr181 = (100 / 1149) * 0.5 + (50 / 1149) * 0 + (999 / 1149) * 0;
    const mechda187 = 4000;
    const mechda181 = 500;
    const participacao187 = mechda187 * vr187;
    const participacao181 = mechda181 * vr181;
    const somaParticipacoes = participacao187 + participacao181;

    const valorInstituicao187 = (participacao187 / somaParticipacoes) * orcamentoAssistenciaEstudantil;
    const valorInstituicao181 = (participacao181 / somaParticipacoes) * orcamentoAssistenciaEstudantil;

    const porCampus = new Map(resultado.map((r) => [r.campusId, r]));

    expect(porCampus.get(1)?.vrInstituicao).toBeCloseTo(vr187, 6);
    expect(porCampus.get(3)?.vrInstituicao).toBeCloseTo(vr181, 6);
    expect(porCampus.get(1)?.valorReais).toBeCloseTo((3000 / 4000) * valorInstituicao187, 6);
    expect(porCampus.get(2)?.valorReais).toBeCloseTo((1000 / 4000) * valorInstituicao187, 6);
    expect(porCampus.get(3)?.valorReais).toBeCloseTo(valorInstituicao181, 6);

    const somaValores = resultado.reduce((s, r) => s + r.valorReais, 0);
    expect(somaValores).toBeCloseTo(orcamentoAssistenciaEstudantil, 6);
  });

  it("com o mesmo VR e o mesmo MECHDA (Matrícula Ponderada), duas instituições recebem a mesma fatia — o volume bruto de matrículas do dataset de RFP (por si só) não importa, só o % de cada faixa e a Matrícula Ponderada", () => {
    // Ambas 100% na faixa de peso 2,5 — mesmo VR (2,5) apesar de uma ter 10 matrículas no dataset de RFP e a outra 10.000.
    const rfpInputs = [
      { instituicaoId: 1, faixaRfp: "0<RFP<=0,5", numeroMatriculas: 10 },
      { instituicaoId: 2, faixaRfp: "0<RFP<=0,5", numeroMatriculas: 10_000 },
    ];
    // MECHDA (Matrícula Ponderada) igual para as duas — é isso que soma tamanho, não o dataset de RFP.
    const campusInputs = [
      { campusId: 1, instituicaoId: 1, matriculaPonderadaPresencial: 100, matriculaPonderadaEad: 0 },
      { campusId: 2, instituicaoId: 2, matriculaPonderadaPresencial: 100, matriculaPonderadaEad: 0 },
    ];

    const resultado = blocoAssistenciaEstudantil(rfpInputs, campusInputs, 1_000_000);
    const porCampus = new Map(resultado.map((r) => [r.campusId, r]));

    expect(porCampus.get(1)?.valorReais).toBeCloseTo(500_000, 6);
    expect(porCampus.get(2)?.valorReais).toBeCloseTo(500_000, 6);
  });

  it("instituição com MECHDA maior recebe mais, para o mesmo VR — o porte entra via MECHDA × VR", () => {
    const rfpInputs = [
      { instituicaoId: 1, faixaRfp: "0<RFP<=0,5", numeroMatriculas: 100 },
      { instituicaoId: 2, faixaRfp: "0<RFP<=0,5", numeroMatriculas: 100 },
    ];
    const campusInputs = [
      { campusId: 1, instituicaoId: 1, matriculaPonderadaPresencial: 100, matriculaPonderadaEad: 0 }, // MECHDA menor
      { campusId: 2, instituicaoId: 2, matriculaPonderadaPresencial: 300, matriculaPonderadaEad: 0 }, // MECHDA 3x maior
    ];

    const resultado = blocoAssistenciaEstudantil(rfpInputs, campusInputs, 1_000_000);
    const porCampus = new Map(resultado.map((r) => [r.campusId, r]));

    expect(porCampus.get(2)?.valorReais).toBeCloseTo(3 * (porCampus.get(1)?.valorReais ?? 0), 6);
    expect(porCampus.get(1)?.valorReais).toBeCloseTo(250_000, 6);
    expect(porCampus.get(2)?.valorReais).toBeCloseTo(750_000, 6);
  });

  it("MECHDA pondera matrícula EAD a 1/4 do peso da presencial — mesma matrícula presencial, mas uma instituição só tem EAD extra", () => {
    const rfpInputs = [
      { instituicaoId: 1, faixaRfp: "0<RFP<=0,5", numeroMatriculas: 100 },
      { instituicaoId: 2, faixaRfp: "0<RFP<=0,5", numeroMatriculas: 100 },
    ];
    const campusInputs = [
      // Instituição 1: só presencial -> MECHDA = 100
      { campusId: 1, instituicaoId: 1, matriculaPonderadaPresencial: 100, matriculaPonderadaEad: 0 },
      // Instituição 2: mesma presencial + 400 de EAD -> MECHDA = 100 + 400/4 = 200 (2x a da instituição 1)
      { campusId: 2, instituicaoId: 2, matriculaPonderadaPresencial: 100, matriculaPonderadaEad: 400 },
    ];

    const resultado = blocoAssistenciaEstudantil(rfpInputs, campusInputs, 1_000_000);
    const porCampus = new Map(resultado.map((r) => [r.campusId, r]));

    expect(porCampus.get(1)?.mechdaInstituicao).toBeCloseTo(100, 6);
    expect(porCampus.get(2)?.mechdaInstituicao).toBeCloseTo(200, 6);
    expect(porCampus.get(2)?.valorReais).toBeCloseTo(2 * (porCampus.get(1)?.valorReais ?? 0), 6);

    // A subdivisão por câmpus (aqui só 1 câmpus por instituição) usa a matrícula total (Presencial + EAD, sem
    // desconto), não o MECHDA — mas com 1 câmpus só, shareDentroInstituicao é sempre 1.0 e não muda o resultado.
    expect(porCampus.get(2)?.matriculaPonderadaCampus).toBeCloseTo(500, 6);
  });

  it("retorna lista vazia quando não há câmpus no escopo", () => {
    expect(blocoAssistenciaEstudantil([], [], 1_000_000)).toEqual([]);
  });

  it("dá share zero quando não há dado de RFP para a instituição do câmpus", () => {
    const resultado = blocoAssistenciaEstudantil(
      [],
      [{ campusId: 1, instituicaoId: 999, matriculaPonderadaPresencial: 100, matriculaPonderadaEad: 0 }],
      1_000_000,
    );

    expect(resultado).toHaveLength(1);
    expect(resultado[0]?.valorReais).toBe(0);
    expect(resultado[0]?.shareInstituicao).toBe(0);
  });

  it("faixas sem peso definido (RFP>3,5, não declarada, S/I) não recebem valor", () => {
    const resultado = blocoAssistenciaEstudantil(
      [
        { instituicaoId: 1, faixaRfp: "RFP>3,5", numeroMatriculas: 1000 },
        { instituicaoId: 1, faixaRfp: "Não declarada", numeroMatriculas: 1000 },
        { instituicaoId: 1, faixaRfp: "S/I", numeroMatriculas: 1000 },
        { instituicaoId: 2, faixaRfp: "0<RFP<=0,5", numeroMatriculas: 1 },
      ],
      [
        { campusId: 1, instituicaoId: 1, matriculaPonderadaPresencial: 100, matriculaPonderadaEad: 0 },
        { campusId: 2, instituicaoId: 2, matriculaPonderadaPresencial: 100, matriculaPonderadaEad: 0 },
      ],
      1_000_000,
    );

    const porCampus = new Map(resultado.map((r) => [r.campusId, r]));
    expect(porCampus.get(1)?.valorReais).toBe(0);
    expect(porCampus.get(2)?.valorReais).toBeCloseTo(1_000_000, 6);
  });
});
