# ANTIA — Le moteur social national et le réseau social public gabonais

> Nom à confirmer par le propriétaire (« ANTIA » saisi, « A-N-T-S-A » épelé). Le nom
> `antia.ga` figure déjà au registre de ses dépôts GitHub ; ce dossier retient **ANTIA** et le
> domaine `antia.ga`. Dans le code, le nom est un jeton de marque unique.

Deux objets dans un dépôt :

- **Le moteur social national** : le backend Convex et les paquets (`social-domain`,
  `social-contracts`, `social-features`, `ui`, `api`) qui servent **tous** les réseaux de
  l'écosystème — ANTIA, DIASPOGAB, et demain d'autres. Il est construit par **duplication** du
  réseau social de l'espace agent d'administration.ga (iRéseau, iCom, stories, albums, direct,
  notifications), selon les dix règles de duplication de PRO.GA, et rendu **multi-réseaux par
  construction** (table `networks`, clé `networkId` partout, une personne unique, identités
  externes, modération par réseau, fédération entrante par contrats signés).
- **Le réseau public ANTIA** : réseau **racine**, ouvert à toute personne, structuré par la
  confiance (Officiel · Vérifié · Agent public · Communauté), qui **contient** les réseaux
  fermés : DIASPOGAB (diaspora) et le miroir de l'iRéseau de l'administration (reflets des
  pages vérifiées et des publications déclarées publiques).

Édité par **NTSAGUI Digital** ; identité fédérée par **identite.ga** (IDN), fournisseur
d'identité unique du programme.

## État du dossier (14 octobre 2026)

**Ouvert le 14/10/2026 : cahier des charges et plan d'implémentation. Aucun code encore.**
Dépôt GitHub cible : `administration-ga/antia` (à créer par le propriétaire).

| Document | Rôle |
|---|---|
| [`docs/00_CAHIER_DES_CHARGES_ANTIA.md`](docs/00_CAHIER_DES_CHARGES_ANTIA.md) | cahier des charges du moteur (partie A) et du réseau public (partie B) : exigences `EXF-AN` / `EXT-AN`, lots A0–A6, parcours R1–R10, arbitrages A1–A10 |
| [`docs/01_PLAN_IMPLEMENTATION_PROMPTS_ANTIA.md`](docs/01_PLAN_IMPLEMENTATION_PROMPTS_ANTIA.md) | onze prompts PA0 → PA10 ; **DIASPOGAB PD0 → PD6 s'exécute entre PA7 et PA8** |
| `../../../Documentation/RESEAUX_SOCIAUX/` | plan de pilotage « réseaux dans le réseau » et annexes A (backend du socle), B (front du socle), C (comptes consulat.ga), D (conventions, ADR, gabarit, identité) |
| `../DIASPOGAB/docs/00_CAHIER_DES_CHARGES_DIASPOGAB.md` | le premier réseau servi par le moteur |

## Ce que sera le dépôt (cible, après PA0)

```text
ANTIA/
├── apps/
│   ├── antia_ga             # antia.ga — réseau public (Next.js 16, port 3030)
│   └── admin_antia_ga       # console du moteur : réseaux, équipes, fédération, journal (port 3032)
├── packages/
│   ├── social-domain        # SSOT : visibilité, éligibilité, badges, validation (TS pur, dupliqué du socle)
│   ├── social-contracts     # types et modules purs partagés front/back
│   ├── social-features      # surfaces dupliquées : fil, profil, relations, groupes, évènements, pages, albums, stories, notifications, messagerie, appels, direct, modération ; coque légère
│   ├── ui                   # jetons (data-charte par application) et primitives
│   └── api                  # client Convex + TanStack, NetworkProvider, routage, SSO
├── convex/                  # LE MOTEUR : modules en tranches (networks, people, posts, engagement, graph, pages, groups, events, messaging, calls, live, files, notifications, moderation, federation, diaspora…)
├── docs/                    # cahiers, prompts, owner map, parité, charte, contrats, ADR
└── deploy/                  # catalogue des applications (Dockerfiles en contexte ECOSYSTEMES)
```

Espaces de travail bun : `apps/*`, `packages/*`, et les applications externes
`../DIASPOGAB/apps/*`, `../DIASPOGAB/packages/*` (une seule installation, ici).

## Commandes (cibles, posées par PA0)

```bash
bun install
bun run codegen            # TOUJOURS avant typecheck et tests
bun run verify             # codegen + typecheck:convex + tests + turbo typecheck test lint
bun run dev:convex         # déploiement dev du projet Convex `antia`
bun run dev:antia          # http://localhost:3030
bun run dev:admin          # http://localhost:3032
bun run dev:diaspogab      # http://localhost:3031 (après DIASPOGAB PD0)
```

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
