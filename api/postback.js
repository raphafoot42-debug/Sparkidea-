// GET/POST /api/postback -> reçoit les postbacks du réseau d'affiliation
// (register, ftd, deposit, cpa, ngr) et met à jour postback_daily_stats
// dans Supabase. Nécessite ?key=... = POSTBACK_API_KEY (variable d'env Vercel).

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const POSTBACK_API_KEY = process.env.POSTBACK_API_KEY || "";
const VALID_TYPES = ["register", "ftd", "deposit", "cpa", "ngr"];

function headers() {
  return {
    apikey: SUPABASE_SERVICE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
    "Content-Type": "application/json"
  };
}
function pick(obj, names) {
  for (const n of names) {
    if (obj[n] !== undefined && obj[n] !== null && obj[n] !== "") return obj[n];
  }
  return undefined;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(500).json({ error: "Supabase non configuré (variables manquantes)." });
  }

  // BlueAffiliates appelle en GET (query string) le plus souvent, parfois en POST.
  const params = { ...(req.query || {}), ...(req.body || {}) };

  const key = pick(params, ["key", "apikey", "api_key"]);
  if (!key || key !== POSTBACK_API_KEY) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const type = String(pick(params, ["type"]) || "").toLowerCase();
  if (!VALID_TYPES.includes(type)) {
    return res.status(400).json({ error: "type invalide (register, ftd, deposit, cpa, ngr)" });
  }

  // Le code affilié Lexora est transmis par le réseau via son macro de tracking
  // (souvent {subid} / {click_id} / {aff_id} selon la plateforme).
  const code = pick(params, ["code", "subid", "sub_id", "affid", "aff_id", "clickid", "click_id"]);
  if (!code) return res.status(400).json({ error: "code (identifiant affilié) manquant" });

  const amount = Number(pick(params, ["amount", "sum", "value", "ngr_amount", "cpa_amount"])) || 0;
  const today = new Date().toISOString().slice(0, 10);

  try {
    // Log brut, utile pour debug/litiges avec le casino
    await fetch(`${SUPABASE_URL}/rest/v1/postback_log`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify([{
        code: String(code),
        type,
        amount,
        raw: params,
        received_at: new Date().toISOString()
      }])
    });

    const readRes = await fetch(
      `${SUPABASE_URL}/rest/v1/postback_daily_stats?code=eq.${encodeURIComponent(code)}&date=eq.${today}&select=*`,
      { headers: headers() }
    );
    const existingRows = await readRes.json();
    const row = (Array.isArray(existingRows) && existingRows[0]) || {
      code: String(code), date: today, clicks: 0, signups: 0, ftd: 0, deposits: 0, revenue: 0
    };

    if (type === "register") row.signups = (row.signups || 0) + 1;
    if (type === "ftd") {
      row.ftd = (row.ftd || 0) + 1;
      row.deposits = (row.deposits || 0) + amount;
      row.revenue = (row.revenue || 0) + amount;
    }
    if (type === "deposit") {
      row.deposits = (row.deposits || 0) + amount;
      row.revenue = (row.revenue || 0) + amount;
    }
    if (type === "cpa") row.revenue = (row.revenue || 0) + amount;
    if (type === "ngr") row.revenue = (row.revenue || 0) + amount;

    const writeRes = await fetch(`${SUPABASE_URL}/rest/v1/postback_daily_stats?on_conflict=code,date`, {
      method: "POST",
      headers: { ...headers(), Prefer: "resolution=merge-duplicates" },
      body: JSON.stringify([{ ...row, updated_at: new Date().toISOString() }])
    });

    if (!writeRes.ok) {
      const errText = await writeRes.text();
      return res.status(500).json({ error: "Erreur Supabase : " + errText });
    }

    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: "Erreur serveur." });
  }
}
