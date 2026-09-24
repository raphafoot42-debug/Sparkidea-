/**
 * Helper serveur pour communiquer avec l'API / Webhook Affitor côté serveur
 */
export async function trackAffitorSignup(data: {
  customerKey: string; // ID utilisateur unique de Spark Idea (user.id)
  email: string;
  clickId?: string;
}) {
  const programId = process.env.AFFITOR_PROGRAM_ID || "MON_PROGRAM_ID_AFFITOR";
  const apiKey = process.env.AFFITOR_API_KEY;

  if (!apiKey) {
    console.log(
      `[Affitor] Tracking inscription pour user=${data.customerKey} (${data.email}), clickId=${data.clickId || "aucun"}`
    );
    return;
  }

  try {
    const res = await fetch("https://api.affitor.com/v1/signups", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        program_id: programId,
        affitor_customer_key: data.customerKey,
        email: data.email,
        affitor_click_id: data.clickId || undefined,
      }),
    });

    if (!res.ok) {
      console.error(`[Affitor] Erreur API signup (${res.status}):`, await res.text());
    }
  } catch (err) {
    console.error("[Affitor] Échec de l'envoi du signup à Affitor :", err);
  }
}
