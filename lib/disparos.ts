import "server-only";
import { db } from "./supabase";
import { enviarModelo, erroDeveParar, type ErroMeta } from "./whatsapp";
import { paraE164 } from "./exportar";

// ---------------------------------------------------------------------------
// Variáveis que podem preencher {{1}}, {{2}}… do modelo
// ---------------------------------------------------------------------------
export const VARIAVEIS: Record<string, string> = {
  empresa: "Nome da empresa (razão social ou nome do anúncio)",
  nome_anuncio: "Nome que aparece no anúncio",
  site: "Site (domínio)",
  problema: "Problema encontrado (frase curta)",
  regiao: "Região da pesquisa",
  presenca: "% de presença do anúncio",
};

type LeadDisparo = {
  id: number; telefone_principal: string | null; prioridade: string | null; observacoes: string[]; presenca: number | null;
  regioes: string[]; razao_social: string | null; advertisers: { dominio: string; nome: string | null };
};

/** Frase curta do problema, para caber no modelo (sem quebra de linha). */
export function problemaCurto(l: Pick<LeadDisparo, "observacoes" | "presenca">): string {
  const o = l.observacoes.join(" | ");
  if (/SITE FORA DO AR/i.test(o)) return "o seu site está fora do ar e o anúncio continua rodando";
  const pal = o.match(/busca de "([^"]+)"/);
  if (pal) return `o seu anúncio aparece para quem busca "${pal[1]}", mas o site não fala desse serviço`;
  if (/Nenhuma tag do Google/i.test(o)) return "o seu site não está medindo as conversões do Google Ads";
  if (l.presenca !== null && Number(l.presenca) < 0.4) return `o seu anúncio aparece em só ${Math.round(Number(l.presenca) * 100)}% das buscas da sua região`;
  if (/sem sitelinks/i.test(o)) return "o seu anúncio está sem os links extras (sitelinks)";
  return "o seu anúncio no Google pode trazer mais ligações";
}

const limpar = (t: string) => t.replace(/[\r\n\t]+/g, " ").replace(/ {2,}/g, " ").trim();

export function valorVariavel(chave: string, l: LeadDisparo): string {
  const v = {
    empresa: l.razao_social ?? l.advertisers.nome ?? l.advertisers.dominio,
    nome_anuncio: l.advertisers.nome ?? l.advertisers.dominio,
    site: l.advertisers.dominio.startsWith("perfil-google:") ? "seu perfil do Google" : l.advertisers.dominio,
    problema: problemaCurto(l),
    regiao: (l.regioes[0] ?? "").replace(/^\d{3}\s+/, ""),
    presenca: l.presenca !== null ? `${Math.round(Number(l.presenca) * 100)}%` : "-",
  }[chave];
  return limpar(v ?? (chave.startsWith("texto:") ? chave.slice(6) : "-"));
}

// ---------------------------------------------------------------------------
// Público: leads com celular, COM autorização e SEM pedido de saída
// ---------------------------------------------------------------------------
export type Filtro = { rodada?: number | null; prioridades?: string[] };
export type Elegiveis = {
  elegiveis: { lead: LeadDisparo; telefone: string }[];
  semCelular: number; semAutorizacao: number; sairam: number; total: number;
};

export async function calcularPublico(filtro: Filtro): Promise<Elegiveis> {
  let q = db().from("leads")
    .select("id, telefone_principal, prioridade, observacoes, presenca, regioes, razao_social, advertisers(dominio, nome)")
    .limit(5000);
  if (filtro.prioridades?.length) q = q.in("prioridade", filtro.prioridades);
  if (filtro.rodada) {
    const { data: ra } = await db().from("run_advertisers").select("advertiser_id").eq("run_id", filtro.rodada).limit(5000);
    const ids = [...new Set((ra ?? []).map((r) => r.advertiser_id))];
    if (!ids.length) return { elegiveis: [], semCelular: 0, semAutorizacao: 0, sairam: 0, total: 0 };
    q = q.in("advertiser_id", ids);
  }
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  const leads = (data ?? []) as unknown as LeadDisparo[];

  const celulares = leads.map((l) => {
    const d = (l.telefone_principal ?? "").replace(/\D/g, "");
    const e164 = d.length === 11 && d[2] === "9" ? paraE164(d) : null;
    return { lead: l, telefone: e164 ? e164.slice(1) : null };
  });
  const comCel = celulares.filter((c): c is { lead: LeadDisparo; telefone: string } => !!c.telefone);
  const tels = [...new Set(comCel.map((c) => c.telefone))];
  const contatos = new Map<string, { optin_em: string | null; optout_em: string | null }>();
  for (let i = 0; i < tels.length; i += 300) {
    const { data: cs } = await db().from("wa_contatos").select("telefone, optin_em, optout_em").in("telefone", tels.slice(i, i + 300));
    for (const c of cs ?? []) contatos.set(c.telefone, c);
  }
  const vistos = new Set<string>();
  const elegiveis: Elegiveis["elegiveis"] = [];
  let semAutorizacao = 0, sairam = 0;
  for (const c of comCel) {
    if (vistos.has(c.telefone)) continue;                 // mesmo número em dois leads (mesmo dono): manda uma vez só
    vistos.add(c.telefone);
    const ct = contatos.get(c.telefone);
    if (ct?.optout_em) { sairam++; continue; }
    if (!ct?.optin_em) { semAutorizacao++; continue; }
    elegiveis.push(c);
  }
  return { elegiveis, semCelular: leads.length - comCel.length, semAutorizacao, sairam, total: leads.length };
}

export async function criarCampanha(nome: string, modelo: string, idioma: string, variaveis: string[], filtro: Filtro, ritmo: number) {
  const pub = await calcularPublico(filtro);
  if (!pub.elegiveis.length) throw new Error("Nenhum contato com WhatsApp e autorização nesse filtro.");
  const { data: camp, error } = await db().from("wa_campanhas").insert({
    nome, modelo_nome: modelo, modelo_idioma: idioma, variaveis, filtro, ritmo_por_minuto: ritmo,
    total: pub.elegiveis.length, status: "pausada",
  }).select("id").single();
  if (error) throw new Error(error.message);
  const linhas = pub.elegiveis.map((e) => ({
    campanha_id: camp.id, lead_id: e.lead.id, telefone: e.telefone, parametros: variaveis.map((v) => valorVariavel(v, e.lead)),
  }));
  for (let i = 0; i < linhas.length; i += 500) {
    const { error: e } = await db().from("wa_envios").insert(linhas.slice(i, i + 500));
    if (e) throw new Error(e.message);
  }
  return camp.id as number;
}

// ---------------------------------------------------------------------------
// Envio em lotes (a tela chama a cada ~10 s)
// ---------------------------------------------------------------------------
async function setting(chave: string, padrao: number) {
  const { data } = await db().from("settings").select("valor").eq("chave", chave).maybeSingle();
  return Number(data?.valor ?? padrao) || padrao;
}

export async function enviadosUltimas24h(): Promise<number> {
  const desde = new Date(Date.now() - 86_400_000).toISOString();
  const { data } = await db().from("wa_envios").select("telefone").gte("enviado_em", desde).limit(100_000);
  return new Set((data ?? []).map((d) => d.telefone)).size;
}

export type ProgressoCampanha = { status: string; total: number; porStatus: Record<string, number>; erro: string | null; limiteRestante: number };

export async function progressoCampanha(id: number): Promise<ProgressoCampanha> {
  const [{ data: c }, { data: es }, usados, limite] = await Promise.all([
    db().from("wa_campanhas").select("status, total, erro").eq("id", id).single(),
    db().from("wa_envios").select("status").eq("campanha_id", id).limit(100_000),
    enviadosUltimas24h(), setting("wa_limite_diario", 250),
  ]);
  const porStatus: Record<string, number> = {};
  for (const e of es ?? []) porStatus[e.status] = (porStatus[e.status] ?? 0) + 1;
  return { status: c?.status ?? "?", total: c?.total ?? 0, porStatus, erro: c?.erro ?? null, limiteRestante: Math.max(0, limite - usados) };
}

export async function processarCampanha(id: number): Promise<ProgressoCampanha> {
  const { data: camp } = await db().from("wa_campanhas").select("*").eq("id", id).single();
  if (!camp || camp.status !== "enviando") return progressoCampanha(id);

  const limite = await setting("wa_limite_diario", 250);
  const restante = limite - (await enviadosUltimas24h());
  if (restante <= 0) {
    await db().from("wa_campanhas").update({ status: "pausada", erro: `Limite diário de ${limite} contatos atingido. Continue amanhã (ou aumente o limite em Configurações quando a Meta liberar mais).` }).eq("id", id);
    return progressoCampanha(id);
  }
  const lote = Math.max(1, Math.min(20, Math.round(camp.ritmo_por_minuto / 6), restante));   // ~10 s entre lotes
  const { data: reservados, error } = await db().rpc("reservar_envios", { p_campanha: id, p_limite: lote });
  if (error) throw new Error(error.message);
  const fila = (reservados ?? []) as { id: number; telefone: string; parametros: string[]; lead_id: number | null }[];

  if (!fila.length) {
    const { count } = await db().from("wa_envios").select("id", { count: "exact", head: true }).eq("campanha_id", id).in("status", ["pendente", "enviando"]);
    if (!count) await db().from("wa_campanhas").update({ status: "concluida", erro: null }).eq("id", id);
    return progressoCampanha(id);
  }

  let parar: string | null = null;
  for (const e of fila) {                                   // um por vez: ritmo calmo é bom para a nota do número
    if (parar) { await db().from("wa_envios").update({ status: "pendente" }).eq("id", e.id); continue; }
    // saiu da lista depois que a campanha foi criada?
    const { data: ct } = await db().from("wa_contatos").select("optout_em").eq("telefone", e.telefone).maybeSingle();
    if (ct?.optout_em) { await db().from("wa_envios").update({ status: "ignorado", erro: "Pediu para sair" }).eq("id", e.id); continue; }
    try {
      const wamid = await enviarModelo(e.telefone, camp.modelo_nome, camp.modelo_idioma, e.parametros ?? []);
      const agora = new Date().toISOString();
      await db().from("wa_envios").update({ status: "enviado", wamid, enviado_em: agora, atualizado_em: agora, erro: null }).eq("id", e.id);
      await db().from("wa_mensagens").insert({ telefone: e.telefone, lead_id: e.lead_id, direcao: "saida", tipo: "template",
        texto: `[modelo ${camp.modelo_nome}] ${(e.parametros ?? []).join(" · ")}`, wamid, status: "enviado" });
    } catch (err) {
      const meta = (err as { meta?: ErroMeta }).meta;
      const msg = err instanceof Error ? err.message : String(err);
      if (erroDeveParar(meta)) {
        parar = msg;
        await db().from("wa_envios").update({ status: "pendente", erro: msg }).eq("id", e.id);
      } else {
        await db().from("wa_envios").update({ status: "falhou", erro: msg, atualizado_em: new Date().toISOString() }).eq("id", e.id);
      }
    }
  }
  if (parar) {
    await db().from("wa_campanhas").update({ status: "pausada", erro: `Pausada automaticamente para proteger o número: ${parar}` }).eq("id", id);
  }
  return progressoCampanha(id);
}
