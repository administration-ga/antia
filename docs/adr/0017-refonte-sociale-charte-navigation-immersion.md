# ADR-0017 : Refonte sociale ANTSIA — charte encre et prune, navigation opt-in, immersion avec mode liste

- **Statut** : Proposé — implémentation demandée par le propriétaire le 18/10/2026 (« Implémente ») ;
  la palette et l'immersion par défaut sur téléphone ne seront « acceptées » qu'après recette.
- **Date** : 2026-10-18
- **Portée** : lots P01–P05 de l'étude `docs/etudes/2026-10-18-social-commerce/` ; complète ADR-0010
  (préférences de présentation) et ADR-0012 (projections publiques), sans les modifier.

## Contexte

Le propriétaire demande un réseau ANTSIA « présenté comme Instagram, défilant comme TikTok,
communiquant comme WhatsApp, organisé comme Facebook ». Le moteur possède déjà cartes, médias,
réactions, pages, iCom, appels et le choix système/clair/sombre ; il manque une hiérarchie média,
une navigation à cinq destinations, un fil immersif et des états d'appel lisibles. Les paquets
`@antsia/social-features`, `@antsia/ui` et `@antsia/api` servent aussi DIASPORALE, qui ne doit
pas changer. Le thème clair « fond blanc, cartes beige » a été demandé le 17/10 et doit rester.

## Décision

Nous allons :

1. Appliquer la palette **encre, ivoire et prune** de l'étude (03 §2) dans le seul thème
   `packages/ui/src/themes/antsia.css`, avec surcharge sombre `.dark[data-charte="antsia"]` et
   `.dark [data-charte="antsia"]`. Tout jeton nouveau est déclaré dans `charte.css` avec une valeur
   par défaut qui reproduit le rendu des autres consommateurs. Aucune seconde infrastructure de thème.
2. Introduire une **capacité de présentation** déclarée par l'application (contrat `@antsia/api`) :
   ANTSIA active la navigation Fil · Découvrir · Créer · Messages · Profil (rail à partir de 960 px) ;
   sans déclaration, la coque garde son comportement actuel. Aucun test de nom de marque dans le
   code partagé. La coque de communication reste montée une fois dans le gabarit membre.
   Forme livrée au lot P02 : `NetworkProvider navigation="destinations"` (type `EngineNavigation`,
   lu par `useNetwork().navigation`) et deux adresses facultatives `EngineRoutes.discover` et
   `EngineRoutes.me` ; `resolveEngineNavigation` revient aux volets si l'une manque. Seule
   l'application ANTSIA la déclare (`network-shell.tsx`) ; DIASPORALE n'a aucune ligne modifiée.
3. Rendre les publications selon l'ordre auteur → média → actions → légende → offre facultative,
   au ratio du média (plus de 16:10 imposé), dans la carte connectée comme dans la carte SSR publique.
4. Proposer un **fil immersif** sur téléphone, sur le vrai fil et ses portées, avec un mode **Liste**
   mémorisé par réseau ; Liste par défaut au bureau ; réduction des mouvements et lecteur d'écran
   ramènent à Liste. Un coordinateur de lecture n'autorise qu'**une vidéo active** ; aucune lecture
   automatique avec son ; pause hors écran, onglet masqué et appel entrant.
5. Réorganiser iCom en Conversations · Appels · Contacts, avec des états d'envoi et d'appel issus
   des seules preuves serveur. Aucune promesse de sonnerie native ni de chiffrement de bout en bout.

## Conséquences

### Positives

- Une seule base de composants pour les deux réseaux ; DIASPORALE n'adopte rien sans décision.
- Les cliquets existants (`theme-contract`, `no-hardcoded-colors`, `social-shell-boundary`,
  `i18n-locales`) continuent de garder la refonte.

### Négatives

- Chaque composant partagé porte une variante supplémentaire à tester pour deux consommateurs.
- Le fil immersif reste borné par la composition actuelle à 200 sources (PA10 non réalisé).

### Neutres

- Retour arrière par capacité : désactiver la présentation ANTSIA rend l'ancienne coque ; revenir
  au mode Liste désactive l'immersion ; l'ancien mapping de couleurs reste dans l'historique Git.

## Alternatives considérées

### Option A — dupliquer la coque dans l'application ANTSIA

Rejetée : deux coques divergentes, double maintenance des gardes de session et d'appel, cliquet
`social-shell-boundary` contourné.

### Option B — appliquer la nouvelle coque à tous les consommateurs

Rejetée : régression non demandée de DIASPORALE (1 124 tests et une recette propre).

### Option C — fil uniquement immersif

Rejeté : texte long, zoom 200 %, lecteur d'écran et réduction des mouvements exigent une liste.

## Références

- `docs/etudes/2026-10-18-social-commerce/{00,02,03,04,05}_*.md`, prompts P01–P05.
- Rapport de cadrage : `docs/etudes/2026-10-18-social-commerce/rapports/P00_CADRAGE.md`.
