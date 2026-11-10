"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", rotulo: "Nova pesquisa" },
  { href: "/rodadas", rotulo: "Rodadas" },
  { href: "/agendamentos", rotulo: "Agendamentos" },
  { href: "/leads", rotulo: "Leads" },
  { href: "/relatorios", rotulo: "Relatórios" },
  { href: "/disparos", rotulo: "Disparos" },
  { href: "/configuracoes", rotulo: "Configurações" },
];
export const PAGINAS_PUBLICAS = ["/privacidade", "/termos", "/exclusao-de-dados", "/acesso"];

/** Menu do sistema (não aparece nas páginas públicas de política/termos). */
export function Menu() {
  const caminho = usePathname();
  if (PAGINAS_PUBLICAS.some((p) => caminho.startsWith(p))) {
    return (
      <header className="border-b border-borda bg-white">
        <div className="mx-auto max-w-3xl px-4 py-3 text-sm font-semibold text-marca">Connect Digital</div>
      </header>
    );
  }
  return (
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
  );
}
