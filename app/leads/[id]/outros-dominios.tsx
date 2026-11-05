"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ResultadoCnpj } from "@/lib/consulta-cnpj";

type Item = { dominio: string; resultado: ResultadoCnpj | null; consultado_em: string };

export function OutrosDominios({ leadId, itens }: { leadId: number; itens: Item[] }) {
  const router = useRouter();
  const [dominio, setDominio] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function consultar(e: React.FormEvent) {
    e.preventDefault();
    setCarregando(true); setErro(null);
    const r = await fetch(`/api/leads/${leadId}/dominios`, { method: "POST", body: JSON.stringify({ dominio }) });
    const j = await r.json().catch(() => ({}));
    setCarregando(false);
    if (!r.ok) { setErro(j.erro ?? `HTTP ${r.status}`); return; }
    setDominio("");
    router.refresh();
  }

  return (
    <section className="cartao space-y-3 p-4 text-sm">
      <div>
        <h2 className="font-semibold">Outros sites deste dono</h2>
        <p className="text-xs text-suave">
          Sabe de outro site da mesma pessoa? Consulte aqui quem é o dono dele (Registro.br, o próprio site e a Receita).
        </p>
      </div>
      <form onSubmit={consultar} className="flex flex-col gap-2 sm:flex-row">
        <input value={dominio} onChange={(e) => setDominio(e.target.value)} placeholder="ex.: outrosite.com.br" required className="campo flex-1" />
        <button disabled={carregando} className="botao">{carregando ? "Consultando…" : "Consultar dono"}</button>
      </form>
      {erro && <p className="text-xs text-red-600">{erro}</p>}
      {itens.map((i) => {
        const r = i.resultado;
        return (
          <div key={i.dominio} className="space-y-1 rounded-lg border border-borda bg-slate-50 p-3 text-xs">
            <p className="text-sm font-medium">
              <a href={`https://${i.dominio}`} target="_blank" rel="noreferrer" className="text-marca hover:underline">{i.dominio}</a>
            </p>
            {r?.titularDominio && (
              <p>Dono do domínio: <strong>{r.titularDominio.nome ?? "—"}</strong>
                {r.titularDominio.tipo === "cnpj" && r.titularDominio.documento && <> · CNPJ {r.titularDominio.documento}</>}
                {r.titularDominio.tipo === "cpf" && <> · pessoa física</>}
              </p>
            )}
            {r?.empresas.map((e) => (
              <div key={e.cnpj} className="border-t border-borda pt-1">
                <p className="font-semibold">{e.razaoSocial}</p>
                <p>CNPJ <span className="font-mono">{e.cnpj}</span> · {e.situacao ?? "—"}{e.cidade ? ` · ${e.cidade}/${e.uf}` : ""}</p>
                {e.telefones.length > 0 && <p>Telefones na Receita: <strong>{e.telefones.join(" · ")}</strong></p>}
                {e.email && <p>E-mail: {e.email.toLowerCase()}</p>}
                {e.socios.length > 0 && <p>Sócios: {e.socios.map((s) => s.nome).join("; ")}</p>}
              </div>
            ))}
            {r && r.empresas.length === 0 && <p className="text-suave">{r.avisos.join(" ")}</p>}
          </div>
        );
      })}
    </section>
  );
}
