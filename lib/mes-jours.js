// Commandes d'un client pour les 8 prochains jours ouvrés (commandes d'office comprises)
import { verifierDate, maintenantNC } from "./rules";
import { commandesDuJour } from "./store";
import { officeDuClient } from "./office";

export async function mesJours(client) {
  const now = maintenantNC();
  const jours = [];
  const d = new Date(now.date + "T12:00:00Z");
  while (jours.length < 8) {
    d.setUTCDate(d.getUTCDate() + 1);
    if (d.getUTCDay() !== 0) jours.push(d.toISOString().slice(0, 10));
  }
  return Promise.all(jours.map(async (date) => {
    const [office, duJour] = await Promise.all([officeDuClient(client, date), commandesDuJour(date)]);
    const autres = duJour.filter((c) => c.clientId === client.id && !c.office);
    // Commande d'office : modifiable jusqu'à la veille 13 h (jour ouvré), quels que soient les produits
    return { date, office, autres, modifiable: !verifierDate(date, office?.mode || "livraison", false, now) };
  }));
}
