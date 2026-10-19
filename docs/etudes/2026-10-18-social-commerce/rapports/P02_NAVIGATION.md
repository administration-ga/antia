# P02 — Navigation téléphone et bureau (Fil · Découvrir · Créer · Messages · Profil)

18 octobre 2026, agent « navigation » sous coordination (vague 1). Prompt
[P02](../prompts/P02_NAVIGATION.md), spécification [04](../04_PARCOURS_FIL_ET_PUBLICATIONS.md) §1 et §5,
audit [02](../02_AUDIT_ANTSIA.md) §2, décision [ADR-0017](../../../adr/0017-refonte-sociale-charte-navigation-immersion.md) §2.

Verdicts séparés (10 §7) : **présent dans le code** — oui, branché sur les vraies routes ;
**testé automatiquement** — oui (chiffres au §4) ; **observé en recette** — **non** (navigateur
réservé au coordinateur, points précis au §6) ; **publié** — non (aucun commit, push ni déploiement).

## 1. Bilan standard

| Champ | Contenu |
|---|---|
| Résultat | Capacité de présentation **opt-in** dans le contrat `@antsia/api` (`NetworkProvider navigation="destinations"` + `EngineRoutes.discover` / `me`), déclarée par antsia.ga seule (`NetworkShell`). Sous elle : barre basse à **cinq destinations stables** au téléphone (fil, pages de membre), **rail** des mêmes destinations au bureau ≥ 960 px (fil et toutes les pages de membre), « Créer » = carte de choix réelle (publication, actu, évènement, conférence, album — formats déjà servis), deux pages de membre nouvelles : **Découvrir** (`/explorer`) et **Profil** (`/moi`). Sans déclaration (DIASPORALE, tests existants) : coque historique **à l'identique**. |
| Source | Base `codex/pa4-identite-session` @ `9eaff40`, arbre partagé (PA9, DIASPORALE, Mon fil, partage, accueil). Modifications non commitées d'autres sessions **préservées** dans `routes.ts` (`signIn(intent)`, `feedPreferences`, `engineRoutes.post`), `routes.test.ts`, `member-chrome.tsx` (lien « Mon fil »), `antsia.json` (`feedPreferences.*`, `access.*`), `packages/api/src/network.tsx` (`EngineRoutes.post?`). Liste exacte des fichiers au §5. |
| Tests | Typage 0 erreur (`api`, `social-features`, `antsia_ga`) ; tests ciblés et cliquets verts ; consommateurs DIASPORALE avant/après identiques (§4). Aucun `bun run verify` (interdit à l'agent). |
| Recette | **Non faite** : aucune capture, aucun appareil. Seul constat d'exécution : le serveur de dev déjà lancé (:3030) sert `/explorer` (HTTP 200, `<title>Découvrir</title>`) et `/moi` (HTTP 200, `<title>Profil</title>`) sans marqueur d'erreur — ce qui ne prouve pas le rendu connecté (porte de session côté client). |
| Dépendances | Aucune donnée ni contrat nouveau. Onglets Boutiques · Services · Emplois et entrées Ma boutique · Mes achats · Mes candidatures **réservés et non rendus** jusqu'à P07/P09, P13, P14, P15 (§3.4). |
| Retour arrière | Retirer `navigation="destinations"` de `apps/antsia_ga/src/components/network-shell.tsx` (une prop) : barre « Menu » + volets, rail des volets, commande flottante, porte iCom, liens de la barre du haut reviennent à l'identique (testé, §4). Les routes `/explorer` et `/moi` restent servies sans être proposées. Aucune donnée à conserver ni migrer. |
| Limites | §7. |

## 2. Ce qui est branché

1. **Contrat** `packages/api/src/network.tsx` (ajouts optionnels seulement) : type `EngineNavigation`
   (`"volets"` défaut, `"destinations"`), prop `NetworkProvider navigation`, champ
   `useNetwork().navigation`, `EngineRoutes.discover?` et `EngineRoutes.me?`,
   `resolveEngineNavigation()` qui **rabat sur `"volets"`** si l'une des deux destinations propres
   manque (jamais une entrée vers un 404). Aucun nom de marque testé dans le code partagé.
2. **Modèle pur** `packages/social-features/src/shell/reseau-menu-destinations.ts` : ordre des cinq
   destinations, adresses composées sur la table injectée, destination courante
   (`aria-current="page"` pour la page même, `"true"` pour une page qui en relève), rangement de
   chaque volet (`relations`, `groupes`, `pages`, `conferences`, `evenements` → Découvrir ;
   `enregistrements` → Profil ; alias et anciennes graphies compris), choix « Créer » bâti sur
   `creationEntries`/`creationLaunchFor` (formats à surface = boutons ; évènement/album = **liens**
   servis ; conférence seulement si `liveAvailable`), pastille Messages (`messagesUnreadTotal`,
   confrontée par test à `combinerNonLus` d'iCom).
3. **Téléphone** : `ReseauMobileTabBar` rend les cinq places (même ancrage `fixed`, gouttière 12 px,
   encoche `env(safe-area-inset-bottom)`, repères `data-mobile-nav`/`data-reseau-mobile-nav`,
   masquée ≥ 960 px), largeur égale, sans défilement. `ReseauMobileShell` ne monte plus la commande
   flottante (Créer est dans la barre) ; `ReseauMobileHeader` garde recherche et cloche, retire
   porte iCom et pastille du profil (destinations de la barre). La même barre est montée par
   `MemberPage` sur les pages de membre (profil, page, album, modération, fil national, Mon fil,
   Découvrir, Profil), hors pages de direct (`isLiveSessionPath`) et vues immersives.
4. **Bureau** : `ReseauMenuRail` se coiffe d'un repère « Navigation principale » (identité + cinq
   destinations) ; les volets suivent sous « Dans le réseau » (sans le Fil, déjà destination ;
   « Voir plus » retiré, porté par Profil). Sur la page réseau, un clic ordinaire sur **Fil** repasse
   par `onSelectTab("fil")` (lève recherche/mot-clé/pagination comme l'ancien volet) et sur
   **Messages** détache la carte iCom en place (`dockStore.detach()`), ⌘/Ctrl-clic laissé au
   navigateur ; la porte iCom de la barre d'identité (`ReseauDesktopIcomLink`) s'efface. Hors de la
   page réseau, `MemberPage` monte le **même** rail dans une colonne gauche collante
   (`activeTab={null}`, volets en **liens** — visibles par la garde de sortie de la modération).
5. **Créer** : sur le fil, les surfaces existantes de `ReseauAgentPage`/`ReseauMobilePage`
   (`PostComposerSheet`, `StoryCreateSheet`, conférence par l'hôte persistant) ; sur les autres pages
   de membre, `MemberPage` monte **une fois** `PostComposerSheet` + `StoryCreateSheet` avec le même
   `useCreationController`. Le brouillon de publication garde son mécanisme (magasin de module +
   `sessionStorage` par réseau et auteur, R-12) : il survit au changement de page et à 959/960.
6. **Coque de communication** : inchangée, toujours montée **une seule fois** dans
   `NetworkShell` (`(membre)/layout.tsx`) ; aucune page ni navigation ne la monte (garde statique
   testée, §4). `/explorer` et `/moi` sont sous `(membre)` : y aller ne démonte ni appel ni présence.
7. **Barre du haut** (`MemberTopBar`) sous les destinations : marque (retour au fil), cloche, identité
   (IDN, « Mes données et mes recours », autres espaces), déconnexion par la porte partagée — les
   autres liens sont rangés sous les destinations ; leur groupe n'est plus un second repère
   « navigation » (`role="group"`, libellé « Notifications, identité et session »).

## 3. Plans avant / après

### 3.1 Destinations (le tableau que garantit `navigation-coverage.test.ts`)

| Destination | Avant — téléphone | Avant — bureau | Après — téléphone | Après — bureau | Adresse |
|---|---|---|---|---|---|
| Fil (accueil) | sous-onglet « Fil » de la barre | volet « Fil » du rail, marque | **Fil** (barre), marque des pages de membre | **Fil** (rail), marque | `/fil` |
| Découvrir | — (lien « Découvrir » de la rangée du fil → vue **publique**) | lien « Découvrir » de la barre du haut → vue **publique** | **Découvrir** → page membre | **Découvrir** → page membre | `/explorer` (nouveau) |
| Créer | commande flottante : publication, actu, évènement, conférence, album* | « Publier », « Conférence » (barre d'identité), vignette des actus, volet Évènements | **Créer** (barre) : mêmes formats | **Créer** (rail) : mêmes formats ; portes historiques gardées | carte de choix |
| Messages | porte iCom de l'en-tête (pastille) | « Messages » (barre du haut), porte iCom (960–1107 px), carte iCom (≥ 1108 px) | **Messages** (barre, pastille) ; iCom garde sa barre sur `/messages` | **Messages** (rail, pastille ; détache iCom en place sur le fil) ; carte iCom ≥ 1108 px | `/messages` |
| Profil | pastille de l'en-tête → profil ; « Mon profil » (feuille Menu) | « @identifiant » (barre du haut), identité et « Voir plus » du rail | **Profil** → page Profil (« Voir mon profil public » en tête) | **Profil** → page Profil ; identité du rail → profil public | `/moi` (nouveau), `/profil/<id>` |
| Relations, Groupes, Pages, Conférences, Évènements | sous-onglets de la barre | volets du rail | page **Découvrir** (« Dans le réseau ») ; Découvrir allumé | volets du rail (« Dans le réseau ») + Découvrir | `/fil?tab=…` |
| Enregistrements (signets) | sous-onglet « Signets » | volet du rail | page **Profil** (« Mon activité ») | volet du rail + Profil | `/fil?tab=enregistrements` |
| Fil national | rangée du fil (`feed-screen`) | icône « National » (barre du haut) | **Découvrir** ; rangée du fil (inchangée) | **Découvrir** | `/fil?portee=national` |
| Provinces | sélecteur du fil national | idem | **Découvrir** (9 liens) + sélecteur | idem | `/fil?portee=province&province=…` |
| Mot-clé (#) | clic sur un `#mot` d'une publication | idem | **Découvrir** (formulaire RHF + Zod) + clic `#mot` | idem | `/fil?portee=national&tag=…` |
| Mon fil (préférences) | rangée du fil | lien « Mon fil » (barre du haut) | page **Profil** (« Préférences ») ; rangée du fil (inchangée) | page **Profil** | `/mon-fil` |
| Modération | rangée du fil | icône « Modération » (barre du haut) | page **Profil** (« Compte et données ») ; rangée du fil | page **Profil** | `/moderation` |
| Actus (statuts) | feuille « Menu » ; rangée des actus | rangée des actus | page **Profil** ; rangée des actus ; Créer → Actu | idem | `/actus` |
| Mes données / réglages | « Paramètres » (feuille Menu) | « Paramètres » (Voir plus), outil Identité | page **Profil** ; outil Identité | idem | `/mes-donnees` |
| Apparence | feuille Menu | rail | page **Profil** | rail + page Profil | — |
| Vue publique | rangée du fil ; lien du fil national | barre du haut ; lien du fil national | **Découvrir** (« Vue publique ») ; lien du fil national | idem | `/decouvrir` |
| Cloche · recherche · retour accueil · déconnexion | en-tête du fil (cloche, recherche) ; barre du haut des pages | barre du haut ; recherche du fil | **inchangés** (+ déconnexion sur Profil) | **inchangés** | — |
| Raccourcis (pages suivies, groupes) | — | rail | — | rail (inchangé) | `/page/…`, `/fil?tab=groupes&groupe=…` |

\* Album seulement avec un identifiant publié ; conférence seulement si l'application sert le direct.

### 3.2 Routes

| Route | Statut | Détail |
|---|---|---|
| `/explorer` | **ajoutée** | `routes.memberDiscover()`, `engineRoutes.discover` ; page `app/(membre)/explorer/page.tsx`. Segment statique : prime sur `(public)/[publicHandle]` ; ne commence pas par `@`. Distincte de la découverte **publique** `/decouvrir` (testé). |
| `/moi` | **ajoutée** | `routes.me()`, `engineRoutes.me` ; page `app/(membre)/moi/page.tsx`. |
| `isLiveSessionPath`, `memberDestinationFor` | **ajoutés** (`routes.ts`) | pages de direct sans barre ni rail ; rangement des pages propres à l'application (fil filtré → Découvrir ; Mon fil, modération → Profil). |
| `/fil` (+ `tab`, `portee`, `province`, `tag`, `q`, `post`, `groupe`, `vue`, `notifications`, `curseur`), `/mon-fil`, `/groupes`, `/evenements`, `/messages/**`, `/actus/**`, `/profil/**`, `/@…/albums/…`, `/page/…`, `/moderation`, `/direct/…`, `/conference/…`, `/mes-donnees`, `/parametres/**`, `/decouvrir` et toutes les routes publiques | **conservées** | aucune adresse modifiée ni retirée ; liens profonds et anciennes graphies de volets inchangés. |
| Mesure d'usage | inchangée | `/explorer`, `/moi` → `usageScreenForPath` = `null` (catégories fermées d'ADR-0010 non étendues). |

### 3.3 Écrans

- **Téléphone** : `[en-tête : Réseau · recherche · cloche]` (fil) ou `[ANTSIA · cloche · identité · sortie]`
  (autres pages) — contenu — `[Fil · Découvrir · Créer · Messages · Profil]` fixe, au-dessus de l'encoche.
- **Bureau** : `[barre du haut : ANTSIA · cloche · identité · sortie]` puis, à gauche, le rail
  `[identité · Fil · Découvrir · Créer · Messages · Profil | Dans le réseau : Relations … Enregistrements | raccourcis | apparence]`,
  au centre le contenu ; sur le fil, la colonne iCom/découverte à droite reste celle d'avant (≥ 1108 px).

### 3.4 Extensions commerciales réservées (typées, non rendues)

`apps/antsia_ga/src/components/discovery/discover-model.ts` (`DISCOVER_TABS`) : `tout` servi ;
`boutiques` (P07, P09), `services` (P14), `emplois` (P15) en `availability: "reserved"` — aucune rangée
d'onglets n'est rendue tant qu'un seul est servi. `apps/antsia_ga/src/app/(membre)/moi/me-model.ts`
(`RESERVED_ME_ENTRIES`) : `shop` (P07), `purchases` (P13), `applications` (P15). Les tests vérifient
qu'aucun n'apparaît. Leur activation = changer le statut, ajouter libellés FR/EN et adresse servie.

## 4. Preuves automatiques

Commandes lancées depuis la racine ANTSIA (aucun `codegen`, `verify`, serveur, `convex`) :

| Commande | Résultat |
|---|---|
| `bunx tsgo --noEmit -p tsconfig.json` dans `packages/api`, `packages/social-features`, `apps/antsia_ga` | 0 erreur ×3 |
| `bunx vitest run src/shell` (`packages/social-features`) | **33 fichiers, 379 tests verts** (référence avant : 26 / 341 ; +7 fichiers, +38 tests) |
| `bunx vitest run src/shell src/i18n …/creation-controller.test.ts …/messagerie-source.test.ts` | 38 fichiers, 438 tests verts |
| `bunx vitest run` (`apps/antsia_ga`, suite de l'application) | **29 fichiers, 162 tests verts** (avant : 23 / 125) |
| `bunx vitest run` (`packages/api`) | 11 fichiers, 190 tests verts |
| Cliquets `social-shell-boundary`, `no-hardcoded-strings`, `no-hardcoded-urls`, `no-hardcoded-colors`, `i18n-locales`, `sign-out-everywhere`, `provenance-headers`, `no-cross-product-imports` (`--config tests/vitest.config.ts`) | **8 fichiers, 28 tests verts** (avant : 6 / 21 pour les six demandés) |
| `bun run lint` | `api` : 0 ; `social-features` : 0 erreur, 73 avertissements **tous préexistants** (aucun dans un fichier touché) ; `antsia_ga` : 0 erreur, 8 avertissements préexistants (`moderation-forms`, `notification-controls`) |

Tests ajoutés ou étendus : `reseau-menu-destinations.test.ts` (ordre, adresses, courant, alias,
rangement de chaque volet, choix Créer, parité de la pastille avec iCom) ;
`reseau-menu-destinations-ui.test.tsx` (capacité rabattue, deux décomptes serveur dans le réseau
courant, clic ordinaire) ; `ReseauMobileTabBar.destinations.test.tsx` (5 places, adresses, `page`/`true`,
courant imposé, Créer : boutons/liens/fermeture/Échap et focus rendu, pas de geste mort, pastille et
nom accessible, repli historique) ; `ReseauMenuRail.destinations.test.tsx` (deux repères, volets
sans Fil, Fil et Messages sur la page réseau, ⌘-clic, volets en liens hors page réseau, Créer,
plafond 99+) ; `ReseauMobileShell.test.tsx` (une seule porte Créer par navigation) ;
`ReseauMobileHeader.destinations.test.tsx` ; `ReseauDesktopIcomLink.destinations.test.tsx` ;
`routes.test.ts` (destinations, non-collision avec `/decouvrir`, directs, rangement, mesure) ;
`discover-model.test.ts` (+ parité du mot-clé avec `member-feed-filter`) ; `discover-screen.test.tsx` ;
`me-model.test.ts` ; `me-screen.test.tsx` ; `member-chrome.test.tsx` (barre du haut sous les deux
navigations, rail au bureau / barre au téléphone / rien avant la mesure, rangement, surfaces montées
une fois, directs plein écran, retour arrière à l'identique) ; `navigation-coverage.test.ts`
(**tableau avant/après** : toute destination d'avant atteignable au téléphone et au bureau ;
**une seule** coque de communication dans les sources de l'application).

**DIASPORALE (consommateur des mêmes paquets, aucune ligne modifiée de son côté)**, mêmes commandes
avant et après :

| Suite | Avant | Après | Attribution |
|---|---|---|---|
| `apps/diasporale_com` — 17 fichiers important `@antsia/api/network`, `@antsia/social-features`, la coque ou ses routes | 254 ✓ / 5 ✗ | 254 ✓ / 5 ✗ | les 5 échecs, identiques, sont dans `settings-screen.test.tsx` (« DataSourceProvider manquant » levé par `content-preferences-settings.tsx`, fichier non suivi d'une autre session) — **préexistants** |
| `packages/diasporale-features` (suite) | 18 / 407 ✓ | 19 / 415 ✓ | +1 fichier (`demo/data-rights.test.tsx`) ajouté **pendant** le lot par la session DIASPORALE |
| `apps/diasporale_com/src/ratchets` (vu après seulement) | — | 3 ✗ (`i18n-keys` : `moderation.cases`, `errors.page_*`) | **étranger au lot** : ce cliquet ne lit que `apps/diasporale_com/src`, `packages/diasporale-features/src` et ses propres locales (`sources.ts:13`, `:41`) — aucun fichier de P02 n'y entre. Non mesuré avant : à confirmer par sa session. |

## 5. Fichiers

**Créés (22, dont ce rapport)**
- `packages/social-features/src/shell/reseau-menu-destinations.ts` (+ `.test.ts`)
- `packages/social-features/src/shell/reseau-menu-destinations-ui.tsx` (+ `.test.tsx`)
- `packages/social-features/src/shell/ReseauMenuRail.destinations.test.tsx`
- `packages/social-features/src/shell/ReseauDesktopIcomLink.destinations.test.tsx`
- `packages/social-features/src/shell/mobile/ReseauMobileTabBar.destinations.test.tsx`
- `packages/social-features/src/shell/mobile/ReseauMobileShell.test.tsx`
- `packages/social-features/src/shell/mobile/ReseauMobileHeader.destinations.test.tsx`
- `apps/antsia_ga/src/app/(membre)/explorer/page.tsx`
- `apps/antsia_ga/src/app/(membre)/moi/{page.tsx, me-screen.tsx, me-screen.test.tsx, me-model.ts, me-model.test.ts}`
- `apps/antsia_ga/src/components/discovery/{discover-model.ts, discover-model.test.ts, discover-screen.tsx, discover-screen.test.tsx, navigation-coverage.test.ts}`
- `apps/antsia_ga/src/components/member-chrome.test.tsx`
- ce rapport.

**Modifiés (18)** — modifications d'autres sessions conservées là où elles existaient (†)
- `packages/api/src/network.tsx` † — ajouts optionnels (`EngineNavigation`, `navigation`, `discover?`, `me?`, `resolveEngineNavigation`)
- `packages/social-features/src/shell/ReseauMenuRail.tsx`, `ReseauDesktopIcomLink.tsx`, `ReseauAgentPage.tsx` (une ligne : `onCreate` passé au rail)
- `packages/social-features/src/shell/mobile/{ReseauMobileTabBar, ReseauMobileShell, ReseauMobileHeader, ReseauMobileCreateButton}.tsx` (carte de choix et retour du focus exportés ; la commande flottante inchangée)
- `packages/social-features/src/i18n/locales/{fr,en}/reseau.coque.json` (`reseauDestinations.*`)
- `apps/antsia_ga/src/lib/routes.ts` †, `routes.test.ts` †
- `apps/antsia_ga/src/components/network-shell.tsx` (`navigation="destinations"`)
- `apps/antsia_ga/src/components/member-chrome.tsx` †
- `apps/antsia_ga/src/i18n/locales/{fr,en}/antsia.json` † (`nav.sessionTools`, `me.*`), `{fr,en}/memberNetwork.json` (`discoverHub.*`)

Les en-têtes « Dupliqué de … — adaptations : » des fichiers modifiés reçoivent leur mention P02
(`provenance-headers` vert). Aucun fichier de `convex/**`, `packages/ui/**`, `package.json`,
`bun.lock`, `.env*`, PostCard/PostMedia/FeedPages/ReseauMobileFeed/VerticalPager, messagerie,
iappel, pont de session, entrée ou accueil n'a été touché.

## 6. Recette navigateur à faire (coordinateur)

Compte membre (racine rejointe, profil publié). Largeurs **320, 393, 768, 1280 px**, **clair** et
**sombre** (Apparence), **zoom 200 %** à 1280 px (bascule en téléphone attendue à 640 px effectifs).

1. `http://localhost:3030/fil` — téléphone : barre à 5 places, aucune commande flottante, en-tête
   sans porte iCom ni pastille ; rangée « Mon fil · National · Découvrir · Modération » de
   `feed-screen` encore présente (cf. §8.1). Bureau : barre du haut réduite, rail « Navigation
   principale » puis « Dans le réseau » ; porte iCom absente de la barre d'identité entre 960 et 1107 px.
2. Tab depuis le haut : lien d'évitement → marque → cloche → identité → sortie → (bureau) identité du rail →
   Fil → Découvrir → Créer → Messages → Profil → volets ; anneau de focus visible ; lecteur d'écran :
   « Fil, page actuelle » ; sur `/fil?tab=groupes` : « Découvrir, actuel » + « Groupes, page actuelle ».
3. Créer (barre et rail) : carte « Formats » ; Échap la ferme et rend le focus ; Publication ouvre la
   feuille ; Évènement mène au volet Évènements, carte ouverte ; Album au profil (si identifiant).
4. **Brouillon** : ouvrir Publication, taper un texte, Fermer ; naviguer Profil → Découvrir → Fil ;
   rouvrir Publication : texte, audience et médias présents (R-12) ; idem à cheval sur 959/960 px.
5. **Appel** : lancer un appel, naviguer Fil → Découvrir (`/explorer`) → Profil (`/moi`) → un profil :
   l'appel continue, pilule au-dessus de la barre basse. Contre-épreuve connue : « Mes données »
   (`/mes-donnees`) et la vue publique (`/decouvrir`) sont **hors** coque (§7).
6. Messages : badge = celui d'iCom ; au téléphone la barre d'iCom remplace la barre basse sur
   `/messages` ; au bureau, Messages ouvre la carte iCom en place sur le fil, ailleurs passe par l'accueil.
7. Recharger `/explorer`, `/moi`, `/fil?tab=relations&vue=suggestions`, `/fil?portee=province&province=nyanga` ;
   Retour navigateur après Découvrir → Groupes ; lien profond `/fil?tab=reseau` (alias) → Découvrir allumé.
8. Safe areas (simulation iPhone à encoche) : barre au-dessus de l'indicateur ; bas des pages de
   membre non masqué (réserve `6rem + env(safe-area-inset-bottom)`).
9. `/direct/<id>` et `/conference/<id>` : ni barre ni rail.

## 7. Limites et risques

- **Aucune recette observée** ; aucune capture ; aucun appareil physique.
- `/mes-donnees` (droits ouverts même suspendu) et `/decouvrir` (vue publique) vivent **hors** du
  gabarit `(membre)` : y naviguer démonte la coque de communication (comportement antérieur, déjà vrai
  pour « Paramètres » et l'ancien lien « Découvrir ») — la page Découvrir l'annonce pour la vue publique.
- Au téléphone, changer de volet passe désormais par Découvrir (un geste de plus qu'avec la rangée de
  sous-onglets) ; sur `/messages`, la barre d'iCom (P05) remplace les cinq destinations.
- Au téléphone, le lien « Fil » ne lève pas une recherche affichée (comportement déjà vrai du
  sous-onglet « Fil » historique) ; au bureau, il la lève (geste du volet conservé).
- Bureau, pages de membre : le rail ajoute une colonne gauche (≈ 200–248 px) — mise en page des
  profils, pages, modération et fil national à recetter à 960 et 1280 px ; les titres `h2` du rail
  précèdent le `h1` de la page dans le document (lien d'évitement vers `#contenu` conservé).
- L'état d'erreur « filtre non disponible » du fil (`feed-screen.tsx:25`) n'a que la barre du haut.

## 8. Demandes au coordinateur

1. `apps/antsia_ga/src/components/feed/feed-screen.tsx:29-34` (hors réservation) : la rangée mobile
   double les destinations et son « Découvrir » mène à la vue **publique** (hors coque). Correction
   proposée : ne la rendre que sans la navigation par destinations —
   `const destinations = useNetwork().navigation === "destinations"` puis
   `{destinations ? null : <nav aria-label={t("nav.discover")} …>…</nav>}` (import `useNetwork` de
   `@antsia/api/network`) ; « Mon fil », National et Modération restent atteignables par Profil et
   Découvrir. Variante minimale : `routes.discover()` → `routes.memberDiscover()` à la ligne 32.
2. Même fichier, ligne 25 (option) : envelopper l'état invalide dans `MemberPage` pour lui donner la
   barre et le rail.
3. ADR-0017 §2 : la capacité est livrée sous la forme `NetworkProvider navigation` + `EngineRoutes.discover/me`
   (rabattue si une adresse manque) — à consigner à l'acceptation.
4. P05 : décider si la barre d'iCom de `/messages` garde sa première place « retour au réseau » ou
   rejoint les cinq destinations.
5. P07/P09, P13, P14, P15 : activer `DISCOVER_TABS` / `RESERVED_ME_ENTRIES` avec libellés et adresses servies.
