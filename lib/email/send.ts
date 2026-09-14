import nodemailer from "nodemailer";

// -----------------------------------------------------------------------
// SOLUTION TEMPORAIRE — à retirer dès qu'un vrai domaine est vérifié sur
// Resend. Sans domaine, Resend ne peut envoyer qu'à l'adresse du compte
// Resend lui-même (restriction anti-abus de leur part, pas un choix de
// notre côté) — inutilisable pour de vrais clients. En attendant, on
// envoie via un compte Gmail classique (SMTP), qui accepte n'importe quel
// destinataire.
//
// Limites réelles à connaître tant qu'on est sur ce mode :
// - Environ 500 emails/jour maximum (limite Gmail, pas la nôtre)
// - L'email peut afficher "via gmail.com" selon le client mail du
//   destinataire — moins pro qu'un vrai domaine, mais fonctionnel
// - Gmail peut bloquer temporairement si le volume ressemble à du spam
//
// QUAND LE DOMAINE SERA PRÊT : remplacer le contenu de sendEmail()
// ci-dessous par un appel à resend.emails.send(...) (voir lib/email/resend.ts,
// déjà en place et inchangé) — aucun autre fichier de l'app n'a besoin
// d'être modifié, ils appellent tous sendEmail() sans savoir comment
// l'email part réellement.
// -----------------------------------------------------------------------

const gmailTransport = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,
    // Un "mot de passe d'application" Gmail, pas le mot de passe du compte —
    // à générer sur https://myaccount.google.com/apppasswords (nécessite la
    // validation en 2 étapes activée sur le compte Google).
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}) {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    console.error(
      "[sendEmail] GMAIL_USER ou GMAIL_APP_PASSWORD absent — email non envoyé. Configure ces variables sur Vercel."
    );
    throw new Error("Configuration email manquante.");
  }

  await gmailTransport.sendMail({
    from: `Spark Idea <${process.env.GMAIL_USER}>`,
    to,
    subject,
    html,
  });
}
