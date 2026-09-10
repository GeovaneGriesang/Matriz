"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Ordem pensada para quem acompanha o texto de "Como funciona" e vai seguindo as
 * telas na mesma sequência da conta da MDO: primeiro o manual, depois de onde vêm
 * os dados, depois o bloco Funcionamento (Consulta e o que a evasão tira dele),
 * depois o bloco Qualidade e Eficiência (Conferência), depois o Simulador (que
 * combina os dois blocos acima) e só então Comparativo, que olha tudo isso ao
 * longo de vários ciclos.
 */
const LINKS = [
  { href: "/como-funciona", rotulo: "Como funciona" },
  { href: "/dados-importados", rotulo: "Dados importados" },
  { href: "/consulta", rotulo: "Consulta" },
  { href: "/evasao", rotulo: "Perda por evasão" },
  { href: "/conferencia", rotulo: "Conferência" },
  { href: "/simulador", rotulo: "Simulador" },
  { href: "/comparativo", rotulo: "Comparativo" },
  { href: "/", rotulo: "Painel" },
];

/**
 * "use client" só por causa do `usePathname`: precisa saber qual tela está aberta
 * pra marcar o link dela com fundo verde (pedido do usuário, que com o cabeçalho
 * fixo agora passa mais tempo olhando pro menu sem saber onde está). O resto do
 * cabeçalho (sessão, nome, Sair) continua no Server Component, sem precisar virar
 * cliente por causa disso.
 */
export function SiteNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-wrap items-center gap-1">
      {LINKS.map((l) => {
        const ativo = l.href === "/" ? pathname === "/" : pathname === l.href || pathname.startsWith(`${l.href}/`);
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={ativo ? "page" : undefined}
            className={`rounded-md px-2.5 py-1.5 text-sm font-medium ${
              ativo
                ? "bg-if-green text-white"
                : "text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
            }`}
          >
            {l.rotulo}
          </Link>
        );
      })}
    </nav>
  );
}
