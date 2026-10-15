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
| 3 | `people` (profil, annuaire, images, mentions) et `media` | voir journal git (`feat(people)`) | 2 fichiers convex + 1 cas domaine | D05, D14, D36 |

Ordre suivi (owner map §4.2), avec un écart : le lot 1 (modules purs) est porté avec chaque module qui le
consomme ; l'avis de verdict des fichiers (`files/notify`) arrive avec le module `notifications` (lot 5), dont il
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
| `modules/fileGuard/notify.ts` | `convex/modules/files/notify.ts` | à réécrire | ⏳ avec `notifications` (lot 5) |
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
