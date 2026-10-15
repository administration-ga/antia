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
