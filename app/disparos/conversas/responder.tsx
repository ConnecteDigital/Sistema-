"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { responder } from "../actions";

export function Responder({ telefone }: { telefone: string }) {
  const router = useRouter();
  const [texto, setTexto] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, iniciar] = useTransition();
  return (
    <form className="flex gap-2" onSubmit={(e) => {
      e.preventDefault();
      iniciar(async () => {
        const r = await responder(telefone, texto);
        if (r && "erro" in r && r.erro) setErro(r.erro); else { setTexto(""); setErro(null); router.refresh(); }
      });
    }}>
      <input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Responder…" required className="campo flex-1" />
      <button disabled={enviando} className="botao">{enviando ? "…" : "Enviar"}</button>
      {erro && <p className="text-xs text-red-600">{erro}</p>}
    </form>
  );
}
