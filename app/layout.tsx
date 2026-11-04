import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Robô de Prospecção", template: "%s · Robô de Prospecção" },
  robots: { index: false, follow: false },
};

const links = [
  { href: "/", rotulo: "Nova pesquisa" },
  { href: "/rodadas", rotulo: "Rodadas" },
  { href: "/leads", rotulo: "Leads" },
  { href: "/configuracoes", rotulo: "Configurações" },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen font-sans antialiased">
        <header className="border-b border-borda bg-white">
          <nav className="mx-auto flex max-w-6xl items-center gap-1 overflow-x-auto px-4 py-2 text-sm">
            <Link href="/" className="mr-3 shrink-0 font-semibold text-marca">Connect · Prospecção</Link>
            {links.map((l) => (
              <Link key={l.href} href={l.href} className="shrink-0 rounded-md px-3 py-1.5 text-suave hover:bg-slate-100 hover:text-texto">
                {l.rotulo}
              </Link>
            ))}
          </nav>
        </header>
        {children}
      </body>
    </html>
  );
}
