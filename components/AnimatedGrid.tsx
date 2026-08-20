"use client";

import { useEffect, useRef } from "react";

// Le même fond animé que sur toutes les maquettes validées : une grille qui
// réagit au passage de la souris. "intensity" permet la version "discrète"
// pour le dashboard vs la version "intense" pour la page d'accueil, comme
// décidé (l'animation forte fatigue sur un usage répété au quotidien).
export function AnimatedGrid({
  intensity = "intense",
}: {
  intensity?: "intense" | "discrete";
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let W = 0,
      H = 0,
      DPR = 1;
    function resize() {
      DPR = Math.min(window.devicePixelRatio || 1, 2);
      W = window.innerWidth;
      H = window.innerHeight;
      canvas!.width = W * DPR;
      canvas!.height = H * DPR;
      canvas!.style.width = W + "px";
      canvas!.style.height = H + "px";
      ctx!.setTransform(DPR, 0, 0, DPR, 0, 0);
    }
    resize();
    window.addEventListener("resize", resize);

    const mouse = { x: -9999, y: -9999, active: false };
    const onMove = (e: MouseEvent) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
      mouse.active = true;
    };
    window.addEventListener("mousemove", onMove);

    const SPACING = 50;
    const radius = intensity === "intense" ? 220 : 90;
    const maxPush = intensity === "intense" ? 55 : 10;
    const baseAlpha = intensity === "intense" ? 0.22 : 0.07;

    let t = 0;
    let raf: number;

    // Lue depuis la variable CSS --bg (thème sombre ou clair) plutôt que
    // codée en dur, pour rester cohérente si l'utilisateur bascule le thème
    // dans Paramètres sans recharger la page.
    let bgColor = getComputedStyle(document.documentElement).getPropertyValue("--bg").trim() || "#030407";
    const themeObserver = new MutationObserver(() => {
      bgColor = getComputedStyle(document.documentElement).getPropertyValue("--bg").trim() || "#030407";
    });
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

    function draw() {
      t += 1;
      ctx!.fillStyle = bgColor;
      ctx!.fillRect(0, 0, W, H);
      const cols = Math.ceil(W / SPACING) + 2;
      const rows = Math.ceil(H / SPACING) + 2;
      const pts: { x: number; y: number }[][] = [];

      for (let j = 0; j <= rows; j++) {
        const row: { x: number; y: number }[] = [];
        for (let i = 0; i <= cols; i++) {
          let x = i * SPACING - SPACING;
          let y = j * SPACING - SPACING;
          const dx = x - mouse.x,
            dy = y - mouse.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < radius && mouse.active) {
            const force = Math.pow(1 - dist / radius, 2);
            const angle = Math.atan2(dy, dx);
            x -= Math.cos(angle) * force * maxPush;
            y -= Math.sin(angle) * force * maxPush;
          }
          const wave =
            intensity === "intense"
              ? Math.sin(i * 0.4 + t * 0.01) * Math.cos(j * 0.4 + t * 0.01) * 2.5
              : 0;
          row.push({ x, y: y + wave });
        }
        pts.push(row);
      }

      ctx!.lineWidth = intensity === "intense" ? 1.2 : 0.8;
      for (let j = 0; j <= rows; j++) {
        ctx!.beginPath();
        for (let i = 0; i <= cols; i++) {
          const p = pts[j][i];
          if (i === 0) ctx!.moveTo(p.x, p.y);
          else ctx!.lineTo(p.x, p.y);
        }
        ctx!.strokeStyle = `rgba(34,211,238,${baseAlpha})`;
        ctx!.stroke();
      }
      for (let i = 0; i <= cols; i++) {
        ctx!.beginPath();
        for (let j = 0; j <= rows; j++) {
          const p = pts[j][i];
          if (j === 0) ctx!.moveTo(p.x, p.y);
          else ctx!.lineTo(p.x, p.y);
        }
        ctx!.strokeStyle = `rgba(168,85,247,${baseAlpha * 0.85})`;
        ctx!.stroke();
      }

      raf = requestAnimationFrame(draw);
    }
    draw();

    return () => {
      cancelAnimationFrame(raf);
      themeObserver.disconnect();
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMove);
    };
  }, [intensity]);

  return (
    <canvas
      ref={canvasRef}
      style={{ position: "fixed", top: 0, left: 0, zIndex: 0 }}
    />
  );
}
