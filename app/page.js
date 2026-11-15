export default function Accueil() {
  return (
    <>
      <header className="bar"><h1>🥖 Boulangerie La Vie Saine</h1></header>
      <main className="wrap">
        <div className="choix">
          <a href="/client">
            <strong>Espace CLIENT</strong>
            Passer une commande (snacks, commerces, clients pros).
          </a>
          <a href="/lvs">
            <strong>Espace LA VIE SAINE</strong>
            Commandes du jour, total à produire, feuilles des livreurs.
          </a>
        </div>
        <p className="muted" style={{ marginTop: 24 }}>
          Particuliers : les prix sont sur le site internet ou dans la liste de tarifs papier.
        </p>
      </main>
    </>
  );
}
