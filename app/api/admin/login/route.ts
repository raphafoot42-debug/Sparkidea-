import { NextRequest, NextResponse } from "next/server";
import { createAdminSession } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const { code } = await req.json().catch(() => ({}));

  const adminCode = process.env.ADMIN_CODE;
  if (!adminCode) {
    return NextResponse.json({ error: "ADMIN_CODE non configuré." }, { status: 500 });
  }

  if (!code || code !== adminCode) {
    // Délai pour ralentir le bruteforce 
    await new Promise((r) => setTimeout(r, 600));
    return NextResponse.json({ error: "Code incorrect." }, { status: 401 });
  }

  await createAdminSession();
  return NextResponse.json({ ok: true });
}
