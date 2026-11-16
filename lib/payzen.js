// Paiement par PayZen / Lyra (formulaire de paiement V2), solution proposée par les banques en Nouvelle-Calédonie.
// Variables : PAYZEN_SITE_ID, PAYZEN_KEY (clé de test ou de production), PAYZEN_MODE (TEST|PRODUCTION),
// PAYZEN_URL (URL de la page de paiement fournie par la banque, par défaut Lyra).
import crypto from "crypto";

const SITE = process.env.PAYZEN_SITE_ID;
const KEY = process.env.PAYZEN_KEY;
const MODE = process.env.PAYZEN_MODE || "TEST";
const URL_PAIEMENT = process.env.PAYZEN_URL || "https://secure.lyra.com/vads-payment/";
export const payzenActif = !!(SITE && KEY);

function signer(champs) {
  const vads = Object.keys(champs).filter((k) => k.startsWith("vads_")).sort().map((k) => champs[k]);
  return crypto.createHmac("sha256", KEY).update([...vads, KEY].join("+")).digest("base64");
}

export function formulairePayzen(cmd, origin) {
  const now = new Date();
  const p = (n) => String(n).padStart(2, "0");
  const champs = {
    vads_action_mode: "INTERACTIVE",
    vads_amount: String(cmd.ttc), // XPF : pas de décimales
    vads_ctx_mode: MODE,
    vads_currency: "953", // XPF
    vads_order_id: `${cmd.date}_${cmd.id}`,
    vads_page_action: "PAYMENT",
    vads_payment_config: "SINGLE",
    vads_site_id: SITE,
    vads_trans_date: `${now.getUTCFullYear()}${p(now.getUTCMonth() + 1)}${p(now.getUTCDate())}${p(now.getUTCHours())}${p(now.getUTCMinutes())}${p(now.getUTCSeconds())}`,
    vads_trans_id: crypto.randomInt(0, 899999).toString().padStart(6, "0"),
    vads_version: "V2",
    vads_url_return: `${origin}/client?paye=1&date=${cmd.date}&id=${cmd.id}`,
    vads_url_check: `${origin}/api/pay/payzen`,
    vads_return_mode: "GET",
  };
  champs.signature = signer(champs);
  return { action: URL_PAIEMENT, champs };
}

// Notification serveur (IPN) : vérifie la signature et renvoie { date, id, montant, paye }
export function verifierNotification(champs) {
  if (!payzenActif || !champs.signature || signer(champs) !== champs.signature) return null;
  const [date, id] = String(champs.vads_order_id || "").split("_");
  return { date, id, montant: Number(champs.vads_amount), paye: ["AUTHORISED", "CAPTURED", "ACCEPTED"].includes(champs.vads_trans_status) };
}
