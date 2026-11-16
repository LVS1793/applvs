export default function Accueil() {
  return (
    <>
      <main className="wrap">
        <img src="/logo-lvs.png" alt="La Vie Saine — le vrai boulanger traditionnel" className="logo-accueil" />
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
      </main>
    </>
  );
}
