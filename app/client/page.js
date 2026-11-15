"use client";
import { useEffect, useMemo, useState } from "react";
import { PRODUITS, PRODUITS_BY_ID, prixHT, totaux, libelle } from "@/lib/catalog";
import { datesPossibles, frDate, HEURE_LIMITE } from "@/lib/rules";

const api = async (url, opts) => {
  const r = await fetch(url, { headers: { "Content-Type": "application/json" }, ...opts });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.erreur || "Erreur");
  return j;
};
const xpf = (n) => n.toLocaleString("fr-FR") + " XPF";

export default function Client() {
  const [etat, setEtat] = useState(null);
  const [msg, setMsg] = useState(null);
  const charger = () => api("/api/client").then(setEtat).catch((e) => setMsg(e.message));
  useEffect(() => {
    const u = new URLSearchParams(location.search);
    if (u.get("paye")) {
      api(`/api/pay?date=${u.get("date")}&id=${u.get("id")}&sid=${u.get("sid")}`)
        .then((r) => setMsg(r.ok ? "✅ Paiement reçu, commande confirmée. Merci !" : "Paiement non confirmé : appelez La Vie Saine."))
        .catch(() => setMsg("Paiement non confirmé : appelez La Vie Saine."));
      history.replaceState(null, "", "/client");
    }
    if (u.get("annule")) { setMsg("Paiement annulé : la commande n'est pas validée."); history.replaceState(null, "", "/client"); }
    charger();
  }, []);

  const deconnexion = async () => { await api("/api/client", { method: "DELETE" }); charger(); };

  return (
    <>
      <header className="bar">
        <h1>🥖 Commander — La Vie Saine</h1>
        {etat?.moi && <button onClick={deconnexion}>Changer</button>}
      </header>
      <main className="wrap">
        {msg && <div className={msg.startsWith("✅") ? "ok" : "err"}>{msg}</div>}
        {!etat ? <p className="muted">Chargement…</p> : etat.moi ? <Commande etat={etat} recharger={charger} /> : <Onboarding clients={etat.clients} ok={charger} />}
      </main>
    </>
  );
}

function Onboarding({ clients, ok }) {
  const [onglet, setOnglet] = useState("compte");
  const [filtre, setFiltre] = useState("");
  const [id, setId] = useState("");
  const [code, setCode] = useState("");
  const [nom, setNom] = useState("");
  const [err, setErr] = useState(null);
  const liste = clients.filter((c) => c.nom.toLowerCase().includes(filtre.toLowerCase()));

  const go = async (body) => {
    setErr(null);
    try { await api("/api/client", { method: "POST", body: JSON.stringify(body) }); ok(); } catch (e) { setErr(e.message); }
  };

  return (
    <>
      <h2>Bienvenue 👋</h2>
      <div className="tabs">
        <button className={onglet === "compte" ? "actif" : ""} onClick={() => setOnglet("compte")}>J'ai un compte client</button>
        <button className={onglet === "comptant" ? "actif" : ""} onClick={() => setOnglet("comptant")}>Je paie au comptant</button>
      </div>
      {err && <div className="err">{err}</div>}
      {onglet === "compte" ? (
        <div className="card">
          <label>Votre établissement</label>
          <input className="recherche" placeholder="Rechercher (ex. snack…)" value={filtre} onChange={(e) => setFiltre(e.target.value)} />
          <select value={id} onChange={(e) => setId(e.target.value)} size={Math.min(6, Math.max(2, liste.length))}>
            {liste.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
          </select>
          {!clients.length && <p className="muted">Aucun client importé pour l'instant.</p>}
          <label>Code client (donné par La Vie Saine)</label>
          <input inputMode="numeric" value={code} onChange={(e) => setCode(e.target.value)} />
          <button className="primaire gros" style={{ marginTop: 14 }} disabled={!id || !code} onClick={() => go({ clientId: id, code })}>Entrer</button>
        </div>
      ) : (
        <div className="card">
          <label>Nom du snack / de l'entreprise</label>
          <input value={nom} onChange={(e) => setNom(e.target.value)} />
          <p className="muted">Paiement en ligne obligatoire à la commande.</p>
          <button className="primaire gros" disabled={nom.trim().length < 2} onClick={() => go({ comptant: true, nom })}>Continuer</button>
        </div>
      )}
      <p className="muted">Particulier ? Les prix sont sur notre site internet ou dans la liste de tarifs papier.</p>
    </>
  );
}

function Commande({ etat, recharger }) {
  const { moi, historique, decoupes } = etat;
  const [mode, setMode] = useState(moi.mode || (moi.tournee === "Fournil" ? "retrait" : "livraison"));
  const [lignes, setLignes] = useState({}); // produitId -> { qte, decoupe }
  const [date, setDate] = useState("");
  const [note, setNote] = useState("");
  const [cat, setCat] = useState(historique.length ? "mes" : "snack");
  const [q, setQ] = useState("");
  const [err, setErr] = useState(null);
  const [envoi, setEnvoi] = useState(false);
  const [fini, setFini] = useState(null);

  const tab = Object.entries(lignes).map(([produitId, l]) => ({ produitId, ...l })).filter((l) => l.qte > 0);
  const aEmballes = tab.some((l) => PRODUITS_BY_ID[l.produitId]?.cat === "emballe");
  const dates = useMemo(() => datesPossibles(mode, aEmballes), [mode, aEmballes]);
  useEffect(() => { if (!dates.includes(date)) setDate(dates[0] || ""); }, [dates]);
  const t = totaux(tab, mode);

  const mesIds = new Set(historique.flatMap((h) => h.lignes.map((l) => l.produitId)));
  const visibles = PRODUITS.filter((p) =>
    (q ? libelle(p).toLowerCase().includes(q.toLowerCase()) : cat === "mes" ? mesIds.has(p.id) || lignes[p.id]?.qte : p.cat === cat));

  const prerempli = (v) => {
    const h = historique.find((x) => x.id === v);
    if (!h) return setLignes({});
    setLignes(Object.fromEntries(h.lignes.map((l) => [l.produitId, { qte: l.qte, decoupe: l.decoupe }])));
    setMode(h.mode);
  };
  const maj = (id, champ, val) => setLignes((s) => ({ ...s, [id]: { qte: 0, decoupe: "entier", ...s[id], [champ]: val } }));

  const valider = async () => {
    setErr(null); setEnvoi(true);
    try {
      const r = await api("/api/orders", { method: "POST", body: JSON.stringify({ date, mode, note, lignes: tab }) });
      if (r.checkoutUrl) { location.href = r.checkoutUrl; return; }
      setFini(r.commande); recharger();
    } catch (e) { setErr(e.message); }
    setEnvoi(false);
  };

  if (fini) return (
    <div className="card">
      <h2>✅ Commande enregistrée</h2>
      <p>{fini.mode === "retrait" ? "Retrait au fournil" : "Livraison"} le <b>{frDate(fini.date)}</b> — {xpf(fini.ttc)} TTC.</p>
      <button className="primaire gros" onClick={() => { setFini(null); setLignes({}); }}>Nouvelle commande</button>
    </div>
  );

  return (
    <>
      <h2>Bonjour {moi.nom}</h2>
      <p className="muted">
        {moi.comptant || moi.paiement === "comptant" ? "Paiement en ligne à la commande." : "Facturé sur votre compte."} Commandes avant {HEURE_LIMITE} h :
        24 h à l'avance pour le snacking, 48 h pour les pains emballés. Lundi : commander le samedi avant 13 h.
      </p>

      <div className="card">
        <label>Pré-remplir avec…</label>
        <select onChange={(e) => prerempli(e.target.value)} defaultValue="">
          <option value="">— Commande vide —</option>
          {historique.map((h, i) => (
            <option key={h.id} value={h.id}>{i === 0 ? "⭐ Ma dernière commande" : "Commande"} du {frDate(h.date)} ({xpf(h.ttc)})</option>
          ))}
        </select>
        <div className="row">
          <div>
            <label>Mode</label>
            <select value={mode} onChange={(e) => setMode(e.target.value)}>
              <option value="livraison">Livraison (min. 3 000 XPF)</option>
              <option value="retrait">Retrait au fournil (6 h – 12 h)</option>
            </select>
          </div>
          <div>
            <label>Date</label>
            <select value={date} onChange={(e) => setDate(e.target.value)}>
              {dates.map((d) => <option key={d} value={d}>{frDate(d)}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="tabs">
        {historique.length > 0 && <button className={cat === "mes" ? "actif" : ""} onClick={() => setCat("mes")}>Mes produits</button>}
        <button className={cat === "snack" ? "actif" : ""} onClick={() => setCat("snack")}>Snacking</button>
        <button className={cat === "emballe" ? "actif" : ""} onClick={() => setCat("emballe")}>Pains emballés</button>
      </div>
      <input className="recherche" placeholder="🔎 Chercher un produit" value={q} onChange={(e) => setQ(e.target.value)} />

      <div className="card">
        {visibles.map((p) => {
          const l = lignes[p.id] || { qte: 0, decoupe: "entier" };
          return (
            <div className="ligne" key={p.id}>
              <div>
                <div className="nom">{libelle(p)}</div>
                <div className="prix">{prixHT(p, mode)} XPF HT {p.cat === "emballe" && "· 48 h"}</div>
              </div>
              <input type="number" min="0" inputMode="numeric" value={l.qte || ""} placeholder="0" onChange={(e) => maj(p.id, "qte", Number(e.target.value))} />
              {l.qte > 0 && (
                <select value={l.decoupe} onChange={(e) => maj(p.id, "decoupe", e.target.value)}>
                  {decoupes.map((d) => <option key={d.id} value={d.id}>Découpe : {d.nom}</option>)}
                </select>
              )}
            </div>
          );
        })}
        {!visibles.length && <p className="muted">Aucun produit.</p>}
      </div>

      <label>Remarque (facultatif)</label>
      <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
      {err && <div className="err">{err}</div>}

      <div className="total">
        <div className="in">
          <div className="row" style={{ marginBottom: 6 }}>
            <span>{tab.length} produit(s) · HT {xpf(t.ht)}</span>
            <b style={{ textAlign: "right" }}>TTC {xpf(t.ttc)}</b>
          </div>
          <button className="primaire gros" disabled={!tab.length || !date || envoi} onClick={valider}>
            {moi.comptant || moi.paiement === "comptant" ? `Payer ${xpf(t.ttc)} et commander` : "Valider la commande"}
          </button>
        </div>
      </div>
    </>
  );
}
