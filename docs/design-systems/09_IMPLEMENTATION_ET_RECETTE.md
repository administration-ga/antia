# Implémentation des sept design systems dans ANTSIA

**20 octobre 2026 — sources réelles et recette locale.**

Référence : [ANTSIA, sept thèmes et huit rubriques](https://claude.ai/artifact/AnLxkaqaai725ywzkrVk6b#page-c71058556eba).
[Index](README.md) · [Socle](00_SOCLE_COMMUN.md) · [Constat initial](08_ECARTS_REFERENCE_ET_CODE.md).

## Résultat

Gaboma, Soleil, Forêt, Corail, Lagon, Électrique et Sable habillent les composants
déjà servis par l’application. Le thème choisi reste celui du compte ; apparence
et motif conservent leur portée existante. Les routes, données, habilitations,
consentements, sessions et contrôleurs de communication restent ceux du moteur.

Les couleurs fondamentales sont conservées. Les nouveaux raccords sont opt-in :
jetons à `initial` dans `packages/ui/src/styles/charte.css`, valeurs définies
uniquement par les sept chartes ANTSIA et anciens styles en repli dans le moteur.
Les tests d’isolation de DIASPORALE et de la console passent.

## Couverture des huit rubriques

| Rubrique | Sources raccordées | Présentation appliquée |
|---|---|---|
| Les sept thèmes | Sept CSS `packages/ui/src/themes/antsia*.css`, `theme-picker.tsx`, primitives et kit UI | Nuanciers, clair/sombre, polices, géométrie, contrastes, motifs et profondeur |
| Accueil et accès | `access-home-screen`, `sign-in-screen`, `welcome-screen`, `public/*` | Marque avec point, navigation responsive, porte IDN/OTP, aperçu de profil, aperçu public SSR réel, sommaire mobile/bureau |
| Fil et vie sociale | `shell/ReseauAgentPage`, `shell/mobile`, features réseau, actus et notifications, découverte et préférences du fil | Colonnes, gouttières, cartes, textes riches, composeur, recherche, listes et états existants |
| Messages et directs | Styles et conversation iCom, DirectPage/Studio/Discussion/Antenne, iAppel | Titres, champs, corps, surfaces et rôles ; conférence raccordée via DirectPage |
| Profils et pages | ProfilPersonnePage, ProfilPagePage, Avatar, ProfilFrame, AlbumPage/AlbumsSection, `moi/me-screen` | Avatar de profil 104 px, grande page rayon 24 px, médias, titres et espace personnel |
| Boutiques et achats | Composants réels `shops/`, `cart/`, `checkout/`, `payment/`, `purchases/` | Vitrine, catalogue, offre, contact, panier, préparation, paiement, achat et gestion ; panneaux responsive et étapes distinctes |
| Emplois et services | Composants réels `jobs/` et `services/` | Offre, candidature, pièces, demandes, devis, rendez-vous et prestations ; états et consentements existants |
| Compte et données | Paramètres, PersonalControls, modération, santé et coque membre | Affichage, langue/fuseau, consentements, export/effacement, décisions et état du service |

Les 60 planches sont des références de composition. Leurs personnes, messages,
prix, offres et compteurs ne sont pas injectés dans l’application.

## Mesures et arbitrages

- Corps Inter **15 px / 1,5**, champs **16 px / 1,4**.
- Titres Familjen Grotesk : **26 / 20 / 16 px**, interlignes **1,1 / 1,2 / 1,3**.
- Carte **24 px**, intérieur **16 px**, espacement intérieur **12 px** ;
  champ **14 px**, média **16 px**, badge **6 px**, puce **10 px**.
- Cibles tactiles **44 px** conservées, conformément à la règle écrite de la référence.
- Créer **52 × 52 px**, rayon **18 px**, ombre à **75 %** de l’aplat.
- Dock carte **88 %**, flou **16 px**, rayon **28 px** ; téléphone côtés **12 px**,
  bas **16 px** ; tablette largeur **540 px**, bas **26 px**.
- Bureau : grille **248 px / centre flexible / 312 px**, gap **24 px**,
  maximum **1 400 px**, gouttières **20 px** selon la composition.
  Depuis le 22/10/2026 (demande du propriétaire) : **une seule gouttière**,
  plus de maximum. La marge extérieure vaut l'écart entre les colonnes, et la
  barre du haut comme le bandeau démo s'y alignent : **16 px** de 768 à
  1 199 px, **24 px** au-delà (jeton Tailwind `--spacing-gutter`). La colonne
  centrale prend la largeur restante ; le téléphone ne change pas.
- Tablette du fil : colonne **728 px**, padding **8 / 24 / 140 px** ;
  téléphone **4 / 12 / 120 px**.
- Les exceptions d’ombre de **Soleil** et **Corail** suivent les CSS des maquettes.
  Les autres cartes restent plates ; Électrique garde son anneau.
- Fonds doux message et réaction calculés en sRGB à **15 % / 18 %**, avec
  vérification des contrastes ; grain radial **5 / 7 / 11 px** et projecteur **85 % / 55 %**.
- Messages conserve la barre iCom **Menu / Conversations / Appels / Contacts**,
  comme `Messages.dc.html` ; les pages sociales gardent les cinq destinations.

## Vérifications exécutées

| Vérification | Résultat |
|---|---|
| `bun run codegen`, déploiement anonyme local | Réussi ; typage strict Convex réussi |
| Types application, UI et social-features | Réussis |
| Tests application | **756 / 756**, 102 fichiers |
| Tests UI | **2 263 / 2 263**, 17 fichiers ; nouvelle mesure de référence et isolation incluses |
| Tests social-features | **4 026 / 4 026**, 260 fichiers |
| Cliquets transverses | **140 / 140**, 25 fichiers |
| Compilation Next.js optimisée et typage de build | Réussis |
| Lint application, UI et social-features | **0 erreur**, avertissements du dépôt conservés |
| Espaces finaux et liens Markdown locaux | Contrôlés |

Les assertions CSS de géométrie vérifient aussi les anciens replis et les
scrollers du moteur. Un test de candidature utilisait un mauvais prototype de
Storage dans jsdom : le test vise désormais le stockage réel, sa garde métier
n’a pas changé. La fixture d’état inconnu est explicitement distincte de la
fixture de candidature valide.

## Recette sur l’application servie

Serveur **localhost:3030** existant, moteur anonyme local sur **3210**.
Compte local de démonstration vérifié, sans connexion à une cible de production.

- Paramètres : **sept thèmes × clair/sombre** à 1 440 × 1 024.
  Corps 15 px, titre 26 px, champ 16 px et absence de débordement vérifiés.
- Téléphone **390 × 844** : paramètres, messagerie, profil, candidatures,
  demandes, données personnelles, page publique et état du service.
- Tablette **834 × 1 194** : fil, paramètres et vitrine existante ;
  dock 540 px centré et colonne de fil 728 px mesurés.
- Accueil : passage FR/EN immédiat du titre et de l’aperçu public vérifié, puis français rétabli.
- Le conflit `inline-flex` / `hidden` du menu public a été corrigé puis
  revérifié : marque et Entrer au téléphone ; sommaire ouvrable.
- Le profil réel, la vitrine de démonstration et les états vides de
  conversations, candidatures et demandes sont affichés sans données inventées.
- Préférences du compte de démonstration rétablies : **Lagon, Système, Aucun**.
  Tailles temporaires du navigateur rétablies.

![Sept thèmes dans les paramètres réels](recette/sept-themes-desktop.jpg)

![Paramètres au téléphone](recette/parametres-mobile.jpg)

![Sommaire public mobile](recette/page-publique-mobile.jpg)

### Gouttière unique (22/10/2026)

Candidat tiré de `main`, backend Convex local isolé, sept comptes de
démonstration et contenu fictif semés ; aucune cible de démonstration ni de
production. Mesures prises dans la page (`getBoundingClientRect`), sur `/fil` :

| Largeur | Marge gauche | Écart rail / fil | Écart fil / colonne droite | Marge droite | Barre du haut (gauche / droite) |
|---|---|---|---|---|---|
| 1 024 px | 16 | 16 | — (pas de colonne droite) | 16 | 16 / 16 |
| 1 280 px | 24 | 24 | — (pas de colonne droite) | 24 | 24 / 24 |
| 1 440 px | 24 | 24 | 24 | 24 | 24 / 24 |
| 1 920 px | 24 | 24 | 24 | 24 | 24 / 24 |

- La colonne du fil mesure 880, 960, 784 puis 1 264 px ; les publications
  l'occupent entière, en Liste comme en Immersion.
- Réglages et Messages, à 1 440 px : rail à 24 px du bord, écart de 24 px, contenu
  jusqu'à 24 px du bord droit.
- Téléphone **390 px** : coquille inchangée (cartes à 12 px des bords), sans
  défilement horizontal.
- Le bandeau démo n'existe qu'avec le backend de démonstration : sa classe
  `px-gutter` a été mesurée dans la page, à 16 px puis 24 px dès 1 200 px.

![Fil à 1 440 px : 24 px aux bords comme entre les colonnes](recette/gouttiere-fil-1440.jpg)

![Fil à 1 920 px](recette/gouttiere-fil-1920.jpg)

![Fil à 1 280 px](recette/gouttiere-fil-1280.jpg)

![Fil à 1 024 px, rail compact](recette/gouttiere-fil-1024.jpg)

![Fil au téléphone, 390 px](recette/gouttiere-fil-390.jpg)

### Gouttière des espaces spécialisés (22/10/2026)

Boutique, prestataire, professionnels et média ont leur propre cadre
(`specialized-page.tsx`). Il suit désormais la même règle : dès 768 px, le
jeton `--spacing-gutter` fait la marge extérieure, l'écart entre le rail de
l'espace et son contenu, et le retrait de la barre de l'espace. Le cadre de
1 440 px centré est retiré. Le téléphone ne change pas : barre basse fixe,
retraits de 12 px, puis 24 px de 640 à 767 px.

Même candidat et même méthode que ci-dessus. Mesures prises sur
`/boutique/epicerie-moussavou-demo`, `/prestataire/studio-objectif-demo`,
`/professionnels`, `/media/gabon-actu-demo` et `/presse`. Les quatre espaces
donnent les mêmes valeurs :

| Largeur | Marge gauche | Écart rail / contenu | Marge droite | Barre de l'espace (gauche / droite) | Colonne de contenu |
|---|---|---|---|---|---|
| 1 024 px | 16 | 16 | 16 | 16 / 16 | 880 |
| 1 280 px | 24 | 24 | 24 | 24 / 24 | 1 000 |
| 1 440 px | 24 | 24 | 24 | 24 / 24 | 1 160 |
| 1 920 px | 24 | 24 | 24 | 24 / 24 | 1 640 |

- La marge gauche se mesure aux destinations du rail. Le rail n'a plus de
  retrait intérieur : le fond de la destination active touche la gouttière.
- Téléphone **390 px** : barre basse fixe d'un bord à l'autre, contenu et barre
  de l'espace à 12 px, sans défilement horizontal. À 700 et 767 px : 24 px,
  comme avant. À 768 px : 16 / 16 / 16.
- Piège corrigé : Tailwind 4 émet `sm:` (en rem) après `min-[768px]:` (en px).
  Le `min-[1200px]:px-8` du contenu ne s'appliquait donc jamais. Le `sm:` est
  désormais borné au téléphone (`sm:max-[768px]:`).
- Reste hors de ce lot : plusieurs écrans se centrent eux-mêmes dans la colonne,
  avec leur propre largeur maximale :
  - la vitrine, le catalogue, les offres et les formulaires de boutique ou de
    prestataire (`ShopFrame` de `shop-ui.tsx`, 768 px). À 1 920 px, la vitrine
    laisse 436 px de chaque côté de son bloc ;
  - l'annuaire des professionnels (1 024 px) ;
  - l'annuaire presse (1 152 px).

![Boutique à 1 440 px : 24 px aux bords comme entre le rail et le contenu](recette/gouttiere-boutique-1440.jpg)

![Boutique à 1 920 px : la vitrine reste centrée dans sa colonne](recette/gouttiere-boutique-1920.jpg)

![Boutique à 1 280 px](recette/gouttiere-boutique-1280.jpg)

![Boutique à 1 024 px, rail compact](recette/gouttiere-boutique-1024.jpg)

![Boutique au téléphone, 390 px](recette/gouttiere-boutique-390.jpg)

## Limites de preuve et état Git

Le `verify` global avec l’ensemble des tests backend et des espaces de travail voisins n’a pas été relancé : la validation est ciblée sur les surfaces modifiées et leurs contrats.

Cette recette confirme les vues citées et les raccords des composants réels ;
elle ne constitue pas une comparaison exhaustive de chaque pixel des
60 planches × sept thèmes × deux modes × trois formats.

Les données locales ne fournissent pas tous les états de catalogue, paiement,
candidature ou prestation. Leurs composants et tests ont été vérifiés ; aucune
transaction, candidature, demande commerciale, communication, autorisation de
caméra/microphone, export ou suppression n’a été exécuté pour produire les captures.

Les travaux parallèles du dépôt sont conservés, notamment les changements de
modération/effacement et les traductions de boutiques. Aucun changement de
branche, commit applicatif, push, merge, publication ni fichier d’environnement
modifié par cette livraison. Les anciens rapports de production ne prouvent
pas la publication de ces nouveaux raccords.
