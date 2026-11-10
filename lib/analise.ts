// Análise do anúncio em português claro: o que os números dizem, por quê, o que falar e o cuidado. Pura.

export type Aparicao = {
  rodada?: number | null; data?: string | null; regiao: string;
  presenca: number; aparicoes: number; buscas: number; posMedia: number | null; pctTopo?: number | null;
  pontos: string[]; termos: string[];
};

export type Analise = {
  resumo: string;          // uma frase: o retrato
  leitura: string[];       // o que os números querem dizer
  causas: string[];        // por que isso acontece (prováveis)
  abordagem: string;       // o que falar na ligação/mensagem
  cuidados: string[];      // o que perguntar antes de afirmar
  amostraPequena: boolean;
};

/** Abaixo disso, a presença (ex.: 1/1 = 100%) não serve para concluir nada. */
export const AMOSTRA_MINIMA = 5;

const pct = (v: number) => `${Math.round(v * 100)}%`;
const lista = (xs: string[], max = 3) =>
  xs.length <= max ? xs.join(", ").replace(/, ([^,]*)$/, " e $1") : `${xs.slice(0, max).join(", ")} e mais ${xs.length - max}`;
const deCada10 = (p: number) => Math.round((1 - p) * 10);

/** Rótulo de força que não engana: com poucas buscas, diz "amostra pequena". */
export function rotuloForca(forca: string | null | undefined, buscas: number | null | undefined) {
  if (buscas != null && buscas < AMOSTRA_MINIMA) return `${forca ?? "—"} (amostra pequena)`;
  return forca ?? "—";
}

/** Escolhe a aparição mais confiável: a mais recente com amostra suficiente (ou a mais recente, se nenhuma tiver). */
function escolherBase(aps: Aparicao[]): Aparicao {
  const ord = [...aps].sort((a, b) => (b.rodada ?? 0) - (a.rodada ?? 0));
  return ord.find((a) => a.buscas >= AMOSTRA_MINIMA) ?? ord[0];
}

export function analisarAnuncio(aparicoes: Aparicao[]): Analise | null {
  if (!aparicoes.length) return null;
  const b = escolherBase(aparicoes);
  const p = b.presenca;
  const pequena = b.buscas < AMOSTRA_MINIMA;
  const pos = b.posMedia;
  const noTopo = pos !== null && pos <= 1.5;
  const atras = pos !== null && pos >= 2.5;
  const umPonto = b.pontos.length === 1;
  const leitura: string[] = [], causas: string[] = [], cuidados: string[] = [];
  const quando = b.rodada ? `Na rodada #${b.rodada}` : "Nesta pesquisa";
  const regiao = b.regiao.replace(/^\d{3}\s+/, "");
  const fora = b.buscas - b.aparicoes;

  // --- O que os números dizem ---
  leitura.push(`${quando} o robô fez ${b.buscas} ${b.buscas === 1 ? "busca" : "buscas"} em ${b.regiao} e o anúncio apareceu em ${b.aparicoes} (${pct(p)}).`.replace(b.regiao, regiao));
  if (pequena) {
    leitura.push(`Amostra pequena: com só ${b.buscas} ${b.buscas === 1 ? "busca" : "buscas"} não dá para dizer se a presença é forte ou fraca. Repita a pesquisa com mais palavras-chave ou mais cidades antes de usar esse número na conversa.`);
  } else if (p < 0.4) {
    leitura.push(`Ficou de fora de ${fora} das ${b.buscas} buscas: quem procura o serviço na região quase nunca vê esse anúncio.`);
  } else if (p <= 0.75) {
    leitura.push(`Ficou de fora de ${fora} das ${b.buscas} buscas: perde cerca de ${deCada10(p)} em cada 10 clientes que procuram o serviço.`);
  } else {
    leitura.push("Aparece quase sempre: é um anunciante que investe de forma constante.");
  }
  if (pos !== null) {
    if (noTopo) leitura.push("Quando aparece, fica em 1º lugar: o anúncio em si é bom (lance e qualidade em dia).");
    else if (atras) leitura.push(`Quando aparece, fica em média na posição ${pos.toFixed(1).replace(".", ",")} (1 = primeiro anúncio): tem concorrente pagando mais ou com anúncio melhor na frente.`);
    else leitura.push(`Quando aparece, fica entre o 1º e o 2º lugar (posição média ${pos.toFixed(1).replace(".", ",")}).`);
  }
  if (b.aparicoes > 0) {
    leitura.push(`Apareceu ${umPonto ? "só" : ""} em ${lista(b.pontos)}${b.termos.length ? `, para ${b.termos.length === 1 ? "a busca" : "as buscas"} ${lista(b.termos.map((t) => `"${t}"`))}` : ""}.`.replace("  ", " "));
  }

  // --- Histórico: outras rodadas ---
  const outras = aparicoes.filter((a) => a !== b).sort((x, y) => (y.rodada ?? 0) - (x.rodada ?? 0));
  for (const o of outras.slice(0, 4)) {
    const nome = o.rodada ? `rodada #${o.rodada}` : "outra pesquisa";
    if (o.buscas < AMOSTRA_MINIMA && Math.abs(o.presenca - p) >= 0.3 && !pequena) {
      leitura.push(`A ${nome} deu ${pct(o.presenca)} (${o.aparicoes}/${o.buscas}), mas com ${o.buscas === 1 ? "uma busca só" : `só ${o.buscas} buscas`}: não vale como comparação. O retrato confiável é o de ${b.buscas} buscas (${pct(p)}).`);
    } else if (o.buscas >= AMOSTRA_MINIMA && o.regiao === b.regiao && Math.abs(o.presenca - p) >= 0.2) {
      const caiu = p < o.presenca;
      leitura.push(`Na ${nome} estava em ${pct(o.presenca)} e agora está em ${pct(p)}: ${caiu ? "caiu — pode ter reduzido verba, pausado ou perdido espaço para concorrente" : "subiu — está investindo mais"}.`);
    }
  }

  // --- Por quê / o que falar ---
  let abordagem: string;
  if (pequena) {
    abordagem = "Ainda não use a presença como argumento: repita a pesquisa nessa região com mais buscas. Enquanto isso, use os outros pontos (site, conversões, palavra-chave).";
  } else if (p < 0.4 && !atras) {
    causas.push("Verba diária acabando cedo (o anúncio some no resto do dia).",
      umPonto ? `Área do anúncio configurada só para ${b.pontos[0]}.` : "Área do anúncio menor que a região que ele atende.",
      "Poucas palavras-chave (não aparece em buscas parecidas).");
    abordagem = `Fizemos ${b.buscas} buscas na sua região e o seu anúncio só apareceu em ${b.aparicoes}.${noTopo ? " Quando aparece, fica em 1º lugar, então o problema não é a qualidade do anúncio: é verba, horário ou área configurada." : ""} Dá para aparecer muito mais sem necessariamente gastar mais.`;
  } else if (p < 0.4 && atras) {
    causas.push("Lance baixo ou anúncio com nota de qualidade fraca: perde o leilão para os concorrentes.", "Verba curta e área ou palavras-chave limitadas.");
    abordagem = `Fizemos ${b.buscas} buscas na sua região: o seu anúncio apareceu em ${b.aparicoes} e, quando apareceu, ficou atrás dos concorrentes. Quem procura o serviço está ligando para eles primeiro. Dá para melhorar o anúncio e a página para aparecer mais e pagar menos por clique.`;
  } else if (p <= 0.75) {
    causas.push("Verba que não cobre o dia todo ou lance no limite.", "Algumas palavras-chave ou cidades de fora da campanha.");
    abordagem = `O seu anúncio fica de fora em ${deCada10(p)} de cada 10 buscas na sua região${atras ? " e, quando aparece, fica atrás de concorrentes" : ""}. São clientes procurando o seu serviço e encontrando outra empresa. Dá para cobrir esse buraco ajustando a campanha.`;
  } else if (atras) {
    causas.push("Concorrentes com lance maior ou anúncio melhor avaliado.");
    abordagem = `Seu anúncio aparece quase sempre, mas fica atrás de concorrentes (posição média ${pos!.toFixed(1).replace(".", ",")}). Melhorando a qualidade do anúncio e da página dá para subir de posição sem aumentar o lance.`;
  } else {
    abordagem = "A presença está forte e o anúncio fica no topo: aqui o argumento não é aparecer mais. Vá pelos outros pontos (site, medição de conversões, palavra-chave, custo por cliente).";
  }

  // --- Cuidados ---
  if (!pequena && p < 0.75 && umPonto) cuidados.push(`Se ele atende só ${b.pontos[0]} de propósito, é normal não aparecer nas outras cidades. Pergunte isso antes de afirmar que está perdendo clientes.`);
  if (!pequena && p < 0.75) cuidados.push("Pergunte se a verba acaba antes do fim do dia: é a causa mais comum e ele costuma saber.");

  const forcaTxt = pequena ? "amostra pequena" : p < 0.4 ? "presença fraca" : p <= 0.75 ? "presença média" : "presença forte";
  const posTxt = pos === null ? "" : noTopo ? ", em 1º quando aparece" : atras ? ", atrás de concorrentes" : "";
  const resumo = `${pct(p)} (${b.aparicoes}/${b.buscas}) em ${regiao}: ${forcaTxt}${posTxt}.`;
  return { resumo, leitura, causas, abordagem, cuidados, amostraPequena: pequena };
}

/** Texto corrido (para copiar/colar no WhatsApp ou no CRM). */
export function analiseEmTexto(a: Analise): string {
  return [
    a.resumo,
    ...a.leitura.map((l) => `- ${l}`),
    a.causas.length ? `Causas prováveis: ${a.causas.join(" ")}` : "",
    `O que falar: "${a.abordagem}"`,
    ...a.cuidados.map((c) => `Cuidado: ${c}`),
  ].filter(Boolean).join("\n");
}
