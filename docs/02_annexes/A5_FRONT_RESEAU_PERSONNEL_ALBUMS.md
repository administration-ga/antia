---
title: "ANTSIA — Annexe A5 du document 02 : inventaire contradictoire, front — tranches reseau-personnel et reseau-albums"
date: "2026-10-14"
source: "socle administration.ga, origin/main = ad2e7fdc2, copie propre (git worktree add), lecture seule"
statut: "Rapport d'inventaire brut, produit en lecture seule ; la synthèse décisionnelle est docs/02_OWNER_MAP_DUPLICATION.md"
---

> Annexe A5 de `docs/02_OWNER_MAP_DUPLICATION.md`. Les chemins sont relatifs à la racine d'une copie
> propre du socle sur `origin/main` (`ad2e7fdc2`). Les numéros de ligne valent pour ce commit. Quand une
> décision du document 02 diffère d'une proposition de ce rapport, c'est le document 02 qui fait foi.

# Inventaire contradictoire : `reseau-personnel` et `reseau-albums` (socle `ad2e7fdc2`)

**Source.** `S = <copie propre du socle>`. `git log -1` donne `ad2e7fdc2` (09/10) et l'arbre est propre.

Tous les chemins sont relatifs à `S` :
- `AF` = `socle/packages/agent-features/src` ;
- `RP` = `AF/features/reseau-personnel` ;
- `RA` = `AF/features/reseau-albums`.

`AF/features/reseau` est hors sujet : c'est le réseau des caisses (8 fichiers, 1 740 l.). Aucun fichier de RP ou de RA ne l'importe.

**Méthode, en lecture seule.**
- Commandes : `ls -R`, `wc -l`, `grep -n`, `awk` et `perl -ne` (lecture seule), lecture des en-têtes et des passages cités.
- Git, en lecture seule sur la copie : `git log`, `git diff --stat`, `git ls-tree`, `git show`. Aucun fetch, aucune écriture.
- Lus pour comparaison : l'annexe B (`DIGITAL_GOUV/Documentation/RESEAUX_SOCIAUX/annexes/B_AUDIT_FRONTEND_…_2026-10-14.md`), le cahier ANTSIA §3.1, le prompt PA6, et les cliquets d'ANTSIA (`tests/ratchets/lib/detectors.ts`).

## Légende des tableaux

- **Cat.** : S (social générique), S\* (social marqué administration), K (coque), A (administratif).
- **Imports** (react omis) :
  - `int` : modules relatifs internes à la tranche ;
  - `F` : autres features d'AF, sous la forme `chemin:ligne` ;
  - `K` : `AF/shell`, `AF/hooks`, `AF/components` ;
  - `WS` : `@workspace/*` (`ui2` = ui-v2, `hooks` = api/hooks, `rt` = routing, `ui/sheet`, `ui/tooltip`) ;
  - `CX` : `@convex/*` (`api` = `_generated/api` ; `dm` = `_generated/dataModel`, toujours `import type { Id }` ; `rP/domain`, `rP/media`, `rA/domain`) ;
  - `cv` : `convex/react` (useMutation) ou `convex/server` ;
  - puis les paquets npm.
- **api.\*** : préfixes abrégés. `rP.` = `api.modules.reseauPersonnel.`, `Pages.` = `api.modules.reseauPages.pages.` ; q = `useAuthenticatedConvexQuery`, pq = `useAuthenticatedPaginatedQuery`, m = `useMutation`.
- **Accroches** : lignes de code ; « comm. » signale un commentaire.
- **≈lit** : nombre de lignes de code qui portent un texte d'interface littéral. C'est une heuristique awk : CSS et commentaires exclus. Elle sous-estime les libellés d'un seul mot.
- **Coul.** : les lignes que le cliquet ANTSIA `no-hardcoded-colors` attraperait (j'ai rejoué ses regex à l'identique). Il n'y a aucune classe de palette Tailwind. Les classes présentes sont sémantiques (`bg-primary`, `text-muted-foreground`…, dans ReseauMobileCreateButton L92-133 et ReseauMobileMenuSheet L68-100).
- **Cible** : par défaut, le même chemin relatif sous `packages/social-features/src/features/reseau-personnel/` (ou `…/reseau-albums/`). `shell/…` = `packages/social-features/src/shell/…`. « — » = non dupliqué.

---

## 1. Synthèse

**Volumes : identiques à l'annexe B.**
- RP : 105 sources / 29 508 l., dont `mobile/` 19 / 3 367 ; tests 65 / 14 178.
- RA : 6 sources / 1 657 l. ; tests 4 / 1 181.

**Répartition par catégorie** (RP + RA = 111 fichiers, 31 165 l.)

| Catégorie | Fichiers | Lignes |
|---|---|---|
| S | 46 | 11 628 |
| S\* | 30 | 11 738 |
| K | 30 | 4 719 |
| A | 5 | 3 080 |

**Sort proposé** (même périmètre)

| Sort | Fichiers | Lignes | Part |
|---|---|---|---|
| Tel quel | 17 | 1 972 | 6 % |
| À adapter | 72 | 21 386 | 69 % |
| À réécrire | 7 | 2 729 | 9 % |
| Retirer | 15 | 5 078 | 16 % |

L'annexe B donnait 34 % tel quel, 56 % à adapter et 10 % à retirer. L'écart est expliqué au §11.

**Volume d'adaptation.**
- 135 appels Convex reçoivent le réseau courant :
  - 63 `useAuthenticatedConvexQuery`, dont 2 génériques dans la pagination double ;
  - 4 `useAuthenticatedPaginatedQuery` ;
  - 68 `useMutation`.
- « /espace » apparaît sur 104 lignes : 39 de code, 65 de commentaires.
- Environ 1 000 lignes de texte d'interface littéral.
- 12 lignes de couleur seraient refusées par le cliquet ANTSIA.

**Points saillants nouveaux.**
- **Trois composants orphelins**, montés nulle part dans le socle : NotificationsPanel, ContactsRail, MonReseauCard.
- **`media.ts` n'est pas pur.** Le front n'en importe qu'un type, mais le module importe `_generated/server`, `lib/errors`, `customFunctions`, `fileGuard`…
- **Deux fonctions ne servent que l'annuaire administratif.** `api.modules.reseau.connections.paginateMine` et `paginatePendingForMe` (use-dual-connection-pagination) n'ont pas d'autre consommateur.
- **Retrait des Pages.** Le cahier §3.1 prévoit les Pages « à adapter (autorité générique) ». Le prompt PA6 demande au contraire de retirer « Pages = organisations ». Il faut trancher entre les deux.

---

## 2. `RP/` racine : 86 sources, 26 141 l.

### 2.A Pages et cadre

| Fichier | l. | Rôle | Cat. | Imports | api.\* | Accroches | ≈lit | Coul. | Sort et raison | Cible |
|---|---|---|---|---|---|---|---|---|---|---|
| ReseauAgentPage.tsx | 1149 | Page bureau `/espace` : bascule mobile (L160-170), barre d'identité, tablist chemise, rail-menu, 7 volets, chips de portée, stories, composeur, rails, dock iCom | S\* (+K) | int (26) : BookmarksPanel, DirectsLiveRail, DirectsPanel, EvenementsRail, EvenementsPanel, FeedPages, GroupsPanel, PagesPanel, PagesSuggestionsRail, ReseauMenuRail, PeoplePanel, PostCard, mobile/PostComposerSheet, ProfileMiniCard, ReseauDesktopIcomLink, SuggestionsPanel, mobile/ReseauMobilePage, mobile/useIsReseauMobile, useReseauFeedState, use-creation-controller, reseau-agent-nav, reseau-header, feed-scopes, reseau-feed-pages, reseau-layout, shared · F direct/CreateDirectDialog:85 (DirectLaunchButton), stories/StoriesTray:89, StoryCreateSheet:90, stories-entry:91, stories-styles:92, messagerie/MessagerieDock:93, iagenda/agenda-create-intent:119 · K components/espace-kit:82 · WS ui2 · lucide | aucun direct | `/espace/actus…` L953-954 (+ comm. L4, 32, 36, 223) ; Pages L101-102, 1067, 1128 ; chips (dont mon_administration) L121, 860 ; ids `iprofil-panel` / `iprofil-tab-` L712-723 ; `[data-espace-rail]` L568-592 ; MessagerieDock L1126 ; porte iCom L704 ; agenda L1078 ; @media 960/959 L596/603 | 18 | — | **À réécrire.** C'est la coque bureau (environ 380 l. de CSS de grille, L242-620, calées sur le rail de l'espace). Garder l'orchestration des volets ; retirer Pages et mon_administration ; routes par useRoutes | id. (grille → `shell/`) |
| MonProfilPage.tsx | 1646 | iProfil, dossier de l'agent en bento : état civil, carte d'agent, manques, parcours, demandes, documents, profil de réseau | A | int : Avatar, ProfilProfessionnelSection, ProfilReseauSection, ReseauQueryError, anchor-settle, iprofil-sections, parcours-model, profile-onboarding, use-profile-onboarding, use-section-follower · F espace-personnel/DocumentsPersonnelsPage:56 · WS hooks, rt, ui2 · lucide | rP.people.getMyProfile q L100 ; api.functions.users.getMe q L103, 1313 ; iProfiles.getMyIProfil q L105 ; positionAssignments.getMyAssignments q L1383 ; memberships.listMyMemberships q L1387 ; requests.listMine q L1583 | 48 lignes « iProfil » ; `/espace/profil/…` L346 ; `/espace/demandes` L1136, 1639 ; orgId L1441, 1458, 1471 ; « agent de l'administration » L884, 1050 | 52 | — | **Retirer** (dossier administratif). À remplacer par un « Mon profil » social bâti sur ProfilReseauSection | — |
| ProfilPersonnePage.tsx | 893 | Profil public `/profil/[handle]` : couverture, identité, connexion et suivi, présence, onglets Publications / Photos / Albums, aperçu | S\* | int : Avatar, PostCard, ProfilFrame, ReseauQueryError, design-styles, profil-personne, query-state, reseau-agent-nav, reseau-feed-pages · F iappel/presence-dot:59, reseau-albums/AlbumComposer, AlbumsSection, album-model:75-81 · K espace-kit:74 · WS hooks, rt, ui2 · cv react · sonner | rP.people.getPublicProfile q L206 ; rP.people.getMyProfile q L210 ; api.modules.reseau.connections.withAgent q L311 ; rP.follows.isFollowing q L315 ; rP.posts.personPosts q L631 ; iProfiles.getMyIProfil q L732 ; rP.connections.requestByHandle m L779 ; rP.follows.follow m L865 ; rP.follows.unfollow m L866 | `/espace/parametres?tab=reseau` et `?tab=professionnel` L120-121 ; `/espace/profil` L148, 274 (+7 comm.) ; MonIProfilResume L729-770, monté L490 ; bouton « Mon dossier iProfil » L457-464 ; aperçu « ce que voient vos collègues » L143 | 35 | — | **À adapter** : retirer le résumé iProfil et le bouton dossier ; routes par useRoutes ; withAgent vers l'API du moteur ; i18n | id. |
| ProfilPagePage.tsx | 437 | Page publique d'une administration `/pages/[handle]` (ADR-0073) | S\* | int : Avatar, PostCard, PostComposer, ProfilFrame, design-styles, profil-page, reseau-agent-nav, reseau-feed-pages · WS hooks, rt, ui2 · cv react · sonner | Pages.getPage q L91 ; Pages.follow m L95 ; Pages.unfollow m L96 ; Pages.pagePosts q L397 | Pages = organisations (en-tête L3-16) ; `/espace/profil/…` L310 ; `reseauAgentHref("pages")` L166 | 7 | — | **Retirer** (Pages = organisations). À réécrire si des Pages génériques sont gardées (cahier M-A5) | — |
| ProfilFrame.tsx | 143 | Cadre CSS des pages d'identité (bannière, carte à cheval, corps) | S | aucun | — | `.pp-avatar--square` (« logo institutionnel ») L86-93 ; comm. iProfil L54 | 0 | — | **Tel quel.** La variante carrée tombe avec les Pages | id. |

### 2.B Fil et publication

| Fichier | l. | Rôle | Cat. | Imports | api.\* | Accroches | ≈lit | Coul. | Sort et raison | Cible |
|---|---|---|---|---|---|---|---|---|---|---|
| FeedPages.tsx | 158 | Une page du fil (`myFeed` + curseur) et l'état vide ; découverte intercalée | S\* | int : PagesSuggestionsRail, PostCard, SuggestionsPanel, feed-scopes, reseau-feed-pages, useReseauFeedState · K espace-kit:20 · WS hooks, ui2 | rP.posts.myFeed q L80 | argument `scope` L86-88 (mon_administration possible) ; rail Pages L22, 151 | 0 | — | **À adapter** : networkId, portée sans mon_administration, retrait du rail Pages | id. |
| PostCard.tsx | 697 | Publication : auteur (personne ou page), corps riche, médias, partage cité, carte de direct, réactions, commentaires, menu | S\* | int : Avatar, CommentsSurface, PostMedia, PostOverflowMenu, PostReactionControl, ReportContentDialog, RichText, SharePostDialog, author-link, design-styles, shared · F direct/direct-status:23 · CX api, dm, rP/media (type PostMediaDto):14 · WS rt, ui2 · cv react · sonner, lucide | rP.engagement.toggleReaction m L185 ; rP.posts.remove m L187 ; rP.posts.edit m L188 ; rP.posts.pinOnMyWall m L189 ; rP.moderation.reportPost m L191 ; rP.moderation.reportComment m L194 | `authorKind` L88 ; `page{pageId, orgId: Id<"orgs">}` L95-101 ; `/espace/conference/…` L614 (+ comm. L80, 258-259) ; libellés audience et raison L334 (organisation, collegue, page, via shared) | 16 | — | **À adapter** : retirer la branche page/orgId ; route par useRoutes ; type depuis social-contracts ; i18n | id. |
| PostComposer.tsx | 631 | Composeur : texte, médias, audience ; cible fil, groupe ou page ; brouillon durable ; idempotence | S\* | int : Avatar, design-styles, post-composer-target, post-draft, post-draft-store, shared, useMediaDraft · CX api, dm · WS ui2, hooks · cv react · sonner | rP.people.getMyProfile q L158 ; rP.posts.publish m L188 ; Pages.publishAsPage m L192 ; rP.media.generateUploadUrl m L194 | `asPage` L95-99, 122, 132-145, 216-237, 329-335, 555-578 ; PAGE_AUDIENCE_OPTIONS (« organisation ») L47, 217, 578 | 14 | — | **À adapter** : retirer asPage, publishAsPage et l'audience organisation ; networkId ; i18n | id. |
| PostMedia.tsx | 650 | Médias : image, carrousel de 2 à 4, vidéo, plein écran | S | int : mobile/ImmersiveOverlay, post-media-carousel · CX rP/media (type):28 · lucide | — | — | 14 | — | **À adapter** : type depuis social-contracts ; i18n | id. |
| PostOverflowMenu.tsx | 359 | Menu « … » portalisé | S | int : author-link, post-overflow · CX api, dm · cv react · react-dom, sonner | rP.marks.toggleMark m L92 ; hidePost m L93 ; unhidePost m L94 ; muteAuthor m L95 ; unmuteAuthor m L97 | `authorKind` (page) L50, 67, 236 | 13 | rgb() L252 | **À adapter** | id. |
| PostReactionControl.tsx | 387 | Les 4 réactions (appui long, clavier) | S | int : shared · lucide | — (props) | — | 5 | rgb() L299 | **À adapter** | id. |
| CommentsSurface.tsx | 547 | Commentaires (feuille ou panneau portalisé) | S | int : Avatar, RichText, shared, mobile/useBodyScrollLock, mobile/useVisualViewport · CX api, dm · WS hooks, ui2 · cv react · lucide, react-dom, sonner | rP.engagement.listComments q L57 ; comment m L60 ; removeComment m L62 | @media 768 px L390 | 14 | rgb() L361, 374, 401 | **À adapter** | id. |
| SharePostDialog.tsx | 199 | Relayer une publication avec un mot (portail) | S | int : shared · CX api, dm · WS ui2 · cv react · react-dom, sonner | rP.posts.publish m L86 | — | 8 | rgba() L125 | **À adapter** | id. |
| ReportContentDialog.tsx | 124 | Signalement (6 motifs) | S | WS ui2 · react-dom | — | motifs codés L3-10 | 13 | rgb() L39, 57 | **À adapter** (i18n) | id. |
| RichText.tsx | 84 | Corps sans HTML découpé par `splitBodyRich` | S | CX rP/domain:17 | — | — | 0 | — | **À adapter** : import vers social-contracts, rien d'autre | id. |
| Avatar.tsx | 94 | Pastille : photo, initiales ou silhouette ; ronde ou carrée | S | WS ui2 | — | forme carrée « administration » (comm. L20-27, prop L28) | 0 | — | **Tel quel.** Partagé par 9 features | id. |

### 2.C Relations et découverte

| Fichier | l. | Rôle | Cat. | Imports | api.\* | Accroches | ≈lit | Coul. | Sort et raison | Cible |
|---|---|---|---|---|---|---|---|---|---|---|
| PeoplePanel.tsx | 1306 | Volet Relations : recherche, invitations reçues et envoyées, suggestions, connexions, suivis, appeler, écrire | S\* | int : Avatar, ReseauQueryError, author-link, design-styles, empty-states, people-panel, query-state, reseau-agent-nav, shared, suggestions-actions, use-dual-connection-pagination · F iappel/presence-dot:14-18, iappel/useRingRelation:19, messagerie/messagerie-dock:36, messagerie/messagerie-routes:37 · K espace-kit:28-35 · CX api, dm · WS hooks, rt, ui2 · cv react, server (type) · sonner | rP.people.searchPeople q L338 ; rP.connections.requestByHandle m L346, 737 ; rP.follows.follow m L348 ; rP.connections.respond m L539 ; rP.suggestions.listSentInvitations q L652 ; paginate q L726 (type L708) ; listDismissed q L733 ; dismiss m L739 ; restore m L740 ; rP.follows.listMyFollows q L1040 ; myFollowerCount q L1044 ; unfollow m L1047 ; connexions par la pagination double L197, 968 | ligne « fonction » = poste : props positionTitle/orgName L588-589, 686-687, 897-898, 1009-1010, 1144-1157 ; calcul L1164 ; rendu L1239-1241 ; « Agents à découvrir » L851, 872, 885, 957 | 67 | — | **À adapter** : headline seule ; vocabulaire ; networkId ; i18n | id. |
| SuggestionsPanel.tsx | 365 | « Agents à découvrir » (rail ou carrousel) | S\* | int : Avatar, DiscoveryEmptyCard, author-link, design-styles, people-panel, suggestions-actions · CX api · WS hooks, rt, ui2 · cv react · sonner | rP.suggestions.paginate q L80 ; rP.connections.requestByHandle m L84 ; rP.suggestions.dismiss m L87 | « agents » L105, 121-122, 186, 210 | 14 | — | **À adapter** | id. |
| DiscoveryEmptyCard.tsx | 62 | Carte vide de découverte (texte en props) | S | int : design-styles, suggestions-actions · WS ui2 | — | — | 0 | — | **Tel quel** | id. |
| RelationPicker.tsx | 300 | Sélecteur de relations à cocher | S | int : relation-picker, use-relation-search · WS ui2 | — (passe par le hook) | `candidate.position` (poste) L249 | 7 | — | **À adapter** | id. |
| ContactsRail.tsx | 183 | Rail Contacts : connexions, filtre, brouillon de conversation | S | int : Avatar, ReseauQueryError, contacts-rail, design-styles, use-dual-connection-pagination · WS ui2 | rP.connections.paginateMine, par usePersonalConnections L40 | **orphelin** : exporté (index L51), monté nulle part | 6 | — | **À adapter** (i18n). Optionnel | id. |
| MonReseauCard.tsx | 227 | Carte-raccourci « Mon réseau » | S\* | int : reseau-agent-nav, shared, use-dual-connection-pagination · CX api · WS hooks, ui2 · **next/link** L26 | rP.follows.listMyFollows q L61 ; rP.notifications.unreadCount q L65 ; rP.people.getMyProfile q L69 | `next/link` L26, 216 ; « collègues » et « administration » L162-163 ; **orphelin** (index L38-39) | 6 | — | **Retirer** : orphelin, remplacé par ReseauMenuRail | — |

### 2.D Groupes, Pages, Conférences, Évènements, Signets, Notifications

| Fichier | l. | Rôle | Cat. | Imports | api.\* | Accroches | ≈lit | Coul. | Sort et raison | Cible |
|---|---|---|---|---|---|---|---|---|---|---|
| GroupsPanel.tsx | 1140 | Volet Groupes : annuaire, création, page de groupe, invitations, membres et rôles, mur, épingles | S | int : PostCard, PostComposer, RelationPicker, ReseauQueryError, design-styles, empty-states, groupes-thematiques, query-state, relation-picker, reseau-feed-pages · K espace-kit:29-34 · CX api, dm · WS hooks, ui2 · cv react · sonner | rP.groupesThematiques : myInvites q L185 ; myGroups q L189 ; discover q L193 ; respondInvite m L197, 594 ; join m L199, 591 ; create m L486 ; getGroup q L588 ; leave m L592 ; unpinGroupPost m L597 ; invite m L847 ; listInviteCandidates q L849 ; listMembers q L937 ; setMemberRole m L941 ; removeMember m L944 ; groupWall q L1058 ; pinGroupPost m L1061 ; removeGroupPost m L1063 | « agents » L551 | 58 | — | **À adapter** | id. |
| PagesPanel.tsx | 331 | Volet Pages : administrations suivies et à découvrir | S\* | int : Avatar, PageFollowButton, ReseauPaginatedErrorBoundary, ReseauQueryError, author-link, design-styles, pages-panel, query-state · K espace-kit:44-49, hooks/useDebouncedValue:50 · CX api, dm · WS hooks, rt, ui2 | Pages.listMyPageFollows q L111 ; Pages.discoverPage pq L186 | « administrations » L127-128 ; pageHref L272 | 4 | — | **Retirer** | — |
| PageFollowButton.tsx | 84 | Bouton Suivre / Suivi d'une page | S\* | int : design-styles, pages-panel · CX api, dm · WS ui2 · cv react · sonner | Pages.follow m L50 ; Pages.unfollow m L51 | Pages | 0 | — | **Retirer** | — |
| PagesSuggestionsRail.tsx | 298 | « Pages à suivre » | S\* | int : Avatar, DiscoveryEmptyCard, PageFollowButton, author-link, design-styles, reseau-agent-nav, suggestions-actions · CX api, dm · WS hooks, rt, ui2 | Pages.discover q L50 | volet pages L128 ; pageHref L211, 227 | 11 | — | **Retirer** | — |
| DirectsPanel.tsx | 695 | Volet Conférences : en direct, rediffusions, mes sessions | S | int : Avatar, ReseauQueryError, design-styles, directs-panel, empty-states · F direct/direct-status:29, direct/direct-playback:32-38 · K espace-kit:25 · CX api, dm · WS hooks, rt, ui2 | api.modules.direct.sessions.listLive q L130 ; listReplays q L134 ; listMinePage q L138 | `/espace/conference/…` L682 (+ comm. L10) | 11 | — | **À adapter** | id. |
| DirectsLiveRail.tsx | 140 | Rail « En direct maintenant » | S | int : Avatar, author-link, design-styles, directs-panel · CX api · WS hooks, rt, ui2 | direct.sessions.listLive q L35 | `/espace/conference/…` L93 | 3 | — | **À adapter** | id. |
| EvenementsPanel.tsx | 388 | Volet Évènements : agenda, réponses, annonce, annulation | S | int : AnnounceEventDialog, Avatar, ReseauQueryError, design-styles, empty-states, evenements-list, query-state · K espace-kit:38-43 · CX api, dm · WS hooks, ui2 · cv react · sonner | rP.evenements.myAgenda q L84 ; respond m L87 ; cancel m L88 | fuseau Libreville (comm. L11 ; la décision est dans evenements-list) | 18 | — | **À adapter** | id. |
| EvenementsRail.tsx | 134 | Aperçu des prochains évènements | S | int : Avatar, design-styles, evenements-list, reseau-agent-nav · CX api · WS hooks, rt, ui2 | rP.evenements.myAgenda q L20 | lien vers le volet L68 | 5 | — | **À adapter** | id. |
| AnnounceEventDialog.tsx | 197 | Annoncer un évènement (audience, mot, récapitulatif) | S | int : evenements-list, shared · CX api, dm · WS ui2 · cv react · react-dom, sonner | rP.evenements.announce m L76 | — | 8 | rgba() L121 | **À adapter** | id. |
| BookmarksPanel.tsx | 209 | Volet Enregistrements (aperçus) | S | int : Avatar, ReseauPaginatedErrorBoundary, bookmarks-panel, design-styles, empty-states, shared · K espace-kit:26 · CX api, dm · WS hooks, rt, ui2 · cv react · sonner | rP.marks.paginateBookmarks pq L67 ; toggleMark m L71 | lien de l'état vide L112 | 9 | — | **À adapter** | id. |
| NotificationsPanel.tsx | 105 | Enveloppe Card de NotificationsList | S | int : design-styles · F notifications/NotificationsList:21, notification-targets:22 · CX dm · WS ui2 | — (passe par NotificationsList) | **orphelin** : aucun montage ; la cloche l'a remplacé (R-03) | 0 | — | **Retirer.** Son test va vers notifications | — |

### 2.E Profil social

| Fichier | l. | Rôle | Cat. | Imports | api.\* | Accroches | ≈lit | Coul. | Sort et raison | Cible |
|---|---|---|---|---|---|---|---|---|---|---|
| ProfileMiniCard.tsx | 448 | Barre de profil d'iRéseau (en-tête) | S\* | int : Avatar, profil-personne, profile-onboarding, reseau-header, use-profile-onboarding · CX api · WS hooks, rt, ui2 | rP.people.getMyProfile q L87 | `/espace/profil` L68 (Link L334, 387, 434) ; `/espace/parametres?tab=reseau` L69 (push L317) ; « parchemin d'iProfil » L114 | ≥1 | — | **À adapter** | id. |
| ProfilePublicationCard.tsx | 477 | Éditeur de visibilité : publier ou retirer, confidentialité, avatar, couverture, adresse | S\* (léger) | int : Avatar, HandleChoiceCard, ReseauQueryError, design-styles, profile-onboarding, shared, use-profile-onboarding · CX api · WS hooks, ui2 · cv react · sonner | rP.people.getMyProfile q L69 ; publishMyProfile m L78 ; withdrawMyProfile m L81 ; setMyProfilePrivacy m L84 ; setMyAvatar m L86 ; setMyCover m L87 ; rP.media.generateUploadUrl m L89 | « votre poste reste joignable dans l'annuaire » L447 | 40 | — | **À adapter** | id. |
| HandleChoiceCard.tsx | 175 | Choix de l'identifiant public | S | int : design-styles · CX api · WS hooks, ui2 · cv react · sonner | rP.people.suggestHandles q L44 ; confirmMyHandle m L48 | — | 11 | — | **À adapter** | id. |
| ProfilReseauSection.tsx | 154 | Onglet « Profil de réseau » : opt-in, aperçu, listes de confidentialité | S\* | int : PrivacyLists, ProfilePublicationCard, ReseauQueryError, profile-visibility-copy · F parametres-personnels/parametres-nav:21 · CX api · WS hooks, rt, ui2 | api.functions.users.getMe q L27 (administratif, sert `avatarUrl` L123) ; rP.people.getMyProfile q L36 | `parametresHref("compte")` L80 ; `/espace/profil/…?apercu=1` L94 ; « vu par mes collègues » L108 | 8 | — | **À adapter** : getMe vers l'identité du moteur | id. |
| PrivacyLists.tsx | 208 | Signets, sourdines, publications masquées, réversibles | S | int : ReseauPaginatedErrorBoundary, ReseauQueryError · CX api · WS hooks, ui2 · cv react · sonner | rP.marks.paginateBookmarks pq L32 ; myMutes q L37 ; paginateHiddenPosts pq L41 ; unmuteAuthor m L45 ; unhidePost m L46 | — | 22 | — | **À adapter** | id. |
| ProfilProfessionnelSection.tsx | 474 | Fiche iProfil professionnelle (régime, matricule, corps…) | A | int : ReseauQueryError, iprofil-form · F parametres-personnels/design-styles:44-47 · CX api · WS hooks, ui2 · cv react · **react-i18next** L34 (clés `iprofilPersonal.form.*`) · sonner | iProfiles.getMyIProfil q L53 ; iProfiles.upsertMyIProfil m L56 | 32 lignes « iProfil » | 10 | — | **Retirer** | — |

### 2.F Coque bureau et états d'échec

| Fichier | l. | Rôle | Cat. | Imports | api.\* | Accroches | ≈lit | Coul. | Sort et raison | Cible |
|---|---|---|---|---|---|---|---|---|---|---|
| ReseauMenuRail.tsx | 255 | Rail-menu vertical : volets, raccourcis, profil, paramètres | K | int : Avatar, design-styles, reseau-agent-nav, reseau-menu · K shell/personal-nav:34 · CX api · WS hooks, ui2 | rP.people.getMyProfile q L60 ; Pages.listMyPageFollows q L64 ; rP.groupesThematiques.myGroups q L68 | PERSONAL_PROFILE_URL et PERSONAL_SETTINGS_URL L95, 188, 196 ; raccourcis de pages L145, 232 | 3 | — | **À adapter** : retirer Pages ; routes par useRoutes | `shell/ReseauMenuRail.tsx` |
| ReseauDesktopIcomLink.tsx | 100 | Porte iCom avec non-lus | K | int : shared · F messagerie/dock-store:13, messagerie-source:14-18 · WS ui2 | indirect : `SOURCE_AGENT.useUnreadTotals` L45 | libellés L37-41 | 3 | — | **À adapter** (après la messagerie) | `shell/` |
| ReseauQueryError.tsx | 25 | État d'échec partagé (Alert + Réessayer) | K | WS ui2 | — | « Réessayer » L19 | 1 | — | **À adapter** (i18n) | `shell/` |
| ReseauPaginatedErrorBoundary.tsx | 41 | Error boundary des listes paginées | K | int : ReseauQueryError | — | — | 0 | — | **Tel quel** | `shell/` |

### 2.G Hooks et état

| Fichier | l. | Rôle | Cat. | Imports | api.\* | Accroches | ≈lit | Sort et raison | Cible |
|---|---|---|---|---|---|---|---|---|---|
| useReseauFeedState.ts | 504 | Tout l'état d'iRéseau, partagé bureau et téléphone | S\* | int : feed-scopes, profile-onboarding, reseau-agent-nav, reseau-feed-pages, reseau-layout, use-dual-connection-pagination, use-profile-onboarding · F notifications/notification-center-store:40 · CX api, dm · WS hooks, rt (`usePathname`, `useRouter`, `useSearchParams`, `useTabQueryState`, L33-38) | rP.posts.search q L256 ; getPost q L260 ; rP.follows.listMyFollows q L276 ; rP.people.getMyProfile q L298 (+ connexions L265, 279) | `/espace/profil/…` L362 (+ comm. L10, 153) ; portée L181-185, 330 ; openNotificationCenter L421 | 0 | **À adapter** (useRoutes, useNetwork, portée) | id. |
| use-creation-controller.ts | 77 | Ouverture des surfaces de création | S | int : creation-controller, post-draft-store | — | — | 0 | **Tel quel** | id. |
| use-dual-connection-pagination.ts | 201 | Pagination à double curseur des connexions | S | int : dual-pagination-pages · CX api · WS hooks · cv server (types) | rP.connections.paginateMine L164-165 (type L42) ; paginatePendingForMe L175-176 ; api.modules.reseau.connections.paginateMine L186-187 (type L45) ; reseau.connections.paginatePendingForMe L197-198 (type L48) | useCore\* (L181-201) : seul consommateur `annuaire/use-annuaire-connections.ts:46, 58` | 0 | **À adapter** : networkId ; useCore\* hors périmètre | id. |
| use-profile-onboarding.ts | 86 | Rattrapage de la publication d'office | S | int : profile-onboarding · CX api · WS hooks · cv react | rP.people.ensureMyProfile m L58 ; getMyProfile q L61 | — | 0 | **À adapter** | id. |
| use-relation-search.ts | 100 | Recherche serveur parmi mes relations | S | K hooks/useDebouncedValue:30 · CX api · WS hooks · cv server (type) | rP.connections.searchMine q L80 (type L38) | — | 0 | **À adapter** | id. |
| use-section-follower.ts | 104 | La section suit l'URL | K | — | — | n'est utilisé que par MonProfilPage:85 | 0 | **Retirer** | — |
| useMediaDraft.ts | 444 | Brouillon de médias : sélection, téléversement, texte alternatif | S | int : post-draft, post-draft-store · CX rP/domain (constantes POST\_\*):39-45 | — (URL fournie par l'appelant ; fetch L419) | — | 9 | **À adapter** : constantes vers social-contracts ; i18n | id. |
| post-draft-store.ts | 307 | Magasin de brouillons (useSyncExternalStore + sessionStorage) | S | int : post-draft, shared | — | préfixe `espace:post-drafts:v1:` L65 ; cible page L199-200 | 0 | **À adapter** : clé préfixée par le réseau | id. |

### 2.H Modules purs

| Fichier | l. | Rôle | Cat. | Imports | Accroches | ≈lit | Sort et raison | Cible |
|---|---|---|---|---|---|---|---|---|
| anchor-settle.ts | 66 | Re-défiler vers une ancre (iProfil) | K | — | comm. `/espace/profil?section=` L12 ; utilisé par MonProfilPage seul | 0 | **Retirer** | — |
| author-link.ts | 163 | Destination de l'auteur, badge, forme de pastille, droits du menu | S\* | — | personHref `/espace/profil/` L55 ; pageHref `/espace/pages/` L68 ; `AuthorKind "page"` L20 | 2 | **À adapter** | id. |
| bookmarks-panel.ts | 47 | Décisions du volet Enregistrements | S | — | — | 3 | **À adapter** (i18n) | id. |
| contacts-rail.ts | 96 | Décisions du rail Contacts | S | int : shared | « Trouvez des collègues » L89 | 3 | **À adapter** | id. |
| creation-controller.ts | 223 | Ce qu'on peut créer et par quelle surface | S | int : reseau-agent-nav · F reseau-albums/album-model:30, iagenda/agenda-create-intent:31 · WS ui2 (type) | événement via iAgenda L80-81 ; `/espace/profil` L89 | 10 | **À adapter** | id. |
| design-styles.ts | 77 | Styles de surfaces (jetons `--esp-*`, `--rp-*`) | K | — | jetons de la charte espace-personnel | 0 | **À adapter** (jetons ANTSIA) | `shell/` |
| directs-panel.ts | 313 | Décisions du volet Conférences | S | K shell/espace-origin:22 | `/espace/conference/` L312 ; comm. « espace_administration_ga » L301 | 16 | **À adapter** | id. |
| dual-pagination-pages.ts | 255 | Chaîne de pages à double curseur | S | — | — | 0 | **Tel quel** | id. |
| empty-states.ts | 268 | États vides et seul geste proposé | S | int : evenements-list, groupes-thematiques, people-panel, reseau-agent-nav | liens L146, 202, 213 ; « agent » L239 | 17 | **À adapter** | id. |
| evenements-list.ts | 359 | Sections, libellés et dates des évènements | S\* | — | `Africa/Libreville` L58 (employé L67, 317, 325) ; `fr-FR` L316, 324 | 13 | **À adapter** : fuseau et locale de la personne | id. |
| feed-scopes.ts | 139 | Chips de portée du fil | S\* | int : reseau-agent-nav, reseau-layout (types) | `mon_administration` L41, 72-77 ; alias L89-91 | 7 | **À adapter** | id. |
| groupes-thematiques.ts | 280 | Décisions du volet Groupes | S | — | — | 31 | **À adapter** (i18n) | id. |
| index.ts | 147 | Barrel : réexporte 70 modules (34 non exportés) | K | int : 70 | comm. `/espace` L4-12, 29, 79 | 0 | **À réécrire** | id. |
| iprofil-form.ts | 203 | Normalisation du formulaire iProfil | A | — | — | 0 | **Retirer** | — |
| iprofil-sections.ts | 332 | Sections d'iProfil | A | — | `IPROFIL_URL` L54 ; 52 lignes « iProfil » ; importé aussi par shell/espace-mobile-volets, espace-personnel et parametres-personnels | 16 | **Retirer** | — |
| pages-panel.ts | 280 | Décisions du volet Pages | S\* | — | orgId L25 ; « administrations » L219, 244 | 16 | **Retirer** | — |
| parcours-model.ts | 425 | Parcours d'agent | A | — | orgId sur 10 lignes ; UTC L316 | 19 | **Retirer** | — |
| people-panel.ts | 139 | Sous-vues, ligne « fonction », présence | S\* | int : reseau-agent-nav | personTitleLine L104-115 ; peopleViewHref L74-79 | 3 | **À adapter** | id. |
| post-composer-target.ts | 118 | Qui publie (fil, groupe, page) | S\* | — | asPage L22-33, 43, 58, 69, 96 ; textes « administration » L86-87 | 8 | **À adapter** | id. |
| post-draft.ts | 477 | Modèle pur du brouillon | S\* | int : shared | cible page L40-41, 56, 65, 77, 117, 152, 218-220, 429-431 ; `PAGE_AUDIENCES` (« organisation ») L369 | 0 | **À adapter** | id. |
| post-media-carousel.ts | 51 | Décisions du carrousel | S | — | — | 0 | **Tel quel** | id. |
| post-overflow.ts | 189 | Composition du menu « … » | S | int : author-link | authorKind page L74, 136 | 21 | **À adapter** | id. |
| profil-page.ts | 66 | Décisions de la page d'administration | S\* | — | Pages | 7 | **Retirer** | — |
| profil-personne.ts | 96 | Décisions de la page personne | S | — | — | 5 | **À adapter** (i18n) | id. |
| profile-onboarding.ts | 253 | Ce que l'écran demande sur le profil | S\* | int : profile-visibility-copy | « vos collègues » L221, 248 ; comm. iProfil L5, 155, 180 | 13 | **À adapter** | id. |
| profile-visibility-copy.ts | 148 | Ce que le réseau montre de vous (3 faits, 5 gestes) | S\* | — | dossier administratif L51 ; « agents » L57, 115 ; « poste … annuaire » L109 | 21 | **À réécrire** (texte) | id. |
| query-state.ts | 163 | Contrat d'état de liste (6 états) | K | — | — | 0 | **Tel quel** | `shell/` |
| relation-picker.ts | 267 | Candidats parmi ses relations | S\* (léger) | F iappel/add-to-call-candidates:34-37, messagerie/messagerie-recipients:38 | positionTitle L63, 110 | 6 | **À adapter** | id. |
| reseau-agent-nav.ts | 620 | Volets, paramètres et adresses du réseau | K (S\*) | int : reseau-layout | `RESEAU_AGENT_URL = "/espace"` L50, source de toutes les adresses ; volet « pages » L196-208 ; alias administrations/organisations/orgs L275-278 ; textes L186, 193, 207 | 17 | **À réécrire** : adresses par useRoutes | `shell/` |
| reseau-feed-pages.ts | 161 | Pagination du fil | S | — | — | 1 | **À adapter** (i18n L157) | id. |
| reseau-header.ts | 58 | Quelle en-tête afficher | K | int : reseau-agent-nav | — | 0 | **Tel quel** | `shell/` |
| reseau-layout.ts | 262 | Seuils de mise en page, vues, entrelacement | K | — | TABLET\_\* L91-100 ; COLLECTION_VOLETS (pages) L103 | 4 | **À adapter** (un seul format) | `shell/` |
| reseau-menu.ts | 190 | Composition du rail-menu | K | int : reseau-agent-nav · WS ui2 (type) | raccourcis `/espace/pages/` L159 | 0 | **À adapter** | `shell/` |
| shared.ts | 563 | Logique décidable : audiences, raisons, réactions, dates, compteurs, phrases, validations | S\* | — | `PostAudience` « organisation » L37 ; `FeedReason` « collegue » L49 et « page » L56 ; PageAudience et PAGE_AUDIENCE_OPTIONS (« Mon administration » L127) L95-132 ; libellés L178-179, 188, 208-209 ; `toLocaleDateString("fr-FR")` L229 | 64 | **À adapter** | id. |
| suggestions-actions.ts | 105 | État du geste « Se connecter » | S | — | — | 5 | **À adapter** (i18n) | id. |

Aucun appel `api.*` dans les modules purs. `iprofil-form.ts` L47 ne cite `upsertMyIProfil` qu'en commentaire.

---

## 3. `RP/mobile/` : 16 sources, 2 943 l.

| Fichier | l. | Rôle | Cat. | Imports | api / indirect | Accroches | ≈lit | Coul. | Sort et raison | Cible |
|---|---|---|---|---|---|---|---|---|---|---|
| ImmersiveOverlay.tsx | 175 | Surface plein écran portalisée | K | int : useBodyScrollLock, useVisualViewport · WS ui2 · react-dom | — | `--vv-height` L163 | 0 | — | **Tel quel.** PA6 §4 le place dans `packages/ui` | `shell/mobile/` |
| PostComposerSheet.tsx | 210 | Surface du composeur, bureau et téléphone | S | int : ../PostComposer, ../post-draft, ../post-draft-store, ../reseau-layout, ImmersiveOverlay, useIsReseauMobile · WS ui2 | — | — | 8 | — | **À adapter** | id. |
| ReseauMobileCreateButton.tsx | 143 | Commande flottante « Créer » | K | int : ../creation-controller, reseau-mobile-tabs · F espace-personnel/EspaceFloatingCard:36, floating-surface/use-surface-insets:37 · WS rt, ui2 · lucide | — | usePathname | 3 | hsl() L121, 125 (repli dans une classe arbitraire) | **À adapter** | `shell/mobile/` |
| ReseauMobileFeed.tsx | 350 | Fil au téléphone | S\* | int : ../Avatar, ../FeedPages, ../PostCard, ../feed-scopes, ../reseau-feed-pages, ../reseau-layout, ../shared, ../useReseauFeedState · F stories/StoriesTray:35, stories-entry:36, stories-styles:37 · WS ui2 | passe par FeedPages | `/espace/parametres?tab=reseau` L58 ; `/espace/actus…` L192-193, 198 ; chips L41, 212 | 6 | — | **À adapter** | id. |
| ReseauMobileHeader.tsx | 217 | En-tête : titre, recherche, iCom, cloche, avatar | K | int : ../reseau-agent-nav, ../shared, ../Avatar · F notifications/NotificationBell:39 · K shell/espace-mobile-volets:38 · WS rt, ui2 | indirect : NotificationBell | `ESPACE_ICOM_URL` L179 ; `reseauBaseHref = RESEAU_AGENT_URL` L204 | 10 | — | **À adapter** | `shell/mobile/` |
| ReseauMobileMenuSheet.tsx | 118 | Feuille Menu (iRéseau + espace agent) | K | int : reseau-mobile-tabs · F stories/stories-entry:37 · K hooks/use-personal-modules:32, shell/personal-nav:33-36 · WS rt, **ui/sheet**:24-29, **ui/tooltip**:30, ui2 | indirect : `personalModules.grants.myPersonalModules` (L53) | `/espace/actus` L95 ; « Menu principal » L72 | 0 | — | **À réécrire** | `shell/mobile/` |
| ReseauMobilePage.tsx | 257 | Pilote du réseau au téléphone (volets en colonne, créations) | S\* | int : ../GroupsPanel, ../PeoplePanel, ../PagesPanel, ../DirectsPanel, ../EvenementsPanel, ../BookmarksPanel, ../reseau-agent-nav, ../creation-controller, ../use-creation-controller, ../useReseauFeedState, ReseauMobileFeed, ReseauMobileHeader, ReseauMobileShell, PostComposerSheet, reseau-mobile-tabs · F direct/CreateDirectDialog:31, stories/StoryCreateSheet:32, messagerie/messagerie-source:33, iagenda/agenda-create-intent:35 · WS rt | indirect : `SOURCE_AGENT.useUnreadTotals` L71 | `/espace/profil` L46 ; PagesPanel L27, 225 ; agenda L236 | 8 | — | **À adapter** | id. |
| ReseauMobileShell.tsx | 84 | Charpente du téléphone | K | int : mobile-styles, ReseauMobileCreateButton, ReseauMobileTabBar, ../creation-controller, reseau-mobile-tabs | — | — | 0 | — | **Tel quel** | `shell/mobile/` |
| ReseauMobileTabBar.tsx | 178 | Barre basse | K | int : reseau-mobile-tabs · K shell/espace-mobile-volets:39, espace-mobile-volets-row:40, personal-nav:41 · WS rt, ui2 | — | `EspaceMobileVoletsRow activeVolet="ireseau"` L144 ; ESPACE_MENU_TILE L123-130 | 2 | — | **À adapter** | `shell/mobile/` |
| VerticalPager.tsx | 199 | Pager vertical plein écran (aussi utilisé par stories) | K | int : gestures · motion/react | — | — | 0 | — | **Tel quel** | `shell/mobile/` |
| mobile-shell.ts | 81 | Seuil de la coquille (959 px) | K | K shell/poste-breakpoint:1 | — | 959 = POSTE_MOBILE_MAX_PX | 0 | — | **À adapter** (format unique) | `shell/mobile/` |
| mobile-styles.tsx | 370 | Feuille de la coquille mobile | K | — | — | paliers tablette 600/820 L190-207 ; @media 705 L246 ; masque `black` L252-262 (non détecté) ; comm. `#espace-main` L43 | 0 | hex en comm. L321 | **À adapter** | `shell/mobile/` |
| reseau-mobile-tabs.ts | 366 | Onglets bas et sections du menu | K | int : ../reseau-agent-nav · K shell/personal-nav:39-44, personal-chrome:45-48 · WS ui2 (type) | — | `/espace` en code L214, 216, 218, 249-251, 299 (+9 comm.) ; « Espace agent » L319 | 15 | — | **À réécrire** | `shell/mobile/` |
| useBodyScrollLock.ts | 49 | Verrou de défilement | K | — | — | `#espace-main` L28, 36 | 0 | — | **À adapter** | `shell/mobile/` |
| useIsReseauMobile.ts | 62 | Arbre téléphone, bureau ou inconnu | K | int : mobile-shell | — | — | 0 | — | **Tel quel** | `shell/mobile/` |
| useVisualViewport.ts | 84 | Hauteur visible et clavier en variables CSS | K | — | — | `--vv-height` L40 | 0 | — | **Tel quel** | `shell/mobile/` |

## 4. `RP/mobile/gestures/` : 3 sources, 424 l.

| Fichier | l. | Rôle | Cat. | Imports | Sort | Cible |
|---|---|---|---|---|---|---|
| index.ts | 2 | Barrel | K | int : swipe, usePointerSwipe | **Tel quel** | `shell/mobile/gestures/` |
| swipe.ts | 275 | Machine de geste pure | K | — | **Tel quel** | idem |
| usePointerSwipe.ts | 147 | Événements pointer vers swipe | K | int : swipe | **Tel quel** | idem |

Aucun appel API, aucune accroche, aucun littéral. Ces fichiers sont aussi importés par stories (StoryViewer) et messagerie (MessageBubble).

## 5. `RA/` : 6 sources, 1 657 l.

| Fichier | l. | Rôle | Cat. | Imports | api.\* | Accroches | ≈lit | Sort et raison | Cible |
|---|---|---|---|---|---|---|---|---|---|
| AlbumComposer.tsx | 652 | Composeur en 4 étapes ; ré-encodage canvas qui retire l'EXIF (fail-closed) | S | int : album-model, albums-api · F reseau-personnel/useMediaDraft:31-34 · CX rA/domain (ALBUM_ITEMS_MAX):35 · WS ui2 · cv react · sonner | albumsApi.create m L149 ; addItems L150 ; publish L151 ; reorder L152 ; setCover L153 ; setCaption L154 ; albumUploadUrlRef (= `reseauPersonnel/media:generateUploadUrl`) L155 | — | 41 | **À adapter** : API typée, networkId, i18n | id. |
| AlbumPage.tsx | 247 | Galerie d'un album et retrait | S | int : albums-api, album-model · F reseau-personnel/ProfilFrame:27, ReseauQueryError:28 · WS hooks, rt, ui2 · cv react · sonner | albumsApi.getAlbum q L49 ; withdraw m L50 | retour par albumBackHref ; comm. `/espace` L4 | 11 | **À adapter** | id. |
| AlbumsSection.tsx | 200 | Albums et photos d'un profil | S | int : albums-api, album-model · F reseau-personnel/ReseauQueryError:21, query-state:22-27 · WS hooks, rt, ui2 | albumsApi.listForPerson q L62 | albumHref ; comm. iProfil L6-9 | 5 | **À adapter** | id. |
| album-model.ts | 316 | Étapes, progression, clavier, ré-encodage, libellés, adresses | S | CX rA/domain (ALBUM_ITEMS_MAX, ALBUM_TITLE_MAX):14-17 | — | albumHref `/espace/profil/…/albums/…` L263-265 ; albumBackHref L268-270 ; « réseau des agents » L243 | 24 | **À adapter** | id. |
| albums-api.ts | 181 | Références de fonctions écrites à la main et DTO | S | cv server (`makeFunctionReference`):24 | 13 références par nom `modules/reseauAlbums/albums:*` L82-169 (create, update, addItems, setCaption, reorder, setCover, removeItem, publish, withdraw, remove, getAlbum, listMine, listForPerson) ; albumUploadUrlRef L179-181 | 14 `makeFunctionReference` | 0 | **À réécrire** : API typée ; DTO vers social-contracts | id. |
| index.ts | 61 | Barrel | K | int : 5 modules | — | — | 0 | **À adapter** | id. |

---

## 6. Tests

**Abréviations des mocks** : api = `@convex/_generated/api`, hooks = `@workspace/api/hooks`, cvx = `convex/react`, rt = `@workspace/routing`, ui2 = `@workspace/ui-v2`.

**Colonne « Relit le source »** : oui = cliquet `readFileSync`.

### 6.1 `RP/` racine : 59 tests, 12 908 l., 850 cas statiques (882 exécutés), 21 en jsdom

**Tests montés en jsdom (21)**

| Test | l. | Cas | Mocks | Relit le source | Remarques |
|---|---|---|---|---|---|
| Avatar.test.tsx | 28 | 1 | ui2 | non | |
| CommentsSurface.test.tsx | 191 | 4 | api, hooks, cvx, ui2, ./Avatar, ./RichText, ./mobile/useBodyScrollLock, ./mobile/useVisualViewport, sonner | non | |
| DirectsPanel.test.tsx | 279 | 7 | api, hooks, rt, ui2, components/espace-kit | non | `/espace` ×1 |
| DiscoveryEmptyCard.test.tsx | 38 | 2 | — | non | compare le littéral d'empty-states |
| EvenementsPanel.test.tsx | 307 | 12 | api, hooks, cvx, sonner, ui2 | non | Libreville ×1 |
| GroupsPanel.test.tsx | 331 | 13 | api, hooks, cvx, sonner, ./PostCard, ./PostComposer, ui2 | non | |
| MonProfilPage.sections.test.tsx | 267 | 7 | api, hooks, rt, ui2, lucide-react, ./Avatar, espace-personnel/DocumentsPersonnelsPage, ./ProfilReseauSection, ./ProfilProfessionnelSection, ./use-profile-onboarding | non | A : retiré avec la page |
| NotificationsPanel.test.tsx | 415 | 13 | api, hooks, cvx, rt, ui2, sonner | non | exerce surtout NotificationsList : à déplacer |
| PagesPanel.test.tsx | 263 | 8 | api, hooks, cvx, sonner, rt, ui2 | non | retiré avec les Pages |
| PeoplePanel.test.tsx | 541 | 23 | api, hooks, iappel/useRingRelation, ./use-dual-connection-pagination, iappel/presence-dot, rt, cvx, sonner, ui2 | non | `/espace` ×2 |
| PostComposer.test.tsx | 354 | 6 | api, hooks, cvx, sonner, ui2 | non | |
| PostReactionControl.test.tsx | 97 | 3 | — | non | |
| ProfilPersonnePage.test.tsx | 633 | 32 | api, hooks, rt, iappel/presence-dot, reseau-albums/AlbumsSection, reseau-albums/AlbumComposer, cvx, sonner, ./PostCard, ui2 | non | iProfil ×3, `/espace` ×1 |
| ProfilReseauSection.test.tsx | 118 | 6 | api, hooks, rt, ui2, ./ProfilePublicationCard, ./PrivacyLists, ./ReseauQueryError | non | |
| RelationPicker.test.tsx | 190 | 9 | ./use-relation-search, ui2 | non | |
| ReseauDesktopIcomLink.test.tsx | 103 | 4 | api, hooks, messagerie/dock-store, ui2 | non | |
| tablist-contract.test.tsx | 432 | 18 (19 exécutés) | rt, ui2, shell/espace-mobile-volets-row | **oui** : ReseauAgentPage, PeoplePanel, espace-kit/EspaceDossierTabs, iboite-souveraine/MailboxSectionTabs, IdnPersonalMailbox | importe aussi espace-kit et iboite-souveraine/mailbox |
| use-creation-controller.test.tsx | 70 | 5 | — | non | |
| use-dual-connection-pagination.test.tsx | 153 | 2 | api, hooks | non | |
| use-relation-search.test.tsx | 183 | 5 | api, hooks | non | |
| use-section-follower.test.tsx | 191 | 10 | — | non | retiré avec le hook |

**Tests en environnement node, sans mock (38)**

| Test | l. | Cas | Relit le source | Remarques |
|---|---|---|---|---|
| anchor-settle | 83 | 7 | non | retiré |
| author-link | 154 | 20 | non | `/espace` ×12 |
| bookmarks-panel | 27 | 2 | non | |
| contacts-rail | 129 | 14 | non | |
| creation-controller | 188 | 17 | non | `/espace` ×3 |
| directs-panel | 444 | 50 | non | importe direct/direct-playback ; `/espace` ×3 |
| dual-pagination-pages | 296 | 22 | non | |
| empty-states | 226 | 11 (17 exécutés) | **oui** : BookmarksPanel, DirectsPanel, PeoplePanel, GroupsPanel, EvenementsPanel | `/espace` ×3 |
| evenements-list | 417 | 26 | non | Libreville ×3 |
| feed-scopes | 93 | 10 | non | mon_administration ×4 |
| groupes-thematiques | 163 | 16 | non | |
| iprofil-form | 244 | 17 | non | A |
| iprofil-sections | 303 | 28 | **oui** : `socle/convex/ai/navManifest.ts` (×2), MonProfilPage | A |
| pages-panel | 344 | 39 | non | retiré |
| parcours-model | 348 | 15 | **oui** : MonProfilPage | A |
| people-panel | 168 | 21 | **oui** : PeoplePanel | `/espace` ×3 |
| post-composer-target | 153 | 20 | non | |
| post-draft-store | 237 | 13 | non | |
| post-draft | 330 | 25 | non | organisation ×2 |
| post-media-carousel | 50 | 7 | non | |
| post-overflow | 175 | 15 | non | |
| profil-page | 96 | 14 | non | retiré |
| profil-personne | 95 | 10 | non | |
| profile-onboarding | 214 | 22 | non | `/espace` ×1 |
| profile-visibility-copy | 116 | 11 | **oui** : ProfilReseauSection, iprofil-sections, ProfilProfessionnelSection, MonReseauCard | |
| query-state | 165 | 15 (26 exécutés) | non | |
| relation-picker | 293 | 16 | non | type tiré d'iappel/add-to-call-candidates |
| reseau-agent-nav | 578 | 49 | non | `/espace` ×10 |
| reseau-feed-pages | 135 | 14 | non | |
| reseau-header | 43 | 5 | non | |
| reseau-layout | 450 | 28 | **oui** : CSS de ReseauAgentPage et de mobile/mobile-styles, ReseauAgentPage, mobile/ReseauMobileTabBar, PeoplePanel, PagesPanel, GroupsPanel | importe stories/story-create et espace-personnel/espace-rail-collapse ; assertions tablette L330-341 |
| reseau-menu | 168 | 16 | non | `/espace` ×2 |
| reseau-query-states | 83 | 2 (16 exécutés) | **oui** : 11 composants + ReseauPaginatedErrorBoundary | |
| reseau-rendering-contract | 180 | 15 | **oui** : ReseauAgentPage, mobile/ReseauMobilePage, DirectsPanel, PagesPanel, mobile/ReseauMobileShell, mobile/ReseauMobileTabBar, design-styles, ProfileMiniCard, messagerie/messagerie-styles, notifications/notification-targets | |
| reseau-v2-consumers | 49 | 2 | **oui** : 7 fichiers de RP + messagerie/IcomRelationsPanel, annuaire/use-annuaire-connections, espace-personnel/PersonalCounters, components/call-center/CallCenterShell, iasted/IAstedPage | |
| shared | 320 | 28 | non | |
| suggestions-actions | 94 | 13 | non | |
| useMediaDraft | 73 | 5 | non | |

**Cas générés par boucle**, ce qui explique l'écart entre 850 cas statiques et 882 exécutés :

| Test | Cas ajoutés |
|---|---|
| query-state | +11 |
| reseau-query-states | +14 |
| empty-states | +6 |
| tablist-contract | +1 |

### 6.2 `RP/mobile/` : 5 tests, 908 l., 60 cas, 3 en jsdom

| Test | l. | Cas | Env. | Mocks | Relit le source | Remarques |
|---|---|---|---|---|---|---|
| PostComposerSheet.test.tsx | 165 | 6 | jsdom | ui2, ./ImmersiveOverlay, ./useIsReseauMobile, ../PostComposer | non | |
| ReseauMobileCreateButton.test.tsx | 146 | 8 | jsdom | rt, react-i18next | non | `/espace` ×4 |
| ReseauMobileTabBar.test.tsx | 110 | 2 | jsdom | rt, ui2, shell/espace-mobile-volets-row | non | `/espace` ×5 |
| mobile-shell.test.ts | 72 | 10 | node | — | non | |
| reseau-mobile-tabs.test.ts | 415 | 34 | node | — | **oui** : ReseauMobilePage | `/espace` ×53 |

### 6.3 `RP/mobile/gestures/` : 1 test

`swipe.test.ts` : 362 l., 47 cas, node, aucun mock, ne relit pas le source.

### 6.4 `RA/` : 4 tests, 1 181 l., 69 cas, 3 en jsdom

| Test | l. | Cas | Env. | Mocks | Remarques |
|---|---|---|---|---|---|
| AlbumComposer.test.tsx | 431 | 15 | jsdom | cvx, sonner, ui2 | aucun mock d'api : références par nom |
| AlbumPage.test.tsx | 261 | 12 | jsdom | hooks, rt, cvx, sonner, ui2 | `/espace` ×2 |
| AlbumsSection.test.tsx | 208 | 11 | jsdom | hooks, rt, ui2 | `/espace` ×1 |
| album-model.test.ts | 281 | 31 | node | — | `/espace` ×7 |

Aucun test de RA ne relit le source.

### 6.5 Cliquets hors périmètre qui visent ces dossiers

- `AF/shell/landmarks.ratchet.test.ts` : L74, 121, 124.
- `AF/shell/poste-chrome.ratchet.test.ts` : relit `mobile/mobile-shell.ts`, L34.
- `AF/shell/poste-floating-cards.ratchet.test.ts` : L34.
- `socle/convex/tests/charteRatchet.test.ts`.
- Environ 20 tests de messagerie, direct, iappel, notifications et dcrh simulent des modules de RP, `Avatar` surtout.

---

## 7. Totaux mesurés avec `wc -l`

| Sous-dossier | Sources (fichiers / l.) | Tests (fichiers / l.) | Cas (statiques / exécutés) | jsdom | Cliquets readFileSync |
|---|---|---|---|---|---|
| RP racine | 86 / 26 141 | 59 / 12 908 | 850 / 882 | 21 | 10 |
| RP `mobile/` | 16 / 2 943 | 5 / 908 | 60 / 60 | 3 | 1 |
| RP `mobile/gestures/` | 3 / 424 | 1 / 362 | 47 / 47 | 0 | 0 |
| **RP** | **105 / 29 508** (`.tsx` 54 / 19 020 ; `.ts` 51 / 10 488) | **65 / 14 178** | **957 / 989** | 24 | 11 |
| **RA** | **6 / 1 657** | **4 / 1 181** | 69 / 69 | 3 | 0 |
| **Total** | 111 / 31 165 | 69 / 15 359 | 1 026 / 1 058 | 27 | 11 |

**Catégories, en fichiers / lignes**

| Sous-dossier | S | S\* | K | A |
|---|---|---|---|---|
| RP racine | 40 / 9 822 | 28 / 11 131 | 13 / 2 108 | 5 / 3 080 |
| RP `mobile/` | 1 / 210 | 2 / 607 | 13 / 2 126 | — |
| RP `mobile/gestures/` | — | — | 3 / 424 | — |
| RA | 5 / 1 596 | — | 1 / 61 | — |

**Sorts, en fichiers / lignes**

| Sous-dossier | Tel quel | À adapter | À réécrire | Retirer |
|---|---|---|---|---|
| RP racine | 9 / 944 | 58 / 18 055 | 4 / 2 064 | 15 / 5 078 |
| RP `mobile/` | 5 / 604 | 9 / 1 855 | 2 / 484 | — |
| RP `mobile/gestures/` | 3 / 424 | — | — | — |
| RA | — | 5 / 1 476 | 1 / 181 | — |

Détail des 15 retraits (5 078 l.) :
- A, 3 080 l. : MonProfilPage, ProfilProfessionnelSection, iprofil-form, iprofil-sections, parcours-model ;
- Pages, 1 496 l. : ProfilPagePage, PagesPanel, PageFollowButton, PagesSuggestionsRail, pages-panel, profil-page ;
- orphelins, 332 l. : MonReseauCard, NotificationsPanel ;
- utilitaires d'iProfil, 170 l. : anchor-settle, use-section-follower.

---

## 8. Modules `@convex/*` importés par les deux features (à sortir vers `@antsia/social-contracts`)

**`@convex/modules/reseauPersonnel/domain`.** Module pur : aucun import, 1 633 l.
- `RichText.tsx:17` importe `splitBodyRich` (fonction L967, type `PostBodySegment` L939).
- `useMediaDraft.ts:39-45` importe `POST_IMAGE_MAX_BYTES` (L116), `POST_VIDEO_MAX_BYTES` (L117), `POST_MEDIA_MAX_COUNT` (L118), `POST_IMAGE_MIME_TYPES` (L120) et `POST_VIDEO_MIME_TYPES` (L126).
- Par ricochet, `IMAGE_ONLY_ACCEPT` (useMediaDraft L92) est importé par AlbumComposer.

**`@convex/modules/reseauPersonnel/media`.** Module **non pur**, 198 l. : il importe `_generated/dataModel`, `_generated/server`, `lib/errors`, `lib/customFunctions`, `lib/uploadPolicy`, `fileGuard/admission` et `fileGuard/storageGuard`.
- Seul `import type { PostMediaDto }` (L43-51) est utilisé, dans `PostCard.tsx:14` et `PostMedia.tsx:28`.
- Il faut extraire **le type seul**.

**`@convex/modules/reseauAlbums/domain`.** Module pur, 355 l.
- `AlbumComposer.tsx:35` importe `ALBUM_ITEMS_MAX` (L42).
- `album-model.ts:14-17` importe `ALBUM_ITEMS_MAX` et `ALBUM_TITLE_MAX` (L59).
- Ce module importe lui-même `../reseauPersonnel/domain` (`POST_IMAGE_MAX_BYTES`, `POST_IMAGE_MIME_TYPES`, `POST_MEDIA_ALT_MAX_LENGTH`, `type PersonalReachAudience`). Les deux modules sortent donc ensemble.

**`@convex/_generated/api`**, à remplacer par `@antsia/api`.
- 33 fichiers de RP : AnnounceEventDialog, BookmarksPanel, CommentsSurface, DirectsLiveRail, DirectsPanel, EvenementsPanel, EvenementsRail, FeedPages, GroupsPanel, HandleChoiceCard, MonProfilPage, MonReseauCard, PageFollowButton, PagesPanel, PagesSuggestionsRail, PeoplePanel, PostCard, PostComposer, PostOverflowMenu, PrivacyLists, ProfilPagePage, ProfilPersonnePage, ProfilProfessionnelSection, ProfilReseauSection, ProfileMiniCard, ProfilePublicationCard, ReseauMenuRail, SharePostDialog, SuggestionsPanel, use-dual-connection-pagination, use-profile-onboarding, use-relation-search, useReseauFeedState.
- Aucun fichier de RA : il passe par `makeFunctionReference`.

**`@convex/_generated/dataModel`.** 18 fichiers, uniquement `import type { Id }`. Tables référencées :

| Table | Occurrences |
|---|---|
| `reseauPersonnel_posts` | 11 |
| `direct_sessions` | 8 |
| `reseauPages_pages` | 6 |
| `users` | 3 |
| `reseauPersonnel_thematicGroups` | 2 |
| `reseauPersonnel_postComments` | 2 |
| `reseauPersonnel_events` | 2 |
| `connections` | 2 |
| `reseauPersonnel_thematicGroupInvites` | 1 |
| `reseauPersonnel_eventParticipants` | 1 |
| `orgs` | 1 (PostCard) |

**Autres candidats aux contrats, hors `@convex/*`.**
- Les DTO typés à la main de `albums-api.ts` : AlbumSummary, AlbumItem, AlbumDetail, DeclaredAlbumItem, AlbumAudienceValue, AlbumStatusValue, AlbumPage, AlbumPaginationOpts.
- Les « miroirs client » recopiés du serveur :
  - `shared.ts` : `FeedReason`, `PostAudience`, `ReachAudience` ;
  - `feed-scopes.ts` ;
  - `groupes-thematiques.ts` ;
  - `evenements-list.ts` : `EvenementListItem`, miroir de `PersonalEventDto` ;
  - `bookmarks-panel.ts` : `BookmarkedPostSummary` ;
  - `directs-panel.ts` ;
  - `pages-panel.ts` : `PageSummary`.

---

## 9. Liste exhaustive des `api.*` appelés (parité backend)

### `api.modules.reseauPersonnel.*` : 71 fonctions

| Sous-module | Fonctions → fichier:ligne |
|---|---|
| posts | myFeed q FeedPages:80 · search q useReseauFeedState:256 · getPost q :260 · personPosts q ProfilPersonnePage:631 · publish m PostComposer:188, SharePostDialog:86 · edit m PostCard:188 · remove m PostCard:187 · pinOnMyWall m PostCard:189 |
| engagement | toggleReaction m PostCard:185 · listComments q CommentsSurface:57 · comment m :60 · removeComment m :62 |
| moderation | reportPost m PostCard:191 · reportComment m :194 |
| marks | toggleMark m PostOverflowMenu:92, BookmarksPanel:71 · hidePost m PostOverflowMenu:93 · unhidePost m :94, PrivacyLists:46 · muteAuthor m PostOverflowMenu:95 · unmuteAuthor m :97, PrivacyLists:45 · paginateBookmarks pq BookmarksPanel:67, PrivacyLists:32 · paginateHiddenPosts pq PrivacyLists:41 · myMutes q PrivacyLists:37 |
| media | generateUploadUrl m PostComposer:194, ProfilePublicationCard:89, plus par nom `albums-api.ts:180` (AlbumComposer:155) |
| people | getMyProfile q ×10 : MonProfilPage:100, MonReseauCard:69, PostComposer:158, ProfilPersonnePage:210, ProfilReseauSection:36, ProfileMiniCard:87, ProfilePublicationCard:69, ReseauMenuRail:60, use-profile-onboarding:61, useReseauFeedState:298 · getPublicProfile q ProfilPersonnePage:206 · searchPeople q PeoplePanel:338 · suggestHandles q HandleChoiceCard:44 · confirmMyHandle m :48 · ensureMyProfile m use-profile-onboarding:58 · publishMyProfile m ProfilePublicationCard:78 · withdrawMyProfile m :81 · setMyProfilePrivacy m :84 · setMyAvatar m :86 · setMyCover m :87 |
| connections | paginateMine q use-dual-connection-pagination:164 (type :42) · paginatePendingForMe q :175 · searchMine q use-relation-search:80 (type :38) · requestByHandle m PeoplePanel:346, :737, SuggestionsPanel:84, ProfilPersonnePage:779 · respond m PeoplePanel:539 |
| follows | follow m PeoplePanel:348, ProfilPersonnePage:865 · unfollow m PeoplePanel:1047, ProfilPersonnePage:866 · listMyFollows q useReseauFeedState:276, PeoplePanel:1040, MonReseauCard:61 · isFollowing q ProfilPersonnePage:315 · myFollowerCount q PeoplePanel:1044 |
| suggestions | paginate q PeoplePanel:726 (type :708), SuggestionsPanel:80 · dismiss m PeoplePanel:739, SuggestionsPanel:87 · restore m PeoplePanel:740 · listDismissed q :733 · listSentInvitations q :652 |
| groupesThematiques (GroupsPanel) | myInvites q :185 · myGroups q :189 (+ ReseauMenuRail:68) · discover q :193 · respondInvite m :197, :594 · join m :199, :591 · create m :486 · getGroup q :588 · leave m :592 · unpinGroupPost m :597 · invite m :847 · listInviteCandidates q :849 · listMembers q :937 · setMemberRole m :941 · removeMember m :944 · groupWall q :1058 · pinGroupPost m :1061 · removeGroupPost m :1063 |
| evenements | myAgenda q EvenementsPanel:84, EvenementsRail:20 · respond m EvenementsPanel:87 · cancel m :88 · announce m AnnounceEventDialog:76 |
| notifications | unreadCount q MonReseauCard:65 (orphelin ; NotificationsList et NotificationBell l'appellent aussi) |

### Autres espaces de noms

| Espace de noms | Fonctions → fichier:ligne | Sort |
|---|---|---|
| `api.modules.reseau.connections` (graphe) | withAgent q ProfilPersonnePage:311 · paginateMine q use-dual-connection-pagination:186 (type :45) · paginatePendingForMe q :197 (type :48) | withAgent à garder. Les deux pagines ne servent que l'annuaire |
| `api.modules.reseauPages.pages` | getPage q ProfilPagePage:91 · follow m :95, PageFollowButton:50 · unfollow m :96, PageFollowButton:51 · pagePosts q ProfilPagePage:397 · publishAsPage m PostComposer:192 · listMyPageFollows q PagesPanel:111, ReseauMenuRail:64 · discoverPage pq PagesPanel:186 · discover q PagesSuggestionsRail:50 | retirées avec les Pages |
| `api.modules.direct.sessions` | listLive q DirectsPanel:130, DirectsLiveRail:35 · listReplays q DirectsPanel:134 · listMinePage q :138 | à garder |
| `api.functions.*` (administratif) | users.getMe q MonProfilPage:103, :1313, **ProfilReseauSection:27** · iProfiles.getMyIProfil q MonProfilPage:105, ProfilProfessionnelSection:53, ProfilPersonnePage:732 · iProfiles.upsertMyIProfil m ProfilProfessionnelSection:56 · positionAssignments.getMyAssignments q MonProfilPage:1383 · memberships.listMyMemberships q :1387 · requests.listMine q :1583 | retirées, sauf getMe dans ProfilReseauSection, à remplacer |

### Albums

Références par nom `modules/reseauAlbums/albums:*` (albums-api.ts L82-169) :
- **Utilisées** : create, addItems, publish, reorder, setCover et setCaption (AlbumComposer:149-154) ; getAlbum et withdraw (AlbumPage:49-50) ; listForPerson (AlbumsSection:62).
- **Déclarées mais inutilisées** : update, removeItem, remove, listMine.

### Appels indirects, par les tranches voisines (hors périmètre, pour la parité)

- `personalModules.grants.myPersonalModules` : `hooks/use-personal-modules.ts:38`, via ReseauMobileMenuSheet.
- `reseauPersonnel.messagerie.*` et `groupes.totalUnread` : `messagerie-source.ts:316-529`.
- `iappel.presence.*` : `presence-dot.tsx:99-174`, avec les variantes `forOrg*`.
- `reseauPersonnel.messagerie.callByHandle` : `useRingRelation.ts:56`.
- `reseauPersonnel.stories.tray` : `StoriesTray.tsx:82`.
- `reseauPersonnel.notifications.*` et `notificationCenter.queries.unreadCountForEspace` : NotificationsList et NotificationBell.

---

## 10. Dépendances et ordre de duplication

### 10.1 Features voisines importées

| Feature | Modules | Importés par |
|---|---|---|
| messagerie | dock-store, messagerie-source, messagerie-dock, messagerie-routes, messagerie-recipients, MessagerieDock | ReseauDesktopIcomLink:13-18, mobile/ReseauMobilePage:33, PeoplePanel:36-37, relation-picker:38, ReseauAgentPage:93 |
| stories | StoriesTray, StoryCreateSheet, stories-entry, stories-styles | ReseauAgentPage:89-92, mobile/ReseauMobileFeed:35-37, mobile/ReseauMobileMenuSheet:37, mobile/ReseauMobilePage:32 |
| direct | direct-status, direct-playback, CreateDirectDialog | DirectsPanel:29, 32-38 ; PostCard:23 ; ReseauAgentPage:85 ; mobile/ReseauMobilePage:31 |
| iappel | presence-dot, useRingRelation, add-to-call-candidates | PeoplePanel:14-19, ProfilPersonnePage:59, relation-picker:34-37 |
| notifications | NotificationsList, notification-targets, notification-center-store, NotificationBell | NotificationsPanel:21-22 (retiré), useReseauFeedState:40, mobile/ReseauMobileHeader:39 |
| iagenda | agenda-create-intent | ReseauAgentPage:119, creation-controller:31, mobile/ReseauMobilePage:35 |
| espace-personnel | DocumentsPersonnelsPage, EspaceFloatingCard | MonProfilPage:56 (retiré) ; mobile/ReseauMobileCreateButton:36 |
| parametres-personnels | design-styles, parametres-nav | ProfilProfessionnelSection:44-47 (retiré) ; ProfilReseauSection:21 |
| floating-surface | use-surface-insets | mobile/ReseauMobileCreateButton:37 |
| reseau-albums ← RP | AlbumComposer, AlbumsSection, album-model | ProfilPersonnePage:75-81, creation-controller:30 |
| reseau-personnel ← RA | useMediaDraft, ProfilFrame, ReseauQueryError, query-state | AlbumComposer:31-34, AlbumPage:27-28, AlbumsSection:21-27 |

### 10.2 Coque

| Module de coque | Importé par |
|---|---|
| `components/espace-kit` | BookmarksPanel, DirectsPanel, EvenementsPanel, FeedPages, GroupsPanel, PagesPanel, PeoplePanel, ProfilPersonnePage, ReseauAgentPage |
| `hooks/useDebouncedValue` | PagesPanel, use-relation-search |
| `hooks/use-personal-modules` | ReseauMobileMenuSheet |
| `shell/personal-nav` | ReseauMenuRail, ReseauMobileMenuSheet, ReseauMobileTabBar, reseau-mobile-tabs |
| `shell/personal-chrome` | reseau-mobile-tabs |
| `shell/espace-mobile-volets` | ReseauMobileHeader, ReseauMobileTabBar |
| `shell/espace-mobile-volets-row` | ReseauMobileTabBar |
| `shell/poste-breakpoint` | mobile-shell |
| `shell/espace-origin` | directs-panel |

Paquets externes : ui-v2 (50 fichiers), api/hooks (30), routing (22), convex/react (21), sonner (20), lucide-react (7), react-dom (6), convex/server (4), `@workspace/ui` sheet et tooltip (1), motion/react (1), react-i18next (1), next/link (1).

### 10.3 Cycles

Les features suivantes réimportent des modules de RP :
- **messagerie** : Avatar, ReseauQueryError, author-link, gestures/usePointerSwipe, mobile-styles, reseau-mobile-tabs, useIsReseauMobile, useVisualViewport, query-state, reseau-agent-nav, shared, use-dual-connection-pagination, use-relation-search.
- **iappel** : Avatar, ReseauQueryError, ImmersiveOverlay, use-dual-connection-pagination.
- **stories** : Avatar, ImmersiveOverlay, VerticalPager, gestures, useIsReseauMobile, shared.
- **direct** : Avatar, ReseauQueryError, design-styles, ImmersiveOverlay, useIsReseauMobile, useVisualViewport, shared.
- **notifications** : ReseauPaginatedErrorBoundary, reseau-agent-nav, shared.
- **iagenda** : directs-panel, people-panel.
- **espace-personnel** : iprofil-sections, ImmersiveOverlay, useIsReseauMobile, reseau-agent-nav, use-dual-connection-pagination.
- **parametres-personnels** : Avatar, iprofil-sections, reseau-mobile-tabs.
- **annuaire, icom-poste, activity-contributions** également.
- **shell** : `espace-mobile-volets.ts` importe iprofil-sections ; `iasted-window.tsx` et `global-call-surface-host.tsx` importent useIsReseauMobile.

### 10.4 Ordre proposé

0. **Contrats** : les trois modules du §8, le type PostMediaDto, les DTO d'albums, et l'API typée `@antsia/api` (Id, références).
1. **Coque et primitives** (`shell/`) :
   - `useRoutes` et `useNetwork` ;
   - `design-styles`, `query-state`, `ReseauQueryError`, `ReseauPaginatedErrorBoundary` ;
   - côté mobile : `mobile-shell`, `useIsReseauMobile`, `useVisualViewport`, `useBodyScrollLock`, `ImmersiveOverlay`, `gestures/*`, `VerticalPager` ;
   - équivalents d'espace-kit et `useDebouncedValue`.
2. **Socle social pur** :
   - `shared` ;
   - `author-link`, puis `post-overflow` ;
   - `reseau-layout`, puis `reseau-agent-nav` (réécrit), puis `feed-scopes`, `people-panel`, `reseau-header` et `reseau-menu` ;
   - `post-draft`, puis `post-draft-store` ;
   - `dual-pagination-pages`, `reseau-feed-pages`, `evenements-list`, `groupes-thematiques`, puis `empty-states` ;
   - `profile-visibility-copy`, puis `profile-onboarding` ;
   - `suggestions-actions`, `contacts-rail`, `bookmarks-panel`, `post-media-carousel`, `post-composer-target`, `profil-personne`, `directs-panel`.
3. **Hooks** : use-dual-connection-pagination, use-relation-search, use-profile-onboarding, useMediaDraft, use-creation-controller.
4. **Composants feuilles** : Avatar, RichText, PostMedia, PostReactionControl, ReportContentDialog, SharePostDialog, CommentsSurface, PostOverflowMenu, ProfilFrame, DiscoveryEmptyCard, HandleChoiceCard, PrivacyLists, ProfilePublicationCard, RelationPicker, AnnounceEventDialog.
5. **Ici, les tranches voisines** stories, direct, iappel, messagerie et notifications, qui dépendent des niveaux 1 à 4. Puis `relation-picker` et `creation-controller`, qui dépendent d'iappel, de messagerie et d'iagenda.
6. **Albums** : album-model, albums-api (réécrit), AlbumsSection, AlbumComposer, AlbumPage.
7. **Fil et volets** : PostCard, PostComposer, PostComposerSheet, FeedPages, useReseauFeedState, PeoplePanel, SuggestionsPanel, GroupsPanel, DirectsPanel, DirectsLiveRail, EvenementsPanel, EvenementsRail, BookmarksPanel, ContactsRail, ProfilReseauSection.
8. **Pages et coque haute** :
   - ProfileMiniCard, ReseauMenuRail, ReseauDesktopIcomLink ;
   - mobile : TabBar, Header, MenuSheet, CreateButton, Shell, Feed, Page ;
   - ProfilPersonnePage, puis ReseauAgentPage ;
   - index.

---

## 11. Écarts avec l'annexe B du 14/10

1. **Fichiers : aucun écart.**
   - RP : 105 sources / 29 508 l. ; `mobile/` 19 / 3 367 ; `.tsx` 19 020 ; `.ts` 10 488 ; tests 65 / 14 178 ; 957 cas ; 24 en jsdom ; 11 cliquets.
   - RA : 6 / 1 657 ; tests 4 / 1 181 ; 69 cas ; 3 en jsdom.
   - Aucun fichier en plus ni en moins.
2. **Référence de mesure.** L'en-tête de l'annexe dit que ses chiffres valent « pour le disque » (HEAD `4e1b62504`). Or sur `4e1b62504`, RP compte **104 sources / 29 170 l.** `git diff --stat 4e1b62504 ad2e7fdc2` montre 6 fichiers modifiés (+928 / −67) :
   - `dual-pagination-pages.ts` (255 l.) et son test (296 l.) sont absents ;
   - `shared.ts`, `shared.test.ts`, `use-dual-connection-pagination.ts` et `NotificationsPanel.test.tsx` ont évolué.

   Les totaux de l'annexe sont donc ceux d'`origin/main` `ad2e7fdc2`, ce qui est cohérent avec le cahier §3.1.
3. **10e occurrence de `people.getMyProfile`**, signalée « non localisée » par l'annexe (annexe A.5) : c'est `use-profile-onboarding.ts:61`.
4. **Deux fonctions de `api.modules.reseau.connections`.** `paginateMine` et `paginatePendingForMe` (use-dual-connection-pagination:186, 197) ne servent que l'annuaire, via `annuaire/use-annuaire-connections.ts:46, 58`. Aucun écran de RP ne les appelle.
5. **Orphelins non signalés par l'annexe** : NotificationsPanel (l'annexe le classe S) et ContactsRail, montés nulle part. Le commentaire `index.ts` sur NotificationsPanel est périmé.
6. **Cas exécutés** : 957 cas statiques, mais 989 exécutés (boucles dans query-state, reseau-query-states, empty-states et tablist-contract).
7. **Catégories divergentes.**
   - Je classe K ce que l'annexe classe S : ImmersiveOverlay, VerticalPager, mobile-styles, ReseauQueryError, ReseauPaginatedErrorBoundary, query-state, design-styles, reseau-agent-nav, reseau-menu, reseau-layout, reseau-header, mobile-shell, reseau-mobile-tabs, gestures.
   - Je classe S\* ce que l'annexe classe S :
     - FeedPages (portée et rail Pages) ;
     - ProfileMiniCard (`/espace/profil` iProfil et `/espace/parametres`) ;
     - ProfilReseauSection (`users.getMe`, `parametresHref`, « collègues ») ;
     - MonReseauCard.
8. **Réemploi.** L'annexe donnait 34 % tel quel, 56 % à adapter, 10 % à retirer. Mon décompte, avec les cibles de PA6, donne 6 %, 69 %, 9 % à réécrire et 16 % à retirer. Trois raisons :
   - **Chaînes et réseau.** Toute chaîne d'interface (i18n obligatoire) et toute requête (networkId) imposent « à adapter ».
   - **Pages.** Les Pages (1 496 l.), les orphelins (332 l.) et les utilitaires d'iProfil (170 l.) passent en « retirer ».
   - **Albums.** L'annexe et le cahier les disaient « tel quel ». Ils sont « à adapter » : `/espace` dans `album-model:263-270`, environ 81 lignes de texte, `makeFunctionReference` à remplacer, networkId.
9. **Précisions de lignes.**
   - La ligne « fonction » de l'annexe (PeoplePanel 1155, 1239) se décide en réalité dans `people-panel.ts:104-115`. `relation-picker.ts:63, 110` porte aussi `positionTitle` (affiché `RelationPicker.tsx:249`).
   - `page.orgId` est en `PostCard.tsx:95-101`, avec orgId en L96.
10. **Couleurs.** Les en-têtes de composants affirment « aucun hexadécimal », mais le cliquet ANTSIA (qui lit aussi les commentaires) relèverait 12 lignes :
    - 1 hexadécimal en commentaire : `mobile-styles.tsx:321` ;
    - 2 `hsl(` en repli : ReseauMobileCreateButton:121, 125 ;
    - 9 `rgb()` ou `rgba()` d'ombres ou de voiles.

---

## 12. Points d'attention

- **Pages.** Le cahier §3.1 et M-A5 prévoient des Pages génériques (institution, association, entreprise, média, « Officiel » fédéré). Retirer les 6 fichiers de Pages de la copie PA6 suppose qu'un lot ultérieur les réécrive. Ces fichiers retiennent aussi des branches dans PostCard, PostComposer, post-draft, post-composer-target, shared, author-link, ReseauMenuRail, reseau-menu, reseau-agent-nav, reseau-layout et ReseauMobilePage.
- **Cliquets ANTSIA génériques, trop étroits pour PA6.**
  - `no-hardcoded-urls` ne verrait que 6 des 39 lignes de code qui contiennent `/espace` : MonProfilPage:1136, 1639 ; reseau-mobile-tabs:249-251 ; ReseauMobileFeed:198.
  - `no-hardcoded-strings` ne voit que le JSX : les constantes de texte des modules `.ts` (shared, groupes-thematiques, empty-states…) lui échappent.
  - Il faut donc un cliquet « /espace » dédié et une revue des `.ts`.
- **Couplages DOM et URL à la coque de l'espace** :
  - `#espace-main` : useBodyScrollLock L28 ;
  - `[data-espace-rail]` : ReseauAgentPage L568-592 ;
  - `useTabQueryState` (routing) : useReseauFeedState, PeoplePanel ;
  - le manifeste iAsted : `iprofil-sections.test.ts` relit `socle/convex/ai/navManifest.ts`.
- **Seul vrai import i18n existant** : ProfilProfessionnelSection (`react-i18next`), qui est retiré.
- **Seule fuite de routage** : MonReseauCard (`next/link`), qui est retiré.
- **Barrel.** 34 modules ne sont pas exportés par `index.ts`, alors que d'autres features les importent par chemin profond (ReseauQueryError, query-state, design-styles, use-dual-connection-pagination, use-relation-search, VerticalPager, gestures, mobile-styles, author-link…). Dans un même paquet `social-features`, les imports relatifs suffisent.
- **Formats.**
  - Le seuil téléphone et bureau est de 959 px (`shell/poste-breakpoint`). PA6 conserve la bascule à 960 px.
  - Le « format unique 440 × 956 » touche les paliers tablette : `reseau-layout` TABLET\_\* L91-100 ; `mobile-styles` L190-207 et L246 ; les assertions de `reseau-layout.test.ts` L330-341.
  - Il touche aussi `CommentsSurface` (@media 768 L390).
