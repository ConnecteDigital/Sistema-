import "server-only";
import { cnpjValido, formatarCnpj, soDigitos } from "./cnpj";
import { baixarPagina, analisarPagina } from "./site";

// Consulta sob demanda (botão "Consultar CNPJ"). Fontes públicas e gratuitas:
// 1) Registro.br (RDAP): titular de domínios .br — traz CNPJ quando o dono é empresa.
// 2) O próprio site: CNPJ escrito no rodapé / política de privacidade / contato.
// 3) BrasilAPI (dados da Receita), com publica.cnpj.ws como reserva.

export type DadosEmpresa = {
  cnpj: string; razaoSocial: string | null; nomeFantasia: string | null; situacao: string | null;
  abertura: string | null; atividade: string | null; porte: string | null; endereco: string | null;
  cidade: string | null; uf: string | null; telefones: string[]; email: string | null;
  socios: { nome: string; qualificacao: string | null }[]; fonteDados: string;
};
export type ResultadoCnpj = {
  dominio: string;
  titularDominio: { nome: string | null; documento: string | null; tipo: "cnpj" | "cpf" | null } | null;
  encontrados: { cnpj: string; origem: string[] }[];
  empresas: DadosEmpresa[];
  avisos: string[];
};

const H = { "user-agent": "robo-prospeccao/1.0", accept: "application/json" };

type Rdap = {
  entities?: { roles?: string[]; vcardArray?: [string, [string, unknown, string, unknown][]];
    publicIds?: { type?: string; identifier?: string }[]; entities?: Rdap["entities"] }[];
};

async function titularRegistroBr(dominio: string): Promise<ResultadoCnpj["titularDominio"]> {
  const r = await fetch(`https://rdap.registro.br/domain/${encodeURIComponent(dominio)}`, {
    headers: { ...H, accept: "application/rdap+json" }, signal: AbortSignal.timeout(10_000), cache: "no-store",
  });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`Registro.br respondeu HTTP ${r.status}`);
  const j = (await r.json()) as Rdap;
  const titular = (j.entities ?? []).find((e) => e.roles?.includes("registrant"));
  if (!titular) return null;
  const nome = (titular.vcardArray?.[1] ?? []).find((c) => c[0] === "fn")?.[3];
  const id = titular.publicIds?.find((p) => p.identifier);
  const tipo = id?.type?.toLowerCase().includes("cnpj") ? "cnpj" : id?.type?.toLowerCase().includes("cpf") ? "cpf" : null;
  return { nome: typeof nome === "string" ? nome : null, documento: id?.identifier ?? null, tipo };
}

async function dadosBrasilApi(cnpj: string): Promise<DadosEmpresa | null> {
  const r = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`, { headers: H, signal: AbortSignal.timeout(12_000), cache: "no-store" });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`BrasilAPI HTTP ${r.status}`);
  const j = await r.json();
  const tel = [j.ddd_telefone_1, j.ddd_telefone_2].filter((t: unknown) => typeof t === "string" && t.trim()).map((t: string) => t.trim());
  return {
    cnpj, razaoSocial: j.razao_social ?? null, nomeFantasia: j.nome_fantasia || null,
    situacao: j.descricao_situacao_cadastral ?? null, abertura: j.data_inicio_atividade ?? null,
    atividade: j.cnae_fiscal_descricao ?? null, porte: j.porte ?? j.descricao_porte ?? null,
    endereco: [j.descricao_tipo_de_logradouro, j.logradouro, j.numero, j.complemento, j.bairro].filter(Boolean).join(", ") || null,
    cidade: j.municipio ?? null, uf: j.uf ?? null, telefones: tel, email: j.email || null,
    socios: (j.qsa ?? []).map((s: { nome_socio?: string; qualificacao_socio?: string }) => ({ nome: s.nome_socio ?? "", qualificacao: s.qualificacao_socio ?? null })),
    fonteDados: "BrasilAPI (Receita Federal)",
  };
}

async function dadosCnpjWs(cnpj: string): Promise<DadosEmpresa | null> {
  const r = await fetch(`https://publica.cnpj.ws/cnpj/${cnpj}`, { headers: H, signal: AbortSignal.timeout(12_000), cache: "no-store" });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`CNPJ.ws HTTP ${r.status}`);
  const j = await r.json();
  const e = j.estabelecimento ?? {};
  const tel = [[e.ddd1, e.telefone1], [e.ddd2, e.telefone2]].filter(([, t]) => t).map(([d, t]) => `${d ?? ""}${t}`);
  return {
    cnpj, razaoSocial: j.razao_social ?? null, nomeFantasia: e.nome_fantasia || null, situacao: e.situacao_cadastral ?? null,
    abertura: e.data_inicio_atividade ?? null, atividade: e.atividade_principal?.descricao ?? null, porte: j.porte?.descricao ?? null,
    endereco: [e.tipo_logradouro, e.logradouro, e.numero, e.complemento, e.bairro].filter(Boolean).join(", ") || null,
    cidade: e.cidade?.nome ?? null, uf: e.estado?.sigla ?? null, telefones: tel, email: e.email || null,
    socios: (j.socios ?? []).map((s: { nome?: string; qualificacao_socio?: { descricao?: string } }) => ({ nome: s.nome ?? "", qualificacao: s.qualificacao_socio?.descricao ?? null })),
    fonteDados: "CNPJ.ws (Receita Federal)",
  };
}

async function dadosEmpresa(cnpj: string, avisos: string[]): Promise<DadosEmpresa | null> {
  try { const d = await dadosBrasilApi(cnpj); if (d) return d; }
  catch (e) { avisos.push(String(e instanceof Error ? e.message : e)); }
  try { return await dadosCnpjWs(cnpj); }
  catch (e) { avisos.push(String(e instanceof Error ? e.message : e)); return null; }
}

export async function consultarCnpjDoSite(dominio: string, linkAnuncio: string | null): Promise<ResultadoCnpj> {
  const avisos: string[] = [];
  const origens = new Map<string, Set<string>>();
  const anotar = (cnpj: string, origem: string) => {
    const d = soDigitos(cnpj);
    if (!cnpjValido(d)) return;
    if (!origens.has(d)) origens.set(d, new Set());
    origens.get(d)!.add(origem);
  };

  // 1) Registro.br (só .br)
  let titularDominio: ResultadoCnpj["titularDominio"] = null;
  if (dominio.endsWith(".br")) {
    try {
      titularDominio = await titularRegistroBr(dominio);
      if (titularDominio?.tipo === "cnpj" && titularDominio.documento) anotar(titularDominio.documento, "Registro.br (dono do domínio)");
      if (titularDominio?.tipo === "cpf") avisos.push("O domínio está registrado no CPF de uma pessoa física (o Registro.br não mostra o número).");
    } catch (e) { avisos.push(String(e instanceof Error ? e.message : e)); }
  } else {
    avisos.push("Domínio não é .br: o Registro.br não tem o dono. Procurando só no site.");
  }

  // 2) Site: página do anúncio, home e páginas comuns de contato
  const urls = [...new Set([linkAnuncio, `https://${dominio}/`, `https://www.${dominio}/`].filter(Boolean) as string[])];
  let algumaAbriu = false;
  for (const url of urls) {
    const p = await baixarPagina(url, 12_000);
    if (!p.html) continue;
    algumaAbriu = true;
    for (const c of analisarPagina(p).cnpjs) anotar(c, "Site");
    if (origens.size) break;
  }
  if (!origens.size && algumaAbriu) {
    for (const caminho of ["/contato", "/politica-de-privacidade", "/sobre", "/quem-somos"]) {
      const p = await baixarPagina(`https://${dominio}${caminho}`, 8_000);
      if (p.ok) for (const c of analisarPagina(p).cnpjs) anotar(c, `Site (${caminho})`);
      if (origens.size) break;
    }
  }
  if (!algumaAbriu) avisos.push("Não consegui abrir o site.");

  // 3) Dados da Receita para cada CNPJ (no máximo 3)
  const encontrados = [...origens].map(([cnpj, o]) => ({ cnpj: formatarCnpj(cnpj), origem: [...o] }));
  const empresas: DadosEmpresa[] = [];
  for (const [cnpj] of [...origens].slice(0, 3)) {
    const d = await dadosEmpresa(cnpj, avisos);
    if (d) empresas.push({ ...d, cnpj: formatarCnpj(cnpj) });
  }
  if (!encontrados.length) avisos.push("Nenhum CNPJ encontrado no Registro.br nem no site.");
  return { dominio, titularDominio, encontrados, empresas, avisos };
}
