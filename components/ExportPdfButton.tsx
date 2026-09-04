"use client";

import { jsPDF } from "jspdf";
import type { SchemaResult } from "@/lib/ai/schema-generator";

// Export PDF réel (texte sélectionnable, plusieurs pages si besoin) — pas
// une image comme ExportPngButton.tsx. Réservé aux forfaits Pro/Élite (voir
// HAS_PDF_EXPORT dans lib/plan-limits.ts), donc rendu uniquement dans le
// dashboard authentifié, jamais sur la page de partage publique.
export function ExportPdfButton({ schema }: { schema: SchemaResult }) {
  function handleExport() {
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 48;
    const maxWidth = pageWidth - margin * 2;
    let y = margin;

    function ensureSpace(neededHeight: number) {
      if (y + neededHeight > pageHeight - margin) {
        doc.addPage();
        y = margin;
      }
    }

    function writeParagraph(text: string, fontSize: number, color: [number, number, number], lineHeight = 14) {
      doc.setFontSize(fontSize);
      doc.setTextColor(...color);
      const lines = doc.splitTextToSize(text, maxWidth);
      for (const line of lines) {
        ensureSpace(lineHeight);
        doc.text(line, margin, y);
        y += lineHeight;
      }
    }

    // Titre + score
    doc.setFont("helvetica", "bold");
    writeParagraph(schema.projectTitle, 20, [20, 20, 20], 24);
    doc.setFont("helvetica", "normal");
    writeParagraph(`Score global : ${schema.overallScore}/10`, 13, [8, 145, 178], 20);
    y += 8;

    // Analyse par critère
    doc.setFont("helvetica", "bold");
    writeParagraph("ANALYSE", 10, [120, 120, 120], 18);
    for (const [key, c] of Object.entries(schema.criteria)) {
      doc.setFont("helvetica", "bold");
      writeParagraph(`${capitalize(key)} — ${c.score}/5`, 12, [30, 30, 30], 16);
      doc.setFont("helvetica", "normal");
      writeParagraph(c.note, 10.5, [90, 90, 90], 14);
      y += 8;
    }

    y += 8;
    doc.setFont("helvetica", "bold");
    writeParagraph("PLAN D'ACTION", 10, [120, 120, 120], 18);

    for (const n of schema.nodes) {
      const tagLabel = n.type === "todo" ? "À FAIRE" : n.type === "risk" ? "VIGILANCE" : "OPPORTUNITÉ";
      const tagColor: [number, number, number] =
        n.type === "todo" ? [8, 145, 178] : n.type === "risk" ? [220, 38, 38] : [22, 163, 74];
      doc.setFont("helvetica", "bold");
      writeParagraph(tagLabel, 8.5, tagColor, 13);
      writeParagraph(n.label, 12.5, [30, 30, 30], 16);
      doc.setFont("helvetica", "normal");
      writeParagraph(n.comment, 10.5, [90, 90, 90], 14);
      y += 10;
    }

    // Pied de page sur la dernière page
    doc.setFontSize(9);
    doc.setTextColor(150, 150, 150);
    doc.text("Généré avec Spark Idea", margin, pageHeight - 24);

    doc.save(`${schema.projectTitle.replace(/[^a-z0-9]/gi, "-")}.pdf`);
  }

  return (
    <button onClick={handleExport} className="btn-secondary" style={{ borderRadius: 20, fontSize: 12.5 }}>
      Télécharger en PDF
    </button>
  );
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
