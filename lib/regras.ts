// Regras, observações e prioridade (seção 10). Funções puras.
import { escolherPrincipal, normalizarTelefone, type Telefone } from "./telefone";

export type Prioridade = "Máxima" | "Alta" | "Normal" | "Baixa";

export type PresencaRegiao = {
  regiao: string; ddd: string; presenca: number; forca: string; pctSitelinks: number; duplicado: number;
  buscas?: number;                                   // buscas feitas na região
  // Onde ele anuncia: só as cidades em que apareceu (quando não aparece na região toda). null = sem esse dado.
  foco?: { cidades: string[]; buscas: number; aparicoes: number; presenca: number; forca: string } | null;
};
export type SiteResumo = {
  situacao: string; motivo: string | null; telefones: string[]; whatsapps: string[];
  tagGoogle: string | null; tagsAw: string[]; tagsGtm: string[];
};
export type EntradaLead = {
  dominio: string; regioes: PresencaRegiao[]; site: SiteResumo | null;
  cnpjs?: string[]; razaoSocial?: string | null;      // da consulta de CNPJ (só dígitos)
  palavraErrada?: string[] | null;                    // termos anunciados que o site não menciona (null = ok/não verificado)
  cliente?: boolean;                                  // já é cliente da Connect (status "Cliente Connect")
};
export type Contexto = {
  dominiosPorTelefone: Map<string, Set<string>>;   // numero → domínios que divulgam
  dominiosPorTag: Map<string, Set<string>>;        // AW-/GTM- → domínios
  dominiosPorCnpj: Map<string, Set<string>>;       // CNPJ (dígitos) → domínios
};
export type SaidaLead = {
  prioridade: Prioridade; telefonePrincipal: string | null; outrosTelefones: string[];
  observacoes: string[]; forca: string; presenca: number;
};

const PESO: Record<Prioridade, number> = { "Máxima": 0, Alta: 1, Normal: 2, Baixa: 3 };
export const ordemPrioridade = (p: string) => PESO[p as Prioridade] ?? 9;

/** Monta os índices de telefone/tag → domínios a partir das últimas verificações de site. */
export function montarContexto(
  sites: { dominio: string; site: SiteResumo }[], cnpjs: { dominio: string; cnpjs: string[] }[] = [],
): Contexto {
  const dominiosPorTelefone = new Map<string, Set<string>>();
  const dominiosPorTag = new Map<string, Set<string>>();
  const dominiosPorCnpj = new Map<string, Set<string>>();
  const add = (m: Map<string, Set<string>>, k: string, d: string) => { if (!m.has(k)) m.set(k, new Set()); m.get(k)!.add(d); };
  for (const { dominio, site } of sites) {
    for (const t of [...site.telefones, ...site.whatsapps]) {
      const n = normalizarTelefone(t);
      if (n && !n.nacional) add(dominiosPorTelefone, n.numero, dominio);
    }
    for (const tag of [...site.tagsAw, ...site.tagsGtm]) add(dominiosPorTag, tag, dominio);
  }
  for (const c of cnpjs) for (const n of c.cnpjs) add(dominiosPorCnpj, n, c.dominio);
  return { dominiosPorTelefone, dominiosPorTag, dominiosPorCnpj };
}

export function avaliarLead(e: EntradaLead, ctx: Contexto): SaidaLead {
  const obs: string[] = [];
  const perfil = e.dominio.startsWith("perfil-google:");
  // Força medida ONDE ELE ANUNCIA: se aparece só em algumas cidades da região, conta só elas
  // (antes contava a região inteira e quase ninguém que anuncia em poucas cidades saía "Forte").
  const efetiva = (r: PresencaRegiao) => (r.foco && r.foco.buscas >= 5 ? r.foco.presenca : r.presenca);
  const principalRegiao = [...e.regioes].sort((a, b) => efetiva(b) - efetiva(a))[0];
  const focoP = principalRegiao?.foco && principalRegiao.foco.buscas >= 5 ? principalRegiao.foco : null;
  const forca = focoP?.forca ?? principalRegiao?.forca ?? "Fraca";
  const presenca = principalRegiao ? efetiva(principalRegiao) : 0;
  const amostraPequena = (focoP?.buscas ?? principalRegiao?.buscas ?? 99) < 5;
  const dddRegiao = principalRegiao?.ddd ?? null;
  let baixa = false, maxima = false;

  const s = e.site;
  const telefones = (s?.telefones ?? []).map(normalizarTelefone).filter((t): t is Telefone => !!t);
  const whatsapps = (s?.whatsapps ?? []).map(normalizarTelefone).filter((t): t is Telefone => !!t);

  // Site fora do ar com anúncio rodando
  if (s && ["fora_do_ar", "suspenso", "dns"].includes(s.situacao)) {
    maxima = true;
    obs.push(`SITE FORA DO AR e o anúncio continua rodando: está pagando clique para uma página de erro (${s.motivo ?? s.situacao}).`);
  }
  if (s?.situacao === "bloqueado") obs.push("O site bloqueia robôs: conferir abrindo no celular.");
  if (s?.situacao === "nao_verificado" && s.motivo) {
    obs.push(`${s.motivo}. Confira abrindo no celular: se não abrir também, é argumento forte (anúncio pagando clique para página de erro).`);
  }
  if (s?.situacao === "ok" && /^(Página do anúncio|A página do anúncio)/.test(s.motivo ?? "")) {
    obs.push(`${s.motivo}. Confira clicando no anúncio no celular antes de citar.`);
  }
  if (s?.situacao === "ok" && s.motivo?.startsWith("Certificado")) {
    obs.push(`${s.motivo.replace(/ \([^)]*\)$/, "")}. Confira abrindo no celular antes de citar.`);
  }
  if (perfil) obs.push("O anúncio leva para o perfil do Google, não para um site.");

  // Rede: mesmo número em 3+ domínios
  const numerosRede = new Set<string>();
  const mesmoDono = new Set<string>();
  for (const t of [...telefones, ...whatsapps]) {
    const doms = ctx.dominiosPorTelefone.get(t.numero);
    if (!doms) continue;
    const outros = [...doms].filter((d) => d !== e.dominio);
    if (doms.size >= 3) {
      numerosRede.add(t.numero);
      if (!baixa) obs.push(`Mesmo WhatsApp/telefone ${t.formatado} em ${doms.size} sites: parece rede/agência que gera leads, não o dono direto.`);
      baixa = true;
    } else outros.forEach((d) => mesmoDono.add(d));
  }
  for (const tag of [...(s?.tagsAw ?? []), ...(s?.tagsGtm ?? [])]) {
    for (const d of ctx.dominiosPorTag.get(tag) ?? []) if (d !== e.dominio) mesmoDono.add(d);
  }
  // Mesmo CNPJ em outros sites = mesmo dono, com certeza
  const mesmoCnpj = new Set<string>();
  for (const c of e.cnpjs ?? []) for (const d of ctx.dominiosPorCnpj.get(c) ?? []) if (d !== e.dominio) mesmoCnpj.add(d);
  if (mesmoCnpj.size) {
    obs.push(`Mesmo CNPJ${e.razaoSocial ? ` (${e.razaoSocial})` : ""} que ${[...mesmoCnpj].slice(0, 4).join(", ")}: mesmo dono, ligar uma vez só.`);
    mesmoCnpj.forEach((d) => mesmoDono.delete(d));
  }
  if (mesmoDono.size && !baixa) obs.push(`Mesmo dono que ${[...mesmoDono].slice(0, 3).join(", ")}: ligar uma vez só.`);

  // Só 0800 / 4003
  const todos = [...telefones, ...whatsapps];
  if (todos.length && todos.every((t) => t.nacional)) {
    baixa = true;
    obs.push("Só divulga 0800/4003: empresa grande ou central.");
  }

  // Telefone principal
  const principal = escolherPrincipal(telefones, whatsapps, dddRegiao, numerosRede);
  const outros = todos.filter((t) => t.numero !== principal?.numero).map((t) => t.formatado);
  if (principal?.ddd && dddRegiao && principal.ddd !== dddRegiao) {
    obs.push(`Telefone com DDD ${principal.ddd} (região é ${dddRegiao}): pode ser central ou empresa de fora.`);
  }
  if (!principal && !perfil) obs.push("Telefone não encontrado no site: pegar abrindo o anúncio no celular.");
  if (!principal && perfil) obs.push("Pegar o telefone no perfil do Google (abrir o anúncio no celular).");

  // Outras observações
  if (e.regioes.length > 1) obs.push(`Aparece em ${e.regioes.length} regiões (${e.regioes.map((r) => r.regiao).join(", ")}): ligar uma vez só.`);
  if (s?.situacao === "ok" && s.tagGoogle === "nao") obs.push("Nenhuma tag do Google no site: provavelmente não mede conversões. Argumento forte.");
  if (s?.situacao === "ok" && s.tagGoogle === "so_gtm") obs.push("Só Tag Manager no site (não dá para confirmar se mede conversões).");
  if (e.regioes.length && e.regioes.every((r) => r.pctSitelinks === 0)) obs.push("Anúncio sem sitelinks.");
  if (e.regioes.some((r) => r.duplicado > 0)) obs.push("Aparece duas vezes na mesma busca: possivelmente duas contas de Google Ads.");

  if (e.palavraErrada?.length) {
    obs.unshift(`Apareceu na busca de "${e.palavraErrada.slice(0, 2).join('", "')}" mas o site não fala disso: está anunciando na palavra-chave errada (pagando clique de quem procura outro serviço). Argumento forte.`);
  }
  if (focoP && principalRegiao) {
    obs.push(`Anuncia em ${focoP.cidades.slice(0, 3).join(", ")}${focoP.cidades.length > 3 ? "…" : ""}: lá aparece em ${focoP.aparicoes} de ${focoP.buscas} buscas ` +
      `(${Math.round(focoP.presenca * 100)}%, ${focoP.forca.toLowerCase()}). Na região inteira: ${Math.round(principalRegiao.presenca * 100)}%.`);
  }
  if (amostraPequena) obs.push("Poucas buscas nesta rodada: a força ainda não é confiável.");

  // Prioridade ALTA só com sinal concreto de que está perdendo dinheiro:
  //  - fraco ONDE ANUNCIA (com amostra suficiente), ou
  //  - anunciando na palavra errada, ou
  //  - problema no site/página do anúncio (não abriu para o robô, 404, cadeado inválido).
  // "Sem tag" e "sem sitelinks" sozinhos NÃO bastam (muita conta boa mede ligação pelo próprio anúncio).
  const problemaSite = !!s && (s.situacao === "nao_verificado" ||
    (s.situacao === "ok" && /^(Página do anúncio|A página do anúncio|Certificado de segurança inválido)/.test(s.motivo ?? "")));
  const fracoOndeAnuncia = forca === "Fraca" && !amostraPequena;
  const sinalForte = fracoOndeAnuncia || !!e.palavraErrada?.length || problemaSite;
  if (e.cliente) obs.unshift("CLIENTE DA CONNECT: não prospectar.");
  const prioridade: Prioridade = e.cliente ? "Baixa" : maxima ? "Máxima" : baixa ? "Baixa" : sinalForte ? "Alta" : "Normal";
  return { prioridade, telefonePrincipal: principal?.formatado ?? null, outrosTelefones: outros, observacoes: obs, forca, presenca };
}
