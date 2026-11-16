// Catalogue 2026 (grille Professionnel Fournil, HT en XPF) — source : vault 05-Ressources/Produits/Catalogue-tarifs-2026.md
// cat: "emballe" (48 h à l'avance) ou "snack" (24 h à l'avance, sans emballage)
// Grille livraison : +10 XPF HT (emballé) / +5 XPF HT (snack).

const E = (ref, nom, g, ht) => ({ id: "E" + (ref || nom.replace(/\W/g, "")), ref, nom, g, ht, cat: "emballe" });
let n = 0;
const S = (nom, g, ht) => ({ id: "S" + ++n, ref: null, nom, g, ht, cat: "snack" });

export const PRODUITS = [
  E(77, "Bagels pavot x4", 315, 311),
  E(14, "Brioché canapé", 290, 256),
  E(13, "Brioché tranché", 550, 447),
  E(19, "Canapé", 375, 296),
  E(18, "Céréales", 550, 389),
  E(39, "Complet aux raisins", 320, 305),
  E(1, "Complet grand", 550, 336),
  E(25, "Complet soja", 300, 278),
  E(70, "Complet XXL", 700, 436),
  E(11, "Grand lait", 550, 377),
  E(null, "Hamburger x4 (80 g)", 320, 296),
  E(20, "Hamburger x4 (100 g)", 380, 311),
  E(36, "Hamburger x4 (150 g)", 600, 467),
  E(67, "Hot dog sésame x2", 200, 188),
  E(33, "Lait x2", 210, 188),
  E(76, "Mini briochés x4", 300, 282),
  E(72, "Muffin x3", 150, 246),
  E(65, "Multigrains XXL", 700, 448),
  E(62, "Multigrains XXL coupé fin", 700, 448),
  E(46, "Pain de fête brioché", 220, 192),
  E(47, "Pain de fête nature", 220, 169),
  E(40, "Pain de mie sans sel", 300, 193),
  E(37, "Panier blanc", 550, 306),
  E(54, "Panier complet", 550, 327),
  E(68, "Panini filet / plat x5", 320, 197),
  E(74, "Petit complet", 320, 223),
  E(75, "Petit mie", 320, 191),
  E(21, "Petit panier blanc", 320, 191),
  E(73, "Petit panier complet", 320, 223),
  E(4, "Sandwich", 550, 314),
  E(9, "Seigle", 220, 213),
  E(35, "Seigle cocktail", 375, 315),
  E(23, "Seigle noix", 325, 272),
  E(16, "Seigle raisins", 325, 284),
  E(66, "Seigle XXL", 700, 436),
  E(64, "Toast XXL", 700, 415),
  E(63, "Toast XXL coupé fin", 700, 415),
  E(28, "Viennois choco x6", 230, 305),

  S("Bagna rond ou plat (kebab)", 200, 88),
  S("Bagna rond ou plat (kebab)", 150, 77),
  S("Bagna plat (kebab)", 100, 60),
  S("Boule complet / seigle / multigrains", 80, 74),
  S("Boule complet / seigle / multigrains", 50, 56),
  S("Boule nature", 80, 70),
  S("Boule nature", 50, 51),
  S("Boule noix, sésame, raisin, olive", 80, 81),
  S("Boule noix, sésame, raisin, olive", 50, 63),
  S("Bagel", 100, 81),
  S("Bagel pavot, sésame", 100, 86),
  S("Baguette nature, complète", 280, 123),
  S("Pistolet nature", 150, 75),
  S("Pistolet céréales, complet", 150, 82),
  S("Pistolet noix", 150, 92),
  S("Hamburger", 300, 234),
  S("Hamburger", 250, 200),
  S("Hamburger", 200, 160),
  S("Hamburger", 150, 111),
  S("Hamburger", 100, 72),
  S("Hamburger", 80, 67),
  S("Hamburger brioché", 150, 123),
  S("Hamburger brioché", 100, 83),
  S("Hamburger brioché", 80, 78),
  S("Hamburger junior", 50, 60),
  S("Hamburger mini", 30, 43),
  S("Hot dog long 30 cm", 160, 118),
  S("Hot dog avec sésame", 100, 78),
  S("Hot dog nature", 100, 72),
  S("Mini hot dog sésame", 60, 65),
  S("Muffin nature", 50, 49),
  S("Muffin au beurre", 50, 54),
  S("Pain au lait", 105, 81),
  S("Panini rond", 400, 181),
  S("Panini rond", 200, 83),
  S("Panini rond", 100, 53),
  S("Panini filet / plat", 180, 78),
  S("Panini filet / plat", 150, 66),
  S("Panini filet mini", 75, 49),
  S("Viennois", 100, 82),
  S("Viennois brioché", 40, 49),
  S("Viennois choco", 40, 53),
  S("Hot dog x5", 500, 413),
  S("Mini hot dog x5", 300, 339),
  S("Pain blanc long", 1000, 674),
  S("Pain complet / seigle / multigrain", 1000, 803),
  S("XXL coupé long / fin", 700, 438),
  S("Pain panier blanc coupé long / fin", 600, 321),
  S("Sandwich coupé long / fin", 550, 340),
];

export const PRODUITS_BY_ID = Object.fromEntries(PRODUITS.map((p) => [p.id, p]));

export const libelle = (p) => `${p.nom} ${p.g} g`;

// Prix HT selon le mode (retrait = grille Fournil, livraison = grille Divers)
export function prixHT(p, mode) {
  if (mode !== "livraison") return p.ht;
  return p.ht + (p.cat === "emballe" ? 10 : 5);
}

export const TGC = 0.03;

export function totaux(lignes, mode) {
  let ht = 0;
  for (const l of lignes) {
    const p = PRODUITS_BY_ID[l.produitId];
    if (p && l.qte > 0) ht += prixHT(p, mode) * l.qte;
  }
  const tgc = Math.round(ht * TGC);
  return { ht, tgc, ttc: ht + tgc };
}

// Découpes : uniquement pour certains pains de mie (liste validée par le service commercial le 2026-11-17).
// « entier » = tranchage habituel du produit (aucune découpe particulière).
export const DECOUPES_DEFAUT = [
  { id: "entier", nom: "Standard", couleur: "#ffffff" },
  { id: "coupe_long", nom: "Coupé long", couleur: "#f9a8d4" },
  { id: "coupe_fin", nom: "Coupé fin", couleur: "#93c5fd" },
  { id: "tranche_2cm", nom: "Tranché à 2 cm", couleur: "#86efac" },
  { id: "non_tranche", nom: "Non tranché", couleur: "#fde047" },
];
// Produit -> découpes possibles (en plus de « Standard »)
export const DECOUPES_PAR_PRODUIT = {
  E54: ["coupe_long"],                 // Panier complet : coupé long
  E64: ["coupe_fin"],                  // Toast XXL : coupé fin
  E4: ["coupe_long", "tranche_2cm"],   // Sandwich : coupé long, tranché à 2 cm
  E66: ["coupe_fin"],                  // Seigle XXL : coupé fin
  E70: ["coupe_fin"],                  // Complet XXL : coupé fin
  E65: ["coupe_fin"],                  // Multigrains XXL : coupé fin
  E13: ["non_tranche"],                // Brioché (tranché 550 g) : non tranché
  E11: ["tranche_2cm"],                // Grand brioché au lait : tranché à 2 cm
  // « Brioché XXL tranché à 2 cm » : produit absent du catalogue 2026 (à vérifier)
};
export const decoupesDe = (produitId) => DECOUPES_PAR_PRODUIT[produitId] || [];
export const decoupeValide = (produitId, d) => (decoupesDe(produitId).includes(d) ? d : "entier");
// Noms et couleurs modifiables par l'équipe, mais la liste des découpes reste fixe
export const fusionDecoupes = (reg) => DECOUPES_DEFAUT.map((d) => ({ ...d, ...((reg || []).find((x) => x.id === d.id) || {}), id: d.id }));

export const TOURNEES = [
  "Livreur 1 — Magenta > Rivière Salée",
  "Livreur 2 — Centre-ville > Orphelinat",
  "Livreur 3 — Faubourg > Magenta",
  "Livreur 4 — Anse Vata",
  "Livreur 5 — Mont-Dore",
  "Livreur 6 — DSM",
  "Livreur 7 — Ducos / Ouémo > Faubourg",
  "Livreur 8 — Païta > La Foa",
  "Livreur 9 — Dumbéa > Katiramona",
  "Arrêt",
  "Fournil",
  "Livraison bateau / avion",
  "Responsable LVS",
  "Sans tournée",
];
