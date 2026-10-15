# ANTIA — Consignes pour les agents (Claude Code, Codex)

> Moteur social national (backend Convex + paquets `@antia/*`) et réseau public ANTIA.
> Avant tout travail, lire dans l'ordre :
> 1. `docs/00_CAHIER_DES_CHARGES_ANTIA.md` (le moteur et le réseau public : invariants, tables, lots) ;
> 2. `docs/01_PLAN_IMPLEMENTATION_PROMPTS_ANTIA.md` (le prompt à exécuter, un à la fois, avec son
>    préambule commun ; l'encart « État » dit où l'on en est) ;
> 3. `../../../Documentation/RESEAUX_SOCIAUX/00_PLAN_RESEAUX_DANS_LE_RESEAU_DIASPORALE_ANTIA_2026-10-14.md`
>    et ses annexes A (backend du socle) et B (front du socle), qui sont la carte de duplication ;
> 4. `../DIASPORALE/docs/00_CAHIER_DES_CHARGES_DIASPORALE.md` (le premier réseau servi) ;
> 5. `docs/adr/` (décisions du moteur).

## Ce qu'est ce dépôt

- **Le moteur social national** (backend Convex `antia` + paquets) et **le réseau public
  ANTIA** (`apps/antia_ga`, port 3030) et sa **console** (`apps/admin_antia_ga`, port 3032).
  DIASPORALE (`../DIASPORALE`) est une application externe de ce moteur ; sa tranche backend
  `convex/modules/diaspora/` vit ici.
- Le code vient du **socle administration.ga sur `origin/main`** (jamais de l'arbre de
  travail partagé, en retard), dupliqué selon les dix règles de PRO.GA (`PRO_GA/docs/11` §2) :
  copier d'abord, en-tête de provenance `// Dupliqué de <chemin> @ <commit> — adaptations : …`,
  périmètre d'adaptation fermé, aucun import inter-produit, tests portés et exécutés, fusion
  sans écrasement, jetons sans fork, tranches verticales, gardes testées, parité prouvée.
  Source lue au 14/10 : `origin/main` = `ad2e7fdc2` (copie propre par `git worktree add`).

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

- Code en anglais, UI en français **via i18n** (fr, en ; mêmes clés, cliquet `i18n-locales`) ;
  TypeScript strict ; `schemaValidation: true` ; validateurs précis, jamais le validateur
  permissif ; aucun `.collect()` sans `// borné : <raison>` ; aucune couleur littérale hors de
  `packages/ui/src/{styles,themes}` ; aucune URL en dur (les routes vivent dans
  `apps/*/src/lib/routes.ts`, les origines dans l'environnement) ; React Hook Form + Zod ; sonner ;
  lucide-react ; `bun run codegen` avant tout typecheck ou test.
- Versions : une seule fois, dans le **catalogue** du `package.json` racine ; chaque paquet
  déclare ce qu'il importe avec `"catalog:"` (linker isolé : une dépendance non déclarée
  n'existe pas pour le paquet).
- Thèmes : la charte de base (`packages/ui/src/styles/charte.css`, dupliquée de la charte
  Personnel du socle) déclare TOUS les jetons ; un thème (`packages/ui/src/themes/<nom>.css`,
  `[data-charte="<nom>"]`) ne redéclare que des jetons du contrat (cliquet `theme-contract`).
- Modèle : **Opus** pour tout le code (consigne du 25/09/2026), jamais de sous-agent Sonnet.
- Livraison : commits en français ; restent au propriétaire : création de dépôts, projets
  Convex, hébergement, secrets, domaines, et **toute publication du socle en production** (PA9).
  Aucune commande vers un déploiement de production sans décision explicite ; jamais de
  `--rapide` sans demande. Les agents n'éditent **aucun fichier `.env*`** (sauf `.env.example`).
- Dépôts voisins : `../../ADMINISTRATION_GA` (source de duplication, lecture seule, sauf PA9
  par PR) ; `../../SERVICES_TRANSVERSES/identite.ga` (clients OIDC par le portail).

## Arbre partagé avec la session DIASPORALE

- La session ANTIA est propriétaire de tout le dépôt, SAUF `convex/modules/diaspora/`,
  `packages/ui/src/themes/diasporale.css` et `packages/social-contracts/src/i18n/locales/*/diaspora.json`
  (écrits par la session DIASPORALE).
- Fichiers partagés (`package.json`, `bun.lock`, `convex/schema.ts`, `convex/convex.config.ts`,
  `deploy/catalog.json`) : modifiés par la session ANTIA seule, sur demande par message.
- Jamais `git add -A` : `git add -- <chemins>` puis `git commit -- <chemins>`. Aucun changement de
  branche dans ANTIA tant que les deux sessions y écrivent (`main` pendant PA0 → PA3 ; à partir
  de PA4, branches dédiées + PR si une seule session écrit encore).

## Commandes

```bash
bun install                # une seule installation, ici
bun run dev:convex         # déploiement Convex de développement (local anonyme tant que le projet `antia` n'existe pas)
bun run dev:antia          # http://localhost:3030
bun run dev:admin          # http://localhost:3032
bun run verify             # obligatoire avant tout commit
```

`verify` = codegen + `typecheck:convex` (tsgo) + `typecheck:tests` + `test` (convex-test,
cliquets, scripts) + typage, tests et lint de chaque espace de travail
(`scripts/workspace-run.mjs`).

Cliquets en place (`tests/ratchets/`) : `no-cross-product-imports`, `no-any-validators`,
`no-unbounded-collect`, `no-hardcoded-colors`, `no-hardcoded-strings`, `no-hardcoded-urls`,
`network-scoped-functions` (liste des modules sociaux à étendre à chaque module),
`public-communication`, `i18n-locales`, `theme-contract`, `provenance-headers`,
`deploy-catalog`, et pour la garde des fichiers (PA3) `file-delivery-gate`, `upload-policy`,
`fresh-upload`, `storage-arg-freshness`, et pour la cloche `notifications-writer` (seule
`convex/modules/notifications/notify.ts` écrit dans `notifications`). À venir : `rate-limited-writes` (PA5), `sign-out-everywhere` (PA4).

## Pièges déjà payés

- **Fichiers à plusieurs points sous `convex/`** (`*.test.ts`, `test.setup.ts`,
  `vitest.config.ts`) : ignorés par le bundler de Convex (vérifié dans le CLI 1.45). Un fichier à
  UN point y est déployé : jamais d'`import.meta.glob` ni d'import de `vitest` dedans.
- **Glob de convex-test** : la négation extglob `!(…)` ne correspond à RIEN avec le glob de Vite
  (zéro module, harnais muet). Forme tableau avec exclusions `"!…"` ; le test du harnais vérifie
  que le glob n'est jamais vide.
- **`@next/env` garde un cache partagé avec Next** : `loadEnvConfig` sur un second dossier rend
  l'environnement du premier. La config Next commune lit `ANTIA/.env.local` par un lecteur
  minimal (`readEnvFile`), testé.
- Une modification de `packages/api/next-config.mjs` ne redémarre PAS `next dev` (seul
  `next.config.ts` est surveillé) : relancer le serveur.
- **Disque plein** : le 14/10, le disque du Mac n'avait plus que 118 Mo libres pendant le premier
  `convex dev` (binaire du backend local : ~164 Mo). Vérifier `df -h /System/Volumes/Data` avant
  une installation ou un build.
- **Actions « use node » et backend local** : le backend local refuse TOUT le déploiement dès
  qu'une action `"use node"` existe et que son Node n'est pas en 20, 22 ou 24 (le Mac a Node 25 :
  `DeploymentNotConfiguredForNodeActions`). `bun run dev:convex` passe par `scripts/convex-dev.mjs`,
  qui met un Node supporté en tête du PATH (Homebrew `node@22` présent). Relancer `convex dev`
  après tout changement de ce lanceur.
- **Identifiants de cron** : ASCII seulement (`crons.daily("purge des fichiers infectés", …)` fait
  échouer le déploiement entier à cause du `é`).
- **`codegen` et `convex dev` en même temps** : `convex codegen` pousse aussi vers le backend local ;
  lancé pendant un déploiement de `convex dev`, il rend `409 ExistingModuleHashConflict`. Attendre
  « Convex functions ready » puis relancer.
- **Garde des fichiers** : tout `ctx.storage.getUrl` passe par `convex/modules/files/storageGuard.ts`
  (`servableUrl`), tout `generateUploadUrl` par `guardUploadUrl`, tout rattachement par
  `assertFreshUpload` puis `admitStoredUpload` (ou `admitPosedUploads`) — quatre cliquets.

## Mémoire

Vault Obsidian : `10-PROJETS/antia/` (fiche, contexte actif, décisions) ; ADR du dépôt dans
`docs/adr/`. Mettre à jour en fin de travail (`/memoire-maj`).
