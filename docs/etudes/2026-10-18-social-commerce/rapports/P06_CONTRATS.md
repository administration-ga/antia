# P06 — Contrats commerciaux et modèles d'autorité : rapport

Date : 18 octobre 2026. Agent « contrats », sous coordinateur. Verdicts séparés
selon `10_RECETTE_MESURES_ET_RISQUES.md` §7 : **documenté** et **présent dans le
code** et **testé automatiquement** ; **ni observé en recette, ni publié.**
Aucune synchronisation, aucune commande exécutable, aucun encaissement.

## Bilan standard

| Champ | Contenu |
|---|---|
| Résultat | Deux contrats fermés, `PRO-COMMERCE-PUBLIC-V1` (projection publique : 9 événements) et `PRO-COMMERCE-COMMAND-V1` (9 commandes + consultation `request.status`, 6 noms réservés), spécifiés et implémentés en validateurs, types, machines d'état et décisions **purs**, **octet pour octet identiques** dans ANTSIA (`packages/social-domain/src/commerce/`) et PRO.GA (`packages/pro-domain/src/commerce/`), avec 10 fixtures partagées et un manifeste d'empreintes. Rien n'est branché à un parcours : c'est l'objet du lot (handlers, transport, tables, projections : P08/P09). |
| Source | ANTSIA `codex/pa4-identite-session` @ `9eaff40` (arbre partagé : PA9 et DIASPORALE actifs, leurs fichiers non touchés). PRO.GA `feat/antsia-social-commerce` @ `9497f22` (arbre propre au départ). Fichiers créés ou modifiés : §1. Aucun commit, aucun changement de branche. |
| Tests | ANTSIA : `bun run --cwd packages/social-domain test -- commerce` → **3 fichiers, 38 tests verts** ; `bunx tsgo --noEmit -p packages/social-domain/tsconfig.json` → **0 erreur** ; `bun run --cwd packages/social-domain lint` → **propre** ; cliquets `no-cross-product-imports`, `provenance-headers`, `no-hardcoded-urls` → **10 tests verts**, `no-hardcoded-colors`, `no-unbounded-collect` → **4 verts**. PRO.GA : `bun test packages/pro-domain/tests/commerce-conformance.test.ts packages/pro-domain/tests/commerce-parity.test.ts` → **15 verts, 85 assertions** ; `bun run --cwd packages/pro-domain typecheck` → **0 erreur** ; `bun run --cwd packages/pro-domain test` (domaine pur, l'export du barillet touchant tous ses consommateurs) → **736 verts / 55 fichiers**. Contre-épreuve : un octet ajouté à la copie PRO.GA d'une fixture a fait rougir le test de jumelage ANTSIA ET le test d'empreinte PRO.GA ; copie restaurée identique. Non lancés (consigne) : `bun run codegen`, `bun run verify`, commande Convex, serveur, suites complètes. |
| Recette | Aucune : lot de contrats purs, sans surface ni parcours. |
| Dépendances | Registres PRO.GA : 5 types de référence et 10 scopes machine à ajouter (P08). Endpoint de commandes, magasin d'idempotence, raccord des deux outboxes (P08). Producteurs et handler commercial de l'inbox (P09). Prestataire de paiement (P12). Décisions du §6. |
| Retour arrière | Supprimer les fichiers créés (§1) et retirer la ligne d'export de `pro-domain/src/index.ts` : aucune donnée, configuration ni capacité n'est concernée. |
| Limites | Les tests prouvent la cohérence des validateurs et leur parité entre dépôts, et la compatibilité des projections admises avec la garde ACTUELLE de l'inbox ANTSIA (fichier en cours d'édition par PA9). Ils ne prouvent aucun échange HTTP, aucune signature avec une vraie clé, aucune application métier, aucune performance. |

## 1. Fichiers

### ANTSIA (tous nouveaux)

```
packages/social-domain/src/commerce/primitives.ts        ┐
packages/social-domain/src/commerce/projection.ts        │ jumeaux (manifeste)
packages/social-domain/src/commerce/command.ts           │
packages/social-domain/src/commerce/lifecycle.ts         │
packages/social-domain/src/commerce/index.ts             │
packages/social-domain/src/commerce/conformance.ts       ┘
packages/social-domain/src/commerce/fixtures/MANIFEST.json            (jumeau)
packages/social-domain/src/commerce/fixtures/{command-replay,command-requests,command-responses,
  lifecycle,names,public-events,public-revisions,references,signing,views}.json (jumeaux)
packages/social-domain/src/commerce/conformance.test.ts   manifeste, jumelage, banc
packages/social-domain/src/commerce/compatibility.test.ts inbox ANTSIA, noms civils
packages/social-domain/src/commerce/core.test.ts          propriétés unitaires
docs/contrats/PRO-COMMERCE-PUBLIC-V1.md
docs/contrats/PRO-COMMERCE-COMMAND-V1.md
docs/etudes/2026-10-18-social-commerce/rapports/P06_CONTRATS.md
```

`packages/social-domain/src/index.ts` n'est pas modifié : consommation par
`@antsia/social-domain/commerce/index` (ou `/commerce/<fichier>`) grâce à l'export
`"./*"` ; `tsconfig` (`src/**/*.ts`), vitest (`src/**/*.test.ts`) et eslint (`.`)
couvrent le sous-répertoire (vérifié par les commandes ci-dessus).

### PRO.GA

```
packages/pro-domain/src/commerce/{primitives,projection,command,lifecycle,index,conformance}.ts  (nouveaux, jumeaux)
packages/pro-domain/src/commerce/fixtures/*.json                                                  (nouveaux, jumeaux, MANIFEST compris)
packages/pro-domain/src/index.ts                     (modifié : export * from "./commerce/index", 3 lignes)
packages/pro-domain/tests/commerce-conformance.test.ts  (nouveau)
packages/pro-domain/tests/commerce-parity.test.ts       (nouveau : parité avec les enums et bornes PRO.GA)
docs/18_CONTRATS_COMMERCE_ANTSIA.md                     (nouveau : renvoi normatif versionné + obligations PRO.GA)
```

Manifeste révision 1, SHA-256 `0ad170ac60f7e81576e38bd43273b029b4088720272fa35bfdec2e1de1d755f0`.
Volume des fixtures : ≈ 410 Kio par dépôt (dont l'offre maximale, 39 860 octets).
Mise à jour d'un fichier jumeau : modifier les deux copies, recalculer chaque
empreinte (`shasum -a 256`), monter `manifestRevision`, garder les deux manifestes
identiques (procédure rappelée dans `PRO_GA/docs/18_CONTRATS_COMMERCE_ANTSIA.md`).
Les fixtures ont été produites par un générateur de travail hors dépôt ; leurs
attentes sont écrites à la main d'après le contrat et se modifient directement.

## 2. Ce que les contrats fixent

- **Séparation stricte** : projection publique par l'inbox signée existante,
  sans assouplissement ; actions privées par un endpoint PRO.GA dédié. Clés
  interdites à toute profondeur dans les deux sens (payload imbriqué, enveloppe
  PRO.GA transmise brute, SKU, `storageId`, contacts, tenant, réseau).
- **Enveloppe** : cinq clés de l'inbox ; `version` = transport ; `revision` (et
  `availabilityRevision`) = ordre métier ; **JSON canonique obligatoire**, qui fait
  coïncider l'empreinte des octets exacts (ANTSIA) et du JSON canonique (PRO.GA) ;
  octets persistés à l'enfilement, reprises sur ces octets.
- **Références** : `pro.ga:<type>:<id>`, bijection avec `pro.ga/<type>/<id>`,
  opaque pour ANTSIA, résolue par table de miroirs ; compatible `objectRef`.
- **Prix** : `fixed`, `unit` (unité exigée), `range`, `quote` ; XAF entiers en unité
  minimale ; devise jugée avant le montant ; sur-devis jamais payable ni chiffré ;
  variantes à `variantRef` stable, montant exact, fenêtre d'effet ; une seule
  révision de catalogue pour l'offre et ses variantes.
- **Révisions** : retardée → `stale` ; égale → doublon ou conflit ; trou → appliqué
  + relecture bornée ; tombes versionnées ; fermeture d'emploi terminale.
- **Identités** : sujets opaques par (personne, réseau, structure, rôle) ; réseau
  par configuration d'émetteur/source ; tenant jamais transmis ; mandat relu à
  chaque commande vendeur ; seule preuve de liaison : double preuve PKCE ; aucun
  badge ni identité vérifiée dans les décisions commerciales.
- **Idempotence et délai** : même clé + mêmes octets → mêmes octets de réponse
  (même expirée) ; autre corps → conflit ; jamais d'exécution après `expiresAt` ;
  enregistrement ≥ `expiresAt` + 5 min ; consultation `request.status` et guide
  de reprise ; nouvelle tentative de paiement seulement après échec certain.
- **Signatures** : PUBLIC = FEDERATION-INBOX-V1 inchangé ; COMMAND =
  construction `pro-ga-machine-hmac/v1` sous l'étiquette
  `pro-ga-commerce-command-hmac/v1`, sans composant tenant, clé propre par source
  et environnement. Aucun algorithme nouveau, aucun secret.
- **Machines et capacités** : liaison, publication, demande, panier, rendez-vous,
  paiement, commande, remboursement (+ devis, candidature, offre), avec parité
  testée sur les enums PRO.GA ; capacités brouillon → vitrine → contact → achat ;
  cohérences commande/paiement et paiement tardif.

## 3. Écarts entre 07/08 et le source réel

Constats de 07 revérifiés et **exacts** à `9497f22` : deux outboxes sans raccord
(`emitProEvent` écrit `proOutboxEvents`, sans consommateur hors rétention ;
`enqueueFederationEvent` n'a aucun appelant hors tests) ; transport abstrait et
`TestIntegrationTransport` seul ; routeur HTTP limité à l'OpenID, à
l'authentification et aux routes de développement ; `PAYMENT_ADAPTERS` vide ;
variantes identifiées par (offre, libellé) et absentes de l'instantané d'offre ;
publication d'offre à charge `{version}`, pause sans émission ; commandes nées
d'un devis, lignes sans offre ni variante ; aucun événement de recrutement ;
enveloppe ANTSIA à cinq clés, `objectRef` sans `/`, signatures non
interchangeables.

Écarts ou nouveautés qui conditionnent les contrats :

1. **Inbox ANTSIA en évolution (PA9A, non commité)** : `RESEAU-PUBLIC-V1`
   `page.upserted` est désormais appliqué, avec un contrôle de charge avant reçu
   (`validImplementedFederationPayload`). La phrase de 07 « tout contrat autorisé
   est placé en dead_letter/unsupported_contract » ne vaut plus que pour les autres
   contrats, dont les deux commerciaux.
2. **Borne de 2 000 nœuds de l'inbox** : une offre PRO.GA de 150 variantes en
   représentation naïve la dépasse ; d'où la représentation compacte (axes une
   fois, options en chaînes, montant sans devise répétée) : 1 582 nœuds au maximum.
3. **Montants d'offre fractionnaires acceptés par PRO.GA** (`assertPriceCoherence`) ;
   `unit` sans unité, unité sur un prix fixe, zone/délai/étiquettes non bornés.
4. **`emitProEvent`** : `businessId` en majuscules (refusé par le propre analyseur
   strict de PRO.GA), `subjectVersion: 0` à l'archivage d'une offre jamais publiée,
   charge plate : les lignes de `proOutboxEvents` ne sont pas relisibles par la
   fondation `proIntegrationOutbox` sans adaptation.
5. **Profil machine PRO.GA** : OpenAPI (horodatage RFC 3339, nonce ≥ 24,
   key-id mixte) ≠ code (millisecondes, nonce ≥ 16, key-ref en minuscules) ; PRO.GA
   signe l'empreinte du JSON **re-canonisé**, ANTSIA celle des **octets exacts**
   (résolu par la forme canonique obligatoire).
6. **Registres PRO.GA** : `MACHINE_SCOPES` ne connaît que `federation.*` ;
   `PRO_RESOURCE_TYPES` n'a ni `offer_variant`, ni `commerce_link`, ni `inquiry`,
   ni `checkout`, ni `refund`.
7. **Commandes PRO.GA** : `history[].byUserId` obligatoire (une transition
   déclenchée par l'acheteur ou un rappel de prestataire n'a pas d'utilisateur),
   destinataire `lead|client` + `recipientName` obligatoires, aucune devise
   stockée (XAF implicite).
8. **Agenda** : l'expiration d'une demande est `cancelled_by_pro` (audit
   `agenda.appointment.expired`), pas un état propre. **Recrutement** : salaire
   déclaré sans période.
9. **08 §7** proposait des états conceptuels (`awaiting_payment`, paiement
   `expired`) : le contrat garde les enums PRO.GA (aucune traduction) ; l'expiration
   relève de la réservation de panier.
10. **08 §5** ne prévoyait ni consultation de statut ni noms réservés : ajoutés
    (`request.status` ; `link.revoke`, `booking.cancel`, `application.withdraw`,
    `inquiry.withdraw`, `catalog.publish.request`, `subject.erasure.request`).
11. **Débit** : `federation.receive` (300/min par émetteur) suffit au courant
    estimé, pas à un rattrapage de 100 000 offres (≈ 5,5 h) : décision P09.

## 4. Décisions prises dans ce lot

1. Implémentation **unique et jumelle** (mêmes octets, manifeste, contrôle croisé
   conditionnel au dépôt voisin, comme `gabaos/registry.test.ts`), plutôt que deux
   implémentations à garder parallèles ; style à points-virgules dans les deux.
2. Banc de conformité **pur et partagé** (`conformance.ts`, non réexporté) : les
   deux suites exécutent les mêmes vérifications sur les mêmes octets ; attentes
   écrites à la main d'après le contrat, jamais calculées par l'implémentation.
3. Référence de transport bijective plutôt qu'un identifiant haché : aucune table
   de correspondance supplémentaire côté PRO.GA, aucune identité Convex exposée.
4. JSON canonique obligatoire dans les deux contrats.
5. Deux séquences de révision par offre (catalogue, disponibilité), charges à état
   complet, tombes, fermeture terminale des emplois.
6. Enums PRO.GA conservés ; machines nouvelles seulement pour liaison,
   publication, demande et remboursement.
7. Copie testée du normaliseur civil ANTSIA dans le contrat (PRO.GA n'en a pas).
8. Limites V1 assumées : quantités entières ; livraison au Gabon, sans coordonnée
   directe (messagerie ANTSIA) ; fuseau `Africa/Libreville` ; ni variante ni média
   dans `catalog.draft.save` ; réponses non signées ; états privés par consultation.

## 5. Décisions laissées ouvertes

Prestataire et bénéficiaire des fonds (P12) ; admission de la vitrine déclarée
(P07) ; raccord unique des deux outboxes (P08) ; budget ou lots de rattrapage
(P09) ; signature des réponses ; canal poussé d'états privés ; révocation et
effacement initiés par ANTSIA ; durées de conservation (propriétaire / conseil) ;
période des salaires (P15) ; équipe vendeur multi-opérateurs (P10) ; valeurs des
quotas (P08/P10) ; quantités fractionnaires (V2) ; livraison hors Gabon.

## 6. Demandes au coordinateur

1. **Commits** (je n'ai rien commité) — ANTSIA, par chemins :
   `packages/social-domain/src/commerce`, `docs/contrats/PRO-COMMERCE-PUBLIC-V1.md`,
   `docs/contrats/PRO-COMMERCE-COMMAND-V1.md`,
   `docs/etudes/2026-10-18-social-commerce/rapports/P06_CONTRATS.md` (tous
   nouveaux, sans recouvrement avec PA9 ni DIASPORALE). PRO.GA, sur
   `feat/antsia-social-commerce` : `packages/pro-domain/src/commerce`,
   `packages/pro-domain/src/index.ts`, `packages/pro-domain/tests/commerce-conformance.test.ts`,
   `packages/pro-domain/tests/commerce-parity.test.ts`,
   `docs/18_CONTRATS_COMMERCE_ANTSIA.md`. Les deux commits doivent porter les
   mêmes octets jumeaux (le test de jumelage le vérifie quand les deux checkouts
   sont présents) ; `bun run verify` des deux dépôts reste à passer par vous.
2. **Fichiers partagés** : aucun besoin sur `package.json`, `bun.lock`,
   `convex/**`, `packages/social-domain/src/index.ts`.
3. **PA9 (fédération ANTSIA)** : `compatibility.test.ts` lit
   `federationProtocol.ts` (bornes, clés interdites, signature) en lecture seule ;
   une évolution PA9 de ces bornes doit être répercutée dans le contrat. Pour P09,
   le contrôle de forme canonique exige que le hook de charge de l'inbox reçoive le
   corps brut (aujourd'hui `validImplementedFederationPayload(envelope, now)`), et
   l'ajout du contrat à `FEDERATION_IMPLEMENTED_CONTRACTS` fera volontairement
   rougir l'assertion « aucun contrat commercial appliqué » de
   `compatibility.test.ts`, à mettre à jour dans le même lot.
4. **P08 (PRO.GA)** : ajouter les 5 types de référence et les 10 scopes
   `commerce.*` ; aligner l'OpenAPI du profil machine sur le code ; trancher le
   raccord des outboxes et corriger les trois défauts d'`emitProEvent` relevés.
5. **Étude** : 07 §4.3 (« tout contrat autorisé → DLQ ») est à nuancer après PA9A ;
   l'état de P06 dans `EXECUTION.md` et la mémoire du vault sont à mettre à jour par
   vous (hors de mes fichiers réservés).
