# P01 — Charte claire et sombre ANTSIA (encre, ivoire et prune)

18 octobre 2026, agent « charte » sous coordination (vague 1). Prompt
[P01](../prompts/P01_CHARTE.md), spécification [03](../03_DESIGN_SYSTEM.md) §2, §3, §6–§8,
audit [02](../02_AUDIT_ANTSIA.md) §4, [ADR-0017](../../../adr/0017-refonte-sociale-charte-navigation-immersion.md).

Verdicts séparés (10 §7) : **présent dans le code** — oui ; **testé automatiquement** — oui
(contrastes *calculés* sur les jetons résolus) ; **observé en recette** — non (navigateur
réservé au coordinateur, liste au §8) ; **publié** — non (aucun commit, push ni déploiement).

## 1. Résultat

- `packages/ui/src/themes/antsia.css`, servi par `apps/antsia_ga` (`globals.css` l. 3,
  `<html data-charte="antsia">`), porte la palette 03 §2 complète en clair et en sombre.
  Constaté sur le serveur de dev déjà lancé (:3030, HTTP 200, lecture seule) : la feuille
  `/_next/static/chunks/ANTSIA_08dmsc-._.css` contient les trois blocs du thème
  (`--primary-500: #8b2f73`, `--on-fill: #24101f`, `--radius-xl: 12px`, voile `#1f20248c`).
  Ce constat HTTP ne prouve pas le rendu.
- La modification non commitée du propriétaire (fond blanc, cartes beige, `--esp-surface-card`,
  `--secondary`, `--ink-0` = carte, `--ink-100` = fond, polices) est **conservée telle quelle en
  valeur** et étendue : les mêmes rôles portent désormais le charbon en sombre.
- Trois blocs, tous dans le contrat (`theme-contract` vert) :
  1. clair `[data-charte="antsia"]` : primitives du contrat réaccordées (seules valeurs
     littérales des neutres), échelles `--primary-*`, `--success-*`, `--danger-*` du clair,
     rôles propres au clair ;
  2. sombre `.dark[data-charte="antsia"], .dark [data-charte="antsia"]` (0,2,0) : échelles et
     rôles propres au sombre. `.dark` et `data-charte` sont posés **sur `<html>`**
     (`apps/antsia_ga/src/app/layout.tsx:32`, `shell/appearance/provider.tsx:77`) ; la forme
     descendante sert les portails qui redéclarent `data-charte` (dock iCom, appel, stories,
     cartes flottantes, commentaires) ;
  3. commun (sélecteur triple, 0,1,0 en clair et 0,2,0 en sombre) : les familles ui-v2 et
     `--esp-*` suivent les rôles sémantiques — un seul renvoi pour les deux thèmes.
- États traités : texte secondaire, liens, focus (`--ring`, `--shadow-focus` 2 px + 2 px),
  champs (`--input`, `--ink-300` ≥ 3:1), danger, succès, actif/sélectionné (`--primary-50/100`,
  `--primary-700/800`, `--accent`, `--sidebar-accent`, `--esp-accent-soft/deep`), boutons pleins
  repos/survol (`--primary-fill(-hover)`, `--on-fill`) pour l'action, le danger et le succès,
  couverture de repli (`--esp-banner` prune), voile (`--ui2-scrim` encre 55 %), badges de statut.
- Rayon `--radius-xl` 14 → 12 px (cartes `rounded-xl`) ; `--radius-lg`/`-md` restaient à 12 px,
  `--radius-2xl` à 16 px (feuilles `rounded-t-2xl`). Aucune police ajoutée.
- **Aucun ajout à `charte.css`** : tous les rôles de la palette existaient déjà ; les manques
  restants sont dans des composants (§7). Aucun composant, aucune navigation, aucun comportement
  de publication modifiés ; le choix système/clair/sombre existant reste la seule infrastructure.

## 2. Inventaire réel des trois familles (avant mapping)

Lectures `var(--…)` et utilitaires Tailwind de rôle, hors tests, hors `charte.css` et thèmes
(`sf` = `packages/social-features/src`, `app` = `apps/antsia_ga/src`, `ui` = composants de
`packages/ui/src`, `comm` = `styles/communication.css`). Script d'analyse jetable (scratchpad).

| Famille | Jetons les plus lus | Emploi constaté | Rôle palette retenu |
|---|---|---|---|
| shadcn (utilitaires) | `text-muted-foreground` 140, `border-border` 84, `ring-ring`/`outline-ring` 65, `bg-background` 44, `*-destructive` 40, `bg-muted` 34 (dont `hover:bg-muted`), `bg-primary`/`text-primary` 31, `border-input`/`bg-input/30` 31, `bg-card` 29, `text-foreground` 23 | coque, fil, formulaires, modération | fond, carte, texte, secondaire, action, séparateur, contour, focus, danger |
| shadcn (`var()`) | `--border` 51, `--muted-foreground` 39, `--ring` 31, `--foreground` 30, `--primary` 29, `--background` 28, `--card` 19, `--secondary` 12, `--accent` 3 (onglet actif, rangée choisie), `--popover` 3 (feuilles) | CSS en TS, couche de communication | idem ; `--accent` = aplat d'action |
| ui-v2 `--ink-*` | `--ink-600` 117 (couleur), `--ink-900` 106 (couleur), `--ink-200` 65 (filets), `--ink-0` 63 (41 fonds : cartes, menus, champs, boutons outline), `--ink-100` 54 (survols, bulles reçues, puces, fonds de média), `--ink-500` 51, `--ink-700` 38, `--ink-300` 18 (contours de champs, boutons outline, piste d'interrupteur), `--ink-800` 16, `--ink-150` 13 (puces, vignettes, filets fins), `--ink-50` 9 (survols fins), `--ink-400` 4 (cases à cocher + 1 texte) | composants dupliqués du socle | 900/800/700 texte ; 600/500/400 secondaire ; 300 contour ; 200 séparateur ; 150 creux ; 100 fond ; 50 surface élevée ; 0 carte |
| ui-v2 action | `--primary-fill` 28 (15 fonds), `--on-fill` 25, `--primary-600` 21 (13 couleurs), `--primary-50` 19 (sélections), `--primary-500` 19 (5 anneaux, 4 couleurs), `--primary-700` 14, `--primary-100` 6, `--primary-300` 6 (4 anneaux de 3 px), `--primary-400` 2 (anneaux), `--primary-800` 2 | boutons, bulles envoyées, filtres, badges | prune ; 300/400 tenus ≥ 3:1 car ce sont des anneaux de focus |
| ui-v2 statuts | `--danger-500/600/700/50/100`, `--danger-fill`, `--success-50/500/600`, `--success-fill`, `--warning-*`, `--info-*`, `--status-*` | badges, alertes, iCom | danger et succès de la palette ; ambre hérité |
| `--esp-*` | `--esp-immersive-on-ink` 89 / `-ink` 27 (scène d'appel, hors contrat), `--esp-surface-card` 20, `--esp-neutral-hover` 3, `--esp-mobilebar-*` 2, `--esp-r-chrome` 2, `--esp-banner`, `--esp-green-strong` (aplat de l'accueil), `--esp-neutral-chip`, `--esp-night-bg`/`--esp-neutral-0` (lus par `comm` pour `--destructive-foreground`) | cartes, barre basse, cloche, couverture | carte, creux, séparateur, succès ; primitives charbon réaccordées |

Conséquence du constat : `--ink-0`/`--ink-100` gardent la sémantique « carte/fond » de la demande
du propriétaire (et non l'échelle inversée) ; `--ink-300` et `--ink-400` deviennent des contours
mesurés (ils valaient 1,22:1 et 2,33:1 sur la carte beige) ; `--primary-300/400` deviennent des
anneaux visibles (1,53:1 et 2,70:1 avant).

## 3. Mapping appliqué (03 §2 → jetons)

| Rôle | Clair | Sombre | Jetons qui le portent (résolus, vérifiés par le test) |
|---|---|---|---|
| Fond page | `#FFFFFF` | `#141419` | `--background`, `--background-dashboard`, `--ink-100` |
| Surface carte | `#F7F6F2` | `#202026` | `--card`, `--esp-surface-card`, `--secondary`, `--ink-0`, `--sidebar` |
| Surface élevée | `#FFFFFF` | `#2A2A33` | `--popover`, `--ink-50` |
| Texte principal | `#1F2024` | `#F7F6F2` | `--foreground`, `--card-/popover-/sidebar-foreground`, `--ink-900/800/700` |
| Texte secondaire | `#62636B` | `#B9B7C0` | `--muted-foreground`, `--secondary-foreground`, `--sidebar-muted`, `--ink-600/500/400` |
| Action / lien | `#8B2F73` | `#EDADD8` | `--primary`, `--primary-fill`, `--primary-500`, `--accent`, `--sidebar-primary`, `--info-500`, `--status-active` |
| Texte sur action | `#FFFFFF` | `#24101F` | `--primary-foreground`, `--on-fill`, `--accent-foreground`, `--sidebar-primary-foreground` |
| Séparateur | `#DEDCE2` | `#3C3A44` | `--border`, `--ink-200`, `--sidebar-border`, `--esp-mobilebar-border` |
| Contour de contrôle | `#7B7780` | `#8F8998` | `--input`, `--ink-300` |
| Focus | `#8B2F73` | `#EDADD8` | `--ring`, `--sidebar-ring`, `--shadow-focus` |
| Succès | `#14704A` | `#83D5AB` | `--success`, `--success-fill`, `--success-500`, `--esp-green-strong`, `--status-archived` |
| Danger | `#B4233F` | `#FFACB9` | `--destructive`, `--danger-fill`, `--danger-500`, `--status-error` |

Teintes dérivées (absentes de 03 §2, toutes mesurées par le test) : creux ivoire `--muted` =
`--esp-neutral-200` `#efebe0` en clair (encart, survol, puce : 1,10:1 sous la carte) et surface
élevée en sombre ; sélection prune `--primary-50/100` (`#f5e6f0`/`#ebd3e4`, sombre
`#4a2d42`/`#5a3852`, au-dessus de la carte et du menu) ; anneaux `--primary-300/400`
(`#a85592`/`#9a3f83`, sombre `#d98bc4`/`#e39ccd`) ; survol `--primary-600` (`#7a2865`, sombre
`#f2c1e3`) ; textes d'accent `--primary-700/800` ; teintes de succès/danger (50, 100, 600, 700) ;
voile `--ui2-scrim` = encre à 55 % (au lieu du bleu nuit). Primitives réaccordées dans le bloc
clair (lues par les deux thèmes) : `--esp-neutral-900`, `-600`, `-rule`, `-field`,
`--esp-night-bg`, `-card`, `-chip`, `-border`, `-input`, `-soft`.

Hérités de la base à dessein (liste tenue par le test) : ambre d'avertissement
(`--warning*`, `--status-destruct*`), tons de compteur, séries de graphique 2–5, `--accent-orange/
blue/yellow`, ombres, `--esp-mobilebar-bg/-shadow` (déjà sur les primitives charbon),
`--border-light`, sélecteur de comptes ; palette des avatars inchangée (identité de la personne).

## 4. Ratios calculés (arithmétique sur jetons résolus, pas mesure de rendu)

Cascade complète `theme.css` → `charte.css` → `communication.css` → `antsia.css`, sur `<html>` et
sur un portail. Les huit lignes de 03 §2 sont retrouvées **exactement** (16,27/16,98 ; 15,05/14,98 ;
5,52/8,18 ; 7,63/9,90 ; 7,06/8,93 ; 4,05/4,78 ; 5,63/9,31 ; 5,97/9,15).

| Paire | Usage | Clair avant → après | Sombre avant → après |
|---|---|---:|---:|
| `--foreground / --background` | texte du document | 19,90 → **16,27** | 17,19 → **16,98** |
| `--card-foreground / --card` | corps d'une carte | 18,41 → **15,05** | 14,85 → **14,98** |
| `--popover-foreground / --popover` | menu, feuille | 17,40 → **16,27** | 14,85 → **13,14** |
| `--muted-foreground / --card` | date, aide | 6,18 → **5,52** | 6,37 → **8,18** |
| `--muted-foreground / --muted` | aide dans un encart | 6,18 → **5,01** | 6,90 → **7,17** |
| `--primary-foreground / --primary` | bouton plein | 11,58 → **7,63** | 5,96 → **9,90** |
| `--primary / --card` | lien dans une carte | 10,71 → **7,06** | 5,51 → **8,93** |
| `--input / --card` | champ dans une carte | **1,47** → **4,05** | **1,32** → **4,78** |
| `--input / --background` | champ sur le fond | **1,59** → **4,38** | **1,52** → **5,42** |
| `--ink-300 / --ink-0` | champ et bouton outline ui-v2 | **1,22** → **4,05** | **1,41** → **4,78** |
| `--ring / --card` | focus | 7,43 → **7,06** | 5,51 → **8,93** |
| `--primary-300 / --card` | anneau 3 px (réactions, commentaires) | **1,53** → **4,43** | **1,39** → **6,51** |
| `--success / --card` | confirmation | 5,00 → **5,63** | 6,97 → **9,31** |
| `--destructive / --card` | erreur de champ | 6,04 → **5,97** | 6,16 → **9,15** |
| `--on-fill / --success-fill` | bouton de succès | 4,62 → **6,09** | **4,08** → **10,33** |
| `--on-fill / --esp-green-strong` | « Créer un compte » (accueil) | 5,41 → **6,09** | 5,41 → **10,33** |
| `--on-fill / --danger-fill` | danger, enregistrement | 6,98 → **6,46** | 5,62 → **10,14** |
| `--primary-700 / --primary-50` | texte sur la sélection | 12,21 → **8,48** | 15,00 → **8,84** |
| `--ink-400 / --ink-0` | case à cocher ; ligne compacte de notification | **2,33** → **5,52** | **2,41** → **8,18** |

Sur les 170 paires du test (85 × 2 thèmes) : **32 sous le seuil avec l'ancien thème, 0 après**.
Marges les plus faibles après : texte 5,01:1 (secondaire sur creux ivoire, clair) ; non-textuel
3,68:1 (contour de champ sur creux ivoire, clair). Informatif, hors seuil asserté : survol shadcn
`bg-primary/90` 6,17 (clair) / 8,30 (sombre) ; bouton plein désactivé (opacité 50 %) 1,68 —
exempté par WCAG (commande inactive).

## 5. Tests (commandes exécutées, résultats)

| Commande | Résultat |
|---|---|
| `bun run --cwd packages/ui test -- antsia-palette themes-isolation` | 2 fichiers, **214 tests verts** |
| `bun run --cwd packages/ui test` (paquet entier) | 13 fichiers, **302 tests verts** |
| `bunx vitest run --config tests/vitest.config.ts tests/ratchets/{theme-contract,no-hardcoded-colors,provenance-headers,no-hardcoded-urls}.test.ts` | 4 fichiers, **9 tests verts** |
| `bunx tsgo --noEmit -p packages/ui/tsconfig.json` | sortie 0 |
| `bun run --cwd packages/ui lint` | 0 erreur ; 6 avertissements **préexistants** (`card.tsx`, `EspaceDialog.tsx`, `EspaceDossierTabs.tsx`, `use-modal-a11y.ts`) ; `eslint` sur les 3 fichiers du lot : sortie 0 |

Pas de `bun run codegen` ni `verify` (interdits au lot ; aucun fichier Convex touché).

Ce que les tests prouvent :
- `antsia-palette.test.ts` : palette 03 §2 portée par **chaque famille** sur `<html>` et dans un
  portail ; 67 paires texte ≥ 4,5:1 et 18 non textuelles ≥ 3:1 par thème ; titre de couverture
  sur chaque arrêt du dégradé ; libellés de la barre basse translucide composée sur le fond ;
  portail ≡ `<html>` pour **tous** les jetons ; **aucun bleu** résolu hors tons catégoriels (avec
  test du test : la base sans thème est bleue) ; le bloc sombre redéclare chaque rôle du bloc
  sombre de la base sauf la liste d'héritages (égalité stricte, aucun héritage périmé) ; blocs sans
  recouvrement ; hiérarchie des surfaces (fond > carte en clair, fond < carte < surface élevée et
  sélection en sombre) ; voile = encre 55 % ; rayons 12/16 px ; aucune police, `@import`, `url(` ni
  `prefers-color-scheme` ajoutés.
- `themes-isolation.test.ts` : la console (`data-charte="admin-antsia"`, thème vide → charte de
  base pure, clair et sombre) garde **chaque** jeton résolu, figé au lot dans
  `tests/fixtures/charte-base-resolved.json` (253 jetons × 2 ; un ajout au contrat reste permis) ;
  DIASPORALE et la console résolvent à l'identique avec ou sans `antsia.css` chargé avant ou après
  leur thème (<html> et portail, clair et sombre) ; tests du test (règle non scopée détectée,
  valeur de base modifiée détectée).
- Vérification ponctuelle (scratchpad) : jetons résolus DIASPORALE et console **identiques avant
  et après P01** (253 jetons, 4 nœuds chacun). `charte.css`, `communication.css`, `theme.css`,
  `admin-antsia.css`, `diasporale.css` : non modifiés (`git diff` vide pour `styles/` ;
  `diasporale.css` identique octet pour octet à son état au début du lot, modifications de la
  session DIASPORALE préservées).

Le thème DIASPORALE n'est **pas** figé : sa session l'édite en parallèle ; seul l'effet nul
d'ANTSIA sur lui est asserté. Le gel de la base garde aussi la part dont il hérite.

## 6. Source

- Base : `codex/pa4-identite-session`, HEAD `9eaff40` (inchangé), arbre partagé.
- Fichiers du lot :
  - modifié : `packages/ui/src/themes/antsia.css` (+241/−11 par rapport à HEAD ; la modification
    non commitée du propriétaire y est intégrée) ;
  - créés : `packages/ui/src/tests/css-token-cascade.ts` (cascade et contrastes, outil de test,
    dossier `tests/` exclu des cliquets comme `social-features/src/tests/`),
    `packages/ui/src/tests/fixtures/charte-base-resolved.json`,
    `packages/ui/src/themes/antsia-palette.test.ts`, `packages/ui/src/themes/themes-isolation.test.ts`,
    ce rapport.
- Aucun autre fichier écrit. À committer par chemins (`git commit -- <chemins>`), fixture JSON
  comprise.

## 7. Demandes au coordinateur (hors réservation, non éditées)

| # | Fichier:ligne | Constat | Correction proposée |
|---|---|---|---|
| D1 | `packages/social-features/src/shell/ReseauAgentPage.tsx:131` ; `packages/ui/src/styles/communication.css:31` | `.rp-scope` redéclare `--rp-surface-radius: 18px` ; le jeton n'est pas au contrat → les cartes du fil restent à 18 px | Retirer la ligne 131 ; déclarer `--rp-surface-radius: 18px` dans `charte.css` (défaut identique) ; puis `--rp-surface-radius: 12px` dans `antsia.css` |
| D2 | `packages/ui/src/components/form.tsx:119`, `:269` ; `button.tsx:43` | `borderRadius: 6` en ligne : champs ui-v2 à 6 px (03 §3 : 12 px) | Nouveau jeton de contrat `--ui2-field-radius` (défaut `6px`, rendu inchangé ailleurs) lu par `INPUT_BASE` ; ANTSIA `12px` |
| D3 | `packages/ui/src/espace-kit/espace-kit-styles.tsx:335` ; `packages/social-features/src/features/reseau-personnel/PostOverflowMenu.tsx:263` ; `CommentsSurface.tsx:86` ; `shell/floating-card/EspaceFloatingCard.tsx:76` ; `shell/mobile/PostComposerSheet.tsx:200` ; `features/reseau-personnel/ReportContentDialog.tsx:60` | Dialogues, menu « … », feuille de commentaires, cartes flottantes peints en carte (`--esp-surface-card`, `--ink-0`, `--card`) ou en fond (`--background`) : beige au lieu de blanc en clair, `#202026`/`#141419` au lieu de `#2A2A33` en sombre | Lire `var(--popover)` (surface élevée du contrat). Pour ne rien changer à DIASPORALE : jeton `--esp-surface-raised` au contrat, défaut `var(--esp-surface-card, var(--secondary))`, ANTSIA `var(--popover)` |
| D4 | `packages/ui/src/styles/theme.css:100` ; `packages/ui/src/sheet/sheet-button.tsx:11` | Anneau par défaut `outline-ring/50` et `ring-ring/50` : 2,41:1 sur la carte claire (< 3:1) ; 3,28:1 en sombre | `outline-ring` et `ring-ring` pleins (amélioration pour tous les consommateurs) |
| D5 | `packages/ui/src/styles/theme.css:135-141` | Liens sans soulignement : lien/texte 2,13:1 (clair), 1,68:1 (sombre) < 3:1 (WCAG 1.4.1) | Souligner les liens de texte courant (texte riche, mentions) ; garder la règle actuelle pour la navigation |
| D6 | `apps/antsia_ga/src/components/providers.tsx:39` | Toasts sonner : variables posées sur `[data-sonner-toaster][data-sonner-theme]` (0,2,0), palette sonner (blanc/noir, verts et rouges propres), pas la charte | Dans `apps/antsia_ga/src/app/globals.css` : `[data-charte="antsia"] [data-sonner-toaster][data-sonner-theme] { --normal-bg: var(--popover); --normal-text: var(--popover-foreground); --normal-border: var(--border); --success-bg: var(--success-50); --success-text: var(--success-600); --success-border: var(--success-500); --error-bg: var(--danger-50); --error-text: var(--danger-700); --error-border: var(--danger-500); --info-bg: var(--primary-50); --info-text: var(--primary-700); --info-border: var(--primary-300); }` (0,3,0, aucune couleur littérale ; paires déjà ≥ 4,5:1 au test) |
| D7 | `packages/ui/src/styles.css:14` ; `charte.css:432-433` ; `package.json:29` | Aucune police Inter chargée (`@fontsource-variable/inter` au catalogue, importée nulle part) ; `--font-familjen-grotesk` jamais défini et la face chargée s'appelle « Familjen Grotesk Variable » : corps **et** titres rendus probablement en `system-ui` | Décision propriétaire ; si Inter : dépendance + `@import` de `@fontsource-variable/inter` (paquet local, pas de police distante) et `"Inter Variable"` en tête de `--font-sans` |
| D8 | `packages/ui/src/styles/theme.css:106` | Corps à 15 px (03 §3 : 16 px) | Jeton de contrat `--font-size-body` (défaut 15 px) lu par `theme.css`, ANTSIA 16 px |
| D9 | `apps/antsia_ga/src/components/sign-in-screen.tsx:66` | « Créer un compte » en aplat vert (`--esp-green-strong`) : seconde couleur d'action. Jeton rendu sûr dans les deux thèmes (10,33:1 en sombre, 4,08 auparavant pour le bouton de succès) | `--primary-fill`/`--on-fill` si c'est une action (décision produit) |
| D10 | `apps/antsia_ga/src/components/public/public-post-card.tsx:16` | Avatar `rounded-xl` (désormais 12 px) au lieu de rond (03 §3) | `rounded-full` (P03) |
| D11 | `packages/ui/src/styles/communication.css:24-28` | Ombres `--shadow-*` teintées bleu nuit (5–16 %), hors contrat | Facultatif : passer au contrat avec défauts identiques |
| D12 | `packages/social-features/src/shell/appearance/provider.tsx:76-79` | `.dark` posé après hydratation : bref flash clair au rechargement en préférence sombre | Script inline avant peinture dans `layout.tsx` (même clé `antsia:antsia:appearance`, même `matchMedia`) — changement d'infrastructure, lot dédié |

## 8. Recette navigateur à faire (coordinateur)

Non faite par l'agent. Serveur existant `http://localhost:3030`, compte de développement membre.
Thèmes : **Système, Clair, Sombre** (contrôle d'apparence de la coque) ; largeurs **375×812,
393×852, 1280×800**, puis **320 px** et **zoom 200 %** à 1280.

1. `/fil` : fond blanc / charbon, cartes beige / `#202026` sur fil, rails et iCom ; méta en gris
   lisible ; liens et réactions actives en prune ; menu « … » d'une carte (surface — écart D3
   attendu) ; feuille de commentaires ; onglet actif de la barre basse (pastille `--accent`).
2. `/profil/<identifiant>` et `/@<identifiant>` (public) : couverture de repli prune, cartes,
   boutons pleins et outline (repos, survol, pression, désactivé), anneau de focus au clavier
   (Tab) visible 2 px détaché, non masqué par les barres fixes.
3. `/messages` : bulle envoyée (prune + texte blanc / rose + encre), bulle reçue, champ du
   composeur (contour ≥ 3:1), recherche, filtre sélectionné, pastille de non-lus, enregistrement
   vocal (aplat danger).
4. Formulaires : `/entrer` (champs, erreurs, bouton vert D9), `/parametres`, composeur de
   publication (feuille mobile) : contours, `aria-invalid`, message d'erreur, toast de succès
   (écart D6 attendu).
5. Feuille et dialogues : menu mobile, signalement d'un contenu, dialogue du kit (écart D3).
6. Mesures dans les outils du navigateur : `getComputedStyle(document.documentElement)` pour
   `--background`, `--card`, `--primary`, `--ring` en clair/sombre ; même lecture dans un portail
   (dock iCom) ; `color-scheme` de `<html>` ; police calculée du corps et des titres (D7) ; anneau
   par défaut d'un élément sans style de focus (D4).
7. Bascule de thème pendant : un appel en cours (si LiveKit), un brouillon de publication et de
   message, une session ouverte — rien ne doit se remonter ni se perdre.
8. Non-régression visuelle : DIASPORALE `http://localhost:3031` clair/sombre et console (si
   lancée) identiques aux captures antérieures.

## 9. Dépendances

Aucune pour le code livré. Décisions attendues : D3 (surface élevée, portée DIASPORALE), D7
(police), D8 (corps 16 px), D9 (couleur du bouton d'inscription). P02 (navigation) et P03 lisent
ces jetons ; D1/D3/D10 touchent leurs fichiers.

## 10. Retour arrière

Rétablir `packages/ui/src/themes/antsia.css` à son état d'ouverture du lot — **pas** à HEAD, qui
est la charte PA8 bleu/parchemin sans la demande fond blanc/cartes beige — et retirer
`antsia-palette.test.ts`. Le test d'isolation et sa fixture peuvent rester (indépendants du thème).
Aucune donnée, session ni état à reprendre. État d'ouverture (bloc unique, en-tête de commentaire
omis) :

```css
[data-charte="antsia"] {
  --background: var(--esp-neutral-0);
  --background-dashboard: var(--esp-neutral-0);
  --foreground: var(--esp-neutral-800);
  --card: var(--esp-neutral-100);
  --card-foreground: var(--esp-neutral-800);
  --esp-surface-card: var(--esp-neutral-100);
  --secondary: var(--esp-neutral-100);
  --ink-0: var(--esp-neutral-100);
  --ink-100: var(--esp-neutral-0);
  --primary: var(--esp-blue-600);
  --primary-foreground: var(--esp-neutral-0);
  --font-sans: "Inter", system-ui, sans-serif;
  --font-display: var(--font-familjen-grotesk, "Familjen Grotesk"), "Inter", system-ui, sans-serif;
}
```

## 11. Limites

- Contrastes **calculés** sur jetons résolus : pas de mesure du rendu (anticrénelage, opacités
  composées par les composants, texte sur photo/vidéo, `color-mix(in oklab)` des utilitaires
  Tailwind approché en sRGB pour les survols informatifs).
- Le modèle de cascade lit les règles hors `@media`/`@layer` (bureau, sans préférence de
  mouvement) ; les blocs `@media (max-width: 1023px)` de la base ne portent que des dimensions.
- Les composants qui codent leurs valeurs (rayon 18 px du fil, 6 px des champs ui-v2, surfaces
  élevées, toasts) ne suivent pas encore la charte : §7.
- Aucune capture, aucune recette appareil, aucune preuve d'absence de remontage au changement de
  thème (le lot ne touche que du CSS : le mécanisme ne change pas, l'effet reste à observer).
- La sélection claire (`--primary-50`) ne se détache de la carte qu'à 1,11:1 : l'état choisi doit
  aussi se lire par la graisse, l'icône ou le texte (03 §3), à contrôler en recette.

---

# P01b — Jetons de base, toasts, police d'affichage et ombres

18 octobre 2026, même agent, sur demande du coordinateur après sa recette à 1280 px (jetons
rendus conformes à la palette ; seule « DM Mono » chargée, D7 confirmée). Verdicts : **présent
dans le code** — oui ; **testé automatiquement** — oui ; **observé en recette** — non (§P8) ;
**publié** — non.

## P1. Résultat

| Demande | Traitement | Preuve |
|---|---|---|
| D4 anneau de base | Jeton de contrat `--outline-ring` (charte, bloc clair) = `color-mix(in oklab, var(--ring) 50%, transparent)`, exactement l'ancien `outline-ring/50` ; `theme.css` lit `outline-color: var(--outline-ring)`. ANTSIA : `var(--ring)`, anneau plein | Feuille servie (:3030) : `[data-charte] { --outline-ring: var(--ring) }` + `@supports (color: color-mix(…)) { … 50 % }` — même repli plein et même 50 % que l'utilitaire compilé auparavant |
| D8 corps | `--body-font-size: 15px` (contrat) ; `theme.css` : `font-size: var(--body-font-size, 15px)` ; ANTSIA 16 px | Gel console : 15 px ; test ANTSIA : 16 px dans les deux thèmes |
| D6 toasts | Règle `[data-charte="antsia"] [data-sonner-toaster][data-sonner-theme]` (0,3,0 > 0,2,0 de sonner) dans `apps/antsia_ga/src/app/globals.css`, 17 variables, jetons du contrat seulement | Test : toutes les variables de thème de sonner 2.0.7 couvertes, aucun littéral, contrastes |
| D7a titres | `--font-display` d'ANTSIA : `var(--font-familjen-grotesk, "Familjen Grotesk Variable")…` — la face que `@fontsource-variable/familjen-grotesk` déclare et que `styles.css:14` importe. Base intacte (la console garde son rendu) | Test : 1ʳᵉ face = face déclarée par le paquet importé |
| D11 ombres | `--shadow-xs…xl` et `--icom-float-drag-shadow` portées au contrat (bloc clair de la charte) avec EXACTEMENT les valeurs de `communication.css`, qui les redéclare après et l'emporte toujours ; ANTSIA : encre `rgb(31 32 36 / α)`, mêmes géométries et opacités, en clair ; en sombre, les ombres noires de la couche de communication restent | Test d'égalité des deux sources + source gagnante = `communication.css` ; servi : base `#0e1a2b0d`, ANTSIA `#1f20240d` |
| D12 flash | **Non implémenté** : laissé à P18 (§P4) | Expérience jsdom avec le vrai provider |

Hors lot, documentés : **D2** (`form.tsx:119`, `:269`, `button.tsx:43`, rayon 6 px en ligne dans
les primitives) ; **`sheet-button.tsx:11`** (`focus-visible:ring-ring/50`, anneau de 3 px à 50 %) :
2,47:1 sur la feuille en clair, 3,09:1 en sombre — sous 3:1 en clair, primitive non modifiée ;
D1, D3, D5, D9, D10 attribués par le coordinateur à P02/P03/décision produit.

## P2. Inter : lignes exactes à ajouter (coordinateur)

`@fontsource-variable/inter` figure au catalogue (`package.json:29`, 5.3.0) mais n'est ni
déclaré ni installé (absent de `node_modules/.bun`). Pour ANTSIA seulement :

1. `apps/antsia_ga/package.json`, `dependencies` : `"@fontsource-variable/inter": "catalog:",`
2. `bun install` (coordinateur).
3. `apps/antsia_ga/src/app/globals.css`, après la ligne 3 : `@import "@fontsource-variable/inter";`
4. `packages/ui/src/themes/antsia.css`, bloc clair : `--font-sans: "Inter Variable", "Inter", system-ui, sans-serif;`
   (nom de face des paquets `@fontsource-variable`, comme « Familjen Grotesk Variable » ; à
   confirmer dans le `index.css` installé). La CSP admet déjà `font-src 'self'`.

## P3. Ratios calculés (jetons résolus)

| Paire | Clair | Sombre |
|---|---:|---:|
| Anneau de base ANTSIA (`--outline-ring`) / carte · fond | 7,06 · 7,63 | 8,93 · 10,11 |
| Anneau de base de la charte (50 %) / carte, pour mémoire | 2,41 | 3,28 |
| Toast ordinaire : texte / fond | 16,27 | 13,14 |
| Bouton d'action d'un toast (inversé) | 16,27 | 13,14 |
| Fermeture survolée : texte / `--normal-bg-hover` | 13,53 | 11,13 |
| Toast de succès | 6,89 | 8,50 |
| Toast d'information | 8,48 | 8,84 |
| Toast d'avertissement (ambre de la base) | 4,88 | 9,10 |
| Toast d'erreur | 9,25 | 10,08 |
| Description de sonner (`#3f3f3f` / `hsl(0 0% 91%)`) sur le fond du toast | 10,53 | 11,61 |

## P4. D12 — évaluation du flash de thème (laissé à P18)

- **CSP** : aujourd'hui `script-src 'self' 'unsafe-inline' 'unsafe-eval'` (dev, en-tête observé
  sur :3030 ; `packages/api/csp.mjs`, pas de middleware ni de proxy) : un script en ligne passerait.
  Mais `csp.mjs` annonce la CSP à jeton (nonce par requête, EXT-AN-02, PA8/PA10) : le script devra
  alors porter le nonce.
- **Blocage constaté** : le provider (`shell/appearance/provider.tsx:40-79`) rend d'abord
  `mode="system"`, `systemDark=false`, donc `"light"`, et son effet retire `.dark` au montage.
  Expérience jsdom avec le provider réel, `.dark` posé avant montage (ce que ferait un script de
  démarrage) et préférence `"dark"` enregistrée : mutations de `<html>` =
  `class=""`, `color-scheme: light`, puis `class=dark`, `color-scheme: dark`. Un script seul
  transformerait le basculement clair→sombre en sombre→clair→sombre. La correction exige donc une
  modification du provider, interdite dans ce lot.
- **Correction proposée pour P18** :
  1. `apps/antsia_ga/src/app/layout.tsx`, premier enfant de `<body>` (ou `<head>`) :
     `<script dangerouslySetInnerHTML={{ __html: APPEARANCE_BOOT }} />` avec
     `(function(){var m="system";try{var s=localStorage.getItem("antsia:antsia:appearance");if(s==="light"||s==="dark"||s==="system")m=s}catch(e){}var d=false;try{d=matchMedia("(prefers-color-scheme: dark)").matches}catch(e){}var r=m==="system"?(d?"dark":"light"):m;var h=document.documentElement;h.classList.toggle("dark",r==="dark");h.style.colorScheme=r})()`
     — même clé (`storagePrefix` de `providers.tsx:70` + `appearance`) et même logique que
     `readPreference` et l'effet du provider ; `<html suppressHydrationWarning>` existe déjà
     (`layout.tsx:32`).
  2. Provider : ne pas appliquer la classe avant la première lecture du stockage (drapeau posé par
     l'effet de montage), et exporter la construction de la clé pour éviter deux sources.
  3. Tests : parité script/provider (valeurs `light`/`dark`/`system`/invalide/absente × système
     clair/sombre × stockage refusé), aucune mutation de `.dark` au montage quand le script a déjà
     posé la bonne valeur ; console du navigateur sans avertissement d'hydratation ; nonce quand la
     CSP à jeton arrive.

## P5. Tests (exécutés, chiffrés)

| Commande | Résultat |
|---|---|
| `bun run --cwd packages/ui test -- antsia-palette themes-isolation antsia-toasts` | 3 fichiers, **246 tests verts** |
| `bun run --cwd packages/ui test` | 14 fichiers, **334 tests verts** |
| `bunx vitest run --config tests/vitest.config.ts tests/ratchets/{theme-contract,no-hardcoded-colors,no-hardcoded-urls,provenance-headers}.test.ts` | 4 fichiers, **9 tests verts** |
| `bunx tsgo --noEmit -p packages/ui/tsconfig.json` ; `apps/antsia_ga` (`tsgo --noEmit -p tsconfig.json`) | sortie 0 ; sortie 0 |
| `eslint` `packages/ui` | 0 erreur, 6 avertissements préexistants ; fichiers du lot : sortie 0 |
| `eslint .` `apps/antsia_ga` | 0 erreur, 8 avertissements préexistants (`moderation-forms*`, `notification-controls.tsx`) |
| DIASPORALE `bunx vitest run src/styles/engine-theme-contrast.test.ts` (lecture seule, il relit `charte.css`) | **139 tests verts** |

Nouveaux contrôles : anneau de base plein (3 paires ≥ 3:1 par thème) ; corps 16 px et ligne de
`theme.css` ; face des titres = face importée ; ombres d'ANTSIA à l'encre (géométries et opacités
de la base, ombres noires en sombre) ; garde « aucun bleu » étendue aux couleurs des ombres et
dégradés (test du test : la base porte ses ombres bleu nuit) ; câblage de `theme.css` sur les
jetons ; égalité des ombres charte/communication et source gagnante ; toasts (spécificité,
couverture des 17 variables de sonner, jetons du contrat, 8 paires de contraste et fond = surface
élevée, par thème).

**Non-régression console** : les 253 jetons figés au lot P01, en clair et en sombre, sont
identiques ; le figé ne gagne que `--outline-ring` et `--body-font-size` (valeurs par défaut =
ancien rendu). DIASPORALE et la console : résolution identique avec ou sans le thème ANTSIA.
Aucun jeton ajouté au bloc sombre de la charte (son test de complétude DIASPORALE reste vert).

## P6. Fichiers P01b

- Modifiés : `packages/ui/src/styles/charte.css` (+27/−1 : 8 jetons au bloc clair, en-tête de
  provenance), `packages/ui/src/styles/theme.css` (+6/−3 : règle universelle, corps, en-tête),
  `packages/ui/src/themes/antsia.css`, `apps/antsia_ga/src/app/globals.css` (+26),
  `packages/ui/src/tests/css-token-cascade.ts` (`hsl()`, `colorsIn`),
  `packages/ui/src/tests/fixtures/charte-base-resolved.json` (+2 jetons × 2 thèmes),
  `packages/ui/src/themes/antsia-palette.test.ts`, `packages/ui/src/themes/themes-isolation.test.ts`,
  ce rapport.
- Créé : `packages/ui/src/themes/antsia-toasts.test.ts`.
- Non touchés : `layout.tsx` (D12 non retenu), `communication.css`, primitives, `diasporale.css`.

## P7. Retour arrière

Retirer ensemble les jetons de `charte.css` et leur lecture dans `theme.css` (rétablir
`@apply border-border outline-ring/50;` et `font-size: 15px;`) : `var(--outline-ring)` sans
déclaration rendrait l'outline invalide. Retirer les surcharges d'ANTSIA, la règle sonner de
`globals.css`, les deux jetons ajoutés au figé et `antsia-toasts.test.ts`. Aucune donnée ni
session concernée.

## P8. Recette à faire (coordinateur)

1. Titres : police calculée « Familjen Grotesk Variable » et fichier `woff2` chargé (onglet
   Réseau) sur `/fil`, `/profil/<identifiant>`, `/entrer` ; changement visible assumé (D7a).
2. Corps 16 px : `getComputedStyle(document.body).fontSize` ; reflow 320 px et zoom 200 %.
3. Anneau du navigateur plein sur une commande sans style de focus propre (Tab), clair et sombre.
4. Toasts de succès et d'erreur (ex. enregistrement des préférences, `/parametres`) en clair et
   en sombre ; survol du bouton de fermeture.
5. Ombres des cartes et menus (teinte neutre, subtile).
6. Console et DIASPORALE : corps 15 px, anneau à 50 %, ombres inchangés.
