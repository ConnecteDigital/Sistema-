"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type FB = {
  init: (o: Record<string, unknown>) => void;
  login: (cb: (r: { authResponse?: { code?: string } | null }) => void, o: Record<string, unknown>) => void;
};
declare global { interface Window { FB?: FB; fbAsyncInit?: () => void } }

/** Botão do Embedded Signup da Meta, no modo coexistência (número continua no WhatsApp Business do celular). */
export function BotaoConectar({ appId, configId, versao }: { appId: string; configId: string; versao: string }) {
  const router = useRouter();
  const [pronto, setPronto] = useState(false);
  const [etapa, setEtapa] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const sessao = useRef<{ wabaId?: string; phoneId?: string; evento?: string }>({});

  useEffect(() => {
    window.fbAsyncInit = () => {
      window.FB!.init({ appId, autoLogAppEvents: true, xfbml: false, version: versao });
      setPronto(true);
    };
    if (!document.getElementById("facebook-jssdk")) {
      const s = document.createElement("script");
      s.id = "facebook-jssdk"; s.async = true; s.defer = true; s.crossOrigin = "anonymous";
      s.src = "https://connect.facebook.net/pt_BR/sdk.js";
      document.body.appendChild(s);
    } else if (window.FB) { window.fbAsyncInit(); }

    // A janela da Meta avisa aqui quando termina (com os IDs da conta e do número)
    const ouvir = (ev: MessageEvent) => {
      if (!/(^|\.)facebook\.com$/.test(new URL(ev.origin).hostname)) return;
      try {
        const d = typeof ev.data === "string" ? JSON.parse(ev.data) : ev.data;
        if (d?.type !== "WA_EMBEDDED_SIGNUP") return;
        if (String(d.event ?? "").startsWith("FINISH")) {
          sessao.current = { wabaId: d.data?.waba_id, phoneId: d.data?.phone_number_id, evento: d.event };
        } else if (d.event === "CANCEL") {
          setErro(`Cadastro interrompido${d.data?.current_step ? ` na etapa ${d.data.current_step}` : ""}.`);
        } else if (d.event === "ERROR") {
          setErro(`A Meta informou um erro: ${d.data?.error_message ?? "desconhecido"}`);
        }
      } catch { /* mensagens que não são da Meta */ }
    };
    window.addEventListener("message", ouvir);
    return () => window.removeEventListener("message", ouvir);
  }, [appId, versao]);

  function conectar() {
    setErro(null); setEtapa("Abrindo a janela da Meta…");
    window.FB!.login((resp) => {
      const codigo = resp.authResponse?.code;
      if (!codigo) { setEtapa(null); setErro((e) => e ?? "A janela foi fechada antes de concluir."); return; }
      setEtapa("Ligando o número ao robô…");
      // a mensagem com os IDs pode chegar um pouco depois do código
      setTimeout(async () => {
        const r = await fetch("/api/whatsapp/conectar", {
          method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify({ codigo, ...sessao.current }),
        });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) { setEtapa(null); setErro(j.erro ?? `HTTP ${r.status}`); return; }
        setEtapa(`Conectado: ${j.nome ?? ""} ${j.numero ?? ""}`);
        router.push("/disparos");
      }, 1500);
    }, {
      config_id: configId,
      response_type: "code",
      override_default_response_type: true,
      extras: { setup: {}, featureType: "whatsapp_business_app_onboarding", sessionInfoVersion: "3" },
    });
  }

  return (
    <div className="space-y-2">
      <button onClick={conectar} disabled={!pronto || !!etapa} className="botao px-6 py-3 text-base">
        {pronto ? "Conectar WhatsApp Business (QR code)" : "Carregando…"}
      </button>
      {etapa && <p className="text-sm text-marca">{etapa}</p>}
      {erro && <p className="text-sm text-red-600">{erro}</p>}
    </div>
  );
}
