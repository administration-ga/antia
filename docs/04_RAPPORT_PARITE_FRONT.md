---
title: "ANTIA — Rapport de parité du front (PA6)"
date: "2026-10-15"
source: "socle administration.ga, origin/main = ad2e7fdc2 (copie propre, lecture seule)"
statut: "Tenu à jour à chaque lot du front ; la carte de duplication est docs/02_OWNER_MAP_DUPLICATION.md §4.3 et §7, le détail fichier par fichier ses annexes A5 et A6"
---

# Rapport de parité du front — `@antia/social-features` et sa coque

Le front de l'espace agent du socle est dupliqué dans le moteur par LOTS, dans l'ordre de l'owner map
(§4.3). Chaque lot suit les règles de duplication (`CLAUDE.md`) : copie d'abord, en-tête de
provenance, adaptations fermées, aucun import inter-produit, tests portés et exécutés, cliquets verts,
vérification sur le serveur qui tourne.

| Lot | Contenu | Clos le | Commit(s) |
|---|---|---|---|
| F0 — fondations | `@antia/ui` (primitives d'ui-v2, tiroir, surfaces plein écran), `@antia/api` (routage, réseau courant, références typées du moteur), dépendances | 2026-10-15 | `8ddece5` |
| F1 — iCom | messagerie (iChat, groupes), iAppel (appels 1:1 et de groupe, journal, présence, messagerie vocale), stories (Statuts), primitives du réseau personnel, coque légère, branchement d'antia.ga | 2026-10-15 | `517bf13` |
| F2 — réseau personnel | fil et publication, relations, groupes thématiques, évènements, signets, vie privée, profil, pages, cloche, albums, coque de bureau et coquille mobile (A5, A6 §4.3) | 2026-10-15 | ce commit |
| F3 — direct | conférences en direct (A6 §4.1), après le lot 16 `live` du moteur | — | — |

---

## Lot F1 — iCom

### Méthode

1. **Copie mécanique** (codemod, lecture seule du socle) : fermeture transitive des imports à partir des
   points d'entrée d'iCom (`MessagerieDock`, `MessagesRoute`, pages, `global-call-surface-host`, stories),
   coupée aux fichiers retirés (poste, organisation, iAsted, iDocument, centre d'appels, iRéunion) et aux
   fichiers réécrits (`IcomMobileTabBar`, barrels) : **180 sources (≈ 43 000 l.) et leurs tests voisins**,
   275 fichiers. En-tête de provenance posé, chemins cibles de l'owner map, imports relatifs recalculés,
   imports de paquets réécrits (`@workspace/*` → `@antia/*`, `@convex/*` → `@antia/api/engine` et
   contrats).
2. **Adaptation par huit lots parallèles** (agents Opus, consigne du 25/09), chacun sur ses fichiers et ses
   fichiers de traduction, avec un brief commun (fonctions du moteur, i18n, couleurs, tests, contrôles).
3. **Intégration et vérification** : signatures réconciliées, coque et application branchées, `verify`
   complet, navigateur.

### Volumes

| Lot d'adaptation | Fichiers | Tests du lot | Clés i18n (fr = en) |
|---|---|---|---|
| W1 messagerie — la conversation | 35 | 247 | 133 |
| W2 messagerie — dock, liste, routes (+ barre basse réécrite) | 38 | 221 | 99 |
| W3 messagerie — groupes et briques Relations, Appels, Statuts | 31 | 142 | 249 |
| W4 iAppel — modules purs, hooks, relais | 69 | 544 | 142 |
| W5 iAppel — surfaces, hôte unique de la couche d'appel | 27 | 67 | 152 |
| W6 stories | 25 | 179 | 94 |
| W7 primitives du réseau personnel, coque basse | 39 | 292 | 102 |
| W8 magasins d'appel, LiveKit client, utilitaires de discussion | 16 | 56 | 2 |

`@antia/social-features` : **100 fichiers de test, 1 757 cas verts** ; tous les cas retirés le sont avec
leur branche (poste, secrétariat, priorité, file, exemption, surfaces de stories), listés dans le rapport
de chaque lot (en-têtes des fichiers de test).

### Cibles (owner map §0.3, §7.8)

- `SF/features/{messagerie, iappel, stories, reseau-personnel}` ; `SF/shell/{floating-surface, mobile,
  communication, account, presence}` et `SF/shell/{ReseauQueryError, query-state, reseau-agent-nav,
  reseau-layout}` ; `SF/stores` ; `SF/lib/{livekit, chat}` ; `SF/components/identity`.
- `UI/overlay` : `ImmersiveOverlay` et ses prérequis (verrou de défilement, hauteur visible, seuil
  ≤ 959 px renommé de `poste-breakpoint`) — dans le paquet d'interface, puisque l'overlay les importe.
- `UI/styles/communication.css` : la couche d'appel du socle (`.call-*`, `.av-ring`, `.iappel-*`, carte
  Conférence) et les classes `.esp-*` des surfaces immersives et des stories, avec les jetons qu'elles lisent.

### Décisions et écarts

- **Réseau et adresses injectés** : `useNetwork()` remplace `OrgProvider` (contrat lu porté en constantes :
  `personalMode`, `personalSpaceIsElsewhere`, `activeOrgId`), `useRoutes()` les 17 chemins `/espace/…`
  écrits en dur ; `storagePrefix` préfixe toute clé de stockage local (un état par réseau) ; deux
  configurateurs (`configureDockStorage`, `configureCallStoreStorage`) appelés par la coque.
- **i18n** : espaces de noms `messagerie`, `iappel`, `stories`, `reseau`, `shell`, rédigés en parts par lot
  et fusionnés ; clés de premier niveau = nom du fichier source ; modules purs à clés qualifiées et `t` en
  dernier paramètre ; dates par la langue courante (plus de `fr-FR` ni d'`Africa/Libreville`).
- **Fonctions du moteur ajoutées pour le front** : `calls.lifecycle.getCall` (état allowlisté d'un appel
  pour ceux qui y ont une ligne, `null` pour tout autre), `groups.invites.listMyConnectionsForGroup` (les
  relations qu'accepte la création d'un groupe), `calleePersonId` au retour de `calls.direct.callMember`.
  Retirées côté front : `threadCallCapacity` (plafond constant de onze), `listMyThreads` (pages
  `paginateMyThreads`), `getMyProfile` (`getMyPerson`).
- **Stories sans surfaces** : le moteur n'a plus de destinations « iRéseau / iCom » ; le choix de
  destination et ses refus sortent du composeur.
- **Conférence** : le geste « Lancer une conférence » reste câblé mais N'EST PAS proposé
  (`CONFERENCE_LAUNCH_AVAILABLE = false`) tant que le lot `live` n'a pas d'hôte de conférence ; la liste
  des directs en cours des stories est vide jusqu'à ce lot.
- **Coque persistante** : antia.ga monte la coque une fois, dans le gabarit `(membre)` (fil, messagerie,
  statuts) : un appel en cours, la présence et le dock ne se démontent plus à chaque navigation.
- **Présence sans organisation** (`use-presence-heartbeat`, réécrit) : par (réseau, personne), sans
  battement redoublé à moins de 20 s, « hors ligne » différé et annulé par un remontage — le seau du
  moteur est de huit par minute.
- **Format téléphone unique 440 × 956** pour l'iCom flottant et l'appel (owner map ; l'iCom du socle
  était en 390 × 844).
- **Corrections au passage** (hors liste fermée, chacune motivée dans l'en-tête du fichier) : plus jamais
  le message brut du serveur à l'écran (sa trace y figure en développement) ; double comptage de la
  croissance du fil de conversation ; badge de page calculé par le serveur au lieu de « Page officielle »
  pour toute page ; échec de copie du lien d'invitation dit pour ce qu'il est.

### Branchement d'antia.ga

- Gabarit `(membre)` : porte d'adhésion, `NextRouterAdapter`, `NetworkProvider`, couche de communication.
- `/fil` : rangée des statuts en tête, carte iCom dans la colonne de droite au bureau (≥ 960 px), lien
  Messages au téléphone.
- `/messages`, `/messages/nouveau`, `/messages/nouveau-groupe`, `/messages/<chat|groupe|a>/<id>` →
  `MessagesRoute` (page iCom au téléphone ; au bureau, la carte iCom détachée sur le fil).
- `/actus`, `/actus/nouvelle` → lecteur plein écran des statuts.
- Feuille LiveKit importée par l'application ; CSP : origine du serveur média (`LIVEKIT_WS_URL`, variable
  sans valeur par défaut) et stockage du déploiement en `media-src` (messages vocaux).
- **Tailwind** : `@source "…/packages/*/src"` ne balayait AUCUN fichier des paquets (mesuré) ; chemins
  explicites dans antia.ga et la console.

### Vérification

- `bun run verify` : vert (Convex 656 cas, cliquets 53, paquets, typage, lint).
- Navigateur (http://localhost:3030, compte de développement et deux personnes de démonstration posées par
  `seeds/devSocial:demoPerson`) : carte iCom au bureau et ses quatre briques sur les données du moteur ;
  relation listée avec sa pastille ; conversation ouverte depuis la brique Relations, message envoyé et
  rendu ; appel audio jusqu'à l'écran « visioconférence non configurée » (aucune clé LiveKit sur ce
  déploiement) puis raccroché ; page iCom au téléphone (liste, conversation, barre basse) ; lecteur des
  statuts.

### Reste ouvert

- **Clés LiveKit** (propriétaire) : sans elles, un appel admis s'arrête à l'émission du jeton.
- **Push d'appel** (`use-call-push`) : sans fonction serveur avant PA5.
- **`signOutEverywhere`** (PA4) : purger `messagerie-dock:v6`, `icom-floating-placement:v1`, `ringtone-muted`
  et `iappel:audio-route` sous le préfixe du réseau.
- `calls.ringing.hold` pourrait rendre `holdOnAnswer` (le hook l'infère).
- ~~`EngineRoutes` sans `page()` ni `settings()`~~ : réglé en F2 (`page()` obligatoire, `settings?()` facultatif).
- Tests à rétablir avec la page réseau de bureau : voir « Reste ouvert » de F2.
- Barre basse d'iCom à 375 px : le dernier onglet défile (comportement du socle, R-15).

---

## Lot F2 — le réseau personnel

### Méthode

Même chaîne qu'en F1 : **copie mécanique** par le codemod (fermeture d'imports à partir de la page réseau,
du profil, de la cloche et des albums, coupée aux fichiers retirés et à ceux qu'iCom a déjà livrés),
**adaptation par huit lots parallèles** d'agents Opus sur un avenant au brief commun (fonctions du moteur
par module, adresses `page()` et `settings?()`, espaces de noms), puis **intégration** : signatures
réconciliées, contrats communs posés au fil des rapports, application branchée, `verify`, navigateur.

### Volumes

| Lot d'adaptation | Fichiers | Tests du lot | Clés i18n (fr = en) |
|---|---|---|---|
| P1 fil et publication (carte, composeur, commentaires, réactions, médias, création) | 36 | 183 | 189 |
| P2 relations et découverte (personnes, suggestions, sélecteur de relations) | 18 | 128 | 137 |
| P3 groupes thématiques, évènements, signets, vie privée | 16 | 134 | 244 |
| P4 profil social (fiche, publication du profil, identifiant, mini-carte) | 15 | 114 | 140 |
| P5 coque de bureau (page réseau, menu) et coquille mobile | 24 | 71 | 56 |
| P6 cloche et carte flottante | 16 | 91 | 45 |
| P7 albums et kit d'espace (`@antia/ui/espace-kit`) | 24 | 125 | 89 |
| P8 pages, RÉÉCRITES sur le module `pages` du moteur | 11 | 135 | 158 |

`@antia/social-features` : **160 fichiers de test, 2 704 cas verts** (1 757 à la fin de F1). Cas du socle
portés sauf branches retirées (poste, administration, iProfil, conférences, iAgenda), chaque retrait
nommé dans l'en-tête du fichier de test.

### Cibles

- `SF/features/reseau-personnel` (fil, volets, profil, pages, évènements, signets…), `SF/features/notifications`,
  `SF/features/reseau-albums` ; `SF/shell/{ReseauAgentPage, ReseauMenuRail, ReseauDesktopIcomLink,
  reseau-header, reseau-menu, design-styles, floating-card}`, `SF/shell/mobile/*` (coquille mobile).
- `UI/espace-kit` : le kit d'espace (cartes, onglets « chemise », état vide, pagination, dialogue), SANS
  i18n — les phrases viennent de l'appelant (`EspacePagination.labels`, `EspaceDialog.closeLabel`).
- Exports du paquet : `@antia/social-features/reseau-personnel`, `/albums`, `/notifications`.

### Décisions et écarts

- **Pages réécrites, pas dupliquées** : le module `pages` du moteur (identité propre, signataires,
  revendications, badge calculé) n'a pas d'équivalent au socle ; mêmes noms et props que les composants du
  socle (`PagesPanel`, `PageFollowButton`, `ProfilPagePage`…), en-tête « Réécrit d'après ».
- **Création d'évènement dans le volet Évènements** (iAgenda n'existe pas dans le moteur) : carte de
  création sur place, invitation de relations, liste des invités ; « Créer → Évènement » ouvre la carte
  (intention `nouveau=evenement`, consommée une fois).
- **Profil sans section professionnelle** : « Modifier mon profil » ouvre la gestion sur ma fiche
  (`?gerer=1`) faute de réglages servis ; l'identifiant se choisit dans l'éditeur.
- **Cloche** : une seule source (`notifications.bell.*`), lacune du décompte dite (« 99+ »), 24 genres du
  moteur phrasés. **Moteur** : le DTO de `page_post` porte la CARTE de la page (nom, badge calculé), relue
  à la lecture — la ligne nomme la page et montre son badge ; une page retirée rend `null`.
- **Contrats communs posés à l'intégration** : `useEspacePaginationLabels()` (phrases de pagination
  traduites une fois), `useRingRelation` dupliqué du socle dans `features/iappel` (le volet Relations et la
  fiche profil y convergent ; `IcomRelationsPanel` garde sa fonction, son cliquet de canal la relit).
- **Feuilles** : `.esp-banner` (repli de couverture) et `.citizen-scrollbar` dans `communication.css` ;
  espacements `--sp-1` → `--sp-8` d'ui-v2 dans la charte.
- **Direct absent** (lot `live`) : volet Conférences, rail des directs et format « Conférence » retirés ;
  une adresse `?tab=conferences` retombe sur le fil.

### Branchement d'antia.ga

- `/fil` : la page réseau du moteur, qui choisit son arbre (≤ 959 px : coquille mobile, le document défile ;
  au-delà : trois colonnes qui défilent chacune, dans un conteneur de hauteur définie) ; barre du haut au
  bureau seulement.
- `/profil/<identifiant>`, `/profil/<identifiant>/albums/<album>`, `/page/<identifiant>` : fiches du moteur
  sous la barre du haut des membres (`MemberPage` : cloche, messages, mon profil, déconnexion) ; segments
  décodés une fois (`lib/route-params.ts`), refus indistinct laissé au moteur.
- Le fil minimal de la tranche verticale (composeur et carte de l'application) est retiré.

### Vérification

- `bun run verify` : vert (Convex 656 cas, cliquets 53, `@antia/social-features` 2 704, `@antia/ui` 86,
  typage des 10 paquets, lint).
- Navigateur (http://localhost:3030, compte de développement) : page réseau au bureau (menu, fil, identité,
  rail iCom, suggestions, pages à suivre, évènements) et au téléphone (en-tête, barre basse, aucun
  défilement horizontal de page) ; volets Relations, Groupes, Pages, Évènements ; évènement créé depuis
  l'adresse d'intention, relation invitée ; profil (le mien, onglet Albums ; celui d'une relation : écrire,
  appeler → fenêtre d'appel « visioconférence non configurée ») ; cloche ; création de page REFUSÉE
  (adhésion seulement déclarée : refus traduit) ; page inconnue → refus indistinct.

### Reste ouvert

- ~~Cliquets du bureau à rétablir~~ : rétablis après F2 — `reseau-layout` (28 cas, comme au socle : feuille
  `RESEAU_DESKTOP_CSS`, ordre des paliers 1 008 → 812 → 1 108 sans rail d'hôte, attribut `data-volet` posé),
  `reseau-mobile-tabs` (36 cas, parité de `ReseauMobilePage`), `messagerie-floating-contract` (12 cas, format
  440 × 956, une seule règle pour l'iCom détaché et la fenêtre d'appel).
- Hérité du socle : `BookmarksPanel` sans `data-collection` — au téléphone, les signets ne sont pas élargis
  comme une collection.
- **Pages en direct** : la création exige une adhésion `verifiee` — aucune page éprouvée au navigateur sur
  le compte de développement (135 cas de test) ; règle de visibilité `root` d'une page non exposée ; libellé
  « Collectif » de la nature `community` à valider ; modération des revendications : à la console.
- Signaux rendus par le moteur sans écran au socle : `lacunar` du fil, réseau d'origine, carte d'un
  évènement annoncé.
- Réseau gouverné : `searchPeople` et `suggestions.paginate` y refusent (`policyRefused`) — la coque d'un tel
  réseau ne doit pas monter le volet Relations générique.
- Écrans absents au socle aussi : blocage d'une personne, clôture et archivage d'un groupe, `ContactsRail`
  sans point de montage.

## F3a — Première tranche des conférences (16/10/2026)

Le backend `live` permet la première tranche de PA6/F3. **F3 reste en cours** : cette tranche
n'affirme pas la parité du studio et de la console d'antenne du socle.

Source : `ad2e7fdc2` ; le diff du périmètre direct, stores, hôtes et points de branchement contre
l'`origin/main` local du socle (`25398f565`) est vide. Copies dans les fichiers réels d'ANTIA.

### Surfaces branchées

- Volet Conférences au bureau et au téléphone : directs, rediffusions publiées, mes conférences,
  trois listes paginées. Une page vide avec curseur garde « Voir plus » ; changement de réseau
  remet les cartes à zéro, refus de lecture masque les cartes mémorisées.
- « Créer une conférence » depuis le bureau, le catalogue mobile et iCom. Titre, audience
  personnelle, capacité, annonce explicite ; invités et fil source d'iCom conservés et rejugés
  côté serveur. Formulaire RHF/Zod, clé idempotente conservée après un échec.
- `/conference/[id]` sous le gabarit persistant des membres, sur la route injectée déjà prévue
  par l'application. Une annonce de publication et une carte des actus y ouvrent la même salle.
- Préparation locale du matériel, puis démarrage. Contrôle `checkBroadcastConfiguration` :
  adhésion et lecture de session avant configuration, hôte seul, aucun jeton ni admission,
  aucun réveil du service. La configuration manquante refuse AVANT les périphériques et le
  passage en direct. Ce contrôle n'est pas une preuve de disponibilité du serveur média.
- Store de session, registre de salle, propriétaire unique LiveKit et cohabitation iAppel copiés
  du socle ; micro et son du direct suivent la ligne d'appel. Salle et baux dans la coque,
  pas dans la page : navigation et largeur ne remontent pas la connexion ; fin, révocation
  de lecture et changement de réseau la ferment. Changement de rôle exige un nouveau geste
  d'entrée et un nouveau jeton. Présence : hôte 15 s, spectateur 30 s, depuis le domaine.
- Rediffusion servie par la garde du moteur, lecture avec sous-titres si présents ; hôte :
  publication ou conservation privée. L'enregistrement est **décoché par défaut dans ce
  formulaire**, demandé explicitement et annoncé dans la salle ; le défaut du backend reste
  inchangé. Aucune suppression de rediffusion exposée par cette tranche.
- Activation explicite par `NetworkProvider.liveAvailable` : ANTIA la pose avec sa route servie ;
  DIASPORALE garde sa route réservée sans activer la création iCom, le lecteur des directs ni
  l’hôte. Test de l’absence de capacité par défaut.
- Textes français et anglais ; jetons existants, aucun changement de primitive ui.

### Parité restante après F3a

Studio complet (présentation, spotlight, partage d'écran et disposition), commentaires et
réactions, invitations et demandes d'antenne, participants, exclusions/sourdines, délégations,
création au nom d'une page et audience followers, sélection nominative libre, gestion avancée
et retrait/reprise de rediffusion, import des sous-titres, carte flottante complète et rail
compact du fil. Une publication `root` ne devient pas un direct hors réseau.

### Recette et validation

- Chrome réel sur le serveur local, compte fictif de recette : entrée, profil de test, création
  d'une conférence avec annonce explicite ; carte « À venir » dans le fil, page de conférence
  ouverte ; démarrage désactivé avant préparation. Aucun secret ni donnée réelle utilisés.
- Tests de composant : entrée seulement sur clic, même propriétaire après navigation, jeton
  tardif après départ, changement de réseau/rôle et fin serveur, retour de place après refus,
  préflight avant démarrage et arrêt des pistes tardives ; confidentialité et rejeu du formulaire ;
  curseurs et isolation des listes. Tests purs/store du socle portés.
- La recette vidéo/audio/SFU/Egress réelle, la conservation et publication d'un vrai replay,
  les appareils réels, la passe mobile/sombre exhaustive et l'audit AA restent à faire.
- `bun run verify` final : vert ; 1 101 cas Convex, 53 cliquets, 2 792 cas social-features,
  10 espaces de travail typés/testés et lint sans erreur (avertissements non bloquants conservés).
- Vérification bornée à deux workers pour Convex, cliquets et surfaces jsdom : des scans
  simultanés avaient dépassé 5 s sur la machine en charge, sans violation de code. Les délais
  et assertions restent inchangés.
- Contrôle de configuration aussi éprouvé au navigateur : refus traduit du service média
  absent, aucun démarrage ; vidéo/audio réelle non validée.

## F3b — Studio et gestion avancée d'antenne (16/10/2026)

Tranche branchée dans `DirectPage` sur la route existante d'ANTIA. La salle reste
possédée par la coque du membre ; aucune connexion ni piste audio supplémentaire.
Sources relues sur `origin/main` du socle, sans différence pour les fichiers portés
depuis `ad2e7fdc2`. Décision : [ADR-0005](adr/0005-studio-persistant-et-droits-d-antenne.md).

### Parité de cette tranche

- Scène : solo/duo/grille, vue orateur et cinéma, épingle locale, programme de l'hôte,
  écran partagé dominant avec caméra conservée, choix du format et grille fixe à la
  création. Géométrie pure du socle et tests portés ; conteneur de hauteur définie,
  bandeau de côté dans un conteneur bas, commandes hors scène et plein écran.
- Appariement au `personId` du jeton et au roster serveur ; homonymes distincts,
  pistes de spectateurs et rôles retirés écartés. Nom neutre du DTO et légendes i18n
  remplacent les libellés techniques/anglais de LiveKit. Charte existante réutilisée.
- Micro/caméra par l'intention persistante ; partage d'écran déclenché explicitement,
  sans audio capturé. Convergence du socle dans le propriétaire de salle : une coupure
  distante de micro reste fermée après navigation ou reconnexion. Le partage peut
  s'arrêter à la reconnexion ; sa reprise exige un nouveau geste.
- Antenne : main après admission, annulation, acceptation/refus, proposition à une
  relation de l'hôte ou par identifiant pour un délégué, révocation et expiration
  effective. Plafond de huit (hôte inclus). Retirer de l'antenne, couper le micro,
  mettre en avant pour tous ; nouveau jeton après changement de rôle, reçu tardif rejugé.
- Admissions paginées : personnes silencieuses modérables, chat coupé/rétabli,
  exclusion confirmée/réintégration. Historique d'admissions nommé sans promettre
  une présence actuelle. Une confirmation ne survit pas au retrait du droit d'exclure.
- Délégations : rôle, capacités explicites (antenne, exclusion, fin), édition/retrait,
  limite de huit. Nouvelle query `delegations.searchCandidates`, deux côtés paginés du
  graphe, même règle que `grant` ; membres en attente/exclus/inéligibles écartés,
  personnes déjà invitées ou à l'antenne toujours proposées si éligibles.
- Invités désignés après création : recherche parmi les relations/fil source,
  ajout, changement du rôle proposé, retrait, relance d'un intervenant hors antenne ;
  `canManage` relu, plafonds de 200 invités et sept intervenants invités conservés.
- Discussion et quatre réactions : abonnement seulement dans le volet ouvert,
  formulaire RHF/Zod, derniers commentaires, retrait selon droit serveur,
  fermeture/réouverture du chat et erreurs traduites. Aucun annuaire de gestion
  souscrit chez un spectateur ; perte de droit/réseau referme le volet concerné.

### Limites de parité

Cette tranche couvre le studio et l'antenne demandés. F3 reste ouvert pour la création
au nom d'une page et `followers`, la sélection nominative au formulaire initial,
la reprise/retrait avancé et les sous-titres des replays, la carte flottante complète
et le rail compact des directs. Le retour flottant de F3a garde la connexion en place.

La diffusion audio/vidéo/SFU/Egress réelle nécessite la configuration LiveKit du
propriétaire. Les tests de scène/contrôles avec une salle simulée ne la prouvent pas.

### Vérification et recette de F3b

- Toutes les étapes de `verify` validées, reprises séquentiellement après saturation
  et coordonnées avec la session DIASPORALE : codegen sous Node 22, typage Convex/tests
  et des dix espaces de travail, 1 104 cas Convex, 53 cliquets, 24 cas scripts,
  2 869 cas social-features (173 fichiers, délai fonctionnel de 5 s conservé), tests
  des autres paquets/apps et lint des neuf paquets sans erreur. Avertissements hérités
  conservés (69 social-features, 6 ui). Les premières chaînes `verify` ont échoué
  sur des délais de scans ou ont été interrompues ; leur code de sortie n'est pas
  présenté comme un succès. Les reprises couvrent les mêmes étapes sur les sources finales.
- Cliquets statiques : un worker, délai de 60 s réservé à leurs analyses AST du dépôt
  (un scan valide prenait 36 s sous swap). Assertions et délais des suites fonctionnelles
  inchangés. Aucun cache ni donnée supprimé par la session ANTIA ; son serveur Next
  a été redémarré après un verrou de compaction provoqué par le disque plein.
- 77 cas front nouveaux : géométrie du socle, identités exactes/homonymes, écran et
  caméra distincts, JWT tardif après rétrogradation, retour d'audio seul vers caméra,
  mise en avant d'un rôle hors connexion, intentions et reconnexion, droits retirés,
  consentement, invitations expirées, plafond d'antenne, curseurs vides et `canManage`.
- Trois cas backend neufs : invités/intervenants encore délégables, membres en
  attente/exclus écartés, candidats réservés au titulaire et isolés par réseau.
- Chrome réel sur le serveur local : compte et personne fictifs, création programmée
  avec format télévision et grille fixe, ajout d'un invité spectateur puis attribution
  d'une délégation cohôte limitée à l'antenne ; absence des capacités d'exclusion/fin
  confirmée dans l'écran. Déjà invité, le candidat reste proposé pour la délégation.
- Gestion vérifiée à 320, 375 et 1 280 px sans débordement horizontal ; viewport remis
  à sa valeur initiale. Préflight : refus traduit du média absent, démarrage désactivé,
  conférence restant à venir. Captures de recette dans le dossier de visualisations
  Codex du 16/10, `antia-f3b-delegations.png` et `antia-f3b-mobile.png`.
- Reste : média réel, scène de plusieurs appareils, écran partagé réel, plein écran
  réel avec SFU, Egress, passe sombre exhaustive et audit AA complet.
