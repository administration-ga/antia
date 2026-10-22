# ADR-0037 : Fil sans cadre, grille du bureau, deux formules de relation et formules des boutiques

- **Statut** : Accepté par le propriétaire le 2026-10-22 (demande et réponses du jour).
- **Date** : 2026-10-22

## Contexte

Le 22/10/2026, le propriétaire envoie vingt captures d'un fil social de référence et demande d'en
« recopier exactement » l'architecture :

- une publication épouse le format de son média : aucun cadre sur les côtés, les cadres réservés
  aux zones d'écriture et d'information (en-tête, actions, légende) ;
- au bureau, une grille de « 3 ou 4 » colonnes de publications ;
- des arrondis plus discrets, des boutons de suivi deux fois moins hauts (« 25 px ») ;
- une barre de menu translucide, large et basse ;
- deux formules de relation : suivre sans être ami, ou être ami (ce qui vaut suivre) ;
- des réels et des personnes suggérés ; cinq formules de publication pour les boutiques.

Étude détaillée : `docs/etudes/2026-10-22-fil-sans-cadre/README.md`.

## Décision

Nous allons, sous la présentation « charte » d'antsia.ga (ADR-0028) :

1. faire traverser la carte au média de la publication, bord à bord, sans angle, recadré au centre
   dans son ratio borné (plus aucune bande) ; au téléphone, la carte passe pleine largeur ;
2. ranger le fil du bureau en grille de deux à quatre colonnes, en maçonnerie, l'ordre du DOM restant
   l'ordre chronologique (`FeedMasonryGrid`) ;
3. réduire les angles des sept thèmes (cartes 24 → 16 px, médias 16 → 12 px, actions compactes
   8 → 6 px) et ramener les actions sociales compactes à 25 px de haut ;
4. passer la barre des destinations en verre (flou et saturation), 52 px, icônes seules ;
5. proposer partout où l'on rencontre une personne suggérée les deux formules, Suivre (ou Suivre en
   retour) et Ajouter (lot 2) ;
6. déduire la formule d'une publication de boutique de son offre et de son média (lot 3).

## Conséquences

### Positives

- Les photos et les vidéos occupent toute la largeur au téléphone, sans bandes.
- Le bureau montre trois à quatre fois plus de publications par écran.
- Les boutons de relation cessent d'écraser les cartes de suggestion.

### Négatives

- Un média hors des bornes de ratio est recadré dans le fil ; la visionneuse garde l'image entière.
- Les actions compactes de 25 px passent sous la cible de 44 px voulue jusqu'ici ; elles restent
  au-dessus du minimum de 24 px des cibles (WCAG 2.2, 2.5.8).
- La grille mesure ses cartes (`ResizeObserver`) : sans lui, elle garde des rangées automatiques.

### Neutres

- Les autres présentations (« media », historique) et les autres applications du moteur ne changent pas.

## Alternatives considérées

### Colonnes CSS (`columns`)

Ordre de lecture par colonnes, et des cartes qui sautent d'une colonne à l'autre à chaque page
chargée. Écarté.

### Grille à rangées égales

Des trous sous chaque carte plus courte que sa voisine. Écarté.

## Références

- Étude : `docs/etudes/2026-10-22-fil-sans-cadre/README.md`
- ADR-0027 (thèmes et système épuré), ADR-0028 (écran des chartes)
