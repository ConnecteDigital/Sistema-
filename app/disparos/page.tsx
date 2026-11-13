import Link from "next/link";
import { db } from "@/lib/supabase";
import { formatarData } from "@/lib/utils";
import { configWhatsapp, listarModelos, saudeNumero, whatsappFaltando, type Modelo, type SaudeNumero } from "@/lib/whatsapp";
import { enviadosUltimas24h } from "@/lib/disparos";
import { salvarLimites } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Disparos" };

const COR_QUALIDADE: Record<string, string> = { GREEN: "bg-green-100 text-green-800", YELLOW: "bg-amber-100 text-amber-800", RED: "bg-red-600 text-white", UNKNOWN: "bg-slate-100 text-slate-700" };
const NOME_QUALIDADE: Record<string, string> = { GREEN: "Verde (boa)", YELLOW: "Amarela (atenção)", RED: "Vermelha (pare os disparos)", UNKNOWN: "Ainda sem nota (número novo)" };

export default async function Disparos() {
  const faltando = await whatsappFaltando();
  const origem = (await configWhatsapp().catch(() => null))?.origem ?? null;
  const { data: conexao } = await db().from("wa_conexao").select("numero, nome, conectado_em").eq("ativo", true).order("id", { ascending: false }).limit(1).maybeSingle();
  let saude: SaudeNumero | null = null, modelos: Modelo[] = [], erroMeta: string | null = null;
  if (!faltando.some((f) => f.startsWith("Conectar"))) {
    try { [saude, modelos] = await Promise.all([saudeNumero(), listarModelos()]); }
    catch (e) { erroMeta = e instanceof Error ? e.message : String(e); }
  }
  const [campanhas, cfg, usados, contatos] = await Promise.all([
    db().from("wa_campanhas").select("id, nome, modelo_nome, status, total, criado_em, erro").order("id", { ascending: false }).limit(50),
    db().from("settings").select("chave, valor").in("chave", ["wa_limite_diario", "wa_ritmo_por_minuto"]),
    enviadosUltimas24h().catch(() => 0),
    db().from("wa_contatos").select("optin_em, optout_em").limit(100000),
  ]);
  const conf = Object.fromEntries((cfg.data ?? []).map((c) => [c.chave, Number(c.valor)]));
  const autorizados = (contatos.data ?? []).filter((c) => c.optin_em && !c.optout_em).length;
  const sairam = (contatos.data ?? []).filter((c) => c.optout_em).length;
  const aprovados = modelos.filter((m) => m.status === "APPROVED");

  return (
    <main className="mx-auto max-w-6xl space-y-5 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Disparos pelo WhatsApp</h1>
        <div className="flex gap-2">
          <Link href="/disparos/modelos" className="botao-sec">Modelos e teste</Link>
          <Link href="/disparos/conversas" className="botao-sec">Conversas</Link>
          <Link href="/disparos/nova" className="botao">Nova campanha</Link>
        </div>
      </div>
      {campanhas.error && <p className="text-sm text-red-600">{campanhas.error.message} — rodou o 0009_disparos.sql?</p>}

      {faltando.length > 0 && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-medium">Falta para o disparo funcionar:</p>
          <ul className="mt-1 list-inside list-disc">{faltando.map((v) => <li key={v}>{v}</li>)}</ul>
        </div>
      )}
      <div className="cartao flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
        <div>
          <p className="font-medium">WhatsApp conectado</p>
          <p className="text-suave">
            {origem === "variaveis"
              ? `${saude?.nome ?? ""} ${saude?.numero ?? ""} · número só da API (configurado na Vercel). O botão ao lado é para conectar o número do celular com coexistência, depois da análise do app.`
              : conexao ? `${conexao.nome ?? ""} ${conexao.numero ?? ""} · desde ${formatarData(conexao.conectado_em)} · mesmo número no app do celular (coexistência)` : "Nenhum número conectado ainda."}
          </p>
        </div>
        <Link href="/disparos/conectar" className={conexao || origem ? "botao-sec" : "botao"}>{conexao ? "Reconectar" : origem === "variaveis" ? "Conectar número do celular" : "Conectar WhatsApp"}</Link>
      </div>
      {erroMeta && <p className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800">Erro na Meta: {erroMeta}</p>}

      <div className="grid gap-3 md:grid-cols-4">
        <div className="cartao p-4">
          <p className="text-xs text-suave">Número</p>
          <p className="font-semibold">{saude?.nome ?? "—"}</p>
          <p className="text-sm">{saude?.numero ?? ""}</p>
        </div>
        <div className="cartao p-4">
          <p className="text-xs text-suave">Nota de qualidade (Meta)</p>
          {saude?.qualidade
            ? <span className={`selo mt-1 text-sm ${COR_QUALIDADE[saude.qualidade] ?? "bg-slate-100"}`}>{NOME_QUALIDADE[saude.qualidade] ?? saude.qualidade}</span>
            : <p className="text-sm">—</p>}
          <p className="mt-1 text-[11px] text-suave">Cai com bloqueios e denúncias. Vermelha = pare tudo.</p>
        </div>
        <div className="cartao p-4">
          <p className="text-xs text-suave">Contatos novos nas últimas 24h</p>
          <p className="text-2xl font-semibold tabular-nums">{usados} <span className="text-sm font-normal text-suave">/ {conf.wa_limite_diario ?? 250}</span></p>
          <p className="text-[11px] text-suave">Limite da Meta: {saude?.limite ?? "—"}</p>
        </div>
        <div className="cartao p-4">
          <p className="text-xs text-suave">Autorizados a receber</p>
          <p className="text-2xl font-semibold tabular-nums text-green-700">{autorizados}</p>
          <p className="text-[11px] text-suave">{sairam} pediram para sair (nunca recebem)</p>
        </div>
      </div>

      <section className="cartao space-y-3 p-4">
        <h2 className="font-semibold">Campanhas</h2>
        {!(campanhas.data ?? []).length ? <p className="text-sm text-suave">Nenhuma campanha ainda.</p> : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-suave">
              <tr className="border-b border-borda"><th className="py-1.5 pr-3">#</th><th className="pr-3">Nome</th><th className="pr-3">Modelo</th>
                <th className="pr-3 text-right">Contatos</th><th className="pr-3">Status</th><th>Criada</th></tr>
            </thead>
            <tbody>
              {(campanhas.data ?? []).map((c) => (
                <tr key={c.id} className="border-b border-borda last:border-0">
                  <td className="py-1.5 pr-3"><Link href={`/disparos/${c.id}`} className="text-marca hover:underline">{c.id}</Link></td>
                  <td className="pr-3"><Link href={`/disparos/${c.id}`} className="hover:underline">{c.nome}</Link></td>
                  <td className="pr-3 text-suave">{c.modelo_nome}</td>
                  <td className="pr-3 text-right tabular-nums">{c.total}</td>
                  <td className={`pr-3 ${c.erro ? "text-red-600" : ""}`}>{c.status}</td>
                  <td className="text-suave">{formatarData(c.criado_em)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="cartao space-y-2 p-4">
        <h2 className="font-semibold">Modelos aprovados pela Meta ({aprovados.length})</h2>
        <p className="text-xs text-suave">
          Crie modelos em <Link href="/disparos/modelos" className="text-marca hover:underline">Modelos e teste</Link> (ou no WhatsApp Manager). Eles aparecem aqui quando a Meta aprova.
        </p>
        {modelos.map((m) => (
          <div key={m.nome + m.idioma} className="rounded-lg border border-borda p-3 text-sm">
            <p className="font-medium">{m.nome} <span className="text-xs text-suave">· {m.idioma} · {m.categoria}</span>
              <span className={`selo ml-2 ${m.status === "APPROVED" ? "bg-green-100 text-green-800" : "bg-slate-100 text-slate-600"}`}>{m.status}</span></p>
            <p className="mt-1 whitespace-pre-line text-xs text-suave">{m.corpo}</p>
          </div>
        ))}
      </section>

      <section className="cartao p-4">
        <h2 className="mb-2 font-semibold">Limites de segurança</h2>
        <form action={salvarLimites} className="flex flex-wrap items-end gap-3 text-sm">
          <label>Contatos novos por dia<input name="limite" type="number" defaultValue={conf.wa_limite_diario ?? 250} className="campo mt-1 block w-32" /></label>
          <label>Mensagens por minuto<input name="ritmo" type="number" defaultValue={conf.wa_ritmo_por_minuto ?? 20} className="campo mt-1 block w-32" /></label>
          <button className="botao-sec">Salvar</button>
        </form>
        <p className="mt-2 text-xs text-suave">
          Comece pelo limite que a Meta mostra para o seu número (normalmente 250/dia no início) e só aumente quando ela liberar.
          A campanha pausa sozinha se a Meta reclamar de limite, spam ou qualidade.
        </p>
      </section>
    </main>
  );
}
