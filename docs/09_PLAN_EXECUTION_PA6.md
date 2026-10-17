---
title: "ANTSIA — Reprise PA6 : préférences, contrats et accessibilité"
date: "2026-10-17"
statut: "Implémentation dans les sources servies ; vérification finale et recettes distinctes"
---

# PA6 — Plan de reprise

Les sept tranches sont déjà exportées et montées : réseau personnel, albums,
stories, notifications, messagerie, appels et direct. F1/F2/F3a/F3b/F3c constituent
la base de cette reprise ; ce plan traite les écarts constatés dans le code.
Références : cahier `docs/00`, prompt PA6 de `docs/01`, owner map `docs/02`, rapport
réel `docs/04_RAPPORT_PARITE_FRONT.md` et ADR-0004 à ADR-0009.

## Lots et responsabilités

1. **Préférences de présentation** — provider commun de fuseau ; préférence
   personnelle prioritaire, navigateur en repli, rendu serveur stable. Calendrier
   civil et formats de messages/appels/évènements/replays dans ce fuseau ; conversion
   des heures saisies avec refus des heures inexistantes aux changements saisonniers.
   Executor fuseaux : API neuve, helpers et consommateurs précis ; intégration app
   et composants partagés avec les autres lots par le coordinateur.
2. **Apparence** — reprendre le patron de thème du socle, système/clair/sombre,
   persistance préfixée par réseau, changement système et autre onglet, stockage refusé
   toléré. Contrôle natif accessible dans les menus existants, sans remonter les salles.
   Executor apparence : provider/contrôle, menus et locales shell ; branchement app
   et exports communs par le coordinateur. Aucune nouvelle dépendance nécessaire.
3. **Écritures de messagerie** — `MessagerieSource.useMessageWrites()` porte les
   mutations 1:1/groupe/dépôt/transfert, typées depuis l’API ; le réseau est injecté
   par la source. La conversation utilise son adaptateur, sans changer les règles,
   l’idempotence ni les contrôles serveur. Executor messagerie : source, conversation
   et tests voisins uniquement.
4. **Intégration et qualité** — couple Convex/TanStack cohérent au remontage,
   erreurs de fil distinctes du vide, lacunes et origine rendues honnêtement,
   évènement annoncé, signets en collection mobile ; focus, mouvements réduits et
   contrôle des fichiers modifiés avec `web-design-guidelines` et `accessibility-review`.
5. **Observabilité facultative** — raccord PostHog inactif sans configuration et
   consentement explicite révocable ; projection fermée des types d’écran, réseau
   et langue. Aucun contenu, handle, adresse de page privée, IDN, identifiant social
   ni enregistrement de session. Transport limité, sans SDK additionnel ; recette
   réelle et tableaux de mesure relèvent de la configuration puis de PA10.

## Arbre partagé

- Branche existante conservée : `codex/pa4-identite-session`, tant que DIASPORALE écrit.
- Base PA5 `639d987`, graphe `1637c12`, surfaces demandes/blocages `a2350ca`.
- Gel DIASPORALE levé après sa recette et restitution de3030 ; sources PD4 préservées.
  Vérifications PA6 sérialisées, un seul Next et concurrence des suites bornée à2.
- Aucun environnement réel, secret, déploiement de production ni donnée réelle modifié.
- Chaque executor possède ses chemins ; personne ne rétablit les changements d’autrui.

## Vérification prévue

Après restitution du créneau : codegen sous Node supporté, tests significatifs aux
frontières de jour/DST et au remontage, tests des adaptateurs et préférences, cliquets,
typages et `bun run verify` complet. Les modifications sont branchées aux routes
réelles ; vérifier leur disponibilité sur le serveur ANTSIA restitué.

Mettre à jour le rapport de parité et l’état de `docs/01`, puis commits locaux par
pathspec, un lot cohérent à la fois, et mémoire Obsidian.

## Limites de recette à conserver

Une recette Chrome à 320/375/1280 px, sombre, clavier et contraste réel est exigée
pour clore PA6. La politique navigateur a refusé l’observation dans ce chat lors de
PA5 : aucune nouvelle tentative par un autre outil pour contourner ce refus.
Les tests DOM et contrats ne constituent pas une certification AA. LiveKit/SFU/Egress
et plusieurs appareils nécessitent la configuration du propriétaire. Ces critères
restent ouverts tant qu’ils ne sont pas effectivement joués.
