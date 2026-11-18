import "server-only";
import { request as httpsRequest } from "node:https";
import { normalizarTelefone, type Telefone } from "./telefone";
import { extrairCnpjs } from "./cnpj";
import { normalizar } from "./palavra";

// Verificação de site pelo nosso servidor (seção 9). Grátis.

const UA = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36";
const UA_PC = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
const MAX_HTML = 2_000_000;

export type Pagina = {
  ok: boolean; status: number | null; urlFinal: string | null; html: string; tempoMs: number;
  erroRede: "dns" | "timeout" | "conexao" | null; erroMsg: string | null;
  avisoCertificado?: string | null;   // abriu, mas o certificado (cadeado) tem defeito (código do erro)
};

/** Erros de certificado: o site responde, só o "cadeado" tem defeito (o navegador costuma abrir mesmo assim). */
const ERRO_CERT = /CERT|SELF_SIGNED|UNABLE_TO_GET_ISSUER|UNABLE_TO_VERIFY|ERR_TLS|DEPTH_ZERO/i;

/** Segunda tentativa sem validar o certificado: só para saber se o site abre (não confia no conteúdo para mais nada). */
function baixarIgnorandoCertificado(u: URL, timeoutMs: number, ua = UA, saltos = 5): Promise<{ status: number; html: string; urlFinal: string } | null> {
  return new Promise((resolve) => {
    if (u.protocol !== "https:") return resolve(null);
    const req = httpsRequest(u, {
      rejectUnauthorized: false, timeout: timeoutMs,
      headers: { "user-agent": ua, accept: "text/html,application/xhtml+xml,*/*;q=0.8", "accept-language": "pt-BR,pt;q=0.9" },
    }, (res) => {
      const st = res.statusCode ?? 0;
      if (st >= 300 && st < 400 && res.headers.location && saltos > 0) {
        res.resume();
        let prox: URL;
        try { prox = new URL(res.headers.location, u); } catch { return resolve(null); }
        if (!urlPermitida(prox)) return resolve(null);
        if (prox.protocol === "http:") {   // redirecionou para http: usa o fetch normal
          fetch(prox, { redirect: "follow", signal: AbortSignal.timeout(timeoutMs), headers: { "user-agent": ua } })
            .then(async (r) => resolve({ status: r.status, html: (await r.text()).slice(0, MAX_HTML), urlFinal: r.url }))
            .catch(() => resolve(null));
          return;
        }
        baixarIgnorandoCertificado(prox, timeoutMs, ua, saltos - 1).then(resolve);
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

export async function baixarPagina(url: string, timeoutMs = 15_000, ua = UA): Promise<Pagina> {
  const inicio = Date.now();
  let u: URL;
  try { u = new URL(url); } catch { return { ok: false, status: null, urlFinal: null, html: "", tempoMs: 0, erroRede: "conexao", erroMsg: "URL inválida" }; }
  if (!urlPermitida(u)) return { ok: false, status: null, urlFinal: null, html: "", tempoMs: 0, erroRede: "conexao", erroMsg: "URL não permitida" };
  try {
    const r = await fetch(u, {
      redirect: "follow", signal: AbortSignal.timeout(timeoutMs), cache: "no-store",
      headers: { "user-agent": ua, accept: "text/html,application/xhtml+xml,*/*;q=0.8", "accept-language": "pt-BR,pt;q=0.9" },
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
      const r = await baixarIgnorandoCertificado(u, timeoutMs, ua);
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
  // Sem resposta do nosso servidor não prova que o site está fora: muitas hospedagens barram servidores de fora do Brasil.
  if (p.erroRede) return { ...vazio, situacao: "nao_verificado", motivo: p.erroRede === "timeout" ? "O site não respondeu ao robô (tempo esgotado)" : `O site não abriu para o robô (${p.erroMsg})`, tagGoogle: "nao_verificado" };

  const html = p.html;
  const st = p.status ?? 0;
  let situacao: Situacao = "ok";
  let motivo: string | null = null;
  if (SUSPENSO.test(html.slice(0, 200_000))) { situacao = "suspenso"; motivo = "Hospedagem suspensa (Account Suspended)"; }
  else if (ESTACIONADO.test(html.slice(0, 200_000)) && html.length < 150_000) { situacao = "fora_do_ar"; motivo = "Domínio estacionado / à venda / expirado"; }
  else if (st === 403 || st === 429 || (st === 503 && BLOQUEIO.test(html))) { situacao = "bloqueado"; motivo = `Site bloqueia robôs (HTTP ${st})`; }
  else if (st >= 500) { situacao = "nao_verificado"; motivo = `O site respondeu erro HTTP ${st} para o robô`; }
  else if (st === 404 || st === 410) { situacao = "nao_verificado"; motivo = `A página do anúncio respondeu HTTP ${st} (não existe) para o robô`; }
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

/** O domínio existe? Pergunta a um DNS público (Google). true = existe, false = não existe (NXDOMAIN), null = não deu para saber. */
async function dominioExiste(host: string): Promise<boolean | null> {
  try {
    const r = await fetch(`https://dns.google/resolve?name=${encodeURIComponent(host)}&type=A`, { signal: AbortSignal.timeout(8_000), cache: "no-store" });
    const j = await r.json() as { Status?: number; Answer?: unknown[] };
    if (j.Status === 3) return false;
    if (j.Status === 0) return true;
    return null;
  } catch { return null; }
}

const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Baixa e analisa a página do anúncio, com cuidado para não dizer "fora do ar" à toa:
 * - erro de servidor, sem resposta ou 404: tenta de novo (como computador) e confere a página inicial;
 * - falha de DNS: confirma num DNS público se o domínio existe mesmo.
 * Só fica "fora do ar"/"dns"/"suspenso" com prova firme; o resto vira "não verificado" (conferir no celular).
 */
export async function verificarUrl(url: string): Promise<{ pagina: Pagina; a: Analise }> {
  let pagina = await baixarPagina(url);
  let a = analisarPagina(pagina);
  if (a.situacao === "ok" || a.situacao === "suspenso" || a.situacao === "bloqueado" || a.situacao === "fora_do_ar") return { pagina, a };

  let u: URL | null = null;
  try { u = new URL(url); } catch { /* url ruim */ }
  if (!u) return { pagina, a };

  // Falha de DNS: o domínio existe mesmo?
  if (a.situacao === "dns") {
    const existe = await dominioExiste(u.hostname);
    if (existe === false) return { pagina, a };   // confirmado: domínio não existe
    await espera(1500);
    const p2 = await baixarPagina(url, 15_000, UA_PC);
    const a2 = analisarPagina(p2);
    if (a2.situacao === "ok") return { pagina: p2, a: a2 };
    return { pagina, a: { ...a, situacao: "nao_verificado",
      motivo: existe ? "O endereço não abriu para o robô, mas o domínio existe" : "O endereço não abriu para o robô (DNS não confirmou)" } };
  }

  // Não verificado (erro de servidor, sem resposta, 404): tenta de novo como computador e a página inicial
  const tentativas: string[] = [url];
  const inicial = `${u.protocol}//${u.host}/`;
  if (inicial !== url) tentativas.push(inicial);
  const semWww = u.hostname.startsWith("www.") ? u.hostname.slice(4) : `www.${u.hostname}`;
  tentativas.push(`${u.protocol}//${semWww}/`);
  await espera(1500);
  for (const t of tentativas) {
    const p2 = await baixarPagina(t, 15_000, UA_PC);
    const a2 = analisarPagina(p2);
    if (a2.situacao === "ok") {
      const naoExiste = pagina.status === 404 || pagina.status === 410;
      return { pagina: p2, a: t === url ? a2 : { ...a2,
        motivo: naoExiste ? `Página do anúncio dá erro ${pagina.status} (não existe), mas a página inicial do site abre`
          : `A página do anúncio não abriu para o robô (${a.motivo}), mas a página inicial do site abre` } };
    }
  }
  return { pagina, a };
}
