// Arquivo de contatos (.vcf) para importar no celular de uma vez. Puro.

export type ContatoVcf = { nome: string; telefone: string; site?: string | null; nota?: string | null };

const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/([,;])/g, "\\$1");

/** "(11) 98765-4321" → "+5511987654321" (só números brasileiros com DDD). */
export function telefoneVcf(t: string): string | null {
  const d = t.replace(/\D/g, "");
  if (d.length === 10 || d.length === 11) return `+55${d}`;
  if ((d.length === 12 || d.length === 13) && d.startsWith("55")) return `+${d}`;
  return null;
}

export function gerarVcf(contatos: ContatoVcf[]): string {
  return contatos.map((c) => [
    "BEGIN:VCARD", "VERSION:3.0",
    `FN:${esc(c.nome)}`, `N:${esc(c.nome)};;;;`,
    `TEL;TYPE=CELL:${c.telefone}`,
    ...(c.site ? [`URL:${esc(c.site)}`] : []),
    ...(c.nota ? [`NOTE:${esc(c.nota)}`] : []),
    "END:VCARD",
  ].join("\r\n")).join("\r\n") + "\r\n";
}
