// CNPJ: validação, extração de texto e consulta em fontes públicas gratuitas.

export function soDigitos(t: string) { return t.replace(/\D/g, ""); }

export function cnpjValido(c: string): boolean {
  const d = soDigitos(c);
  if (d.length !== 14 || /^(\d)\1+$/.test(d)) return false;
  const calc = (base: string, pesos: number[]) => {
    const s = base.split("").reduce((acc, n, i) => acc + Number(n) * pesos[i], 0);
    const r = s % 11;
    return r < 2 ? 0 : 11 - r;
  };
  const p1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const p2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const d1 = calc(d.slice(0, 12), p1);
  const d2 = calc(d.slice(0, 12) + d1, p2);
  return d.endsWith(`${d1}${d2}`);
}

export function formatarCnpj(c: string) {
  const d = soDigitos(c);
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

/** Acha CNPJs válidos num texto/HTML (rodapé de site, política de privacidade…). */
export function extrairCnpjs(texto: string): string[] {
  const achados = new Set<string>();
  const re = /(?<!\d)(\d{2})[.\s]?(\d{3})[.\s]?(\d{3})[\s/]?(\d{4})[-.\s]?(\d{2})(?!\d)/g;
  for (const m of texto.matchAll(re)) {
    const d = m.slice(1, 6).join("");
    if (cnpjValido(d)) achados.add(d);
  }
  return [...achados];
}
