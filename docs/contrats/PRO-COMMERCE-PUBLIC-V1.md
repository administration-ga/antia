# PRO-COMMERCE-PUBLIC-V1 — projection publique PRO.GA → ANTSIA

Statut : **contrat spécifié et validateurs purs testés, lot P06, 18 octobre 2026.**
Au bilan P06, aucun handler, transport, table ni projection n'existait. P08 ajoute
le transport dans les sources et la validation canonique avant reçu. P09 raccorde les
producteurs, le handler catalogue et les projections dans les sources : boutiques,
offres et disponibilité ; les emplois restent P15. Mapping explicite, consentement,
politique ouverte et modération sont nécessaires à la lecture. **Vérifications et
recette croisée sont différées ; aucune synchronisation réelle n'est prouvée.** Contrat jumeau :
[PRO-COMMERCE-COMMAND-V1](PRO-COMMERCE-COMMAND-V1.md). Pendant PRO.GA :
`PRO_GA/docs/18_CONTRATS_COMMERCE_ANTSIA.md`.

P08 prépare aussi un contrat technique de recette sandbox séparé. Son effet ne prouve
pas l'application du catalogue PUBLIC. Aucun échange réel ni contrôle n'est exécuté
pendant les reprises P08/P09, à la demande du propriétaire. Le rattrapage et les médias
utilisent le contrat privé distinct [PRO-COMMERCE-CATALOG-READ-V1](PRO-COMMERCE-CATALOG-READ-V1.md).

Implémentation normative (octets identiques dans les deux dépôts, vérifiés par
`fixtures/MANIFEST.json`, révision 1) :
`packages/social-domain/src/commerce/` (ANTSIA) et
`packages/pro-domain/src/commerce/` (PRO.GA) — `primitives.ts`, `projection.ts`,
`command.ts`, `lifecycle.ts`, `index.ts`, `conformance.ts` et dix fixtures.

## 1. Rôle et frontière

PRO.GA est l'autorité des structures vendeuses, du catalogue, des prix, des
variantes, du stock et des offres d'emploi. ANTSIA en conserve une **projection
publique** pour la découverte. Ce contrat ne transporte que des faits
**publics et volontairement publiés** :

| Circule | Ne circule jamais |
|---|---|
| Boutique liée : nom commercial (organisation, casse conservée), pays, zone, vérification commerciale de la structure, capacités admises, catégories | Contacts, adresses, acheteurs, prospects, conversations, candidatures, CV |
| Offres consenties : titre, description, nature, prix qualifié, variantes à référence stable, médias par empreinte, catégories, zone, délai | SKU, quantités en stock, coûts, marges, identifiants Convex, `storageId`, URL de stockage |
| Disponibilité indicative (`in_stock`, `out_of_stock`, `unknown`) si l'offre l'expose | Réservations, établissements internes, tenants, utilisateurs PRO.GA |
| Offres d'emploi publiées et leur clôture | Notes d'entretien, décisions RH, salariés |

Tout ce qui est privé (liaison, achat, devis, rendez-vous, candidature) passe par
[PRO-COMMERCE-COMMAND-V1](PRO-COMMERCE-COMMAND-V1.md), jamais par l'inbox de reflets.

## 2. Transport et profil de signature PUBLIC

Le transport est **[FEDERATION-INBOX-V1](FEDERATION-INBOX-V1.md), inchangé** :
`POST /federation/inbox`, en-têtes `x-antsia-emitter`, `x-antsia-environment`,
`x-antsia-timestamp`, `x-antsia-signature`, HMAC-SHA256 hexadécimal de
`environment + "\n" + timestamp + "\n" + rawBody` (`commercePublicSigningText`
reproduit `federationSigningText`, testé). Ce contrat n'assouplit aucune règle de
l'inbox : il ajoute les siennes, plus strictes.

- **Émetteur** : un enregistrement `federationEmitters` par réseau servi et par
  environnement (slug de la forme `pro-ga`, `pro-ga-<réseau>`), avec
  `PRO-COMMERCE-PUBLIC-V1` dans `allowedContracts`. Le **réseau vient de cet
  enregistrement**, jamais de la charge (`networkId` y est refusé à toute profondeur).
- **Clés** : une clé par couple émetteur/environnement, jamais réutilisée (règle
  existante de l'inbox) ; côté ANTSIA, une référence de variable
  `ANTSIA_FEDERATION_[A-Z0-9_]+_KEY` ; côté PRO.GA, une référence opaque de son
  coffre. Aucune valeur ne figure dans un document ni dans le source.
- **Environnement** : `sandbox` ou `production`, explicite des deux côtés ; une
  signature de sandbox ne passe jamais en production, ni l'inverse.
- **Débit** : budget existant `federation.receive` (300/min, capacité 60, par
  émetteur et environnement). Un rattrapage complet de catalogue doit être étalé ;
  voir §9.

## 3. Enveloppe, octets et idempotence de transport

```json
{"contract":"PRO-COMMERCE-PUBLIC-V1","eventId":"pro-ga-evt-000001","objectRef":"pro.ga:offer:01JA00000000000000000000F1","payload":{"…":"…"},"version":1}
```

- Exactement les cinq clés de l'inbox. `version` vaut `1` : c'est la version de
  **transport**, jamais une révision métier.
- **Forme canonique obligatoire** : clés triées par unités de code UTF-16 (ordre
  par défaut de `Array.prototype.sort`), aucun espace, chaînes et nombres
  sérialisés par `JSON.stringify`, aucune clé dupliquée, nombres finis.
  `commerceCanonicalJson` la produit ; un corps qui n'y est pas identique octet
  pour octet est refusé `not_canonical`. Conséquence voulue : l'empreinte du corps
  exact (ANTSIA) et l'empreinte du JSON canonique (PRO.GA) coïncident.
- **Octets persistés** : PRO.GA persiste, dans la transaction qui enfile
  l'événement, les octets UTF-8 exacts du corps et leur SHA-256 hexadécimal. Une
  reprise renvoie **ces octets**, avec un horodatage et une signature d'en-tête
  neufs ; jamais une resérialisation.
- `eventId` : identifiant opaque de livraison, 8 à 200 caractères de la grammaire
  `objectRef` de l'inbox, unique par émetteur et environnement. Même `eventId` et
  mêmes octets : doublon (`200`, reçu existant) ; autres octets : conflit (`409`).
  Règle pure partagée : `decideCommerceIdempotentWrite`.
- Bornes identiques à l'inbox (testées) : 128 Kio réels, profondeur 8,
  2 000 nœuds, 256 éléments par tableau, 64 champs par objet, clés de 100
  caractères, chaînes de 8 192 caractères.

## 4. Références

**Référence de transport** : `pro.ga:<type>:<id>`, bijection exacte avec la
référence métier PRO.GA `pro.ga/<type>/<id>` (`commerceRefFromBusinessRef`,
`commerceBusinessRefFromRef`). `<id>` est l'identifiant Crockford frappé par
`mintBusinessRef` (10 à 32 caractères, sans I, L, O, U), jamais un identifiant
Convex. La forme `:` respecte la grammaire `objectRef` de l'inbox, qui refuse `/`
— aucune validation de l'inbox n'est assouplie.

- ANTSIA la traite comme **opaque** : il n'en déduit ni tenant, ni structure, ni
  autorité. La **correspondance serveur** est sa table de miroirs, clé
  `(émetteur, environnement, objectRef)` ; PRO.GA résout la référence par son
  index `businessRef` et rejuge l'appartenance à la structure liée.
- Familles d'`objectRef` : `structure` (boutique), `offer` (offre et
  disponibilité), `job_opening` (emploi). La référence de l'objet dans la charge
  (`shopRef`, `offerRef`, `jobRef`) est **égale** à `objectRef`, sinon
  `reference_mismatch`.
- Types utilisés par les contrats : `agenda_resource`, `agenda_service`,
  `appointment`, `checkout`, `commerce_link`, `establishment`, `inquiry`,
  `job_application`, `job_opening`, `offer`, `offer_collection`, `offer_variant`,
  `order`, `payment_intent`, `quote`, `refund`, `structure`. **À enregistrer dans
  `PRO_RESOURCE_TYPES` avant P08/P09** : `checkout`, `commerce_link`, `inquiry`,
  `offer_variant`, `refund` (constat tenu par un test PRO.GA).

## 5. Événements

| `type` | `objectRef` | Effet sur le miroir | Séquence |
|---|---|---|---|
| `shop.published`, `shop.updated` | `structure` | état complet, actif | `revision` |
| `shop.withdrawn` | `structure` | retrait (tombe) | `revision` |
| `offer.published`, `offer.updated` | `offer` | état complet, actif | `revision` |
| `offer.withdrawn` | `offer` | retrait (tombe) | `revision` |
| `offer.availabilityChanged` | `offer` | disponibilité indicative | `availabilityRevision` |
| `job.published` | `job_opening` | état complet, actif | `revision` |
| `job.closed` | `job_opening` | `closed`/`filled` : fermeture définitive ; `withdrawn` : retrait | `revision` |

Tout autre `type` est refusé `unknown_event` ; un `type` absent ou non textuel,
`invalid_payload`. Chaque charge est un **objet fermé** : clé inconnue ou
manquante, `invalid_payload` ; clé interdite à toute profondeur (liste de l'inbox,
plus `sku`, `tenantId`, `structureId`, `userId`, `tenantBusinessRef`,
`structureBusinessRef`, `establishmentId`, `onHand`, `reserved`, `costXaf`,
`marginXaf`, `contactName`, `contactEmail`, `contactPhone`, `fullName`,
`address`, `buyerRef`, `subject`, `lead`, `leadRef`, `note`, `cv`, `url`,
`logoUrl`, `mediaUrl`, `storageUrl`, `downloadUrl`, `token`, `idToken`,
`cookie`), `forbidden_field`. Une enveloppe PRO.GA imbriquée ou transmise brute
est donc refusée (fixtures). Les textes arrivent **déjà normalisés** par le
producteur (NFC, sans espace de bord, sans caractère de contrôle ; LF/CR admis
dans les descriptions) : sinon `invalid_text`, jamais de correction ni de
troncature côté récepteur. `changedAt` est un instant Unix en millisecondes, au
plus cinq minutes dans le futur (`invalid_time`). Les révisions sont des entiers
sûrs ≥ 1 (`invalid_revision`).

### 5.1 Boutique — `shop.published`, `shop.updated`

| Champ | Règle |
|---|---|
| `shopRef` | `pro.ga:structure:…`, égal à `objectRef` |
| `revision`, `changedAt` | révision métier de la boutique ; instant du changement |
| `capabilities` | ensemble **trié** sans doublon parmi `booking`, `catalog`, `checkout`, `jobs`, `quote` : capacités ADMISES par PRO.GA, indicatives (chaque commande est rejugée) |
| `collections` | 0 à 50 `{collectionRef, label (1-60), position (0-10 000)}`, références uniques |
| `commercialName` | 2 à 120 caractères (borne d'un nom de page ANTSIA), nom d'organisation : aucune règle de casse des personnes |
| `country` | deux capitales ISO, `GA` en V1 de fait |
| `currency` | `XAF` |
| `linkRef` | `pro.ga:commerce_link:…` de la liaison active qui fonde la publication |
| `sellerVerification` | `unverified`, `pending`, `verified` (`proStructures.verification`) : un fait reflété, jamais un badge ANTSIA ni une autorisation |
| `serviceArea` | facultatif, 1 à 120 caractères |

`checkout` sans `sellerVerification: "verified"` est refusé
`capability_incoherent` (règle PRO.GA : le module commerce n'est effectif que pour
une structure vérifiée).

`shop.withdrawn` : `shopRef`, `revision`, `changedAt`, `linkRef`, `reason` parmi
`consent_withdrawn`, `link_revoked`, `policy_removed`, `seller_request`,
`structure_closed`, `structure_suspended`. Le retrait d'une boutique **masque
toutes ses offres et emplois** sans attendre leurs propres retraits.

### 5.2 Offre — `offer.published`, `offer.updated`

| Champ | Règle |
|---|---|
| `offerRef`, `shopRef` | offre (égale à `objectRef`) et structure vendeuse |
| `revision` | **révision de catalogue cohérente** : un seul compteur pour l'offre, ses variantes, ses prix, médias et catégories ; chaque charge est un état COMPLET |
| `kind` | `product` ou `service` |
| `title` | 2 à 120 ; `description` 0 à 4 000, multiligne |
| `price` | prix qualifié, §5.3 |
| `variantAxes` | 0 à 2 axes (1-40), sans doublon |
| `variants` | 0 à 150 variantes, §5.4 |
| `media` | 0 à 6 descripteurs `{sha256, mimeType (jpeg, png, webp), byteSize (1 o-10 Mio), width?, height? (1-20 000), altText? (1-200)}`, empreintes uniques |
| `collectionRefs` | 0 à 5 références de catégories, uniques |
| `tags` | 0 à 10 étiquettes de 1 à 40, uniques |
| `showsAvailability` | l'offre expose-t-elle sa disponibilité (défaut PRO.GA : non) |
| `zone`, `leadTimeDays` | facultatifs : 1-120 caractères ; entier 0-365 |

Les **médias** sont désignés par leur empreinte : aucune URL d'un autre produit
n'est propagée. P09 définit la chaîne d'admission (récupération contractuelle des
octets, vérification de l'empreinte, garde des fichiers ANTSIA) ; un média non
admis n'est jamais servi.

### 5.3 Prix

Montants : **entiers sûrs en unité minimale XAF** (le franc CFA n'a pas de
subdivision), de 0 à 10 000 000 000 (borne de contrat, pas règle métier).
Ordre de jugement : mode, forme, devise, unité, montants, cohérence.

| `mode` | Clés exactes | Payable ? |
|---|---|---|
| `fixed` | `amount`, `currency` | oui, au montant |
| `unit` | `amount`, `currency`, `unit` (1-20, exigée) | oui, par quantité entière d'unité |
| `range` | `minAmount ≤ maxAmount`, `currency`, `unit?` | **jamais** sans variante ; une variante active l'est à son montant |
| `quote` | `currency` seule | **jamais**, et aucune variante admise |

Devise autre que `XAF` : `currency_mismatch` (jugée avant le montant). Montant non
entier, négatif ou hors borne : `invalid_amount`. Montant manquant, superflu
(sur devis chiffré, `unit` sur un prix fixe), fourchette inversée, variante sur un
sur-devis : `amount_incoherent`. Aucune conversion de devise.

### 5.4 Variantes

`{variantRef, label (1-80), options, amount, unit?, effectiveFrom?, effectiveTo?}` :

- `variantRef` (`pro.ga:offer_variant:…`) est **stable** : frappée une fois par
  PRO.GA, jamais réattribuée, indépendante du libellé. PRO.GA identifie
  aujourd'hui une variante par (offre, libellé normalisé) : la frappe d'une
  référence propre est un changement P09.
- Unicité des références et des libellés normalisés (espaces de bord, minuscules,
  règle PRO.GA) : `duplicate_entry`.
- `options` : vide (variante saisie à la main) ou une valeur par axe déclaré.
- `amount` : montant exact, dans la devise de l'offre ; `unit` : sinon l'unité du
  prix `unit`.
- Fenêtre d'effet : `effectiveTo > effectiveFrom` ; hors fenêtre, la variante
  n'est ni affichée ni payable (`commerceOfferPurchasability`).
- Une variante retirée chez PRO.GA n'est pas publiée. Le SKU n'est jamais publié.

Représentation compacte voulue : axes déclarés une fois, options en chaînes,
montant sans devise répétée. Une offre de 150 variantes à deux axes, six photos et
toutes bornes atteintes compte **1 582 nœuds et 39 860 octets** et passe la
garde de l'inbox (fixture « offre maximale », testée) ; une représentation par
objets `{axis, value}` et devise par variante dépasserait les 2 000 nœuds.

### 5.5 Disponibilité — `offer.availabilityChanged`

`offerRef`, `shopRef`, `availabilityRevision` (séquence **propre**), `changedAt`,
`availability` et `variants: [{variantRef, availability}]` (uniques) parmi
`in_stock`, `out_of_stock`, `unknown`. Indicative : jamais une réservation, jamais
un droit d'achat. Une disponibilité ne réordonne jamais le contenu (séquences
distinctes) ; elle est ignorée à l'affichage si l'offre ne l'expose pas.

### 5.6 Emploi — `job.published`, `job.closed`

`job.published` : `jobRef`, `shopRef`, `revision`, `changedAt`, `title` (3-120),
`contractType` (`apprentissage`, `cdd`, `cdi`, `prestation`, `stage`),
`headcount` (1-1 000), `description` (0-4 000), `openedOn`, `closesOn?`
(dates civiles existantes, `closesOn ≥ openedOn`), `location?` (1-120),
`declaredSalary?` `{currency: "XAF", minAmount?, maxAmount?}` (au moins une
borne, ordonnées ; fourchette DÉCLARÉE, sans période : PRO.GA n'en stocke pas).

`job.closed` : `reason` `closed` ou `filled` (**terminal** : comme dans PRO.GA, on
rouvre par un nouveau poste) ou `withdrawn` (retrait de publication, levable par
une révision supérieure). Une offre close reste lisible sur un lien connu avec sa
clôture ; elle sort des recommandations.

### 5.7 Raisons de refus

`invalid_body`, `body_too_large`, `not_canonical` (octets) ; `invalid_envelope` ;
`too_complex`, `forbidden_field` (parcours) ; `unknown_event` ; `invalid_payload`,
`invalid_reference`, `reference_mismatch`, `invalid_revision`, `invalid_time`,
`invalid_text`, `duplicate_entry`, `invalid_amount`, `currency_mismatch`,
`amount_incoherent`, `capability_incoherent`. Ordre d'évaluation : octets →
enveloppe → parcours borné → type → structure fermée → référence de l'objet →
révision → horodatage → autres champs par ordre alphabétique de clé (de même dans
chaque entrée imbriquée) → règles croisées. Chaque raison est accompagnée d'un
chemin (`$.payload.variants[0].sku`) pour le diagnostic interne ; la réponse HTTP
de l'inbox reste celle de FEDERATION-INBOX-V1 (`400` sans détail).

## 6. Révisions, retraits, réordonnancement et rejeu

`eventId` identifie une livraison ; `revision` (ou `availabilityRevision`)
ordonne les états d'un objet. Décision pure `decideCommercePublicRevision`, sur
l'empreinte SHA-256 de la forme canonique de l'événement validé (qui est la
charge reçue : le validateur ne perd ni n'ajoute rien, testé) :

| Situation | Décision |
|---|---|
| Aucun état connu | `apply` (un retrait crée une **tombe** sans objet) |
| Révision inférieure (événement retardé) | `stale` : reconnu, sans réécriture |
| Révision égale, même empreinte | `duplicate` |
| Révision égale, autre empreinte | `conflict` / `revision_conflict` (DLQ `source_conflict`) |
| Révision supérieure | `apply` ; `gap` si des révisions manquent |
| Objet fermé définitivement (`closed`) | `conflict` / `terminal_object` |

- Une tombe empêche qu'un ancien état ressuscite l'objet ; une révision supérieure
  le republie.
- Chaque charge étant un état complet, un trou s'applique ; il déclenche une
  **relecture contractuelle bornée** (réconciliation par curseur, P09) et une
  mesure, jamais une supposition sur les champs manquants.
- Le rejeu opérateur réutilise le reçu, l'`eventId` et le corps authentifié de la
  DLQ, comme FEDERATION-INBOX-V1. Un `202` est une réception, pas une application ;
  `applied` peut signifier une révision ancienne reconnue sans réécriture.

## 7. Projection anonyme ANTSIA

`commerceOfferPublicView` et `commerceShopPublicView` fixent l'allowlist servie :

- jamais `linkRef`, aucun champ privé ; les médias restent des descripteurs à
  admettre ;
- variantes de leur fenêtre d'effet seulement ;
- disponibilité `null` si l'offre ne l'expose pas, `unknown` sans information ;
- **action principale** : `buy` seulement pour une ligne payable ET la capacité
  d'achat ANTSIA ; un sur-devis donne « Demander un devis » (`request_quote`) si la
  boutique admet les devis, sinon `contact` ; jamais un faux bouton d'achat.

Une offre n'est visible que si sa boutique est publiée, l'offre active, aucune
modération ANTSIA ne la retire et la capacité vitrine de la page est ouverte
(`deriveCommerceCapabilities`, [COMMAND §9](PRO-COMMERCE-COMMAND-V1.md)). La
porte anonyme est une porte dédiée aux boutiques publiées et admises : les gardes
anonymes existantes des pages ne sont pas généralisées.

## 8. Obligations du producteur PRO.GA (P09)

Émettre, pour toute structure dont la liaison est active et la publication
consentie (permissions `publish_catalog`, `publish_jobs`) :

| Changement PRO.GA | Événement |
|---|---|
| Première publication / republication / modification d'une offre consentie, d'une variante, d'une catégorie rattachée, d'un média | `offer.published` / `offer.updated` (révision +1, état complet) |
| Pause, archivage, fin de consentement, retrait de modération, retrait de la boutique | `offer.withdrawn` avec la raison exacte |
| Variation du stock d'une offre qui expose sa disponibilité | `offer.availabilityChanged` (séquence propre) |
| Liaison activée, nom, zone, catégories, capacités, vérification | `shop.published` / `shop.updated` |
| Liaison révoquée, consentement retiré, structure suspendue ou fermée | `shop.withdrawn` |
| Poste publié ou modifié ; fermé, pourvu ou dépublié | `job.published` ; `job.closed` |

Le producteur normalise ses textes (NFC, espaces de bord) et ne tronque jamais :
une offre hors contrat **n'est pas publiée vers ANTSIA** et le vendeur en voit la
raison dans PRO.GA. Données PRO.GA actuellement hors contrat : montants d'offre
fractionnaires (aujourd'hui acceptés par `assertPriceCoherence`), mode `unit` sans
`priceUnit`, `priceUnit` sur un prix fixe, étiquettes, zone, délai et unité non
bornés, variantes de grille aux axes incohérents.

## 9. Obligations du récepteur ANTSIA (P09)

- Relire le corps exact par `parseCommercePublicBody` avant tout reçu (charge
  invalide d'un contrat connu : `400` sans reçu ni DLQ, comme RESEAU-PUBLIC-V1).
- Restreindre le contrat aux émetteurs commerciaux enregistrés et aux réseaux dont
  la politique commerciale est ouverte ; sinon DLQ `contract_not_allowed`.
- Tenir un état par objet et par séquence (révision, empreinte, état, tombe) ;
  appliquer `decideCommercePublicRevision` ; `conflict` → DLQ `source_conflict`.
- Mesurer la fraîcheur et le retard (cible de recette p95 < 60 s, à mesurer) ; un
  miroir périmé n'autorise jamais un achat : `checkout.prepare` relit chez PRO.GA.
- Budget : 300/min par émetteur suffit au fonctionnement courant estimé (5 000
  changements/jour) mais pas à un rattrapage de 100 000 offres (≈ 5,5 h) ; P09
  conserve ce budget et ajoute une réconciliation manuelle par pages de vingt événements
  au plus, via la même outbox. Il n'y a ni boucle de rattrapage globale ni mesure de délai
  effectuée dans cette reprise ; l'admission des demandes est elle aussi bornée.

## 10. Compatibilité, migration et retour arrière

- V1 est **fermée** : un champ nouveau casserait les récepteurs V1. Toute évolution
  passe par `PRO-COMMERCE-PUBLIC-V2` : récepteurs d'abord (lisant V1 et V2), puis
  ajout de V2 à `allowedContracts`, puis bascule du producteur ; V1 reste lisible
  tant que des états ou tombes V1 existent.
- Les projections servies aux clients évoluent de façon additive ; un client
  ancien qui rencontre un mode de prix inconnu n'affiche aucun prix payable ni
  bouton d'achat.
- Retour arrière : retirer le contrat de `allowedContracts` ou désactiver
  l'émetteur arrête les nouvelles applications ; les projections restent servies
  avec leur fraîcheur ou sont retirées par `shop.withdrawn` ; aucun engagement
  privé n'en dépend.

## 11. Données personnelles, effacement, rétention

Aucune donnée personnelle n'est attendue dans ce contrat (noms d'organisation,
offres, emplois). Les reçus et tombes ne conservent que références, révisions,
empreintes et états. Révocation de liaison ou retrait de consentement : retrait
des projections par `shop.withdrawn`/`offer.withdrawn`. Durée de conservation des
tombes : celle du miroir ; aucune durée légale n'est fixée par ce contrat.

## 12. Preuves de P06

Validateurs et fixtures (70 cas publics dont 57 refus, 12 décisions de révision,
vues et payabilité) exécutés par le même banc `runCommerceConformance` dans les
deux dépôts ; compatibilité avec la garde de l'inbox ANTSIA testée sur 31 cas
(`compatibility.test.ts`). Commandes et résultats : rapport
`docs/etudes/2026-10-18-social-commerce/rapports/P06_CONTRATS.md`. Ces tests ne
prouvent ni un échange réel, ni une application métier, ni une publication.
