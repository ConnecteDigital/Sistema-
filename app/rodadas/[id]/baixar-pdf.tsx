"use client";

import { useState } from "react";

export type ItemPdf = {
  n: number; prioridade: string; empresa: string; cnpj: string | null; telefone: string | null;
  sites: string[]; regioes: string[]; presenca: string; status: string;
  porQue: string[]; resumo: string | null; falar: string | null; cuidados: string[];
};

const COR: Record<string, [number, number, number]> = {
  "Máxima": [220, 38, 38], Alta: [234, 88, 12], Normal: [37, 99, 235], Baixa: [100, 116, 139],
};

// Fontes padrão do PDF só têm o alfabeto latino: troca símbolos que não existem nelas.
const limpar = (t: string) => t.replace(/⚠️?/g, "!").replace(/[^\u0000-ÿ—–“”‘’…•€]/g, "");

export function BotaoPdf({ itens, titulo }: { itens: ItemPdf[]; titulo: string }) {
  const [gerando, setGerando] = useState(false);

  async function gerar() {
    setGerando(true);
    try {
      const [{ jsPDF }, { default: autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      const agora = new Date();
      doc.setFontSize(15);
      doc.text(limpar(titulo), 12, 14);
      doc.setFontSize(9);
      doc.setTextColor(100);
      doc.text(`${itens.length} empresas para ligar · gerado em ${agora.toLocaleString("pt-BR")}`, 12, 20);

      autoTable(doc, {
        startY: 24,
        margin: { left: 12, right: 12 },
        styles: { fontSize: 8, cellPadding: 1.8, valign: "top", overflow: "linebreak" },
        headStyles: { fillColor: [30, 41, 59], textColor: 255, fontStyle: "bold" },
        columnStyles: {
          0: { cellWidth: 8, halign: "right" }, 1: { cellWidth: 18 }, 2: { cellWidth: 58 }, 3: { cellWidth: 30 },
          4: { cellWidth: "auto" }, 5: { cellWidth: 26, halign: "right" }, 6: { cellWidth: 20 },
        },
        head: [["#", "Prioridade", "Empresa", "Telefone", "Por que ligar e o que falar", "Presença", "Status"]],
        body: itens.map((d) => [
          String(d.n),
          d.prioridade,
          limpar([d.empresa, d.cnpj ? `CNPJ ${d.cnpj}` : "", d.sites.filter((s) => s !== d.empresa).map((s) => s.startsWith("perfil-google:") ? "perfil Google" : s).join(" · ")]
            .filter(Boolean).join("\n")),
          d.telefone ?? "abrir o anúncio no celular",
          limpar([
            ...d.porQue.map((o) => `• ${o}`),
            d.resumo ? `Anúncio: ${d.resumo}` : "",
            d.falar ? `O que falar: “${d.falar}”` : "",
            ...d.cuidados.map((c) => `Cuidado: ${c}`),
          ].filter(Boolean).join("\n")),
          limpar(`${d.presenca}\n${d.regioes.map((r) => r.replace(/^\d{3}\s+/, "")).join(", ")}`),
          d.status,
        ]),
        didParseCell: (c) => {
          if (c.section === "body" && c.column.index === 1) {
            const cor = COR[String(c.cell.raw)];
            if (cor) { c.cell.styles.textColor = cor; c.cell.styles.fontStyle = "bold"; }
          }
        },
        didDrawPage: () => {
          const h = doc.internal.pageSize.getHeight();
          doc.setFontSize(8); doc.setTextColor(140);
          doc.text(`Página ${doc.getCurrentPageInfo().pageNumber}`, doc.internal.pageSize.getWidth() - 12, h - 6, { align: "right" });
        },
      });
      doc.save(`lista-para-ligar-${agora.toISOString().slice(0, 10)}.pdf`);
    } finally {
      setGerando(false);
    }
  }

  return (
    <button className="botao-sec" onClick={gerar} disabled={gerando || !itens.length}>
      {gerando ? "Gerando PDF…" : "Baixar PDF"}
    </button>
  );
}
