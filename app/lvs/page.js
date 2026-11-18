"use client";
import { useEffect, useState } from "react";
import { PRODUITS, PRODUITS_BY_ID, libelle, TOURNEES, canonique, decoupeLigne } from "@/lib/catalog";
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
  const [mdp, setMdp] = useState(""); const [err, setErr] = useState(null); const [voir, setVoir] = useState(false);
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
          <div className="mdp">
            <input type={voir ? "text" : "password"} value={mdp} onChange={(e) => setMdp(e.target.value)} autoFocus autoComplete="current-password" />
            <button type="button" className="oeil" onClick={() => setVoir(!voir)} aria-label={voir ? "Masquer le mot de passe" : "Afficher le mot de passe"} title={voir ? "Masquer" : "Afficher"}>
              {voir ? (
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 5.1A10.4 10.4 0 0 1 12 5c6 0 10 7 10 7a17.6 17.6 0 0 1-3.2 3.9M6.6 6.6A17.4 17.4 0 0 0 2 12s4 7 10 7a9.7 9.7 0 0 0 5.4-1.6" /></svg>
              ) : (
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></svg>
              )}
            </button>
          </div>
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
        {onglet === "reglages" && <><RecapEmballes coul={coul} /><Decoupes etat={etat} recharger={recharger} /></>}
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
    // Total par produit, toutes découpes confondues (le détail des découpes est dans l'onglet Découpes)
    const pid = canonique(l.produitId);
    const e = m.get(pid) || { produitId: pid, qte: 0, clients: new Set() };
    e.qte += l.qte; e.clients.add(c.clientId || c.id); m.set(pid, e);
  }
  const rows = [...m.values()].map((e) => ({ ...e, clients: e.clients.size }))
    .sort((a, b) => libelle(PRODUITS_BY_ID[a.produitId] || { nom: a.produitId }).localeCompare(libelle(PRODUITS_BY_ID[b.produitId] || { nom: b.produitId }), "fr"));
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
              <thead><tr><th>Produit</th><th className="n">Quantité</th><th className="n">Clients</th><th>OK</th></tr></thead>
              <tbody>
                {r.map((x) => (
                  <tr key={x.produitId}>
                    <td>{libelle(PRODUITS_BY_ID[x.produitId])}</td>
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
      {rows.length > 0 && (() => {
        const parCat = (cat) => rows.filter((x) => PRODUITS_BY_ID[x.produitId]?.cat === cat).reduce((t, x) => t + x.qte, 0);
        const total = rows.reduce((t, x) => t + x.qte, 0);
        const ht = cmds.reduce((t, c) => t + (c.ht || 0), 0), ttc = cmds.reduce((t, c) => t + (c.ttc || 0), 0);
        return (
          <div className="card total-global">
            <h3 style={{ marginTop: 0 }}>Total global de la production</h3>
            <table><tbody>
              <tr><td>Snacking</td><td className="n"><b>{parCat("snack")}</b> pièces</td></tr>
              <tr><td>Pains en tranches (emballés)</td><td className="n"><b>{parCat("emballe")}</b> pièces</td></tr>
              <tr><td><b>TOTAL</b></td><td className="n"><b style={{ fontSize: 20 }}>{total}</b> pièces</td></tr>
              <tr><td>Commandes / clients</td><td className="n">{cmds.length}</td></tr>
              <tr><td>Montant</td><td className="n">{xpf(ht)} HT · {xpf(ttc)} TTC</td></tr>
            </tbody></table>
          </div>
        );
      })()}
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
              <span style={{ textAlign: "right" }}>{frDate(date)} · {cs.length} client(s) · <b>Total à encaisser : {xpf(cs.filter(aEncaisser).reduce((t, c) => t + c.ttc, 0))}</b></span>
            </div>
            {cs.map((c) => <CommandeLivreur key={c.id} c={c} coul={coul} />)}
          </section>
        );
      })}
      {!liste.length && <p className="muted">Aucune commande.</p>}
    </>
  );
}

// Le livreur encaisse les clients au comptant et ceux en « règlement à la livraison »
const REGLEMENT = { comptant: "Comptant", quinzaine: "À la quinzaine", mois: "Au mois" };
const libReglement = (c) => REGLEMENT[c.reglement] || (c.paiement === "compte" ? "Au mois" : "Comptant");
const aEncaisser = (c) => (c.paiement === "comptant" && c.statut === "a_payer") || c.paiement === "livraison";

function CommandeLivreur({ c, coul }) {
  return (
        <div className="card">
          <h3 style={{ margin: "0 0 4px" }}>{c.clientNom}</h3>
          <p>{c.mode === "retrait" ? "Retrait au fournil" : "Livraison"} · Règlement : <b>{libReglement(c)}</b> · <Statut c={c} /></p>
          <p className="encaisser">{aEncaisser(c) ? <>À ENCAISSER : <b>{xpf(c.ttc)}</b> TTC</> : <>Montant : <b>{xpf(c.ttc)}</b> TTC — sur le relevé {c.reglement === "quinzaine" ? "de la quinzaine" : "du mois"} (rien à encaisser)</>}</p>
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
  const [acces, setAcces] = useState(null); // accès créés (mots de passe affichés une seule fois)
  const creerAcces = async (body, question) => {
    if (!confirm(question)) return;
    try { const r = await api("/api/admin", { method: "POST", body: JSON.stringify(body) }); setAcces(r.crees); recharger(); }
    catch (x) { alert(x.message); }
  };
  const telechargerAcces = () => {
    const NL = String.fromCharCode(10);
    const csv = "Numéro client;Nom;Mot de passe" + NL + acces.filter((a) => a.motDePasse).map((a) => `${a.id};"${a.nom.replace(/"/g, "'")}";${a.motDePasse}`).join(NL);
    const url = URL.createObjectURL(new Blob([String.fromCharCode(0xfeff) + csv], { type: "text/csv;charset=utf-8" }));
    const l = document.createElement("a"); l.href = url; l.download = "acces-clients-la-vie-saine.csv"; l.click(); URL.revokeObjectURL(url);
  };
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
        <h3>Accès des clients</h3>
        {etat.supabaseActif ? (
          <>
            <p className="muted">Chaque snack se connecte avec son numéro client et son mot de passe personnel. {etat.clients.filter((c) => c.aAcces).length} accès créés sur {etat.clients.filter((c) => !c.categorie || c.categorie === "snack").length} snacks.</p>
            <button className="primaire" onClick={() => creerAcces({ action: "accesTous" }, "Créer un mot de passe pour tous les snacks qui n'ont pas encore d'accès ?")}>Créer les accès manquants</button>
          </>
        ) : <p className="muted">Les clients se connectent avec leur seul ID client (ID LGL), que vous leur envoyez par mail.</p>}
        {acces && (
          <div style={{ marginTop: 10 }}>
            <div className="ok">⚠️ Notez ou téléchargez ces mots de passe maintenant : ils ne seront plus affichés. Remettez-les aux clients (pas par un canal public).</div>
            <div className="row no-print"><button onClick={telechargerAcces}>⬇ Télécharger (CSV)</button><button onClick={() => window.print()}>🖨️ Imprimer</button><button onClick={() => setAcces(null)}>Masquer</button></div>
            <table><thead><tr><th>N°</th><th>Client</th><th>Mot de passe</th></tr></thead>
              <tbody>{acces.map((a) => <tr key={a.id}><td>{a.id}</td><td>{a.nom}</td><td>{a.motDePasse ? <code style={{ fontSize: 16 }}>{a.motDePasse}</code> : <span className="badge rouge">{a.erreur}</span>}</td></tr>)}</tbody>
            </table>
          </div>
        )}
      </div>
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
            <div><label>Accès client : {edit.aAcces ? "✔ créé" : "pas encore créé"}</label>
              {etat.supabaseActif && edit.id && <button onClick={() => creerAcces({ action: "acces", id: edit.id }, edit.aAcces ? "Réinitialiser le mot de passe de ce client ? L'ancien ne fonctionnera plus." : "Créer l'accès de ce client ?")}>{edit.aAcces ? "Réinitialiser le mot de passe" : "Créer l'accès"}</button>}
            </div>
          </div>
          <div className="row" style={{ marginTop: 10 }}>
            <button className="primaire" disabled={!edit.id || !edit.nom} onClick={enregistrer}>Enregistrer</button>
            <button onClick={() => setEdit(null)}>Fermer</button>
            <button onClick={async () => { if (confirm("Supprimer ce client ?")) { await api("/api/admin", { method: "POST", body: JSON.stringify({ action: "client", id: edit.id, supprimer: true }) }); setEdit(null); recharger(); } }}>Supprimer</button>
          </div>
        </div>
      )}
      <div className="card table-scroll">
        <table>
          <thead><tr><th>ID</th><th>Nom</th><th className="hide-mobile">Tournée</th><th>Livreur</th><th className="hide-mobile">Règlement</th><th>Type</th><th className="hide-mobile">Habitudes</th><th className="hide-mobile">Accès</th></tr></thead>
          <tbody>
            {liste.map((c) => (
              <tr key={c.id} onClick={() => setEdit({ ...c, code: "" })} style={{ cursor: "pointer" }}>
                <td>{c.id}</td><td>{c.nom}</td><td className="hide-mobile">{c.tournee}</td><td>{c.livreur || ""}</td><td className="hide-mobile">{libReglement(c)}</td><td>{c.categorie === "snack" || !c.categorie ? <span className="badge vert">Snack</span> : <span className="badge">{c.categorie}</span>}</td><td className="hide-mobile">{c.joursHab ? c.joursHab.map((j) => j.slice(0, 3)).join(" ") : ""}</td><td className="hide-mobile">{c.aAcces ? "✔" : <span className="badge ambre">non</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!liste.length && <p className="muted">Aucun client.</p>}
      </div>
    </>
  );
}

// Récapitulatif des pains emballés (pains en tranches) commandés, jour par jour, avec leur découpe
function RecapEmballes({ coul }) {
  const [jours, setJours] = useState(null);
  const [debut, setDebut] = useState(lendemain());
  useEffect(() => {
    setJours(null);
    const dates = []; const d = new Date(debut + "T12:00:00Z");
    while (dates.length < 6) { if (d.getUTCDay() !== 0) dates.push(d.toISOString().slice(0, 10)); d.setUTCDate(d.getUTCDate() + 1); }
    Promise.all(dates.map((x) => api("/api/orders?date=" + x).then((r) => ({ date: x, cmds: r.commandes.filter((c) => c.statut !== "annulee") }))))
      .then(setJours).catch(() => setJours([]));
  }, [debut]);
  if (!jours) return <div className="card"><p className="muted">Chargement du récapitulatif…</p></div>;
  // Total par découpe et par jour (pains emballés). Le standard n'est pas noté.
  const DECOUPES = ["entier", "coupe_long", "coupe_fin", "tranche_2cm", "non_tranche"];
  const tab = Object.fromEntries(DECOUPES.map((d) => [d, Array(jours.length).fill(0)]));
  jours.forEach(({ cmds }, i) => cmds.forEach((c) => c.lignes.forEach((l) => {
    const pid = canonique(l.produitId);
    const p = PRODUITS_BY_ID[pid]; if (!p || p.cat !== "emballe" || !(l.qte > 0)) return;
    const dec = decoupeLigne({ ...l, produitId: pid });
    if (tab[dec]) tab[dec][i] += l.qte;
  })));
  const somme = (a) => a.reduce((x, y) => x + y, 0);
  const totalJour = jours.map((_, i) => DECOUPES.reduce((t, d) => t + tab[d][i], 0));
  const court = (x) => new Date(x + "T12:00:00Z").toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
  return (
    <div className="card">
      <div className="row no-print" style={{ alignItems: "end" }}>
        <h3 style={{ margin: 0 }}>Découpes à faire, par jour</h3>
        <div style={{ flex: "none" }}><label>À partir du</label><input type="date" value={debut} onChange={(e) => setDebut(e.target.value)} /></div>
        <button style={{ flex: "none" }} onClick={() => window.print()}>🖨️ Imprimer</button>
      </div>
      <h3 className="print-only">Découpes à faire, par jour</h3>
      <p className="muted">Nombre de pains emballés par découpe, standard compris (d'après le nom du produit LGL : C/Long, C/Fin, Non coupé… ou le choix du client). Commandes d'office et commandes en plus, hors annulées.</p>
      <div className="table-scroll">
        <table>
          <thead><tr><th>Découpe</th>{jours.map((j) => <th key={j.date} className="n" style={{ textTransform: "capitalize" }}>{court(j.date)}</th>)}<th className="n">Total</th></tr></thead>
          <tbody>
            {DECOUPES.map((d) => (
              <tr key={d}>
                <td style={{ background: coul[d]?.couleur }}><b>{coul[d]?.nom || d}</b></td>
                {tab[d].map((q, i) => <td key={i} className="n" style={{ fontSize: 16 }}>{q ? <b>{q}</b> : "—"}</td>)}
                <td className="n"><b>{somme(tab[d])}</b></td>
              </tr>
            ))}
            <tr><td><b>TOTAL pains emballés</b></td>{totalJour.map((t, i) => <td key={i} className="n"><b>{t}</b></td>)}<td className="n"><b>{somme(totalJour)}</b></td></tr>
          </tbody>
        </table>
      </div>
    </div>
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
