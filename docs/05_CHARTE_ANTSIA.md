# Charte ANTSIA — Réseau public

Date : 2026-10-17. Direction PA8, prolongement de la charte Personnel existante.

## Sujet et intention

Un réseau social gabonais ouvert, avec des contextes de publication lisibles.
La vitrine aide à lire les contenus réellement publics, choisir son parcours
et comprendre où sa propre publication sera visible.

La signature est le **fil d’origine** : une même grille relie les publications
nationales et les contributions choisies des réseaux enfants ; le nom du réseau
est un signifiant de contexte, jamais une décoration ni une certification.

## Palette et typographie

Six teintes issues des tokens existants, sans duplication dans les composants :
papier `#f7f6f2`, carte `#ffffff`, encre `#0a0907`, bleu Gabon `#073871`, ciel
`#e7eff9`, section nocturne `#1c1a14`. Le bleu sert les actions et l’orientation ;
les couleurs du drapeau restent décoratives. En sombre, utiliser les rôles et
contrastes de la charte, jamais la même encre que sur fond clair.

Titres : Familjen Grotesk, usage resserré et échelle fluide ; texte : Inter et
polices système déjà chargées ; données : chiffres tabulaires. Aucune nouvelle
police distante, aucune famille administrative ou logo répliqué.

## Composition

```text
Marque · Découvrir · Transparence                    Entrer

Un titre court                    Publications publiques
Une explication précise           Origine → auteur → contenu
Lire / Rejoindre                   Page suivante explicite

Réseaux réellement présents · Provinces · Confiance expliquée
À propos · Mentions · Confidentialité · Retour à l’accueil
```

Au bureau, un volet d’orientation étroit et un fil respirant ; au téléphone,
un ordre unique, navigation compacte et commandes44px. Cartes de lecture et
fenêtres d’édition gardent les rayons et surfaces du moteur. Éviter les faux
compteurs, contenus de démonstration présentés comme réels, carrousels animés
ou illustrations qui suggèrent une affiliation institutionnelle absente.

## Ergonomie et contrôle

Une action a un libellé stable ; navigation par liens, gestes par boutons.
Filtres/portées/pagination reflétés dans l’URL, état courant visible autrement
que par la couleur. Aucun CTA ouvrant une route fictive. Les refus gardent un
message neutre et une issue ; une indisponibilité technique permet de réessayer.

Titres hiérarchiques, lien d’évitement, focus visible, contenu long refluant,
images admises avec dimensions/alternatives, dates et nombres localisés. Mouvement
réduit respecté ; le rendu public serveur ne dépend pas d’un bootstrap de session.
Mesurer les paires de contraste modifiées et conserver la recette visuelle réelle
distincte des tests DOM et des calculs de tokens.

## Critique avant réalisation

Le risque du parchemin est une vitrine générique à cartes répétées. Le fil
d’origine occupe donc le premier écran avec des contenus autorisés réels et des
états vides utiles, plutôt que des cartes promotionnelles interchangeables.
La typographie et les espacements portent l’identité ; les éléments de confiance
expliquent leurs conditions réelles et ne promettent aucune validation absente.
