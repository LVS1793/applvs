// Catalogue de l'app = liste des produits du LGL en ligne (gestion.lvs.nc → Produits), fichier produits-lgl.json :
// noms exacts et prix de vente tels que facturés. Familles retenues : pains de snack, pains en tranches, baguettes.
// cat : « emballe » (pains en tranches, 48 h pour une commande en plus) ou « snack » (24 h).
import PRODUITS_LGL from "./produits-lgl.json";
import { PRODUITS_ANCIENS } from "./catalogue-ancien";

const FAMILLES = { "Pains en tranches": "emballe", "Pains de snack": "snack", "Baguettes": "snack" };
export const PRODUITS = PRODUITS_LGL
  .filter((p) => FAMILLES[p.famille] && p.prix > 0)
  .map((p) => ({ id: "L" + p.lgl, lgl: p.lgl, ref: p.ref || null, nom: p.nom, ht: p.prix, famille: p.famille, cat: FAMILLES[p.famille] }))
  .sort((a, b) => a.nom.localeCompare(b.nom, "fr"));

// Les anciens identifiants (E…, S…) restent connus pour l'affichage des commandes déjà enregistrées
export const PRODUITS_BY_ID = Object.fromEntries([...PRODUITS_ANCIENS.map((p) => [p.id, { ...p, ancien: true }]), ...PRODUITS.map((p) => [p.id, p])]);

export const libelle = (p) => (p.ancien ? `${p.nom} ${p.g} g` : p.nom);

// Prix HT : d'abord le prix réellement facturé à CE client (dernières factures LGL, prixClient = { L69: 71, … }),
// sinon le prix de vente LGL. Anciens produits : ancienne grille (+10 / +5 en livraison).
export function prixHT(p, mode, prixClient) {
  if (prixClient && prixClient[p.id] > 0) return prixClient[p.id];
  if (!p.ancien || mode !== "livraison") return p.ht;
  return p.ht + (p.cat === "emballe" ? 10 : 5);
}

export const TGC = 0.03;

export function totaux(lignes, mode, prixClient) {
  let ht = 0;
  for (const l of lignes) {
    const p = PRODUITS_BY_ID[l.produitId];
    if (p && l.qte > 0) ht += prixHT(p, mode, prixClient) * l.qte;
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
  L36: ["coupe_long"],                 // Panier Complet 550g : coupé long
  L41: ["coupe_fin"],                  // Toast XXL 700g : coupé fin
  L1: ["coupe_long", "tranche_2cm"],   // Sandwich 550g : coupé long, tranché à 2 cm
  L44: ["coupe_fin"],                  // Seigle XXL 700g : coupé fin
  L42: ["coupe_fin"],                  // Complet XXL 700g : coupé fin
  L43: ["coupe_fin"],                  // Multigrains XXL 700g : coupé fin
  L16: ["non_tranche"],                // Brioché Tranché 550g : non tranché
  L15: ["tranche_2cm"],                // Grand Brioché au Lait 550g : tranché à 2 cm
  // « Brioché XXL tranché à 2 cm » : produit absent du catalogue 2026 (à vérifier)
};
export const decoupesDe = (produitId) => DECOUPES_PAR_PRODUIT[produitId] || [];
export const decoupeValide = (produitId, d) => (decoupesDe(produitId).includes(d) ? d : "entier");
// Noms et couleurs modifiables par l'équipe, mais la liste des découpes reste fixe
export const fusionDecoupes = (reg) => DECOUPES_DEFAUT.map((d) => ({ ...d, ...((reg || []).find((x) => x.id === d.id) || {}), id: d.id }));

// Libellés identiques à LGL (Base de Données LGL)
export const TOURNEES = [
  "Livreur 1 : Magenta > Rivière Salée",
  "Livreur 2 : Centre Ville > Orphelinat",
  "Livreur 3 : Faubourg > Magenta",
  "Livreur 4 : Anse Vata",
  "Livreur 5 : Mont Dore",
  "Livreur 6 : DSM",
  "Livreur 7 : Ducos / Ouemo > Faubourg",
  "Livreur 8 : Païta > La Foa",
  "Livreur 9 : Dumbéa > Katiramona",
  "Fournil",
  "Livraison Bateau / Avion",
  "Responsable LVS",
  "Sans tournée"
];
