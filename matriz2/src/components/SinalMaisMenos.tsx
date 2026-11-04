/**
 * O sinal de abrir e fechar do sistema: + quando o detalhe está fechado, − quando está aberto, sempre logo abaixo do item (pedido em 2026-11-04).
 * É só o desenho: quem abre é o botão ou o link em volta dele. O `aria-hidden` também o tira do CSV das tabelas. Nos `<details>`, o mesmo sinal vem do `globals.css`.
 */
export function SinalMaisMenos({ aberto }: { aberto: boolean }) {
  return (
    <span
      aria-hidden
      className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded border border-neutral-300 text-xs font-semibold leading-none text-neutral-600 dark:border-neutral-700 dark:text-neutral-300"
    >
      {aberto ? "−" : "+"}
    </span>
  );
}
