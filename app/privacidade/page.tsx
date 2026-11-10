import Link from "next/link";
import { EMPRESA, PaginaLegal } from "@/components/pagina-legal";

export const metadata = { title: "Política de Privacidade", robots: { index: true, follow: true } };

export default function Privacidade() {
  return (
    <PaginaLegal titulo="Política de Privacidade" atualizado="10 de novembro de 2026">
      <p>
        Esta política explica como a <strong>{EMPRESA.nome}</strong> (&quot;Connect Digital&quot;), CNPJ {EMPRESA.cnpj}, trata dados pessoais
        no seu sistema interno de prospecção comercial e na comunicação com empresas pelo WhatsApp, em conformidade com a
        Lei Geral de Proteção de Dados (Lei nº 13.709/2018 — LGPD).
      </p>

      <h2>1. Quem somos</h2>
      <p>
        A Connect Digital é uma agência de marketing digital especializada em Google Ads, criação de sites e SEO para prestadores de
        serviço. O sistema descrito aqui é de uso interno da equipe da Connect Digital.
      </p>

      <h2>2. Quais dados tratamos</h2>
      <ul>
        <li><strong>Dados públicos de empresas anunciantes:</strong> nome, site, anúncios exibidos publicamente no Google, telefones e WhatsApp divulgados no próprio site, CNPJ e dados cadastrais públicos da Receita Federal.</li>
        <li><strong>Dados de contato e conversa no WhatsApp:</strong> número de telefone, nome do perfil, mensagens trocadas com a Connect Digital, status de entrega e leitura, e o registro de autorização (opt-in) ou de pedido de saída (opt-out).</li>
        <li><strong>Dados de quem usa o sistema:</strong> registros técnicos de acesso necessários para a segurança.</li>
      </ul>

      <h2>3. Para que usamos</h2>
      <ul>
        <li>Identificar empresas que anunciam no Google e oferecer serviços de marketing digital (prospecção B2B).</li>
        <li>Enviar mensagens pelo WhatsApp somente a quem autorizou recebê-las, e responder a quem nos contata.</li>
        <li>Registrar pedidos de saída para nunca mais enviar mensagens a quem não deseja recebê-las.</li>
        <li>Cumprir obrigações legais e proteger a segurança do sistema.</li>
      </ul>

      <h2>4. Bases legais</h2>
      <p>
        Consentimento (art. 7º, I, da LGPD) para o envio de mensagens pelo WhatsApp; legítimo interesse (art. 7º, IX) para a análise de
        dados públicos de empresas; e cumprimento de obrigação legal (art. 7º, II), quando aplicável.
      </p>

      <h2>5. WhatsApp e Meta</h2>
      <p>
        As mensagens são enviadas pela Plataforma do WhatsApp Business (Meta Platforms). A Meta trata os dados de acordo com as suas
        próprias políticas. Não vendemos dados a terceiros e não usamos as conversas do WhatsApp para fins diferentes dos descritos aqui.
      </p>

      <h2>6. Compartilhamento</h2>
      <p>
        Usamos fornecedores para operar o sistema: hospedagem (Vercel), banco de dados (Supabase), mensagens (Meta / WhatsApp) e consulta
        de resultados de busca (SerpApi). Eles tratam dados apenas para prestar esses serviços.
      </p>

      <h2>7. Por quanto tempo guardamos</h2>
      <p>
        Pelo tempo necessário às finalidades acima. Pedidos de saída (opt-out) são mantidos de forma permanente, apenas para garantir que
        a pessoa não volte a receber mensagens.
      </p>

      <h2>8. Seus direitos</h2>
      <p>
        Você pode pedir confirmação, acesso, correção, anonimização, portabilidade ou exclusão dos seus dados, e revogar o consentimento a
        qualquer momento. Para parar de receber mensagens, basta responder <strong>SAIR</strong> no WhatsApp. Para outros pedidos, veja{" "}
        <Link href="/exclusao-de-dados" className="text-marca hover:underline">Exclusão de dados</Link> ou escreva para {EMPRESA.email}.
      </p>

      <h2>9. Segurança</h2>
      <p>
        O acesso ao sistema é restrito à equipe da Connect Digital; credenciais e chaves de acesso são armazenadas criptografadas e o banco
        de dados não é acessível publicamente.
      </p>

      <h2>10. Contato</h2>
      <p>Encarregado / contato para assuntos de privacidade: {EMPRESA.email} · {EMPRESA.telefone}.</p>
    </PaginaLegal>
  );
}
