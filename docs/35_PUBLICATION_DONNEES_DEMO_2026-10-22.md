# Publication des données de démonstration — 22/10/2026

> Sources : PR 40 (données de démo) et administration-ga/diasporale#23 (10 clés de modération).
> Publication autorisée par écrit par le propriétaire, pour `main` 628e8a9 : démo puis principal,
> contrôles à 390/834/1440 px, retour à `antsia-75eknkz96` si un contrôle échoue.

## Backend (session marketplace, accord écrit du propriétaire)

| Étape | Résultat |
|---|---|
| Convex démo `vivid-hedgehog-655`, puis production `diligent-avocet-585` | `main` 628e8a9, puis 9927c9c (PR 41, SU01d) ; aucun index supprimé |
| Comptes (`prepare-demo-content`) | 7 acteurs reconnectés, 10 figurants créés |
| `seeds/demoContent:run` | 31 publications créées, 21 déjà présentes (vague du 20/10) |
| `seeds/demoContent:runFigurants` | 10 figurants, 20 publications, 30 relations, 16 demandes |
| Images | 47 sur 54 ; restent les 7 actus du jour (PNG trop lourds pour `convex run`) |

## Fronts (Vercel, contexte figé)

Contexte : `git archive` de ANTSIA 628e8a9 (arbre 1b2774d9) et de DIASPORALE df2bca3,
3 232 fichiers, empreinte `98ed496b…`. Secrets serveur hérités, jamais lus.

| Projet | Déploiement | Version | État |
|---|---|---|---|
| Enfant démo | `dpl_FCwtTZXT2xt8SNjHJhEruDmfaV4U` (antsia-demo-lxv1xb7du) | `main-628e8a96be67-demo` | READY, promu |
| Principal | `dpl_Fxg6JPahZcCRo1G5TaaaDf9BSdPX` (antsia-dl360lhin) | `main-628e8a96be67-production` | READY, promu |

Retour arrière : promouvoir `antsia-75eknkz96` (main-2b93836a9187).

Ce front 628e8a9 tourne sur le backend 9927c9c, dont les changements sont additifs : motifs de
signalement en plus, deux genres d'avis (`report_received`, `report_decided`), nouvelles
fonctions, rien de retiré. Seule limite : l'avis d'accusé de réception d'un signalement n'a pas
de phrase tant que le front de 9927c9c n'est pas publié.

## Recette en ligne (compte Membre, Awa MBA)

| Contrôle | 1440 | 834 | 390 |
|---|---|---|---|
| Fil : publications des figurants, photos, portraits | ✓ | ✓ | ✓ |
| Bandeau « 3 invitations en attente » | ✓ | ✓ | ✓ |
| Débordement horizontal | aucun | aucun | aucun |

Autres contrôles :
- Mon réseau : 5 connexions ; invitations reçues (Prisca BIYOGHE, Georgette MAKAYA, Mireille
  NZIGOU) et envoyée (Albert MBOUMBA), avec portraits.
- Personnes à découvrir : figurants avec portrait, « Ajouter » ou « Répondre à l'invitation ».
- Épicerie : 12 produits sur la vitrine et « Voir tout le catalogue » (13) ; les 12 photos sont
  servies en 200 et se décodent aux bonnes dimensions.
- Marketplace (onglet Produits) : 13 produits.
- Écran de connexion de la démo : toujours huit comptes, aucun figurant.
- Site principal (hors démo) : 1440/834/390 sans débordement ; aucune ressource en erreur après
  rechargement.
- Santé : `/api/sante-fonctionnelle` et `/demo/api/sante-fonctionnelle` rendent les versions
  ci-dessus.

## Restes

1. Les 7 actus du jour de la démo : `seed-demo-content.mjs` avec la clé de démonstration
   (rejouable, ne pose que ce qui manque), ou le prochain passage des graines.
2. Le front de `main` 9927c9c (PR 41, « Mes signalements ») reste à publier.
3. La fiche boutique laisse beaucoup de vide à 1440 px : catalogue sur deux colonnes étroites
   dans un cadre de 768 px (ShopFrame `max-w-3xl`), déjà relevé le 21/10.

## Mise à jour — publication de `main` 1942aa7 (iCom en colonne droite)

- Entre-temps : backend 9927c9c (PR 41), fronts 3ba59c7 publiés par la session marketplace ; recette
  connectée conforme (cloche : 3 demandes ; marketplace : 13 produits et 20 services).
- Les 7 actus du jour sont posées (images 54/54), sans clé, par la connexion CLI du Mac.
- PR 44 : `MessagerieDock` revient en tête de la colonne droite du fil (décision du propriétaire).
  Front seul, aucun changement sous `convex/`.
- Fronts promus (accord écrit du propriétaire) :
  - enfant démo : `dpl_CXq6fxP6AjzaP4te2C9p2gZFACi5` (antsia-demo-g8bhjmocb), version `main-1942aa7ebfb5-demo` ;
  - principal : `dpl_DR58SLXdJnfHYhgG1xuD8pSgoJAn` (antsia-fl8eoqzvl), version `main-1942aa7ebfb5-production`.
  - Contexte : ANTSIA 1942aa7 et DIASPORALE 214831c, 3 236 fichiers, empreinte `35dac378…`.
  - Retour arrière : antsia-fqt7jo4yd (principal) et antsia-demo-9wd9liokh (enfant).
- Recette :
  - 1440 : iCom (« Messages ») en tête de la colonne droite, puis Personnes à découvrir ;
  - 834 : colonne droite repliée, comme prévu ;
  - 390 : bande des actus avec images ;
  - aucun débordement horizontal, aucune ressource en erreur.
- Reste : la démo n'a encore aucune conversation, donc iCom affiche « Aucune conversation » pour
  les comptes de démonstration.
