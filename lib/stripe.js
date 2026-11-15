// Paiement en ligne via Stripe Checkout (API REST, sans SDK). Le XPF est une devise sans décimales.
const KEY = process.env.STRIPE_SECRET_KEY;
export const paiementActif = !!KEY;

async function stripe(path, params, method = "POST") {
  const res = await fetch("https://api.stripe.com/v1/" + path, {
    method,
    headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: method === "POST" ? new URLSearchParams(params).toString() : undefined,
  });
  return res.json();
}

export async function creerCheckout(cmd, origin) {
  if (!KEY) return { erreur: "Le paiement en ligne n'est pas encore activé. Appelez La Vie Saine pour régler votre commande." };
  const p = {
    mode: "payment",
    "line_items[0][price_data][currency]": "xpf",
    "line_items[0][price_data][unit_amount]": String(cmd.ttc),
    "line_items[0][price_data][product_data][name]": `Commande La Vie Saine du ${cmd.date} (TTC, TGC 3 % incluse)`,
    "line_items[0][quantity]": "1",
    "metadata[date]": cmd.date,
    "metadata[id]": cmd.id,
    success_url: `${origin}/client?paye=1&date=${cmd.date}&id=${cmd.id}&sid={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/client?annule=1`,
  };
  const s = await stripe("checkout/sessions", p);
  if (s.error) return { erreur: "Paiement indisponible : " + s.error.message };
  return { id: s.id, url: s.url };
}

export async function sessionPayee(id) {
  if (!KEY) return false;
  const s = await stripe("checkout/sessions/" + encodeURIComponent(id), null, "GET");
  return s.payment_status === "paid" ? s : false;
}
