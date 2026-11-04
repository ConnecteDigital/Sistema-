// Código de acesso OPCIONAL (variável ACESSO_CODIGO). Se vazio, o sistema abre direto.
export const COOKIE_ACESSO = "acesso";

export async function hashCodigo(codigo: string): Promise<string> {
  const dados = new TextEncoder().encode("robo-prospeccao:" + codigo);
  const hash = await crypto.subtle.digest("SHA-256", dados);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
