---
title: "ANTIA — Annexe A2 du document 02 : inventaire contradictoire, backend — groupes, groupes thématiques, évènements, stories, suggestions, messagerie personnelle"
date: "2026-10-14"
source: "socle administration.ga, origin/main = ad2e7fdc2, copie propre (git worktree add), lecture seule"
statut: "Rapport d'inventaire brut, produit en lecture seule ; la synthèse décisionnelle est docs/02_OWNER_MAP_DUPLICATION.md"
---

> Annexe A2 de `docs/02_OWNER_MAP_DUPLICATION.md`. Les chemins sont relatifs à la racine d'une copie
> propre du socle sur `origin/main` (`ad2e7fdc2`). Les numéros de ligne valent pour ce commit. Quand une
> décision du document 02 diffère d'une proposition de ce rapport, c'est le document 02 qui fait foi.

# Inventaire contradictoire de la tranche sociale de l'espace agent (socle `ad2e7fdc2`), en vue du moteur social ANTIA

Lecture seule, rien n'a été modifié. Tous les chemins sont relatifs à `$S` (`<copie propre du socle>`).

## 0. Ce qu'il faut retenir

- **Périmètre** : 23 fichiers source, **12 731 lignes**. S'y ajoutent le bloc crons `socle/convex/crons.ts:402-443`, la table `reseauPersonnel_unreadTotals` (`socle/convex/modules/reseauPersonnel/tables.ts:1101-1134`) et son enregistrement dans `socle/convex/schema.ts:983`.
- **Fonctions Convex exportées** : 117 au total (groupes 36, thématiques 21, évènements 11, stories 8, suggestions 5, messagerie 9, transfert 2, chats 25).
- **Tests primaires** : 23 fichiers, 16 242 lignes, 488 `it` (490 exécutions). Environ 352 cas sont à porter (adaptés) et environ 136 à abandonner.

Constats contradictoires vérifiés dans le code :

1. **`.collect()`** : aucun dans tout le périmètre, toutes les lectures sont bornées (`.take`, `.paginate`, `.first`, `.unique`). Mais trois lectures balaient une table sans index :
   - `groupesThematiques.ts:1128-1131` (découverte) ;
   - `suggestions.ts:132-135` (tous les profils) ;
   - `functions/chats.ts:1355-1363` (`.filter`, code exclu).

   Et deux lectures prennent les N **plus anciennes** appartenances avant de trier en mémoire :
   - `groupes.ts:776-781` et `866-871` (50) ;
   - `groupesThematiques.ts:1144-1149` (100).

   Au-delà de N, les groupes récents n'apparaissent jamais.
2. **Garde de suspension inégale** (`assertNotSuspended`) :
   - présente dans les thématiques (12 appels), les suggestions (2), la messagerie (2), le transfert (2) et `chats.sendMessage` (1) ;
   - **absente** de `groupes.ts`, `evenements.ts` et `stories.ts` (0 occurrence).

   `requireMembership` devra uniformiser.
3. **`functions/chats.ts` ne contient aucune vérification de blocage** (0 occurrence de `isBlockedBetween`). Un correspondant bloqué peut continuer d'écrire via `sendMessage` dans un fil personnel existant. Le fil est seulement masqué à la lecture (`messagerie.ts:405-411`) et la pastille est corrigée à la lecture (`messagerie.ts:870-890`).
4. **Notifications envoyées dans la même transaction** (`notifyPersonal` = 1 lecture + 1 écriture, plus un `isBlockedBetween`, par membre) :
   - `groupes.ts:1499-1513` (`sendGroupMessage`) ;
   - `groupes.ts:727-741` (`createGroup`, jusqu'à 999 invitations) ;
   - `messagerieScope/transfert.ts:434-446`.

   Le plafond est `GROUP_MEMBERS_MAX = 1000` (`lib/groupCapacity.ts:49`).
5. **`ctx.storage.getUrl` brut, qui contourne la garde de délivrance des fichiers** :
   - médias de story : `stories.ts:188, 563, 574` ;
   - avatars de groupe : `groupes.ts:802, 1001, 2324, 2767` ;
   - avatars de profil : `suggestions.ts:176`.

   Les médias de story sont pourtant inscrits à la Sentinelle fichiers (`media.ts` → `enqueueScan`).
6. **Purges qui suppriment le fichier stocké sans la ligne `fileGuard_scans`** :
   - `stories.ts:939-944` ;
   - `groupes.ts:2977-2981` ;
   - `groupesThematiques.ts:439-441`.
7. **Notification push contenant un aperçu du message** : `functions/chats.ts:887-895`, avec `body.slice(0,120)`. Elle est alimentée par :
   - `sendMessage` (`chats.ts:822-826`) ;
   - `openOrContinueThread` (`threads.ts:557-561`) ;
   - le transfert (`transfert.ts:361-365`).

   Les groupes n'envoient pas de push (seulement des cloches internes, sans texte).
8. **Aucune limitation de débit** sur aucune écriture du périmètre. Le seul `rateLimiter` concerne le Standard iAsted (`chats.ts:1024-1031`, exclu). `authMutation` n'en pose pas (`lib/customFunctions.ts:131-137`), `guardUploadUrl` non plus.
9. **Identité = `users` partout.** L'e-mail sert de repli d'affichage dans `chats.ts:301, 1720, 1818` et sort dans des DTO à `chats.ts:348, 1290`.
10. **`Date.now()` dans des queries** : `stories.ts:492, 644, 696`, `groupes.ts:2047`, `chats.ts:1797`. La doctrine écrite dans `evenements.ts:660-661` dit pourtant que les queries doivent rester déterministes.

---

## 1. Fichiers source

### 1.1 `socle/convex/modules/reseauPersonnel/groupes.ts` — 3 112 lignes

**Rôle** : conversations de groupe fermées (création, invitations, lien d'invitation, messages, réactions, épingle, saisie en cours, administration, suppression en cascade).

**Imports**
- Paquets externes : `convex/server` (`paginationOptsValidator`), `convex/values` (`v`, `Infer`) — 40-41, 100.
- `_generated` : `api` (`internal`) 42, `dataModel` 43, `server` (`internalMutation`, `MutationCtx`, `QueryCtx`) 44-48.
- `lib/*` :
  - `customFunctions` 49 ;
  - `errors` 51 ;
  - `userCategory` (`isPublicUser`) 52 ;
  - `uploadPolicy` (`guardUploadUrl`) 72 ;
  - `groupCapacity` (`GROUP_MEMBERS_MAX`) 98.
- Autres modules du socle :
  - `fileGuard/storageGuard` (`resolveFileDelivery`) 50 ;
  - `fileGuard/admission` (`findScanByStorageId`) 73 ;
  - `messagerieScope/forwardedFrom` 75 ;
  - `schemas/messageReactions` 53-60 ;
  - `schemas/chatMessages` (`MESSAGE_EDIT_WINDOW_MS`) 61.
- Internes : `./graph` 62-67, `./messagerie/attachmentStorage` 68-71, `./messagerie/attachments` 74, `./notifications` 76, `./people` 77-83, `./domain` 84-97, `./validators` 99.

**Points d'accroche administration**
- `assertNotSuspended` : **aucun** (lacune).
- `isPublicUser` : 52, 260, 611-616, 2129, 2311-2316, 2343-2348.
- `hasAnyLiveMembership` (= `validatedOrgIds` → `memberships`) : 64, 258.
- Scope « poste »/« personnel » :
  - `assertGroupScope` 213-224 ;
  - `assertAdmissible` 244-264 (branche poste 257-258) ;
  - scope rendu par `requireLiveMembership` 336, 346 ;
  - `GROUP_SCOPE_PERSONNEL` 653-658, 684 ;
  - `groupThreadMatchesScope` 795, 882 ;
  - 2236, 2432, 2455.
- Appels (`meetings`, `iappel`) :
  - `isLiveMemberOfGroupCall` 355-371 ;
  - `liveGroupThreadIdOfCall` 382-400 ;
  - `liveActiveCall` 437-445 ;
  - `revokeActiveGroupCallParticipation` 476-500, utilisé 1926-1931, 2810, 3103-3105 ;
  - DTO `activeCall` 763, 939, 1011 ; `meetingId` 1094, 1218 ;
  - commentaire `iappel.groupCalls.startFromThread` 721.
- iDocument (`sourceDocumentId`) : 1077, 1181, 2912-2930.
- Lecture de la table `users` : 2124-2127 (`isActive`/`deletedAt`) ; indirectement via `people.findPublishedPersonByHandle`.
- `orgs`/`orgId` : commentaire 13 seulement.
- `requestId`, `claimedBy`, iAsted, `isPlatformAdmin`, `/espace`, fuseau Africa/Libreville : aucun.
- Libellés en dur (environ 47) :
  - 176-185, 188, 220 ;
  - 614 (« Les ressortissants… »), 622, 641, 665, 671 ;
  - 1420, 1427, 1432, 1454 ;
  - 1765 (« [Message supprimé] »), 1772-1775 ;
  - 2205, 2256, 2286, 2314, 2346 (« Seuls les agents… ») ;
  - 2359-3095 (liste complète au grep) ;
  - `localeCompare(…, "fr")` 2140.
- Usage de dépôt `"piece_ichat"` 1384 ; `source: "ichat"` 1463.

**Dette**
- `.collect()` : aucun. Lectures bornées :
  - 412 (1000) ;
  - 543 et 553 (100 + 100 par fil) ;
  - 781 et 871 (50 appartenances **les plus anciennes**) ;
  - 981 et 2619 (1000) ;
  - 1151 (200) ;
  - 2051 (1000) ;
  - 2074 (500) ;
  - 2177 et 2958-3045 (50).
- `totalUnread` 863-889 : jusqu'à 50 fils × 200 messages lus, à chaque évaluation de la pastille ; pas de compteur dénormalisé pour les groupes (contrairement au 1:1).
- `sendGroupMessage` notifie tous les membres vivants dans la même transaction : 1499-1513. Idem `createGroup` 727-741 (sans borne sur `memberHandles`, argument 588).
- Compteurs écrits sur le document chaud :
  - `memberCount` 686, 1933-1937, 2405, 2588, 2824-2826 ;
  - `lastMessage*` du fil à **chaque** message 1479-1490, plus 1686-1692 et 1764-1766 ;
  - `reactionCounts` du message 1574 ;
  - tableau `deletedForUserIds` 1606-1608, qui peut atteindre 1000 identifiants (le commentaire `tables.ts:836` le dit borné à 20).
- `ctx.storage.getUrl` brut : 802, 1001, 2324, 2767. Les pièces jointes, elles, passent par `resolveFileDelivery` (1182).
- Suppression du fichier sans la ligne `fileGuard_scans` : 2977-2981.
- Avatar laissé orphelin : 3060-3064.
- Cloches `group_*` non purgées par la cascade : 2947-3067.
- Aucune limitation de débit (`sendGroupMessage`, `setGroupTyping` 2002 à chaque frappe, `createGroup`, `inviteToGroup`, `joinGroupViaInviteLink`, `generateAttachmentUploadUrl` 1379, etc.).
- `Date.now()` en query : 2047.
- Pas de push.

**Exports**
- Convex :
  - `createGroup` [authMutation] 585 ;
  - `listMyGroupThreads` [authQuery] 769 ;
  - `totalUnread` [authQuery] 863 ;
  - `getGroupThread` [authQuery] 921 ;
  - `listGroupMessages` [authQuery] 1252 ;
  - `paginateGroupMessages` [authQuery] 1323 ;
  - `generateAttachmentUploadUrl` [authMutation] 1379 ;
  - `sendGroupMessage` 1395, `toggleGroupMessageReaction` 1531, `deleteGroupMessageForMe` 1595, `editGroupMessage` 1632, `deleteGroupMessage` 1714, `setGroupPinnedMessage` 1792, `clearGroupConversation` 1845, `markGroupRead` 1887, `leaveGroup` 1916, `setGroupMuted` 1977, `setGroupTyping` 2002, `clearGroupTyping` 2026 [authMutation] ;
  - `listGroupTyping` [authQuery] 2040 ;
  - `purgeExpiredGroupTyping` [internalMutation] 2082 ;
  - `listMyConnectionsForGroup` [authQuery] 2111 ;
  - `getOrCreateGroupInviteLink` 2241, `resetGroupInviteLink` 2271 [authMutation] ;
  - `previewGroupInvite` [authQuery] 2301 ;
  - `joinGroupViaInviteLink` 2336, `inviteToGroup` 2426, `respondGroupInvite` 2512 [authMutation] ;
  - `myGroupInvites` [authQuery] 2601 ;
  - `renameGroup` 2640, `setGroupDescription` 2690, `setGroupAvatar` 2731, `removeGroupMember` 2772, `setGroupMemberRole` 2845 [authMutation] ;
  - `continueDeleteGroup` [internalMutation] 3070 ;
  - `deleteGroup` [authMutation] 3084.
- Helpers et constantes :
  - `GROUP_MAX_MEMBERS` 124, `GROUP_MIN_OTHERS` 130, `GROUP_TITLE_MAX_LENGTH` 131, `GROUP_DESCRIPTION_MAX_LENGTH` 132, `GROUP_MESSAGE_MAX_LENGTH` 133 ;
  - `requireLiveMembership` 319, `isLiveMemberOfGroupCall` 355, `liveGroupThreadIdOfCall` 382, `liveMembers` 403 ;
  - types `GroupThreadDto` 751, `GroupMemberDto` 891, `GroupInviteDto` 911, `GroupMessageDto` 1064, `ConnectionForGroupDto` 2093.
- Importé hors périmètre par : `functions/meetings.ts`, `direct/{access,invitees,sessions}.ts`, `iappel/groupCalls.ts`, `idocument/saveFromSurface.ts`, `messagerieScope/transfert.ts`.

**SORT : à adapter (lourd).**
- Le cœur est réutilisable : rôles, invitations, plancher d'historique, masquage en cas de blocage, épingle, cascade bornée.
- À retirer : scope et branche poste, toute la mécanique d'appel (environ 170 lignes), `sourceDocumentId`, `isPublicUser`.
- À ajouter : `networkId` et `requireMembership`.
- Les notifications doivent passer par un job planifié, et les `getUrl` par la garde de délivrance.

**Cible** : `convex/modules/groups/{access.ts (requireLiveMembership, liveMembers), threads.ts, messages.ts, invites.ts (+ liens), typing.ts, cascade.ts}`.

### 1.2 `socle/convex/modules/reseauPersonnel/groupesThematiques.ts` — 1 436 lignes

**Rôle** : groupes thématiques (lieux de publication découvrables) : cycle de vie, adhésion, invitations, rôles, mur, modération.

**Imports**
- Paquets externes : `convex/values` 47.
- `_generated` : `api` 48, `dataModel` 49, `server` 50-54.
- `lib` : `customFunctions` 55, `errors` 56, `userCategory` 57.
- Socle : `reseau/attachmentGate` (`assertNotSuspended`) 90.
- Internes :
  - `./access` (`assertVisiblePost`) 58 ;
  - `./domain` 59-68 ;
  - `./graph` 69-74 ;
  - `./groupesThematiquesAccess` 75-80 ;
  - `./marks` 81 ;
  - `./notifications` 82 ;
  - `./people` 83-87 ;
  - `./posts` (`readerMarks`, `toFeedItem`) 88 ;
  - `./searchText` 89.
- Dépendance forte au fil d'actualité (posts, access, marks).

**Points d'accroche administration**
- `assertNotSuspended` : 152, 201, 331, 349, 519, 575, 801, 911, 947, 1368, 1391, 1412. Absent de `leave` (265) et du refus dans `respondInvite` (788-799).
- `isPublicUser` : 57, 155-160, 207-212, 589, 741.
- Lecture de `users` : 732-739.
- `orgId` : commentaire 9 seulement.
- Libellés : 93, 158 et 210 (« Les ressortissants… »), 282, 317, 785, 922, 958, 1377, 1417 ; `localeCompare("fr")` 759.
- Scope, appels, iDocument, requestId, iAsted, `/espace`, fuseau : aucun.

**Dette**
- Aucun `.collect()`.
- `discover` (1118-1138) :
  - en recherche : `withSearchIndex` (1124-1127) sur un index de recherche **sans `filterFields`** (`tables.ts:963`) ;
  - sans recherche : `.query().order("desc").take(30)` (1128-1131), un balayage par ordre de création suivi d'un filtrage en mémoire (1135), donc une page sous-remplie ;
  - dans les deux cas, risque de fuite entre réseaux dans le moteur.
- `memberCount` sur le document chaud : 176, 251-254, 287-290, 841-844, 970-973.
- `listMembers` et `listInviteCandidates` sont tronqués à 100 membres (`MEMBERS_PAGE`, 712 et 1007) : le statut « member » est faux au-delà.
- `myGroups` prend les 100 plus anciennes appartenances (1149).
- La cascade supprime les fichiers de médias des publications sans la ligne `fileGuard_scans` (439-441) et laisse les cloches.
- Aucune limitation de débit (`invite`, `join`, `create`).

**Exports**
- Convex :
  - `create` 130, `join` 198, `leave` 265, `closeGroup` 328, `archiveGroup` 346 [authMutation] ;
  - `continueDeleteThematicGroup` [internalMutation] 499 ;
  - `deleteGroup` 513, `invite` 566 [authMutation] ;
  - `listInviteCandidates` [authQuery] 696 ;
  - `respondInvite` [authMutation] 773 ;
  - `myInvites` [authQuery] 850 ;
  - `setMemberRole` 904, `removeMember` 941 [authMutation] ;
  - `listMembers` 985, `discover` 1118, `myGroups` 1141, `getGroup` 1177, `groupWall` 1261 [authQuery] ;
  - `pinGroupPost` 1362, `unpinGroupPost` 1388, `removeGroupPost` 1409 [authMutation].
- Autres : `thematicGroupInviteCandidateStatusValidator` 652 ; types 658, 671, `ThematicGroupCardDto` 1042.

**SORT : à adapter.** Remplacer `isPublicUser` et `assertNotSuspended` par `requireMembership`. Ajouter `networkId` (avec index de découverte filtré et `filterFields`). Prévoir le nettoyage des lignes `fileGuard_scans`. Ne se duplique qu'après le module du fil d'actualité.

**Cible** : `convex/modules/thematicGroups/thematicGroups.ts`.

### 1.3 `socle/convex/modules/reseauPersonnel/groupesThematiquesAccess.ts` — 98 lignes

**Rôle** : définition unique du « membre vivant » d'un groupe thématique, partagée avec la garde d'audience du fil.

**Imports** : `_generated/dataModel` 13, `_generated/server` 14, `lib/errors` 15.

**Points d'accroche administration** : aucun. Libellés 28-29 et 32.

**Dette** : aucune (lectures `.unique()` sur `by_group_and_user`).

**Exports** : `GROUP_MEMBERSHIP_REQUIRED` 28, `GROUP_NOT_FOUND` 32, `isActiveThematicGroup` 39, `liveThematicGroupMembership` 50, `isLiveThematicGroupMember` 66, `requireLiveThematicGroupMembership` 81. Importé par `access.ts:21`, `postWrite.ts:33`, `posts.ts:46`.

**SORT : tel quel** (le contrôle du réseau se fait chez l'appelant via `requireMembership`).

**Cible** : `convex/modules/thematicGroups/access.ts`.

### 1.4 `socle/convex/modules/reseauPersonnel/evenements.ts` — 961 lignes

**Rôle** : évènements personnels (création, invitation, réponse, annulation, annonce dans le fil, agenda, export iCal).

**Imports**
- Paquets externes : `convex/values` 39, `convex/server` 40.
- `_generated` : 41-47 (`internalMutation`, `internalQuery`).
- `lib` : `customFunctions` 48, `errors` 49, `ical` (`signPersonalEventIcalToken`) 50, `userCategory` 51.
- Internes : `./domain` 52-63, `./graph` 64, `./notifications` 65, `./people` 66-70, `./postWrite` 71, `./validators` 72.

**Points d'accroche administration**
- `assertNotSuspended` : **aucun** (lacune).
- `isPublicUser` : 51, 180-185, 269.
- iCal :
  - commentaires 33-37 ;
  - `eventIcalUrl` 918-940, avec `CONVEX_SITE_URL` 934 et la route `/ical/event/{id}.ics` 937 ;
  - `getPersonalEventForIcal` 947-961, consommé par `socle/convex/http.ts:1545-1551`.
- Fuseau : `timeZone` 160, 190-195, 209, 597, 635. Pas de Africa/Libreville dans le source (seulement dans les tests).
- Lecteurs hors périmètre : iAgenda (`modules/iagenda/sources.ts:118-151`, « 3e source d'iAgenda » 656), `iappel/evaluate.ts:154-166`, `posts.ts:585`.
- `orgId` : commentaire 10.
- Libellés : 75, 77, 183, 248, 254, 346, 349, 358, 420, 538, 544, 796.

**Dette**
- Aucun `.collect()`.
- `myAgenda` 658-814 : jusqu'à 3 × 200 lectures, plus 201 lectures sur le chemin hérité (783-809, `eventStartAt` optionnel), avec un `db.get` d'évènement par participation (772, 800).
- `participantCount` et `acceptedCount` sur le document chaud : 211-212, 306-309, 386-394.
- L'annulation passe bien par un job planifié et paginé (430-434, 454-498).
- `getEvent` est limité à 100 participants (845).
- Aucune limitation de débit sur `invite`.

**Exports**
- Convex :
  - `create` 153, `invite` 234, `respond` 331, `cancel` 409 [authMutation] ;
  - `resolveEventInvitationsOnCancel` [internalMutation] 454 ;
  - `announce` [authMutation] 512 ;
  - `myAgenda` 658, `getEvent` 821, `paginateEventParticipants` 878, `eventIcalUrl` 918 [authQuery] ;
  - `getPersonalEventForIcal` [internalQuery] 947.
- Helpers : `EVENT_NOT_FOUND` 77, `CANCEL_RESOLVE_BATCH` 95, `personalEventParticipationOf` 104, `requirePersonalEventAccess` 123, type `PersonalEventDto` 589.

**SORT : à adapter.** `requireMembership` partout. `networkId` sur l'évènement et la participation. `eventStartAt` obligatoire (supprimer le chemin hérité). Garder ou différer l'iCal (qui demande `lib/ical` et une route HTTP). `announce` dépend de `postWrite`.

**Cible** : `convex/modules/events/events.ts` (+ `events/ical.ts` si conservé).

### 1.5 `socle/convex/modules/reseauPersonnel/stories.ts` — 956 lignes

**Rôle** : stories éphémères de 24 h (publication, plateau, vues, retrait, purge du fichier et de la ligne).

**Imports**
- Paquets externes : `convex/values` 35.
- `_generated` : 36-39.
- `lib` : `customFunctions` 40, `errors` 41.
- Internes : `./domain` 42-53, `./feedScale` 54, `./graph` 55-61, `./media` (`verifyDeclaredMedia`) 62, `./people` 63, `./validators` 64-68.

**Points d'accroche administration**
- `assertNotSuspended` et `isPublicUser` : **aucun** (n'importe quel compte publie).
- Surfaces `reseau`/`icom` (ADR-0079, « Actus d'iCom ») : 302-305, 346-367, 398, 479-483, 528-536, 631-632, 654-660, 691-692, 701-706. Les bornes vidéo dépendent de la surface (`domain.ts:1204`, `STORY_VIDEO_LIMITS`).
- Lecture de `users` : indirecte (`people`).
- Libellés : 80 (« Actu introuvable. »), 85, 342, 380.

**Dette**
- Aucun `.collect()`. `tray` 475-613 : jusqu'à 100 sources × `take(20)`, plus un `getUrl` par story.
- `ctx.storage.getUrl` brut : **188, 563, 574**.
- `viewCount` sur le document chaud : 399, **770**, plus une réécriture de `seenAt` à chaque revue (761). Le commentaire de `tables.ts:523-525` affirme « jamais un compteur en contention », ce qui est faux pour une story populaire.
- La purge laisse la ligne `fileGuard_scans` : **939-944** (`storage.delete` puis `db.delete` de la story uniquement).
- `Date.now()` en query : 492, 644, 696. La réactivité ne se rejoue pas à l'expiration.
- Aucune limitation de débit (`publish`, `markSeen`). Seul le plafond `STORY_ACTIVE_PER_AUTHOR_MAX` existe (376-382).

**Exports**
- Convex :
  - `publish` [authMutation] 295 ;
  - `tray` 475, `listByAuthor` 628, `myActive` 689 [authQuery] ;
  - `markSeen` [authMutation] 732 ;
  - `viewers` [authQuery] 788 ;
  - `remove` [authMutation] 868 ;
  - `purgeExpired` [internalMutation] 914.
- Autres : `TRAY_SOURCES_MAX` 101, `PURGE_BATCH` 119, `PURGE_VIEWS_BATCH` 122, types `StoryMediaDto` 128, `StoryDto` 137.

**SORT : à adapter.** Retirer les surfaces (ou les rendre génériques). Faire passer la délivrance par la garde. Purger aussi la ligne de scan. Sortir `viewCount` dans un compteur séparé. Passer `now` en argument. Ajouter `requireMembership`, `networkId` et une limitation de débit.

**Cible** : `convex/modules/stories/stories.ts`.

### 1.6 `socle/convex/modules/reseauPersonnel/suggestions.ts` — 403 lignes

**Rôle** : catalogue paginé des suggestions, masquages durables, demandes envoyées.

**Imports**
- Paquets externes : `convex/server` 31-35, `convex/values` 36.
- `_generated/dataModel` 37.
- `lib` : `customFunctions` 38, `errors` 39, `postIdentity` (`resolvePostIdentities`) 40.
- Socle : `reseau/attachmentGate` 41.
- Internes : `./domain` 42, `./graph` 43-50, `./people` 51.

**Points d'accroche administration**
- `assertNotSuspended` : 41, 230, 270.
- `validatedOrgIds` : 49, 194, 380.
- `resolvePostIdentities` (memberships, postes, orgs) : 191-195, 375-381. Il alimente les champs DTO `positionTitle`/`orgName` 86-88, 100-101, 178-179, 201-202, 333-334, 396-397.
- Lecture de `users` : 165-168.
- Table `connections` du socle : 357-368.
- Libellés : 235, 240.

**Dette**
- Aucun `.collect()`.
- `paginate` balaie **tous** les profils par ordre de création (132-135) et filtre après la page.
- `ctx.storage.getUrl` brut : 176.
- Aucune limitation de débit (`dismiss`, `restore`).

**Exports**
- Convex :
  - `paginate` [authQuery] 120 ;
  - `dismiss` 220, `restore` 266 [authMutation] ;
  - `listDismissed` 300, `listSentInvitations` 353 [authQuery].
- Autres : `DISMISSALS_SCAN` 59, validateurs et types 69-104, 283, 326.

**SORT : à adapter.** `paginate` et `listSentInvitations` sont à réécrire : index par `networkId`, retrait de `positionTitle`/`orgName` ou remplacement par le titre de la personne. `dismiss`, `restore` et `listDismissed` sont presque tels quels.

**Cible** : `convex/modules/suggestions/suggestions.ts`.

### 1.7 `socle/convex/modules/reseauPersonnel/messagerie.ts` — 1 113 lignes

**Rôle** : surface de messagerie 1:1 du réseau (projection des fils à la charte, pages par activité, pastille, ouverture par handle, appel par handle).

**Imports**
- Paquets externes : `convex/values` 45.
- `_generated` : `api` 46, `dataModel` 47, `server` 48.
- `lib` : `customFunctions` 49, `errors` 50.
- Socle :
  - `iappel/agentAccess` (`assertCallTargetAffiliated`) 51, `iappel/scope` (type) 52 ;
  - `messagerieScope/posteKey` 54, `posteResolve` 55, `scope` 56-59, `threads` 60-69 ;
  - `reseau/attachmentGate` 77.
- Internes : `./graph` 53, `./messagerie/attachmentStorage` 70, `./messagerie/counterpart` 71-75, `./people` 76.

**Points d'accroche administration**
- `assertNotSuspended` : 954, 1073.
- `assertPeutOuvrirFilPersonnel` : 175-186, utilisé 973.
- Scope et poste :
  - 317, 330-332, 350, 354-360, 372, 399, 406, 425 ;
  - 434 (« Poste vacant ») ;
  - DTO `poste` 251-255 et 464-471 ;
  - 480-487 ;
  - `getPosteThread` 784-818, `listMyPosteThreads` 840-844 ;
  - 876, 915, 981.
- `orgId` : 319, 330, 353-358, 785, 791, 800-805, 841-843.
- Standard iAsted : 367-369, 483, 789.
- Lecture de `users` : 415 (compte pour le libellé).
- Appels : `callByHandle` 1039-1113, `assertCallTargetAffiliated` 1089, `ctx.runMutation(api.functions.meetings.callCitizenById)` 1093-1096, type d'appel 273-275.
- `/espace` : commentaires 90, 851. `requestId` : commentaire 20.
- Libellés : 124, 135-137, 434, 962, 1081.

**Dette**
- Aucun `.collect()`. Lectures bornées : `THREADS_SCAN` 200 (338, 342), `PAGE_ROUNDS_MAX` 4 (524).
- `totalUnread` : correction des correspondants bloqués limitée à 100 (873-890).
- Push délégué (`openOrContinueThread`).
- Aucune limitation de débit (`startThreadWithHandle`).

**Exports**
- Convex :
  - `listMyThreadsPage` 733, `getThread` 752, `getPosteThread` 784, `listMyThreads` 821, `listMyPosteThreads` 840, `totalUnread` 864, `findThreadWithHandle` 905 [authQuery] ;
  - `startThreadWithHandle` 946, `callByHandle` 1039 [authMutation].
- Autres : `PERSON_NOT_FOUND` 124, `RELATION_REQUISE` 135, `assertPeutOuvrirFilPersonnel` 175, types 196, 218, 541-551.

**SORT : à réécrire (partiel).** Garder la moitié personnelle. Retirer `getPosteThread`, `listMyPosteThreads`, les branches poste de `projeterMesFils`/`projeterFil` et `callByHandle`.

**Cible** : `convex/modules/messaging/inbox.ts`.

### 1.8 `socle/convex/modules/reseauPersonnel/messagerie/attachmentStorage.ts` — 191 lignes

**Rôle** : seul point qui relit le stockage et admet les pièces jointes (1:1 et groupes).

**Imports**
- Paquets externes : `convex/values` 13.
- `_generated` : 14-15.
- `lib/errors` 16.
- Socle : `functions/documents` (`canReadDocument`) 17, `fileGuard/admission` 18, `fileGuard/policy` (type) 19.
- Internes : `../domain` 20, `./attachments` 21.

**Points d'accroche administration**
- iDocument (`sourceDocumentId`) : 36-41, 50, 125, 156-168, 176 (`canReadDocument` 163).
- `orgId` : 57, 137.
- `meta.actor: Doc<"users">` : 56.
- `"piece_ichat"` : 132 ; `source "ichat"` : 136.
- Libellés : 65, 72-73.

**Dette** : aucune (lectures unitaires ; admission par `admitStoredUpload`).

**Exports** : `attachmentFileValidator` 29, types `DeclaredAttachment` 44 et `AttachmentAdmissionMeta` 54, `ATTACHMENT_NOT_FOUND` 65, `ATTACHMENT_ALREADY_SENT` 72, `verifyDeclaredAttachments` 111.

**SORT : à adapter.** Retirer `sourceDocumentId` (ou le désactiver). Remplacer `orgId` par `networkId`. Brancher la Sentinelle du moteur.

**Cible** : `convex/modules/messaging/attachmentStorage.ts`.

### 1.9 `socle/convex/modules/reseauPersonnel/messagerie/attachments.ts` — 224 lignes

**Rôle** : module pur : bornes des pièces jointes (5 pièces, 25 Mo, vocal de 5 min, liste de types MIME), aperçu, extrait de citation.

**Imports** : `../domain` (`ReseauPersonnelViolation`) 29.

**Points d'accroche administration**
- Libellés : 139, 147, 153, 166, 172, 178 ; « Message vocal » / « Pièce jointe » / « … pièces jointes » 206-209.
- Commentaire « réseau mobile gabonais » 34.
- Parité testée avec `lib/uploadPolicy` (`piece_ichat`).

**Dette** : aucune.

**Exports** : `ATTACHMENTS_MAX_PER_MESSAGE` 32, `ATTACHMENT_MAX_BYTES` 35, `VOICE_MIME_TYPES` 44, `VOICE_MAX_DURATION_MS` 53, `CHAT_ATTACHMENT_MIME_TYPES` 63, `isChatMimeAllowed` 87, `REPLY_EXCERPT_MAX_LENGTH` 92, `AttachmentInput` 98, `isVoiceAttachment` 121, `assertAttachmentBatch` 132, `previewLabelFor` 198, `replyExcerpt` 219. Importé par le front : `agent-features/.../messagerie-composer.ts:35`, `MessagerieConversationView.tsx:108`, `IcomPosteDraftView.tsx:45`.

**SORT : tel quel**, en remplaçant `ReseauPersonnelViolation` par l'erreur du package.

**Cible** : `packages/social-contracts/src/attachments.ts`.

### 1.10 `socle/convex/modules/reseauPersonnel/messagerie/counterpart.ts` — 114 lignes

**Rôle** : module pur qui nomme le correspondant (profil publié, sinon compte, sinon inconnu).

**Imports** : aucun.

**Points d'accroche administration** : `COUNTERPART_UNKNOWN = "Agent"` 62 (vocabulaire administratif) ; `AccountNameInput` (forme `users`) 55-59.

**Dette** : aucune.

**Exports** : `CounterpartSource` 35, `CounterpartLabel` 37, `PublishedProfileInput` 46, `AccountNameInput` 55, `COUNTERPART_UNKNOWN` 62, `counterpartLabel` 82.

**SORT : à adapter** : libellé neutre, et `account` remplacé par le nom de la personne (`persons`).

**Cible** : `packages/social-contracts/src/counterpart.ts`.

### 1.11 `socle/convex/lib/groupCapacity.ts` — 154 lignes

**Rôle** : module pur des plafonds de groupe et d'appel de groupe.

**Imports** : aucun.

**Points d'accroche administration**
- Exemption back-office « illimité » (`isBackOfficeUser`) : 102-134.
- Configuration d'organisation `maxParticipantsCall` : 77-79, 93-100.
- Plafonds d'appel : 66, 74, 82, 148-154.

**Dette** : le plafond de structure de 1000 (49) commande la taille des notifications groupées (voir 1.1).

**Exports** : `GROUP_MEMBERS_MAX` 49, `GROUP_CALL_DEFAULT_MAX_PARTICIPANTS` 66, `GROUP_CALL_MAX_OTHERS` 74, `CallsCapacityConfig` 77, `GROUP_CALL_MIN_PARTICIPANTS` 82, `resolveGroupCallCapacity` 116-134, `callCapacityOf` 148. Importé par le front (`groupe-composeur.ts:20`, `group-call-capacity.ts:27`, `global-call-surface-host.tsx:36`, `CallSettingsSection.tsx`).

**SORT : à adapter.** Ne garder que `GROUP_MEMBERS_MAX` (à reconsidérer à la baisse). La capacité d'appel est exclue.

**Cible** : `packages/social-contracts/src/groupCapacity.ts`.

### 1.12 `socle/convex/modules/messagerieScope/forwardedFrom.ts` — 48 lignes

**Rôle** : provenance d'un message transféré, relue à la lecture (l'original existe-t-il encore ?).

**Imports** : `_generated/dataModel` 23, `_generated/server` 24.

**Points d'accroche administration** : aucun.

**Dette** : aucune.

**Exports** : `ForwardedFrom` 27-33, `isForwardedOriginAlive` 41.

**SORT : tel quel** (identifiants à renommer).

**Cible** : `convex/modules/messaging/forwardedFrom.ts`.

### 1.13 `socle/convex/modules/messagerieScope/posteKey.ts` — 121 lignes

**Rôle** : clés de poste (`position:` / `membership:`), paire ordonnée, `isPosteAnchored`, `otherPosteOf`.

**Imports** : aucun.

**Points d'accroche administration** : tout le fichier (ADR-0021/0123).

**Exports** : `PosteKey` 33, `ParsedPosteKey` 35, `posteKeyForPosition` 42, `posteKeyForMembershipId` 46, `posteKeyForMembership` 54, `parsePosteKey` 64, `sortPosteKeys` 82, `PosteAnchorable` 90, `isPosteAnchored` 99, `otherPosteOf` 111.

**SORT : exclu.** Pas de cible.

### 1.14 `socle/convex/modules/messagerieScope/posteResolve.ts` — 272 lignes

**Rôle** : résolution des titulaires de poste (`memberships`, `positions`, `positionAssignments`, `orgs`).

**Imports** : `_generated` 22-23 ; `lib/assignmentLifecycle` 24-27, `lib/positionContext` 28, `lib/postIdentity` 29 ; `appAccess/resolve` 30, `reseau/graphGuards` 31 ; `./posteKey` 32-38.

**Points d'accroche administration**
- `memberships` : 62-66, 91-100, 181, 226-231.
- `orgs` : 64, 258, 269.
- `users` : 69.

**Dette** : lectures bornées (`MAX_HOLDERS` 20, `MAX_MEMBERSHIPS` 50).

**Exports** : `membershipIsLive` 58, `userIsActive` 68, `myPosteKeys` 83, `resolvePosteOf` 127, `resolveInstitutionalPostes` 152, `resolvePosteHolders` 173, `userHoldsPoste` 208, `PosteDescription` 241, `describePoste` 249.

**SORT : exclu.**

### 1.15 `socle/convex/modules/messagerieScope/scope.ts` — 104 lignes

**Rôle** : module pur qui classe un fil « poste » ou « personnel ».

**Imports** : `./posteKey` 46.

**Points d'accroche administration** : `effectiveChatScope` 83-88 (`orgId` 56 et 87, `standard` 58 et 86), `/espace` commentaire 8.

**Exports** : `MessagerieScope` 49, `ScopableChat` 52, `SCOPE_ENTREE_INSTITUTIONNELLE` 67, `SCOPE_ENTREE_PERSONNELLE` 70, `effectiveChatScope` 83, `chatMatchesScope` 97, `isScoped` 102.

**SORT : exclu**, mais le patron se transpose : c'est la porte qui pose `networkId`, jamais le client.

### 1.16 `socle/convex/modules/messagerieScope/threads.ts` — 564 lignes

**Rôle** : identité et ouverture d'un fil (seul chemin d'écriture), non-lus, compteur `unreadTotals`.

**Imports**
- `_generated` : 33-35.
- `lib` : `errors` 36, `orgChatPolicy` (`verifyOrgChatAttachments`) 37, `userCategory` 38.
- Internes : `./posteKey` 39-44, `./posteResolve` 45, `./scope` 46.

**Points d'accroche administration**
- `isPublicUser` : 471-476.
- Lecture de `users` : 480, 499.
- `orgId` : 432, 517. `requestId` : 433, 518.
- Poste :
  - `findPosteThread` 99-109, `findInstitutionalThread` 118-129, `listPosteThreadsFor` 132-157 ;
  - branche ancrée de `chatSides` 187-209 ;
  - `unreadForSides` 240-248 ;
  - `postes` 440, 493-503, 520 ; `senderPoste` 536.
- `effectiveChatScope` : 46, 301. Standard : 92, 299.
- `verifyOrgChatAttachments` : 500-503.
- Libellés : 474, 478, 481, 486, 529 ; « 📎 » 451.

**Dette**
- Push avec aperçu : 557-561.
- Document `unreadTotals` par compte, écrit à chaque message reçu : 551-553.
- Aucune limitation de débit.

**Exports** : `sortParticipants` 60, `findPersonThread` 75, `findPosteThread` 99, `findInstitutionalThread` 118, `listPosteThreadsFor` 132, `ChatSides` 170, `chatSides` 181, `unreadForSides` 232, `isCountedPersonalChat` 292, `isUnreadFor` 310, `readPersonalUnreadTotal` 333, `adjustPersonalUnreadTotal` 348, `setPersonalUnreadTotal` 367, `recomputePersonalUnreadTotal` 390, `ThreadAttachmentFile` 418, `OpenThreadInput` 428, `previewOf` 444, `openOrContinueThread` 467.

**SORT : à réécrire** sur le patron `openOrContinueThread`, scope personnel seul (détail en section 5).

**Cible** : `convex/modules/messaging/threads.ts` + `messaging/unreadTotals.ts`.

### 1.17 `socle/convex/modules/messagerieScope/transfert.ts` — 550 lignes

**Rôle** : transfert d'un message 1:1 ou de groupe vers un fil, un groupe ou un handle (ADR-0143).

**Imports**
- Paquets externes : `convex/values` 46.
- `_generated` : 47-49.
- `lib` : `customFunctions` 50, `errors` 51, `orgChatPolicy` 52, `userCategory` 53.
- Socle :
  - `reseau/attachmentGate` 54 ;
  - `reseauPersonnel/domain` 55, `graph` 56, `groupes` 57-61, `messagerie/attachments` 62, `messagerie/attachmentStorage` 63-66, `messagerie` 67-70, `notifications` 71, `people` 72 ;
  - `functions/chats` (`validateParticipation`) 73.
- Internes : `./forwardedFrom` 74, `./scope` 75, `./threads` 76-82.

**Points d'accroche administration**
- `assertNotSuspended` : 476, 521.
- `isPublicUser` : 169-171, 183-188.
- Cloisonnement entre espaces : `FORWARD_CROSS_SPACE` 96-97, 265-267 ; `effectiveChatScope` 145, 496 ; `groupThreadScopeOf` 153, 540.
- `senderPoste` : 338.
- `verifyOrgChatAttachments` : 295-299.
- `assertPeutOuvrirFilPersonnel` : 172.
- Libellés : 87, 89, 91, 97, 143, 151, 162, 177, 186, 219, 280.

**Dette**
- Notifications de groupe dans la même transaction : 434-446.
- Push avec aperçu : 361-365.
- Écritures sur documents chauds : 347-351, 420-425.
- Aucune limitation de débit.

**Exports** : `FORWARD_CROSS_SPACE` 96, `ForwardTarget` 111, `ForwardResult` 458, `forwardChatMessage` [authMutation] 468, `forwardGroupMessage` [authMutation] 514.

**SORT : à adapter.** Le refus entre espaces devient un refus **entre réseaux**. Retirer `senderPoste` et la politique d'organisation.

**Cible** : `convex/modules/messaging/forward.ts`.

### 1.18 `socle/convex/functions/chats.ts` — 1 840 lignes

**Rôle** : iChat 1:1 (portes institutionnelle et standard iAsted, envoi, lecture, édition, réactions, épingle, saisie en cours, push, crons).

**Imports**
- Paquets externes : `convex/values` (`ConvexError`, `v`) 11, `convex/server` 12.
- `_generated` : 13-15.
- `lib` : `customFunctions` 16, `errors` 18, `permissions` (`canDoTask`) 19, `taskCodes` 20, `orgChatPolicy` 21, `uploadPolicy` 22, `userCategory` 24, `iastedBotIdentity` 25.
- Socle :
  - `ai/rateLimiter` 17 ;
  - `fileGuard/storageGuard` 23 ;
  - `messagerieScope/{scope 26-30, posteKey 31, forwardedFrom 32, posteResolve 33-39, threads 40-51}` ;
  - `reseauPersonnel/messagerie/{attachments 52, attachmentStorage 53-55}` ;
  - `schemas/{messageReactions 56-63, chatMessages 64}` ;
  - `reseau/attachmentGate` 65.

**Points d'accroche administration**
- `assertNotSuspended` : 711 seulement.
- `isPublicUser` : 659, 1154.
- `memberships` et `orgId` : `canAccessStandardThreads` 95-116 ; 158-164, 375-416, 617-623, 653-673, 1115, 1146-1158, 1185, 1232-1246.
- Poste : `validateParticipation` 145-153, `projectPoste` 327-339, 381-382, 464-465, 492-493, 659-668, 755-762, 860-875, 913-921.
- `requestId` : 432-453, 473, 654, 674.
- `claimedBy` : 69, 688, 809-815, 1087-1101, 1342-1376.
- iAsted et Standard : 5-6, 982-1376 (`findIastedBotUser` 1076, 1130, 1256, 1318).
- `canDoTask` / `TaskCode` : 110-115.
- iDocument : `attachments: v.id("documents")` 698, 764 ; `documentIds` 749-751 ; `sourceDocumentId` 291.
- Lecture de `users` : 108, 272-276, 439-445, 491, 1268, 1713, 1810-1811.
- E-mail exposé : 301, 348, 1290, 1720, 1818.
- URL `/espace/messages/chat/` : **884**.
- `effectiveChatScope` : 883.
- Libellés (environ 24, plus « Nouveau message » 890, « [Message supprimé] » 1472, « Inconnu » 302 et 1721, « 📎 » 778).

**Dette**
- `.collect()` : aucun. Balayage par `.filter` : 1146 (après index) et **1355-1363** (table entière, `take(500)`).
- Push avec aperçu : **887-895**, alimenté par 822-826.
- Aucune vérification de blocage nulle part.
- Aucune limitation de débit sauf iAsted (1024-1031).
- `lastMessage*` sur le document chaud : 784-788.
- Compteur `unreadTotals` : 793-795, 936-945, 1442-1453, 1564-1570.
- Aperçu calculé sur les fichiers déclarés par le client et non vérifiés : 775-783.
- `content: ""` au retrait (1425), contre `undefined` dans les groupes (`groupes.ts:1753`) : incohérence.
- `Date.now()` en query : 1797.

**Exports**
- Convex :
  - `listMyChats` 367, `getChat` 485, `listMessages` 508, `paginateMessages` 562 [authQuery] ;
  - `generateAttachmentUploadUrl` [authMutation] 598 ;
  - `findChatWith` [authQuery] 616 ;
  - `initiateChat` 650, `sendMessage` 694 [authMutation] ;
  - `dispatchChatPush` [internalMutation] 844 ;
  - `markRead` [authMutation] 958 ;
  - `markReadBatch` [internalMutation] 969 ;
  - `initiateStandardChat` [authMutation] 1113 ;
  - `listStandardChats` [authQuery] 1231 ;
  - `insertIastedMessage` 1311, `resetStaleClaimedThreads` 1347 [internalMutation] ;
  - `deleteMessage` 1401, `editMessage` 1486, `deleteMessageForMe` 1545, `toggleMessageReaction` 1589, `setPinnedMessage` 1658 [authMutation] ;
  - `getPinnedMessage` [authQuery] 1704 ;
  - `setTyping` 1742, `clearTyping` 1772 [authMutation] ;
  - `listTyping` [authQuery] 1792 ;
  - `purgeExpiredTyping` [internalMutation] 1827.
- Helper : `validateParticipation` 138, importé par `transfert.ts` et `idocument/saveFromSurface.ts`.

**SORT : à réécrire, par scission.** Environ 690 lignes (≈ 38 %) sont exclues : poste, Standard et iAsted (détail en section 5).

**Cible** : `convex/modules/messaging/{participation.ts, messages.ts, reactions.ts, pins.ts, typing.ts, push.ts}`.

### 1.19 `socle/convex/schemas/chats.ts` — 104 lignes

**Rôle** : table `chats` (fil 1:1).

**Imports** : `convex/server` 1, `convex/values` 2.

**Points d'accroche administration**
- Commentaire « Catégorie A/B » : 12-14.
- `orgId` 25, `requestId` 26, `type` standard 34, `claimedBy` 37, `scope` 50, `posteA`/`posteB` 63-64.
- Index : `by_org_type` 83, `by_participant*_scope` 86-87 (inutilisés), `by_posteA_B`/`by_posteA`/`by_posteB` 102-104.

**SORT : à réécrire** : `networkId` + `personA`/`personB` ; retirer les champs et index ci-dessus.

**Cible** : `convex/modules/messaging/tables.ts` (table `personalThreads` ou `chats`).

### 1.20 `socle/convex/schemas/chatMessages.ts` — 166 lignes

**Rôle** : table des messages 1:1 ; constante `MESSAGE_EDIT_WINDOW_MS` ; validateur `forwardedFrom`.

**Imports** : `convex/server`, `convex/values`, `./messageReactions` 1-3.

**Points d'accroche administration**
- `senderPoste` : 62 ; index `by_chat_senderPoste_read` 162.
- `attachments` (documents, ancien format) : 68.
- `sourceDocumentId` : 86.
- Types `call_started`/`call_ended` : 114-115.
- `by_chat_read` (Standard) : 166.
- `/espace` : commentaire 147.

**Dette** : aucune.

**Exports** : `MESSAGE_EDIT_WINDOW_MS` 17 (importé par le front : `MessageBubble.tsx:39`, `message-actions.test.ts:1`), `forwardedFromValidator` 29, `chatMessagesTable` 48.

**SORT : à adapter.** La constante part dans les contrats partagés ; la table va dans `messaging/tables.ts`.

**Cible** : `packages/social-contracts/src/messaging.ts` (constante) + `convex/modules/messaging/tables.ts`.

### 1.21 `socle/convex/schemas/chatMessageReactions.ts` — 36 lignes

**Rôle** : réactions 1:1.

**Points d'accroche administration** : `Id<"users">` 26.

**Index** : `by_message_and_user` 31, `by_chat_and_user` 34, `by_message` 36 (inutilisé).

**SORT : tel quel** (identifiants en personnes).

**Cible** : `convex/modules/messaging/tables.ts`.

### 1.22 `socle/convex/schemas/chatTyping.ts` — 23 lignes

**Rôle** : saisie en cours 1:1 (durée de vie 6 s).

**Index** : `by_chat` 21, `by_chat_user` 22, `by_expires` 23.

**SORT : tel quel.**

**Cible** : `convex/modules/messaging/tables.ts`.

### 1.23 `socle/convex/schemas/messageReactions.ts` — 141 lignes

**Rôle** : module pur du vocabulaire des réactions (6 genres, emoji, libellés, logique de bascule et de compte).

**Imports** : `convex/values` 20 (validateurs).

**Points d'accroche administration** : libellés FR 47-56.

**Exports** : `MESSAGE_REACTION_KINDS` 23, `MessageReactionKind` 32, `MESSAGE_REACTION_EMOJI` 35, `MESSAGE_REACTION_LABEL` 47, `messageReactionKindValidator` 58, `messageReactionCountsValidator` 72, `MessageReactionCounts` 81, `emptyMessageReactionCounts` 86, `applyReactionDelta` 104, `nextReactionKind` 124, `totalReactions` 132. Importé par le front : `MessageActionsSheet.tsx:31`, `MessageBubble.tsx:45`, `MessagerieConversationView.tsx:44`.

**SORT : tel quel.** Séparer les validateurs (`convex/values`) si le package ne doit pas dépendre de convex.

**Cible** : `packages/social-contracts/src/messageReactions.ts`.

### Table `reseauPersonnel_unreadTotals`

- Définition : `tables.ts:1101-1134`, index `by_user` 1134.
- Enregistrement : `schema.ts:983`.
- Écrite par `threads.ts:348-382`, `chats.ts:793-795, 943-945, 1451, 1569`, `transfert.ts:355-357`. Lue par `messagerie.ts:868`.
- Réconciliation : `socle/convex/migrations/backfillUnreadTotals.ts` (115 lignes, hors périmètre).
- **SORT : à adapter** : clé (`networkId`, `personId`). **Cible** : `convex/modules/messaging/tables.ts`.

---

## 2. Crons (`socle/convex/crons.ts`)

| Lignes | Nom | Appel | Sort |
|---|---|---|---|
| 405-410 | `reset-stale-claimed-chats` (quotidien 05:00) | `functions.chats.resetStaleClaimedThreads` | **exclu** (iAsted Standard) |
| 415-420 | `purge-expired-chat-typing` (1 min) | `functions.chats.purgeExpiredTyping` (`take(500)`) | garder → `messaging/typing.purgeExpired` |
| 424-429 | `purge-expired-group-typing` (1 min) | `reseauPersonnel.groupes.purgeExpiredGroupTyping` (`take(500)`) | garder → `groups/typing.purgeExpired` |
| 438-443 | `purge-expired-stories` (10 min, se replanifie) | `reseauPersonnel.stories.purgeExpired` | garder et ajouter la purge de la ligne `fileGuard_scans` → `stories/stories.purgeExpired` |

Il n'existe aucun cron pour les évènements, les groupes thématiques, les suggestions ou les invitations.

---

## 3. Tests

Les tests marqués `edge-runtime` utilisent `convex-test` via `testConvex` (`test.setup.ts:104`, composants d'agrégats enregistrés) et `tests/harness.setup.ts`. Le défaut du projet est `node` (`vitest.config.ts`).

### 3.1 Tests primaires (testent directement les fichiers du périmètre)

| Test | Lignes | Cas `it` | Env. | Imports | Fixtures administration | À porter / abandonner |
|---|---|---|---|---|---|---|
| `socle/convex/modules/reseauPersonnel/groupes.test.ts` | 4079 | 114 | edge | vitest, `api`, `dataModel`, `testConvex`, `lib/groupCapacity`, `schemas/chatMessages` | **oui** : `users`/`orgs`/`memberships` (`mkUser` ~44-75, Africa/Libreville), `meetings`, `reseau.connections`, `iappel.groupCalls` | 92 / 22 (appels : 925-1143 ×4, 2683-2910 ×9, 2911-2980 ×2 ; poste : 3281-3418 ×7) |
| `…/reseauPersonnel/groupes.cascadeBlobs.test.ts` | 266 | 3 | edge | vitest, `api`, `testConvex` | **oui** : `users`/`orgs`/`memberships`, `documents` (`documentVault.addToVault`) | 2 / 1 (coffre, 156) |
| `…/reseauPersonnel/groupesThematiques.test.ts` | 1418 | 45 | edge | vitest, `api`, `testConvex` | **oui** : `users`/`orgs`/`memberships`, `connections`, `posts` | 45 / 0 (suspension 205 → statut d'adhésion minimal) |
| `…/reseauPersonnel/evenements.test.ts` | 1103 | 27 | edge | vitest, `api`/`internal`, `testConvex`, `lib/ical`, `./evenements`, `./notifications` | **oui** : `users`/`orgs`/`memberships` ; Africa/Libreville ×9 | 27 / 0 (iCal 727/746 si conservé) |
| `…/reseauPersonnel/stories.test.ts` | 1311 | 47 | edge | vitest, `api`/`internal`, `testConvex`, `./domain`, `./stories` | non (`users` et `connections` seulement) | 40 / 7 (surfaces 754-867 ×5 ; 597, 627) |
| `…/reseauPersonnel/suggestions.test.ts` | 375 | 16 | edge | vitest, `convex/server` (type), `api`, `testConvex` | non (`users` seulement) | 16 / 0 |
| `…/reseauPersonnel/messagerie.test.ts` | 1849 | 53 (55 exécutions : boucle 1589) | edge | vitest, `api`, `testConvex`, `iappel/agentAccess` | **oui** : `users`/`orgs`/`memberships`/`positions`, `chats`, `meetings` | 29 / 24 (`callByHandle` ×7, cloisonnement ×4, `listMyPosteThreads` ×3, deux réseaux ×7 ; 531, 588, 1639) |
| `…/reseauPersonnel/messagerie/attachments.test.ts` | 242 | 22 | node | vitest, `../domain`, `./attachments`, `lib/uploadPolicy` | non | 22 / 0 |
| `…/reseauPersonnel/messagerie/counterpart.test.ts` | 91 | 6 | node | vitest, `./counterpart` | non | 6 / 0 |
| `socle/convex/lib/groupCapacity.test.ts` | 116 | 11 | node | vitest, `./groupCapacity` | non | 1 / 10 (capacité d'appel) |
| `socle/convex/modules/messagerieScope/posteKey.test.ts` | 88 | 9 | node | vitest, `./posteKey` | non | 0 / 9 |
| `…/messagerieScope/posteResolve.doublePoste.test.ts` | 237 | 4 | edge | vitest, `testConvex`, `lib/constants`, `lib/countryCodeValidator`, `./posteKey`, `./posteResolve`, `./threads` | **oui** : `orgs`/`memberships`/`positions`/`positionAssignments` | 0 / 4 |
| `…/messagerieScope/scope.test.ts` | 75 | 8 | node | vitest, `./scope` | non | 0 / 8 |
| `…/messagerieScope/threads.test.ts` | 321 | 8 | edge | vitest, `testConvex`, `./threads` | **oui** : `users`/`orgs`/`memberships`, `chats` | 7 / 1 (60) |
| `…/messagerieScope/transfert.test.ts` | 700 | 20 | edge | vitest, `api`, `testConvex`, `./transfert` | **oui** : `users`/`orgs`/`memberships`, `chats` | 16 / 4 (441-487, à remplacer par des tests entre réseaux) |
| `socle/convex/tests/chatsMessagerie.test.ts` | 724 | 21 | edge | vitest, `api`/`internal`, `lib/countryCodeValidator`, `lib/constants`, `messagerieScope/posteKey`, `testConvex` | **oui** (passe par `initiateChat`) | 21 / 0 (fixture à repointer vers la porte personnelle) |
| `…/tests/chatsP2P.test.ts` | 606 | 24 | edge | `@convex-dev/rate-limiter/test`, vitest, `api`, `lib/*`, `iastedBotIdentity` | **oui** (`orgs`, `documents`, compte iAsted) | 9 / 15 |
| `…/tests/chatsPinning.test.ts` | 318 | 9 | edge | vitest, `api`, `testConvex` | **oui** : `users`/`orgs`/`memberships`, `chats` | 9 / 0 |
| `…/tests/chatsAttachmentsAdmission.test.ts` | 207 | 3 | edge | vitest, `api`, `lib/dsi`, `lib/roles`, `testConvex` | **oui** : `positions`, politique d'import iDocument | 0 / 3 |
| `…/tests/chatsAttachmentsAdoption.test.ts` | 762 | 14 | edge | vitest, `api`, `lib/*`, `messagerie/attachmentStorage`, `scheduledDrain.setup` | **oui** : `orgs`/`memberships`, `documents` | 10 / 4 (359, 390, 466, 493) |
| `…/tests/standardChatCadence.test.ts` | 532 | 7 | edge | rate-limiter test, `typescript` AST, vitest | oui | 0 / 7 |
| `…/tests/standardChatOwnThread.test.ts` | 623 | 11 | edge | rate-limiter test, `lib/taskCodes` | oui | 0 / 11 |
| `…/tests/standardQueueAccess.test.ts` | 199 | 6 | edge | rate-limiter test, `lib/roles`, `lib/taskCodes` | oui | 0 / 6 |

Total des tests primaires : **23 fichiers, 16 242 lignes, 488 cas** (≈352 à porter, ≈136 à abandonner).

### 3.2 Tests secondaires (appels incidents, dépendances ou cliquets)

- **Domaine (dépendance pure à emporter)**
  - `…/reseauPersonnel/stories.domain.test.ts` : 387 lignes, 41 cas, node (les cas de surfaces sont à couper).
  - `…/reseauPersonnel/domain.test.ts` : 947 lignes, 71 cas, dont 21 dans le périmètre (thématiques 644-743 : 8 ; évènements 744-811 : 4 ; administration de fil 812-947 : 9).
- **Appels ponctuels**
  - `…/reseauPersonnel/media.adoption.test.ts` : 419 lignes, 8 cas (`stories.publish`/`purgeExpired`, `groupesThematiques.create`/`deleteGroup`).
  - `marks.test.ts` : 469 lignes, 13 cas (`groupesThematiques.leave` ×1).
  - `platformAccounts.test.ts` : 364 lignes, 17 cas (`stories.publish` ×1).
- **Exclus avec les appels**
  - `newAgentCalls.test.ts` : 232 lignes, 5 cas (`callByHandle`).
  - `modules/reseau/attachmentGate.test.ts` : 591 lignes, 25 cas (`callByHandle`).
- **Cliquets (à transposer en cliquet `requireMembership`)**
  - `tests/attachmentGateRatchet.test.ts` : 134 lignes, 2 cas ; registre 39-84 (suggestions, thématiques, messagerie, `chats.sendMessage`, transfert).
  - `tests/freshUploadRatchet.test.ts` : 109 lignes, 3 cas (`attachmentStorage` à 105).
  - `tests/membershipScopeRatchet.test.ts` : 1 571 lignes, 14 cas. Son vocabulaire de gardes est à reprendre : `openOrContinueThread` 231, `validateParticipation` 493, `requireLiveMembership` 509, `requireLiveThematicGroupMembership` 519, `requireThematicGroupOwner` 524, `requireGroupModerator` 529, `requirePersonalEventAccess` 537, `isVisibleLine` 636 ; ancrage `projeterMesFils` 795 ; ancres poste 1387-1395.
- **Exclus (iAgenda, iAppel, iChat institutionnel)**
  - `tests/callCapacitySettings.test.ts` (254 lignes, 9 cas) ;
  - `iappel/groupCalls.test.ts` (1 904 lignes, 58 cas) ;
  - `seeds/vpg/seedVpgCollaborationDemo.test.ts` (428 lignes, 6 cas) ;
  - `tests/vpgCollaborationEndToEnd.test.ts` (723 lignes, 2 cas) ;
  - iagenda (`briefing`, `delegateHolding`, `delegations`, `events`, `menuHints`, `reminders`), `iappel/{authorityResolve, routing.integration}`, `seeds/seedIagendaDelegationDemo` : n'importent que `posteKey`.

### 3.3 Tests périphériques (fixtures dans les tables du périmètre, ne testent pas ces fichiers)

| Test | Lignes | Cas | Tables du périmètre |
|---|---|---|---|
| `migrations/resolveSettledInvitations.test.ts` | 434 | 6 | `events`, `eventParticipants` |
| `direct/invitees.test.ts` | 1345 | 30 | `groupThreads`, `groupMembers` |
| `iagenda/colleague.test.ts` | 857 | 26 | `events`, `eventParticipants` |
| `iagenda/counts.test.ts` | 302 | 7 | `events` |
| `iappel/evaluate.test.ts` | 759 | 27 | `events` |
| `reseauPersonnel/notifications.test.ts` | 577 | 10 | `thematicGroups` |
| `reseauPersonnel/reseauPersonnel.test.ts` | 2278 | 83 | `thematicGroups` |
| `seeds/seedReseauSocialDemo.test.ts` | 256 | 3 | `events`, `stories` |
| `tests/realtimeToolTodayAgenda.test.ts` | 401 | 3 | `events` |

---

## 4. Ordre de duplication (dépendances d'abord)

0. **Prérequis du moteur, hors périmètre mais importés.** Les équivalents doivent exister avant toute tranche :
   - `persons` ;
   - réseaux, adhésions et `requireMembership` ;
   - graphe par réseau (`isConnectedTo`, `isBlockedBetween`, `acceptedCounterpartIds`, `blockedCounterpartIds`, `followedUserIds`, `pendingCounterpartIds`, aujourd'hui `reseauPersonnel/graph.ts` sur la table `connections`) ;
   - profils (`findPublishedPersonByHandle`, `miniProfileCache`, `publishedMiniProfile`, `assertFreshAvatarStorage`, `rethrowDomain` de `people.ts`) ;
   - cloches (`notifyPersonal`, `resolvePersonalNotifications`) ;
   - Sentinelle fichiers (`admitStoredUpload`, `assertFreshUpload`, `findScanByStorageId`, `resolveFileDelivery`, `guardUploadUrl`) ;
   - `domain.ts` (règles groupe, thématique, évènement, story, `ReseauPersonnelViolation`), `validators.ts` (17-20, 156-215, 248-268, 302-344), `searchText`, `feedScale`, `media.verifyDeclaredMedia` ;
   - fil d'actualité (`posts`, `access`, `marks`, `postWrite`) pour les thématiques et l'annonce d'évènement.
1. **Contrats purs** → `packages/social-contracts` : `messageReactions`, `MESSAGE_EDIT_WINDOW_MS`, `attachments`, `counterpart`, `groupCapacity` (`GROUP_MEMBERS_MAX`).
2. **Tables** (avec `networkId`) : messagerie (fils, messages, réactions, saisie, `unreadTotals`), groupes (7), thématiques (3), évènements (2), stories (2), `suggestionDismissals`.
3. `messaging/forwardedFrom`, puis `messaging/attachmentStorage`.
4. `messaging/threads` (+ `unreadTotals`) : le noyau `openOrContinueThread` personnel.
5. `messaging/participation`, `messages`, `reactions`, `pins`, `typing`, `push` (la partie personnelle de `chats.ts`).
6. `messaging/inbox` (la moitié personnelle de `messagerie.ts`).
7. `groups/access`, puis `groups/*`.
8. `messaging/forward` (dépend de 5, 6 et 7).
9. `thematicGroups/access` (requis par la garde d'audience du fil), puis `thematicGroups/thematicGroups`.
10. `events/events` (annonce via `postWrite`).
11. `stories/stories`.
12. `suggestions/suggestions`.
13. Crons (saisie 1:1, saisie de groupe, purge des stories), puis cliquet `requireMembership`.

Les tests suivent chaque étape.

---

## 5. Ce que la messagerie personnelle exige de `functions/chats.ts` et de `messagerieScope`

### `functions/chats.ts`

**À garder** (adapter : `persons`, `networkId`, `requireMembership`) :
- `requireSameChatReply` 192-203 ;
- `isDeletedForUser` 206-213 ;
- `projectChatReplyTo` 223-244 ;
- `enrichChatMessagePage` 254-320 (expéditeur depuis `persons`, **sans repli e-mail** 299-302) ;
- `paginateMessages` 562-587 ;
- `listMessages` 508-552 (optionnel, compatibilité front ; curseur `before` ambigu) ;
- `generateAttachmentUploadUrl` 598-606 ;
- `markReadBatchForParticipant` 903-953 (sans la branche ancrée 913-921), `markRead` 958-966, `markReadBatch` 969-980 ;
- `deleteMessage` 1401-1479 ; `editMessage` 1486-1531 ; `deleteMessageForMe` 1545-1573 ;
- `toggleMessageReaction` 1589-1633 ;
- `setPinnedMessage` 1658-1691 ; `getPinnedMessage` 1704-1726 (sans e-mail 1717-1721) ;
- `setTyping` 1742-1766, `clearTyping` 1772-1785, `listTyping` 1792-1821 (sans e-mail 1818), `purgeExpiredTyping` 1827-1840.

**À réécrire** :
- `validateParticipation` 138-166 : participant + réseau seulement. Supprimer la branche poste 145-153 et la branche Standard 157-164.
- `sendMessage` 694-830 :
  - **ajouter un contrôle de blocage**, une limitation de débit et `requireMembership` ;
  - retirer `attachments` (documents) 698/764, `senderPoste` 755-762 et la branche Standard 797-816 ;
  - remplacer `verifyOrgChatAttachments` (749-751) par `verifyDeclaredAttachments` ;
  - calculer l'aperçu via `previewLabelFor` sur les pièces vérifiées.
- `dispatchChatPush` 844-899 : un seul destinataire (l'autre participant), **corps sans aperçu**, URL par réseau à la place de `/espace/...` (884), libellé non figé (890). Retirer la branche historique `recipientUserId` et la branche poste 856-875.

**À retirer (exclu)** :
- `CLAIMED_BY_STALE_THRESHOLD_MS` 69, `STANDARD_CHATS_SCAN` 73 ;
- `canAccessStandardThreads` 95-116 ;
- `projectPoste` 327-339, `projectOtherUser` 341-352 (e-mail) ;
- `listMyChats` 367-480, `getChat` 485-501 (remplacé par `messagerie.getThread`) ;
- `findChatWith` 616-627, `initiateChat` 650-680 ;
- tout le bloc Standard 982-1376 (`standardChatAccountRefusal`, `STANDARD_CHAT_GLOBAL_REFUSAL`, `scheduleIastedStandardReply`, `standardThreadWriter`, `replyToStandardCitizen`, `initiateStandardChat`, `listStandardChats`, `insertIastedMessage`, `resetStaleClaimedThreads`).

### `messagerieScope/threads.ts`

**À garder** :
- `sortParticipants` 60-67 ;
- `isUnreadFor` 310-319 ;
- `unreadTotalDoc` 322-330, `readPersonalUnreadTotal` 333-339, `adjustPersonalUnreadTotal` 348-364, `setPersonalUnreadTotal` 367-382 (clé `networkId` + `personId`) ;
- `recomputePersonalUnreadTotal` 390-415 (réconciliation).

**À réécrire** :
- `findPersonThread` 75-96 : index paire + `networkId`, sans filtre de scope ni Standard.
- `chatSides` 181-221 : réduit aux participants (210-220).
- `unreadForSides` 232-265 : branche personnelle seulement (249-257).
- `isCountedPersonalChat` 292-303 : devient « fil actif ».
- `openOrContinueThread` 467-564, **le patron**. Il devient `openOrContinuePersonalThread(ctx, {networkId, initiatorPersonId, targetPersonId, initialMessage, initialAttachmentFiles})` :
  - `requireMembership` des deux côtés à la place de `isPublicUser` (471-476) ;
  - `verifyDeclaredAttachments` à la place de `verifyOrgChatAttachments` (500-503) ;
  - plus de `orgId`/`requestId`/`postes`/`senderPoste` (432-440, 493, 517-520, 536) ;
  - compteur de non-lus (551-553) ;
  - push sans aperçu (557-561).
- `previewOf` 444-456 : remplacé par `previewLabelFor`.

**À retirer** : `findPosteThread` 99-109, `findInstitutionalThread` 118-129, `listPosteThreadsFor` 132-157, branche ancrée 187-209 et 240-248.

### Autres fichiers de `messagerieScope`

- `scope.ts`, `posteKey.ts`, `posteResolve.ts` : retirer entièrement (le champ `scope` disparaît : tout fil est personnel).
- `forwardedFrom.ts` : garder.
- `transfert.ts` : adapter. `FORWARD_CROSS_SPACE` (96-97, 265-267) devient un refus **réseau source ≠ réseau cible**. Retirer `isPublicUser` (169-171, 183-188) et `senderPoste` (338). Remplacer `verifyOrgChatAttachments` (295-299) par `verifyDeclaredAttachments`. Planifier les notifications 434-446. Push sans aperçu 361-365.

### `reseauPersonnel/messagerie.ts`

- **Garder** : `assertPeutOuvrirFilPersonnel` 175-186, `lastMessageKindOf` 270-283 (sans les types d'appel si les appels sont exclus), `estDansLaBoitePersonnelle` 480-487 (réduit), `lireCote`/`blocageCache`/`pagePersonnelle` 589-724, `listMyThreadsPage` 733, `getThread` 752, `totalUnread` 864, `findThreadWithHandle` 905, `startThreadWithHandle` 946.
- **Réécrire** : `projeterFil` 396-473 (sans `poste` ni `describePoste` ni « Poste vacant »). `listMyThreads`/`projeterMesFils` 315-386, 821 : branche personnelle, ou suppression au profit de la version paginée.
- **Retirer** : `getPosteThread` 784-818, `listMyPosteThreads` 840-844, `callByHandle` 1039-1113.

---

## 6. Tables touchées et index

Définitions : `socle/convex/modules/reseauPersonnel/tables.ts` (lignes indiquées) et `socle/convex/schemas/*`. Proposition générale : préfixer par `networkId` tout index « mes … ».

| Table | Déf. | Index actuels | Proposition moteur |
|---|---|---|---|
| `chats` | schemas/chats.ts 16-104 | `by_participantA_B`, `by_participantA`, `by_participantB`, `by_org_type`, `by_participantA_scope`* , `by_participantB_scope`*, `by_participantA_lastMessageAt`, `by_participantB_lastMessageAt`, `by_posteA_B`, `by_posteA`, `by_posteB` | garder `[networkId, A, B]`, `[networkId, A, lastMessageAt]`, `[networkId, B, lastMessageAt]` ; supprimer org, scope, poste |
| `chatMessages` | schemas/chatMessages.ts 48-166 | `by_chat_created`, `by_chat_idempotency`, `by_chat_sender_read`, `by_chat_senderPoste_read`, `by_chat_read` | garder les 3 premiers ; supprimer `senderPoste` et `chat_read` |
| `chatMessageReactions` | 20-36 | `by_message_and_user`, `by_chat_and_user`, `by_message`* | tel quel |
| `chatTyping` | 15-23 | `by_chat`, `by_chat_user`, `by_expires` | tel quel |
| `reseauPersonnel_unreadTotals` | 1129-1134 | `by_user` | `[networkId, personId]` |
| `groupThreads` | 618-685 | `by_creator_and_idempotencyKey`, `by_activeMeetingId` | supprimer `activeMeetingId`, `scope`, `avatar` via la garde ; ajouter `networkId` |
| `groupMembers` | 695-722 | `by_thread_and_user`, `by_thread_and_leftAt`, `by_user_and_leftAt` | `[networkId, personId, leftAt]` (+ ordre d'activité) |
| `groupInvites` | 745-761 | `by_thread_and_invitee`, `by_invitee_and_status`, `by_thread_and_status` | `[networkId, invitee, status]` |
| `groupInviteLinks` | 770-778 | `by_threadId`, `by_token` | tel quel |
| `groupMessages` | 786-864 | `by_thread_and_createdAt`, `by_thread_and_idempotencyKey` | retirer `meetingId`, `sourceDocumentId` |
| `groupMessageReactions` | 873-884 | `by_message_and_user`, `by_thread_and_user`, `by_message` | tel quel |
| `groupTyping` | 892-899 | `by_thread`, `by_thread_and_user`, `by_expiresAt` | tel quel |
| `thematicGroups` | 922-963 | `by_creator_and_idempotencyKey`, `search_name` (sans `filterFields`) | `filterFields: ["networkId"]` + `[networkId, createdAt]` |
| `thematicGroupMembers` | 973-982 | `by_group_and_user`, `by_group_and_leftAt`, `by_user_and_leftAt` | `[networkId, personId, leftAt]` |
| `thematicGroupInvites` | 992-1002 | `by_group_and_invitee`, `by_invitee_and_status`, `by_group_and_status` | `[networkId, invitee, status]` |
| `events` | 1031-1062 | `by_organizer_and_idempotencyKey`, `by_organizer_and_startAt` | `[networkId, organizer, startAt]` |
| `eventParticipants` | 1074-1099 | `by_event_and_user`, `by_user_and_status`*, `by_user_and_eventStartAt`, `by_event_and_status` | `eventStartAt` obligatoire ; `[networkId, personId, eventStartAt]` |
| `stories` | 527-574 | `by_author_and_expiresAt`, `by_expiresAt`, `by_author_and_idempotencyKey` | supprimer `surfaces` ; compteur de vues hors du document |
| `storyViews` | 582-593 | `by_story_and_viewer`, `by_story_and_seenAt`, `by_viewer_and_seenAt` | `[networkId, viewer, seenAt]` |
| `suggestionDismissals` | 1154-1164 | `by_user_and_dismissed`, `by_user_and_createdAt` | préfixe `networkId` |

\* index déclaré mais jamais utilisé dans le code (vérifié au grep).

**Tables externes lues ou écrites par le périmètre** :
- `reseauPersonnel_notifications` (`by_recipient_and_dedupKey`) ;
- `reseauPersonnel_posts` (`by_group_status_publishedAt`, `by_eventId`) et ses enfants (réactions, commentaires, marques, signalements, `aggregateBackfills`) pour la cascade thématique ;
- `reseauPersonnel_profiles` (`by_handle`, balayage `order("desc")`) ;
- `connections` (`by_pair`, `by_low_status`, `by_high_status`) ;
- `fileGuard_scans` ; `_storage`.

**Tables administration à couper** : `users`, `orgs`, `memberships`, `positions`, `positionAssignments`, `requests`, `documents`, `meetings`.

---

## 7. Totaux

| Catégorie | Fichiers | Lignes | Cas |
|---|---|---|---|
| Source du périmètre | 23 | **12 731** (+ crons 42, + définition `unreadTotals` 34) | — |
| dont tel quel | 6 | 570 (`groupesThematiquesAccess`, `attachments`, `forwardedFrom`, `chatMessageReactions`, `chatTyping`, `messageReactions`) | — |
| dont à adapter | 10 | 8 043 (`groupes`, `groupesThematiques`, `evenements`, `stories`, `suggestions`, `attachmentStorage`, `counterpart`, `groupCapacity`, `transfert`, `chatMessages`) | — |
| dont à réécrire | 4 | 3 621 (`messagerie.ts`, `threads.ts`, `functions/chats.ts`, `schemas/chats.ts`) | — |
| dont exclu | 3 | 497 (`posteKey`, `posteResolve`, `scope`) ; s'y ajoutent ≈ 690 lignes de `chats.ts`, ≈ 200 de `messagerie.ts`, ≈ 170 de `groupes.ts` | — |
| Fonctions Convex exportées | — | — | 117 |
| Tests primaires | 23 | **16 242** | **488** `it` (490 exécutions) → ≈ 352 à porter, ≈ 136 à abandonner |
| Tests secondaires (domaine, appels, cliquets) | 22 | — | stories.domain 41 + domain 21 (sur 71) + cliquets 19 ; les autres sont exclus |
| Tests périphériques (fixtures) | 9 | 7 209 | 195 (non portés tels quels) |
