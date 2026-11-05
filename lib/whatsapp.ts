import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

// WhatsApp Cloud API (oficial da Meta). Variáveis:
// WHATSAPP_TOKEN (token permanente de usuário do sistema), WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_WABA_ID,
// WHATSAPP_VERIFY_TOKEN (você inventa; usado ao cadastrar o webhook), WHATSAPP_APP_SECRET (confere a assinatura do webhook).

const VERSAO = process.env.WHATSAPP_GRAPH_VERSION?.trim() || "v24.0";
const GRAPH = `https://graph.facebook.com/${VERSAO}`;

export function whatsappFaltando(): string[] {
  return ["WHATSAPP_TOKEN", "WHATSAPP_PHONE_NUMBER_ID", "WHATSAPP_WABA_ID", "WHATSAPP_VERIFY_TOKEN"]
    .filter((k) => !process.env[k]?.trim());
}

const h = () => ({ authorization: `Bearer ${process.env.WHATSAPP_TOKEN!.trim()}`, "content-type": "application/json" });

export type ErroMeta = { code?: number; message?: string; error_subcode?: number; error_data?: { details?: string } };

async function graph<T>(caminho: string, init?: RequestInit): Promise<T> {
  const r = await fetch(`${GRAPH}/${caminho}`, { ...init, headers: h(), cache: "no-store", signal: AbortSignal.timeout(20_000) });
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
    `${process.env.WHATSAPP_PHONE_NUMBER_ID!.trim()}?fields=verified_name,display_phone_number,quality_rating,messaging_limit_tier,name_status`);
  return {
    nome: j.verified_name ?? null, numero: j.display_phone_number ?? null, qualidade: j.quality_rating ?? null,
    limite: j.messaging_limit_tier ?? null, statusNome: j.name_status ?? null,
  };
}

export type Modelo = { nome: string; idioma: string; categoria: string; status: string; corpo: string; parametros: number };
export async function listarModelos(): Promise<Modelo[]> {
  type C = { type: string; text?: string };
  const j = await graph<{ data: { name: string; language: string; category: string; status: string; components: C[] }[] }>(
    `${process.env.WHATSAPP_WABA_ID!.trim()}/message_templates?fields=name,language,category,status,components&limit=200`);
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
  const j = await graph<{ messages?: { id: string }[] }>(`${process.env.WHATSAPP_PHONE_NUMBER_ID!.trim()}/messages`, {
    method: "POST",
    body: JSON.stringify({ messaging_product: "whatsapp", to: para, type: "template", template: { name: nome, language: { code: idioma }, components } }),
  });
  const id = j.messages?.[0]?.id;
  if (!id) throw new Error("Meta não devolveu o id da mensagem");
  return id;
}

/** Texto livre: só funciona até 24h depois da última mensagem do cliente. */
export async function enviarTexto(para: string, texto: string): Promise<string> {
  const j = await graph<{ messages?: { id: string }[] }>(`${process.env.WHATSAPP_PHONE_NUMBER_ID!.trim()}/messages`, {
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
  const segredo = process.env.WHATSAPP_APP_SECRET?.trim();
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
