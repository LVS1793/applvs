// Commandes d'office : pour un client qui a une commande habituelle (fiches de chargement / commandes d'office),
// la commande du jour existe automatiquement, sans qu'il ait à la passer.
// Elle est « virtuelle » tant que personne n'y touche ; si le client ou l'équipe la modifie ou l'annule,
// elle est enregistrée avec l'identifiant fixe off-<ID client>, qui remplace alors la version automatique.
import { PRODUITS_BY_ID, totaux } from "./catalog";
import { jourSemaine } from "./rules";
import { clients, commandesDuJour, lireCommande } from "./store";

const JOURS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
export const jourDe = (date) => JOURS[jourSemaine(date)];
export const idOffice = (clientId) => `off-${clientId}`;
const enArret = (t) => /^\s*arr[eêé]t/i.test(t || "");

export function habitudeDuJour(client, date) {
  const h = client?.habitudes?.[jourDe(date)];
  if (!h) return null;
  const lignes = h.lignes.filter((l) => PRODUITS_BY_ID[l.produitId] && l.qte > 0)
    .map((l) => ({ produitId: l.produitId, qte: l.qte, decoupe: "entier", ok: false }));
  return lignes.length ? { lignes, texte: h.texte || "" } : null;
}

export function genererOffice(client, date) {
  const h = habitudeDuJour(client, date);
  if (!h) return null;
  const mode = client.mode === "retrait" ? "retrait" : "livraison";
  return {
    id: idOffice(client.id), office: true, auto: true,
    date, mode, clientId: client.id, clientNom: client.nom,
    tournee: mode === "retrait" ? "Fournil" : client.tournee || "Sans tournée",
    paiement: ["comptant", "livraison"].includes(client.paiement) ? client.paiement : "compte",
    reglement: client.reglement || null,
    livreur: mode === "retrait" ? null : client.livreur || null,
    lignes: h.lignes, note: h.texte ? `Habitude : ${h.texte}` : "", supplement: "", inhabituels: [],
    ...totaux(h.lignes, mode),
    statut: client.paiement === "comptant" ? "a_payer" : "confirmee",
    okProduit: null, creeLe: `${date}T00:00:00.000Z`,
  };
}

// Commande d'office d'un client pour une date : version enregistrée (modifiée / annulée) ou version automatique
export async function officeDuClient(client, date) {
  return (await lireCommande(date, idOffice(client.id))) || genererOffice(client, date);
}

// Toutes les commandes d'une date pour l'équipe : commandes enregistrées + commandes d'office automatiques
export async function toutesLesCommandes(date) {
  const stockees = await commandesDuJour(date);
  const dejaLa = new Set(stockees.map((c) => c.id));
  const auto = (await clients())
    .filter((c) => !enArret(c.tournee) && (!c.categorie || c.categorie === "snack") && c.habitudes && !dejaLa.has(idOffice(c.id)))
    .map((c) => genererOffice(c, date)).filter(Boolean);
  return [...stockees, ...auto].sort((a, b) => (a.tournee || "").localeCompare(b.tournee || "") || a.clientNom.localeCompare(b.clientNom));
}
