---
title: "ANTSIA — Annexe A4 du document 02 : inventaire contradictoire, backend — appels personnels (iappel, meetings, présence), LiveKit et Egress, direct"
date: "2026-10-14"
source: "socle administration.ga, origin/main = ad2e7fdc2, copie propre (git worktree add), lecture seule"
statut: "Rapport d'inventaire brut, produit en lecture seule ; la synthèse décisionnelle est docs/02_OWNER_MAP_DUPLICATION.md"
---

> Annexe A4 de `docs/02_OWNER_MAP_DUPLICATION.md`. Les chemins sont relatifs à la racine d'une copie
> propre du socle sur `origin/main` (`ad2e7fdc2`). Les numéros de ligne valent pour ce commit. Quand une
> décision du document 02 diffère d'une proposition de ce rapport, c'est le document 02 qui fait foi.

# Inventaire contradictoire : appels personnels et direct (socle `ad2e7fdc2`, lecture seule)

Racine : `$S=<copie propre du socle>`. Tous les chemins sont relatifs à `$S`, et `cx/` désigne `socle/convex/`. Aucune écriture n'a été faite et aucune commande git, bun ou convex n'a été lancée.

**Légende SORT**
- **tel quel** : la logique ne change pas.
- **à adapter** : les gardes ou les clés changent, la logique est conservée.
- **à simplifier** : on retire des branches entières.
- **à réécrire** : refonte.
- **exclu** : non dupliqué.

**Substitutions mécaniques, valables pour tout fichier gardé (non répétées ensuite)**
- `v.id("users")` devient `v.id("persons")`.
- `ctx.user._id` devient la personne courante.
- `authQuery`/`authMutation` (`cx/lib/customFunctions`) sont remplacés par les constructeurs ANTSIA avec `requireMembership(ctx, networkId, minStatus)`.
- `networkId` est ajouté à chaque table et chaque ligne.
- Les noms viennent du profil `persons` au lieu de `reseauPersonnel/people.publishedMiniProfile` et de l'état civil `users.firstName/lastName`.
- Les identités LiveKit gardent le sujet d'auth en préfixe.

---

## A. `cx/modules/iappel/` — 26 sources (9 423 l.), 21 tests (10 325 l., 446 cas)

### A.1 Synthèse

| Fichier | l. | Rôle | SORT | Cible |
|---|---|---|---|---|
| `_deps.ts` | 13 | Frontière d'injection (ADR-0004) | à réécrire | `calls/_deps.ts` |
| `admission.ts` | 404 | Décideur PUR « l'appel sonne-t-il ? » | à simplifier | `calls/admission.ts` |
| `agentAccess.ts` | 51 | Garde « appelé affilié » | **exclu** (disparaît) | — |
| `authority.ts` | 218 | PUR, autorité organigramme | exclu | — |
| `authorityResolve.ts` | 279 | Lecture postes, tutelles et habilitations | exclu | — |
| `calls.ts` | 751 | `listRinging` + attente serveur | à adapter | `calls/ringing.ts` |
| `capacity.ts` | 97 | PUR, plafonds appel/réunion | à simplifier | `calls/capacity.ts` |
| `evaluate.ts` | 1 074 | Pont admission + routage secrétariat | à simplifier (fort) | `calls/evaluate.ts` |
| `group.ts` | 354 | PUR, état et grille de l'appel de groupe | tel quel | `calls/group.ts` |
| `groupCalls.ts` | 1 403 | Appels de groupe (fil, ad hoc, ajout, refus, grille) | à adapter | `calls/groupCalls.ts` |
| `hours.ts` | 372 | PUR, horaires de poste (UTC+1) | exclu | — |
| `manifest.ts` | 24 | Manifeste de tranche | à réécrire | `calls/manifest.ts` |
| `posteHours.ts` | 198 | API horaires de poste | exclu | — |
| `postePolicy.ts` | 740 | Politique de poste (filtre, secrétariat) | exclu | — |
| `preferences.ts` | 277 | Réglages d'appel d'une personne | à adapter | `calls/preferences.ts` |
| `presence.ts` | 357 | Présence des relations + présence d'org | à réécrire | `calls/presence.ts` |
| `priority.ts` | 260 | PUR, appels prioritaires (ADR-0217) | exclu | — |
| `priorityCallers.ts` | 899 | API des 3 échelons de priorité | exclu | — |
| `priorityResolve.ts` | 191 | Lecture des règles de priorité | exclu | — |
| `push.ts` | 84 | Web Push d'appel entrant | à simplifier | `calls/push.ts` |
| `ringExpiry.ts` | 67 | Extinction planifiée d'un ticket | tel quel | `calls/ringExpiry.ts` |
| `routing.ts` | 144 | PUR, routage secrétariat | exclu | — |
| `scope.ts` | 258 | PUR, portée, environnement, journal | à simplifier | `calls/journal.ts` |
| `tables.ts` | 312 | 6 tables | à simplifier (3 gardées) | `calls/tables.ts` |
| `validators.ts` | 243 | Validators et bornes | à simplifier | `calls/validators.ts` |
| `voicemail.ts` | 353 | Messagerie vocale d'un appel direct | à adapter | `calls/voicemail.ts` |

Bilan : 16 fichiers gardés (6 071 l.) et 10 exclus (3 352 l.).

### A.2 Détail par fichier

**`_deps.ts` (13)**
- Ré-exports : `authMutation`/`authQuery` (`lib/customFunctions`, L9), `getMembership` (`lib/auth`, L10), `loadLiveMemberships` (`appAccess/resolve`, L11), `getPositionContext` (`lib/positionContext`, L12), `error`/`ErrorCode` (L13).
- Accroches : L10-12 (rattachements et postes).
- Il faut y exposer `requireMembership` et les constructeurs ANTSIA.

**`admission.ts` (404)**
- Imports : `./hours`, `./scope`.
- Exports : `silenceApplies` L151, `labelOf` L159, `callerMessageFor` L175, `secretariatUnavailableMessage` L229, `filteredPosteMessage` L244, `decideCallAdmission` L284. Types : L63, L70, L76, L80, L124.
- Horaires de poste : L69-73, L84-85, L190-199, L351-376.
- Libellé de poste : L77, L160-169, L216-249.
- Passe-droits autorité/priorité : L98-111, L286, L312-325, L341, L368, L381, L394.
- Portée poste/personnel : L81, L151-156, L295.
- Secrétariat : L200-201, L229-249.
- Phrases en dur : L180-206, L232-233, L247-248.
- Dette : aucune (pur).
- À garder : l'ordre `outside_relations` → `dnd` → `in_meeting` → `busy` → `offline`.

**`agentAccess.ts` (51)**
- Exports : `CALL_AFFILIATION_REQUIRED` L5, `assertCallTargetAffiliated` L16-23, `hasCallAffiliation` L31-47 (memberships validées, L35-46), `SELF_CALL_NO_AGENT_SPACE` L50.
- Consommateurs : `functions/meetings.ts:1907` et `:2105-2106` ; `modules/reseauPersonnel/messagerie.ts:51` et `:1089` ; `messagerie.test.ts:20` et `:835`.

**`authority.ts` (218)** — exclu
- Import : `lib/correspondanceHelpers`.
- Exports : `apexPositionsOf` L156, `authorityLevelOf` L172, `bypassesFor` L203.

**`authorityResolve.ts` (279)** — exclu
- Imports : `lib/effectiveModulePolicies`, `lib/orgTutelle`, `iagenda/delegateHolding`, `messagerieScope/posteKey|posteResolve`, `./authority`, `./priority`, `./priorityResolve`.
- Exports : `resolveCallerAccess` L144, `calleeAncestorOrgIds` L263.

**`calls.ts` (751)**
- Imports L63-87 : `reseauPersonnel/people`, `./_deps` (`loadLiveMemberships`), `lib/postIdentity`, `./groupCalls`, `./scope`, `./validators`.
- Exports : `listRinging` L198 (authQuery), `hold` L563 (authMutation), `resume` L666 (authMutation).
- Environnement back-office/agent : L204, L231, L243, L332-345 (`BACKOFFICE_CALLER_TITLE`).
- Portée par rattachements : L279-284, L317-323, L392-398, L432-438.
- Noms d'org : L304-312, L361-366, L422-427.
- Fonctions de poste et routage : L287-295, L350-351, L409-412, L449-452, DTO L175-186.
- Réunions instantanées (`kind:"meeting"`) : L263-268, L418-456.
- Priorité : L347, L405, L445.
- File du centre d'appels : L494-502.
- Présence d'org (`mirrorPresenceActiveCall`) : L523-550.
- Dette : query réactive qui peut lire jusqu'à 2 × 1 000 tickets (`groupCalls.ts` L1318, L1369) avec un `db.get` par ticket. N+1 d'org et d'appelant par appel (borné à 20, L92).
- Dette : la fenêtre de 120 s (L90) est dupliquée dans `meetings.ts` L153 et L2755 et dans `ringExpiry.ts` L26.

**`capacity.ts` (97)**
- Import : `lib/groupCapacity`.
- Exports : ré-export `resolveGroupCallCapacity` L39, `GROUP_CALL_FLOOR` L43, `MEETING_FLOOR` L46, `PARTICIPANTS_CEILING` L53 (=1000), `MEETING_DEFAULT_MAX` L56, `resolveMeetingCapacity` L77, `photographedGroupCallCapacity` L93.
- Accroches : `org.settings.calls` L59-62 et L77-87 ; exemption back-office (dans le lib).
- À garder : `photographedGroupCallCapacity` et le plancher 3 ; plafond 11 constant (ou réglage réseau).

**`evaluate.ts` (1 074)**
- Imports L15-42 : `lib/auth` (getMembership), `lib/notify`, `lib/positionContext`, `lib/presenceTransitions`, `directory/holders`, `iagenda/delegateHolding`, `messagerieScope/*`, `./admission`, `./authorityResolve`, `./routing`, `./scope`.
- Exports :
  - `isCalleeKnownOffline` L72, `countCalleeActiveCalls` L99, `isInAcceptedMeeting` L148, `evaluateCallAdmission` L265 ;
  - `callPriorityOf` L519, `resolveAccessForPosition` L535, `resolveCallRouting` L622 ;
  - `voicemailEnabledFor` L879, `insertRefusedCall` L898, `notifyPriorityCallMissed` L984 ;
  - `notifyAutoDeclined` L1026 (privé).
- Présence d'org et de planning : L47-96 (`agentPresence by_user_and_org` L78-81, clientType planning L84-88, `pushSubscriptions` L91-95).
- Agenda de poste `iagenda_*` : L181-204.
- Portée, rattachement, horaires et poste : L282-342 ; « hors ligne » réservé au poste : L357-363.
- Routage complet : L397-868.
- Priorité : L519-524, L984-1008.
- Champs de routage : L911-921, L941-946.
- URL `/espace/messages?brique=iappel` : L1002, L1068.
- Libellés en dur : L995-1001, L1045-1066.
- Dette : budget de lectures par appelé (préférences + horaires + poste + org + appelé + agenda 4×10 + 2×10 appels + 50 présences + 1 push), multiplié par invité en groupe. Aucun limiteur de débit.
- À garder : L72-223 (adapté), `evaluateCallAdmission` sans org ni poste, `voicemailEnabledFor`, `insertRefusedCall` sans champs de routage, `notifyAutoDeclined`.
- À retirer : L397-868 et L984-1008.

**`group.ts` (354)** — tel quel
- Imports : `lib/groupCapacity`, `./scope` (type).
- Exports : `GROUP_CALL_MAX_PARTICIPANTS` L81, `GROUP_CALL_MIN_OTHERS` L91, `GROUP_CALL_INVITES_SCAN` L106 (=1000), `participantStateOf` L158, `summarizeGroupCall` L222, `reservesSeat` L266, `countReservedSeats` L271, `groupCallShouldEnd` L303, `composeGroupCallTitle` L319 (libellé en dur L327-330), `normalizeGroupInvitees` L340.
- Dette : la borne de balayage 1 000 sert l'exemption back-office ; à ramener à 11.

**`groupCalls.ts` (1 403)**
- Imports L46-89 : `lib/auth` (isBackOfficeUser), `lib/groupCapacity`, `lib/permissions` (canPlaceDirectCall), `lib/postIdentity`, `lib/userCategory` (isPublicUser), `reseauPersonnel/graph|people|groupes`, `./_deps`, `./admission`, `./evaluate`, `./push`, `./ringExpiry`, `./group`, `reseau/attachmentGate`.
- Exports Convex :
  - authMutation : `startFromThread` L451, `startAdHoc` L633, `addInvitee` L767, `decline` L1272 ;
  - authQuery : `listParticipants` L1095, `myCallCapacity` L1189, `threadCallCapacity` L1224.
- Helpers exportés : `loadGroupParticipants` L140, `endGroupCallIfDeserted` L178, `markGroupInviteJoined` L213, `describePerson` L235, `declineGroupInvite` L1254, `loadRingingGroupCalls` L1301, `loadRingingMeetingInvites` L1352, `expireRingingInvites` L1394.
- Verrous et accroches : voir V08 à V17 en fin de rapport. Couplage au fil `reseauPersonnel` : L486-490, L510, L601-612, L1152-1156. Réunions instantanées : L1352-1386.
- Dette : `invitesOf` lit jusqu'à 1 000 lignes (L129) ; tickets lus par 1 000 (L1318, L1369).
- Dette : réécriture du tableau `meetings.participants` à chaque ajout (L973-978, L1039-1045), document chaud.
- Dette : aucun limiteur de débit sur `startAdHoc`, `addInvitee`, `startFromThread` ; un push par invité (L425-430, L1071-1077).
- **Trou** : aucun contrôle `isBlockedBetween` sur les invités ad hoc (L694-713) ni sur le chemin d'org d'`addInvitee` (L838-850). À ajouter dans ANTSIA.

**`hours.ts` (372)** — exclu
- Fuseau UTC+1 fixe (`lib/eauHoraires` `LIBREVILLE_UTC_OFFSET_MS`) : L7-16, L27-32, L113-141.

**`manifest.ts` (24)**
- `canonicalRoute` `/espace/messages?brique=iappel` L19 ; dépendances `meetings`, `organigramme`, `agentPresence`, `reseauPersonnel` L20 ; `taskCodes` vide L21.

**`posteHours.ts` (198)** — exclu
- Exports : `listMine` L84 (Q), `upsert` L123 (M). Importe `schemas/agentSchedules` et, via `_deps`, `getMembership`, `getPositionContext`, `loadLiveMemberships`.

**`postePolicy.ts` (740)** — exclu
- Exports : `requirePosteHolder` L187, `resolveMyPosition` L378, `getForMyPoste` L422 (Q), `upsert` L521 (M), `authoritiesPreview` L657 (Q), `listClusterOrgs` L727 (Q).

**`preferences.ts` (277)**
- Imports : `./_deps`, `./validators`.
- Exports : `getMine` L77 (Q), `setDnd` L133 (M), `update` L190 (M), `markJournalSeen` L256 (M).
- Accroches : `mirrorDndToPresence` vers `agentPresence` L40-73, L152, L179 ; portée DND poste/personnel/all L37, L136, L166.
- Réponses rapides en dur : L31-35 ; défauts de sonnerie L89 (`muted:false, vibrate:true`).
- Dette : aucune notable.

**`presence.ts` (357)** — à réécrire
- Imports : `api.modules.reseau.connections.listMine`, `lib/presenceTransitions`, `reseau/graphGuards`, `./admission`, `./_deps`.
- Exports (authQuery ×4) : `forMyConnections` L70, `offlineHints` L186, `forOrgContacts` L243, `forOrgMembers` L330.
- Accroches : `agentPresence` L154-217 et L279-310 ; organisation L243-270 et L330-357 ; portée DND L99 et L298.
- Dette : listing des connexions non borné en amont (L78, L190 ; seule la sortie est tronquée à 100) ; environ 3 lectures par relation dans une query réactive.

**`priority.ts` (260), `priorityCallers.ts` (899), `priorityResolve.ts` (191)** — exclus
- `priorityCallers.ts` : `authQuery`/`authMutation` ×2 chacun, `orgSettingsMutation` ×2 (L647, L668), `superadminQuery` ×2 (L710, L818), `superadminMutation` ×3 (L782, L863, L888).

**`push.ts` (84)**
- Import : `internal.actions.push.sendPushNotification` (VAPID).
- Export : `scheduleIncomingCallPush` L41.
- Priorité : L26-35, L50-63, L69-81.
- URL `"/"` : L75 ; titres et corps en dur : L65-74.

**`ringExpiry.ts` (67)** — tel quel
- Exports : `GROUP_RING_WINDOW_MS` L26, `scheduleRingingExpiry` L36, `expireRingingTicket` L53 (internalMutation).

**`routing.ts` (144)** — exclu
- Export : `decideCallRouting` L113.

**`scope.ts` (258)**
- Exports : `AUTO_DECLINE_REASONS` L62, `isAutoDeclineReason` L75, `resolveCallScope` L110, `DEFAULT_CALL_ENVIRONMENT` L149, `isCrossEnvironmentSelfCall` L182, `callSideOf` L202, `BACKOFFICE_CALLER_TITLE` L219, `categorizeCall` L234.
- À garder : `categorizeCall` (sans environnement) et `AUTO_DECLINE_REASONS` sans `secretariat_unavailable`.
- À retirer : portée L86-127 et environnement L129-219.

**`tables.ts` (312)**
- Imports : validators d'horaires de `schemas/agentSchedules` L43-46.
- Tables : `iappelCallPreferencesTable` L63-98, `iappelPosteHoursTable` L101-113, `iappelVoicemailsTable` L116-133 (`scope`/`orgId` L121-123), `iappelCallInvitesTable` L162-195, `iappelPostePolicyTable` L228-257, `iappelPriorityCallersTable` L289-312.
- Dette documentaire : l'en-tête annonce « CINQ tables » (L4) pour 6 réelles ; « jusqu'à vingt » (L144) alors que le plafond est 11.

**`validators.ts` (243)**
- À retirer : portées `dndScope` L19, `callScope` L26, `callEnvironment` L39 ; `outsideBehavior` L45 ; `postePolicyTarget` L93 ; `authorityLevel` L111 ; `priority*` L181-243 ; dans `admissionReason` L54-69, retirer `outside_hours` et `secretariat_unavailable`.

**`voicemail.ts` (353)**
- Imports : `lib/notify`, `fileGuard/admission` (`assertFreshUpload`, `enqueueScan`), `./_deps` (getMembership), `./scope`.
- Exports : `leave` L43 (M), `listMine` L222 (Q), `markRead` L276 (M), `playbackUrl` L305 (M), `deleteMine` L335 (M).
- Accroches : portée et org L114-141, L161, L170-171 ; URL `/espace/messages?brique=iappel` L189 ; libellés L178-192, L255-258.
- Dette : pas de limiteur (borné à 1 message par appel, déposé par l'appelant seul) ; N+1 borné à 50 dans `listMine`.

---

## B. `meetings` et `agentPresence`

### B.1 `cx/functions/meetings.ts` (3 103 l.) — à réécrire, en plusieurs fichiers `calls/*`

**Imports (L1-57)**
- `modules/iappel/{evaluate, authority, groupCalls, group, push, validators, scope, agentAccess, capacity}`.
- `reseauPersonnel/graph` (isConnectedTo), `reseauPersonnel/groupes` (isLiveMemberOfGroupCall).
- `lib/groupCapacity`, `reseau/graphGuards`, `lib/constants`, `lib/notify`.
- `iagenda/{reminderPolicy, reminders, sources}`.
- `lib/auth` (getMembership, isBackOfficeUser), `lib/permissions` (canDoTask, canPlaceDirectCall), `lib/taskCodes`, `lib/userCategory` (isPublicUser).
- `reseau/attachmentGate`, `gabaos/access`.

**Constructeurs :** authMutation ×18, authQuery ×10, internalQuery ×4, internalMutation ×1.

| Export | Lignes | Constr. | Accroches / verrous | SORT |
|---|---|---|---|---|
| `getForToken` | 63-68 | iQ | Seul consommateur : supervision (`actions/livekit.ts:471`) | exclu |
| `getAuthorizedForToken` | 75-104 | iQ | `users.by_authId` ; fil vivant L85-91 ; participant actif | à adapter (persons + `requireMembership`) |
| `isAuthSubjectCitizen` | 106-120 | iQ | `isPublicUser` (grant citoyen) | exclu |
| `getDisplayNameByAuthSubject` | 125-137 | iQ | Nom civil | à adapter |
| `generateRoomName` | 146-150 | — | `mtg-{orgSlug}` | à adapter (`call-…`) |
| `endStaleCalls` | 163-184 | — | **`.collect()` non borné L167-170** ; patch sans `callStatus` L182 | à réécrire (borné) |
| `get` | 193-215 | Q | Repli « membre de l'org » L203-211 | à adapter (participant seul) |
| `listByOrg` | 220-285 | Q | org | exclu |
| `listMine` | 330-429 | Q | Balayage sans index de 200 lignes L351-354 ; `.collect()` L382 | exclu (journal = `listCallHistory`) |
| `listByRequest` | 442-462 | Q | `requests` | exclu |
| `exportIcs` | 472-574 | Q | `administration.ga` L513, L532, L544, L548 | exclu |
| `unreadMeetingNotifications` / `markMeetingNotificationsRead` | 587-604 / 611-634 | Q / M | iRéunion | exclu |
| `create` | 643-828 | M | `orgId` L647 ; `requestId`/`appointmentId` L649-650 ; `TaskCode.meetings.create` L663-669 ; Gabaos L723-734 ; tickets de réunion L779-789 ; liens `/my-space` vs `/?active=` L806-809 | exclu |
| `join` | 834-1085 | M | Fil L850-857 (garder) ; verrou 1:1 « déjà pris par un autre agent » L879-892 (garder, libellé à changer) ; `isOrgInbound` + `TaskCode.meetings.join` L914-923 ; réunion d'org `joinPolicy` L924-932 ; capacité L943-977 ; `holdOnAnswer` L1039-1046 ; ticket L1060-1062 ; `markRelatedRead` L1070 ; iRéunion L1075-1081 | à adapter |
| `leave` | 1090-1230 | M | Groupe L1135-1140 (garder) ; protection de 5 s L1147-1148 ; priorité L1175-1191 ; `missedCalls`/`callLineId` L1168, L1193-1228 | à simplifier |
| `end` / `cancel` | 1235-1278 / 1285-1345 | M | `TaskCode.meetings.manage` L1245-1257, L1301-1313 ; iRéunion L1267-1276 ; liens L1330-1338 | exclu |
| `agendaLinkForMeeting` | 1355-1363 | — | Fuseau d'org iAgenda | exclu |
| `listInboundOrgCalls` | 1377-1468 | Q | File ; `.collect()` L1388, L1420 | exclu |
| `callOrganization` | 1475-1530 | M | Citoyen vers org, `callLineId` | exclu |
| `callUser` | 1536-1759 | M | `orgId` L1538 ; `canPlaceDirectCall` L1559-1565 ; routage L1595-1656 ; bypass L1664-1670 ; trace de routage et champs de poste L1671-1679, L1718-1724 ; priorité L1744 | exclu (gabarit de structure pour `callMember`) |
| `describeRouting` | 1779-1796 | — | Secrétariat | exclu |
| `callCitizenByEmail` | 1802-1861 | M | Ressortissant L1807-1814 | exclu |
| `callCitizenById` | 1881-1993 | M | Voir V01-V03. Garder : soi-même L1903-1905, `endStaleCalls` L1910, `strangerPolicy` L1929-1951, refus en valeur L1952-1971, insertion L1973-1989 | **à réécrire** en `calls/direct.ts::callMember` (fusion avec `callByHandle`) |
| `callRequestAgent` | 2005-2059 | M | `requests`, `callLines` ; `.collect()` L2028 | exclu |
| `callUserAsAdmin` | 2077-2291 | M | Back-office L2083-2088 ; auto-appel L2104-2107 ; `.collect()` L2118 | exclu |
| `setCallRinging` | 2302-2343 | M | Push L2328-2341 (priorité L2339) | à simplifier |
| `declineCall` | 2348-2439 | M | Environnement L2364, L2396-2399 ; branche file L2423-2437 | à simplifier |
| `listCallHistory` | 2449-2645 | Q | `orgId` et `answeredCalls` L2451, L2494-2506 ; `.collect()` L2571 ; portée, poste et routage L2567-2582, L2614-2636 ; environnement L2456, L2600 | à simplifier |
| `addParticipant` | 2664-2747 | M | Réunions ; liens L2731-2734 | exclu |
| `cleanupStaleCalls` (+ constantes L2754-2767) | 2775-2862 | iM | Priorité L2811-2819 ; index `by_callStatus_and_org` | à simplifier |
| `accept`/`request`/`declineRecordingConsent` | 2872-2957 | M | `citizenConsent` | exclu |
| `getActiveCallForUser` | 2975-3033 | Q | `.collect()` L2987, L2994, L3003 ; balayage par org | à réécrire (borné) ou exclu (seul consommateur : iAsted) |
| `findRecallableMissedCall` | 3042-3103 | Q | `missedCalls` d'org ; `.collect()` L3054 | exclu |

**Dette globale de `meetings.ts`**
- 11 appels `.collect()` : L170, L382, L1388, L1420, L2028, L2118, L2571, L2987, L2994, L3003, L3054.
- `.filter` après index : L381, L2986, L2993, L3053.
- **Aucun limiteur de débit** sur les mutations d'appel.
- Le tableau `participants` est réécrit à chaque join/leave (document chaud).
- Constantes de 120 s quadruplées.

**Consommateurs entrants**
- `actions/livekit.ts` : 140, 165, 240, 471.
- `crons.ts` : 257-262.
- `ai/realtimeToolExecutor.ts` : 2635, 2697, 2748, 2852-2965, 3508-3520, 3877, 6688-6729.
- `modules/itravail/overview.ts` : 290.
- `modules/reseauPersonnel/messagerie.ts` : 1094.

### B.2 `cx/schemas/meetings.ts` (353 l.) — à réécrire

La table devient `calls` dans `calls/tables.ts`. Le détail des champs à garder ou retirer est en fin de rapport (point 2).

### B.3 `cx/schemas/agentPresence.ts` (39 l.) — à réécrire

La table devient `personPresence` dans `calls/tables.ts`.
- Champs : `userId` L14, **`orgId` L15 (obligatoire)**, `status` L16-21, `lastHeartbeat` L22, `lastActivity` L23, `currentCallId` L26 (legacy), `currentCallIds` L28 (centre d'appels), `activeCallId` L30, `clientType` L31, `dndUntil` L35.
- Index L37-39 : `by_user_and_org`, `by_org_and_status`, `by_org`.

### B.4 `cx/functions/agentPresence.ts` (366 l.) — à réécrire

La cible est `calls/presence.ts`, avec la présence par personne.
- Imports : `lib/customFunctions` (`mutation`, authMutation, authQuery), `lib/auth` (getCurrentUser), `lib/presenceTransitions`.
- Exports :
  - `heartbeat` L20 (`mutation`, `orgId` ; pointage L51-59 et L85-95) ;
  - `setOffline` L106 (`mutation`) ;
  - `listOnlineAgents` L146 (Q, **aucune garde d'appartenance**) ;
  - `countAvailableAgents` L188 (Q, sans garde) ;
  - `cleanupStalePresence` L215 (iM) ;
  - `getMine` L257 (Q) ;
  - `setDnd` L283 (M, crée une ligne `online`, L302-310) ;
  - `isAvailable` L328 ;
  - `backfillMultiCallFields` L351 (iM).
- Dette : le nettoyage ne balaie que 500 lignes de toute la table (L220-222) ; au-delà, des lignes ne sont jamais nettoyées. Fuite d'information par les deux queries sans garde. Écriture toutes les 30 s (voulu).
- À garder dans ANTSIA : `heartbeat`, `setOffline`, `cleanup` (indexé par `lastHeartbeat`). Le reste est exclu (centre d'appels, pointage).

---

## C. LiveKit et Egress

**`cx/actions/livekit.ts` (830 l., "use node") — à simplifier ; cible `calls/livekitActions.ts` + `live/egressActions.ts`**
- Constructeurs : action ×4, internalAction ×6.
- Imports L9-23 : `node:crypto`, `livekit-server-sdk` (AccessToken, EgressClient, WebhookReceiver), `@livekit/protocol`, `lib/livekit`, `lib/livekitWake`, `lib/livekitIdentity`, `lib/errors`, `lib/egressFileTransfer`, `lib/egressUploads`, `lib/egressWebhook`.
- Le commentaire L25-74 renvoie au `callCenter`.

| Export | Lignes | Constr. | SORT |
|---|---|---|---|
| Référence EAU `getAuthorizedForEauCourseTokenRef` | 76-83 | — | exclu |
| `generateToken` (PNPE) | 89-119 | iA | exclu |
| `requestToken` | 127-297 | A | **à adapter** |
| `requestEauCourseToken` | 306-348 | A | exclu |
| `createCitizenJoinToken` (rendez-vous ; dates sans fuseau L392-395) | 371-430 | A | exclu |
| `requestSupervisionToken` (centre d'appels) | 449-541 | A | exclu |
| `hasEgressEnv` / `buildEgressClient` | 550-556 / 561-569 | — | factoriser dans un lib (dupliqués dans `livekitDirect`) |
| `startCallRecordingEgress` / `stop…` | 579-616 / 621-643 | iA | exclu |
| `startVoicemailEgress` | 657-706 | iA | exclu |
| `verifyEgressWebhook` | 731-766 | iA | tel quel |
| `ingestEgressFile` | 779-830 | iA | à simplifier (route `direct` seule) |

Détail de `requestToken` (L127-297) :
- À garder : L131-159 (autorisation puis réveil), L188-192 (identité `call`), L220-231 (`attributes.userId` devient `personId`), L246-251.
- À retirer : grant restreint « citoyen » L239-243 et L252-263 ; iRéunion « late joiner » L268-288 ; `console.log` de diagnostic L194-199.
- `throw new Error` (L133, L145, L149) à remplacer par des codes `ConvexError`.
- Quatre `runQuery` (L139, L164, L214, L239) à ramener à un seul.

**`cx/actions/livekitDirect.ts` (800 l., "use node") — tel quel ; cible `live/livekitActions.ts`**
- Constructeurs : action ×2, internalAction ×6.
- Imports L29-68.
- Exports : `requestDirectToken` L77 (A), `applyDirectSfuState` L141, `muteDirectMicrophone` L260, `closeDirectRoom` L307, `startDirectEgress` L393 (se replanifie, L515-527), `stopDirectEgress` L548, `reconcileDirectEgress` L609, `importReplayCaptions` L752 (A).
- Aucune accroche administration ; le fichier ne lit jamais `meetings` (L6-7).
- Dette : env Egress dupliquée L327-340 ; `new Error("NOT_AUTHENTICATED")` L89 ; motifs FR en dur L421, L619, L628, L656.

**Bibliothèques**

| Fichier | l. | Rôle | SORT | Cible |
|---|---|---|---|---|
| `cx/lib/livekit.ts` | 61 | `getLiveKitConfig` (env L39-41, `LIVEKIT_NOT_CONFIGURED`) | tel quel | `lib/livekit.ts` |
| `cx/lib/livekitWake.ts` | 117 | Réveil de la VM avant jeton (env L86-87 ; 240 s L34 ; codes `NO_CAPACITY`/`UNAVAILABLE` L114-116) | tel quel | `lib/livekitWake.ts` |
| `cx/lib/livekitIdentity.ts` | 112 | Fabrique d'identité | à simplifier : garder `call` L45 et L95-96 ; retirer `eau` L47/L97, `citizen` L49/L99, `supervisor` L51-56/L101, `pnpe` L58/L103 | `lib/livekitIdentity.ts` |
| `cx/lib/egressRouting.ts` | 53 | Contrat filepath vers traitement | à simplifier : garder `directs/` L37 et L43-45 | `lib/livekitEgressRouting.ts` |
| `cx/lib/egressUploads.ts` | 86 | Politique de dépôt (dépend de `lib/uploadPolicy` L27) | à adapter | `lib/livekitEgressUploads.ts` |
| `cx/lib/egressWebhook.ts` | 288 | Plan et propriété de l'egress | à simplifier : `EGRESS_ROUTES` L40-45, `isEgressKnownBy` L178-196 et `completeEgressForOwners` L251-286 réduits à la branche `direct` | `lib/livekitEgressWebhook.ts` |
| `cx/lib/egressFileTransfer.ts` | 523 | Rapatriement en flux (node:http/https/stream) | tel quel | `lib/livekitEgressFileTransfer.ts` |
| `cx/lib/presenceTransitions.ts` | 64 | Pointage (`isHumanPresent`, client « agent-schedule-auto ») | exclu | — |
| `cx/actions/pnpeLivekit.ts` | 84 | PNPE | exclu | — |

**`cx/http.ts` : une seule route LiveKit/Egress**
- Pas de webhook de salle ni de participant.
- Imports : L20 (`timingSafeEqual`) et L25-38 (`egressWebhook`, `replayComposition`).
- Helper `isPayloadTooLarge` : L235-238. Commentaire, `LIVEKIT_EGRESS_WEBHOOK_MAX_BYTES` (L1302) et `livekitEgressJson` : L1274-1309.
- Route `POST /webhooks/livekit-egress`, L1311-1444 :
  - taille L1315-1324 ;
  - JSON L1325-1334 ;
  - événements ignorés L1340-1342 ;
  - secret historique L1345-1355 ;
  - `verifyEgressWebhook` L1356-1366 ;
  - `egress_started`/`updated` vers `direct.replay.markEgressState` L1368-1399 ;
  - `egress_ended` : plan et propriétaires L1401-1415, rapatriement planifié L1417-1430, complétion L1441-1442.
- SORT : à simplifier (propriété limitée au direct).

**Crons (`cx/crons.ts`)**
- Calls : `cleanup-stale-calls` (30 s), L257-262.
- Live : `reap-stale-directs` (60 s) L270-275 ; `purge-expired-direct-replays` (1 h) L279-284 ; `reconcile-direct-replays` (15 min) L291-296.
- Présence par personne : `cleanup-stale-presence` (60 s), L330-335.
- Exclus : `match-agent-schedules-to-presence` L340-345 ; cron iRéunion L395-400.

**Schéma (`cx/schema.ts`)** : L90 et L92, L646-652, L654-658, L1032-1053 (12 tables `direct_*`), L1166-1187.

---

## D. `cx/modules/direct/` — 23 sources (10 595 l., tout gardé), 21 tests (12 157 l., 340 cas)

**Cible :** `convex/modules/live/<même nom>`.

**Bornage :** aucun `.collect()` dans le code (seulement en commentaire, `reap.ts` L50 et L86, `replay.ts` L369) ; toutes les lectures sont en `take`/`paginate`.

**Limiteurs présents** (`cx/ai/rateLimiter.ts` L343-381) : `comments.ts` L81, `reactions.ts` L50, `antenna.ts` L273 et L413.

**Limiteurs absents :** `sessions.create`, `invitees.add`, `presence.heartbeat`, `hostPresence.heartbeat`, `requestDirectToken`.

**Notifications :** aucun Web Push ; seulement `reseauPersonnel/notifications.notifyPersonal` (`direct_started`, `direct_invite`, `direct_antenna_invite`, `direct_replay_published`).

| Fichier | l. | Rôle | Exports (constructeurs) | Accroches administration | SORT |
|---|---|---|---|---|---|
| `access.ts` | 828 | Gardes de visibilité et jeton | 20 fonctions + `authorizeToken` L673 (iM) | `isPublicUser` L46, L318-329 ; organisation L374-403 (L389-394), L413-422, L501-515, L539-550, L622-628. Écrit `viewerGrantCount`/`viewerPresentCount` sur la session (document regardé par toute la salle) L792-808 | **à adapter** |
| `antenna.ts` | 1 186 | Mains levées et invitations à l'antenne | M×8, Q×4 (L378-1169) | Indirect (décision d'accès) | tel quel |
| `comments.ts` | 235 | Commentaires persistés | `send` L43, `remove` L125, `list` L176 | — | tel quel |
| `delegations.ts` | 271 | Co-hôte et modérateur | `grant` L115, `revoke` L197, `listForSession` L230 | — | tel quel |
| `domain.ts` | 521 | Règles pures | 18 fonctions et constantes | Audience `organisation` L317-333, L481-498, L513-521 | à adapter |
| `grants.ts` | 182 | Grants et identités (`direct-v_` L66, `direct-s_` L67, salle L181, TTL 1 h L63) | 7 fonctions | — | tel quel |
| `hostPresence.ts` | 178 | Bail de l'hôte | `heartbeat` L101, `presence` L153 | — | tel quel |
| `invitationSettle.ts` | 147 | Solde des invitations | `expireSessionInvitations` L59 (iM) | — | tel quel |
| `invitees.ts` | 767 | Invités nominatifs | Q×3, M×2 | Organisation L145-152, L265-275, L352-357, L592-599 | à adapter |
| `manifest.ts` | 34 | Manifeste | — | `/espace/direct` L16 | à adapter |
| `moderation.ts` | 385 | Exclusion et sourdine | M×4, `listAdmitted` L296 | — | tel quel |
| `permissions.ts` | 207 | Matrice de gestion (pure) | 5 fonctions | — | tel quel |
| `presence.ts` | 147 | Bail des spectateurs | `heartbeat` L78, `leave` L124 | — | tel quel |
| `reactions.ts` | 144 | Réactions (une ligne par personne) | `react` L33, `summary` L108 | — | tel quel |
| `reap.ts` | 304 | Récolte et agrégats (écrivain unique, n'écrit que si changement) | `reapStaleDirects` L185 + 3 fonctions | — | tel quel |
| `replay.ts` | 569 | Replay Egress | iQ×2, iM×7 | — | tel quel |
| `replayComposition.ts` | 546 | Pur, composition et statuts | 16 fonctions | — | tel quel |
| `retention.ts` | 48 | Conservation 90 jours | 3 fonctions | — | tel quel |
| `revocation.ts` | 227 | Coupures temps réel | iM×4 | `kickUserFromOrgDirects` L21-67 (org vers page), `kickUserFromInviteeDirects` L140-172 (« devient citoyen »), `closePageDirects` L175-227 | à adapter |
| `sessions.ts` | 2 365 | Cycle de vie et découverte | M×9, Q×7 (`create` L120 … `listReplays` L2248) | Organisation exige une page L196-201 ; `getMembership` + `assertCanDoTask("communication.publish")` L222-231 ; L276 ; cloche aux membres d'org L527-570 ; `validatedOrgIds` L2169-2193 et L2264-2290 | à adapter |
| `speakers.ts` | 397 | Promotion et rétrogradation | M×3, iQ, iM | — | tel quel |
| `tables.ts` | 563 | 12 tables (l'en-tête n'en liste que 8) | — | `pageId` vers `reseauPages_pages` L75-88 | à adapter |
| `validators.ts` | 344 | Validators | — | `organisation` L42-53 | à adapter |

**Entrants vers le direct, à recréer dans ANTSIA**
- `cx/lib/membershipLifecycle.ts:139`, `:146`.
- `cx/modules/reseau/connections.ts:38`, `:47`.
- `cx/modules/reseauPages/admin.ts:218`.
- `reseauPersonnel/posts.ts`, `postWrite.ts`, `notifications.ts`, `tables.ts` (`directSessionId`, projection de l'annonce).

---

## E. `cx/modules/ireunion/` — liste et justification d'exclusion

| Fichier | l. | Rôle |
|---|---|---|
| `egressActions.ts` | 455 | "use node" : egress audio par participant + composite vidéo (`startAllParticipantEgress` L205, `ensureLateJoinerEgress` L314, `rotateTrackEgress` L383, `stopSessionEgresses` L433) |
| `recordings.ts` | 706 | Sessions d'enregistrement (17 exports) ; `requireHostOrManager` L86-104 (org + `TaskCode.meetings.manage`) ; consentement citoyen L108-118 ; env `IREUNION_*` L51-64 ; `.collect()` L127, L344, L377, L524, L647, L679 |
| `report.ts` | 194 | "use node" : compte rendu Gemini, PDF, coffre iDocument L133-173 |
| `reportData.ts` | 179 | Pur |
| `reportPdf.ts` | 150 | "use node" : PDF |
| `tables.ts` | 195 | 4 tables, `orgId` obligatoire (L60, L104, L134, L158) |
| `transcriptMerge.ts` | 102 | Pur |
| `transcription.ts` | 185 | Whisper |
| `transcripts.ts` | 500 | Persistance (`.collect()` L43, L96, L351, L443) |
| `workflow.ts` | 134 | Workflow durable |
| `ireunion.test.ts` | 647 | 23 cas, edge-runtime |

**Pourquoi exclu :** réunion institutionnelle (org obligatoire, `meetings.manage`, consentement citoyen, iDocument, IA).

**Utile aux appels de groupe :** seulement `parseLiveKitAuthSubject` (`recordings.ts` L77-84), si l'on branche plus tard un webhook de salle LiveKit (`participant_left`/`room_finished`). Ce signal manque aujourd'hui (`meetings.ts` L2756-2766).

**Accroches à couper**
- `meetings.ts` L1075-1081 et L1267-1276.
- `actions/livekit.ts` L268-288.
- `egressWebhook.ts` L191-195 et L273-285.
- `egressRouting.ts` L38 et L47-53.

---

## Tests

### Tests colocalisés `iappel`

Les tests « node » n'ont pas de pragma ; les tests convex-test sont en `edge-runtime`.

| Test | l. | cas | env | Imports (hors vitest/_generated/test.setup) | Tables ou API administration | SORT |
|---|---|---|---|---|---|---|
| `admission.test.ts` | 668 | 56 | node | `./admission`, `./authority` | — | à simplifier (environ 26 cas poste/autorité/priorité : blocs L130, L342, L369, L432, L530) |
| `authority.test.ts` | 244 | 22 | node | `./authority` | — | exclu |
| `authorityResolve.test.ts` | 316 | 5 | edge | `lib/countryCodeValidator`, `lib/constants`, `messagerieScope/posteKey` | memberships, orgs, positions | exclu |
| `calls.test.ts` | 706 | 25 | edge | `lib/countryCodeValidator`, `lib/constants` | agentPresence, memberships, orgs | à adapter |
| `capacity.test.ts` | 102 | 12 | node | `./capacity`, `./group` | Configuration d'org simulée | à simplifier (−5 cas réunion) |
| `evaluate.test.ts` | 759 | 27 | edge | idem | agentPresence, `iagenda_*`, `iappel_posteHours`, memberships, orgs, pushSubscriptions (`callUser` ×23) | à simplifier (−4 horaires, 5 « hors ligne poste » à adapter) |
| `group.test.ts` | 273 | 24 | node | `./group` | — | tel quel |
| `groupCalls.test.ts` | 1 904 | 58 | edge | + `lib/groupCapacity`, `./group` | memberships, orgs (`startAdHoc` avec orgId) | à adapter |
| `hours.test.ts` | 311 | 35 | node | `./hours` | — | exclu |
| `posteHours.test.ts` | 373 | 14 | edge | `./validators`, `./hours` | memberships, orgs, positions | exclu |
| `postePolicy.test.ts` | 521 | 18 | edge | `./validators` | + positionAssignments | exclu |
| `preferences.test.ts` | 427 | 18 | edge | `./validators` | agentPresence, orgs | à adapter (4 cas « miroir ») |
| `presence.test.ts` | 587 | 24 | edge | — | agentPresence, connections, memberships, orgs | à réécrire (8 cas org, 4 `offlineHints`) |
| `priority.integration.test.ts` | 774 | 19 | edge | `./authorityResolve` | postePolicy, priorityCallers, positions | exclu |
| `priority.test.ts` | 269 | 18 | node | `./priority` | — | exclu |
| `ringExpiry.test.ts` | 139 | 2 | edge | `./ringExpiry` | memberships, orgs | à adapter |
| `routing.integration.test.ts` | 770 | 11 | edge | `migrations/backfillPositionDirectory`, `posteKey` | directoryEntries, positions, policies | exclu |
| `routing.test.ts` | 141 | 12 | node | `./admission`, `./routing` | — | exclu |
| `scope.test.ts` | 219 | 24 | node | `./scope` | — | à simplifier (−14 cas portée et environnement) |
| `voicemail.adoption.test.ts` | 267 | 4 | edge | — | `fileGuard_scans` ; API `functions.documents.*`, `documentVault.addToVault` (**iDocument**) | à adapter |
| `voicemail.test.ts` | 555 | 18 | edge | `./validators` | memberships, orgs, notifications | à adapter (−2 cas portée) |

### Tests colocalisés `direct`

Dans ces tests, `memberships`/`orgs` servent surtout à fabriquer des comptes « agents » non citoyens.

| Test | l. | cas | env | Imports | Tables ou API administration | SORT |
|---|---|---|---|---|---|---|
| `antenna.test.ts` | 1 390 | 26 | edge | `rate-limiter/test`, `convex/server`, `./domain` | memberships, orgs, `reseauPages.admin.activate` | tel quel (cas page à adapter) |
| `comments.test.ts` | 163 | 3 | edge | `./reap` | — | tel quel |
| `delegations.test.ts` | 388 | 13 | edge | — | — | tel quel |
| `direct.test.ts` | 1 561 | 50 | edge | `./domain` | memberships, orgs, pages | à adapter (4 cas « conférence d'administration ») |
| `discovery.test.ts` | 726 | 24 | edge | — | — | tel quel |
| `egressStartReconcile.test.ts` | 347 | 7 | edge | — | — | tel quel |
| `grants.test.ts` | 135 | 9 | node | `./grants` | — | tel quel |
| `hostPresence.test.ts` | 378 | 7 | edge | `./domain` | — | tel quel |
| `invitationSettle.test.ts` | 565 | 5 | edge | `reseauPersonnel/notifications` | `reseauPages_pages` (`closePageDirects`) | à adapter |
| `invitees.test.ts` | 1 345 | 30 | edge | `./domain` | memberships, orgs, pages, citoyen | à adapter |
| `moderation.test.ts` | 633 | 24 | edge | — | — | tel quel |
| `organisationAccess.test.ts` | 539 | 10 | edge | `lib/constants` | memberships, orgs, pages activate/deactivate | **à réécrire** (page et adhésion) |
| `pagination.test.ts` | 275 | 9 | edge | — | — | tel quel |
| `permissions.test.ts` | 211 | 16 | node | `./permissions` | — | tel quel |
| `presence.test.ts` | 389 | 11 | edge | `./domain` | — | tel quel |
| `replayComposition.test.ts` | 432 | 27 | node | `./replayComposition` | — | tel quel |
| `replayPublication.test.ts` | 770 | 16 | edge | — | memberships, orgs | à adapter (comptes) |
| `replayReconcile.test.ts` | 944 | 28 | edge | `tests/scheduledDrain.setup` | — | tel quel |
| `retention.test.ts` | 235 | 4 | edge | `./retention` | — | tel quel |
| `revocation.test.ts` | 283 | 5 | edge | `lib/constants` | `functions.orgs.removeMember`, `reseauPages_pages` | **à réécrire** |
| `spotlight.test.ts` | 448 | 16 | edge | — | — | tel quel |

La majorité des tests convex-test du direct importent `@convex-dev/rate-limiter/test` (non répété ci-dessus).

### Tests de `cx/lib/` (tous en node)

| Test | l. | cas | SORT |
|---|---|---|---|
| `livekit.test.ts` | 112 | 7 | tel quel |
| `livekitWake.test.ts` | 169 | 10 | tel quel |
| `livekitIdentity.test.ts` | 196 | 14 | à simplifier (cas `eau`/`citizen`/`supervisor`/`pnpe`) |
| `egressFileTransfer.test.ts` | 410 | 16 | tel quel |
| `egressRouting.test.ts` | 37 | 3 | à simplifier |
| `egressWebhook.test.ts` | 178 | 11 | à simplifier |

### Tests de `cx/tests/` qui couvrent directement le périmètre

| Test | l. | cas | env | Dépendances | SORT |
|---|---|---|---|---|---|
| `callJournalAndDecline` | 332 | 12 | edge | memberships, orgs | à adapter |
| `callCapacitySettings` | 254 | 9 | edge | orgs, positions ; `meetings.create` | à simplifier (−4 réunion, −2 API 1:1) |
| `callCrossEnvironment` | 295 | 11 | edge | `callUserAsAdmin` | exclu |
| `livekitTokenIssuance` | 233 | 5 | edge | `meetings` | à adapter (−2 supervision) |
| `livekitEgressWebhook` | 564 | 22 | edge | `livekit-server-sdk` ; `callRecordings`, `voicemails`, `ireunion*` | à simplifier (branche direct) |
| `livekitCitizenJoinErrorsI18n` | 105 | 4 + 1 `it.each` | node | Lit `actions/livekit.ts`, `lib/livekit*.ts` | à simplifier (codes `LIVEKIT_*`) |
| `livekitCitizenJoinErrors` | 223 | 6 | edge | appointments | exclu |
| `livekitCsp` | 56 | 5 | node | `packages/livekit/csp.mjs` | à reprendre si le package est dupliqué |
| `meetingsCollaboration` | 709 | 22 | edge | requests, orgs | exclu (sauf 2 cas `getAuthorizedForToken` et 1 auto-appel) |
| `meetingsJoinPolicy` | 589 | 18 | edge | Réunions | exclu |
| `appelDunPosteTrace` | 168 | 3 | edge | directoryEntries, positions | exclu |
| `contactResolution` | 487 | 19 | edge | contactSearch, positions | exclu |
| `gabaosIastedGuard` | 469 | 18 | edge | gabaos | exclu |
| `vpgCollaborationEndToEnd` | 723 | 2 | edge | Seed VPG | exclu |
| `attachmentGateRatchet` | 134 | 2 | node | Cliquet source : `groupCalls.ts` L70, `meetings.ts` L75 | à réécrire en cliquet `requireMembership` |
| `membershipScopeRatchet` | 1 571 | 14 | node | Cliquet source (L464, L556, L695, L709) | informatif |

### Tests périphériques (n'insèrent que dans `meetings` ou `presenceTransitions`) — exclus

| Test | l. | cas |
|---|---|---|
| `callTermination` | 172 | 5 |
| `orgScopedReads` | 442 | 13 |
| `realtimeToolTodayAgenda` | 401 | 3 |
| `voicemails` | 206 | 3 |
| `gabaosGuardRatchet` | 190 | 5 |
| `pointage` | 426 | 36 |
| `pointageSettings` | 517 | 9 |

### Tests hors `tests/` qui touchent le périmètre

| Test | l. | cas | env | SORT |
|---|---|---|---|---|
| `cx/functions/blobsServeur.adoption.test.ts` | 353 | 3 | edge | partiel |
| `cx/functions/eau/audioDrafts.adoption.test.ts` | 330 | 6 | edge | exclu |
| `cx/migrations/resolveSettledInvitations.test.ts` | 434 | 6 | edge | exclu |
| `cx/modules/reseauPersonnel/groupes.test.ts` | 4 079 | 114 | edge | à adapter : partie appels de fil, `startFromThread` et `listParticipants` (≈ 31 références) |
| `…/messagerie.test.ts` | 1 849 | 53 | edge | à adapter : `callByHandle` + `CALL_AFFILIATION_REQUIRED` L20 et L835 |
| `…/newAgentCalls.test.ts` | 232 | 2 | edge | à réécrire (`callCitizenById`) |
| `cx/seeds/vpg/seedVpgCollaborationDemo.test.ts` | 428 | 6 | edge | exclu |

---

## FIN

### (1) Liste fermée des verrous « agent » à lever

**Appelant et appelé, 1:1**
- **V01** `cx/functions/meetings.ts:1888` — `assertNotSuspended` (délai de rattachement de 72 h, `cx/modules/reseau/attachmentGate.ts:310-331`).
- **V02** `meetings.ts:1889-1895` — `isPublicUser` de l'appelant : « Les ressortissants ne peuvent pas appeler… ».
- **V03** `meetings.ts:1907` vers `modules/iappel/agentAccess.ts:16-23` (et 31-47) — l'appelé doit avoir une membership validée.
- **V04** `meetings.ts:1807-1814` — même refus dans `callCitizenByEmail` (mutation exclue entière).
- **V05** `meetings.ts:1538` et `:1559-1565` — `callUser` : `orgId` obligatoire, `getMembership` et `canPlaceDirectCall` (`cx/lib/permissions.ts:696`).
- **V06** `meetings.ts:2083-2088` et `:2104-2107` — `callUserAsAdmin` : back-office et `hasCallAffiliation`.
- **V07** (entrée hors périmètre) `cx/modules/reseauPersonnel/messagerie.ts:1073` (`assertNotSuspended`) et `:1089` (`assertCallTargetAffiliated`), dans `callByHandle` L1039-1110, qui délègue à `callCitizenById` (L1093-1095).

**Groupe**
- **V08** `cx/modules/iappel/groupCalls.ts:485`, `:655`, `:786` — `assertNotSuspended`.
- **V09** `groupCalls.ts:633-636` et `:666-667` — `startAdHoc` exige `orgId` et l'existence de l'org.
- **V10** `groupCalls.ts:659-664` — `getMembership` et `canPlaceDirectCall`.
- **V11** `groupCalls.ts:694-713` — chaque invité doit exercer dans l'org (696-704) et ne pas être citoyen (705-710).
- **V12** `groupCalls.ts:838-850` — `addInvitee`, appel d'org : membership et non-citoyen.
- **V13** `groupCalls.ts:851-861` — `addInvitee`, appel personnel : `isPublicUser` donne « n'est pas joignable ».
- **V14** `groupCalls.ts:515-518`, `:683-686`, `:874-886`, `:1195`, `:1233-1236` — plafond lu dans `org.settings.calls` et exemption back-office.
- **V15** `groupCalls.ts:1189-1209` — `myCallCapacity(orgId)` exige une membership.
- **V16** `groupCalls.ts:273-297`, `:344-353`, `:925-932` — filtre de poste.
- **V17** `groupCalls.ts:1111-1117` et `:1129-1130` — fonctions et org dans la grille.

**Présence par organisation**
- **V18** `cx/schemas/agentPresence.ts:15` et `:37-39`.
- **V19** `cx/functions/agentPresence.ts:20-97`, `:106-140`, `:146-202`, `:215-249`, `:257-314`.
- **V20** `cx/modules/iappel/presence.ts:186-217`, `:243-270`, `:279-310`, `:330-357`.
- **V21** `cx/modules/iappel/evaluate.ts:72-96` et `:357-363`.
- **V22** `cx/modules/iappel/calls.ts:523-550`.
- **V23** `cx/modules/iappel/preferences.ts:40-73`.

**Poste, horaires, secrétariat, autorité, priorité**
- **V24** `evaluate.ts:282-342`.
- **V25** `evaluate.ts:397-868`.
- **V26** `meetings.ts:1595-1679`, `:1718-1724`, `:1744`, `:2149-2217`, `:2250-2257`, `:2281`.
- **V27** `admission.ts:69-73`, `:98-111`, `:286`, `:312-325`, `:351-376`, `:381`, `:394`.
- **V28** (portée poste/personnel)
  - `scope.ts:86-127` ;
  - `calls.ts:279-284`, `:317-323`, `:392-398`, `:432-438` ;
  - `voicemail.ts:114-141`, `:161`, `:170-171` ;
  - `meetings.ts:2567-2582`, `:2614-2636`.
- **V29** (priorité, ADR-0217)
  - `meetings.ts:1175-1191`, `:2337-2340`, `:2811-2819` ;
  - `evaluate.ts:519-524`, `:984-1008` ;
  - `push.ts:26-35`, `:50-81` ;
  - `calls.ts:347`, `:405`, `:445`.
- **V30** Tables `tables.ts:101-113`, `:228-257`, `:289-312`, et fichiers `hours`, `posteHours`, `postePolicy`, `authority`, `authorityResolve`, `priority`, `priorityResolve`, `priorityCallers`, `routing`.

**Centre d'appels**
- **V31** `meetings.ts:914-923`, `:1168`, `:1193-1228`, `:1377-1530`, `:2005-2059`, `:2423-2437`, `:2494-2506`, `:2872-2957`, `:3042-3103` ; `calls.ts:494-502`.

**Environnement back-office/agent**
- **V32** `scope.ts:129-219` ; `calls.ts:204`, `:231`, `:243`, `:332-345` ; `meetings.ts:841`, `:1025-1026`, `:2364`, `:2396-2399`, `:2456`, `:2600`.

**Citoyen côté LiveKit**
- **V33** `meetings.ts:106-120` vers `cx/actions/livekit.ts:239-264`.

**Réunions qui touchent le chemin d'appel**
- **V34** `meetings.ts:203-211` (`get` via l'org), `:924-932` (`joinPolicy`), `:1075-1081` et `:1267-1276` (iRéunion), `:1245-1257` et `:1301-1313` (`meetings.manage`).

**Direct**
- **V35** `cx/modules/direct/access.ts:318-329` — `isPublicUser` remplacé par l'adhésion.
- **V36** `access.ts:374-403`, `:413-422`, `:501-515`, `:539-550`, `:622-628` — l'organisation devient la page.
- **V37** `direct/sessions.ts:196-201`, `:222-231` (`communication.publish`), `:276`, `:527-570`, `:2169-2193`, `:2264-2290`.
- **V38** `direct/revocation.ts:21-67` et `:140-172`.
- **V39** `direct/invitees.ts:145-152`, `:265-275`, `:352-357`, `:592-599`.
- **V40** `direct/domain.ts:317-333`, `:481-498`, `:513-521` ; `direct/validators.ts:42-53` ; `direct/tables.ts:75-88`. Entrants associés : `lib/membershipLifecycle.ts:139` et `:146`, `modules/reseauPages/admin.ts:218`.

### (2) Table `meetings`, devenue `calls` pour le 1:1 et le groupe (≤ 11 participants)

Il y a 46 champs et 10 index.

**20 champs à garder, plus `networkId` à ajouter**

| Champ | Ligne du schéma | Remarque |
|---|---|---|
| `title` | L24 | |
| `status` | L26 | Réduire à `active`/`ended` |
| `roomName` | L34 | |
| `createdBy` | L39 | Devient une personne |
| `participants` | L42 et L15-20 | `personId`, `joinedAt`, `leftAt`, `role` |
| `callStatus` | L51-61 | |
| `answeredBy` | L62 | |
| `answeredAt` | L63 | |
| `calleeEngagedAtCreate` | L70 | Lu par le client (tonalité « occupé ») |
| `endReason` | L71-101 | Garder `normal`, `timeout`, `declined`, `cancelled`, `error`, `dnd`, `busy`, `in_meeting`, `offline`, `outside_relations` ; retirer `rejected`, `voicemail_recorded`, `outside_hours`, `secretariat_unavailable` |
| `parkedAt` | L109 | |
| `holdOnAnswer` | L114 | |
| `heldBy` | L120 | |
| `mediaType` | L159 | |
| `callKind` | L191 | À rendre obligatoire |
| `calleeUserId` | L226 | Devient `calleePersonId` |
| `declineNote` | L301 | |
| `maxParticipants` | L304 | 2 ou ≤ 11 |
| `startedAt` | L324 | |
| `endedAt` | L325 | |

**26 champs à retirer**

| Champ | Ligne | Motif |
|---|---|---|
| `type` | L25 | Plus de réunion dans la table |
| `roomSid` | L35 | Jamais écrit |
| `orgId` | L38 | |
| `isOrgInbound` | L45 | |
| `callLineId` | L48 | |
| `declinedBy` | L64 | Lu seulement par la file |
| `fallbackApplied` | L105 | |
| `originalCallLineId` | L107 | |
| `priority` | L123-130 | |
| `citizenConsent` | L133-145 | |
| `requestId` | L148 | |
| `appointmentId` | L149 | |
| `eauCommandeId` | L151 | |
| `eauDestinataireUserId` | L156 | |
| `targetDirectoryEntryId` | L204 | |
| `targetPositionTitle` | L206 | |
| `callerEnvironment` | L241-243 | |
| `calleeOrgId` | L263 | |
| `routedFromPositionId` | L277 | |
| `routedFromPositionTitle` | L279 | |
| `routedFromUserId` | L285 | |
| `routingReason` | L291 | |
| `recordingEnabled` | L305 | |
| `description` | L307 | |
| `joinPolicy` | L320 | |
| `scheduledAt` | L323 | |

**Index**
- Garder `by_createdBy` (L329, devient par personne) et `by_calleeUserId_and_status` (L353, devient `by_calleePerson_and_status`).
- `by_callStatus_and_org` (L338) devient `by_callStatus` (cron).
- Retirer `by_org`, `by_roomName` (seulement les seeds), `by_createdBy_and_scheduledAt`, `by_org_status`, `by_request`, `by_eauCommandeId`, `by_eauDestinataireUserId`.

**Tables `iappel` associées**
- `callInvites` : tel quel, en renommant `meetingId` en `callId`.
- `callPreferences` : retirer la portée des DND.
- `voicemails` : retirer `scope` et `orgId`.
- `personPresence` : `personId`, `status`, `lastHeartbeat`, `lastActivity`, `activeCallId`, `clientType`, sans `orgId`, `currentCallId(s)` ni `dndUntil`.

### (3) Ce que le direct garde tel quel

- **Logique** : 15 fichiers sur 23 (`antenna`, `comments`, `delegations`, `grants`, `hostPresence`, `invitationSettle`, `moderation`, `permissions`, `presence`, `reactions`, `reap`, `replay`, `replayComposition`, `retention`, `speakers`).
- **Actions** : `actions/livekitDirect.ts` entier.
- **Egress** : pipeline Egress `direct` (`lib/egress*`, branche direct ; route `http.ts` L1311-1444).
- **Crons** : L270-296.
- **Audiences** : `public`, `connections`, `invitees`.
- **Limiteurs** : `directComment`, `directReaction`, `directAntennaRequest`, `directAntennaInvite`.
- **Les 12 tables, sur le fond.**
- **Ce qui change :** l'audience `organisation` devient la page ; `isPublicUser` devient l'adhésion ; `communication.publish` devient un rôle de page ; ajout de `networkId` (index de découverte `by_status_and_startedAt` et `by_status_replayStatus_endedAt` à préfixer par le réseau) ; `notifyPersonal` et `writePersonalPost` pointent vers leurs équivalents ANTSIA.

### (4) Ordre de duplication proposé

0. **Prérequis ANTSIA** : `persons`, `networks`, `requireMembership`, graphe (`isConnectedTo`, `isBlockedBetween`), fils de groupe, notifications, push VAPID, `rateLimiter`, `uploadPolicy`/`fileGuard`.
1. **Transport** : `lib/livekit`, `lib/livekitWake`, `lib/livekitIdentity` (simplifié), avec leurs tests.
2. **Modules purs des appels** : `group` (tel quel), `scope` réduit à `journal`, `admission`, `capacity`, `validators`, avec leurs tests node.
3. **Tables** : `calls`, `callInvites`, `callPreferences`, `voicemails`, `personPresence`.
4. **Présence par personne** : `heartbeat`, `setOffline`, `cleanup`, `forMyConnections`/`forNetworkMembers`, `offlineHints`.
5. **Préférences.**
6. **`evaluate` simplifié.**
7. **Appel 1:1** : `callMember`, `setCallRinging`, `join`, `leave`, `declineCall`, `hold`/`resume`, `listRinging`, `listCallHistory`, `cleanupStaleCalls` et son cron, `push`, `requestToken` et `getAuthorizedForToken`.
8. **Groupe** : `groupCalls`, `ringExpiry`.
9. **Messagerie vocale.**
10. **Egress** (libs, `verifyEgressWebhook`/`ingestEgressFile`, route `http`).
11. **Direct** : `validators` puis purs, `tables`, `access`, `sessions`, puis les autres, puis `livekitDirect`, puis les crons.
12. **Cliquets** (`attachmentGate` remplacé par `requireMembership`).

### (5) Variables d'environnement lues

| Variable | Où |
|---|---|
| `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `LIVEKIT_WS_URL` | `lib/livekit.ts` L39-41 ; `actions/livekit.ts` L96-97, L552-554, L741-742 ; `actions/livekitDirect.ts` L329-331 |
| `LIVEKIT_EGRESS_URL` (facultative) | `actions/livekit.ts` L567 ; `actions/livekitDirect.ts` L338 |
| `LIVEKIT_WAKE_URL`, `LIVEKIT_WAKE_TOKEN` (facultatives) | `lib/livekitWake.ts` L86-87 |
| `LIVEKIT_WEBHOOK_SECRET` (historique, facultative) | `http.ts` L1346 |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (push d'appel) | `actions/push.ts` L66-77 |
| `NEXT_PUBLIC_LIVEKIT_WS_URL` / `LIVEKIT_WS_URL` (client) | `packages/livekit/csp.mjs` L70 |
| Exclues : `IREUNION_RECORDINGS`, `IREUNION_VIDEO`, `IREUNION_MAX_TRACKS`, `IREUNION_RECORDING_RETENTION_DAYS` | `ireunion/recordings.ts` L51-64 ; `ireunion/egressActions.ts` L51-53 et L85 |

### (6) Totaux

**Sources du périmètre A à D : 26 919 lignes**

| Bloc | Fichiers | Lignes | Gardées | Exclues |
|---|---|---|---|---|
| A, `iappel` | 26 | 9 423 | 16 fichiers / 6 071 l. | 10 fichiers / 3 352 l. |
| B, `meetings` + `agentPresence` | 4 | 3 861 | ≈ 1 070 l. réutilisables (≈ 35 %) | — |
| C, actions LiveKit | 2 | 1 630 | `livekitDirect` en entier, ≈ 260 l. de `livekit.ts` | — |
| C, libs | 7 | 1 240 | — | — |
| C, route `http.ts` | — | 170 | — | — |
| D, `direct` | 23 | 10 595 | tout | — |
| E, `ireunion` (hors total) | 10 | 2 800 | — | tout |

**Tests**

| Groupe | Fichiers | Lignes | Cas | Gardés | Exclus |
|---|---|---|---|---|---|
| `iappel` | 21 | 10 325 | 446 | 12 fichiers / 6 606 l. / 292 cas, dont environ 60 à retirer et 40 à adapter | 9 fichiers / 3 719 l. / 154 cas |
| `direct` | 21 | 12 157 | 340 | Tous ; 2 à réécrire (`organisationAccess` 10 cas, `revocation` 5 cas) | — |
| `lib` | 6 | 1 102 | 61 | — | — |
| `tests/` directement liés | 16 | 6 912 | 172 (+1 `it.each`) | — | — |
| `tests/` périphériques | 7 | 2 354 | 74 | — | tous |
| Hors `tests/` | 7 | 7 705 | 190 | Partiellement liés | — |

**Points d'attention majeurs pour ANTSIA**
- **`endStaleCalls` non borné** (`meetings.ts` L163-184), appelé à chaque appel émis.
- **Aucun limiteur de débit** sur tout le chemin d'appel.
- **Contrôle de blocage absent** sur les invités ad hoc (`groupCalls.ts` L694-713).
- **`cleanupStalePresence` borné à 500 lignes de toute la table** (`agentPresence.ts` L220-222).
- **`listOnlineAgents`/`countAvailableAgents` sans garde d'appartenance.**
- **Réécriture de `direct_sessions` à chaque admission de spectateur** (`access.ts` L792-808).
