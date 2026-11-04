"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { adicionarChave, validarLocais, type Resultado } from "./actions";

function Enviar({ children, sec }: { children: React.ReactNode; sec?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button disabled={pending} className={sec ? "botao-sec" : "botao"}>
      {pending ? "Aguarde…" : children}
    </button>
  );
}

function Mensagem({ r }: { r: Resultado }) {
  if (!r) return null;
  return <p className={`text-sm ${r.ok ? "text-green-700" : "text-red-600"}`}>{r.msg}</p>;
}

export function FormNovaChave() {
  const [r, acao] = useActionState(adicionarChave, null);
  return (
    <form action={acao} className="space-y-2">
      <div className="flex flex-col gap-2 sm:flex-row">
        <input name="apelido" placeholder="Apelido (ex.: Conta 1)" required className="campo sm:w-48" />
        <input name="chave" placeholder="Chave da SerpApi" required autoComplete="off" spellCheck={false}
          className="campo flex-1 font-mono" />
        <Enviar>Adicionar</Enviar>
      </div>
      <Mensagem r={r} />
      <p className="text-xs text-suave">
        A chave é testada (grátis) antes de salvar e fica criptografada no banco. Na tela só aparece o final dela.
      </p>
    </form>
  );
}

export function BotaoValidarLocais() {
  const [r, acao] = useActionState(validarLocais, null);
  return (
    <form action={acao} className="space-y-2">
      <Enviar sec>Validar locais pendentes na SerpApi (grátis)</Enviar>
      <Mensagem r={r} />
    </form>
  );
}

export function BotaoEnviar({ children }: { children: React.ReactNode }) {
  return <Enviar sec>{children}</Enviar>;
}
