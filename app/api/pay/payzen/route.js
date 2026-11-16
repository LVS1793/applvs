import { NextResponse } from "next/server";
import { lireCommande, ecrireCommande } from "@/lib/store";
import { verifierNotification } from "@/lib/payzen";

export const dynamic = "force-dynamic";

// Notification instantanée PayZen (IPN) : confirme la commande payée.
export async function POST(req) {
  const champs = Object.fromEntries((await req.formData()).entries());
  const n = verifierNotification(champs);
  if (!n) return new NextResponse("signature invalide", { status: 400 });
  const c = await lireCommande(n.date, n.id);
  if (!c) return new NextResponse("commande inconnue", { status: 404 });
  if (n.paye && n.montant === c.ttc) {
    c.statut = "confirmee";
    c.payeEnLigne = true;
    await ecrireCommande(c);
  }
  return new NextResponse("OK");
}
