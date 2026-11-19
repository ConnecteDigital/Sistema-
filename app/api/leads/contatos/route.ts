import { db } from "@/lib/supabase";
import { gerarVcf, telefoneVcf } from "@/lib/vcard";

/** GET /api/leads/contatos?id=1&id=2… → arquivo .vcf com os leads marcados (para importar no celular). */
export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const ids = sp.getAll("id").map(Number).filter(Boolean).slice(0, 500);
  // Início do nome do contato (ex.: "Prospec 2"), para separar cada leva na agenda do celular
  const prefixo = (sp.get("prefixo") ?? "").replace(/[^\p{L}\p{N} ._#-]/gu, "").trim().slice(0, 30) || "Prospec";
  if (!ids.length) return new Response("Marque pelo menos um lead.", { status: 400 });
  const { data, error } = await db().from("leads")
    .select("id, telefone_principal, outros_telefones, regioes, advertisers(dominio, nome)").in("id", ids);
  if (error) return new Response(error.message, { status: 500 });
  type L = { id: number; telefone_principal: string | null; outros_telefones: string[] | null; regioes: string[] | null;
    advertisers: { dominio: string; nome: string | null } };
  const contatos = ((data ?? []) as unknown as L[]).flatMap((l) => {
    const tel = telefoneVcf(l.telefone_principal ?? "") ?? (l.outros_telefones ?? []).map(telefoneVcf).find(Boolean) ?? null;
    if (!tel) return [];
    const dominio = l.advertisers.dominio.startsWith("perfil-google:") ? null : l.advertisers.dominio;
    const nome = l.advertisers.nome ?? dominio ?? "Lead";
    return [{ nome: `${prefixo} - ${nome}`, telefone: tel, site: dominio ? `https://${dominio}` : null,
      nota: `Lead #${l.id}${l.regioes?.length ? " · " + l.regioes.join(", ") : ""}` }];
  });
  if (!contatos.length) return new Response("Nenhum dos leads marcados tem telefone válido.", { status: 400 });
  return new Response(gerarVcf(contatos), {
    headers: {
      "content-type": "text/vcard; charset=utf-8",
      "content-disposition": `attachment; filename="contatos-${prefixo.replace(/\s+/g, "-").toLowerCase()}-${contatos.length}.vcf"`,
    },
  });
}
