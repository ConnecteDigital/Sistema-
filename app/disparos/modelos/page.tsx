import Link from "next/link";
import { listarModelos, whatsappFaltando, type Modelo } from "@/lib/whatsapp";
import { FormModelo } from "./form";
import { FormTeste } from "./teste";

export const dynamic = "force-dynamic";
export const metadata = { title: "Modelos de mensagem" };

export default async function Modelos() {
  const falta = await whatsappFaltando();
  let modelos: Modelo[] = [], erro: string | null = null;
  if (!falta.some((f) => f.startsWith("Conectar"))) {
    try { modelos = await listarModelos(); } catch (e) { erro = e instanceof Error ? e.message : String(e); }
  }
  const aprovados = modelos.filter((m) => m.status === "APPROVED");
  return (
    <main className="mx-auto max-w-4xl space-y-5 p-4">
      <Link href="/disparos" className="text-xs text-marca hover:underline">← Disparos</Link>
      <h1 className="text-xl font-semibold">Modelos de mensagem</h1>
      {falta.some((f) => f.startsWith("Conectar")) && (
        <p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">Conecte o WhatsApp primeiro (Disparos → Conectar WhatsApp).</p>
      )}
      {erro && <p className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800">Erro na Meta: {erro}</p>}

      <section className="space-y-2">
        <h2 className="font-semibold">Criar modelo</h2>
        <p className="text-xs text-suave">
          A Meta analisa cada modelo (normalmente em minutos ou horas). Só modelos aprovados podem iniciar conversas.
          Dica: mensagem pessoal, com o nome da empresa e o problema encontrado, e um botão para sair.
        </p>
        <FormModelo telefonePadrao="" />
      </section>

      <section className="cartao space-y-2 p-4">
        <h2 className="font-semibold">Enviar mensagem de teste</h2>
        <FormTeste modelos={aprovados.map((m) => ({ nome: m.nome, idioma: m.idioma, parametros: m.parametros, corpo: m.corpo }))} />
      </section>

      <section className="cartao space-y-2 p-4">
        <h2 className="font-semibold">Modelos na conta ({modelos.length})</h2>
        {modelos.map((m) => (
          <div key={m.nome + m.idioma} className="rounded-lg border border-borda p-3 text-sm">
            <p className="font-medium">{m.nome} <span className="text-xs text-suave">· {m.idioma} · {m.categoria}</span>
              <span className={`selo ml-2 ${m.status === "APPROVED" ? "bg-green-100 text-green-800" : m.status === "REJECTED" ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800"}`}>{m.status}</span></p>
            <p className="mt-1 whitespace-pre-line text-xs text-suave">{m.corpo}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
