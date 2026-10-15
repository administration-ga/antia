---
title: "ANTIA — Rapport de parité du backend (PA3)"
version: "0.1"
date: "2026-10-15"
statut: "En cours — un chapitre par module dupliqué, dans l'ordre de l'owner map (docs/02 §4.2)"
projet: "ANTIA"
source: "socle administration.ga, origin/main = ad2e7fdc2"
---

# ANTIA — Rapport de parité du backend

Pour chaque module dupliqué du socle (`docs/02_OWNER_MAP_DUPLICATION.md` §6) : la liste de parité cochée
(fichier par fichier), les adaptations (liste fermée du préambule de PA3), les corrections de dette (§5 de
l'owner map), les tests portés et neufs, les écarts assumés. Un module n'entre ici que vérifié (`verify` vert).

| # | Module | Commit | Tests portés / neufs | Dettes corrigées |
|---|---|---|---|---|
| 2 | `files` — garde des fichiers, politique de dépôt | `344f0fa` | 6 fichiers convex + 2 domaine + 4 cliquets | D05, D06, D31, D36 |
| 3 | `people` (profil, annuaire, images, mentions) et `media` | `6ef11f7` | 2 fichiers convex + 1 cas domaine | D05, D14, D36 |
| 4 | `graph` (connexions, blocages, abonnements) | `bfb2db9` | 1 fichier convex (15 cas) + 4 cas domaine | D04, D05, D12, D14, D17, D19 |
| 5 | `notifications` (cloche sociale, diffusion par lots) et avis de verdict des fichiers | `9f2f12b` | 1 fichier convex (10 cas) + 1 fichier domaine + 1 cliquet | D07, D18, D19 |
| 6 | `platform/audit` (journal des décisions du moteur) | `75e4b26` | 1 fichier convex (5 cas) + 4 cas fichiers + 1 fichier domaine + 1 cliquet | D14, D35 |
| 7 | `thematicGroups/access`, `posts` (accès, retrait, compteurs, écriture, fil, mur, recherche) et `marks` | `3dfebcc` | 2 fichiers convex (32 + 8 cas) + cas domaine | D01, D14, D18, D19, D24, D25, D35 |
| 8 | `engagement` (réactions, commentaires paginés, cloches) et `moderation` (signalements, file du réseau, décisions tracées) | `44831f1` | 2 fichiers convex (8 + 5 cas) + 1 fichier domaine | D01, D03, D08, D14, D35 |
| 9 | `thematicGroups` (module complet : cycle de vie, invitations, rôles, mur, découverte, modération de groupe) | `a38c863` | 1 fichier convex (17 cas) | D02, D10, D14, D17, D19 |
| 10 | `messaging` (fils personnels par réseau, boîte paginée, pastille tenue à l'écriture, pièces gardées, transfert) | `8c0ecda` | 1 fichier convex (37 cas) + 4 fichiers contrats (20 cas) | D13, D14, D16, D21, D37, D38, D39 |
| 11 | `groups` (conversations de groupe : création par invitation, lien, administration, messages, non-lus tenus, transfert, cascade) | `35db309` | 1 fichier convex (42 cas) + 1 fichier contrats (7 cas) | D02, D05, D07, D10, D14, D15, D16, D22, D23 |
| 12a | `events` (évènements personnels : création, invitation, réponse, annulation, annonce, agenda) | `3d397a9` | 1 fichier convex (20 cas) | D02, D14, D15, D19 |
| 12b | `stories` (publier, plateau, mur, vues, retrait, purge) | `989d1f0` | 1 fichier convex (17 cas) | D02, D05, D10, D14, D16 |
| 12c | `suggestions` (catalogue, masquage, invitations envoyées) | voir journal git (`feat(suggestions)`) | 1 fichier convex (10 cas) | D05, D14, D17, D19 |

Ordre suivi (owner map §4.2), avec un écart : le lot 1 (modules purs) est porté avec chaque module qui le
consomme ; l'avis de verdict des fichiers (`files/notify`) est arrivé avec le module `notifications` (lot 5), dont il
dépend.

---

## Lot 2 — `files` (garde des fichiers) et `L/uploadPolicy`

### Parité, fichier par fichier

| Source (`socle/convex/…`) | Cible | Sort | État |
|---|---|---|---|
| `modules/fileGuard/policy.ts` | `packages/social-domain/src/filePolicy.ts` + `convex/modules/files/policy.ts` | à adapter | ✅ fail-closed |
| `modules/fileGuard/verdict.ts` | `convex/modules/files/verdict.ts` | tel quel | ✅ copie textuelle |
| `modules/fileGuard/inspect.ts` | `convex/modules/files/inspect.ts` | tel quel | ✅ copie binaire vérifiée (`cmp`) |
| `modules/fileGuard/avProviders.ts` | `convex/modules/files/avProviders.ts` | à adapter | ✅ fournisseur indisponible hors local |
| `modules/fileGuard/scan.ts` | `convex/modules/files/scan.ts` | tel quel | ✅ `"use node"`, `jszip` 3.10.1 |
| `modules/fileGuard/tables.ts` | `convex/modules/files/tables.ts` (`fileScans`) | à adapter | ✅ |
| `modules/fileGuard/storageGuard.ts` | `convex/modules/files/storageGuard.ts` | à adapter | ✅ seul `getUrl` du moteur |
| `modules/fileGuard/admission.ts` | `convex/modules/files/admission.ts` | à adapter | ✅ |
| `modules/fileGuard/posedUploads.ts` | `convex/modules/files/posedUploads.ts` | tel quel | ✅ (personnes) |
| `modules/fileGuard/mutations.ts` | `convex/modules/files/mutations.ts` | à adapter | ✅ |
| `modules/fileGuard/queries.ts` | `convex/modules/files/queries.ts` | à adapter | ✅ |
| `modules/fileGuard/notify.ts` | `convex/modules/files/notify.ts` | à réécrire | ✅ au lot 5 (cloche sociale) |
| `modules/fileGuard/posedImages.ts`, `quarantine.ts`, `triage.ts` | — | exclus | — |
| `modules/fileGuard/triageModel.ts` | — | option V2 | — |
| `lib/uploadPolicy.ts` | `packages/social-domain/src/uploadPolicy.ts` (règles) + `convex/lib/uploadPolicy.ts` (stockage) | à adapter | ✅ |

### Adaptations (liste fermée)

- Identités et périmètre : `users` → `persons`, `orgId` → `networkId` (absent pour un fichier de profil) ;
  libération par un **modérateur du réseau** du fichier (`network_moderator`, `network_admin`) ou un
  opérateur, relance par un opérateur ; lecture du rapport par le déposant, un modérateur ou un opérateur.
- Erreurs : chaînes `UPLOAD_*:usage` et libellés → codes du moteur (`notFound` indistinct, `conflict`,
  règles `UPLOAD_TYPE_NOT_ALLOWED`, `UPLOAD_SIZE_OUT_OF_RANGE`, `UPLOAD_MISMATCH` traduites dans `rules`,
  retenues `fileScanPending`, `fileQuarantined` traduites dans `errors`).
- `isKeptApartStorage` retiré (registres RH, signatures, marques officielles, courrier : aucun dans le moteur).
- Quarantaine iDocument retirée : le statut bloquant EST la retenue.
- Libellés d'écran (`scanBadgeLabel`, `scanRefusalMessage`) retirés : l'écran traduit le statut.
- `getScanByStorageId`, `_reportForTriage`, `_ageScanForTests` non recopiées (la règle de lecture du rapport est
  celle de `getScan` ; les tests vieillissent la ligne eux-mêmes).

### Corrections de dette

- **D06 — garde fail-closed** : aucune ligne d'analyse = fichier RETENU (le socle le servait) ; coupe-circuit
  `FILE_GUARD=off` = analyses suspendues, nouveaux fichiers `pending` sans job (le socle les rendait servables) ;
  antivirus absent, inconnu, incomplet ou mock hors développement local = fournisseur indisponible, verdict
  `error` (le socle retombait sur un mock qui ne reconnaît qu'EICAR). Tests inversés en conséquence.
- **D05 — délivrance** : cliquet `file-delivery-gate` réécrit en **liste noire** (tout `storage.getUrl` hors de
  `storageGuard.ts` est rouge, sans exception).
- **D31 — famine de la purge** : index `[status, blobPurgedAt, updatedAt]` ; test neuf (50 lignes déjà purgées
  ne bloquent plus la suivante).
- **D36 — usages sociaux** : registre réduit aux usages du moteur (`media_social` avec GIF, `avatar`, `cover`,
  `page_logo`, `page_banner`, `album_image`, `story_media`, `chat_attachment`, `voice`, `live_recording`),
  sans exception au cliquet `upload-policy`.
- **D14 — débit** : seau `file.moderate` sur la libération et la relance (les dépôts passent par les seaux de
  leur module).

### Tests

- Portés : `verdict.test` (tel quel), `inspect.test` (tel quel), `avProviders.test` (sélection fail-closed),
  `policy.test` (scindé : servabilité inversée dans le domaine, interrupteurs côté backend), `fileGuard.test`
  → `files.test` (admission, délivrance fail-closed, verdicts, libération, balayeur, purge, lecture),
  `tests/uploadPolicy.test` (règles pures dans le domaine, lecture du stockage côté backend),
  `queries.rapport.test` (sa règle, sur `getScan` : un rapport sans réseau ne sort pas de son enclave).
- Cliquets portés : `uploadPolicyRatchet` → `upload-policy` (sans exception), `freshUploadRatchet` →
  `fresh-upload`, `storageArgFreshnessRatchet` → `storage-arg-freshness` (avec « test du test » sur sources
  fabriquées), `fileGuardGateRatchet` → `file-delivery-gate` (liste noire).
- Neufs : fraîcheur du dépôt (fichier d'autrui indistinct, le sien nommé), coupe-circuit qui suspend, antivirus
  absent hors local, fichier généré, pièces posées en bloc, purge sans famine, lecture bornée au réseau.

### Écarts assumés

- **Repli sur le type déclaré** quand le stockage ne porte aucun type : gardé (l'owner map le retirait). Le
  harnais convex-test n'enregistre aucun `contentType`, et l'inspection des octets confronte le type avant toute
  délivrance (garde fail-closed) : un fichier qui ment reste `suspicious`.
- **Avis de verdict** (`files/notify`) : arrive avec le module `notifications`.
- **Backend local et actions Node** : le backend local refuse tout déploiement contenant une action
  `"use node"` si son Node n'est pas en version 20, 22 ou 24 ; `bun run dev:convex` passe désormais par
  `scripts/convex-dev.mjs`, qui met un Node supporté en tête du PATH (Homebrew `node@24/22/20`, puis nvm).

---

## Lot 3 — `people` (profil social complet, annuaire, mentions) et `media`

### Parité, fichier par fichier

| Source (`socle/convex/…`) | Cible | Sort | État |
|---|---|---|---|
| `reseauPersonnel/people.ts` — `rethrowDomain` | `convex/lib/errors.ts` (`rethrowDomain`, `checked`, PA2) | à réécrire | ✅ |
| `reseauPersonnel/people.ts` — `addedMentionedUserIds` | `packages/social-domain/src/content.ts` (`addedMentionedIds`) | pur | ✅ |
| `reseauPersonnel/people.ts` — `livePersonalProfile`, `findPublishedPersonByHandle`, `publishedMiniProfile`, `miniProfileCache`, `resolveMentionedUserIds` | `convex/modules/people/miniProfile.ts` | à réécrire | ✅ |
| `reseauPersonnel/people.ts` — `getMyProfile`, `ensureMyProfile` | `people/persons.ts` (`getMyPerson`, `ensureMyPerson`, PA2 ; photo et couverture ajoutées) | à réécrire | ✅ |
| `reseauPersonnel/people.ts` — `publishMyProfile`, `suggestHandles` (tranche verticale), `withdrawMyProfile`, `setMyProfilePrivacy`, `setMyAvatar`, `setMyCover`, `getPublicProfile`, `assertFreshAvatarStorage` | `convex/modules/people/profile.ts` | à réécrire | ✅ |
| `reseauPersonnel/people.ts` — `searchPeople` | `convex/modules/people/directory.ts` | à réécrire | ✅ |
| `reseauPersonnel/people.ts` — `confirmMyHandle` | — | sans objet | — (aucun identifiant provisoire : la personne choisit le sien dès la publication) |
| `reseauPersonnel/people.ts` — `ensurePublishedProfile`, `civilNameOf`, positions et administrations | — | **retirés** | — (publication d'office contraire à l'invariant 7) |
| `reseauPersonnel/handleSuggestion.ts` | `packages/social-domain/src/handleSuggestion.ts` | tel quel | ✅ (PA2) |
| `lib/accountErasure.ts` | `convex/modules/people/accountErasure.ts` | à adapter | ⏳ avec l'effacement (PA5) |
| `reseauPersonnel/media.ts` | `convex/modules/media/media.ts` + `packages/social-contracts/src/media.ts` (`PostMediaDto`) | à adapter | ✅ |

### Adaptations (liste fermée)

- `users` + `reseauPersonnel_profiles` → `persons` ; « joignable » = profil publié, personne non effacée **et membre
  active du réseau demandé** (fiche, mentions, annuaire) : un réseau ne voit jamais un non-membre.
- Annuaire **par réseau** : projection `peopleDirectory` (réseau, personne, texte cherchable replié, `listed`), index
  de recherche à `filterFields: ["networkId", "listed"]`, tenue par `syncPersonDirectory` à chaque changement de
  profil ou de statut d'adhésion (dans les aides partagées : une tranche n'a rien à y penser).
- Nom neutre rendu `null` (l'écran le traduit) ; badges calculés joints aux mini-profils.
- Images de profil par la garde des fichiers (fraîcheur, politique `avatar`/`cover`, retenue nommée tant que
  l'analyse n'a pas conclu) ; `getUrl` brut du socle (8 dans `people.ts`) remplacés par `resolveFileDelivery`.
- `media` : déclaration du client confrontée au stockage (type et poids : `UPLOAD_MISMATCH`), admission sous la
  politique de l'usage, URL de dépôt sous adhésion et usage déclaré, DTO avec retenue nommée.
- Débit : `person.profile` sur retrait, mode privé et images ; `upload.url` sur les URL de dépôt.

### Corrections de dette

- **D36** : l'exception `media_social` disparaît — les usages des publications, stories et avatars dérivent des
  constantes du domaine (une seule source) ; le PDF sort de `media_social` (une publication porte des images et des
  vidéos), il reste admis en pièce de conversation.
- **D05** : aucun `getUrl` brut dans `people` et `media`.
- **D14** : débit sur les écritures du profil et les URL de dépôt.

### Tests

- Portés et adaptés : `media.adoption.test` → `media.test` (vérification et délivrance des médias, pour elles-mêmes ;
  les cas qui passent par les stories et les groupes thématiques reviennent avec ces modules) ;
  `profileAutoPublish.test` **réécrit en négatif** (rien n'est publié d'office) ; cas `people.*` de
  `reseauPersonnel.test` → `people.test` (retrait, mode privé, fiche, mentions).
- Neufs : annuaire borné au réseau (réseau fermé, non-membre, suspension racine, départ), images retenues jusqu'au
  verdict, image d'autrui refusée comme absente, mini-profil mémoïsé.

### Écarts assumés

- **Blocage** : le filtre du blocage (annuaire, fiche) arrive avec le graphe (lot 4), qui porte `isBlockedBetween`.
- **`accountErasure`** : porté avec l'effacement complet des tables sociales (PA5, D32).
- **Type déclaré des images de profil** : `setMyAvatar`/`setMyCover` acceptent le type annoncé par l'écran, confronté
  au stockage (même repli que la politique de dépôt quand le stockage n'en porte pas).

---

## Lot 4 — `graph` (connexions, blocages, abonnements)

### Parité, fichier par fichier

| Source (`socle/convex/…`) | Cible | Sort | État |
|---|---|---|---|
| `modules/reseau/connections.ts` | `convex/modules/graph/connections.ts` | à réécrire | ✅ |
| `modules/reseau/enums.ts` (l. 183-196) | `packages/social-domain/src/connectionState.ts` (`CONNECTION_STATUSES`, PA2) | à adapter | ✅ |
| `modules/reseau/tables.ts` (l. 96-122) | `convex/modules/graph/tables.ts` (`connections`) | à adapter | ✅ |
| `modules/reseau/graphGuards.ts` | — | exclu | — (le plancher défini positivement est `requireMembership`) |
| `reseauPersonnel/graph.ts` (l. 1-223) | `convex/modules/graph/graph.ts` | à adapter | ✅ (l. 225-327 exclues : organisations, collègues) |
| `reseauPersonnel/connections.ts` | fusionné dans `convex/modules/graph/connections.ts` | à réécrire | ✅ (`requestByHandle` + `requestByUserId` → `requestConnection`, `respond`, `paginateMine`, `paginatePendingForMe`, `searchMine`, `pendingState`) |
| `reseauPersonnel/follows.ts` | `convex/modules/graph/follows.ts` | à adapter | ✅ |
| `reseauPersonnel/connectionState.ts` | `packages/social-domain/src/connectionState.ts` | à adapter | ✅ (PA2 ; `canonicalPair` et `viewConnection` ajoutés) |
| `modules/reseau/*` (16 fichiers institutionnels) | — | exclus | — |

### Adaptations (liste fermée)

- Personnes et réseaux : une ligne par paire ET par réseau (`networkId`, `personIdLow`/`personIdHigh`) ;
  abonnements par réseau ; garde d'adhésion par le constructeur au lieu d'`assertNotSuspended`.
- **Blocage sur toute la paire, tous réseaux** : écrit sur chaque ligne de la paire (créée dans le réseau
  courant au besoin), lu par l'index `by_pair` ; il ferme aussi l'annuaire, la fiche et l'abonnement. Bloquer
  dans un réseau pour être retrouvé dans un autre ne protégerait de rien.
- Une seule façade (plus de délégation par `runMutation`) ; adressage par identifiant OU par personne, avec la
  même exigence de découvrabilité et d'adhésion de la cible (EXF-AN-15 : manque du socle sur l'API brute).
- Demandes reçues listées par un index (`recipientPersonId` dénormalisé) au lieu d'un `.filter()`.
- Décompte d'abonnés par l'agrégat `followerCounts` (composant `aggregate`, instance nommée) au lieu de compter
  des lignes ; suggestions puisées dans l'annuaire du réseau.
- Erreurs à code ; DTO sans fonction ni administration, avec badges calculés.

### Corrections de dette

- **D12 — fuite du blocage** : le bloqué reçoit la réponse d'une demande envoyée, sans écriture ; le test
  l'AFFIRME (au socle, le test qui devait l'empêcher n'affirmait rien).
- **D04 — plafond qui lève** : `listMine`/`listPendingForMe` (qui levaient au-delà de 200) non recopiés ;
  pagination native partout.
- **D19 — troncatures silencieuses** : les lectures bornées du graphe rendent `truncated` (l'appelant dit la
  lacune) ; `listMyFollows` paginé.
- **D17 — lecture sans index** : suggestions d'abonnement par l'annuaire du réseau (`by_network_listed`), plus
  par un balayage de tous les profils.
- **D05** : avatar des suggestions par la garde. **D14** : seaux `connection.request`, `connection.respond`,
  `connection.block`, `follow.toggle`.

### Tests

- Portés : `tests/reseauConnections.test` (paire canonique, demande, réponse, réouverture, blocage, vue,
  demandes en attente, pagination exhaustive) ; `reseauPersonnel/connections.test` (`searchMine`,
  `pendingState`, découvrabilité de la porte par personne) ; cas `follows.*` de `reseauPersonnel.test`.
- Neufs : D12 affirmé, blocage d'un réseau valant dans un autre (fiche, annuaire, abonnement fermés), décompte
  par agrégat.

### Écarts assumés

- **Cloche** (demande, acceptation, nouvel abonné) : branchée au lot 5.
- **Directs révoqués au blocage** (`revokeConnectionDirects`) : point d'accroche branché avec `live` (lot 16).
- **Rompre une connexion sans bloquer** : absent du socle, non ajouté (parité).

---

## Lot 5 — `notifications` (cloche sociale, diffusion par lots) et avis de verdict des fichiers

### Parité, fichier par fichier

| Source (`socle/convex/…`) | Cible | Sort | État |
|---|---|---|---|
| `reseauPersonnel/notifications.ts` (l. 54-126 : genres, résolutions, clé de sujet) | `packages/social-domain/src/notifications.ts` | pur | ✅ |
| `reseauPersonnel/notifications.ts` (l. 128-253 : `notifyPersonal`, résolution) et `lib/notify.ts` | `convex/modules/notifications/notify.ts` (`notifyPerson`, `resolveNotifications`) | à adapter | ✅ (push : PA5) |
| `reseauPersonnel/notifications.ts` (l. 255-499 : liste, non-lus, marquages) | `convex/modules/notifications/bell.ts` | à adapter | ✅ (`myNotifications` → `paginateNotifications`) |
| `reseauPersonnel/tables.ts` (l. 391-455, `reseauPersonnel_notifications`) | `convex/modules/notifications/tables.ts` | à adapter | ✅ |
| `schemas/notifications.ts` | — | remplacé | — (table du centre administratif : titre, corps, lien ; la table unique du moteur dérive de la cloche sociale, voir écarts) |
| `icom/notifyFanout.ts` | `convex/modules/notifications/fanout.ts` | patron | ✅ |
| `modules/fileGuard/notify.ts` | `convex/modules/files/notify.ts` | à réécrire | ✅ |
| `tests/notificationsWriterRatchet.test.ts` | `tests/ratchets/notifications-writer.test.ts` | patron | ✅ (zéro exemption) |
| `actions/push.ts`, `schemas/pushSubscriptions.ts`, `functions/pushSubscriptions.ts` | `M/notifications/push.ts`, `pushSubscriptions.ts` | à adapter | ⏳ PA5 (D20, D29) |
| `crons/notificationsRetention.ts` | `M/notifications/retention.ts` | à adapter | ⏳ PA5 (D30) |
| `icom/autoEnroll.ts` | `M/groups/`, `M/thematicGroups/` | patron | ⏳ avec ces modules |
| `functions/notifications.ts` (centre administratif, 600 l.) | — | exclu | — |

### Adaptations (liste fermée)

- **Une seule table** `notifications`, PAR RÉSEAU (`networkId`, destinataire, acteur facultatif, genre, sujet typé,
  clé de dédoublonnage `genre|sujet|acteur`). Aucun titre, corps ni lien stocké : l'écran traduit le genre (i18n) et
  route le sujet ; ouvrir le sujet le relit avec sa garde.
- **Porte unique** `notifyPerson` : jamais soi-même, jamais un non-membre actif du réseau, jamais à travers un blocage
  (ces deux gardes sont neuves) ; un même geste rafraîchit la ligne (non lue, non résolue) au lieu d'en empiler une.
- **Résolution par le serveur** (`resolveNotifications`, préfixe `genre|sujet|`) : toutes les lignes du sujet, quel
  que soit l'acteur, sont résolues et lues d'office sans écraser une date de lecture ; `markAllRead` ne résout rien.
- **Sujets** typés au fil des modules (publication, connexion, analyse de fichier pour l'instant) ; le DTO porte
  l'état VIVANT d'une demande de relation (`inviteState`) et d'une analyse (`fileScanStatus`), et l'acteur par le
  mini-profil publié (badges calculés).
- **Diffusion** (`enqueueFanout`) : un job planifié par lots de 150 par la porte unique, replanifié tant que la
  source n'est pas épuisée ; sources génériques (liste de personnes, abonnés d'une personne dans le réseau) ; aucune
  écriture sur le document du sujet.
- **Avis de verdict des fichiers** : le déposant et les modérateurs du réseau (rôles `network_moderator` et
  `network_admin`, index `by_network_and_role`) au lieu du DSI ; un fichier de profil (sans réseau) est signalé dans
  la racine ; l'avis ne fait jamais échouer l'analyse.
- **Cloches du graphe** : demande (création et réouverture), acceptation (résout la demande, prévient le demandeur),
  refus (résout, silence pour le demandeur), nouvel abonné. Seaux `notification.read` et `notification.readAll`.

### Corrections de dette

- **D18 — liste qui lève** : `myNotifications` (curseur temporel qui levait à égalité de date) non recopiée ;
  pagination native, aucune ligne sautée (test sur cinq lignes de même date).
- **D19 — troncature silencieuse** : `unreadCount` rend `{ count, capped }` (99+, l'écran dit la lacune).
- **D07 — diffusion dans la transaction** : le patron par lots chaînés est en place pour les modules qui notifient
  en nombre (groupes, messagerie, publications : D08 s'y branchera avec `posts` et `engagement`).
- Post-filtre `.filter()` de `markAllRead` remplacé par l'index des non-lus borné à la date du clic.

### Tests

- Portés : `reseauPersonnel/notifications.test` (pagination sans saut, continuations de `markAllRead` sans absorber le
  futur, résolution quel que soit l'acteur sans écraser `readAt`, réouverture remise à zéro, `markAllRead` lit sans
  résoudre, état vivant de la demande, accepter et refuser, rejeu) ; `tests/notifications.test` (dédoublonnage par
  clé, jamais soi-même, isolement par destinataire).
- Neufs : porte fermée au blocage et au non-membre, non-lus bornés avec lacune, diffusion de plus d'un lot (liste et
  abonnés), avis de verdict au déposant et aux modérateurs ; domaine (`notifications.test.ts`) ; cliquet
  `notifications-writer`.

### Écarts assumés

- **`unreadCount` sur lecture bornée, pas sur compteur** (owner map §6.4 « sur compteur ») : au plus 100 lignes lues
  par l'index des non-lus ; un compteur serait un document chaud écrit à chaque notification, en conflit avec la
  diffusion par lots.
- **`schemas/notifications.ts` remplacé** par la table de la cloche sociale : la table administrative porte un titre,
  un corps et un lien, que le moteur ne stocke pas.
- **Push** (abonnements, envoi sans aperçu, D20, D29) et **rétention** (D30) : PA5.
- Les genres de messagerie, groupes, évènements et directs sont déclarés au domaine ; ils sonnent avec leur module.
- Quatre genres de la tranche `diaspora`, sans sujet, à la demande de DIASPORALE : `sponsorship_received`,
  `sponsorship_withdrawn` (sans acteur si la modération retire), `attestation_verified`, `attestation_not_confirmed`
  (aucune raison consulaire) ; émis par `convex/modules/diaspora/` via `notifyPerson`.

---

## Lot 6 — `platform/audit` (journal des décisions du moteur)

### Parité, fichier par fichier

| Source (`socle/convex/…`) | Cible | Sort | État |
|---|---|---|---|
| `lib/contextAudit.ts` | `convex/modules/platform/audit.ts` (`appendAudit`, lectures) et `packages/social-domain/src/audit.ts` (actions, qualités, sujets, détail, motif) | à adapter | ✅ |
| `schemas/auditLog.ts` | `convex/modules/platform/tables.ts` (`engineAudit`) | à adapter | ✅ |
| `functions/archive.ts` — `logAudit` (`archiveAuditLog`) | `appendAudit` | remplacé | ✅ (garde des fichiers : libération, relance, purge) |
| `triggers/index.ts` (audit automatique, l. 568-643) | — | exclu | — (le moteur trace des DÉCISIONS, pas chaque écriture) |
| `tests/reseauPlatformActsAudit.test.ts` | `convex/modules/platform/audit.test.ts` | patron | ✅ |

### Adaptations (liste fermée)

- **Une seule table** `engineAudit`, AJOUT SEUL, écrite dans la transaction de la décision : une décision refusée
  n'a pas de ligne. Les tables `operatorAudit` et `moderationAudit` du cahier (§11) en sont deux lectures.
- **Qualité de l'acteur** (`capacity` : `platform_admin`, `platform_operator`, `network_admin`, `network_moderator`,
  `system`) : la qualité qui AUTORISAIT l'acte, au lieu du contexte institutionnel (organisation, rattachement,
  affectation, poste). Un acte du système n'a pas d'acteur, un acte humain en a un (vérifié à l'écriture).
- **Sujet typé** (table d'une liste fermée et identifiant) et réseau de l'acte ; **détail plat et borné** (12 clés,
  500 caractères, des scalaires) au lieu de `changes: v.any()` ; `operation` retiré (le verbe canonique la dit).
- **Motif de décision** : règle du domaine `DECISION_REASON_LENGTH` (seuil bas propre à la décision : 10 en console,
  3 pour libérer un fichier ; seuil haut commun : 500), traduite en fr et en.
- **Décisions branchées** : réseaux (créer, régler, archiver) ; suspension partout et levée (motif désormais exigé
  pour lever) ; garde des fichiers (libération par un modérateur du réseau ou un opérateur, avec sa qualité ;
  relance par un opérateur ; purge par le système).
- **Lectures** : la console lit tout (`paginateAudit`, par réseau ou entier ; `paginateSubjectAudit`) ; un
  administrateur ou un modérateur lit le journal de SON réseau (`paginateNetworkAudit`), tout autre membre reçoit
  le refus indistinct ; l'acteur est rendu par son mini-profil publié.
- **Cliquet `operator-audit`** : toute `operatorMutation` appelle `appendAudit` dans sa définition même.

### Corrections de dette

- **D14** : débit sur `suspendEverywhere` et `liftSuspension` (seau `operator.membership`).
- **D35** : trois index, tous lus (`by_at`, `by_network_at`, `by_subject_at`) ; l'index par acteur viendra avec son
  lecteur (effacement, PA5).
- Le validateur permissif du socle (`changes: v.any()`) n'est pas recopié.

### Tests

- Patron porté : une décision écrit sa ligne, une décision refusée n'en écrit pas (suspension, levée, réseaux).
- Neufs : qualité de l'acteur (administrateur et opérateur de plateforme, modérateur du réseau, système), motif
  nettoyé et borné, lectures et refus indistinct, cohérence d'une ligne ; journal de la garde des fichiers (quatre cas
  dans `files.test.ts`) ; domaine (`audit.test.ts`) ; cliquet `operator-audit` (avec son test du détecteur).

### Écarts assumés

- **`operatorAudit` et `moderationAudit`** (cahier §11) : une table, deux lectures (owner map, E9).
- **Effacement d'une personne** (PA5) : l'acte reste au journal, l'acteur sera pseudonymisé.
- **Tranche diaspora** : l'action `diaspora.sponsorship_revoke` (retrait d'un parrainage par la modération) est
  déclarée ; DIASPORALE l'émet depuis sa tranche.
- **Double validation des actes irréversibles** (EXF-AN-40) : avec la console (PA7).

---

## Lot 7 — `thematicGroups/access`, `posts` et `marks`

### Parité, fichier par fichier

| Source (`socle/convex/modules/reseauPersonnel/…`) | Cible | Sort | État |
|---|---|---|---|
| `groupesThematiquesAccess.ts` | `convex/modules/thematicGroups/access.ts` | tel quel | ✅ (codes au lieu des libellés, réseau de l'acte) |
| `tables.ts` (l. 922-990, groupes et membres) | `convex/modules/thematicGroups/tables.ts` | à adapter | ✅ partiel : invitations, découverte, décompte des membres au lot 9 |
| `access.ts` | `convex/modules/posts/access.ts` | à adapter | ✅ |
| `contentRemoval.ts` | `convex/modules/posts/contentRemoval.ts` | à adapter | ✅ (retrait d'un commentaire : lot 8) |
| `counters.ts` | `convex/modules/posts/counters.ts` | à adapter | ✅ |
| `postWrite.ts` | `convex/modules/posts/postWrite.ts` | à adapter | ✅ |
| `posts.ts` | `convex/modules/posts/posts.ts` | à adapter (lourd) | ✅ (pages : lot 13 ; direct et évènements : leurs lots) |
| `tables.ts` (l. 137-300, publications) | `convex/modules/posts/tables.ts` | à réécrire | ✅ |
| `marks.ts` | `convex/modules/marks/marks.ts` | à adapter | ✅ |
| `tables.ts` (l. 465-500, marques et sourdines) | `convex/modules/marks/tables.ts` | à adapter | ✅ |
| `tests/backfillReseauPersonnelPostAggregates.test.ts` | `convex/migrations.ts` (`setPostsOnRoot`) | patron | ✅ |

### Adaptations (liste fermée)

- **Contexte de lecture** : une publication se lit DEPUIS le réseau de la fonction appelée — le sien, ou la racine
  si elle est `root`. Une publication `network` d'un réseau fermé n'est rendue par aucune lecture de la racine (R4) ;
  la racine lit ses natives et les `root` de tous les réseaux, avec leur ORIGINE (`origin`, pastille du fil).
  `onRoot` est dénormalisé à l'écriture (un index pour le fil, le mur et la recherche de la racine) ; migration
  `setPostsOnRoot` pour les lignes d'avant.
- **Blocage** : il l'emporte sur toute audience, `public` compris (cahier §12.3) — lecture, fil, recherche, mur,
  réaction, marque ; au socle, il ne restreignait que l'audience `group`. Un ensemble de blocages tronqué fait relire
  la paire : le blocage n'est jamais une lacune.
- **Fil** : fenêtres par auteur, fusion k-voies, curseur composite et deux phases gardés ; lecteurs de fenêtre
  factorisés (réseau, racine, auteur) ; portée « mon_administration », collègues, organisations et notes de service
  retirés ; `lacunar` rendu à l'écran.
- **Publier** : groupe (appartenance vivante, forme, pas de partage), médias sous la garde des fichiers, partage aplati
  sur l'original, portée et pays jugés contre le réseau (`assertPostReach`), « aussi sur ANTIA » ; idempotence par
  auteur (une clé rejouée dans un autre réseau est refusée) ; cloches du partage et des citations par la porte unique.
- **Épingle** par réseau, posée sur l'adhésion, rendue à part en première page du mur.
- **Marques et sourdines par réseau** (celui où elles sont posées) ; listes paginées seules.
- **`feed`** (fil « Récents » à curseur natif de la tranche verticale) gardé pour les écrans existants (antia.ga,
  DIASPORALE), DTO étendu sans retrait.
- **Réaction** sous la même garde (`assertVisiblePost`).
- Débit : `post.edit`, `post.remove`, `mark.toggle`, `mute.toggle`.

### Corrections de dette

- **D01** : aucun compteur sur la publication ; partages (et commentaires au lot 8) dans l'agrégat `engineCounters`.
- **D18** : `myBookmarks` et `myHiddenPosts` (qui levaient au-delà de 50) non recopiées.
- **D19** : masquages, sourdines, connexions et abonnements bornés AVEC leur lacune ; `myMutes` et `myPosts` paginées.
- **D24** : bornes et fusion conservées, portée réseau, collègues retirés, lacune exposée.
- **D25** : une seule garde dans la recherche.
- **D35** : `by_directSessionId`, `by_eventId`, `by_sharedPostId` non recopiés.
- **D14** : débit sur les gestes de publication et de marque.

### Tests

- Portés (`reseauPersonnel.test`, `feedScale.test`, `marks.test`) : audience, rupture, retrait, abonné hors du
  cercle, pagination du fil (sans trou, ex æquo, au-delà de 50 et de 200), idempotence, profil retiré, médias (URL ou
  retenue, poids réel, vidéo seule, cinq images), partage (garde du lecteur, aplatissement, décompte), recherche
  (accents, inconnu, garde, retrait, requête courte, partage sans corps), citations, mur (audiences, retirées, refus
  indistinct, continuation de 75 publications), masquer, enregistrer, suivre, sourdine, pagination de plus de 50 marques.
- Neufs : contexte de lecture (R4, « aussi sur ANTIA » avec origine, natif de la racine), blocage qui l'emporte sur
  `public`, portée et pays, groupe (forme, appartenance, départ), édition, épingle, lacune, fil natif compatible,
  marque par réseau ; domaine : `assertPostReach`, blocage dans `isVisibleTo`.

### Écarts assumés

- **Fil d'un hub pays** (DIASPORALE, EXF-DG-15/16) : la portée et le pays sont posés et validés ; la lecture par pays
  attend la demande précise de DIASPORALE.
- **Commentaires, cloche des réactions, abonnés d'une publication** : lot 8 (`engagement`).
- **Groupes thématiques** (créer, rejoindre, mur) : lot 9 ; les publications de groupe sont testées sur des lignes posées.
- **Seau renforcé** `post.publish.reinforced` (déclarée sans badge) : avec la modération à l'échelle (PA5).

---

## Lot 8 — `engagement` et `moderation`

### Parité, fichier par fichier

| Source (`socle/convex/modules/reseauPersonnel/…`) | Cible | Sort | État |
|---|---|---|---|
| `engagement.ts` | `convex/modules/engagement/engagement.ts` | à adapter | ✅ (`listComments` → `paginateComments` + `paginateReplies`) |
| `tables.ts` (l. 324-346, commentaires) | `convex/modules/engagement/tables.ts` (`postComments`) | à adapter | ✅ |
| `contentRemoval.ts` — `markPersonalCommentRemoved` | `convex/modules/posts/contentRemoval.ts` (`markCommentRemoved`) | à adapter | ✅ |
| `moderation.ts` | `convex/modules/moderation/moderation.ts` | à adapter | ✅ |
| `tables.ts` (l. 347-366, signalements) | `convex/modules/moderation/tables.ts` (`contentReports`) | à adapter | ✅ |
| `validators.ts` (l. 347-361, motifs et statuts) | `packages/social-domain/src/moderation.ts` | pur | ✅ (transitions explicites) |
| `marks.ts` — `NOTIFY_FANOUT` | source `postSubscribers` de `convex/modules/notifications/fanout.ts` | patron | ✅ |

### Adaptations (liste fermée)

- **Commentaires** : un seul niveau (le serveur aplatit), vivent dans le réseau de la publication ; racines paginées
  avec l'aperçu de trois réponses et leur nombre, réponses paginées (D03) ; comptés par l'agrégat `engineCounters`
  (publication et racine) — l'engagement n'écrit plus la publication (D01, vérifié par test) ; commentaires d'un
  auteur bloqué écartés.
- **Cloches** : réaction (auteur), commentaire (auteur, personne à qui l'on répond), citation (personnes citées),
  chacune par `notifyAboutPost` — dans le réseau d'où le destinataire peut OUVRIR la publication (le sien, sinon la
  racine pour une publication `root`), garde de lecture rejouée pour lui ; abonnés de la publication par la
  DIFFUSION PAR LOTS (source `postSubscribers`), re-gardés au moment de sonner (D08, au lieu d'une boucle de 100 dans
  la transaction).
- **Signalements** : sur un contenu qu'on voit, jamais le sien (refus indistinct), dédoublonnés, masqués pour le
  déclarant ; la file appartient au réseau du CONTENU (`networkId`), servie à ses modérateurs et administrateurs ;
  l'opérateur de plateforme tranche en dernier ressort (`decideAsOperator`). DTO de file sans corps, sans auteur,
  sans déclarant.
- **Décisions** : transitions du domaine (examen depuis l'ouverture ; terminale définitive), motif borné
  (`assertDecisionReason`), retrait par les aides du moteur (agrégats décomptés), ligne de journal écrite par le
  décideur (`moderation.report_decide`, qualité du décideur) au lieu d'`appendContextAudit`.
- Débit : `comment.edit`, `comment.remove`, `report.create`, `moderation.decide`.

### Corrections de dette

- **D01** : réactions par fragments, commentaires par agrégat ; la publication n'est jamais réécrite par l'engagement.
- **D03** : pagination par racine et réponses paginées (le socle rendait 100 lignes et 10 réponses, sans curseur).
- **D08** : abonnés d'une publication par la diffusion par lots, hors de la transaction du commentaire.
- **D14** : débit sur chaque geste d'engagement et de modération.
- **D35** : `by_parent_and_createdAt`, `contentReports.by_post` et `by_comment` non recopiés.

### Tests

- Portés : réagir (bascule, changement, retrait, refus si invisible), réponses à un niveau, retrait d'un commentaire
  (auteur de la publication oui, tiers non ; retiré sans réponse), lister exige de voir, citation en commentaire, réponse
  qui prévient, abonné prévenu puis plus après révocation (`reseauPersonnel.test`) ; gardes de signalement, file
  anonymisée, dossier en examen jusqu'à la décision terminale, retrait modéré qui décompte (`moderation.test`) ;
  patron `reseauPlatformActsAudit` (la décision écrit sa ligne).
- Neufs : la publication n'est jamais réécrite par une réaction, 150 racines paginées sans perte, réponses paginées et
  décomptées, commentaires d'un auteur bloqué écartés, opérateur en dernier ressort ; domaine (`moderation.test.ts`).

### Écarts assumés

- **Modération à l'échelle** (équipes, files par équipe puis réseau puis plateforme, sanctions graduées, recours,
  relecture, mots bloqués, détection de spam, rapport périodique) : PA5, sur `contentReports` et `engineAudit`.
- **Prévenir l'auteur d'un retrait** et le **recours** : PA5 (EXF-AN-28/29).

---

## Lot 9 — `thematicGroups` (module complet)

### Parité, fichier par fichier

| Source (`socle/convex/modules/reseauPersonnel/…`) | Cible | Sort | État |
|---|---|---|---|
| `groupesThematiques.ts` | `convex/modules/thematicGroups/thematicGroups.ts` | à adapter | ✅ |
| `tables.ts` (l. 922-1030) | `convex/modules/thematicGroups/tables.ts` (groupes, membres, invitations) | à adapter | ✅ |
| `groupesThematiquesAccess.ts` | `convex/modules/thematicGroups/access.ts` | tel quel | ✅ (lot 7) |
| purges de `stories.ts`, `groupes.ts`, `groupesThematiques.ts` (D10) | `convex/modules/files/purge.ts` (`purgeStoredFile`) | à réécrire | ✅ (blob ET ligne d'analyse) |

### Adaptations (liste fermée)

- **Par réseau** : le groupe, l'appartenance et l'invitation portent `networkId` ; toute fonction exige le réseau du
  groupe (un groupe d'un autre réseau est introuvable) ; adhésion par le constructeur ; « ressortissants »
  (`isPublicUser`) sans objet dans le moteur.
- **Effectif** dans l'agrégat `engineCounters` (D02), une entrée par appartenance vivante ; jamais un champ du groupe.
- **Découverte** indexée par réseau (`by_network_createdAt`, `search_name` filtrée par réseau, D17).
- **Listes** : membres et invitations paginés ; « mes groupes » bornés par activité récente avec `truncated` ; vivier
  d'invitation borné avec `truncated`, chaque relation jugée personne par personne (D19).
- **Mur du groupe** à curseur composite (le socle repartait d'un instant et perdait les ex æquo), blocage et
  masquage appliqués.
- **Invitations** par la cloche du moteur (nouveau sujet `thematicGroup`), résolues par le serveur (accepter, décliner,
  adhérer librement) ; anti-oracle (inconnue, non connectée, bloquée : même refus).
- **Suppression** : cascade bornée et chaînée qui nettoie réactions, fragments, commentaires (décomptés), marques,
  signalements, médias (blob ET ligne d'analyse, D10), membres (décomptés), invitations, puis le groupe.
- **Refus** à code : `notFound`, `groupMembershipRequired`, `groupRoleRequired` (neuf), règle
  `GROUP_OWNER_CANNOT_LEAVE` (neuve) ; débit `group.create`, `group.join`, `group.invite`, `group.moderate`,
  `group.manage` (D14).

### Corrections de dette

- **D02** : effectif par agrégat. **D10** : purge du blob avec sa ligne d'analyse. **D14** : débit sur chaque geste.
- **D17** : découverte filtrée par réseau. **D19** : listes paginées ou bornées avec leur lacune.

### Tests

- Portés (`groupesThematiques.test`) : idempotence et owner unique, adhésion et départ (effectif, rôle qui ne survit
  pas), l'owner ne quitte pas, fermer (actes gelés, découverte retirée, fiche gardée), archiver monotone, cascade de
  suppression, publier et lire dans un groupe (co-membre, non-membre, départ, aucune portée du fil, aucune recherche),
  blocage entre co-membres, partage interdit, invitations (rappel, acceptation qui résout toutes les lignes, anti-oracle,
  refus muet, déjà membre), vivier (statuts, relation bloquée, vivier propre), rôles et retraits, modération de groupe
  (épingler, retirer, re-garde), citations dans un groupe, découverte et « mes groupes », signalement.
- Neufs : groupe d'un autre réseau introuvable, clé rejouée dans un autre réseau refusée, mur à ex æquo parcouru sans
  perte, purge vérifiée jusqu'au blob et à la ligne d'analyse.

### Écarts assumés

- **Journal des décisions** : les gestes de modération d'un groupe (rôle, retrait, épingle) relèvent de
  l'autogestion du groupe et ne sont pas écrits dans `engineAudit` (comme au socle) ; la modération du réseau l'est.
- **Vivier d'invitation** borné à 200 connexions (la recherche serveur des connexions prend le relais), comme au socle.

---

## Lot 10 — `messaging` (messagerie personnelle d'un réseau)

### Parité, fichier par fichier

| Source (`socle/convex/…`) | Cible | Sort | État |
|---|---|---|---|
| `functions/chats.ts` (participation, messages, réactions, épingle, saisie) | `convex/modules/messaging/{participation,messages,reactions,pins,typing}.ts` | à réécrire par scission | ✅ (`listMessages` non recopiée : la pagination native seule ; push → PA5) |
| `modules/messagerieScope/threads.ts` | `convex/modules/messaging/threads.ts` | à réécrire (patron) | ✅ (un seul point de création de fil, `ensurePersonalThread`, et d'insertion, `appendPersonalMessage`) |
| `modules/messagerieScope/transfert.ts` | `convex/modules/messaging/forward.ts` | à adapter | ✅ (source et cible personnelles ; le groupe arrive au lot 11) |
| `modules/messagerieScope/forwardedFrom.ts` | `convex/modules/messaging/forwardedFrom.ts` | tel quel | ✅ |
| `modules/reseauPersonnel/messagerie.ts` | `convex/modules/messaging/inbox.ts` | à réécrire (partiel) | ✅ (`listMyThreadsPage` → `paginateMyThreads`) |
| `modules/reseauPersonnel/messagerie/attachmentStorage.ts` | `convex/modules/messaging/attachmentStorage.ts` | à adapter | ✅ |
| `modules/reseauPersonnel/messagerie/attachments.ts` | `packages/social-contracts/src/attachments.ts` | tel quel | ✅ (listes blanches dérivées de la politique de dépôt) |
| `modules/reseauPersonnel/messagerie/counterpart.ts` | `packages/social-contracts/src/counterpart.ts` | à adapter | ✅ |
| `schemas/chats.ts`, `chatMessages.ts`, `chatMessageReactions.ts`, `chatTyping.ts`, table `reseauPersonnel_unreadTotals` | `convex/modules/messaging/tables.ts` | à réécrire / adapter | ✅ |
| `schemas/chatMessages.ts` (`MESSAGE_EDIT_WINDOW_MS`) | `packages/social-contracts/src/messaging.ts` | à adapter | ✅ (borne de longueur ajoutée) |
| `schemas/messageReactions.ts` | `packages/social-contracts/src/messageReactions.ts` | tel quel | ✅ |
| `migrations/backfillUnreadTotals.ts` | `recomputePersonalUnreadTotal` (`threads.ts`) | patron | ✅ (référence de la pastille ; aucune donnée à rattraper) |
| cron `purge-expired-chat-typing` | `messaging-purge-expired-typing` (`convex/crons.ts`, 1 min) | patron | ✅ |

### Adaptations (liste fermée)

- **Par réseau** : un fil par paire ET par réseau (`by_network_pair`) ; la garde du fil (`requireThread`) exige
  d'y être partie, dans le réseau appelé, sans blocage entre les deux ; toute fonction passe par le constructeur
  (adhésion, `declaree` pour écrire). Être en relation à la racine n'ouvre rien ailleurs.
- **Ouvrir un fil** : relation acceptée DANS le réseau, ou fil déjà ouvert (jamais rétroactif) ; identifiant
  inconnu, profil retiré et blocage rendent le même refus ; soi-même et l'absence de relation se disent
  (`THREAD_SELF`, `THREAD_RELATION_REQUIRED`) ; être dans le même groupe n'ouvre rien.
- **Boîte** : l'union de deux plages d'index (`personLow`, `personHigh`) fusionnée avec un curseur par côté —
  sans doublon ni trou, une ligne écartée (fil archivé, correspondant bloqué) fait avancer son côté ; projection
  allowlistée ; interlocuteur nommé par le contrat `counterpartLabel` (profil publié, sinon le nom choisi — plus
  après une demande d'effacement —, jamais d'e-mail) ; nature du dernier message lue sur l'aperçu dénormalisé.
- **Pastille** : `unreadTotals` par (réseau, personne), tenue à l'envoi, à la lecture, au retrait, au masquage et
  au BLOCAGE ; `totalUnread` lit un document, plafond 99 DIT (`capped`).
- **Messages** : DTO allowlisté (ni identifiant de stockage, ni clé d'idempotence, ni liste de masquage) ; pièces
  servies par la garde des fichiers (URL ou retenue nommée) ; citation du même fil, extrait relu ; provenance
  relue ; retrait pour tous réservé à l'auteur dans la fenêtre (l'aperçu se rembobine, l'épingle tombe, le non-lu
  sort de la pastille de l'autre), masquage pour moi ouvert à tout participant ; marquage lu par lots chaînés.
- **Pièces** : admission à la garde (fraîcheur au nom de l'expéditeur, usage `chat_attachment`, réseau et
  déposant inscrits) ; poids et type relus au stockage — une déclaration qui ment est refusée (`UPLOAD_MISMATCH`)
  au lieu d'être écrasée ; le nombre est jugé avant toute lecture ; vocal par le mime de sa pièce, durée bornée.
- **Transfert** : la frontière est le RÉSEAU (refus explicite `MESSAGE_FORWARD_CROSS_NETWORK` pour un fil dont je
  suis partie, source comme cible) ; pièces recopiées par le serveur, relues au stockage, sans changer de
  déposant (le blob reste celui de l'original) ; idempotent par (cible, clé) ; vers un identifiant, les gardes de
  l'ouverture dans leur ordre, et le budget `thread.open`.
- **Débit** : `thread.open`, `message.send`, `message.read`, `message.edit`, `message.react`, `message.typing`,
  `message.forward`.
- **Retirés** : postes et fils de poste, Standard, iAsted, ressortissants, coffre (`sourceDocumentId`), politique
  des organisations, cloisonnement poste / personnel (remplacé par le réseau), push (PA5).

### Corrections de dette

- **D13** : le blocage ferme le fil à la lecture ET à l'écriture (garde du fil), dans les deux sens.
- **D14** : débit sur chaque geste. **D16** : la saisie se lit à l'instant fourni par le client (arrondi à la
  seconde), plus de `Date.now()` dans une query.
- **D21** : aucun chemin ne lit d'e-mail ; nom neutre (clé i18n) quand il n'y a rien à nommer.
- **D37** : contenu ABSENT pour des pièces seules et pour un message retiré (`undefined`, jamais `""`) ; le DTO
  rend `null`.
- **D38** : poser ou lever le blocage d'une paire déplace la pastille à l'écriture, de chaque côté et dans chaque
  réseau ; un blocage posé de l'autre côté garde la paire fermée (rien d'ôté deux fois, rien de rendu trop tôt).
- **D39** : l'aperçu se juge sur les pièces VÉRIFIÉES.

### Tests

- Portés (`messagerie.test`, `threads.test`, `transfert.test`, `chatsMessagerie.test`, `chatsP2P.test`,
  `chatsPinning.test`, `chatsAttachmentsAdoption.test`) : même refus pour inconnu, profil retiré et blocage ; fil
  réutilisé ; relation exigée et dite, demandée insuffisante, jamais rétroactive, le groupe n'ouvre rien ;
  `findThreadWithHandle` ; nommer l'interlocuteur ; fils d'un bloqué retirés ; pages sans doublon ni trou, fil
  réactivé en tête, boîte vide ; `getThread` ; nature du dernier message et accusé ; non-lus (balayage, envoi,
  lecture, retrait, masquage, plafond) ; tiers refusé partout ; idempotence ; pièces (poids, blob disparu, cinq au
  plus, texte vide), vocal ; blob d'un tiers refusé ; citation ; deux suppressions ; fenêtre ; historique au-delà
  de 50 et marquage par lots ; réactions ; épingle et bande relue ; saisie ; transfert (provenance, aperçu,
  non-lus, création par identifiant, relation, idempotence, contenu indisponible, pièces recopiées, blob disparu,
  marque qui tombe). Contrats : pièces, interlocuteur, réactions, messages (20 cas).
- Neufs : le blocage déplace la pastille dans chaque réseau et un second blocage garde la paire fermée (D38) ;
  contenu absent (D37) ; saisie à instant fourni (D16) ; nom tu après une demande d'effacement ; déposant
  inchangé au transfert ; une paire a un fil par réseau ; transfert refusé d'un réseau à l'autre, dans les deux
  sens.
- Abandonnés : `callByHandle` (→ module des appels, lot 15), cloisonnement poste / personnel, `listMyPosteThreads`,
  deux réseaux du socle (réécrits « entre réseaux »), Standard, iAsted, réglages des organisations, coffre,
  pièces « documents ».

### Écarts assumés

- **Push** (D20, D29) : PA5 ; aucune notification ne sort d'un message en attendant (le socle ne sonnait pas la
  cloche pour le 1:1 : seul le push l'annonçait).
- **Rétention** (D30) : PA5 — un message transféré ne possède pas son blob (c'est celui de l'original) : la purge
  devra le respecter.
- **Archiver un fil** : le statut `archived` est lu partout (envoi, boîte, transfert) mais aucun geste ne l'écrit
  encore (au socle, seul le Standard l'écrivait) ; l'archivage par personne viendra avec l'écran (PA6) s'il est
  demandé.
- **Conversations de groupe**, part `groups` de la pastille, source et cible de groupe du transfert : lot 11.
  **Appels** (événements `call_started` / `call_ended`, aperçu « appel ») : lot 15.

---

## Lot 11 — `groups` (conversations de groupe d'un réseau)

### Parité, fichier par fichier

| Source (`socle/convex/…`) | Cible | Sort | État |
|---|---|---|---|
| `modules/reseauPersonnel/groupes.ts` (garde, plancher, effacement) | `convex/modules/groups/access.ts` | à adapter | ✅ |
| `modules/reseauPersonnel/groupes.ts` (création, lectures, curseur, départ, administration) | `convex/modules/groups/threads.ts` | à adapter | ✅ (« mes groupes », membres et conviés paginés) |
| `modules/reseauPersonnel/groupes.ts` (messages, projection, épingle) | `convex/modules/groups/messages.ts` | à adapter | ✅ (`listGroupMessages` non recopiée : la pagination native seule) |
| `modules/reseauPersonnel/groupes.ts` (invitations, lien) | `convex/modules/groups/invites.ts` | à adapter | ✅ |
| `modules/reseauPersonnel/groupes.ts` (saisie) | `convex/modules/groups/typing.ts` | à adapter | ✅ |
| `modules/reseauPersonnel/groupes.ts` (suppression) | `convex/modules/groups/cascade.ts` | à adapter | ✅ |
| `modules/reseauPersonnel/groupes.ts` (`unreadForMember`, `totalUnread`, cloche des membres) | `convex/modules/groups/unread.ts` | à réécrire | ✅ (compteur tenu, D23 ; diffusion par lots, D07) |
| `modules/reseauPersonnel/tables.ts` (l. 596-899) | `convex/modules/groups/tables.ts` | à adapter | ✅ (+ `groupMessageHides`, D22) |
| `lib/groupCapacity.ts` | `packages/social-contracts/src/groupCapacity.ts` | à adapter | ✅ (+ bornes du titre, de la description et de la composition) |
| `modules/messagerieScope/transfert.ts` (porte de groupe, cible `thread`) | `convex/modules/messaging/forward.ts` (`forwardGroupMessage`, cible `group`) | à adapter | ✅ |
| `modules/reseauPersonnel/domain.ts` (administration d'un fil) | `packages/social-domain/src/groupThreads.ts` | pur | ✅ (lot 1) |
| cron `purge-expired-group-typing` | `groups-purge-expired-typing` (`convex/crons.ts`, 1 min) | patron | ✅ |

### Adaptations (liste fermée)

- **Par réseau** : le fil, l'appartenance, l'invitation, le lien et le message portent `networkId` ; toute fonction exige le
  réseau du fil (un fil ou un jeton d'un autre réseau est introuvable) ; une clé de création rejouée dans un autre réseau
  est refusée.
- **Qui entre** : une personne publiée du réseau, en relation ACCEPTÉE avec qui l'invite, sans blocage — chaque
  manquement rend le refus d'un identifiant inconnu ; les autres sont INVITÉS (l'appartenance naît à l'acceptation), le
  lien porte le consentement du groupe. Plafond de structure ramené à **256** (le socle : 1 000) ; titre, description et
  composition jugés par le contrat ; effectif dans l'agrégat `engineCounters` (D02).
- **Lire** : l'histoire d'un membre commence à SON arrivée (plancher inclusif, aperçu de liste compris) ; masquage « pour
  moi » dans `groupMessageHides` (D22), lus par plage pour une page ; corps d'un expéditeur bloqué retiré à la lecture,
  dans les deux sens, le fil demeure ; DTO allowlistés, personnes nommées par `counterpartLabel`.
- **Non-lus (D23)** : `unreadCount` TENU sur l'appartenance (avec la position jusqu'où les messages ont été examinés :
  une diffusion rejouée ou en retard ne recompte rien), somme dans `unreadTotals.groups` ; lu, effacé, quitté, retiré,
  supprimé : la pastille suit ; le blocage d'une paire recompte les fils qu'elle partage ; seuls les messages TEXTE
  d'autrui comptent.
- **Diffusion (D07)** : un message déclenche UN job par lots de 100 membres (rattrapage des non-lus, ordre d'activité,
  cloche `group_message` sauf sourdine) hors de la transaction de l'envoi ; les cloches `group_added` de la création
  passent par la diffusion du moteur.
- **Écrire** : un point d'insertion (`appendGroupMessage`) que partagent l'envoi et le transfert ; pièces par la garde
  des fichiers (source `group`) ; réagir, citer, épingler exigent de VOIR le message ; un retrait pour tous efface
  l'aperçu sans déplacer le fil (D37 : jamais « [Message supprimé] » en base) ; un événement ne se modifie pas.
- **Administrer** : rôles du domaine (`groupThreads`) ; refus de rôle `groupRoleRequired` ; photo sous la garde (dépôt
  neuf, usage `avatar`, type déclaré confronté au stockage), purgée quand elle est remplacée ou retirée.
- **Supprimer** : cascade bornée et chaînée (messages avec réactions et masquages, pièces propres purgées blob ET ligne
  d'analyse — D10 —, membres décomptés de l'agrégat et de la pastille, cloches du fil retirées, saisies, invitations,
  liens, photo, fil). Une pièce n'est purgée que si son message n'est pas une copie, que le registre la dit déposée par
  son auteur, et qu'aucune copie vivante ne la sert (index `by_forwarded_message`).
- **Transfert** : source et cible de groupe (`forwardGroupMessage`, cible `group`), mêmes gardes que le 1:1, refus
  explicite entre réseaux ; la provenance distingue `personal` et `group`.
- **Débit (D14)** : `groupThread.create`, `groupThread.invite`, `groupThread.join`, `groupThread.manage`, et les seaux
  `message.*` pour les messages.
- **Retirés** : espace poste / personnel (`assertGroupScope`, `GROUP_SCOPE_*`), mécanique d'appel (lot 15), comptes
  publics, coffre (`sourceDocumentId`), exemption du back-office et réglage d'organisation du plafond d'appel.

### Corrections de dette

- **D02** : effectif par agrégat. **D05** : photo et pièces servies par la garde des fichiers. **D07** : cloches et
  non-lus par diffusion chaînée. **D10** : purge du blob avec sa ligne d'analyse. **D14** : débit. **D15** : adhésion par
  le constructeur sur chaque fonction. **D16** : saisie lue à l'instant fourni. **D22** : table de masquage. **D23** :
  pastille de groupe tenue à l'écriture.

### Tests

- Portés (`groupes.test`, `groupes.cascadeBlobs.test`, cas de groupe de `transfert.test`) : titre vide, moins de trois,
  soi-même ; création qui invite ; refus muet ; idempotence ; non-connecté, bloqué, profil retiré indistincts ;
  `group_added` ; refus indistinct (non-membre, parti, supprimé, autre réseau) ; envoi, clé, curseur ; `markGroupRead`
  no-op ; cloche dédupliquée et sourdine ; pagination à milliseconde égale ; blocage ultérieur (corps, pièces, aperçu) ;
  non-lus d'un bloqué ; pièces (poids, blob disparu, cinq, texte vide, vocal) ; citation relue ; réactions ; « pour
  moi » ; édition et retrait (auteur, fenêtre, pierre tombale, idempotence) ; membre parti ; effacement local ; plancher
  d'arrivée ; renommer ; description ; photo ; administrateur qui invite ; retrait nommé ; succession et fermeture ;
  conviés et membres ; épingle (rôle, remplacement, refus) et sa relecture masquée ; lien (réservé, réutilisé,
  réinitialisé, idempotent, refus indistincts, plafond) ; cloches résolues ; saisie ; suppression complète et par lots ;
  purge des blobs ; transfert 1:1 ↔ groupe.
- Neufs : diffusion rejouée et désordonnée qui ne recompte rien, blocage qui recompte les fils partagés, masquage par
  table, compteur égal au recalcul, fil et jeton d'un autre réseau, transfert refusé entre réseaux et pour un message
  d'avant mon arrivée, blob épargné tant qu'une copie le sert ; contrats (`groupCapacity`, 7 cas).
- Abandonnés : appels de groupe (×15 → lot 15), espaces poste / personnel (×7), comptes publics, coffre.

### Écarts assumés

- **Plafond 256** au lieu de 1 000 : il borne aussi les lectures et la diffusion de chaque message ; une audience passe
  par les groupes thématiques et les pages. Une constante du contrat, réversible.
- **`listMyConnectionsForGroup`** non recopiée : le sélecteur lit les relations du graphe (`paginateMine`,
  `searchMine`), qui ne rendent que des relations acceptées du réseau ; une relation sans profil publié n'a pas
  d'identifiant à proposer.
- Un **message retiré pour tous** reste compté en non-lu (sa pierre tombale est une ligne du fil), comme au socle.
- Une **chaîne de copies** (copie d'une copie dont l'intermédiaire a disparu) peut perdre sa pièce à la purge de
  l'original : la référence comptée des blobs viendra avec la rétention (PA5, D30).
- **Appels de groupe** (fil d'origine, sonnerie des membres vivants, capacité) : lot 15.

---

## Lot 12a — `events` (évènements personnels d'un réseau)

### Parité, fichier par fichier

| Source (`socle/convex/modules/reseauPersonnel/…`) | Cible | Sort | État |
|---|---|---|---|
| `evenements.ts` | `convex/modules/events/events.ts` | à adapter | ✅ (iCal différé) |
| `tables.ts` (l. 1031-1097) | `convex/modules/events/tables.ts` | à adapter | ✅ |
| `posts.ts` (`resolveEventProjection`) | `convex/modules/events/card.ts` (carte de la publication) | à adapter | ✅ |
| `postWrite.ts` (`eventId`) | `convex/modules/posts/postWrite.ts` | à adapter | ✅ |
| `domain.ts` (évènements) | `packages/social-domain/src/events.ts` | pur | ✅ (lot 1) |

### Adaptations (liste fermée)

- **Par réseau** : l'évènement et la participation portent `networkId` ; un évènement d'un autre réseau est introuvable ;
  une clé de création rejouée ailleurs est refusée ; la relation exigée pour inviter est celle DU réseau.
- **Adhésion** par le constructeur sur chaque fonction (D15, absente au socle) ; « comptes publics » sans objet.
- **Décomptes** (`participantCount`, `acceptedCount`) dans l'agrégat `engineCounters` (D02), jamais sur l'évènement.
- **Fuseau** : celui de l'évènement, ou à défaut celui de la personne — jamais un fuseau imposé ; refus sinon.
- **Agenda** : organisés et invitations, prochains d'abord puis l'historique récent, borné et qui DIT sa lacune
  (`truncated`, D19) ; `eventStartAt` obligatoire (le chemin hérité est supprimé).
- **Fiche** sans participants ; ceux-ci se paginent (`paginateEventParticipants`).
- **Annonce** par le point d'écriture des publications (portée, pays, visibilité du réseau) ; la publication porte la
  carte de l'évènement, RELUE à chaque lecture (statut, réponse du lecteur).
- **Cloche** `event_invite` (sujet `event`) par la porte du moteur, résolue à la réponse ; à l'annulation, job paginé
  gardé tel quel.
- **Refus** à code : `notFound` indistinct, `eventOrganizerRequired` (neuf), règle `EVENT_CANCELLED` (neuve) ; débit
  `event.create`, `event.invite`, `event.respond`, `event.manage` (l'annonce consomme `post.publish`).

### Corrections de dette

- **D02** : décomptes par agrégat. **D14** : débit. **D15** : adhésion partout. **D19** : agenda borné qui dit sa lacune.

### Tests

- Portés (`evenements.test`) : idempotence et fuseau ; fuseau, fenêtre, durée, titre ; une ligne par invitation ;
  participants paginés ; réponse qui écrit la ligne et décomptes ; réinvitation d'un refus, pas d'un accord ; réponse
  d'autrui ; anti-oracle ; autorité de l'organisateur ; tiers indistinct ; annulé visible et figé ; fenêtre de l'agenda ;
  invitation future derrière 200 anciennes ; cloche dédupliquée et refus muet ; résolution à la réponse ; annulation
  résolue par lots ; job sans effet hors annulation ; annonce unique, carte relue, annulé non annoncé.
- Neufs : clé rejouée dans un autre réseau, autre réseau introuvable, relation d'un autre réseau refusée, fuseau de la
  personne par défaut, adhésion en attente refusée (D15), lacune de l'agenda.
- Différés : iCal (2 cas).

### Écarts assumés

- **Export iCal** (`eventIcalUrl`, route `/ical/event/{id}.ics`) : différé, décision par défaut de l'owner map.

---

## Complément au lot 7 — fil par voies et fusion sous frontière (demande DIASPORALE, PD4)

- **Voies** (`myFeed({ lanes })`) : jusqu'à quatre voies (une portée du réseau, un pays facultatif), chacune servie par
  un index (`by_network_reach_country_status_publishedAt`, `by_network_reach_status_publishedAt`), fusionnées par date,
  sans classement, avec les gardes du fil (audience, blocage, masquage, sourdine, statut). L'application compose ses
  voies selon SA règle : le hub d'un pays X = `[{ reach: "local", country: X }, { reach: "diaspora" }]`, « toute la
  diaspora » = `[{ reach: "diaspora" }]` — le moteur ne connaît pas la règle (`normalizeFeedLanes` ne juge que les
  portées déclarées et la forme du pays ; règle `FEED_LANES_INVALID`).
- **Frontière** (`mergeFeedWindows`) : une fenêtre bornée PLEINE n'a rien dit de ce qui est plus ancien que sa dernière
  ligne ; la page s'arrête à la plus récente de ces dernières lignes. Corrige un trou latent de « Pour vous » (reproduit
  par test : avec un mot-clé qui écartait toute la fenêtre d'un auteur prolixe, ses publications plus anciennes étaient
  perdues — 5 rendues sur 15).
- Tests : 5 cas convex (`feedLanes.test.ts`) + 4 cas de domaine.

---

## Lot 12b — `stories` (contenu éphémère d'un réseau)

### Parité, fichier par fichier

| Source (`socle/convex/modules/reseauPersonnel/…`) | Cible | Sort | État |
|---|---|---|---|
| `stories.ts` | `convex/modules/stories/stories.ts` | à adapter | ✅ |
| `tables.ts` (l. 500-595) | `convex/modules/stories/tables.ts` | à adapter | ✅ |
| `domain.ts` (stories) | `packages/social-domain/src/stories.ts` | pur | ✅ (lot 1) |
| cron `purge-expired-stories` | `stories-purge-expired` (`convex/crons.ts`, 10 min, se replanifie) | patron | ✅ |

### Adaptations (liste fermée)

- **Par réseau** : une story vit dans le réseau où elle est publiée (plateau, mur, vues, plafond par réseau) ; une story
  d'un autre réseau est introuvable ; une clé rejouée ailleurs est refusée ; adhésion par le constructeur.
- **Surfaces** `reseau`/`icom` (ADR-0079 du socle) retirées : une seule borne vidéo, la plus stricte (domaine, lot 1).
- **Délivrance par la garde** (D05) : une story dont le média n'est pas servable est OMISE pour les autres (le média EST
  la story) et montrée RETENUE à son auteur (`withheld`) ; la vignette du plateau retombe sur un média servable, un
  groupe sans aucun est écarté ; champ de compatibilité `coverUrl` non recopié.
- **Spectateurs** dans l'agrégat `engineCounters` (D02), jamais sur la story ; « vu par » à curseur NATIF (le socle
  perdait les ex æquo d'une frontière de page).
- **Instant des lectures** fourni par le client (`tray`, `listByAuthor`, `myActive`, D16).
- **Purge** : vues et décomptes, blob ET ligne d'analyse (D10), puis la ligne ; lot plein replanifié.
- **Refus** à code (`notFound` indistinct, règle `STORY_ACTIVE_LIMIT` neuve) ; débit `story.publish`, `story.view`,
  `story.remove` (D14).

### Corrections de dette

- **D02** : spectateurs par agrégat. **D05** : URL par la garde. **D10** : purge avec la ligne d'analyse. **D14** :
  débit. **D16** : instant fourni par le client.

### Tests

- Portés (`stories.test`) : média inventé ; vidéo QuickTime et trop longue ; plafond et retrait qui libère ;
  idempotence ; légende ; audience connexions et abonné ; blocage ; identifiant inconnu et bloqué ; plateau (groupes,
  non-vues, ordre, les miennes) ; source bloquée ; expirée hors plateau et mur ; vignette de repli et groupe écarté ;
  auteur tout-vidéo ; « vu » unique, auteur non compté, compte réservé à l'auteur ; « vu par » réservé et paginé ;
  retrait idempotent, « vu par » gardé, retrait d'autrui ; purge (ligne, vues, blob), vivantes épargnées, blob absent,
  lot plein replanifié ; DTO sans identifiant de stockage.
- Neufs : déclaration qui ment refusée, clé rejouée dans un autre réseau, ex æquo de « vu par » rendus, purge de la
  ligne d'analyse, retenue montrée à l'auteur seul, story d'un autre réseau introuvable.
- Abandonnés : surfaces (8 cas).

### Écarts assumés

- Une story n'est pas lue depuis la racine pour un autre réseau : elle reste dans son réseau.

---

## Lot 12c — `suggestions` (catalogue d'un réseau)

### Parité, fichier par fichier

| Source (`socle/convex/modules/reseauPersonnel/…`) | Cible | Sort | État |
|---|---|---|---|
| `suggestions.ts` | `convex/modules/suggestions/suggestions.ts` | à adapter (`paginate` et `listSentInvitations` réécrits) | ✅ |
| `tables.ts` (l. 1135-1165) | `convex/modules/suggestions/tables.ts` | à adapter | ✅ |

### Adaptations (liste fermée)

- **Par réseau** : le catalogue puise dans l'annuaire DU réseau (`peopleDirectory`, membres découvrables) ; un réseau
  gouverné par une tranche le refuse (`policyRefused`, comme le rail) ; le masquage vaut dans le réseau où il est fait
  (D17).
- **Carte** : identifiant, nom, titre (`headline`, au lieu du poste et de l'organisation), avatar par la garde (D05),
  état de la relation relu côté serveur ; allowlistée.
- **Ensembles bornés** (connexions, blocages, abonnements) relus par paire quand ils sont tronqués : une relation n'est
  jamais une lacune.
- **Listes paginées** (D19) : personnes masquées (`paginateDismissed`), invitations envoyées
  (`paginateSentInvitations`, sur un index du demandeur `by_network_requester_status` au lieu de deux balayages filtrés).
- Adhésion par le constructeur ; débit `suggestion.dismiss` sur masquer et rouvrir (D14) ; refus à code.

### Corrections de dette

- **D05** : avatar par la garde. **D14** : débit. **D17** : index et masquage par réseau. **D19** : listes paginées.

### Tests

- Portés (`suggestions.test`) : pagination jusqu'au bout ; page filtrée qui continue ; filtres (soi, connexion, suivi,
  blocage dans les deux sens) ; carte sans état civil ; masquage durable, listé, levé ; `includeDismissed` ; masquer deux
  fois ; restaurer sans masquage ; identifiant inconnu ; masquage propre à l'appelant ; états `requested_by_me` /
  `requested_by_them` ; acceptée, sortie du catalogue ; invitations envoyées (sens, acceptation).
- Neufs : réseau gouverné refusé, masquage propre au réseau.

