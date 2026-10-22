# Fil sans cadre, suggestions et formules des boutiques — étude du 22/10/2026

Demande du propriétaire (22/10/2026), sur vingt captures d'un fil social de référence :
recopier son architecture — publication qui épouse le format de son média, sans cadre
sur les côtés, cadres réservés aux zones d'écriture et d'information ; réels et
personnes suggérés ; cinq formules de publication des boutiques ; arrondis plus
discrets ; boutons de suivi deux fois moins hauts ; barre de menu translucide, large
et basse. Le modèle est un téléphone : l'adapter au bureau.

Réponses du propriétaire aux questions posées le même jour :
- bureau : « 3 ou 4 en mode desktop » — une grille de trois ou quatre colonnes de publications ;
- boutons de suggestion et de suivi : « 25 px » de haut ;
- recette sur un backend local isolé (port 3060) : accordée.

## 1. Ce que montrent les captures

| Élément | Référence | ANTSIA avant | ANTSIA après |
|---|---|---|---|
| Publication au téléphone | pleine largeur, aucun bord, aucune carte | carte arrondie (24 px), 16 px de marge autour du média | pleine largeur, média bord à bord, 12–16 px seulement autour du texte, de l'en-tête et des actions |
| Média | ratio propre, borné (4:5 à 1,91:1), jamais de bandes | ratio borné, `contain`, bandes grises dès que le média sort des bornes ou dépasse 75 % de la hauteur | même ratio borné, recadré au centre (`cover`) : plus de bandes ; la visionneuse garde l'image entière |
| Bureau | (modèle téléphone) | une colonne de lecture | grille de 2 colonnes (tablette) à 3 puis 4 (bureau), cartes à hauteur naturelle, ordre chronologique conservé |
| Arrondis | cartes ~12–16 px, réels ~10–12 px | cartes 24 px, médias 16 px | cartes 16 px, médias 12 px |
| Boutons Suivre / Ajouter | ~28 px, rectangle arrondi | 44 px | 25 px visibles ; la cible tactile reste de 44 px (zone invisible au-dessus et au-dessous) |
| Barre de menu | verre translucide, icônes seules, basse | 64 px, opaque à 90 %, libellés | 52 px, verre (flou et saturation), icônes seules, libellés pour les lecteurs d'écran |
| Réels suggérés | cartes 9:16 qui défilent | cartes 9:14 dans une carte | cartes 9:16, rayon 12 px, rangée pleine largeur |
| Personnes suggérées | grand avatar, nom, Suivre, ×, « Voir tout » | portrait 4:3, une seule action (Ajouter) | grand avatar rond, Suivre (ou Suivre en retour) et Ajouter en ami, ×, Voir tout |

## 2. Suivre ou être ami

Le moteur porte déjà les deux relations :
- **suivre** (`graph.follows`) : unilatéral ; on voit les publications de la personne ;
- **être ami** (`graph.connections`) : demande puis acceptation ; le fil de chacun
  intègre l'autre (`respondToConnection` rafraîchit les deux fils). Être ami vaut donc suivre.

L'écran propose les deux gestes partout où l'on rencontre une personne suggérée :
`Suivre` (ou `Suivre en retour` quand elle vous suit déjà, puis `Suivi`) et `Ajouter`
(puis `Demande envoyée`, ou `Accepter` quand elle vous l'a demandé). « Suivre en retour »
lit un champ ajouté au catalogue des suggestions (`followsYou`). Tant que ce backend
n'est pas déployé, le champ manque et l'écran dit simplement « Suivre ».

## 3. Formules des boutiques (proposition)

La formule se déduit de l'offre attachée à la publication, sans réglage de plus pour le vendeur :

| Formule | Déclencheur | Rendu |
|---|---|---|
| Réservation | service au mode `booking` (location, rendez-vous) | bandeau d'action collé au média : titre, prix, « Réserver » ; « Obtenir un devis » en second si le devis est aussi ouvert |
| Devis | service au seul mode `quote`, ou prix « sur devis » | bandeau « Obtenir un devis » |
| Trois vues | produit avec au moins trois photos | une grande vue et deux petites, le prix et la boutique dessous, « Acheter » |
| Fiche produit | produit avec une ou deux photos, carte étroite | photo sur fond neutre, titre et prix, bandeau « Acheter » |
| Panneau prix | produit avec une ou deux photos, carte large (≥ 480 px) | photo à gauche, titre, description courte, prix et actions dans un panneau à droite |
| Vidéo et modèles | publication vidéo dont l'offre a des variantes | la vidéo, puis la rangée défilante des modèles (variantes) avec leur prix |

Les couleurs viennent des jetons de rôle du thème (`--role-commerce-*`), jamais d'une
marque. Les liens mènent aux pages réelles de l'offre (panier, réservation, devis).

## 4. Lots

1. **Socle et publications** : jetons d'arrondi des sept thèmes, boutons compacts de
   25 px à cible de 44 px, barre translucide, publication pleine largeur au téléphone,
   médias sans bandes, grille du bureau.
2. **Suggestions et relations** : réels suggérés en 9:16, carrousel des personnes,
   Suivre / Suivre en retour / Ajouter / Accepter ; champ `followsYou` du catalogue.
3. **Formules des boutiques** : bandeau d'action et les cinq rendus ci-dessus.

Chaque lot passe `bun run verify`, une recette navigateur mesurée à 390, 834, 1280,
1440 et 1920 px, puis sa PR. Aucun déploiement : la publication reste au propriétaire.

## 5. Recette

### Lot 1 — socle et publications (22/10/2026)

Backend local isolé du candidat (ports 3260/3261, front 3060), compte « Membre vérifié », images de
démonstration posées par `seeds/demoContent:mediaTargets` et `seeds/demoContentMedia:storeAsset`.
Mesures prises dans le navigateur :

| Largeur | Mesure |
|---|---|
| 390 px | carte de publication à `x = 0`, 390 px de large, angle 0 ; média 390 × 260 (photo 3:2), `object-fit: cover` ; barre basse 54 px (52 + filet), `blur(24px) saturate(1.5)`, fond à 72 % |
| 834 px | grille de 2 colonnes |
| 1 440 px | grille de 3 colonnes de 245 px, gouttière 24 px, colonne de droite visible ; média bord à bord dans la carte (angle 0), carte à 16 px |
| 1 920 px | grille de 4 colonnes de 298 px |

Captures : `recette/lot1-telephone-390.jpg`, `recette/lot1-telephone-390-photo.jpg`,
`recette/lot1-bureau-1440.jpg`, `recette/lot1-bureau-1920.jpg`.

### Lot 2 — suggestions et relations (22/10/2026)

Même banc local. Ce qui change :
- la carte de suggestion unique de tête (ADR-0028) laisse place au carrousel « Personnes à
  découvrir », à l'endroit de la référence : après la troisième publication (ou la dernière d'un
  fil plus court), et au-dessus de l'état vide d'un fil vide ;
- chaque carte : portrait rond de 80 px, nom, ligne d'appoint, « Suivre » (ou « Suivre en retour »)
  et « Ajouter », chacun de 25 px, et « × ». Une personne suivie garde sa carte (« Suivi ») ;
- le rail droit et le catalogue « Voir tout » offrent aussi « Suivre » ;
- la rangée d'actions du profil passe à 25 px ;
- les clips du fil passent en cartes 9:16, pleine largeur au téléphone ;
- sur la grille du bureau sans colonne droite (768 à 1 399 px), la découverte revient pleine largeur.

| Constat | Mesure |
|---|---|
| 390 px, carrousel | rangée à `x = 0`, 390 px ; cartes de 168 × 227 px ; Suivre et Ajouter à 25 px |
| Suivre (Ruth ALLOGHO) | `follows` écrit ; la carte reste et dit « Suivi », nom accessible « Vous suivez Ruth ALLOGHO : ne plus suivre » |
| Suivre en retour | Nadège KOUMBA suit Jean-Rémy : sa carte chez Jean-Rémy dit « Suivre en retour » (champ `followsYou` lu sur le backend) |
| Profil, 390 px | Ajouter, Suivre et Clips à 25 px |
| 1 280 px | grille de 3 colonnes, pas de colonne droite : le carrousel occupe la rangée entière (960 px) |

Captures : `recette/lot2-telephone-390-suggestions.jpg`, `recette/lot2-bureau-1280-suggestions.jpg`.
Les données de démonstration n'ont aucune vidéo : la rangée des clips n'a pas pu être vue à
l'écran ; ses tests la couvrent.
