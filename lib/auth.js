import crypto from "crypto";
import { cookies } from "next/headers";

const SECRET = process.env.SESSION_SECRET || "dev-secret-a-changer";

export function signer(obj) {
  const data = Buffer.from(JSON.stringify(obj)).toString("base64url");
  const sig = crypto.createHmac("sha256", SECRET).update(data).digest("base64url");
  return `${data}.${sig}`;
}
export function verifier(tok) {
  if (!tok || !tok.includes(".")) return null;
  const [data, sig] = tok.split(".");
  const ok = crypto.createHmac("sha256", SECRET).update(data).digest("base64url");
  if (sig.length !== ok.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(ok))) return null;
  try { return JSON.parse(Buffer.from(data, "base64url").toString()); } catch { return null; }
}

const opts = { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 180 };

export function setSession(name, obj) { cookies().set(name, signer(obj), opts); }
export function getSession(name) { return verifier(cookies().get(name)?.value); }
export function clearSession(name) { cookies().delete(name); }

export const estAdmin = () => !!getSession("lvs_admin")?.admin;
export const sessionClient = () => getSession("lvs_client");

export function hashCode(code) {
  return crypto.createHash("sha256").update(SECRET + ":" + String(code).trim()).digest("hex");
}
