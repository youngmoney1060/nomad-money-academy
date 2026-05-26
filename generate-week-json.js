import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const MODEL = 'claude-sonnet-4-20250514';
const WEEK = parseInt(process.argv[2] || '1', 10);

const SYSTEM_PROMPT = `Tu es un expert en entrepreneuriat et liberté financière qui crée du contenu pour MoneyFlow (moneyflowcompany.netlify.app).

MoneyFlow propose 3 plans :
- Starter (0€) : Pour découvrir et démarrer
- Pro (29€/mois) : Pour accélérer sa croissance
- Expert (99€/mois) : Pour les entrepreneurs ambitieux

Contenu toujours : motivant sans être irréaliste, concret avec chiffres précis, accessible aux débutants, en français courant et direct, honnête sur délais et efforts.

RÈGLE ABSOLUE : Tu réponds UNIQUEMENT en JSON valide. Aucun texte avant ou après. Aucun bloc markdown. Aucune balise. Juste le JSON brut, parseable directement.`;

async function generateSection(userPrompt, label) {
  console.log(`\n📝 ${label}`);
  let raw = '';

  const stream = client.messages.stream({
    model: MODEL,
    max_tokens: 4096,
    system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: userPrompt }],
  });

  process.stdout.write('   ');
  for await (const event of stream) {
    if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
      raw += event.delta.text;
      process.stdout.write('▪');
    }
  }

  const final = await stream.finalMessage();
  const u = final.usage;
  console.log(
    ` ✓  (${u.input_tokens} in / ${u.output_tokens} out` +
    (u.cache_read_input_tokens ? ` / ${u.cache_read_input_tokens} cache` : '') + ')'
  );

  // Strip accidental markdown fences
  let cleaned = raw.trim();
  if (cleaned.startsWith('```')) cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();

  return JSON.parse(cleaned);
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('❌ ANTHROPIC_API_KEY manquante.');
    process.exit(1);
  }

  const outputDir = path.join(__dirname, 'content', `semaine-${WEEK}`);
  fs.mkdirSync(outputDir, { recursive: true });

  console.log('\n╔══════════════════════════════════════════════════╗');
  console.log(`║   MoneyFlow — JSON Semaine ${String(WEEK).padEnd(21)}║`);
  console.log('╚══════════════════════════════════════════════════╝');
  console.log(`🤖 Modèle : ${MODEL}`);
  console.log(`📁 Sortie : content/semaine-${WEEK}/semaine-${WEEK}.json`);

  // ── 1. TÉMOIGNAGE ────────────────────────────────────────────────────────────
  const temoignage = await generateSection(
    `Génère un témoignage authentique d'entrepreneur pour MoneyFlow — méthode "freelance design ou dropshipping Shopify".

Retourne ce JSON (et rien d'autre) :
{
  "prenom": "prénom français",
  "age": 28,
  "ville": "ville française",
  "methode": "freelance design" | "dropshipping Shopify",
  "titre_court": "accroche percutante en 1 ligne avec chiffre",
  "avatar_initiales": "2 lettres pour l'avatar (ex: ML)",
  "parcours": {
    "avant": "situation de départ, 2-3 phrases humaines et concrètes",
    "pendant": "les 3 premières actions prises + une difficulté réelle rencontrée",
    "resultat": "résultat à 6 mois + changement concret dans sa vie quotidienne"
  },
  "revenus_progressifs": [
    {"mois": 1, "revenus": 320, "commentaire": "explication courte"},
    {"mois": 2, "revenus": 890, "commentaire": ""},
    {"mois": 3, "revenus": 1650, "commentaire": ""},
    {"mois": 4, "revenus": 2400, "commentaire": ""},
    {"mois": 5, "revenus": 3200, "commentaire": ""},
    {"mois": 6, "revenus": 4100, "commentaire": ""}
  ],
  "plan_moneyflow": "Starter" | "Pro" | "Expert",
  "pourquoi_plan": "1 phrase explication",
  "citation": "sa citation la plus authentique, à la 1ère personne, sans jargon marketing"
}

Critères impératifs :
- Revenus du mois 1 entre 200 et 600€ (pas de démarrage miraculeux)
- Progression crédible et irrégulière (pas linéaire)
- Ton humain, quelques doutes mentionnés, pas de success story parfaite`,
    'Témoignage entrepreneur'
  );

  // ── 2. FORMATION ─────────────────────────────────────────────────────────────
  const formation = await generateSection(
    `Génère un article de formation "Freelance" (design ou dev web) pour débutants complets — MoneyFlow Semaine 1.

Retourne ce JSON (et rien d'autre) :
{
  "titre": "titre accrocheur avec chiffre ou résultat (ex: Comment gagner vos 1000 premiers euros en freelance en 30 jours)",
  "sous_titre": "sous-titre explicatif en 1 ligne",
  "introduction": "3-4 phrases motivantes et concrètes pour accrocher le lecteur",
  "etapes": [
    {
      "numero": 1,
      "titre": "titre de l'étape",
      "description": "3-4 phrases concrètes, avec détails pratiques",
      "action_immediate": "UNE action à faire aujourd'hui, commence par un verbe d'action"
    },
    {"numero": 2, "titre": "", "description": "", "action_immediate": ""},
    {"numero": 3, "titre": "", "description": "", "action_immediate": ""},
    {"numero": 4, "titre": "", "description": "", "action_immediate": ""},
    {"numero": 5, "titre": "", "description": "", "action_immediate": ""}
  ],
  "outils_recommandes": [
    {
      "nom": "Malt",
      "url": "https://www.malt.fr",
      "prix": "gratuit (commission 10%)",
      "usage": "plateforme n°1 pour trouver des clients freelance en France"
    },
    {"nom": "", "url": "", "prix": "", "usage": ""},
    {"nom": "", "url": "", "prix": "", "usage": ""},
    {"nom": "", "url": "", "prix": "", "usage": ""},
    {"nom": "", "url": "", "prix": "", "usage": ""},
    {"nom": "", "url": "", "prix": "", "usage": ""}
  ],
  "erreurs_courantes": [
    {
      "erreur": "description précise de l'erreur (pas vague)",
      "consequence": "ce qui arrive concrètement",
      "solution": "comment corriger, avec exemple"
    },
    {"erreur": "", "consequence": "", "solution": ""},
    {"erreur": "", "consequence": "", "solution": ""}
  ],
  "resultat_attendu": {
    "semaine_4": "objectif réaliste à 4 semaines",
    "mois_3": "objectif réaliste à 3 mois",
    "mois_6": "objectif réaliste à 6 mois avec chiffres"
  },
  "cta_moneyflow": "appel à l'action naturel (1-2 phrases) vers le plan Pro ou Expert"
}

Règles : URLs réelles et vérifiables. 6 outils différents (Malt obligatoire). Erreurs spécifiques au freelance débutant, pas génériques.`,
    'Article formation freelance'
  );

  // ── 3. GUIDE DIGITAL NOMADE ─ Lisbonne ───────────────────────────────────────
  const guide = await generateSection(
    `Génère un guide pratique et complet pour digital nomades à Lisbonne (Portugal) — MoneyFlow Semaine 1.

Retourne ce JSON (et rien d'autre) :
{
  "destination": "Lisbonne (Portugal)",
  "pays_code": "PT",
  "introduction": "2-3 phrases sur pourquoi Lisbonne attire les nomades français",
  "budget_mensuel": {
    "logement": {"budget_serre": 600, "budget_confort": 950, "budget_premium": 1600, "notes": "types de logements correspondants"},
    "nourriture": {"budget_serre": 250, "budget_confort": 400, "budget_premium": 650, "notes": "habitudes correspondantes"},
    "coworking": {"budget_serre": 80, "budget_confort": 150, "budget_premium": 250, "notes": "options disponibles"},
    "transport": {"budget_serre": 30, "budget_confort": 60, "budget_premium": 120, "notes": "moyens utilisés"},
    "loisirs_sorties": {"budget_serre": 80, "budget_confort": 180, "budget_premium": 350},
    "sante_divers": {"budget_serre": 60, "budget_confort": 100, "budget_premium": 180},
    "totaux": {"budget_serre": 0, "budget_confort": 0, "budget_premium": 0}
  },
  "meilleurs_quartiers": [
    {
      "nom": "nom du quartier",
      "ambiance": "description courte de l'ambiance",
      "avantages_nomade": "pourquoi c'est bien pour travailler",
      "prix_chambre_studio": "fourchette mensuelle en €"
    }
  ],
  "espaces_coworking": [
    {
      "nom": "nom réel de l'espace",
      "prix_journee": 15,
      "prix_mois": 180,
      "quartier": "nom du quartier",
      "point_fort": "ce qui le distingue des autres"
    }
  ],
  "communaute_nomades": {
    "description": "2-3 phrases sur la scène nomade locale",
    "evenements_reguliers": ["type d'événements qu'on trouve facilement"],
    "ressources_en_ligne": ["groupes Facebook, Discord, Meetup pertinents"]
  },
  "visa_et_legalite": {
    "citoyen_ue": "durée séjour illimitée, droits résidence",
    "visa_nomade_digital": {
      "nom_officiel": "Visto D8 — Visa de Nómade Digital",
      "revenu_minimum_mensuel": 3480,
      "cout_demande": "€83 à l'ambassade + frais",
      "duree_initiale": "1 an renouvelable",
      "avantage_fiscal": "statut RNH (Résident Non Habituel) — imposition à 20% flat"
    },
    "conseils_pratiques": [
      "conseil 1 concret pour un Français qui s'installe",
      "conseil 2",
      "conseil 3"
    ]
  },
  "internet": {
    "vitesse_moyenne_mbps": 100,
    "operateur_recommande": "NOS ou MEO",
    "sim_touriste": "NOS 15€/15 jours — 25 Go"
  },
  "temoignage_nomade": {
    "prenom": "prénom",
    "activite": "son activité en ligne",
    "duree_lisbonne": "depuis X mois/ans",
    "revenu_mensuel_net": 3200,
    "coup_de_coeur_local": "ce qu'il/elle recommande absolument"
  }
}

Calcule les totaux budget_mensuel.totaux en additionnant les 6 postes pour chaque niveau. Utilise des chiffres réels actualisés 2024-2025.`,
    'Guide Digital Nomade — Lisbonne'
  );

  // Recalcul des totaux si Claude ne l'a pas fait correctement
  for (const niveau of ['budget_serre', 'budget_confort', 'budget_premium']) {
    const postes = ['logement', 'nourriture', 'coworking', 'transport', 'loisirs_sorties', 'sante_divers'];
    guide.budget_mensuel.totaux[niveau] = postes.reduce(
      (sum, p) => sum + (guide.budget_mensuel[p]?.[niveau] || 0), 0
    );
  }

  // ── 4. NEWSLETTER HTML ────────────────────────────────────────────────────────
  const newsletter = await generateSection(
    `Génère une newsletter HTML complète pour MoneyFlow — Semaine 1 (thème : Freelance + Lisbonne).

Retourne ce JSON (et rien d'autre) :
{
  "objet_email": "objet accrocheur max 60 caractères, minuscules naturels, pas de spam words",
  "preheader": "texte preheader max 90 caractères qui complète l'objet",
  "sections": {
    "astuce": {
      "titre": "titre court",
      "contenu": "astuce freelance/business actionnable en 5 minutes, 3-4 phrases concrètes"
    },
    "success_story": {
      "titre": "titre court",
      "prenom_ville": "Prénom, Ville",
      "contenu": "résumé inspirant du témoignage de la semaine, 3-4 phrases avec chiffres"
    },
    "ressource_gratuite": {
      "titre": "titre court",
      "description": "description de la ressource gratuite (template, guide, outil), 2-3 phrases",
      "lien_texte": "texte du lien (ex: Télécharger gratuitement →)",
      "lien_url": "https://moneyflowcompany.netlify.app"
    }
  },
  "html": "CODE HTML COMPLET ICI"
}

Specs HTML :
- HTML5 complet : DOCTYPE, head, meta charset=UTF-8, meta viewport
- CSS 100% inline (zéro balise <style>) — obligatoire pour compatibilité email
- max-width 600px, centré, fond général #0f0f1a
- Palette : #0f0f1a (fond), #1a1a2e (cards), #f0a500 (doré/CTA), #00c896 (vert succès), #ffffff (texte), #a0a0b0 (texte secondaire)
- Police : Arial, Helvetica, sans-serif uniquement

Structure du HTML :
1. Header : "💰 MoneyFlow" + "Semaine 1 • Freelance & Lisbonne"
2. Section Astuce (fond #1a1a2e, bordure gauche dorée)
3. Section Success Story (fond #1a1a2e, badge vert)
4. Section Ressource Gratuite (fond #1a1a2e)
5. Bloc CTA : plan Pro 29€/mois — bouton doré → moneyflowcompany.netlify.app
6. Footer : liens site/blog/contact + lien désabonnement en gris

Le HTML doit être prêt à copier-coller dans Mailchimp ou Brevo sans aucune modification.`,
    'Newsletter HTML'
  );

  // ── ASSEMBLAGE FINAL ──────────────────────────────────────────────────────────
  const output = {
    meta: {
      semaine: WEEK,
      theme_principal: 'freelance',
      destination_nomade: 'Lisbonne (Portugal)',
      date_generation: new Date().toISOString().split('T')[0],
      modele: MODEL,
      plateforme: 'MoneyFlow',
      url_site: 'https://moneyflowcompany.netlify.app',
    },
    temoignage,
    formation,
    guide_digital_nomade: guide,
    newsletter,
  };

  const outputPath = path.join(outputDir, `semaine-${WEEK}.json`);
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2), 'utf-8');

  // Écrire aussi la newsletter HTML en fichier séparé
  if (newsletter.html) {
    fs.writeFileSync(
      path.join(outputDir, 'newsletter.html'),
      newsletter.html,
      'utf-8'
    );
    console.log(`   📄 newsletter.html extrait séparément`);
  }

  const sizeKo = (fs.statSync(outputPath).size / 1024).toFixed(1);
  console.log('\n╔══════════════════════════════════════════════════╗');
  console.log('║   ✅ Génération JSON terminée !                 ║');
  console.log('╚══════════════════════════════════════════════════╝');
  console.log(`\n📂 Fichiers créés dans content/semaine-${WEEK}/ :`);
  console.log(`   📄 semaine-${WEEK}.json  (${sizeKo} Ko) — données complètes`);
  console.log(`   📄 newsletter.html      — prête à envoyer`);
  console.log(`\n💡 Prochain : node generate-week-json.js ${WEEK + 1}\n`);
}

main().catch((err) => {
  console.error('\n❌ Erreur :', err.message);
  if (err.message.includes('JSON') || err instanceof SyntaxError) {
    console.error('   → La réponse Claude n\'était pas du JSON valide. Relancez.');
  }
  process.exit(1);
});
