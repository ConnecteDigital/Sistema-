// Um dono por linha: sites do mesmo dono (CNPJ/telefone/tag) juntos, na ordem de ligação. Pura.
import type { Linha } from "./linha";

export const PESO: Record<string, number> = { "Máxima": 0, Alta: 1, Normal: 2, Baixa: 3 };

export type Dono = {
  principal: Linha; sites: string[]; regioes: string[]; prioridade: string; presenca: number;
  telefone: string | null; empresa: string; cnpj: string | null; palavraErrada: boolean; problemaSite: string | null;
};

/** Um dono por linha (sites com mesmo CNPJ/telefone/tag juntos), na ordem de quem ligar primeiro. */
export function montarDonos(linhas: Linha[]): Dono[] {
  const porGrupo = new Map<number, Linha[]>();
  for (const l of linhas) {
    if (!porGrupo.has(l.grupo)) porGrupo.set(l.grupo, []);
    porGrupo.get(l.grupo)!.push(l);
  }
  const donos: Dono[] = [];
  for (const ls of porGrupo.values()) {
    const ord = [...ls].sort((a, b) => (PESO[a.prioridade ?? ""] ?? 9) - (PESO[b.prioridade ?? ""] ?? 9) || a.presenca - b.presenca);
    const p = ord[0];
    const comTel = ord.find((x) => x.telefone);
    const comCnpj = ord.find((x) => x.razaoSocial || x.cnpjPrincipal);
    donos.push({
      principal: p, sites: [...new Set(ls.map((x) => x.dominio))], regioes: [...new Set(ls.map((x) => x.regiao))],
      prioridade: p.prioridade ?? "Normal", presenca: Math.max(...ls.map((x) => x.presenca)),
      telefone: comTel?.telefone ?? null,
      empresa: comCnpj?.razaoSocial ?? p.nome ?? p.dominio, cnpj: comCnpj?.cnpjPrincipal ?? null,
      palavraErrada: ls.every((x) => x.termoNoSite === false),
      problemaSite: ls.map((x) => x.situacao).find((x) => x && x !== "ok") ?? null,
    });
  }
  return donos.sort((a, b) => (PESO[a.prioridade] ?? 9) - (PESO[b.prioridade] ?? 9) || a.presenca - b.presenca);
}

