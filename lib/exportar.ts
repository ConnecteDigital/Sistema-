// Exportação da lista de telefones (XML/CSV) para disparo no WhatsApp. Pura.
import type { Dono } from "./donos";

export type Contato = {
  nome: string; empresa: string; cnpj: string; site: string; link: string; telefone: string; telefoneE164: string;
  whatsapp: boolean; prioridade: string; regiao: string; presenca: string; motivo: string; outrosSites: string;
};

export function paraE164(tel: string): string | null {
  const d = tel.replace(/\D/g, "");
  if (d.length === 10 || d.length === 11) return `+55${d}`;
  return null;
}

export function donosParaContatos(donos: Dono[], filtro: "ligar" | "todos" | "whatsapp"): Contato[] {
  return donos
    .filter((d) => filtro === "todos" || d.prioridade !== "Baixa")
    .filter((d) => d.telefone && paraE164(d.telefone))
    .map((d) => {
      const dig = d.telefone!.replace(/\D/g, "");
      const site = d.sites.find((s) => !s.startsWith("perfil-google:")) ?? "";
      return {
        nome: d.principal.nome ?? d.empresa, empresa: d.empresa, cnpj: d.cnpj ?? "", site,
        link: site ? `https://${site}` : "", telefone: d.telefone!, telefoneE164: paraE164(d.telefone!)!,
        whatsapp: dig.length === 11 && dig[2] === "9", prioridade: d.prioridade, regiao: d.regioes.join(", "),
        presenca: `${Math.round(d.presenca * 100)}%`, motivo: d.principal.observacoes[0] ?? "",
        outrosSites: d.sites.filter((s) => s !== site).join(", "),
      };
    })
    .filter((c) => filtro !== "whatsapp" || c.whatsapp);
}

const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

export function contatosXml(contatos: Contato[], meta: { rodada: number; termos: string[] }): string {
  const linhas = contatos.map((c) => `  <contato>
    <nome>${esc(c.nome)}</nome>
    <empresa>${esc(c.empresa)}</empresa>
    <cnpj>${esc(c.cnpj)}</cnpj>
    <telefone>${esc(c.telefone)}</telefone>
    <telefone_e164>${esc(c.telefoneE164)}</telefone_e164>
    <whatsapp>${c.whatsapp ? "sim" : "nao"}</whatsapp>
    <site>${esc(c.site)}</site>
    <link>${esc(c.link)}</link>
    <prioridade>${esc(c.prioridade)}</prioridade>
    <regiao>${esc(c.regiao)}</regiao>
    <presenca>${esc(c.presenca)}</presenca>
    <motivo>${esc(c.motivo)}</motivo>
    <outros_sites>${esc(c.outrosSites)}</outros_sites>
  </contato>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<contatos rodada="${meta.rodada}" termos="${esc(meta.termos.join(", "))}" gerado_em="${new Date().toISOString()}" total="${contatos.length}">
${linhas}
</contatos>
`;
}

export function contatosCsv(contatos: Contato[]): string {
  const cab = ["nome", "empresa", "cnpj", "telefone", "telefone_e164", "whatsapp", "site", "link", "prioridade", "regiao", "presenca", "motivo", "outros_sites"];
  const q = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const linhas = contatos.map((c) => [c.nome, c.empresa, c.cnpj, c.telefone, c.telefoneE164, c.whatsapp ? "sim" : "nao",
    c.site, c.link, c.prioridade, c.regiao, c.presenca, c.motivo, c.outrosSites].map(q).join(";"));
  return "﻿" + [cab.join(";"), ...linhas].join("\r\n") + "\r\n";   // BOM + ; = abre certo no Excel BR
}
