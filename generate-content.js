import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── Load weekly themes ────────────────────────────────────────────────────────
const themes = JSON.parse(fs.readFileSync(path.join(__dirname, 'themes.json'), 'utf-8'));
const { semaine, themes: t } = themes;

// ── Shared system prompt ──────────────────────────────────────────────────────
const SYSTEM = `Tu génères du contenu HTML premium pour Nomad Money Academy (nomadmoneyacademy.com), une plateforme française à 29€/99€ par mois pour jeunes actifs qui veulent vivre nomades et libres financièrement.

Règles absolues :
- Génère uniquement du HTML valide, sans balises html/head/body, sans code fences markdown
- Style direct, informatif, précis — chiffres concrets, pas de bullshit
- Tous les liens externes ont target="_blank" rel="noopener"
- Indentation : 8 espaces pour les éléments de premier niveau dans le panel

Classes CSS disponibles (utilise exactement ces noms) :
  content-week-tag            → petit badge semaine en haut
  content-title               → <h1> principal
  content-sub                 → <p> sous-titre
  content-grid-3 / content-grid-2  → grilles responsive
  stat-card → stat-card__val + stat-card__label  → chiffres clés
  content-section-label       → titre de section
  content-body > <p>          → paragraphes texte
  content-card → content-card__tag [+ --orange] + content-card__title + content-card__body
  link-item → span.link-item__desc + <a>  → ligne ressource
  content-divider             → <hr>

Format embed YouTube (obligatoire pour les panels avec vidéo) :
<div style="position:relative;padding-bottom:56.25%;height:0;overflow:hidden;border-radius:12px;margin-bottom:32px;border:1px solid var(--border)">
  <iframe src="https://www.youtube.com/embed/VIDEO_ID" style="position:absolute;top:0;left:0;width:100%;height:100%;border:0" allowfullscreen loading="lazy" title="..."></iframe>
</div>`;

// ── Claude API call ───────────────────────────────────────────────────────────
async function generate(prompt) {
  let content = '';
  process.stdout.write('  ');
  const stream = client.messages.stream({
    model: 'claude-opus-4-7',
    max_tokens: 3500,
    system: SYSTEM,
    messages: [{ role: 'user', content: prompt }],
  });
  for await (const event of stream) {
    if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
      content += event.delta.text;
      process.stdout.write('▪');
    }
  }
  const msg = await stream.finalMessage();
  console.log(` ✓ (${msg.usage.input_tokens}in / ${msg.usage.output_tokens}out)`);
  return content.trim();
}

// ── Panel prompts ─────────────────────────────────────────────────────────────
const prompts = {
  crypto() {
    const { actif, angle, prix_actuel } = t.crypto;
    return `Génère le contenu HTML complet pour le panel CRYPTO — Semaine ${semaine}.

DONNÉES DE LA SEMAINE :
- Actif : ${actif}
- Angle éditorial : ${angle}
- Prix actuel : ${prix_actuel}

STRUCTURE ATTENDUE (dans cet ordre) :
1. <div class="content-week-tag">Analyse Crypto — Semaine ${semaine}</div>
2. <h1 class="content-title">${actif}</h1>
3. <p class="content-sub"> — 1-2 phrases sur le contexte et l'opportunité de la semaine
4. Embed YouTube — cherche une vraie vidéo FR récente sur ${actif} (canaux : Journal du Coin, CoinAcademy, Cryptoast, Cryptonomie)
5. <div class="content-grid-3"> avec 3 stat-cards : prix actuel ${prix_actuel}, capitalisation estimée, performance récente
6. <div class="content-section-label">Analyse fondamentale</div> + content-body (2 paragraphes : contexte macro + catalyseur de la semaine)
7. <hr class="content-divider">
8. <div class="content-section-label">Niveaux clés</div> + content-grid-2 avec 2 content-cards : support clé (tag vert) + résistance (tag orange)
9. <div class="content-section-label">Vidéos — spécialistes FR</div> + 4 link-items avec vraies URLs YouTube
10. <div class="content-section-label">Articles — analyses FR</div> + 5 link-items vers journalducoin.com, cryptoast.fr, cryptonomie.fr
11. <hr class="content-divider">
12. <div class="content-section-label">Où trader ${actif}</div> + 3 link-items plateformes
13. <div style="margin-top:20px"><p style="font-size:12px;color:var(--muted);font-style:italic">Disclaimer légal</p></div>`;
  },

  bourse() {
    const { actif, angle, ticker } = t.bourse;
    return `Génère le contenu HTML complet pour le panel BOURSE & ETFs — Semaine ${semaine}.

DONNÉES DE LA SEMAINE :
- Actif : ${actif} (ticker : ${ticker})
- Angle éditorial : ${angle}

STRUCTURE ATTENDUE :
1. <div class="content-week-tag">Bourse & ETFs — Semaine ${semaine}</div>
2. <h1 class="content-title"> — titre accrocheur sur ${actif}
3. <p class="content-sub"> — contexte de l'opportunité
4. Embed YouTube — vidéo FR récente sur ${actif} (canaux : Finance avec Matthieu, Heureux Rentier, Paf le Geek Finance, BFM Bourse, Nexus)
5. content-grid-3 avec 3 stat-cards : valorisation, secteur, date/événement clé
6. content-section-label "Analyse fondamentale" + content-body (2-3 paragraphes)
7. content-grid-2 : 2 content-cards — opportunité (tag normal) + risques (tag orange)
8. content-section-label "Vidéos analyse FR" + 4 link-items YouTube
9. content-section-label "Articles & analyses" + 5 link-items (latribune.fr, boursorama.com, lefigaro.fr/bourse, capital.fr, challenges.fr)
10. hr + content-section-label "Courtiers recommandés" + 3 link-items (Trade Republic, Degiro, Boursorama Bourse)
11. Disclaimer légal`;
  },

  remote() {
    const { focus_secteur, nouvelles_companies } = t.remote;
    return `Génère le contenu HTML complet pour le panel REMOTE & FACTURATION OCCIDENT — Semaine ${semaine}.

DONNÉES DE LA SEMAINE :
- Secteur focus : ${focus_secteur}
- Entreprises qui recrutent : ${nouvelles_companies.join(', ')}

STRUCTURE ATTENDUE :
1. content-week-tag : "Remote & Facturation Occident — Semaine ${semaine}"
2. h1.content-title — titre sur les opportunités remote du moment
3. p.content-sub — résumé rapide
4. content-grid-3 : 3 stat-cards (nb postes remote ouverts, salaire médian remote FR, % d'entreprises full-remote)
5. content-section-label "Entreprises qui recrutent cette semaine" + 4 content-cards pour les entreprises (${nouvelles_companies.join(', ')}) — chaque card : nom entreprise (tag), rôles ouverts (titre), fourchette salaire + lien postuler (body)
6. hr + content-section-label "Comment décrocher un poste remote UK/US depuis la France" + content-body (2 paragraphes conseils concrets)
7. content-section-label "Plateformes de recherche" + 5 link-items (LinkedIn, Remote OK, We Work Remotely, Malt, Welcome to the Jungle)
8. content-section-label "Statuts juridiques recommandés" + content-grid-2 : auto-entrepreneur vs SASU (avantages/seuils/comparaison)
9. content-section-label "Ressources & guides" + 3 link-items articles FR sur travail remote`;
  },

  villes() {
    const { ville_spotlight, angle } = t.villes;
    return `Génère le contenu HTML complet pour le panel VILLES NOMADES — Semaine ${semaine}.

DONNÉES DE LA SEMAINE :
- Ville spotlight : ${ville_spotlight}
- Angle éditorial : ${angle}

STRUCTURE ATTENDUE :
1. content-week-tag : "Villes Nomades — Semaine ${semaine}"
2. h1.content-title : titre accrocheur sur ${ville_spotlight}
3. p.content-sub
4. content-grid-3 : 3 stat-cards (coût de vie mensuel moyen €, score internet Mbps, score qualité de vie /10)
5. content-section-label "Pourquoi ${ville_spotlight} en 2026" + content-body (2 paragraphes avec le contexte de l'angle : ${angle})
6. Tableau HTML comparatif budget (3 colonnes : Serré / Confort / Premium) avec les postes logement, coworking, repas, transport, loisirs + total
7. content-section-label "Quartiers recommandés" + content-grid-2 : 2 content-cards avec nom quartier + description
8. content-section-label "Visa & démarches" + content-body (type de visa, durée, coût, conditions 2026)
9. content-section-label "Vidéos nomades FR" + 3 link-items YouTube
10. content-section-label "Autres villes à surveiller" + 4 link-items articles nomades`;
  },

  immo() {
    const { pays, angle } = t.immobilier;
    return `Génère le contenu HTML complet pour le panel IMMOBILIER INTERNATIONAL — Semaine ${semaine} (section Expert).

DONNÉES DE LA SEMAINE :
- Pays focus : ${pays}
- Angle éditorial : ${angle}

STRUCTURE ATTENDUE :
1. content-week-tag : "Immobilier International — Semaine ${semaine}"
2. h1.content-title + p.content-sub
3. content-grid-3 : 3 stat-cards (rendement net %, prix m² moyen €, durée procédure semaines)
4. content-section-label "Pourquoi ${pays} en 2026" + content-body (2 paragraphes sur le contexte : ${angle})
5. content-section-label "Processus d'achat étape par étape" + content-grid-2 : 4 content-cards (recherche bien / due diligence notaire / financement / fiscalité avantages)
6. content-section-label "Fiscalité pour non-résidents" + content-body
7. hr + content-section-label "Agents & plateformes" + 4 link-items
8. content-section-label "Autres marchés à surveiller" + content-grid-3 : 3 stat-cards (Portugal, Thaïlande, Colombie) avec rendement estimé
9. Disclaimer légal`;
  },

  rupture() {
    const { focus, pays } = t.rupture;
    return `Génère le contenu HTML complet pour le panel RUPTURE CONVENTIONNELLE — Semaine ${semaine} (section Expert).

DONNÉES DE LA SEMAINE :
- Focus : ${focus}
- Pays : ${pays}

STRUCTURE ATTENDUE :
1. content-week-tag : "Rupture Conventionnelle — Semaine ${semaine}"
2. h1.content-title : titre sur ${focus}
3. p.content-sub
4. content-grid-3 : 3 stat-cards (indemnité légale minimum exemple, délai moyen obtention, % acceptation employeur)
5. content-section-label "Analyse : ${focus}" + content-body (2 paragraphes sur le contexte Q3 2026 et pourquoi c'est le bon timing)
6. content-section-label "4 stratégies de négociation" + 4 content-cards avec tactiques concrètes (titre court + description actionnable)
7. content-section-label "Calculateur rapide" + content-body avec formule légale FR + exemple chiffré (ancienneté × salaire)
8. content-section-label "Pièges à éviter absolument" + 3 content-cards (tag orange)
9. hr + content-section-label "Ressources officielles" + 4 link-items (service-public.fr, etc.)
10. <div style="margin-top:20px"><p style="font-size:12px;color:var(--muted);font-style:italic">Ce contenu est informatif. Consultez un avocat ou conseiller RH pour votre situation.</p></div>`;
  },

  banques() {
    const { focus } = t.banques;
    return `Génère le contenu HTML complet pour le panel BANQUES NOMADES — Semaine ${semaine}.

DONNÉES DE LA SEMAINE :
- Focus : ${focus}

STRUCTURE ATTENDUE :
1. content-week-tag : "Banques Nomades — Semaine ${semaine}"
2. h1.content-title + p.content-sub
3. Embed YouTube — vidéo FR récente sur Wise vs Revolut ou banques pour nomades (canaux : Heureux Rentier, Nomade Digital France, Finance avec Matthieu)
4. content-grid-3 : 3 stat-cards (frais change Wise %, frais change Revolut Standard %, taux impôt Géorgie résidents étrangers)
5. Tableau comparatif HTML Wise vs Revolut : colonnes Critère / Wise / Revolut · lignes : frais virement SEPA, frais change, limite mensuelle, carte gratuite, multi-devises, support
6. content-section-label "Résidence fiscale Géorgie : 0% sur revenus étrangers" + content-body (2 paragraphes sur le régime fiscal géorgien pour nomades)
7. content-section-label "Autres options" + content-grid-2 : 2 content-cards (N26 + Bunq)
8. content-section-label "Vidéos comparatifs FR" + 4 link-items YouTube
9. content-section-label "Guides & articles" + 4 link-items
10. Disclaimer fiscal`;
  },

  psycho() {
    const { theme, angle } = t.psycho;
    return `Génère le contenu HTML complet pour le panel PSYCHOLOGIE & MINDSET — Semaine ${semaine}.

DONNÉES DE LA SEMAINE :
- Thème : ${theme}
- Angle : ${angle}

STRUCTURE ATTENDUE :
1. content-week-tag : "Psychologie & Mindset — Semaine ${semaine}"
2. h1.content-title sur ${theme}
3. p.content-sub
4. Embed YouTube — vidéo FR d'un psychologue ou coach sur le burn-out ou reconversion professionnelle (canaux : Léa Camilleri, Marie-Laurence Cattoire, NeuroAtypique, Psychologue.net, Mieux Être)
5. content-grid-3 : 3 stat-cards (% actifs en burn-out en France, % réussite reconversion après burn-out, durée moyenne reconversion mois)
6. content-section-label "Comprendre le cycle" + content-body (2-3 paragraphes sur ${angle})
7. content-section-label "Les 4 étapes clés" + 4 content-cards (Diagnostic / Deuil du passé / Reconstruction / Passage à l'action) — chaque card : titre court + description concrète + signe que tu es prêt
8. content-section-label "Ressources psychologiques" + 5 link-items (vidéos de psys/coachs FR sur YouTube)
9. content-section-label "Articles & livres" + 5 link-items
10. content-section-label "Action concrète cette semaine" + 1 content-card avec un exercice de 10 minutes à faire maintenant`;
  },
};

// ── Replace content between markers in an HTML file ───────────────────────────
function replaceBetweenMarkers(html, startMarker, endMarker, newContent) {
  const start = html.indexOf(startMarker);
  const end = html.indexOf(endMarker);
  if (start === -1 || end === -1) {
    throw new Error(`Markers not found: ${startMarker} / ${endMarker}`);
  }
  const afterStart = start + startMarker.length;
  return html.slice(0, afterStart) + '\n' + newContent + '\n        ' + html.slice(end);
}

// ── Build week preview HTML for index.html ────────────────────────────────────
function buildWeekPreview() {
  const items = [
    { num: '01', theme: 'Analyse Crypto', topic: `${t.crypto.actif} — ${t.crypto.angle}`, lock: 'Membres' },
    { num: '02', theme: 'Bourse & ETFs',  topic: `${t.bourse.actif} — ${t.bourse.angle}`, lock: 'Membres' },
    { num: '03', theme: 'Remote & Facturation Occident', topic: `${t.remote.focus_secteur} — ${[...t.remote.nouvelles_companies].slice(0,3).join(', ')}`, lock: 'Membres' },
    { num: '04', theme: 'Villes Nomades', topic: `${t.villes.ville_spotlight} — ${t.villes.angle}`, lock: 'Membres' },
    { num: '05', theme: 'Immobilier',     topic: `${t.immobilier.pays} — ${t.immobilier.angle}`, lock: 'Expert' },
    { num: '06', theme: 'Rupture Conventionnelle', topic: t.rupture.focus, lock: 'Expert' },
    { num: '07', theme: 'Banques Nomades', topic: t.banques.focus, lock: 'Membres' },
    { num: '08', theme: 'Psychologie',    topic: `${t.psycho.theme} — ${t.psycho.angle}`, lock: 'Membres' },
  ];
  return items.map(({ num, theme, topic, lock }) =>
    `        <div class="week-preview__item">
          <span class="week-preview__num">${num}</span>
          <div class="week-preview__body">
            <div class="week-preview__theme">${theme}</div>
            <div class="week-preview__topic">${topic}</div>
          </div>
          <span class="week-preview__lock">${lock}</span>
        </div>`
  ).join('\n');
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('❌ ANTHROPIC_API_KEY manquante');
    process.exit(1);
  }

  console.log('\n╔══════════════════════════════════════════════════╗');
  console.log(`║  Nomad Money Academy — Semaine ${String(semaine).padEnd(17)}║`);
  console.log('╚══════════════════════════════════════════════════╝\n');

  const membresPath = path.join(__dirname, 'membres.html');
  const indexPath   = path.join(__dirname, 'index.html');
  let membresHtml = fs.readFileSync(membresPath, 'utf-8');
  let indexHtml   = fs.readFileSync(indexPath, 'utf-8');

  const panelIds = ['crypto', 'bourse', 'remote', 'villes', 'immo', 'rupture', 'banques', 'psycho'];

  for (const id of panelIds) {
    const label = id.charAt(0).toUpperCase() + id.slice(1);
    process.stdout.write(`📝 ${label.padEnd(12)}`);
    const content = await generate(prompts[id]());
    membresHtml = replaceBetweenMarkers(
      membresHtml,
      `<!-- NMA-START:${id} -->`,
      `<!-- NMA-END:${id} -->`,
      content
    );
  }

  // Update week preview in index.html (no Claude call needed)
  const weekItems = buildWeekPreview();
  indexHtml = replaceBetweenMarkers(
    indexHtml,
    '<!-- NMA-WEEK-START -->',
    '<!-- NMA-WEEK-END -->',
    weekItems
  );

  fs.writeFileSync(membresPath, membresHtml, 'utf-8');
  fs.writeFileSync(indexPath, indexHtml, 'utf-8');

  console.log('\n✅ membres.html + index.html mis à jour.');
  console.log(`\n💡 Pour déployer :\n   git add membres.html index.html themes.json\n   git commit -m "Contenu semaine ${semaine}"\n   git push\n   vercel --prod\n`);
}

main().catch(err => {
  console.error('\n❌ Erreur:', err.message);
  process.exit(1);
});
