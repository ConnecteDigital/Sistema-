export const EMPRESA = {
  nome: "CONNECT DIGITAL LTDA",
  fantasia: "Connect Digital",
  cnpj: "55.161.845/0001-50",
  email: "contato@connectedigital.com",
  telefone: "+55 (73) 99905-9858",
  site: "https://connectedigital.com",
};

export function PaginaLegal({ titulo, atualizado, children }: { titulo: string; atualizado: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <article className="cartao space-y-4 p-6 text-sm leading-relaxed [&_h2]:mt-6 [&_h2]:text-base [&_h2]:font-semibold [&_li]:ml-5 [&_li]:list-disc">
        <h1 className="text-2xl font-semibold">{titulo}</h1>
        <p className="text-xs text-suave">Última atualização: {atualizado}</p>
        {children}
        <hr className="border-borda" />
        <p className="text-xs text-suave">
          {EMPRESA.nome} ({EMPRESA.fantasia}) · CNPJ {EMPRESA.cnpj} · {EMPRESA.email} · {EMPRESA.telefone} ·{" "}
          <a href={EMPRESA.site} className="text-marca hover:underline">{EMPRESA.site.replace("https://", "")}</a>
        </p>
      </article>
    </main>
  );
}
