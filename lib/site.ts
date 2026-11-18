import "server-only";
import { request as httpsRequest } from "node:https";
import { normalizarTelefone, type Telefone } from "./telefone";
import { extrairCnpjs } from "./cnpj";
import { normalizar } from "./palavra";

// Verificação de site pelo nosso servidor (seção 9). Grátis.

const UA = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36";
const MAX_HTML = 2_000_000;

export type Pagina = {
  ok: boolean; status: number | null; urlFinal: string | null; html: string; tempoMs: number;
  erroRede: "dns" | "timeout" | "conexao" | null; erroMsg: string | null;
  avisoCertificado?: string | null;   // abriu, mas o certificado (cadeado) tem defeito (código do erro)
};

/** Erros de certificado: o site responde, só o "cadeado" tem defeito (o navegador costuma abrir mesmo assim). */
const ERRO_CERT = /CERT|SELF_SIGNED|UNABLE_TO_GET_ISSUER|UNABLE_TO_VERIFY|ERR_TLS|DEPTH_ZERO/i;

/** Segunda tentativa sem validar o certificado: só para saber se o site abre (não confia no conteúdo para mais nada). */
function baixarIgnorandoCertificado(u: URL, timeoutMs: number, saltos = 5): Promise<{ status: number; html: string; urlFinal: string } | null> {
  return new Promise((resolve) => {
    if (u.protocol !== "https:") return resolve(null);
    const req = httpsRequest(u, {
      rejectUnauthorized: false, timeout: timeoutMs,
      headers: { "user-agent": UA, accept: "text/html,application/xhtml+xml,*/*;q=0.8", "accept-language": "pt-BR,pt;q=0.9" },
    }, (res) => {
      const st = res.statusCode ?? 0;
      if (st >= 300 && st < 400 && res.headers.location && saltos > 0) {
        res.resume();
        let prox: URL;
        try { prox = new URL(res.headers.location, u); } catch { return resolve(null); }
        if (!urlPermitida(prox)) return resolve(null);
        if (prox.protocol === "http:") {   // redirecionou para http: usa o fetch normal
          fetch(prox, { redirect: "follow", signal: AbortSignal.timeout(timeoutMs), headers: { "user-agent": UA } })
            .then(async (r) => resolve({ status: r.status, html: (await r.text()).slice(0, MAX_HTML), urlFinal: r.url }))
            .catch(() => resolve(null));
          return;
        }
        baixarIgnorandoCertificado(prox, timeoutMs, saltos - 1).then(resolve);
        return;
      }
      let html = "";
      res.setEncoding("utf8");
      res.on("data", (c: string) => { html += c; if (html.length >= MAX_HTML) res.destroy(); });
      res.on("end", () => resolve({ status: st, html, urlFinal: u.toString() }));
      res.on("close", () => resolve({ status: st, html, urlFinal: u.toString() }));
      res.on("error", () => resolve(null));
    });
    req.on("timeout", () => { req.destroy(); resolve(null); });
    req.on("error", () => resolve(null));
    req.end();
  });
}

function urlPermitida(u: URL) {
  if (!/^https?:$/.test(u.protocol)) return false;
  const h = u.hostname;
  if (h === "localhost" || h.endsWith(".local") || h.endsWith(".internal")) return false;
  if (/^\d+\.\d+\.\d+\.\d+$/.test(h) || h.includes(":")) return false; // IP literal: não é site de anunciante
  return true;
}

export async function baixarPagina(url: string, timeoutMs = 15_000): Promise<Pagina> {
  const inicio = Date.now();
  let u: URL;
  try { u = new URL(url); } catch { return { ok: false, status: null, urlFinal: null, html: "", tempoMs: 0, erroRede: "conexao", erroMsg: "URL inválida" }; }
  if (!urlPermitida(u)) return { ok: false, status: null, urlFinal: null, html: "", tempoMs: 0, erroRede: "conexao", erroMsg: "URL não permitida" };
  try {
    const r = await fetch(u, {
      redirect: "follow", signal: AbortSignal.timeout(timeoutMs), cache: "no-store",
      headers: { "user-agent": UA, accept: "text/html,application/xhtml+xml,*/*;q=0.8", "accept-language": "pt-BR,pt;q=0.9" },
    });
    let html = "";
    if (r.body) {
      const leitor = r.body.getReader();
      const dec = new TextDecoder("utf-8", { fatal: false });
      while (html.length < MAX_HTML) {
        const { done, value } = await leitor.read();
        if (done) break;
        html += dec.decode(value, { stream: true });
      }
      leitor.cancel().catch(() => {});
    }
    return { ok: r.ok, status: r.status, urlFinal: r.url, html, tempoMs: Date.now() - inicio, erroRede: null, erroMsg: null };
  } catch (e) {
    const causa = (e as { cause?: { code?: string } })?.cause?.code ?? "";
    const msg = e instanceof Error ? e.message : String(e);
    const erroRede = /ENOTFOUND|EAI_AGAIN/.test(causa) ? "dns" : /timeout|aborted/i.test(msg + causa) ? "timeout" : "conexao";
    // certificado com defeito: o navegador normalmente abre. Tenta de novo sem validar para ver se o site responde.
    if (ERRO_CERT.test(causa + " " + msg)) {
      const r = await baixarIgnorandoCertificado(u, timeoutMs);
      if (r) return { ok: r.status >= 200 && r.status < 300, status: r.status, urlFinal: r.urlFinal, html: r.html,
        tempoMs: Date.now() - inicio, erroRede: null, erroMsg: null, avisoCertificado: causa || msg };
    }
    return { ok: false, status: null, urlFinal: null, html: "", tempoMs: Date.now() - inicio, erroRede, erroMsg: causa || msg };
  }
}

// ---------------------------------------------------------------------------
// Análise do HTML (pura)
// ---------------------------------------------------------------------------
const SUSPENSO = /account (has been )?suspended|this account has been suspended|conta suspensa|site suspenso|hospedagem suspensa|website (is )?suspended|cpanel.*suspend/i;
const ESTACIONADO = /domain (name )?(is )?for sale|este dom[ií]nio (est[aá] )?(a|à) venda|buy this domain|parkingcrew|sedoparking|bodis\.com|dom[ií]nio (expirado|vencido)|domain (has )?expired|this domain is parked|godaddy.*parked|hugedomains/i;
const BLOQUEIO = /cf-chl|challenge-platform|attention required.*cloudflare|just a moment\.\.\.|access denied|captcha/i;

export type Situacao = "ok" | "fora_do_ar" | "suspenso" | "dns" | "bloqueado" | "nao_verificado";
export type TagGoogle = "sim" | "so_gtm" | "nao" | "nao_verificado";

export type Analise = {
  situacao: Situacao; motivo: string | null; telefones: Telefone[]; whatsapps: Telefone[];
  tagsAw: string[]; tagsGtm: string[]; ga4: string[]; tagGoogle: TagGoogle; cnpjs: string[]; wordpress: boolean;
  texto: string;   // texto visível normalizado (sem acento, minúsculo), até 50 mil caracteres
};

function textoVisivel(html: string) {
  return html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ");
}

function unicos(ts: (Telefone | null)[]) {
  const m = new Map<string, Telefone>();
  for (const t of ts) if (t && !m.has(t.numero)) m.set(t.numero, t);
  return [...m.values()];
}

export function analisarPagina(p: Pagina): Analise {
  const vazio = { telefones: [], whatsapps: [], tagsAw: [], tagsGtm: [], ga4: [], cnpjs: [], wordpress: false, texto: "" };
  if (p.erroRede === "dns") return { ...vazio, situacao: "dns", motivo: "Domínio não existe (falha de DNS)", tagGoogle: "nao_verificado" };
  if (p.erroRede) return { ...vazio, situacao: "fora_do_ar", motivo: p.erroRede === "timeout" ? "Site não respondeu (tempo esgotado)" : `Site não abre (${p.erroMsg})`, tagGoogle: "nao_verificado" };

  const html = p.html;
  const st = p.status ?? 0;
  let situacao: Situacao = "ok";
  let motivo: string | null = null;
  if (SUSPENSO.test(html.slice(0, 200_000))) { situacao = "suspenso"; motivo = "Hospedagem suspensa (Account Suspended)"; }
  else if (ESTACIONADO.test(html.slice(0, 200_000)) && html.length < 150_000) { situacao = "fora_do_ar"; motivo = "Domínio estacionado / à venda / expirado"; }
  else if (st === 403 || st === 429 || (st === 503 && BLOQUEIO.test(html))) { situacao = "bloqueado"; motivo = `Site bloqueia robôs (HTTP ${st})`; }
  else if (st >= 500) { situacao = "fora_do_ar"; motivo = `Erro no servidor do site (HTTP ${st})`; }
  else if (st === 404 || st === 410) { situacao = "fora_do_ar"; motivo = `Página do anúncio não existe (HTTP ${st})`; }
  else if (!p.ok) { situacao = "nao_verificado"; motivo = `HTTP ${st}`; }
  if (situacao === "ok" && p.avisoCertificado) {
    motivo = /SELF_SIGNED|EXPIRED|ALTNAME|DEPTH_ZERO/i.test(p.avisoCertificado)
      ? `Certificado de segurança inválido: o site abre, mas o navegador pode mostrar "site não seguro" (${p.avisoCertificado})`
      : `Certificado de segurança incompleto: o site abre, mas alguns celulares podem mostrar aviso (${p.avisoCertificado})`;
  }

  // Telefones
  const tel = [...html.matchAll(/href=["']tel:([^"']+)["']/gi)].map((m) => normalizarTelefone(decodeURIComponent(m[1])));
  const wa = [...html.matchAll(/(?:wa\.me\/|whatsapp\.com\/send\/?\?[^"'\s]*?phone=|whatsapp:\/\/send\/?\?[^"'\s]*?phone=)(\+?\d[\d%\s-]{8,16})/gi)]
    .map((m) => normalizarTelefone(decodeURIComponent(m[1])));
  const whatsapps = unicos(wa);
  let telefones = unicos(tel);
  if (!telefones.length && !whatsapps.length) {
    const texto = textoVisivel(html);
    const brutos = [...texto.matchAll(/(?:\+?55\s?)?\(?\b([1-9]{2})\)?[\s.-]?(9?\d{4})[\s.-]?(\d{4})\b|0800[\s.-]?\d{3}[\s.-]?\d{4}|\b400[34][\s.-]?\d{4}\b/g)]
      .map((m) => normalizarTelefone(m[0]));
    telefones = unicos(brutos).slice(0, 6);
  }

  const tagsAw = [...new Set([...html.matchAll(/\bAW-\d{8,12}\b/g)].map((m) => m[0]))];
  const tagsGtm = [...new Set([...html.matchAll(/\bGTM-[A-Z0-9]{4,10}\b/g)].map((m) => m[0]))];
  const ga4 = [...new Set([...html.matchAll(/\bG-[A-Z0-9]{6,12}\b/g)].map((m) => m[0]))];

  let tagGoogle: TagGoogle;
  if (situacao !== "ok") tagGoogle = "nao_verificado";
  else if (tagsAw.length) tagGoogle = "sim";
  else if (tagsGtm.length) tagGoogle = "so_gtm";
  else {
    // HTML pequeno com scripts externos = provavelmente montado por JavaScript: não dá para afirmar
    const scriptsExternos = (html.match(/<script[^>]+src=/gi) ?? []).length;
    tagGoogle = html.length < 15_000 && scriptsExternos > 0 ? "nao_verificado" : "nao";
  }

  return {
    situacao, motivo, telefones, whatsapps, tagsAw, tagsGtm, ga4, tagGoogle,
    cnpjs: extrairCnpjs(textoVisivel(html)), wordpress: /wp-content|wp-includes/i.test(html),
    // título e descrição contam como conteúdo do site
    texto: normalizar([
      html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "",
      html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)/i)?.[1] ?? "",
      textoVisivel(html),
      // menus e imagens também dizem o que a empresa faz: textos alternativos e caminhos dos links
      // (ex.: <img alt="Caça vazamento">, href="/servicos/encanamento")
      ...[...html.matchAll(/\b(?:alt|title)=["']([^"']{2,200})["']/gi)].map((m) => m[1]),
      ...[...html.matchAll(/href=["'](?:https?:\/\/[^/"']+)?\/([^"'#?]{2,200})/gi)].map((m) => m[1].replace(/[/_.-]+/g, " ")),
    ].join(" ")).slice(0, 50_000),
  };
}

/**
 * Baixa e analisa a página do anúncio. Se ela der 404/410 mas o site existir, confere a página inicial
 * antes de dizer "fora do ar" (o anúncio pode apontar para uma página que foi apagada).
 */
export async function verificarUrl(url: string): Promise<{ pagina: Pagina; a: Analise }> {
  const pagina = await baixarPagina(url);
  const a = analisarPagina(pagina);
  if (a.situacao !== "fora_do_ar" || (pagina.status !== 404 && pagina.status !== 410)) return { pagina, a };
  let inicial: string | null = null;
  try { const u = new URL(url); inicial = u.pathname !== "/" || u.search ? `${u.protocol}//${u.host}/` : null; } catch { /* url ruim */ }
  if (!inicial) return { pagina, a };
  const p2 = await baixarPagina(inicial);
  const a2 = analisarPagina(p2);
  if (a2.situacao !== "ok") return { pagina, a };
  return { pagina: p2, a: { ...a2, motivo: `Página do anúncio dá erro ${pagina.status} (não existe), mas a página inicial do site abre` } };
}
