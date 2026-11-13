"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ligarWebhooksAcao } from "./actions";

export function BotaoLigarWebhooks() {
  const router = useRouter();
  const [msg, setMsg] = useState<{ ok: boolean; msg: string } | null>(null);
  const [ocupado, iniciar] = useTransition();
  return (
    <div className="space-y-1">
      <button className="botao" disabled={ocupado} onClick={() => iniciar(async () => { setMsg(await ligarWebhooksAcao()); router.refresh(); })}>
        {ocupado ? "Ligando…" : "Ligar webhooks desta conta"}
      </button>
      {msg && <p className={`text-xs ${msg.ok ? "text-green-700" : "text-red-600"}`}>{msg.msg}</p>}
    </div>
  );
}
