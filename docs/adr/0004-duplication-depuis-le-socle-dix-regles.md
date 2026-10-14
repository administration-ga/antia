# ADR-0004 : Duplication depuis le socle — dix règles, provenance, parité prouvée

- **Statut** : Proposé
- **Date** : 2026-10-14

## Contexte

Le socle porte environ 22 000 lignes de backend social et 92 000 lignes de front, testées et en
production. PRO.GA a déjà dupliqué les modules i-* du socle avec un protocole éprouvé (dix règles,
`PRO_GA/docs/11` §2). L'arbre de travail partagé du socle est en retard et modifié : la seule
source fiable est `origin/main`.

## Décision

Nous allons dupliquer le réseau social du socle **depuis une copie propre de `origin/main`**
(`git worktree add`, commit noté), en appliquant les dix règles :

1. copier d'abord, adapter ensuite (diff minimal et documenté) ;
2. en-tête de provenance `Dupliqué de <chemin> @ <commit> — adaptations : <liste>` (cliquet
   `provenance-headers`) ;
3. périmètre d'adaptation fermé (imports, authentification du moteur, `networkId`, facettes, pages
   génériques, libellés et i18n, jetons, gardes ; suppression des dépendances administration) ;
4. aucun import inter-produit (cliquet) ;
5. les tests voyagent avec le code et S'EXÉCUTENT ;
6. fusion sans écrasement ;
7. jetons sans fork (charte de base = charte Personnel du socle ; un thème par réseau) ;
8. tranches verticales (`convex/modules/<module>/` + surface dans `social-features`) ;
9. gardes testées (adhésion → éligibilité → limitation de débit → droit) ;
10. parité prouvée (rapports `docs/03` backend et `docs/04` frontend).

Deux précisions propres au moteur : la duplication suit la pose des fondations multi-réseaux
(PA2), pour que chaque module arrive avec `networkId` ; les modules purs que le front importait
depuis `convex/` sortent dans `@antia/social-contracts`. La dette connue du socle est corrigée au
passage, par une liste fermée et testée (compteurs fragmentés, pagination des commentaires et des
connexions, diffusion par lots, garde de délivrance partout, `schemaValidation: true`).

## Conséquences

### Positives

- Le moteur part d'un code éprouvé en production plutôt que d'une réécriture.
- La provenance fichier par fichier permet de porter un correctif du socle par décision.

### Négatives

- Deux versions du réseau social coexistent (socle pour l'administration, moteur pour le public) :
  la divergence se gère par les rapports de parité, pas par réflexe.

### Neutres

- Les outils du socle sont repris de la même façon (lanceur `workspace-run.mjs` au lieu de turbo,
  préréglages ESLint, gabarit d'ADR), avec leur en-tête de provenance.

## Alternatives considérées

### Option A — réécrire un réseau social neuf

Perdrait des milliers de cas de test et des décisions déjà payées (refus indistinct, blocage
silencieux, stories multi-surfaces…) : écartée.

### Option B — importer les paquets du socle (`file:`) comme PRO.GA

Couplerait le moteur à la branche du socle sortie sur le disque (piège payé par PRO.GA le
08/08/2026) et contredirait l'étanchéité : écartée, on copie le code, on ne l'importe pas.

## Références

- `PRO_GA/docs/11_PLAN_IMPLEMENTATION_PROMPTS_PRO_GA.md` §2, `docs/12`, `docs/14`.
- Annexes A et B du plan « Réseaux dans le réseau » ; cahier §3.
