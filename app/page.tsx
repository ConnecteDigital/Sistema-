import { db } from "@/lib/supabase";
import { variaveisFaltando } from "@/lib/env";
import { AvisoConfiguracao } from "@/components/aviso-configuracao";
import { FormPesquisa, type Dados } from "./form-pesquisa";
import { dadosDaRodada } from "./actions";

export const dynamic = "force-dynamic";

export default async function NovaPesquisa({ searchParams }: { searchParams: Promise<{ repetir?: string }> }) {
  const { repetir } = await searchParams;
  if (variaveisFaltando().length) {
    return <main className="mx-auto max-w-3xl p-4"><AvisoConfiguracao /></main>;
  }
  const [nichos, regioes, locais, chaves] = await Promise.all([
    db().from("niches").select("id, nome, keyword_templates(modelo, ordem)").order("ordem"),
    db().from("regions").select("id, nome, uf, ddd").order("uf").order("ordem"),
    db().from("locations").select("id, region_id, nome_exibicao, camada")
      .eq("ativo", true).not("validado_em", "is", null).order("id"),
    db().from("serp_keys").select("creditos_restantes, limite_troca").eq("ativa", true),
  ]);
  const erro = nichos.error ?? regioes.error ?? locais.error ?? chaves.error;
  if (erro) {
    return (
      <main className="mx-auto max-w-3xl p-4">
        <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-900">
          Não consegui ler o banco: {erro.message}
        </div>
      </main>
    );
  }
  const dados: Dados = {
    nichos: (nichos.data ?? []).map((n) => ({
      nome: n.nome,
      modelos: [...(n.keyword_templates as { modelo: string; ordem: number }[])]
        .sort((a, b) => a.ordem - b.ordem).map((t) => t.modelo),
    })),
    regioes: regioes.data ?? [],
    locais: locais.data ?? [],
    creditos: (chaves.data ?? []).reduce((s, k) => s + Math.max(0, (k.creditos_restantes ?? 0) - (k.limite_troca ?? 2)), 0),
  };
  const rep = repetir ? await dadosDaRodada(Number(repetir)) : null;
  const inicial = rep ? { rodada: Number(repetir), ...rep } : null;
  return (
    <main className="mx-auto max-w-3xl px-4 pb-16 pt-[6vh]">
      <div className="mb-8 text-center">
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl"><span className="text-marca">Prospecção</span></h1>
        <p className="mt-2 text-sm text-suave">Quem está anunciando agora no Google, no celular.</p>
      </div>
      <FormPesquisa key={repetir ?? "novo"} dados={dados} inicial={inicial} />
    </main>
  );
}
