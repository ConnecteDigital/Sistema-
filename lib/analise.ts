// Análise do anúncio em português claro: o que os números dizem, por quê, o que falar e o cuidado. Pura.
// Olha os dois lados da busca: o anúncio pago (patrocinado) e o site no orgânico.
import type { Organico } from "./agregacao";

export type Aparicao = {
  rodada?: number | null; data?: string | null; regiao: string;
  presenca: number; aparicoes: number; buscas: number; posMedia: number | null; pctTopo?: number | null;
  pontos: string[]; termos: string[];
  organico?: Organico | null;   // null/undefined = orgânico não medido nesta rodada
  porPonto?: { ponto: string; buscas: number; aparicoes: number }[] | null;   // cada cidade da região (null = rodada antiga)
};

/** Onde ele anuncia: as cidades da região em que apareceu, quando ele NÃO aparece na região toda. */
type Foco = { cidades: string[]; buscas: number; aparicoes: number; presenca: number; outras: string[];
  detalhe: { ponto: string; buscas: number; aparicoes: number }[] };
function focoDe(a: Aparicao): Foco | null {
  const pp = (a.porPonto ?? []).filter((x) => x.buscas > 0);
  const com = pp.filter((x) => x.aparicoes > 0), sem = pp.filter((x) => x.aparicoes === 0);
  if (!com.length || !sem.length) return null;   // aparece em todas (ou em nenhuma): não há foco
  const buscas = com.reduce((s, x) => s + x.buscas, 0), aparicoes = com.reduce((s, x) => s + x.aparicoes, 0);
  return { cidades: com.map((x) => x.ponto), buscas, aparicoes, presenca: buscas ? aparicoes / buscas : 0,
    outras: sem.map((x) => x.ponto), detalhe: com };
}

export type Analise = {
  resumo: string;          // uma frase: o retrato (pago + orgânico)
  leitura: string[];       // anúncio pago: o que os números querem dizer
  organico: string[];      // orgânico: o que os números querem dizer
  causas: string[];        // por que isso acontece (prováveis)
  abordagem: string;       // o que falar na ligação/mensagem
  cuidados: string[];      // o que perguntar antes de afirmar
  amostraPequena: boolean;
};

/** Abaixo disso, a presença (ex.: 1/1 = 100%) não serve para concluir nada. */
export const AMOSTRA_MINIMA = 5;
/** Para o "O que falar" (texto que vai para o cliente) exige mais: com menos buscas, nada de número na mensagem. */
export const AMOSTRA_FALA = 10;
/** Posição ("1º lugar", "atrás de concorrentes") só com pelo menos 3 aparições: 1 aparição é uma foto, não um padrão. */
export const APARICOES_POSICAO = 3;

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

export type ForcaOrganico = "forte" | "media" | "fraca" | "ausente";

/** Orgânico forte = aparece em 3 de cada 4 buscas, entre os 3 primeiros em média. */
export function forcaOrganico(o: Organico): ForcaOrganico {
  if (o.aparicoes === 0) return "ausente";
  if (o.presenca >= 0.75 && o.posMedia !== null && o.posMedia <= 3) return "forte";
  if (o.presenca >= 0.4) return "media";
  return "fraca";
}

const num = (v: number) => v.toFixed(1).replace(".", ",").replace(",0", "");

/** "8/9 buscas, posição média 1,3: forte" (para tabela e resumo). */
export function resumoOrganico(o: Organico | null | undefined): string {
  if (!o) return "não medido nesta rodada";
  const f = forcaOrganico(o);
  if (f === "ausente") return `não apareceu na 1ª página (0/${o.buscas})`;
  const rot = { forte: "forte", media: "médio", fraca: "fraco" }[f];
  return `${o.aparicoes}/${o.buscas} buscas${o.posMedia !== null ? `, posição média ${num(o.posMedia)}` : ""}: ${rot}`;
}

export function analisarAnuncio(aparicoes: Aparicao[]): Analise | null {
  if (!aparicoes.length) return null;
  const b = escolherBase(aparicoes);
  const p = b.presenca;
  const pequena = b.buscas < AMOSTRA_MINIMA;
  const pos = b.posMedia;
  const posConfiavel = pos !== null && b.aparicoes >= APARICOES_POSICAO;
  const noTopo = posConfiavel && pos! <= 1.5;
  const atras = posConfiavel && pos! >= 2.5;
  const umPonto = b.pontos.length === 1;
  const leitura: string[] = [], causas: string[] = [], cuidados: string[] = [];
  const quando = b.rodada ? `Na rodada #${b.rodada}` : "Nesta pesquisa";
  const regiao = b.regiao.replace(/^\d{3}\s+/, "");
  const fora = b.buscas - b.aparicoes;
  // Ele anuncia só em algumas cidades da região? Então a força que importa é a medida LÁ.
  const f = focoDe(b);
  const usaFoco = !!f && !pequena && p < 0.75 && f.buscas >= AMOSTRA_MINIMA;
  const P = usaFoco ? f!.presenca : p;
  const BB = usaFoco ? f!.buscas : b.buscas;
  const AA = usaFoco ? f!.aparicoes : b.aparicoes;
  const ONDE = usaFoco ? `em ${lista(f!.cidades)}, onde você anuncia` : "na sua região";
  const forcaDaPresenca = (x: number) => (x < 0.4 ? "fraca" : x <= 0.75 ? "média" : "forte");

  // --- O que os números dizem ---
  // Nome da região x nome da cidade: "Balneário Camboriú e região" (5 cidades) não é a cidade "Balneário Camboriú"
  const cidadesRegiao = (b.porPonto ?? []).filter((x) => x.buscas > 0).map((x) => x.ponto);
  const ondeRegiao = cidadesRegiao.length > 1
    ? `na região inteira "${regiao}" (${cidadesRegiao.length} cidades: ${lista(cidadesRegiao, 4)})`
    : `em ${regiao}`;
  leitura.push(`${quando} o robô fez ${b.buscas} ${b.buscas === 1 ? "busca" : "buscas"} ${ondeRegiao} e o anúncio pago apareceu em ${b.aparicoes} (${pct(p)}).`);
  if (f && !pequena) {
    leitura.push(`Essa${f.aparicoes > 1 ? "s aparições foram" : " aparição foi"} na cidade de ${lista(f.cidades)}. Contando só ${f.cidades.length === 1 ? "essa cidade" : "essas cidades"}: ` +
      `${f.buscas} buscas e o anúncio apareceu em ${f.aparicoes} (${pct(f.presenca)}), presença ${forcaDaPresenca(f.presenca)} onde ele anuncia` +
      (f.buscas < AMOSTRA_MINIMA ? " (amostra pequena)." : "."));
    if (f.detalhe.length > 1) leitura.push(`Por cidade: ${f.detalhe.map((x) => `${x.ponto} ${x.aparicoes}/${x.buscas}`).join(", ")}.`);
    leitura.push(`Nas outras cidades (${lista(f.outras)}) o anúncio não apareceu.`);
  }
  if (pequena) {
    leitura.push(`Amostra pequena: com só ${b.buscas} ${b.buscas === 1 ? "busca" : "buscas"} não dá para dizer se a presença é forte ou fraca. Repita a pesquisa com mais palavras-chave ou mais cidades antes de usar esse número na conversa.`);
  } else if (p < 0.4 && f) {
    leitura.push(`Na região inteira (todas as cidades), ficou de fora de ${fora} das ${b.buscas} buscas.`);
  } else if (p < 0.4) {
    leitura.push(`Ficou de fora de ${fora} das ${b.buscas} buscas: quem procura o serviço na região quase nunca vê esse anúncio.`);
  } else if (p <= 0.75) {
    leitura.push(`Ficou de fora de ${fora} das ${b.buscas} buscas: perde cerca de ${deCada10(p)} em cada 10 clientes que procuram o serviço.`);
  } else {
    leitura.push("Aparece quase sempre: é um anunciante que investe de forma constante.");
  }
  if (pos !== null) {
    if (!posConfiavel) leitura.push(`Posição: o anúncio apareceu só ${b.aparicoes} ${b.aparicoes === 1 ? "vez" : "vezes"}, pouco para dizer se fica na frente ou atrás dos concorrentes.`);
    else if (noTopo) leitura.push("Quando aparece, fica em 1º lugar: o anúncio em si é bom (lance e qualidade em dia).");
    else if (atras) leitura.push(`Quando aparece, fica em média na posição ${pos.toFixed(1).replace(".", ",")} (1 = primeiro anúncio): tem concorrente pagando mais ou com anúncio melhor na frente.`);
    else leitura.push(`Quando aparece, fica entre o 1º e o 2º lugar (posição média ${pos.toFixed(1).replace(".", ",")}).`);
  }
  if (b.aparicoes > 0 && f && !pequena) {
    if (b.termos.length) leitura.push(`Apareceu para ${b.termos.length === 1 ? "a busca" : "as buscas"} ${lista(b.termos.map((t) => `"${t}"`))}.`);
  } else if (b.aparicoes > 0) {
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
  } else if (usaFoco && P > 0.75) {
    abordagem = `Em ${lista(f!.cidades)}, onde você anuncia, o seu anúncio aparece em ${AA} de ${BB} buscas: lá está forte. ` +
      `Nas cidades vizinhas (${lista(f!.outras)}) ele não aparece. Se você também atende essas cidades, são clientes procurando o seu serviço e ligando para outra empresa.`;
    if (atras) abordagem += ` E, nas vezes em que aparece, fica em média na ${Math.round(pos!)}ª posição, com concorrente acima.`;
  } else if (P < 0.4 && !atras) {
    causas.push("Verba diária acabando cedo (o anúncio some no resto do dia).",
      usaFoco ? "Lance ou horário de veiculação limitados." : umPonto ? `Área do anúncio configurada só para ${b.pontos[0]}.` : "Área do anúncio menor que a região que ele atende.",
      "Poucas palavras-chave (não aparece em buscas parecidas).");
    abordagem = `Nas ${BB} buscas que fizemos ${ONDE}, o seu anúncio apareceu em ${AA}.${noTopo ? ` Quando aparece, fica em 1º lugar, então o problema não é a qualidade do anúncio: é verba, horário${usaFoco ? "" : " ou área configurada"}.` : ""} Dá para aparecer muito mais sem necessariamente gastar mais.`;
  } else if (P < 0.4 && atras) {
    causas.push("Lance baixo ou anúncio com nota de qualidade fraca: perde o leilão para os concorrentes.", usaFoco ? "Verba curta ou poucas palavras-chave." : "Verba curta e área ou palavras-chave limitadas.");
    abordagem = `Nas ${BB} buscas que fizemos ${ONDE}, o seu anúncio apareceu em ${AA} e, nessas vezes, ficou em média na ${Math.round(pos!)}ª posição, com concorrente acima. Quem procura o serviço tende a ligar para quem aparece primeiro. Dá para melhorar o anúncio e a página para aparecer mais e pagar menos por clique.`;
  } else if (P <= 0.75) {
    causas.push("Verba que não cobre o dia todo ou lance no limite.", usaFoco ? "Algumas palavras-chave de fora da campanha." : "Algumas palavras-chave ou cidades de fora da campanha.");
    abordagem = `O seu anúncio fica de fora em ${deCada10(P)} de cada 10 buscas ${ONDE}${atras ? ` e, quando aparece, fica em média na ${Math.round(pos!)}ª posição` : ""}. São clientes procurando o seu serviço e encontrando outra empresa. Dá para cobrir esse buraco ajustando a campanha.`;
  } else if (atras) {
    causas.push("Concorrentes com lance maior ou anúncio melhor avaliado.");
    abordagem = `Seu anúncio aparece quase sempre, mas em média na ${Math.round(pos!)}ª posição, com concorrente acima. Melhorando a qualidade do anúncio e da página dá para subir de posição sem aumentar o lance.`;
  } else {
    abordagem = "A presença está forte e o anúncio fica no topo: aqui o argumento não é aparecer mais. Vá pelos outros pontos (site, medição de conversões, palavra-chave, custo por cliente).";
  }

  // --- Orgânico (o site, sem anúncio) ---
  const o = b.organico ?? null;
  const organico: string[] = [];
  const fo = o ? forcaOrganico(o) : null;
  const orgPequena = !!o && o.buscas < AMOSTRA_MINIMA;
  if (!o) {
    organico.push("Não medido nesta rodada (feita antes de o robô ler o orgânico).");
  } else if (fo === "ausente") {
    organico.push(`Nas ${o.buscas} buscas, o site não apareceu na 1ª página do orgânico.`);
  } else {
    organico.push(`O site apareceu na 1ª página do orgânico em ${o.aparicoes} das ${o.buscas} buscas (${pct(o.presenca)})` +
      (o.posMedia !== null ? `, em média na posição ${num(o.posMedia)} (melhor: ${o.melhorPos}º lugar).` : "."));
    if (fo === "forte") organico.push("Está muito bem no orgânico: quem pesquisa encontra o site dele entre os primeiros resultados, abaixo dos anúncios.");
    else if (fo === "media") organico.push("Aparece no orgânico em parte das buscas, nem sempre entre os primeiros.");
    else organico.push("Aparece pouco no orgânico.");
  }
  if (orgPequena) organico.push(`Amostra pequena (${o!.buscas} ${o!.buscas === 1 ? "busca" : "buscas"}): confira no Google antes de citar esse número.`);

  // O que falar, levando o orgânico em conta (só com amostra suficiente nos dois)
  if (o && usaFoco && !orgPequena && (fo === "ausente" || fo === "fraca")) {
    abordagem += fo === "ausente"
      ? ` E no orgânico o seu site não apareceu na 1ª página em nenhuma das ${o.buscas} buscas da região.`
      : ` E no orgânico o site aparece pouco (em ${o.aparicoes} das ${o.buscas} buscas da região).`;
  }
  if (o && !usaFoco && !pequena && !orgPequena) {
    const posOrg = o.posMedia !== null ? `, em média na posição ${num(o.posMedia)}` : "";
    if ((fo === "forte" || fo === "media") && p <= 0.75) {
      const final = p < 0.4 && !atras ? "Dá para o seu anúncio aparecer muito mais sem necessariamente gastar mais."
        : p < 0.4 ? "Dá para melhorar o anúncio e a página para aparecer mais e pagar menos por clique."
        : "Dá para cobrir esse buraco ajustando a campanha.";
      abordagem = `Fizemos ${b.buscas} buscas na sua região. No orgânico o seu site ${fo === "forte" ? "está muito bem" : "aparece"}: ` +
        `apareceu em ${o.aparicoes} delas${posOrg}. Já o seu anúncio pago apareceu em ${b.aparicoes}${atras ? `, em média na ${Math.round(pos!)}ª posição` : ""}. ` +
        `Os anúncios patrocinados aparecem antes do orgânico, e quem clica neles está indo para outras empresas. ${final}`;
    } else if ((fo === "ausente" || fo === "fraca") && p <= 0.75) {
      abordagem += fo === "ausente"
        ? ` E no orgânico o seu site não apareceu na 1ª página em nenhuma das ${o.buscas} buscas: hoje, quem pesquisa na região quase não te encontra no Google.`
        : ` E no orgânico o site também aparece pouco (em ${o.aparicoes} das ${o.buscas} buscas).`;
    } else if (p > 0.75 && fo === "ausente") {
      abordagem = `Seu anúncio aparece quase sempre${atras ? `, mas em média na ${Math.round(pos!)}ª posição` : ""}. Só que no orgânico o seu site não apareceu na 1ª página em nenhuma das ${o.buscas} buscas: ` +
        "você depende 100% do anúncio pago. Se a verba parar, o telefone para. Dá para trabalhar o site para aparecer também no orgânico.";
    } else if (p > 0.75 && fo === "fraca") {
      abordagem += ` No orgânico o site aparece pouco (${o.aparicoes} de ${o.buscas} buscas): ele depende quase só do anúncio pago.`;
    }
  }

  // --- Cuidados ---
  if (o && (fo === "forte" || fo === "media") && p < 0.75 && !pequena) {
    cuidados.push("Ele aparece no orgânico: quando pesquisar, vai ver o site dele no Google. Deixe claro desde o começo que você está falando do anúncio pago (patrocinado), não do site.");
  }
  if (!o && !pequena && p < 0.75) {
    cuidados.push("O orgânico não foi medido nesta rodada. Antes de falar em presença fraca, pesquise o serviço no Google e veja se o site dele aparece abaixo dos anúncios: se aparecer bem, fale só do anúncio pago.");
  }
  if (usaFoco) {
    cuidados.push(`Ele parece anunciar de propósito só em ${lista(f!.cidades)}: o "O que falar" já usa só ${f!.cidades.length === 1 ? "essa cidade" : "essas cidades"}. ` +
      `Pergunte se ele também atende ${lista(f!.outras)} antes de falar das outras cidades.`);
  } else if (!pequena && p < 0.75 && umPonto) {
    cuidados.push(`Se ele atende só ${b.pontos[0]} de propósito, é normal não aparecer nas outras cidades. Pergunte isso antes de afirmar que está perdendo clientes.`);
  }
  if (!pequena && P < 0.75) cuidados.push("Pergunte se a verba acaba antes do fim do dia: é a causa mais comum e ele costuma saber.");
  if (!pequena) cuidados.push("Quem anuncia costuma se ver em 1º quando pesquisa: o Google personaliza o resultado e o próprio dono pesquisa perto da empresa. " +
    "Se ele disser \"eu apareço em primeiro\", é normal: o robô pesquisa como cliente, em várias cidades, palavras e horários.");

  // Pouca busca para pôr número na mensagem do cliente: o "O que falar" vira orientação interna
  const pequenaFala = !pequena && BB < AMOSTRA_FALA;
  if (pequenaFala) {
    abordagem = `Ainda não mande números: foram só ${BB} buscas ${usaFoco ? `em ${lista(f!.cidades)}` : "na região"}, pouco para afirmar presença ou posição. ` +
      "Repita a pesquisa nessa cidade com mais palavras-chave antes de citar números; por enquanto, use os outros pontos (site, medição de conversões, palavra-chave) ou só pergunte como está o retorno do anúncio.";
    causas.length = 0;
  }

  const forcaTxt = pequena ? "amostra pequena" : p < 0.4 ? "presença fraca" : p <= 0.75 ? "presença média" : "presença forte";
  const posTxt = !posConfiavel ? "" : noTopo ? ", em 1º quando aparece" : atras ? `, em média na ${Math.round(pos!)}ª posição` : "";
  const focoTxt = usaFoco ? ` Em ${lista(f!.cidades)} (onde anuncia): ${pct(P)} (${AA}/${BB}), presença ${forcaDaPresenca(P)}.` : "";
  const resumo = `Anúncio pago: ${pct(p)} (${b.aparicoes}/${b.buscas}) em ${regiao}, ${forcaTxt}${posTxt}.${focoTxt} Orgânico: ${resumoOrganico(o)}.`;
  return { resumo, leitura, organico, causas, abordagem, cuidados, amostraPequena: pequena || pequenaFala };
}

/** Texto corrido (para copiar/colar no WhatsApp ou no CRM). */
export function analiseEmTexto(a: Analise): string {
  return [
    a.resumo,
    ...a.leitura.map((l) => `- ${l}`),
    ...a.organico.map((l) => `- Orgânico: ${l}`),
    a.causas.length ? `Causas prováveis: ${a.causas.join(" ")}` : "",
    `O que falar: "${a.abordagem}"`,
    ...a.cuidados.map((c) => `Cuidado: ${c}`),
  ].filter(Boolean).join("\n");
}
