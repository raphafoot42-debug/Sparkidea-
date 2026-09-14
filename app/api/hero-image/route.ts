import { NextResponse } from "next/server";
import { searchIllustrationImage } from "@/lib/images";

// Image d'illustration fixe pour la landing page — pas de projet encore
// défini à ce stade, donc pas de mot-clé personnalisé possible. Mise en
// cache 24h côté CDN Vercel (revalidate) : pas besoin de rappeler Pexels
// à chaque visite pour une image qui ne change jamais dans la journée.
export const revalidate = 86400;

export async function GET() {
  const url = await searchIllustrationImage("startup entrepreneur launching idea");
  return NextResponse.json({ url });
}
