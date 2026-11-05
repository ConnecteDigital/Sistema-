import { db } from "@/lib/supabase";
import { formatarData } from "@/lib/utils";
import { listarModelos, whatsappFaltando, type Modelo } from "@/lib/whatsapp";
import { VARIAVEIS } from "@/lib/disparos";
import { FormCampanha } from "./form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Nova campanha" };

export default async function Nova() {
  let modelos: Modelo[] = [], erro: string | null = null;
  if (whatsappFaltando().length) erro = "Configure a API do WhatsApp na Vercel antes (veja a tela Disparos).";
  else { try { modelos = (await listarModelos()).filter((m) => m.status === "APPROVED"); } catch (e) { erro = e instanceof Error ? e.message : String(e); } }
  const [{ data: rodadas }, { data: cfg }] = await Promise.all([
    db().from("runs").select("id, criado_em, termos").eq("status", "pronta").order("id", { ascending: false }).limit(50),
    db().from("settings").select("chave, valor").in("chave", ["wa_ritmo_por_minuto", "wa_custo_marketing_usd"]),
  ]);
  const conf = Object.fromEntries((cfg ?? []).map((c) => [c.chave, Number(c.valor)]));
  return (
    <main className="mx-auto max-w-3xl space-y-4 p-4">
      <h1 className="text-xl font-semibold">Nova campanha</h1>
      {erro && <p className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800">{erro}</p>}
      {!erro && !modelos.length && <p className="text-sm text-suave">Nenhum modelo aprovado ainda. Crie no WhatsApp Manager e espere a aprovação.</p>}
      {modelos.length > 0 && (
        <FormCampanha
          modelos={modelos}
          rodadas={(rodadas ?? []).map((r) => ({ id: r.id, rotulo: `#${r.id} · ${formatarData(r.criado_em)} · ${(r.termos as string[]).join(", ")}` }))}
          variaveis={VARIAVEIS} ritmoPadrao={conf.wa_ritmo_por_minuto ?? 20} custo={conf.wa_custo_marketing_usd ?? 0.0625}
        />
      )}
    </main>
  );
}
