// Recherche d'image d'illustration via Pexels (gratuit, sans validation
// compliquée contrairement à d'autres banques d'images). Utilisé pour
// donner un visage visuel concret au schéma généré — avant, tout était
// uniquement du texte, ce qui pouvait donner une impression de "vite
// fait" à un client qui découvre le produit.
//
// Nécessite la variable d'environnement PEXELS_API_KEY (clé gratuite sur
// https://www.pexels.com/api/, aucune carte bancaire demandée).
//
// Comportement en cas d'absence de clé ou d'échec : retourne null plutôt
// que de faire planter la génération du schéma — une image manquante ne
// doit jamais empêcher le client d'obtenir son plan.
export async function searchIllustrationImage(query: string): Promise<string | null> {
  const apiKey = process.env.PEXELS_API_KEY;
  if (!apiKey) return null;

  try {
    const res = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=1&orientation=landscape`,
      { headers: { Authorization: apiKey } }
    );
    if (!res.ok) {
      console.error(`[searchIllustrationImage] Pexels a répondu ${res.status} pour "${query}"`);
      return null;
    }
    const data = await res.json();
    const photo = data.photos?.[0];
    // "medium" est un bon compromis poids/qualité pour une vignette de nœud.
    return photo?.src?.medium ?? null;
  } catch (err) {
    console.error(`[searchIllustrationImage] Échec de la recherche pour "${query}" :`, err);
    return null;
  }
}
