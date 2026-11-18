// "Mensagem pronta": texto para WhatsApp a partir da análise do lead. Pura (sem banco), para testar fácil.

export type DadosMensagem = {
  empresa: string;            // nome da empresa (ou domínio); hoje não entra no texto, que começa igual para todos
  dominio: string | null;     // null = anúncio leva para perfil do Google
  remetente: string;          // quem assina (padrão: Bruno)
  siteFora: boolean;          // site fora do ar / suspenso / sem DNS
  semTag: boolean;            // site sem nenhuma tag do Google (não mede conversões)
  abordagem: string | null;   // "O que falar" da análise (null = não usar: amostra pequena ou presença forte)
};

export function montarMensagem(d: DadosMensagem): string {
  const partes: string[] = [];
  // início padronizado (igual para todo lead)
  partes.push(`Oi! Tudo bem? Aqui é o ${d.remetente.trim() || "Bruno"}, da Connect Digital. ` +
    "Trabalhamos com Google Ads para empresas de serviço e analisamos o anúncio de vocês no Google.");

  const pontos: string[] = [];
  if (d.siteFora && d.dominio) {
    pontos.push(`O anúncio de vocês está rodando, mas o site (${d.dominio}) não está abrindo: cada clique é pago e o cliente cai numa página de erro.`);
  } else if (d.abordagem) {
    pontos.push(d.abordagem);
  }
  if (d.semTag && !d.siteFora) {
    pontos.push("Também notei que o site não tem a medição de conversões do Google: o Google não sabe quais cliques viram ligação, e isso deixa o clique mais caro.");
  }
  if (!pontos.length) {
    pontos.push("Encontramos alguns pontos no anúncio que podem estar fazendo vocês perderem clientes para a concorrência.");
  }
  partes.push(...pontos);
  partes.push("Posso te mostrar em 5 minutos como resolver?");
  return partes.join("\n\n");
}

/** A "O que falar" da análise serve para mandar ao cliente? (as instruções internas não servem) */
export function abordagemParaCliente(abordagem: string | null | undefined, amostraPequena: boolean): string | null {
  if (!abordagem || amostraPequena) return null;
  if (/^A presença está forte/.test(abordagem)) return null;   // instrução interna: "vá pelos outros pontos"
  return abordagem;
}

/** Link do WhatsApp com a mensagem já escrita (celular BR com DDD, 11 dígitos). */
export function linkWhatsComTexto(telefone: string | null, texto: string): string | null {
  const d = (telefone ?? "").replace(/\D/g, "");
  const n = d.length === 11 ? `55${d}` : d.length === 13 && d.startsWith("55") ? d : null;
  return n ? `https://wa.me/${n}?text=${encodeURIComponent(texto)}` : null;
}
