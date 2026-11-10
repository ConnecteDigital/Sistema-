import { EMPRESA, PaginaLegal } from "@/components/pagina-legal";

export const metadata = { title: "Exclusão de dados", robots: { index: true, follow: true } };

export default function Exclusao() {
  return (
    <PaginaLegal titulo="Instruções para exclusão de dados" atualizado="10 de novembro de 2026">
      <p>Você pode pedir a exclusão dos seus dados tratados pela {EMPRESA.fantasia} de duas formas:</p>
      <h2>1. Pelo WhatsApp</h2>
      <p>
        Responda <strong>SAIR</strong> em qualquer mensagem nossa: você deixa de receber mensagens imediatamente. Se quiser também a exclusão
        das conversas e dos dados de contato, escreva &quot;EXCLUIR MEUS DADOS&quot;.
      </p>
      <h2>2. Por e-mail</h2>
      <p>
        Envie um e-mail para <strong>{EMPRESA.email}</strong> com o assunto &quot;Exclusão de dados&quot;, informando o número de telefone ou o
        site da empresa. Respondemos em até 15 dias, confirmando a exclusão.
      </p>
      <h2>O que é mantido</h2>
      <p>
        Mantemos apenas o número de telefone numa lista de bloqueio, para garantir que você não volte a receber mensagens, e o que a lei
        exigir.
      </p>
    </PaginaLegal>
  );
}
