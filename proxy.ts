import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_ACESSO, hashCodigo } from "@/lib/acesso";

/**
 * Sem login. Só existe um "cadeado" opcional: se ACESSO_CODIGO estiver definido,
 * pede o código uma vez por navegador. Sem a variável, tudo abre direto.
 * Rotas do Cron (/api/cron) usam CRON_SECRET e não passam por aqui.
 */
export async function proxy(req: NextRequest) {
  const codigo = process.env.ACESSO_CODIGO?.trim();
  if (!codigo) return NextResponse.next();

  const cookie = req.cookies.get(COOKIE_ACESSO)?.value;
  if (cookie && cookie === (await hashCodigo(codigo))) return NextResponse.next();

  if (req.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ erro: "Acesso negado" }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/acesso";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!acesso|api/cron|_next/static|_next/image|favicon.ico|robots.txt|icon.svg).*)"],
};
