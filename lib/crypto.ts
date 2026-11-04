import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { exigir } from "./env";

// AES-256-GCM. Formato salvo: base64(iv).base64(tag).base64(conteúdo)
function chave() {
  return createHash("sha256").update(exigir("KEYS_ENCRYPTION_SECRET")).digest();
}

export function criptografar(texto: string): string {
  const iv = randomBytes(12);
  const cifra = createCipheriv("aes-256-gcm", chave(), iv);
  const conteudo = Buffer.concat([cifra.update(texto, "utf8"), cifra.final()]);
  return [iv, cifra.getAuthTag(), conteudo].map((b) => b.toString("base64")).join(".");
}

export function descriptografar(salvo: string): string {
  const [iv, tag, conteudo] = salvo.split(".").map((p) => Buffer.from(p, "base64"));
  const decifra = createDecipheriv("aes-256-gcm", chave(), iv);
  decifra.setAuthTag(tag);
  return Buffer.concat([decifra.update(conteudo), decifra.final()]).toString("utf8");
}
