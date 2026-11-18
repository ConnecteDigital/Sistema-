"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/**
 * Lembra a última seleção da página (filtros e rodadas que estão no endereço).
 * Ao voltar para a página sem nada no endereço (ex.: pelo menu), reabre do jeito que estava.
 * "?limpar=1" esquece a seleção. Guarda só neste navegador.
 */
export function LembrarFiltros({ chave }: { chave: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const qs = params.toString();

  useEffect(() => {
    const k = `filtros:${chave}`;
    try {
      if (params.get("limpar")) {
        localStorage.removeItem(k);
        router.replace(pathname);
        return;
      }
      if (qs) { localStorage.setItem(k, qs); return; }
      const salvo = localStorage.getItem(k);
      if (salvo) router.replace(`${pathname}?${salvo}`);
    } catch { /* navegador sem armazenamento: segue sem lembrar */ }
  }, [chave, qs, pathname, router, params]);

  return null;
}
