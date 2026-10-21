# Publication des contrôles globaux et de la base native — 21 octobre 2026

La publication Web est active sur https://antsia.vercel.app.

- Version : `global-native-20261021-08edc2d08cb9b596`.
- Sources ANTSIA : `1b6a45e2498935d5bffd055e8f27a2b1f7a56938` ; base native et corrections : `8200ba8abe4192294800539505eacbe42d12cbef`.
- Branche poussée : `codex/controles-globaux-natif-20261021`.
- Contrats DIASPORALE : `0ea572a2042534a338481e45771a272b6a30bf77`, branche poussée `codex/contrats-medias-20261021`.
- Déploiement : `dpl_8CeRkqMNT7reNhCQcvVXZ3q5UWjt`, build de production vérifié avant promotion.

## Périmètre livré

La base Expo/React Native complète, les modules Swift/Kotlin, les contrats d'appels, les thèmes natifs et leurs dépendances sont versionnés. Le catalogue distingue les applications Web et natives ; le filtrage des origines conserve les portes de démonstration déjà publiées. Le verrou de dépendances est généré sur le paquet isolé et son installation figée réussit.

Les corrections globales incluent les annotations de types, les fixtures d'entrée en appel et la couverture des six tables de services existantes. Les 14 fichiers DIASPORALE ferment les contrats de retenue des médias ; toute retenue masque l'URL et le motif d'analyse indisponible reste explicite. Ces contrats sont poussés ; aucun site DIASPORALE distinct n'est déployé ici.

Les corrections responsive déjà publiées `5b89394` et le favicon publié pendant le travail sont conservés. Le favicon servi conserve exactement l'empreinte `17d852570781ea593894532cff3ef4e5c57481d873db9eabbf911ccec3ea9149`.

## Vérifications

`bun run verify` complet : **sortie 0**, Node 22.22.3, 1 090,31 s. Génération sur le backend local en mode lecture seule, typages Convex/tests, 2 716 tests du moteur, garde-fous et scripts, puis 12 typages, 12 scripts de tests et 11 scripts de lint. Le lint termine sans erreur ; 253 avertissements non bloquants restent. Trois tests du domaine déjà déclarés ignorés restent identifiés dans le bilan.

| Surface | Tests réussis |
| --- | ---: |
| Kit visuel, dont thèmes natifs | 2 286 |
| Interface sociale | 4 119 |
| ANTSIA Web | 763 |
| Application native | 58 |
| Paquet natif partagé | 31 |
| Application DIASPORALE | 1 402 |

Les fichiers exécutables ne changent plus après cette campagne. Six documents sont restaurés depuis le commit déjà publié pour préserver ses rapports, puis le seul ajout applicatif est la copie exacte du favicon public. Un second build de production et les empreintes du fichier servi couvrent ce dernier ajout.

Deux builds de production réussissent. Le premier n'est pas promu : le contrôle de concurrence détecte la publication du favicon et empêche son écrasement. Le second est promu après succès des contrôles HTTP 200, version et politique de connexion vers `diligent-avocet-585` sur les pages publiques. Les mêmes contrôles et l'empreinte du favicon réussissent sur l'adresse canonique. Le navigateur affiche la version finale. Aucun journal `error` ou `fatal` ne correspond au nouveau déploiement dans la fenêtre contrôlée jusqu'à 00:31:34 UTC.

## Préservation et limites

Aucune commande Convex de production, migration, graine, effacement, écriture de contenu, manipulation de session ni édition de fichier `.env*` n'est exécutée. Les adaptations backend natives sont commitées et testées localement ; elles ne sont pas déployées sur le backend de production. Aucune distribution iOS/Android ni recette sur appareil physique n'est effectuée.

Les branches/HEAD et les index des arbres partagés ANTSIA et DIASPORALE sont conservés. La suppression de police déjà indexée dans DIASPORALE reste à son auteur ; les travaux de présentation voisins sont exclus. Le serveur local répond toujours HTTP 200 avec le backend configuré. Les tests ne constituent pas une nouvelle recette authentifiée des pages membres ; les contrôles en ligne restent publics, conformément au choix du propriétaire.

- [Bilan des contrôles](verification.json)
- [Preuves de publication et de préservation](publication.json)
- [Capture de la version publique](etat-public.png)
