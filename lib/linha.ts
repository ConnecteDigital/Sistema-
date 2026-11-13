import type { CnpjSalvo } from "@/components/consulta-cnpj";
import type { Organico } from "./agregacao";

// Uma linha da rodada: anunciante × região, já com lead, site e CNPJ.
export type Linha = {
  id: number; regiao: string; dominio: string; nome: string | null; aparicoes: number; buscas: number;
  presenca: number; pontos: string[]; termos: string[]; pos_media: number | null; pct_topo: number;
  pct_sitelinks: number; titulo: string | null; link: string | null; forca: string; duplicado: number;
  advertiserId: number; leadId: number | null; prioridade: string | null; telefone: string | null;
  outrosTelefones: string[]; observacoes: string[]; situacao: string | null; tagGoogle: string | null;
  cnpj: CnpjSalvo; cnpjPrincipal: string | null; razaoSocial: string | null; cnpjs: string[];
  tags: string[]; statusLead: string | null; grupo: number;
  termoNoSite: boolean | null; termosAusentes: string[];
  porRodada?: { rodada: number; presenca: number | null }[];   // só no relatório de várias rodadas
  organico: Organico | null;   // site no orgânico na mesma região (null = não medido nesta rodada)
};
