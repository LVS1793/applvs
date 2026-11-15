import { NextResponse } from "next/server";
import { commandesDuJour, enregistrerCommandes } from "@/lib/store";
import { sessionPayee } from "@/lib/stripe";

export const dynamic = "force-dynamic";

// Vérifie auprès de Stripe que la commande est payée, puis la confirme.
export async function GET(req) {
  const u = new URL(req.url).searchParams;
  const date = u.get("date"), id = u.get("id"), sid = u.get("sid");
  const liste = await commandesDuJour(date);
  const c = liste.find((x) => x.id === id);
  if (!c || c.stripeSession !== sid) return NextResponse.json({ ok: false }, { status: 404 });
  if (c.statut === "confirmee") return NextResponse.json({ ok: true });
  const s = await sessionPayee(sid);
  if (!s || s.amount_total !== c.ttc) return NextResponse.json({ ok: false });
  c.statut = "confirmee";
  c.payeEnLigne = true;
  await enregistrerCommandes(date, liste);
  return NextResponse.json({ ok: true });
}
