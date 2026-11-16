"use client";
import { useEffect, useMemo, useState } from "react";
import { PRODUITS, PRODUITS_BY_ID, prixHT, totaux, libelle, decoupesDe } from "@/lib/catalog";
import { datesPossibles, frDate, HEURE_LIMITE } from "@/lib/rules";

const api = async (url, opts) => {
  const r = await fetch(url, { headers: { "Content-Type": "application/json" }, ...opts });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.erreur || "Erreur");
  return j;
};
const xpf = (n) => n.toLocaleString("fr-FR") + " XPF";
const JOURS = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
const TEL_HABITUDE = "275982";

// Modifier durablement la commande habituelle (commande d'office) se fait par téléphone
function AppelHabitude() {
  return (
    <a href={`tel:${TEL_HABITUDE}`} className="appel">
      📞 Modifier ma commande habituelle : appelez le <b>27 59 82</b>
    </a>
  );
}

// Fiche du client : livreur, tournée, produits habituels avec tarifs (données LGL)
function MonEspace({ moi, mode }) {
  const [ouvert, setOuvert] = useState(true);
  const hab = moi.habitudes || {};
  const jours = JOURS.filter((j) => hab[j]);
  const tournee = moi.tournee?.replace(/^Livreur \d+\s*[:—-]\s*/, "");
  const num = (moi.tournee?.match(/Livreur (\d+)/) || [])[1];
  // Produits habituels (union des jours) avec quantités par jour
  const ids = [...new Set(jours.flatMap((j) => hab[j].lignes.map((l) => l.produitId)))].filter((id) => PRODUITS_BY_ID[id]);
  return (
    <div className="card">
      <div className="row">
        <div>
          <div className="muted">Votre livreur</div>
          <b>{mode === "retrait" ? "Retrait au fournil" : moi.livreur ? `${moi.livreur}${num ? " — Livreur " + num : ""}` : moi.tournee}</b>
          {mode !== "retrait" && tournee && moi.livreur && <div className="muted">{tournee}</div>}
        </div>
        {ids.length > 0 && <button style={{ flex: "none" }} onClick={() => setOuvert(!ouvert)}>{ouvert ? "Masquer" : "Mes habitudes"}</button>}
      </div>
      {ouvert && ids.length > 0 && (
        <>
          <h3>Mes produits habituels</h3>
          <div style={{ overflowX: "auto" }}>
            <table>
              <thead><tr><th>Produit</th><th className="n">Prix HT</th>{jours.map((j) => <th key={j} className="n">{j.slice(0, 3)}.</th>)}</tr></thead>
              <tbody>
                {ids.map((id) => (
                  <tr key={id}>
                    <td>{libelle(PRODUITS_BY_ID[id])}</td>
                    <td className="n">{prixHT(PRODUITS_BY_ID[id], mode)}</td>
                    {jours.map((j) => <td key={j} className="n">{hab[j].lignes.filter((l) => l.produitId === id).reduce((s, l) => s + l.qte, 0) || ""}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {jours.some((j) => hab[j].texte) && <p className="muted">Aussi : {jours.filter((j) => hab[j].texte).map((j) => `${j} : ${hab[j].texte}`).join(" · ")}</p>}
          {moi.remarque && <p className="muted">Note : {moi.remarque}</p>}
          <p className="muted">Prix {mode === "retrait" ? "fournil" : "livraison"} 2026, hors TGC 3 %. Votre commande habituelle est pré-remplie selon le jour choisi.</p>
          <AppelHabitude />
        </>
      )}
    </div>
  );
}

// Commandes d'office des prochains jours : déjà en place, le client peut seulement les modifier ou les annuler
function MesCommandes({ onModifier, rafraichir }) {
  const [jours, setJours] = useState(null);
  const [err, setErr] = useState(null);
  const charger = () => api("/api/orders?mes=1").then((r) => setJours(r.jours)).catch((e) => setErr(e.message));
  useEffect(() => { charger(); }, [rafraichir]);
  const action = async (date, a) => {
    setErr(null);
    try { await api("/api/orders", { method: "POST", body: JSON.stringify({ action: a, date }) }); charger(); } catch (e) { setErr(e.message); }
  };
  if (!jours) return <p className="muted">Chargement de vos commandes…</p>;
  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>Mes commandes des prochains jours</h3>
      <p className="muted" style={{ marginTop: 0 }}>Votre commande d'office est déjà enregistrée : vous n'avez rien à faire. Modifiez-la ou annulez-la seulement si besoin, avant 13 h la veille (2 jours avant pour les pains emballés).</p>
      {err && <div className="err">{err}</div>}
      {jours.map(({ date, office, autres, modifiable }) => (
        <div key={date} className="jour-cmd">
          <div className="row" style={{ alignItems: "baseline" }}>
            <b style={{ textTransform: "capitalize" }}>{frDate(date)}</b>
            <span style={{ textAlign: "right" }}>
              {!office ? <span className="badge">Pas de commande d'office</span>
                : office.statut === "annulee" ? <span className="badge rouge">Annulée</span>
                : office.auto ? <span className="badge vert">Prévue</span>
                : <span className="badge ambre">Modifiée</span>}
            </span>
          </div>
          {office && office.statut !== "annulee" && (
            <p className="muted" style={{ margin: "4px 0" }}>
              {office.lignes.map((l) => `${l.qte} ${PRODUITS_BY_ID[l.produitId] ? PRODUITS_BY_ID[l.produitId].nom : l.produitId}`).join(" · ")} — <b>{xpf(office.ttc)} TTC</b>
            </p>
          )}
          {autres.map((c) => <p key={c.id} className="muted" style={{ margin: "4px 0" }}>➕ Commande en plus : {xpf(c.ttc)} TTC{c.statut === "annulee" ? " (annulée)" : ""}</p>)}
          {office && (modifiable ? (
            <div className="row" style={{ marginTop: 6 }}>
              {office.statut !== "annulee" && <button onClick={() => onModifier(date, office)}>✏️ Modifier</button>}
              {office.statut !== "annulee"
                ? <button onClick={() => confirm(`Annuler la commande du ${frDate(date)} ?`) && action(date, "annulerOffice")}>✖ Annuler</button>
                : <button onClick={() => action(date, "retablirOffice")}>↩ Rétablir</button>}
            </div>
          ) : <p className="muted" style={{ margin: "4px 0" }}>🔒 Délai dépassé : pour un changement, appelez le 27 59 82.</p>)}
        </div>
      ))}
    </div>
  );
}

// Première connexion : le client crée son mot de passe personnel
function CreerMotDePasse({ moi, ok }) {
  const [a, setA] = useState(""); const [b, setB] = useState(""); const [err, setErr] = useState(null);
  const go = async (e) => {
    e.preventDefault(); setErr(null);
    if (a !== b) return setErr("Les deux mots de passe sont différents.");
    try { await api("/api/client", { method: "PUT", body: JSON.stringify({ nouveauCode: a }) }); ok(); } catch (x) { setErr(x.message); }
  };
  return (
    <form onSubmit={go}>
      <h2>Bienvenue {moi.nom}</h2>
      <p>Pour sécuriser votre compte, créez votre mot de passe personnel. Il vous sera demandé à chaque connexion, avec votre numéro client <b>{moi.id}</b>.</p>
      {err && <div className="err">{err}</div>}
      <div className="card">
        <label>Nouveau mot de passe (6 caractères minimum)</label>
        <input type="password" autoComplete="new-password" value={a} onChange={(e) => setA(e.target.value)} autoFocus />
        <label>Confirmez le mot de passe</label>
        <input type="password" autoComplete="new-password" value={b} onChange={(e) => setB(e.target.value)} />
        <button className="primaire gros" style={{ marginTop: 14 }} disabled={a.length < 6 || !b}>Créer mon mot de passe</button>
      </div>
      <p className="muted">Mot de passe oublié plus tard ? Appelez le 27 59 82 pour le réinitialiser.</p>
    </form>
  );
}

export default function Client() {
  const [etat, setEtat] = useState(null);
  const [msg, setMsg] = useState(null);
  const charger = () => api("/api/client").then(setEtat).catch((e) => setMsg(e.message));
  useEffect(() => {
    const u = new URLSearchParams(location.search);
    if (u.get("paye") && !u.get("sid")) {
      setMsg(u.get("vads_trans_status") && !["AUTHORISED", "CAPTURED", "ACCEPTED"].includes(u.get("vads_trans_status"))
        ? "Paiement non abouti : la commande n'est pas validée." : "✅ Merci ! Paiement reçu, votre commande est enregistrée.");
      history.replaceState(null, "", "/client");
    } else if (u.get("paye")) {
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
        <h1><img src="/logo-lvs.png" alt="La Vie Saine" />Commander</h1>
        {etat?.moi && <button onClick={deconnexion}>Changer</button>}
      </header>
      <main className="wrap">
        {msg && <div className={msg.startsWith("✅") ? "ok" : "err"}>{msg}</div>}
        {!etat ? <p className="muted">Chargement…</p> : etat.moi ? (etat.moi.doitCreerCode && !etat.moi.comptant ? <CreerMotDePasse moi={etat.moi} ok={charger} /> : <Commande etat={etat} recharger={charger} />) : <Onboarding ok={charger} />}
      </main>
    </>
  );
}

function Onboarding({ ok }) {
  const [numero, setNumero] = useState("");
  const [code, setCode] = useState("");
  const [besoinCode, setBesoinCode] = useState(false);
  const [err, setErr] = useState(null);
  const [envoi, setEnvoi] = useState(false);

  const go = async (e) => {
    e.preventDefault();
    setErr(null); setEnvoi(true);
    const r = await fetch("/api/client", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ numero, code: besoinCode ? code : undefined }) });
    const j = await r.json().catch(() => ({}));
    setEnvoi(false);
    if (r.ok) return ok();
    if (j.besoinCode) setBesoinCode(true);
    setErr(j.erreur || "Erreur");
  };

  return (
    <form onSubmit={go}>
      <h2>Bienvenue 👋</h2>
      <p>Connectez-vous avec votre numéro client.</p>
      {err && <div className="err">{err}</div>}
      <div className="card">
        <label>Numéro client La Vie Saine</label>
        <input inputMode="numeric" autoComplete="username" placeholder="ex. 1024" value={numero} onChange={(e) => { setNumero(e.target.value); setBesoinCode(false); }} autoFocus />
        {besoinCode && (
          <>
            <label>Code personnel</label>
            <input type="password" inputMode="numeric" autoComplete="current-password" value={code} onChange={(e) => setCode(e.target.value)} />
          </>
        )}
        <button className="primaire gros" style={{ marginTop: 14 }} disabled={!numero.trim() || envoi || (besoinCode && !code)}>Entrer</button>
      </div>
      <p className="muted">Votre numéro client figure sur vos factures. Pas encore de compte ? Appelez La Vie Saine.</p>
    </form>
  );
}

function Commande({ etat, recharger }) {
  const { moi, historique, decoupes } = etat;
  const enLigne = etat.paiementEnLigne && (moi.comptant || moi.paiement === "comptant");
  const [mode, setMode] = useState(moi.mode || (moi.tournee === "Fournil" ? "retrait" : "livraison"));
  const [lignes, setLignes] = useState({}); // produitId -> { qte, decoupe }
  const [date, setDate] = useState("");
  const [note, setNote] = useState("");
  const [supp, setSupp] = useState(null); // null = fermé
  const [cat, setCat] = useState(historique.length || moi.habitudes ? "mes" : "snack");
  const [q, setQ] = useState("");
  const [err, setErr] = useState(null);
  const [envoi, setEnvoi] = useState(false);
  const [fini, setFini] = useState(null);
  const [edition, setEdition] = useState(null); // { date } quand le client modifie sa commande d'office d'un jour
  const [rafraichir, setRafraichir] = useState(0);

  const tab = Object.entries(lignes).map(([produitId, l]) => ({ produitId, ...l })).filter((l) => l.qte > 0);
  const aEmballes = tab.some((l) => PRODUITS_BY_ID[l.produitId]?.cat === "emballe");
  const dates = useMemo(() => datesPossibles(mode, aEmballes), [mode, aEmballes]);
  useEffect(() => { if (!edition && !dates.includes(date)) setDate(dates[0] || ""); }, [dates, edition]);
  const t = totaux(tab, mode);

  const habitudes = moi.habitudes || {};
  const joursHab = JOURS.filter((j) => habitudes[j]);
  const mesIds = new Set([
    ...historique.flatMap((h) => h.lignes.map((l) => l.produitId)),
    ...Object.values(habitudes).flatMap((j) => j.lignes.map((l) => l.produitId)),
  ]);
  const jourDe = (d) => JOURS[(new Date(d + "T12:00:00Z").getUTCDay() + 6) % 7];
  const appliquerHabitude = (jour) => {
    const h = habitudes[jour];
    if (h) setLignes(Object.fromEntries(h.lignes.map((l) => [l.produitId, { qte: l.qte, decoupe: "entier" }])));
  };
  const habDuJour = date ? habitudes[jourDe(date)] : null;
  const differeHabitude = !!habDuJour && (() => {
    const h = {}; habDuJour.lignes.forEach((l) => { h[l.produitId] = (h[l.produitId] || 0) + l.qte; });
    const c = {}; tab.forEach((l) => { c[l.produitId] = l.qte; });
    const ids = new Set([...Object.keys(h), ...Object.keys(c)]);
    return [...ids].some((id) => (h[id] || 0) !== (c[id] || 0));
  })();
  // Client avec commandes d'office : la commande du jour existe déjà ; le formulaire sert à la modifier ou à commander en plus.
  const aOffice = joursHab.length > 0;
  const [formulaireOuvert, setFormulaireOuvert] = useState(false);
  const modifierOffice = (d, office) => {
    setEdition({ date: d }); setDate(d); setMode(office.mode || mode); setNote("");
    setLignes(Object.fromEntries(office.lignes.map((l) => [l.produitId, { qte: l.qte, decoupe: l.decoupe || "entier" }])));
    setFormulaireOuvert(true);
    setTimeout(() => document.getElementById("formulaire")?.scrollIntoView({ behavior: "smooth" }), 50);
  };
  const fermerFormulaire = () => { setEdition(null); setFormulaireOuvert(false); setLignes({}); setSupp(null); setErr(null); };
  // Catalogue limité aux produits déjà achetés (fiches de chargement, commandes d'office, commandes passées).
  // Un client sans aucun historique ne voit aucun produit (il passe par la commande supplémentaire ou appelle).
  const restreint = true;
  const autorises = new Set([...(moi.produits || []), ...mesIds]);
  const visibles = PRODUITS.filter((p) => {
    if (restreint && !autorises.has(p.id) && !lignes[p.id]?.qte) return false;
    if (q) return libelle(p).toLowerCase().includes(q.toLowerCase());
    if (restreint) return true;
    return cat === "mes" ? mesIds.has(p.id) || lignes[p.id]?.qte : p.cat === cat;
  });

  const prerempli = (v) => {
    if (v.startsWith("hab:")) return appliquerHabitude(v.slice(4));
    const h = historique.find((x) => x.id === v);
    if (!h) return setLignes({});
    setLignes(Object.fromEntries(h.lignes.map((l) => [l.produitId, { qte: l.qte, decoupe: l.decoupe }])));
    setMode(h.mode);
  };
  const maj = (id, champ, val) => setLignes((s) => ({ ...s, [id]: { qte: 0, decoupe: "entier", ...s[id], [champ]: val } }));

  const valider = async () => {
    setErr(null); setEnvoi(true);
    try {
      const r = await api("/api/orders", { method: "POST", body: JSON.stringify({ date, mode, note, lignes: tab, supplement: supp || "", office: !!edition }) });
      if (r.checkoutUrl) { location.href = r.checkoutUrl; return; }
      if (r.formulaire) { // PayZen : envoi du formulaire signé vers la page de paiement de la banque
        const f = document.createElement("form");
        f.method = "POST"; f.action = r.formulaire.action;
        for (const [k, v] of Object.entries(r.formulaire.champs)) {
          const i = document.createElement("input"); i.type = "hidden"; i.name = k; i.value = v; f.appendChild(i);
        }
        document.body.appendChild(f); f.submit(); return;
      }
      setFini(r.commande); setEdition(null); setFormulaireOuvert(false); setRafraichir((x) => x + 1); recharger();
    } catch (e) { setErr(e.message); }
    setEnvoi(false);
  };

  if (fini) return (
    <div className="card">
      <h2>✅ {fini.office ? "Commande modifiée" : "Commande enregistrée"}</h2>
      <p>{fini.mode === "retrait" ? "Retrait au fournil" : "Livraison"} le <b>{frDate(fini.date)}</b> — {xpf(fini.ttc)} TTC.</p>
      <button className="primaire gros" onClick={() => { setFini(null); setLignes({}); setSupp(null); }}>{aOffice ? "Retour à mes commandes" : "Nouvelle commande"}</button>
    </div>
  );

  return (
    <>
      <h2>Bonjour {moi.nom}</h2>
      {!moi.comptant && <MonEspace moi={moi} mode={mode} />}
      <p className="muted">
        {enLigne ? "Paiement en ligne à la commande." : moi.paiement === "livraison" || moi.paiement === "comptant" ? "Règlement à la livraison." : "Facturé sur votre compte (relevé LGL)."} Commandes avant {HEURE_LIMITE} h :
        24 h à l'avance pour le snacking, 48 h pour les pains emballés. Lundi : commander le samedi avant 13 h.
      </p>

      {aOffice && <MesCommandes onModifier={modifierOffice} rafraichir={rafraichir} />}
      {aOffice && !formulaireOuvert && (
        <button className="gros" onClick={() => { setEdition(null); setLignes({}); setFormulaireOuvert(true); }}>➕ Passer une commande en plus</button>
      )}

      {(!aOffice || formulaireOuvert) && <div id="formulaire">
      {aOffice && (
        <div className="row" style={{ marginTop: 16 }}>
          <h3 style={{ margin: 0 }}>{edition ? `Modifier ma commande du ${frDate(edition.date)}` : "Commande en plus"}</h3>
          <button style={{ flex: "none" }} onClick={fermerFormulaire}>Fermer</button>
        </div>
      )}
      <div className="card">
        {!edition && <>
        <label>Pré-remplir avec…</label>
        <select onChange={(e) => prerempli(e.target.value)} defaultValue="">
          <option value="">— Commande vide —</option>
          {joursHab.map((j) => <option key={j} value={"hab:" + j}>📅 Ma commande habituelle du {j}</option>)}
          {historique.map((h, i) => (
            <option key={h.id} value={h.id}>{i === 0 ? "⭐ Ma dernière commande" : "Commande"} du {frDate(h.date)} ({xpf(h.ttc)})</option>
          ))}
        </select>
        </>}
        <div className="row">
          <div>
            <label>Mode</label>
            <select value={mode} onChange={(e) => setMode(e.target.value)}>
              <option value="livraison">Livraison</option>
              <option value="retrait">Retrait fournil</option>
            </select>
          </div>
          <div>
            <label>Date</label>
            <select value={date} disabled={!!edition} onChange={(e) => setDate(e.target.value)}>
              {(edition ? [edition.date] : dates).map((d) => <option key={d} value={d}>{new Date(d + "T12:00:00Z").toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" })}</option>)}
            </select>
          </div>
        </div>
        <p className="muted" style={{ margin: "6px 0 0" }}>{mode === "livraison" ? "Livraison le matin, minimum 3 000 XPF HT." : "Retrait au fournil de 6 h à 12 h, lundi au vendredi."}</p>
      </div>

      {restreint ? (
        autorises.size > 0 && <h3>Mes produits ({autorises.size})</h3>
      ) : (
        <div className="tabs">
          {mesIds.size > 0 && <button className={cat === "mes" ? "actif" : ""} onClick={() => setCat("mes")}>Mes produits</button>}
          <button className={cat === "snack" ? "actif" : ""} onClick={() => setCat("snack")}>Snacking</button>
          <button className={cat === "emballe" ? "actif" : ""} onClick={() => setCat("emballe")}>Pains emballés</button>
        </div>
      )}
      {(!restreint || autorises.size > 12) && <input className="recherche" placeholder="🔎 Chercher un produit" value={q} onChange={(e) => setQ(e.target.value)} />}
      {autorises.size === 0 && (
        <div className="card">
          <p style={{ marginTop: 0 }}>Aucun produit n'est encore associé à votre compte.</p>
          <p className="muted">Écrivez votre commande avec « J'ai une commande supplémentaire » ci-dessous, ou appelez-nous pour mettre en place votre commande habituelle.</p>
          <AppelHabitude />
        </div>
      )}
      {restreint && autorises.size > 0 && <p className="muted" style={{ margin: "0 0 6px" }}>Un autre produit ? Ajoutez-le avec « J'ai une commande supplémentaire » en bas.</p>}

      {autorises.size > 0 && <div className="card">
        {visibles.map((p) => {
          const l = lignes[p.id] || { qte: 0, decoupe: "entier" };
          return (
            <div className="ligne" key={p.id}>
              <div>
                <div className="nom">{libelle(p)}</div>
                <div className="prix">{prixHT(p, mode)} XPF HT {p.cat === "emballe" && "· 48 h"}</div>
              </div>
              <input type="number" min="0" inputMode="numeric" value={l.qte || ""} placeholder="0" onChange={(e) => maj(p.id, "qte", Number(e.target.value))} />
              {l.qte > 0 && decoupesDe(p.id).length > 0 && (
                <select value={decoupesDe(p.id).includes(l.decoupe) ? l.decoupe : "entier"} onChange={(e) => maj(p.id, "decoupe", e.target.value)}>
                  {decoupes.filter((d) => d.id === "entier" || decoupesDe(p.id).includes(d.id)).map((d) => <option key={d.id} value={d.id}>Découpe : {d.nom}</option>)}
                </select>
              )}
            </div>
          );
        })}
        {!visibles.length && <p className="muted">Aucun produit trouvé.</p>}
      </div>}

      {(edition || !aOffice) && habDuJour && differeHabitude && (
        <div className="card" style={{ background: "#fffbea" }}>
          <p style={{ margin: 0 }}>Vous avez modifié votre commande habituelle du {jourDe(date)}. Ce changement ne vaut <b>que pour cette commande</b>.</p>
          <AppelHabitude />
        </div>
      )}
      {supp === null ? (
        <button className="gros" style={{ marginTop: 8 }} onClick={() => setSupp("")}>➕ J'ai une commande supplémentaire</button>
      ) : (
        <div className="card">
          <label>Commande supplémentaire — écrivez ce que vous voulez en plus</label>
          <textarea rows={3} autoFocus value={supp} onChange={(e) => setSupp(e.target.value)} placeholder="ex. 20 pains au lait en plus, 2 toasts XXL coupés fin…" />
          <p className="muted">La Vie Saine confirmera et ajoutera ces articles à votre facture.</p>
          <button onClick={() => setSupp(null)}>Retirer</button>
        </div>
      )}
      <label>Remarque (facultatif)</label>
      <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
      {err && <div className="err">{err}</div>}

      <div className="total">
        <div className="in">
          <div className="row" style={{ marginBottom: 6 }}>
            <span>{tab.length} produit(s) · HT {xpf(t.ht)}</span>
            <b style={{ textAlign: "right" }}>TTC {xpf(t.ttc)}</b>
          </div>
          <button className="primaire gros" disabled={(!tab.length && !supp?.trim()) || !date || envoi} onClick={valider}>
            {edition ? "Enregistrer la modification" : enLigne ? `Payer ${xpf(t.ttc)} et commander` : "Valider la commande"}
          </button>
        </div>
      </div>
      </div>}
    </>
  );
}
