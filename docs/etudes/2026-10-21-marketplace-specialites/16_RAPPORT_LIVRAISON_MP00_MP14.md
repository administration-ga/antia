# MP14 — Rapport de livraison du candidat MP00–MP14

**Date : 21 octobre 2026 · Branche : `claude/marketplace-mp00-mp14-20261021` · État : candidat composé et vérifié ; mise en production soumise à l'accord du propriétaire.**

Les sessions Codex ont été interrompues à 17 h 50 pendant la composition, dans un bac à sable Vercel (`sbx_YVoF…`) que la reprise n'a pas pu utiliser : prolongation refusée (403), commandes non autorisées. Le candidat a été recomposé localement, hors de l'arbre partagé.

## Composition

| Élément | Valeur |
|---|---|
| Base | `main` `d2ac0be` (PR 28) ; même code que la production `main-086cd43b8686` |
| Instantané de l'arbre partagé | `eea4f0c` (parent `c4d36f3`), construit avec un index privé |
| Fusion puis correctifs | `1994827`, `884fa37`, `6c3b0c4` et ce rapport |
| Arbre, index et HEAD partagés | Inchangés (`codex/pa4-identite-session`) |

L'instantané couvre `apps/` (hors `apps/antsia_mobile`, laissé à `main`), `packages/`, `convex/`, `tests/`, `scripts/`, `ops/`, `deploy/` et `docs/` hors recettes, contenus de démonstration, maintenance et mémoire. Il porte **trois couches non publiées** :

1. les lots commerce P03–P19 de l'étude du 18/10, restés « sources raccordées » ;
2. le responsive U03–U08 (`71c93a5` … `e2c3819`), publié dans la nuit puis **absent de `main` et de la production depuis le 21/10 à 10 h 46** ;
3. la marketplace MP01–MP13.

La marketplace dépend des deux premières couches : tables et contrats P (intentions de service, candidatures V2), classes et jetons du système U. Le candidat les publie donc ensemble et les vérifie ensemble. Une autre session prépare en parallèle une PR U03–U08 dédiée : la branche sera remise à jour sur `main` après sa fusion.

### Conflits (54 fichiers)

- Quand un côté inclut l'autre ligne à ligne, la version la plus complète est retenue ; les doublons créés par les déplacements auto-fusionnés ont été retirés (imports, clés JSON, déclarations).
- Démo intégrée de `main` préservée : hauteur sous le bandeau (`demoWorkspaceHeight`), espace de stockage démo, codes démo lisibles (`demoCodeReadable`), catalogue démo fermé.
- Sept thèmes et charte : jetons `esp-` de l'arbre, qui contiennent déjà les quatre jetons ajoutés par `main`.
- Traductions : aucune clé en double, mêmes clés FR/EN.
- Next 16.4.2 (lot U) et `bun.lock` de l'arbre, cohérent avec `main` + DIASPORALE (`bun install --lockfile-only` ne change rien).
- Le test de hauteur démo de la messagerie (`main`) est conservé dans `messages-screen-demo.test.tsx`, à côté du test MP09 de l'arbre.

### Correctifs apportés à la vérification

- **Conversation contextuelle (MP09)** : `ContextualObjectRefView` redevient le type V1 à trois natures, que DIASPORALE rouvre de façon exhaustive. Les quatre natures passent par `ContextualAnyObjectRefView` et le geste explicite `onOpenContextualObject` ; une collaboration professionnelle ne s'ouvre jamais par le rappel historique (test ajouté).
- **Inventaire P16** : `commerceCatalogIndexes` (MP04, état collectif sans titulaire) ajouté à la revue des tables commerciales.
- **MP07b** : jeu d'essai rendu cohérent avec la règle du contrat (un bénéficiaire vérifié suppose un rail qualifié pour la vérification) ; l'analyseur n'est pas assoupli.
- **Tests de l'application** : `data-scroll-behavior="smooth"` (MP04), entrées professionnels/presse/rencontres dans Découvrir (MP09, MP10, MP13), retour au fil confié à la coque spécialisée (MP01).
- **Dépôt public** : chemins `/Users/…` remplacés par `~/…` dans les documents ajoutés.

## Vérifications du candidat exact

| Contrôle | Résultat |
|---|---|
| Génération Convex | Verte, sur un backend local propre au dossier candidat : schéma validé, onze composants installés. Le backend local de l'arbre partagé n'a reçu aucun déploiement. |
| `typecheck:convex`, `typecheck:tests` | 0 erreur |
| Tests du moteur (`test:convex`) | 203 fichiers, 3 197 tests : 3 195 verts au passage complet ; les 2 échecs corrigés puis rejoués verts (65/65 sur leurs deux fichiers) |
| Cliquets / scripts | 146/146 · 70/70 |
| Typage des espaces de travail | 11/12 verts ; `diasporale-com` : voir DIASPORALE ci-dessous |
| Tests des espaces ANTSIA | domaine 998 · contrats 86 · api 291 · natif 75 · ui 2 286 · social-features 4 172 · console 87 · antsia_ga 1 735 · mobile 84 |
| Lint | 0 erreur (avertissements préexistants) |
| Build Next `antsia_ga` | RESULTAT_BUILD |

Total ANTSIA : **13 227 tests verts**.

### DIASPORALE (dépôt voisin, non modifié)

Avec la version publiée de DIASPORALE (`fab55ef`), le nouveau moteur laisse 6 erreurs de typage dans `diasporale-com`, 10 tests de contraste du thème en échec dans `diasporale-features` et 1 cliquet de traductions dans `diasporale-com`. Avec les retouches **non publiées** de son arbre de travail : typage vert, 963/963 tests de `features`, et `diasporale-com` à 1 401/1 402. Le dernier échec demande dix clés FR/EN pour cinq nouvelles surfaces de modération (`commerceStorefront`, `professionalProfile`, `professionalCollaboration`, `editorialVersion`, `editorialMedia`) dans `settings.dataRights.decisions.surface` et `moderationDesk.surface`.

Ces fichiers appartiennent à la session DIASPORALE : publier ses retouches et ajouter ces clés est la condition pour que DIASPORALE adopte ce moteur. Le déploiement d'antsia.vercel.app n'en dépend pas.

### Parité des contrats jumeaux

Les tests de parité lisent `../PRO_GA` : ils sont verts contre l'arbre de travail PRO.GA (branche `feat/antsia-social-commerce`, non publiée). La publication PRO.GA reste un périmètre distinct ; tant que son producteur V2 n'est pas déployé, aucun catalogue marchand réel n'alimente la marketplace.

## Capacités

| Capacité | État dans ce candidat |
|---|---|
| Espaces spécialisés, retour social (MP01–MP02) | Raccordés, opt-in ANTSIA |
| Catalogue V2, facettes, marketplace (MP03–MP05) | Raccordés ; aucun catalogue marchand réel ; sélection démo distincte |
| Services, devis, forfaits (MP06) | Raccordés ; options serveur `ANTSIA_COMMERCE_*` fermées par défaut |
| Préparation financière (MP07) | Lecture seule, `ANTSIA_COMMERCE_PAYMENT_PREPARATION_ENABLED=false` |
| Rails de paiement (MP08) | **Fermés** : aucun contrat PSP fourni |
| Réseau professionnel (MP09) | Raccordé, volontaire |
| Rencontres personnelles (MP10–MP11) | **Fermées** : aucune preuve de majorité ; `/rencontres` informative |
| Rédaction et sites médias (MP12–MP13) | Raccordés ; aucun article réel publié par cette session |

Aucune capacité conditionnelle n'est activée par ce candidat.

## Mise en production — non effectuée

La marketplace ajoute treize tables et des fonctions Convex. Les publications précédentes n'avaient déployé que le front ; celle-ci exige, dans l'ordre :

1. fusionner la PR dans `main`, après la PR U03–U08 si elle passe avant, et revérifier le résultat ;
2. `convex deploy` sur la démonstration, puis sur la production (`diligent-avocet-585`) ;
3. `vercel deploy --prod` de l'enfant démo, puis du principal ;
4. recette en ligne aux trois formats, comptes démo et compte réel.

Ces gestes restent soumis à la décision explicite du propriétaire (CLAUDE.md du dépôt, PA9).

Schéma : sur les tables existantes, seulement des champs optionnels et des unions élargies ; les champs obligatoires appartiennent aux tables nouvelles. Si Convex refusait la validation sur les données réelles, la version en service resterait active.

## Retour arrière

- Front : promouvoir de nouveau le déploiement `dpl_DF9PM1Zp117xVN7eYDiUqmcaGrKP` (`main-086cd43b8686-production`).
- Backend : redéployer `main` `d2ac0be`. Les tables nouvelles restent vides tant que les capacités sont fermées ; ce retour n'a pas été répété.
