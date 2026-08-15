import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, hashPassword, verifyPassword } from "@/lib/auth";
import { db } from "@/lib/db";

// On exige TOUJOURS le mot de passe actuel pour changer l'email ou le mot de
// passe — même connecté, sans ça n'importe qui avec une session ouverte sur
// un ordinateur partagé pourrait détourner le compte.
const BodySchema = z
  .object({
    currentPassword: z.string().min(1, "Mot de passe actuel requis."),
    newEmail: z.string().email("Email invalide.").optional(),
    newPassword: z.string().min(8, "8 caractères minimum.").optional(),
  })
  .refine((d) => d.newEmail || d.newPassword, {
    message: "Rien à changer.",
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
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Requête invalide." },
      { status: 400 }
    );
  }

  const ok = await verifyPassword(parsed.data.currentPassword, user.passwordHash);
  if (!ok) {
    return NextResponse.json({ error: "Mot de passe actuel incorrect." }, { status: 401 });
  }

  const data: { email?: string; passwordHash?: string } = {};

  if (parsed.data.newEmail && parsed.data.newEmail !== user.email) {
    const existing = await db.user.findUnique({ where: { email: parsed.data.newEmail } });
    if (existing) {
      return NextResponse.json({ error: "Cet email est déjà utilisé." }, { status: 409 });
    }
    data.email = parsed.data.newEmail;
  }

  if (parsed.data.newPassword) {
    data.passwordHash = await hashPassword(parsed.data.newPassword);
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ ok: true }); // rien à changer réellement (ex: même email)
  }

  await db.user.update({ where: { id: user.id }, data });

  return NextResponse.json({ ok: true, email: data.email ?? user.email });
}
