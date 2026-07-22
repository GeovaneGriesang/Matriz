import chardet from "chardet";

export type SupportedEncoding = "UTF-8" | "ISO-8859-1";

function hasUtf8Bom(buffer: Buffer): boolean {
  return buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf;
}

function isValidUtf8(buffer: Buffer): boolean {
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(buffer);
    return true;
  } catch {
    return false;
  }
}

/** Detecta se um CSV da PNP está em UTF-8 ou ISO-8859-1 (as duas codificações suportadas). */
export function detectEncoding(buffer: Buffer): SupportedEncoding {
  if (hasUtf8Bom(buffer) || isValidUtf8(buffer)) {
    return "UTF-8";
  }

  const detectado = chardet.detect(buffer);
  if (detectado && /iso-8859-1|latin1|windows-1252/i.test(detectado)) {
    return "ISO-8859-1";
  }

  // Fallback: se não é UTF-8 válido e o chardet não confirma Latin-1 explicitamente,
  // assume ISO-8859-1 por ser a codificação alternativa mais comum em exports da PNP.
  return "ISO-8859-1";
}

/** Decodifica um buffer de CSV usando a codificação informada. */
export function decodeBuffer(buffer: Buffer, encoding: SupportedEncoding): string {
  const label = encoding === "UTF-8" ? "utf-8" : "iso-8859-1";
  return new TextDecoder(label).decode(buffer);
}
