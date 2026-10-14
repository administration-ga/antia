# ADR-0001 : Un moteur, trois réseaux, deux dépôts ; une clé de réseau sur tout contenu

- **Statut** : Proposé
- **Date** : 2026-10-14

## Contexte

Le propriétaire veut trois réseaux sociaux emboîtés : l'iRéseau de l'administration (il existe,
dans l'espace agent d'administration.ga), DIASPORALE.COM (réseau fermé de la diaspora) et ANTIA
(réseau public gabonais, racine, qui contient les deux autres : « quand on a créé son réseau
social dans DIASPORALE, on est inclus dans ANTIA »), avec des contextes séparés. L'audit du socle
(annexes A et B du plan « Réseaux dans le réseau ») montre un réseau social complet mais sans
notion de réseau : aucune table ne porte de clé de tenant, « Récents », la recherche et les
suggestions balaient tout le déploiement.

## Décision

Nous allons construire **un seul moteur social national** (backend Convex dédié + paquets
`@antia/*`) dans le dépôt ANTIA, **multi-réseaux par construction** :

- une table `networks` (racine `antia`, réseaux fermés `diasporale`, `administration` en miroir) ;
  créer un réseau = une ligne et une application légère, jamais un nouveau backend ;
- un champ `networkId` indexé sur toute table sociale et une borne de réseau sur toute fonction
  sociale (`requireMembership(networkId, minStatus)`), tenus par le cliquet
  `network-scoped-functions` (actif dès PA2) ;
- une personne unique (`persons`, un handle global), des adhésions par réseau, dérivées vers la
  racine (entrer dans un enfant crée l'adhésion racine ; une suspension racine vaut partout) ;
- une visibilité `network` par défaut, `root` seulement sur audience publique et geste explicite.

DIASPORALE est une **application** de ce moteur, dans son propre dépôt (espace de travail bun
externe déclaré dans ANTIA, modèle de l'ADR-0165 du socle) ; son code backend propre vit dans la
tranche `convex/modules/diaspora/` du moteur, parce que Convex déploie un seul dossier de
fonctions. L'iRéseau du socle ne bouge pas : il se **reflète** dans ANTIA par contrat (ADR-0003).

## Conséquences

### Positives

- « Inclus dans ANTIA » est gratuit : mêmes tables, adhésion dérivée, aucune synchronisation.
- Un seul code social à maintenir pour N réseaux ; un seul projet Convex, un seul LiveKit.
- Les fuites de contexte deviennent un défaut détectable par un test (cliquet), pas une revue.

### Négatives

- Les fichiers partagés (`package.json`, `bun.lock`, `convex/schema.ts`, `convex/convex.config.ts`,
  catalogue de déploiement) ont un seul propriétaire (la session ANTIA) : DIASPORALE les fait
  modifier par demande.
- Toute fonction sociale paie la résolution d'adhésion à chaque appel (index, mais coût réel).

### Neutres

- turbo cède la place au lanceur `scripts/workspace-run.mjs` du socle : turbo 2.x refuse le graphe
  dès qu'un espace de travail sort de la racine (les applications de DIASPORALE).

## Alternatives considérées

### Option A — DIASPORALE dans le monorepo consulaire

Le réseau social vivrait dans la base des passeports et du renseignement, sous une gouvernance de
dépôt fragile (production publiée hors du dépôt, CI coupée) : écartée.

### Option B — Deux backends fédérés (DIASPORALE puis ANTIA)

Double saisie des contenus, doublons de personnes, deux moteurs à maintenir : écartée.

## Références

- `docs/00_CAHIER_DES_CHARGES_ANTIA.md` §0, §5, §7, §11, §12 ; plan `Documentation/RESEAUX_SOCIAUX/00_PLAN_…` §3–§4.
- Socle : ADR-0165 et ADR-0167 (espaces de travail externes), annexe A §8 (abstractions manquantes).
