// Authentification des clients avec Supabase Auth (API REST, sans SDK).
// Chaque client a son compte : identifiant = numéro client LGL, mot de passe personnel.
// Supabase exige un e-mail : on utilise une adresse technique interne (jamais utilisée pour écrire au client).
// Variables (ajoutées par l'intégration Supabase de Vercel) : SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY.
import crypto from "crypto";

const URL_SB = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
export const supabaseActif = !!(URL_SB && ANON && SERVICE);

export const emailClient = (id) => `client-${String(id).trim()}@clients.laviesaine.nc`;

async function appel(chemin, { methode = "GET", corps, admin = false } = {}) {
  const cle = admin ? SERVICE : ANON;
  const r = await fetch(URL_SB + chemin, {
    method: methode,
    headers: { apikey: cle, Authorization: `Bearer ${cle}`, "Content-Type": "application/json" },
    body: corps ? JSON.stringify(corps) : undefined,
    cache: "no-store",
  });
  let j = {}; try { j = await r.json(); } catch {}
  return { ok: r.ok, status: r.status, j };
}

// Vérifie numéro + mot de passe auprès de Supabase
export async function verifierClient(id, motDePasse) {
  if (!supabaseActif || !motDePasse) return false;
  const r = await appel("/auth/v1/token?grant_type=password", { methode: "POST", corps: { email: emailClient(id), password: String(motDePasse) } });
  return r.ok && !!r.j.access_token;
}

async function chercherUtilisateur(id) {
  const email = emailClient(id);
  for (let page = 1; page <= 20; page++) {
    const r = await appel(`/auth/v1/admin/users?page=${page}&per_page=200`, { admin: true });
    const users = r.j.users || [];
    const u = users.find((x) => x.email === email);
    if (u || users.length < 200) return u || null;
  }
  return null;
}

// Crée le compte du client ou change son mot de passe. Retourne l'identifiant Supabase.
export async function definirAcces(client, motDePasse) {
  if (!supabaseActif) throw new Error("Supabase n'est pas configuré.");
  const meta = { numero: client.id, nom: client.nom };
  if (client.supaId) {
    const r = await appel(`/auth/v1/admin/users/${client.supaId}`, { methode: "PUT", admin: true, corps: { password: motDePasse, user_metadata: meta } });
    if (r.ok) return client.supaId;
  }
  const c = await appel("/auth/v1/admin/users", { methode: "POST", admin: true, corps: { email: emailClient(client.id), password: motDePasse, email_confirm: true, user_metadata: meta } });
  if (c.ok) return c.j.id;
  const existant = await chercherUtilisateur(client.id); // compte déjà présent mais non mémorisé
  if (existant) {
    const r = await appel(`/auth/v1/admin/users/${existant.id}`, { methode: "PUT", admin: true, corps: { password: motDePasse, user_metadata: meta } });
    if (r.ok) return existant.id;
  }
  throw new Error(c.j.msg || c.j.message || `Supabase : erreur ${c.status}`);
}

export async function supprimerAcces(client) {
  if (!supabaseActif || !client.supaId) return;
  await appel(`/auth/v1/admin/users/${client.supaId}`, { methode: "DELETE", admin: true });
}

// Mot de passe initial lisible (sans 0/O, 1/l) : 8 caractères
export function genererMotDePasse() {
  const a = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from(crypto.randomBytes(8), (b) => a[b % a.length]).join("");
}
