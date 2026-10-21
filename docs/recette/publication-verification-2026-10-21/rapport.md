# Livraison des correctifs de vérification — 21/10/2026

Les sources nécessaires sont commitées et poussées, avec les prérequis séparés des corrections. Les branches, HEAD, index, serveurs et travaux des autres sessions sont conservés. Aucun fichier .env, secret, compte, contenu social ou consentement n’est modifié.

## En ligne

- Production : `global-native-20261021-08edc2d08cb9b596`, READY `dpl_8CeRkqMNT7reNhCQcvVXZ3q5UWjt`, sources `1b6a45e`. Cette publication parallèle est conservée : ses sources web et backend correspondent aux nôtres. Les différences portent sur les outils de recette native, la documentation et deux thèmes DIASPORALE que le site ANTSIA n’importe pas. Notre construction `dpl_388vHtPYBhiUfKAsKtf2pgFnd1ZF` est READY, sans nouvelle promotion qui écraserait cette livraison.
- Démonstration : `verification-20261021-demo-070aafd886c4337a`, READY `dpl_J5YskviFDCg5UTz3DfBzXh6Xwqjg`, sources `c7c96bc`. Construction production contrôlée puis promotion du même artefact. Catalogue fictif, projection, restrictions contact/devis/achat et huit images existantes conservés.
- Backends publiés : `diligent-avocet-585` depuis `b91a0f8`, `vivid-hedgehog-655` depuis `68d29f9`. Ces sources backend correspondent aux commits frontend suivants, qui ajoutent uniquement le favicon. Schéma validé, aucun index supprimé, contrôle des empreintes du backend avant publication. Aucune graine ou migration de données exécutée ; variables et paramètres existants conservés.
- Les deux pages d’entrée et de santé répondent HTTP 200, versions exactes et CSP vers le bon backend. Le favicon publié en parallèle est conservé sur les deux domaines. Les huit PNG de démonstration répondent HTTP 200 et correspondent à leurs empreintes sources.

## Commits et PR

- [ANTSIA #19](https://github.com/administration-ga/antsia/pull/19) : historique déjà publié conservé, mémoire de main réunie, prérequis `989db18`, corrections `b91a0f8`, favicon `9f5ad68`.
- [Variante démo #20](https://github.com/administration-ga/antsia/pull/20) : catalogue et médias déjà publiés isolés, `68d29f9`, favicon `c7c96bc`. Branche de livraison démo distincte ; la couche démo ne vise pas la production.
- [DIASPORALE #21](https://github.com/administration-ga/diasporale/pull/21) : médias retenus `789e9ec`, prérequis minimaux `f445bcb`, contrôle de parité `57ebf51`. Aucun hébergement DIASPORALE distinct n’est publié par cette reprise.

Les PR restent ouvertes. Les changements futurs P16/P19/DP39, leurs nouvelles tables et les changements étrangers de limitation de débit sont exclus de nos branches. Les fixtures propres à ces futurs chantiers restent dans l’arbre partagé. Les outils de recette native publiés par l’autre session restent dans sa branche ; ils ne changent pas le code web servi.

## Vérification des sources exactes

Installation Bun figée réussie. API locale rafraîchie avec les templates officiels Convex 1.45 et l’inventaire local conforme à leur règle ; composants inchangés. Aucun codegen poussé vers le backend local partagé. Les dry-runs cloud et les publications effectuent ensuite la validation officielle du schéma et le typage CLI.

Typages backend/tests réussis ; 2 710 tests backend, 144 contrôles de règles et 36 tests de scripts réussis. Puis typages et tests des 12 workspaces, et lints des 11 workspaces concernés : zéro erreur. Trois tests préexistants du domaine sont ignorés, des avertissements de lint subsistent.

Le premier passage isolé a révélé deux dépendances manquantes du contrôle DIASPORALE : cinq teintes douces/curseur et le resolveur color-mix. Elles sont ajoutées dans leur forme minimale ; aucun seuil n’est abaissé. Les étapes workspaces sont ensuite rejouées avec succès. Backend et entrées des garde-fous sont inchangés depuis leur passage réussi.

Variante démo : installation figée, génération d’API séparée, typages backend/tests/site, 246 tests backend ciblés, 144 contrôles de règles, 799 tests du site et lint sans erreur. Les paquets communs restent identiques à la validation commune. Les sources historiques de deux archives sont confrontées à leurs manifestes ; les anciens fichiers auth/graph/fichiers/médias ne remplacent pas les correctifs récents.

Les sept chartes ANTSIA restent celles des sources déjà publiées ; aucune nouvelle recette membre sur 42 combinaisons n’est revendiquée ici. Le build natif, la distribution iOS/Android et les appels sur appareils physiques restent hors preuve. Les identifiants natifs et fournisseurs ne sont pas inventés, les capacités restent soumises à la configuration du propriétaire.

Les résultats structurés, cibles, versions, empreintes et compteurs sont dans [preuves.json](preuves.json). Les journaux et manifestes détaillés restent dans le cache local de publication.
