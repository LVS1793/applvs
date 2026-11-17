// Synchronisation quotidienne : base LGL (NAS + lgl-base-web.tsv) -> applvs.vercel.app
// Usage : node scripts/sync-app.js   (lancé chaque jour par le Planificateur de tâches Windows)
// 1. reconstruit lgl-clients.json via import-lgl.js
// 2. se connecte à l'espace La Vie Saine (ADMIN_PASSWORD de .env.deploy) et envoie l'action importLGL
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const URL_APP = process.env.APP_URL || "https://applvs.vercel.app";
const LOG = path.join(ROOT, "sync-app.log");
const log = (m) => { const l = `[${new Date().toISOString()}] ${m}`; console.log(l); fs.appendFileSync(LOG, l + "\n"); };

const env = Object.fromEntries(fs.readFileSync(path.join(ROOT, ".env.deploy"), "utf8").split(/\r?\n/)
  .filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]));

(async () => {
  try {
    execFileSync(process.execPath, [path.join(__dirname, "import-lgl.js")], { cwd: ROOT, stdio: "ignore" });
    const data = JSON.parse(fs.readFileSync(path.join(ROOT, "lgl-clients.json"), "utf8"));
    if (!data.clients?.length) throw new Error("lgl-clients.json vide, envoi annulé");

    const login = await fetch(`${URL_APP}/api/admin`, { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "login", motDePasse: env.ADMIN_PASSWORD }) });
    if (!login.ok) throw new Error(`connexion refusée (${login.status})`);
    const cookie = (login.headers.getSetCookie?.() || [login.headers.get("set-cookie")]).filter(Boolean).map((c) => c.split(";")[0]).join("; ");

    const r = await fetch(`${URL_APP}/api/admin`, { method: "POST", headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ action: "importLGL", data }) });
    const j = await r.json();
    if (!r.ok || !j.ok) throw new Error(`import refusé (${r.status}) ${JSON.stringify(j)}`);
    log(`OK : ${j.n} clients envoyés (${data.clients.length} dans LGL)`);
  } catch (e) {
    log(`ERREUR : ${e.message}`);
    process.exit(1);
  }
})();
