"use client";

import { useState } from "react";

export function BotaoCopiar({ texto }: { texto: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button className="botao-sec" onClick={async () => {
      await navigator.clipboard.writeText(texto);
      setOk(true); setTimeout(() => setOk(false), 2000);
    }}>
      {ok ? "Copiado!" : "Copiar lista (para WhatsApp)"}
    </button>
  );
}
