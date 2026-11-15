// Règles horaires (Conditions de commande 2026) — heure de Nouméa
// - Toutes les commandes avant 13 h.
// - Snacking : 24 h à l'avance (1 jour ouvré avant, avant 13 h).
// - Pains emballés / spéciaux : 48 h à l'avance (2 jours ouvrés avant, avant 13 h).
// - Jours ouvrés : lundi à samedi. Livraison du lundi -> commande le samedi avant 13 h.
// - Livraison lundi-samedi ; retrait au fournil lundi-vendredi.

export const HEURE_LIMITE = 13;
const TZ = "Pacific/Noumea";

export function maintenantNC() {
  const s = new Date().toLocaleString("sv-SE", { timeZone: TZ }); // "2026-11-16 10:42:00"
  const [d, t] = s.split(" ");
  return { date: d, heure: Number(t.slice(0, 2)), minute: Number(t.slice(3, 5)) };
}

const toDate = (s) => new Date(s + "T12:00:00Z");
const fmt = (d) => d.toISOString().slice(0, 10);
export const jourSemaine = (s) => toDate(s).getUTCDay(); // 0 = dimanche

function reculerJoursOuvres(s, n) {
  const d = toDate(s);
  while (n > 0) {
    d.setUTCDate(d.getUTCDate() - 1);
    if (d.getUTCDay() !== 0) n--;
  }
  return fmt(d);
}

export function dateLimite(dateLivraison, aEmballes) {
  return reculerJoursOuvres(dateLivraison, aEmballes ? 2 : 1);
}

// Retourne null si OK, sinon un message d'erreur
export function verifierDate(dateLivraison, mode, aEmballes, now = maintenantNC()) {
  const j = jourSemaine(dateLivraison);
  if (j === 0) return "Pas de livraison ni de retrait le dimanche.";
  if (mode === "retrait" && j === 6) return "Le fournil est ouvert du lundi au vendredi (6 h – 12 h).";
  const lim = dateLimite(dateLivraison, aEmballes);
  if (now.date < lim) return null;
  if (now.date === lim && now.heure < HEURE_LIMITE) return null;
  const delai = aEmballes ? "48 h pour les pains emballés" : "24 h pour le snacking";
  return `Trop tard pour cette date : il fallait commander avant le ${frDate(lim)} à 13 h (délai ${delai}).`;
}

// Prochaines dates possibles (14 jours)
export function datesPossibles(mode, aEmballes) {
  const now = maintenantNC();
  const out = [];
  const d = toDate(now.date);
  for (let i = 0; i < 16; i++) {
    d.setUTCDate(d.getUTCDate() + 1);
    const s = fmt(d);
    if (!verifierDate(s, mode, aEmballes, now)) out.push(s);
  }
  return out;
}

export function frDate(s) {
  return toDate(s).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
}
