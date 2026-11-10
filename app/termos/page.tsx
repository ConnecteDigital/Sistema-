import Link from "next/link";
import { EMPRESA, PaginaLegal } from "@/components/pagina-legal";

export const metadata = { title: "Termos de Uso", robots: { index: true, follow: true } };

export default function Termos() {
  return (
    <PaginaLegal titulo="Termos de Uso" atualizado="10 de novembro de 2026">
      <p>
        Estes termos regem o uso do sistema interno de prospecção da <strong>{EMPRESA.nome}</strong> (&quot;Connect Digital&quot;) e das
        mensagens enviadas pela Connect Digital pelo WhatsApp.
      </p>
      <h2>1. Uso do sistema</h2>
      <p>O sistema é de uso exclusivo da equipe da Connect Digital, para pesquisa de anúncios públicos e gestão de contatos comerciais.</p>
      <h2>2. Mensagens pelo WhatsApp</h2>
      <ul>
        <li>Enviamos mensagens apenas a quem autorizou recebê-las.</li>
        <li>Você pode parar de receber a qualquer momento respondendo <strong>SAIR</strong>.</li>
        <li>As mensagens seguem as políticas da Plataforma do WhatsApp Business (Meta).</li>
      </ul>
      <h2>3. Privacidade</h2>
      <p>O tratamento de dados segue a nossa <Link href="/privacidade" className="text-marca hover:underline">Política de Privacidade</Link>.</p>
      <h2>4. Contato</h2>
      <p>{EMPRESA.email} · {EMPRESA.telefone}</p>
    </PaginaLegal>
  );
}
