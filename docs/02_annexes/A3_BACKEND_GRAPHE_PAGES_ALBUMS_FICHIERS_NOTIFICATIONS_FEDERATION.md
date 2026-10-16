---
title: "ANTSIA — Annexe A3 du document 02 : inventaire contradictoire, backend — graphe des connexions, pages, albums, garde des fichiers, notifications et push, fédération, effacement, limitation de débit"
date: "2026-10-14"
source: "socle administration.ga, origin/main = ad2e7fdc2, copie propre (git worktree add), lecture seule"
statut: "Rapport d'inventaire brut, produit en lecture seule ; la synthèse décisionnelle est docs/02_OWNER_MAP_DUPLICATION.md"
---

> Annexe A3 de `docs/02_OWNER_MAP_DUPLICATION.md`. Les chemins sont relatifs à la racine d'une copie
> propre du socle sur `origin/main` (`ad2e7fdc2`). Les numéros de ligne valent pour ce commit. Quand une
> décision du document 02 diffère d'une proposition de ce rapport, c'est le document 02 qui fait foi.

# Inventaire contradictoire : duplication du réseau social vers le moteur social multi-réseaux

Source examinée en lecture seule : `$S` = `<copie propre du socle>` (commit ad2e7fdc2). Tous les chemins ci-dessous sont relatifs à `$S`.

Je n'ai lancé aucune écriture, aucun git fetch, aucune commande bun ou convex.

---

## 0. Ce qui contredit le cadrage (à lire en premier)

1. **graphGuards.ts n'est pas une dépendance de connections.ts.**
   - connections.ts n'importe que `./enums` (ligne 22).
   - graphGuards ne sert qu'aux rattachements (`resolveMembershipStatus`, `isValidatedMembership`).
   - Il atteint pages et albums indirectement, via `reseauPersonnel/graph.ts:13`.

2. **Il n'existe aucun seau « revendications ».**
   - `socle/convex/ai/rateLimiter.ts` ne contient aucune clé claim ou revendication.
   - `modules/reseau/claims.ts` n'appelle aucun limiteur.
   - Les seuls seaux sociaux sont ceux du direct : `directComment`, `directReaction`, `directAntennaRequest`, `directAntennaInvite` (lignes 343-381).

3. **Le push n'est pas « réservé aux appels », mais aucun évènement social ne pousse.**
   - Six émetteurs de push existent :
     - `functions/chats.ts:887` (messages) ;
     - `functions/voicemails.ts:231` ;
     - `lib/appointmentNotify.ts:306` ;
     - `modules/iappel/push.ts:66` ;
     - `modules/iagenda/briefing.ts:428` ;
     - `modules/iagenda/reminders.ts:426`.
   - Aucun ne concerne une connexion, une page, un album, une réaction ou une mention.
   - La raison est structurelle : `notifyUser` prend `Pick<MutationCtx,"db">` (lib/notify.ts:140-141), donc pas de scheduler.
   - La cloche sociale est une autre table, `reseauPersonnel_notifications`, alimentée par `notifyPersonal`, sans aucun push.

4. **La fédération n'a ni inbox HTTP ni signature.**
   - `ingest` et `replay` sont des `triggeredInternalMutation` (federation.ts:308, 376).
   - Aucune route dans `http.ts`, aucun appelant en production : seuls les tests les invoquent.
   - Le patron d'inbox HTTP signée le plus proche est le webhook NDJOBI :
     - `http.ts:3161-3240` : `checkIpBlock`, seau IP, corps lu en texte, `verifyNdjobiDelivery`, contrôle de l'en-tête d'idempotence ;
     - helper dans `lib/ndjobi/webhook.ts` (`NDJOBI_HEADERS` ligne 254).

5. **La délivrance de fichiers n'est pas fail-closed.**
   - Un blob sans ligne de scan est servable : `fileGuard/policy.ts:121-125` et `storageGuard.ts:9-11`.
   - Ce comportement est verrouillé par deux tests :
     - `fileGuard/fileGuard.test.ts:195-219` (« fail-open sur l'antériorité ») ;
     - `fileGuard/policy.test.ts:15-20`.
   - Le kill-switch `FILE_GUARD=off` fait naître les lignes en `skipped`, donc servables (admission.ts:285-293).
   - Le fournisseur antivirus par défaut est `mock`, qui ne détecte que EICAR, et un fournisseur inconnu retombe sur le mock (avProviders.ts:215-238).

6. **Le cliquet `tests/fileGuardGateRatchet.test.ts` est une liste blanche.**
   - Seuls les fichiers de `GATED` (lignes 26-47) sont contrôlés.
   - Quatre appels bruts à `ctx.storage.getUrl` y échappent : `reseauPages/access.ts:164` et `:166`, `reseauAlbums/access.ts:98`, `reseauAlbums/albums.ts:115`.
   - Conséquence : une photo d'album `pending` ou `infected` est servie, alors que `addItems` l'a bien inscrite à l'analyse via `verifyDeclaredMedia` → `enqueueScan`.

7. **Le blocage est révélé au bloqué.**
   - `connections.ts:179-186` renvoie `status: "blocked"` au demandeur.
   - Le wrapper le propage tel quel (`reseauPersonnel/connections.ts:84-97`).
   - Le test « une demande du bloqué ne crée rien et ne révèle rien » (`tests/reseauConnections.test.ts:342-363`) n'affirme pas `attempt.status` : il ne mord pas.

8. **`albums.remove` laisse des orphelins (albums.ts:590-610).**
   - La ligne d'album est supprimée (607), mais les items sont seulement marqués `removedAt` (602-606).
   - Au-delà de 240 items, ils ne sont même pas marqués (`take(ALBUM_ITEMS_SCAN_MAX)`, 601).
   - Aucun blob ni ligne de scan n'est purgé.
   - La table `reseauAlbums_items` n'a pas d'index par propriétaire : ces orphelins sont introuvables pour un effacement.

9. **`dataSubjectErasure` ne touche aucune table sociale**, pas même `notifications` et `pushSubscriptions`, que la suppression admin couvre (`functions/admin.ts:2661, 2676`, puis suppression lignes 2972 et 2982).

10. **`fileGuard/inspect.ts:814` contient des octets bruts NUL à 0x1F** (`/[\0-\037]/`). `file` le classe comme « data » et grep l'ignore sans `-a`. Il faut le copier octet pour octet.

11. **Famine possible du cron de purge** (`fileGuard/mutations.ts:362-370`). Les lignes déjà purgées (`blobPurgedAt` posé) restent `infected` et ne sont plus repatchées après le `continue`. Dès qu'il y en a 50 plus vieilles que la rétention, `take(50)` ne rend plus qu'elles et la purge s'arrête. À confirmer par un test.

12. **Pas de code d'erreur générique de limitation de débit.**
    - `lib/errors.ts` n'a que `PIN_RATE_LIMITED` (ligne 223).
    - Le direct lève `INVALID_ARGUMENT` (`modules/direct/comments.ts:84-90`).
    - pnpe lève un `ConvexError({code:"RATE_LIMITED"})` ad hoc (`functions/pnpe/leads.ts:252-272`, configuration de seau en ligne).

---

## A. Graphe des connexions : socle/convex/modules/reseau

### A.1 `socle/convex/modules/reseau/connections.ts` (635 lignes)

**Rôle :** lien agent↔agent stocké une seule fois en paire canonique `userIdLow`/`userIdHigh`, avec demande, réponse, blocage unilatéral, levée du blocage et lectures paginées.

**Imports**
- Externes : `convex/server` (`paginationOptsValidator`, `PaginationResult`), `convex/values`.
- `_generated/api` (api, internal), `_generated/dataModel`, `_generated/server`.
- `lib/customFunctions` (`authMutation`, `authQuery`, qui enveloppent `triggers.wrapDB` et `requireAuth`), `lib/errors`.
- Interne : `./enums`.

**Accroches administration**
- Identité = table `users`, partout :
  - `ctx.user._id` (163, 247, 286, 329, 379, 408, 476, 551, 599) ;
  - `v.id("users")` (32-33, 67-69, 152, 283, 352, 386, 392).
- Contrôle de la cible : `ctx.db.get(targetUserId)` et `isActive` (168-171).
- Couplage au module direct : `revokeConnectionDirects` (30-55) planifie `internal.modules.direct.revocation.kickUserFromConnectionDirects` (38, 47), appelé par `block` (300, 314).
- Libellé en dur « Agent introuvable » (170).
- Aucune notion d'organisation ou de réseau : pas de `networkId`.

**Dette**
- Aucune limitation de débit sur `request` (150), `respond` (237), `block` (282), `unblock` (320).
- `message` non borné (153), stocké tel quel (204, 222). La borne n'existe que dans le wrapper (`assertConnectionMessage`).
- Aucune garde de suspension : elle n'existe que dans le wrapper `reseauPersonnel/connections.ts`, et l'API brute est publique.
- Aucune notification : la cloche est émise par le wrapper (`notifyPersonal`), sans push.
- Fuite du blocage (179-186), voir §0.7.
- `.filter()` après l'index dans `paginatePendingForMeSide` (484, 492) : pages potentiellement courtes.
- Pas de validateur `returns` sur les quatre fonctions `paginate*` (402-534).
- Listes historiques bornées à `LEGACY_CONNECTION_LIMIT=200` (28) : `take(201)` puis exception (558/564, 606/612, 567-576, 615-624). Pas de `.collect()`.

**Exports et constructeurs**

| Ligne | Export | Constructeur |
|---|---|---|
| 66 | `canonicalPair` (pur) | — |
| 92 | `ConnectionView` (type) | — |
| 100 | `viewConnection` (pur) | — |
| 150 | `request` | authMutation |
| 237 | `respond` | authMutation |
| 282 | `block` | authMutation |
| 320 | `unblock` | authMutation |
| 351 | `withAgent` | authQuery |
| 402 | `paginateMineSide` | authQuery |
| 443 | `paginateMine` | authQuery (compose via `ctx.runQuery`) |
| 470 | `paginatePendingForMeSide` | authQuery |
| 510 | `paginatePendingForMe` | authQuery |
| 541 | `listMine` | authQuery |
| 588 | `listPendingForMe` | authQuery |

**Appelants :** `reseauPersonnel/connections.ts` (84, 222, 320, 373, 424, 458), `iappel/presence.ts` (78, 190), seeds (`canonicalPair`).

**SORT : à réécrire.** On garde `canonicalPair`, `viewConnection`, la machine d'états, l'idempotence et l'unilatéralité. Il faut :
- passer en `personId` + `networkId` et `requireMembership` ;
- ajouter la limitation de débit, borner `message`, corriger la fuite du blocage ;
- émettre la notification avec push dans la mutation ;
- remplacer `revokeConnectionDirects` par un point d'accroche.

**Cible :** `convex/modules/graph/connections.ts`.

### A.2 `socle/convex/modules/reseau/enums.ts` (196 lignes)

**Rôle :** vocabulaire du réseau. Imports : `convex/values` seulement.

**Accroches administration**
- Statuts d'organisation (24-31), provenance (40-55), transitions (62-96), statuts de rattachement (112-118), revendications (124-177).
- Contrat externe (4-7) : `config/v4.4/acquisition-model.json` et `scripts/v4.4/modules-pricing.test.mjs` (lignes 372-390). Ce contrat verrouille les statuts d'organisation, pas ceux de connexion.

**Exports**

| Ligne | Export |
|---|---|
| 24 | `ORG_STATUSES` |
| 25 | `OrgStatus` |
| 27 | `orgStatusValidator` |
| 40 | `ORG_PROVENANCES` |
| 47 | `OrgProvenance` |
| 49 | `orgProvenanceValidator` |
| 62 | `ORG_STATUS_TRANSITIONS` |
| 84 | `isLegalOrgStatusTransition` |
| 94 | `carriesPublicBadge` |
| 112 | `MEMBERSHIP_STATUSES` |
| 113 | `MembershipStatus` |
| 115 | `membershipStatusValidator` |
| 124 | `ORG_CLAIM_STATUSES` |
| 132 | `OrgClaimStatus` |
| 134 | `orgClaimStatusValidator` |
| 145 | `ORG_CLAIM_EVIDENCE_KINDS` |
| 158 | `OrgClaimEvidenceKind` |
| 160 | `orgClaimEvidenceKindValidator` |
| 169 | `ORG_CLAIM_OPEN_STATUSES` |
| 175 | `isOpenClaimStatus` |
| 183 | `CONNECTION_STATUSES` |
| 189 | `ConnectionStatus` |
| 191 | `connectionStatusValidator` |

**SORT : à adapter.** N'extraire que les lignes 183-196.

**Cible :** `convex/modules/graph/enums.ts`.

### A.3 `socle/convex/modules/reseau/tables.ts` (147 lignes)

**Imports :** `convex/server`, `convex/values`, `./enums`.

**Tables**
- `orgClaimsTable` (29-94) : institutionnel.
- `connectionsTable` (107-122) : champs `v.id("users")` aux lignes 108-110 et 114. Index `by_pair [userIdLow,userIdHigh]` (120), `by_low_status` (121), `by_high_status` (122).
- `orgInvitationsTable` (135-147) : institutionnel.

**Dette :** aucun index par `requestedByUserId` ou `blockedByUserId`, ce qui gênera l'effacement.

**SORT : à adapter.** Garder seulement les lignes 96-122, avec `networkId`, `personIdLow`/`personIdHigh`, index préfixés par `networkId`.

**Cible :** `convex/modules/graph/tables.ts`.

### A.4 `socle/convex/modules/reseau/graphGuards.ts` (97 lignes)

**Rôle :** plancher de tâches d'un rattachement déclaré. Import : `./enums` (type uniquement).

**Exports :** `DECLARED_MEMBERSHIP_TASKS` (45), `resolveMembershipStatus` (59), `isValidatedMembership` (65), `filterTasksForMembershipStatus` (78), `declaredMembershipAllows` (95).

**Accroche :** sémantique « champ absent = validated » (59-63). Cette valeur par défaut est fail-open et ne doit pas être reprise.

**SORT : exclu.** Seul le patron « plancher défini positivement » est à retenir pour `requireMembership`.

**Cible indicative :** `convex/modules/people/membership.ts`.

### A.5 Fichiers institutionnels exclus de modules/reseau (16 sources, 6 243 lignes)

| Fichier | Lignes | Rôle |
|---|---:|---|
| affiliationReminders.ts | 150 | Relance l'autorité (DSI) après 60 jours sans décision (ADR-0124) |
| attachment.ts | 289 | Décision pure de rattachement et de fusion sans perte |
| attachmentDeadline.ts | 341 | Règle des 72 h de rattachement (ADR-0087), pure |
| attachmentGate.ts | 331 | Porte de suspension (`assertNotSuspended`, 310-331), appelée par pages et albums |
| attestationService.ts | 98 | Attestation de services, action |
| attestationServiceData.ts | 228 | Données et dépôt de l'attestation |
| claims.ts | 1434 | Revendications d'organisation |
| engagementReminders.ts | 255 | Rappels d'échéance d'engagement |
| membershipEngagement.ts | 328 | Engagement à terme |
| membershipValidation.ts | 297 | Validation en lot des rôles déclarés |
| orgAdminState.ts | 597 | Qui administre une structure (`platformTitleCoversOrg` à la ligne 95) |
| orgStatus.ts | 22 | Statut effectif d'une organisation |
| rattachementLegalCatalog.ts | 224 | Corpus juridique du rattachement |
| registration.ts | 877 | Inscription individuelle |
| sensitiveOrgs.ts | 89 | Gel des slugs sensibles |
| verticalStaffProvisioning.ts | 683 | Profils verticaux MENDI/FP/ARCEP |

Les tests colocalisés de modules/reseau représentent 6 334 lignes au total, dont `graphGuards.test.ts` (177), `federation.test.ts` (483) et `federationProtocol.test.ts` (158), détaillés en §H.

À noter : `isPlatformAdmin` est défini dans `lib/platformAdmin.ts:19` et `platformTitleCoversOrg` dans `reseau/orgAdminState.ts:95`. Aucun des deux n'apparaît dans les fichiers du périmètre.

### A.6 Patrons de fédération

#### `socle/convex/modules/reseau/federationTables.ts` (104 lignes)

**Imports :** `convex/server`, `convex/values`.

**Tables**
- `federationInboxReceiptsTable` (33-44) : reçu idempotent `receiptKey = eventId#consumer`.
  - Index `by_receiptKey` (43), `by_eventId` (44).
  - Accroches administration : `resultOrgId` (38), `resultUserId` (39), `resultMembershipId` (40).
- `federationDeadLettersTable` (61-82) : dead-letter queue.
  - Index `by_eventId_consumer` (81), `by_destination_status` (82).
  - Champs propres aux agents (69-73), dont `agentName` et `agentEmail` en clair.
- `federationReplayAuditTable` (91-104) : audit des rejeux.
  - Index `by_eventId` (103), `by_replayId` (104).
  - `requestedByUserId` (101).

**SORT : patron.** Il faut :
- des résultats génériques : `networkId` et des identifiants résultats polymorphes ;
- une dead-letter queue qui stocke l'enveloppe opaque (JSON canonique + sha256) plutôt que des colonnes métier ;
- une durée de rétention pour cette queue.

**Cible :** `convex/modules/federation/tables.ts`.

#### `socle/convex/modules/reseau/federationProtocol.ts` (160 lignes)

**Rôle :** module pur. Import de type seulement depuis `@workspace/federation-contracts` (33). Le paquet se trouve dans `socle/packages/federation-contracts`.

**Exports**

| Ligne | Export |
|---|---|
| 37 | `FEDERATION_API_VERSION` |
| 41 | `FEDERATION_DESTINATION` = "reseau.identity" |
| 45 | `FEDERATION_CONSUMER` |
| 49 | `FEDERATED_AGENT_EVENT_TYPE` |
| 64-74 | `FederatedAgentEventInput` (propre aux agents) |
| 78-103 | `buildFederatedAgentEnvelope` |
| 108-110 | `computeReceiptKey` |
| 119-136 | `canonicalStringify` |
| 140-146 | `sha256HexWebCrypto` |
| 149-151 | `eventDigest` |
| 158-160 | `federatedAuthId` |

`canonicalStringify` est réutilisé par `modules/entitlements/verify.ts:25` et `model.ts:25`.

**Dette :** aucune vérification de signature ni de fraîcheur (horodatage, fenêtre anti-rejeu).

**SORT : à adapter.**
- Lignes 105-151 reprises telles quelles.
- Constantes, type d'entrée et `federatedAuthId` à réécrire.
- Ajouter une vérification HMAC ou Ed25519 et de l'horodatage, sur le modèle de `lib/ndjobi/webhook.ts`.

**Cible :** `convex/modules/federation/protocol.ts`.

#### `socle/convex/modules/reseau/federation.ts` (482 lignes)

**Imports**
- `convex/values`.
- `lib/customFunctions` (`triggeredInternalMutation`), `lib/auth` (`getMembership`), `lib/errors`.
- `_generated/*`.
- Internes : `./enums` (`isLegalOrgStatusTransition`), `./orgStatus`, `./federationProtocol`.

**Accroches administration**
- `resolveFederatedAgent` (107-189) écrit dans trois tables :
  - `orgs` : recherche par slug (115-118), patch `verified`/`sovereign_source` (140-147) ;
  - `users` : création avec un `authId` synthétique (150-164) ;
  - `memberships` : insertion `validated` (169-186).
- `recordAuditEntry` (255-274) écrit dans `auditLog` avec `table:"memberships"`.

**Patrons à garder**
- `findReceipt` (195-200), `findDeadLetter` (202-209).
- `recordDeadLetter` (211-246) : upsert avec `attempts`.
- `resolveDeadLetterIfAny` (248-253).
- `attemptResolveFederatedAgent` (280-296) : try/catch vers la dead-letter queue, sans jamais faire échouer la mutation.
- `ingest` (308-365) : reçu d'abord, puis traitement, puis reçu, fermeture de la dead-letter queue et audit.
- `replay` (376-482) : `deduplicated` / `reprocessed` / `still_failing`, chacun journalisé.

**Dette**
- Pas de route HTTP, pas de signature, pas de limitation de débit.
- Passage en dead-letter queue immédiat, sans `MaxDeliver` (assumé, 53-59).
- Aucun appelant en production.

**SORT : patron.** Réécrire `resolveFederatedAgent` en dispatch par type d'évènement vers persons, network et graph, et ajouter une `httpAction` signée avec seau IP.

**Cible :** `convex/modules/federation/inbox.ts`, plus `convex/modules/federation/http.ts`.

---

## B. Pages : socle/convex/modules/reseauPages (9 sources, 1 645 lignes)

### `tables.ts` (123 lignes)

**Imports :** `convex/server`, `convex/values`, `./validators`.

**Tables**
- `reseauPagesPagesTable` (49-97).
  - Champs : `orgId: v.id("orgs")` (50), `handle`, `status`, `followerCount`, `postCount`, `searchText`.
  - Utilisateurs : `activatedByUserId` (74), `deactivatedByUserId` (76).
  - Index : `by_org` (82), `by_handle` (83), `by_status_and_activatedAt` (86), `by_status_and_followerCount` (89).
  - Recherche plein-texte : `search_name_v1` sur `searchText`, filtre `status` (94-97).
- `reseauPagesFollowsTable` (112-123) : `followerUserId` (113), `pageId`.
  - Index : `by_follower_and_page` (118), `by_follower_and_createdAt` (121), `by_page_and_createdAt` (123).

**Accroches administration :** l'identité de la page est dérivée de `orgs` (commentaire 28-31 et 40-43). La table ne porte ni nom, ni logo, ni description.

**SORT : à adapter.**
- Ajouter `networkId`, les champs d'identité propre (`name`, `shortName`, `logoStorageId`, `bannerStorageId`, `description`), et `createdByPersonId`.
- Retirer `orgId`.
- Créer une table neuve des signataires (`pageId`, `personId`, `role`, `grantedBy`, `revokedAt`).

**Cible :** `convex/modules/pages/tables.ts`.

### `validators.ts` (21 lignes)

- Import : `convex/values`. Export : `pageStatusValidator` (18-21), `active | inactive`.
- **SORT : tel quel.** Cible : `convex/modules/pages/validators.ts`.

### `domain.ts` (139 lignes)

**Imports :** `reseauPersonnel/domain` (`ReseauPersonnelViolation` ligne 6, type `FeedReason` ligne 7).

**Exports :** `PAGE_HANDLE_MIN_LENGTH` (18), `PAGE_HANDLE_MAX_LENGTH` (19), `PAGES_FEED_MAX` (29), `PAGE_FOLLOWS_SCAN` (32), `derivePageHandle` (43-51), `assertPageHandle` (62-80), `PageFeedScope` (83), `pageFeedAdmissionFor` (105-139).

**Accroches administration**
- Le handle est dérivé du slug d'organisation (commentaires 12-16, 35-42).
- La portée `mon_administration` (83, 132-137) dépend de `isMyOrgPage`.
- La route `/espace/pages` est citée en commentaire (57-58).

**SORT : à adapter.**
- Dériver le handle du nom.
- Remplacer `isMyOrgPage` par l'appartenance au réseau ou la qualité de signataire.
- Introduire une classe d'erreur propre.

**Cible :** `convex/modules/pages/domain.ts`.

### `graph.ts` (62 lignes)

- Imports : `_generated` (types), `./domain`.
- Exports : `followedPageIds` (22-31, borné à 200), `isFollowingPage` (34-46), `myPageFollowRows` (52-62).
- **SORT : à adapter** (renommer `personId` et ajouter `networkId`). Cible : `convex/modules/pages/follows.ts`.

### `access.ts` (213 lignes)

**Imports :** `_generated` (types), `lib/auth` (`getMembership`), `lib/errors`, `lib/permissions` (`assertCanDoTask`).

**Exports :** `pageNotFound` (26), `activePageOrNull` (31-40), `requireActivePage` (43-50), `assertCanPublishOnPage` (59-72), `requireActivePageByHandle` (75-89), `assertPageHandleFree` (98-113), `pageForOrg` (116-124), `PageIdentity` (137-150), `resolvePageIdentity` (152-188), `pageIdentityCache` (197-213).

**Accroches administration**
- Organisation vivante vérifiée à chaque lecture (38, 66, 85, 159).
- `getMembership` et `assertCanDoTask(…"communication.publish")` (69-70).
- Identité lue sur `orgs` : `org.name` (174), `shortName` (175), `branding.logoStorageId` et `bannerStorageId` (161-162), `org.logoUrl` (178), `publicDescription` puis `description` (181-183).

**Dette :** `ctx.storage.getUrl` brut (164, 166), hors fileGuard et hors du cliquet.

**SORT : à réécrire.**
- Identité lue sur la page elle-même.
- URL délivrées par `servableUrl` en fail-closed.
- Autorité de publication = appartenir aux signataires.

**Cible :** `convex/modules/pages/access.ts`.

### `pages.ts` (630 lignes)

**Imports**
- Externes : `convex/server`, `convex/values`.
- `lib/auth`, `lib/customFunctions`, `lib/errors`, `lib/permissions` (`canDoTask`).
- `reseauPersonnel/*` : `domain`, `access`, `media` (`verifyDeclaredMedia`), `postWrite` (`writePersonalPost`), `validators`, `graph` (`validatedOrgIds`), `contentRemoval`, `people`, `posts`, `searchText`. Ce sont des imports lignes 29-39.
- `./access`, `./graph`, `reseau/attachmentGate` (50).

**Accroches administration**
- `canDoTask(…"communication.publish")` (116-117).
- `validatedOrgIds` sur `memberships` (378).
- `assertNotSuspended` (146, 453, 515).
- `pageSearchText(org)` (628-630).
- Les publications vivent dans `reseauPersonnel_posts` (champ `pageId`), écrites par `writePersonalPost` (492-501). Le module dépend donc fortement de la tranche personnelle.

**Dette**
- Aucune limitation de débit sur `follow` (139), `unfollow` (176), `publishAsPage` (405), `removePagePost` (511).
- Compteurs chauds sur un seul document : `followerCount` (165-168, 193-196) et `postCount` (503-506), source de conflits OCC sur une page populaire.
- Une publication de page ne notifie pas les abonnés : seules les mentions sont notifiées (`reseauPersonnel/postWrite.ts:140-149`), et `follow` ne notifie rien (169-171).
- `listMyPageFollows` (239-267) fait N lectures plus jusqu'à deux `getUrl` brutes par page suivie.
- `discover` ne contrôle pas une limite négative (273).

**Exports**

| Ligne | Export | Constructeur |
|---|---|---|
| 65 | `DISCOVER_QUERY_MIN_LENGTH` | — |
| 120 | `getPage` | authQuery |
| 139 | `follow` | authMutation |
| 176 | `unfollow` | authMutation |
| 239 | `listMyPageFollows` | authQuery |
| 269 | `discover` | authQuery |
| 325 | `discoverPage` | authQuery |
| 364 | `myPublishablePages` | authQuery |
| 405 | `publishAsPage` | authMutation |
| 511 | `removePagePost` | authMutation |
| 541 | `pagePosts` | authQuery |
| 628 | `pageSearchText` | — |

**SORT : à réécrire.** Cible : `convex/modules/pages/pages.ts`.

### `admin.ts` (285 lignes)

**Imports :** `convex/values`, `_generated/api`, `lib/contextAudit`, `lib/customFunctions` (`superadminMutation`, `superadminQuery`), `lib/errors`, `lib/moduleCodes`, `reseauPersonnel/people` (`rethrowDomain`), `./domain`, `./access`, `./pages`.

**Accroches administration**
- Activation réservée au superadmin : `getForOrg` (75), `activate` (87-185), `deactivate` (187-223), `setHandle` (225-258), `listPages` (260-285).
- Contrôle du module Actualités : `ModuleCode.news` (29, 55-57).
- Audit : `appendContextAudit` vers `auditLog` (142-156, 173-182, 206-215, 246-255).
- `deactivate` planifie `internal.modules.direct.revocation.closePageDirects` (216-220).

**Dette :** aucune spécifique ; l'audit est un bon patron.

**SORT : à réécrire.** Création par un membre du réseau et gestion des signataires, en gardant le patron « un geste qui écrit laisse une ligne d'audit ».

**Cible :** `convex/modules/pages/admin.ts` et `convex/modules/pages/signatories.ts`.

### `followedUpdates.ts` (138 lignes)

**Imports :** `convex/values`, `lib/customFunctions`, `reseauPersonnel/domain` (`isPersonalPostVisibleTo`), `./domain`, `./access`, `./graph`.

**Exports :** `followedUpdateValidator` (26), `FollowedUpdate` (37), `followedUpdateExcerpt` (45), `list` (69, authQuery).

**Lectures :** bornées à 50 pages × 12 publications. Hérite du `getUrl` brut de `resolvePageIdentity`.

**SORT : à adapter.** Cible : `convex/modules/pages/followedUpdates.ts`.

### `manifest.ts` (34 lignes)

`canonicalRoute: "/espace/pages"` (20), `taskCodes: ["communication.publish"]` (33), dépendances `organigramme`, `reseauPersonnel` et `reseau` (32).

**SORT : exclu.** C'est le concept de tranche ADR-0004 propre à administration.

---

## C. Albums : socle/convex/modules/reseauAlbums (6 sources, 1 388 lignes)

### `domain.ts` (355 lignes)

**Rôle :** module pur. Importe `POST_IMAGE_MAX_BYTES` (20 Mo), `POST_IMAGE_MIME_TYPES`, `POST_MEDIA_ALT_MAX_LENGTH` et `PersonalReachAudience` depuis `reseauPersonnel/domain` (12-17).

**Exports**

| Ligne | Export |
|---|---|
| 20 | `ReseauAlbumsViolation` |
| 42 | `ALBUM_ITEMS_MAX` = 60 |
| 54 | `ALBUM_ITEMS_SCAN_MAX` = 240 |
| 57 | `ALBUM_ADD_BATCH_MAX` = 12 |
| 59-63 | Bornes de titre, description, légende et texte alternatif |
| 66 | `ALBUM_PAGE_MAX` = 24 |
| 69-70 | Types MIME et taille d'image |
| 83 | `ALBUM_STATUSES` |
| 97, 115, 128, 141 | `assertAlbumTitle`, `assertAlbumDescription`, `assertAlbumCaption`, `assertAlbumAltText` |
| 165 | `assertAlbumMedia` |
| 195 | `assertAlbumCapacity` |
| 230 | `isAlbumVisibleTo` |
| 263 | `assertAlbumPublishable` |
| 276 | `assertAlbumWithdrawable` |
| 290 | `nextPosition` |
| 310 | `reorderPositions` |
| 346 | `resolveCoverId` |

**Dette :** le libellé « 20 Mo » est écrit en dur (188).

**SORT : tel quel**, en rapatriant les constantes. Cible : `convex/modules/albums/domain.ts`.

### `validators.ts` (56 lignes)

- Exports : `albumStatusValidator` (16-20), `albumItemMediaValidator` (31-38, `storageId v.id("_storage")`), `albumDeclaredItemValidator` (47-56).
- **SORT : tel quel.** Cible : `convex/modules/albums/validators.ts`.

### `tables.ts` (90 lignes)

**Imports :** `reseauPersonnel/validators` (`personalReachAudienceValidator`, ligne 18), `./validators`.

**Tables**
- `reseauAlbumsAlbumsTable` (37-59) : `ownerUserId` (38).
  - Index : `by_owner_status_updatedAt` (55), `by_owner_and_updatedAt` (57), `by_owner_and_idempotencyKey` (59).
- `reseauAlbumsItemsTable` (76-90) : `ownerUserId` (78), `addedByUserId` (84).
  - Index : `by_album_and_position` (89), `by_album_and_idempotencyKey` (90).

**Dette :** aucun index par propriétaire sur les items.

**SORT : à adapter** (`networkId`, `ownerPersonId`, ajouter `by_owner` sur les items). Cible : `convex/modules/albums/tables.ts`.

### `access.ts` (112 lignes)

**Imports :** `lib/errors`, `reseauPersonnel/graph` (`isConnectedTo`, `isBlockedBetween`, qui lisent `connections`), `./domain`.

**Exports :** `albumNotFound` (26), `albumReadContext` (37), `canSeeAlbum` (52), `AlbumItemDto` (73), `resolveAlbumItemDtos` (92-112).

**Dette :** `ctx.storage.getUrl` brut (98).

**SORT : à adapter** (`servableUrl`, helpers de graphe du moteur). Cible : `convex/modules/albums/access.ts`.

### `albums.ts` (737 lignes)

**Imports :** `convex/server`, `convex/values`, `lib/customFunctions`, `lib/errors`, `reseau/attachmentGate` (31), `reseauPersonnel/media` (`verifyDeclaredMedia`, 32), `reseauPersonnel/people` (`findPublishedPersonByHandle`, `miniProfileCache`), `reseauPersonnel/graph`, `reseauPersonnel/validators`, `./access`, `./domain`, `./validators`.

**Accroches administration :** `assertNotSuspended` (532, 637, 699). Identité = `users`.

**Dette**
- `getUrl` brut sur la couverture (115).
- Orphelins de `remove` (590-610), voir §0.8.
- Performance :
  - `summaryOf` → `coverUrlOf` → `liveItems` fait un `take(240)` par album (103-117, 133-152) ;
  - `listMine` et `listForPerson` peuvent donc lire jusqu'à 24 × 240 = 5 760 items par page (677-679, 728-734) ;
  - `getAlbum` lit `liveItems` deux fois (640 et 108).
- Aucune limitation de débit sur les dix mutations.
- Aucune notification à la publication.

**Exports**

| Ligne | Export | Constructeur |
|---|---|---|
| 119 | `AlbumSummaryDto` (type) | — |
| 166 | `create` | authMutation |
| 220 | `update` | authMutation |
| 261 | `addItems` | authMutation |
| 389 | `setCaption` | authMutation |
| 424 | `reorder` | authMutation |
| 453 | `setCover` | authMutation |
| 482 | `removeItem` | authMutation |
| 526 | `publish` | authMutation |
| 563 | `withdraw` | authMutation |
| 590 | `remove` | authMutation |
| 623 | `getAlbum` | authQuery |
| 663 | `listMine` | authQuery |
| 693 | `listForPerson` | authQuery |

**SORT : à adapter.** Les changements sont lourds : purge en cascade (items, blobs, scans), `servableUrl`, couverture dénormalisée, limitation de débit et notifications.

**Cible :** `convex/modules/albums/albums.ts`.

### `manifest.ts` (38 lignes)

`canonicalRoute "/espace/profil"` (35), `taskCodes: []`. **SORT : exclu.**

---

## D. Fichiers : socle/convex/modules/fileGuard (16 sources, 3 604 lignes) et lib/uploadPolicy.ts

### `policy.ts` (185 lignes, pur, aucun import)

**Exports**

| Ligne | Export |
|---|---|
| 27 | `FILE_SCAN_STATUSES` |
| 49 | `FILE_SCAN_SOURCES` (11 sources : idocument, icorrespondance, ichat, iboite, courriel, digitalMail, media, backfill, generated, lecture_ia, ndjobi) |
| 70 | `GENERATED_BLOB_SKIP_REASON` |
| 75 | `Finding` |
| 83 | `FILE_GUARD_MAX_INSPECT_BYTES` |
| 86 | `FILE_GUARD_RUNNING_STALE_MS` |
| 89 | `FILE_GUARD_MAX_ATTEMPTS` |
| 92 | `FILE_GUARD_QUARANTINE_RETENTION_DAYS_DEFAULT` |
| 97 | `isKillSwitched` |
| 102 | `isAiTriageEnabled` |
| 106 | `quarantineRetentionDays` |
| 117 | `serviceStateOf` |
| 136 | `isServableStatus` |
| 143 | `isReleasableStatus` |
| 148 | `scanBadgeLabel` |
| 172 | `scanRefusalMessage` |

**Accroches administration :** libellés « votre DSI » (182) et « Sentinelle fichiers » (183).

**Dette :** absence de ligne = servable (121-125, et doctrine décrite 12-19).

**SORT : à adapter** (absence de ligne = `pending`/bloqué, sources sociales). Cible : `convex/modules/files/policy.ts`.

### `verdict.ts` (65 lignes)

- Import : `./policy`. Exports : `AvVerdict`, `AvResult`, `VerdictStatus`, `Verdict`, `decideVerdict` (38-61). Une erreur antivirus donne `error`, donc fail-closed.
- **SORT : tel quel.** Cible : `convex/modules/files/verdict.ts`.

### `inspect.ts` (882 lignes)

- Import : `./policy`.
- Exports : `ZipEntryInfo` (33), `InspectionInput` (41), `InspectionReport` (49), `normalizeMime` (57), `mimeFamily` (95), `indexOfBytes` (204), `sniffMime` (306), `mimeMismatchFinding` (401), `decodePdfNameEscapes` (445), `inspectPdf` (451), `inspectZipEntries` (566), `inspectOle2` (758), `inspectFilename` (789), `runDeterministicInspection` (839).
- Contient des octets de contrôle bruts à la ligne 814.
- **SORT : tel quel**, en copie binaire. Cible : `convex/modules/files/inspect.ts`.

### `avProviders.ts` (239 lignes)

- Imports : `./policy`, `./verdict`.
- Exports : `EICAR_SIGNATURE` (43), `MockFileScanProvider` (58), `parseClamAvResponse` (89), `ClamAvRestProvider` (148), `getFileScanProvider` (215).
- Dette : repli silencieux sur le mock (216-237).
- **SORT : à adapter.** En production, l'absence de fournisseur doit donner un verdict `error`. Cible : `convex/modules/files/avProviders.ts`.

### `scan.ts` (143 lignes, "use node")

- Imports : `_generated/api`, `_generated/server`, `./avProviders`, `./inspect`, `./policy`, `./verdict`, `jszip` en import dynamique (28).
- Export : `runScan` (53, internalAction).
- Dette : lecture du champ interne `_data` de jszip (35).
- **SORT : tel quel.** Cible : `convex/modules/files/scan.ts`.

### `tables.ts` (132 lignes)

**Exports :** les validateurs (18-85) et `fileGuardScansTable` (87-132).

**Accroches administration :** `orgId` (92), `subjectDocumentId` → `documents` (96), `quarantineDocumentId` (117), `previousFolderId` → `documentFolders` (120), et l'union de sources (28-40).

**Index :** `by_storageId` (129), `by_status_updatedAt` (130), `by_org_status` (131), `by_sha256` (132). Aucun index par déposant (`uploadedByUserId`, ligne 93).

**SORT : à adapter** (`networkId`, `uploadedByPersonId` indexé). Cible : `convex/modules/files/tables.ts`.

### `storageGuard.ts` (132 lignes)

- Imports : `convex/values`, `lib/errors`, `./policy`.
- Exports : `getScanForStorage` (22), `getScanStatus` (33), `isServableStorage` (41), `resolveFileDelivery` (60), `servableUrl` (70), `scanStateForFiles` (78), `withheldCodeValidator` (95), `withheldCodeOf` (106), `assertServableStorage` (124).
- Seul appel brut légitime à `getUrl` : ligne 66.
- **SORT : à adapter** (ligne absente = retenue). Cible : `convex/modules/files/storageGuard.ts`.

### `admission.ts` (417 lignes)

**Imports :** `_generated/api`, `lib/errors`, `lib/officialDocumentMark` (36), `lib/restrictedStorage` (37-40), `lib/uploadPolicy`, `rhDossier/guards` (47), `./policy`.

**Exports :** `findScanByStorageId` (85), `assertFreshUpload` (143-160), `isKeptApartStorage` (181-205), `enqueueScan` (236-298), `readStoredBlobFacts` (306), `admitStoredUpload` (324), `registerGeneratedBlob` (383).

**Accroches administration :** `isKeptApartStorage` lit `isRhStorage`, `isRestrictedStorage`, `isSignatureSpecimenStorage`, `isOfficialMarkStorage`, `courrierReceptionAssets`, `apdpvpPieces` et `documentTemplates` (186-203). `subjectDocumentId` (62, 346).

**Dette :** kill-switch fail-open (285-293).

**SORT : à adapter** (retirer les registres administration, méta `networkId`). Cible : `convex/modules/files/admission.ts`.

### `posedUploads.ts` (102 lignes)

- Imports : `lib/errors`, `lib/uploadPolicy` (type), `./admission`, `./policy`.
- Export : `admitPosedUploads` (57).
- **SORT : tel quel.** Cible : `convex/modules/files/posedUploads.ts`.

### `posedImages.ts` (50 lignes)

- Import : `lib/settingsImageRefs` (images de réglages d'administration).
- Export : `admitPosedImages` (33).
- **SORT : exclu**, ou à adapter pour le logo et la bannière de page.

### `mutations.ts` (406 lignes)

**Imports :** `lib/auth` (`getMembership`, `isSuperadminUser`), `lib/customFunctions`, `lib/permissions` (`assertCanDoTask`), `lib/taskCodes`, `functions/archive` (`logAudit` vers `archiveAuditLog`), `./notify`, `./policy`, `./quarantine`, `./tables`.

**Exports**

| Ligne | Export | Constructeur |
|---|---|---|
| 56 | `scanFactsValidator` | — |
| 68 | `_markRunning` | internalMutation |
| 93 | `scanOutcomeValidator` | — |
| 146 | `_record` | triggeredInternalMutation |
| 201 | `_recordTriage` | internalMutation |
| 219 | `releaseScan` | authMutation |
| 272 | `requeueScan` | superadminMutation |
| 314 | `retryStale` | internalMutation (cron `file-guard-retry-stale`, crons.ts:786) |
| 356 | `purgeQuarantinedBlobs` | internalMutation (cron `file-guard-quarantine-purge`, crons.ts:794) |
| 397 | `_ageScanForTests` | internalMutation (exposée en production) |

**Accroches administration :** `settings.manage` (239-245), `logAudit` (258, 297, 381), quarantaine iDocument (187).

**Dette :** famine de purge possible (362-370), voir §0.11.

**SORT : à adapter.** Cible : `convex/modules/files/mutations.ts`.

### `queries.ts` (192 lignes)

**Imports :** `lib/auth`, `lib/customFunctions`, `lib/orgAccess` (`hasOrgAccess`), `./policy`, `./tables`, `./storageGuard`.

**Exports :** `statusByStorageIds` (31, authQuery, exige un `orgId`), `getScan` (68), `getScanByStorageId` (88), `listForBackoffice` (115, superadminQuery), `stats` (150, échantillon de 1 000 par statut), `_reportForTriage` (170).

**SORT : à adapter** (`requireMembership` sur le réseau). Cible : `convex/modules/files/queries.ts`.

### `notify.ts` (197 lignes)

**Imports :** `lib/assignmentLifecycle`, `lib/constants`, `lib/dsi`, `lib/notify`, `lib/permissions`, `lib/positionContext`, `lib/taskCodes`.

**Export :** `deliverVerdictNotice` (137).

**Accroches administration :** DSI par postes et `memberships` (90-132), insertion `iBoite_messages` (174-189), liens `/idocument` (61) et `/espace/documents` (63), libellés DSI et iDocument (44-56).

**SORT : à réécrire** (modérateurs du réseau, notification et push). Cible : `convex/modules/files/notify.ts`.

### Les trois derniers fichiers de fileGuard

- **`quarantine.ts` (196 lignes) : exclu.** Coffre iDocument : `documents`, `documentFolders`, `ensureOrgSystemFolders`, `logAudit`, `resolveSystemActor` (`users` `take(200)`, 35-43).
- **`triage.ts` (120 lignes, "use node") : exclu en V1.** `callGemini`, `resolveProviderApiKey` (39), `aiActivityLog` qui exige un `orgId` (66-67).
- **`triageModel.ts` (146 lignes, pur) : tel quel en option V2.**

### `socle/convex/lib/uploadPolicy.ts` (399 lignes)

**Imports :** `_generated` (types), `./errors`.

**Exports :** `UPLOAD_USAGES` (85-221), `UploadUsage`, `DeclaredUpload`, `StoredUpload`, `guardUploadUrl` (254), `normalizeMimeType` (272), `isMimeAllowedForUsage` (280), `normalizeSha256` (290), `assertStoredUpload` (315-383), `tryStoredUpload` (390).

**Accroches administration :** usages administration (`justificatif`, `document_officiel`, `piece_correspondance`, `piece_ichat`, `enregistrement_egress`, `lecture_ia`, `corpus`, `signature`, `dossier_rh`, `dossier_startup_cgi`, `piece_cns`, lignes 89-220). Miroir client cité aux lignes 63-67.

**Dette**
- Repli sur le type MIME déclaré quand le stockage n'en porte pas (339-340).
- `media_social` (113-117) exclut le GIF, que le réseau accepte. Le réseau contourne donc cette politique (`reseauPersonnel/media.ts:118-123`).
- `reseauPersonnel/media.ts:193-198` appelle `generateUploadUrl` sans limitation de débit.

**SORT : à adapter** (usages `avatar`, `page_logo`, `page_banner`, `album_image`, `media_social` unifié). Cible : `convex/lib/uploadPolicy.ts`.

---

## E. Notifications

### `socle/convex/lib/notify.ts` (233 lignes)

**Imports :** `_generated` (types), `./constants` (type `NotificationType`).

**Exports :** `NOTIFICATION_TITLE_MAX` (35), `NOTIFICATION_BODY_MAX` (36), `NOTIFICATION_RELATED_TYPES` (46-82, liste administration), `asRelatedType` (87), `NotifyInput` (94), `normalizeNotificationLink` (117), `notifyUser` (139), `notifyUsers` (189), `markRelatedRead` (214, borné à 200).

**Dette :** pas de push (140-141) ; `/my-space` cité en commentaire (14).

**SORT : à adapter** (personId, networkId, types sociaux, planification du push). Cible : `convex/modules/notifications/notify.ts`.

### `socle/convex/schemas/notifications.ts` (49 lignes)

- Import : `lib/validators` (`notificationTypeValidator`, défini à la ligne 1645). L'enum `NotificationType` (`lib/constants.ts:328`) ne contient aucun type social.
- Champ `userId` (14).
- Index : `by_user` (42), `by_user_unread` (43), `by_user_created` (44), `by_userId_and_dedupKey` (45), `by_isRead_and_readAt` (48), `by_isRead_and_createdAt` (49).
- API associée hors liste : `functions/notifications.ts` (600 lignes), exposant `list`, `getUnreadCount`, `listRecent`, `markAsRead`, `markAllAsRead`, `createNotification` (464-574).
- **SORT : à adapter.** Cible : `convex/modules/notifications/tables.ts`.

### `socle/convex/actions/push.ts` (181 lignes, "use node")

- Imports : `web-push` (^3.6.7), `_generated/server`, `_generated/api`.
- Exports : `sendPushNotification` (85, internalAction), `sendPushToMany` (155).
- Dette :
  - bouchon sans clés VAPID (95-98) ;
  - `VAPID_SUBJECT` d'exemple administration.ga (12) ;
  - libellés « [SPRINT6] » (96, 144) ;
  - `sendPushToMany` lance un `runAction` séquentiel par utilisateur (166-178).
- **SORT : à adapter.** Cible : `convex/modules/notifications/push.ts`.

### `socle/convex/schemas/pushSubscriptions.ts` (24 lignes)

- Champ `userId` (11). Index `by_user` (23), `by_endpoint` (24).
- **SORT : à adapter** (personId). Cible : `convex/modules/notifications/tables.ts`.

### `socle/convex/functions/pushSubscriptions.ts` (133 lignes)

**Imports :** `_generated/server`, `lib/customFunctions`.

**Exports :** `subscribe` (17), `unsubscribe` (61), `listMySubscriptions` (80), `getSubscriptionsForUserInternal` (95), `markSubscriptionUsedInternal` (105), `deleteSubscriptionInternal` (112), `incrementSubscriptionFailureInternal` (121, `MAX_FAILURES_BEFORE_DELETE=5` ligne 119).

**Dette**
- `.collect()` non bornés (86, 101).
- `subscribe` réassocie un endpoint existant à l'appelant (34-41).
- Clés renvoyées au client (83-87).
- Pas de validateur `returns`, pas de contrôle d'URL, pas de limitation de débit.

**SORT : à adapter.** Cible : `convex/modules/notifications/pushSubscriptions.ts`.

### `socle/convex/crons/notificationsRetention.ts` (227 lignes)

**Exports :** `READ_RETENTION_DAYS=180` (33), `UNREAD_RETENTION_DAYS=365` (34), `RETENTION_PASSES` (38-43), `retentionDryRun` (64-68), `run` (71), `purgePass` (91). Cron `notifications-retention`, déclaré à `crons.ts:375-380`, lui-même sous `if (opsCronsEnabled())`.

**Dette :** la purge tourne à blanc tant que `NOTIFICATIONS_RETENTION_DRY_RUN` ne vaut pas exactement `false` (15-20, 64-68). Les passes `social_*` portent sur `reseauPersonnel_notifications` (152-189).

**SORT : à adapter.** Cible : `convex/modules/notifications/retention.ts`.

### `socle/convex/modules/icom/notifyFanout.ts` (178 lignes)

- Imports : `lib/constants`, `lib/notify`.
- Exports : `ICOM_FANOUT_BATCH_SIZE=150` (47), `ICOM_FANOUT_BODY_EXCERPT_MAX` (50), `fanoutAnnounce` (52), `fanoutReminder` (112).
- Accroches administration : `icomChannelMembers`, `memberships`, `icomMessageReads`, lien `/?icom=canal:` (80, 158).
- Dette : un `ctx.db.get` par membre (74, 141). Aucun test ne cible directement `fanoutAnnounce`/`fanoutReminder` (couverture indirecte par `tests/icomChannels.test.ts`).
- **SORT : patron** (pagination de 150 auto-replanifiée, notification par la porte unique, clé de déduplication, aucune écriture sur le document parent). Cible : `convex/modules/notifications/fanout.ts`.

### `socle/convex/modules/icom/autoEnroll.ts` (140 lignes)

- Imports : `reseau/graphGuards`, `./access`.
- Exports : `ICOM_ENROLL_BATCH_SIZE` (40), `enrollAnnounceChannel` (50), `enrollMembershipInAnnounceChannels` (106).
- **SORT : patron** (inscription paginée et chaînée, réactivation plutôt qu'une seconde insertion).

---

## F. Effacement

### `socle/convex/crons/dataSubjectErasure.ts` (566 lignes)

**Imports :** `convex/values`, `convex/server`, `_generated/*` (dont `components`), `ai/iastedRetentionPolicy`, `lib/accountErasure`.

**Exports :** `TRACE_MAX_STEPS` (100), `TraceCounts` (111), `EMPTY_TRACE_COUNTS` (113), `eraseTraceStep` (259), `purgeExpiredDeletions` (275), `eraseUserData` (329), `eraseDeletedAccountTrace` (532).

**Ce qu'il efface aujourd'hui**
- Étape 0 : `iastedWorkEvents`, `iastedWorkSessions`, `iastedConversationMessages`, `iastedConversations`, `conversations` (170-248).
- `profiles` et `childProfiles` (370-377, 410-411).
- `documents` et leurs blobs (389-405).
- `cv`, `userVoicePrints`, `aiRealtimeSessions` (428-430).
- `demandeursEmploi` (433-438).
- Anonymisation de `users` (443-458).
- Comptes Better Auth : `session`, `account`, `user` (463-482).
- Une ligne `auditLog` (485-492).

**Dette**
- `.collect()` non bornés (373, 377, 392, 424, 436).
- Blobs supprimés sans vérifier s'ils sont partagés, et lignes `fileGuard_scans` laissées en place (396).
- `as any` (471, 479).

**SORT : patron** (étapes bornées auto-replanifiées, contrôle à chaque étape, audit des comptages). Cible : `convex/modules/people/erasure.ts`.

### `socle/convex/lib/accountErasure.ts` (50 lignes)

- Imports : `_generated/dataModel`, `./errors`.
- Exports : `ERASED_ACCOUNT_NAME` (26), `erasedAccountEmail` (29), `isErasedAccount` (38), `erasedAccountRefusal` (45).
- **SORT : à adapter** (persons). Cible : `convex/modules/people/accountErasure.ts`.

---

## G. Limitation de débit

### `socle/convex/ai/rateLimiter.ts` (553 lignes)

**Import :** `@convex-dev/rate-limiter` (^0.3.2, composant déclaré à `convex.config.ts:11`).

**Exports :** constantes (18-33) et `rateLimiter` (35-553).

**Seaux utiles au moteur**
- Direct (343-381) : `directComment` 10/min capacité 4, `directReaction` 20/min capacité 6, `directAntennaRequest` 4/min capacité 2, `directAntennaInvite` 12/min capacité 4. Clé `String(userId)`, consommés par `modules/direct/comments.ts:81`, `reactions.ts:50`, `antenna.ts:273` et `:413`.
- Authentification (383-418) et accès démo (419-446).
- Webhooks entrants (457-494).

**Dette :** aucun seau pour connexions, pages, albums, abonnements push ou dépôts.

**SORT : à réécrire** (seaux sociaux, `RATE_LIMITED`). Cible : `convex/lib/rateLimiter.ts`.

### `socle/convex/functions/authRateLimit.ts` (136 lignes)

**Imports :** `convex/values`, `_generated/server`, `ai/rateLimiter`.

**Exports (10 internalMutation) :** `checkLoginRateLimit` (11), `checkOtpSendRateLimit` (20), `checkPinVerifyRateLimit` (29), `checkDevSigninRateLimit` (38), `checkOttGenerateRateLimit` (47), `checkDemoAccessRequestRateLimits` (56), `checkDemoAccessVerifyRateLimits` (75), `checkCorrespondanceInboundRateLimit` (98), `checkNdjobiInboundRateLimit` (118), `checkNdjobiCarburantInboundRateLimit` (130).

**Appelants :** `http.ts` (664, 865, 1086, 1716, 3172, 3387), `betterAuth/auth.ts:440-441`, `modules/demoAccess/accessNode.ts` (126, 203).

**Dette :** unités incohérentes (`retryAfter` en millisecondes contre `retryAfterSeconds`), pas de validateur `returns`.

**SORT : patron** (helper de seau IP pour l'inbox de fédération). Cible : `convex/lib/rateLimit.ts`.

---

## H. Tests

« Admin » signifie que le test amorce ou appelle des tables administration.

### H.1 Graphe et fédération (7 tests, 2 302 lignes, 85 cas)

| Test | Lignes | Cas | Env | Imports et dépendances |
|---|---:|---:|---|---|
| tests/reseauConnections.test.ts | 610 | 22 | edge-runtime | `testConvex`, `api`, `canonicalPair`/`viewConnection`. Amorce `users` et `connections`. Pas d'administration. Portable. |
| modules/reseau/graphGuards.test.ts | 177 | 16 | node | `./graphGuards`, `./enums`, `lib/moduleCodes`. Admin. |
| modules/reseau/federation.test.ts | 483 | 12 | edge-runtime | `api`/`internal`, `OrganizationType`, `CountryCode`. Amorce `orgs`, `users`, `notifications`. Appelle `functions.contactSearch.searchContacts`. Admin. |
| modules/reseau/federationProtocol.test.ts | 158 | 12 | node (pas de pragma) | Import de valeur `@workspace/federation-contracts`. Pur. Portable si le paquet suit. |
| tests/federationReseauSocial.test.ts | 352 | 5 | edge-runtime | `internal`, amorce `orgs` et `users`. Admin. |
| tests/membershipStatusRatchet.test.ts | 283 | 6 | node | Lecture de source. Admin. |
| tests/rattachementLegalRatchet.test.ts | 239 | 12 (1 `each`) | node | `rattachementLegalCatalog`. Admin. |

### H.2 Pages (5 tests, 3 632 lignes, 86 cas)

| Test | Lignes | Cas | Env | Imports et dépendances |
|---|---:|---:|---|---|
| modules/reseauPages/pages.test.ts | 1400 | 61 | edge-runtime | Amorce `users`, `orgs` (modules `news`), `memberships` (accord `communication.publish`, ligne 100). Appelle `reseauPersonnel` (`posts`, `marks`, `notifications`, `connections`). Admin lourd. |
| modules/reseauPages/followedUpdates.test.ts | 196 | 3 | edge-runtime | `makeFunctionReference`. Amorce `users`, `orgs`, `reseauPages_pages`, `reseauPages_follows`, `reseauPersonnel_posts`. |
| tests/attachmentGateRatchet.test.ts | 134 | 2 | node | Lecture de source. Portes albums (42) et pages (71). Règle ADR-0087. |
| tests/membershipScopeRatchet.test.ts | 1571 | 14 | node | AST `typescript`. Vérificateurs reconnus `requireActivePageByHandle` (641) et `assertCanPublishOnPage` (646). Patron. |
| tests/reseauPlatformActsAudit.test.ts | 331 | 6 | edge-runtime | `UserRole`. Amorce `users`, `orgs`, `memberships`. Vérifie les lignes `auditLog`. |

### H.3 Albums (2 tests, 1 137 lignes, 57 cas)

| Test | Lignes | Cas | Env | Imports et dépendances |
|---|---:|---:|---|---|
| modules/reseauAlbums/albums.test.ts | 792 | 25 | edge-runtime | Amorce `users`. Appelle `reseauPersonnel.people.publishMyProfile`, `connections.requestByHandle`/`respond`, `reseau.connections.block`. |
| modules/reseauAlbums/domain.test.ts | 345 | 32 | node | Pur. |

`albums.test.ts` ne teste ni la retenue fileGuard ni les orphelins : le cas 684-703 vérifie seulement que `getAlbum` rend `null`.

### H.4 Fichiers (19 tests, 5 032 lignes, 169 cas)

| Test | Lignes | Cas | Env | Imports et dépendances |
|---|---:|---:|---|---|
| fileGuard/avProviders.test.ts | 74 | 6 | node | Pur. |
| fileGuard/fileGuard.test.ts | 443 | 17 | edge-runtime | `jszip`, `lib/dsi`, `lib/roles`, `./admission`, `./storageGuard`. Amorce `documents`, `memberships`, `orgs`, `positions`, `users`. Passe par `functions.documents.getUrls`. Verrouille le fail-open (195-219). Admin. |
| fileGuard/inspect.test.ts | 255 | 20 | node | `jszip`. Pur. |
| fileGuard/notify.doublePoste.test.ts | 289 | 2 | edge-runtime | Amorce `directoryEntries`, `positionAssignments`, `positions`, `memberships`, `orgs`, `fileGuard_scans`, `users`. Admin. |
| fileGuard/policy.test.ts | 74 | 7 | node | Pur. Verrouille « absence = servable » (15-20). |
| fileGuard/queries.rapport.test.ts | 262 | 6 | edge-runtime | `tests/blobAdoption.setup` (`users`, `orgs`, `memberships`), `positions`. Admin. |
| fileGuard/triageModel.test.ts | 47 | 4 | node | Pur. |
| fileGuard/verdict.test.ts | 53 | 5 | node | Pur. |
| tests/fileGuardGateRatchet.test.ts | 93 | 3 | node | Lecture de source. Liste blanche GATED. |
| tests/freshUploadRatchet.test.ts | 109 | 3 | node | Lecture de source. |
| tests/storageArgFreshnessRatchet.test.ts | 349 | 3 | node | AST `typescript`. |
| tests/chatsAttachmentsAdmission.test.ts | 207 | 3 | edge-runtime | `chats`, `memberships`, `orgs`, `positions`. Admin. |
| tests/chatsAttachmentsAdoption.test.ts | 762 | 14 | edge-runtime | `chats`, `documents`, `memberships`, `orgs`, `users`. Utilise aussi `connections` comme fixture. Admin. |
| tests/rhDossierLectureSentinelle.test.ts | 435 | 13 (3 `each`) | edge-runtime | `fpDossierPieces`. Admin. |
| tests/rhPiecesFreshness.test.ts | 642 | 6 | edge-runtime | Tables fp/ecole. Admin. |
| tests/aiCostUnit.test.ts | 254 | 28 | node | N'importe que `FILE_SECURITY_TRIAGE_MODEL`. Hors sujet. |
| tests/iastedLanguageContractCoverage.test.ts | 272 | 5 | node | Ne cite que `triage*.ts`. Hors sujet. |
| tests/uploadPolicy.test.ts | 253 | 20 | node | Pur. Portable après réduction des usages. |
| tests/uploadPolicyRatchet.test.ts | 159 | 4 | node | `uploadPolicyRatchet.exceptions.json` (`reseauPersonnel/media.ts` en exception, ligne 52). |

### H.5 Notifications (8 tests, 3 417 lignes, 105 cas)

| Test | Lignes | Cas | Env | Imports et dépendances |
|---|---:|---:|---|---|
| crons/notificationsRetention.test.ts | 142 | 4 | edge-runtime | Amorce `notifications`, `reseauPersonnel_notifications`, `users`. Portable. |
| tests/notifications.test.ts | 261 | 8 | edge-runtime | Seul test qui importe réellement `lib/notify`. Amorce `users`. Portable. |
| tests/notificationsWriterRatchet.test.ts | 126 | 5 | node | Lecture de source. Patron. |
| tests/notifyResidualWriters.test.ts | 221 | 4 | edge-runtime | `documents`, `memberships`, `orgs`. Admin. |
| tests/chatsMessagerie.test.ts | 724 | 21 | edge-runtime | Job `actions/push:sendPushNotification` (711). Admin. |
| tests/scheduledDrain.test.ts | 340 | 16 | edge-runtime | Bouchon push (58, 97, 127, 215). Utile. |
| tests/voicemails.test.ts | 206 | 3 | edge-runtime | Job push (181). Admin. |
| tests/icomChannels.test.ts | 1397 | 44 | edge-runtime | `autoEnroll`, couvre le fanout indirectement. Admin. |

### H.6 Effacement (4 tests, 2 279 lignes, 41 cas)

| Test | Lignes | Cas | Env | Imports et dépendances |
|---|---:|---:|---|---|
| tests/dataSubjectErasure.test.ts | 587 | 8 | edge-runtime | Tables iAsted et `orgs`. |
| tests/dataSubjectErasureResidue.test.ts | 471 | 7 (1 `each`) | edge-runtime | Tables iAsted et `orgs`. |
| tests/dataSubjectErasureTrash.test.ts | 471 | 13 | edge-runtime | Tables iAsted. |
| tests/accountDeletionIastedTrace.test.ts | 750 | 13 | edge-runtime | Schéma Better Auth lu dans `node_modules` ; tables iAsted et `orgs`. |

Aucun de ces tests n'est social. `lib/accountErasure.ts` n'est importé par aucun test (couverture indirecte seulement).

### H.7 Limitation de débit (1 test, 89 lignes, 4 cas)

| Test | Lignes | Cas | Env | Imports et dépendances |
|---|---:|---:|---|---|
| functions/authRateLimit.test.ts | 89 | 4 | edge-runtime | `@convex-dev/rate-limiter/test`. Ne couvre que l'accès démo et `ndjobiInbound`. |

Seaux du direct testés hors module :
- `modules/direct/direct.test.ts` (1 561 lignes, 50 cas) : `directComment` aux lignes 976-994.
- `modules/direct/antenna.test.ts` (1 390 lignes, 26 cas) : `directAntennaRequest` à la ligne 222.
- `directReaction` et `directAntennaInvite` ne sont pas testés.

Les 23 tests de tests/ qui enregistrent le composant rate-limiter portent sur l'IA et sont exclus.

### H.8 Consommateurs hors périmètre (non détaillés)

- **Connexions :** une trentaine de fichiers utilisent `connections` comme fixture :
  - `modules/direct/*` (12) ;
  - `modules/reseauPersonnel/*` (12) ;
  - `messagerieScope/transfert`, `migrations/resolveSettledInvitations`, 2 seeds.
- **fileGuard :** 57 tests d'adoption en administration :
  - `functions/*` (31) ;
  - `migrations/*` (7) ;
  - autres modules (19), dont `reseauPersonnel/media.adoption.test.ts`, qui couvre aussi `verifyDeclaredMedia` côté albums.

---

## I. Ordre de duplication proposé

1. **Fondations `convex/lib`** :
   - `errors` avec un code `RATE_LIMITED` ;
   - `rateLimiter` (seaux sociaux) et `rateLimit` (helpers de contrôle) ;
   - `uploadPolicy` réduit aux usages sociaux ;
   - `accountErasure`.
2. **`modules/files`**, dans cet ordre :
   - fichiers purs : `policy` (fail-closed), `verdict`, `inspect` (copie binaire), `avProviders` ;
   - stockage : `tables`, `storageGuard` ;
   - admission : `admission`, `posedUploads` ;
   - traitement : `scan`, `mutations` (sans quarantaine), `queries`, crons `retryStale` et purge corrigée.
3. **`modules/notifications`** :
   - tables `notifications` et `pushSubscriptions` ;
   - `notify` avec push planifié, `push`, `pushSubscriptions` ;
   - `fanout`, `retention`.
4. **`modules/graph`** : `enums`, `tables`, `connections` réécrit.
5. **Prérequis hors de mon périmètre, bloquants pour pages et albums**, à cadrer d'abord :
   - équivalents de `reseauPersonnel_posts`/`writePersonalPost` ;
   - `verifyDeclaredMedia`, `miniProfileCache`/`findPublishedPersonByHandle` ;
   - helpers de graphe (`isConnectedTo`, `isBlockedBetween`) ;
   - `requireMembership`, qui remplace `assertNotSuspended`, `assertCanDoTask` et `validatedOrgIds`.
6. **`modules/pages`** :
   - `validators`, `tables` (avec signataires), `domain`, `follows` ;
   - `access` (identité propre et `servableUrl`) ;
   - `pages`, `admin`/`signatories`, `followedUpdates`.
7. **`modules/albums`** : `validators`, `domain`, `tables`, `access`, `albums` (purge en cascade).
8. **`modules/federation`** : `tables`, `protocol` (avec signature), `inbox`, `http` signé avec seau IP, `replay`.
9. **`modules/people/erasure`** couvrant toutes les tables sociales (§L), puis les cliquets :
   - délivrance de fichiers en liste noire / tous fichiers ;
   - écrivains de notifications ;
   - fraîcheur des dépôts ;
   - portée d'appartenance au réseau.

---

## J. Tables et index

| Table actuelle | Index | Pour le moteur |
|---|---|---|
| `connections` | `by_pair`, `by_low_status`, `by_high_status` | Préfixer par `networkId` ; ajouter un index pour l'effacement (demandeur, bloqueur) |
| `reseauPages_pages` | `by_org`, `by_handle`, `by_status_and_activatedAt`, `by_status_and_followerCount`, recherche `search_name_v1` (filtre `status`) | Retirer `by_org` ; `by_network_handle` ; filtre de recherche `[networkId, status]` |
| `reseauPages_follows` | `by_follower_and_page`, `by_follower_and_createdAt`, `by_page_and_createdAt` | Passer en personId |
| Signataires de page | n'existe pas | Table neuve : `by_page_person`, `by_person` |
| `reseauAlbums_albums` | `by_owner_status_updatedAt`, `by_owner_and_updatedAt`, `by_owner_and_idempotencyKey` | Passer en personId |
| `reseauAlbums_items` | `by_album_and_position`, `by_album_and_idempotencyKey` | Ajouter `by_owner` |
| `fileGuard_scans` | `by_storageId`, `by_status_updatedAt`, `by_org_status`, `by_sha256` | `by_network_status` ; ajouter `by_uploader` |
| `notifications` | 6 index (schemas/notifications.ts:42-49) | Passer en personId |
| `pushSubscriptions` | `by_user`, `by_endpoint` | Passer en personId |
| `federationInboxReceipts` | `by_receiptKey`, `by_eventId` | Patron |
| `federationDeadLetters` | `by_eventId_consumer`, `by_destination_status` | Patron |
| `federationReplayAudit` | `by_eventId`, `by_replayId` | Patron |

Aucune de ces tables n'a de trigger ; l'audit automatique (`triggers/index.ts:568-643`) ne les concerne pas.

---

## K. Totaux

**Sources inventoriées : 11 327 lignes**

| Bloc | Lignes |
|---|---:|
| Graphe : connections, enums, tables, graphGuards | 1 075 |
| Fédération | 746 |
| Pages | 1 645 |
| Albums | 1 388 |
| fileGuard | 3 604 |
| uploadPolicy | 399 |
| Notifications | 1 165 |
| Effacement | 616 |
| Limitation de débit | 689 |

**Exclusions listées :** 16 sources de modules/reseau, 6 243 lignes.

**Tests détaillés : 46 fichiers, 17 888 lignes, 547 cas.** Hors périmètre de comptage : `direct.test` et `antenna.test`, pour 2 951 lignes et 76 cas.

**Bilan des SORT sur les fichiers source**

| SORT | Nombre | Fichiers |
|---|---:|---|
| Tel quel | 9 | `pages/validators`, `albums/domain`, `albums/validators`, `verdict`, `inspect`, `scan`, `posedUploads`, `triageModel` (option V2), et le noyau de `federationProtocol` |
| À adapter | 23 | — |
| À réécrire | 6 | `connections`, `pages/access`, `pages/pages`, `pages/admin`, `fileGuard/notify`, `rateLimiter` |
| Patron | 6 | `federationTables`, `federation`, `notifyFanout`, `autoEnroll`, `dataSubjectErasure`, `authRateLimit` |
| Exclu | 7 | `graphGuards`, 2 manifestes, `quarantine`, `triage`, `posedImages`, et les 16 fichiers institutionnels |

---

## L. Effacement RGPD : tables sociales que `dataSubjectErasure` ne touche pas aujourd'hui

Vérifié : aucune occurrence dans `crons/dataSubjectErasure.ts`, et `IASTED_RETENTION_TABLES` (`ai/iastedRetentionPolicy.ts:42-48`) ne contient que les tables iAsted.

### Périmètre de la duplication

- `connections` : `userIdLow`, `userIdHigh`, `requestedByUserId`, `blockedByUserId`, `message`.
- `reseauPages_follows` : `followerUserId`.
- `reseauPages_pages` : `activatedByUserId`, `deactivatedByUserId`, à pseudonymiser.
- `reseauAlbums_albums` : `ownerUserId`.
- `reseauAlbums_items` : `ownerUserId`, `addedByUserId` et les blobs `media.storageId`. Sans index par propriétaire, et avec des orphelins après `remove`.
- `fileGuard_scans` : `uploadedByUserId`, `releasedByUserId`, `filename`. Sans index par déposant ; les lignes survivent même aux documents que l'effacement supprime.
- `notifications` : `userId`. Supprimée par la cascade admin, pas par le RGPD.
- `pushSubscriptions` : `userId`, `endpoint`, `keys`, `userAgent`. Même situation.
- `federationDeadLetters` : `agentName` et `agentEmail` en clair.
- `federationInboxReceipts` : `resultUserId`.
- `federationReplayAudit` : `requestedByUserId`.
- Seaux du composant rate-limiter : clés `String(userId)`.
- `auditLog` : `actorId` des actes sur les pages.

### Adjacentes sociales, hors de mon périmètre

**26 tables `reseauPersonnel_*` :**
- `profiles` (`userId`, blobs avatar et couverture) ;
- `posts` (`authorUserId`, `mentionedUserIds`, blobs) ;
- `postReactions` ;
- `postComments` ;
- `contentReports` ;
- `follows` ;
- `notifications` (`recipientUserId`, `actorUserId`) ;
- `postMarks` ;
- `mutes` ;
- `stories` (blobs) ;
- `storyViews` ;
- `groupThreads` (blob avatar) ;
- `groupMembers` ;
- `groupInvites` ;
- `groupInviteLinks` ;
- `groupMessages` (blobs, `deletedForUserIds`) ;
- `groupMessageReactions` ;
- `groupTyping` ;
- `thematicGroups` ;
- `thematicGroupMembers` ;
- `thematicGroupInvites` ;
- `events` ;
- `eventParticipants` ;
- `unreadTotals` ;
- `suggestionDismissals` ;
- `postAggregateBackfills` (aucun champ utilisateur).

**12 tables `direct_*` :**
- `sessions` (blobs de rediffusion et sous-titres) ;
- `speakers`, `viewer_grants`, `antenna_requests`, `antenna_invitations` ;
- `bans`, `delegations`, `invitees`, `chat_mutes` ;
- `comments`, `reactions`, `host_presence`.
