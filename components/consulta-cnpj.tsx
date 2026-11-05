"use client";

import { useState } from "react";
import type { ResultadoCnpj } from "@/lib/consulta-cnpj";

export type CnpjSalvo = { resultado: ResultadoCnpj; consultado_em: string } | null;

function data(iso: string | null) {
  if (!iso) return "—";
  const [a, m, d] = iso.slice(0, 10).split("-");
  return d && m && a ? `${d}/${m}/${a}` : iso;
}

export function ConsultaCnpj({ advertiserId, inicial, compacto = false }: {
  advertiserId: number; inicial: CnpjSalvo; compacto?: boolean;
}) {
  const [salvo, setSalvo] = useState<CnpjSalvo>(inicial);
  const [aberto, setAberto] = useState(!compacto && !!inicial);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function consultar() {
    setCarregando(true); setErro(null);
    try {
      const r = await fetch(`/api/advertisers/${advertiserId}/cnpj`, { method: "POST" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.erro || `HTTP ${r.status}`);
      setSalvo(j); setAberto(true);
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setCarregando(false);
    }
  }

  const res = salvo?.resultado;
  const principal = res?.empresas[0];
  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-2">
        {!salvo ? (
          <button onClick={consultar} disabled={carregando} className="botao-sec whitespace-nowrap px-2 py-1 text-xs">
            {carregando ? "Consultando…" : "Consultar CNPJ"}
          </button>
        ) : (
          <button onClick={() => setAberto((a) => !a)} className="whitespace-nowrap text-left text-xs">
            {principal ? (
              <>
                <span className="font-medium text-texto">{principal.razaoSocial ?? principal.cnpj}</span>
                <span className="block font-mono text-[11px] text-suave">{principal.cnpj}</span>
              </>
            ) : res?.encontrados[0] ? (
              <span className="font-mono text-texto">{res.encontrados[0].cnpj}</span>
            ) : res?.titularDominio?.nome ? (
              <span className="font-medium text-texto">{res.titularDominio.nome}</span>
            ) : (
              <span className="text-suave">CNPJ não encontrado</span>
            )}
            <span className="ml-1 text-marca">{aberto ? "▲" : "▼"}</span>
          </button>
        )}
      </div>
      {erro && <p className="text-xs text-red-600">{erro}</p>}

      {salvo && aberto && res && (
        <div className="mt-1 min-w-[260px] max-w-[420px] space-y-2 rounded-lg border border-borda bg-slate-50 p-3 text-xs">
          {res.titularDominio && (
            <p>
              <span className="text-suave">Dono do domínio (Registro.br): </span>
              <strong>{res.titularDominio.nome ?? "—"}</strong>
              {res.titularDominio.documento && <> · {res.titularDominio.documento}</>}
            </p>
          )}
          {res.empresas.map((e) => (
            <div key={e.cnpj} className="space-y-0.5 border-t border-borda pt-2 first:border-0 first:pt-0">
              <p className="text-sm font-semibold">{e.razaoSocial ?? "—"}</p>
              {e.nomeFantasia && <p>Fantasia: {e.nomeFantasia}</p>}
              <p>
                CNPJ: <span className="font-mono">{e.cnpj}</span>
                <button onClick={() => navigator.clipboard?.writeText(e.cnpj)} className="ml-1 text-marca hover:underline">copiar</button>
              </p>
              <p>
                Situação: <span className={e.situacao?.toUpperCase() === "ATIVA" ? "text-green-700" : "text-red-700"}>{e.situacao ?? "—"}</span>
                {" · "}Aberta em {data(e.abertura)}{e.porte ? ` · ${e.porte}` : ""}
              </p>
              {e.atividade && <p className="text-suave">{e.atividade}</p>}
              {(e.cidade || e.endereco) && <p className="text-suave">{[e.endereco, e.cidade && `${e.cidade}/${e.uf}`].filter(Boolean).join(" — ")}</p>}
              {e.telefones.length > 0 && <p>Telefones na Receita: {e.telefones.join(" · ")}</p>}
              {e.email && <p>E-mail: {e.email.toLowerCase()}</p>}
              {e.socios.length > 0 && (
                <p>Sócios: {e.socios.map((s) => s.nome + (s.qualificacao ? ` (${s.qualificacao})` : "")).join("; ")}</p>
              )}
              <p className="text-[11px] text-suave">
                Achado em: {res.encontrados.find((x) => x.cnpj === e.cnpj)?.origem.join(", ")} · Dados: {e.fonteDados}
              </p>
            </div>
          ))}
          {res.encontrados.filter((x) => !res.empresas.some((e) => e.cnpj === x.cnpj)).map((x) => (
            <p key={x.cnpj}>CNPJ <span className="font-mono">{x.cnpj}</span> ({x.origem.join(", ")}) — sem dados da Receita no momento.</p>
          ))}
          {res.avisos.length > 0 && <ul className="list-inside list-disc text-[11px] text-suave">{res.avisos.map((a) => <li key={a}>{a}</li>)}</ul>}
          <div className="flex items-center justify-between text-[11px] text-suave">
            <span>Consultado em {new Date(salvo.consultado_em).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</span>
            <button onClick={consultar} disabled={carregando} className="text-marca hover:underline">
              {carregando ? "consultando…" : "consultar de novo"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
