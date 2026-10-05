import { CONHECIMENTO_GERAL, conhecimentoDaTela } from "./conhecimento";
import { itemAtivo } from "@/lib/menu";

export interface TurnoChat {
  papel: "usuario" | "assistente";
  texto: string;
}

export interface EntradaChat {
  /** Caminho da tela aberta, sem o prefixo /matriz. */
  rota: string;
  pergunta: string;
  historico: TurnoChat[];
  /** Números e filtros que a tela está mostrando, em texto. */
  contexto?: string;
}

export interface MensagemOllama {
  role: "system" | "user" | "assistant";
  content: string;
}

export const LIMITES_CHAT = {
  pergunta: 800,
  turno: 1200,
  turnosDeHistorico: 6,
  contexto: 2500,
} as const;

const INSTRUCOES = `Você é o assistente do sistema Matriz Orçamentária RFEPCT, usado por diretores e gestores do IFSul. Explique o sistema e comente a tela que a pessoa está vendo.
Regras:
- Responda sempre em português do Brasil, de forma curta e clara: no máximo 6 frases ou uma lista de até 5 itens.
- Use SOMENTE as informações abaixo (conhecimento geral, tela e dados da tela). Se a resposta não estiver nelas, diga que não sabe e sugira a página "Como funciona" ou falar com a equipe da matriz.
- Nunca invente número. Quando citar valor, copie dos "Dados da tela". Não faça contas longas; se pedirem uma conta, mostre os números e diga que a conta deve ser conferida na tela.
- Explique sigla que usar (MECHDA, ICQA, RAPP, IEA, IAML, PNP, LOA) na primeira vez.
- Não dê opinião política nem conselho financeiro pessoal. Não use travessão.`;

function cortar(texto: string, maximo: number): string {
  return texto.length <= maximo ? texto : `${texto.slice(0, maximo)}...`;
}

/** Monta a conversa que vai ao modelo: instruções com o conhecimento, o histórico recente e a pergunta. Pura, para poder ser testada. */
export function montarMensagens(entrada: EntradaChat): MensagemOllama[] {
  const tela = itemAtivo(entrada.rota);
  const partes = [INSTRUCOES, `CONHECIMENTO GERAL:\n${CONHECIMENTO_GERAL}`];
  if (tela) partes.push(`TELA ABERTA: "${tela.rotulo}". ${tela.descricao} ${conhecimentoDaTela(entrada.rota)}`.trim());
  if (entrada.contexto?.trim()) partes.push(`DADOS DA TELA (o que a pessoa está vendo agora):\n${cortar(entrada.contexto.trim(), LIMITES_CHAT.contexto)}`);

  const historico = entrada.historico.slice(-LIMITES_CHAT.turnosDeHistorico).map<MensagemOllama>((t) => ({
    role: t.papel === "usuario" ? "user" : "assistant",
    content: cortar(t.texto, LIMITES_CHAT.turno),
  }));
  return [{ role: "system", content: partes.join("\n\n") }, ...historico, { role: "user", content: cortar(entrada.pergunta.trim(), LIMITES_CHAT.pergunta) }];
}
