# CC — Conversation contextuelle : domaine pur (CC-1), contrat du résolveur (CC-2a), module du moteur (CC-2b)

Date : 19 octobre 2026. **Verdict : sources raccordées ; tests écrits, non exécutés ; recette ouverte.**

Décision du propriétaire (18/10/2026) : « Continuer sans vérifier ». Aucun codegen, test, typage, lint,
build, serveur, navigateur, commande Convex ni installation n'a été lancé. Tous les tests cités sont
**écrits, non exécutés** ; aucun résultat n'est annoncé. Aucun commit, aucune écriture git.

Références : contrat `docs/contrats/CONVERSATION-CONTEXTUELLE-V1.md` (**Accepté** — validation du
propriétaire du 19/10/2026, relayée par la session DIASPORALE : « Je valide les décisions D1 à D16 du
contrat CONVERSATION-CONTEXTUELLE-V1, avec les amendements D5 et D8 ; transmets-le à ANTSIA. » ; D7 et
D13 restent à confirmer juridiquement) ; décision `docs/adr/0025-conversation-contextuelle.md` (Accepté).

## Bilan standard

| Champ | Contenu |
|---|---|
| Résultat | Une famille de conversations **attachées à un objet** (demande de service, mentorat, candidature DIASPORALE), distincte de la messagerie personnelle et du contact commercial P10 (D1). Domaine pur fermé (trois natures V1, deux noms réservés refusés, clé `nature:identifiant`, phases, côtés, voix, capacités, règle neutre de texte, clé et empreinte, `CONTEXTUAL_RETENTION = null`). Contrat du résolveur en types seuls, importable par la tranche sans interne du moteur. Module `convex/modules/contextualMessaging` : quatre tables `contextual*`, fils, messages, états personnels, politique par réseau et par nature **fermée par défaut** réglée en console (motif, `appendAudit`), crochets `open/sync/purge`, aides `canRead*`, débits `contextual.*`, pièces par la garde des fichiers, avis neutres par `notify.ts` (destination typée `contextualThread`), modération par la surface unique `contextualMessage`, export et effacement en cascade, cliquets `contextual-registry` et `contextual-hooks`. Toute lecture et toute écriture **relit** l'objet par le résolveur de sa nature (aucun cache d'accès). Registre branché sur les résolveurs livrés par DIASPORALE (CC-3a) ; aucune nature en attente. |
| Source | ANTSIA `9eaff40` (`codex/pa4-identite-session`) + arbre partagé non commité. Les fichiers **non suivis** de P14B `convex/modules/notifications/targets.ts` et `packages/social-domain/src/notificationOpenTarget.ts` portent aussi des ajouts CC-2b : à commiter ensemble. Tranche DIASPORALE CC-3a/CC-3b lue, jamais modifiée. |
| Tests | Écrits, non exécutés : `packages/social-domain/src/contextualMessaging.test.ts` (nouveau) ; `convex/modules/contextualMessaging/contextualMessaging.test.ts` (nouveau, N01–N11, N13–N26, N32–N45 ; registre de test injecté) ; `tests/ratchets/contextual-registry.test.ts` et `tests/ratchets/contextual-hooks.test.ts` (nouveaux, avec leurs tests du test) ; `tests/ratchets/network-scoped-functions.test.ts` (module ajouté) ; `packages/social-domain/src/commerceNotifications.test.ts` (attente des genres de destination mise à jour). |
| Recette | Ouverte : politique ouverte en console puis refermée ; demande de service envoyée (premier mot de la page), proposition, clôture par un côté ; mentorat accepté puis blocage ; candidature présélectionnée ; signataire retiré, page désactivée, suspension racine ; pièce en analyse puis libérée ; avis ouverts depuis la cloche et un push ; signalement, décision par un tiers, refus d'une partie ; export et effacement du demandeur, du mentor, d'un signataire ; FR/EN. À deux comptes au moins (demandeur, signataire), plus un mentor et un modérateur. |
| Dépendances | Codegen (`api.modules.contextualMessaging.*` : la console `console-contextual-policy.tsx` ne se type pas avant ; le test du moteur passe par `makeFunctionReference`) ; `verify` ; tranche DIASPORALE CC-3a présente (`registry.ts` importe `../diaspora/conversationContexts`) ; fichiers P14B non suivis ci-dessus. |
| Retour arrière | Fonctionnel immédiat : aucune ligne de politique = nature fermée (fermer en console suffit) ; un résolveur remis à `null` dans `registry.ts` rend la nature indisponible pour tous (repli sûr, N45). Retrait complet : retirer l'entrée du registre, les crochets de la tranche, l'étalement `...contextualMessagingTables` du schéma (tables vides) et les ajouts à ancre ; aucune donnée à migrer tant que les tables sont vides. |
| Limites | Voir « Limites et défauts observés ». |

## Points d'import

### CC-2a — le type du résolveur (pour la tranche)

```ts
// convex/modules/diaspora/*.ts — types SEULS (aucune valeur d'exécution dans contract.ts, cliquet)
import type {
  ContextualObjectRef,      // union { kind, id } par nature, id typé sur la table de la nature
  ContextualObjectRefOf,    // <K> la référence d'UNE nature
  ContextualReadCtx,        // Pick<QueryCtx, "db"> — base en lecture seule à l'exécution
  ContextualResolver,       // <K> { kind; load(ctx, id, now); visibleTo(ctx, id, personId, now); textRule?(input) }
  ContextualResolvers,      // { [K in ContextualKind]: ContextualResolver<K> } (ce que la tranche exporte)
  ContextualResponderRef,   // { pageId } | { personId }
  ContextualSnapshot,       // { networkId, requester:{personId}, responder, phase, callsEngaged, responderFirst,
                            //   attachments:{requester,responder}, writeMinStatus:{requester,responder}, moderationCountry }
  ContextualTextRuleInput,  // <K> { text, kind, side, voice } (D8 amendé)
  ContextualTextRuleResult, // { ok: true } | { ok: false; code } — code fermé de la tranche (APP_RULE_PATTERN)
} from "../contextualMessaging/contract"
import { CONTEXTUAL_KINDS, type ContextualKind, type ContextualPhase } from "@antsia/social-domain/contextualMessaging"
```

### Registre — seul fichier du moteur qui importe la tranche

```ts
// convex/modules/contextualMessaging/registry.ts
import { DIASPORA_CONVERSATION_CONTEXTS } from "../diaspora/conversationContexts"
export type ContextualRegistry = { readonly [K in ContextualKind]: ContextualResolver<K> | null }
export const CONTEXTUAL_PENDING_KINDS: readonly ContextualKind[] = []
export const CONTEXTUAL_REGISTRY: ContextualRegistry = { diasporaServiceRequest: …, diasporaMentoring: …, diasporaJobApplication: … }
```

Le type garde le repli `null` pour une nature future (« nature indisponible »). Analyse de fermeture
d'imports refaite après CC-3b : aucun chemin d'exécution de `diaspora/conversationContexts.ts` (25 modules)
ne revient vers `registry.ts` — pas de lecture en zone morte temporelle à l'évaluation.

### Crochets et aides offerts à la tranche (CC-3b, modération DIASPORALE)

```ts
import { openContextualConversation, purgeContextualConversation, syncContextualConversation } from "../contextualMessaging/hooks"
//   openContextualConversation(ctx: MutationCtx, ref): Promise<{ opened: true; threadId; created } | { opened: false }>
//   syncContextualConversation(ctx: MutationCtx, ref): Promise<{ threadId | null; change: "none"|"opened"|"closed"|"reopened"|"unchanged" }>
//   purgeContextualConversation(ctx: MutationCtx, ref): Promise<{ scheduled: boolean }>   // AVANT de supprimer l'objet hors effacement
import { canReadContextualMessage, canReadContextualThread, contextualDecisionConflict, contextualModerationFacts } from "../contextualMessaging/access"
```

Les crochets n'échouent jamais pour un refus (ils ne font pas échouer le geste de la tranche) ; un crochet
manqué ne change pas l'accès (relu sans cache).

### Fonctions publiques (après codegen : `api.modules.contextualMessaging.*`)

`threads` : `openForObject`, `getThread`, `findForObject`, `paginateMine`, `paginateForPage`, `markRead`,
`close` · `messages` : `paginateMessages`, `generateUploadUrl`, `send`, `remove` · `operator` : `policies`,
`policy`, `setPolicy` · interne : `retention.purgeSlice`. Toutes par les constructeurs du moteur
(`networkQuery`/`networkMutation` avec seaux, `operatorQuery`/`operatorMutation`).

## Décisions appliquées

1. **D1–D16 du contrat**, telles que validées :
   - D1 : module distinct de P10 ; règles communes (texte, clé) **dupliquées** dans le domaine pur, avec test de parité ; aucun import de `commercialMessaging/**` ni de `messaging/**`.
   - D2 : côté page = tous les signataires **vivants** (`liveSignatoryRole`).
   - D3 : voix de page ; `pageSpeakerPersonId` sert d'audit seul ; le coéquipier n'est montré qu'à l'équipe ; les avis en voix de page n'ont pas d'acteur.
   - D4 : `responderFirst` fourni par la tranche ; le premier mot est acquis par un message du répondant ou par un geste de l'objet (`syncContextualConversation`).
   - D5 (a) : réservé à CC-4 ; les aides pures (`contextualCallConsentAllowed`, `contextualCallAllowed`, `contextualCallAuthorityKey`) sont prêtes.
   - D6 : aucun crochet dans `closeExpiredJobOffers`.
   - D7 : `CONTEXTUAL_RETENTION = null`, aucune tâche planifiée.
   - D8 amendé : `textRule({ text, kind, side, voice })` ; un refus devient `failAppRule(code, {}, "invalidArgument")`, sans journalisation du texte.
   - D9 : au plus deux pièces `chat_attachment`, nombre jugé avant toute lecture du stockage.
   - D10 : politique fermée = historique en lecture seule ; la clôture reste possible.
   - D11 : `commerceJobApplication` et `shopContact` sont des noms réservés, refusés par le domaine, le validateur et le cliquet.
   - D12 : clôture par un côté, irréversible, avec `expectedRevision`, et avis `contextual_closed`.
   - D13 : export d'une trace sans contenu en voix de page.
   - D14 : seaux `contextual.open` 20/h cap 5, `contextual.message` 30/min cap 10 (renforcé `contextual.message.reinforced` 15/min cap 5 pour les comptes légers), `contextual.thread` 120/h cap 30, `contextual.manage` 120/h cap 30.
   - D15 : `moderateOwnedContentWrite` (propriétaire personne ou page), sans prélecture par défaut.
   - D16 : ADR-0025, module `contextualMessaging`, tables `contextual*`.
2. **Accès relu partout (§4.2)**, dans cet ordre :
   1. constructeur ;
   2. réseau du fil ;
   3. résolveur, avec les clés immuables du fil égales à celles de l'objet (sinon le fil est absent pour tous) ;
   4. qualité de partie, le demandeur d'abord ;
   5. vivacité : profil, adhésion, consentement `social_profile` ;
   6. visibilité propre de l'objet ;
   7. blocages : face à une page, seul le signataire concerné perd l'accès ; en mentorat, les deux ;
   8. politique, disponibilité d'en face et statut d'écriture (le plus strict de `declaree` et de l'exigence de la tranche), puis capacités.

   Tout refus avant le point 8 est indistinct (`null` en lecture, `notFound` en écriture).
3. **Refus explicites**, liste fermée de 9 règles `CONTEXT_*` ajoutées à `DOMAIN_RULES` et traduites (`rules.json` FR/EN). `CONTEXT_UNAVAILABLE` et `CONTEXT_TEXT_CONTROL` précisent l'implémentation.
4. **Ordre de l'envoi** :
   1. accès ;
   2. clé d'idempotence ;
   3. texte neutre ;
   4. nombre de pièces ;
   5. empreinte ;
   6. rejeu lié à l'émetteur : un message admis avant une fermeture est rendu tel quel ; une autre empreinte donne `conflict` + `CONTEXT_IDEMPOTENCY_CONFLICT` ;
   7. capacités ;
   8. seau du fil, consommé **après** le droit, si bien qu'un tiers ne peut pas l'épuiser ;
   9. règle de la tranche ;
   10. pièces par la garde ;
   11. écriture ;
   12. modération ;
   13. avis, seulement si le message est publié.
5. **Pièces** : `attachments.ts` compose `assertFreshUpload` → `admitStoredUpload` (`chat_attachment`, source `message`) → `assertAttachmentBatch`. Le cliquet `upload-policy` (temps 2) exige qu'un module qui délivre une URL de dépôt rattache ses fichiers lui-même ; d'où ce choix, plutôt que `verifyDeclaredAttachments`. Le contrat §5.7 le note. La délivrance passe par `deliverAttachments` : URL ou retenue nommée.
6. **Avis** : genres `contextual_message` et `contextual_closed`, catégorie « messages », sujet `contextualThread`. Ils vont à l'autre côté seulement, à vingt membres d'équipe vivants au plus (administrateurs d'abord), sans contenu. La garde `canReadContextualThread` est relue à l'émission, dans la cloche (`notificationStillVisible`, masquage et décompte), avant transport et à l'ouverture. La **destination typée** (modèle P14B) vaut `{ kind: "contextualThread", threadId, contextKind, objectId, side, pageHandle }`, relue et calculée par `contextualNotificationTarget` ; elle est servie par la cloche et par `open.resolveOpenTarget`, déjà générique. Si la garde échoue, la destination vaut `null` (repli neutre). `social-features` ne compose aucune adresse pour cette cible : l'application de la nature la route. Les phrases FR/EN de la cloche sont ajoutées.
7. **Modération** : surface unique `contextualMessage`, avec la cible `{ kind, id: v.id("contextualMessages") }`.
   - Signalement : seule une partie qui lit le message peut signaler ; personne ne signale son propre message ; un signataire ne signale pas la voix de sa page.
   - Aperçu : le message seul, et `context: { kind }` dérivé du fil.
   - Décision : une partie ou un signataire vivant de la page reçoit `notFound` (`contextualDecisionConflict`, en tête d'`assertNoPageDecisionConflict`).
   - Message retiré : retenu pour tous. En relecture : lu de son auteur, ou de l'équipe pour la voix de page. Le masque du signaleur reste la règle commune.
   - Libération d'un message en relecture : l'avis qu'il n'avait pas émis part (`onContextualMessageReleased`, émetteur relu).
8. **Resynchronisation après modération — voie (a)**, choisie et transmise. Le moteur garde son ordre ; le cliquet `contextual-hooks` admet la resynchronisation **planifiée** et nommée `internal.modules.diaspora.conversationSync.syncConversationsAfterModeration`, en appel direct ou par une aide locale (`scheduleConversationSync`). Il vérifie aussi que cette fonction appelle réellement `syncContextualConversation`. La voie (b) est écartée : un crochet du moteur après `setContentModerationStatus` aurait exigé de lire les tables de la tranche et de réordonner la modération de toutes les surfaces.
9. **Données (PA5)** :
   - `contextualThreads` : `owners: []`, parents = les trois références (le fil suit son objet) ;
   - `contextualMessages` : propriétaire `authorPersonId`, parent `threadId` ;
   - `contextualPersonStates` : propriétaire `personId`, parent `threadId` ;
   - `contextualPolicies` : partagée.

   L'export projette le fil, au demandeur ou au répondant-personne seulement, sans aperçu. Les messages en voix de personne vont à leur auteur, sans clé, empreinte ni `storageId`. Un message en voix de page donne une trace sans contenu à son signataire (D13). L'effacement remet à zéro le seau `contextual.thread`.
10. **Contrat aligné** (19/10, ancres uniques) :
    - statut Accepté, D1–D16 validées, D5 et D8 amendés, §6.3 corrigé (D6), type CC-2a et points d'import (§10.3) ;
    - noms des fichiers du domaine pur alignés sur le livré (`contextualMessaging.ts` et son test) aux §12 et §13.

## Fichiers

Créés :
`packages/social-domain/src/{contextualMessaging.ts,contextualMessaging.test.ts}` ;
`convex/modules/contextualMessaging/{contract,registry,tables,access,attachments,personStates,projection,hooks,threads,messages,operator,retention}.ts`
et `contextualMessaging.test.ts` ; `apps/admin_antsia_ga/src/components/console-contextual-policy.tsx` ;
`tests/ratchets/{contextual-registry.test.ts,contextual-hooks.test.ts}` et `tests/ratchets/lib/contextual.ts` ;
`docs/adr/0025-conversation-contextuelle.md` ; ce rapport.

Modifiés par ancres uniques relues juste avant (ajouts des autres sessions préservés) :
`docs/contrats/CONVERSATION-CONTEXTUELLE-V1.md` ; `docs/adr/README.md` (ligne 0025) ;
`packages/social-domain/src/{violation,notifications,notificationDelivery,moderationPolicy,audit,notificationOpenTarget,commerceNotifications.test}.ts` ;
`packages/social-contracts/src/i18n/locales/{fr,en}/rules.json` ;
`convex/schema.ts` (import + `...contextualMessagingTables`) ; `convex/lib/rateLimit.ts` (cinq seaux + renforcé) ;
`convex/modules/notifications/{tables,notify,policy,bell,targets}.ts` ;
`convex/modules/moderation/{tables,policy,targets,reviewProjection,cases}.ts` ;
`convex/modules/people/{dataPolicies,dataInventory,erasure}.ts` ;
`tests/ratchets/network-scoped-functions.test.ts` ;
`apps/admin_antsia_ga/src/components/console-pages.tsx` (montage de la politique) ;
`apps/admin_antsia_ga/src/i18n/locales/{fr,en}/operations.json` (`contextualPolicy.*`, `surfaces.contextualMessage`) ;
`packages/social-features/src/features/notifications/notification-targets.ts` ;
`packages/social-features/src/i18n/locales/{fr,en}/notifications.json`.

Non touchés : `package.json`, `bun.lock`, `_generated`, `.env*`, primitives UI, pont de session,
`convex/modules/diaspora/**`, `../DIASPORALE`, `convex/modules/messaging/**`,
`convex/modules/commercialMessaging/**`, `convex/modules/notifications/open.ts` (déjà générique),
contrats jumeaux et manifeste P06, `EXECUTION.md`.

## Tests écrits (non exécutés)

- **Domaine pur** (`contextualMessaging.test.ts`) : natures fermées et noms réservés ; référence unique par
  nature ; clé de contexte ; côtés et voix (demandeur d'abord) ; états vus (fermé l'emporte sur
  indisponible) ; cache et irréversibilité ; capacités par phase, premier mot, pièces ; vivacité et
  statuts ; texte (contrôles, NFC, vide, borne) avec **parité `commercialText`** ; clé avec **parité
  `commercialIdempotencyKey`** ; empreinte ; rejeu ; politique ; bornes ; genres, catégorie, sujet ;
  surface ; ordre des destinataires ; non-lu ; aides d'appel pour CC-4.
- **Moteur** (`contextualMessaging.test.ts`) : sessions réelles, résolveurs **simulés par un registre de
  test injecté** (`vi.mock("./registry")`, identifiants de forme valide sans ligne) — aucun résolveur de
  test enregistré dans le moteur.
  - Accès et réseau (N01–N09) ; blocages (N10–N11).
  - Cycle et idempotence (N13–N21).
  - Seaux renforcé et par fil (N22).
  - Premier mot (N23) ; refus de texte et adresse en voix de personne ou de page (N24).
  - Pièces : dépôt d'un tiers, lot trop nombreux, poids mensonger, dépôt d'autrui, analyse et quarantaine, retrait (N25–N26).
  - Avis sans contenu ni acteur en voix de page, destination typée, relecture (N32–N35).
  - Signalement, aperçu, décision refusée à une partie (N36–N38).
  - Export, classification et anonymisation (N39–N42) ; purge par tranches.
  - Politique en console : motif et journal ; listes.
  - Non-régression personnelle (N43, placée ici car `messaging/**` est en lecture seule) ; identifiants non convertibles (N44) ; repli `null` (N45).
- **Cliquets** : `contextual-registry` vérifie :
  - une entrée par nature ; natures en attente = entrées `null` ; aucune nature réservée ;
  - colonnes, index et parents de chaque nature ; libellés de console FR/EN ;
  - import de la tranche par `registry.ts` seul ; contrat sans valeur ; aucun `.collect()` dans l'arbre syntaxique.

  `contextual-hooks` vérifie que toute écriture d'état ou insertion ouvrante d'un objet enregistré appelle son crochet, sa resynchronisation planifiée admise ou une exemption motivée ; il est armé pour les natures à résolveur. Les deux cliquets ont leurs tests du test. `network-scoped-functions` couvre désormais le module.

## Reste à faire

- **CC-3 (DIASPORALE)** : CC-3a (résolveurs) et CC-3b (crochets, resynchronisation planifiée) sont livrés et branchés. Il reste leurs propres tests, le manifeste et les libellés de leur fragment, à confirmer par leur session. Puis CC-6 : port, adaptateur, entrées depuis « Mes demandes », « Demandes reçues », « Mes mentorats » et les candidatures, liens profonds routant la cible `contextualThread`.
- **CC-4 (moteur, appels)** :
  - `calls.contextualThreadId` (champ et index) et sélecteur de contexte d'appel ;
  - accords (`setCallConsent`, `callsAllowed` et `callAuthorityKey` déjà dans `contextualPersonStates`) ;
  - `start` par `calls/direct` avec admission D5 (a) ;
  - `canParticipateContextualCall`, jeton court, journal ;
  - arrêt des appels à la clôture, à la fermeture par synchronisation et à la purge (emplacements marqués « CC-4 » dans `hooks.ts`, `threads.ts` et `retention.ts`) ;
  - `revalidateCalls` planifié ;
  - projection `canSetCallConsent` / `canCall` / `callTargets` (aujourd'hui `false` / `false` / `[]`) ;
  - `contextualCalls.test.ts` (N12, N27–N31).
- **CC-5 (interface partagée)** : `contextual-messaging-source.ts` et `ContextualConversationView.tsx`, avec leurs tests ; fragment `messagerie.contexte.json` FR/EN ; source injectable dans `MessagesRoute.tsx` et `IcomMessagesPage.tsx`. Les phrases de la cloche et les 9 refus sont déjà traduits.
- **CC-V (coordinateur)** : codegen, `verify`, recette à deux comptes, sur instruction du propriétaire.

## Limites et défauts observés

- **Rien n'est vérifié** : aucun test, aucun typage ni aucun cliquet n'a tourné. Les cliquets `contextual-hooks` (armé depuis CC-3a) et `upload-policy` peuvent se révéler rouges à la première exécution.
- **Défaut probable chez P10 (lecture statique, non exécuté)** : le cliquet `upload-policy`, en son temps 2, regroupe les fichiers par `convex/modules/<module>`. Le module `convex/modules/commercialMessaging` y apparaît comme délivrant une URL (`messages.ts` → `guardUploadUrl`), mais aucun de ses fichiers n'appelle `admitStoredUpload` ni `admitPosedUploads` : le rattachement passe par `messaging/attachmentStorage.verifyDeclaredAttachments`, un autre module. Le cliquet devrait donc signaler P10. C'est la raison de `contextualMessaging/attachments.ts`. P10 n'a pas été modifié (lecture seule).
- **Libellé manquant hors de mon lot** : `apps/antsia_ga/src/i18n/locales/{fr,en}/memberNetwork.json` porte `moderation.surfaces.commercialMessage`, mais pas `moderation.surfaces.contextualMessage`. Un dossier contextuel vu depuis l'écran membre d'antsia.ga n'aurait pas de libellé. La console (`operations.json`) en a un, et DIASPORALE en a ajouté un.
- **Console** : `console-contextual-policy.tsx` référence `api.modules.contextualMessaging.operator.*`. Elle ne se type qu'après codegen.
- **Export et effacement** : N40 et N42 sont couverts par la classification (politiques de données, propriété directe, anonymisation), pas par un effacement de bout en bout. Celui-ci exige les objets réels de la tranche et relève de la recette CC-V.
- **Résolveurs simulés** : le test du moteur n'exerce pas les chargeurs DIASPORALE, couverts par leurs propres tests CC-3a.
- **Premier mot** : `responderSpokeAt` est acquis par le premier passage de synchronisation où l'objet ne fait plus attendre (`responderFirst: false`). C'est un fait irréversible : un objet qui referait attendre ne le retire pas.
- **Non-lu strict** (`lastMessageAt > readAt ?? createdAt`) : un message posé dans la même milliseconde que la dernière lecture n'est pas compté non lu. Seul l'émetteur est dans ce cas, puisque l'envoi marque lu.
- **Masque du signaleur** : la règle commune est conservée sur les messages (un signaleur ne relit plus le message signalé). La tranche ne l'applique pas à l'objet.
- **D7 et D13** restent à confirmer juridiquement : aucune durée de conservation (`null`), et une trace sans contenu à l'export d'un message en voix de page.
- **Arbre partagé** : les fichiers P14B non suivis (`notifications/targets.ts`, `notificationOpenTarget.ts`) portent des ajouts CC-2b. Un commit partiel les casserait.

## CC-4 — appels de la conversation contextuelle (19/10/2026)

**Verdict : sources raccordées ; tests écrits, non exécutés ; recette ouverte.** Décision du propriétaire
(18/10/2026) : « Continuer sans vérifier ». Aucun codegen, test, typage, lint, build, serveur, navigateur,
commande Convex ni installation. Aucune écriture git. Seule lecture outillée : une analyse statique des
imports par un script de lecture (aucune commande du projet), comme en CC-2b (voir « Limites »).

### Bilan standard

| Champ | Contenu |
|---|---|
| Résultat | Appels contextuels de bout en bout (§5.8, D5 amendé option (a)) : champ `calls.contextualThreadId` et ses deux index ; **sélecteur unique** du contexte d'appel (`calls/conversation.ts`, pur ; `calls/conversationAccess.ts`, règles vivantes) qui remplace toutes les branches P10 de `calls/*` et `notifications/{open,policy}.ts` sans changer le comportement P10 ; accords explicites par côté, liés à l'autorité (`callAuthorityKey`) ; phase « engagée » exigée ; portes `setCallConsent` et `start` par `placeDirectCall` et toutes ses gardes ; D5 (a) dans l'admission ; jeton de 60 s relu après le réveil ; ni messagerie vocale ni appel de groupe ; revalidation à chaque perte de droit ; projection des capacités, de son propre accord, des cibles consentantes et de l'effet de SES réglages. |
| Source | Arbre partagé non commité de `codex/pa4-identite-session` (`9eaff40`). `convex/modules/commercialMessaging/**`, `messaging/**`, `diaspora/**` : lus, jamais modifiés. |
| Tests | Écrits, non exécutés : `convex/modules/contextualMessaging/contextualCalls.test.ts` (N12, N27–N31, plus politique fermée, avis d'appel, conflit de contextes N44, jeton de 60 s), même harnais que le test du moteur (`vi.mock("./registry")`, sessions réelles). |
| Recette | Ouverte : à deux comptes au moins (demandeur, signataire) plus un mentor — accords, appel audio/vidéo dans les deux sens, retrait pendant la sonnerie puis pendant l'appel, signataire retiré, blocage, clôture du fil, objet clos par la tranche, politique fermée en console ; réglages « hors de mes relations », « ne pas déranger », occupé ; jeton expiré et reconnexion ; journal et rappel par la conversation ; FR/EN (textes CC-5). |
| Dépendances | Codegen (les portes `api.modules.contextualMessaging.calls.*` sont neuves ; le test les référence par chemin) ; `verify` ; tranche DIASPORALE fournissant `callsEngaged` (CC-3a) ; interface CC-5. |
| Retour arrière | Immédiat : fermer la politique de la nature (aucun accord activable, aucun appel ; la revalidation arrête ceux qui vivent). Retrait complet : retirer `contextualMessaging/calls.ts`, l'appel des aides dans `threads.ts`/`hooks.ts`/`retention.ts`/`operator.ts`, la tâche `contextual-revalidate-calls`, puis le champ et les index (aucune donnée tant qu'aucun appel contextuel n'existe). Le sélecteur peut rester : sans contexte contextuel, il rend exactement le comportement P10 antérieur. |
| Limites | Voir « Limites CC-4 ». |

### API exacte pour CC-5 (après codegen)

`api.modules.contextualMessaging.calls.setCallConsent` — `networkMutation`, statut minimal `en_attente`
(activer exige `declaree` ET le statut d'écriture de la tranche pour son côté), seau `contextual.manage`.
- Arguments : `{ networkId: Id<"networks">, threadId: Id<"contextualThreads">, allowed: boolean }`.
- Retour : `null`.
- Retirer (`allowed: false`) : toujours admis pour une partie actuelle (fil fermé compris) ; arrête dans la même transaction l'appel vivant dont la paire n'est plus admise.
- Activer : refus fermés `CONTEXT_NOT_OPEN`, `CONTEXT_CLOSED`, `CONTEXT_UNAVAILABLE`, `CONTEXT_CALLS_CLOSED` (règles, `invalidArgument`), ou `statusInsufficient`. Tiers : `notFound`. L'accord ne fait jamais sonner.
- Voix de page : le signataire qui consent accepte d'être NOMMÉ dans l'appel. **CC-5 doit afficher un texte d'accord distinct** pour ce cas (`viewer.voice === "page"`).

`api.modules.contextualMessaging.calls.start` — `networkMutation`, statut minimal `declaree`, seau
`contextual.manage`, puis `call.place` dans la porte partagée.
- Arguments : `{ networkId: Id<"networks">, threadId: Id<"contextualThreads">, targetPersonId?: Id<"persons">, mediaType: "audio" | "video" }`.
- Retour : le résultat d'appel direct (`calls/direct.directCallResultValidator`) : `{ admitted: true, callId, calleePersonId, roomName, mediaType }` ou `{ admitted: false, callId, calleePersonId, reason: "dnd" | "in_meeting" | "busy" | "offline", voicemailOffered: false }` (`outside_relations` ne peut pas survenir : D5 (a)). Un refus d'admission est une VALEUR (appel inscrit terminé, au journal de la conversation), jamais une exception.
- Cible : le répondant appelle le demandeur ; le mentoré son mentor ; face à une page, le demandeur passe `targetPersonId` choisi dans `callTargets` (un seul consentant : choisi d'office). Un signataire n'appelle qu'en son nom et seulement le demandeur.
- Refus : `CONTEXT_CALL_CONSENT_REQUIRED` (son accord, ou celui d'en face, manque), `CONTEXT_CALLS_CLOSED`, `CONTEXT_CLOSED`, `CONTEXT_NOT_OPEN`, `CONTEXT_UNAVAILABLE`, `statusInsufficient`, `invalidArgument` avec `field: "targetPersonId"` (plusieurs consentants, aucun choisi), `notFound` (tiers ; cible inconnue, d'un autre côté ou signataire non consentant — indistinct, D3 ; un appel vit déjà dans le fil), `rateLimited`.
- Suite : le flux d'appel existant, inchangé — `calls.lifecycle.setCallRinging` (appelant), `calls.livekitActions.requestToken` (jeton de 60 s, relu à chaque émission), `calls.lifecycle.join` / `leave` / `declineCall`, `calls.lifecycle.getCall`.

Projection du fil (`threads.getThread`, `findForObject`, `paginateMine`, `paginateForPage`, type `ContextualThreadDto`) :
- `capabilities.canSetCallConsent` : activer possible (fil ouvert, phase engagée, statut d'écriture) ou accord à retirer ;
- `capabilities.canCall` : accords effectifs des deux côtés, cible prête, aucun appel vivant dans le fil ;
- `callConsent` : son accord EFFECTIF (posé et lié à l'autorité qu'il a encore), jamais celui d'en face ;
- `callTargets: { personId, label }[]` : signataires consentants, au seul demandeur face à une page, quand il peut appeler (vingt au plus) ; vide sinon ;
- **`callSettings` (nouveau, D5 amendé)** : `{ outsideRelationsSilenceWaived: boolean, dndUntil: number | null, meetingSilence: boolean, callWaitingOff: boolean, incomingPushOff: boolean }` — SES réglages seulement, jamais ceux d'en face. Phrases attendues de CC-5 : si `outsideRelationsSilenceWaived`, « vos réglages d'appel en silence ne s'appliquent pas à cet accord » ; si `dndUntil` est futur à l'horloge de l'écran, « ne pas déranger est actif » ; si `meetingSilence`, le silence de réunion s'applique ; si `callWaitingOff`, « occupé » quand il est déjà en ligne ; si `incomingPushOff`, pas de sonnerie hors de l'onglet.

DTO d'appel : `contextualThreadId?: Id<"contextualThreads">` s'ajoute (à côté de `commercialThreadId?`) aux lignes
de `calls.ringing.listRinging`, de `calls.history.listCallHistory` et à `calls.lifecycle.getCall`. **« Le journal
rappelle par la conversation »** : pour une ligne portant `contextualThreadId`, l'écran ouvre la conversation (et
son `start`), jamais `calls.direct.callMember` ni la messagerie vocale.

### Aides internes (moteur)

- `contextualMessaging/callAccess.ts` : `canParticipateContextualCall(ctx, call, personId)` (§10.2, lu par `calls` et `notifications` via le sélecteur), `contextualCallPairAllowed`, `contextualCallVisibleTo` (journal, avis), `currentCallAuthorityKey`, `effectiveCallConsent`, `callPhaseRefusal`, `canActivateCallConsent`, `readyCallTargets`, `resolveContextualCallTarget`, `liveContextualCalls`, `stopContextualThreadCalls`, `revalidateContextualThreadCalls`, `contextualCallView`, `viewerCallSettings`. N'importe jamais `calls/direct.ts` ni `commercialMessaging/**`.
- `contextualMessaging/personStates.ts` : `setPersonCallConsent` (seule écriture de `callsAllowed` / `callAuthorityKey`).
- `contextualMessaging/retention.ts` : `revalidateCalls` (interne, pages de vingt, chaîne par curseur).
- `calls/conversation.ts` (pur) : `callConversationOf`, `isConversationCall`, `conversationFieldsOf`, `conversationFieldsOfCall`, `CONVERSATION_CALL_TOKEN_TTL`. `calls/conversationAccess.ts` : `canParticipateConversationCall`, `conversationCallInJournal`, `conversationCallPairAllowed`.

### Décisions appliquées

1. **Sélecteur unique, P10 intact.** `none` → chemin habituel ; `commercial` → règles P10 INCHANGÉES (`canParticipateCommercialCall`, `commercialCallPairAllowed`) ; `contextual` → règles CC-4 ; `conflict` (deux contextes) → refus partout. Branches remplacées : accès (`isLiveMemberOfThreadCall`), porte d'appel (`placeDirectCall`), sonnerie et jeton (`authorizeToken`, `listRinging`), fermeture de salle (`finishCall`), jeton de 60 s et relecture après réveil (`requestToken`), journal (`listCallHistory`), état (`getCall`), refus de la messagerie vocale (`voicemail.leave`) et de la promotion en groupe (`addInvitee`), `ringsFor` et `incomingCallAllowed`. Aucune demande à P10 : sa signature `placeDirectCall({ …, commercialThreadId })` est conservée.
2. **Accords liés à l'autorité** : `callAuthorityKey` = `page:<ligne de signataire>:<acceptedAt>` en voix de page, `person:<contextKey>:<côté>` sinon (aide pure CC-1). Un accord n'est effectif que si la clé stockée égale la clé actuelle (N29).
3. **Paire admise** : deux personnes de côtés opposés, chacune partie actuelle (relecture complète `accessForThread`), conversation ouverte, phase engagée, statut d'écriture, accord effectif, aucun blocage entre elles. Relue à la sonnerie, au décrochage, à chaque jeton, à l'état, aux avis d'appel et à chaque revalidation.
4. **D5 (a)** : `evaluateCallAdmission(…, { viaContextualConsent: true })` lève le seul réglage « hors de mes relations » pour un appel contextuel (dont la paire exige l'accord de l'appelé dans ce fil) ; « ne pas déranger », silence de réunion, occupation et absence connue restent appliqués, et sont RELUS avant le décrochage (comme P10). L'appel personnel garde le réglage.
5. **Revalidation** : retrait d'accord (`setCallConsent`), clôture par un côté (`threads.close`), synchronisation de l'objet (`syncContextualConversation`, même cache inchangé), purge (`purgeContextualConversation`, `purgeContextualThreadSlice`) arrêtent les appels dans leur transaction ; politique fermée (`operator.setPolicy`) planifie `revalidateCalls` ; les pertes nées hors du module (adhésion, suspension, signataire, blocage, consentement, profil, page) ferment toute porte à la requête suivante, et la tâche `contextual-revalidate-calls` (une minute, comme `commercial-revalidate-calls`) arrête la salle établie. Fin écrite : `ended` / `normal` (parité P10), salle fermée par `closeDirectRoom`.
6. **Aucun appel automatique** : ouverture, acceptation, présélection et accord ne créent aucun appel ; au plus un appel vivant par fil.
7. **Avis d'appel** : un `call_missed` issu d'un appel contextuel refusé suit la lecture du fil (`notificationStillVisible`) ; avis personnels et P10 inchangés.

### Fichiers

Créés : `convex/modules/calls/{conversation,conversationAccess}.ts` ;
`convex/modules/contextualMessaging/{callAccess,calls}.ts` et `contextualCalls.test.ts`.

Modifiés par ancres uniques relues juste avant : `convex/modules/calls/{tables,access,direct,evaluate,state,token,livekitActions,ringing,history,lifecycle,voicemail,groupCalls}.ts` ;
`convex/modules/notifications/{open,policy}.ts` ;
`convex/modules/contextualMessaging/{tables,personStates,hooks,threads,retention,operator}.ts` (index `by_thread_calls` sur
`contextualPersonStates`) ; `convex/crons.ts` (`contextual-revalidate-calls`, après la ligne P10) ; ce rapport.

Non touchés : `commercialMessaging/**`, `messaging/**`, `diaspora/**`, `package.json`, `bun.lock`, `_generated`,
`.env*`, primitives UI, pont de session, contrats jumeaux et manifeste P06, contrat CC (accepté) et ADR-0025.

### Tests écrits (non exécutés) — `contextualCalls.test.ts`

- N27 : sans accord, un seul accord, phase non engagée, fil clos ; rien ne sonne à l'ouverture ni à l'accord ; demande `sent` : accord non activable ; tiers indistinct.
- N28 : retrait pendant la sonnerie ; objet clos pendant l'appel établi (crochet) ; phase non engagée à cache inchangé ; signataire retiré pendant la sonnerie (porte refusée, puis `revalidateCalls`) ; politique fermée.
- N29 : rôle retiré puis rendu → accord sans effet, cible indistincte ; nouvel accord → cible rétablie.
- N30 : D5 (a) pour CE fil seulement (l'appel personnel garde le réglage) ; « ne pas déranger », occupé, hors ligne ; jamais de messagerie vocale ; ni invitation ni promotion ; un seul appel vivant ; `callSettings` de chacun.
- N31 : cible consentante seule (non-consentant, tiers, soi-même indistincts) ; un consentant choisi d'office ; deux → `targetPersonId` exigé ; un signataire n'appelle que le demandeur, en son nom.
- N12 : blocage pendant l'appel (mentorat) → jeton, état et journal fermés, appel arrêté ; face à une page, seul le signataire concerné.
- Avis `call_missed` masqué pour un ancien participant ; N44 : deux contextes refusés, identifiant d'une autre famille refusé par le validateur ; jeton de 60 s (`exp − nbf`), refusé après retrait.

### Limites CC-4

- **Rien n'est vérifié** : aucun test, typage ni cliquet n'a tourné. Analyse statique des imports (script de lecture) : un seul cycle d'évaluation touche ces fichiers — le cycle préexistant `notifications` ↔ `diaspora` (17 modules), rejoint par `calls/{access,state,conversationAccess}.ts` et `contextualMessaging/callAccess.ts` ; aucun de ses membres ne lit une liaison importée au chargement. `registry.ts`, `threads.ts`, `contextualMessaging/calls.ts` et `calls/direct.ts` restent hors cycle.
- **Délai des pertes nées hors du module** : la porte suivante refuse aussitôt, mais une salle déjà établie n'est arrêtée qu'au passage de `contextual-revalidate-calls` (une minute au plus, non mesurée) ; un jeton déjà émis (60 s) n'est pas révoqué cryptographiquement (limite assumée §4.3, comme P10).
- **Tâche planifiée** : `contextual-revalidate-calls` arrête des appels, n'efface rien ; D7 reste sans durée (aucune purge temporelle). À confirmer par le coordinateur, la phrase « aucune tâche planifiée » du §6.6 visant la conservation.
- **Accord et autorité** : seule la clé (ligne de signataire et date d'acceptation, ou qualité de partie) invalide un accord. Une perte de droit qui ne change pas la clé (blocage levé, suspension levée, page réactivée, adhésion rétablie sur la même ligne) laisse l'accord revivre avec le droit ; une partie absente (bloquée) ne peut pas retirer son accord pendant le blocage.
- **Relecture de l'admission avant décrochage** (parité P10) : un « ne pas déranger » posé ou une présence devenue hors ligne pendant la sonnerie rend l'appel non admis pour les deux personnes ; la revalidation le termine (`ended` / `normal`, comme P10, même s'il n'a jamais été décroché).
- **Un appel vivant par fil** : `start` répond `notFound` (parité P10) ; l'écran s'appuie sur `canCall`.
- **`dndUntil`** est la valeur brute de son réglage : l'écran la compare à son horloge (une requête ne se rafraîchit pas à l'échéance).
- **Coût de projection** : `canCall` et `callTargets` relisent chaque cible consentante (vingt au plus) quand son propre accord est effectif ; les listes partagent la mémoire locale de la requête.
- **Codegen** : `api.modules.contextualMessaging.calls.*` et le type de `requestToken` enrichi (`contextualThreadId`) ne se typent qu'après génération.

## CC-5 — source et vue contextuelles partagées (19/10/2026)

**Verdict : sources raccordées ; tests écrits, non exécutés ; recette ouverte.** Décision du propriétaire
(18/10/2026) : « Continuer sans vérifier ». Aucun codegen, test, typage, lint, build, serveur, navigateur,
commande Convex ni installation ; aucune lecture outillée autre que `grep`/`git diff` et deux lectures
statiques en Node, hors outillage du dépôt (fermeture des imports de chaque module testé : les mocks de
`@antsia/ui/overlay` couvrent les exports atteints ; fragment i18n : 96 clés, mêmes clés et variables FR/EN) — des
lectures, pas une validation ; aucune écriture git.
Interface alignée sur CC-4 tel que livré (message du coordinateur du 19/10, relu dans `contextualMessaging/{calls,threads}.ts`).

### Bilan standard

| Champ | Contenu |
|---|---|
| Résultat | Une troisième source de messagerie, **contextuelle**, au contrat de la source existante (constante de module, membres hooks, `SourcePageListe`, réseau injecté après les arguments) : mes fils et ceux d'une page dont je suis signataire, un fil, le fil d'un objet, les messages, et les écritures (ouverture, envoi idempotent, dépôt gardé, lecture marquée, clôture, retrait, signalement, accord et démarrage d'appel). Une vue de conversation qui **compose** les sous-composants partagés (en-tête, bulles accessibles P18b, pièces de la garde, composeur, pastille, région polie des arrivées, trace locale des envois), sans fork. Une liste « Mises en relation », un **filtre typé** dans la vue Conversations, et un **point d'injection** (`useContextualMessages` → `MessagesRoute`, prop `contextual`) servi dans les deux navigations. Les appels contextuels du journal, de l'écran de fin et de l'ajout de participant passent par la conversation, jamais par l'appel personnel. Aucun fil personnel ni P10 n'est lu, écrit ou converti. |
| Source | Arbre partagé non commité de `codex/pa4-identite-session` (`9eaff40`) ; moteur CC-2b et CC-4 lus (`contextualMessaging/{threads,messages,calls,projection,tables}.ts`, `calls/{direct,history,ringing,lifecycle}.ts`). |
| Tests | Écrits, non exécutés (liste ci-dessous). |
| Recette | Ouverte (CC-V), à monter dans DIASPORALE après CC-6 : liste et filtre ; voix de page vue du demandeur et de l'équipe ; envoi, double appui, coupure réseau et réessai ; adresse exacte refusée (voix de personne) et admise (voix de page) ; pièce en analyse ; fermée, indisponible, bloquée, absente ; clôture ; accord d'appel, effet de ses réglages, appel audio/vidéo, refus d'admission ; journal et fin d'appel ; lecteur d'écran (région du fil, arrivées, alertes) ; FR/EN ; téléphone et bureau. |
| Dépendances | Codegen (types de `api.modules.contextualMessaging.*`, de `callSettings` et de `contextualThreadId` sur les DTO d'appel) ; `verify` ; CC-6 (DIASPORALE) pour un montage réel. |
| Retour arrière | Sans injection, rien de contextuel n'est rendu (filtre absent, segment refusé, lignes d'appel contextuel sans geste) ; retirer la prop `contextual` de l'application suffit. Retrait complet : supprimer les fichiers créés, les ajouts ancrés marqués « CC-5 » et le fragment i18n. |

### Point d'injection pour DIASPORALE (CC-6)

```tsx
// apps/diasporale_com/src/screens/icom-screens.tsx (MessagesScreen), sous IcomIsland (NetworkProvider + routeur)
import { MessagesRoute, useContextualMessages } from "@antsia/social-features/messagerie"
// ou, sans le barillet : "@antsia/social-features/features/messagerie/contextual-entry"
const contextual = useContextualMessages({
  describeAppRule,   // (code, params) => phrase de SON espace de noms, ex. context_address_forbidden ; null sinon
  describeObject,    // facultatif : (fil) => « où en est l'objet » ; null sinon
  onOpenObject,      // facultatif : ({ kind, id }) => écran de l'objet
  // pageId,         // « Demandes reçues » d'une page (signataire vivant) ; kind pour une seule nature
})
<MessagesRoute {...props.route} contextual={contextual} />
```

- Adresse : `<base>/mise-en-relation/<fil>` — `CONTEXTUAL_ROUTE_KIND` (hors de `CONVERSATION_ROUTE_KINDS`, comme `commerce`) ; la coquille `lib/messages-route.ts` doit l'accepter (import depuis `@antsia/social-features/features/messagerie/messagerie-routes`). Composer : `conversationHref(contextualConversationKey(fil), routes.messages())` — y compris pour la destination d'avis `contextualThread`.
- Rendu : navigation par destinations → `IcomMessagesPage` (filtre « Mises en relation » dans Conversations, conversation dans le panneau de détail, journal) ; navigation par volets (DIASPORALE aujourd'hui) → au téléphone, liste iCom avec le filtre ; conversation **en page** au téléphone comme au bureau (le dock personnel ne porte jamais un fil contextuel).
- Montage direct possible sur ses écrans : `ContextualConversationList` (`pageId`, `kind`, `onOpen`) et `ContextualConversationView` (`threadId`, `onBack`…) ; l'objet → fil : `CONTEXTUAL_MESSAGING_SOURCE.useThreadForObject(ref)`, ouverture idempotente `useWrites().openForObject(ref)`.
- Journal d'appels : `IcomAppelJournal` reçoit `onOpenContextualThread` quand `contextual` est injecté (destinations et volets au téléphone).

### Hypothèses CC-4 et écarts corrigés après livraison

| Sujet | Hypothèse initiale | CC-4 livré | Effet sur CC-5 |
|---|---|---|---|
| Noms et arguments | `calls.setCallConsent({ threadId, allowed })`, `calls.start({ threadId, targetPersonId?, mediaType })` | identiques | aucun |
| Retour de `start` | résultat d'appel direct | `directCallResultValidator`, jamais de messagerie vocale, raisons `dnd`/`in_meeting`/`busy`/`offline` | `resultatAppelDe` réutilisé ; écran de refus ouvert sans dépôt vocal |
| Effet de MES réglages (D5) | lecture séparée `calls.preferences.getMine` | `callSettings` dans la projection du fil | **corrigé** : lecture séparée retirée de la source ; phrases pour `outsideRelationsSilenceWaived` (avant et après l'accord), `dndUntil` futur (avec son heure), `meetingSilence`, `callWaitingOff`, `incomingPushOff` |
| Plusieurs consentants sans choix | non prévu | `invalidArgument`, `field: "targetPersonId"` | **ajouté** : « Choisissez la personne de l'équipe à appeler. » ; l'écran envoie toujours la cible choisie (la première par défaut) face à une page |
| Lignes d'appel | non prévu | `contextualThreadId?` sur `listRinging`, `listCallHistory`, `getCall` | **ajouté** : journal (rappeler/écrire → la conversation ; sans injection, aucun geste), écran de fin (ni rappel personnel ni fil personnel ; lien vers la conversation), aucun ajout de participant |
| `canSetCallConsent` | activer seulement | activer ou accord à retirer | le bouton dépend de `callConsent` (retirer) puis de `canSetCallConsent` (donner) |

### Décisions appliquées

1. **Source** (`contextual-messaging-source.ts`) : `paginateMine` (curseur à deux côtés) et `paginateForPage` (pagination Convex) accumulés comme la boîte personnelle (première page vivante, `fusionnerPagesFils`) ; messages en pages Convex **vivantes** (`useAuthenticatedPaginatedQuery`, tenues par `ReseauPaginatedErrorBoundary`) pour qu'un retrait ou une décision de modération se voie aussitôt ; aucune donnée personnelle ni P10.
2. **Envoi idempotent** : règle neutre `contextualText` avant tout aller-retour, puis `useConversationSend` (clé = identifiant local de l'intention, réutilisée sur un réessai identique ; `MessageSendInProgress` au double appui ; trace locale « Envoi en cours » → « Envoyé » à l'admission, effacée quand CE `messageId` est projeté). Un refus garde texte et pièces (`AbandonedMessageSend`) et se dit traduit. Brouillon en mémoire seulement, par lecteur et par fil (le magasin du dock purgerait une clé qu'il ne connaît pas).
3. **Voix** : le demandeur ne voit jamais le signataire (défense côté écran même si le moteur en enverrait un) ; l'équipe voit « Awa pour Atelier Mbolo » ; la phrase de voix dit au lecteur au nom de qui il écrit. Rôles et natures traduits par défaut (liste fermée du moteur) ; l'état de l'objet vient de l'application (`describeObject`).
4. **États** : ouverte, fermée, indisponible (ligne `role="status"`, sous-titre de l'en-tête) ; bloquée et absente reçoivent la même phrase neutre, sans cause et sans lecture des messages ; l'envoi fermé est remplacé par le refus explicite `rules:CONTEXT_*` (phase comprise : premier mot attendu, pièces fermées).
5. **Refus de la tranche** : `appRule` traduit par l'application (`describeAppRule`, règle §5.3 : « traduit par l'application qui l'a défini ») ; à défaut, une phrase neutre — jamais le code brut.
6. **Bulles P18b** : `MessageBubble` réutilisée avec une feuille d'actions injectable (`renderActionsSheet`, ajout facultatif, comportement historique inchangé sans elle) : copier ; retirer son message (confirmation) ; signaler celui d'en face (motif fermé, RHF + Zod) — ni réaction, ni transfert, ni épingle, ni citation, ni accusé (`readAt` absent : aucune coche). Un refus se dit dans la feuille (la page derrière est inerte).
7. **Pièces** : uniquement par `generateUploadUrl` du fil (`chat_attachment`), au plus deux (D9), vocal compris, selon `canAttach` ; délivrance par la garde (`MessageAttachment` : URL servie ou retenue nommée).
8. **Appels** : panneau ouvert à la demande ; texte d'accord distinct en voix de page (le signataire sera nommé) ; jamais prérempli, retrait toujours offert ; démarrage par formulaire RHF + Zod (cible parmi les seuls consentants) ; rien ne sonne avant le geste.
9. **Accessibilité** : fil en région nommée par le titre ; arrivées annoncées (`conversation-arrivals`, P18b A04) ; confirmations dans une région polie persistante ; erreurs en `role="alert"` ; confirmation de clôture en groupe nommé avec focus sur « Annuler » ; sélecteurs étiquetés par `htmlFor`.
10. **Aucune promesse non prouvée** : ni « Lu », ni « Livré » ; « Envoyé » = admission serveur ; aucune lecture marquée montrée à l'autre côté (acquittement une fois par dernier message).

### Fichiers

Créés (`packages/social-features/src/`) :
`features/messagerie/{contextual-conversation-model.ts,contextual-messaging-source.ts,ContextualConversationView.tsx,ContextualConversationList.tsx,use-contextual-messages.tsx,contextual-entry.ts}` ;
`i18n/locales/{fr,en}/messagerie.contexte.json` (espace `messagerie`, clé `contextualConversation.*`, mêmes clés FR/EN) ;
tests `features/messagerie/{contextual-conversation-model.test.ts,contextual-messaging-source.test.ts,contextual-messaging-routes.test.ts,ContextualConversationView.test.tsx,ContextualConversationList.test.tsx,MessagesRoute.contextual.test.tsx,MessagerieListView.contextual.test.tsx}` et `features/iappel/IappelJournal.contextual.test.tsx`.

Modifiés par ancres uniques relues juste avant (en-têtes de provenance complétés « CC-5 ») :
`features/messagerie/{messagerie-dock.ts,messagerie-routes.ts,icom-views.ts,MessageBubble.tsx,MessagerieListView.tsx,MessagerieListPage.tsx,IcomMessagesPage.tsx,MessagesRoute.tsx,IcomAppelJournal.tsx,index.ts}` ;
`features/iappel/{call-journal.ts,IappelJournal.tsx,call-end-actions.ts}` ; `shell/communication/global-call-surface-host.tsx` (deux gardes d'ajout de participant) ; `i18n/index.ts` (fragment fusionné dans `messagerie`) ; ce rapport.

Non touchés : `convex/**`, `apps/**` (aucune nature V1 dans ANTSIA), `CommercialConversationView.tsx` et la source P10, `notification-targets.ts`, `packages/api/**`, primitives UI, pont de session, `package.json`, `bun.lock`, `_generated`, `.env*`, `../DIASPORALE`.

### Tests écrits (non exécutés)

- **Modèle** : voix de page sans signataire pour le demandeur, coéquipier pour l'équipe, phrases de voix ; ordre et dédoublonnage ; bulles sans accusé ni réaction ; retenu → masqué, retiré → supprimé ; états ; refus explicites (règles, `appRule` traduit ou neutre, conflit d'idempotence, envoi en cours, cible à choisir) ; gestes d'une bulle ; notes d'appel (CC-4) ; recherche locale ; acquittement ; brouillon.
- **Source** : listes armées et bornées, nature transmise seulement si choisie, accumulation sans doublon, page désarmée, pagination de page ; fil, objet et messages désarmés sans identifiant ; réseau injecté après les arguments ; noms CC-4 et cible facultative ; aucune autre lecture.
- **Adresses et filtre** : clé `contexte:` jamais lue par le dock, segment refusé sans injection, chemin relu ; filtre servi seulement avec la liste injectée.
- **Vue** : voix de page sans nom ; contexte de l'objet ; double appui → un envoi, réessai → même clé, trace jusqu'à la projection ; caractère de contrôle refusé avant envoi ; fermée, indisponible, bloquée et absente (même phrase, aucun message demandé) ; premier mot et pièces fermées ; adresse exacte traduite par l'application ou neutre ; accord d'appel (texte distinct en voix de page, effet de ses réglages, retrait) ; démarrage vers un consentant choisi ; refus d'admission sans messagerie vocale ; refus CC-4 traduits ; région nommée, arrivée annoncée, feuille d'actions sans réaction, signalement, retrait avec refus dans la feuille, clôture avec focus, acquittement unique, panne de lecture.
- **Liste** : lignes, non-lu, `aria-current`, recherche locale annoncée, aller au bout, vide, panne, fils d'une page.
- **Aiguillage** : destinations et volets, avec et sans injection ; liste iCom recevant l'injection ; filtre dans les deux présentations, sans fil personnel ni invitation, mémorisé.
- **Appels** : ligne contextuelle du journal → conversation (jamais `callMember` ni fil personnel), fermée sans injection ; fin d'appel contextuel sans rappel ni ajout.

### Limites CC-5

- **Rien n'est vérifié** : aucun test, typage, lint ni cliquet n'a tourné ; les types `api.modules.contextualMessaging.*`, `callSettings` et `contextualThreadId` (DTO d'appel) n'existent qu'après génération.
- **Bureau en navigation par volets** (DIASPORALE aujourd'hui) : `/messages` ouvre le dock personnel, qui ne porte pas le filtre « Mises en relation » ; la conversation, elle, se rend en page. Monter la liste sur un écran de l'application, ou passer aux destinations.
- **Pages anciennes des listes** : photographies, comme la boîte personnelle (un fil qui sort de la première page quand un autre remonte peut manquer jusqu'au rafraîchissement).
- **Carte d'appel entrant** : elle ne nomme pas la conversation d'origine (`listRinging.contextualThreadId` non lu, comme P10) ; la fin d'appel et le journal y renvoient.
- **Lien de fin d'appel** : composé sous `routes.messages()` ; une application qui n'injecte pas `contextual` répondrait « introuvable » (aucune nature V1 hors DIASPORALE).
- **Voix du signataire** : la projection ne porte pas la carte de sa propre page ; la phrase dit « la page », sans nom.
- **« Envoyé »** : admission serveur seulement ; un message en relecture de modération est « Envoyé » pour son auteur et retenu pour l'autre côté.
- **Brouillon** : mémoire seulement, perdu au remplacement du document (choix délibéré).
- **Rôles et natures** : libellés par défaut du moteur ; l'état métier de l'objet (« Proposition à accepter ») reste à l'application (`describeObject`).
