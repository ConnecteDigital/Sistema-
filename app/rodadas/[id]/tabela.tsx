"use client";

import { useMemo, useState } from "react";
import { ConsultaCnpj, type CnpjSalvo } from "@/components/consulta-cnpj";
import { COR_FORCA, COR_PRIORIDADE, ROTULO_SITUACAO, ROTULO_TAG, linkWhats } from "@/components/selos";

export type Linha = {
  id: number; regiao: string; dominio: string; nome: string | null; aparicoes: number; buscas: number;
  presenca: number; pontos: string[]; termos: string[]; pos_media: number | null; pct_topo: number;
  pct_sitelinks: number; titulo: string | null; link: string | null; forca: string; duplicado: number;
  advertiserId: number; leadId: number | null; prioridade: string | null; telefone: string | null;
  outrosTelefones: string[]; observacoes: string[]; situacao: string | null; tagGoogle: string | null;
  cnpj: CnpjSalvo; cnpjPrincipal: string | null; razaoSocial: string | null; cnpjs: string[];
  tags: string[]; statusLead: string | null; grupo: number;
};
const PESO: Record<string, number> = { "Máxima": 0, Alta: 1, Normal: 2, Baixa: 3 };

const pct = (v: number) => `${Math.round(v * 100)}%`;

type Ordem = "prioridade" | "presenca_asc" | "presenca_desc" | "pos" | "nome";

export function TabelaAnunciantes({ linhas }: { linhas: Linha[] }) {
  const regioes = useMemo(() => [...new Set(linhas.map((l) => l.regiao))], [linhas]);
  const [regiao, setRegiao] = useState("");
  const [forca, setForca] = useState("");
  const [prioridade, setPrioridade] = useState("");
  const temLeads = linhas.some((l) => l.prioridade);
  const [ordem, setOrdem] = useState<Ordem>(temLeads ? "prioridade" : "presenca_desc");

  // Quantos sites desta rodada têm o mesmo CNPJ
  const sitesPorCnpj = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const l of linhas) for (const c of l.cnpjs) { if (!m.has(c)) m.set(c, new Set()); m.get(c)!.add(l.dominio); }
    return m;
  }, [linhas]);

  const visiveis = linhas
    .filter((l) => (!regiao || l.regiao === regiao) && (!forca || l.forca === forca) && (!prioridade || l.prioridade === prioridade))
    .sort((a, b) => {
      if (ordem === "prioridade") return (PESO[a.prioridade ?? ""] ?? 9) - (PESO[b.prioridade ?? ""] ?? 9) || a.presenca - b.presenca;
      if (ordem === "presenca_asc") return a.presenca - b.presenca;
      if (ordem === "presenca_desc") return b.presenca - a.presenca;
      if (ordem === "pos") return (a.pos_media ?? 99) - (b.pos_media ?? 99);
      return (a.nome ?? a.dominio).localeCompare(b.nome ?? b.dominio);
    });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {regioes.length > 1 && (
          <select value={regiao} onChange={(e) => setRegiao(e.target.value)} className="campo py-1.5">
            <option value="">Todas as regiões</option>
            {regioes.map((r) => <option key={r}>{r}</option>)}
          </select>
        )}
        <select value={forca} onChange={(e) => setForca(e.target.value)} className="campo py-1.5">
          <option value="">Toda força</option>
          <option>Fraca</option><option>Média</option><option>Forte</option>
        </select>
        {temLeads && (
          <select value={prioridade} onChange={(e) => setPrioridade(e.target.value)} className="campo py-1.5">
            <option value="">Toda prioridade</option>
            <option>Máxima</option><option>Alta</option><option>Normal</option><option>Baixa</option>
          </select>
        )}
        <select value={ordem} onChange={(e) => setOrdem(e.target.value as Ordem)} className="campo py-1.5">
          {temLeads && <option value="prioridade">Prioridade (padrão)</option>}
          <option value="presenca_desc">Maior presença primeiro</option>
          <option value="presenca_asc">Menor presença primeiro</option>
          <option value="pos">Melhor posição</option>
          <option value="nome">Nome</option>
        </select>
        <span className="self-center text-sm text-suave">{visiveis.length} anunciantes</span>
      </div>

      <div className="cartao overflow-x-auto">
        <table className="w-full min-w-[1250px] text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-suave">
            <tr>
              {regioes.length > 1 && <th className="px-3 py-2">Região</th>}
              {temLeads && <th className="px-3 py-2">Prioridade</th>}
              <th className="px-3 py-2">Anunciante</th>
              <th className="px-3 py-2">Contato</th>
              <th className="px-3 py-2 text-right">Aparições</th>
              <th className="px-3 py-2">Força</th>
              <th className="px-3 py-2 text-right">Pos.</th>
              <th className="px-3 py-2 text-right">Topo</th>
              <th className="px-3 py-2 text-right">Sitelinks</th>
              <th className="px-3 py-2">Onde apareceu</th>
              <th className="px-3 py-2">Anúncio</th>
              <th className="px-3 py-2">Empresa (CNPJ)</th>
            </tr>
          </thead>
          <tbody>
            {visiveis.map((l) => {
              const perfil = l.dominio.startsWith("perfil-google:");
              return (
                <tr key={l.id} className="border-t border-borda align-top">
                  {regioes.length > 1 && <td className="px-3 py-2 text-suave">{l.regiao}</td>}
                  {temLeads && (
                    <td className="px-3 py-2">
                      {l.prioridade && <span className={`selo ${COR_PRIORIDADE[l.prioridade] ?? ""}`}>{l.prioridade}</span>}
                    </td>
                  )}
                  <td className="max-w-[300px] px-3 py-2">
                    <p className="font-medium">
                      {l.leadId ? <a href={`/leads/${l.leadId}`} className="hover:underline">{l.nome ?? l.dominio}</a> : (l.nome ?? l.dominio)}
                    </p>
                    {!perfil && (
                      <a href={`https://${l.dominio}`} target="_blank" rel="noreferrer" className="text-xs text-marca hover:underline">
                        {l.dominio}
                      </a>
                    )}
                    <div className="mt-1 flex flex-wrap gap-1">
                      {perfil && <span className="selo bg-purple-100 text-purple-800">leva ao perfil do Google</span>}
                      {l.duplicado > 0 && <span className="selo bg-red-100 text-red-800">2 anúncios na mesma busca</span>}
                      {l.pct_sitelinks === 0 && <span className="selo bg-slate-100 text-slate-700">sem sitelinks</span>}
                      {l.situacao && l.situacao !== "ok" && (
                        <span className={`selo ${["fora_do_ar", "suspenso", "dns"].includes(l.situacao) ? "bg-red-600 text-white" : "bg-slate-100 text-slate-700"}`}>
                          {ROTULO_SITUACAO[l.situacao] ?? l.situacao}
                        </span>
                      )}
                      {l.tagGoogle && l.situacao === "ok" && (
                        <span className={`selo ${l.tagGoogle === "nao" ? "bg-green-100 text-green-800" : "bg-slate-100 text-slate-700"}`}>
                          Tag Google Ads: {ROTULO_TAG[l.tagGoogle] ?? l.tagGoogle}
                        </span>
                      )}
                    </div>
                    {l.observacoes.length > 0 && (
                      <ul className="mt-1 list-inside list-disc text-xs text-suave">
                        {l.observacoes.map((o) => <li key={o}>{o}</li>)}
                      </ul>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-xs">
                    {l.telefone ? (
                      <>
                        <a href={`tel:${l.telefone.replace(/\D/g, "")}`} className="font-medium hover:underline">{l.telefone}</a>
                        {linkWhats(l.telefone) && (
                          <a href={linkWhats(l.telefone)!} target="_blank" rel="noreferrer" className="ml-1 text-green-700 hover:underline">zap</a>
                        )}
                        {l.outrosTelefones.length > 0 && <span className="block text-suave">{l.outrosTelefones.slice(0, 2).join(" · ")}</span>}
                      </>
                    ) : <span className="text-suave">—</span>}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">
                    <span className="font-semibold">{pct(l.presenca)}</span>
                    <span className="block text-xs text-suave">{l.aparicoes}/{l.buscas}</span>
                  </td>
                  <td className="px-3 py-2"><span className={`selo ${COR_FORCA[l.forca] ?? ""}`}>{l.forca}</span></td>
                  <td className="px-3 py-2 text-right tabular-nums">{l.pos_media?.toFixed(1) ?? "—"}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{pct(l.pct_topo)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{pct(l.pct_sitelinks)}</td>
                  <td className="max-w-[220px] px-3 py-2 text-xs text-suave">
                    {l.pontos.join(", ")}
                    <span className="mt-0.5 block text-[11px]">{l.termos.join(" · ")}</span>
                  </td>
                  <td className="max-w-[240px] px-3 py-2 text-xs">
                    {l.titulo}
                    {l.link && (
                      <a href={l.link} target="_blank" rel="noreferrer" className="mt-0.5 block text-marca hover:underline">abrir</a>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {perfil ? <span className="text-xs text-suave">sem site</span> : (
                      <>
                        <ConsultaCnpj advertiserId={l.advertiserId} inicial={l.cnpj} compacto />
                        {(() => {
                          const outros = new Set<string>();
                          for (const c of l.cnpjs) for (const d of sitesPorCnpj.get(c) ?? []) if (d !== l.dominio) outros.add(d);
                          return outros.size > 0 ? (
                            <span className="selo mt-1 bg-red-100 text-red-800" title={[...outros].join(", ")}>
                              mesmo CNPJ em +{outros.size} site{outros.size > 1 ? "s" : ""}
                            </span>
                          ) : null;
                        })()}
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-suave">
        Força: Fraca &lt; 40% das buscas da região · Média 40–75% · Forte &gt; 75%. É uma foto deste horário.
        {temLeads && " Prioridade: Máxima = site fora do ar · Alta = força Fraca/Média · Normal = Forte · Baixa = rede, 0800 ou agência."}
      </p>
    </div>
  );
}
