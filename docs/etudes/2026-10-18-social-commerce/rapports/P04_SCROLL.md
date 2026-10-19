# P04 — Fil immersif et contrôle des médias

18 octobre 2026. Références : [prompt P04](../prompts/P04_SCROLL.md),
[parcours](../04_PARCOURS_FIL_ET_PUBLICATIONS.md) §3–§4, [préambule](../prompts/PROMPT_COMMUN.md),
ADR-0017 §4.

**Verdict : sources raccordées ; tests écrits, non exécutés ; recette ouverte.**

Décision du propriétaire (18/10/2026, vers 22 h) : « Continuer sans vérifier ». Aucune commande
de vérification n'a été lancée pour ce lot : ni codegen, ni test, ni typage, ni lint, ni build,
ni serveur, ni navigateur, ni commande Convex, ni installation. Les fichiers ont seulement été
relus. Ce rapport n'attribue à P04 aucun résultat de test, aucune capture, aucune mesure ni
aucune publication. Rien n'a été commité.

## 1. Point de départ

- Arbre partagé, branche `codex/pa4-identite-session`, `HEAD` local `9eaff40`. Les
  modifications non commitées des autres sessions sont conservées : PA9/PA10 (fil
  matérialisé dans `FeedPages.tsx`), P01–P03, P05–P15 et DIASPORALE. Les fichiers existants
  n'ont été touchés que par des modifications ciblées.
- Aucun fichier interdit n'a été modifié : `package.json`, `bun.lock`, `convex/_generated`,
  `.env*`, primitives `packages/ui/src/components/**`, les cinq fichiers du pont de session,
  `EXECUTION.md` (tenu par le coordinateur). Aucune commande git d'écriture n'a été lancée.
- Briques étudiées : `VerticalPager` et `StoriesViewerPage`, qui restent intacts ; les
  stories ne sont pas transformées. Ont aussi été lus : la chaîne de pages du fil
  (`reseau-feed-pages.ts`, `FeedPage`), la présentation média P03
  (`PostMediaPresentation.tsx`), le magasin d'appel et `listRinging` (en lecture seule), puis
  la purge de déconnexion (`personalStateKeys`).

## 2. Comportement raccordé

### Capacité et activation

- `@antsia/api/network` reçoit une nouvelle capacité, `feedPresentation: "list" | "immersive"`,
  au même rang que `navigation` et `postPresentation`. `resolveEngineFeedPresentation` retient
  `"immersive"` seulement sur demande explicite. Toute autre valeur rend la liste historique.
- ANTSIA active cette capacité dans `apps/antsia_ga/src/components/network-shell.tsx` avec
  `feedPresentation="immersive"`. La coque monte une fois `FeedReturnSessionBoundary` et
  `MediaPlaybackProvider` autour des pages de membre. DIASPORALE ne déclare rien et garde
  donc le rendu à l'identique.

### Lecteur immersif

- `ImmersiveFeedReader` montre une publication principale par hauteur disponible. Le
  défilement vertical est natif et accroché (`scroll-snap-type: y mandatory`,
  `scroll-snap-stop: always`). Le lecteur mesure et prend la hauteur restante de son
  défileur, sous l'en-tête et au-dessus de la barre basse (`[data-mobile-nav], .rm-tabbar`).
  Il devient ainsi le seul défileur du fil.
- Un créneau plus haut que l'écran défile à l'intérieur. Aucun contenu n'est tronqué ni
  forcé par l'accrochage. Quand la légende longue est ouverte (« Lire la suite »), le geste
  et le clavier restent dans la publication (`:has(...[aria-expanded="true"])`).
- L'axe du geste est décidé par le défilement natif. La galerie P03 garde sa piste
  horizontale. Aucun pointeur n'est capturé, aucun `touch-action: none` n'est posé. Un
  curseur, une sélection de texte ou une feuille en portail gardent donc leur geste.
- Le lecteur ne lit aucune donnée. Sous lui, `FeedPage` exécute la même requête, avec les
  mêmes curseurs, la même fenêtre lacunaire et le même temps réel, et rend des créneaux.
  Il n'existe pas de second fil de données.
- La tête du fil forme le premier créneau : bandeaux, composeur, actus, portées, vue en
  cours. La fin forme le dernier créneau :
  - « Charger la suite » reste toujours offert ;
  - une page vide qui a une suite n'est jamais présentée comme une fin ;
  - une fin réelle est dite ;
  - une page sans réponse ne conclut rien.
- En approchant de la fin, le lecteur charge au plus trois pages de lui-même
  (`IMMERSIVE_AUTO_LOAD_PAGES`). Ces chargements sont bornés et annoncés. La liste garde la
  doctrine « pas de défilement infini ».
- Sur la première page, les publications arrivées pendant la lecture sont retenues en tête.
  Elles ne s'insèrent pas sous la lecture. La commande dédiée « N nouvelles publications »
  les montre et ramène à la plus récente. Une insertion ou un retrait au-dessus est
  compensé par une ancre.
- Le retrait de la publication lue est annoncé, et le focus passe au créneau suivant. Une
  baisse de profondeur due au recalage temps réel déclenche une recherche de la publication
  lue.
- L'avertissement de couverture limitée reste visible dans la barre du lecteur (« Fil
  incomplet », « Fil en préparation ») et en clair dans la fin, avec la date d'historique PA10.

### Surfaces

- **Téléphone** (`ReseauMobileFeed`) : le fil et ses mots-clés s'ouvrent en immersion par
  défaut. La recherche et la publication ouverte restent en liste. La bascule se trouve
  dans la barre du lecteur.
- **Bureau** (`ReseauAgentPage`) : la liste reste le défaut. La bascule est ajoutée aux
  outils du fil, juste après la portée, et c'est le seul point d'entrée. L'immersion monte
  le lecteur dans la colonne de lecture, à la place de la liste. Le rail, les volets et la
  colonne d'iCom ne changent pas. Il n'y a pas de seconde bascule dans la barre du lecteur.
- **National, province, mot-clé** (`apps/antsia_ga/.../member-feed.tsx`) : la fenêtre reste
  celle de l'adresse (`curseur`). « Suivant » et « Première page » vivent dans la fin du
  lecteur, et le lecteur ne change jamais l'adresse de lui-même. Les publications arrivées
  en tête de la première fenêtre sont retenues de la même manière.

### Mode Liste/Immersion

- La bascule est un groupe nommé de deux boutons `aria-pressed`, chacun avec icône et
  libellé. Elle est toujours visible sur les surfaces de fil.
- Le choix est mémorisé par réseau et par pose (téléphone ou bureau), dans `localStorage`,
  sous la clé `antsia:<slug>:feed-mode:v1`. Cette clé suit le préfixe du réseau : la porte
  de déconnexion (`personalStateKeys`, préfixe `antsia:`) la purge.
- Si la réduction des mouvements est demandée et qu'aucun choix explicite n'existe, la
  liste s'affiche. Un choix explicite est respecté, avec des transitions immédiates.
- Sous 480 px de hauteur de fenêtre (téléphone en paysage, zoom à 200 %), la liste remplace
  l'immersion. La raison est dite et le choix de la personne n'est pas effacé. Le contenu
  n'est jamais tronqué.

### Retour à la publication lue

- La mémoire de navigation de l'onglet est un singleton de module, sans stockage durable et
  sans adresse. Elle retient :
  - l'identifiant de la publication ;
  - le décalage, selon le mode qui l'a mesuré ;
  - l'index de galerie ;
  - la profondeur.
- Une portée appartient à un réseau, une personne et un fil. Une position dure trente
  minutes. Au plus douze positions sont retenues, sur au plus dix pages de profondeur.
- En revenant d'une offre, des commentaires ou d'un profil, la profondeur est rechargée
  page par page. La publication est ensuite rétablie avec son décalage et son image de
  galerie. Cela fonctionne en immersion par le lecteur, et en liste par `FeedListReturn` et
  les enveloppes `display: contents`.
- Si une autre personne remplace la session, ou si la coque se démonte, tout est purgé.
  Une ancienne coque ne purge jamais la nouvelle personne.
- Changer de mode, par la bascule ou à cause d'un écran trop bas, garde la publication lue.

### Coordination de lecture

- `features/media-playback/` contient trois couches :
  - des décisions pures (`media-playback-policy.ts`) ;
  - un coordinateur sans React (`media-playback-coordinator.ts`) ;
  - un pont d'environnement (`MediaPlaybackProvider`).
- Au plus une vidéo joue à la fois, quel que soit le mode. En liste, les commandes natives
  restent identiques et seules les règles d'unicité et de suspension s'appliquent.
- Dans le créneau lu, la vidéo démarre en muet, seulement si le navigateur l'admet et hors
  économie de données. Sinon, un bouton « Lire » est proposé. Le son demande un geste
  (bouton « Son » `aria-pressed`). La préférence de son vaut ensuite pour la session.
- La lecture est suspendue dans ces cas, et la raison est dite :
  - vidéo hors écran (seuil de 70 %, réglable) ;
  - onglet masqué (`visibilitychange`) ;
  - appel entrant, sortant qui sonne, actif ou en attente.

  L'état d'appel est lu sans écriture, à partir de trois sources : les slots de
  `useCallStore`, sa fenêtre d'appel sortant, et `listRinging` avec les arguments de l'hôte
  d'appel, ce qui partage l'abonnement TanStack. Aucun fichier P05 n'est modifié.
- Le préchargement ne porte que les métadonnées de la publication lue et de sa seule
  voisine. Les publications lointaines ont `none`. En économie de données (`saveData`,
  `prefers-reduced-data`), aucune vidéo n'est anticipée.
- Il n'y a ni relance, ni passage automatique au post suivant. Une pause de la personne est
  respectée tant que la publication reste lue. Une vidéo citée dans un partage ne démarre
  jamais d'elle-même.
- `PostMediaPresentation.tsx` (fichier P03) reçoit deux ajouts, inertes sans leur contexte.
  La carte publique et DIASPORALE gardent donc le rendu P03, et `PostMedia.tsx` (classique)
  n'est pas modifié.

### Accessibilité

- Le lecteur est une région nommée et focalisable, avec une consigne clavier
  (`aria-describedby`). Chaque créneau est un `article` nommé (« Publication de … »), avec
  `aria-posinset` et `aria-setsize="-1"`.
- Les flèches haut et bas, Page précédente et Page suivante ne pilotent le lecteur que si le
  focus y est. Les champs, curseurs, menus, onglets, dialogues, feuilles en portail, vidéos
  et touches modifiées gardent leurs touches. Un créneau plus haut que l'écran défile
  d'abord.
- Le DOM est conservé et le focus n'est jamais recyclé. `content-visibility: auto` borne le
  rendu, pas le DOM.
- Après « Charger la suite », le focus rejoint la première publication ajoutée. Une suite
  vide ne garde pas d'intention de focus. Le chargement, le retrait, le retour et les
  nouvelles publications sont annoncés dans une région polie. Une erreur de page s'annonce
  par sa propre alerte.

## 3. Décisions

1. **Défilement natif accroché plutôt que `VerticalPager`.** `VerticalPager` translate une
   fenêtre de trois éléments sous `touch-action: none`. Pour le fil, cela casserait quatre
   choses : le zoom à deux doigts, le lecteur d'écran (deux tiers du fil hors du DOM), le
   texte plus haut que l'écran et la sélection de texte. Deux primitives sont reprises :
   `nextIndex` (`shell/mobile/gestures/swipe.ts`) et `useReducedMotion` (`motion/react`). La
   justification se trouve dans `immersive-reader-model.ts`.
2. **Immersion au bureau en ligne, pas en surcouche.** `ImmersiveOverlay` rendrait inertes
   les surfaces d'appel et le dock. Le lecteur prend donc la hauteur restante de la colonne.
3. **Fenêtres nationales par adresse.** Leur pagination reste explicite (« Suivant »). Le
   lecteur ne pagine pas d'adresse de lui-même.
4. **Chargement automatique borné à trois pages, en immersion seulement.** La commande
   reste offerte. Ce compromis entre la doctrine de 2026-08-05 et le défilement de 04 §3
   est à confirmer en recette.
5. **Mémoire de retour en mémoire d'onglet seulement.** Rien n'est stocké durablement et
   aucune adresse n'est gardée, comme pour la mémoire de liste iCom (P05).
6. **Le mode est une préférence, pas un droit.** Il ne change aucune donnée, requête ni garde.

## 4. Fichiers

### Créés

| Domaine | Fichiers |
|---|---|
| Coordination de lecture | `packages/social-features/src/features/media-playback/` : `media-playback-policy.ts`, `media-playback-coordinator.ts`, `media-playback-environment.ts`, `media-role-context.ts`, `media-playback-context.tsx`, `MediaPlaybackProvider.tsx`, `use-coordinated-video.ts`, `CoordinatedVideoControls.tsx`, `index.ts` |
| Fil immersif | `packages/social-features/src/features/feed-immersion/` : `feed-mode.ts`, `use-feed-mode.ts`, `feed-return-memory.ts`, `FeedReturnSessionBoundary.tsx`, `feed-post-memory.tsx`, `immersive-reader-model.ts`, `layout-measure.ts`, `immersive-styles.tsx`, `ImmersiveFeedReader.tsx`, `FeedModeToggle.tsx`, `FeedListReturn.tsx`, `use-feed-immersion.ts`, `index.ts` |
| Traductions | `packages/social-features/src/i18n/locales/{fr,en}/reseau.immersion.json` (mêmes clés, pluriels `_one/_many/_other`) |
| Tests (écrits, non exécutés) | `packages/api/src/network-feed-presentation.test.ts` ; `media-playback/{media-playback-policy,media-playback-coordinator}.test.ts`, `media-playback/{MediaPlaybackProvider,coordinated-video}.test.tsx` ; `feed-immersion/{feed-mode,feed-return-memory,immersive-reader-model}.test.ts`, `feed-immersion/{use-feed-mode,use-feed-immersion,ImmersiveFeedReader,FeedListReturn}.test.tsx` ; `reseau-personnel/FeedPages.immersive.test.tsx` ; `apps/antsia_ga/src/components/discovery/member-feed.immersive.test.tsx` |
| Rapport | `docs/etudes/2026-10-18-social-commerce/rapports/P04_SCROLL.md` |

### Modifiés (ajouts ciblés, travail des autres sessions conservé)

| Fichier | Ajout P04 |
|---|---|
| `packages/api/src/network.tsx` | `EngineFeedPresentation`, `feedPresentation` du contexte et du fournisseur, `resolveEngineFeedPresentation` |
| `packages/social-features/src/features/reseau-personnel/FeedPages.tsx` | Créneaux et état déclaré sous le lecteur, tête figée ; enveloppe d'ancre en liste sous capacité ; en-tête de provenance complété |
| `packages/social-features/src/features/reseau-personnel/PostMediaPresentation.tsx` (P03) | `useCoordinatedVideo`, `CoordinatedVideoControls`, préchargement coordonné ; index de galerie restauré (`useOptionalFeedPostMemory`) |
| `packages/social-features/src/features/reseau-personnel/index.ts` | Exports du fil immersif pour les applications |
| `packages/social-features/src/shell/index.ts` | `MediaPlaybackProvider`, `FeedReturnSessionBoundary` |
| `packages/social-features/src/shell/mobile/ReseauMobileFeed.tsx` | Branche immersive, bascule, `FeedListReturn` ; chaîne de pages factorisée, identique dans les deux modes |
| `packages/social-features/src/shell/ReseauAgentPage.tsx` | Bascule dans les outils du fil, lecteur dans la colonne, `FeedListReturn` ; tête factorisée sans changement de rendu en liste |
| `packages/social-features/src/i18n/index.ts` | Enregistrement de `reseau.immersion.json` dans l'espace `reseau` |
| `apps/antsia_ga/src/components/network-shell.tsx` | `feedPresentation="immersive"`, `FeedReturnSessionBoundary`, `MediaPlaybackProvider` |
| `apps/antsia_ga/src/components/discovery/member-feed.tsx` | Lecteur sur les portées National, province et mot-clé, bascule, ancres et retour en liste |
| `apps/antsia_ga/src/components/discovery/member-feed.test.tsx` | Simulation étendue (`useFeedImmersion: () => null`) |

## 5. Tests — écrits, non exécutés

Au total, 117 cas sont écrits : 13 fichiers nouveaux et une simulation adaptée. Aucun n'a été
lancé et aucun résultat n'est connu.

| Fichier | Couverture (écrit, non exécuté) |
|---|---|
| `network-feed-presentation.test.ts` (2) | Capacité sur déclaration seulement ; une valeur inconnue rend la liste |
| `media-playback-policy.test.ts` (12) | Seuil, suspensions, préchargement, décision de lecture automatique, rôle d'une vidéo citée |
| `media-playback-coordinator.test.ts` (19) | Une vidéo active, onglet masqué, appel (y compris les commandes natives), hors écran en liste et en immersion, pause de la personne, fin sans relance, son par geste, refus du son puis reprise muette, cycle de vie, instantanés stables |
| `MediaPlaybackProvider.test.tsx` (5) | Lecture seule de `listRinging` avec les mêmes arguments ; slots et appel sortant ; `visibilitychange` ; `saveData` |
| `coordinated-video.test.tsx` (8) | Sans coordinateur : P03 à l'identique ; « classic » inchangé ; muet à l'entrée ; « Lire » sur refus ; voisine et lointaine ; vidéo citée ; appel |
| `feed-mode.test.ts` (7) | Défauts, choix explicite, écran trop bas, clé par réseau, purge par `personalStateKeys` |
| `use-feed-mode.test.tsx` (6) | Capacité, pose, largeur inconnue, mouvements réduits, mémoire par réseau, hauteur |
| `feed-return-memory.test.ts` (7) | Titulaire actif, session remplacée, purge, durée, bornes, aucune adresse |
| `use-feed-immersion.test.tsx` (6) | Retour (publication, décalage, galerie, profondeur), changement de mode, session remplacée |
| `immersive-reader-model.test.ts` (12) | Clavier, créneau lu, voisine, ancre, fin, approche, retour, tête figée |
| `ImmersiveFeedReader.test.tsx` (16) | Gestes et touches croisés (curseur, portail, modifieur, détail), fin vide avec curseur, réponse tardive avec focus et annonce, nouvelles publications, retrait, retour par la profondeur, publication disparue |
| `FeedListReturn.test.tsx` (4) | Suivi en liste, rechargement de la profondeur puis recalage, carte disparue |
| `FeedPages.immersive.test.tsx` (9) | Créneaux nommés, fenêtre vide lacunaire, vide réel, panne, chargement, tête retenue, continuation, liste sans enveloppe ou avec enveloppe selon la capacité |
| `member-feed.immersive.test.tsx` (4) | Fenêtre de l'adresse dans le lecteur, fenêtre vide avec suite, chargement, liste avec bascule et ancres |

Commandes à lancer plus tard, sur source gelée, par le lanceur officiel :

```bash
bun run codegen                      # racine ANTSIA (lanceur scripts/convex-dev.mjs)
# depuis packages/social-features
bunx vitest run src/features/media-playback src/features/feed-immersion src/features/reseau-personnel/FeedPages
# depuis packages/api
bunx vitest run src/network-feed-presentation.test.ts
# depuis apps/antsia_ga
bunx vitest run src/components/discovery
# racine : typage tsgo, tests, cliquets (no-hardcoded-*, i18n-locales, provenance-headers), lint
bun run verify
```

## 6. Recette à faire (aucune réalisée)

1. Préparer 30 médias mixtes : photo, galerie de 2 à 4 images, vidéo portrait et paysage,
   texte long, partage avec vidéo citée, publication de page. Sur iPhone (Safari) et Android
   (Chrome) réels, vérifier :
   - une publication par hauteur ;
   - l'accrochage ;
   - le défilement intérieur d'un créneau haut ;
   - la galerie horizontale contre le geste vertical ;
   - le zoom à deux doigts ;
   - la sélection de texte.
2. Tester en faible débit (3G simulée) et avec `Save-Data` : aucune vidéo anticipée, bouton
   « Lire ».
3. Tester un téléphone en paysage et un bureau zoomé à 200 % : retour à la liste,
   explication visible, choix conservé.
4. Clavier :
   - les touches ne pilotent le lecteur que dans le lecteur ;
   - curseurs, menus et feuilles gardent leurs touches ;
   - après « Charger la suite », le focus rejoint la première publication ajoutée.
5. VoiceOver (iOS et macOS) et TalkBack : nom de la région, nom et position des articles,
   annonces (chargement, retrait, nouvelles publications, retour).
6. Avec la réduction des mouvements : liste par défaut, transitions immédiates.
7. Interruptions : appel entrant, appel sortant qui sonne, appel actif, appel en attente,
   onglet masqué. Vérifier la pause, le motif affiché et la reprise de la seule publication
   lue.
8. Preuve de lecture unique : dans le lecteur et en liste, avec les commandes natives,
   aucune paire de vidéos ne doit jouer en même temps. Vérifier `paused` par l'inspecteur.
9. Retour depuis une offre, des commentaires ou un profil, y compris en page 3 ou plus :
   même publication, même image de galerie, même décalage. Après déconnexion et changement
   de personne, rien ne doit être restauré.
10. Arrivée de nouvelles publications en temps réel : la lecture ne bouge pas, la commande
    « N nouvelles publications » apparaît.
11. Mesurer les budgets : mémoire (tas après 30 puis 100 publications), téléchargements
    (octets vidéo de la voisine limités aux métadonnées, aucun pour une publication
    lointaine), tâches longues et décalages de mise en page (trace de performance).
12. Vérifier que DIASPORALE est inchangée et qu'au bureau les rails, la colonne d'iCom et
    les surfaces d'appel ne sont pas affectés.

## 7. Bilan standard

| Champ | Contenu |
|---|---|
| Résultat | Le fil immersif et la coordination de lecture sont raccordés dans les sources servies d'antsia.ga (capacité déclarée dans `network-shell.tsx`), sur le téléphone, le bureau et les portées National, province et mot-clé. Le comportement n'est pas vérifié. |
| Source | Branche partagée `codex/pa4-identite-session`, `HEAD` `9eaff40`, arbre non commité des autres sessions conservé. Fichiers de P04 : les deux dossiers créés, `reseau.immersion.json` et les ajouts ciblés listés au §4. Rien n'a été commité. |
| Tests | 117 cas écrits dans 14 fichiers, non exécutés. Aucune commande lancée, aucun résultat. Commandes à lancer au §5. |
| Recette | Aucune : ni navigateur, ni appareil, ni lecteur d'écran, ni mesure. Points à couvrir au §6. |
| Dépendances | Vérification à lancer (codegen, typage, tests, cliquets, lint). Champs PA10 de `myFeed` (`lacunar`, `preparing`, `materializedSince`), venus d'une autre session et non commités. `PostMediaPresentation.tsx` (P03, non suivi) à livrer avec P04. Appareils réels pour la recette. |
| Retour arrière | Retirer `feedPresentation="immersive"` de `network-shell.tsx` rend la liste historique partout (ni bascule, ni lecteur, ni ancre, ni mémoire de retour). Retirer `<MediaPlaybackProvider>` rend aux vidéos leur comportement P03. Aucune donnée serveur ni aucun schéma n'est concerné. Le seul état local est `antsia:<slug>:feed-mode:v1`, purgé à la déconnexion. |
| Limites | Rien n'est prouvé : compilation, rendu, gestes, lecture unique et budgets restent à établir. Voir §8. |

## 8. Risques et limites

- **Code jamais compilé ni exécuté.** Des erreurs de typage ou de rendu sont possibles. Les
  signatures ont été lues dans les modules qui les exportent, et les diffs ont été relus.
- **Prise en charge inégale selon les navigateurs :**
  - `:has()` : sans lui, le détail ouvert ne retient plus le geste tactile au bord du
    créneau, mais la garde clavier reste en place ;
  - `content-visibility` : sans lui, tous les créneaux sont rendus, avec un coût de
    performance ;
  - `scroll-snap-stop` sur iOS ;
  - `navigator.getAutoplayPolicy` n'existe que sous Firefox. Ailleurs, le premier refus de
    `play()` fait basculer sur « Lire ».
- **Recalage temps réel.** Une baisse de profondeur peut faire clignoter brièvement le fil
  pendant que la publication lue est recherchée.
- **Pas d'affiche.** `PostMediaDto` ne porte aucune affiche : les vidéos préparées n'ont que
  leurs métadonnées, sans vignette inventée.
- **Bureau.** Il n'y a pas de panneau de détail latéral, car le rail n'est pas touché.
- **Pont d'environnement.** Il suit `useCallStore()` à chaque battement du magasin. Ce
  nœud rend `null` et reste borné.
- **Espace disque.** 8,4 Gio restent libres sur `/System/Volumes/Data`. Le vérifier avant
  le codegen et le backend local.
- **PA10.** Le lot ne réalise pas à lui seul le fil matérialisé.

## 9. Demandes au coordinateur

1. Mettre à jour `EXECUTION.md` et le README de l'étude selon ce verdict. P04 n'y a pas
   écrit.
2. Lancer la vérification du §5 dans un créneau coordonné, puis la recette du §6. Traiter
   les échecs avant tout commit.
3. Livrer P04 avec P03 (`PostMediaPresentation.tsx`) et les champs PA10 de `myFeed` dont
   `FeedPages.tsx` dépend déjà.
