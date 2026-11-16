// Construit lgl-clients.json à partir des fichiers LGL du bureau / NAS.
// Usage : node scripts/import-lgl.js
// Sources :
//  - Base de Données LGL.xlsx (ID, Nom, Tournée)
//  - CLIENTS LGL 2025.xlsx (livreur, type snack/magasin, encaissement)
//  - Commande d'office Snack.xlsx (commandes habituelles par jour)
// Le fichier produit est importé dans l'app : Espace La Vie Saine → Clients → « Importer fichier LGL ».
// Il n'est pas versionné (.gitignore).
const X = require("xlsx");
const fs = require("fs");
const path = require("path");

const SRC = {
  base: process.env.LGL_BASE || "C:/Users/Utilisateur/Desktop/Base de Données LGL.xlsx",
  clients: process.env.LGL_CLIENTS || "//nas/COMMUN/Commercial 2019/CLIENTS LGL 2025.xlsx",
  office: process.env.LGL_OFFICE || "//nas/COMMUN/Commercial 2019/Commande d'office Snack.xlsx",
};
const JOURS = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
const rows = (file, sheet) => {
  const wb = X.readFile(file);
  const out = {};
  for (const n of sheet ? [sheet] : wb.SheetNames) out[n] = X.utils.sheet_to_json(wb.Sheets[n], { header: 1, defval: "" });
  return out;
};
const norm = (s) => String(s).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/\(.*?\)/g, " ").replace(/[^A-Z0-9]+/g, " ").trim();
const STOP = new Set(["SARL", "SAS", "SNACK", "ALIMENTATION", "CHEZ", "LE", "LA", "LES", "DU", "DE", "DES", "NC", "MAGASIN", "TRAIT", "TRAITEUR", "AU", "ET", "L", "D", "TEL", "SI"]);
const mots = (s) => norm(s).split(" ").filter((w) => w.length > 1 && !STOP.has(w) && !/^\d+$/.test(w));

// ---------- 1. Base LGL ----------
const base = Object.values(rows(SRC.base))[0].slice(1)
  .filter((r) => r[0] !== "" && r[1])
  .filter((r) => !/^\s*arr[eêé]t/i.test(String(r[2] || ""))) // « Arrêt » = anciens clients
  .map((r) => ({ id: String(r[0]).trim(), nom: String(r[1]).trim(), tournee: String(r[2] || "").trim() || "Sans tournée" }));

// ---------- 2. CLIENTS LGL 2025 (livreur, type, encaissement) ----------
const infos = new Map(); // nom normalisé -> { livreurNum, livreurNom, type, encaissement }
for (const [sheet, a] of Object.entries(rows(SRC.clients))) {
  const m = sheet.match(/LIV\s*(\d+)\s+(.+)/i);
  const livreurNum = m ? Number(m[1]) : null;
  const livreurNom = m ? m[2].trim().replace(/^\w/, (c) => c).toLowerCase().replace(/^\w/, (c) => c.toUpperCase()) : null;
  const lieu = /FOURNIL/i.test(sheet) ? "Fournil" : /ARRET/i.test(sheet) ? "Arrêt" : null;
  if (!livreurNum && !lieu) continue;
  for (const r of a) {
    const nom = String(r[0]).trim();
    if (!nom || /NOMS? (DU |DES )?CLIENTS|^LIVREUR|^FOURNIL|ARRR?ET/i.test(nom)) continue;
    infos.set(norm(nom), { livreurNum, livreurNom, lieu, type: String(r[4] || "").trim(), encaissement: String(r[5] || "").trim().toUpperCase() });
  }
}

// ---------- 3. Commandes d'office ----------
// Abréviations du tableau -> id produit du catalogue (lib/catalog.js). Ordre : du plus précis au plus général.
const MAP = [
  [/mini hot ?dog s[ée]s/i, "S68"],
  [/hot ?dog s[ée]s/i, "S67"],
  [/hot ?dog nat/i, "S68N"],
  [/hamb\.?\s*x\s*4/i, "E20"],
  [/ham[b]?\.?\s*plaq\.?\s*100/i, "S20"],
  [/hamb\.?\s*150/i, "S19"],
  [/hamb\.?\s*80/i, "S21"],
  [/laits?\s*x\s*2/i, "E33"],
  [/laits?/i, "S71"],
  [/toast xxl fin/i, "E63"],
  [/toast xxl/i, "E64"],
  [/comp\.?\s*xxl/i, "E70"],
  [/(grd\.?\s*comp|comp\.?\s*grd|complet grd)/i, "E1"],
  [/panier comp/i, "E54"],
  [/seigle xxl/i, "E66"],
  [/sand/i, "E4"],
  [/filets?\s*180/i, "S75"],
  [/filets?\s*150/i, "S76"],
  [/plats?\b/i, "S76"],
  [/baguettes?/i, "S12"],
  [/bagels? pavot/i, "S11"],
  [/bagels? nat/i, "S10"],
];
// Correspondance des index S (doit suivre l'ordre de lib/catalog.js)
const { PRODUITS } = requireCatalog();
const idParNom = (nom, g) => PRODUITS.find((p) => p.nom === nom && p.g === g)?.id;
const ALIAS = {
  S68: idParNom("Mini hot dog sésame", 60), S67: idParNom("Hot dog avec sésame", 100), S68N: idParNom("Hot dog nature", 100),
  S20: idParNom("Hamburger", 100), S19: idParNom("Hamburger", 150), S21: idParNom("Hamburger", 80), S71: idParNom("Pain au lait", 105),
  S75: idParNom("Panini filet / plat", 180), S76: idParNom("Panini filet / plat", 150), S12: idParNom("Baguette nature, complète", 280),
  S11: idParNom("Bagel pavot, sésame", 100), S10: idParNom("Bagel", 100),
};
function requireCatalog() {
  // lib/catalog.js est un module ESM : on l'évalue simplement
  const src = fs.readFileSync(path.join(__dirname, "../lib/catalog.js"), "utf8").replace(/export /g, "");
  return new Function(src + "; return { PRODUITS };")();
}
const resoudre = (code) => ALIAS[code] || code;

function parserCellule(txt) {
  const lignes = [], restes = [];
  const clean = String(txt).replace(/\s+/g, " ").replace(/Tel\s*:?\s*[\d. ]+/gi, "").trim();
  if (!clean) return null;
  for (const morceau of clean.split("/").map((s) => s.trim()).filter(Boolean)) {
    const m = morceau.match(/^(\d+)\s+(.+)$/);
    const regle = m && MAP.find(([re]) => re.test(m[2]));
    if (regle) {
      const pid = resoudre(regle[1]);
      lignes.push({ produitId: pid, qte: Number(m[1]), ...(/(fin|semoule|imprim)/i.test(m[2]) && regle[1] !== "E63" ? { note: m[2] } : {}) });
    } else restes.push(morceau);
  }
  return { lignes, texte: restes.join(" / ") };
}

const office = Object.values(rows(SRC.office))[0];
const habitudes = []; // { nomTableau, livreurNum, lieu, jours: {...}, remarque }
let lieuCourant = null;
for (const r of office) {
  const col0 = String(r[0]).trim();
  if (col0) lieuCourant = col0;
  const nomT = String(r[1]).trim();
  if (!nomT || /^(LUNDI)$/i.test(String(r[2]).trim())) continue;
  const jours = {};
  JOURS.forEach((j, i) => { const p = parserCellule(r[2 + i]); if (p && (p.lignes.length || p.texte)) jours[j] = p; });
  if (!Object.keys(jours).length) continue;
  const rem = (nomT.match(/\(([^)]*)\)/) || [])[1] || "";
  const ln = (lieuCourant || "").match(/Livreur\s*(\d+)/i);
  habitudes.push({ nomTableau: nomT.replace(/Tel\s*:?.*$/i, "").replace(/\(.*?\)/g, "").trim(), livreurNum: ln ? Number(ln[1]) : null, lieu: ln ? null : lieuCourant, jours, remarque: rem });
}

// ---------- Rapprochement des noms ----------
function meilleur(nomT, candidats) {
  const mt = mots(nomT);
  if (!mt.length) return null;
  let best = null, score = 0;
  for (const c of candidats) {
    const mc = new Set(mots(c.nom));
    const commun = mt.filter((w) => mc.has(w) || [...mc].some((x) => x.length > 3 && (x.startsWith(w) || w.startsWith(x)))).length;
    const s = commun / mt.length;
    if (s > score) { score = s; best = c; }
  }
  return score >= 0.99 || (score >= 0.5 && mt.length > 1) ? best : null;
}

const tourneeNum = (t) => Number((t.match(/Livreur\s*(\d+)/i) || [])[1]) || null;
const resultat = new Map(base.map((c) => [c.id, { ...c }]));
for (const c of resultat.values()) {
  const inf = infos.get(norm(c.nom));
  if (inf) {
    if (inf.livreurNom) c.livreur = inf.livreurNom;
    if (inf.type) c.type = inf.type;
    if (inf.encaissement) c.paiement = inf.encaissement === "COMPTANT" ? "comptant" : inf.encaissement === "LIVRAISON" ? "livraison" : "compte";
  }
}
// Rapprochements vérifiés à la main (nom du tableau -> ID LGL). null = client absent de la base LGL.
const FORCE = {
  "Super Mag": "698", "Superette 68": "87", "Ma Vie Là": "723", "Trait. Myshop": "727", "Traiteur Best. Super.": "346",
  "Total Ducos": null, "Cosy Foch": null,
};
const nonTrouves = [];
for (const h of habitudes) {
  if (h.nomTableau in FORCE) {
    const c = FORCE[h.nomTableau] && resultat.get(FORCE[h.nomTableau]);
    if (!c) { nonTrouves.push(`${h.livreurNum ? "Livreur " + h.livreurNum : h.lieu} — ${h.nomTableau}`); continue; }
    c.habitudes = h.jours; c.nomTableau = h.nomTableau; if (h.remarque) c.remarque = h.remarque;
    continue;
  }
  const pool = [...resultat.values()].filter((c) => (h.livreurNum ? tourneeNum(c.tournee) === h.livreurNum : /fournil/i.test(c.tournee)));
  const c = meilleur(h.nomTableau, pool) || meilleur(h.nomTableau, [...resultat.values()]);
  if (!c) { nonTrouves.push(`${h.livreurNum ? "Livreur " + h.livreurNum : h.lieu} — ${h.nomTableau}`); continue; }
  c.habitudes = h.jours;
  if (h.remarque) c.remarque = h.remarque;
  c.nomTableau = h.nomTableau;
}
// Nom du livreur par numéro (déduit des feuilles CLIENTS LGL)
const livreurs = {};
for (const i of infos.values()) if (i.livreurNum && i.livreurNom) livreurs[i.livreurNum] = i.livreurNom;
for (const c of resultat.values()) {
  const n = tourneeNum(c.tournee);
  if (n && !c.livreur && livreurs[n]) c.livreur = livreurs[n];
}

const out = { genereLe: new Date().toISOString(), sources: Object.values(SRC), livreurs, clients: [...resultat.values()] };
fs.writeFileSync(path.join(__dirname, "../lgl-clients.json"), JSON.stringify(out));
const avecHab = out.clients.filter((c) => c.habitudes);
console.log(`Clients : ${out.clients.length} · avec livreur : ${out.clients.filter((c) => c.livreur).length} · avec commandes habituelles : ${avecHab.length}/${habitudes.length}`);
console.log("Livreurs :", livreurs);
console.log("Rapprochements :"); avecHab.forEach((c) => console.log(`  ${c.nomTableau}  ->  ${c.nom} [${c.id}]`));
console.log("Non rapprochés :", nonTrouves);
const textes = new Set(); avecHab.forEach((c) => Object.values(c.habitudes).forEach((j) => j.texte && textes.add(j.texte)));
console.log("Mentions non converties :", [...textes]);
