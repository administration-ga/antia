# P00 — Cadrage exécutable et décisions

18 octobre 2026. Lot documentaire exécuté par le coordinateur au lancement de l'implémentation
demandée (« Implémente en utilisant des agents simultanés et coordonnés »). Aucun code applicatif
n'est modifié par ce lot ; aucun build ni serveur lancé.

## 1. Source relevée

| Élément | Constat |
|---|---|
| ANTSIA | `codex/pa4-identite-session`, HEAD `9eaff40`, 45 commits devant `origin/main` ; 36 fichiers modifiés et 13 non suivis d'autres sessions à l'ouverture (13:47) |
| Sessions actives | PA9 Codex (fédération, pages, `social-domain` fédération, console, ADR-0013, plan 01) ; DIASPORALE (`convex/modules/diaspora`, son dépôt) ; travaux non commités antérieurs : partage, pont de session, accueil/inscription, fond blanc/cartes beige |
| Derniers travaux PostCard / partage / routes | `PostCard.tsx` (+14), `SharePostDialog.tsx` (réécrit), `reseau.fil.json`, `routes.ts` (`signIn(intent)`, `engineRoutes.post`), `packages/api/src/network.tsx` (`EngineRoutes.post?`) — non commités, recette `docs/recette/partage-2026-10-18` ; à conserver par P02/P03 |
| PRO.GA | arbre propre, `feat/vitrine-catalogue-vivant` (4 commits devant `main`) ; branche de travail `feat/antsia-social-commerce` créée par le coordinateur |
| Services | Next ANTSIA :3030, Convex local :3210 (`convex dev` d'une autre session, poussée automatique), Next DIASPORALE :3031 — non relancés |
| Réservations | `EXECUTION.md` (fichiers par lot) ; ADR `0017`–`0019` (0014–0016 laissés à PA9B–D) |

Constats de l'audit revérifiés sur le source courant :

- `convex/modules/pages/pages.ts:129` exige `minStatus: "verifiee"` et `:158` crée une page `community` ;
- `convex/modules/public/access.ts:56` n'admet que `trust === "official"` et `status === "active"` ;
- `convex/modules/messaging/inbox.ts:34` exige une relation acceptée pour un fil personnel ;
- `PRO_GA/convex/modules/payments/adapters.ts` : `PAYMENT_ADAPTERS = []` (aucun fournisseur) ;
- `packages/social-domain/src/feedScale.ts:27` : `PERSONAL_FEED_AUTHORS_MAX = 200`.

Les autres affirmations de 02/07/08 sont revérifiées par le lot qui en dépend (P01/P02 pour 02 §2–4,
P06 pour 07/08) ; leurs écarts sont consignés dans leurs rapports.

## 2. Décisions acquises et proposées

| Décision | Statut | Trace |
|---|---|---|
| « Pro.gram » = PRO.GA, système de gestion | **Acquise** (propriétaire) | README de l'étude |
| Une nouvelle étude puis son implémentation | **Acquise** (demandes du 18/10) | conversation du 18/10 |
| Refonte réservée à ANTSIA ; DIASPORALE inchangé | **Acquise** (« ANTSIA uniquement ») | 00 §1, recette accueil 17/10 |
| Fond blanc et cartes beige en clair | **Acquise** (17/10) | `docs/recette/fil-mobile-2026-10-18` |
| Palette encre/ivoire/prune, sombre charbon/rose prune | Proposée — implémentation demandée, acceptation après recette | ADR-0017 |
| Capacités ANTSIA opt-in (présentation injectée par l'app) | Proposée | ADR-0017 |
| Immersion mobile + mode Liste persistant ; Liste au bureau | Proposée | ADR-0017 |
| Boutique = capacité de page ; brouillon pour membre déclaré | Proposée | ADR-0019 |
| Publication d'une vitrine déclarée non vérifiée | **Ouverte** (propriétaire, avant P07) | ADR-0019 |
| PRO.GA autorité ; liaison volontaire à double preuve | Proposée | ADR-0018 |
| Contrats public/privé distincts | Proposée | ADR-0018, P06 |
| Paiement mono-vendeur XAF V1 | Proposée | ADR-0018 |
| Fournisseur de paiement, bénéficiaire, frais, commission | **Ouverte** (propriétaire et partenaire, avant P12) | 00 §8 |
| Livraison/retrait, conditions de vente, admission vendeurs, conservation | **Ouverte** (propriétaire / conseil) | 00 §8 |
| E2EE | **Hors périmètre** ; aucune promesse | ADR-0017 |

Aucune section du cahier `docs/00_CAHIER_DES_CHARGES_ANTSIA.md` n'est réécrite : les décisions
qui l'amendent (paiements §8, pages vérifiées, lecture anonyme) sont seulement proposées. Le plan
`docs/01_PLAN_IMPLEMENTATION_PROMPTS_ANTSIA.md` est en cours d'édition par PA9 : son encart
« État » sera complété par le coordinateur une fois PA9 commité.

## 3. Options rejetées et conséquences concrètes

| Option | Conséquence si elle était retenue |
|---|---|
| Double maître commerce | Deux prix pour une variante ; survente du dernier article ; factures PRO.GA contradictoires avec ANTSIA |
| Élargir les conversations personnelles aux inconnus | Démarchage et appels non sollicités vers toute personne ; perte de la garde testée `messaging/inbox.ts:34` |
| Supposer un SSO existant | Un compte ANTSIA quelconque pourrait revendiquer une structure PRO.GA et ses ventes |
| Retirer `verifiee` de `createPage` | Pages de confiance créées par tout compte ; test `pages.test.ts` cassé |
| Coque unique imposée à DIASPORALE | Régression non demandée d'un produit recetté |

## 4. Matrice de capacités par acteur

Légende : ✅ admis par garde serveur ; ⚙️ admis sous condition explicite ; ❌ refusé (refus indistinct
quand l'existence doit rester cachée) ; — sans objet. « Lot » = lot qui livre la garde.

| Capacité | Anonyme | Déclaré | Vérifié | Signataire de page | Équipier boutique | Vendeur admis (lien PRO.GA + mandat) | Acheteur | Recruteur (mandat) | Suspendu | Lot |
|---|---|---|---|---|---|---|---|---|---|---|
| Lire fil membre | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | existant |
| Lire projection publique | ⚙️ root+audience | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ⚙️ public | existant |
| Créer une page sociale | ❌ | ❌ | ✅ | — | — | — | — | — | ❌ | existant |
| Préparer un brouillon de boutique | ❌ | ✅ | ✅ | ✅ | ❌ | ✅ | — | — | ❌ | P07 |
| Publier la vitrine | ❌ | ⚙️ décision ouverte | ⚙️ admission | ⚙️ mandat page | ❌ | ⚙️ admission | — | — | ❌ | P07 |
| Lier PRO.GA | ❌ | ⚙️ double preuve | ⚙️ double preuve | ⚙️ double preuve | ❌ | ✅ renouveler/révoquer | — | — | ❌ | P08 |
| Publier une offre (reflet) | ❌ | ❌ | ❌ | ❌ | ❌ | ⚙️ consentement PRO.GA | — | — | ❌ | P09 |
| Poser une question à une boutique | ❌ | ⚙️ quota | ⚙️ quota | ✅ | — | — | ⚙️ quota | — | ❌ | P10 |
| Répondre au nom de la boutique | ❌ | ❌ | ❌ | ⚙️ mandat vivant | ⚙️ mandat vivant | ⚙️ mandat vivant | — | — | ❌ | P10 |
| Appeler la boutique | ❌ | ⚙️ après acceptation | ⚙️ après acceptation | — | ⚙️ réponse | ⚙️ réponse | ⚙️ après acceptation | — | ❌ | P10 |
| Préparer une commande | ❌ | ⚙️ | ⚙️ | — | — | — | ✅ sujet opaque | — | ❌ | P11 |
| Payer | ❌ | ❌ tant que fournisseur absent | ❌ idem | — | — | — | ⚙️ fournisseur prouvé | — | ❌ | P12/P13 |
| Demander devis / créneau | ❌ | ⚙️ | ⚙️ | — | — | — | ✅ | — | ❌ | P14 |
| Publier un emploi | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | — | ⚙️ mandat + consentement | ❌ | P15 |
| Candidater | ❌ | ✅ | ✅ | — | — | — | — | — | ❌ | P15 |
| Suivi des engagements antérieurs | ❌ | ✅ | ✅ | — | — | ✅ | ✅ | ✅ | ⚙️ voie support | P13–P16 |

## 5. Invariants de non-régression

1. **Session** : pont de session corrigé (délai client 15 s, SID signé, génération fermante) ; aucune
   reprise manuelle ; `signOutEverywhere` seul point de sortie ; aucune exception de développement.
2. **Réseau** : `networkId` et `requireMembership` partout ; refus indistinct ; diffusion racine
   uniquement sur geste explicite ; badges calculés.
3. **Médias** : admission `verifyDeclaredMedia`, délivrance `servableUrl`, plafonds actuels
   (4 images ou 1 vidéo, 20/100 Mio) inchangés sans lot dédié.
4. **Communication** : coque montée une fois ; un appel survit à la navigation et au thème ;
   raccrocher libère les pistes ; aucune caméra pour un appel audio.
5. **DIASPORALE** : comportement et thème inchangés ; ses tests (dans `verify`) restent verts.
6. **Commerce** : aucun bouton qui simule un succès ; aucun paiement réel ; aucune donnée de production.

## 6. Besoins fournisseur et appareil (non inventés)

| Besoin | Bloque | Responsable |
|---|---|---|
| Fournisseur de paiement + sandbox + admission marchand + preuve de callback | Activation P12/P13 (pas l'adaptateur contractuel) | Propriétaire / partenaire |
| Clés de signature ANTSIA↔PRO.GA par environnement | Preuve de transport réel P08 (pas les tests de contrat) | Propriétaire (procédure secrets) |
| Backend PRO.GA local lancé dans un créneau coordonné | Recette croisée P08/P09/P11/P14/P15 | Coordinateur |
| LiveKit configuré + deux sessions consenties | Recette appel P05 (les tests UI restent possibles) | Propriétaire |
| VAPID / FCM / APNs | Notification reçue P05/P17 | Propriétaire |
| Appareils Android et iOS physiques, comptes développeur, droits CallKit | P17b–d | Propriétaire |
| Conditions de vente, admission vendeurs, conservation | Ouverture commerciale | Propriétaire / conseil |
| Participants consentants du pilote | P19 (étude utilisateur) | Propriétaire |

## 7. Lots, sous-lots, responsables, fichiers et preuves

| Lot | Taille | Sous-lots | Responsable | Fichiers principaux | Preuves exigées |
|---|---|---|---|---|---|
| P01 | M | — | agent charte | `themes/antsia.css`, ajouts `styles/charte.css`, tests de contraste | cliquets, contrastes calculés, jetons DIASPORALE/console identiques, captures |
| P02 | M | — | agent navigation | `routes.ts`, `network-shell.tsx`, coque `shell/**`, `packages/api/src/network.tsx` | tests de routes/coque, DIASPORALE avant/après, recette 320–1280 |
| P03 | M | — | agent publications | `PostCard`, `PostMedia`, `public-post-card`, `reseau.fil.json` | galerie/clavier/erreurs/SSR, post exact chez second lecteur |
| P04 | L | a : coordinateur média + immersion mobile ; b : restauration, pagination, immersion bureau | agent fil | `ReseauMobileFeed`, `FeedPages`, `VerticalPager`, `ReseauAgentPage` (fil) | une vidéo active, retour au post, 30 médias |
| P05 | M | — | agent iCom | `features/messagerie/**`, `features/iappel/**`, `shell/communication/**`, worker | états, permissions, absence de remount ; appel réel si LiveKit |
| P06 | M | — | agent contrats | `social-domain/src/commerce/**`, `pro-domain/src/commerce/**`, `docs/contrats/PRO-COMMERCE-*` | fixtures partagées, tests des deux dépôts |
| P07 | L | a : domaine boutique + politique + backend ; b : éditeur + projection publique + SSR | agent boutique | `convex/modules/shops/**` (cible), schéma (coordinateur), routes/surfaces | gardes déclaré/vérifié/anonyme, effacement, recette |
| P08 | L | a : liaison double preuve ; b : transport | agents ANTSIA / PRO.GA séparés | `convex/modules/commerce/**` (cible), PRO.GA `integrations` | rejeu, expiration, mauvais compte, crash avant/après reçu |
| P09 | L | a : producteurs PRO.GA ; b : handler + projections ANTSIA | idem | `catalog`/outbox PRO.GA ; handler et projections ANTSIA | effet appliqué, retrait, tombstone |
| P10 | M | — | agent contact | canal commercial, adaptateur de messagerie | inconnu admis, refus, blocage, équipier révoqué |
| P11 | L | a : `checkout.prepare` + réservation PRO.GA ; b : client privé ANTSIA | agent commande | `orders`, `inventory`, routes privées PRO.GA | concurrence dernier article, timeout |
| P12 | L | adaptateur contractuel + capacité fermée (fournisseur absent) | agent paiement | `payments/**` PRO.GA | callbacks simulés ; sandbox réelle bloquée |
| P13 | L | UI avec capacité « payer » fermée | agent achat | écrans ANTSIA, vues privées | parcours sans faux reçu |
| P14 | L | a : demande/devis ; b : rendez-vous | agent services | `quotes`, `agenda` PRO.GA ; surfaces ANTSIA | acceptation versionnée, créneau unique |
| P15 | M | — | agent emploi | `recruiting` PRO.GA ; surfaces ANTSIA | publication consentie, candidature privée |
| P16 | M | revue transverse | coordinateur + agent revue | inventaires, cliquets | matrice menace → garde → test |
| P17 | XL | a : audit/contrats (seul exécutable sans appareils) ; b–d : appareils | agent natif | rapport d'audit | b–d bloqués par appareils |
| P18 | M–L | mesures sur version candidate | coordinateur | rapport | mesures brutes |
| P19 | M | dossier de décision | coordinateur | rapport | vérifié / non vérifié / bloquant |

Fichiers partagés réservés au coordinateur : `convex/schema.ts`, `convex/convex.config.ts`,
`package.json`, `bun.lock`, `deploy/catalog.json`, inventaire d'effacement, listes des cliquets,
`docs/adr/README.md`. Aucun agent ne les modifie en parallèle.

## 8. Ordre exécutable

1. **Vague 1** (parallèle) : P01, P02, P06 ; P00 (coordinateur).
2. **Vague 2** : P03 (après P02), P05 (après P02), P07a (après P02 + P06).
3. **Vague 3** : P04 (après P03), P08 (après P06), P07b.
4. **Vague 4** : P09 (après P07 + P08), P11a, P15.
5. **Vague 5** : P10 (après P05 + P07 + P09), P12 (contrat, capacité fermée), P14.
6. **Vague 6** : P13 (capacité payer fermée tant que P12 n'est pas prouvé), P16, P17a.
7. **Vague 7** : P18, P19.

Dépendances bloquantes : la décision de publication déclarée bloque l'activation de la vitrine
déclarée (pas le brouillon) ; le fournisseur bloque l'encaissement (pas l'adaptateur) ; les clés
bloquent la preuve de transport réel (pas les contrats) ; les appareils bloquent P17b–d.

## 9. Vérifications statiques

- Liens relatifs du dossier : **109 vérifiés, 0 cassé** (script Python sur `docs/etudes/2026-10-18-social-commerce/**/*.md`).
- Couverture SC01–SC16 : toutes présentes dans la traçabilité de `09_FEUILLE_DE_ROUTE.md` §5
  (notation groupée SC01/02, SC03/04, SC05/15, SC06/07, SC14/16) et rattachées aux lots ci-dessus.

## 10. Limites

Ce cadrage ne prouve aucun comportement applicatif. Les statuts « proposé » restent tels jusqu'à
validation explicite du propriétaire. Les numéros d'ADR sont réservés dans l'arbre partagé ; leur
inscription dans `docs/adr/README.md` attend la fin d'édition de ce fichier par PA9.
