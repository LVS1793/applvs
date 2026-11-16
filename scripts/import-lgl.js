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
  for (const n of sheet ? [sheet] : wb.SheetNames) out[n] = avecFusions(wb.Sheets[n]);
  return out;
};
// Cellules fusionnées : la valeur (ex. « 20 Laits » de mardi à vendredi) est recopiée dans chaque case de la fusion
function avecFusions(ws) {
  const a = X.utils.sheet_to_json(ws, { header: 1, defval: "", blankrows: true });
  for (const m of ws["!merges"] || []) {
    const v = a[m.s.r]?.[m.s.c];
    if (v === "" || v === undefined) continue;
    for (let r = m.s.r; r <= m.e.r; r++) for (let c = m.s.c; c <= m.e.c; c++) {
      a[r] = a[r] || []; while (a[r].length <= c) a[r].push("");
      a[r][c] = v;
    }
  }
  return a;
}
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
  if (!nomT || /COMMANDES D.OFFICE/i.test(nomT) || /^(LUNDI)$/i.test(String(r[2]).trim())) continue;
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
  "Total Ducos": null, "Cosy Foch": null, "Magasin Val Plaisance": "146", "Bikini": "180", "Loulou": "194",
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
// ---------- 4. Fiches de chargement par client (Chargement\Fiches Clients 2026\Livreur N.xlsx) ----------
// Un onglet par client ; bloc « NORMAL » = quantités chargées habituellement par jour.
const DIR_CHG = process.env.LGL_CHARGEMENTS || "//nas/COMMUN/Commercial 2019/Chargement/Fiches Clients 2026/";
const MAP_CHG = [
  [/^bagels? pavot/i, "E77"], [/^brioch[ée] tranch/i, "E13"], [/^c[ée]r[ée]ales/i, "E18"], [/^complet au raisin/i, "E39"],
  [/^complet grand/i, "E1"], [/^complet soja/i, "E25"], [/^complet xxl/i, "E70"], [/^grand brio/i, "E11"],
  [/^hamburger x4 600/i, "E36"], [/^hamburger x4/i, "E20"], [/^hot dog s[ée]same x2/i, "E67"], [/^lait x2/i, "E33"],
  [/^mini brioch/i, "E76"], [/^muffin x3/i, "E72"], [/^multigrains xxl coup/i, "E62"], [/^multigrains xxl/i, "E65"],
  [/^pain de f[êe]te brio/i, "E46"], [/^pain de f[êe]te nat/i, "E47"], [/^pain de mie sans sel/i, "E40"],
  [/^panier blanc/i, "E37"], [/^panier complet/i, "E54"], [/^panini filet/i, "E68"], [/^petit complet/i, "E74"],
  [/^petit mie/i, "E75"], [/^petit panier blanc/i, "E21"], [/^petit panier complet/i, "E73"], [/^sandwich/i, "E4"],
  [/^seigle cocktail/i, "E35"], [/^seigle noix/i, "E23"], [/^seigle raisins?/i, "E16"], [/^seigle xxl/i, "E66"],
  [/^seigle\b/i, "E9"], [/^toast xxl coup/i, "E63"], [/^toast xxl/i, "E64"], [/^viennois choco/i, "E28"],
];
// Rapprochements vérifiés à la main (onglet de la fiche -> ID LGL). null = absent de la base LGL (à vérifier).
const FORCE_CHG = {
  "Superette 68": "87", "Total Riviéra": "609", "Kim Marché": "533", "Comptoir RS": "672", "Auchan Q. Ferry": "591",
  "Cin SARL Myshop": "452", "Géant Ste Marie": "61", "Carrefour Market N'Géa": "152", "Michel Ange Supermarket": "68",
  "Carrefour Market Orphelinat": "45", "Val Plaisance": "146", "Oceania": "178", "Bikini": "63", "Mobil Conception": "568",
  "Mobil PDF": "78", "Ah Yen": "330", "Chez Loulou": "104", "Géant Mall": "171", "Total Zac Panda": "279",
  "Mobil Koutio": "544", "Best Supermarket": "89", "LS Kandy": "668", "Cagou Drive Top Store": "324",
  "Hyper U Païta": "689", "Korail Païta": "157", "Destock NC": "165", "Emilie La Foa": "268", "LS Tomo": "765",
  "U Express Q. Latin": null, "U Express Alma": null, "Cosy Foch": null, "Mobil VDC": null, "K'You du Pacific": null, "Eco Marché": null,
};
const chargements = []; const libellesInconnus = new Set();
for (let i = 1; i <= 9; i++) {
  const f = path.join(DIR_CHG, `Livreur ${i}.xlsx`);
  if (!fs.existsSync(f)) continue;
  for (const [onglet, a] of Object.entries(rows(f))) {
    const h = a.findIndex((r) => r.slice(1).some((c) => JOURS.includes(String(c).trim().toLowerCase())));
    if (h < 0) continue;
    const cols = {}; a[h].forEach((c, k) => { const j = String(c).trim().toLowerCase(); if (k > 0 && JOURS.includes(j)) cols[j] = k; });
    const jours = {}; const produits = new Set();
    for (const r of a.slice(h + 1)) {
      const lab = String(r[0]).trim();
      if (!lab) continue;
      if (/QUANTITE CHARG/i.test(lab)) break; // fin du bloc NORMAL
      const regle = MAP_CHG.find(([re]) => re.test(lab));
      if (!regle) { libellesInconnus.add(lab); continue; }
      for (const [j, k] of Object.entries(cols)) {
        const q = Math.round(Number(r[k]) || 0);
        if (q > 0) { (jours[j] = jours[j] || { lignes: [], texte: "" }).lignes.push({ produitId: regle[1], qte: q, deChargement: true }); produits.add(regle[1]); }
      }
    }
    if (produits.size) chargements.push({ livreurNum: i, onglet, nomFiche: String(a[h][0]).trim(), jours, produits: [...produits] });
  }
}
// Rapprochement strict : tous les mots significatifs du nom de la fiche doivent se retrouver dans le nom LGL
// (parenthèses comprises). Un seul candidat accepté, sinon rapprochement manuel via FORCE_CHG.
const normP = (s) => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/[^A-Z0-9]+/g, " ").trim();
const ABREV = { LP: "LEADER", MT: "MONT", STE: "SAINTE", Q: "QUARTIER", ALIM: "ALIMENTATION", SUP: "SUPERMARCHE", LS: "LS" };
const motsP = (s) => normP(s).split(" ").filter((w) => w && !["DE", "DU", "LA", "LE", "LES", "CHEZ", "SARL", "D", "L", "ET"].includes(w)).map((w) => ABREV[w] || w);
function strict(nom, pool) {
  const mt = motsP(nom); if (!mt.length) return null;
  const ok = pool.filter((c) => { const mc = motsP(c.nom); return mt.every((w) => mc.some((x) => x === w || (w.length >= 4 && x.length >= 4 && (x.startsWith(w) || w.startsWith(x))))); });
  return ok.length === 1 ? ok[0] : null;
}
let chgOk = 0; const chgKo = [];
for (const ch of chargements) {
  let c = ch.onglet in FORCE_CHG ? (FORCE_CHG[ch.onglet] && resultat.get(FORCE_CHG[ch.onglet])) : undefined;
  if (c === undefined) {
    const pool = [...resultat.values()].filter((x) => tourneeNum(x.tournee) === ch.livreurNum);
    c = strict(ch.onglet, pool) || strict(ch.nomFiche, pool) || strict(ch.onglet, [...resultat.values()]) || strict(ch.nomFiche, [...resultat.values()]);
  }
  if (!c) { chgKo.push(`Livreur ${ch.livreurNum} — ${ch.onglet}`); continue; }
  chgOk++;
  c.ficheChargement = ch.onglet;
  // Fusion avec les commandes d'office (snacking) déjà présentes
  c.habitudes = c.habitudes || {};
  for (const [j, v] of Object.entries(ch.jours)) {
    const ex = c.habitudes[j] || { lignes: [], texte: "" };
    ex.lignes = [...ex.lignes, ...v.lignes];
    c.habitudes[j] = ex;
  }
}

// ---------- 5. Tri snack / magasin ----------
// L'application est réservée aux SNACKS. Sources :
//  - Commande d'office Snack.xlsx : tout client qui y figure est un snack ;
//  - Planning Livraison 2026.xlsx (dernier onglet) : liste des MAGASINS livrés ;
//  - CLIENTS LGL 2025.xlsx : type (SNACK, MAGASIN, SNACK/MAGASIN…) ; le nom LGL « … (snack) ».
const PLANNING = process.env.LGL_PLANNING || "//nas/COMMUN/Planning Livraison 2026.xlsx";
const wbP = X.readFile(PLANNING);
const feuilleP = X.utils.sheet_to_json(wbP.Sheets[wbP.SheetNames[wbP.SheetNames.length - 1]], { header: 1, defval: "" });
const nomsMagasins = feuilleP.map((r) => String(r[0]).trim()).filter((n) => n && !/^(PLANNING|NOM DES|LIVREUR|TOTAL|MISE A JOUR|MISE À JOUR)/i.test(n));
const tous = [...resultat.values()];
for (const n of nomsMagasins) { const c = strict(n, tous); if (c) c.planningMagasin = true; }
const motsSnack = /snack|food|truck|roulotte|burger|kebab|sandwich|croque|pizz|traiteur|restaurant|caf[eé]|coffee|\bbar\b|kitchen|chi?cken|chiken|\bcook\b|cuisto|grill|buffet|wings|tacos|deux coqs|boy n cow|single fin|mc ?donald/i;
const pasSnack = /coll[eè]ge|lyc[eé]e|[eé]cole|school|maternelle|ehpad|amicale|tennis|basket|club|boucherie|supermarch|supermarket|magasin|[eé]picerie|alimentation|station|h[oô]tel|resort|carnet|test|boulangerie|ddec|fse\b|cise/i;
for (const c of resultat.values()) {
  const type = String(c.type || "").toUpperCase();
  let cat;
  if (c.nomTableau) cat = "snack";                                   // commande d'office snack
  else if (/\bsnack\b/i.test(c.nom)) cat = "snack";                  // « … (snack) » dans le nom LGL
  else if (c.planningMagasin) cat = "magasin";                       // livré au planning des magasins
  else if (/SNACK/.test(type)) cat = "snack";                        // SNACK, SNACK/MAGASIN, MAGASIN/SNACK
  else if (/MAGASIN|BOUCHERIE/.test(type)) cat = "magasin";
  else if (type) cat = "autre";                                      // école, collège, amicale, comité
  else cat = motsSnack.test(c.nom) && !pasSnack.test(c.nom) ? "snack" : "inconnu";
  c.categorie = cat;
}

// Les chargements des magasins ne servent plus : seules les commandes d'office snack restent comme habitudes.
for (const c of resultat.values()) {
  if (c.categorie !== "snack") { delete c.habitudes; delete c.produits; continue; }
  if (c.ficheChargement && !c.nomTableau) { delete c.habitudes; } // habitudes issues d'une fiche magasin
  else if (c.ficheChargement && c.habitudes) {
    // snack + magasin sur le même compte : ne garder que la partie snack (commande d'office)
    for (const j of Object.keys(c.habitudes)) {
      c.habitudes[j].lignes = c.habitudes[j].lignes.filter((l) => !l.deChargement);
      if (!c.habitudes[j].lignes.length && !c.habitudes[j].texte) delete c.habitudes[j]; // jour sans commande snack
    }
  }
  delete c.ficheChargement;
}

// Liste des produits proposés à chaque client = produits de ses chargements + commandes d'office
for (const c of resultat.values()) {
  const ids = new Set(Object.values(c.habitudes || {}).flatMap((j) => j.lignes.map((l) => l.produitId)));
  if (ids.size) c.produits = [...ids];
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
console.log(`Fiches de chargement : ${chgOk}/${chargements.length} rapprochées · clients avec liste de produits : ${out.clients.filter((c) => c.produits).length}`);
console.log("Fiches non rapprochées :", chgKo);
console.log("Libellés de chargement inconnus :", [...libellesInconnus]);
console.log("Rapprochements chargements :"); out.clients.filter((c) => c.ficheChargement).forEach((c) => console.log(`  ${c.ficheChargement}  ->  ${c.nom} [${c.id}]`));
const parCat = {}; out.clients.forEach((c) => { parCat[c.categorie] = (parCat[c.categorie] || 0) + 1; });
console.log("Catégories :", parCat, "· magasins du planning rapprochés :", out.clients.filter((c) => c.planningMagasin).length, "/", nomsMagasins.length);
console.log("Snacks avec commande d'office :", out.clients.filter((c) => c.categorie === "snack" && c.habitudes).length);
console.log("Snacks aussi au planning magasins :", out.clients.filter((c) => c.categorie === "snack" && c.planningMagasin).map((c) => c.nom));
console.log("Inconnus (exclus) :", out.clients.filter((c) => c.categorie === "inconnu").length);
