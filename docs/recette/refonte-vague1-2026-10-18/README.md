# Refonte ANTSIA — recette de la vague 1 (charte P01/P01b, navigation P02)

18 octobre 2026, coordinateur de l'étude `docs/etudes/2026-10-18-social-commerce/`.
Navigateur intégré de l'application (émulation de largeur et de `prefers-color-scheme`),
`http://localhost:3030`, Next et backend Convex locaux relancés à 14:05 par le coordinateur.
Compte local fictif `@recette.refonte` (« Recette Refonte »), créé pour cette recette par
le parcours normal d'inscription (code de développement affiché localement), adhésion déclarée.
Aucun appareil physique, aucune publication, aucune donnée réelle.

## Constats

| Contrôle | Résultat observé |
|---|---|
| Jetons rendus, sombre, 1280 px | `--background #141419`, `--card #202026`, `--primary #edadd8`, `--foreground #f7f6f2`, `color-scheme: dark`, `.dark` et `data-charte="antsia"` sur `<html>` |
| Clair, 1280 px | Fond blanc, cartes ivoire, actions et onglet actif prune ; rail Fil · Découvrir · Créer · Messages · Profil puis « Dans le réseau » |
| Téléphone 375 × 812, clair et sombre | Barre basse à cinq destinations, en-tête « Réseau » avec recherche et cloche, aucune porte iCom ni bouton flottant |
| Rangée de liens en doublon au téléphone | Constatée avant correction (`avant-correction-375-rangee-doublon.jpg`) ; masquée par le coordinateur en navigation par destinations (`feed-screen.tsx`) ; absente après HMR |
| Créer | Feuille « Créer » : Publication, Actu, Évènement, Conférence, Album ; Échap la ferme et rend le focus au bouton Créer |
| Découvrir (`/explorer`) et Profil (`/moi`) | Pages rendues, destination active dans la barre basse ; aucune collision avec `/decouvrir` public |
| 320 px | `scrollWidth = clientWidth = 320` : aucun défilement horizontal sur `/moi` |
| Typographie (P01b) | Corps 16 px ; titres en « Familjen Grotesk Variable » (police chargée) ; Inter non installée, repli système |
| Focus (P01b) | `--outline-ring` = `#8b2f73` (anneau plein) ; anneau visible et détaché sur la cloche au clavier |

## Captures

- [Bureau 1280, clair](bureau-1280-clair-fil.jpg) — [sombre](bureau-1280-sombre-fil.jpg)
- [Téléphone 375, clair](telephone-375-clair-fil.jpg) — [sombre](telephone-375-sombre-fil.jpg)
- [Créer](telephone-375-clair-creer.jpg) — [Découvrir](telephone-375-clair-decouvrir.jpg) — [Profil](telephone-375-clair-profil.jpg)
- [320 px, focus clavier](telephone-320-clair-profil-focus.jpg)
- [Avant correction : rangée en doublon](avant-correction-375-rangee-doublon.jpg)

La pastille « N » en bas à gauche est l'indicateur de développement de Next, absent en production.

## Hors de cette recette

Contrastes mesurés au rendu par un outil dédié, lecteur d'écran, zoom 200 % réel, appareils
physiques, DIASPORALE sur :3031 (non lancé), console. Les contrastes de P01 sont calculés sur les
jetons (`packages/ui/src/themes/antsia-palette.test.ts`), pas mesurés à l'écran.
