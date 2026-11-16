// Stockage : Upstash Redis (Vercel Marketplace) si configuré, sinon fichier local (dev).
import { Redis } from "@upstash/redis";
import fs from "fs";
import path from "path";

const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const redis = url && token ? new Redis({ url, token }) : null;

const FILE = path.join(process.env.VERCEL ? "/tmp" : process.cwd(), ".data.json");
function readFile() {
  try { return JSON.parse(fs.readFileSync(FILE, "utf8")); } catch { return {}; }
}
function writeFile(d) { fs.writeFileSync(FILE, JSON.stringify(d)); }

export async function get(key, def = null) {
  if (redis) { const v = await redis.get(key); return v ?? def; }
  const d = readFile(); return d[key] ?? def;
}
export async function set(key, val) {
  if (redis) return redis.set(key, val);
  const d = readFile(); d[key] = val; writeFile(d);
}

export const persistant = !!redis;

// Commandes : une clé par commande + un index (ensemble) par date de livraison.
// Deux clients qui commandent en même temps ne peuvent plus s'écraser.
const kCmd = (date, id) => `cmd:${date}:${id}`;
const kIdx = (date) => `idx:${date}`;

export async function commandesDuJour(date) {
  let ids;
  if (redis) ids = await redis.smembers(kIdx(date));
  else ids = readFile()[kIdx(date)] || [];
  if (!ids.length) return [];
  const vals = redis ? await redis.mget(...ids.map((id) => kCmd(date, id))) : ids.map((id) => readFile()[kCmd(date, id)]);
  return vals.filter(Boolean).sort((a, b) => a.creeLe.localeCompare(b.creeLe));
}
export async function lireCommande(date, id) { return get(kCmd(date, id)); }
export async function ecrireCommande(cmd) {
  await set(kCmd(cmd.date, cmd.id), cmd);
  if (redis) await redis.sadd(kIdx(cmd.date), cmd.id);
  else { const d = readFile(); d[kIdx(cmd.date)] = [...new Set([...(d[kIdx(cmd.date)] || []), cmd.id])]; writeFile(d); }
}

// Compteur avec expiration (limitation des essais de code)
export async function incrementer(key, ttlSec) {
  if (redis) { const n = await redis.incr(key); if (n === 1) await redis.expire(key, ttlSec); return n; }
  const d = readFile(); const e = d[key] && d[key].exp > Date.now() ? d[key] : { n: 0, exp: Date.now() + ttlSec * 1000 };
  e.n++; d[key] = e; writeFile(d); return e.n;
}
export async function lireCompteur(key) {
  if (redis) return Number(await redis.get(key)) || 0;
  const e = readFile()[key]; return e && e.exp > Date.now() ? e.n : 0;
}

export async function clients() { return get("clients", []); }
