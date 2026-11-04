"use client";

import { useMemo, useState } from "react";

export type Linha = {
  id: number; regiao: string; dominio: string; nome: string | null; aparicoes: number; buscas: number;
  presenca: number; pontos: string[]; termos: string[]; pos_media: number | null; pct_topo: number;
  pct_sitelinks: number; titulo: string | null; link: string | null; forca: string; duplicado: number;
};

const COR_FORCA: Record<string, string> = {
  Fraca: "bg-green-100 text-green-800", "Média": "bg-amber-100 text-amber-800", Forte: "bg-slate-200 text-slate-700",
};
const pct = (v: number) => `${Math.round(v * 100)}%`;

type Ordem = "presenca_asc" | "presenca_desc" | "pos" | "nome";

export function TabelaAnunciantes({ linhas }: { linhas: Linha[] }) {
  const regioes = useMemo(() => [...new Set(linhas.map((l) => l.regiao))], [linhas]);
  const [regiao, setRegiao] = useState("");
  const [forca, setForca] = useState("");
  const [ordem, setOrdem] = useState<Ordem>("presenca_desc");

  const visiveis = linhas
    .filter((l) => (!regiao || l.regiao === regiao) && (!forca || l.forca === forca))
    .sort((a, b) => {
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
        <select value={ordem} onChange={(e) => setOrdem(e.target.value as Ordem)} className="campo py-1.5">
          <option value="presenca_desc">Maior presença primeiro</option>
          <option value="presenca_asc">Menor presença primeiro</option>
          <option value="pos">Melhor posição</option>
          <option value="nome">Nome</option>
        </select>
        <span className="self-center text-sm text-suave">{visiveis.length} anunciantes</span>
      </div>

      <div className="cartao overflow-x-auto">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-suave">
            <tr>
              {regioes.length > 1 && <th className="px-3 py-2">Região</th>}
              <th className="px-3 py-2">Anunciante</th>
              <th className="px-3 py-2 text-right">Aparições</th>
              <th className="px-3 py-2">Força</th>
              <th className="px-3 py-2 text-right">Pos.</th>
              <th className="px-3 py-2 text-right">Topo</th>
              <th className="px-3 py-2 text-right">Sitelinks</th>
              <th className="px-3 py-2">Onde apareceu</th>
              <th className="px-3 py-2">Anúncio</th>
            </tr>
          </thead>
          <tbody>
            {visiveis.map((l) => {
              const perfil = l.dominio.startsWith("perfil-google:");
              return (
                <tr key={l.id} className="border-t border-borda align-top">
                  {regioes.length > 1 && <td className="px-3 py-2 text-suave">{l.regiao}</td>}
                  <td className="px-3 py-2">
                    <p className="font-medium">{l.nome ?? l.dominio}</p>
                    {!perfil && (
                      <a href={`https://${l.dominio}`} target="_blank" rel="noreferrer" className="text-xs text-marca hover:underline">
                        {l.dominio}
                      </a>
                    )}
                    <div className="mt-1 flex flex-wrap gap-1">
                      {perfil && <span className="selo bg-purple-100 text-purple-800">leva ao perfil do Google</span>}
                      {l.duplicado > 0 && <span className="selo bg-red-100 text-red-800">2 anúncios na mesma busca</span>}
                      {l.pct_sitelinks === 0 && <span className="selo bg-slate-100 text-slate-700">sem sitelinks</span>}
                    </div>
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
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-suave">
        Força: Fraca &lt; 40% das buscas da região · Média 40–75% · Forte &gt; 75%. É uma foto deste horário.
      </p>
    </div>
  );
}
