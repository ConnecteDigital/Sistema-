import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { COOKIE_ACESSO, hashCodigo } from "@/lib/acesso";

export const metadata = { title: "Acesso" };

async function entrar(form: FormData) {
  "use server";
  const codigo = process.env.ACESSO_CODIGO?.trim();
  if (!codigo) redirect("/");
  if (String(form.get("codigo") ?? "").trim() !== codigo) redirect("/acesso?erro=1");
  (await cookies()).set(COOKIE_ACESSO, await hashCodigo(codigo), {
    httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365,
  });
  redirect("/");
}

export default async function Acesso({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const { erro } = await searchParams;
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-sm flex-col justify-center px-4">
      <form action={entrar} className="space-y-3 rounded-xl border border-borda bg-cartao p-6">
        <h1 className="text-lg font-semibold">Código de acesso</h1>
        <p className="text-sm text-suave">Digite uma vez. Este navegador fica liberado por 1 ano.</p>
        <input name="codigo" type="password" autoFocus required className="campo w-full" />
        {erro && <p className="text-sm text-red-600">Código incorreto.</p>}
        <button className="botao w-full">Entrar</button>
      </form>
    </main>
  );
}
