# U03–U08 reportés sur main — 21 octobre 2026

## Constat

Les lots responsive U03 à U08 ont été publiés le 21/10 depuis la lignée de livraison Codex (`71c93a5` → `2966fea`). La consolidation de `main` (PR 25) n'a repris que les compléments sociaux et leurs prérequis. La production servie depuis `main` (`main-086cd43b8686`) a donc perdu Clips et Explorer, les profils adaptatifs, la création et la pause des Stories, la messagerie en espace de travail, la demande de contact des boutiques ainsi que le rail et la barre basse adaptatifs.

L'absence de `.antsia-panel` dans la feuille servie ne relève pas de U. Elle vient du design de la lignée Codex (`3507e4a`), que `main` a remplacé par les chartes « à la lettre » (ADR-0027). Ce report ne la réintroduit pas.

## Report

Sept commits publiés ont été repris par `cherry-pick -x` sur `main` `d2ac0be` : `71c93a5`, `0c273d7`, `afd0113`, `5b89394`, `e2c3819`, `70939c5` et `4d1e07b`. Deux commits suivent : une adaptation et des tests.

- **Style de `main` conservé.** Les 26 fichiers en conflit (42 zones) gardent le style de `main`. La logique U est fusionnée mot à mot avec ce style. Les classes de l'ancienne lignée de design ne sont pas réintroduites.
- **Version des compléments sociaux.** La carte d'offre, la grille du catalogue, le lien vers le catalogue de la vitrine et les marges des offres jointes gardent la version des compléments sociaux, postérieure à U.
- **Verrou de session.** Il était déjà dans `main` (`0c273d7`) ; seuls les rapports sont repris.
- **Composeur hors des coquilles.** Le composeur de publication est monté une fois, au-dessus des coquilles téléphone et bureau. Le fichier en cours de choix survit au passage d'un seuil.
- **Bandeau de la démo.** L'espace borné de Messages retranche le bandeau de la démo.
- **Jetons.** Les jetons de l'ancienne charte absents de `main` sont remplacés par leur valeur de repli (16 px, 1 400 px) ou par la surface des entrées voisines (cliquet `theme-contract`).
- **Test non reporté.** Le cas « analyse indisponible » (`fileScanUnavailable`) n'est pas repris : `main` n'a ni ce motif de retenue ni sa présentation classique.

Aucun changement de `convex/`, `package.json`, `bun.lock` ni `deploy/`. Aucun backend n'est concerné.

## Vérification

Faite dans un candidat isolé (`main` + DIASPORALE `fab55ef`, `bun install --frozen-lockfile`), sans toucher à l'arbre de travail partagé.

| Contrôle | Résultat |
| --- | --- |
| Typages : 12 espaces de travail, tests racine, Convex | sans erreur |
| Moteur social (`@antsia/social-features`) | 4 112 tests, 271 fichiers |
| Application `antsia-ga` | 998 tests, 108 fichiers |
| `@antsia/ui`, `social-domain`, `api`, `social-contracts`, `social-native` | 2 178 + 899 (3 ignorés) + 255 + 65 + 54 |
| Console `admin-antsia-ga`, mobile `antsia-mobile` | 81 + 84 |
| DIASPORALE (domaine, fonctions, application) | 697 + 877 + 1 389 |
| Cliquets du dépôt, scripts | 144 + 44 |
| Lint des espaces | 0 erreur (257 avertissements préexistants) |

Total : 11 877 tests réussis. Une première passe a été coupée par un disque plein (ENOSPC) : elle a été rejouée.

## Limites

- Les suites Convex (`test:convex`) ne sont pas rejouées : `convex/` est identique à `main`.
- Aucune recette visuelle locale : elle demanderait les secrets d'authentification du poste.
- La recette en ligne aux trois largeurs suit la publication.
