# Commandes La Vie Saine

Application mobile (web, installable sur l'écran d'accueil) pour les commandes des clients pros (snacks qui laissaient un message sur le répondeur, clients qui commandaient par mail).

## Deux espaces
- **/client** — Espace CLIENT : onboarding en 1 écran (compte client choisi dans un menu déroulant + code, ou « je paie au comptant »), pré-remplissage avec les commandes précédentes, découpe par produit, contrôle des heures limites, paiement en ligne Stripe pour les clients au comptant.
- **/lvs** — Espace LA VIE SAINE : commandes du jour avec cases par ligne et bouton **OK produit** en bas de chaque commande, **Total à produire** (par produit et par découpe, codes couleur), **Feuilles livreurs** (une page imprimée par commande, regroupées par tournée), import des clients LGL, réglage des découpes et couleurs.

## Règles intégrées (Conditions de commande 2026)
- Commandes avant 13 h (heure de Nouméa) ; snacking 24 h, pains emballés 48 h ; lundi = samedi avant 13 h.
- Livraison lundi–samedi (minimum 3 000 XPF HT) ; retrait fournil lundi–vendredi.
- Prix : grille Fournil (retrait) ou Divers (+10 XPF HT emballé / +5 XPF HT snack en livraison), TGC 3 %.

## Variables d'environnement (Vercel)
| Variable | Rôle |
|---|---|
| `ADMIN_PASSWORD` | Mot de passe de l'espace La Vie Saine |
| `SESSION_SECRET` | Chaîne aléatoire longue (signature des sessions et des codes clients) |
| `KV_REST_API_URL` / `KV_REST_API_TOKEN` | Base Upstash Redis (Vercel → Storage → Upstash) — ajoutées automatiquement |
| `STRIPE_SECRET_KEY` | Clé secrète Stripe (paiement des clients au comptant, devise XPF) |

## Import clients LGL
Dans Excel, copier les colonnes **ID, Nom, Tournée, Paiement (compte/comptant), Code** et les coller dans Espace La Vie Saine → Clients.

## Développement
```
npm install
npm run dev
```
Sans Redis, les données sont dans `.data.json` (local uniquement).
