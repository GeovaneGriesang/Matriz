import { describe, expect, it } from "vitest";
import { ehEmailInstitucional } from "@/lib/emailInstitucional";

describe("ehEmailInstitucional", () => {
  it("aceita o domínio do IFSul e seus subdomínios, sem diferenciar maiúsculas", () => {
    expect(ehEmailInstitucional("fulana.silva@ifsul.edu.br")).toBe(true);
    expect(ehEmailInstitucional("  Fulano@IFSUL.EDU.BR ")).toBe(true);
    expect(ehEmailInstitucional("alguem@va.ifsul.edu.br")).toBe(true);
  });

  it("recusa outros domínios, inclusive os parecidos", () => {
    expect(ehEmailInstitucional("fulana@gmail.com")).toBe(false);
    expect(ehEmailInstitucional("fulana@ifsul.edu.br.com")).toBe(false);
    expect(ehEmailInstitucional("fulana@falsoifsul.edu.br")).toBe(false);
    expect(ehEmailInstitucional("fulana@ifrs.edu.br")).toBe(false);
    expect(ehEmailInstitucional("sem-arroba")).toBe(false);
    expect(ehEmailInstitucional("a@b@ifsul.edu.br")).toBe(false);
  });
});
