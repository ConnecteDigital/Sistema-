import Link from "next/link";
import { db } from "@/lib/supabase";
import { variaveisFaltando } from "@/lib/env";
import { AvisoConfiguracao } from "@/components/aviso-configuracao";

export const dynamic = "force-dynamic";

async function creditosDisponiveis(): Promise<number | null> {
  if (variaveisFaltando().length) return null;
  const { data, error } = await db().from("serp_keys").select("creditos_restantes").eq("ativa", true);
  if (error) return null;
  return (data ?? []).reduce((s, k) => s + (k.creditos_restantes ?? 0), 0);
}

export default async function NovaPesquisa() {
  const creditos = await creditosDisponiveis();
  return (
    <main className="mx-auto flex max-w-2xl flex-col items-center px-4 pt-[12vh]">
      <div className="mb-4 w-full"><AvisoConfiguracao /></div>
      <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
        <span className="text-marca">Prospecção</span>
      </h1>
      <p className="mt-2 text-sm text-suave">Quem está anunciando agora no Google, no celular.</p>

      <div className="mt-8 w-full">
        <input
          disabled
          placeholder="ex.: desentupidora"
          className="w-full rounded-full border border-borda bg-white px-6 py-4 text-base shadow-sm outline-none disabled:cursor-not-allowed"
        />
      </div>
      <p className="mt-3 text-center text-sm text-suave">
        A pesquisa (variações, área, custo e execução) chega na <strong>Fase 2</strong>.
      </p>

      <p className="mt-8 text-sm">
        Créditos SerpApi disponíveis:{" "}
        <strong>{creditos ?? "—"}</strong>{" · "}
        <Link href="/configuracoes" className="text-marca hover:underline">gerenciar chaves</Link>
      </p>
    </main>
  );
}
