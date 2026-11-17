"use client";
import { useEffect, useState } from "react";
import { PRODUITS, PRODUITS_BY_ID, libelle, TOURNEES } from "@/lib/catalog";
import { frDate, maintenantNC } from "@/lib/rules";

const api = async (url, opts) => {
  const r = await fetch(url, { headers: { "Content-Type": "application/json" }, ...opts });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.erreur || "Erreur");
  return j;
};
const xpf = (n) => (n || 0).toLocaleString("fr-FR") + " XPF";
const lendemain = () => { const d = new Date(maintenantNC().date + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + 1); return d.toISOString().slice(0, 10); };
const ordreProduit = Object.fromEntries(PRODUITS.map((p, i) => [p.id, i]));

export default function LVS() {
  const [etat, setEtat] = useState(null);
  const charger = () => api("/api/admin").then(setEtat);
  useEffect(() => { charger(); }, []);
  if (!etat) return <main className="wrap">Chargement…</main>;
  if (!etat.admin) return <Login ok={charger} />;
  return <Espace etat={etat} recharger={charger} />;
}

function Login({ ok }) {
  const [mdp, setMdp] = useState(""); const [err, setErr] = useState(null);
  const go = async (e) => {
    e.preventDefault();
    try { await api("/api/admin", { method: "POST", body: JSON.stringify({ action: "login", motDePasse: mdp }) }); ok(); } catch (x) { setErr(x.message); }
  };
  return (
    <>
      <header className="bar"><h1><img src="/logo-lvs.png" alt="La Vie Saine" />Espace équipe</h1></header>
      <form className="wrap" onSubmit={go}>
        <div className="card">
          <label>Mot de passe équipe</label>
          <input type="password" value={mdp} onChange={(e) => setMdp(e.target.value)} autoFocus />
          {err && <div className="err">{err}</div>}
          <button className="primaire gros" style={{ marginTop: 12 }}>Entrer</button>
        </div>
      </form>
    </>
  );
}

function Espace({ etat, recharger }) {
  const [onglet, setOnglet] = useState("commandes");
  const [date, setDate] = useState(lendemain());
  const [cmds, setCmds] = useState([]);
  const coul = Object.fromEntries(etat.decoupes.map((d) => [d.id, d]));
  const chargerCmds = () => api("/api/orders?date=" + date).then((r) => setCmds(r.commandes));
  useEffect(() => { chargerCmds(); const t = setInterval(chargerCmds, 30000); return () => clearInterval(t); }, [date]);
  const actives = cmds.filter((c) => c.statut !== "annulee");

  const patch = async (body) => { await api("/api/orders", { method: "PATCH", body: JSON.stringify({ date, ...body }) }); chargerCmds(); };
  const sortir = async () => { await api("/api/admin", { method: "POST", body: JSON.stringify({ action: "logout" }) }); recharger(); };

  return (
    <>
      <header className="bar"><h1><img src="/logo-lvs.png" alt="La Vie Saine" />Espace équipe</h1><button onClick={sortir}>Sortir</button></header>
      <main className="wrap wide">
        {!etat.persistant && <div className="err no-print">⚠️ Base de données non connectée : les commandes ne sont pas conservées durablement (ajouter Upstash Redis sur Vercel).</div>}
        <div className="tabs">
          {[["commandes", "Commandes"], ["total", "Total à produire"], ["livreurs", "Feuilles livreurs"], ["clients", "Clients"], ["reglages", "Découpes"]].map(([k, v]) => (
            <button key={k} className={onglet === k ? "actif" : ""} onClick={() => setOnglet(k)}>{v}</button>
          ))}
        </div>
        {["commandes", "total", "livreurs"].includes(onglet) && (
          <div className="row no-print">
            <div><label>Jour de livraison / retrait</label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
            <div style={{ alignSelf: "end" }}><button onClick={() => window.print()}>🖨️ Imprimer</button></div>
          </div>
        )}
        {onglet === "commandes" && <Commandes cmds={cmds} coul={coul} patch={patch} date={date} />}
        {onglet === "total" && <Total cmds={actives} coul={coul} date={date} />}
        {onglet === "livreurs" && <Livreurs cmds={actives} coul={coul} date={date} />}
        {onglet === "clients" && <Clients etat={etat} recharger={recharger} />}
        {onglet === "reglages" && <Decoupes etat={etat} recharger={recharger} />}
      </main>
    </>
  );
}

const Decoupe = ({ d }) => d ? <span><span className="pastille" style={{ background: d.couleur }} />{d.nom}</span> : null;
const Statut = ({ c }) => c.statut === "annulee" ? <span className="badge rouge">Annulée</span>
  : c.statut === "a_payer" ? <span className="badge ambre">Non payée</span>
  : c.paiement === "livraison" ? <span className="badge ambre">À encaisser</span>
  : <span className="badge vert">{c.paiement === "comptant" ? "Payée" : "Compte"}</span>;

function Commandes({ cmds, coul, patch, date }) {
  const [par, setPar] = useState(() => (typeof localStorage !== "undefined" && localStorage.getItem("lvs_par")) || "");
  useEffect(() => { try { localStorage.setItem("lvs_par", par); } catch {} }, [par]);
  const faites = cmds.filter((c) => c.okProduit).length;
  return (
    <>
      <h2>{frDate(date)} — {cmds.length} commande(s), {faites} produite(s)</h2>
      <div className="no-print"><label>Votre prénom (pour le OK production)</label><input value={par} onChange={(e) => setPar(e.target.value)} style={{ maxWidth: 260 }} /></div>
      {cmds.map((c) => (
        <div className="card" key={c.id} style={c.statut === "annulee" ? { opacity: .5 } : null}>
          <div className="row">
            <b>{c.clientNom}</b>
            <span className="muted" style={{ textAlign: "right" }}>{c.mode === "retrait" ? "Retrait fournil" : c.tournee} · <Statut c={c} />{c.office && <> · <span className="badge">{c.auto ? "Commande d'office" : "Office modifiée par le " + (c.modifiePar || "client")}</span></>}</span>
          </div>
          {c.inhabituels?.length > 0 && (
            <div className="err">⚠️ Article(s) que ce client ne prend pas habituellement : <b>{c.inhabituels.map((id) => PRODUITS_BY_ID[id] ? libelle(PRODUITS_BY_ID[id]) : id).join(", ")}</b></div>
          )}
          {c.supplement && <div className="err" style={{ background: "#fef3c7", color: "#92400e" }}>➕ Commande supplémentaire : <b>{c.supplement}</b></div>}
          <table style={{ marginTop: 8 }}>
            <tbody>
              {c.lignes.map((l, i) => (
                <tr key={i} style={c.inhabituels?.includes(l.produitId) ? { outline: "2px solid #b42318" } : null}>
                  <td style={{ width: 32 }}><input type="checkbox" checked={!!l.ok} onChange={() => patch({ id: c.id, action: "ligne", index: i })} style={{ width: 20, height: 20 }} /></td>
                  <td className="n" style={{ width: 50 }}><b>{l.qte}</b></td>
                  <td>{PRODUITS_BY_ID[l.produitId] ? libelle(PRODUITS_BY_ID[l.produitId]) : l.produitId}</td>
                  <td style={{ background: coul[l.decoupe]?.couleur }}>{coul[l.decoupe]?.nom || l.decoupe}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {c.note && <p>📝 {c.note}</p>}
          <p className="muted">{xpf(c.ttc)} TTC · commandé le {new Date(c.creeLe).toLocaleString("fr-FR", { timeZone: "Pacific/Noumea" })}</p>
          <div className={"okbar" + (c.okProduit ? " fait" : "")}>
            <span style={{ flex: 1 }}>{c.okProduit ? `✅ OK produit par ${c.okProduit.par || "?"} à ${new Date(c.okProduit.le).toLocaleTimeString("fr-FR", { timeZone: "Pacific/Noumea", hour: "2-digit", minute: "2-digit" })}` : "Production terminée ?"}</span>
            <button className={c.okProduit ? "" : "primaire"} style={{ flex: "none" }} onClick={() => patch({ id: c.id, action: "ok", par })}>{c.okProduit ? "Annuler OK" : "OK ✔"}</button>
          </div>
          <div className="row no-print" style={{ marginTop: 8 }}>
            {c.statut === "a_payer" && <button style={{ flex: "none" }} onClick={() => patch({ id: c.id, action: "payee" })}>Marquer payée</button>}
            <button style={{ flex: "none" }} onClick={() => confirm(c.statut === "annulee" ? "Rétablir ?" : "Annuler cette commande ?") && patch({ id: c.id, action: "annuler" })}>{c.statut === "annulee" ? "Rétablir" : "Annuler"}</button>
          </div>
        </div>
      ))}
      {!cmds.length && <p className="muted">Aucune commande pour ce jour.</p>}
    </>
  );
}

function Total({ cmds, coul, date }) {
  const m = new Map();
  for (const c of cmds) for (const l of c.lignes) {
    const k = l.produitId + "|" + l.decoupe;
    const e = m.get(k) || { produitId: l.produitId, decoupe: l.decoupe, qte: 0, clients: 0 };
    e.qte += l.qte; e.clients++; m.set(k, e);
  }
  const rows = [...m.values()].sort((a, b) => ordreProduit[a.produitId] - ordreProduit[b.produitId] || a.decoupe.localeCompare(b.decoupe));
  const sections = [["snack", "Snacking"], ["emballe", "Pains emballés"]];
  return (
    <>
      <h2>Total à produire — {frDate(date)}</h2>
      <p className="muted">{cmds.length} commande(s) non annulée(s), toutes tournées confondues.</p>
      {sections.map(([cat, titre]) => {
        const r = rows.filter((x) => PRODUITS_BY_ID[x.produitId]?.cat === cat);
        if (!r.length) return null;
        return (
          <div className="card" key={cat}>
            <h3>{titre}</h3>
            <table>
              <thead><tr><th>Produit</th><th>Découpe</th><th className="n">Quantité</th><th className="n">Clients</th><th>OK</th></tr></thead>
              <tbody>
                {r.map((x) => (
                  <tr key={x.produitId + x.decoupe}>
                    <td>{libelle(PRODUITS_BY_ID[x.produitId])}</td>
                    <td style={{ background: coul[x.decoupe]?.couleur }}>{coul[x.decoupe]?.nom || x.decoupe}</td>
                    <td className="n"><b style={{ fontSize: 16 }}>{x.qte}</b></td>
                    <td className="n">{x.clients}</td>
                    <td>☐</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
      {!rows.length && <p className="muted">Rien à produire.</p>}
    </>
  );
}

function Livreurs({ cmds, coul, date }) {
  const [t, setT] = useState("");
  const tournees = [...new Set(cmds.map((c) => c.tournee))].sort();
  const liste = cmds.filter((c) => !t || c.tournee === t).sort((a, b) => a.tournee.localeCompare(b.tournee) || a.clientNom.localeCompare(b.clientNom));
  return (
    <>
      <div className="no-print">
        <label>Livreur / tournée</label>
        <select value={t} onChange={(e) => setT(e.target.value)} style={{ maxWidth: 420 }}>
          <option value="">Toutes les tournées</option>
          {tournees.map((x) => <option key={x}>{x}</option>)}
        </select>
        <p className="muted">Impression : une feuille par livreur, avec toutes ses commandes à la suite.</p>
      </div>
      {[...new Set(liste.map((c) => c.tournee))].map((tr) => {
        const cs = liste.filter((c) => c.tournee === tr);
        const liv = cs.find((c) => c.livreur)?.livreur;
        return (
          <section className="saut" key={tr}>
            <div className="row" style={{ borderBottom: "3px solid #000", padding: "6px 0", marginTop: 16 }}>
              <h2 style={{ margin: 0 }}>{tr}{liv ? ` — ${liv}` : ""}</h2>
              <span style={{ textAlign: "right" }}>{frDate(date)} · {cs.length} client(s)</span>
            </div>
            {cs.map((c) => <CommandeLivreur key={c.id} c={c} coul={coul} />)}
          </section>
        );
      })}
      {!liste.length && <p className="muted">Aucune commande.</p>}
    </>
  );
}

function CommandeLivreur({ c, coul }) {
  return (
        <div className="card">
          <h3 style={{ margin: "0 0 4px" }}>{c.clientNom}</h3>
          <p>{c.mode === "retrait" ? "Retrait au fournil" : "Livraison"} · <Statut c={c} /> {((c.paiement === "comptant" && c.statut === "a_payer") || c.paiement === "livraison") && <b> — À ENCAISSER {xpf(c.ttc)}</b>}</p>
          <table>
            <thead><tr><th className="n">Qté</th><th>Produit</th><th>✓</th></tr></thead>
            <tbody>
              {c.lignes.map((l, i) => (
                <tr key={i}>
                  <td className="n"><b style={{ fontSize: 16 }}>{l.qte}</b></td>
                  <td>{PRODUITS_BY_ID[l.produitId] ? libelle(PRODUITS_BY_ID[l.produitId]) : l.produitId}</td>
                  <td>☐</td>
                </tr>
              ))}
            </tbody>
          </table>
          {c.supplement && <p><b>➕ Supplément : {c.supplement}</b></p>}
          {c.note && <p>📝 {c.note}</p>}
          <div className="okbar" style={{ marginTop: 8, padding: 6 }}>
            <span style={{ flex: 1 }}>Produit : ☐ OK &nbsp;&nbsp; Par : ____________ &nbsp;&nbsp; Chargé : ☐</span>
          </div>
        </div>
  );
}

function Clients({ etat, recharger }) {
  const [texte, setTexte] = useState("");
  const [msg, setMsg] = useState(null);
  const [f, setF] = useState("");
  const [edit, setEdit] = useState(null);
  const importer = async () => {
    const r = await api("/api/admin", { method: "POST", body: JSON.stringify({ action: "import", texte }) });
    setMsg(`${r.n} client(s) importé(s) / mis à jour.`); setTexte(""); recharger();
  };
  const enregistrer = async () => {
    await api("/api/admin", { method: "POST", body: JSON.stringify({ action: "client", ...edit }) });
    setEdit(null); recharger();
  };
  const liste = etat.clients.filter((c) => (c.nom + c.id + c.tournee).toLowerCase().includes(f.toLowerCase())).sort((a, b) => a.nom.localeCompare(b.nom));
  return (
    <>
      <div className="card">
        <h3>Importer le fichier LGL complet</h3>
        <p className="muted">Fichier <b>lgl-clients.json</b> généré au bureau par <code>node scripts/import-lgl.js</code> (base LGL + livreurs + commandes d'office). Les codes clients déjà définis sont conservés.</p>
        <input type="file" accept=".json" onChange={async (e) => {
          const f = e.target.files[0]; if (!f) return;
          try {
            const data = JSON.parse(await f.text());
            const r = await api("/api/admin", { method: "POST", body: JSON.stringify({ action: "importLGL", data }) });
            setMsg(`${r.n} client(s) LGL importé(s), dont ${data.clients.filter((c) => c.habitudes).length} avec commandes habituelles.`); recharger();
          } catch (x) { setMsg("Erreur : " + x.message); }
          e.target.value = "";
        }} />
      </div>
      <div className="card">
        <h3>Ajout rapide (coller depuis Excel)</h3>
        <p className="muted">Copier les colonnes depuis Excel puis coller ici : <b>ID · Nom · Tournée · Paiement (compte ou comptant) · Code</b>. Les colonnes 3 à 5 sont facultatives ; un client existant (même ID) est mis à jour.</p>
        <textarea rows={6} value={texte} onChange={(e) => setTexte(e.target.value)} placeholder={"1024\tSNACK EXEMPLE\tLivreur 2 — Centre-ville > Orphelinat\tcompte\t4821"} />
        <button className="primaire" style={{ marginTop: 8 }} disabled={!texte.trim()} onClick={importer}>Importer</button>
        {msg && <div className="ok">{msg}</div>}
      </div>
      <div className="row">
        <input placeholder="🔎 Filtrer" value={f} onChange={(e) => setF(e.target.value)} />
        <button style={{ flex: "none" }} onClick={() => setEdit({ id: "", nom: "", tournee: "Sans tournée", paiement: "compte", mode: "livraison", code: "" })}>+ Client</button>
      </div>
      {edit && (
        <div className="card">
          <div className="row">
            <div><label>ID LGL (= code client)</label><input value={edit.id} onChange={(e) => setEdit({ ...edit, id: e.target.value })} /></div>
            <div><label>Nom</label><input value={edit.nom} onChange={(e) => setEdit({ ...edit, nom: e.target.value })} /></div>
          </div>
          <div className="row">
            <div><label>Tournée</label><select value={edit.tournee} onChange={(e) => setEdit({ ...edit, tournee: e.target.value })}>{[...new Set([edit.tournee, ...TOURNEES])].map((x) => <option key={x}>{x}</option>)}</select></div>
            <div><label>Paiement</label><select value={edit.paiement} onChange={(e) => setEdit({ ...edit, paiement: e.target.value })}><option value="compte">Compte (relevé mensuel LGL)</option><option value="livraison">Règlement à la livraison</option><option value="comptant">Comptant (paiement en ligne)</option></select></div>
          </div>
          <div className="row">
            <div><label>Type (accès à l'app : snacks uniquement)</label><select value={edit.categorie || "snack"} onChange={(e) => setEdit({ ...edit, categorie: e.target.value })}><option value="snack">Snack (accès à l'app)</option><option value="magasin">Magasin (pas d'accès)</option><option value="autre">Autre (pas d'accès)</option><option value="inconnu">Inconnu (pas d'accès)</option></select></div>
          </div>
          <div className="row">
            <div><label>Mode par défaut</label><select value={edit.mode || "livraison"} onChange={(e) => setEdit({ ...edit, mode: e.target.value })}><option value="livraison">Livraison</option><option value="retrait">Retrait</option></select></div>
            <div><label>Mot de passe du client : {edit.aCode ? "créé par le client" : "pas encore créé (1re connexion avec le numéro seul)"}</label><input value={edit.code || ""} onChange={(e) => setEdit({ ...edit, code: e.target.value })} /></div>
          </div>
          <div className="row" style={{ marginTop: 10 }}>
            <button className="primaire" disabled={!edit.id || !edit.nom} onClick={enregistrer}>Enregistrer</button>
            <button onClick={() => setEdit(null)}>Fermer</button>
            {edit.aCode && <button onClick={async () => { if (confirm("Réinitialiser le mot de passe ? Le client en recréera un à sa prochaine connexion avec son numéro.")) { await api("/api/admin", { method: "POST", body: JSON.stringify({ action: "client", id: edit.id, resetCode: true }) }); setEdit(null); recharger(); } }}>Réinitialiser le mot de passe</button>}
            <button onClick={async () => { if (confirm("Supprimer ce client ?")) { await api("/api/admin", { method: "POST", body: JSON.stringify({ action: "client", id: edit.id, supprimer: true }) }); setEdit(null); recharger(); } }}>Supprimer</button>
          </div>
        </div>
      )}
      <div className="card table-scroll">
        <table>
          <thead><tr><th>ID</th><th>Nom</th><th className="hide-mobile">Tournée</th><th>Livreur</th><th className="hide-mobile">Paiement</th><th>Type</th><th className="hide-mobile">Habitudes</th><th className="hide-mobile">Mot de passe</th></tr></thead>
          <tbody>
            {liste.map((c) => (
              <tr key={c.id} onClick={() => setEdit({ ...c, code: "" })} style={{ cursor: "pointer" }}>
                <td>{c.id}</td><td>{c.nom}</td><td className="hide-mobile">{c.tournee}</td><td>{c.livreur || ""}</td><td className="hide-mobile">{c.paiement}</td><td>{c.categorie === "snack" || !c.categorie ? <span className="badge vert">Snack</span> : <span className="badge">{c.categorie}</span>}</td><td className="hide-mobile">{c.habitudes ? Object.keys(c.habitudes).map((j) => j.slice(0, 3)).join(" ") : ""}</td><td className="hide-mobile">{c.aCode ? "✔ créé" : <span className="badge ambre">pas encore</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!liste.length && <p className="muted">Aucun client.</p>}
      </div>
    </>
  );
}

function Decoupes({ etat, recharger }) {
  const [d, setD] = useState(etat.decoupes);
  const [ok, setOk] = useState(false);
  const maj = (i, k, v) => setD(d.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  const save = async () => { await api("/api/admin", { method: "POST", body: JSON.stringify({ action: "decoupes", decoupes: d }) }); setOk(true); recharger(); };
  return (
    <div className="card">
      <h3>Découpes et codes couleur</h3>
      <p className="muted">Découpes possibles uniquement sur : Panier complet (coupé long), Toast XXL, Seigle XXL, Complet XXL et Multigrains XXL (coupé fin), Sandwich (coupé long ou tranché à 2 cm), Brioché (non tranché), Grand brioché au lait (tranché à 2 cm). Les couleurs sont celles du grand tableau de production : à ajuster si besoin.</p>
      {d.map((x, i) => (
        <div className="row" key={i} style={{ marginBottom: 6 }}>
          <input type="color" value={x.couleur} onChange={(e) => maj(i, "couleur", e.target.value)} style={{ flex: "0 0 56px", padding: 2, height: 42 }} />
          <input value={x.nom} onChange={(e) => maj(i, "nom", e.target.value)} />
        </div>
      ))}
      <div className="row" style={{ marginTop: 8 }}>
                <button className="primaire" onClick={save}>Enregistrer</button>
      </div>
      {ok && <div className="ok">Enregistré.</div>}
    </div>
  );
}
