export const COR_PRIORIDADE: Record<string, string> = {
  "Máxima": "bg-red-600 text-white", Alta: "bg-orange-100 text-orange-800",
  Normal: "bg-slate-100 text-slate-700", Baixa: "bg-slate-100 text-slate-400",
};
export const COR_FORCA: Record<string, string> = {
  Fraca: "bg-green-100 text-green-800", "Média": "bg-amber-100 text-amber-800", Forte: "bg-slate-200 text-slate-700",
};
export const ROTULO_TAG: Record<string, string> = {
  sim: "Sim", so_gtm: "Só Tag Manager", nao: "Não encontrada", nao_verificado: "Não verificado",
};
export const ROTULO_SITUACAO: Record<string, string> = {
  ok: "No ar", fora_do_ar: "FORA DO AR", suspenso: "SUSPENSO", dns: "DOMÍNIO NÃO EXISTE",
  bloqueado: "Bloqueia robôs", nao_verificado: "Não verificado",
};

/** Link de WhatsApp a partir de "(11) 98765-4321". */
export function linkWhats(tel: string) {
  const d = tel.replace(/\D/g, "");
  return d.length === 11 ? `https://wa.me/55${d}` : null;
}
