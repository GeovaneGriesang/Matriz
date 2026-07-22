import { describe, it, expect } from "vitest";
import { detectEncoding, decodeBuffer } from "@/ingestion/encoding/detectEncoding";

describe("detectEncoding", () => {
  it("detecta UTF-8 para um texto com acentuação em UTF-8", () => {
    const buffer = Buffer.from("Câmpus,Situação\nVenâncio Aires,Ativa\n", "utf-8");
    expect(detectEncoding(buffer)).toBe("UTF-8");
  });

  it("detecta UTF-8 quando há BOM", () => {
    const bom = Buffer.from([0xef, 0xbb, 0xbf]);
    const texto = Buffer.from("Campus,Situacao\n", "utf-8");
    expect(detectEncoding(Buffer.concat([bom, texto]))).toBe("UTF-8");
  });

  it("detecta ISO-8859-1 para bytes Latin-1 que não formam UTF-8 válido", () => {
    // "ção" em ISO-8859-1/Latin-1: byte 0xE7 ('ç') seguido de 0xE3 ('ã') não é uma
    // sequência UTF-8 válida quando decodificada estritamente.
    const buffer = Buffer.from([0x43, 0x61, 0x70, 0x61, 0x63, 0x69, 0x74, 0x61, 0xe7, 0xe3, 0x6f]); // "Capacitaçăo"-like bytes
    expect(detectEncoding(buffer)).toBe("ISO-8859-1");
  });
});

describe("decodeBuffer", () => {
  it("decodifica corretamente um buffer UTF-8 com acentuação", () => {
    const buffer = Buffer.from("Instituto Federal de Educação", "utf-8");
    expect(decodeBuffer(buffer, "UTF-8")).toBe("Instituto Federal de Educação");
  });

  it("decodifica corretamente um buffer ISO-8859-1", () => {
    const buffer = Buffer.from([0x45, 0x64, 0x75, 0x63, 0x61, 0xe7, 0xe3, 0x6f]); // "Educação" em Latin-1
    expect(decodeBuffer(buffer, "ISO-8859-1")).toBe("Educação");
  });
});
