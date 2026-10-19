# P14B — Notifications des services et de l'emploi, ouverture ciblée, renvoi Mes achats

Date : 19 octobre 2026. **Verdict : sources raccordées ; tests écrits, non exécutés ; recette ouverte.**

Décision du propriétaire (18/10/2026) : « Continuer sans vérifier ». Aucun codegen, test, typage, lint,
build, serveur, navigateur, commande Convex ni installation n'a été lancé. Tous les tests cités sont
**écrits, non exécutés** ; aucun résultat n'est annoncé. Aucun commit, aucune écriture git.

## Bilan standard

| Champ | Contenu |
|---|---|
| Résultat | 13 genres d'avis commerce (P14 services, P15 emploi), neutres, émis par la porte unique `notifyPerson` à partir d'un état **confirmé par PRO.GA** (réponse corrélée, relecture, consultation, suivi), jamais d'un clic local ; destinataires relus à l'écriture, à la lecture de la cloche, avant tout transport et à l'ouverture. Ouverture ciblée : `open.resolveOpenTarget` rend une **destination typée** relue (`target`) — demande de service, fiche de candidature, conversation commerciale de l'équipe, décisions d'une page ou personnelles, sujet générique DIASPORALE. Cloche : phrases et liens de ces genres ; `moderation_decision` d'un dossier de page projette la carte publique de la page au seul signataire vivant (ajout du coordinateur). Fiche « Ma candidature » (`/mes-candidatures/[applicationId]`). Mes achats : section distincte qui renvoie à Mes demandes. |
| Source | ANTSIA `9eaff40` (`codex/pa4-identite-session`) + arbre partagé non commité. Fichiers ci-dessous. |
| Tests | Écrits, non exécutés : `packages/social-domain/src/commerceNotifications.test.ts` (nouveau) ; `convex/modules/notifications/targets.test.ts` (nouveau) ; bloc « P14B » en fin de `convex/modules/shops/services.test.ts` et de `convex/modules/shops/jobApplications.test.ts` ; `open.test.ts` (forme attendue `target: null`) ; bloc « P14B » de `packages/social-features/src/features/notifications/notification-targets.test.ts` ; `apps/antsia_ga/src/components/notification-open-screen.test.tsx` (bloc ajouté), `apps/antsia_ga/src/components/purchases/purchases-screen.test.tsx` (bloc ajouté), `apps/antsia_ga/src/components/jobs/my-application-screen.test.tsx` (nouveau), `apps/antsia_ga/src/lib/notification-destinations.test.ts` (nouveau). |
| Recette | Ouverte : rendez-vous retenu puis confirmé/refusé/annulé côté PRO.GA et relu côté client ; devis accepté vu par un mandataire ; suivi de candidature reçu en push puis ouvert ; mandat retiré ; décision de page ouverte par un signataire puis par un ancien signataire ; renvoi Mes achats ; téléphone et bureau, FR/EN, clavier et lecteur d'écran. |
| Dépendances | Codegen (références `api.modules.notifications.*`, nouveaux champs `target`), `verify` ; configuration push existante (`NOTIFICATION_APPLICATIONS_JSON`, fournisseurs) ; mandats de contact P10 réels pour l'équipe. |
| Retour arrière | Retirer les appels `notice*` de `serviceFlow.ts` et `jobApplicationTransport.ts` : plus aucun avis commerce n'est écrit ; les lignes existantes cessent d'être présentées dès que la garde ne trouve plus leur objet. `target` est un champ additionnel : l'ignorer rend l'ancien comportement. Aucune donnée à migrer ni supprimer. |
| Limites | Voir « Limites ». |

## Décisions

1. **Genres hors du domaine commun.** `@antsia/social-domain/commerceNotifications` porte la liste
   fermée `COMMERCE_NOTIFICATION_KINDS` (préfixe `commerce_`, aucun nom commun avec DIASPORALE), le
   public de chaque genre (`client`, `team`, `candidate`) et la règle pure des observations. Comme pour
   DIASPORALE, `NOTIFICATION_KINDS` n'est pas touché : les enregistrements exhaustifs existants et
   l'application DIASPORALE ne changent pas ; une cloche qui ignore ces genres dit « nouvelle activité ».

   | Genre | Public | Moment (état confirmé) |
   |---|---|---|
   | `commerce_service_quote_received` / `_quote_revised` | client | liste des devis servie (`quote.list`), version courante transmise ; acceptation à reconfirmer (`reconfirm_required`) |
   | `commerce_service_booking_confirmed` | client | relecture : `requested` → `confirmed`, ou remplacement en attente devenu le rendez-vous tenu |
   | `commerce_service_booking_declined` | client | relecture : `requested` → `cancelled_by_pro` (`professional`), ou remplacement refusé (`change_declined`) ; **une expiration n'est pas un refus** |
   | `commerce_service_booking_rescheduled` | client | relecture : même rendez-vous ouvert, révision supérieure, nouvel horaire |
   | `commerce_service_booking_cancelled` | client | relecture : `confirmed` → `cancelled_by_pro` (`professional`) |
   | `commerce_service_order_accepted` / `_order_declined` | client | consultation de la commande (`current`) : `pending` → accepté, ou → `cancelled` |
   | `commerce_service_quote_accepted` | équipe | réponse `quote.accept` acceptée (preuve `acceptedAt`) |
   | `commerce_service_booking_held` | équipe | réponse `booking.request` acceptée (créneau retenu) |
   | `commerce_service_booking_client_changed` | équipe | réponse de changement acceptée (échange ou remplacement) |
   | `commerce_service_booking_client_cancelled` | équipe | réponse d'annulation acceptée |
   | `commerce_job_application_updated` | candidat | suivi P15 : état autorisé **visible** changé (`commerceJobsCandidateState`), révision plus récente |

2. **Porte unique.** `notify.ts` : branche `notifyCommerceRecipient` en tête de `notifyPerson` (après
   DIASPORALE). Jamais d'acteur ; jamais l'auteur du geste ni à travers un blocage (`sourcePersonId`) ;
   garde `commerceNoticeAdmission` (droit actuel + état écrit + **transition qui désigne exactement**
   la référence/révision de la ligne relue) ; clé `genre|sujet:transition|-` (une transition ne
   s'annonce qu'une fois, un rejeu ne rouvre rien). Aucune écriture hors de `notify.ts`.
3. **Destinataires.** Client : SA demande, dans CE réseau, non retirée, adhésion `declaree`, personne
   vivante. Équipe habilitée : mandataires P10 **vivants** (`liveMandate` : mandat accepté, non révoqué,
   lecture, signataire vivant, membre vivant), au plus `COMMERCIAL_TEAM_MAX`, jamais le client, jamais à
   travers un blocage, plus rien quand le client s'efface. Candidat : SA candidature, adhésion active.
4. **Observé par le destinataire lui-même.** PRO.GA ne pousse aucun état de service vers ANTSIA et le
   contrat SERVICE-CONTROL exige une preuve de session de cinq minutes : toute observation P14 a lieu
   dans la session du client. Ses avis s'écrivent donc en **trace déjà lue, sans transport** (il voit
   l'état à l'écran ; la clé empêche qu'un futur chemin asynchrone le redise). L'équipe et le candidat
   (suivi P15 fait par la file serveur) reçoivent un avis non lu, transporté.
5. **Préférences, consentement, budget, catégorie.** Rien de neuf : `pushAllowed` relit visibilité,
   consentement `notifications`, budget hebdomadaire et catégorie ; catégorie existante **« messages »**
   (comme le contact commercial P10 : aucune catégorie nouvelle, les préférences sont des objets fermés).
   `pushAllowed` lit désormais la catégorie par `notificationRowCategory` (identique pour les genres communs).
6. **Visibilité.** `notificationStillVisible` (cloche, file, digest, ouverture) appelle
   `commerceNoticeVisible` ; la cloche ne présente plus et ne compte plus un avis dont l'objet ne se lit
   plus (mandat retiré, demande purgée, effacement).
7. **Destination typée** (`targets.ts`, `NotificationOpenTarget` du domaine) : `serviceRequest`
   (`requestRowId` → `/mes-demandes/[requestId]`), `jobApplication` (→ fiche `/mes-candidatures/[id]`,
   qui renvoie à Mes candidatures), `commercialThread` (devis accepté, conversation que l'équipe lit déjà,
   `canReadCommercialThread` relu) ; aucune destination ANTSIA pour les avis de rendez-vous de l'équipe
   (l'agenda est chez PRO.GA) : centre des notifications. Rendue dans la cloche (`target`) et par
   `resolveOpenTarget` ; l'application la compose sur ses routes (`EngineRoutes` : `serviceRequest`,
   `jobApplication`, `pageModerationDecisions`, `personalDecisions`, facultatives).
8. **Décision de modération d'une page (ajout du coordinateur).** `moderationDecisionPage` : dossier sans
   propriétaire personnel, page porteuse dans le réseau de l'avis, lecteur **signataire vivant** à
   l'instant. Cloche : `page` = carte publique (identifiant, adresse, nom, logo, badge calculé ; ni motif,
   ni contenu, ni modérateur), phrase « … concerne la page X » ; sinon `page: null` comme avant. Ouverture :
   `pageModerationDecisions` (→ section de la page dans Mes données, ancre `#decisions-page-…` portée par
   `page-moderation-decisions.tsx`), sa propre décision → `personalDecisions` (Mes données), ancien
   signataire → `null` (repli neutre, la garde `moderationNoticeRecipient` refuse déjà).
9. **Mes achats.** `ServiceRequestsNotice` : section séparée « Prestations sans paiement en ligne » et
   lien vers Mes demandes ; aucune ligne de service mêlée aux achats payés, aucun état de paiement simulé,
   aucune requête de services ajoutée à la liste.

## Contrat de sujet à transmettre à la session DIASPORALE

`modules/notifications/open:resolveOpenTarget` (porte d'ouverture d'un push, `networkQuery`) rend
désormais, pour un avis, `{ channel: "notification", kind, subject, actorHandle, target }`. Pour les
**13 genres de mise en relation** (`subject` reste `null`) :

```ts
target: {
  kind: "diasporaServiceNotice",
  audience: "requester" | "provider" | "responsible" | "member", // = SERVICE_NOTICE_AUDIENCES
  subjectKind: "serviceRequest" | "associationMembership" | "serviceReview",
  subjectId: string,          // Id du moteur (serviceRequests | associationMemberships | serviceReviews), opaque
  requestId: string | null,   // serviceNoticeView().requestId
  pageHandle: string | null,  // serviceNoticeView().pageHandle (page encore lisible par CE lecteur)
} | null
```

- Relecture à l'ouverture : session et adhésion (`networkQuery`), job du destinataire dans CE réseau,
  `notificationStillVisible` → `serviceNoticeVisible`, puis `serviceNoticeView` (mêmes droits) ; sinon le
  résultat entier est `null` (repli neutre). Aucune URL, aucun contenu, aucun nom.
- Correspondance suggérée côté DIASPORALE : `requester` + `requestId` → la demande du demandeur ;
  `provider` + `requestId` (+ `pageHandle`) → les demandes reçues de la page ; `responsible` + `pageHandle`
  → les adhésions à traiter ; `member` + `pageHandle` → la page de l'association ;
  `service_review_replied` (requester) → l'avis ou la demande ; `null` → centre des notifications.
- `moderation_decision` : `target` = `{ kind: "pageModerationDecisions", pageId, pageHandle }` (signataire
  vivant), `{ kind: "personalDecisions" }` (sa décision), ou `null` ; la cloche porte `page` (carte) dans
  le même cas.
- Types : `NotificationOpenTarget`, `DIASPORA_NOTICE_AUDIENCES`, `DIASPORA_NOTICE_SUBJECT_KINDS` dans
  `@antsia/social-domain/notificationOpenTarget`, ou le type de retour de l'API. Rien n'a été écrit dans
  `../DIASPORALE` ni dans `convex/modules/diaspora/**` (lecture seule de `serviceNoticeView`).

## Fichiers

Créés :
`packages/social-domain/src/{commerceNotifications.ts,commerceNotifications.test.ts,notificationOpenTarget.ts}` ;
`convex/modules/notifications/{commerceAccess.ts,commerceEmit.ts,targets.ts,targets.test.ts}` ;
`apps/antsia_ga/src/app/(membre)/mes-candidatures/[applicationId]/page.tsx` ;
`apps/antsia_ga/src/components/jobs/{my-application-screen.tsx,my-application-screen.test.tsx}` ;
`apps/antsia_ga/src/components/purchases/service-requests-notice.tsx` ;
`apps/antsia_ga/src/lib/notification-destinations.test.ts` ; ce rapport.

Modifiés par ancres uniques relues juste avant :
`convex/modules/notifications/{tables,notify,policy,bell,open,open.test}.ts` (ajouts DIASPORALE, P16 et
CC-2b préservés) ; `convex/modules/shops/{serviceFlow,jobApplicationTransport,services.test,jobApplications.test}.ts` ;
`packages/api/src/network.tsx` (`EngineRoutes`, quatre adresses facultatives) ;
`packages/social-features/src/features/notifications/{notification-targets,notification-targets.test}.ts` ;
`packages/social-features/src/i18n/locales/{fr,en}/notifications.json` ;
`apps/antsia_ga/src/lib/routes.ts` (`jobApplication`, `pageModerationDecisions`, `pageDecisionsAnchor`,
`engineRoutes`, `memberDestinationFor`) ; `apps/antsia_ga/src/components/{notification-open-screen,notification-open-screen.test,page-moderation-decisions}.tsx` ;
`apps/antsia_ga/src/components/purchases/{purchases-screen,purchases-screen.test}.tsx` ;
`apps/antsia_ga/src/i18n/locales/{fr,en}/{jobs,purchases}.json`.

Non touchés : `package.json`, `bun.lock`, `_generated`, `.env*`, primitives UI, pont de session,
`convex/modules/diaspora/**`, `../DIASPORALE`, contrats jumeaux et manifeste P06, `EXECUTION.md`.

## Tests écrits (non exécutés)

- Bon destinataire et bonne transition : créneau retenu → équipe seule ; confirmation → client (trace
  lue, sans job, cible `serviceRequest`), relue deux fois → un seul avis ; refus ≠ expiration ;
  annulation du client → équipe ; devis accepté → équipe, cible conversation ; devis révisé → client ;
  candidature `interview` → candidat, même état relu → rien ; règles pures de toutes les transitions.
- Aucun contenu ni montant : ni besoin, note, nom de boutique, prestation, devise, montant, poste,
  employeur, nom civil ni état dans les lignes et jobs (clés : références et révisions seules).
- Droit perdu : mandat retiré → absent de la cloche et ouverture `null` ; ancien signataire → ni carte ni
  ouverture. Session d'une autre personne → `null` (équipe, candidat, décision de page).
- Préférences : catégorie Messages coupée ou budget hebdomadaire nul → aucun job, l'avis reste en cloche.
- Renvoi Mes achats → Mes demandes : section distincte, sans état de paiement, sans lecture de demandes.
- Écrans : destinations typées de la porte d'ouverture, fiche de candidature (refus neutre, retrait),
  routes et injection `engineRoutes`, phrases FR/EN de chaque genre.

## Limites

- **Rien n'a été exécuté** ; des erreurs de type ou de compilation restent possibles (références d'API
  à régénérer, notamment `target` et les nouveaux champs de la cloche).
- **Avis client P14 = traces lues** : sans canal asynchrone (événement PRO.GA → inbox signée, ou suivi de
  fond conforme au contrat), le client apprend toujours l'état en relisant « Mes demandes ». Les avis
  existent, se dédoublonnent et s'ouvrent ; ils ne réveillent personne. Décision à prendre avec PRO.GA.
  L'expiration d'un créneau retenu n'a pas d'avis (pas dans la liste demandée).
- Les avis de rendez-vous de l'équipe n'ont pas de destination ANTSIA (agenda PRO.GA) : centre des
  notifications. Le suivi P15 garde le défaut relevé par P16 (`authVerifiedAt: now` de fond).
- Un avis d'équipe garde, jusqu'à sa rétention, une référence opaque à la demande d'un client effacé ;
  il n'est plus présenté (garde) mais n'est pas supprimé à l'effacement du client.
- Arbre partagé : la session CC-2b (conversation contextuelle) modifiait au même moment `tables.ts`,
  `notify.ts`, `policy.ts`, `bell.ts` ; nos ajouts ont été relus et sont intacts. Elle a ajouté
  `contextual_message`, `contextual_closed` et le sujet `contextualThread` au domaine commun :
  `notification-targets.ts` (enregistrement exhaustif des phrases, `switch` exhaustif des sujets) devra
  les couvrir de son côté.
- Section « Décisions visant mes pages » : pages du réseau racine seulement (limite P16) ; l'ancre ne
  défile qu'une fois les pages chargées.
