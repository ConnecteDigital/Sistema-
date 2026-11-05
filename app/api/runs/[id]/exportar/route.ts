import { carregarRodadas } from "@/lib/rodada-dados";
import { comparar, type Comparacao } from "@/lib/combinar";
import { montarDonos } from "@/lib/donos";
import { contatosCsv, contatosXml, donosParaContatos } from "@/lib/exportar";

export const dynamic = "force-dynamic";

/** GET /api/runs/:id/exportar?formato=xml|csv&quem=ligar|whatsapp|todos[&rodadas=7,8][&so=sumiu|…] */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const id = Number((await ctx.params).id);
  const url = new URL(req.url);
  const formato = url.searchParams.get("formato") === "csv" ? "csv" : "xml";
  const q = url.searchParams.get("quem");
  const quem = q === "todos" || q === "whatsapp" ? q : "ligar";

  const extras = (url.searchParams.get("rodadas") ?? "").split(",").map(Number).filter(Boolean);
  const ids = extras.length ? extras : [id];
  const so = url.searchParams.get("so") as Comparacao | null;
  const dados = await carregarRodadas(ids);
  if (!dados) return new Response("Rodada não encontrada", { status: 404 });
  const linhas = so ? dados.linhas.filter((l) => comparar(l.porRodada ?? []).includes(so)) : dados.linhas;
  const contatos = donosParaContatos(montarDonos(linhas), quem);
  const nome = `contatos-rodada-${ids.join("-")}${so ? "-" + so : ""}-${quem}.${formato}`;
  const corpo = formato === "xml"
    ? contatosXml(contatos, { rodada: ids[ids.length - 1], termos: [...new Set(dados.runs.flatMap((r) => r.termos))] })
    : contatosCsv(contatos);
  return new Response(corpo, {
    headers: {
      "content-type": formato === "xml" ? "application/xml; charset=utf-8" : "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${nome}"`,
      "cache-control": "no-store",
    },
  });
}
