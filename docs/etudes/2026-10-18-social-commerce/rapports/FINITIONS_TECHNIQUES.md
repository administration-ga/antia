# Finitions techniques — garde des pièces P10, cloche, K-04, K-07, consoles, lettres mortes, `request.status`

19 octobre 2026, agent « finitions » sous coordination ([EXECUTION.md](../EXECUTION.md), ligne
« Finitions »). Décision du propriétaire du 18/10/2026 : **« Continuer sans vérifier »**.

**Verdict : six corrections branchées dans les vraies sources des deux dépôts, une décision de contrat
documentée ; tests écrits, non exécutés.** Aucun codegen, test, typage, lint, build, serveur,
navigateur, commande Convex ni installation n'a été lancé ; aucune écriture git, aucun `.env*`,
`package.json`, `bun.lock`, `_generated`, primitive UI, pont de session, `diaspora/**`,
`contextualMessaging/**`, `calls/**`, manifeste P06 ni contrat jumeau touché. Les fichiers partagés
ont été modifiés par ancres uniques relues juste avant ; les fichiers `convex/**` d'ANTSIA (poussés en
continu par le `convex dev` :3210) ont été écrits dans un ordre qui laisse chaque état intermédiaire
cohérent (import ajouté, puis appel remplacé, puis import retiré).

Racines : **A/** = `ECOSYSTEMES/ANTSIA/`, **P/** = `ECOSYSTEMES/PRO_GA/`.

## Bilan standard

| Champ | Contenu |
|---|---|
| Résultat | (1) le module `commercialMessaging` rattache lui-même ses pièces par la garde ; (2) la cloche nomme l'acteur d'un contact commercial ; (3) K-04 : `P/convex/http.ts` n'importe plus aucun module (deux routes génériques, deux actions internes) ; (4) K-07 : l'assertion de compatibilité suit l'état réel (PUBLIC-V1 appliqué) ; (5) DP-37/K-19 : consoles vitrines (politique + file d'admission), catalogue et préparation ; (6) K-20 : relance explicite et auditée d'une lettre morte commerce, backend et écran admin_pro_ga ; (7) K-06/DP-34 : deux options de contrat rédigées, rien codé |
| Source | ANTSIA `codex/pa4-identite-session` @ `9eaff40` + arbre partagé ; PRO.GA `feat/antsia-social-commerce` @ `9497f22` + arbre partagé. Aucune branche changée |
| Tests | Écrits, **non exécutés** : détail par point ci-dessous |
| Recette | Aucune |
| Dépendances | `codegen` des deux dépôts (nouveau module PRO.GA `integrations/commerceDeadLetters`, nouvelles fonctions), puis `verify` au gel ([02](../pilote/02_GEL_ET_VERIFICATION.md)) |
| Retour arrière | Par point, en fin de section ; aucune donnée migrée ni supprimée |

## 1. P10 — garde des pièces du contact commercial (cliquet `upload-policy`)

**Constat (confirmé à la lecture).** `A/convex/modules/commercialMessaging/messages.ts` délivrait une URL
de dépôt (`generateUploadUrl` → `guardUploadUrl(ctx, "chat_attachment")`) mais rattachait ses pièces
par `messaging/attachmentStorage.verifyDeclaredAttachments`, un autre module. Le temps 2 du cliquet
`upload-policy` juge par dossier `convex/modules/<module>` : `commercialMessaging` délivrait sans jamais
appeler `admitStoredUpload` ni `admitPosedUploads` → rouge attendu (constat de l'agent CC).

**Correction.** Nouveau `A/convex/modules/commercialMessaging/attachments.ts` :
`admitCommercialAttachments(ctx, declared, { networkId, senderPersonId })` compose les primitives
partagées, comme `contextualMessaging/attachments.ts` : nombre jugé avant tout stockage
(`COMMERCIAL_ATTACHMENTS_MAX`, défense en profondeur — l'envoi refuse déjà au-delà de deux),
`assertFreshUpload` au nom de l'émetteur, `admitStoredUpload` (`chat_attachment`, source `message`,
réseau du fil, déposant, nom), lot jugé par `assertAttachmentBatch`. `messages.ts#sendMessage`
l'appelle à la place de `verifyDeclaredAttachments` (même position dans l'ordre de l'envoi, mêmes
refus). Délivrance inchangée (`deliverAttachments`).

**Cliquets, par lecture** : `upload-policy` (module délivrant ⇒ admettant ; relevé `grep` : les dix
dossiers qui délivrent admettent tous), `fresh-upload` (`admitStoredUpload` et `assertFreshUpload`
dans le même fichier), `storage-arg-freshness` (`sendMessage` atteint la garde par
`admitCommercialAttachments`, nom non générique), `file-delivery-gate` (aucun `getUrl`).

**Test écrit, non exécuté** — `A/convex/modules/commercialMessaging/commercialMessaging.test.ts`, cas
« finitions : la pièce neuve est admise par la garde du module… » : ligne `fileScans` au nom de
l'émetteur et du réseau (`source: "message"`, `pending`), pièce posée avec le poids réel ; le même
dépôt déclaré par l'autre côté → `notFound` (aucun oracle) ; redéclaré par son déposant → `conflict` ;
une seule ligne d'analyse au total.

Retour arrière : rétablir l'appel `verifyDeclaredAttachments` et supprimer `attachments.ts`.

## 2. Phrase de `commercial_contact` dans la cloche

**Constat.** `A/packages/social-features/src/features/notifications/notification-targets.ts` déclarait
`commercial_contact: { actor: null, system: … }` : la phrase ne nommait jamais l'acteur, alors que le
test « chaque genre du domaine a sa phrase » attend « Awa » pour tout genre hors `SYSTEM_KINDS`
(échec constaté par une autre session). L'avis porte pourtant un `actorPersonId`
(`commercialMessaging/hooks.ts`) et la cloche projette son profil public (`bell.ts`), le même nom
étant déjà affiché sur chaque message du fil.

**Correction.** `commercial_contact: { actor: "…commercialContactActor", system: "…commercialContact" }` :
l'acteur est nommé quand la projection le fournit (libellé neutre pour un profil non publié) ; sans
acteur, la phrase du système. Phrase sans contenu, sans boutique ni offre :
FR « Nouvelle activité dans votre conversation commerciale avec {{actor}}. » (forme sans élision
devant un prénom à voyelle), EN « New activity in your commercial conversation with {{actor}}. »,
clé ajoutée aux deux `notifications.json`.

**Test écrit, non exécuté** — `notification-targets.test.ts`, cas « P10 : un contact commercial nomme
l'acteur… » (FR, EN, profil non publié, sans acteur) ; le test existant redevient cohérent.

## 3. K-04 — `PRO_GA/convex/http.ts` sans import de module

**Constat.** `http.ts` importait deux `httpAction` de modules (`payments/commercePaymentEvidence#providerCallback`,
`integrations/commerceApplicationFiles#uploadApplicationFile`) : `tests/domainBoundary.test.ts`
(« hors modules, seul schema.ts importe les tables des modules ») devait échouer.

**Correction (comportements conservés).** Les deux routes sont désormais définies dans `http.ts`, qui ne
lit que des en-têtes et des octets bornés, puis appelle par `makeFunctionReference` des fonctions
internes du module (types de retour copiés structurellement, même règle que `CommerceMediaTicket`).
Nouvel utilitaire `readCommerceBytes` (octets exacts, borne sans confiance dans `Content-Length`,
`null` au-delà, lecture en échec levée vers la route).

- **Rappel fournisseur** `POST /commerce/v1/payments/callback` : la route lit d'abord
  `commercePaymentEvidence.callbackIntake` (requête interne : `null` si le registre ne désigne pas
  exactement un adaptateur doté d'un port commerce), puis applique **dans l'ordre d'origine** :
  503 sans sélection (avant toute lecture), 400 méthode/corps absent/paramètre d'URL, 413 par
  `Content-Length` > 64 Kio, 503 si le port déclare 0 ou plus de 20 en-têtes, 400 en-tête manquant ou
  trop long, 400 lecture en échec, 413 au-delà de 64 Kio lus ; puis remet `{ rawBody: v.bytes(), proof }`
  à l'action interne `admitProviderCallback`, qui rejuge sélection, borne et en-têtes (exactement ceux
  du port) et rend 204 appliqué, 409 non appliqué, 400 refus. Aucun corps de réponse, rien journalisé.
  Les octets passent en `bytes` : plus aucune conversion texte (l'ancien `receiveCallback` encodait
  une chaîne). La vérification, le bail et l'applicateur sont factorisés (`verifyAndApplyCallback`)
  et partagés avec `receiveCallback`, dont le contrat (`{ accepted }`, fixtures) est inchangé.
- **Pièces de candidature** `POST /commerce/v1/application-files` : la route garde 503 (environnement
  commerce absent, même test que `deployedCommerceEnvironment`), 400 (en-têtes de corrélation,
  `Content-Type` ≠ `application/pdf`), 413 (> 5 Mio), 400 (vide ou sans `%PDF-`), puis appelle l'action
  interne `commerceApplicationFiles.receiveApplicationFile` (`proof`, en-têtes, `bytes`), qui rejuge
  ces règles (issue `invalid` → 400), calcule l'empreinte, admet par signature (`admitUpload`), stocke
  le blob privé, le rattache (`bindUpload`). Codes conservés : 401 non autorisé, 503 débit, 200
  `stored`/`already_stored`, 422 `rejected`, 503 sur toute exception ; réponse canonique corrélée
  composée par la route ; aucun octet, nom ni signature journalisé. L'issue est une union à
  discriminant unitaire, et l'admission se rétrécit par un test positif sur `admit` (l'ancien code
  lisait `admission.attachmentId` après quatre tests négatifs sur une union à discriminant composé,
  rétrécissement non garanti par TypeScript).
- Supprimés des modules : `providerCallback`, `uploadApplicationFile` et le lecteur d'octets local.
  `docs/23` et `docs/26` décrivent les nouvelles portes.

**Tests écrits, non exécutés.** `P/convex/modules/payments/commercePayments.test.ts`, bloc « K-04 » :
registre vide → `callbackIntake` nul et 503 sans corps même avec paramètre d'URL ; adaptateur désigné
(liaison de fixture posée puis retirée) → 204 puis 204 rejoué sans doubler le ledger ; en-tête absent,
paramètre d'URL, preuve refusée → 400 ; 64 Kio + 1 → 413 ; action interne : 503 sans sélection,
400 pour un en-tête non déclaré ou manquant. `P/convex/modules/integrations/commerceJobs.test.ts`, bloc
« K-04 » : type faux et octets non PDF → 400, 5 Mio + 1 → 413, preuve absente → 401
`{"outcome":"refused"}`, action interne appelée sur des octets non PDF → `invalid`, pièce toujours
`awaiting` sans blob. Le test historique de bout en bout (`stored` puis 401 au rejeu du nonce) couvre
le chemin nominal. `tests/domainBoundary` devrait passer : plus aucun `from "./modules/…"` dans
`http.ts` (relevé `grep`).

**À constater au gel** : taille d'argument d'une action Convex pour une pièce de 5 Mio passée en
`v.bytes()` (sous la limite documentée des arguments, à mesurer) ; appel `runAction` depuis une
`httpAction` sous convex-test.

Retour arrière : restaurer les deux `httpAction` des modules et leurs imports dans `http.ts`
(K-04 rouvert).

## 4. K-07 — `compatibility.test.ts`

**Constat.** `A/packages/social-domain/src/commerce/compatibility.test.ts` affirmait « le moteur ne
déclare aucun contrat commercial appliqué (P09 non livré) ». Or `FEDERATION_IMPLEMENTED_CONTRACTS`
contient `PRO-COMMERCE-PUBLIC-V1` (handler P09 : `federation/reseauPublic.ts` → `applyCommerceCatalog`)
et `PRO-COMMERCE-JOBS-V1` (P15). **Hors manifeste vérifié** : `fixtures/MANIFEST.json` (révision 1)
n'empreinte que `command.ts`, `conformance.ts`, `index.ts`, `lifecycle.ts`, `primitives.ts`,
`projection.ts` et les fixtures — aucune révision jumelle requise. Aucune copie PRO.GA du fichier
(`packages/pro-domain/src/commerce/` n'a pas de `compatibility.test.ts`, et PRO.GA ne déclare aucun
`FEDERATION_IMPLEMENTED_CONTRACTS`).

**Correction.** Le cas devient « l'inbox applique PUBLIC-V1 (handler P09) pour les seuls genres du
contrat ; COMMAND-V1 n'est jamais un contrat d'inbox » : PUBLIC présent, COMMAND absent, et les
genres déclarés par l'inbox pour PUBLIC égalent exactement `COMMERCE_PUBLIC_EVENT_TYPES` (alignement
contrat ↔ inbox, que l'ancien test ne tenait pas). Écrit, non exécuté.

## 5. DP-37 / K-19 — consoles vitrines, catalogue, préparation

**Constat.** Politiques sans écran : vitrines (`shops/operator`), catalogue (`shops/catalogControl`),
préparation (`shops/checkoutPolicy`). Le serveur journalise déjà chaque décision (`appendAudit` :
`shop.policy_set`, `shop.storefront_decide`, `catalog.policy_set`, `checkout.policy_set` — vérifié,
cliquet `operator-audit`). Catalogue et préparation n'avaient **aucune lecture** pour la console.

**Corrections.**
- Lectures ajoutées, sur le modèle exact de `servicePolicy.getPolicy` : `shops/catalogControl.getPolicy`
  et `shops/checkoutPolicy.getPolicy` (`operatorQuery`, `requireFederationAdmin`, réseau actif, état
  **fermé par défaut** `enabled: row?.enabled === true`).
- `A/apps/admin_antsia_ga/src/components/console-storefront-policy.tsx` (nouveau) : politique lue par
  toute la console, réglée par l'administration de la plateforme seule (motif ≥ 10, `setStorefrontPolicy`) ;
  transitions offertes : fermée ↔ admission motivée, et sortie d'une admission d'office déjà en
  vigueur ; **l'admission d'office n'est jamais proposée** tant que la liste des secteurs restreints
  n'est pas validée (P16 D2, DP-05). File d'admission (`storefrontQueue`, dix par page, la plus
  ancienne d'abord) : nom, modèle, page, présentation, préparateur (nom, alias, adhésion), date ;
  « Admettre » (désactivé tant que la publication est fermée) et « Refuser » (motif rendu aux
  gérants), motif ≥ 3 comme le serveur. Sans cet écran, la politique `review` était inutilisable.
- `console-catalog-policy.tsx` et `console-checkout-policy.tsx` (nouveaux) : clones de
  `console-service-policy.tsx` (motif ≥ 10, état fermé par défaut, dernière décision datée), montés
  pour `canAdmin` seulement, avant Paiement, Services et Emploi dans `console-pages.tsx`.
- Libellés FR/EN (`storefrontPolicy.*`, `catalogPolicy.*`, `checkoutPolicy.*`) dans les deux
  `operations.json`, mêmes clés.

**Test écrit, non exécuté** — `console-operations.test.tsx`, bloc « finitions DP-37 » : vitrines
fermées (admission motivée proposée, aucun bouton d'admission d'office, « Admettre » désactivé,
préparateur et adhésion affichés) ; opérateur lecteur (aucun réglage de politique, aucune lecture
catalogue/préparation, refus motivé transmis `{ shopId, decision: "reject", reason }`) ; catalogue et
préparation fermés puis ouverture motivée transmise au réseau choisi.

**Reste, documenté :** (a) **suspension/rétablissement d'une vitrine publiée** (`setStorefrontSuspension`
existe) : aucune requête ne liste les vitrines publiées ou suspendues d'un réseau ; conception :
`operatorQuery` paginée sur l'index `by_network_storefront_publishedAt` (`published`, `suspended`),
même projection que la file, puis deux `MotiveAction` (motif ≥ 10) ; d'ici là, le retrait global
passe par la fermeture de la politique. (b) **Rattachement catalogue d'une boutique**
(`catalogControl.configureMapping`, boutique + émetteur) : aucune lecture des boutiques liées
`publish_catalog` ni des émetteurs admettant PUBLIC ; écran à concevoir avec la console Fédération.
(c) DP-37 mentionnait une « révision » : les politiques réseau n'ont pas de révision attendue côté
serveur (comme P14/P15) ; non ajouté. (d) La conversation contextuelle avait déjà son écran (CC-2b).

## 6. K-20 — relance d'une lettre morte de l'outbox PRO.GA

**Constat.** La fondation `integrations/outbox` n'a **aucun** rejeu : une ligne `dead-letter` n'en sort
jamais ; `admin.ts` liste des compteurs et désactive seulement (« aucune surface … de rejeu ») ; le
scope machine `federation.dead_letters.manage` est déclaré sans consommateur. Mais la fondation a un
mécanisme d'administration (`platformAdminQuery/Mutation`, `requirePlatformRoleIn`, `writeAudit`) et
le contrat AsyncAPI prévoit que « tout replay manuel est explicite et audité ». Côté ANTSIA, PUBLIC
est appliqué de façon monotone (`decideCommercePublicRevision` : révision dépassée = sans effet) et le
dispatch rejuge l'actualité de chaque projection (`dispatchAdmission`) : relancer un vieil événement
ne peut rien ressusciter.

**Correction.** `P/convex/modules/integrations/commerceDeadLetters.ts` (nouveau) :
- `listCommerceDeadLetters({ tenantBusinessRef, destinationRef })` — `platformAdminQuery`,
  `super_admin`/`system_admin`, session Better Auth vivante (`requireCommerceSession`, même module),
  vingt-cinq au plus par l'index profil/état ; projection stricte `{ recordId, eventType, attempts,
  errorCode, createdAt, redrivable }` (ni enveloppe, ni charge, ni clé, ni transport, ni empreinte).
- `redriveCommerceDeadLetter({ …, recordId, expectedAttempts, reason, confirmedByHuman: true })` —
  mêmes rôles et session, motif d'une ligne (10–500, **empreinte seule** au journal, comme P12),
  débit par administrateur (seau existant `commerceCatalogReconcile`, clé dédiée). Refus unique
  `AccessDenied` (ligne inconnue, autre tenant ou destination, ligne hors commerce). **Idempotence par
  comparaison-échange** : état `dead-letter` ET nombre de tentatives affiché, sinon `unchanged` sans
  écriture. Codes déterministes non relancés (`not_redrivable`) : enveloppe corrompue ou divergente,
  projection dépassée ou retirée, refus d'application par ANTSIA (qui se rejoue depuis sa console
  Fédération), corps/entrée refusés sur leurs octets. Destination absente, désactivée ou liée
  autrement que la ligne → `destination_unavailable`. Sinon : ligne `pending`, `attempts: 0`,
  `availableAt` maintenant, bail et code effacés ; trace métier `proOutboxEvents` repassée `pending`
  (si présente et corrélée) ; journaux `integration.outbox.redriven` et
  `platform.integration.commerce_dead_letter_redriven` ; dispatch planifié. Enveloppe, clé
  d'idempotence et reçus antérieurs intacts ; le bail rejuge tout.
- admin_pro_ga : `hooks/use-commerce-dead-letters.ts` (références par chaîne typée, schéma Zod du
  motif identique au serveur) et `components/commerce-dead-letters.tsx` (RHF + Zod, une entrée à la
  fois, confirmation et motif, issues traduites), monté sous chaque destination dont le compteur
  « Échec définitif » est non nul (`integrations/page.tsx`, description et commentaire mis à jour).
- `convex/tests/surfacePlatformRoles.test.ts` : les deux fonctions rejoignent la surface
  `integrations` (rôles identiques à `admin.ts`, registre inchangé). Commentaire d'`admin.ts` mis à jour.

**Tests écrits, non exécutés** — `P/convex/modules/integrations/commerceDeadLetters.test.ts` :
projection stricte ; relance auditée (ligne `pending`, tentatives remises à zéro, trace métier
rouverte, empreinte du motif sans le motif, journal d'intégration), second appel `unchanged` sans
nouvelle trace, nouveau bail à la tentative 1 sur les mêmes octets ; écran périmé → `unchanged` ;
refus ANTSIA → `not_redrivable` et `redrivable: false` ; destination désactivée →
`destination_unavailable` ; rôle `support_agent`, autre tenant, motif trop court → refus sans écriture.

**Limites.** Une relance n'est pas un reçu : une ligne qui retombe en lettre morte reçoit un second
reçu `…:dead-letter` (identifiants non uniques, aucune lecture `.unique()` sur ces reçus sortants) ;
la relance n'est visible que par les journaux. Aucune relance en lot (une par appel, volontairement).
Retour arrière : retirer le fichier, son test, le hook, le composant et son montage, les deux lignes du
test de surface ; aucune donnée à migrer.

## 7. K-06 / DP-34 — `request.status` de fond : options de contrat (rien codé)

**Constat.** COMMAND §5 : `subject.authVerifiedAt` est « l'instant où le serveur ANTSIA a revérifié la
**session vivante** du sujet, au plus cinq minutes avant `issuedAt` » ; le parseur ne contrôle que la
fenêtre (`authMaxAgeMs`). Deux consultations partent **sans session**, d'un travail planifié, en
déclarant `authVerifiedAt: now` : `A/convex/modules/commercialMessaging/crmTransport.ts:62` (P10,
résolution d'un transfert CRM après expiration de la demande) et
`A/convex/modules/shops/jobApplicationTransport.ts:143` (`statusJob` P15 : résolution `resolve` d'un
envoi expiré et suivi `track` de l'état d'une candidature, sur des jours). Les autres `request.status`
(préparation, paiement) partent d'un geste de la personne, identité et session relues : sincères.
`request.status` est sans effet, non enregistré, et rend `unknown` pour une autre source ou un autre
sujet ; son résultat peut contenir la réponse enregistrée exacte et l'état privé des objets nés de la
demande.

### Option 1 — consultation machine, sans sujet engageant

Le contrat admet qu'une consultation **sans effet** soit faite par le serveur ANTSIA pour le compte
d'une intention déjà exprimée, sans session : variante (1a) **texte seul** — §5 et §6.10 précisent que,
pour `request.status`, `authVerifiedAt` date la relecture serveur de l'autorité du sujet (consentement,
liaison, non-effacement, non-retrait), pas d'une session ; octets inchangés ; variante (1b) **syntaxe**
— un sujet `{ kind: "system" }` ou un `authVerifiedAt` absent pour la seule consultation.

Conséquences : les résolutions après délai et le suivi de candidature continuent hors ligne (rien ne
reste « en cours » parce que la personne est absente) ; PRO.GA inchangé en (1a). Mais le serveur lit
pour la personne, en son absence, une réponse enregistrée et un état privé : ANTSIA doit relire avant
chaque consultation consentement, retrait, effacement et adhésion (P10 relit le consentement ; P15 relit
l'état de la candidature — à étendre à l'effacement demandé et à la suspension), et l'attribut ne
prouve plus une session. (1b) touche `command.ts`, gelé par le manifeste P06 : révision 2 du manifeste,
jumeaux, fixtures et conformance dans les deux dépôts. ADR à rédiger (« consultation machine »).

### Option 2 — relecture de la dernière session prouvée

L'attribut garde son sens. Avant chaque consultation de fond, ANTSIA relit qu'une session Better Auth
**vivante** du sujet existe (session non expirée, non révoquée, même personne) ; si oui,
`authVerifiedAt: now` est sincère ; sinon, aucune consultation : le travail attend (état « en attente
de session ») et reprend à la prochaine connexion ou au prochain passage. Rejouer l'instant de la
session prouvée au clic ne suffit pas : le parseur refuse au-delà de cinq minutes (`invalid_time`),
or la résolution P10 ne part qu'après expiration de la demande.

Conséquences : aucun changement de contrat ni du manifeste P06 ; aucune lecture en l'absence de toute
session vivante. Mais une personne déconnectée bloque la résolution : transferts CRM et candidatures
restent « en cours » plus longtemps, les avis de suivi de candidature (P14B) peuvent tarder de
plusieurs jours ; « une session existe » ne prouve pas la présence de la personne ; lecture du
composant Better Auth depuis un travail planifié (requête bornée par utilisateur), et une voie de
reprise à la connexion à écrire (pont de session gelé : point d'accroche à arbitrer).

**Lecture de l'agent (non décisionnelle).** `request.status` n'écrit rien et ne sert qu'à éviter un
double effet après un délai réseau : l'option 1a (texte seul) préserve la reprise hors ligne sans
révision du manifeste, à condition d'étendre la relecture d'autorité de P15 ; l'option 2 garde
l'attribut littéral au prix de résolutions suspendues. Décision DP-34 au propriétaire, avant tout code.

## Fichiers

ANTSIA — créés : `convex/modules/commercialMessaging/attachments.ts`,
`apps/admin_antsia_ga/src/components/{console-storefront-policy,console-catalog-policy,console-checkout-policy}.tsx`,
ce rapport. Modifiés par ancres : `convex/modules/commercialMessaging/{messages,commercialMessaging.test}.ts`,
`convex/modules/shops/{catalogControl,checkoutPolicy}.ts`,
`packages/social-features/src/features/notifications/notification-targets{,.test}.ts`,
`packages/social-features/src/i18n/locales/{fr,en}/notifications.json`,
`packages/social-domain/src/commerce/compatibility.test.ts`,
`apps/admin_antsia_ga/src/components/{console-pages.tsx,console-operations.test.tsx}`,
`apps/admin_antsia_ga/src/i18n/locales/{fr,en}/operations.json`.

PRO.GA — créés : `convex/modules/integrations/commerceDeadLetters{,.test}.ts`,
`apps/admin_pro_ga/src/hooks/use-commerce-dead-letters.ts`,
`apps/admin_pro_ga/src/components/commerce-dead-letters.tsx`. Modifiés par ancres : `convex/http.ts`,
`convex/modules/payments/{commercePaymentEvidence,commercePayments.test}.ts`,
`convex/modules/integrations/{commerceApplicationFiles,commerceJobs.test,admin}.ts`,
`convex/tests/surfacePlatformRoles.test.ts`, `apps/admin_pro_ga/src/app/(backoffice)/integrations/page.tsx`,
`docs/23_P12_PAIEMENT_ANTSIA.md`, `docs/26_P15_EMPLOI_ANTSIA.md`.

## Demandes au coordinateur

1. Mettre à jour [02 §6](../pilote/02_GEL_ET_VERIFICATION.md) : K-04 et K-07 « corrigés dans les
   sources, non exécutés » ; K-19 « vitrines, catalogue, préparation : écrans posés ; suspension et
   rattachement catalogue restent sans écran » ; K-20 « relance commerce posée (PRO.GA) » ; K-06
   inchangé (DP-34). Ligne « Finitions » d'EXECUTION.md.
2. Au gel : `codegen` PRO.GA (nouveau module `integrations/commerceDeadLetters`, nouvelles fonctions
   `callbackIntake`, `admitProviderCallback`, `receiveApplicationFile`) et ANTSIA (`getPolicy` ×2,
   déjà typées par les imports de `api.d.ts`), puis `tests/domainBoundary`, `surfacePlatformRoles`,
   `upload-policy`, `fresh-upload`, `storage-arg-freshness`, `i18n-locales` en priorité.
3. Soumettre DP-34 (§7) au propriétaire.
