# ANTIA — Consignes pour les agents (Claude Code, Codex)

> Dossier ouvert le 14/10/2026 : **cahier des charges et prompts seulement, pas encore de
> code**. Avant tout travail, lire dans l'ordre :
> 1. `docs/00_CAHIER_DES_CHARGES_ANTIA.md` (le moteur et le réseau public : invariants, tables, lots) ;
> 2. `docs/01_PLAN_IMPLEMENTATION_PROMPTS_ANTIA.md` (le prompt à exécuter, un à la fois, avec son préambule commun) ;
> 3. `../../../Documentation/RESEAUX_SOCIAUX/00_PLAN_RESEAUX_DANS_LE_RESEAU_DIASPORALE_ANTIA_2026-10-14.md`
>    et ses annexes A (backend du socle) et B (front du socle), qui sont la carte de duplication ;
> 4. `../DIASPORALE/docs/00_CAHIER_DES_CHARGES_DIASPORALE.md` (le premier réseau servi).

## Ce qu'est ce dépôt

- **Le moteur social national** (backend Convex `antia` + paquets) et **le réseau public
  ANTIA** (`apps/antia_ga`) et sa **console** (`apps/admin_antia_ga`). DIASPORALE
  (`../DIASPORALE`) est une application externe de ce moteur ; sa tranche backend
  `convex/modules/diaspora/` vit ici.
- Le code vient du **socle administration.ga sur `origin/main`** (jamais de l'arbre de
  travail partagé, en retard), dupliqué selon les dix règles de PRO.GA (`PRO_GA/docs/11` §2) :
  copier d'abord, en-tête de provenance `// Dupliqué de <chemin> @ <commit> — adaptations : …`,
  périmètre d'adaptation fermé, aucun import inter-produit, tests portés et exécutés, fusion
  sans écrasement, jetons sans fork, tranches verticales, gardes testées, parité prouvée.

## Invariants (ne jamais contourner)

- `networkId` sur toute table et toute fonction sociale ; `requireMembership(networkId,
  minStatus)` en tête de toute fonction (cliquet `network-scoped-functions`) ; refus indistinct.
- Une personne, un handle ; adhésion dérivée vers la racine ; suspension racine = partout.
- Visibilité `network` par défaut ; `root` seulement si audience publique et geste explicite
  (ou règle de page) ; le retrait se propage.
- Badges (Officiel · Vérifié · Agent public · Communauté) **calculés** côté serveur, jamais
  stockés comme vérité.
- Étanchéité : aucune lecture de base externe, aucun client Convex croisé, aucun import de
  `_generated` ou de schéma du socle ou de gabon-diplomatie ; reflets et attestations par
  contrats signés et idempotents (`convex/modules/federation`).
- Aucun profil ni adhésion créé d'office depuis une base externe (leçon des ADR-0080/0082).
- Toute écriture bornée : adhésion → éligibilité → limitation de débit → droit ; garde de
  délivrance des fichiers fail-closed partout.
- Effacement effectif de toutes les tables sociales et des blobs ; consentements horodatés,
  révocables.

## Conventions

- Code en anglais, UI en français **via i18n** (fr, en) ; TypeScript strict ;
  `schemaValidation: true` ; validateurs précis, jamais `v.any()` ; aucun `.collect()` non
  borné ; aucune couleur littérale hors des fichiers de jetons ; aucune URL codée en dur (tout
  passe par l'adaptateur de routage de l'application) ; React Hook Form + Zod ; sonner ;
  lucide-react ; `bun run codegen` avant tout typecheck ou test.
- Modèle : **Opus** pour tout le code (consigne du 25/09/2026).
- Livraison : branche dédiée, commits en français, PR, fusion après vérification (décision du
  23/09/2026). Restent au propriétaire : création de dépôts, projets Convex, hébergement,
  secrets, domaines, et **toute publication du socle en production** (PA9). Aucune commande
  vers un déploiement de production sans décision explicite ; jamais de `--rapide` sans demande.
- Dépôts voisins : `../../ADMINISTRATION_GA` (source de duplication, lecture seule, sauf PA9
  par PR) ; `../../SERVICES_TRANSVERSES/identite.ga` (clients OIDC par le portail).

## Vérification

```bash
bun run verify   # obligatoire avant tout commit
```

Cliquets attendus verts : `network-scoped-functions`, `no-cross-product-imports`,
`no-any-validators`, `no-unbounded-collect`, `no-hardcoded-colors`, `no-hardcoded-strings`,
`no-hardcoded-urls`, `public-communication`, `rate-limited-writes`, `sign-out-everywhere`.

## Mémoire

Vault Obsidian : `10-PROJETS/antia/` (fiche, contexte actif, décisions) ; ADR du dépôt dans
`docs/adr/`. Mettre à jour en fin de travail (`/memoire-maj`).
