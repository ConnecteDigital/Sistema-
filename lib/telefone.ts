// Normalização de telefones BR (seção 9). Funções puras.

export type Telefone = {
  numero: string;        // só dígitos, sem 55: "11987654321", "08001234567", "40031234"
  formatado: string;     // "(11) 98765-4321", "0800 123 4567", "4003-1234"
  ddd: string | null;    // null para números nacionais
  nacional: boolean;     // 0800 / 4003 / 4004 / 3003 / 3004
  celular: boolean;
};

const DDDS = new Set([
  11,12,13,14,15,16,17,18,19,21,22,24,27,28,31,32,33,34,35,37,38,41,42,43,44,45,46,47,48,49,
  51,53,54,55,61,62,63,64,65,66,67,68,69,71,73,74,75,77,79,81,82,83,84,85,86,87,88,89,91,92,93,
  94,95,96,97,98,99,
].map(String));

export function normalizarTelefone(bruto: string): Telefone | null {
  let d = bruto.replace(/\D/g, "");
  if (!d) return null;

  // Nacionais
  if (/^0?800\d{7}$/.test(d)) {
    d = d.replace(/^0?800/, "0800");
    return { numero: d, formatado: `0800 ${d.slice(4, 7)} ${d.slice(7)}`, ddd: null, nacional: true, celular: false };
  }
  if (/^(4003|4004|3003|3004|4020|4002)\d{4}$/.test(d)) {
    return { numero: d, formatado: `${d.slice(0, 4)}-${d.slice(4)}`, ddd: null, nacional: true, celular: false };
  }

  if ((d.length === 12 || d.length === 13) && d.startsWith("55")) d = d.slice(2);
  if ((d.length === 11 || d.length === 12) && d.startsWith("0")) d = d.slice(1);        // 0 + DDD (+ operadora já removida)
  if (d.length === 13 && d.startsWith("0")) d = d.slice(3);                              // 0 + operadora (2) + DDD...
  if (d.length !== 10 && d.length !== 11) return null;

  const ddd = d.slice(0, 2);
  const local = d.slice(2);
  if (!DDDS.has(ddd)) return null;
  if (local.startsWith("0") || /^(\d)\1+$/.test(local)) return null;                   // lixo: 0..., 0000-0000, 9999...
  if (d.length === 11 && !local.startsWith("9")) return null;                            // celular sempre começa com 9
  if (d.length === 10 && !/^[2-5]/.test(local)) {
    // 8 dígitos começando com 6-9 = celular antigo sem o 9: completa
    if (/^[6-9]/.test(local)) return normalizarTelefone(ddd + "9" + local);
    return null;
  }
  const celular = d.length === 11;
  const formatado = celular ? `(${ddd}) ${local.slice(0, 5)}-${local.slice(5)}` : `(${ddd}) ${local.slice(0, 4)}-${local.slice(4)}`;
  return { numero: d, formatado, ddd, nacional: false, celular };
}

/** Escolhe o telefone principal (seção 10): WhatsApp com DDD da região › celular da região › fixo da região › outros. */
export function escolherPrincipal(
  telefones: Telefone[], whatsapps: Telefone[], dddRegiao: string | null, evitar: Set<string> = new Set(),
): Telefone | null {
  const wNums = new Set(whatsapps.map((w) => w.numero));
  const todos = [...whatsapps, ...telefones.filter((t) => !wNums.has(t.numero))];
  const candidatos = todos.filter((t) => !evitar.has(t.numero));
  const lista = candidatos.length ? candidatos : todos;
  const pontuar = (t: Telefone) =>
    (wNums.has(t.numero) ? 4 : 0) + (t.ddd && t.ddd === dddRegiao ? 8 : 0) + (t.celular ? 2 : 0) + (t.nacional ? -20 : 0);
  return [...lista].sort((a, b) => pontuar(b) - pontuar(a))[0] ?? null;
}
