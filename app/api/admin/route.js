import { NextResponse } from "next/server";
import crypto from "crypto";
import { clients, get, set, persistant, incrementer, lireCompteur } from "@/lib/store";
import { setSession, clearSession, estAdmin, hashCode } from "@/lib/auth";
import { fusionDecoupes } from "@/lib/catalog";
import { paiementActif } from "@/lib/stripe";
import { supabaseActif, definirAcces, genererMotDePasse, supprimerAcces } from "@/lib/supabase";
import { payzenActif } from "@/lib/payzen";

export const dynamic = "force-dynamic";
const enArret = (t) => /^\s*arr[eêé]t/i.test(t || "");
const PASS =process.env.ADMIN_PASSWORD || "laviesaine";

// GET : état (connecté ?), clients, réglages
export async function GET() {
  if (!estAdmin()) return NextResponse.json({ admin: false });
  const reg = (await get("reglages")) || {};
  const liste = await clients();
  return NextResponse.json({
    admin: true, persistant, paiementActif: paiementActif || payzenActif,
    decoupes: fusionDecoupes(reg.decoupes),
    clients: liste.map(({ codeHash, supaId, ...c }) => ({ ...c, aCode: !!codeHash, aAcces: !!supaId })), supabaseActif,
  });
}

// POST { action: "login" | "import" | "client" | "decoupes" | "logout" }
export async function POST(req) {
  const b = await req.json();
  if (b.action === "login") {
    const ip = (req.headers.get("x-forwarded-for") || "local").split(",")[0].trim();
    if ((await lireCompteur(`essais-admin:${ip}`)) >= 10) return NextResponse.json({ erreur: "Trop d'essais, réessayez dans 15 minutes." }, { status: 429 });
    const a = Buffer.from(String(b.motDePasse || "")), p = Buffer.from(PASS);
    if (a.length !== p.length || !crypto.timingSafeEqual(a, p)) {
      await incrementer(`essais-admin:${ip}`, 900);
      return NextResponse.json({ erreur: "Mot de passe incorrect" }, { status: 401 });
    }
    setSession("lvs_admin", { admin: true });
    return NextResponse.json({ ok: true });
  }
  if (b.action === "logout") { clearSession("lvs_admin"); return NextResponse.json({ ok: true }); }
  if (!estAdmin()) return NextResponse.json({ erreur: "Non autorisé" }, { status: 401 });

  if (b.action === "import") {
    // Texte collé depuis Excel (LGL) : ID ; Nom ; Tournée ; Paiement (compte/comptant) ; Code
    const liste = await clients();
    const parId = new Map(liste.map((c) => [c.id, c]));
    let n = 0;
    for (const raw of String(b.texte || "").split(/\r?\n/)) {
      const cols = raw.split(/\t|;/).map((x) => x.trim());
      if (!cols[0] || !cols[1] || /^id$/i.test(cols[0])) continue;
      const c = parId.get(cols[0]) || { id: cols[0] };
      c.nom = cols[1];
      if (cols[2]) c.tournee = cols[2];
      if (!c.tournee) c.tournee = "Sans tournée";
      if (cols[3]) c.paiement = /comptant|cash|esp/i.test(cols[3]) ? "comptant" : /livr/i.test(cols[3]) ? "livraison" : "compte";
      if (!c.paiement) c.paiement = "compte";
      if (cols[4]) c.codeHash = hashCode(cols[4]);
      parId.set(c.id, c); n++;
    }
    await set("clients", [...parId.values()]);
    return NextResponse.json({ ok: true, n });
  }
  if (b.action === "importLGL") {
    // Fichier lgl-clients.json produit par scripts/import-lgl.js
    const liste = await clients();
    const parId = new Map(liste.map((c) => [c.id, c]));
    let n = 0;
    for (const s of b.data?.clients || []) {
      if (!s.id || !s.nom) continue;
      if (enArret(s.tournee)) { parId.delete(String(s.id)); continue; } // anciens clients : retirés
      const c = parId.get(String(s.id)) || { id: String(s.id) };
      const garde = Object.fromEntries((c.manuel || []).map((k) => [k, c[k]])); // modifications faites dans l'espace équipe
      Object.assign(c, {
        nom: s.nom, tournee: s.tournee || "Sans tournée", livreur: s.livreur || null, type: s.type || null,
        paiement: s.reglement ? (s.reglement === "comptant" ? "livraison" : "compte") : s.paiement || c.paiement || "compte",
        reglement: s.reglement || null, habitudes: s.habitudes || null, remarque: s.remarque || null, produits: s.produits || null, categorie: s.categorie || null,
        mode: c.mode || (/fournil/i.test(s.tournee || "") ? "retrait" : "livraison"),
      }, garde);
      parId.set(c.id, c); n++;
    }
    // Import complet (liste LGL entière) : les clients absents de LGL (ou passés en « Arrêt ») sont retirés
    const presents = new Set((b.data?.clients || []).map((x) => String(x.id)));
    await set("clients", [...parId.values()].filter((c) => !enArret(c.tournee) && (!b.data?.complet || presents.has(c.id))));
    if (b.data?.livreurs) await set("livreurs", b.data.livreurs);
    return NextResponse.json({ ok: true, n });
  }
  if (b.action === "client") {
    const liste = await clients();
    if (!String(b.id || "").trim()) return NextResponse.json({ erreur: "ID manquant" }, { status: 400 });
    let c = liste.find((x) => x.id === String(b.id));
    if (b.supprimer) { if (c) await supprimerAcces(c); await set("clients", liste.filter((x) => x !== c)); return NextResponse.json({ ok: true }); }
    if (!c) { c = { id: String(b.id) }; liste.push(c); }
    const LIVREURS = { 1: "Jules", 2: "Tita", 3: "Edmond", 4: "Franck", 5: "Alexis", 6: "Antoine", 7: "Tomasi", 8: "Yoann" };
    const manuel = new Set(c.manuel || []);
    for (const k of ["nom", "tournee", "paiement", "mode", "categorie", "livreur"]) if (b[k] != null && b[k] !== c[k]) { c[k] = b[k]; manuel.add(k); }
    if (b.tournee != null && b.livreur == null) { // livreur et mode déduits de la tournée
      const n = (String(b.tournee).match(/Livreur\s*(\d+)/i) || [])[1];
      c.livreur = n ? LIVREURS[n] || null : null; manuel.add("livreur");
      if (b.mode == null) { c.mode = /fournil/i.test(b.tournee) ? "retrait" : "livraison"; manuel.add("mode"); }
    }
    c.manuel = [...manuel];
    if (b.code) c.codeHash = hashCode(b.code);
    if (b.resetCode) delete c.codeHash; // le client recrée son mot de passe à la prochaine connexion
    await set("clients", liste);
    return NextResponse.json({ ok: true });
  }
  // Accès Supabase des clients : création ou réinitialisation (le mot de passe n'est montré qu'une fois)
  if (b.action === "acces" || b.action === "accesTous") {
    if (!supabaseActif) return NextResponse.json({ erreur: "Supabase n'est pas encore configuré." }, { status: 503 });
    const liste = await clients();
    const cibles = b.action === "acces"
      ? liste.filter((c) => c.id === String(b.id))
      : liste.filter((c) => !c.supaId && (!c.categorie || c.categorie === "snack") && !enArret(c.tournee));
    const crees = [];
    for (const c of cibles) {
      const mdp = b.action === "acces" && b.motDePasse ? String(b.motDePasse) : genererMotDePasse();
      if (mdp.length < 6) return NextResponse.json({ erreur: "6 caractères minimum." }, { status: 400 });
      try { c.supaId = await definirAcces(c, mdp); c.accesModifieLe = new Date().toISOString(); crees.push({ id: c.id, nom: c.nom, motDePasse: mdp }); }
      catch (e) { crees.push({ id: c.id, nom: c.nom, erreur: e.message }); }
    }
    await set("clients", liste);
    return NextResponse.json({ ok: true, crees });
  }
  if (b.action === "decoupes") {
    const reg = (await get("reglages")) || {};
    reg.decoupes = fusionDecoupes((b.decoupes || []).filter((d) => d.id && d.nom));
    await set("reglages", reg);
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ erreur: "Action inconnue" }, { status: 400 });
}
