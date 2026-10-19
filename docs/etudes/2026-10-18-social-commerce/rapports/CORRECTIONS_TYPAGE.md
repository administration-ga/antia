# Corrections de typage — `typecheck:convex`, cliquets et contrats jumeaux

19 octobre 2026, agent « corrections » sous coordination ([EXECUTION.md](../EXECUTION.md)). Phase :
préparation de la vérification commune avant « commit, pousse et déploie » (décision du propriétaire).

**Verdict : les 55 erreurs de typage Convex de mon périmètre sont corrigées (0 erreur au typage
Convex complet), les trois cliquets rouges passent (suite complète 25/25 fichiers, 140/140 tests), les
contrats jumeaux restent identiques octet pour octet dans les deux dépôts, et l'assertion N34 signalée
en cours de route par le coordinateur est corrigée (contextualMessaging 56/56).** Les causes sont
corrigées, pas les symptômes : aucun `as any`, `@ts-ignore`, `@ts-expect-error` ni transtypage ; la
`lib` des tsconfig est inchangée.

Interdits respectés : aucune écriture git, aucun `codegen`, `verify`, commande `convex`, serveur,
navigateur ni installation ; aucun `.env*`, `package.json`, `bun.lock`, `_generated`, primitive UI,
pont de session, `diaspora/**`, `events/**`, manifeste P06 (`commerce/**`), `commercialMessaging/**`,
`P/convex/**`, `apps/admin_antsia_ga`, `notification-targets.ts` ni `compatibility.test.ts` touché.
Chaque fichier existant a été modifié par ancre unique relue juste avant. Les fichiers `A/convex/**`
(poussés en continu par le `convex dev` :3210 d'une autre session) ont été écrits dans un ordre qui
laisse chaque état intermédiaire cohérent (consommateur mis à jour avant le retrait d'un export,
import ajouté avant son usage).

Racines : **A/** = `ECOSYSTEMES/ANTSIA/`, **P/** = `ECOSYSTEMES/PRO_GA/`.

## Bilan standard

| Champ | Contenu |
|---|---|
| Résultat | Typage Convex 59 → 0 (55 corrigées ici ; les 4 de `events/agendaPagination.test.ts` l'ont été par DIASPORALE entre-temps) ; `social-domain` 1 → 0 ; cliquets `i18n-locales`, `no-hardcoded-urls`, `theme-contract` verts ; N34 vert |
| Source | ANTSIA `codex/pa4-identite-session` @ `9eaff40` + arbre partagé ; PRO.GA `feat/antsia-social-commerce` @ `9497f22` + arbre partagé. Aucune branche changée |
| Fichiers | 21 : 6 jumeaux (3 × 2 dépôts), 11 sous `A/convex/modules`, 2 sous `A/packages/social-features`, 2 sous `A/apps/antsia_ga` — détail ci-dessous |
| Tests | Exécutés, chiffres au §4 ; échecs restants tous hors de ces corrections (§5) |
| Outils | Node v25.9.0, Bun 1.4.2, tsgo (ANTSIA), tsc 6.0.3 (PRO.GA), vitest 4.1.10, convex-test 0.0.54 |
| Retour arrière | Par fichier (annuler l'édition) ; aucune donnée migrée ni supprimée |

## 1. Typage Convex — erreur → cause → correction

### 1.1 Contrats jumeaux `commerce-{checkout,orders,payment}.ts` (A/packages/social-domain/src et P/packages/pro-domain/src)

| Erreur | Cause | Correction |
|---|---|---|
| `commerce-checkout.ts:48` TS2322 (aussi au typage propre de `social-domain`) | Type de retour INFÉRÉ du rappel de `commerceCapture` : les deux `return` (`payload: {}` et `payload: { checkoutRef }`) sont normalisés en `{ checkoutRef?: undefined }`, non assignable à `Record<string, never>` | Type de retour explicite `commerceCapture((): CommerceCheckoutControlRequest => { … })` : chaque `return` est jugé contre le contrat |
| `Object.hasOwn` × 7 (checkout l.105/108, orders l.190/193, payment l.160/198/201) TS2550 | `Object.hasOwn` est ES2022 ; les jumeaux sont aussi compilés sous `convex/tsconfig.json` (`lib` ES2021, exigé par Convex) | `commerceHas(row, clé)` — la primitive P06 (`commerce/primitives.ts:87`), qui EST `Object.prototype.hasOwnProperty.call(record, key)`, déjà employée par les jumeaux voisins `commerce-services.ts` et `commerce-jobs.ts` ; ajoutée à l'import des primitives. Écart assumé avec la consigne littérale : même vérification, idiome des contrats, aucune duplication. `lib` inchangée |
| Cliquet URL `commerce-payment.ts:166` | Le littéral `"https://"` de `url.startsWith("https://")` est lu comme une URL en dur | `/^https:\/\//u.test(url)` : préfixe exact sensible à la casse, sémantique identique ; même forme que l'expression voisine `/^https:\/\/[^/?#]*@/u` |

Règle des jumeaux : mêmes éditions appliquées aux deux copies par ancres uniques, puis `cmp` identique.
Empreintes SHA-256 finales (identiques des deux côtés) :

- `commerce-checkout.ts` `4b51acb8b9e1cda0bf6b0466f50322d42925551a5082f6034cb83f67a2737ae0`
- `commerce-orders.ts` `0ece6ddccfd12d4c37a62005ede6df733b6d9a3a3e4ff651aeed9831fe9055c7`
- `commerce-payment.ts` `17d22923237fb3fd1d13cdb68ebb6792f9ed8a1cafa6d1696c6e2e04f167f4a0`

Empreintes figées recherchées dans les deux dépôts : aucune ne porte sur ces trois fichiers (seul
`commerce-services.ts` a un `TWIN_SHA256`, fichier non modifié). La parité est contrôlée par
comparaison directe des octets dans `commerce-orders.test.ts` et `commerce-payment.test.ts` (copies
identiques dans les deux dépôts) : vertes. Le manifeste P06 n'est pas touché : conformité verte.

### 1.2 `contract: string` au lieu du littéral (ANTSIA seulement, 15 erreurs)

**Cause.** Les constantes `export const COMMERCE_…_CONTRACT = "PRO-COMMERCE-…-V1"` ont un type
littéral *élargissable* : dans un objet littéral sans type contextuel (`const base = {…}`, fonction ou
flèche sans type de retour), la propriété s'élargit en `string`. Corriger à l'usage plutôt qu'à la
déclaration : `COMMERCE_COMMAND_CONTRACT` vit dans le manifeste P06 (interdit) et les autres constantes
dans des jumeaux (dont `commerce-services.ts`, à empreinte figée).

**Correction : la valeur est typée par l'enveloppe du contrat (`Omit<Requête, champs d'opération>`).**

| Fichier | Erreurs | Correction |
|---|---|---|
| `A/convex/modules/shops/serviceRules.ts:193` (`p06ResponseRequest`) | l.198, 202, 206 | `const base: Omit<CommerceCommandRequest, "command" \| "payload" \| "scope">` |
| `A/convex/modules/shops/serviceRules.ts:217` (`controlResponseRequest`) | l.221, 225, 228 | `const base: Omit<CommerceServiceControlRequest, "operation" \| "payload">` |
| `A/convex/modules/shops/paymentFlow.ts:46` (`controlBase`) | l.63, 90, 127 | type de retour `Omit<CommercePaymentControlRequest, "operation" \| "payload">` |
| `A/convex/modules/shops/paymentClient.test.ts:23` | l.29–32 | `const base: Omit<CommercePaymentControlRequest, "operation" \| "payload">` |
| `A/convex/modules/federation/commerceCatalogClient.test.ts:14` | l.24, 63 | `const base = (): Omit<CommerceCatalogReadRequest, "operation" \| "payload"> => (…)` |

### 1.3 `A/convex/modules/shops/serviceFlow.ts` (23 erreurs)

**Cause.** Dans l'union `CommerceServiceControlResult`, la réponse `service.options`
(`CommerceServiceOptions`) porte AUSSI des champs `booking` (`null | { services }`) et `quote`
(`{ available }`). Le rétrécissement par `"booking" in result` / `"quote" in result` garde donc deux
membres : `result.booking` vaut `View | { services } | null`, d'où la cascade (l.607/609, 838–840,
854–860).

**Correction.** Exclure la réponse d'options par sa propre clé, vérifiée par le compilateur (aucune
garde de type maison) : `&& !("offerRef" in result)` (l.605, annulation) et
`|| "offerRef" in response.result` (l.836 relecture de devis, l.856 relecture de rendez-vous), avec un
commentaire. Effet à l'exécution : nul en pratique, la réponse étant déjà validée par le contrat contre
l'opération demandée ; une réponse d'options n'y serait plus lue comme un rendez-vous ou un devis
(refus/indisponible au lieu d'une lecture fausse).

### 1.4 Autres corrections Convex

| Erreur | Cause | Correction |
|---|---|---|
| `shops/jobApplications.ts:272` TS2345 + l.276 × 2 TS2339 | `shops.pageId` est `v.optional(v.id("pages"))` : `ctx.db.get(undefined)` ne se type pas, et la surcharge retenue faisait de `page` l'union de tous les documents (`handle`, `name` absents) | `shop?.pageId ? await ctx.db.get(shop.pageId) : null` (même forme que `catalogAccess.ts:27`, `operator.ts:35`) : boutique en brouillon → identifiant et nom publics `null` au lieu d'un `get(undefined)` |
| `shops/checkoutRules.ts:50` TS2322 | `...result` étalait `changes?: readonly …[]` ; la branche `{}` de l'étalement conditionnel gardait ce tableau en lecture seule, non assignable au type mutable du validateur | `const { changes, ...rest } = result`, puis `...rest` et copie de `changes` seulement s'il existe. Même sortie, sans clé `changes: undefined` |
| `shops/purchaseFlow.ts:133` TS2339 | Le membre refus/indisponible a un discriminant `"refused" \| "unavailable"` : deux tests négatifs successifs ne l'éliminent pas | Branche de refus écrite `outcome !== "accepted"` (équivalent : `unavailable` sort plus haut) ; `result` est alors typé |
| `federation/http.ts:57` TS2339 | Toutes les issues d'admission ne portent pas `status` | `"status" in admitted ? admitted.status : undefined` : réponse HTTP identique |
| `people/dataInventory.ts:100/107/112` TS2550 | `Object.hasOwn` hors `lib` ES2021 | `Object.prototype.hasOwnProperty.call(…)`, l'idiome du fichier (l.7, 25, 47, 69) |

## 2. Cliquets

| Cliquet | Cause | Correction |
|---|---|---|
| `i18n-locales` — `messagerie.conversation : outboxMessages.attachments_many absente en anglais` | Le français a la catégorie CLDR `many` ; l'anglais ne la choisit jamais, mais le cliquet exige les mêmes clés. Convention du dépôt : 39 des 40 clés `_many` françaises avaient déjà leur jumelle anglaise | `A/packages/social-features/src/i18n/locales/en/messagerie.conversation.json:153` : `"attachments_many": "{{count}} attachments"` |
| `no-hardcoded-urls` — `apps/antsia_ga/…/payment-fixtures.test-support.ts:8` | `*.test-support.ts` n'est pas un fichier de test pour `isTestFile` | L'URL fictive (un seul consommateur) vit désormais dans `payment-status-card.test.tsx:10`, fichier de test exclu du cliquet ; l'export est retiré du support |
| `no-hardcoded-urls` — `packages/social-domain/src/commerce-payment.ts:166` | Voir §1.1 | Expression rationnelle équivalente |
| `theme-contract` — `feed-immersion/immersive-styles.tsx : --fil-stage-h` | Règle exacte : tout `var(--x)` lu doit être déclaré dans `charte.css`, `theme.css`, `packages/ui/src/styles/*.css`, OU localement par le fichier qui le lit (`--x:`). `--fil-stage-h` n'est pas un jeton de thème : c'est une mesure posée en style en ligne par `ImmersiveFeedReader.tsx:614` sur `.fil-imm-scroller` ; le déclarer au contrat de la charte permettrait à un thème de le redéclarer | Jeton LOCAL : `--fil-stage-h: 100cqh;` sur `.fil-imm-scroller` (l.95), patron de `--icom-anchored-height` (`messagerie-styles.tsx:266`) ; en-tête de la feuille complété. Rendu inchangé : le style en ligne l'emporte après mesure ; avant, `100cqh` se résout à l'usage contre le même conteneur `fil-stage` que l'ancien repli ; les replis `var(--fil-stage-h, 100cqh)` sont conservés |

## 3. Ajout du coordinateur — N34 (`contextualMessaging`)

`A/convex/modules/contextualMessaging/contextualMessaging.test.ts:641` (« CC-2b — avis neutres >
N34 ») : `t.run` sérialise sa valeur de retour (convex-test 0.0.54 :
`jsonToConvex(JSON.parse(rawResult))`), un `undefined` revient `null`. L'assertion est faite DANS le
rappel (l.642, commentaire l.641) :
`await f.t.run(async (ctx) => { expect((await ctx.db.get(notice._id))?.readAt).toBeUndefined() })`.
Un échec s'y propage tel quel (`deserializeConvexErrorData` renvoie l'objet levé). Intention
inchangée : ouvrir ne marque rien comme lu.

## 4. Commandes exactes et résultats

| # | Commande | Résultat |
|---|---|---|
| 1 | `cd A && bunx tsgo --noEmit -p convex/tsconfig.json` | Avant (09:11) : 59 erreurs dans 14 fichiers (55 de ce lot + 4 `events/**`) ; après (09:21, puis 09:27) : **0**, sortie 0 |
| 2 | `cd A && bunx tsgo --noEmit -p packages/social-domain/tsconfig.json` | Avant : 1 (`commerce-checkout.ts:48`) ; après : **0** |
| 3 | `cd A && bunx tsgo --noEmit -p packages/social-features/tsconfig.json` | **0** |
| 4 | `cd A && bunx vitest run --config tests/vitest.config.ts tests/ratchets/i18n-locales.test.ts tests/ratchets/no-hardcoded-urls.test.ts tests/ratchets/theme-contract.test.ts` | Avant : 3 échecs sur 9 ; après : **9/9** |
| 5 | `cd A && bunx vitest run --config tests/vitest.config.ts tests/ratchets` | **25/25 fichiers, 140/140 tests** |
| 6 | `bun run --cwd A/packages/social-domain test -- commerce` | **12 fichiers, 155/155** (dont parité octet pour octet orders, payment, services, inquiry et conformité P06 « copies PRO.GA identiques ») |
| 7 | `cd P && bun test packages/pro-domain/tests` | **60 fichiers, 775 pass, 0 fail** |
| 8 | `cd P && bun test packages/pro-domain/src/commerce-checkout.test.ts packages/pro-domain/src/commerce-orders.test.ts packages/pro-domain/src/commerce-payment.test.ts packages/pro-domain/src/commerce-payment-lifecycle.test.ts` | **4 fichiers, 37 pass, 0 fail** |
| 9 | `cd P/packages/pro-domain && ./node_modules/.bin/tsc --noEmit -p tsconfig.json` (TS 6.0.3) | **0 erreur dans les jumeaux** ; 4 erreurs préexistantes ailleurs (§5) |
| 10 | `cd A && bunx vitest run --config convex/vitest.config.ts modules/contextualMessaging` | **2 fichiers, 56/56** |
| 11 | `cd A && bunx vitest run --config convex/vitest.config.ts modules/people` | **15 fichiers, 154/154** (exports et effacements commerce compris) |
| 12 | `cd A && bunx vitest run --config convex/vitest.config.ts modules/shops` | 13 fichiers, 182/188 : 6 échecs hors de ces corrections (§5) ; `services.test.ts` (serviceFlow/serviceRules) vert |
| 13 | `cd A && bunx vitest run --config convex/vitest.config.ts modules/federation` | 8 fichiers, 186/190 : 4 échecs hors de ces corrections (§5) ; tests de l'inbox HTTP (`http.ts`) et `commerceCatalogClient.test.ts` verts |
| 14 | `cd A/apps/antsia_ga && bunx vitest run --passWithNoTests src/components/payment` | 4 fichiers verts (85 tests) ; 2 suites non chargées (PostCSS, §5) |
| 15 | `cd A/packages/social-features && bunx vitest run --passWithNoTests src/features/feed-immersion` | 5/7 fichiers verts, dont `ImmersiveFeedReader.test.tsx` (assertions de la feuille) ; 12 échecs d'environnement (§5) |
| 16 | `bunx eslint` ciblé : 3 jumeaux (`social-domain`), `immersive-styles.tsx` (`social-features`), 2 fichiers de paiement (`antsia_ga`) | **0 problème** |
| 17 | `cd A && bunx tsgo --noEmit -p apps/antsia_ga/tsconfig.json` | 20 erreurs, **aucune dans les fichiers modifiés** (§5) |

## 5. Erreurs restantes hors de mon périmètre, et propriétaires

Aucune n'est causée par ces corrections (fichiers et chemins d'exécution distincts, ou suites qui
échouent à l'identique sans être touchées). Non corrigées : hors relevé confié.

**Typage de l'application `apps/antsia_ga` (20, hors relevé `typecheck:convex`).**
`components/shops/contact-crm.tsx` × 9 (`consentedAt`, `revokedAt`, `selectedText`, `displayName` lus
sur une union non rétrécie — P10) ; `components/shops/offer-card.test.tsx` × 5 (objet possiblement
`undefined`, options de prix non assignables — P07/P09) ; `components/shops/member-shop-directory.test.tsx`
× 1 (`@testing-library/react` introuvable — P07) ;
`components/discovery/member-feed.tsx` × 3 (province `string` vs union du résolveur Zod — fil) ;
`components/services/service-slot-picker.tsx:61` × 1 (`string` vs `"Africa/Libreville"` — P14) ;
`lib/cart-draft.test.ts:13` × 1 (étalement hors tuple — P11).

**Typage PRO.GA `pro-domain` (4, hors jumeaux).** `tests/commerce-marketplace.test.ts` l.9, 13, 14 et
`tests/commerce-services.test.ts:44` (surcharges de `expect`) — PRO.GA (lots P12/P14, agent
« finitions » pour les paiements).

**Tests Convex `modules/shops` (6) — « écrits, non exécutés » selon les rapports P07/P11/P12/P15.**
- `shops.test.ts:108`, `:119`, `:237` — le test lit `engineErrorRule(e)?.rule` (règle de domaine) alors
  que le code lève `failAppRule("shop_publication_closed" | "shop_consent_outdated")` (`appRule`) — P07.
- `checkout.test.ts:212` — `ConvexError profileRequired` levé par `people/memberships.ts:60` pendant le
  montage — P11.
- `jobApplications.test.ts:209` — `rateLimited` (`lib/functions.ts:75`, seau d'écriture) pendant le
  scénario de rejeu — P15.
- `paymentFlow.test.ts:268` (variante « checkout ») — le contrat (`readOptions`, `sameRef`) rejette la
  corrélation, `finishOptions` rend `unavailable` ; le test attend `refused` — P12 (trancher test ou
  code).

**Tests Convex `modules/federation` (4).** `agentConsentTransfer.test.ts:271` et
`reseauPublicAgents.test.ts:293` (l'export rend `[]` pour les tables d'agents — PA9C/PA9D) ;
`federation.test.ts:250` (lettre morte `attempts` 2 au lieu de 1 après rejeu — PA5) ;
`reseauPublicPosts.test.ts:192` (auteur objet au lieu de `null` — PA9B).

**Environnement.**
- `payment-status-card.test.tsx` et `payment-status-card.announce.test.tsx` (ce dernier non modifié) ne
  se chargent pas : « Failed to load PostCSS config: Invalid PostCSS Plugin found at plugins[0] » en
  transformant la feuille de `@livekit/components-styles` — configuration PostCSS d'`antsia_ga` sous
  vitest.
- `use-feed-mode.test.tsx` et `use-feed-immersion.test.tsx` : `window.localStorage.clear is not a
  function` — `localStorage` global de Node 25.9.0 sans `--localstorage-file` ; à exécuter sous Node 22
  (comme `scripts/convex-dev.mjs`) ou à isoler dans la configuration de test.

**DIASPORALE.** Les 4 erreurs de `convex/modules/events/agendaPagination.test.ts` (relevé de 09:11) ont
disparu au passage suivant (fichier modifié à 09:09 par sa session).

## 6. Fichiers modifiés

- Jumeaux : `A/packages/social-domain/src/commerce-{checkout,orders,payment}.ts` et
  `P/packages/pro-domain/src/commerce-{checkout,orders,payment}.ts`.
- `A/convex/modules/shops/{serviceFlow,serviceRules,paymentFlow,paymentClient.test,jobApplications,checkoutRules,purchaseFlow}.ts`.
- `A/convex/modules/federation/{http,commerceCatalogClient.test}.ts`.
- `A/convex/modules/people/dataInventory.ts`.
- `A/convex/modules/contextualMessaging/contextualMessaging.test.ts`.
- `A/packages/social-features/src/i18n/locales/en/messagerie.conversation.json`.
- `A/packages/social-features/src/features/feed-immersion/immersive-styles.tsx`.
- `A/apps/antsia_ga/src/components/payment/{payment-fixtures.test-support.ts,payment-status-card.test.tsx}`.

## 7. Seconde passe — backend

19 octobre 2026, 09:30–09:45, agent « backend » sous coordination. Lot : `convex/modules/shops` et
`convex/modules/federation` au vert, en corrigeant la cause après avoir établi, pour chaque échec, qui
du code ou du test contredit sa source.

**Verdict : shops 182/188 → 188/188 ; federation 186/190 → 190/190 ; modules voisins verts ; typage
Convex 0 ; cliquets 140/140.** Sur les dix échecs, neuf venaient du test (fixture ou attente contraire à
sa source) et un du code (`federation/replay.ts`, comptage d'un rejeu dédoublonné). Aucun comportement
de sécurité n'est modifié : admission de débit, refus indistinct, corrélation des contrats et instantané
d'export sont inchangés.

Interdits respectés : aucune écriture git, aucun `codegen`, `verify`, commande `convex`, serveur,
navigateur ni installation ; aucun `.env*`, `package.json`, `bun.lock`, `_generated`, `diaspora/**`,
`events/**`, ni fichier d'`apps/antsia_ga` ou de PRO.GA touché. Chaque fichier a été modifié par une
ancre unique, relue juste avant. `replay.ts`, poussé en continu par le `convex dev` :3210, a été modifié
en une seule écriture cohérente.

### 7.1 Échec → source qui fait foi → correction

| Échec | En faute | Source qui fait foi | Correction |
|---|---|---|---|
| `shops.test.ts:108`, `:119` (`shop_publication_closed`) et `:237` (`shop_consent_outdated`) : `engineErrorRule(e)?.rule` vaut `undefined` | Test | `packages/social-contracts/src/errors.ts` : un refus d'application voyage dans `appRule`, et « `rule` reste réservé aux règles du domaine du moteur (`DOMAIN_RULES`) ». `shops/rules.ts:96-97` définit `SHOP_RULES` comme des refus MÉTIER traduits par l'application. Le lecteur client (`shop-model.ts`, `shopErrorText`) appelle d'abord `engineErrorAppRule` | Assistant `shopRefusal` (code + `engineErrorAppRule`) et attentes `{ code: "policyRefused", appRule: "shop_publication_closed" }` (× 2) puis `{ code: "consentRequired", appRule: "shop_consent_outdated" }`, soit les codes exacts de `failAppRule` (`decisions.ts:59`, `shops.ts:532`, `shops.ts:587`) |
| `checkout.test.ts:212` : `profileRequired` pendant le montage | Test (fixture) | EXF-AN-02 et l'en-tête de `people/memberships.ts` : entrer « exige le consentement au profil social et un profil choisi ». Invariant : aucun profil ni adhésion créé d'office. Les voisins suivent ce patron (`paymentFlow.test.ts:229-232`, `purchase.test.ts:151-154`) | L'« autre acheteur » consent (`social_profile`) et publie son profil avant `joinNetwork`. L'assertion du scénario (aucun reçu lu par autrui) est inchangée |
| `jobApplications.test.ts:209` : `rateLimited` (`retryAfterMs` 28 800 000) au rejeu | Test | ADR-0009 §4 : « L'admission de débit appartient aux constructeurs […] renforcés pour les membres déclarés sans badge de confiance ». Même ordre dans l'invariant « adhésion → éligibilité → limitation de débit → droit » et dans `lib/functions.ts`. Le candidat est `declaree` sans badge, donc soumis à `shop.job.apply.reinforced` (capacité 1, 3 par jour : un envoi par 8 h), consommé AVANT le handler, rejeu compris. Le rapport P15 (décision 4) fixe la règle d'idempotence du handler, pas une exemption de débit | Dans ce scénario seulement, le candidat reçoit un lien IDN loa 2, ce qui le place sous le seau ordinaire (capacité 3). C'est le patron DIASPORALE (`diaspora/jobs.test.ts:64-76`, « Un membre à identité forte (IDN loa 2) : seaux de débit ordinaires »). Code non modifié |
| `paymentFlow.test.ts:268` (variante `checkout`) : `unavailable` au lieu de `refused` | Test | Contrat jumeau `commerce-payment.ts` : `readOptions` → `sameRef` → `correlation_mismatch`, éprouvé par `commerce-payment.test.ts:83` (copies identiques ANTSIA/PRO.GA). Transport `paymentClient.ts:60-64` : `sendPaymentControl` rend `null`, puis `finishOptions` rend `unavailable`. Même convention dans `finish` : un `authorize_start` non corrélé donne `unavailable` (`authorization_unavailable`). `refused` est réservé à une réponse CORRÉLÉE qui contredit le hold (montant, échéance : `paymentFlow.ts:172`) ou à un refus PRO.GA corrélé | Attente `unavailable` pour `checkout` et `refused` pour `amount`/`expiry`. L'intention du test (« ne cache pas », `refresh_required`) reste vérifiée pour les trois |
| `federation.test.ts:250` : `attempts` vaut 2 au lieu de 1 après un rejeu dédoublonné | Code | Le test PA5 commité (`639d987`, vert au passage final PA5, docs/07 « Fédération ») et le code PA5 commité : seul `still_failing` écrivait la lettre, car « le nombre de tentatives porte l'observabilité du rejeu ». ADR-0013 §5 (PA9A) : « résoudre la lettre morte seulement après succès. La console distingue application, dédoublonnage et nouvel échec ». La branche `else` ajoutée par PA9A (non commitée) comptait une tentative et datait `lastAttemptAt` alors que le dédoublonnage n'applique rien | `replay.ts` : `applied` est inchangé (tentative comptée, lettre résolue, reçu appliqué). `deduplicated` ne compte aucune tentative ; une lettre encore ouverte est seulement close (`status: "resolved"`, `resolvedAt`), le reçu appliqué faisant foi. La trace du rejeu reste écrite (`federationReplayAudit`, `engineAudit`). Aucun contrôle d'accès ni d'intégrité n'est touché |
| `reseauPublicPosts.test.ts:192` (PA9B) : l'auteur est un objet au lieu de `null` | Test | ADR-0014 §1 : « Le DTO membre conserve un objet auteur neutre avec identifiant nullable ». docs/16 : « objet `author` neutre avec `personId: null` ». Le validateur `posts.ts` déclare `author: authorValidator`, objet non nullable : `null` serait refusé par `returns` | Attente de l'objet neutre complet `{ personId: null, handle: null, displayName: null, headline: null, avatarUrl: null, badges: [] }`. Elle est plus stricte : aucune donnée de personne ne passe |
| `reseauPublicAgents.test.ts:293` (PA9C) et `agentConsentTransfer.test.ts:271` (PA9D) : l'export rend `[]` | Test (horloge du harnais) | Règle PA5 commitée (`639d987`) : `exportMyDataPage` exclut toute ligne créée après la demande (`row._creationTime > job.requestedAt`). Sous l'horloge figée à T0, convex-test 0.0.54 date les insertions d'une même milliseconde à « précédente + 0,001 » (`dist/index.js:105`) : le grant vaut T0 plus une fraction, la demande vaut T0 pile, le grant passe donc pour postérieur | `vi.setSystemTime(Date.now() + 1_000)` avant `exportMyData` : la demande suit la création, comme en réel, et le code PA9D reste valide (10 min). Les assertions d'exclusion (empreintes, nonce, code, `IDN_SUB`) portent désormais sur une ligne réellement exportée ; elles n'étaient pas atteintes avant |

**Observations au propriétaire (code inchangé).**
- Emploi : un compte léger (membre déclaré sans badge) dont la réponse à `apply` se perd ne peut
  rejouer sa clé qu'après environ 8 h, car le rejeu consomme le seau renforcé. C'est conforme à
  ADR-0009 §4. Relire la clé avant l'admission de débit serait une décision de produit et de sécurité,
  pas une correction de test.
- Export : en production, une ligne validée dans la même milliseconde que la demande d'export
  pourrait en être exclue par la règle PA5 (cas limite, non modifié).

### 7.2 Commandes exactes et résultats

| # | Commande (depuis `A/`) | Résultat |
|---|---|---|
| 1 | `bunx vitest run --config convex/vitest.config.ts modules/shops` | 09:31 : 13 fichiers, 182/188 (les 6 échecs ci-dessus) ; 09:41 : **13 fichiers, 188/188** |
| 2 | `bunx vitest run --config convex/vitest.config.ts modules/federation` | 09:32 : 8 fichiers, 186/190 ; 09:42 : **8 fichiers, 190/190** |
| 3 | `… modules/people` | **15 fichiers, 154/154** |
| 4 | `… modules/notifications` | **6 fichiers, 57/57** |
| 5 | `… modules/moderation` | **6 fichiers, 43/43** |
| 6 | `… modules/contextualMessaging` | **2 fichiers, 56/56** |
| 7 | `… modules/commercialMessaging` | **2 fichiers, 32/32** |
| 8 | `bunx tsgo --noEmit -p convex/tsconfig.json` (inclut les `*.test.ts`) | **0 erreur**, sortie 0 |
| 9 | `bunx vitest run --config tests/vitest.config.ts tests/ratchets` | **25/25 fichiers, 140/140**, dont `operator-audit` sur `replay.ts` |

Aucun lint : aucune configuration ESLint ne couvre `convex/`. Le `verify` commun (codegen compris)
reste au coordinateur.

### 7.3 Fichiers modifiés

- Code : `A/convex/modules/federation/replay.ts` (une branche).
- Tests : `A/convex/modules/shops/{shops,checkout,jobApplications,paymentFlow}.test.ts` et
  `A/convex/modules/federation/{reseauPublicPosts,reseauPublicAgents,agentConsentTransfer}.test.ts`.
- Ce rapport (§7).

Retour arrière : par fichier ; aucune donnée ni aucun schéma touchés.

## 8. Seconde passe — applications

19 octobre 2026, 09:30–10:00, agent « applications » sous coordination. Lot : typage de
`apps/antsia_ga` (les 20 erreurs du §5), environnement de test (feuille livekit sous Vitest,
`localStorage` de Node 25), puis suites de `apps/antsia_ga`, `packages/social-features` et
`apps/admin_antsia_ga`, en établissant pour chaque échec la source qui fait foi.

**Verdict : typage `antsia_ga` 20 → 0 (et 0 pour `social-features`, `api`, `admin_antsia_ga`,
`social-domain`, `social-contracts`, `ui`, `tests/`) ; `antsia_ga` 86/86 fichiers, 621/621 ;
`social-features` 254/255, 3911/3912 (seul échec : DIASPORALE, DG-023) ; `admin_antsia_ga` 9/9,
81/81 ; `api` 12/12, 193/193 ; cliquets 140/140, sous Node 25.9.0 (celui que `verify` donne à
Vitest ici). Mêmes chiffres sous Node 22.22.3 pour `antsia_ga`, `social-features` et
`admin_antsia_ga`.** Aucun `as any`, `@ts-ignore`, `@ts-expect-error`. Aucun type d'API
ne dépend ici du codegen : `convex/_generated/api.d.ts` (régénéré à 09:09 par le `convex dev`
:3210) couvre tous les modules, et les types viennent du code (`typeof module`). Un module Convex
ajouté plus tard sans codegen le redeviendrait. Aucun comportement de sécurité n'est modifié.

Interdits respectés : aucune écriture git, aucun `codegen`, `verify`, commande `convex`, serveur,
navigateur ni installation ; aucun `.env*`, `package.json`, `bun.lock`, `_generated`, primitive UI,
pont de session, `convex/**` ni fichier de `../DIASPORALE` touché (lecture seule de ses deux
`vitest.setup.ts`). Aucun sous-agent. Chaque fichier existant a été modifié par une ancre unique,
relue juste avant.

### 8.1 Typage de `apps/antsia_ga` — erreur → cause → correction

| Erreur | Cause | Correction |
|---|---|---|
| `shops/contact-crm.tsx:46-48` × 9 (`consentedAt`, `revokedAt`, `selectedText`, `displayName`) | Le type de `getMyTransfer` est celui de son `handler` (`crm.ts:47-48`) : l'union `{ state: "none"; textVersion }` \| demande enregistrée. Lire ces champs sur l'union non rétrécie est refusé | `const recorded = transfer.data?.state === "none" ? undefined : transfer.data`, puis lectures sur `recorded`. Rendu identique : la réponse « none » ne porte jamais ces champs, `undefined` dans les deux cas |
| `discovery/member-feed.tsx:53` × 2 et `:56` | Le prédicat de `refine` (`value === "" \|\| isProvinceSlug(value)`) est inféré (TS ≥ 5.5) : la SORTIE devient l'union des provinces, l'entrée reste `string`. `useForm<z.infer<…>>` typait le formulaire par la sortie | `type ProvinceFilterValues = z.input<typeof provinceFilterSchema>`, convention du dépôt (`purchase-model.ts`, `checkout-model.ts`, `shop-model.ts`). Soumission inchangée (`isProvinceSlug` relu) |
| `services/service-slot-picker.tsx:61` | `COMMERCE_SERVICE_TIME_ZONE` est typé par le littéral `"Africa/Libreville"` : `useState(SERVICE_AGENDA_TIME_ZONE)` en infère l'état, alors que `displayTimeZones` propose aussi le fuseau de l'appareil (`string`) | `useState<string>(SERVICE_AGENDA_TIME_ZONE)` : fuseau d'affichage, celui de l'agenda au départ |
| `shops/offer-card.test.tsx` × 5 | `noUncheckedIndexedAccess` : `variants[0]` et `media[0]` peuvent valoir `undefined`, et leur étalement donne des champs facultatifs | `catalogVariantFixture(changes)` ajoutée à `__tests__/catalog-fixtures.ts`, et employée par `catalogOfferFixture` avec les mêmes valeurs. Photo tenue dans une constante. Assertions inchangées |
| `shops/member-shop-directory.test.tsx:2` | `@testing-library/react` n'est pas déclaré par `antsia_ga` (linker isolé : absent de `apps/antsia_ga/node_modules`). Le test ne pouvait ni se typer ni se charger | Porté sur la convention de l'application : `createRoot` + `act`, requêtes par rôle explicite, un rôle attendu devant être unique comme avec `getByRole`. Quatre cas, mêmes assertions (`null` devient `undefined`) |
| `lib/cart-draft.test.ts:13` | Une union de tuples (`as const`) ne s'étale pas sur des paramètres fixes (TS2556) | Déstructuration `const [networkId, personId, at] = args` |

### 8.2 Environnement de test

**a) Feuille livekit, « Invalid PostCSS Plugin found at plugins[0] »** (`payment-status-card` et
`.announce`). Chaîne d'imports établie : `payment-status-card` → `shops/shop-ui` (`ShopLink`) →
`member-chrome` → `network-shell` → `@antsia/social-features/shell` → `communication-shell` →
`communication/direct-session-host` → `components/direct/DirectRoomMount.tsx:41`
(`import "@livekit/components-styles"`). Vitest vide la feuille (`vitest:css-disable`, option
`test.css` par défaut), en supposant que Vite ne fait alors rien. Or Vite 8.3.4 (`compilePostCSS`)
résout la configuration PostCSS AVANT de tester la feuille vide. Celle de Next
(`postcss.config.mjs`, `plugins: ["@tailwindcss/postcss"]`, greffons nommés par chaîne : forme
propre à Next) est refusée par postcss-load-config.

**Correction** : `apps/antsia_ga/vitest.config.ts` déclare `css: { postcss: { plugins: [] } }`.
Une configuration en ligne n'est jamais cherchée sur disque. Le test seul est concerné : Next ne lit
pas ce fichier, `next dev` et `next build` lisent toujours `postcss.config.mjs`. Écartés :
- forme objet dans `postcss.config.mjs` : elle change la configuration de construction, non
  vérifiable ici sans build ;
- alias de la seule feuille livekit : il ne vaut que pour elle ;
- import paresseux dans `DirectRoomMount` : il change le chargement réel, et `diasporale_com`, dont
  la mise en page n'importe pas la feuille, en dépend.

Résultat : `src/components/payment` passe de 4 fichiers, 85 tests et 2 suites non chargées à
**6/6 fichiers, 105/105**.

**b) `window.localStorage.clear is not a function`** (`use-feed-mode`, `use-feed-immersion`).
Cause établie :
- Node 25.9.0 pose sur le global un accesseur `localStorage` configurable. Sans
  `--localstorage-file`, il rend un objet vide, sans `clear` ni `getItem`, et avertit (sonde `node -e`).
- L'environnement jsdom de Vitest 4.1.10 (`populateGlobal`, `getWindowKeys`) ne recopie une clé de
  fenêtre déjà présente sur le global que si elle figure dans sa liste fixe `KEYS`, où
  `localStorage` n'est pas. Le stockage de jsdom n'est donc pas posé. Et `window` EST le global :
  `window.localStorage` est l'objet vide de Node.
- Node 22 n'a pas ce global, d'où le passage.

**Correction** : le bloc DIASPORALE est repris tel quel dans
`packages/social-features/vitest.setup.ts`. Si `localStorage` existe sans méthodes, un `Storage` en
mémoire conforme est posé sur `globalThis` et `window` par `Object.defineProperty(…, {
configurable: true, value })`. Rien ne change sous Node 22. La provenance figure en commentaire
(« Bloc repris tel quel de `../DIASPORALE/packages/diasporale-features/vitest.setup.ts` »). Elle ne
prend pas la forme `Dupliqué de … @ <commit>` : le cliquet `provenance-headers` réserve cet en-tête
aux copies du socle à un commit répertorié, et la source DIASPORALE n'est pas commitée.

`apps/antsia_ga` n'en dépend pas : ses suites posent leur propre stockage (`theme-picker`
`vi.stubGlobal`, `preferences-controls` `defineProperty`), et `sessionStorage` est fonctionnel sous
Node 25. Ses suites passent sous les deux Node sans ce bloc.

Bruit résiduel, sans effet : l'avertissement « `--localstorage-file` was provided without a valid
path » est émis une fois par processus de test, à la lecture de l'accesseur.

### 8.3 Suites — échec → source qui fait foi → correction

| Échec | En faute | Source qui fait foi | Correction |
|---|---|---|---|
| `antsia_ga` `jobs/job-application-form.test.tsx` : suite non chargée, `api.modules.graph` indéfini (`use-dual-connection-pagination.ts:68`) | Test (maquette) | Le formulaire ne rend pas la coque membre. `shop-ui` l'importe, et son graphe lit des références du moteur au chargement, absentes de la maquette partielle de `@antsia/api/engine`. Patron voisin : `purchases-screen.test.tsx` | `vi.mock("@/components/member-chrome", …)` (coque légère), comme le test voisin |
| `antsia_ga` `purchases/purchases-screen.test.tsx:94` (P13) : `disabled` vaut `false` au retour du réseau | Test | La case d'accord est dans `<fieldset disabled={paused}>` (`purchases-screen.tsx:125`). La propriété `disabled` d'une case ne reflète que son propre attribut. L'état effectif est `:disabled` : sonde jsdom (`disabled` vaut `false`, `matches(":disabled")` vaut `true`, un clic ne coche pas) | Assertions sur `matches(":disabled")`, vrai au retour puis faux après actualisation. Garde inchangée : fieldset, et `!paused && navigator.onLine` à la soumission |
| `antsia_ga` `public-post-continuation.test.tsx` (P03) et `notification-continuation.test.tsx` (P05) : 4 + 4 échecs, `Usage permission provider missing` / `reading 'slug'` | Test (harnais) | `SessionState` (`use-session-state.ts:19-25`) : les états admis portent `person` et `root`. `Providers` monte `UsagePermissionProvider` (`providers.tsx:78`). La mesure d'entrée de PA10 (`welcome-screen.tsx:41-45`) les lit | Session doublée conforme au type : personne sans accord de mesure, racine `{ slug }`. Montage sous `UsagePermissionProvider`. Côté notification, routeur doublé STABLE : celui de Next l'est, alors qu'un objet neuf à chaque rendu relançait l'effet (deux `replace` identiques, « exactement une fois » en échec). Attentes inchangées |
| `social-features` `IcomAppelJournal.test.tsx` × 4 : pas d'export `useConvexAuth` dans la maquette | Test (maquette, fixture) | Composant P10/CC-5 (`IcomAppelJournal.tsx:52-57`) : `useConvexAuth`, `useConvex`, porte `commercialMessaging.calls.startCall`. Contrat serveur `calls/direct.ts:30-31` : `calleePersonId` dans les deux issues | Maquettes complétées, fixtures de `callMember` avec `calleePersonId`, en-tête de provenance complété. Assertions inchangées |
| `social-features` `MessagerieListView.destinations.test.tsx` (P05) : « Aucune conversation individuelle pour le moment. », sans « Charger plus pour chercher » | **Code** | P05 §1 : recherche et filtres portent sur les données chargées, « cette portée est annoncée ». Test voisin `MessagerieListView.test.tsx:280` (« une recherche sans résultat AVOUE… ») et commentaire du composant : un vide affirmé avant d'avoir tout chargé est un mensonge. P05 avait exempté la première branche (`totalConversations === 0 && (!destinationMode \|\| !canLoadMore)`), pas la suivante | `totalDansFiltre === 0 && (!destinationMode \|\| !canLoadMore)`. La branche suivante avoue le vide de la fenêtre et offre le chargement. Inchangés : dock (hors destination), filtre Groupes (`canLoadMore` faux) et boîte épuisée |
| `social-features` `source-writes.test.tsx` (PA6) × 2 : `idempotencyKey` inattendue au premier message ; brouillon `undefined` après refus | Test | Rapport P05 §2 : `startThreadWithHandle` accepte une clé d'idempotence, et « le texte reste disponible pendant l'aller-retour et après refus ». Le texte vit au magasin et n'est effacé qu'à l'admission (`MessagerieConversationView.tsx:848-850`). Le test appelait `onSend` sans avoir jamais frappé | Attente `idempotencyKey: expect.any(String)`. La frappe passe par `onChange` du composeur avant les deux envois refusés. Assertions conservées : brouillon gardé, même clé, erreur lisible sans trace serveur |
| `social-features` `global-call-surface-host.test.tsx` (P05) : bouton « rappeler » absent | Test | Règle de sécurité P10/CC-5 (`call-end-actions.ts`) : sans projection lisible de l'appel, aucun geste. Testé par `call-end-actions.test.ts` (« ferme les gestes quand l'autorité n'est plus lisible ») | Le test fournit le refus « occupé » d'un appel PERSONNEL tel que le serveur l'enregistre (`insertRefusedCall` : `ended`, `declined`, `busy`). **Code inchangé** |
| `social-features` `PostReactionControl.p18b.test.tsx` (P18b, A11) : écouteur du document appelé une fois | Test | `PostReactionControl.tsx:271-291` : seule Échap est capturée sur `window` et arrêtée. La flèche de navigation du test se propage normalement : c'est l'appel reçu | Vérifie qu'aucun `Escape` n'atteint le document (`vi.fn<(event: KeyboardEvent) => void>()`) |

### 8.4 Autres sessions (non corrigé)

- **DIASPORALE, DG-023** : `packages/social-features/src/features/reseau-personnel/association-agenda.test.ts:43`.
  Attendu `['personal', 'collective']`, obtenu `['personal']`. La fixture
  `cancelled = { ...collective, … }` garde le même `eventId`. `groupAgendaEvents` dédoublonne par
  `eventId` : la copie annulée, vue la première, va à l'historique, et l'occurrence programmée est
  écartée. Fixture ou règle de dédoublonnage à trancher par la session DIASPORALE.
- `session-bridge*`, `entrer/**`, `access-home*` : aucun échec (`antsia_ga`, `api`).
- Observation au propriétaire : sous Node 25, le serveur `next dev` voit aussi un `localStorage` global
  sans méthodes. Une garde `typeof localStorage !== "undefined"` s'y laisserait tromper, par exemple
  `packages/api/src/cross-domain-session-bootstrap.ts:399`, côté pont de session. La production
  tourne sous `node:22-alpine` (`apps/antsia_ga/Dockerfile:43`).

### 8.5 Commandes exactes et résultats

| # | Commande (depuis `A/`) | Résultat |
|---|---|---|
| 1 | `bunx tsgo --noEmit -p "$PWD/apps/antsia_ga/tsconfig.json"` | Avant : 20 erreurs (§5) ; après les corrections, puis en fin de passe : **0** |
| 2 | Même commande pour `packages/{social-features,api,social-domain,social-contracts,ui}`, `apps/admin_antsia_ga` et `tsconfig.json` racine | **0** partout |
| 3 | `bun run --cwd "$PWD/apps/antsia_ga" test -- src/components/payment` | 09:37 : 2 suites non chargées (PostCSS) ; 09:40 : **6/6, 105/105** |
| 4 | `bun run --cwd "$PWD/packages/social-features" test -- use-feed-` | Avant : 12 échecs ; 09:45 : **2/2, 12/12** (Node 25), et **12/12** sous `PATH=/opt/homebrew/opt/node@22/bin:$PATH` |
| 5 | `bun run --cwd "$PWD/apps/antsia_ga" test` | 09:41 : 82/86, 608/617 (9 échecs, 1 suite non chargée) ; 09:47 : **86/86, 621/621** ; Node 22 (09:59) : **86/86, 621/621** |
| 6 | `bun run --cwd "$PWD/packages/social-features" test` | 09:47 : 249/255, 3902/3912 (10 échecs) ; 09:56 : **254/255, 3911/3912** (DG-023) ; Node 22 (09:59) : identique |
| 7 | `bun run --cwd "$PWD/apps/admin_antsia_ga" test` | **9/9, 81/81** (Node 25 et 22) |
| 8 | `bun run --cwd "$PWD/packages/api" test` | **12/12, 193/193** |
| 9 | `bunx vitest run --config tests/vitest.config.ts tests/ratchets` | **25/25, 140/140** (dont `provenance-headers`) |
| 10 | `bunx eslint <fichiers modifiés>` dans `apps/antsia_ga` et `packages/social-features` | **0 erreur**. Trois avertissements `react-hooks/refs` préexistants, hors lignes modifiées : `contact-crm.tsx:53`, `MessagerieListView.tsx:158` × 2 |

### 8.6 Fichiers modifiés

- `A/apps/antsia_ga` :
  - code : `src/components/shops/contact-crm.tsx`, `src/components/discovery/member-feed.tsx`,
    `src/components/services/service-slot-picker.tsx` ;
  - configuration de test : `vitest.config.ts` ;
  - tests : `src/components/shops/{offer-card.test.tsx,member-shop-directory.test.tsx,__tests__/catalog-fixtures.ts}`,
    `src/lib/cart-draft.test.ts`, `src/components/jobs/job-application-form.test.tsx`,
    `src/components/purchases/purchases-screen.test.tsx`,
    `src/components/{public-post-continuation,notification-continuation}.test.tsx`.
- `A/packages/social-features` :
  - code : `src/features/messagerie/MessagerieListView.tsx` (une condition, en-tête complété) ;
  - environnement : `vitest.setup.ts` ;
  - tests : `src/features/messagerie/{IcomAppelJournal,source-writes}.test.tsx`,
    `src/shell/communication/global-call-surface-host.test.tsx`,
    `src/features/reseau-personnel/PostReactionControl.p18b.test.tsx`.
- Ce rapport (§8).

Retour arrière : par fichier ; aucune donnée, aucun schéma, aucune dépendance touchés.

## 9. Après le verify n° 1 — tests pollués par PA10

19 octobre 2026, 10:12–10:40, agent « PA10 » sous coordination. Lot : cinq des six échecs du verify
commun n° 1 (journal `verify-1.log` du coordinateur, 10:05–10:10 : arrêt aux tests Convex,
2538/2544). Le sixième, `modules/pages/signatories.test.ts:229`, appartient à DIASPORALE (réécriture
en cours) : non touché.

**Verdict : les cinq échecs viennent des tests, pas du code. Ils sont corrigés dans les tests
seulement, sans relâcher aucune garantie.** Les quatre fichiers ciblés passent (**4/4, 53/53**).
Absence de régression sur `modules/calls`, `modules/live`, `modules/posts` et `lib` : **46/46
fichiers, 712/712 tests**. Typage Convex : **0**.

Interdits respectés : aucune écriture git, aucun `codegen`, `verify`, commande `convex`, serveur,
navigateur ni installation. Aucun `.env*`, `package.json`, `bun.lock`, `_generated`, `diaspora/**`,
`events/**` ni `pages/signatories.test.ts` touché. Aucun sous-agent. Chaque fichier a été modifié par
une ancre unique, relue juste avant. L'instrumentation provisoire du test de charge (§9.3) est
retirée.

### 9.1 Constat → cause

| # | Échec (ligne du verify) | Attendu | Reçu |
|---|---|---|---|
| 1 | `lib/livekitEgressWebhookRoute.test.ts:336` « en ÉCHEC déclaré… » | `{ jobs: 0, files: 0 }` | `{ jobs: 1, files: 0 }` |
| 2 | `modules/calls/cleanup.test.ts:119` « 123 composés périmés… » | 1 tâche | 3 |
| 3 | `modules/calls/cleanup.test.ts:153` « un jeune en tête… » | la seule suite `{ callStatus, cursor, now: T0 }` | 15 tâches, dont 14 étapes `{ cursorId, generation, step }` de `feedCursors` |
| 4 | `modules/live/reap.test.ts:283` « bail éteint ET grâce écoulée… » | `[expireSessionInvitations]` | trois `feedMaterialization:backfill`, puis `expireSessionInvitations` |
| 5 | `modules/posts/feedMaterialization.test.ts:295` « diffuse cinq mille abonnés… » | ≤ 120 s | délai dépassé (167,8 s) |

**Points 1 à 4 : l'amorce planifie le rattrapage PA10 du fil.**
- `people/memberships.ts:78` : `joinNetwork` appelle `refreshReaderContexts`. Ensuite,
  `posts/feedMaterialization.ts:57` (`refreshReaderFeed`) planifie
  `modules/posts/feedMaterialization:backfill`. Ici, une seule génération par entrée : la racine.
- L'aide `enter` (`calls/fixtures.setup.ts:26-33`, réexportée par `live/fixtures.setup.ts:21`) passe
  par `joinNetwork`. Chaque personne entrée laisse donc une tâche `backfill`. Quand le planificateur
  joue, elle devient une chaîne de sept étapes (`BACKFILL_PHASES`, `feedMaterialization.ts:18` :
  `self` → … → `done`, étapes 0 à 6, chacune planifiant la suivante l.137).
- Les aides comptaient TOUTES les lignes de `_scheduled_functions` : `counts` (egress l.110), `jobs`
  (cleanup l.47) et `planifiees` (reap l.117).
- Le compte est exact. Egress : 1 entrée, donc 1 tâche. Cleanup : 2 entrées, soit 2 tâches en
  attente plus la suite (3) ; une fois jouées, 2 × 7 = 14, plus la suite (15). Reap : 3 entrées, plus
  le solde (4).
- Ce comportement est voulu par PA10 (docs/20 l.9 et l.11 : un nouveau lien ou un changement
  d'adhésion provoque un rattrapage). Aucun défaut de code.

**Pourquoi « vider » ne suffit pas seul.** convex-test 0.0.54 n'efface jamais une ligne de
`_scheduled_functions`. Il l'insère à la planification (`dist/index.js:1082`), puis ne fait que
changer son état : `inProgress`, `success`, `failed` ou `canceled` (l.1113-1168). Son
`_creationTime` est strictement croissant (l.104-106). Une tâche jouée reste donc comptée, en
`success`. Chaque correction relève donc le nombre de lignes à la fin de l'amorce. Quand l'étape
testée joue le vrai planificateur, elle vide d'abord les tâches PA10, faute de quoi leurs chaînes
avanceraient pendant l'étape.

**Point 5 : coût du harnais, pas du code.** convex-test résout chaque lecture indexée en parcourant
les clés de TOUS les documents de toutes les tables : `_iterateDocs`, `dist/index.js:392-405`
(`Object.keys(this._documents).filter(isInTable)`), puis filtre de plage et tri (l.428-485). La
diffusion fait une dizaine de lectures indexées par destinataire : `putEntry` → `liveReader`
(`isActiveMember`), `liveFeedReason` (`canSeePostDoc`, `isConnectedTo`, `isFollowingPerson`), entrée
existante. Elle les fait sur plus de 15 000 documents (5 000 personnes, adhésions et abonnements),
puis 20 000 avec les entrées : 5 000 abonnés en lots de 20, soit au moins 250 transactions. En
Convex réel, une lecture indexée ne parcourt que sa plage d'index. Mesure provisoire (§9.3) : amorce
des 5 000 abonnés **189 ms**, test arrêté juste avant la diffusion à 0,54 s, diffusion ≈ 182 s. La
fixture n'a donc rien d'évitable.

### 9.2 Correction (tests seulement)

| # | Intention (ligne qui la montre) | Mécanisme repris | Correction |
|---|---|---|---|
| 1 | l.319 (« … sans rien télécharger ») et en-tête l.2 (« aucun job planifié ne part seul ») : le webhook ne planifie rien et ne stocke rien | Relevé avant/après du fichier lui-même (l.229 et 245, egress d'un autre déploiement) | `const before = await counts(t)` après l'amorce (l.326), puis `toEqual({ jobs: before.jobs, files: 0 })` (l.341). Plus strict que l'ancien `toMatchObject` : objet exact, `files: 0` absolu, aucune ligne ajoutée (donc aucune tâche, rapatriement compris). `transfer` reste non appelé (l.337). En-tête de provenance complété (règle 2) |
| 2-3 | l.128 (« cinquante au plus par transaction ») et l.137-138 : une seule suite par transaction ; l.142 : deux suites pour le vrai planificateur ; l.171 : la seule tâche est la suite qui porte `now: T0` (« l'instant voyage avec la suite », l.150) | Vidange du fichier (`finishAllScheduledFunctions(vi.runAllTimers)`, l.83, 107, 140, 146, 166), puis relevé | `world()` vide les tâches PA10 de l'amorce (l.43) et relève le nombre de lignes (l.44, `fixtureJobCount`, une entrée par harnais). `jobs(t)` rend les lignes suivantes, dans l'ordre de création, sans filtre de nom (l.65-66). L'exactitude porte sur TOUTES les tâches des étapes testées, pas seulement celles du module : 1, puis 2, puis la seule suite |
| 4 | l.287 : « Sans Egress, rien à arrêter ; le solde des invitations, lui, part toujours » | Relevé avant/après du scénario jumeau avec Egress (`live/direct.test.ts:882-891`) | `const avant = (await planifiees(t)).length` avant la récolte (l.279). L'égalité exacte porte sur `.slice(avant)` (l.288) : un `stopDirectEgress` ou toute autre tâche la ferait échouer. Pas de vidange : la récolte ne joue pas le planificateur et l'horloge est simulée (l.51) |
| 5 | docs/20 l.22 et l.30 : 5 000 abonnés ; lots de 20 (`MATERIALIZED_FEED_BATCH`, `packages/social-domain/src/feedScale.ts:20`) | — | Délai explicite **360 000 ms** pour ce seul test (l.319), avec un commentaire (l.295-300). Abonnés, lots, amorce et assertions inchangés. Les autres tests du fichier gardent 120 s |

### 9.3 Commandes et chiffres

| # | Commande (depuis `A/`) | Résultat |
|---|---|---|
| 1 | `bunx vitest run --config convex/vitest.config.ts lib/livekitEgressWebhookRoute.test.ts modules/calls/cleanup.test.ts modules/live/reap.test.ts` | 10:15, avant : 3 fichiers, 36/40 (les 4 échecs du §9.1) ; 10:20, après : **3/3, 40/40** |
| 2 | `… modules/posts/feedMaterialization.test.ts -t "diffuse cinq mille"` (délai 360 s) | 10:22 : **1/1**, 197 s (195,65 s de test) ; 10:25 : **1/1**, 185 s (182,75 s de test). Mac partagé : tsgo PRO.GA et vitest `social-features` d'autres sessions en cours |
| 3 | Même test, sonde provisoire (`vi.getRealSystemTime()`) arrêtée après l'amorce, puis retirée | Amorce des 5 000 abonnés : **189 ms** ; test arrêté à 0,54 s |
| 4 | `bunx tsgo --noEmit -p convex/tsconfig.json` (inclut les `*.test.ts`) | 10:29 : **0 erreur**, sortie 0 |
| 5 | `… lib/livekitEgressWebhookRoute.test.ts modules/calls/cleanup.test.ts modules/live/reap.test.ts modules/posts/feedMaterialization.test.ts` | 10:30 : **4/4, 53/53**, 165 s |
| 6 | `… modules/calls modules/live modules/posts lib/ --reporter=verbose` | 10:33 : **46/46, 712/712**, 189 s. Détail : calls 9/9 fichiers (153 tests), live 23/23 (399), posts 4/4 (51), lib 10/10 (109). Test de charge : 157 s |

Le délai de 360 s laisse une marge d'environ 1,8 fois sur la plus lente des durées relevées pour ce
test (167,8 s au verify, puis 195,7 s, 182,8 s et 157,1 s ici). Cette durée est celle du harnais. Elle ne mesure pas la charge : la campagne R8
(docs/20) reste à exécuter.

### 9.4 Fichiers modifiés

- `A/convex/lib/livekitEgressWebhookRoute.test.ts` (un test, en-tête de provenance).
- `A/convex/modules/calls/cleanup.test.ts` (aides `world`, `jobs`, `scheduledRows`).
- `A/convex/modules/live/reap.test.ts` (un test).
- `A/convex/modules/posts/feedMaterialization.test.ts` (délai et commentaire d'un test).
- Ce rapport (§9).

Retour arrière : par fichier ; aucun code, aucune donnée, aucun schéma touchés.
