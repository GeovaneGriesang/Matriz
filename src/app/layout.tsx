import type { Metadata } from "next";
import { Open_Sans } from "next/font/google";
import "./globals.css";
import { SiteHeader } from "@/components/brand/SiteHeader";
import { SiteFooter } from "@/components/brand/SiteFooter";

const openSans = Open_Sans({
  subsets: ["latin"],
  variable: "--font-open-sans",
});

export const metadata: Metadata = {
  title: "Matriz Orçamentária RFEPCT",
  description: "Cálculo, auditoria e simulação da Matriz Orçamentária da Rede Federal",
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={openSans.variable}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: TEMA_INICIAL_SCRIPT }} />
      </head>
      <body className="flex min-h-screen flex-col bg-neutral-50 font-sans text-neutral-900 antialiased dark:bg-neutral-950 dark:text-neutral-100">
        <SiteHeader />
        <div className="flex-1">{children}</div>
        <SiteFooter />
      </body>
    </html>
  );
}
