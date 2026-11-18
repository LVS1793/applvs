import { NextResponse } from "next/server";
import { clients, get, set, incrementer, lireCompteur } from "@/lib/store";
import { fusionDecoupes } from "@/lib/catalog";
import { paiementActif } from "@/lib/stripe";
import { payzenActif } from "@/lib/payzen";
import { setSession, sessionClient, clearSession, hashCode } from "@/lib/auth";
import { supabaseActif, verifierClient, definirAcces } from "@/lib/supabase";
import { mesJours } from "@/lib/mes-jours";

export const dynamic = "force-dynamic";

// GET : liste des noms (menu déroulant) + session courante + historique
const enArret = (t) => /^\s*arr[eêé]t/i.test(t || "");
// Application réservée aux snacks : les magasins (planning de livraison) et les autres clients n'y ont pas accès.
const estSnack = (c) => !c.categorie || c.categorie === "snack";
const clientsActifs = async () => (await clients()).filter((c) => !enArret(c.tournee) && estSnack(c));

export async function GET() {
  const liste = await clientsActifs();
  const s = sessionClient();
  let moi = null, historique = [], jours = null;
  if (s) {
    if (s.comptant) moi = { nom: s.nom, paiement: "comptant", tournee: "Sans tournée", comptant: true };
    else {
      const c = liste.find((x) => x.id === s.id);
      if (c) moi = {
        id: c.id, nom: c.nom, paiement: c.paiement, reglement: c.reglement || null, tournee: c.tournee, mode: c.mode || "livraison",
        livreur: c.livreur || null, type: c.type || null, habitudes: c.habitudes || null, remarque: c.remarque || null, produits: c.produits || null, prix: c.prix || null,
      };
    }
    const c = !s.comptant && liste.find((x) => x.id === s.id);
    [historique, jours] = await Promise.all([
      get(`hist:${s.comptant ? "cpt:" + s.nom : s.id}`, []),
      c && c.habitudes ? mesJours(c) : null,
    ]);
  }
  return NextResponse.json({
    // Aucune liste d'établissements n'est envoyée : le client se connecte avec son numéro (ID LGL).
    moi, historique, jours, paiementEnLigne: paiementActif || payzenActif, motDePasseRequis: supabaseActif,
    decoupes: fusionDecoupes(((await get("reglages")) || {}).decoupes),
  });
}

// POST : connexion { clientId, code } ou client au comptant { comptant: true, nom }
export async function POST(req) {
  const b = await req.json();
  if (b.comptant && process.env.AUTORISER_SANS_COMPTE === "1") {
    const nom = String(b.nom || "").trim().slice(0, 80);
    if (nom.length < 2) return NextResponse.json({ erreur: "Indiquez le nom du snack ou de l'entreprise." }, { status: 400 });
    setSession("lvs_client", { comptant: true, nom });
    return NextResponse.json({ ok: true });
  }
  // Limite d'essais par appareil (adresse IP) : empêche de tester tous les numéros
  const ip = (req.headers.get("x-forwarded-for") || "local").split(",")[0].trim();
  const kf = `essais-client:${ip}`;
  if ((await lireCompteur(kf)) >= 10) return NextResponse.json({ erreur: "Trop d'essais. Réessayez dans 15 minutes ou appelez La Vie Saine." }, { status: 429 });
  const numero = String(b.numero || "").trim();
  const c = (await clientsActifs()).find((x) => x.id === numero);
  if (!c) { await incrementer(kf, 900); return NextResponse.json({ erreur: "ID client inconnu. Vérifiez votre ID (reçu par mail) ou appelez La Vie Saine au 27 59 82." }, { status: 401 }); }
  // Authentification Supabase : chaque client a son mot de passe personnel (créé par La Vie Saine).
  if (supabaseActif) {
    if (!c.supaId) return NextResponse.json({ besoinCode: true, erreur: "Votre accès n'est pas encore créé : appelez La Vie Saine au 27 59 82." }, { status: 401 });
    if (!b.code) return NextResponse.json({ besoinCode: true, erreur: "Saisissez votre mot de passe." }, { status: 401 });
    if (!(await verifierClient(c.id, b.code))) { await incrementer(kf, 900); return NextResponse.json({ besoinCode: true, erreur: "Numéro client ou mot de passe incorrect." }, { status: 401 }); }
  }
  setSession("lvs_client", { id: c.id });
  return NextResponse.json({ ok: true });
}

// PUT { nouveauCode, ancienCode? } : création ou changement du mot de passe personnel du client connecté
export async function PUT(req) {
  const s = sessionClient();
  if (!s || s.comptant) return NextResponse.json({ erreur: "Connectez-vous d'abord." }, { status: 401 });
  const b = await req.json();
  const nouveau = String(b.nouveauCode || "");
  if (nouveau.length < 6) return NextResponse.json({ erreur: "Le mot de passe doit faire au moins 6 caractères." }, { status: 400 });
  const liste = await clients();
  const c = liste.find((x) => x.id === s.id);
  if (!c) return NextResponse.json({ erreur: "Compte introuvable." }, { status: 404 });
  if (nouveau.trim() === c.id) return NextResponse.json({ erreur: "Le mot de passe ne peut pas être votre numéro client." }, { status: 400 });
  if (supabaseActif) {
    if (!(await verifierClient(c.id, b.ancienCode))) return NextResponse.json({ erreur: "Mot de passe actuel incorrect." }, { status: 401 });
    c.supaId = await definirAcces(c, nouveau);
    c.accesModifieLe = new Date().toISOString();
    await set("clients", liste);
    return NextResponse.json({ ok: true });
  }
  if (c.codeHash && c.codeHash !== hashCode(b.ancienCode)) return NextResponse.json({ erreur: "Ancien mot de passe incorrect." }, { status: 401 });
  c.codeHash = hashCode(nouveau);
  await set("clients", liste);
  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  clearSession("lvs_client");
  return NextResponse.json({ ok: true });
}
