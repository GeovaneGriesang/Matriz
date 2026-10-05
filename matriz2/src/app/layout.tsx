import type { Metadata } from "next";
import { Open_Sans } from "next/font/google";
import "./globals.css";
import { SiteHeader } from "@/components/brand/SiteHeader";
import { SiteFooter } from "@/components/brand/SiteFooter";
import { ChatDaTela, ChatProvider } from "@/components/chat/ChatDaTela";
import { getAdminSession } from "@/server/auth/session";
import { rotuloDoModelo } from "@/lib/chat/modelo";

const openSans = Open_Sans({
  subsets: ["latin"],
  variable: "--font-open-sans",
});

export const metadata: Metadata = {
  title: "Matriz Orçamentária RFEPCT",
  description: "Consulta, comparação e simulação da Matriz de Distribuição Orçamentária da RFEPCT",
};

const TEMA_INICIAL_SCRIPT = `
(function () {
  try {
    var tema = localStorage.getItem("matriz-theme");
    if (tema === "dark") {
      document.documentElement.classList.add("dark");
    }
  } catch (e) {}
})();
`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // O assistente só aparece para quem tem acesso pleno e quando o servidor o liga (CHAT_ATIVO=1).
  const usuario = process.env.CHAT_ATIVO === "1" ? await getAdminSession() : null;
  const comChat = usuario !== null && usuario.papel !== "PADRAO";
  return (
    <html lang="pt-BR" className={openSans.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: TEMA_INICIAL_SCRIPT }} />
      </head>
      <body
        className="flex min-h-screen flex-col bg-neutral-50 font-sans text-neutral-900 antialiased dark:bg-neutral-950 dark:text-neutral-100"
        suppressHydrationWarning
      >
        <ChatProvider>
          <SiteHeader />
          <div className="flex-1">{children}</div>
          <SiteFooter />
          {comChat && <ChatDaTela modelo={rotuloDoModelo()} />}
        </ChatProvider>
      </body>
    </html>
  );
}
