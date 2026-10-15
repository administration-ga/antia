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
| F1 — iCom | messagerie (iChat, groupes), iAppel (appels 1:1 et de groupe, journal, présence, messagerie vocale), stories (Statuts), primitives du réseau personnel, coque légère, branchement d'antia.ga | 2026-10-15 | ce commit |
| F2 — réseau personnel | fil et volets, profil, relations, groupes thématiques, évènements, pages, signets, cloche, albums (A5, A6 §4.3) | — | — |
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
- `EngineRoutes` sans `page()` ni `settings()` : les liens de page et l'entrée « réglages » attendent F2.
- Tests à rétablir avec la page réseau de bureau (F2) : 8 cas de `reseau-layout`, 3 de
  `reseau-mobile-tabs` ; test `messagerie-floating-contract` (440 × 956) à réécrire.
- Barre basse d'iCom à 375 px : le dernier onglet défile (comportement du socle, R-15).
