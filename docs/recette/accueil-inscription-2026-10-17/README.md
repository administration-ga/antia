# Accueil et inscription ANTSIA — recette locale du 17 octobre 2026

## Demande et périmètre

Présenter ANTSIA comme une entrée de réseau social, sur ordinateur et téléphone,
avec la connexion et une création de compte immédiatement visibles. Référence
visuelle : page Facebook fournie par le propriétaire. Le propriétaire a précisé
« ANTSIA uniquement ». Aucun fichier de DIASPORALE n'a été modifié.

L'arbre partagé contenait déjà un accueil d'accès, une présentation compacte du
formulaire partagé, des traductions et un lien d'inscription. Ces changements
ont été préservés et complétés dans le répertoire servi, sans nouvelle branche,
worktree, publication ni commit.

## Résultat

- Accueil en deux colonnes à partir de 960 px : identité du réseau à gauche,
  carte d'accès à droite. Présentation empilée sous cette largeur, avec une
  invitation visible également au téléphone.
- Bouton vert « Créer un compte » avec cible de 48 px, pleine largeur sur petit
  écran. Le vert utilise un jeton existant et conserve un contraste supérieur
  à 4,5:1 avec son texte blanc en thème sombre.
- La route `/entrer?inscription=1` utilise la même présentation que l'accueil.
  L'intention est fournie par la route serveur, et suit la navigation entre
  inscription et connexion. Changer d'intention réinitialise le formulaire OTP.
- Le parcours reste celui du moteur : authentification, puis profil personnel,
  identifiant et consentement explicite avant l'adhésion. Aucun mot de passe ou
  moyen d'accès fictif n'a été ajouté.
- Retour à l'accueil par la marque ; découverte publique et informations légales
  restent accessibles. Textes français et anglais, sans marque codée en dur dans
  les nouvelles traductions.

## Preuves locales

Vérifications exécutées après `bun run codegen` réussi :

| Contrôle | Résultat |
|---|---|
| Typage de l'application | Réussi |
| Tests de l'application | 115 tests, 23 fichiers, réussis |
| Tests du formulaire partagé IdentityEntry | 29 tests réussis |
| Garde-fous du dépôt | 124 tests, 23 fichiers, réussis |
| Lint des composants et tests de cette intervention | Aucune erreur ni avertissement |
| Lint de l'application entière | Aucune erreur ; 8 avertissements dans les fichiers de modération et réglages, hors périmètre |
| Vérification du diff | Réussie |
| Accueil et inscription sur le port 3030 | HTTP 200 et interfaces rendues dans le navigateur |

Dans le navigateur :

- 320 × 720 et 375 × 812 : aucune barre horizontale ; bouton de création de
  compte entièrement visible à 613–661 px, hauteur 48 px ; commandes de la carte
  d'au moins 44 px.
- 768 × 1024 : présentation empilée, largeur de page de 768 px sans débordement.
- 1280 × 850 : deux colonnes distinctes, carte de 400 px, sans débordement.
- Navigation réelle accueil → inscription → connexion → retour navigateur vers
  inscription : titres et liens conformes à l'adresse courante.
- Captures du thème effectivement actif : [ordinateur](ordinateur.jpg) et
  [téléphone](telephone.jpg). Les dimensions ci-dessus sont des formats de
  navigateur simulés, pas une recette sur appareil physique.

## Limites

La configuration locale annonce IDN indisponible : son bouton reste désactivé
avec une explication. L'e-mail et le SMS restent raccordés au fournisseur existant.
Cette intervention n'a créé aucun compte, envoyé aucun code, ni validé une
réception réelle par un fournisseur. Les tests OTP utilisent des réponses simulées.

`bun run verify` intégral n'a pas été exécuté ; aucun commit n'est créé. Le moteur
local déjà actif a été réutilisé ; l'application a été relancée sur le port 3030.

Le vault `/Users/okatech/Documents/Obsidian Vault/` indiqué dans les consignes
n'existe pas dans cet environnement. La résolution du slug ne renvoie rien ;
aucune mémoire ni nouveau vault n'a donc été créé. Le présent compte rendu
conserve les faits de cette intervention dans le dépôt.

## Surfaces confirmées sur le fil connecté

La capture fournie ensuite par le propriétaire montre `/fil` en thème clair,
et non l'accueil précédemment contrôlé. Son choix explicite est : **fond blanc,
cartes beige**. Les captures antérieures de l'accueil ne valident donc pas la
correction du fil.

La correction porte sur `packages/ui/src/themes/antsia.css` :

- `--background` et `--background-dashboard` : blanc du contrat ;
- `--card`, `--esp-surface-card`, `--secondary`, `--ink-0` : parchemin du contrat ;
- `--ink-100` : blanc du contrat pour les surfaces de fond internes.

Cela aligne les cartes des publications, du profil, des rails, du kit d'espace
et d'iCom. La cause était le même neutre 100 pour le fond ANTSIA et le rôle de
carte hérité du moteur. Aucun composant partagé, thème DIASPORALE ou jeton
primitif n'a été modifié. Les deux composants d'accueil restent inchangés lors
de cette dernière correction.

Preuve actuelle : [fil connecté, fond blanc et cartes beige](fil-fond-blanc-cartes-beige.png),
observé dans Chrome natif sur `localhost:3030/fil`, compte fictif `@recette.f3`,
apparence « Clair ». Aucune saisie, sélection de fichier, publication,
authentification ou actualisation explicite n'a été effectuée. Le compte auteur
DIASPORALE et son composeur n'ont pas été manipulés.

Contrôle ciblé existant exécuté : `theme-contract.test.ts`, 3 tests réussis.
Pas de nouveau test, codegen ou vérification lourde. Le contrôle complet de cet
état reste à coordonner ; ne pas le confondre avec les vérifications antérieures.

Le mode sombre conserve ses rôles de la base, plus spécifiques : lecture réelle
dans le navigateur intégré, fond `#14130f`, carte et rôle réseau `#24211a`.
La preuve du fil connecté ci-dessus est une vérification de bureau ; aucune
nouvelle recette mobile authentifiée n'est revendiquée pour ce correctif.

Complément du 18 octobre : le [contrôle mobile authentifié](../fil-mobile-2026-10-18/README.md)
confirme désormais les surfaces blanches et beige en émulation Chrome à
393 × 852 et 375 × 667, avec captures et limites de la vérification.

Les deux serveurs Next, dont la simultanéité a depuis été expressément autorisée
par le propriétaire, sont restés actifs et n'ont pas été relancés.
