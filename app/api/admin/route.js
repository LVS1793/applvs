import { NextResponse } from "next/server";
import crypto from "crypto";
import { clients, get, set, persistant } from "@/lib/store";
import { setSession, clearSession, estAdmin, hashCode } from "@/lib/auth";
import { DECOUPES_DEFAUT } from "@/lib/catalog";
import { paiementActif } from "@/lib/stripe";

export const dynamic = "force-dynamic";
const PASS = process.env.ADMIN_PASSWORD || "laviesaine";

// GET : état (connecté ?), clients, réglages
export async function GET() {
  if (!estAdmin()) return NextResponse.json({ admin: false });
  const reg = (await get("reglages")) || {};
  const liste = await clients();
  return NextResponse.json({
    admin: true, persistant, paiementActif,
    decoupes: reg.decoupes || DECOUPES_DEFAUT,
    clients: liste.map(({ codeHash, ...c }) => ({ ...c, aCode: !!codeHash })),
  });
}

// POST { action: "login" | "import" | "client" | "decoupes" | "logout" }
export async function POST(req) {
  const b = await req.json();
  if (b.action === "login") {
    const a = Buffer.from(String(b.motDePasse || "")), p = Buffer.from(PASS);
    if (a.length !== p.length || !crypto.timingSafeEqual(a, p)) return NextResponse.json({ erreur: "Mot de passe incorrect" }, { status: 401 });
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
      if (cols[3]) c.paiement = /comptant|cash|esp/i.test(cols[3]) ? "comptant" : "compte";
      if (!c.paiement) c.paiement = "compte";
      if (cols[4]) c.codeHash = hashCode(cols[4]);
      parId.set(c.id, c); n++;
    }
    await set("clients", [...parId.values()]);
    return NextResponse.json({ ok: true, n });
  }
  if (b.action === "client") {
    const liste = await clients();
    let c = liste.find((x) => x.id === String(b.id));
    if (b.supprimer) { await set("clients", liste.filter((x) => x !== c)); return NextResponse.json({ ok: true }); }
    if (!c) { c = { id: String(b.id) }; liste.push(c); }
    for (const k of ["nom", "tournee", "paiement", "mode"]) if (b[k] != null) c[k] = b[k];
    if (b.code) c.codeHash = hashCode(b.code);
    await set("clients", liste);
    return NextResponse.json({ ok: true });
  }
  if (b.action === "decoupes") {
    const reg = (await get("reglages")) || {};
    reg.decoupes = (b.decoupes || []).filter((d) => d.id && d.nom);
    await set("reglages", reg);
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ erreur: "Action inconnue" }, { status: 400 });
}
