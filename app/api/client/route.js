import { NextResponse } from "next/server";
import { clients, get, set, incrementer, lireCompteur } from "@/lib/store";
import { fusionDecoupes } from "@/lib/catalog";
import { paiementActif } from "@/lib/stripe";
import { payzenActif } from "@/lib/payzen";
import { setSession, sessionClient, clearSession, hashCode } from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET : liste des noms (menu déroulant) + session courante + historique
const enArret = (t) => /^\s*arr[eêé]t/i.test(t || "");
// Application réservée aux snacks : les magasins (planning de livraison) et les autres clients n'y ont pas accès.
const estSnack = (c) => !c.categorie || c.categorie === "snack";
const clientsActifs = async () => (await clients()).filter((c) => !enArret(c.tournee) && estSnack(c));

export async function GET() {
  const liste = await clientsActifs();
  const s = sessionClient();
  let moi = null, historique = [];
  if (s) {
    if (s.comptant) moi = { nom: s.nom, paiement: "comptant", tournee: "Sans tournée", comptant: true };
    else {
      const c = liste.find((x) => x.id === s.id);
      if (c) moi = {
        id: c.id, nom: c.nom, paiement: c.paiement, tournee: c.tournee, mode: c.mode || "livraison",
        livreur: c.livreur || null, type: c.type || null, habitudes: c.habitudes || null, remarque: c.remarque || null, produits: c.produits || null,
      };
    }
    historique = await get(`hist:${s.comptant ? "cpt:" + s.nom : s.id}`, []);
  }
  return NextResponse.json({
    // Aucune liste d'établissements n'est envoyée : le client se connecte avec son numéro (ID LGL).
    moi, historique, paiementEnLigne: paiementActif || payzenActif,
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
  if (!c) { await incrementer(kf, 900); return NextResponse.json({ erreur: "Numéro client inconnu. Vérifiez votre numéro ou appelez La Vie Saine." }, { status: 401 }); }
  // Connexion simple : le numéro client (ID LGL) suffit.
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
  if (c.codeHash && c.codeHash !== hashCode(b.ancienCode)) return NextResponse.json({ erreur: "Ancien mot de passe incorrect." }, { status: 401 });
  c.codeHash = hashCode(nouveau);
  await set("clients", liste);
  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  clearSession("lvs_client");
  return NextResponse.json({ ok: true });
}
