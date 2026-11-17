// Correspondance « nom de produit sur les factures LGL » -> produit du catalogue de l'app (lib/catalog.js).
// Utilisé par import-lgl.js pour construire la liste des produits de chaque client à partir de ses factures.
// Les lignes non-produit (poches, cageots, cartons, « FACTURE CARNET… », avoirs, chapelure) sont ignorées.
const IGNORER = /poche|cageot|cagette|carton|bac perso|facture|avoir|chapelure/i;
const MAP = [
  [/^sandwich 550/i, "E4"], [/^complet grand/i, "E1"], [/^toast xxl c\s*\/\s*fin/i, "E63"], [/^toast xxl/i, "E64"],
  [/^panier complet/i, "E54"], [/^panier blanc/i, "E37"], // « C/Long » = même pain avec la découpe « coupé long »
  [/^c[ée]r[ée]ales/i, "E18"], [/^hamburger x4 600/i, "E36"], [/^hamburger x4/i, "E20"],
  [/^petit panier blanc/i, "E21"], [/^petit panier complet/i, "E73"], [/^lait x2/i, "E33"], [/^lait individuel/i, "S33"], [/^pain au lait/i, "S33"],
  [/^multigrains? xxl c\s*\/\s*fin/i, "E62"], [/^multigrains? xxl/i, "E65"], [/^viennois choco x6/i, "E28"], [/^viennois choco 40/i, "S42"],
  [/^complet xxl/i, "E70"], [/^muffin x3/i, "E72"], [/^muffin au beurre/i, "S32"], [/^muffin nature/i, "S31"],
  [/^pain de mie sans sel/i, "E40"], [/^seigle noix/i, "E23"], [/^seigle raisin/i, "E16"], [/^seigle xxl/i, "E66"],
  [/^grand brioch[ée] au lait/i, "E11"], [/^brioch[ée] tranch[ée]/i, "E13"], [/^panini filet\s*\/\s*plat x5/i, "E68"],
  [/^panini (filet|plat) 180/i, "S37"], [/^panini filet 150/i, "S38"], [/^panini filet mini/i, "S39"], [/^panini rond 200/i, "S35"],
  [/^complet au raisin/i, "E39"], [/^hamburger 300/i, "S16"], [/^hamburger 250/i, "S17"], [/^hamburger 200/i, "S18"], [/^hamburger 150/i, "S19"],
  [/^hamburger 100/i, "S20"], [/^hamburger 80/i, "S21"], [/^hot dog s[ée]same x2/i, "E67"], [/^hot dog avec s[ée]same/i, "S28"],
  [/^hot dog nature/i, "S29"], [/^mini brioch[ée]s x4/i, "E76"], [/^petit complet/i, "E74"], [/^bagels pavot x4/i, "E77"],
  [/^bagna (rond ou plat )?\(kebb?ab\) 100/i, "S3"], [/^bagna .*150/i, "S2"], [/^bagna .*200/i, "S1"],
  [/^panini plat 150/i, "S38"], [/^hamburger brioch[ée] 150/i, "S22"], [/^hamburger brioch[ée] 100/i, "S23"], [/^hamburger brioch[ée] 80/i, "S24"],
  [/^hamburger junior/i, "S25"], [/^hamburger mini/i, "S26"], [/^hot dog x5/i, "S43"], [/^hot dog long 30/i, "S27"],
  [/^pistolet (nature|blanc) 150/i, "S13"], [/^pistolet complet 150/i, "S14"], [/^brioch[ée] canap[ée]/i, "E14"], [/^canap[ée] 375/i, "E19"],
  [/^seigle 220/i, "E9"], [/^pain de f[êe]te brioch/i, "E46"], [/^pain de f[êe]te nature/i, "E47"], [/^baguette$/i, "S12"],
  [/^brioch[ée] 550g? n\s*\/\s*coup/i, "E13"], [/^sandwich (snack|coup[ée] long|non coup|bomb)|^sandwich\.?$/i, "E4"],
  [/^petit mie/i, "E75"], [/^bagel (brioch[ée] )?pavot/i, "S11"], [/^bagel (nature|c[ée]r[ée]ales)?/i, "S10"], [/^complet soja/i, "E25"],
];
function produitFacture(nom) {
  if (IGNORER.test(nom)) return null;
  const r = MAP.find(([re]) => re.test(nom.trim()));
  return r ? r[1] : undefined; // undefined = produit réel inconnu du catalogue
}
module.exports = { produitFacture };
