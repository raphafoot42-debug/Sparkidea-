// GET  /api/db  -> renvoie { db } (données publiques filtrées si non authentifié, ou DB complète si x-api-key valide)
// POST /api/db  -> enregistre la base complète dans Supabase (nécessite x-api-key valide)

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const ADMIN_API_KEY = process.env.ADMIN_API_KEY || "";

function sanitizeDbForPublic(db) {
  if (!db || typeof db !== "object") return {};
  return {
    mainTrackingLink: db.mainTrackingLink || "",
    referralPercent: db.referralPercent || 10,
    defaultBaseLink: db.defaultBaseLink || "",
    defaultBaseLinkLabel: db.defaultBaseLinkLabel || "Signup",
    defaultCommissionPerFtd: db.defaultCommissionPerFtd || 20,
    allowSelfSignup: db.allowSelfSignup !== undefined ? db.allowSelfSignup : true,
    memberLinks: db.memberLinks || [],
    rewardTiers: db.rewardTiers || [],
    // Répertoire public des affiliés (SANS code d'accès/mot de passe, SANS RIB/IBAN, SANS messages privés)
    affiliates: Array.isArray(db.affiliates)
      ? db.affiliates.map(a => ({
          id: a.id,
          name: a.name,
          status: a.status || "active",
          ownerChiefId: a.ownerChiefId || null,
          commissionPerFtd: a.commissionPerFtd || 20,
          dailyStats: a.dailyStats || []
        }))
      : [],
    // Répertoire public des chefs (SANS mot de passe)
    chiefs: Array.isArray(db.chiefs)
      ? db.chiefs.map(c => ({
          id: c.id,
          name: c.name,
          recruitPercent: c.recruitPercent || 10,
          defaultCommissionPerFtd: c.defaultCommissionPerFtd || 20
        }))
      : []
  };
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-api-key");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(500).json({ error: "Supabase non configuré (variables manquantes)." });
  }

  const headers = {
    apikey: SUPABASE_SERVICE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
    "Content-Type": "application/json"
  };

  const key = req.headers["x-api-key"] || "";
  const isAuthenticated = Boolean(ADMIN_API_KEY && key === ADMIN_API_KEY);

  if (req.method === "GET") {
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/app_db?id=eq.1&select=data`, { headers });
      const rows = await r.json();
      let db = Array.isArray(rows) && rows[0] ? rows[0].data : null;
      if (db && !isAuthenticated) {
        db = sanitizeDbForPublic(db);
      }
      return res.status(200).json({ db });
    } catch (e) {
      return res.status(500).json({ error: "Erreur de lecture." });
    }
  }

  if (req.method === "POST") {
    if (!isAuthenticated) {
      return res.status(401).json({ error: "Clé API invalide ou manquante." });
    }
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/app_db`, {
        method: "POST",
        headers: { ...headers, Prefer: "resolution=merge-duplicates" },
        body: JSON.stringify([{ id: 1, data: req.body, updated_at: new Date().toISOString() }])
      });
      if (!r.ok) {
        const errText = await r.text();
        return res.status(500).json({ error: "Erreur Supabase : " + errText });
      }
      return res.status(200).json({ ok: true });
    } catch (e) {
      return res.status(500).json({ error: "Erreur d'écriture." });
    }
  }

  res.status(405).end();
}
