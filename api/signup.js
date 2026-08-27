// POST /api/signup -> crée une demande d'inscription en attente de
// validation par l'admin/sous-chef (utilisé par le lien de parrainage),
// stockée dans la même table Supabase app_db (colonne data, clé pendingSignups).

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

function headers() {
  return {
    apikey: SUPABASE_SERVICE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
    "Content-Type": "application/json"
  };
}
async function readDb() {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/app_db?id=eq.1&select=data`, { headers: headers() });
  const rows = await r.json();
  return Array.isArray(rows) && rows[0] ? rows[0].data : {};
}
async function writeDb(db) {
  await fetch(`${SUPABASE_URL}/rest/v1/app_db`, {
    method: "POST",
    headers: { ...headers(), Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify([{ id: 1, data: db, updated_at: new Date().toISOString() }])
  });
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-api-key");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).end();

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(500).json({ error: "Supabase non configuré (variables manquantes)." });
  }

  const { name, code, ref } = req.body || {};
  if (!name || !code) {
    return res.status(400).json({ error: "Nom et code obligatoires." });
  }

  try {
    const db = await readDb();
    db.pendingSignups = db.pendingSignups || [];
    db.affiliates = db.affiliates || [];
    const exists =
      db.affiliates.some(a => (a.code || "").toLowerCase() === code.toLowerCase()) ||
      db.pendingSignups.some(p => (p.code || "").toLowerCase() === code.toLowerCase());
    if (exists) {
      return res.status(400).json({ error: "Ce code d'accès est déjà pris." });
    }
    const request = {
      id: "req_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
      name,
      code,
      ref: ref || "",
      requestedAt: new Date().toISOString()
    };
    db.pendingSignups.unshift(request);
    await writeDb(db);
    return res.status(200).json({ request });
  } catch (e) {
    return res.status(500).json({ error: "Erreur serveur." });
  }
}
