# Contrat — demandes envoyées et blocages personnels

16 octobre 2026. Coordination demandée par le propriétaire dans le chat DIASPORALE. Extension du moteur après PA5, sans changer ses gardes ni publier.

## ABI des demandes

- `suggestions.paginateSentInvitations({ networkId, paginationOpts })` conserve son DTO (dont `connectionId`, `at=requestedAt`) et devient lisible en `en_attente`.
- `connections.cancelSentRequest({ networkId, connectionId, expectedRequestedAt }) -> null`, `networkMutation(minStatus: en_attente)`, quota `connection.cancel`.
- Seulement la demande `requested` du réseau courant émise par l'appelant. Tiers, autre réseau, acceptée, bloquée et version différente : refus indistinct. Aucun retrait de relation acceptée.
- Annulation : état `declined`, marque optionnelle `cancelledRequestedAt` égale à la version annulée ; résolution de la cloche reçue en `cancelled` par `resolveNotifications`, sans nouveau message ni notification.
- Rejeu idempotent uniquement si la même personne a déjà annulé cette version. Réémission : effacer la marque et avancer strictement `requestedAt`, même si l'horloge n'a pas avancé (`max(now, previous.requestedAt+1)`). Tester course avec réponse et rejeu ancien sur la même ligne réutilisée.

## ABI des blocages

- Le blocage reste global entre deux personnes, dans tous les réseaux. Le déblocage retire seulement MES intentions et MES marqueurs hérités ; aucun suivi/relation n'est recréé, aucun blocage inverse retiré, aucune notification.
- Nouveau `personBlocks` dans `graphTables` : `networkId` de l'entrée autorisée, `blockerPersonId`, `targetPersonId`, `createdAt`, `updatedAt`. Un seul document par acteur/cible (`by_blocker_target`), index de pagination par acteur/date et index de cible pour les gardes privées.
- `blockPerson` écrit toujours mon intention propre après ses gardes, y compris quand l'autre bloque déjà ; un rejeu conserve la date. Les marqueurs hérités de `connections` restent compatibles.
- `blocks.paginateMine({ networkId, source: intents|legacy, paginationOpts }) -> PaginationResult<{ targetPersonId, at }>` : `networkQuery(minStatus: en_attente)`, auteur fixé par session, index d'auteur, au plus 50 lignes/2Mio par page. Une seule pagination native par appel/source.
- Deux cursors indépendants dans la surface : intentions canoniques et marqueurs legacy dont `blockedByPersonId` est l'appelant. Les résultats legacy peuvent répéter une cible dans plusieurs réseaux ; fusion/déduplication réactive par cible dans l'UI. Aucun plafond silencieux, aucun origine/réseau/nom/avatar/handle/contact/état civil dans le DTO, aucun helper de blocages entrants exposé.
- Cette coexistence évite une migration créant des intentions impossibles à déduire. Les anciennes intentions non enregistrées par le modèle legacy ne peuvent pas être reconstruites ; toute nouvelle action conserve désormais l'intention propre.
- `isBlockedBetween`, les lecteurs privés de paires/ensembles et `isConnectedTo` prennent en compte les intentions dans les deux sens et les marqueurs legacy. Une fermeture héritée ne doit jamais s'ouvrir simplement parce qu'un premier auteur retire son marqueur.
- `connectionWith` affiche mon blocage quand mon intention existe, sans signaler le blocage inverse. Dans cette seule variante `blocked_by_me`, `connectionId` est nullable si aucune ligne ne vit dans le réseau courant ; aucun identifiant de ligne d’un réseau tiers ne remplace cette absence. Les états publics de demande restent indistincts pour un blocage seulement entrant. Adapter les façades nécessaires, sans exposer `blockedCounterpartIds`.
- `unblockPerson` conserve son ABI et ses gardes `en_attente`. Avant toute mutation, relire la paire avec 101 lignes : au-delà de la borne héritée de 100, refuser sans mutation partielle ; ne pas promettre un déblocage global après une tranche incomplète. Retirer l'intention propre et les marqueurs own seulement ; recomptes existants seulement si la paire est effectivement ouverte.

## Propriété et vérification

- DIASPORALE : `convex/modules/graph/{tables,graph,connections,blocks}.ts`, tests de ce périmètre ; dans `suggestions.ts` seulement le seuil de `paginateSentInvitations` et ses tests. Paquets/surfaces déjà attribués pour ses écrans. API générée par codegen permis ; aucun autre fichier partagé.
- ANTSIA : type de domaine `blocked_by_me.connectionId` nullable (autres variantes inchangées), quota `connection.cancel`, classification d'effacement/export de `personBlocks`, projection d'export des connexions entrantes bloquées et ses tests ; ce contrat.
- Erasure efface les intentions quand acteur OU cible est effacé ; export ne révèle que les intentions émises par l'appelant. Les marqueurs `connections` de blocage seulement entrant ne doivent pas ouvrir leur existence par l'export self-scoped.
- Tests : auteurs/tiers/réseaux, versions et courses, compte en attente, blocage réciproque indépendant de l'ordre, profil inconnu/retiré, pagination multi-pages et doublons, blocages anciens, retrait propre/inverse, refus au-delà de 100 sans effet, aucune notification/relation/suivi créés et effacement/export confidentiels.
- Sources réelles ; pas de branche/worktree, pas d'environnement réel, pas de push/production. Un seul créneau de codegen/tests ; attendre Functions ready, puis vérifier les ciblés et `verify` commun avant commits par pathspec.

## Preuve de sortie

Version gelée du 16 octobre : `verify` commun **code 0, 6 364 tests**, dont 1 481 backend, 122 cliquets, 3 069 surfaces moteur et 364 application DIASPORALE ; codegen sous Node22, typages Convex/tests/dix espaces et neuf lint sans erreur. Trace : `/tmp/diasporale-pd4-requests-blocks-verify-final.log` ; ciblés backend59, UI108, app39 verts.

Revue ANTSIA : le rejeu d’annulation est reconnu avant toute lecture du blocage inverse ; nouvelle émission strictement monotone, marque effacée ; intentions propres indépendantes ; garde de cible absente/en effacement/anonyme avant création ; DTO sans identité forcée ; plus de100 lignes de paire refusé sans effet partiel ; export de blocages seulement entrants fermé et purge du nouveau modèle classée.

Cette preuve porte sur le moteur et les suites automatisées. La recette de l’interface DIASPORALE reste à son chat. Aucune suppression de cache, environnement réel ni publication en production ; l’espace disque a été relâché par macOS et le backend local relancé après ENOSPC.
