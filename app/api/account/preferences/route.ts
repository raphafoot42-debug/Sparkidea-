import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db"; 

const BodySchema = z.object({ 
  theme: z.enum(["dark", "light"]).optional(),
  language: z.enum(["fr", "en", "ja", "ru"]).optional(),
});

export async function POST(req: NextRequest) {
  let user;
  try {
    user = await requireUser();
  } catch {
    return NextResponse.json({ error: "Non connecté." }, { status: 401 });
  }

  const json = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  await db.user.update({
    where: { id: user.id },
    data: {
      ...(parsed.data.theme ? { theme: parsed.data.theme } : {}),
      ...(parsed.data.language ? { language: parsed.data.language } : {}),
    },
  });

  return NextResponse.json({ ok: true });
}
