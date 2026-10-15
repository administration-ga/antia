# ANTIA — Le moteur social national et le réseau social public gabonais

> Nom à confirmer par le propriétaire (« ANTIA » saisi, « A-N-T-S-A » épelé). Le nom
> `antia.ga` figure déjà au registre de ses dépôts GitHub ; ce dossier retient **ANTIA** et le
> domaine `antia.ga`. Dans le code, le nom est un jeton de marque unique
> (`packages/social-contracts/src/brand.ts`).

Deux objets dans un dépôt :

- **Le moteur social national** : le backend Convex et les paquets (`social-domain`,
  `social-contracts`, `social-features`, `ui`, `api`) qui servent **tous** les réseaux de
  l'écosystème — ANTIA, DIASPORALE, et demain d'autres. Il est construit par **duplication** du
  réseau social de l'espace agent d'administration.ga (iRéseau, iCom, stories, albums, direct,
  notifications), selon les dix règles de duplication de PRO.GA, et rendu **multi-réseaux par
  construction** (table `networks`, clé `networkId` partout, une personne unique, identités
  externes, modération par réseau, fédération entrante par contrats signés).
- **Le réseau public ANTIA** : réseau **racine**, ouvert à toute personne, structuré par la
  confiance (Officiel · Vérifié · Agent public · Communauté), qui **contient** les réseaux
  fermés : DIASPORALE (diaspora) et le miroir de l'iRéseau de l'administration (reflets des
  pages vérifiées et des publications déclarées publiques).

Édité par **NTSAGUI Digital** ; identité fédérée par **identite.ga** (IDN), fournisseur
d'identité unique du programme. Licence : voir `LICENSE` et `NOTICE` (AGPL-3.0, héritée du socle
dont le code est dupliqué — à confirmer par le propriétaire).

## État (15 octobre 2026)

PA0 (scaffold), PA1 (owner map de duplication, `docs/02`) et PA2 (fondations multi-réseaux,
domaine pur) sont clos ; une **tranche verticale testable** tourne sur antia.ga : entrer par code
à usage unique, choisir son nom et son identifiant, rejoindre le réseau `antia`, publier, lire le
fil, réagir. DIASPORALE est câblé comme application externe (installation unique ici).
L'avancement prompt par prompt est tenu dans l'encart « État » de
[`docs/01_PLAN_IMPLEMENTATION_PROMPTS_ANTIA.md`](docs/01_PLAN_IMPLEMENTATION_PROMPTS_ANTIA.md).

| Document | Rôle |
|---|---|
| [`docs/00_CAHIER_DES_CHARGES_ANTIA.md`](docs/00_CAHIER_DES_CHARGES_ANTIA.md) | cahier des charges du moteur (partie A) et du réseau public (partie B) : exigences `EXF-AN` / `EXT-AN`, lots A0–A6, parcours R1–R10, arbitrages A1–A10 |
| [`docs/01_PLAN_IMPLEMENTATION_PROMPTS_ANTIA.md`](docs/01_PLAN_IMPLEMENTATION_PROMPTS_ANTIA.md) | onze prompts PA0 → PA10 et leur état ; **DIASPORALE PD0 → PD6 s'exécute entre PA7 et PA8** |
| [`docs/adr/`](docs/adr/) | décisions d'architecture du moteur |
| `../../../Documentation/RESEAUX_SOCIAUX/` | plan de pilotage « réseaux dans le réseau » et annexes A–D |
| `../DIASPORALE/docs/00_CAHIER_DES_CHARGES_DIASPORALE.md` | le premier réseau servi par le moteur |

## Le dépôt

```text
ANTIA/
├── apps/
│   ├── antia_ga             # antia.ga — réseau public (Next.js 16, port 3030)
│   └── admin_antia_ga       # console du moteur (Next.js 16, port 3032)
├── packages/
│   ├── social-domain        # SSOT : règles pures (TS pur, zéro dépendance)
│   ├── social-contracts     # types, modules purs et codes serveur partagés front/back (+ leurs traductions)
│   ├── social-features      # surfaces dupliquées du front de l'espace agent, coque légère, i18n
│   ├── ui                   # charte de base (dupliquée de la charte Personnel), thèmes d'application, primitives
│   ├── api                  # accès au moteur : client, session, réseau courant, CSP, config Next commune
│   ├── tsconfig             # bases TypeScript
│   └── eslint-config        # préréglages ESLint (next, react, library)
├── convex/                  # LE MOTEUR (modules en tranches verticales, à partir de PA2)
├── tests/ratchets/          # cliquets : tests qui relisent le code
├── scripts/                 # lanceur d'espaces de travail (dupliqué du socle), publication
├── deploy/                  # catalogue des applications, Cloud Build, liste blanche du contexte
└── docs/                    # cahiers, prompts, ADR (owner map, parité, charte, contrats à venir)
```

Espaces de travail bun : `apps/*`, `packages/*`, `../DIASPORALE/apps/*`, `../DIASPORALE/packages/*`
(une seule installation, ici ; DIASPORALE câblé le 15/10 à la demande de son prompt PD0). Les versions
vivent une fois dans le **catalogue** du `package.json` racine (`"catalog:"`). Les tâches
transverses passent par `scripts/workspace-run.mjs` (turbo refuse les espaces de travail hors
racine).

## Commandes

```bash
bun install
bun run dev:convex         # backend Convex de développement (garder ouvert)
bun run dev:antia          # http://localhost:3030
bun run dev:admin          # http://localhost:3032
bun run verify             # OBLIGATOIRE avant tout commit
```

`bun run verify` = `codegen` + typage du backend (tsgo) + typage des cliquets + tests convex-test +
cliquets + tests des scripts + typage, tests et lint de chaque espace de travail. Autres
commandes : `bun run test:domain`, `bun run test:ratchets`, `bun run deploy:check` (contrôle du
catalogue, sans réseau), `bun run deploy:antia` (affiche le plan de publication ; rien ne part
sans `--execute` et la décision du propriétaire).

### Déploiement Convex de développement

Tant que le projet Convex `antia` du propriétaire n'existe pas, le moteur tourne sur un
**déploiement local anonyme** (backend Convex sur cette machine, port 3210, aucun compte, aucun
nuage). Première fois :

```bash
CONVEX_AGENT_MODE=anonymous bun run dev:convex
```

Le CLI écrit `ANTIA/.env.local` (non versionné) ; les applications le lisent d'elles-mêmes en
développement. Quand le projet `antia` existera : `bunx convex dev --configure` pour s'y
rattacher, puis `bunx convex env set …` pour ses variables (voir `.env.example`).

### Tester la tranche verticale en local

Une fois par déploiement local (le propriétaire l'a autorisé pour le déploiement LOCAL seulement) :

```bash
openssl rand -base64 32 | bunx convex env set BETTER_AUTH_SECRET
bunx convex env set SITE_URL http://localhost:3030
bunx convex env set ANTIA_DEV_TOOLS true
bunx convex run seeds/foundations:run '{"confirmNonProduction":"ANTIA_SEEDS_HORS_PRODUCTION"}'
```

Puis `bun run dev:convex` et `bun run dev:antia`, et ouvrir http://localhost:3030 → « Entrer ».
Sans service de courriel, le code à usage unique s'affiche sur l'écran de connexion — seulement
quand `ANTIA_DEV_TOOLS=true` ET que le backend est local (double garde, `convex/lib/devTools.ts`) ;
ailleurs, aucun code n'est lu ni écrit.

## Invariants non négociables

- `networkId` sur toute table et toute fonction sociale (cliquet) ; une personne, un handle ;
  adhésion dérivée vers la racine ; visibilité `network` / `root` ; badges calculés côté
  serveur ; étanchéité (contrats signés seulement, jamais de lecture de base externe ni
  d'import `_generated` d'un autre dépôt) ; adhésion explicite ; refus indistinct ; toute
  écriture bornée (adhésion → éligibilité → limitation de débit → droit).
- `schemaValidation: true` ; validateurs précis ; aucun `.collect()` non borné ; aucune
  couleur littérale ; aucune chaîne hors i18n ; aucune URL codée en dur.
- Aucune publicité non étiquetée, aucun profilage commercial, aucun chiffre public non mesuré.

## Droit

Loi gabonaise n° 001/2011 modifiée par la loi n° 025/2023 (APDPVP) ; RGPD pour les résidents
de l'Union européenne ; dossier APDPVP et analyse d'impact du moteur et de chaque réseau
avant mise en ligne (lot A0).
