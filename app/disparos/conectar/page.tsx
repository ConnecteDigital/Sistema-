import Link from "next/link";
import { embeddedSignupFaltando } from "@/lib/whatsapp";
import { BotaoConectar } from "./botao";

export const dynamic = "force-dynamic";
export const metadata = { title: "Conectar WhatsApp" };

export default function Conectar() {
  const falta = embeddedSignupFaltando();
  return (
    <main className="mx-auto max-w-2xl space-y-4 p-4">
      <Link href="/disparos" className="text-xs text-marca hover:underline">← Disparos</Link>
      <h1 className="text-xl font-semibold">Conectar WhatsApp Business</h1>
      <div className="cartao space-y-2 p-4 text-sm">
        <p><strong>Coexistência:</strong> o número continua no <strong>WhatsApp Business do seu celular</strong> (você responde e liga por lá) e o robô usa o mesmo número só para o disparo.</p>
        <ol className="list-inside list-decimal space-y-1 text-suave">
          <li>Deixe o celular com o WhatsApp Business (versão atualizada) por perto.</li>
          <li>Clique no botão abaixo. Abre uma janela da Meta.</li>
          <li>Escolha o portfólio <strong>Connect Digital</strong> e a opção de conectar um número <strong>que já usa o WhatsApp Business</strong>.</li>
          <li>No celular: WhatsApp Business → aparece o pedido de conexão / QR code → confirme.</li>
          <li>Conclua na janela. O sistema liga o número sozinho.</li>
        </ol>
      </div>
      {falta.length ? (
        <p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          Faltam variáveis na Vercel: {falta.map((f) => <code key={f} className="mr-1">{f}</code>)}
        </p>
      ) : (
        <BotaoConectar appId={process.env.META_APP_ID!.trim()} configId={process.env.META_ES_CONFIG_ID!.trim()}
          versao={process.env.WHATSAPP_GRAPH_VERSION?.trim() || "v24.0"} />
      )}
    </main>
  );
}
