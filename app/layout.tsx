import type { Metadata } from "next";
import { Menu } from "@/components/menu";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Robô de Prospecção", template: "%s · Robô de Prospecção" },
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen font-sans antialiased">
        <Menu />
        {children}
      </body>
    </html>
  );
}
