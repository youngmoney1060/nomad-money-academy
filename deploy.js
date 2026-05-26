/**
 * MoneyFlow — Déploiement Netlify
 * Génère le contenu (si absent) puis pousse les fichiers JSON sur le site.
 *
 * Usage :
 *   NETLIFY_TOKEN=... ANTHROPIC_API_KEY=... node deploy.js 1
 *
 * Si le JSON est déjà généré localement, seul NETLIFY_TOKEN est requis.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SITE_ID    = '286891d0-9cba-4635-9a46-c36c9d16c032';
const SITE_URL   = 'https://moneyflowcompany.netlify.app';
const NETLIFY_API = 'https://api.netlify.com/api/v1';
const WEEK       = parseInt(process.argv[2] || '1', 10);
const TOKEN      = process.env.NETLIFY_TOKEN;

// ── Helpers ────────────────────────────────────────────────────────────────────

function sha1(buf) {
  return crypto.createHash('sha1').update(buf).digest('hex');
}

async function nFetch(endpoint, opts = {}) {
  const { asJson = true, ...rest } = opts;
  const res = await fetch(`${NETLIFY_API}${endpoint}`, {
    ...rest,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      ...rest.headers,
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Netlify ${endpoint} → HTTP ${res.status}: ${body.slice(0, 300)}`);
  }
  return asJson ? res.json() : res;
}

function log(icon, msg) {
  console.log(`${icon}  ${msg}`);
}

// ── Génération (si nécessaire) ─────────────────────────────────────────────────

function generateContent(week) {
  return new Promise((resolve, reject) => {
    log('🤖', `Génération du contenu semaine ${week} via Claude…`);
    const child = spawn('node', ['generate-week-json.js', String(week)], {
      cwd: __dirname,
      stdio: 'inherit',
      env: process.env,
    });
    child.on('close', code => {
      if (code === 0) resolve();
      else reject(new Error(`generate-week-json.js a échoué (code ${code})`));
    });
  });
}

// ── Mise à jour content-index.json ────────────────────────────────────────────

function updateIndex(week) {
  const indexPath = path.join(__dirname, 'content-index.json');
  const index = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));

  index.semaine_courante = week;
  index.derniere_mise_a_jour = new Date().toISOString().split('T')[0];

  const exists = index.semaines.some(s => s.numero === week);
  if (!exists) {
    index.semaines.push({
      numero: week,
      fichier: `content/semaine-${week}/semaine-${week}.json`,
      theme_principal: `semaine-${week}`,
      destination_nomade: '',
      date_publication: new Date().toISOString().split('T')[0],
      hook_newsletter: '',
    });
  }

  // Enrichir avec les métadonnées du JSON généré si disponibles
  const weekJsonPath = path.join(__dirname, 'content', `semaine-${week}`, `semaine-${week}.json`);
  if (fs.existsSync(weekJsonPath)) {
    const data = JSON.parse(fs.readFileSync(weekJsonPath, 'utf-8'));
    const entry = index.semaines.find(s => s.numero === week);
    if (entry && data.meta) {
      entry.theme_principal   = data.meta.theme_principal   || entry.theme_principal;
      entry.destination_nomade = data.meta.destination_nomade || entry.destination_nomade;
      entry.hook_newsletter   = data.newsletter?.objet_email || entry.hook_newsletter;
    }
  }

  fs.writeFileSync(indexPath, JSON.stringify(index, null, 2), 'utf-8');
  log('📋', `content-index.json mis à jour (semaine courante → ${week})`);
}

// ── Déploiement Netlify ────────────────────────────────────────────────────────

async function deploy(week) {
  // 1. Lister les fichiers locaux à pousser
  const weekDir   = path.join(__dirname, 'content', `semaine-${week}`);
  const filesToPush = {
    '/content-index.json': fs.readFileSync(path.join(__dirname, 'content-index.json')),
    [`/content/semaine-${week}/semaine-${week}.json`]:
      fs.readFileSync(path.join(weekDir, `semaine-${week}.json`)),
  };

  const newsletterPath = path.join(weekDir, 'newsletter.html');
  if (fs.existsSync(newsletterPath)) {
    filesToPush[`/content/semaine-${week}/newsletter.html`] =
      fs.readFileSync(newsletterPath);
  }

  // 2. Récupérer les fichiers du déploiement actuel pour les conserver
  log('📡', 'Récupération du déploiement actuel…');
  const site = await nFetch(`/sites/${SITE_ID}`);
  const existingMap = {}; // path → sha1

  if (site.published_deploy?.id) {
    const existing = await nFetch(`/deploys/${site.published_deploy.id}/files`);
    for (const f of existing) {
      existingMap[f.id] = f.sha;
    }
    log('✓', `${Object.keys(existingMap).length} fichiers existants conservés`);
  } else {
    log('ℹ', 'Aucun déploiement publié — premier déploiement');
  }

  // 3. Fusionner existants + nouveaux
  const deployMap = { ...existingMap };
  const uploadQueue = {}; // sha1 → { netlifyPath, content }

  for (const [filePath, content] of Object.entries(filesToPush)) {
    const hash = sha1(content);
    deployMap[filePath] = hash;
    uploadQueue[hash] = { netlifyPath: filePath.replace(/^\//, ''), content };
    log('📄', `${filePath}  (${(content.length / 1024).toFixed(1)} Ko)`);
  }

  // 4. Créer le nouveau déploiement
  log('🚀', 'Création du déploiement…');
  const newDeploy = await nFetch(`/sites/${SITE_ID}/deploys`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ files: deployMap }),
  });

  log('✓', `Deploy ID : ${newDeploy.id}`);
  log('📤', `Fichiers à uploader : ${newDeploy.required?.length ?? 0}`);

  // 5. Uploader les fichiers manquants
  if (newDeploy.required?.length > 0) {
    for (const hash of newDeploy.required) {
      const file = uploadQueue[hash];
      if (!file) {
        console.warn(`⚠️  Hash ${hash} requis mais introuvable localement`);
        continue;
      }
      await nFetch(`/deploys/${newDeploy.id}/files/${file.netlifyPath}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: file.content,
        asJson: false,
      });
      log('✓', `Uploadé : /${file.netlifyPath}`);
    }
  }

  // 6. Attendre la mise en ligne
  process.stdout.write('\n⏳ Mise en ligne');
  let state = newDeploy.state;
  let attempts = 0;
  while (!['ready', 'error'].includes(state) && attempts < 40) {
    await new Promise(r => setTimeout(r, 2500));
    const updated = await nFetch(`/deploys/${newDeploy.id}`);
    state = updated.state;
    process.stdout.write('.');
    attempts++;
  }
  console.log('');

  return state;
}

// ── Point d'entrée ─────────────────────────────────────────────────────────────

async function main() {
  if (!TOKEN) {
    console.error('❌ NETLIFY_TOKEN manquant.');
    console.error('   Crée un token sur : app.netlify.com → User settings → Access tokens');
    process.exit(1);
  }

  if (isNaN(WEEK) || WEEK < 1) {
    console.error('❌ Usage : node deploy.js <numéro-semaine>  (ex: node deploy.js 1)');
    process.exit(1);
  }

  console.log('\n╔══════════════════════════════════════════════════╗');
  console.log(`║   MoneyFlow — Deploy Netlify  Semaine ${String(WEEK).padEnd(11)}║`);
  console.log('╚══════════════════════════════════════════════════╝\n');

  const weekJsonPath = path.join(
    __dirname, 'content', `semaine-${WEEK}`, `semaine-${WEEK}.json`
  );

  // Générer si absent
  if (!fs.existsSync(weekJsonPath)) {
    if (!process.env.ANTHROPIC_API_KEY) {
      console.error(`❌ content/semaine-${WEEK}/semaine-${WEEK}.json introuvable.`);
      console.error(`   Ajoutez ANTHROPIC_API_KEY pour générer automatiquement, ou lancez :`);
      console.error(`   node generate-week-json.js ${WEEK}`);
      process.exit(1);
    }
    await generateContent(WEEK);
  } else {
    log('✓', `JSON semaine ${WEEK} trouvé localement — génération ignorée`);
  }

  // Mettre à jour l'index
  updateIndex(WEEK);

  // Déployer
  const finalState = await deploy(WEEK);

  if (finalState === 'ready') {
    console.log('\n╔══════════════════════════════════════════════════╗');
    console.log('║   ✅ Site mis à jour avec succès !              ║');
    console.log('╚══════════════════════════════════════════════════╝');
    console.log(`\n🌍  ${SITE_URL}`);
    console.log(`📄  Semaine ${WEEK} en ligne\n`);
  } else {
    console.error(`\n❌ Déploiement terminé en état : ${finalState}`);
    process.exit(1);
  }
}

main().catch(err => {
  console.error('\n❌ Erreur :', err.message);
  process.exit(1);
});
