const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function seed() {
  console.log("Seeding test database for real screenshot capture...");

  // 1. Create or update test user
  const passwordHash = await bcrypt.hash("Password123!", 10);
  const user = await prisma.user.upsert({
    where: { email: "alex.artisan@sparkidea.fr" },
    update: {
      plan: "PRO",
      subscriptionStatus: "ACTIVE",
      firstName: "Alex",
    },
    create: {
      email: "alex.artisan@sparkidea.fr",
      passwordHash,
      plan: "PRO",
      subscriptionStatus: "ACTIVE",
      firstName: "Alex",
    },
  });

  // 2. Create test Idea with schema
  const schemaObj = {
    projectTitle: "DevisCraft — Devis & Factures WhatsApp pour Artisans",
    overallScore: 8.5,
    criteria: {
      market: { score: 4.5, note: "Secteur du BTP en forte numérisation, les artisans cherchent la rapidité sur leur smartphone." },
      feasibility: { score: 4.8, note: "Excellente faisabilité via l'API WhatsApp Business et un backend Next.js." },
      monetization: { score: 4.2, note: "Modèle d'abonnement SaaS récurrent à 29€/mois très accessible pour un artisan." }
    },
    nodes: [
      { id: "1", type: "todo", label: "Connecter l'API WhatsApp Business", comment: "Permettre l'envoi de devis en PDF directement par message." },
      { id: "2", type: "risk", label: "Temps de réponse du webhook WhatsApp", comment: "S'assurer de la réactivité sous 2 secondes pour ne pas perdre l'artisan." },
      { id: "3", type: "opportunity", label: "Relances automatiques d'impayés", comment: "Fonctionnalité très demandée pour augmenter la valeur perçue du SaaS." }
    ]
  };

  const idea = await prisma.idea.create({
    data: {
      userId: user.id,
      title: "DevisCraft",
      rawInput: "Un SaaS qui génère des devis et factures automatiques par WhatsApp pour les artisans du BTP",
      schemaData: JSON.stringify(schemaObj),
      finalGoal: "Obtenir 10 artisans payants à 29€/mois en 60 jours",
      finalGoalFeedback: "Objectif ambitieux mais tout à fait réalisable avec un ciblage direct.",
    }
  });

  // 3. Create Goal
  await prisma.goal.create({
    data: {
      ideaId: idea.id,
      text: "Obtenir 10 artisans payants à 29€/mois en 60 jours",
      targetMetric: "clients",
      targetValue: 10,
    }
  });

  // 4. Create Quests (Technical & Marketing)
  await prisma.quest.createMany({
    data: [
      {
        ideaId: idea.id,
        track: "technique",
        stageLabel: "Construction du MVP",
        title: "Configurer le modèle de devis PDF",
        detail: "Mets en place le composant de génération de devis au format PDF avec en-tête d'artisan, détail des prestations et calcul automatique de la TVA à 10% ou 20%.\n\nPROMPT À UTILISER AVEC TON IA :\n\"Rédige un composant React/Node.js en TypeScript qui génère un PDF de devis BTP propre avec logo, tableau des matériaux, main d'œuvre et calcul automatique de la TVA.\"",
        status: "PENDING",
        order: 0,
      },
      {
        ideaId: idea.id,
        track: "marketing",
        stageLabel: "Prospection directe",
        title: "Contacter 5 artisans locaux sur Google Maps",
        detail: "Recherche des plombiers et électriciens indépendants autour de chez toi. Propose-leur de tester gratuitement la génération de leur prochain devis sur WhatsApp.\n\nPourquoi c'est important : valider le besoin réel sur le terrain avant de dépenser du budget publicitaire.",
        status: "PENDING",
        order: 0,
      }
    ]
  });

  // 5. Create Conversation & Chat Messages
  const conv = await prisma.conversation.create({
    data: {
      ideaId: idea.id,
      title: "Stratégie de lancement WhatsApp",
    }
  });

  await prisma.chatMessage.createMany({
    data: [
      {
        conversationId: conv.id,
        role: "user",
        text: "Bonjour Alex ! Comment trouver mes 3 premiers artisans clients BTP sans budget pub ?",
      },
      {
        conversationId: conv.id,
        role: "assistant",
        text: "Salut Alex ! Pour trouver tes 3 premiers artisans sans budget pub, va directement sur les chantiers locaux ou contacte les artisans répertoriés sur Google Maps dans ta ville. Propose-leur de créer leur devis du jour gratuitement en 30 secondes directement depuis leur téléphone sur WhatsApp. L'effet 'waouh' de la rapidité fera la conversion !",
      }
    ]
  });

  console.log("Seeding complete! Test user email: alex.artisan@sparkidea.fr / password: Password123!");
}

seed().catch(console.error).finally(() => prisma.$disconnect());
