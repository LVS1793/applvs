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

export async function get(key, def = null) {
  if (redis) { const v = await redis.get(key); return v ?? def; }
  const d = readFile(); return d[key] ?? def;
}
export async function set(key, val) {
  if (redis) return redis.set(key, val);
  const d = readFile(); d[key] = val; fs.writeFileSync(FILE, JSON.stringify(d));
}

export const persistant = !!redis;

// Commandes : une clé par date de livraison -> liste
export async function commandesDuJour(date) { return get(`cmd:${date}`, []); }
export async function enregistrerCommandes(date, liste) { return set(`cmd:${date}`, liste); }

export async function clients() { return get("clients", []); }
export async function reglages() {
  return get("reglages", null);
}
