/**
 * Prefixo de rota quando o app é servido sob um subcaminho (ex.: self-hosting
 * em /matriz em vez da raiz do domínio, como na Vercel). `next/link`,
 * `next/image` e o router já aplicam isso automaticamente — mas `fetch`/
 * `XMLHttpRequest` com caminho absoluto não, por isso as chamadas de API
 * precisam passar por `apiUrl()`.
 */
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export function apiUrl(path: string): string {
  return `${BASE_PATH}${path}`;
}
