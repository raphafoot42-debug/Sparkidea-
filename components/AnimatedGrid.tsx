"use client";

// Fond de page — grille statique, très discrète, sans aucune interaction.
// Avant : un canvas qui redessinait à chaque frame et se déformait au
// passage de la souris. Décidé avec Raphaël : c'est le genre d'effet qui
// impressionne cinq secondes puis fatigue à l'usage quotidien, et qui ne
// fait pas sérieux sur un outil payant. Une grille immobile, en arrière-plan,
// garde l'identité visuelle sans jamais attirer l'œil.
//
// "intensity" est conservée (les 14 pages qui utilisent ce composant n'ont
// rien à changer) mais ne pilote plus qu'une opacité très légèrement
// différente entre la page d'accueil et le reste de l'app.
export function AnimatedGrid({
  intensity = "intense",
}: {
  intensity?: "intense" | "discrete";
}) {
  const opacity = intensity === "intense" ? 0.05 : 0.03;
  const spacing = 50;

  return (
    <div
      aria-hidden
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 0,
        pointerEvents: "none",
        backgroundImage: `
          linear-gradient(rgba(34,211,238,${opacity}) 1px, transparent 1px),
          linear-gradient(90deg, rgba(168,85,247,${opacity}) 1px, transparent 1px)
        `,
        backgroundSize: `${spacing}px ${spacing}px`,
      }}
    />
  );
}
