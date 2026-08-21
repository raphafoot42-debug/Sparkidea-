"use client";

import { useEffect, useState } from "react";

// Petit effet "verdict qui tombe" : le score compte de 0 jusqu'à sa valeur
// réelle en ~800ms au lieu d'apparaître figé. Purement visuel, la valeur
// finale affichée est toujours la vraie (schema.overallScore), jamais
// modifiée par l'animation elle-même.
export function AnimatedScore({ value }: { value: number }) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const duration = 800;
    const start = performance.now(); 

    function tick(now: number) {
      const progress = Math.min(1, (now - start) / duration);
      // Easing simple (ease-out) pour un rendu plus naturel qu'un compte linéaire.
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(value * eased * 10) / 10);
      if (progress < 1) requestAnimationFrame(tick);
    }

    const frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);

  return <>{display.toFixed(1)}</>;
}
