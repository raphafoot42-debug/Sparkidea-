// GET /api/stats/:code -> renvoie { dailyStats: [...] } pour un affilié
// donné, lu depuis Supabase (table postback_daily_stats). Utilisé par le
// bouton "Synchroniser" côté admin/membre. Nécessite le header x-api-key.

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const ADMIN_API_KEY = process.env.ADMIN_API_KEY || "";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-api-key");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).end();

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(500).json({ error: "Supabase non configuré (variables manquantes)." });
  }

  const key = req.headers["x-api-key"] || "";
  if (!ADMIN_API_KEY || key !== ADMIN_API_KEY) {
    return res.status(401).json({ error: "Clé API invalide ou manquante." });
  }

  const { code } = req.query;
  if (!code) return res.status(400).json({ error: "code manquant." });

  try {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/postback_daily_stats?code=eq.${encodeURIComponent(code)}&order=date.asc`,
      { headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` } }
    );
    const rows = await r.json();
    const dailyStats = (Array.isArray(rows) ? rows : []).map(row => ({
      date: row.date,
      clicks: row.clicks || 0,
      signups: row.signups || 0,
      ftd: row.ftd || 0,
      deposits: Number(row.deposits) || 0,
      revenue: Number(row.revenue) || 0
    }));
    return res.status(200).json({ dailyStats });
  } catch (e) {
    return res.status(500).json({ error: "Erreur de lecture." });
  }
}
