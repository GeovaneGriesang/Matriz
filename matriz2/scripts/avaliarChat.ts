/**
 * Avalia o assistente do chat com perguntas cuja resposta é conhecida: tempo de cada resposta e se ela traz o que deveria.
 * Serve para comparar mudanças no texto de conhecimento, no prompt e no modelo, sempre com as mesmas perguntas.
 *
 * Uso: OLLAMA_URL=http://127.0.0.1:11435 npx tsx scripts/avaliarChat.ts [--so=1,2,3] [--sem-regras]
 *   (o modelo da VM escuta só em 127.0.0.1:11434 lá; para testar de fora, abra um túnel:
 *    ssh -f -N -L 11435:127.0.0.1:11434 -i ~/.ssh/matriz_vm root@<ip> </dev/null)
 *
 * Passa quando a resposta contém ao menos um dos trechos esperados (sem diferenciar maiúsculas nem acento).
 */
import { montarMensagens } from "../src/lib/chat/montarPrompt";
import { idDoModelo, rotuloDoModelo } from "../src/lib/chat/modelo";
import { respostaPronta } from "../src/lib/chat/respostasProntas";

interface Caso {
  id: number;
  rota: string;
  pergunta: string;
  /** Trechos aceitos; basta um. */
  esperado: string[];
  /** Trechos que NÃO podem aparecer (erro conhecido). */
  proibido?: string[];
}

const CASOS: Caso[] = [
  { id: 1, rota: "/como-funciona", pergunta: "Quantos por cento do orçamento vai para o bloco Funcionamento?", esperado: ["80"], proibido: ["funcionamento recebe 10%", "10% do orçamento vai para o bloco funcionamento"] },
  { id: 2, rota: "/como-funciona", pergunta: "Quanto é a fatia da Reitoria?", esperado: ["10%", "10 %"] },
  { id: 3, rota: "/como-funciona", pergunta: "Quanto o bloco Qualidade e Eficiência recebe do orçamento?", esperado: ["10%", "10 %"] },
  { id: 4, rota: "/como-funciona", pergunta: "Qual é o valor do Piso Mínimo para câmpus novos?", esperado: ["700"] },
  { id: 5, rota: "/como-funciona", pergunta: "Por quantos anos vale o Piso Mínimo de um câmpus novo?", esperado: ["5 anos", "cinco anos"] },
  { id: 6, rota: "/como-funciona", pergunta: "Quanto vale um aluno de curso MOOC em relação ao presencial?", esperado: ["8%", "8 %"] },
  { id: 7, rota: "/como-funciona", pergunta: "E a distância com financiamento externo, quanto vale?", esperado: ["25"] },
  { id: 8, rota: "/como-funciona", pergunta: "O que é o ICQA?", esperado: ["0,5", "metade", "fração"], proibido: ["Índice de Conclusão"] },
  { id: 9, rota: "/como-funciona", pergunta: "Por quanto tempo o aluno retido continua contando na matriz?", esperado: ["3 anos", "três anos"] },
  { id: 10, rota: "/como-funciona", pergunta: "A matriz de 2027 usa os dados da PNP de qual ano?", esperado: ["2025"] },
  { id: 11, rota: "/orcamento-da-uniao", pergunta: "A LOA tem valor por câmpus?", esperado: ["não", "nao"] },
  { id: 12, rota: "/orcamento-da-uniao", pergunta: "O que é a ação 2994?", esperado: ["assistência", "assistencia"] },
  { id: 13, rota: "/como-funciona", pergunta: "Qual o peso das licenciaturas?", esperado: ["2,5"] },
  { id: 14, rota: "/simulador/projecao", pergunta: "Que IA você é?", esperado: ["qwen"] },
  { id: 15, rota: "/como-funciona", pergunta: "Qual é a capital da França?", esperado: ["só posso ajudar", "não sei", "não conheço", "não tenho", "fora", "não posso", "não está"] },
  { id: 16, rota: "/simulador/projecao", pergunta: "O que esta tela mostra?", esperado: ["ciclos"] },
  // Perguntas redigidas de outro jeito (as respostas prontas não foram escritas olhando para elas):
  { id: 17, rota: "/como-funciona", pergunta: "Depois de tirar a Assistência, que parte do dinheiro fica com o Funcionamento?", esperado: ["80"] },
  { id: 18, rota: "/como-funciona", pergunta: "Em quanto tempo um câmpus novo deixa de ter direito ao mínimo de R$ 700 mil?", esperado: ["5 anos", "cinco anos"] },
  { id: 19, rota: "/como-funciona", pergunta: "O curso on-line aberto do tipo MOOC pesa quanto na conta?", esperado: ["8%"] },
  { id: 20, rota: "/como-funciona", pergunta: "Como é calculado o bloco da Reitoria?", esperado: ["10%", "matrícula total", "mesma base"] },
  { id: 21, rota: "/como-funciona", pergunta: "Os alunos que passaram do prazo do curso ainda contam para a matriz?", esperado: ["metade", "0,5", "3 anos", "três anos"] },
  { id: 22, rota: "/como-funciona", pergunta: "Qual ano de dados da PNP entra no cálculo de 2028?", esperado: ["2026", "dois anos antes"] },
  { id: 23, rota: "/orcamento-da-uniao", pergunta: "Qual é o orçamento do IFSul previsto para 2030?", esperado: ["não sei", "não tenho", "não está", "só posso", "não consta", "não há"] },
];

const normalizar = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

async function perguntarAoModelo(caso: Caso): Promise<{ texto: string; ms: number; tokens: number; tokensPorSegundo: number }> {
  const url = process.env.OLLAMA_URL ?? "http://127.0.0.1:11434";
  const inicio = Date.now();
  const r = await fetch(`${url}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: idDoModelo(),
      messages: montarMensagens({ rota: caso.rota, pergunta: caso.pergunta, historico: [], modelo: rotuloDoModelo() }),
      stream: false,
      keep_alive: "5m",
      options: { num_ctx: 4096, num_predict: 300, temperature: 0.1 },
    }),
  });
  const j = (await r.json()) as { message?: { content?: string }; eval_count?: number; eval_duration?: number };
  return { texto: j.message?.content ?? JSON.stringify(j), ms: Date.now() - inicio, tokens: j.eval_count ?? 0, tokensPorSegundo: j.eval_count && j.eval_duration ? j.eval_count / (j.eval_duration / 1e9) : 0 };
}

async function main() {
  const so = process.argv.find((a) => a.startsWith("--so="))?.slice(5).split(",").map(Number);
  const semRegras = process.argv.includes("--sem-regras");
  const casos = so ? CASOS.filter((c) => so.includes(c.id)) : CASOS;
  let acertos = 0;
  let totalMs = 0;
  console.log(`Modelo: ${idDoModelo()}${semRegras ? " (sem respostas prontas)" : ""}\n`);
  for (const c of casos) {
    const pronta = semRegras ? null : respostaPronta(c.pergunta, c.rota, rotuloDoModelo());
    const r = pronta ? { texto: pronta, ms: 0, tokens: 0, tokensPorSegundo: 0 } : await perguntarAoModelo(c);
    const t = normalizar(r.texto);
    const trouxe = c.esperado.some((e) => t.includes(normalizar(e)));
    const errou = (c.proibido ?? []).some((e) => t.includes(normalizar(e)));
    const ok = trouxe && !errou;
    if (ok) acertos++;
    totalMs += r.ms;
    console.log(`${ok ? "OK  " : "ERRO"} #${c.id} ${pronta ? "[pronta]" : `[modelo ${(r.ms / 1000).toFixed(0)} s, ${r.tokensPorSegundo.toFixed(1)} tok/s]`} ${c.pergunta}\n      ${r.texto.replace(/\s+/g, " ").slice(0, 260)}`);
  }
  console.log(`\nAcertos: ${acertos} de ${casos.length}. Tempo médio: ${(totalMs / casos.length / 1000).toFixed(1)} s por pergunta.`);
}

main();
