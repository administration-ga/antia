# PRO-COMMERCE-COMMAND-V1 — actions privées ANTSIA → PRO.GA

Statut : **contrat spécifié et validateurs purs testés, lot P06, 18 octobre 2026.**
Au bilan P06, aucun endpoint, transport, magasin d'idempotence ni handler n'existait.
P08 ajoute ces sources pour `link.confirm` et `request.status`, avec une préparation
[LINK distincte](PRO-COMMERCE-LINK-V1.md). Les autres commandes restent indisponibles.
Génération, contrôles, configuration et recette de cette reprise sont différés :
la présence du code ne prouve aucun échange réel. Contrat jumeau :
[PRO-COMMERCE-PUBLIC-V1](PRO-COMMERCE-PUBLIC-V1.md) (forme canonique, références,
prix et bornes communes y sont définis). Pendant PRO.GA :
`PRO_GA/docs/18_CONTRATS_COMMERCE_ANTSIA.md`. Implémentation normative jumelle :
`commerce/command.ts` et `commerce/lifecycle.ts` (manifeste révision 1).

## 1. Rôle et frontière

Le **serveur** ANTSIA (jamais le navigateur, jamais un client Convex croisé)
demande à PRO.GA, autorité, d'agir : lier une activité, enregistrer un brouillon
d'offre, transmettre une demande, accepter un devis, préparer un panier, démarrer
un paiement, demander une annulation, demander un rendez-vous, déposer une
candidature, consulter l'état d'une demande. PRO.GA rejuge tout à destination et
rend une réponse déterministe. Ces données privées ne passent jamais par l'inbox de
reflets publics.

## 2. Identités, autorités et correspondances

| Notion | Autorité | Représentation dans le contrat | Règle |
|---|---|---|---|
| Personne, handle, adhésion, réseau ANTSIA | ANTSIA | **Jamais transmis.** Sujet opaque `antsia:sub:<26-64 [0-9a-z]>` | Ni `personId`, ni handle, ni e-mail, ni téléphone (refusés à toute profondeur) |
| Sujet acheteur / candidat | ANTSIA le frappe | Un sujet **par couple** (personne, réseau, structure, rôle) : `buyer`, `candidate` | Aucune corrélation entre boutiques ni entre achat et candidature ; non dérivable d'un identifiant ou d'un contact ; jamais réattribué |
| Opérateur vendeur | ANTSIA le frappe | `seller_operator`, un sujet par (personne, réseau) pour PRO.GA | Lié à la liaison à sa confirmation ; seul sujet admis pour les commandes vendeur |
| Réseau | ANTSIA | Jamais transmis ; PRO.GA lie chaque **source** (`source`, résolue depuis la clé) à un réseau dans sa configuration | Une liaison appartient à la source qui l'a créée ; une autre source y est refusée indistinctement |
| Page / boutique ANTSIA | ANTSIA | `antsia:shop:…` opaque, dans `link.confirm` seulement | Jamais l'identifiant Convex de la page |
| Structure, tenant, établissement PRO.GA | PRO.GA | `shopRef` = `pro.ga:structure:…` ; établissement `pro.ga:establishment:…` | **Le tenant n'est jamais transmis** : PRO.GA le résout depuis la liaison et rejuge tenant ET structure |
| Mandat | PRO.GA | Aucun champ : relu à chaque commande vendeur (affiliation active, tâche requise, module effectif) | Une signature machine ne confère aucun droit de la structure |
| Liaison | PRO.GA (preuve), ANTSIA (rattachement à la page) | `pro.ga:commerce_link:…` | Double preuve seulement (§3) |
| Consentement | La personne, par un geste | `consent: {purpose, textVersion, givenAt}` par commande engageante | Finalité fermée par commande ; horodaté, au plus `issuedAt` |
| Badges ANTSIA (Officiel, Vérifié…), vérification IDN | ANTSIA | **N'entrent dans aucune décision commerciale** | Ni mandat, ni capacité d'encaisser, ni fusion de comptes |

**Aucune fusion de comptes** par e-mail, téléphone, handle, nom ou badge :
`commerceLinkEvidenceAdmissible` n'admet que `double_proof_pkce` (testé contre
`email_match`, `phone_match`, `handle_match`, `badge`, `name_match`). Aucun profil,
adhésion, tenant ni structure n'est créé en arrière-plan.

## 3. Liaison à double preuve

1. Un membre ANTSIA authentifié, administrateur de la page, demande la liaison. Le
   serveur ANTSIA crée un défi à usage unique et à durée courte, lié au réseau, à
   la session et à une URI de retour en liste blanche, et un vérificateur PKCE
   (RFC 7636, S256) qu'il garde.
2. La personne s'authentifie **réellement** dans PRO.GA, choisit une structure où
   son mandat permet le partage commercial, voit les permissions demandées et
   consent. PRO.GA émet un code court opaque (`linkCode`), lié au défi et à la
   source ; aucun jeton réutilisable dans l'URL.
3. Le serveur ANTSIA envoie `link.confirm` (code + vérificateur + `antsiaShopRef`
   + permissions + consentement). PRO.GA vérifie le défi, le vérificateur, la
   source, le mandat **à cet instant**, crée la liaison et rend `linkRef`,
   `shopRef` et les permissions accordées (jamais plus que demandées).

Permissions (distinctes des scopes machine) : `catalog_drafts`,
`publish_catalog`, `publish_jobs`, `receive_applications`, `receive_bookings`,
`receive_inquiries`, `receive_orders`. Cycle : `pending → active | refused |
expired` ; `active → suspended | revoked` ; `suspended → active | revoked`. Perte
de mandat : suspension ou révocation côté PRO.GA, `shop.withdrawn` si la
publication cesse. Révocation demandée depuis ANTSIA : nom réservé `link.revoke`
(§6.10) ; en V1, ANTSIA cesse localement toute commande vendeur et retire la
vitrine commerciale.

## 4. Transport et profil de signature COMMAND

- Endpoint ajouté dans les **sources P08**, sur l'origine HTTP Convex de PRO.GA, configurée par
  le propriétaire (aucune URL dans le code) ; proposition : `POST
  /commerce/v1/commands`, consultations comprises.
- Corps : JSON canonique (même forme que le contrat PUBLIC), 64 Kio au plus pour
  une demande, 128 Kio pour une réponse. Le serveur ANTSIA **persiste les octets
  exacts** de chaque demande jusqu'à résolution de son statut.
- **Profil `pro-ga-commerce-command-hmac/v1`** : même construction que
  `pro-ga-machine-hmac/v1` de PRO.GA (composants `longueur:valeur` joints par `|`,
  HMAC-SHA256, signature base64url sans remplissage, 43 caractères), étiquette
  propre et **sans composant tenant**. Composants, dans l'ordre : étiquette,
  `X-Pro-Key-Id` (8-128 `[A-Za-z0-9._:-]`), horodatage d'émission en
  **millisecondes Unix décimales** (`X-Pro-Timestamp`), `X-Pro-Nonce`
  (24-128 `[A-Za-z0-9_-]`), source (`[a-z][a-z0-9-]{1,63}`), environnement,
  audience `pro.ga.commerce`, scope de l'opération, SHA-256 hexadécimal des octets
  exacts du corps. Signature dans `X-Pro-Signature`. `commerceCommandSigningInput`
  construit cette chaîne et rend `null` pour tout composant hors grammaire.
- **Clés** : une clé par source et par environnement, distincte de toute clé de
  l'inbox publique et de toute clé `federation.*` ; désignée par son identifiant,
  résolue côté serveur dans le coffre PRO.GA ; rotation par nouvel identifiant.
- **Anti-rejeu** : couple (clé, nonce) conservé au moins dix minutes
  (`proIntegrationNonces`) ; fenêtre ± 5 minutes sur `X-Pro-Timestamp`. Une
  reprise après délai renvoie les **mêmes octets de corps** avec un horodatage,
  un nonce et une signature neufs.
- **Environnement** explicite côté PRO.GA ; absent ou différent : refus.
- **Scope** : `commerce.<opération>`, déduit de `command` par la destination ;
  le scope du corps doit lui être égal (`scope_mismatch`) ; les scopes annoncés
  ne sont jamais crus, ceux de la source sont résolus depuis la clé. Ces scopes
  sont **à ajouter** à `MACHINE_SCOPES` (P08 ; constat tenu par un test PRO.GA).
- Ordre à destination : en-têtes et clé → source ; octets bornés et SHA-256 ;
  lecture de `command` (opération inconnue : `401`) ; HMAC (échec : `401`
  uniforme, sans détail) ; `parseCommerceCommandRequest` (échec : `400` avec la
  raison, la source étant authentifiée) ; `decideCommerceCommandReplay` ;
  revalidation métier ; effet et enregistrement de la réponse dans la même
  transaction (ou bail `in_progress` pour une opération qui appelle un prestataire).

## 5. Enveloppe de demande

```json
{"command":"checkout.prepare","contract":"PRO-COMMERCE-COMMAND-V1","environment":"sandbox","expiresAt":1792285499000,"issuedAt":1792285199000,"payload":{"…":"…"},"requestId":"antsia-req-000006","scope":"commerce.checkout.prepare","source":"antsia","subject":{"authVerifiedAt":1792285140000,"kind":"buyer","ref":"antsia:sub:b0000000000000000000000001"},"version":1}
```

Onze clés exactement (`networkId` ou toute autre clé : `invalid_request`).
`requestId` : 8 à 200 caractères opaques, **clé d'idempotence** avec la source et
l'environnement, frappée une fois par intention de l'utilisateur. `issuedAt` /
`expiresAt` : millisecondes, validité ≤ 10 minutes, `issuedAt` au plus cinq minutes
dans le futur du récepteur ; l'expiration est jugée par la décision de rejeu, pas
par l'analyse (une demande déjà traitée se rejoue même expirée).
`subject.authVerifiedAt` : instant où le serveur ANTSIA a revérifié la **session
vivante** du sujet, au plus cinq minutes avant `issuedAt` (`invalid_time`).
`subject.kind` : sujets admis par opération (`subject_not_allowed`).

Raisons d'analyse : `invalid_body`, `body_too_large`, `not_canonical`,
`invalid_request`, `unknown_command`, `unsupported_command`, `source_mismatch`,
`environment_mismatch`, `scope_mismatch`, `invalid_time`, `subject_not_allowed`,
`too_complex`, `forbidden_field`, `invalid_payload`, `invalid_reference`,
`invalid_revision`, `invalid_text`, `invalid_amount`, `currency_mismatch`,
`amount_incoherent`, `duplicate_entry`, `invalid_name`. Ordre : octets →
enveloppe → commande → identifiant → source → environnement → scope → fenêtre →
sujet → parcours borné de la charge → champs par ordre alphabétique de clé →
règles croisées. Clés interdites dans la charge, à toute profondeur : liste de
l'inbox plus `cardNumber`, `contactEmail`, `contactPhone`, `cookie`, `cvv`,
`fullName`, `iban`, `idToken`, `msisdn`, `nationalId`, `pan`, `sku`,
`structureBusinessRef`, `structureId`, `tenantBusinessRef`, `tenantId`, `token`,
`url`, `userId`.

## 6. Opérations

Toute opération revalide à destination : source → réseau, liaison active (et
appartenant à cette source), structure vivante et non suspendue, capacité ou
permission requise, mandat pour les commandes vendeur, propriété du sujet pour les
objets existants, état et révision attendus, limites de débit. Refus métier
fermés par opération ; `access_denied` est **indistinct** (objet inconnu, autre
source, autre sujet, mandat absent), comme `ERR_PRO_ACCESS_DENIED`.

| Opération | Sujet | Exige à destination | Effet PRO.GA visé (lot) |
|---|---|---|---|
| `link.confirm` | `seller_operator` | défi + PKCE valides, mandat de partage | liaison (P08) |
| `catalog.draft.save` | `seller_operator` | permission `catalog_drafts`, tâche d'édition d'offre | brouillon d'offre, jamais une publication (P09) |
| `inquiry.submit` | `buyer` | `receive_inquiries`, boutique publiée, quotas | demande + prospect de provenance ANTSIA si consenti (P10) |
| `quote.accept` | `buyer` | devis envoyé à CE sujet, version et total exacts | acceptation authentifiée du client (P14) |
| `checkout.prepare` | `buyer` | capacité `checkout`, `receive_orders`, structure vérifiée | relecture prix/stock, réservation atomique (P11) |
| `payment.start` | `buyer` | panier tenu, total exact, prestataire admis | commande `pending` + intention de paiement (P12) |
| `order.cancel.request` | `buyer` | commande de CE sujet, révision attendue | annulation ou revue, remboursement demandé (P11-P12) |
| `booking.request` | `buyer` | `receive_bookings`, prestation et créneau publics | rendez-vous `requested`/`confirmed` (P14) |
| `application.submit` | `candidate` | `receive_applications`, poste publié | candidature privée (P15) |
| `request.status` | le sujet de la demande visée | même source ET même sujet, sinon `unknown` | aucune écriture |

### 6.1 `link.confirm`
Charge : `antsiaShopRef`, `codeVerifier` (PKCE, 43-128 non réservés), `consent`
(`commerce_link`), `linkCode` (32-128 `[A-Za-z0-9_-]`), `requestedPermissions`
(ensemble trié, non vide). Résultat : `linkRef`, `shopRef`, `linkedAt`,
`grantedPermissions` ⊆ demandées, `state: "active"`. Refus : `access_denied`,
`consent_invalid`, `link_code_invalid` (code inconnu, expiré, utilisé ou
vérificateur faux, sans distinction), `quota_exceeded`, `request_expired`.

### 6.2 `catalog.draft.save`
Charge : `linkRef`, `draft` (`kind`, `title`, `description`, `price` selon
PUBLIC §5.3, `tags`, `collectionRefs`, `zone?`, `leadTimeDays?`), et, pour une mise
à jour, `offerRef` **et** `expectedDraftRevision` (concurrence optimiste ; l'un
sans l'autre : `invalid_payload`). V1 : ni variante ni média (gérés dans PRO.GA).
Résultat : `offerRef`, `draftRevision` (> attendue), `status` `draft` ou
`pending_review`. Jamais de publication : elle reste un acte humain dans PRO.GA.
Refus : `access_denied`, `capability_disabled`, `not_editable`, `quota_exceeded`,
`request_expired`, `stale_revision`.

### 6.3 `inquiry.submit`
Charge : `shopRef`, `kind` (`question`, `quote_request`, `availability`),
`message` (1-2 000), `consent` (`commerce_inquiry`, vaut transfert vers le
CRM de la structure), `offerRef?`, `variantRef?` (exige `offerRef`), `quantity?`,
`desiredDate?`, `displayName?` (nom social libre, jamais découpé),
`conversationRef?` (`antsia:conv:…`, la conversation commerciale ANTSIA). Le canal
de réponse est la conversation ANTSIA : aucun e-mail ni téléphone. Déduplication
par **demande et structure**, jamais par contact. Résultat : `inquiryRef`,
`state: "submitted"`, `submittedAt`. Refus : `access_denied`,
`capability_disabled`, `consent_invalid`, `offer_unavailable`, `quota_exceeded`,
`request_expired`.

### 6.4 `quote.accept`
Charge : `shopRef`, `quoteRef`, `quoteVersion`, `acceptedTotal` (XAF > 0),
`consent` (`commerce_quote_acceptance`). L'acceptation porte sur la version et le
total EXACTS présentés au client ; la marque « accepté » d'un employé n'en tient pas
lieu. Résultat `accepted` : `acceptedAt`, `orderRef?`, `quoteRef`, `quoteVersion`,
`state`. Résultat `reconfirm_required` : `currentVersion`, `currentTotal`
(différents de la demande). Refus : `access_denied`, `consent_invalid`,
`quote_not_acceptable` (expiré, retiré, refusé, autre destinataire),
`request_expired`.

### 6.5 `checkout.prepare`
Charge : `shopRef` (un seul vendeur, une seule devise), `lines` (1-50,
`{offerRef, variantRef?, quantity (1-999), expectedUnitAmount, expectedCatalogRevision}`,
uniques par offre et variante), `fulfillment` (`{mode: "pickup", establishmentRef}`
ou `{mode: "seller_delivery", address: {country: "GA", line1, line2?, locality},
instructions?}`), `note?`, `consent` (`commerce_checkout`). Les données de remise
sont saisies et consenties à ce moment, jamais exportées d'un profil. PRO.GA relit
vendeur, prix, variantes, stock ; réserve atomiquement ; ne convertit aucune devise.

Résultat (`accepted` ou `reconfirm_required`) : `checkoutRef`, `state: "held"`,
`expiresAt` (> réponse), `lines` (libellé figé, `unitAmount`, `quantity`,
`lineAmount`, `catalogRevision`), `fees` (0-5, `delivery`, `packaging`,
`service`, libellé, montant), `total`. Contrôles côté ANTSIA : `lineAmount =
unitAmount × quantity`, `total = Σ lignes + Σ frais` (`total_mismatch`) ; lignes
dans l'ordre et pour les mêmes offres/variantes ; quantité jamais supérieure à la
demande ; `accepted` ⟹ aucun écart ; `reconfirm_required` ⟹ `changes` liste
exactement les écarts (`catalog_revision`, `quantity`, `unit_amount`)
(`correlation_mismatch`). L'acheteur voit l'ancien et le nouveau récapitulatif ;
`payment.start` sur le nouveau total vaut reconfirmation. Refus :
`access_denied`, `capability_disabled`, `consent_invalid`, `not_purchasable`
(sur devis, fourchette sans variante), `offer_unavailable`, `out_of_stock`,
`quota_exceeded`, `request_expired`.

### 6.6 `payment.start`
Charge : `shopRef`, `checkoutRef`, `expectedTotal` (XAF > 0, = total du panier),
`consent` (`commerce_payment`). Résultat : `paymentRef`, `orderRef`,
`checkoutRef`, `amount` (= attendu), `state` `pending`, `requires_action` ou
`processing` — **jamais `succeeded`** — et `action` :
`{kind: "provider_redirect", url}` (HTTPS sans identifiants ni fragment ; hôte
rejugé par ANTSIA contre sa liste blanche ; exige `requires_action`),
`{kind: "await_provider_confirmation"}` (confirmation sur l'appareil de
l'acheteur) ou `{kind: "none"}` (jamais avec `requires_action`). Le succès n'existe
qu'en état privé `succeeded` servi par PRO.GA après preuve serveur (rappel
authentifié ou consultation du prestataire), jamais d'après un retour navigateur.
Refus : `access_denied`, `capability_disabled`, `checkout_expired`,
`consent_invalid`, `payment_in_progress` (une tentative ouverte existe : la
consulter), `request_expired`, `total_mismatch`.

### 6.7 `order.cancel.request`
Charge : `shopRef`, `orderRef`, `expectedOrderRevision`, `reason`
(`changed_mind`, `delay`, `other`, `wrong_item`), `note?`. Résultat :
`cancellation` (`accepted` ⟹ `orderState: "cancelled"`, ou `pending_review`),
`orderRevision` (> attendue), `orderState`, `refund` (`none`, `requested`).
Refus : `access_denied`, `not_cancellable`, `request_expired`, `stale_revision`.

### 6.8 `booking.request`
Charge : `shopRef`, `serviceRef`, `resourceRef?`, `offerRef?`, `slot`
(`startAt` futur, `endAt`, durée ≤ 480 min, `timeZone: "Africa/Libreville"` en V1),
`note?`, `displayName?`, `consent` (`commerce_booking`). Résultat :
`appointmentRef`, `startAt`/`endAt`/`timeZone` (= demande), `state` `requested`
(avec `holdExpiresAt`, et seulement lui) ou `confirmed`. Deux demandes
incompatibles n'obtiennent jamais deux confirmations. Confirmation du rendez-vous
et paiement d'un acompte restent séparés. Refus : `access_denied`,
`capability_disabled`, `consent_invalid`, `quota_exceeded`, `request_expired`,
`slot_unavailable`.

### 6.9 `application.submit`
Charge : `shopRef`, `jobRef`, `civilName` `{firstName, lastName}` en **forme
normale** (NOM(S) en capitales, chaque Prénom capitalisé, accents, apostrophes et
tirets conservés ; normaliseur partagé ANTSIA `civilName.ts`, copié à l'identique
dans le contrat ; sinon `invalid_name`, jamais de correction), `motivation?`,
`attachments` (0-3 `{attachmentRef: "antsia:file:…", sha256, byteSize ≤ 5 Mio,
mimeType: "application/pdf", kind}`), `consent` (`commerce_application`). Les
octets des pièces passent par la garde des fichiers, jamais dans le corps (P15).
Le candidat ne paie rien. Résultat : `applicationRef`, `state: "received"`,
`submittedAt`. Refus : `access_denied`, `already_applied`,
`capability_disabled`, `consent_invalid`, `job_closed`, `quota_exceeded`,
`request_expired`.

### 6.10 Consultation `request.status` et noms réservés
Charge : `targetCommand`, `targetRequestId`, `targetRequestSha256`. Sans effet,
non enregistrée (une nouvelle consultation peut rendre un état plus frais).
Résultat : `targetRequestId`, `state` (`unknown`, `in_progress`, `completed`),
`recordedResponse` + `recordedResponseSha256` (octets exacts de la réponse
enregistrée, si et seulement si `completed`), `current` (0-4 états privés
`{objectKind, objectRef, revision, state, updatedAt}` des objets nés de la
demande). `unknown` ne révèle rien (et couvre « autre source » ou « autre
sujet »).

Noms réservés, refusés `unsupported_command` en V1 : `application.withdraw`,
`booking.cancel`, `catalog.publish.request`, `inquiry.withdraw`, `link.revoke`,
`subject.erasure.request`.

## 7. Réponses

```json
{"command":"checkout.prepare","contract":"PRO-COMMERCE-COMMAND-V1","outcome":"accepted","requestId":"antsia-req-000006","requestSha256":"…","respondedAt":1792285200000,"result":{"…":"…"},"version":1}
```

| `outcome` | HTTP | Contenu | Enregistrée et rejouée |
|---|---|---|---|
| `accepted` | 200 | `result` | oui |
| `reconfirm_required` | 200 | `result` (seulement `quote.accept`, `checkout.prepare`) | oui |
| `rejected` | 422 | `reason` de la liste de l'opération | oui (sauf `request_expired`, calculé) |
| `conflict` | 409 | `reason: "idempotency_conflict"` | non : calculée |
| `in_progress` | 202 | `reason: "in_progress"`, `retryAfterMs?` | non |
| `unavailable` | 503 | `provider_unavailable`, `rate_limited`, `temporarily_unavailable`, `retryAfterMs?` (1 s-1 h) | non : réessayer les mêmes octets |

`401 {"outcome":"unauthorized"}` et `400 {"outcome":"invalid_request","reason":…}`
sont des réponses de transport, hors enveloppe. Une réponse rejouée est **la même
suite d'octets** que la première (en-tête de transport signalant le rejeu,
proposition `X-Pro-Commerce-Replayed: 1`). ANTSIA valide chaque réponse par
`parseCommerceCommandResponse` : corrélation exacte (`command`, `requestId`,
`requestSha256` de SES octets), `respondedAt` plausible, issue fermée, résultat
fermé et cohérent avec la demande. V1 : réponses non signées ; authenticité par
TLS vers l'origine configurée et corrélation à l'empreinte de la demande.

## 8. Idempotence, rejeu et délai réseau

Clé : (source, environnement, `requestId`) ; empreinte : SHA-256 des octets exacts
(canoniques). Décision pure `decideCommerceCommandReplay`, **avant tout effet** :

| Enregistrement | Demande | Décision |
|---|---|---|
| aucun | non expirée | `execute` |
| aucun | expirée | `expired` (refus `request_expired`, rien n'est exécuté) |
| terminé, même empreinte | quelconque, même expirée | `replay` : mêmes octets de réponse |
| terminé ou en cours, autre empreinte | — | `conflict` |
| en cours, même empreinte | — | `in_progress` |

L'enregistrement vit **au moins jusqu'à `expiresAt` + 5 minutes** : après sa
purge, une répétition est refusée comme expirée, jamais réexécutée. Une opération
qui appelle un prestataire tient un bail `in_progress` ; à son échéance PRO.GA
réconcilie avec le prestataire, il ne réexécute pas à l'aveugle.

Après un délai réseau, ANTSIA ne frappe **jamais** un nouvel identifiant pour la
même intention : il consulte `request.status`, puis
`decideCommerceRetryAfterTimeout` : `completed` → utiliser la réponse
enregistrée ; `in_progress` → attendre ; `unknown` tant que `now ≤ expiresAt + 5
min` → renvoyer les mêmes octets ; au-delà → `safe_to_restart` (nouvelle demande
après reconfirmation de la personne). Nouvelle tentative de paiement pour un même
panier (`commerceCanStartNewPayment`) : seulement après `failed`, `cancelled` ou
`safe_to_restart` ; jamais pendant `pending`, `requires_action`, `processing`, ni
après `succeeded`. Résultat attendu : aucun double débit, aucune double commande.

## 9. Machines d'état, capacités et cohérences

Machines (`lifecycle.ts`, transitions testées ; « = PRO.GA » : test de parité
PRO.GA) ; une mise à jour sans changement d'état n'est pas une transition :

| Machine | États et transitions |
|---|---|
| Liaison | `pending → active, refused, expired` ; `active → suspended, revoked` ; `suspended → active, revoked` |
| Publication (miroir) | `absent → published, withdrawn, closed` ; `published → withdrawn, closed` ; `withdrawn → published, closed` ; `closed` terminal |
| Demande | `submitted → acknowledged, declined, withdrawn, closed` ; `acknowledged → quoted, closed, withdrawn` ; `quoted → closed` (prospect PRO.GA : `new`↔`submitted`, `qualified`↔`acknowledged`, `proposal`↔`quoted`, `won`/`lost`↔`closed`/`declined`) |
| Réservation de panier | `held → consumed, released, expired` (= `STOCK_RESERVATION_TRANSITIONS`) |
| Rendez-vous | = `APPOINTMENT_TRANSITIONS` ; l'expiration d'une demande y est `cancelled_by_pro` |
| Paiement | = `PAYMENT_INTENT_TRANSITIONS` (`pending`, `requires_action`, `processing`, `succeeded`, `failed`, `cancelled`) |
| Commande | = `ORDER_TRANSITIONS` (`pending` = en attente de paiement pour un panier) |
| Remboursement | `requested → processing, rejected` ; `processing → succeeded, failed` (nouveau : PRO.GA ne constate aujourd'hui que des remboursements externes) |
| Devis, candidature, offre | = `QUOTE_TRANSITIONS`, `APPLICATION_TRANSITIONS`, `OFFER_TRANSITIONS` |

Commande, paiement et remise restent trois machines indépendantes, liées par
`commerceOrderPaymentCheck` : une commande prépayée au-delà de `pending` exige un
paiement `succeeded` ; un paiement ouvert sur une commande annulée est incohérent ;
une commande annulée payée exige un remboursement. `commerceSettlementAction` : un
paiement confirmé sur une réservation expirée ou libérée impose
`reacquire_or_refund` (réacquérir le stock si possible, sinon remboursement par
procédure explicite ; ne jamais livrer un article inexistant ni ignorer un fonds
reçu).

Capacités (`deriveCommerceCapabilities`), chacune exigeant la précédente :
**brouillon** (membre actif, boutique non retirée) → **vitrine** (admission de la
vitrine selon la politique du réseau) → **contact** (réglage du vendeur, quotas)
; **catalogue, devis, rendez-vous, emploi, achat** exigent en plus une liaison
active, la boutique publiée par PRO.GA avec la capacité correspondante et
l'interrupteur commercial du réseau ; l'**achat** exige aussi une structure
vérifiée. Aucun badge ni niveau d'identité n'entre dans ce calcul. Indicatif pour
l'interface : un drapeau client ne donne aucun droit ; PRO.GA rejuge chaque
commande.

## 10. Données privées : projections, export, effacement, rétention, quotas, journal

- **Projections privées ANTSIA** (P13) : références, états, révisions, montants
  et dates des objets du sujet, servies à la seule personne titulaire ; aucune
  adresse, aucun CV, aucun registre comptable parallèle. Rafraîchies par
  `request.status`.
- **Export** : ANTSIA exporte ses propres objets (demandes envoyées, projections
  privées, conversations) par son export existant ; les pièces transactionnelles
  (commandes, factures, paiements, candidatures) relèvent de PRO.GA.
- **Effacement** : ANTSIA supprime la correspondance personne ↔ sujets, ses
  projections et les octets de demandes résolues ; chez PRO.GA le sujet devient
  un pseudonyme orphelin. L'effacement des données saisies chez PRO.GA (adresse,
  nom du candidat, CV) relève de PRO.GA ; la commande `subject.erasure.request`
  est réservée (décision ouverte, P16). Aucun document signé n'est réécrit.
- **Rétention** : minimum contractuel de l'idempotence (`expiresAt` + 5 min) et
  des nonces (10 min) ; toute autre durée (pièces commerciales, candidatures,
  journaux) est à décider par le propriétaire et un conseil compétent : **aucune
  durée légale n'est fixée ici.**
- **Quotas** (valeurs de départ à calibrer en P08/P10, non normatives) : demandes
  par (sujet, boutique) et par sujet ; paniers par sujet ; démarrages de paiement
  par panier ; rendez-vous par (sujet, prestation) ; candidatures dédupliquées par
  (sujet, poste) ; liaisons par opérateur ; brouillons par liaison ; consultations
  par source. Dépassement : `quota_exceeded` (métier) ou `rate_limited`
  (transport).
- **Journal minimal** : identifiant de corrélation (`requestId`), opération,
  issue, raison, révision, références publiques, source, environnement, durée,
  tentative. Jamais : message, adresse, nom, CV, `linkCode`, vérificateur PKCE,
  signature, clé, corps brut.

## 11. Compatibilité, migration et retour arrière

V1 fermée ; toute évolution par `PRO-COMMERCE-COMMAND-V2`, la destination
acceptant V1 et V2 avant que la source n'émette V2. Champs et opérations nouveaux
d'abord réservés. Côté PRO.GA, migrations additives : références de variante,
liaison, sujet acheteur, lignes de commande liées à offre/variante/révision avec
instantané immuable, auteur de transition facultatif, provenance ANTSIA ; aucune
réécriture de facture émise. Retour arrière : couper la capacité (réseau,
boutique ou source) bloque les nouvelles commandes ; consultations, annulations,
remboursements et suivis des engagements existants restent servis.

## 12. Décisions ouvertes

Prestataire de paiement et bénéficiaire des fonds (P12) ; politique d'admission
de la vitrine déclarée (P07) ; livraison hors Gabon et coordonnées de remise
directes (V1 : messagerie ANTSIA seulement) ; signature des réponses ; canal
poussé d'états privés (V1 : consultation) ; révocation et effacement initiés par
ANTSIA (`link.revoke`, `subject.erasure.request`) ; durées de conservation ; période
des salaires déclarés ; équipe vendeur multi-opérateurs (P10).

## 13. Preuves de P06

54 demandes (12 nominales, 42 refus), 50 réponses (22 nominales, 28 refus), 7
décisions de rejeu, 5 reprises après délai, 10 nouvelles tentatives de paiement,
41 transitions, 11 dérivations de capacités, exécutées par le même banc dans les
deux dépôts. Aucune de ces preuves ne couvre un échange réel, un encaissement ou
une recette de parcours.
