"use client";

import type { SchemaResult } from "@/lib/ai/schema-generator";

// Dessine le schéma sur un <canvas> natif du navigateur puis déclenche le
// téléchargement en PNG — aucune librairie externe (pas de html2canvas),
// juste l'API Canvas 2D déjà disponible partout.
export function ExportPngButton({ schema }: { schema: SchemaResult }) {
  function handleExport() {
    const width = 800;
    const maxTextWidth = width - 80;

    // --- Passe 1 : on mesure le texte réel pour connaître la hauteur exacte
    // avant de créer le canvas final, plutôt que d'estimer au pif (une
    // estimation trop courte coupait le bas du schéma dans le PNG).
    const measureCanvas = document.createElement("canvas");
    const mctx = measureCanvas.getContext("2d");
    if (!mctx) return;

    let height = 50 + 34 + 40; // titre + score
    height += 22; // en-tête "ANALYSE"
    for (const c of Object.values(schema.criteria)) {
      height += 16;
      mctx.font = "12px sans-serif";
      height += countLines(mctx, c.note, maxTextWidth) * 15 + 14;
    }
    height += 20 + 22; // en-tête "PLAN D'ACTION"
    for (const n of schema.nodes) {
      height += 16 + 16;
      mctx.font = "12px sans-serif";
      height += countLines(mctx, n.comment, maxTextWidth) * 15 + 24;
    }
    height += 60; // marge + pied de page

    // --- Passe 2 : dessin réel sur un canvas dimensionné correctement
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Fond
    ctx.fillStyle = "#030407";
    ctx.fillRect(0, 0, width, height);

    let y = 50;

    // Titre
    ctx.fillStyle = "#e5e7eb";
    ctx.font = "bold 28px sans-serif";
    ctx.fillText(schema.projectTitle, 40, y);
    y += 34;

    // Score
    ctx.fillStyle = "#22d3ee";
    ctx.font = "16px sans-serif";
    ctx.fillText(`Score global : ${schema.overallScore}/10`, 40, y);
    y += 40;

    // Critères
    ctx.fillStyle = "#7d8590";
    ctx.font = "11px sans-serif";
    ctx.fillText("ANALYSE", 40, y);
    y += 22;
    for (const [key, c] of Object.entries(schema.criteria)) {
      ctx.fillStyle = "#e5e7eb";
      ctx.font = "13px sans-serif";
      ctx.fillText(`${capitalize(key)} — ${c.score}/5`, 40, y);
      y += 16;
      ctx.fillStyle = "#7d8590";
      ctx.font = "12px sans-serif";
      y = wrapText(ctx, c.note, 40, y, maxTextWidth, 15) + 14;
    }

    y += 20;
    ctx.fillStyle = "#7d8590";
    ctx.font = "11px sans-serif";
    ctx.fillText("PLAN D'ACTION", 40, y);
    y += 22;

    // Nœuds
    for (const n of schema.nodes) {
      const tagColor = n.type === "todo" ? "#22d3ee" : n.type === "risk" ? "#f43f5e" : "#22c55e";
      const tagLabel = n.type === "todo" ? "À FAIRE" : n.type === "risk" ? "VIGILANCE" : "OPPORTUNITÉ";
      ctx.fillStyle = tagColor;
      ctx.font = "10px sans-serif";
      ctx.fillText(tagLabel, 40, y);
      y += 16;
      ctx.fillStyle = "#e5e7eb";
      ctx.font = "bold 13px sans-serif";
      ctx.fillText(n.label, 40, y);
      y += 16;
      ctx.fillStyle = "#7d8590";
      ctx.font = "12px sans-serif";
      y = wrapText(ctx, n.comment, 40, y, maxTextWidth, 15) + 24;
    }

    // Pied de page
    ctx.fillStyle = "#7d8590";
    ctx.font = "11px sans-serif";
    ctx.fillText("Généré avec Spark Idea", 40, height - 30);

    const link = document.createElement("a");
    link.download = `${schema.projectTitle.replace(/[^a-z0-9]/gi, "-")}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  }

  return (
    <button onClick={handleExport} className="btn-secondary" style={{ borderRadius: 20, fontSize: 12.5 }}>
      Télécharger en PNG
    </button>
  );
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Compte le nombre de lignes qu'un texte va occuper une fois wrappé,
// pour dimensionner le canvas correctement avant de dessiner.
function countLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): number {
  const words = text.split(" ");
  let line = "";
  let lines = 1;
  for (const word of words) {
    const testLine = line + word + " ";
    if (ctx.measureText(testLine).width > maxWidth && line !== "") {
      lines++;
      line = word + " ";
    } else {
      line = testLine;
    }
  }
  return lines;
}

// Retour à la ligne manuel — l'API Canvas ne le fait pas nativement.
// Retourne la position Y finale après la dernière ligne dessinée.
function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number
): number {
  const words = text.split(" ");
  let line = "";
  let currentY = y;
  for (const word of words) {
    const testLine = line + word + " ";
    if (ctx.measureText(testLine).width > maxWidth && line !== "") {
      ctx.fillText(line, x, currentY);
      line = word + " ";
      currentY += lineHeight;
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line, x, currentY);
  return currentY;
}
