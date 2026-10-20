# ANTSIA — expérience sociale, noms et adaptation des écrans

20 octobre 2026. Demande : analyser cinq captures et deux vidéos mobiles, moderniser les noms
des fonctions et préparer leur adaptation téléphone, tablette et ordinateur. **La marque ANTSIA
est conservée.** Ce dossier complète l'étude sociale et commerciale du 18 octobre ; il ne
renumérote pas ses lots P00–P19 et ne remplace pas leurs contrats.

Direction retenue : **Accueil · Clips · Messages · Explorer · Profil**, avec une action **Créer**
accessible par « + ». **Direct** nomme la diffusion ; **En live** son état. **Stories**, **Replays**,
**Mon réseau** et **Enregistrés** remplacent les termes dispersés ou institutionnels. **Mon fil**
reste la gestion des posts masqués et des auteurs en sourdine.

Mise à jour du 21 octobre : les sources U03–U08 sont raccordées et la navigation cible est activée.
Clips possède sa lecture vidéo serveur, ses gardes et sa pagination ; le fil mixte garde sa
propre présentation. Le propriétaire a explicitement autorisé vérifications, corrections,
commit, push et déploiement ; cette instruction lève le gel des préambules initiaux.
Le [bilan de livraison U08](rapports/U08_LIVRAISON_2026-10-21.md) distingue les contrôles
exécutés, le candidat publié et les recettes visuelles ou physiques encore non observées.

| Document | Contenu |
|---|---|
| [01 — Analyse des références](01_ANALYSE_REFERENCES.md) | Observations des cinq captures et des vidéos, options, écarts avec le code, sources officielles |
| [02 — Noms et textes](02_NOMS_ET_MICROTEXTES.md) | Lexique FR/EN, distinctions de sens, boutons et menus |
| [03 — Architecture responsive](03_ARCHITECTURE_RESPONSIVE.md) | Navigation, écrans, grilles, gestes et adaptations téléphone/tablette/ordinateur |
| [04 — Plan d'implémentation](04_PLAN_IMPLEMENTATION.md) | Lots UX U01–U08, dépendances, fichiers, critères de sortie et prompts séparés |

Les propositions privilégient la découverte, le contenu et les boutiques. Le fond clair reste
blanc avec cartes beige ; le sombre et les thèmes existants conservent leurs jetons. Une barre
translucide n'oblige pas à reproduire les teintes variables des vidéos. Les photos et vidéos
restent la principale source de couleur.

## État de cette demande

- Analyse documentaire et visuelle locale : captures examinées, vidéos échantillonnées puis
  vues ciblées des menus de création, notifications, republication, paramètres et messages.
- U01 : libellés raccordés dans les ressources propres à ANTSIA, sans mutation des dictionnaires
  partagés avec DIASPORALE. Scénarios de test écrits, non exécutés ; rendu non constaté. Les routes
  et identifiants techniques restent stables.
- U02 : [navigation adaptative raccordée en source](rapports/U02_NAVIGATION_RESPONSIVE_2026-10-20.md),
  barre sous 768 px, rail compact jusqu'à 1199 px, nommé dès 1200 px ; pages de membre et Messages
  intégrés. Scénarios écrits seulement, rendu non constaté.
- U03–U08 : plan d'exécution, pas une refonte déjà rendue dans le navigateur. Le natif possède
  actuellement un sous-ensemble de fonctions ; ce dossier distingue Web adaptatif et app native.
- Aucune vérification applicative relancée : ni test, génération, typage, lint, build, serveur,
  recette navigateur/appareil, configuration, activation, commit ou publication.

Les lectures de fichiers et l'extraction locale d'images vidéo servent l'analyse demandée ;
elles ne constituent pas une recette de l'application. Les médias d'origine ne sont ni copiés
dans le dépôt ni envoyés à un service externe. Aucun message ou appel n'est effectué.

Les paramètres de paiement, fournisseurs, droits des comptes et gates P16 ne changent pas.
Une action commerciale ou un appel n'est proposé que si sa capacité réelle le permet.

Repères de continuité : [étude initiale](../2026-10-18-social-commerce/README.md),
[exécution P00–P19](../2026-10-18-social-commerce/EXECUTION.md),
[correctifs P19](../2026-10-18-social-commerce/rapports/P19_CORRECTIFS_AUTOMATIQUES_2026-10-20.md).

## Raccord source U01 et passation

| Périmètre | Fichiers / effet |
|---|---|
| Composition Web | `apps/antsia_ga/src/i18n/resources.ts`, `compose-engine-overrides.ts`, `overrides/{fr,en}.json` : copies complètes des namespaces adaptés, fusion imbriquée immuable |
| Traductions propres à l'app | `apps/antsia_ga/src/i18n/locales/{fr,en}/{antsia,memberNetwork,publicNetwork}.json` : navigation, titres, Stories, retours, invitation de connexion et description des boutiques |
| Natif | `apps/antsia_mobile/src/i18n/{fr,en}.json` : uniquement les libellés existants navigation/titre du fil, Accueil/Home |
| Scénarios | `apps/antsia_ga/src/i18n/resources.test.ts` : clés conservées, immutabilité, interpolations/pluriels, ressources serveur/client et différences de sens ; non exécutés |

Les composants consommateurs emploient les ressources existantes ; aucun nouvel écran n'est
créé pour le renommage. La description des boutiques ne dit plus « sans catalogue » et ne
promet pas l'ouverture des achats. Authentification, suivi unilatéral, statuts de connexion,
audiences, routes et dictionnaires moteur restent tels quels. Les autres modifications déjà
présentes dans ces fichiers partagés ne sont pas attribuées à U01 ni retirées.

U02 est raccordé en source ; la prochaine tranche d'interface est **U03**, puis U04. Les modèles des captures sont
analysés dans 01 ; les décisions de noms sont fixées dans 02 ; 03 porte la composition des
écrans et 04 les huit prompts. Aucun lot U03–U08 n'est présenté comme implémenté ici.
