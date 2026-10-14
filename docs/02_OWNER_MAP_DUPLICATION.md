---
title: "ANTIA — Owner map de duplication : du socle administration.ga au moteur social"
version: "1.0"
date: "2026-10-14"
statut: "Livrable de PA1 (lecture seule du socle) ; ordre de marche de PA3 (backend) et de PA6 (front)"
projet: "ANTIA"
source: "socle administration.ga, origin/main = ad2e7fdc2 (fusion de la PR 772, 09/10/2026), copie propre par git worktree add"
dependances:
  - "docs/00_CAHIER_DES_CHARGES_ANTIA.md"
  - "docs/01_PLAN_IMPLEMENTATION_PROMPTS_ANTIA.md (§3 table de correspondance, PA1, PA3, PA6)"
  - "Documentation/RESEAUX_SOCIAUX/annexes/A_* et B_* (inventaire du 14/10, que ce document contredit là où il le faut)"
  - "docs/02_annexes/A1 à A6 (les six inventaires complets, à la ligne près)"
---

# ANTIA — Owner map de duplication

> **Commit du socle lu : `ad2e7fdc2`** (`origin/main`, fusion de la PR 772 du 09/10/2026), dans une copie
> propre créée par `git worktree add` — jamais l'arbre de travail partagé, en retard et modifié.
> Revérifié le 14/10/2026 au soir par `git fetch` : `origin/main` n'a pas bougé (0 commit après `ad2e7fdc2`).
>
> **Méthode** (PRO.GA `docs/12` §0.2) : six inventaires contradictoires menés en parallèle, en lecture seule,
> par des sous-agents Opus ; volumes par `wc -l` (ligne `total`) ; imports remontés par `grep` ; écran
> rattaché à son backend par `grep -rhoE "api\.[a-zA-Z0-9_.]+"` ; chaque passage cité relu. Les rapports
> complets, ligne à ligne, sont les **annexes A1 à A6** (`docs/02_annexes/`). Ce document en est la
> synthèse décisionnelle : pour chaque module, ce qui est copié, d'où, vers où, sous quel sort, dans quel
> ordre, avec quels tests et quelles corrections. Quand il diffère d'une annexe, **il fait foi**.
>
> | Annexe | Périmètre |
> |---|---|
> | [A1](02_annexes/A1_BACKEND_NOYAU_RESEAU_PERSONNEL.md) | backend — noyau de `reseauPersonnel` : profils, publications et fil, engagement, graphe, marques, notifications, modération, médias, domaine pur |
> | [A2](02_annexes/A2_BACKEND_GROUPES_EVENEMENTS_STORIES_MESSAGERIE.md) | backend — groupes, groupes thématiques, évènements, stories, suggestions, messagerie personnelle |
> | [A3](02_annexes/A3_BACKEND_GRAPHE_PAGES_ALBUMS_FICHIERS_NOTIFICATIONS_FEDERATION.md) | backend — connexions (`modules/reseau`), pages, albums, garde des fichiers, notifications et push, fédération, effacement, limitation de débit |
> | [A4](02_annexes/A4_BACKEND_APPELS_LIVEKIT_DIRECT.md) | backend — appels personnels (`iappel`, `meetings`, présence), LiveKit et Egress, direct |
> | [A5](02_annexes/A5_FRONT_RESEAU_PERSONNEL_ALBUMS.md) | front — `reseau-personnel` et `reseau-albums` |
> | [A6](02_annexes/A6_FRONT_MESSAGERIE_APPELS_DIRECT_STORIES_NOTIFICATIONS_COQUE.md) | front — messagerie, iappel, direct, stories, notifications, primitives, coque, paquets |

---

## 0. Conventions

### 0.1 Les sorts

| Sort | Sens |
|---|---|
| **tel quel** | Copie textuelle ; ne changent que les adaptations mécaniques du §0.2. |
| **à adapter** | Logique conservée ; gardes, clés, identités, libellés changent (liste fermée du préambule de PA3). |
| **à simplifier** | À adapter **en retirant des branches entières** (poste, organisation, file d'appels, iRéunion, priorité). Variante d'« à adapter », comptée avec lui. |
| **à réécrire** | Refonte : le fichier du socle sert de spécification, ses tests de preuve de parité. |
| **patron** | On reprend une forme (idempotence, lots chaînés, lettres mortes, audit), pas le code. |
| **exclu** | Administratif : non dupliqué. |

Front seulement : **TQ\*** = tel quel avec une branche `scope === "poste"` inerte ; ANTIA l'élague **dans le même
commit que la copie** (aucune notion de poste dans le moteur).

### 0.2 Adaptations mécaniques (valables partout, jamais répétées ensuite)

- Identité : `v.id("users")` → `v.id("persons")` ; `ctx.user._id` → `ctx.person._id` ; noms tirés de `persons`
  (handle, `displayName`), jamais de l'état civil `users.firstName/lastName`, jamais de l'e-mail.
- Constructeurs : `authQuery`/`authMutation` (socle `lib/customFunctions`) → `networkQuery`/`networkMutation`
  (garde `requireMembership(ctx, networkId, minStatus)` en tête), `personQuery`/`personMutation` (fonctions sur
  soi, marquées `@selfScoped`), `operatorQuery`/`operatorMutation` (console) — tous dans `convex/lib/functions.ts`
  (PA2). `backofficeQuery`/`superadmin*` → opérateur ou rôle de réseau (`network_moderator`, `network_admin`).
- Gardes : `assertNotSuspended` (délai de rattachement de 72 h, ADR-0087 du socle) → statut d'adhésion minimal ;
  `isPublicUser` → statut d'adhésion ; `validatedOrgIds`, `colleagueUserIds`, `resolvePostIdentities` → facettes du
  réseau (`personFacets`) ou rien ; `communication.publish` → rôle de signataire de page.
- `networkId` sur chaque table sociale et chaque ligne ; toute lecture « mes … », toute découverte et tout index de
  recherche sont préfixés ou filtrés par `networkId` (`filterFields`).
- Erreurs : `ReseauPersonnelViolation`, `ReseauAlbumsViolation`, `throw new Error`, libellés français en dur →
  codes `ENGINE_ERROR_CODES` (`@antia/social-contracts/errors`) levés par `fail()` ; le texte vit dans les
  locales fr/en de l'écran.
- `Date.now()` est interdit dans une query (paramètre `now` arrondi passé par l'écran, ou état posé par une mutation
  planifiée) ; toléré dans les mutations.
- Délivrance : tout `ctx.storage.getUrl` passe par `servableUrl` de `convex/modules/files/storageGuard.ts`.
- Front : `@convex/_generated/api` → références typées de `@antia/api` ; `import type { Id }` → alias de
  `@antia/social-contracts` ; le réseau courant vient de `useNetwork()`, les adresses de `useRoutes()` ; toute chaîne
  d'interface passe en clé i18n (fr, en).
- En-tête de provenance, première ligne de chaque fichier copié :
  `// Dupliqué de <chemin> @ ad2e7fdc2 — adaptations : …` (cliquet `provenance-headers`).
- Manifestes : ceux du socle (`manifest.ts`, concept de tranche ADR-0004 avec routes `/espace` et codes de tâche)
  sont exclus ; chaque module du moteur porte un `manifest.ts` écrit à neuf (tables, dépendances, seaux de débit).

### 0.3 Cibles

| Abréviation | Chemin dans ANTIA |
|---|---|
| `M/<module>/` | `convex/modules/<module>/` |
| `L/` | `convex/lib/` |
| `SD/` | `packages/social-domain/src/` (règles pures, importables par le backend et le front) |
| `SC/` | `packages/social-contracts/src/` (types, constantes et modules purs partagés front/back, erreurs, i18n serveur) |
| `SF/f/<tranche>/` | `packages/social-features/src/features/<tranche>/` |
| `SF/shell/` | `packages/social-features/src/shell/` (coque légère) |
| `UI/`, `API/` | `packages/ui/src/`, `packages/api/src/` |

---

## 1. Ce que l'inventaire contredit (à lire avant PA3)

1. **Le domaine pur est plus petit que prévu.** `docs/01` §3 et PA2 annoncent huit modules « tel quel » vers
   `social-domain`. Mesuré : `searchText` et `handleSuggestion` passent tels quels ; `domain.ts` est pur mais porte du
   vocabulaire administratif (audience « organisation », portée « mon_administration », raisons « collegue » et
   « page », scope « poste », libellés iRéseau/iCom) : à adapter ; `feedScale` et `connectionState` n'importent qu'un
   type de `_generated` : adaptation triviale. `validators.ts` (`convex/values`), `counters.ts` et
   `contentRemoval.ts` (contexte Convex) **restent côté backend**. PA2 porte donc cinq modules, pas huit.
2. **`reseau/connections.ts` n'est pas « tel quel + découvrabilité ».** Identité `users`, aucune limitation de
   débit, message non borné, garde de suspension seulement dans l'enveloppe `reseauPersonnel/connections.ts`, et
   **fuite du blocage** : le bloqué reçoit `status: "blocked"` (`connections.ts:179-186`) ; le test qui devait
   l'empêcher n'affirme rien (`tests/reseauConnections.test.ts:342-363`). → **à réécrire**.
3. **Les albums ne sont pas « tel quel ».** `getUrl` brut (une photo `pending` ou `infected` est servie),
   `remove` laisse des orphelins (items seulement marqués, rien au-delà de 240, blobs et lignes d'analyse jamais
   purgés, aucun index par propriétaire donc introuvables à l'effacement), lectures N+1 jusqu'à 5 760 items par
   page. → à adapter (lourd).
4. **La garde des fichiers n'est pas fail-closed.** Un blob sans ligne d'analyse est servable
   (`fileGuard/policy.ts:121-125`, `storageGuard.ts:9-11`), comportement verrouillé par deux tests ; le
   coupe-circuit `FILE_GUARD=off` fait naître des lignes servables ; l'antivirus par défaut est un bouchon qui ne
   reconnaît qu'EICAR, et un fournisseur inconnu y retombe. **Le moteur inverse : absence de ligne = retenue.**
5. **Le cliquet `fileGuardGateRatchet` du socle est une liste blanche** : 21 appels `ctx.storage.getUrl` bruts du
   périmètre social lui échappent (`people.ts` ×8, `follows.ts` ×1, `stories.ts` ×3, `groupes.ts` ×4,
   `suggestions.ts` ×1, `reseauPages/access.ts` ×2, `reseauAlbums` ×2). Le moteur pose le cliquet inverse : tout
   `getUrl` hors de `files/storageGuard.ts` est rouge.
6. **Aucune limitation de débit** sur la centaine de mutations sociales (profils, publications, engagement,
   connexions, abonnements, groupes, thématiques, évènements, stories, messagerie, pages, albums, appels,
   téléversements) ; seules les quatre du direct en ont. Le moteur la pose partout (seaux prêts depuis PA2, cliquet
   `rate-limited-writes` en PA5).
7. **Garde de suspension inégale** : présente dans thématiques, suggestions, messagerie, transfert et
   `chats.sendMessage` ; **absente** de `groupes.ts`, `evenements.ts`, `stories.ts`, `media.generateUploadUrl`,
   `moderation.report*`. `requireMembership` dans les constructeurs l'uniformise (cliquet `network-scoped-functions`).
8. **Le blocage n'est jamais vérifié à l'écriture** dans `functions/chats.ts` (un correspondant bloqué écrit encore
   dans un fil existant, seulement masqué à la lecture), ni pour les invités d'un appel de groupe ad hoc
   (`groupCalls.ts:694-713`, `:838-850`).
9. **Notifications dans la transaction de l'émetteur** : `notifyPersonal` (lecture, écriture et garde par
   destinataire) appelé en boucle par `sendGroupMessage` et `createGroup` (jusqu'à 999 membres), `comment` (≈ 112
   écritures), le transfert. → diffusion par lots chaînés planifiés (patron `icom/notifyFanout`).
10. **Compteurs écrits sur des documents chauds** : `reactionCount(s)`, `commentCount`, `shareCount` (publications),
    `memberCount` (groupes, thématiques), `participantCount`/`acceptedCount` (évènements), `viewCount` (stories),
    `followerCount`/`postCount` (pages), `participants` (appels), `viewerGrantCount`/`viewerPresentCount` (direct),
    `lastMessage*` (fils). → compteurs fragmentés et agrégats (composant `aggregate`, instance `engineCounters`,
    déclaré depuis PA0) ; l'engagement n'écrit plus le document parent.
11. **`Date.now()` dans des queries** (`stories.ts` ×3, `groupes.ts`, `functions/chats.ts`) : la réactivité ne se
    rejoue pas à l'expiration, contrairement à la doctrine écrite dans `evenements.ts:660-661`.
12. **Lectures sans index, tronquées en silence ou qui lèvent** : `suggestions.paginate` (balaie tous les profils),
    `follows.suggestions`, découverte des thématiques (`order("desc").take(30)` et index de recherche **sans
    `filterFields`** : dans un moteur multi-réseaux, c'est une **fuite entre réseaux**), « N plus anciennes
    appartenances » (`groupes.ts:776-781`, `:866-871`, `groupesThematiques.ts:1144-1149`), `listMembers` tronqué à
    100, `myBookmarks`/`myHiddenPosts` qui **lèvent** au-delà de 50, `listMine`/`listPendingForMe` qui **lèvent** au-delà
    de 200 connexions, `myNotifications` qui lève à égalité de `createdAt`, `listComments` sans pagination,
    `endStaleCalls` en `.collect()` à chaque appel, `cleanupStalePresence` borné à 500 lignes de toute la table.
13. **Push** : la messagerie pousse un aperçu du message (`body.slice(0, 120)`), et aucun évènement social ne pousse
    (la cloche sociale n'a pas de push ; `notifyUser` n'a pas de scheduler). → push social **sans contenu** (PA5).
14. **La fédération n'a ni inbox HTTP ni signature** (`ingest` et `replay` sont internes, sans appelant en
    production) et sa file de lettres mortes garde nom et e-mail d'agent en clair. → patron seulement ; inbox HTTP
    signée (HMAC ou Ed25519, horodatage, seau IP) écrite à neuf (PA5, PA9).
15. **L'effacement (`dataSubjectErasure`) ne touche aucune table sociale**, ni notifications, ni abonnements push,
    ni lignes d'analyse. → `people/erasure.ts` couvre toutes les tables du moteur (PA5).
16. **Pages : le cahier et PA6 se contredisent.** Cahier §3.1 et M-A5 : pages génériques à identité propre
    (institution, association, entreprise, média, communauté ; « Officiel » posé par décision tracée). PA6 :
    « retirer Pages = organisations ». **Décision par défaut** : le backend `pages` est **réécrit** en PA3 (identité
    propre, signataires, revendications) ; les six écrans Pages du socle (1 496 l.) **ne sont pas copiés** et sont
    réécrits sur ce backend (PA6/PA8).
17. **Deux formats téléphone se contredisent** dans le socle : iCom flottant en 390×844
    (`messagerie-styles.tsx:1220-1224`), appel flottant en 440×956 (`ui/globals.css:2692-2702`), chacun verrouillé par
    un cliquet. → format unique **440×956** (PA6) ; `messagerie-floating-contract` est réécrit.
18. **Le socle part avec `schemaValidation: false`** (`socle/convex/schema.ts:2019`) ; le moteur tient `true` depuis
    PA0. Toute fixture de test qui insère un document partiel, et tout document que le socle tolérait, échoueront :
    chaque table dupliquée est validée champ par champ (aucun `v.any()`, cliquet `no-any-validators`).
19. **Les cliquets front du socle lisent la coque et des fichiers administratifs** (`app-shell`, `IcomPosteWindow`,
    `CallCenterShell`, `IAstedContactTab`, `convex/` par chemin relatif) : ils casseront à la copie et sont réécrits
    sur la coque légère. Inversement, les cliquets génériques d'ANTIA sont **trop étroits** pour le front :
    `no-hardcoded-urls` ne voit que 6 des 39 lignes de code portant `/espace`, `no-hardcoded-strings` ne voit que le
    JSX (les constantes de texte des `.ts` lui échappent). → cliquet dédié « aucune base `/espace` » et extension aux
    `.ts` (PA6).
20. **Le réemploi front est plus bas qu'annoncé.** Annexe B : 34 % tel quel, 56 % à adapter, 10 % retiré pour
    réseau personnel et albums ; mesuré (A5) : 6 % tel quel, 69 % à adapter, 9 % à réécrire, 16 % retiré, parce que
    toute chaîne (i18n obligatoire) et toute requête (`networkId`) imposent « à adapter ». A6 compte « tel quel » la
    logique inchangée : ses taux se lisent **avant** l'i18n, qui s'applique à tout fichier portant du texte.
21. **Écarts de mesure avec les annexes A et B du 14/10** : `origin/main` n'a pas bougé, mais l'annexe B a compté
    iappel sur `d5942856c` (04/10) : +4 fichiers et +830 lignes depuis, **tous administratifs** (ADR-0213
    environnement back-office, ADR-0217 appelants prioritaires) → exclus. L'en-tête de l'annexe B annonce
    `4e1b62504`, mais ses totaux de réseau personnel sont bien ceux d'`ad2e7fdc2` (fichier `dual-pagination-pages.ts`
    compris). La dixième occurrence de `people.getMyProfile`, « non localisée » par l'annexe, est
    `use-profile-onboarding.ts:61`.

---

## 2. Carte des modules

### 2.1 Backend (PA3, sauf mention)

| Module moteur | Sources du socle (fichiers · lignes) | Sort dominant | Annexe |
|---|---|---|---|
| `people` (profil social) | `reseauPersonnel/{people, handleSuggestion}` · `lib/accountErasure` · `crons/dataSubjectErasure` (4 · 1 716) | à réécrire ; effacement en patron (PA5) | A1, A3 |
| `media` | `reseauPersonnel/media` (1 · 198) | à adapter | A1 |
| `graph` | `reseau/{connections, enums, tables, graphGuards}` · `reseauPersonnel/{graph, connections, follows, connectionState}` (8 · 2 427) | à réécrire (connexions) | A1, A3 |
| `notifications` | `reseauPersonnel/notifications` · `lib/notify` · `schemas/{notifications, pushSubscriptions}` · `actions/push` · `functions/pushSubscriptions` · `crons/notificationsRetention` · `icom/{notifyFanout, autoEnroll}` (9 · 1 664) | à adapter ; push et rétention en PA5 | A1, A3 |
| `posts` | `reseauPersonnel/{posts, postWrite, access, contentRemoval, counters, feedScale, searchText, domain, validators, tables, manifest}` (11 · 5 655) | à adapter (lourd) | A1 |
| `engagement` | `reseauPersonnel/engagement` (1 · 384) | à adapter | A1 |
| `marks` | `reseauPersonnel/marks` (1 · 390) | à adapter | A1 |
| `moderation` | `reseauPersonnel/moderation` (1 · 131) | à adapter (étendu en PA5) | A1 |
| `stories` | `reseauPersonnel/stories` (1 · 956) | à adapter | A2 |
| `suggestions` | `reseauPersonnel/suggestions` (1 · 403) | à adapter | A2 |
| `groups` | `reseauPersonnel/groupes` · `lib/groupCapacity` (2 · 3 266) | à adapter (lourd) | A2 |
| `thematicGroups` | `reseauPersonnel/{groupesThematiques, groupesThematiquesAccess}` (2 · 1 534) | à adapter | A2 |
| `events` | `reseauPersonnel/evenements` (1 · 961) | à adapter | A2 |
| `messaging` | `functions/chats` · `messagerieScope/*` (6) · `reseauPersonnel/messagerie` (+ 3 sous-fichiers) · `schemas/{chats, chatMessages, chatMessageReactions, chatTyping, messageReactions}` (16 · 5 611) | à réécrire sur le patron `openOrContinueThread` | A2 |
| `pages` | `reseauPages/*` (9 · 1 645) | à réécrire (identité propre, signataires) | A3 |
| `albums` | `reseauAlbums/*` (6 · 1 388) | à adapter | A3 |
| `files` | `fileGuard/*` · `lib/uploadPolicy` (17 · 4 003) | à adapter (fail-closed) | A3 |
| `calls` | `iappel/*` (26) · `functions/{meetings, agentPresence}` · `schemas/{meetings, agentPresence}` · `actions/livekit` · `lib/livekit{,Wake,Identity}` (34 · 14 404) | à simplifier | A4 |
| `live` | `direct/*` (23) · `actions/livekitDirect` · `lib/egress{Routing,Uploads,Webhook,FileTransfer}` · route Egress de `http.ts` (28 · ≈ 12 515) | à adapter (15 fichiers sur 23 tels quels) | A4 |
| `federation` | `reseau/{federationTables, federationProtocol, federation}` (3 · 746) | patron (PA5, PA9) | A3 |

Déjà livrés par PA2 et donc hors de cette carte : `networks`, `people` (fondations : `persons`, `identityLinks`,
`networkMemberships`, `personFacets`, `consents`, `handleHistory`), `platform` (`operators`), `L/{access, functions,
errors, rateLimit, validators}` — ces derniers remplacent `lib/customFunctions`, `lib/errors`, `ai/rateLimiter` et
`functions/authRateLimit` du socle (réécrits : seaux sociaux, code `rateLimited`).

### 2.2 Front (PA6)

| Tranche | Sources (fichiers · lignes) | Tests (fichiers · lignes · cas) | Retirés | Annexe |
|---|---|---|---|---|
| `reseau-personnel` | 105 · 29 508 | 65 · 14 178 · 957 (989 exécutés) | 15 fichiers · 5 078 l. (dont 6 Pages réécrites à neuf) | A5 |
| `reseau-albums` | 6 · 1 657 | 4 · 1 181 · 69 | — | A5 |
| `messagerie` | 67 · 17 812 | 49 · 8 138 | 3 · 455 | A6 |
| `iappel` | 83 · 15 750 | 42 · 9 941 | 11 · 2 775 | A6 |
| `direct` | 50 · 16 526 | 38 · 9 207 | — | A6 |
| `stories` | 19 · 4 761 | 6 · 1 537 | — | A6 |
| `notifications` | 16 · 2 933 | 8 · 2 470 | 8 · 1 203 | A6 |
| primitives, hôtes, stores, hooks, app espace | ≈ 7 287 l. | 1 783 l. | stores et hooks administratifs | A6 |
| paquets (`api`, `routing`, `sso`, `chat`, `i18n`, `livekit`) | ≈ 2 800 l. (hors locales) | `api` : 2 · 551 | — | A6 |

### 2.3 Totaux

- **Backend** : ≈ 158 fichiers source, **60 686 lignes** (A1 9 709 ; A2 12 731 ; A3 11 327 ; A4 26 919). À
  l'intérieur de ce périmètre sont exclus : 10 fichiers d'`iappel` (3 352 l.), 3 de `messagerieScope` (497 l.),
  ≈ 65 % de `functions/meetings.ts`, ≈ 690 l. de `functions/chats.ts`, ≈ 200 de `reseauPersonnel/messagerie.ts`,
  ≈ 170 de `groupes.ts`, et partout les branches poste, organisation, iAsted, Standard et centre d'appels. Hors
  périmètre et exclus d'emblée : 16 fichiers institutionnels de `modules/reseau` (6 243 l.) et `ireunion` (≈ 2 800 l.).
- **Tests backend** : ≈ 85 000 lignes et ≈ 2 600 cas inventoriés (avec des recouvrements entre annexes) ; à porter :
  la grande majorité des tests sociaux (détail par module au §6) ; à abandonner : ceux du poste, de l'organisation,
  d'iAsted, du Standard et du centre d'appels.
- **Front** : 346 fichiers de features, **88 947 lignes** (+ ≈ 10 000 l. de coque, stores, hooks et paquets) ;
  212 fichiers de tests, ≈ 46 650 lignes.

---

## 3. Dépendances communes (prérequis de toute tranche)

| Prérequis | Remplace, dans le socle | État au 14/10 | Où |
|---|---|---|---|
| E1 — constructeurs et `requireMembership` | `lib/customFunctions`, `reseau/attachmentGate.assertNotSuspended`, `lib/userCategory.isPublicUser`, `lib/platformAdmin`, `reseau/graphGuards` | **livré (PA2)** | `L/{access, functions}.ts` |
| E2 — erreurs | `lib/errors`, `ReseauPersonnelViolation`, `ReseauAlbumsViolation`, libellés en dur | **livré (PA2)**, 12 codes ; codes ajoutés par module au besoin | `SC/errors.ts`, `L/errors.ts` |
| E3 — personnes et adhésions | `users`, `memberships`, `orgs`, `appAccess/resolve.loadLiveMemberships`, `lib/postIdentity` | **livré (PA2)** ; le profil social (handle choisi, avatar, couverture, publication, mode privé, recherche) arrive avec `people` en PA3 | `M/people/` |
| E4 — limitation de débit | `ai/rateLimiter`, `functions/authRateLimit` | **livré (PA2)**, 12 seaux ; un seau par type d'écriture ajouté avec chaque module | `L/rateLimit.ts` |
| E5 — garde des fichiers | `fileGuard/{admission, storageGuard, policy}`, `lib/uploadPolicy` | PA3, **premier module** (requis par médias, avatars, stories, messagerie, albums, pages) | `M/files/`, `L/uploadPolicy.ts` |
| E6 — graphe par réseau | `modules/reseau/{connections, tables, enums}`, `reseauPersonnel/graph.ts` | PA3, juste après `people` | `M/graph/` |
| E7 — cloche et diffusion par lots | `reseauPersonnel/notifications.notifyPersonal`, `icom/notifyFanout` | PA3 (cloche, lots) ; push en PA5 | `M/notifications/` |
| E8 — compteurs | `reseauPersonnel/counters`, champs dénormalisés | PA3 ; composant `aggregate` (`engineCounters`) déclaré depuis PA0 | `M/posts/counters.ts` et chaque module |
| E9 — audit | `lib/contextAudit`, `functions/archive.logAudit`, table `auditLog` | PA3 : table `engineAudit` et helper ; toute décision de console, de modération ou de page y laisse une ligne | `M/platform/audit.ts` |
| G — garde de groupe thématique | `reseauPersonnel/groupesThematiquesAccess.ts` | PA3 ; importée par `posts/access`, `postWrite`, `posts` : à copier **avant** `posts` (ou, transitoirement, prédicat qui rend `false`) | `M/thematicGroups/access.ts` |

---

## 4. Ordre de duplication

### 4.1 La tranche verticale demandée par le propriétaire (avant PA3 complet)

« Entrer, choisir un handle, publier un texte, lire le fil, réagir » tire en avance, **par copie puis adaptation**
(jamais par réécriture libre), les morceaux suivants, que PA3 complète ensuite sans les refaire :

1. authentification : `socle/convex/betterAuth/auth.ts` (OTP par e-mail, code affiché en développement quand
   `ANTIA_DEV_TOOLS=true`), `socle/convex/http.ts` (routes Better Auth), proxy Next `/api/auth/[...path]`,
   `socle/packages/api/src/{auth-client, cross-domain-session-bootstrap, stable-convex-better-auth-provider, hooks,
   provider, sign-out-everywhere}.ts` ;
2. `people` réduit : `suggestHandles`, `confirmMyHandle`, `publishMyProfile` (copiés de `people.ts`) sur `persons` ;
3. `posts` réduit : `postWrite` + `publish` + `myFeed` à la portée `network` (fenêtres par auteur et curseur composite
   de `feedScale`), garde `access` ;
4. `engagement` réduit : `toggleReaction` (déjà sur compteurs fragmentés, pour ne pas copier la dette).

### 4.2 Backend (PA3) — un commit par module, dépendances d'abord

```text
 0  fondations (PA2, livré) : networks · people/fondations · platform/operators · lib/{access,functions,errors,rateLimit,validators}
 1  SD : searchText · handleSuggestion · domain (scindé) · feedScale · connectionState · albums · callGroup ·
         callJournal · filePolicy · live/{domain, permissions, replayComposition}
    SC : messageReactions · attachments · counterpart · groupCapacity · messaging · media (PostMediaDto) · calls
 2  files (garde fail-closed) + L/uploadPolicy ............................ E5
 3  people (profil social, recherche, mentions) · media ...................... E3 complet
 4  graph : enums · tables · graph · connections (réécrit) · follows ......... E6
 5  notifications : cloche sociale · fanout (lots chaînés) .................. E7
 6  platform/audit .......................................................... E9
 7  thematicGroups/access (G) → posts : access · contentRemoval · counters · postWrite · posts → marks
 8  engagement (réactions fragmentées, commentaires paginés) · moderation
 9  thematicGroups (module complet)
10  messaging : tables · forwardedFrom · attachmentStorage · threads + unreadTotals · participation ·
    messages · reactions · pins · typing · push · inbox
11  groups : access · threads · messages (lots) · invites + liens · typing · cascade → messaging/forward
12  events · stories · suggestions
13  pages (réécrit) : validators · tables + signataires · domain · follows · access · pages · admin/signatories · followedUpdates
14  albums
15  calls : L/livekit{,Wake,Identity} · purs (admission, capacity, journal, validators) · tables · présence par personne ·
    préférences · evaluate · appel 1:1 · groupe · ringExpiry · messagerie vocale
16  live : validators et purs · tables · access · sessions · reste · livekitActions · Egress (L/livekitEgress*, route http)
17  crons (saisie 1:1 et de groupe, stories, présence, appels, direct ×3, fichiers ×2) et cliquets du §8
```

PA5 reprend ensuite, sur ces modules : `notifications/{push, pushSubscriptions, retention}`, `people/erasure`,
`federation`, la modération à l'échelle et le cliquet `rate-limited-writes`.

### 4.3 Front (PA6)

```text
0  contrats et API typée (@antia/api) · paquets api, routing, chat, livekit, i18n réduit · CSS d'appel et de la coque
1  primitives et coque basse : useRoutes · useNetwork · design-styles · query-state · ReseauQueryError ·
   ReseauPaginatedErrorBoundary · primitives mobiles (mobile-shell, useIsReseauMobile, useVisualViewport,
   useBodyScrollLock, ImmersiveOverlay, gestures, VerticalPager) · floating-surface · floating-card · espace-kit ·
   useDebouncedValue · call-errors
2  modules purs de reseau-personnel (ordre de l'annexe A5 §10.4, niveau 2)
3  hooks de reseau-personnel · 4  composants feuilles de reseau-personnel
5  LOT UNIQUE (trois cycles d'imports) : stores + iappel + messagerie (+ stories, requis par IcomActusPanel) ;
   puis direct (+ components/direct) ; puis notifications
6  reseau-albums · 7  fil et volets de reseau-personnel
8  pages et coque haute : ProfilPersonnePage, ReseauAgentPage → SF/shell, hôtes (CallRoomMount,
   global-call-surface-host, conference-launch-host, direct-session-host), coque légère (providers,
   NetworkProvider, chrome, barre mobile, cloche, dock, présence)
```

---

## 5. Corrections de dette (liste fermée, chacune testée)

« Plan » : déjà dans la liste fermée de PA3 (`docs/01`). « Inventaire » : ajoutée par ce document ; elle touche un
invariant du moteur (refus indistinct, étanchéité, garde de délivrance, écriture bornée) et ne se reporte donc pas.

| Id | Dette | Où, dans le socle | Correction | Module | Prompt | Origine |
|---|---|---|---|---|---|---|
| D01 | Compteurs d'engagement sur la publication | `tables.ts:195-199` ; `engagement.ts:82-99, 201` ; `posts.ts:842-850` ; `contentRemoval.ts:44-47, 65-68` | Fragments `postReactionShards` + agrégat `engineCounters` ; l'engagement n'écrit plus le post | posts, engagement | PA3 | plan |
| D02 | Autres compteurs chauds | `memberCount` (groupes, thématiques), `participantCount`/`acceptedCount`, `viewCount`, `followerCount`/`postCount`, `participants`, compteurs de `direct_sessions` | Agrégat par entité ; tables de participation pour les appels | groups, thematicGroups, events, stories, pages, calls, live | PA3 | plan |
| D03 | `listComments` sans pagination (100 + 10 réponses) | `engagement.ts:30, 36, 336-339` | Pagination par racine, réponses paginées | engagement | PA3 | plan |
| D04 | Plafond de 200 connexions qui lève | `reseau/connections.ts:28, 558-624` ; `reseauPersonnel/connections.ts:424, 457` | Pagination native partout ; `listMine`/`listPendingForMe` historiques non recopiés | graph | PA3 | plan |
| D05 | Garde de délivrance contournée (21 `getUrl`) | voir §1.5 | `servableUrl` partout ; cliquet `file-delivery-gate` | tous | PA3 | plan |
| D06 | Garde des fichiers fail-open | `fileGuard/policy.ts:121-125` ; `storageGuard.ts:9-11` ; `admission.ts:285-293` ; `avProviders.ts:215-238` | Ligne absente = retenue ; coupe-circuit → `pending` ; fournisseur absent → `error` hors développement | files | PA3 | inventaire |
| D07 | Notifications de groupe dans la transaction (jusqu'à 999) | `groupes.ts:727-741, 1499-1513` ; `transfert.ts:434-446` | Diffusion par lots chaînés (150, replanifiés, clé de dédoublonnage), sans écrire le parent | groups, messaging, notifications | PA3 | plan |
| D08 | Fan-out de `comment` (≈ 112 écritures) et des citations | `engagement.ts:203-259` ; `postWrite.ts:141-150` ; `posts.ts:854-861, 928-940` | Même diffusion planifiée | engagement, posts | PA3 | inventaire |
| D09 | `albums.remove` laisse des orphelins | `reseauAlbums/albums.ts:590-610` | Cascade bornée : items, blobs, lignes d'analyse ; index `by_owner` sur les items | albums | PA3 | plan |
| D10 | Purges qui laissent la ligne d'analyse | `stories.ts:939-944` ; `groupes.ts:2977-2981` ; `groupesThematiques.ts:439-441` | Purge = blob + ligne d'analyse + document | stories, groups, thematicGroups | PA3 | plan |
| D11 | `.collect()` non bornés | `meetings.ts` ×11 ; `functions/pushSubscriptions.ts:86, 101` ; `dataSubjectErasure.ts` ×5 ; `appAccess/resolve.ts:147-150` (indirect) | `take`/`paginate` + `// borné : <raison>` (cliquet `no-unbounded-collect`) | calls, notifications, people | PA3, PA5 | plan |
| D12 | Fuite du blocage au bloqué | `reseau/connections.ts:179-186` | Réponse indistincte d'une demande envoyée ; test qui affirme le statut | graph | PA3 | inventaire |
| D13 | Blocage non vérifié à l'écriture | `functions/chats.ts` (aucun `isBlockedBetween`) ; `groupCalls.ts:694-713, 838-850` | `isBlockedBetween` à l'écriture, refus indistinct | messaging, calls | PA3 | inventaire |
| D14 | Limitation de débit absente | ≈ 100 mutations (§1.6) | Un seau par type d'écriture, ordre adhésion → éligibilité → débit → droit | tous | PA3 (posée), PA5 (cliquet) | inventaire |
| D15 | Garde de suspension inégale | `groupes.ts`, `evenements.ts`, `stories.ts`, `media.ts`, `moderation.ts` | `requireMembership` dans les constructeurs | tous | PA3 | inventaire |
| D16 | `Date.now()` dans des queries | `stories.ts:492, 644, 696` ; `groupes.ts:2047` ; `functions/chats.ts:1797` | `now` arrondi en argument, ou état posé par mutation planifiée | stories, groups, messaging | PA3 | inventaire |
| D17 | Lectures sans index, fuite entre réseaux | `suggestions.ts:132-135` ; `follows.ts:215` ; `groupesThematiques.ts:1124-1135` (`search_name` sans `filterFields`) ; `groupes.ts:776-781, 866-871` ; `groupesThematiques.ts:1144-1149` | Index `by_network_*`, `filterFields: ["networkId", …]`, ordre par activité récente | suggestions, graph, thematicGroups, groups | PA3 | inventaire |
| D18 | Listes qui lèvent | `marks.ts:170-175, 210-215` ; `notifications.ts:367-372` | Pagination ; départage par `_creationTime` | marks, notifications | PA3 | inventaire |
| D19 | Troncatures silencieuses | `listMembers` (100), `HIDDEN_SCAN` (500), `MUTES_SCAN` (200), `CONNECTIONS_SCAN`/`FOLLOWS_SCAN` (500), `PERSONAL_FEED_AUTHORS_MAX` (200), `unreadCount` (100), `getEvent` (100) | Pagination, ou borne documentée et signal de lacune rendu à l'écran | thematicGroups, marks, graph, posts, notifications, events | PA3 | inventaire |
| D20 | Push avec aperçu du message | `functions/chats.ts:887-895` ; `threads.ts:557-561` ; `transfert.ts:361-365` | Push sans contenu (titre neutre, lien) | messaging, notifications | PA3, PA5 | inventaire |
| D21 | E-mail exposé ou en repli d'affichage | `functions/chats.ts:301, 348, 1290, 1720, 1818` | Jamais d'e-mail : nom tiré de `persons`, sinon « inconnu » (clé i18n) | messaging | PA3 | inventaire |
| D22 | Tableau `deletedForUserIds` (jusqu'à 1 000) | `groupes.ts:1606-1608` | Table `groupMessageHides` (personne, message) | groups | PA3 | inventaire |
| D23 | Pastille de groupe recalculée (50 fils × 200 messages) | `groupes.ts:863-889` | Compteur `unreadTotals` (réseau, personne) comme le 1:1 | groups, messaging | PA3 | inventaire |
| D24 | Amplification de `myFeed` (≈ 12 500 documents) | `posts.ts:155, 1059-1317` | Bornes et fusion k-voies conservées, portée réseau, retrait collègues ; lacune exposée | posts | PA3 | inventaire |
| D25 | Double garde de `search` | `posts.ts:1385, 1393-1403` | Une seule garde | posts | PA3 | inventaire |
| D26 | Présence : nettoyage limité à 500 lignes, lectures sans garde | `functions/agentPresence.ts:146-202, 215-222` | Index `by_lastHeartbeat` ; lectures restreintes aux relations | calls | PA3 | inventaire |
| D27 | `endStaleCalls` en `.collect()` à chaque appel ; tableau `participants` réécrit | `meetings.ts:163-184, 973-1045` | Lecture indexée bornée ; table de participation | calls | PA3 | inventaire |
| D28 | `direct_sessions` réécrit à chaque admission de spectateur | `direct/access.ts:792-808` | Compteurs hors du document regardé (écrivain unique `reap`) | live | PA3 | inventaire |
| D29 | Abonnements push : endpoint réassocié à un autre compte, clés renvoyées, `.collect()` | `functions/pushSubscriptions.ts:34-41, 83-87, 86, 101` | Refus si l'endpoint appartient à un autre ; clés jamais renvoyées ; bornes | notifications | PA5 | inventaire |
| D30 | Rétention à blanc par défaut | `crons/notificationsRetention.ts:15-20, 64-68` | Rétention active ; mode à blanc explicite | notifications | PA5 | inventaire |
| D31 | Famine de la purge de quarantaine | `fileGuard/mutations.ts:362-370` | Statut `purged` (ou index) : une ligne purgée ne bloque plus la file ; test d'abord | files | PA3 | inventaire |
| D32 | Effacement sans table sociale | `crons/dataSubjectErasure.ts` | `people/erasure.ts` : étapes bornées sur toutes les tables, blobs et lignes d'analyse (annexe A3 §L) | people | PA5 | inventaire |
| D33 | Lettres mortes en clair | `reseau/federationTables.ts:69-73` | Enveloppe opaque (JSON canonique + sha256), rétention | federation | PA5 | inventaire |
| D34 | `schemaValidation: false` | `socle/convex/schema.ts:2019` | `true` (PA0) ; test de rejet (PA2) ; fixtures complètes | tous | PA0–PA3 | plan |
| D35 | Index déclarés jamais lus | `posts.by_directSessionId`/`by_eventId` (tests seuls), `postComments.by_parent_and_createdAt`, `contentReports.by_comment`, `chats.by_participant*_scope`, réactions `by_message`, `eventParticipants.by_user_and_status` | Non recopiés | posts, moderation, messaging, events | PA3 | inventaire |
| D36 | Téléversement social hors politique | `media.ts:193-198` (exception `media_social`) ; `uploadPolicy.ts:113-117` (GIF exclu) | Usages sociaux unifiés (`media_social` avec GIF, `avatar`, `cover`, `page_logo`, `page_banner`, `album_image`, `chat_attachment`, `voice`) ; débit | files, media | PA3 | inventaire |
| D37 | Retrait incohérent (`""` contre `undefined`) | `functions/chats.ts:1425` / `groupes.ts:1753` | `undefined` partout | messaging | PA3 | inventaire |
| D38 | Pastille corrigée à la lecture pour les bloqués (≤ 100) | `messagerie.ts:870-890` | Le blocage met le compteur à jour à l'écriture | messaging | PA3 | inventaire |
| D39 | Aperçu calculé sur des pièces déclarées non vérifiées | `functions/chats.ts:775-783` | `previewLabelFor` sur les pièces vérifiées | messaging | PA3 | inventaire |

---

## 6. Backend, module par module

Pour chaque module : la table source → cible exhaustive (ligne totale par `wc -l`), les tests du socle et leur sort,
les tables et index cibles, les dettes à corriger. Les points d'accroche sont cités à la ligne dans l'annexe indiquée.

### 6.1 `people` — profil social, recherche, mentions, effacement (`M/people/`)

| Source | l. | Sort | Cible | Adaptations, retraits |
|---|---:|---|---|---|
| `reseauPersonnel/people.ts` | 883 | à réécrire | `M/people/profile.ts` (+ `search.ts`) | Paire `users` + `reseauPersonnel_profiles` → `persons` (PA2). Réutilisés : `rethrowDomain` (→ codes), `livePersonalProfile`, `findPublishedPersonByHandle`, `publishedMiniProfile`, `miniProfileCache`, `assertFreshAvatarStorage`, `resolveMentionedUserIds` ; `addedMentionedUserIds` (pur) → `SD/content.ts`. Fonctions : `suggestHandles`, `confirmMyHandle`, `publishMyProfile`, `withdrawMyProfile`, `setMyProfilePrivacy`, `setMyAvatar`, `setMyCover`, `searchPeople` (membres du réseau seulement), `getPublicProfile` ; `getMyProfile`/`ensureMyProfile` sont déjà `getMyPerson`/`ensureMyPerson` (PA2). **Retirés** : `ensurePublishedProfile` (publication d'office, contraire à l'invariant 7 — leçon des ADR-0080/0082), `positionTitle`/`orgName` (`resolvePostIdentities`, `loadLiveMemberships`), lectures de `users`. |
| `reseauPersonnel/handleSuggestion.ts` | 217 | tel quel | `SD/handleSuggestion.ts` | Alimenté par `persons.displayName` ; commentaires `users`/IDN mis à jour. |
| `lib/accountErasure.ts` | 50 | à adapter | `M/people/accountErasure.ts` | `persons` au lieu de `users`. |
| `crons/dataSubjectErasure.ts` | 566 | patron | `M/people/erasure.ts` (PA5) | Étapes bornées auto-replanifiées, contrôle à chaque étape, audit des comptages ; aucune des tables iAsted ; toutes les tables du moteur. |

- **Tests.** `handleSuggestion.test.ts` (181 l., 21 cas) : tel quel. `people.adoption.test.ts` (161, 4) : à adapter
  (fixtures `seedOrg`/`memberships`). `profileAutoPublish.test.ts` (302, 14) : **réécrit en négatif** (rien n'est
  publié d'office). `platformAccounts.test.ts` (364, 17) : exclu (comptes de plateforme), sauf les cas de
  non-publication. Les cas `people.*` de `reseauPersonnel.test.ts` et de `connections.test.ts` : à adapter.
  `dataSubjectErasure*.test.ts` (4 fichiers, 2 279 l., 41 cas, tables iAsted) : patron seulement → tests neufs (PA5).
- **Tables.** `reseauPersonnel_profiles` (`by_user`, `by_handle`, recherche `search_displayName`) fusionne dans
  `persons` (PA2 : `by_authUserId`, `by_handle`). Recherche par réseau : projection cherchable dénormalisée sur
  l'adhésion (`networkId` en `filterFields`), pour ne jamais rendre un non-membre.
- **Dettes.** D05 (8 `getUrl`), D14 (squat de handle possible sans débit), D32.

### 6.2 `media` (`M/media/`)

| Source | l. | Sort | Cible | Adaptations |
|---|---:|---|---|---|
| `reseauPersonnel/media.ts` | 198 | à adapter | `M/media/media.ts` | Garde du moteur ; `generateUploadUrl` sous politique d'usage, débit et adhésion ; type `PostMediaDto` → `SC/media.ts` (le front n'importe que lui). |

- **Tests.** `media.adoption.test.ts` (419 l., 8 cas : `stories.publish`/`purgeExpired`, `groupesThematiques.create`/`deleteGroup`) : à adapter. L'exception `media_social` du cliquet de politique de téléversement disparaît.
- **Dettes.** D14, D36.

### 6.3 `graph` — connexions, blocages, abonnements (`M/graph/`)

| Source | l. | Sort | Cible | Adaptations, retraits |
|---|---:|---|---|---|
| `reseau/connections.ts` | 635 | à réécrire | `M/graph/connections.ts` | Gardés : `canonicalPair`, `viewConnection`, machine d'états, idempotence, blocage unilatéral. `personId` + `networkId`, `requireMembership`, débit, message borné, fuite du blocage corrigée (D12), cloche émise par la diffusion ; `revokeConnectionDirects` devient un point d'accroche vers `live`. |
| `reseau/enums.ts` | 196 | à adapter (l. 183-196 seulement) | `M/graph/enums.ts` | Statuts de connexion ; le reste (organisations, revendications, rattachements) est exclu. |
| `reseau/tables.ts` | 147 | à adapter (l. 96-122 seulement) | `M/graph/tables.ts` | `networkId`, `personIdLow`/`personIdHigh`, index préfixés, index d'effacement (demandeur, bloqueur). |
| `reseau/graphGuards.ts` | 97 | exclu | — | Seul le patron « plancher défini positivement » est repris (par `requireMembership`) ; « champ absent = validated » est fail-open. |
| `reseauPersonnel/graph.ts` | 327 | à adapter (l. 1-223) | `M/graph/graph.ts` | `acceptedCounterpartIds`, `pendingCounterpartIds`, `isConnectedTo`, `isBlockedBetween`, `isFollowingUser`, `blockedCounterpartIds`, `followedUserIds` sur la table du moteur. **Exclus** l. 225-327 : `validatedOrgIds`, `hasAnyLiveMembership`, `colleagueUserIds`. |
| `reseauPersonnel/connections.ts` | 731 | à réécrire (fusion dans la façade) | `M/graph/connections.ts` | Réutilisés : sonnerie (l. 79-99), `searchMine`, `pendingState`. Retirés : délégation par `runQuery`/`runMutation` vers `reseau`, `resolvePostIdentities`, « annuaire contacts pro » ; `foldDiacritics` local → `SD/searchText`. |
| `reseauPersonnel/follows.ts` | 255 | à adapter | `M/graph/follows.ts` | `getUrl` brut (l. 249) ; `suggestions` indexée par réseau ; `listMyFollows` paginé ; `myFollowerCount` → agrégat ; débit sur `follow`. |
| `reseauPersonnel/connectionState.ts` | 39 | à adapter (trivial) | `SD/connectionState.ts` | Type structurel en identifiants de personnes. |

- **Exclus du dossier `modules/reseau`** (16 fichiers, 6 243 l., institutionnels) : `affiliationReminders`,
  `attachment`, `attachmentDeadline`, `attachmentGate`, `attestationService`, `attestationServiceData`, `claims`,
  `engagementReminders`, `membershipEngagement`, `membershipValidation`, `orgAdminState`, `orgStatus`,
  `rattachementLegalCatalog`, `registration`, `sensitiveOrgs`, `verticalStaffProvisioning`.
- **Tests.** `tests/reseauConnections.test.ts` (610, 22) : à porter, **plus** une assertion qui mord sur la fuite du
  blocage. `reseauPersonnel/connections.test.ts` (536, 14) : à adapter (fixtures d'organisation retirées, plus de
  `positionTitle`/`orgName`). Cas `follows.*`/`connections.*` de `reseauPersonnel.test.ts` : à adapter.
  `graphGuards.test.ts` (177, 16) : exclu.
- **Tables.** `connections` : `by_pair`, `by_low_status`, `by_high_status` → préfixés par `networkId` + index
  d'effacement ; `follows` : `by_follower_and_target`, `by_follower_and_createdAt`, `by_target_and_createdAt` →
  préfixés.
- **Dettes.** D04, D05, D12, D14, D17, D19.

### 6.4 `notifications` — cloche sociale, diffusion, push (`M/notifications/`)

| Source | l. | Sort | Cible | Adaptations |
|---|---:|---|---|---|
| `reseauPersonnel/notifications.ts` | 499 | à adapter | `M/notifications/bell.ts` | `personalNotificationSubjectKey` (pur) → `SD/notifications.ts` ; `notifyPersonal` appelé par la diffusion ; `myNotifications` corrigé (D18) ; `unreadCount` sur compteur ; post-filtre `.filter()` (l. 465) remplacé par un index. |
| `lib/notify.ts` | 233 | à adapter | `M/notifications/notify.ts` | Porte unique d'écriture ; `personId`, `networkId`, genres sociaux ; push planifié (PA5). |
| `schemas/notifications.ts` | 49 | à adapter | `M/notifications/tables.ts` | **Une seule table** `notifications` (réseau, destinataire, genre, sujet, clé de dédoublonnage) ; le centre administratif (`functions/notifications.ts`, 600 l.) est exclu. |
| `icom/notifyFanout.ts` | 178 | patron | `M/notifications/fanout.ts` | Lots de 150 replanifiés, dédoublonnage, aucune écriture sur le parent. |
| `icom/autoEnroll.ts` | 140 | patron | `M/groups/`, `M/thematicGroups/` | Inscription paginée chaînée, réactivation plutôt que seconde insertion. |
| `actions/push.ts` | 181 | à adapter | `M/notifications/push.ts` (PA5) | VAPID par variables ; libellés « [SPRINT6] » retirés ; envoi par lots, pas un `runAction` séquentiel par personne. |
| `schemas/pushSubscriptions.ts` | 24 | à adapter | `M/notifications/tables.ts` (PA5) | `personId`. |
| `functions/pushSubscriptions.ts` | 133 | à adapter | `M/notifications/pushSubscriptions.ts` (PA5) | D29. |
| `crons/notificationsRetention.ts` | 227 | à adapter | `M/notifications/retention.ts` (PA5) | Passes sociales seulement ; D30. |

- **Tests.** `reseauPersonnel/notifications.test.ts` (577, 10) : à adapter. `tests/notifications.test.ts` (261, 8) : à
  porter. `crons/notificationsRetention.test.ts` (142, 4) : à porter (PA5). `tests/scheduledDrain.test.ts` (340, 16) :
  repris dans le harnais (bouchon push, vidange du scheduler). `tests/notificationsWriterRatchet.test.ts` (126, 5) :
  patron du cliquet « écrivains de notifications ». Exclus : `notifyResidualWriters`, `icomChannels` (le fanout y est
  couvert indirectement : tests directs à écrire), `chatsMessagerie` (job push), `voicemails`.
- **Dettes.** D07, D08, D18, D19, D20, D29, D30.

### 6.5 `posts` — publications, fil, recherche, mur (`M/posts/`) et domaine pur

| Source | l. | Sort | Cible | Adaptations, retraits |
|---|---:|---|---|---|
| `reseauPersonnel/posts.ts` | 1 748 | à adapter (lourd) | `M/posts/posts.ts` | Gardés : fenêtres par auteur, fusion k-voies, curseur composite, deux phases, `toFeedItem`, `readerMarks`. Retirés (≈ 30 %) : portée « mon_administration » et collègues (l. 1059-1061, 1079-1081, 1221-1224, 1253). Pages (`pageFeedWindow` l. 255-325, `FeedItem.page`, `signedBy`, `assertCanPublishOnPage`, `pageOrgIdOf`, admission des pages l. 1201-1246) : **rebranchées sur `pages` du moteur** au lot 13. Direct (l. 550-562) et évènements (l. 573-598) : points d'extension branchés avec `live` et `events`. `networkId` dans tous les index (fil, recherche) ; débit sur `publish`/`edit` ; `shareCount` → agrégat. |
| `reseauPersonnel/postWrite.ts` | 202 | à adapter | `M/posts/postWrite.ts` | Point d'écriture unique ; extensions `pageId`/`directSessionId`/`eventId` ; branche organisation (l. 187-198) retirée ; citations notifiées par la diffusion. |
| `reseauPersonnel/access.ts` | 177 | à adapter | `M/posts/access.ts` | `assertVisiblePost`/`canSeePost` : adhésion + visibilité `network`/`root` (`effectiveVisibility`, PA2) ; retirés l. 97-106 (page → organisation) et l. 135-140 (audience organisation) ; `isPlatformAccount` exclu ; cache par requête. |
| `reseauPersonnel/contentRemoval.ts` | 69 | à adapter | `M/posts/contentRemoval.ts` | Retirés l. 27-39 (`page.postCount`) ; compteurs → agrégats. |
| `reseauPersonnel/counters.ts` | 78 | à adapter | `M/posts/counters.ts` | Lit fragments et agrégats ; en-tête obsolète corrigé. |
| `reseauPersonnel/feedScale.ts` | 106 | à adapter (trivial) | `SD/feedScale.ts` | `Id<…>` → identifiant générique. |
| `reseauPersonnel/searchText.ts` | 64 | tel quel | `SD/searchText.ts` | — |
| `reseauPersonnel/domain.ts` | 1 633 | à adapter | `SD/` scindé : `content.ts` (l. 20-754), `thematicGroups.ts` (l. 756-937), `richText.ts` (l. 939-988), `events.ts` (l. 990-1140), `stories.ts` (l. 1142-1459), `groupThreads.ts` (l. 1461-1633) | Retirés : audience « organisation » (l. 61, 436-449, 485-489, 641-644), `assertPageAudienceShape` (l. 848-894, remplacé par l'audience de page du moteur), « mon_administration » (l. 592, 614-662), raisons « collegue »/« page » (l. 514, 523-529, 660), scope « poste » (l. 1489-1517), libellés iRéseau/iCom (l. 1268-1271, 1319, 1380) ; `ReseauPersonnelViolation` → violation à code. |
| `reseauPersonnel/validators.ts` | 361 | à adapter | `L/validators.ts` (partie sociale) ou par module | Retirés : audience organisation (l. 38), « mon_administration » (l. 278), scope poste (l. 184-187), surfaces `reseau`/`icom` (l. 265-268) ; genres de notification répartis par module. |
| `reseauPersonnel/tables.ts` | 1 164 | à réécrire | `M/<module>/tables.ts` (26 tables réparties) | `networkId` partout, personnes, extensions page/direct/évènement optionnelles. |
| `reseauPersonnel/manifest.ts` | 53 | exclu | — | Manifeste du moteur écrit à neuf. |

- **Tests.** `domain.test.ts` (947, 71) → `SD` : à adapter (retirer organisation l. 91-108, « mon_administration »/
  collègue l. 438-615 ; l'alignement avec les validateurs l. 617-643 reste côté Convex ; fuseau l. 779-780).
  `stories.domain.test.ts` (387, 41) → `SD` : à adapter (6 cas `assertPageAudienceShape`). `feedScale.test.ts`
  (192, 5) : 3 cas purs → `SD`, 2 d'intégration → `posts`. `reseauPersonnel.test.ts` (2 278, 83) : à adapter
  (`posts.*` ; cas de page l. 2093-2125 → lot `pages` ; suspension l. 1604 → statut d'adhésion).
  `backfillReseauPersonnelPostAggregates.test.ts` (81, 2) : patron (compteurs). Exclus : `vpgCollaborationEndToEnd`,
  `instructionQueues`. Cliquets du socle : `attachmentGateRatchet` → remplacé par `network-scoped-functions` (livré) ;
  `membershipScopeRatchet` : patron (vocabulaire des gardes).
- **Tables.** `posts` (index du socle : `by_author_and_status`, `by_author_status_publishedAt`,
  `by_status_and_publishedAt`, `by_author_and_idempotencyKey`, `by_sharedPostId`, `by_group_status_publishedAt`,
  `by_page_status_publishedAt` → tous préfixés par `networkId` ; `by_directSessionId`, `by_eventId` non recopiés ;
  recherche `search_body_v1` avec `filterFields: ["networkId", "status"]`), `postReactions`, `postReactionShards`
  (neuve), `postAggregateBackfills` (patron, non recopiée).
- **Dettes.** D01, D08, D11, D24, D25, D35.

### 6.6 `engagement` — réactions, commentaires (`M/engagement/`)

| Source | l. | Sort | Cible | Adaptations |
|---|---:|---|---|---|
| `reseauPersonnel/engagement.ts` | 384 | à adapter | `M/engagement/engagement.ts` | `toggleReaction` sur fragments ; `comment` notifie par la diffusion ; `removeComment`, `editComment` ; `listComments` paginé ; `reactionCountsAfter` (pur) → `SD/content.ts` ; débit. |

- **Tests.** Cas `engagement.*` de `reseauPersonnel.test.ts` et `moderation.test.ts` (`comment`, `removeComment`) : à
  adapter ; tests neufs : 50 réactions concurrentes sans conflit sur le post, 150 commentaires paginés.
- **Tables.** `postComments` (`by_post_and_createdAt` préfixé ; `by_parent_and_createdAt` non recopié tant qu'il
  n'est pas lu).
- **Dettes.** D01, D03, D08, D14.

### 6.7 `marks` — enregistrer, masquer, mettre en sourdine (`M/marks/`)

| Source | l. | Sort | Cible | Adaptations |
|---|---:|---|---|---|
| `reseauPersonnel/marks.ts` | 390 | à adapter | `M/marks/marks.ts` | `toggleMark`, `hidePost`, `unhidePost`, `muteAuthor`, `unmuteAuthor`, `paginateBookmarks`, `paginateHiddenPosts`, `markStateFor`, `myMutes` paginé ; `myBookmarks`/`myHiddenPosts` (qui lèvent au-delà de 50) non recopiés au profit des versions paginées ; `NOTIFY_FANOUT` → diffusion. |

- **Tests.** `marks.test.ts` (469, 13) : à adapter, **après** `thematicGroups` (il appelle `groupesThematiques.leave`).
- **Tables.** `postMarks` (`by_user_kind_post`, `by_user_kind_createdAt`, `by_post_and_kind`), `mutes`
  (`by_user_and_muted`, `by_user_and_createdAt`) → préfixés par `networkId`.
- **Dettes.** D14, D18, D19.

### 6.8 `moderation` — signalements, file du réseau (`M/moderation/`)

| Source | l. | Sort | Cible | Adaptations |
|---|---:|---|---|---|
| `reseauPersonnel/moderation.ts` | 131 | à adapter | `M/moderation/moderation.ts` | `reportPost`/`reportComment` : adhésion et débit ; `listQueue`/`decide` : back-office → modérateur du réseau (`network_moderator`/`network_admin`) ou opérateur ; `appendContextAudit` → audit du moteur (E9). Modération à l'échelle en PA5. |

- **Tests.** `moderation.test.ts` (330, 6) : à adapter (rôles `AdminSystem`/`SuperAdmin` → rôle de réseau).
  `reseauPlatformActsAudit.test.ts` (331, 6) : patron (une décision écrit une ligne d'audit).
- **Tables.** `contentReports` → `by_network_status_createdAt`, `by_reporter_and_target`, `by_post` ;
  `by_comment` non recopié.

### 6.9 `stories` (`M/stories/`)

| Source | l. | Sort | Cible | Adaptations |
|---|---:|---|---|---|
| `reseauPersonnel/stories.ts` | 956 | à adapter | `M/stories/stories.ts` | Surfaces `reseau`/`icom` (ADR-0079) retirées ; délivrance par la garde ; purge du blob **et** de la ligne d'analyse ; `viewCount` hors du document ; `now` en argument ; adhésion, `networkId`, débit (`publish`, `markSeen`) ; plafond `STORY_ACTIVE_PER_AUTHOR_MAX` gardé. |

- **Tests.** `stories.test.ts` (1 311, 47) : 40 à porter, 7 abandonnés (surfaces l. 754-867 ×5, l. 597, 627) ; cas de
  `media.adoption` et de `platformAccounts` (`stories.publish`) : à adapter.
- **Tables.** `stories` (`by_author_and_expiresAt`, `by_expiresAt`, `by_author_and_idempotencyKey`, sans `surfaces`),
  `storyViews` (`by_story_and_viewer`, `by_story_and_seenAt`, `[networkId, viewer, seenAt]`).
- **Cron.** `purge-expired-stories` (10 min, se replanifie), avec la ligne d'analyse.
- **Dettes.** D02, D05, D10, D14, D16.

### 6.10 `suggestions` (`M/suggestions/`)

| Source | l. | Sort | Cible | Adaptations |
|---|---:|---|---|---|
| `reseauPersonnel/suggestions.ts` | 403 | à adapter (`paginate` et `listSentInvitations` réécrits) | `M/suggestions/suggestions.ts` | Index par réseau ; `positionTitle`/`orgName` remplacés par le titre (`headline`) de la personne ; `getUrl` brut (l. 176) ; débit sur `dismiss`/`restore` ; `dismiss`, `restore`, `listDismissed` presque tels quels. |

- **Tests.** `suggestions.test.ts` (375, 16) : à porter.
- **Tables.** `suggestionDismissals` (`by_user_and_dismissed`, `by_user_and_createdAt`) → préfixés.
- **Dettes.** D05, D14, D17.

### 6.11 `groups` — conversations de groupe (`M/groups/`)

| Source | l. | Sort | Cible | Adaptations, retraits |
|---|---:|---|---|---|
| `reseauPersonnel/groupes.ts` | 3 112 | à adapter (lourd) | `M/groups/{access.ts (requireLiveMembership, liveMembers), threads.ts, messages.ts, invites.ts (+ liens), typing.ts, cascade.ts}` | Retirés : scope et branche poste (`assertGroupScope` l. 213-224, `assertAdmissible` l. 257-258, `GROUP_SCOPE_PERSONNEL`, `groupThreadMatchesScope`), mécanique d'appel (≈ 170 l. : `isLiveMemberOfGroupCall`, `liveGroupThreadIdOfCall`, `liveActiveCall`, `revokeActiveGroupCallParticipation` → point d'accroche de `calls`), `sourceDocumentId` (iDocument), `isPublicUser`. Ajoutés : `networkId`, adhésion, débit (`sendGroupMessage`, `setGroupTyping`, `createGroup`, `inviteToGroup`, `joinGroupViaInviteLink`, `generateAttachmentUploadUrl`). Cascade : cloches `group_*`, avatar orphelin (l. 3060-3064), lignes d'analyse. ≈ 47 libellés → codes. |
| `lib/groupCapacity.ts` | 154 | à adapter | `SC/groupCapacity.ts` | Gardés : `GROUP_MEMBERS_MAX` (à reconsidérer à la baisse) et les constantes d'appel de groupe consommées par `calls` et le front, avec un plafond constant de 11. Retirés : exemption back-office (`isBackOfficeUser`), configuration d'organisation. |

- **Tests.** `groupes.test.ts` (4 079, 114) : 92 à porter, 22 abandonnés — appels de fil (l. 925-1143 ×4,
  2683-2910 ×9, 2911-2980 ×2) **déplacés vers le lot `calls`**, poste (l. 3281-3418 ×7) abandonnés.
  `groupes.cascadeBlobs.test.ts` (266, 3) : 2 / 1 (coffre). `lib/groupCapacity.test.ts` (116, 11) : 1 cas + les cas
  d'appel de groupe non administratifs. Cas « administration de fil » de `domain.test.ts` (l. 812-947, 9) → `SD`.
- **Tables.** `groupThreads` (`by_creator_and_idempotencyKey` ; `activeMeetingId`, `scope` retirés ; `networkId`),
  `groupMembers` (`[networkId, personId, leftAt]` + ordre d'activité), `groupInvites` (`[networkId, invitee,
  status]`), `groupInviteLinks` (`by_threadId`, `by_token`), `groupMessages` (`by_thread_and_createdAt`,
  `by_thread_and_idempotencyKey` ; `meetingId`, `sourceDocumentId` retirés), `groupMessageReactions`, `groupTyping`,
  `groupMessageHides` (neuve, D22) ; pastilles dans `unreadTotals` (`messaging`).
- **Cron.** `purge-expired-group-typing` (1 min, `take(500)`).
- **Dettes.** D02, D05, D07, D10, D14, D15, D16, D22, D23.

### 6.12 `thematicGroups` — groupes thématiques (`M/thematicGroups/`)

| Source | l. | Sort | Cible | Adaptations |
|---|---:|---|---|---|
| `reseauPersonnel/groupesThematiquesAccess.ts` | 98 | tel quel | `M/thematicGroups/access.ts` | Libellés → codes ; le contrôle du réseau est chez l'appelant. |
| `reseauPersonnel/groupesThematiques.ts` | 1 436 | à adapter | `M/thematicGroups/thematicGroups.ts` | `isPublicUser`/`assertNotSuspended` → adhésion ; découverte indexée et filtrée (`filterFields: ["networkId"]`, `[networkId, createdAt]`) ; `listMembers`/`listInviteCandidates` paginés ; `myGroups` par activité récente ; `memberCount` → agrégat ; cascade (cloches, lignes d'analyse) ; débit (`create`, `join`, `invite`). |

- **Tests.** `groupesThematiques.test.ts` (1 418, 45) : 45 à porter (cas de suspension l. 205 → statut d'adhésion
  minimal) ; cas thématiques de `domain.test.ts` (l. 644-743, 8) → `SD` ; fixtures de `notifications.test`,
  `marks.test`, `media.adoption`.
- **Tables.** `thematicGroups` (`by_creator_and_idempotencyKey`, recherche `search_name` avec `filterFields`),
  `thematicGroupMembers` (`[networkId, personId, leftAt]`), `thematicGroupInvites` (`[networkId, invitee, status]`).
- **Dettes.** D02, D10, D14, D17, D19.

### 6.13 `events` — évènements personnels (`M/events/`)

| Source | l. | Sort | Cible | Adaptations |
|---|---:|---|---|---|
| `reseauPersonnel/evenements.ts` | 961 | à adapter | `M/events/events.ts` | Adhésion partout (absente aujourd'hui) ; `networkId` sur l'évènement et la participation ; `eventStartAt` obligatoire (chemin hérité l. 783-809 supprimé) ; compteurs → agrégat ; `getEvent` paginé ; débit sur `invite` ; annonce par `postWrite` ; fuseau de la personne (jamais `Africa/Libreville` en dur). Annulation par job paginé : gardée telle quelle. |

- **iCal** (`lib/ical`, route `/ical/event/{id}.ics`, `eventIcalUrl`, `getPersonalEventForIcal`) : **différé** (hors
  PA3, décision par défaut) ; lecteurs administratifs (iAgenda, `iappel/evaluate`) exclus.
- **Tests.** `evenements.test.ts` (1 103, 27) : 27 à porter (cas iCal l. 727, 746 différés) ; cas évènements de
  `domain.test.ts` (l. 744-811, 4) → `SD`.
- **Tables.** `events` (`by_organizer_and_idempotencyKey`, `[networkId, organizer, startAt]`), `eventParticipants`
  (`by_event_and_user`, `by_event_and_status`, `[networkId, personId, eventStartAt]` ; `by_user_and_status` non
  recopié).
- **Dettes.** D02, D14, D15, D19.

### 6.14 `messaging` — messagerie personnelle (`M/messaging/`)

| Source | l. | Sort | Cible | Adaptations, retraits |
|---|---:|---|---|---|
| `functions/chats.ts` | 1 840 | à réécrire par scission (≈ 690 l. exclues) | `M/messaging/{participation, messages, reactions, pins, typing, push}.ts` | **Gardés** (adaptés) : `requireSameChatReply`, `isDeletedForUser`, `projectChatReplyTo`, `enrichChatMessagePage` (sans repli e-mail), `paginateMessages`, `listMessages` (compatibilité), `generateAttachmentUploadUrl`, `markReadBatchForParticipant` (sans branche ancrée), `markRead`, `markReadBatch`, `deleteMessage`, `editMessage`, `deleteMessageForMe`, `toggleMessageReaction`, `setPinnedMessage`, `getPinnedMessage`, `setTyping`, `clearTyping`, `listTyping`, `purgeExpiredTyping`. **Réécrits** : `validateParticipation` (participant + réseau), `sendMessage` (blocage, débit, adhésion, pièces vérifiées, `previewLabelFor`), `dispatchChatPush` (un destinataire, sans aperçu, URL par réseau). **Exclus** : Standard et iAsted (l. 982-1376), `canAccessStandardThreads`, `projectPoste`, `projectOtherUser`, `listMyChats`, `getChat`, `findChatWith`, `initiateChat`. |
| `messagerieScope/threads.ts` | 564 | à réécrire (patron) | `M/messaging/threads.ts` + `unreadTotals.ts` | `openOrContinuePersonalThread(ctx, { networkId, initiatorPersonId, targetPersonId, initialMessage, initialAttachmentFiles })` : adhésion des deux côtés, `verifyDeclaredAttachments`, compteur de non-lus, push sans aperçu. Gardés : `sortParticipants`, `isUnreadFor`, helpers `unreadTotals` (clé réseau + personne), `recomputePersonalUnreadTotal`. Exclus : `findPosteThread`, `findInstitutionalThread`, `listPosteThreadsFor`, branches ancrées. |
| `messagerieScope/transfert.ts` | 550 | à adapter | `M/messaging/forward.ts` | Refus « réseau source ≠ réseau cible » à la place de `FORWARD_CROSS_SPACE` ; `isPublicUser`, `senderPoste`, `verifyOrgChatAttachments` retirés ; notifications planifiées ; push sans aperçu. |
| `messagerieScope/forwardedFrom.ts` | 48 | tel quel | `M/messaging/forwardedFrom.ts` | Identifiants renommés. |
| `messagerieScope/posteKey.ts` | 121 | exclu | — | — |
| `messagerieScope/posteResolve.ts` | 272 | exclu | — | — |
| `messagerieScope/scope.ts` | 104 | exclu | — | Patron retenu : c'est la porte qui pose `networkId`, jamais le client. |
| `reseauPersonnel/messagerie.ts` | 1 113 | à réécrire (partiel) | `M/messaging/inbox.ts` | Gardés : `assertPeutOuvrirFilPersonnel`, `lastMessageKindOf`, `estDansLaBoitePersonnelle`, `lireCote`/`blocageCache`/`pagePersonnelle`, `listMyThreadsPage`, `getThread`, `totalUnread`, `findThreadWithHandle`, `startThreadWithHandle`. Réécrit : `projeterFil` (sans poste ni « Poste vacant »). Exclus : `getPosteThread`, `listMyPosteThreads`, `callByHandle` (→ `calls`, `callMember`). |
| `reseauPersonnel/messagerie/attachmentStorage.ts` | 191 | à adapter | `M/messaging/attachmentStorage.ts` | `sourceDocumentId` (iDocument) retiré ; `orgId` → `networkId` ; garde du moteur. |
| `reseauPersonnel/messagerie/attachments.ts` | 224 | tel quel | `SC/attachments.ts` | Erreur du paquet ; libellés → clés. |
| `reseauPersonnel/messagerie/counterpart.ts` | 114 | à adapter | `SC/counterpart.ts` | `COUNTERPART_UNKNOWN` neutre (code) ; compte → personne. |
| `schemas/chats.ts` | 104 | à réécrire | `M/messaging/tables.ts` (`personalThreads`) | `networkId`, `personA`/`personB` ; retirés `orgId`, `requestId`, type Standard, `claimedBy`, `scope`, `posteA`/`posteB` et leurs index. |
| `schemas/chatMessages.ts` | 166 | à adapter | `SC/messaging.ts` (`MESSAGE_EDIT_WINDOW_MS`) + `M/messaging/tables.ts` | Retirés `senderPoste`, pièces « documents », `sourceDocumentId`, `by_chat_read`. |
| `schemas/chatMessageReactions.ts` | 36 | tel quel | `M/messaging/tables.ts` | — |
| `schemas/chatTyping.ts` | 23 | tel quel | `M/messaging/tables.ts` | — |
| `schemas/messageReactions.ts` | 141 | tel quel | `SC/messageReactions.ts` | Validateurs `convex/values` séparés côté backend. |
| table `reseauPersonnel_unreadTotals` (`tables.ts:1101-1134`) | — | à adapter | `M/messaging/tables.ts` | Clé (réseau, personne). |
| `migrations/backfillUnreadTotals.ts` | 115 | patron | — | Réconciliation des pastilles. |

- **Tests** (à porter / abandonnés) : `messagerie.test.ts` (1 849, 53) 29 / 24 (`callByHandle` ×7 → `calls` ;
  cloisonnement ×4 ; `listMyPosteThreads` ×3 ; deux réseaux ×7 → réécrits « entre réseaux ») ;
  `messagerie/attachments.test.ts` (242, 22) 22 / 0 ; `messagerie/counterpart.test.ts` (91, 6) 6 / 0 ;
  `threads.test.ts` (321, 8) 7 / 1 ; `transfert.test.ts` (700, 20) 16 / 4 (l. 441-487 → tests entre réseaux) ;
  `tests/chatsMessagerie.test.ts` (724, 21) 21 / 0 ; `tests/chatsP2P.test.ts` (606, 24) 9 / 15 ;
  `tests/chatsPinning.test.ts` (318, 9) 9 / 0 ; `tests/chatsAttachmentsAdoption.test.ts` (762, 14) 10 / 4 ;
  `tests/chatsAttachmentsAdmission.test.ts` (207, 3) 0 / 3 ; `posteKey`, `posteResolve.doublePoste`, `scope` (21 cas) :
  abandonnés ; `standardChatCadence`, `standardChatOwnThread`, `standardQueueAccess` (24 cas) : abandonnés.
- **Cron.** `purge-expired-chat-typing` (1 min) ; `reset-stale-claimed-chats` exclu (Standard).
- **Dettes.** D13, D14, D16, D20, D21, D37, D38, D39.

### 6.15 `pages` — pages à identité propre (`M/pages/`)

| Source | l. | Sort | Cible | Adaptations |
|---|---:|---|---|---|
| `reseauPages/tables.ts` | 123 | à adapter | `M/pages/tables.ts` | `networkId` ; identité propre (`name`, `shortName`, `logoStorageId`, `bannerStorageId`, `description`, `ownerKind`, `trust`) ; `createdByPersonId` ; `orgId` retiré ; tables neuves `pageSignatories` (`by_page_person`, `by_person`) et `pageClaims` (EXF-AN-17) ; abonnements en personnes. |
| `reseauPages/validators.ts` | 21 | tel quel | `M/pages/validators.ts` | — |
| `reseauPages/domain.ts` | 139 | à adapter | `M/pages/domain.ts` | Handle dérivé du nom ; `isMyOrgPage` → adhésion ou signataire ; erreur à code. |
| `reseauPages/graph.ts` | 62 | à adapter | `M/pages/follows.ts` | `personId`, `networkId`. |
| `reseauPages/access.ts` | 213 | à réécrire | `M/pages/access.ts` | Identité lue sur la page ; `servableUrl` ; autorité = signataires. |
| `reseauPages/pages.ts` | 630 | à réécrire | `M/pages/pages.ts` | Débit (`follow`, `unfollow`, `publishAsPage`, `removePagePost`) ; compteurs → agrégats ; abonnés notifiés par diffusion ; `discover` bornée. |
| `reseauPages/admin.ts` | 285 | à réécrire | `M/pages/admin.ts` + `signatories.ts` | Création par un membre ; signataires ; « Officiel » posé seulement par décision tracée (`isTrustAllowedForOwner`, PA2) ; audit (patron). |
| `reseauPages/followedUpdates.ts` | 138 | à adapter | `M/pages/followedUpdates.ts` | — |
| `reseauPages/manifest.ts` | 34 | exclu | — | — |

- **Tests.** `reseauPages/pages.test.ts` (1 400, 61) : à adapter (accord `communication.publish` → signataires) ;
  `followedUpdates.test.ts` (196, 3) : à adapter ; `tests/reseauPlatformActsAudit.test.ts` : patron.
- **Dettes.** D02, D05, D14.

### 6.16 `albums` (`M/albums/`)

| Source | l. | Sort | Cible | Adaptations |
|---|---:|---|---|---|
| `reseauAlbums/domain.ts` | 355 | tel quel | `SD/albums.ts` | Constantes de `reseauPersonnel/domain` rapatriées ; libellé « 20 Mo » → code + paramètre ; consommé par le front (`ALBUM_ITEMS_MAX`, `ALBUM_TITLE_MAX`). |
| `reseauAlbums/validators.ts` | 56 | tel quel | `M/albums/validators.ts` | — |
| `reseauAlbums/tables.ts` | 90 | à adapter | `M/albums/tables.ts` | `networkId`, `ownerPersonId`, index `by_owner` sur les items. |
| `reseauAlbums/access.ts` | 112 | à adapter | `M/albums/access.ts` | `servableUrl` ; helpers du graphe du moteur. |
| `reseauAlbums/albums.ts` | 737 | à adapter (lourd) | `M/albums/albums.ts` | Cascade bornée ; couverture dénormalisée ; débit sur les dix mutations ; notification à la publication. |
| `reseauAlbums/manifest.ts` | 38 | exclu | — | — |

- **Tests.** `albums.test.ts` (792, 25) : à adapter, plus deux tests neufs (retenue d'une photo non analysée ;
  zéro orphelin après `remove`) ; `domain.test.ts` (345, 32) : tel quel.
- **Dettes.** D05, D09, D14.

### 6.17 `files` — garde des fichiers (`M/files/`)

| Source | l. | Sort | Cible | Adaptations |
|---|---:|---|---|---|
| `fileGuard/policy.ts` | 185 | à adapter | `SD/filePolicy.ts` (pur, importé par le front), réexporté par `M/files/policy.ts` | Absence de ligne = `pending` (retenue) ; sources sociales ; libellés « DSI » → codes. |
| `fileGuard/verdict.ts` | 65 | tel quel | `M/files/verdict.ts` | — |
| `fileGuard/inspect.ts` | 882 | tel quel (**copie binaire** : octets bruts de contrôle l. 814) | `M/files/inspect.ts` | — |
| `fileGuard/avProviders.ts` | 239 | à adapter | `M/files/avProviders.ts` | Fournisseur absent → verdict `error` hors développement. |
| `fileGuard/scan.ts` | 143 | tel quel (`"use node"`, `jszip`) | `M/files/scan.ts` | — |
| `fileGuard/tables.ts` | 132 | à adapter | `M/files/tables.ts` | `networkId`, `uploadedByPersonId` indexé ; `orgId`, `subjectDocumentId`, `quarantineDocumentId`, `previousFolderId` retirés ; index `by_network_status`, `by_uploader`. |
| `fileGuard/storageGuard.ts` | 132 | à adapter | `M/files/storageGuard.ts` | Ligne absente = retenue ; seul `getUrl` légitime du moteur. |
| `fileGuard/admission.ts` | 417 | à adapter | `M/files/admission.ts` | `isKeptApartStorage` (registres RH, signatures, marques officielles, courrier) → politique du moteur ; méta `networkId` ; coupe-circuit fail-closed. |
| `fileGuard/posedUploads.ts` | 102 | tel quel | `M/files/posedUploads.ts` | — |
| `fileGuard/posedImages.ts` | 50 | exclu | — | (Repris plus tard pour logo et bannière de page si besoin.) |
| `fileGuard/mutations.ts` | 406 | à adapter | `M/files/mutations.ts` | Sans quarantaine iDocument ; `releaseScan` par modérateur du réseau ; `requeueScan` par opérateur ; `_ageScanForTests` jamais exposée en production ; D31. |
| `fileGuard/queries.ts` | 192 | à adapter | `M/files/queries.ts` | Adhésion au lieu de `hasOrgAccess`. |
| `fileGuard/notify.ts` | 197 | à réécrire | `M/files/notify.ts` | Modérateurs du réseau, cloche et push. |
| `fileGuard/quarantine.ts` | 196 | exclu | — | Coffre iDocument. |
| `fileGuard/triage.ts` | 120 | exclu (V1) | — | IA. |
| `fileGuard/triageModel.ts` | 146 | tel quel, **option V2** | — | Non copié en PA3. |
| `lib/uploadPolicy.ts` | 399 | à adapter | `L/uploadPolicy.ts` | Usages sociaux seulement (D36) ; plus de repli sur le type MIME déclaré. |

- **Tests.** `avProviders.test.ts` (74, 6), `inspect.test.ts` (255, 20), `verdict.test.ts` (53, 5) : tels quels ;
  `fileGuard.test.ts` (443, 17) et `policy.test.ts` (74, 7) : à adapter en **inversant** les cas fail-open
  (l. 195-219 ; l. 15-20) ; `queries.rapport.test.ts` (262, 6) : à adapter ; `tests/uploadPolicy.test.ts` (253, 20) :
  à adapter ; `tests/uploadPolicyRatchet.test.ts` (159, 4) : à adapter, sans exception ;
  `tests/freshUploadRatchet.test.ts` (109, 3) et `tests/storageArgFreshnessRatchet.test.ts` (349, 3) : à porter ;
  `tests/fileGuardGateRatchet.test.ts` (93, 3) : **réécrit en liste noire**. Exclus : `notify.doublePoste`,
  `rhDossierLectureSentinelle`, `rhPiecesFreshness`, `aiCostUnit`, `iastedLanguageContractCoverage` ;
  `triageModel.test` : V2.
- **Crons.** `file-guard-retry-stale`, `file-guard-quarantine-purge`.
- **Dettes.** D05, D06, D31, D36.

### 6.18 `calls` — appels personnels 1:1 et de groupe (`M/calls/`)

| Source | l. | Sort | Cible | Adaptations, retraits |
|---|---:|---|---|---|
| `iappel/_deps.ts` | 13 | exclu | — | Frontière d'injection propre au socle ; le moteur importe ses constructeurs. |
| `iappel/admission.ts` | 404 | à simplifier | `M/calls/admission.ts` | Ordre `outside_relations` → `dnd` → `in_meeting` → `busy` → `offline` gardé ; horaires de poste, passe-droits d'autorité et de priorité, portée poste, secrétariat retirés ; phrases → codes. |
| `iappel/calls.ts` | 751 | à adapter | `M/calls/ringing.ts` | `listRinging`, `hold`, `resume` ; environnement, portée par rattachements, noms d'organisation, fonctions de poste, réunions instantanées, priorité, file et présence d'organisation retirés ; lectures de tickets bornées. |
| `iappel/capacity.ts` | 97 | à simplifier | `M/calls/capacity.ts` | `photographedGroupCallCapacity`, plancher 3, plafond 11 constant. |
| `iappel/evaluate.ts` | 1 074 | à simplifier (fort) | `M/calls/evaluate.ts` | Gardés : l. 72-223 (adaptées), `evaluateCallAdmission` sans organisation ni poste, `voicemailEnabledFor`, `insertRefusedCall` sans champs de routage, `notifyAutoDeclined`. Retirés : l. 397-868 (routage), l. 984-1008 (priorité). |
| `iappel/group.ts` | 354 | tel quel | `SD/callGroup.ts` | Pur, consommé aussi par le front ; `GROUP_CALL_INVITES_SCAN` 1 000 → 11 ; titre composé → code. |
| `iappel/groupCalls.ts` | 1 403 | à adapter | `M/calls/groupCalls.ts` | Verrous V08 à V17 levés ; blocage vérifié pour chaque invité (D13) ; débit ; table de participation (D27) ; push par invité borné. |
| `iappel/preferences.ts` | 277 | à adapter | `M/calls/preferences.ts` | Miroir vers `agentPresence` et portée du « ne pas déranger » retirés ; réponses rapides → i18n. |
| `iappel/presence.ts` | 357 | à réécrire | `M/calls/presence.ts` | `forMyConnections` (borné en amont), `offlineHints` ; `forOrgContacts`, `forOrgMembers` retirés. |
| `iappel/push.ts` | 84 | à simplifier | `M/calls/push.ts` | Priorité retirée ; URL par réseau ; titres côté service worker. |
| `iappel/ringExpiry.ts` | 67 | tel quel | `M/calls/ringExpiry.ts` | — |
| `iappel/scope.ts` | 258 | à simplifier | `SD/callJournal.ts` (pur, importé par le front), réexporté par `M/calls/journal.ts` | `categorizeCall` et `callSideOf` sans environnement ; `AUTO_DECLINE_REASONS` sans `secretariat_unavailable` ; portée (l. 86-127) et environnement (l. 129-219) retirés. |
| `iappel/tables.ts` | 312 | à simplifier (3 tables sur 6) | `M/calls/tables.ts` | `callInvites` (`meetingId` → `callId`), `callPreferences` (sans portée), `voicemails` (sans `scope`/`orgId`). |
| `iappel/validators.ts` | 243 | à simplifier | `M/calls/validators.ts` | Portées, environnement, politique de poste, autorité, priorité retirés. |
| `iappel/voicemail.ts` | 353 | à adapter | `M/calls/voicemail.ts` | Portée et organisation retirées ; URL ; libellés. |
| `iappel/manifest.ts` | 24 | exclu | — | Manifeste du moteur écrit à neuf. |
| `iappel/{agentAccess, authority, authorityResolve, hours, posteHours, postePolicy, priority, priorityCallers, priorityResolve, routing}.ts` | 3 352 | exclu | — | Affiliation, autorité, horaires de poste, politique de poste, priorité (ADR-0217), routage du secrétariat. |
| `functions/meetings.ts` | 3 103 | à réécrire (≈ 35 % réutilisable) | `M/calls/{direct.ts (callMember = callCitizenById + callByHandle), lifecycle.ts (join, leave, setCallRinging, declineCall), history.ts (listCallHistory), cleanup.ts (cleanupStaleCalls), token.ts (getAuthorizedForToken, getDisplayNameByAuthSubject)}` | Tableau export par export : annexe A4 §B.1. Exclus : réunions (`create`, `end`, `cancel`, `addParticipant`, `listByOrg`, `exportIcs`…), file d'appels, `callUser`, `callOrganization`, `callCitizenByEmail`, `callRequestAgent`, `callUserAsAdmin`, consentement d'enregistrement, `getActiveCallForUser`, `findRecallableMissedCall`. |
| `schemas/meetings.ts` | 353 | à réécrire | `M/calls/tables.ts` (`calls`) | 20 champs gardés + `networkId`, 26 retirés, index réduits (annexe A4, fin, point 2). |
| `schemas/agentPresence.ts` | 39 | à réécrire | `M/calls/tables.ts` (`personPresence`) | Sans `orgId`, `currentCallId(s)`, `dndUntil`. |
| `functions/agentPresence.ts` | 366 | à réécrire | `M/calls/presence.ts` | `heartbeat`, `setOffline`, nettoyage indexé par `lastHeartbeat` ; le reste (centre d'appels, pointage) exclu. |
| `actions/livekit.ts` | 830 | à simplifier | `M/calls/livekitActions.ts` | `requestToken` adapté (autorisation puis réveil, identité `call`, `attributes.personId` ; grant citoyen et « late joiner » iRéunion retirés ; codes `ConvexError` ; un seul `runQuery`) ; `verifyEgressWebhook` et `ingestEgressFile` → `live`. Exclus : EAU, PNPE, rendez-vous, supervision, enregistrement d'appel, Egress de messagerie vocale. |
| `lib/livekit.ts` | 61 | tel quel | `L/livekit.ts` | — |
| `lib/livekitWake.ts` | 117 | tel quel | `L/livekitWake.ts` | — |
| `lib/livekitIdentity.ts` | 112 | à simplifier | `L/livekitIdentity.ts` | Identité `call` seule. |
| `lib/presenceTransitions.ts`, `actions/pnpeLivekit.ts` | 148 | exclu | — | Pointage, PNPE. |

- **Tests** (gardés / adaptés / exclus, détail annexe A4) : `group.test` (273, 24) tel quel ; `admission.test` (668, 56)
  ≈ 26 cas retirés ; `capacity.test` (102, 12) −5 ; `evaluate.test` (759, 27) −4, 5 à adapter ; `scope.test` (219, 24)
  −14 ; `calls.test` (706, 25), `groupCalls.test` (1 904, 58), `preferences.test` (427, 18), `ringExpiry.test`
  (139, 2), `voicemail.test` (555, 18), `voicemail.adoption.test` (267, 4) : à adapter ; `presence.test` (587, 24) :
  à réécrire ; `lib/livekit.test` (112, 7), `livekitWake.test` (169, 10) : tels quels ; `livekitIdentity.test`
  (196, 14) : simplifié ; `tests/callJournalAndDecline` (332, 12), `tests/livekitTokenIssuance` (233, 5) : à
  adapter ; `tests/callCapacitySettings` (254, 9) : simplifié ; `newAgentCalls.test` (232) : réécrit sur
  `callMember` ; appels de fil de `groupes.test` (≈ 31 références) et `callByHandle` de `messagerie.test` : rapatriés
  ici. Exclus : `authority`, `authorityResolve`, `hours`, `posteHours`, `postePolicy`, `priority*`, `routing*`,
  `callCrossEnvironment`, `meetingsJoinPolicy`, `meetingsCollaboration` (sauf 3 cas), `appelDunPosteTrace`,
  `contactResolution`, `gabaosIastedGuard`, `vpgCollaborationEndToEnd`.
- **Verrous « agent » levés** (liste fermée V01 à V34, annexe A4, fin) : un membre appelle un membre ; groupe ad hoc
  sans organisation ; présence par personne ; ni affiliation, ni poste, ni environnement, ni priorité.
- **Crons.** `cleanup-stale-calls` (30 s), `cleanup-stale-presence` (60 s).
- **Variables** (noms seulement, posées par le propriétaire) : `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`,
  `LIVEKIT_WS_URL`, `LIVEKIT_WAKE_URL`, `LIVEKIT_WAKE_TOKEN`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`.
- **Dettes.** D02, D11, D13, D14, D26, D27.

### 6.19 `live` — conférences en direct (`M/live/`)

| Source | l. | Sort | Cible | Adaptations |
|---|---:|---|---|---|
| `direct/{antenna (1 186), comments (235), delegations (271), grants (182), hostPresence (178), invitationSettle (147), moderation (385), permissions (207), presence (147), reactions (144), reap (304), replay (569), replayComposition (546), retention (48), speakers (397)}.ts` | 4 946 | tel quel | `M/live/<même nom>.ts` | Limiteurs `directComment`, `directReaction`, `directAntennaRequest`, `directAntennaInvite` repris dans `L/rateLimit.ts`. |
| `direct/access.ts` | 828 | à adapter | `M/live/access.ts` | `isPublicUser` → adhésion (V35) ; audience « organisation » → page (V36) ; compteurs hors de la session (D28). |
| `direct/sessions.ts` | 2 365 | à adapter | `M/live/sessions.ts` | Page au lieu de l'organisation, rôle de page au lieu de `communication.publish`, cloche aux abonnés de la page, découverte préfixée par le réseau (V37) ; débit sur `create`. |
| `direct/invitees.ts` | 767 | à adapter | `M/live/invitees.ts` | Organisation retirée (V39) ; débit sur `add`. |
| `direct/revocation.ts` | 227 | à adapter | `M/live/revocation.ts` | `kickUserFromOrgDirects` → retrait de page, « devient citoyen » → perte d'adhésion (V38). |
| `direct/domain.ts` | 521 | à adapter | `SD/live/domain.ts` | Audience « organisation » → page (V40). |
| `direct/tables.ts` | 563 | à adapter | `M/live/tables.ts` | 12 tables ; `pageId` vers `pages` du moteur ; `networkId`. |
| `direct/validators.ts` | 344 | à adapter | `M/live/validators.ts` | Audience « organisation » retirée. |
| `direct/manifest.ts` | 34 | exclu | — | Manifeste du moteur écrit à neuf. |
| `actions/livekitDirect.ts` | 800 | tel quel | `M/live/livekitActions.ts` | Erreurs à code ; motifs → codes ; configuration Egress factorisée. |
| `lib/egressFileTransfer.ts` | 523 | tel quel | `L/livekitEgressFileTransfer.ts` | — |
| `lib/egressRouting.ts` | 53 | à simplifier | `L/livekitEgressRouting.ts` | Branche `directs/` seule. |
| `lib/egressUploads.ts` | 86 | à adapter | `L/livekitEgressUploads.ts` | Politique de téléversement du moteur. |
| `lib/egressWebhook.ts` | 288 | à simplifier | `L/livekitEgressWebhook.ts` | Propriétaires et routes réduits au direct. |
| `http.ts` (route `POST /webhooks/livekit-egress`, l. 1311-1444, ≈ 170 l.) | 170 | à simplifier | `convex/http.ts` | Propriété limitée au direct. |

- **Modules importés par le front** : `permissions`, `replayComposition`, `domain` et les constantes d'`antenna`
  (importées par `DirectAntennaPanel`) sont purs ou extractibles : ils vont dans `SD/live/`, réexportés par
  `M/live/` ; le front n'importe jamais `convex/`.
- **Tests** (21 fichiers, 12 157 l., 340 cas) : tous gardés ; `organisationAccess.test` (539, 10) et
  `revocation.test` (283, 5) **réécrits** (page et adhésion) ; `direct.test` (1 561, 50), `invitees.test` (1 345, 30),
  `invitationSettle.test` (565, 5), `replayPublication.test` (770, 16), `antenna.test` (cas de page) : à adapter ;
  les autres tels quels. Bibliothèques : `egressFileTransfer.test` (410, 16) tel quel ; `egressRouting.test`
  (37, 3), `egressWebhook.test` (178, 11), `tests/livekitEgressWebhook` (564, 22) : simplifiés.
- **Crons.** `reap-stale-directs` (60 s), `purge-expired-direct-replays` (1 h), `reconcile-direct-replays` (15 min).
- **Dettes.** D14 (`sessions.create`, `invitees.add`, battements de présence, `requestDirectToken`), D28.

### 6.20 `federation` — fédération entrante (`M/federation/`, PA5 et PA9)

| Source | l. | Sort | Cible | Adaptations |
|---|---:|---|---|---|
| `reseau/federationTables.ts` | 104 | patron | `M/federation/tables.ts` | Résultats génériques (`networkId`, identifiants polymorphes) ; lettres mortes en enveloppe opaque, avec rétention (D33). |
| `reseau/federationProtocol.ts` | 160 | à adapter (l. 105-151 telles quelles) | `M/federation/protocol.ts` | `computeReceiptKey`, `canonicalStringify`, `sha256HexWebCrypto`, `eventDigest` ; constantes, type d'entrée et `federatedAuthId` réécrits ; signature HMAC ou Ed25519 et fenêtre anti-rejeu ajoutées ; le type importé de `@workspace/federation-contracts` est recopié dans `SC/federation.ts` (aucun import inter-produit). |
| `reseau/federation.ts` | 482 | patron | `M/federation/inbox.ts` + `http.ts` | Reçu d'abord, traitement, reçu, fermeture des lettres mortes, audit ; rejeu `deduplicated`/`reprocessed`/`still_failing`. `resolveFederatedAgent` (qui crée `orgs`, `users`, `memberships`) n'est **pas** repris : aucun profil ni adhésion d'office ; dispatch par type vers reflets et attestations. |
| `lib/ndjobi/webhook.ts` + `http.ts:3161-3240` | — | patron | `M/federation/http.ts` | Inbox HTTP signée : blocage IP, seau IP, corps lu en texte, vérification, idempotence. |
| `functions/authRateLimit.ts` | 136 | patron | `L/rateLimit.ts` | Seau IP de l'inbox. |

- **Tests.** `federationProtocol.test` (158, 12) : portable avec le contrat ; `federation.test` (483, 12) et
  `tests/federationReseauSocial` (352, 5) : administratifs → tests neufs ; `membershipStatusRatchet`,
  `rattachementLegalRatchet` : exclus.

---

## 7. Front, tranche par tranche (PA6)

Toutes les listes ci-dessous sont **exhaustives** ; le détail de chaque fichier (rôle, imports, appels `api.*`,
points d'accroche ligne à ligne, littéraux, couleurs) est dans l'annexe indiquée. Cible par défaut : même chemin
relatif sous `SF/f/<tranche>/`.

### 7.0 Modules serveur que le front importait (sortent du backend)

Le front du socle importe `@convex/*` directement ; celui d'ANTIA n'importe jamais `convex/` : ce qu'il lisait
passe dans les paquets (PA2 pour les modules purs, PA3 à mesure que les modules arrivent).

| Import du socle | Consommateurs front | Cible |
|---|---|---|
| `@convex/_generated/api` | ≈ 80 fichiers (réseau personnel 33, messagerie 14, iappel 16, direct 10, stories 5, notifications 6, hôtes et hooks) | `@antia/api` (références typées) |
| `@convex/_generated/dataModel` (`Id<…>`) | ≈ 65 fichiers | alias d'identifiants de `SC/` |
| `@convex/modules/reseauPersonnel/domain` | `RichText`, `useMediaDraft`, `groupe-gestion`, `StoriesTray`, `StoryCreateSheet`, `StoryViewer`, `stories-viewer`, `story-create`, `story-video-policy` (+ 2 tests) | `SD/{content, richText, stories, groupThreads}.ts` |
| `@convex/modules/reseauPersonnel/media` (type `PostMediaDto` seul) | `PostCard`, `PostMedia` | `SC/media.ts` |
| `@convex/modules/reseauAlbums/domain` | `AlbumComposer`, `album-model` | `SD/albums.ts` |
| `@convex/schemas/messageReactions` | `MessageActionsSheet`, `MessageBubble`, `MessagerieConversationView` | `SC/messageReactions.ts` |
| `@convex/schemas/chatMessages` (`MESSAGE_EDIT_WINDOW_MS`) | `MessageBubble`, `message-actions.test` | `SC/messaging.ts` |
| `@convex/modules/reseauPersonnel/messagerie` (types de curseurs) | `messagerie-source` | `SC/messaging.ts` |
| `@convex/modules/reseauPersonnel/messagerie/attachments` | `MessagerieConversationView`, `messagerie-composer` | `SC/attachments.ts` |
| `@convex/modules/fileGuard/policy` | `MessageAttachment`, `MessagerieConversationView` | `SD/filePolicy.ts` |
| `@convex/lib/groupCapacity` | `groupe-composeur`, `group-call-capacity`, `global-call-surface-host` | `SC/groupCapacity.ts` |
| `@convex/modules/iappel/group` | `groupe-appel-selection`, `call-seats`, `group-call-capacity` | `SD/callGroup.ts` |
| `@convex/modules/iappel/scope` | `call-journal` | `SD/callJournal.ts` (`callSideOf` sans environnement) |
| `@convex/modules/iappel/validators` | `dnd-presets`, `ReponsesRapidesSection` | constantes → `SC/calls.ts` ; validateurs dans `M/calls/validators.ts` |
| `@convex/modules/direct/{antenna, permissions, domain, replayComposition}` | `DirectAntennaPanel`, `DirectCommentsPanel`, `ParticipantsPanel`, `direct-audience`, `direct-role`, `ReplayManagementPanel` (+ tests) | `SD/live/` |
| `@convex/lib/scheduleMatching` | `PosteHoursSection`, `poste-hours-form` (retirés) | — |

### 7.1 `reseau-personnel` (annexe A5 §2-§4)

- **Tel quel (17)** : `ProfilFrame`, `Avatar`, `DiscoveryEmptyCard`, `ReseauPaginatedErrorBoundary` (→ `SF/shell/`),
  `use-creation-controller`, `dual-pagination-pages`, `post-media-carousel`, `query-state` (→ `SF/shell/`),
  `reseau-header` (→ `SF/shell/`) ; `mobile/` : `ImmersiveOverlay` (→ `UI/overlay/`), `ReseauMobileShell`,
  `VerticalPager`, `useIsReseauMobile`, `useVisualViewport` (→ `SF/shell/mobile/`) ; `mobile/gestures/` : `index`,
  `swipe`, `usePointerSwipe` (→ `SF/shell/mobile/gestures/`).
- **À adapter (67)** : `ProfilPersonnePage`, `FeedPages`, `PostCard`, `PostComposer`, `PostMedia`, `PostOverflowMenu`,
  `PostReactionControl`, `CommentsSurface`, `SharePostDialog`, `ReportContentDialog`, `RichText`, `PeoplePanel`,
  `SuggestionsPanel`, `RelationPicker`, `ContactsRail` (orphelin, facultatif), `GroupsPanel`, `DirectsPanel`,
  `DirectsLiveRail`, `EvenementsPanel`, `EvenementsRail`, `AnnounceEventDialog`, `BookmarksPanel`, `ProfileMiniCard`,
  `ProfilePublicationCard`, `HandleChoiceCard`, `ProfilReseauSection`, `PrivacyLists`, `ReseauMenuRail`,
  `ReseauDesktopIcomLink`, `ReseauQueryError` (ces trois → `SF/shell/`), `useReseauFeedState`,
  `use-dual-connection-pagination`, `use-profile-onboarding`, `use-relation-search`, `useMediaDraft`,
  `post-draft-store`, `author-link`, `bookmarks-panel`, `contacts-rail`, `creation-controller`, `design-styles`
  (→ `SF/shell/`), `directs-panel`, `empty-states`, `evenements-list`, `feed-scopes`, `groupes-thematiques`,
  `people-panel`, `post-composer-target`, `post-draft`, `post-overflow`, `profil-personne`, `profile-onboarding`,
  `relation-picker`, `reseau-feed-pages`, `reseau-layout`, `reseau-menu` (ces deux → `SF/shell/`), `shared`,
  `suggestions-actions` ; `mobile/` : `PostComposerSheet`, `ReseauMobileCreateButton`, `ReseauMobileFeed`,
  `ReseauMobileHeader`, `ReseauMobilePage`, `ReseauMobileTabBar`, `mobile-shell`, `mobile-styles`,
  `useBodyScrollLock` (coque → `SF/shell/mobile/`).
- **À réécrire (6)** : `ReseauAgentPage` (coque bureau, grille → `SF/shell/`), `index` (barrel),
  `profile-visibility-copy` (texte), `reseau-agent-nav` (adresses par `useRoutes`, → `SF/shell/`) ; `mobile/` :
  `ReseauMobileMenuSheet`, `reseau-mobile-tabs` (→ `SF/shell/mobile/`).
- **Réécrits à neuf sur `pages` du moteur, non copiés (6, 1 496 l.)** : `ProfilPagePage`, `PagesPanel`,
  `PageFollowButton`, `PagesSuggestionsRail`, `pages-panel`, `profil-page` (§1.16). Leurs branches dans `PostCard`,
  `PostComposer`, `post-draft`, `post-composer-target`, `shared`, `author-link`, `ReseauMenuRail`, `reseau-menu`,
  `reseau-agent-nav`, `reseau-layout`, `ReseauMobilePage` sont rebranchées sur la page générique.
- **Retirés (9, 3 582 l.)** : administratifs `MonProfilPage`, `ProfilProfessionnelSection`, `iprofil-form`,
  `iprofil-sections`, `parcours-model` ; orphelins `MonReseauCard`, `NotificationsPanel` (son test va vers
  `notifications`) ; utilitaires d'iProfil `anchor-settle`, `use-section-follower`. Un « Mon profil » social est bâti
  sur `ProfilReseauSection`.
- **Tests (65 · 14 178 · 957 cas).** Suivent leur source ; retirés avec elle : `MonProfilPage.sections`,
  `PagesPanel`, `use-section-follower`, `anchor-settle`, `iprofil-form`, `iprofil-sections`, `pages-panel`,
  `parcours-model`, `profil-page`. Les 11 cliquets qui relisent le source (`tablist-contract`, `empty-states`,
  `iprofil-sections`, `parcours-model`, `people-panel`, `profile-visibility-copy`, `reseau-layout`,
  `reseau-query-states`, `reseau-rendering-contract`, `reseau-v2-consumers`, `reseau-mobile-tabs`) sont repointés sur
  les chemins du moteur ; ceux qui lisent la coque ou iAsted sont réécrits.
- **Contrats.** `@convex/modules/reseauPersonnel/domain` (`splitBodyRich`, constantes `POST_*`) → `SD/` ;
  `PostMediaDto` (type seul, `media.ts` n'est pas pur) → `SC/media.ts` ; `@convex/modules/reseauAlbums/domain` →
  `SD/albums.ts` ; `_generated/api` (33 fichiers) → `@antia/api` ; `_generated/dataModel` (18 fichiers,
  `import type { Id }`) → alias de `SC/`.
- **Parité backend** : 71 fonctions `api.modules.reseauPersonnel.*` + `reseau.connections.withAgent` +
  `direct.sessions.{listLive, listReplays, listMinePage}` (liste fichier:ligne, annexe A5 §9). `paginateMine` et
  `paginatePendingForMe` de `modules/reseau` ne servent que l'annuaire administratif : non reprises.

### 7.2 `reseau-albums` (annexe A5 §5)

- **À adapter (5)** : `AlbumComposer`, `AlbumPage`, `AlbumsSection`, `album-model` (adresses `/espace/profil/…/albums`),
  `index`. **À réécrire (1)** : `albums-api` (13 `makeFunctionReference` → API typée ; DTO → `SC/albums.ts`).
- **Tests (4 · 1 181 · 69 cas)** : suivent leur source.

### 7.3 `messagerie` (annexe A6 §2)

- **Tel quel (37)** : `ForwardMessageSheet`, `GroupCallInviteePicker`, `GroupeAvatar`, `IcomAppelJournal`
  (rappel par `calls.callMember`), `IcomBrickHeader`, `IcomPublicReminders`, `MessageActionsSheet`,
  `MessagerieComposePage`, `MessagerieComposeView`, `MessagerieGroupeCompose`, `MessagerieGroupeInvitations`,
  `MessagerieGroupeInvite`, `NewMessagesPill`, `PinnedMessageBanner`, `ReplyPreview`, `VoiceRecorderButton`,
  `call-actions`, `conversation-scroll`, `groupe-appel-selection`, `groupe-composeur`, `groupe-creation`,
  `groupe-invitation-link`, `groupe-liste`, `groupe-ressources`, `icom-dock`, `icom-public-reminders`,
  `messagerie-bulles`, `messagerie-composer`, `messagerie-dock`, `messagerie-erreur`, `messagerie-media-draft`,
  `messagerie-recipients`, `messagerie-typing`, `messagerie-views`, `use-infos-panneau`, `use-messagerie-router-nav`,
  `voice-note`.
- **TQ\*, branche poste élaguée à la copie (4)** : `ConversationHeader`, `MessagerieListView`, `forward-targets`,
  `messagerie-liste`.
- **À adapter (21)** : `IcomActusPanel`, `IcomRelationsPanel`, `MessageAttachment`, `MessageBubble`, `MessageComposer`
  (iDocument retiré), `MessagerieConversationPage`, `MessagerieConversationView` (lourd), `MessagerieDesktopPage`,
  `MessagerieDock`, `MessagerieGroupeInfos`, `MessagerieListPage`, `MessagesRoute`, `dock-store` (clés préfixées par
  le réseau), `groupe-gestion` (fuseau), `icom-desktop-entry`, `icom-mobile-tabs`, `message-actions`,
  `messagerie-routes` (base injectée, `hubChatHref` retiré), `messagerie-source` (`SOURCE_AGENT` seule),
  `messagerie-styles` (440×956), `transfert-api`.
- **À réécrire (2)** : `IcomMobileTabBar` (→ `SF/shell/mobile/`), `index`.
- **Retirés (3, 455 l.)** : `AttachFromVaultDialog`, `SaveToIDocumentDialog` (iDocument), `icom-hub-tabs` (hub
  administratif).
- **Tests (49 · 8 138).** Suivent leur source ; `icom-hub-tabs.test` retiré ; réécrits : `IcomMobileTabBar.test`,
  `icom-annuaire-frontiere` (moitié Relations), `messagerie-floating-contract` (440×956, sans `IcomPosteWindow`),
  `messagerie-source` ; adaptés : `IcomRelationsPanel`, `MessageComposer`, `MessagerieListView`, `call-channel`,
  `icom-desktop-entry`, `icom-mobile-tabs`, `message-actions`, `messagerie-conversation-filters`,
  `messagerie-query-states`, `messagerie-routes`.

### 7.4 `iappel` (annexe A6 §3)

- **Tel quel (44)** : `CallConnectionQuality`, `CallControlButton`, `CallMinimizedPill`, `CallSurface`,
  `ConferenceHintCard`, `GroupCallGrid`, `HeldCallChips`, `LocalPip`, `RemoteVideoStage`, `SpeakerPickerPanel`,
  `VoicemailRecorder`, `audio-route`, `call-controls`, `call-host-store`, `call-kind-reconcile`, `call-line-sync`,
  `call-media-live`, `call-seats`, `call-timer`, `conference-hint`, `group-call-capacity`, `group-stage`,
  `incoming-group`, `media-errors`, `media-watchdog`, `participant-identity`, `remote-video`, `use-call-line-sync`,
  `use-camera-flip`, `use-ring-vibration`, `use-speaker-output`, `use-stage-size`, `useRingRelation`,
  `surface-drag`, `use-surface-drag`, `use-surface-insets` (trois relais vers `floating-surface`) ; `settings/` :
  `AppelEnAttenteSection`, `AppelsHorsRelationsSection`, `MessagerieVocaleSection`, `NotificationsPushSection`,
  `PresencePartageeSection`, `ReponsesRapidesSection`, `SonnerieSection`, `push-copy`.
- **TQ\*, branche poste élaguée à la copie (13)** : `CallEndScreen`, `CallStage`, `CallWaitingChip`, `IappelJournal`,
  `IncomingCallBanner`, `IncomingCallCard`, `add-to-call-candidates`, `call-host`, `call-inbox`, `call-peer`,
  `call-phase`, `call-surface-plan`, `call-types`.
- **À adapter (13)** : `AddToCallPanel` (relations seules), `call-journal`, `conference-launch-store`, `dnd-presets`,
  `my-presence-row` (→ `SF/shell/account/`), `presence-dot` (`useConnectionsPresence` seul), `ringing-signal`,
  `settings/DisponibiliteSection`, `settings/settings-surface`, `use-call-slot-connector`, `use-iappel-actions`,
  `use-incoming-calls`, `use-launch-conference` (branche personnelle seule).
- **À réécrire (2)** : `index`, `settings/index`.
- **Retirés (11, 2 775 l.)** : `GroupCallLauncher`, `call-environment`, `queue-ring` ; `settings/` :
  `PolitiqueAppelSection`, `PosteHoursSection`, `PostePicker`, `PrioritairePicker`, `PrioritairesSection`,
  `poste-hours-form` (en extraire `formatLocalTime`), `poste-policy-model`, `prioritaires-model`.
- **Tests (42 · 9 941).** Suivent leur source ; retirés : `call-environment`, `queue-ring`, `PolitiqueAppelSection`,
  `PrioritairesSection`, `poste-hours-form`, `poste-policy-model`, `prioritaires-model` ; **réécrit** :
  `iappel-surface.ratchet` (1 677 l., 96 cas : il lit la coque, iAsted et le centre d'appels).
- **Paquet `livekit`** (8 sources, 813 l. + `csp.mjs` 90 l.) : tel quel vers `packages/livekit` ; l'URL LiveKit
  par défaut codée dans `csp.mjs` est retirée (variable obligatoire) ; variante de sonnerie « poste » inerte.

### 7.5 `direct` (annexe A6 §4.1)

- **Tel quel (42)** : `AntennaInvitePicker`, `DirectAntennaPanel`, `DirectCommentsPanel`, `DirectControls`,
  `DirectDialog`, `DirectExitDialog`, `DirectFloatingCard`, `DirectInviteDialog`, `DirectInviteesPanel`, `DirectPage`,
  `DirectParticipantsPanel`, `DirectPreflightPanel`, `DirectPresentationTile`, `DirectReactionsBar`, `DirectScene`,
  `DirectSidePanel`, `DirectStudioLayout`, `DirectViewMenu`, `ReplayDecisionDialog`, `direct-antenna`,
  `direct-call-coexistence`, `direct-comments`, `direct-conference-prefill`, `direct-controls`, `direct-exit`,
  `direct-floating-styles`, `direct-host-presence`, `direct-immersive`, `direct-preflight`, `direct-presence`,
  `direct-rail`, `direct-reactions`, `direct-role`, `direct-scene-styles`, `direct-scene`, `direct-stage-format`,
  `direct-status`, `direct-view`, `index`, `use-direct-exit`, `use-direct-fullscreen`, `use-direct-session`.
- **À adapter (8)** : `CreateDirectDialog` (route), `ParticipantsPanel` (références résolues par chaîne → typées),
  `ReplayManagementPanel`, `direct-audience` (« organisation » → page), `direct-floating` (routes),
  `direct-playback` (fuseau, libellé d'organisation), `use-direct-host-heartbeat`, `use-direct-presence`
  (`makeFunctionReference` → typées).
- **Tests (38 · 9 207).** Suivent leur source ; `direct-room.ratchet` réécrit (il vise la coque) ;
  `direct-antenna.test` lit `convex/` par chemin relatif : repointé.

### 7.6 `stories` (annexe A6 §4.2)

- **Tel quel (16)** : `LiveDirectSlide`, `StoriesTray`, `StoryCreateSheet`, `StoryProgressBar`, `StoryRing`,
  `StoryViewer`, `StoryViewersSheet`, `index`, `stories-entry`, `stories-progress`, `stories-styles`, `stories-tray`,
  `stories-viewer`, `story-video-codecs`, `story-video-policy`, `story-video-probe`.
- **À adapter (3)** : `StoriesViewerPage` (routes), `StoryOverlay` (route de profil), `story-create` (libellés de
  surface).
- **Tests (6 · 1 537)** : tels quels.

### 7.7 `notifications` (annexe A6 §4.3)

- **Tel quel (2)** : `NotificationsList`, `ReseauNotificationRow`.
- **À adapter (3)** : `NotificationBell` (une seule source, montée par la coque), `notification-center-store`,
  `notification-targets` (routes).
- **À réécrire (3)** : `NotificationsCenter` (onglet Réseau seul), `index`, `notification-center-tabs`.
- **Retirés (8, 1 203 l.)** : `AdministrationNotificationRow`, `AdministrationNotificationsList`,
  `notification-icons`, `notification-links`, `notification-open`, `notification-presentation`,
  `notification-routes-context`, `use-administration-notification-actions`.
- **Tests (8 · 2 470)** : `notification-links`, `notification-open`, `notification-presentation` retirés ;
  `NotificationBell`, `NotificationsCenter`, `notification-center-tabs` réécrits ; `notification-center-store`,
  `notification-targets` adaptés.

### 7.8 Primitives, hôtes, stores, hooks, application (annexe A6 §5)

| Élément | Sort | Cible |
|---|---|---|
| `components/espace-kit/*` (10 fichiers, 1 115 l.) | tel quel | `UI/espace-kit/` |
| `features/floating-surface/*` (5 fichiers, 1 163 l.) | tel quel (`use-surface-insets` à adapter : sélecteurs fournis par la coque) | `SF/shell/floating-surface/` |
| `EspaceFloatingCard.tsx` · `floating-card.ts` | à adapter · tel quel | `SF/shell/floating-card/` |
| `shell/poste-breakpoint.ts` (≤ 959 px) | à adapter (renommé) | `UI/overlay/` |
| `shell/global-call-surface-host.tsx` (1 037 l.) | à adapter (lourd) : branche v2 seule ; poste, file, réunions, iAsted retirés | `SF/shell/communication/` |
| `shell/direct-session-host.tsx` | tel quel | `SF/shell/communication/` |
| `shell/conference-launch-host.tsx` | à adapter (toujours « foyer ») | `SF/shell/communication/` |
| `components/call-center/CallRoomMount.tsx` (483 l.) | à adapter (pont iAsted retiré) | `SF/f/iappel/` |
| `components/direct/{DirectCallCoexistence, DirectRoomMount, DirectSessionLeases}.tsx` | tel quel | `SF/f/direct/room/` |
| `stores/{call-store, direct-session-store}` | à adapter (file d'appels et iAsted retirés) | `SF/stores/` |
| `stores/{call-room-registry, direct-room-registry}` | tel quel | `SF/stores/` |
| `stores/{active-meeting-store, iasted-ask-store, page-context-store}` | retirés | — |
| `stores/index` | à réécrire | `SF/stores/` |
| `hooks/use-agent-presence.ts` | **à réécrire** (présence sans organisation ; inactif aujourd'hui sans organisation) | `SF/shell/presence/` |
| `hooks/{use-ringtone-muted-pref, ringtone-pref, use-call-push, useDebouncedValue}` | à adapter (nommage) · tel quel | `SF/f/iappel/hooks/`, `UI/` |
| `hooks/{use-active-meeting-connection, use-call-center, useContactSearch}` | retirés (`useOrg()` lève hors `OrgProvider`) | — |
| `lib/call-errors.ts` · `lib/push-subscription.ts` | tel quel · à adapter (service worker par réseau) | `SF/f/iappel/`, `SF/shell/push/` |
| app espace : `layout.tsx` | à réécrire (marque du réseau) | application du réseau |
| app espace : `components/providers.tsx` | à adapter | `SF/shell/providers/` |
| app espace : `lib/convex-provider.tsx` · `lib/auth-client.ts` | tel quel · à adapter | `API/next-provider.tsx`, `API/` |
| app espace : `components/app-layout.tsx` (AppShell) · `lib/push-subscription.ts` | retirés (coque légère) | — |
| app espace : `public/sw-push.js` | à adapter (marque, icône, routes du réseau) | `public/` de chaque application |
| paquet `api` : `hooks`, `stable-convex-better-auth-provider`, `cross-domain-session-bootstrap`, `index` | tel quel | `API/` |
| paquet `api` : `provider` (fusion avec la variante Next), `sign-out-everywhere` (préfixes de stockage du moteur), `auth-client` | à adapter | `API/` |
| paquets `routing` (adaptateur Next) · `chat` (`use-idempotency-key`, `use-chat-attachments`) · `sso` (passage entre applications, PA4) · `i18n` (dictionnaire réduit) | tel quel · tel quel · tel quel · à adapter | `API/` ou paquet dédié |

**Contrat de la coque légère** (sans AppShell) : ordre des providers (`<html>` avec polices et `viewportFit: "cover"`,
`ThemeProvider`, `I18nextProvider`, `AppConvexProvider` = TanStack + `StableConvexBetterAuthProvider` + synchronisation
de la personne, `NextRouterAdapter`, `Toaster`, porte d'authentification `useStableConvexAuth`, **`NetworkProvider`**
qui remplace `OrgProvider` — ses consommateurs ne lisent que `personalMode = true`, `personalSpaceIsElsewhere = false`,
`activeOrgId = null`, plus les bases de route et les libellés du réseau) ; points de montage uniques (couche de
communication, dock sous `<Suspense>`, cloche, battement de présence, barre mobile ≤ 959 px) ; magasins en une seule
copie du bundle ; contrats DOM et CSS (`data-charte` redéclaré par les portails, pile de `z-index`, variables
`--vv-height`, `--iappel-bottom-inset`…) ; routes servies, injectées et non codées en dur. Détail : annexe A6 §7.5.

---

## 8. Cliquets à poser ou à réécrire

| Cliquet | Quand | Rôle |
|---|---|---|
| `network-scoped-functions` | livré (PA2) ; liste des dossiers sociaux étendue à chaque module | Toute fonction publique d'un module social appelle `requireMembership` ou est marquée `@publicProjection`/`@selfScoped` avec justification. |
| `file-delivery-gate` | PA3, avec `files` | Aucun `ctx.storage.getUrl` hors de `M/files/storageGuard.ts` (inverse du `fileGuardGateRatchet` du socle). |
| `fresh-uploads`, `upload-policy` | PA3 | Repris de `freshUploadRatchet`, `storageArgFreshnessRatchet`, `uploadPolicyRatchet` (sans exception). |
| `notification-writers` | PA3 | Patron de `notificationsWriterRatchet` : une seule porte d'écriture des notifications. |
| `rate-limited-writes` | PA5 | Toute mutation publique consomme un seau. |
| `sign-out-everywhere` | PA4 | Préfixes de stockage du moteur purgés à la déconnexion. |
| `no-espace-base`, `no-hardcoded-strings` étendu aux `.ts` | PA6 | Aucune base `/espace` ; aucune chaîne d'interface dans les modules `.ts` du front. |
| cliquets front du socle relus et réécrits | PA6 | `iappel-surface`, `messagerie-floating-contract` (440×956), `direct-room`, `direct-studio`, `messagerie-query-states`, `reseau-rendering-contract`, `reseau-layout`, `reseau-query-states`, `empty-states`, `tablist-contract`, `people-panel`, `profile-visibility-copy`, `reseau-v2-consumers`, `reseau-mobile-tabs`. |

---

## 9. Décisions par défaut prises par ce document

Elles appliquent le cahier là où le plan était muet ou contradictoire ; chacune peut être renversée par le
propriétaire sans reprendre l'inventaire.

1. PA2 porte cinq modules purs (pas huit) ; `validators`, `counters`, `contentRemoval` restent côté backend (§1.1).
2. Pages : backend réécrit (identité propre, signataires, revendications) ; écrans Pages réécrits sur ce backend,
   non copiés (§1.16).
3. iCal des évènements : différé (hors PA3).
4. Format téléphone unique 440×956.
5. Branches « poste » inertes (TQ\*) élaguées dans le commit de copie.
6. Modules purs consommés par le front et le backend (`callGroup`, `albums`, `live`, découpage de `domain`) : dans
   `social-domain` ; types, DTO et constantes de messagerie dans `social-contracts`.
7. Une seule table de notifications (cloche sociale) ; le centre de notifications administratif est exclu.
8. Appels et direct entrent dans le moteur (`calls`, `live`) ; iRéunion, le Standard, iAsted, le centre d'appels,
   la priorité et le routage de poste en sont exclus.
9. Les dettes « inventaire » du §5 qui touchent un invariant (refus indistinct, étanchéité, garde de délivrance,
   écriture bornée) sont corrigées en PA3, pas plus tard.
