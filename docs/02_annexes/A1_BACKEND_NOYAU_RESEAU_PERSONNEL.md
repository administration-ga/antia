---
title: "ANTIA — Annexe A1 du document 02 : inventaire contradictoire, backend — noyau du réseau personnel (profils, publications, fil, engagement, graphe, marques, notifications, modération, médias, domaine pur)"
date: "2026-10-14"
source: "socle administration.ga, origin/main = ad2e7fdc2, copie propre (git worktree add), lecture seule"
statut: "Rapport d'inventaire brut, produit en lecture seule ; la synthèse décisionnelle est docs/02_OWNER_MAP_DUPLICATION.md"
---

> Annexe A1 de `docs/02_OWNER_MAP_DUPLICATION.md`. Les chemins sont relatifs à la racine d'une copie
> propre du socle sur `origin/main` (`ad2e7fdc2`). Les numéros de ligne valent pour ce commit. Quand une
> décision du document 02 diffère d'une proposition de ce rapport, c'est le document 02 qui fait foi.

# Inventaire contradictoire : `socle/convex/modules/reseauPersonnel`, hors groupes, stories, évènements, suggestions et messagerie

Lecture seule sur `$S`, commit ad2e7fdc2. Aucune écriture, aucun `git`, `bun` ou `convex`. Les chemins sont relatifs à `$S`. « L » désigne un numéro de ligne.

**Réponse courte :**
- **Périmètre :** 22 fichiers source, **9 709 lignes**, **63 fonctions Convex** (29 `authQuery`, 31 `authMutation`, 1 `backofficeQuery`, 1 `backofficeMutation`, 1 `internalMutation`).
- **Code pur :** 5 modules seulement (2 059 lignes) peuvent aller dans `packages/social-domain` :
  - `searchText.ts` et `handleSuggestion.ts` passent **tels quels** ;
  - `domain.ts` est pur mais contient du vocabulaire administratif : **à adapter** ;
  - `feedScale.ts` et `connectionState.ts` ne gardent qu'un `import type` vers `_generated` : **adaptation triviale**.
- **Réécriture :** `people.ts`, `connections.ts` et `tables.ts`. Le reste s'adapte.
- **Exclusion :** `manifest.ts`.
- **Dépendance hors périmètre :** `groupesThematiquesAccess.ts` (98 l., couvert par l'autre agent) est importé par `access.ts`, `postWrite.ts` et `posts.ts`. Il faut le dupliquer d'abord ou le remplacer par une fonction qui renvoie `false`.

---

## 0. Liste exhaustive des fichiers (`ls` + `wc -l`)

**Sources dans le périmètre (22) :** access 177, connectionState 39, connections 731, contentRemoval 69, counters 78, domain 1633, engagement 384, feedScale 106, follows 255, graph 327, handleSuggestion 217, manifest 53, marks 390, media 198, moderation 131, notifications 499, people 883, postWrite 202, posts 1748, searchText 64, tables 1164, validators 361. **Total : 9 709.**

**Exclus (autre agent) :** groupes 3112, groupesThematiques 1436, groupesThematiquesAccess 98, evenements 961, stories 956, suggestions 403, messagerie 1113, et `messagerie/` (attachmentStorage 191, attachments 224, counterpart 114).

**Tests colocalisés dans le périmètre (13) :** connections, domain, feedScale, handleSuggestion, marks, media.adoption, moderation, notifications, people.adoption, platformAccounts, profileAutoPublish, reseauPersonnel, stories.domain (ce dernier teste `domain.ts`).

**Test frontière :** `newAgentCalls.test.ts`, qui couvre surtout `messagerie.callByHandle`.

---

## 1. Synthèse

| Fichier (`socle/convex/modules/reseauPersonnel/…`) | L. | Pur ? | Sort | Cible moteur |
|---|---|---|---|---|
| domain.ts | 1633 | oui (0 import) | à adapter | `packages/social-domain/src/domain.ts` (idéalement scindé) |
| searchText.ts | 64 | oui | **tel quel** | `packages/social-domain/src/searchText.ts` |
| handleSuggestion.ts | 217 | oui (`./domain`) | **tel quel** | `packages/social-domain/src/handleSuggestion.ts` |
| feedScale.ts | 106 | quasi (`import type Id`) | à adapter (trivial) | `packages/social-domain/src/feedScale.ts` |
| connectionState.ts | 39 | quasi (`import type Doc/Id`) | à adapter (trivial) | `packages/social-domain/src/connectionState.ts` |
| validators.ts | 361 | non (`convex/values`) | à adapter | `convex/modules/shared/validators.ts` (ou éclaté par module) |
| tables.ts | 1164 | non | **à réécrire** | `convex/modules/<module>/tables.ts` |
| manifest.ts | 53 | oui | **exclu** | — |
| counters.ts | 78 | non | à adapter | `convex/modules/engagement/counters.ts` |
| contentRemoval.ts | 69 | non | à adapter | `convex/modules/posts/contentRemoval.ts` |
| graph.ts | 327 | non | à adapter (L225-327 exclues) | `convex/modules/graph/graph.ts` |
| media.ts | 198 | non | à adapter | `convex/modules/media/media.ts` |
| people.ts | 883 | non | **à réécrire** | `convex/modules/people/people.ts` |
| access.ts | 177 | non | à adapter | `convex/modules/posts/access.ts` |
| notifications.ts | 499 | non | à adapter | `convex/modules/notifications/notifications.ts` |
| marks.ts | 390 | non | à adapter | `convex/modules/marks/marks.ts` |
| postWrite.ts | 202 | non | à adapter | `convex/modules/posts/postWrite.ts` |
| follows.ts | 255 | non | à adapter | `convex/modules/graph/follows.ts` |
| connections.ts | 731 | non | **à réécrire** | `convex/modules/graph/connections.ts` |
| moderation.ts | 131 | non | à adapter | `convex/modules/moderation/moderation.ts` |
| engagement.ts | 384 | non | à adapter | `convex/modules/engagement/engagement.ts` |
| posts.ts | 1748 | non | à adapter (lourd) | `convex/modules/posts/posts.ts` |

**Comptes de motifs dans les sources du périmètre :**
- `.collect()` : **0 occurrence directe**. Indirectement : `loadLiveMemberships` (`socle/convex/modules/appAccess/resolve.ts` L147-150) fait un `.collect()` non borné sur `memberships`.
- `isPublicUser`, `idnSub`, `platformTitleCoversOrg`, `assertCanDoTask` : 0 occurrence directe. `assertCanDoTask(…, "communication.publish")` est atteint via `reseauPages/access.ts` L70.
- `Africa/Libreville` : 0 occurrence dans les sources (seulement dans les fixtures de tests).
- Limitation de débit : **aucune** dans le module, alors que le socle en possède une (`socle/convex/ai/rateLimiter`, utilisée par `modules/direct/comments.ts` L24 et L81).

---

## 2. Fiches par fichier, dans l'ordre de duplication

Pour chaque fiche : imports, accroches administration (L…), dette (L…), exports, sort et raison.

### 2.1 `socle/convex/modules/reseauPersonnel/domain.ts` — 1633 l.

**Rôle :** domaine pur. Contenu par plages :
- L20-754 : constantes, audiences, médias, contenu, handle, visibilité, admission au fil, hashtags, mentions ;
- L756-937 : groupes thématiques ;
- L939-988 : `splitBodyRich` ;
- L990-1140 : évènements ;
- L1142-1459 : stories ;
- L1461-1633 : fils de groupe.

**Imports :** aucun.

**Accroches :**
- **Audience « organisation »**
  - L61 (`PERSONAL_POST_AUDIENCES`) ;
  - `isPageOrgMember` L436-449 ;
  - `case "organisation"` L485-489 ;
  - `isPageOrgMember: false` L641-644 ;
  - `assertPageAudienceShape` L848-894, avec libellés « administration » en dur L865 et L879.
- **Portée « mon_administration »**
  - `FEED_SCOPES` L592 ;
  - `feedAdmissionFor` L614-662 (`isColleague` L620, `case` L654-660).
- **Raisons de présence au fil**
  - raison « collegue » L514 et L660 ;
  - raison « page » L523-529.
- **Scope « poste »**
  - `GroupThreadScope` L1489, `GROUP_SCOPE_POSTE` L1495, `groupThreadScopeOf` L1515-1517.
- **Libellés produit**
  - « sur iRéseau » / « dans les Statuts d'iCom » L1268-1271 ;
  - « iRéseau ou iCom » L1319 ;
  - « iPhone (.mov) » L1380.

**Dette :** aucune I/O. Le fichier est trop gros et mélange 7 sous-domaines.

**Exports :** environ 60 fonctions pures, plus constantes, types et la classe `ReseauPersonnelViolation` (L94). Aucune fonction Convex.

**Sort :** **à adapter**. Le code est pur ; il faut retirer ou paramétrer organisation, page, collègue et poste.

### 2.2 `socle/convex/modules/reseauPersonnel/searchText.ts` — 64 l.

- **Rôle :** repli des diacritiques pour l'index plein texte.
- **Imports :** aucun.
- **Accroches :** aucune (commentaires PRO_GA et Gabon seulement, L4-8 et L15-17).
- **Dette :** pas de test dédié. Le module est doublonné en local dans `connections.ts` L517-528.
- **Exports :** `foldDiacritics` L24, `buildSearchableText` L42, `foldSearchQuery` L62.
- **Sort :** **tel quel**.

### 2.3 `socle/convex/modules/reseauPersonnel/handleSuggestion.ts` — 217 l.

- **Rôle :** échelle de `@handle` proposés à partir de l'état civil.
- **Imports :** `./domain` L33 (`HANDLE_MIN_LENGTH` / `HANDLE_MAX_LENGTH`).
- **Accroches :** toutes structurelles ou en commentaire :
  - `HandleSuggestionPerson` reprend la « ligne `users` » (`firstName`/`lastName`/`name`) L35-41 ;
  - l'ordre `nom.prenom` suit `users.idnEmailAlias` / `DEMO_IDN_ORDER` (L19-24, L146-150) ;
  - exemple de compte de rôle « Agent — DGDI » L39 et L106-107.
- **Dette :** aucune.
- **Exports :** `handleToken` L51, `handleNameComponents` L65, `isCandidateHandle` L74, `handleLadder` L102, `provisionalHandleBase` L152, `provisionalHandleCandidates` L172, `pickFreeHandle` L209.
- **Sort :** **tel quel** : l'alimenter depuis `persons` et mettre à jour les commentaires.

### 2.4 `socle/convex/modules/reseauPersonnel/feedScale.ts` — 106 l.

- **Rôle :** primitives de pagination du fil (curseur composite, sources bornées, signal de lacune).
- **Imports :** `import type { Id }` depuis `_generated/dataModel` L6.
- **Accroches :** aucune administration.
- **Dette :** `PERSONAL_FEED_AUTHORS_MAX = 200` (L27) tronque en silence au-delà de soi + 199 liens.
- **Exports :** `PersonalFeedCursor` L8, `boundedFeedSourceIds` L33, `compareFeedPosts` L54, `isAfterFeedCursor` L70, `cursorForFeedPost` L86, `isLacunarFeedWindow` L95, `exceedsLacunaThreshold` L104.
- **Sort :** à adapter (trivial) : remplacer `Id<…>` par un type d'identifiant générique.

### 2.5 `socle/convex/modules/reseauPersonnel/connectionState.ts` — 39 l.

- **Rôle :** `pendingStateOf`, l'état d'une demande de relation vu par un lecteur.
- **Imports :** `import type Doc, Id` L16.
- **Accroches :** `Doc<"connections">` (table du module `reseau`) L18 et L33 ; `Id<"users">` L34.
- **Dette :** pas de test dédié (couvert indirectement par `connections.test.ts` et `notifications.test.ts`).
- **Exports :** `ConnectionInviteStatus` L18, `ConnectionInviteState` L20, `pendingStateOf` L32.
- **Sort :** à adapter (trivial) : utiliser un type structurel `{userIdLow, userIdHigh, requestedByUserId, status}` en identifiants de personnes.

### 2.6 `socle/convex/modules/reseauPersonnel/validators.ts` — 361 l.

- **Rôle :** validateurs Convex, miroir de `domain.ts`.
- **Imports :** `convex/values` L9.
- **Accroches :**
  - audience « organisation » L38 ;
  - `feedScopeValidator` « mon_administration » L278 ;
  - `groupThreadScopeValidator` « poste » / « personnel » L184-187 ;
  - `storySurfaceValidator` « reseau » / « icom » L265-268 ;
  - genres de notification liés aux autres tranches L67-111 (`group_*` L85-86, `direct_*` L91-97 et L110, `thematic_group_invite` L101, `personal_event_invite` L105).
- **Dette :** aucune.
- **Exports :** 23 validateurs, de L17 à L356.
- **Sort :** à adapter.

### 2.7 `socle/convex/modules/reseauPersonnel/tables.ts` — 1164 l.

- **Rôle :** 26 tables `reseauPersonnel_*`, enregistrées dans `socle/convex/schema.ts` L771-802 et L965-1013.
- **Imports :** `convex/server` L20, `convex/values` L21, `../../schemas/messageReactions` L22-25, `../../schemas/chatMessages` L26, `./validators` L27-48.

**Accroches :**
- **Identité `users` :** 38 occurrences de `v.id("users")` ; aucun `networkId` dans tout le fichier.
- **Champs pointant vers d'autres tranches, sur les posts :**
  - `posts.pageId` → `reseauPages_pages` L225 (+ index L256) ;
  - `directSessionId` → `direct_sessions` L213 (+ L244) ;
  - `eventId` L232 (+ L259) ;
  - `groupId` L193 (+ L252).
- **Autres références externes :**
  - `notifications.subjectConnectionId` → `connections` L412 ;
  - `groupThreads.scope` « poste » L640 ;
  - `meetings` L659 et L853 ;
  - `documents` L818.
- **Doctrine en commentaire :** `users.name`, annuaire `directory` et « poste » sur les profils (L50-80, L108-114).

**Dette :**
- Compteurs sur le document de publication, très sollicité : `reactionCount`, `reactionCounts`, `commentCount`, `shareCount` (L195-199).
- Index sans lecteur dans le code applicatif :
  - `posts.by_directSessionId` L244 et `posts.by_eventId` L259 (utilisés seulement par des tests) ;
  - `postComments.by_parent_and_createdAt` L343 et `contentReports.by_comment` L364 (aucun usage).

**Sort :** **à réécrire**. Ajouter `networkId` partout avec des index préfixés, passer aux identifiants de personnes, et faire de page, direct et évènement des extensions optionnelles ou les supprimer.

### 2.8 `socle/convex/modules/reseauPersonnel/manifest.ts` — 53 l.

- **Rôle :** manifeste de tranche (ADR-0004).
- **Imports :** aucun.
- **Accroches :**
  - `canonicalRoute "/espace"` L24 ;
  - `dependencies` vers `reseau`, `organigramme` (memberships), `chats`, `meetings` et `reseauPages` L51, justifiées L26-50 (`communication.publish` cité L48) ;
  - `taskCodes: []` L52.
- **Exports :** `reseauPersonnelManifest` L15. Aucun consommateur hors `_generated`.
- **Sort :** **exclu** : c'est purement administratif.

### 2.9 `socle/convex/modules/reseauPersonnel/counters.ts` — 78 l.

- **Rôle :** lit les agrégats d'engagement stockés sur la publication.
- **Imports :** `type Id` L14, `type QueryCtx` L15, `./domain` L16.
- **Accroches :** `Id<"users">` L33.
- **Dette :**
  - lit les compteurs dénormalisés L46-47, L62 et L77 ;
  - l'en-tête L4-10 est obsolète : il affirme « jamais dénormalisés » et cite un `ENGAGEMENT_SCAN` qui n'existe plus ;
  - la docstring L20 est orpheline.
- **Exports :** `ReactionSummary` L22, `summarizeReactions` L30, `countLiveComments` L58, `countShares` L73.
- **Sort :** à adapter.

### 2.10 `socle/convex/modules/reseauPersonnel/contentRemoval.ts` — 69 l.

- **Rôle :** retrait transactionnel d'un post ou d'un commentaire, avec décrément des compteurs.
- **Imports :** `type Doc` L9, `type MutationCtx` L10.
- **Accroches :** branche « page d'administration » L27-39 (`get(post.pageId)` L32, `page.postCount` L35).
- **Dette :** compteurs sur des documents très sollicités : `page.postCount` L35, `original.shareCount` L44-47, `post.commentCount` L65-68.
- **Exports :** `markPersonalPostRemoved` L14, `markPersonalCommentRemoved` L50.
- **Sort :** à adapter (supprimer L27-39).

### 2.11 `socle/convex/modules/reseauPersonnel/graph.ts` — 327 l.

- **Rôle :** lecture des liens (connexions, demandes, blocages, abonnements), plus rattachements et collègues.
- **Imports :** `type Id` L11, `type QueryCtx` L12, `../reseau/graphGuards` (`isValidatedMembership`) L13.

**Accroches :**
- Table `connections` du module `reseau`, lue par nom : L40-51, L86-97, L122-125, L145-148, L191-202.
- **Rattachements et collègues :**
  - `validatedOrgIds` L268-280 (`memberships`, index `by_user_org`, `take(ORGS_SCAN = 5)` L231, L272-279) ;
  - `hasAnyLiveMembership` L296-301 (consommé par `groupes.ts` L258, pour le scope poste) ;
  - `colleagueUserIds` L303-327 (`memberships`, index `by_org_deletedAt`, `COLLEAGUES_SCAN = 400` L232).

**Dette :**
- Bornes silencieuses : `CONNECTIONS_SCAN = 500` L22 et `FOLLOWS_SCAN = 500` L23.
- `colleagueUserIds` peut lire jusqu'à environ 2 000 documents (L310-325).

**Exports (helpers) :** `CONNECTIONS_SCAN`, `FOLLOWS_SCAN`, `acceptedCounterpartIds` L35, `pendingCounterpartIds` L81, `isConnectedTo` L113, `isBlockedBetween` L136, `isFollowingUser` L163, `blockedCounterpartIds` L186, `followedUserIds` L212, `ORGS_SCAN`, `COLLEAGUES_SCAN`, `validatedOrgIds` L268, `hasAnyLiveMembership` L296, `colleagueUserIds` L303.

**Sort :** à adapter pour L1-223 (vers la table `connections` du moteur, avec `networkId`) ; **exclure L225-327**.

### 2.12 `socle/convex/modules/reseauPersonnel/media.ts` — 198 l.

- **Rôle :** URLs des médias délivrées derrière la garde, vérification des médias déclarés contre le stockage, URL d'upload.
- **Imports :** `type Doc/Id` L25, `type ctx` L26, `lib/errors` L27, `lib/customFunctions` L28, `lib/uploadPolicy` (`normalizeSha256`) L29, `../fileGuard/admission` (`assertFreshUpload`, `enqueueScan`) L30, `../fileGuard/storageGuard` (`servableUrl`) L31.
- **Accroches :** la garde fichiers (ADR-0160) L135 et L168-177 ; aucune accroche organisation.
- **Dette :**
  - `generateUploadUrl` L193-198 (`ctx.storage.generateUploadUrl()` L196) n'applique pas de politique d'upload : c'est une exception datée dans `socle/convex/tests/uploadPolicyRatchet.exceptions.json` L52 (« media_social ») ;
  - pas de limitation de débit ni de garde de suspension sur cet upload ;
  - la délivrance passe bien par `servableUrl` L68.
- **Exports :** `PostMediaDto` L43, `resolvePostMediaDtos` L61, `DeclaredMedia` L84, `verifyDeclaredMedia` L127, `generateUploadUrl` L193 (`authMutation`).
- **Sort :** à adapter : rebrancher sur la garde fichiers du moteur.

### 2.13 `socle/convex/modules/reseauPersonnel/people.ts` — 883 l.

**Rôle :** profils publiés, handle, avatar et couverture, mode privé, recherche, fiche publique, mentions, publication d'office.

**Imports :** `convex/values` L25, `types` L26-27, `lib/customFunctions` L28, `../appAccess/resolve` (`loadLiveMemberships`) L29, `lib/postIdentity` (`resolvePostIdentities`) L30, `lib/errors` L31, `../fileGuard/admission` L32, `./domain` L33-42, `./handleSuggestion` L43-46, `./graph` L47, `../reseau/attachmentGate` L48.

**Accroches :**
- `assertNotSuspended` L579 (`searchPeople`) et L674 (`getPublicProfile`).
- `resolvePostIdentities` + `loadLiveMemberships` L683-689 alimentent `positionTitle` / `orgName` (L664-671, L696-697).
- **Lectures de la table `users` :**
  - `Doc<"users">` L132 ;
  - `get(profile.userId)` L146-147 ;
  - `civilNameOf` (`firstName`, `lastName`, `name`) L329-337 ;
  - `ensurePublishedProfile` L363-364 et L378-385 ;
  - `ctx.user.firstName` / `lastName` / `name` L453-458 ;
  - `searchPeople` L615-616.
- `ensurePublishedProfile` est appelée à la création de compte hors module : `lib/users.ts` L2, `functions/users.ts` L13, migrations et seeds.

**Dette :**
- **`ctx.storage.getUrl` brut, qui contourne `servableUrl` :** L167, L219, L221, L632, L699, L702, L817, L839. `people.ts` n'est ni dans la liste `GATED` ni dans les `EXEMPTIONS` de `fileGuardGateRatchet` : ces appels échappent au cliquet.
- `.collect()` indirect via `loadLiveMemberships`, appelé jusqu'à 60 fois (`lib/postIdentity.ts` L56).
- Pas de limitation de débit sur `publishMyProfile`, `confirmMyHandle` (squat de handle possible), `setMyAvatar`, `setMyCover`.

**Exports :**
- Helpers : `rethrowDomain` L81, `addedMentionedUserIds` L89 (pur), `livePersonalProfile` L98, `findPublishedPersonByHandle` L118, `publishedMiniProfile` L154, `miniProfileCache` L179, `ensurePublishedProfile` L353, `assertFreshAvatarStorage` L722, `resolveMentionedUserIds` L868.
- `authQuery` : `getMyProfile` L196, `suggestHandles` L450, `searchPeople` L575, `getPublicProfile` L652.
- `authMutation` : `publishMyProfile` L237, `withdrawMyProfile` L310, `ensureMyProfile` L433, `confirmMyHandle` L477, `setMyProfilePrivacy` L527, `setMyAvatar` L774, `setMyCover` L822.

**Sort :** **à réécrire**. La paire `users` + `reseauPersonnel_profiles` devient `persons`, et la fonction / l'administration disparaissent. Les helpers listés ci-dessus restent réutilisables.

### 2.14 `socle/convex/modules/reseauPersonnel/access.ts` — 177 l.

- **Rôle :** la garde unique de visibilité d'une publication (`assertVisiblePost`, `canSeePost`).
- **Imports :** `types` L16-17, `lib/errors` L18, `./domain` L19, `./graph` L20, `./groupesThematiquesAccess` L21 (hors périmètre).
- **Accroches :**
  - `isPlatformAccount` L36-41 (`isSuperadmin`, `role "super_admin"`) : consommé seulement par 4 migrations ;
  - pages et organisations L97-106 (`get(pageId)` L99, `get(page.orgId)` L101) ;
  - auteur de page L111-112 ;
  - audience `organisation` via `validatedOrgIds` L135-140.
- **Dette :** jusqu'à environ 7 lectures par appel, alors que la garde est appelée en boucle (fan-out des commentaires, recherche, listes de marques).
- **Exports :** `postNotFound` L26, `isPlatformAccount` L36, `assertVisiblePost` L79, `canSeePost` L166.
- **Sort :** à adapter : ajouter le contrôle de `networkId` et `requireMembership`, retirer L97-106 et L135-140. `isPlatformAccount` est exclu.

### 2.15 `socle/convex/modules/reseauPersonnel/notifications.ts` — 499 l.

**Rôle :** la cloche sociale (émission dédupliquée, résolution, DTO, liste, compteur, marquage lu).

**Imports :** `convex/server` L33, `convex/values` L34, `_generated/api` (`internal`) L35, `types` L36, `internalMutation` L37-41, `lib/customFunctions` L42, `lib/errors` L43, `./connectionState` L44, `./people` L45.

**Accroches :** aucune organisation. Sujets liés à d'autres tranches (groupe, direct, groupe thématique, évènement) : L101-107, L193-198, L244-249, L269-275. `connections` L306-307.

**Dette :**
- `notifyPersonal` (L187-253) écrit dans la transaction de l'appelant : c'est la cause du fan-out lourd côté émetteurs.
- Post-filtre non indexé `.filter()` L465, avec continuation par le scheduler L473-477.
- `myNotifications` **lève une erreur** quand deux `createdAt` sont égaux en bordure de page (L367-372).
- `unreadCount` plafonne à 100 (L425).
- La rétention vit hors module (`socle/convex/crons/notificationsRetention.ts` L154 et L174) et doit être dupliquée.

**Exports :**
- Helpers : `personalNotificationSubjectKey` L114 (pur), `resolvePersonalNotifications` L143, `notifyPersonal` L187.
- `authQuery` : `myNotifications` L339, `paginateNotifications` L393, `unreadCount` L417.
- `authMutation` : `markRead` L440, `markAllRead` L493.
- `internalMutation` : `continueMarkAllRead` L483.

**Sort :** à adapter.

### 2.16 `socle/convex/modules/reseauPersonnel/marks.ts` — 390 l.

**Rôle :** enregistrer, masquer et suivre une publication ; mise en sourdine d'un auteur.

**Imports :** `convex/server` L24, `convex/values` L25, `types` L26-27, `lib/customFunctions` L28, `lib/errors` L29, `./access` L30, `./people` L31, `./validators` L32.

**Accroches :** aucune administration. `findMark` est enregistré comme vérificateur dans le cliquet d'appartenance.

**Dette :**
- Deux listes **lèvent** au-delà de 50 éléments : `myBookmarks` L170-175 et `myHiddenPosts` L210-215.
- `myMutes` lit `take(200)` sans pagination (L351).
- Troncatures silencieuses : `HIDDEN_SCAN = 500` L40/L56, `MUTES_SCAN = 200` L41/L68.
- `NOTIFY_FANOUT = 100` L44 (consommé par `engagement.ts`).

**Exports :**
- Helpers : `hiddenPostIds` L47, `mutedUserIds` L61.
- `authMutation` : `toggleMark` L96, `hidePost` L128, `unhidePost` L146, `muteAuthor` L298, `unmuteAuthor` L323.
- `authQuery` : `myBookmarks` L156, `myHiddenPosts` L203, `paginateBookmarks` L233, `paginateHiddenPosts` L264, `myMutes` L344, `markStateFor` L373.

**Sort :** à adapter.

### 2.17 `socle/convex/modules/reseauPersonnel/postWrite.ts` — 202 l.

- **Rôle :** point d'écriture unique d'une publication, et règle « qui peut être notifié d'une citation ».
- **Imports :** `types` L20-21, `./domain` L22-27, `./graph` L28-32, `./groupesThematiquesAccess` L33, `./notifications` L34, `./people` L35, `./searchText` L36.
- **Accroches :**
  - `directSessionId` L63 ;
  - `pageId` L64-70 (`communication.publish` cité L66) ;
  - `eventId` L72 ;
  - `assertPageAudienceShape` L99-104 ;
  - branche `organisation` L187-198 (`reseauPages_pages` L189, `orgs` L191-194, `validatedOrgIds` L195-197).
- **Dette :** compteurs initialisés L128-131 ; jusqu'à 10 notifications de citation dans la transaction (L141-150).
- **Exports :** `PersonalPostWriteInput` L42, `writePersonalPost` L84, `mentionCanSeePost` L164.
- **Sort :** à adapter.

### 2.18 `socle/convex/modules/reseauPersonnel/follows.ts` — 255 l.

**Rôle :** abonnements unilatéraux et suggestions.

**Imports :** `convex/values` L11, `type Id` L12, `lib/customFunctions` L13, `lib/errors` L14, `./graph` L15-20, `./domain` L21, `./notifications` L22, `./people` L23, `../reseau/attachmentGate` L24.

**Accroches :** `assertNotSuspended` L49 ; lecture `users` L234-235.

**Dette :**
- **`getUrl` brut** L249, hors cliquet.
- `suggestions` parcourt la table des profils sans index (`take(40)` L215) puis fait environ 4 lectures par candidat.
- `listMyFollows` lit `take(500)` sans pagination (L129).
- `myFollowerCount` compte en lisant (L162).
- `follow` n'a pas de limitation de débit et notifie à chaque nouvel abonnement (L84-88).

**Exports :**
- `authMutation` : `follow` L43, `unfollow` L94.
- `authQuery` : `listMyFollows` L120, `myFollowerCount` L154, `isFollowing` L168, `suggestions` L206.

**Sort :** à adapter.

### 2.19 `socle/convex/modules/reseauPersonnel/connections.ts` — 731 l.

**Rôle :** façade des connexions (adressage par handle ou par compte, cloche, résolution, listes enrichies, recherche dans mes relations, état d'une demande).

**Imports :** `convex/server` L35-38, `convex/values` L39, `_generated/api` L40, `types` L41-42, `lib/customFunctions` L43, `../appAccess/resolve` L44, `lib/postIdentity` L45, `lib/errors` L46, `./domain` L47-52, `./graph` L53, `./notifications` L54, `./people` L55-59, `../reseau/attachmentGate` L60, `../reseau/enums` L61.

**Accroches :**
- **Délégation au module `reseau` :**
  - via `ctx.runMutation` : `request` L84, `respond` L222 ;
  - via `ctx.runQuery` : `paginateMine` L319, `paginatePendingForMe` L372, `listMine` L424, `listPendingForMe` L457.
- `assertNotSuspended` L114, L159, L205.
- `loadLiveMemberships` (`readerOrgIds`) L258-261.
- `resolvePostIdentities` L325, L378, L428, L465, L666, qui produit `positionTitle` / `orgName` (DTO L281-282, validateur L299-300).
- Lecture `users` L180-183 ; « annuaire contacts pro » L137-151 ; table `connections` lue en direct L542-545.

**Dette :**
- **Plafond de 200 qui lève une erreur :**
  - `listMine` L424 atteint `socle/convex/modules/reseau/connections.ts` L28 (`LEGACY_CONNECTION_LIMIT = 200`) puis lève L567-576 ;
  - `listPendingForMe` L457 lève L615-624.
- `searchMine` peut lire 2 × 100 candidats, plus jusqu'à 200 lectures en repli (L515, L641-653).
- `foldDiacritics` est doublonné (L517-528).
- Pas de limitation de débit sur les demandes de connexion.
- Le message « Agent introuvable » peut remonter de `reseau/connections.ts` L170.

**Exports :**
- `authMutation` : `requestByHandle` L107, `requestByUserId` L152, `respond` L201.
- `authQuery` : `paginateMine` L307, `paginatePendingForMe` L360, `listMine` L421, `listPendingForMe` L454, `searchMine` L574, `pendingState` L712.
- Aussi : `connectionPersonDtoValidator` L290.

**Sort :** **à réécrire**. Le lien et sa garde appartiennent au module `reseau`, absent du moteur : il faut écrire `request`, `respond` et `paginate` natifs avec `networkId`. Logiques réutilisables : sonnerie L79-99, `searchMine`, `pendingState`.

### 2.20 `socle/convex/modules/reseauPersonnel/moderation.ts` — 131 l.

- **Rôle :** signalement et file de modération de plateforme.
- **Imports :** `convex/server` L5, `convex/values` L6, `types` L7-8, `lib/contextAudit` L9, `lib/customFunctions` (`authMutation`, `backofficeMutation`, `backofficeQuery`) L10, `lib/errors` L11, `lib/platformAdmin` L12, `./access` L13, `./contentRemoval` L14, `./validators` L15.
- **Accroches :**
  - `isPlatformAdmin` L12 et L25-27 ;
  - constructeurs back-office L64 et L74 ;
  - `appendContextAudit` L110-128, avec `context.orgId` de la page L103-104/L116 et l'action `"reseauPersonnel.report.decide"` L114.
- **Dette :** `reportPost` et `reportComment` n'ont ni limitation de débit ni garde de suspension (L34-62).
- **Exports :**
  - `authMutation` : `reportPost` L34, `reportComment` L48 ;
  - `backofficeQuery` : `listQueue` L64 ;
  - `backofficeMutation` : `decide` L74.
- **Sort :** à adapter : modérateur du réseau via `requireMembership(ctx, networkId, "moderator")`, et audit du moteur.

### 2.21 `socle/convex/modules/reseauPersonnel/engagement.ts` — 384 l.

**Rôle :** réactions et commentaires (un seul niveau), retrait, édition, liste.

**Imports :** `convex/values` L10, `type Id` L11, `lib/customFunctions` L12, `lib/errors` L13, `./access` L14, `./contentRemoval` L15, `./counters` L16, `./domain` L17 (+ import inline L39-40), `./notifications` L18, `./people` L19-24, `./validators` L25, `./marks` L26, `../reseau/attachmentGate` L27.

**Accroches :** `assertNotSuspended` L69, L150, L297.

**Dette :**
- **Compteurs sur le document de publication :** `reaction*` L82, L91, L99 ; `commentCount` L201. Cela crée des conflits d'écriture et invalide les abonnements au fil.
- **Fan-out dans la transaction de `comment` :**
  - auteur L203-208 ;
  - jusqu'à 100 abonnés, chacun avec `canSeePost` (L216-230) ;
  - jusqu'à 10 citations L236-244 ;
  - la personne à qui l'on répond L250-259.
  - Au total, environ 112 écritures et des centaines de lectures de garde.
- **`listComments` sans pagination :** une seule fenêtre `take(100)` (L30, L336-339) et au plus 10 réponses par racine (L36).
- Pas de limitation de débit.

**Exports :**
- `authMutation` : `toggleReaction` L60, `comment` L140, `removeComment` L271, `editComment` L294.
- `authQuery` : `listComments` L321.

**Sort :** à adapter.

### 2.22 `socle/convex/modules/reseauPersonnel/posts.ts` — 1748 l.

**Rôle :** le fil (publier, partager, éditer, retirer, épingler ; `myFeed` sur 3 portées ; recherche ; mur ; lecture unitaire ; `toFeedItem`).

**Imports :** `convex/values` L15, `types` L16-17, `lib/customFunctions` L18, `lib/errors` L19, `./access` L20, `./contentRemoval` L21, `./counters` L22-27, `./domain` L28-45, `./groupesThematiquesAccess` L46, `./marks` L47-50, `./graph` L51-59, `./media` L60-64, `../reseauPages/access` L69-70, `../reseauPages/domain` L71, `../reseauPages/graph` L72, `./notifications` L73, `./people` L74-80, `./postWrite` L81, `./searchText` L82, `./validators` L83-87, `./feedScale` L88-95, `../reseau/attachmentGate` L96.

**Accroches :**
- **`assertNotSuspended` :** L735, L899, L1030, L1357, L1567.
- **Pages d'administration :**
  - `pageFeedWindow` L255-325 ;
  - `FeedItem.page {pageId, orgId}` L436-444 et `signedBy` L451 ;
  - dans `toFeedItem` : L623-625, L642-644, « Page officielle » L659, L669-680, L691 ;
  - `assertCanPublishOnPage` (`communication.publish`) L884-886, L904-906, L953-962 ;
  - dans `myFeed` : L1072, L1118-1137, `pageOrgIdOf` (lecture `reseauPages_pages` + `orgs`) L1173-1192, admission des pages L1201-1246, L1274 ;
  - ailleurs : L1411, L1482, L1643, L1745.
- **Collègues / portée « mon_administration » :** `colleagueUserIds` L1059-1061, `validatedOrgIds` L1079-1081, L1221-1224, L1253.
- **Autres tranches :**
  - direct (`direct_sessions`) L550-562 ;
  - évènements (`reseauPersonnel_events` et `eventParticipants`) L573-598 ;
  - groupes thématiques L764.

**Dette :**
- `shareCount++` sur l'original L842-850.
- **Amplification de lecture de `myFeed` (portée « pour_vous ») :** jusqu'à 200 sources × 50 lignes (`FEED_AUTHOR_SCAN` L155), plus 50 pages × 50, soit environ 12 500 documents, auxquels s'ajoutent les marques (2 × 300) et les ensembles masqués, sourdines et liens.
- La fenêtre globale de 200 (`FEED_SCAN`) est lacunaire (L138-149, `console.warn` L1317).
- `search` applique `canSeePost` puis rejuge la visibilité (L1385 puis L1393-1403) : double garde coûteuse.
- `myPosts` n'a pas de curseur (L1469-1475).
- Notifications en transaction : L854-861 et L928-940.
- Pas de limitation de débit sur `publish` ni `edit`.

**Exports :**
- Helpers et types : `readerMarks` L105, `toFeedItem` L604, `SharedPostProjection` L392, `FeedItem` L403.
- `authMutation` : `publish` L720, `remove` L875, `edit` L895, `pinOnMyWall` L946, `unpinMyWall` L983.
- `authQuery` : `myFeed` L1012, `search` L1353, `myPosts` L1444, `personPosts` L1550, `getPost` L1706.

**Sort :** à adapter (lourd). On garde les fenêtres par auteur, la fusion k-voies, le curseur composite et les deux phases. On retire environ 30 % du fichier : pages, collègues, direct et évènements. On ajoute `networkId` dans tous les index (fil, recherche) et `requireMembership`.

---

## 3. Tests

### 3.1 Tests colocalisés (`socle/convex/modules/reseauPersonnel/`)

« edge » signifie l'en-tête `// @vitest-environment edge-runtime`. « node » signifie qu'il n'y a pas d'en-tête (environnement par défaut). « Admin » indique si les fixtures dépendent de tables d'administration.

| Test | L. | Cas | Env | Imports | Admin ? |
|---|---|---|---|---|---|
| domain.test.ts | 947 | 71 | node | vitest, `./domain` (52 symboles), `./validators` L62 | non (pur) ; cas organisation L91-108, mon_administration/collegue L438-615, alignement validateur L617-643, `Africa/Libreville` L779-780 (fuseau d'évènement) |
| stories.domain.test.ts | 387 | 41 | node | `./domain` | non (pur) ; 6 cas `assertPageAudienceShape` L267-327 |
| handleSuggestion.test.ts | 181 | 21 | node | `./domain`, `./handleSuggestion` | non (pur) |
| feedScale.test.ts | 192 | 5 (3 purs L49/L60/L186, 2 d'intégration L80/L129) | edge | api, Id, `testConvex`, `./feedScale` | `users` seulement |
| connections.test.ts | 536 | 14 | edge | api, Id, `testConvex` | **oui** : `users` (firstName/lastName) + `orgs` + `memberships` L36-59 ; vérifie positionTitle/orgName L229-232 |
| marks.test.ts | 469 | 13 | edge | `PaginationResult`, api, Id, `testConvex` | non ; mais insère `thematicGroups*` (autre tranche) et appelle `groupesThematiques.leave` |
| media.adoption.test.ts | 419 | 8 | edge | api/internal, Doc/Id, `testConvex` | **oui** : `users` + `orgs` + `memberships` L80-103, `documentVault` |
| moderation.test.ts | 330 | 6 | edge | api, Id, `UserRole`, `testConvex` | **oui** : rôles `AdminSystem` / `SuperAdmin` / `Admin` L18-27, L54, L62 |
| notifications.test.ts | 577 | 10 (le grep naïf donne 12 : `emit(` L325/L334) | edge | api, Id, `testConvex`, `./notifications` L205-208 | non (`users` + `thematicGroups`) |
| people.adoption.test.ts | 161 | 4 | edge | api, `testConvex`, `tests/blobAdoption.setup` | **oui** : `seedOrg` + `specimenDUnAgent` (`memberships`) |
| platformAccounts.test.ts | 364 | 17 | edge | api, Id, `UserRole`, `testConvex`, `./people` L25 | **oui** : `isSuperadmin` / `role`, état civil (ADR-0082) |
| profileAutoPublish.test.ts | 302 | 14 | edge | api, Id, `testConvex`, `./people` L22 | partiel : état civil `users` |
| reseauPersonnel.test.ts | 2278 | 83 | edge | api, Id, `testConvex`, `tests/scheduledDrain.setup` | partiel : `agentSpaceFirstSeenAt` L1604 (suspension) ; `orgs` + `reseauPages_pages` + post de page L2093-2125 |
| *Frontière :* newAgentCalls.test.ts | 232 | 2 `it` + 3 `it.each` = 13 cas générés | edge | api, Id, `CountryCode`, `testConvex`, `reseau/attachmentDeadline` | **oui** (`orgs`, `memberships`, `affiliationRequests`) ; sujet : `messagerie.callByHandle` |

Fonctions de mon périmètre appelées par l'API dans ces tests :
- `connections.test.ts` : `connections.pendingState` / `paginateMine` / `searchMine` / `respond` / `requestBy*`, `people.*Privacy` / `publish` / `withdraw`, `notifications.unreadCount` / `markAllRead`.
- `reseauPersonnel.test.ts` : `posts.*`, `follows.*`, `notifications.*`, `engagement.*`, `people.*`, `connections.*`, `marks.toggleMark`.
- `moderation.test.ts` : `moderation.*`, `engagement.comment` / `removeComment`.
- `marks.test.ts` : `marks.*` (10 fonctions), `posts.*`.

### 3.2 Tests centralisés (`socle/convex/tests/`)

Par grep des imports statiques, **aucun** test centralisé n'importe un fichier du périmètre. Le seul import statique (`chatsAttachmentsAdoption.test.ts` L59-62) vise `messagerie/attachmentStorage`, hors périmètre. La couverture passe par l'API ou par lecture du code source.

| Test | L. | Cas | Env | Lien avec le périmètre | Admin ? |
|---|---|---|---|---|---|
| attachmentGateRatchet.test.ts | 134 | 2 | node | Lit le source. Exige `assertNotSuspended` sur `people` (L23), `connections` (L26-30), `engagement` (L31-35), `follows` (L36), `posts` (L57-63) | cliquet ADR-0087 : à remplacer par un cliquet `requireMembership` |
| fileGuardGateRatchet.test.ts | 93 | 3 | node | `media.ts` est dans `GATED` (L32). `people.ts` et `follows.ts` sont absents | — |
| uploadPolicyRatchet.test.ts (+ exceptions.json, 64 l.) | 159 | 4 | node | `media.ts` en exception « media_social » (JSON L52) | — |
| freshUploadRatchet.test.ts | 109 | 3 | node | Balayage global ; `people.ts` L728/L756 concerné implicitement | — |
| membershipScopeRatchet.test.ts | 1571 | 14 | node | Vérificateurs `assertVisiblePost` L463, `isFollowingUser` L482, `findMark` L576 ; ancrages `ctx.user._id` L791+ | — |
| vpgCollaborationEndToEnd.test.ts | 723 | 2 | edge | `people.publishMyProfile`, `follows.follow`, `posts.getPost` / `myFeed` | **oui** (seed VPG, `directoryAssignments`) |
| reseauPlatformActsAudit.test.ts | 331 | 6 | edge | `posts.publish`, `moderation.reportPost` / `decide` (audit L87/L114) | **oui** (`users` / `orgs` / `memberships`, rôles) |

- **Périphériques, fixtures seulement :**
  - `instructionQueues.test.ts` (1071 l., 19 cas) insère des posts et des `contentReports` (L194-215) pour tester `functions/instructionQueues.ts` L355 et L1143 ;
  - `chatsAttachmentsAdoption.test.ts` (762 l., 14 cas) n'appelle que `people.publishMyProfile` (L304).
- **Hors sujet :** `chatsMessagerie.test.ts`, `realtimeToolTodayAgenda.test.ts`.

**Hors des deux répertoires demandés (à porter avec les fonctions) :**
- `socle/convex/migrations/backfillReseauPersonnelPostAggregates.test.ts` (81 l., 2 cas) : compteurs ;
- `socle/convex/crons/notificationsRetention.test.ts` (142 l., 4 cas) ;
- `socle/convex/migrations/resolveSettledInvitations.test.ts` (434 l., 6 cas ; importe `notifyPersonal`).

---

## 4. Graphe d'ordre de duplication (dépendances d'abord)

**Préalables à fournir par le moteur :**
- **E1** — constructeurs authentifiés + `requireMembership`. Remplacent `lib/customFunctions`, `reseau/attachmentGate.assertNotSuspended`, `lib/platformAdmin`, `backoffice*`.
- **E2** — `lib/errors`.
- **E3** — `persons` et memberships réseau. Remplacent `users`, `memberships`, `orgs`, `appAccess/resolve`, `lib/postIdentity`.
- **E4** — table et garde des connexions par réseau. Remplacent `modules/reseau/connections.ts`, `tables.connectionsTable` (index `by_pair`, `by_low_status`, `by_high_status`), `reseau/enums`, `reseau/graphGuards`.
- **E5** — garde fichiers. Remplace `fileGuard/admission`, `fileGuard/storageGuard`, `lib/uploadPolicy`.
- **E6** — audit. Remplace `lib/contextAudit`.
- **G** — `groupesThematiquesAccess.ts` (autre agent), ou une fonction de remplacement qui renvoie `false`.

**Ordre :**
```
N0  domain · searchText · validators · feedScale · connectionState   (manifest : exclu)
N1  handleSuggestion→domain · counters→domain · contentRemoval · tables→validators
    · graph→E4(+E3) · media→E1,E2,E5
N2  people→domain,handleSuggestion,graph,E1,E3,E5 · access→domain,graph,G
N3  notifications→connectionState,people · marks→access,people,validators
N4  postWrite→domain,graph,G,notifications,people,searchText
    follows→graph,domain,notifications,people,E1
    connections→domain,graph,notifications,people,E4
    moderation→access,contentRemoval,validators,E6
    engagement→access,contentRemoval,counters,domain,notifications,people,validators,marks
N5  posts→access,contentRemoval,counters,domain,G,marks,graph,media,notifications,people,
         postWrite,searchText,validators,feedScale
```

**Ce qui doit passer avant l'autre agent :** ses fichiers dépendent des miens.
- `groupes` : graph, notifications, people, domain, validators.
- `groupesThematiques` : access, domain, graph, marks, notifications, people, posts, searchText.
- `evenements` : domain, graph, notifications, people, postWrite, validators.
- `stories` : domain, feedScale, graph, media, people, validators.
- `suggestions` : domain, graph, people.
- `messagerie` : graph, people.
- `messagerie/attachment*` : domain.

---

## 5. Modules purs exportables vers `packages/social-domain`

| Module | L. | Sort | Tests purs à prendre |
|---|---|---|---|
| searchText.ts | 64 | tel quel | aucun (à créer) |
| handleSuggestion.ts | 217 | tel quel | handleSuggestion.test.ts (181 l., 21 cas) |
| domain.ts | 1633 | à adapter | domain.test.ts (947 l., 71 cas ; laisser l'import `validators` L62 et le test d'alignement L617-643 côté Convex) ; stories.domain.test.ts (387 l., 41 cas ; retirer les 6 cas « page ») |
| feedScale.ts | 106 | à adapter (type Id) | 3 cas purs de feedScale.test.ts (L49-58, L60-78, L186-191) |
| connectionState.ts | 39 | à adapter (type) | aucun |

- **Total :** 2 059 lignes ; 136 cas purs (21 + 71 + 41 + 3).
- **Helpers purs à extraire au passage :**
  - `people.addedMentionedUserIds` L89-95 ;
  - `engagement.reactionCountsAfter` L37-46 ;
  - `notifications.personalNotificationSubjectKey` L114-126 ;
  - `connections.foldDiacritics` / `searchWords` L517-528, à fusionner avec `searchText`.

---

## 6. Tables de `tables.ts` et leurs index

26 tables, 73 index et 3 index de recherche. ★ = table utilisée par le périmètre (10 tables, 33 index et 2 index de recherche).

**Tables du périmètre :**
- ★ `reseauPersonnel_profiles` (L81)
  - index : `by_user[userId]`, `by_handle[handle]` ;
  - recherche : `search_displayName` (champ displayName ; filtres withdrawnAt, privateAt).
- ★ `reseauPersonnel_posts` (L137)
  - index : `by_author_and_status`, `by_author_status_publishedAt`, `by_directSessionId`, `by_status_and_publishedAt`, `by_author_and_idempotencyKey`, `by_sharedPostId`, `by_group_status_publishedAt`, `by_page_status_publishedAt`, `by_eventId` ;
  - recherche : `search_body_v1` (champ searchText ; filtre status).
- ★ `reseauPersonnel_postReactions` (L278) : `by_post_and_reactor`, `by_post`.
- ★ `reseauPersonnel_postAggregateBackfills` (L298, utilisée par une migration) : `by_post`.
- ★ `reseauPersonnel_postComments` (L324) : `by_post_and_createdAt`, `by_parent_and_createdAt`.
- ★ `reseauPersonnel_contentReports` (L347) : `by_reporter_and_target`, `by_status_and_createdAt`, `by_post`, `by_comment`.
- ★ `reseauPersonnel_follows` (L380) : `by_follower_and_target`, `by_follower_and_createdAt`, `by_target_and_createdAt`.
- ★ `reseauPersonnel_notifications` (L406) : `by_recipient_and_createdAt`, `by_recipient_and_readAt`, `by_recipient_and_dedupKey`, `by_readAt`, `by_createdAt`.
- ★ `reseauPersonnel_postMarks` (L465) : `by_user_kind_post`, `by_user_kind_createdAt`, `by_post_and_kind`.
- ★ `reseauPersonnel_mutes` (L491) : `by_user_and_muted`, `by_user_and_createdAt`.

**Tables des autres tranches (autre agent) :**
- `stories` (L527) : `by_author_and_expiresAt`, `by_expiresAt`, `by_author_and_idempotencyKey`.
- `storyViews` (L582) : `by_story_and_viewer`, `by_story_and_seenAt`, `by_viewer_and_seenAt`.
- `groupThreads` (L618) : `by_creator_and_idempotencyKey`, `by_activeMeetingId`.
- `groupMembers` (L695) : `by_thread_and_user`, `by_thread_and_leftAt`, `by_user_and_leftAt`.
- `groupInvites` (L745) : `by_thread_and_invitee`, `by_invitee_and_status`, `by_thread_and_status`.
- `groupInviteLinks` (L770) : `by_threadId`, `by_token`.
- `groupMessages` (L786) : `by_thread_and_createdAt`, `by_thread_and_idempotencyKey`.
- `groupMessageReactions` (L873) : `by_message_and_user`, `by_thread_and_user`, `by_message`.
- `groupTyping` (L892) : `by_thread`, `by_thread_and_user`, `by_expiresAt`.
- `thematicGroups` (L922) : `by_creator_and_idempotencyKey` ; recherche `search_name`.
- `thematicGroupMembers` (L973) : `by_group_and_user`, `by_group_and_leftAt`, `by_user_and_leftAt`.
- `thematicGroupInvites` (L992) : `by_group_and_invitee`, `by_invitee_and_status`, `by_group_and_status`.
- `events` (L1031) : `by_organizer_and_idempotencyKey`, `by_organizer_and_startAt`.
- `eventParticipants` (L1074) : `by_event_and_user`, `by_user_and_status`, `by_user_and_eventStartAt`, `by_event_and_status`.
- `unreadTotals` (L1129) : `by_user`.
- `suggestionDismissals` (L1154) : `by_user_and_dismissed`, `by_user_and_createdAt`.

**Tables étrangères lues par le périmètre :** `connections` (module `reseau`), `users`, `memberships`, `orgs`, `reseauPages_pages`, `reseauPages_follows` (via `followedPageIds`), `direct_sessions`, `reseauPersonnel_events` / `eventParticipants`, `reseauPersonnel_thematicGroupMembers` (via G), `_storage`, et les tables de la garde fichiers.

---

## 7. Totaux

- **Sources du périmètre :** 22 fichiers, **9 709 lignes**, 63 fonctions Convex.
- **Tests colocalisés du périmètre :** 13 fichiers, **7 143 lignes**, **307 cas**. Le test frontière `newAgentCalls` ajoute 232 lignes et 13 cas générés.
- **Tests centralisés pertinents :** 7 fichiers, **3 120 lignes**, **34 cas** (cliquets globaux compris), plus un JSON de 64 lignes.
- **Total tests pertinents :** 20 fichiers, **10 263 lignes**, **341 cas**.
- **Code pur vers `social-domain` :** 5 modules, 2 059 lignes ; 136 cas purs.

---

## 8. Ce qui mérite une attention particulière

1. **Délivrance d'images hors garde.** 9 appels `getUrl` bruts (`people.ts` ×8, `follows.ts` ×1) servent avatars et couvertures sans passer par `servableUrl`, et le cliquet `fileGuardGateRatchet` ne les voit pas. Un avatar encore en analyse ou signalé serait donc servi quand même. S'y ajoute indirectement `reseauPages/access.ts` L164-166.
2. **Compteurs et fan-out sur la publication.** Réactions, commentaires et partages patchent le document de la publication, très sollicité. Le fan-out des notifications se fait dans la transaction du commentaire. Ces deux points sont à repenser dans le moteur : compteur à part ou agrégat, notifications planifiées.
3. **Le lien de connexion n'appartient pas à ce module.** Il vient de `modules/reseau` : le moteur doit d'abord fournir E4.
4. **Le socle sait déjà limiter le débit** (`socle/convex/ai/rateLimiter`), mais ce module ne l'utilise sur aucune de ses 31 mutations.

Aucune écriture n'a été faite.
