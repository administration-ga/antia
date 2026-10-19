# PRO-COMMERCE-JOBS-V1 — offres d'emploi PRO.GA → ANTSIA, candidatures privées

Statut : **contrat spécifié et raccordé dans les sources, lot P15, 18 octobre 2026.
Tests écrits, non exécutés ; recette ouverte** (décision du propriétaire « Continuer sans
vérifier »). Aucun échange réel n'est prouvé.

Implémentation normative : module jumeau **hors du manifeste P06 gelé**, octets identiques
dans les deux dépôts — `packages/social-domain/src/commerce-jobs.ts` (ANTSIA) et
`packages/pro-domain/src/commerce-jobs.ts` (PRO.GA, exporté par le barillet
`@workspace/pro-domain`). `commerce/**` et ses fixtures ne sont pas modifiés.
Contrats voisins : [PRO-COMMERCE-PUBLIC-V1](PRO-COMMERCE-PUBLIC-V1.md) (§5.6, `job.*`),
[PRO-COMMERCE-COMMAND-V1](PRO-COMMERCE-COMMAND-V1.md) (`application.submit`, `request.status`),
[FEDERATION-INBOX-V1](FEDERATION-INBOX-V1.md). Pendant PRO.GA :
`PRO_GA/docs/26_P15_EMPLOI_ANTSIA.md`.

## 1. Pourquoi un contrat jumeau

Le schéma `job.published` de PUBLIC-V1 est fermé et ne porte ni compétences ni période de
rémunération, que le lot exige. PUBLIC-V1 étant gelé, JOBS-V1 reprend sa charge et ajoute :

- `skills` : 0 à 20 compétences de 1 à 60 caractères, doublon insensible à la casse refusé ;
- `declaredSalary.period` : `day | hour | week | month | year`, facultatif (absent = « non précisée »).

Même enveloppe à cinq clés (`contract`, `eventId`, `objectRef`, `payload`, `version: 1`),
même inbox signée, même émetteur, mêmes bornes et mêmes règles de révision et de tombe que
PUBLIC-V1. Les champs interdits de PUBLIC-V1 restent interdits à toute profondeur. ANTSIA
lit aussi les `job.*` de PUBLIC-V1 en les normalisant (aucune compétence, période inconnue) ;
PRO.GA ne produit que JOBS-V1. L'émetteur ANTSIA doit autoriser **explicitement**
`PRO-COMMERCE-JOBS-V1` dans `allowedContracts` ; le retirer rend les offres reçues illisibles.

## 2. Événements publics

| Événement | Charge | Effet ANTSIA |
|---|---|---|
| `job.published` | poste, contrat, effectif, description, lieu, compétences, ouverture, échéance, rémunération déclarée | tête active (révision supérieure seulement) |
| `job.closed` `closed` / `filled` | références, révision, raison | clôture **définitive** : quitte la découverte, le lien connu affiche la clôture |
| `job.closed` `withdrawn` | références, révision | tombe : plus aucun contenu servi ; seule une révision supérieure republie |

Une révision inférieure est périmée (aucun effet), une même révision au contenu différent est
un conflit, une révision supérieure à une clôture définitive est refusée. Le parent est la
vitrine P09 : il doit être publié avec la capacité `jobs`, que PRO.GA n'émet que sous un mandat
`publish_jobs` vivant. Aucun candidat, coordonnée, note RH, référence de liaison, sujet ou
identifiant de stockage ne figure dans un événement.

## 3. Candidature (`application.submit`, COMMAND §6.9)

Sujet `candidate` opaque, dérivé par ANTSIA d'un HMAC propre à (personne, réseau de la
boutique, boutique, source, environnement) : jamais le sujet acheteur, aucune corrélation
entre structures. Charge : `shopRef`, `jobRef`, `civilName` déjà en forme normale (NOM en
capitales, Prénom capitalisé), `motivation` facultative, pièces **par empreinte**
(`attachmentRef` opaque par candidature, `kind`, `mimeType: application/pdf`, `sha256`,
`byteSize ≤ 5 Mio`, trois au plus), accord `commerce_application` versionné
(`2026-10-18-p15-v1`).

PRO.GA vérifie la structure, l'**unique** liaison `receive_applications` sous mandat vivant
(`recruiting.applications.manage` + `site.publish`), le poste publié, non échu et consenti à
la publication pour cette source, l'absence de candidature active du même sujet, un budget
par couple sujet/structure et la version d'accord. Refus fermés : `access_denied`,
`already_applied`, `capability_disabled`, `consent_invalid`, `job_closed`, `quota_exceeded`,
`request_expired`. La réponse exacte est durable : même clé + même corps = mêmes octets ;
autre corps = `409 idempotency_conflict`.

`request.status` (sujet `candidate`) rend la réponse enregistrée et l'état **autorisé** de SA
candidature (machine `application` : `received`, `screening`, `interview`, `offer`, `hired`,
`rejected`, `withdrawn`). Jamais un motif de décision ni une note. ANTSIA affiche
`screening` comme « En examen » et `rejected` comme « Non retenue ».

## 4. Contrôle privé `PRO-COMMERCE-APPLICATION-CONTROL-V1`

`POST /commerce/v1/application-control`, signé par le profil COMMAND sur l'opération
`application.submit` (le nom réservé `application.withdraw` de P06 n'est pas rendu exécutable).
Corps canonique fermé : `action` (`withdraw` | `attachment.revoke`), `at`, `attachmentRef`
(révocation seulement), `contract`, `environment`, `expiresAt` (≤ 60 s), `issuedAt`, `reason`
(`candidate_request` | `erasure` | `file_blocked`, ce dernier pour une pièce seulement),
`requestId`, `source`, `subjectRef`, `submitRequestId`, `submitRequestSha256`, `version`.
Réponse `{contract, outcome: applied | rejected, requestId, requestSha256, respondedAt, version}`,
rejouée à l'octet près. Un retrait reçu **avant** la demande pose une tombe : la demande
tardive est refusée (`consent_invalid`).

Politique de retrait : toujours possible pour le candidat. PRO.GA efface immédiatement nom
civil, motivation et pièces, remplace le nom de la candidature par un libellé neutre et classe
« retirée » une candidature encore ouverte ; une décision déjà prise n'est pas réécrite.

## 5. Pièces `PRO-COMMERCE-APPLICATION-FILES-V1`

`POST /commerce/v1/application-files`, corps = octets EXACTS du PDF, `Content-Type:
application/pdf`, en-têtes `X-Pro-Application-Request` (requête d'origine) et
`X-Pro-Attachment-Ref`, signature COMMAND sur l'empreinte de ces octets. ANTSIA n'envoie
qu'une pièce déclarée, encore à la personne, prête et **saine après analyse antivirus
complète** (garde des fichiers, usage `job_application_document`). PRO.GA revérifie
signature (nonce unique), déclaration, taille, empreinte et signature `%PDF-`, stocke un blob
privé. Réponse `{attachmentRef, contract, outcome: stored | already_stored | rejected, sha256,
submitRequestId, version}`. Jamais d'URL ni d'identifiant de stockage échangés. Un recruteur
lit une pièce par une action authentifiée qui revalide `recruiting.view` à CHAQUE lecture et
journalise l'accès ; une révocation ferme l'accès immédiatement (aucun lien antérieur n'existe).

## 6. Conservation

Aucune durée n'est fixée (`COMMERCE_JOBS_RETENTION` à `null`) : décision du propriétaire et
d'un conseil compétent **à valider**. Tant qu'elle manque, aucune purge temporelle ne s'exécute ;
le retrait et l'effacement ANTSIA suppriment immédiatement les copies (ANTSIA et PRO.GA).
