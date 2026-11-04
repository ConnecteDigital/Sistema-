// Identificação do anunciante a partir do anúncio (seção 5.2).

const SUFIXOS_BR = [
  "com.br", "net.br", "org.br", "tec.br", "srv.br", "eco.br", "app.br", "ind.br", "eng.br",
  "adv.br", "blog.br", "emp.br", "art.br", "bsb.br", "gov.br", "edu.br", "inf.br", "info.br",
  "log.br", "med.br", "pro.br", "rio.br", "sp.br", "rj.br", "mg.br", "pr.br", "rs.br", "sc.br",
  "df.br", "ba.br", "ce.br", "pe.br", "go.br", "esp.br", "ong.br", "dev.br", "seg.br", "imb.br",
];
const SUFIXOS_OUTROS = ["co.uk", "com.ar", "com.mx", "com.pt"];

/** "sc.ozielhidro.com.br" → "ozielhidro.com.br" */
export function dominioRaiz(host: string): string {
  const h = host.toLowerCase().replace(/^www\./, "").replace(/\.$/, "");
  const partes = h.split(".");
  for (const suf of [...SUFIXOS_BR, ...SUFIXOS_OUTROS]) {
    if (h === suf) return h;
    if (h.endsWith("." + suf)) {
      const resto = h.slice(0, -(suf.length + 1)).split(".");
      return resto[resto.length - 1] + "." + suf;
    }
  }
  return partes.slice(-2).join(".");
}

/** Extrai host de um link completo ou de um displayed_link ("https://www.x.com.br › servicos"). */
export function hostDe(texto: string | null | undefined): string | null {
  if (!texto) return null;
  const limpo = texto.trim().split(/\s|›/)[0];
  if (!limpo) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(limpo) ? limpo : "https://" + limpo);
    if (!url.hostname.includes(".")) return null;
    return url.hostname.toLowerCase();
  } catch {
    return null;
  }
}

const HOSTS_GOOGLE = /(^|\.)(google\.[a-z.]+|business\.site|g\.page|goo\.gl|googleadservices\.com)$/;

export type Identificacao = {
  dominio: string;           // chave do anunciante
  perfilGoogle: boolean;     // anúncio leva para o perfil do Google, não para um site
};

/** Decide quem é o anunciante de um anúncio. */
export function identificarAnunciante(ad: {
  link?: string | null; displayed_link?: string | null; source?: string | null;
}): Identificacao | null {
  const hostLink = hostDe(ad.link);
  if (hostLink && !HOSTS_GOOGLE.test(hostLink)) return { dominio: dominioRaiz(hostLink), perfilGoogle: false };

  const hostExibido = hostDe(ad.displayed_link);
  if (hostExibido && !HOSTS_GOOGLE.test(hostExibido)) {
    return { dominio: dominioRaiz(hostExibido), perfilGoogle: !!hostLink };
  }
  // source às vezes já é um domínio ("desentupidorasos.com")
  const hostSource = ad.source && /^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(ad.source.trim()) ? hostDe(ad.source) : null;
  if (hostSource && !HOSTS_GOOGLE.test(hostSource)) return { dominio: dominioRaiz(hostSource), perfilGoogle: !!hostLink };

  if (ad.source?.trim()) {
    const slug = ad.source.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    return { dominio: `perfil-google:${slug}`, perfilGoogle: true };
  }
  return null;
}
