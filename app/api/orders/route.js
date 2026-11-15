import { NextResponse } from "next/server";
import crypto from "crypto";
import { clients, commandesDuJour, enregistrerCommandes, get, set } from "@/lib/store";
import { sessionClient, estAdmin } from "@/lib/auth";
import { PRODUITS_BY_ID, totaux, DECOUPES_DEFAUT } from "@/lib/catalog";
import { verifierDate } from "@/lib/rules";
import { creerCheckout } from "@/lib/stripe";

export const dynamic = "force-dynamic";

const MINIMUM_LIVRAISON = 3000;

// GET ?date=AAAA-MM-JJ (La Vie Saine)
export async function GET(req) {
  if (!estAdmin()) return NextResponse.json({ erreur: "Non autorisé" }, { status: 401 });
  const date = new URL(req.url).searchParams.get("date");
  return NextResponse.json({ commandes: await commandesDuJour(date) });
}

// POST : nouvelle commande client
export async function POST(req) {
  const s = sessionClient();
  if (!s) return NextResponse.json({ erreur: "Connectez-vous d'abord." }, { status: 401 });
  const b = await req.json();

  let client;
  if (s.comptant) client = { id: null, nom: s.nom, paiement: "comptant", tournee: "Sans tournée" };
  else {
    client = (await clients()).find((c) => c.id === s.id);
    if (!client) return NextResponse.json({ erreur: "Compte introuvable." }, { status: 404 });
  }

  const mode = b.mode === "retrait" ? "retrait" : "livraison";
  const reglages = (await get("reglages")) || {};
  const decoupesOk = new Set((reglages.decoupes || DECOUPES_DEFAUT).map((d) => d.id).concat("entier"));
  const lignes = (b.lignes || [])
    .map((l) => ({ produitId: l.produitId, qte: Math.max(0, Math.floor(Number(l.qte) || 0)), decoupe: decoupesOk.has(l.decoupe) ? l.decoupe : "entier", ok: false }))
    .filter((l) => l.qte > 0 && PRODUITS_BY_ID[l.produitId]);
  if (!lignes.length) return NextResponse.json({ erreur: "La commande est vide." }, { status: 400 });

  const aEmballes = lignes.some((l) => PRODUITS_BY_ID[l.produitId].cat === "emballe");
  const errDate = verifierDate(b.date, mode, aEmballes);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(b.date || "") || errDate) return NextResponse.json({ erreur: errDate || "Date invalide." }, { status: 400 });

  const t = totaux(lignes, mode);
  if (mode === "livraison" && t.ht < MINIMUM_LIVRAISON)
    return NextResponse.json({ erreur: `Minimum de livraison : ${MINIMUM_LIVRAISON} XPF HT (actuel : ${t.ht} XPF). Ajoutez des produits ou choisissez le retrait au fournil.` }, { status: 400 });

  const cmd = {
    id: crypto.randomUUID().slice(0, 8),
    date: b.date, mode,
    clientId: client.id, clientNom: client.nom,
    tournee: mode === "retrait" ? "Fournil" : client.tournee || "Sans tournée",
    paiement: client.paiement === "comptant" ? "comptant" : "compte",
    lignes, note: String(b.note || "").slice(0, 500),
    ...t,
    statut: client.paiement === "comptant" ? "a_payer" : "confirmee",
    okProduit: null,
    creeLe: new Date().toISOString(),
  };

  let checkoutUrl = null;
  if (cmd.paiement === "comptant") {
    const r = await creerCheckout(cmd, new URL(req.url).origin);
    if (r.erreur) return NextResponse.json({ erreur: r.erreur }, { status: 503 });
    cmd.stripeSession = r.id;
    checkoutUrl = r.url;
  }

  const liste = await commandesDuJour(cmd.date);
  liste.push(cmd);
  await enregistrerCommandes(cmd.date, liste);

  // Historique client (pré-remplissage)
  const hk = `hist:${s.comptant ? "cpt:" + s.nom : s.id}`;
  const hist = await get(hk, []);
  hist.unshift({ id: cmd.id, date: cmd.date, mode, lignes: lignes.map(({ produitId, qte, decoupe }) => ({ produitId, qte, decoupe })), ttc: cmd.ttc, statut: cmd.statut });
  await set(hk, hist.slice(0, 15));

  return NextResponse.json({ commande: cmd, checkoutUrl });
}

// PATCH (La Vie Saine) : { date, id, action: "ok" | "ligne" | "annuler" | "payee", index, par }
export async function PATCH(req) {
  if (!estAdmin()) return NextResponse.json({ erreur: "Non autorisé" }, { status: 401 });
  const b = await req.json();
  const liste = await commandesDuJour(b.date);
  const c = liste.find((x) => x.id === b.id);
  if (!c) return NextResponse.json({ erreur: "Commande introuvable" }, { status: 404 });
  if (b.action === "ligne") c.lignes[b.index].ok = !c.lignes[b.index].ok;
  if (b.action === "ok") c.okProduit = c.okProduit ? null : { par: String(b.par || "").slice(0, 40), le: new Date().toISOString() };
  if (b.action === "annuler") c.statut = c.statut === "annulee" ? "confirmee" : "annulee";
  if (b.action === "payee") c.statut = "confirmee";
  await enregistrerCommandes(b.date, liste);
  return NextResponse.json({ commande: c });
}
