import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { db } from "./supabase";
import { descriptografar } from "./crypto";

// WhatsApp Cloud API (oficial da Meta). Variáveis:
// WHATSAPP_TOKEN (token permanente de usuário do sistema), WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_WABA_ID,
// WHATSAPP_VERIFY_TOKEN (você inventa; usado ao cadastrar o webhook), WHATSAPP_APP_SECRET (confere a assinatura do webhook).

const VERSAO = process.env.WHATSAPP_GRAPH_VERSION?.trim() || "v24.0";
const GRAPH = `https://graph.facebook.com/${VERSAO}`;

// Configuração: a conexão feita pelo botão "Conectar WhatsApp" (banco) ou, se preferir, variáveis de ambiente.
export type ConfigWa = { token: string; phoneId: string; wabaId: string; origem: "conexao" | "variaveis" };

export async function configWhatsapp(): Promise<ConfigWa | null> {
  const env = (k: string) => process.env[k]?.trim();
  if (env("WHATSAPP_TOKEN") && env("WHATSAPP_PHONE_NUMBER_ID") && env("WHATSAPP_WABA_ID")) {
    return { token: env("WHATSAPP_TOKEN")!, phoneId: env("WHATSAPP_PHONE_NUMBER_ID")!, wabaId: env("WHATSAPP_WABA_ID")!, origem: "variaveis" };
  }
  const { data } = await db().from("wa_conexao").select("waba_id, phone_number_id, token_criptografado")
    .eq("ativo", true).order("id", { ascending: false }).limit(1).maybeSingle();
  if (!data) return null;
  return { token: descriptografar(data.token_criptografado), phoneId: data.phone_number_id, wabaId: data.waba_id, origem: "conexao" };
}

/** O que falta para o disparo funcionar (vazio = tudo certo). */
export async function whatsappFaltando(): Promise<string[]> {
  const falta: string[] = [];
  if (!(await configWhatsapp().catch(() => null))) falta.push("Conectar o WhatsApp (Disparos → Conectar WhatsApp)");
  if (!process.env.WHATSAPP_VERIFY_TOKEN?.trim()) falta.push("WHATSAPP_VERIFY_TOKEN na Vercel (senha do webhook)");
  return falta;
}

async function cfg(): Promise<ConfigWa> {
  const c = await configWhatsapp();
  if (!c) throw new Error("WhatsApp não conectado. Vá em Disparos → Conectar WhatsApp.");
  return c;
}

export type ErroMeta = { code?: number; message?: string; error_subcode?: number; error_data?: { details?: string } };

async function graph<T>(caminho: string, init?: RequestInit, token?: string): Promise<T> {
  const t = token ?? (await cfg()).token;
  const r = await fetch(`${GRAPH}/${caminho}`, {
    ...init, headers: { authorization: `Bearer ${t}`, "content-type": "application/json" }, cache: "no-store", signal: AbortSignal.timeout(20_000),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) {
    const e = (j.error ?? {}) as ErroMeta;
    const err = new Error(`Meta (${e.code ?? r.status}): ${e.error_data?.details ?? e.message ?? "erro"}`) as Error & { meta?: ErroMeta };
    err.meta = e;
    throw err;
  }
  return j as T;
}

// ---------------------------------------------------------------------------
export type SaudeNumero = {
  nome: string | null; numero: string | null; qualidade: string | null; limite: string | null; statusNome: string | null;
};
export async function saudeNumero(): Promise<SaudeNumero> {
  const j = await graph<Record<string, string>>(
    `${(await cfg()).phoneId}?fields=verified_name,display_phone_number,quality_rating,messaging_limit_tier,name_status`);
  return {
    nome: j.verified_name ?? null, numero: j.display_phone_number ?? null, qualidade: j.quality_rating ?? null,
    limite: j.messaging_limit_tier ?? null, statusNome: j.name_status ?? null,
  };
}

export type Modelo = { nome: string; idioma: string; categoria: string; status: string; corpo: string; parametros: number };
export async function listarModelos(): Promise<Modelo[]> {
  type C = { type: string; text?: string };
  const j = await graph<{ data: { name: string; language: string; category: string; status: string; components: C[] }[] }>(
    `${(await cfg()).wabaId}/message_templates?fields=name,language,category,status,components&limit=200`);
  return (j.data ?? []).map((m) => {
    const corpo = m.components?.find((c) => c.type === "BODY")?.text ?? "";
    const nums = [...corpo.matchAll(/\{\{(\d+)\}\}/g)].map((x) => Number(x[1]));
    return { nome: m.name, idioma: m.language, categoria: m.category, status: m.status, corpo, parametros: nums.length ? Math.max(...nums) : 0 };
  });
}

/** Envia um modelo aprovado. Devolve o wamid (id da mensagem). */
export async function enviarModelo(para: string, nome: string, idioma: string, parametros: string[]): Promise<string> {
  const components = parametros.length
    ? [{ type: "body", parameters: parametros.map((t) => ({ type: "text", text: t.slice(0, 1000) || "-" })) }]
    : [];
  const j = await graph<{ messages?: { id: string }[] }>(`${(await cfg()).phoneId}/messages`, {
    method: "POST",
    body: JSON.stringify({ messaging_product: "whatsapp", to: para, type: "template", template: { name: nome, language: { code: idioma }, components } }),
  });
  const id = j.messages?.[0]?.id;
  if (!id) throw new Error("Meta não devolveu o id da mensagem");
  return id;
}

/** Texto livre: só funciona até 24h depois da última mensagem do cliente. */
export async function enviarTexto(para: string, texto: string): Promise<string> {
  const j = await graph<{ messages?: { id: string }[] }>(`${(await cfg()).phoneId}/messages`, {
    method: "POST",
    body: JSON.stringify({ messaging_product: "whatsapp", to: para, type: "text", text: { body: texto.slice(0, 4096) } }),
  });
  return j.messages?.[0]?.id ?? "";
}

/** Erros em que é melhor PARAR a campanha (limite/qualidade) em vez de seguir tentando. */
export function erroDeveParar(e: ErroMeta | undefined) {
  return !!e?.code && [130429, 131048, 131056, 131031, 368, 4, 80007, 190, 132001, 132000, 132015, 132016].includes(e.code);
}

/** Confere a assinatura X-Hub-Signature-256 do webhook (se WHATSAPP_APP_SECRET estiver configurado). */
export function assinaturaValida(corpo: string, assinatura: string | null): boolean {
  const segredo = process.env.WHATSAPP_APP_SECRET?.trim() || process.env.META_APP_SECRET?.trim();
  if (!segredo) return true;
  if (!assinatura?.startsWith("sha256=")) return false;
  const esperado = Buffer.from("sha256=" + createHmac("sha256", segredo).update(corpo).digest("hex"));
  const recebido = Buffer.from(assinatura);
  return esperado.length === recebido.length && timingSafeEqual(esperado, recebido);
}

/** "SAIR", "parar", "não tenho interesse"… = opt-out. */
export function pedeParaSair(texto: string | null | undefined) {
  if (!texto) return false;
  const t = texto.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
  return /^(sair|parar|pare|stop|cancelar|descadastrar|remover|nao quero|nao tenho interesse|nao me mande|para de mandar)\b/.test(t)
    || /nao tenho interesse|nao quero (mais )?receber|me (tira|tire|remova) da lista/.test(t);
}

/**
 * Número brasileiro no formato do sistema: 55 + DDD + 9 + 8 dígitos (13 dígitos).
 * O WhatsApp devolve muitos celulares brasileiros SEM o 9 (ex.: 557399430953); aqui o 9 volta.
 */
export function normalizarWaBr(n: string | null | undefined): string {
  const d = (n ?? "").replace(/\D/g, "");
  if (d.length === 12 && d.startsWith("55") && /[6-9]/.test(d[4])) return d.slice(0, 4) + "9" + d.slice(4);
  return d;
}

// ---------------------------------------------------------------------------
// Embedded Signup (coexistência): troca o código pelo token e liga o app à conta
// ---------------------------------------------------------------------------
export function embeddedSignupFaltando(): string[] {
  return ["META_APP_ID", "META_APP_SECRET", "META_ES_CONFIG_ID"].filter((k) => !process.env[k]?.trim());
}

export async function concluirEmbeddedSignup(codigo: string, wabaId: string | null, phoneId: string | null) {
  const p = new URLSearchParams({
    client_id: process.env.META_APP_ID!.trim(), client_secret: process.env.META_APP_SECRET!.trim(), code: codigo,
  });
  const r = await fetch(`${GRAPH}/oauth/access_token?${p}`, { cache: "no-store", signal: AbortSignal.timeout(20_000) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) throw new Error(`Meta não trocou o código: ${j.error?.message ?? `HTTP ${r.status}`}`);
  const token = j.access_token as string;

  // Se a janela não devolveu os IDs, descobre pelo token
  let waba = wabaId;
  if (!waba) {
    const dbg = await graph<{ data?: { granular_scopes?: { scope: string; target_ids?: string[] }[] } }>(
      `debug_token?input_token=${token}`, undefined, `${process.env.META_APP_ID!.trim()}|${process.env.META_APP_SECRET!.trim()}`);
    waba = dbg.data?.granular_scopes?.find((g) => g.scope === "whatsapp_business_management")?.target_ids?.[0] ?? null;
  }
  if (!waba) throw new Error("Não consegui identificar a conta do WhatsApp Business.");

  // Liga o nosso app à conta (para receber as respostas no webhook)
  await graph(`${waba}/subscribed_apps`, { method: "POST" }, token);

  const numeros = await graph<{ data?: { id: string; display_phone_number?: string; verified_name?: string }[] }>(
    `${waba}/phone_numbers?fields=id,display_phone_number,verified_name`, undefined, token);
  const num = numeros.data?.find((n) => n.id === phoneId) ?? numeros.data?.[0];
  if (!num) throw new Error("A conta não tem número de telefone.");
  // Coexistência: o número já está registrado no app; NÃO chamar /register.
  return { token, wabaId: waba, phoneId: num.id, numero: num.display_phone_number ?? null, nome: num.verified_name ?? null };
}
