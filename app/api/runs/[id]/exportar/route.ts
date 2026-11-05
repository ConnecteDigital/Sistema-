import { carregarRodada } from "@/lib/rodada-dados";
import { montarDonos } from "@/lib/donos";
import { contatosCsv, contatosXml, donosParaContatos } from "@/lib/exportar";

export const dynamic = "force-dynamic";

/** GET /api/runs/:id/exportar?formato=xml|csv&quem=ligar|whatsapp|todos */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const id = Number((await ctx.params).id);
  const url = new URL(req.url);
  const formato = url.searchParams.get("formato") === "csv" ? "csv" : "xml";
  const q = url.searchParams.get("quem");
  const quem = q === "todos" || q === "whatsapp" ? q : "ligar";

  const dados = await carregarRodada(id);
  if (!dados) return new Response("Rodada não encontrada", { status: 404 });
  const contatos = donosParaContatos(montarDonos(dados.linhas), quem);
  const nome = `contatos-rodada-${id}-${quem}.${formato}`;
  const corpo = formato === "xml" ? contatosXml(contatos, { rodada: id, termos: dados.run.termos as string[] }) : contatosCsv(contatos);
  return new Response(corpo, {
    headers: {
      "content-type": formato === "xml" ? "application/xml; charset=utf-8" : "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${nome}"`,
      "cache-control": "no-store",
    },
  });
}
