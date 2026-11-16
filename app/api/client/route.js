import { NextResponse } from "next/server";
import { clients, get, incrementer, lireCompteur } from "@/lib/store";
import { DECOUPES_DEFAUT } from "@/lib/catalog";
import { paiementActif } from "@/lib/stripe";
import { payzenActif } from "@/lib/payzen";
import { setSession, sessionClient, clearSession, hashCode } from "@/lib/auth";

const refClient = (id) => hashCode("ref:" + id).slice(0, 16);

export const dynamic = "force-dynamic";

// GET : liste des noms (menu déroulant) + session courante + historique
const enArret = (t) => /^\s*arr[eêé]t/i.test(t || "");
const clientsActifs = async () => (await clients()).filter((c) => !enArret(c.tournee));

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
        livreur: c.livreur || null, type: c.type || null, habitudes: c.habitudes || null, remarque: c.remarque || null,
      };
    }
    historique = await get(`hist:${s.comptant ? "cpt:" + s.nom : s.id}`, []);
  }
  return NextResponse.json({
    // L'ID LGL sert de code : on ne l'expose pas, on envoie une référence opaque
    clients: liste.map((c) => ({ id: refClient(c.id), nom: c.nom })).sort((a, b) => a.nom.localeCompare(b.nom)),
    moi, historique, paiementEnLigne: paiementActif || payzenActif,
    decoupes: ((await get("reglages")) || {}).decoupes || DECOUPES_DEFAUT,
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
  const liste = await clientsActifs();
  const c = liste.find((x) => refClient(x.id) === String(b.clientId));
  if (!c) return NextResponse.json({ erreur: "Client introuvable." }, { status: 404 });
  const kf = `essais:${c.id}`;
  if ((await lireCompteur(kf)) >= 8) return NextResponse.json({ erreur: "Trop d'essais. Réessayez dans 15 minutes ou appelez La Vie Saine." }, { status: 429 });
  // Code client = ID LGL, sauf si un code spécifique a été défini dans l'espace La Vie Saine
  const ok = c.codeHash ? c.codeHash === hashCode(b.code) : String(b.code || "").trim() === c.id;
  if (!ok) { await incrementer(kf, 900); return NextResponse.json({ erreur: "Code incorrect." }, { status: 401 }); }
  setSession("lvs_client", { id: c.id });
  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  clearSession("lvs_client");
  return NextResponse.json({ ok: true });
}
