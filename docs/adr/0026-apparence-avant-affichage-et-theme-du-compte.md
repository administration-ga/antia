# ADR-0026 : Apparence posée avant l'affichage, thème enregistré sur le compte

- **Statut** : Proposé
- **Date** : 2026-10-19
- **Portée** : Préférences > Thème d'antsia.ga (sept thèmes et la charte d'origine, livrés le
  19/10/2026) et mode sombre ; complète ADR-0010 (préférences de présentation) sans le modifier.
- **Remplacé en partie** : la liste des thèmes (§4, `MEMBER_THEME_IDS`) par l'ADR-0027 (six thèmes,
  Gaboma par défaut) ; le mécanisme reste en vigueur.
- **État d'exécution** : code commis le 19/10/2026 (`209a797`, `dbaf707`). Tests verts : parité de
  l'amorçage et du fournisseur (300 cas), hydratation sans réécriture, synchronisation compte ↔
  appareil, sélecteur, mise en page, préférences Convex, purge de sortie. Observé dans le
  navigateur (serveur de développement) : avant toute hydratation, la page servie s'affiche déjà
  dans le thème et le mode choisis. Retour du thème du compte observé le 19/10, après la poussée
  du backend local : sur un appareil sans thème mémorisé, la page revient dans le thème du compte
  et le remet en cache.

## Contexte

Le membre choisit un thème (Préférences > Thème) et une apparence (Système, Clair, Sombre). Les
deux vivaient dans le `localStorage` de l'appareil (`antsia:antsia:theme`,
`antsia:antsia:appearance`) et le fournisseur d'apparence ne les posait sur `<html>`
(`data-charte`, `.dark`, `color-scheme`) qu'après l'hydratation. Le serveur rend toujours
`data-charte="antsia"` en clair : à chaque chargement, la page s'affichait d'abord en Prune clair,
puis basculait (éclair). Le thème ne suivait pas non plus la personne d'un appareil à l'autre,
contrairement à la langue et au fuseau, déjà enregistrés sur `persons`.

Contrainte de sécurité : la CSP tolère `'unsafe-inline'` au palier PA0 ; la CSP à jeton (nonce par
requête, EXT-AN-02) arrive avec la mise en ligne publique. Toute solution doit y survivre.

## Décision

1. **Un script d'amorçage synchrone ouvre le `<head>` de la mise en page racine.** Il pose la
   charte du thème et le mode sombre avant que le corps ne soit lu, donc avant le premier
   affichage. Son texte est produit par `appearanceBootScript` (moteur,
   `packages/social-features/src/shell/appearance/boot-script.ts`), rejoue exactement la lecture du
   fournisseur (mêmes clés, même repli sur le premier thème, même suivi du système, stockage ou
   API absents tolérés) et ne dépend que de la configuration de l'application, jamais de la requête.
   La configuration est commune au fournisseur et au script (`apps/antsia_ga/src/lib/appearance.ts`).
2. **Le script reçoit le nonce de la requête** quand elle en porte un : la mise en page lit l'en-tête
   `CSP_NONCE_HEADER` (`x-nonce`, `@antsia/api/csp`) que le futur proxy de la CSP à jeton posera.
   Absent aujourd'hui, le script relève de `'unsafe-inline'`. Son texte stable permet aussi de
   l'autoriser par empreinte `'sha256-…'` si une page devait rester statique.
3. **Le fournisseur n'écrit rien sur `<html>` avant d'avoir relu les préférences** (état `ready`) :
   les valeurs neutres du premier rendu, identiques au serveur pour l'hydratation, n'écrasent plus le
   travail du script le temps d'un cadre.
4. **Le thème s'enregistre sur le compte** : `persons.theme`, facultatif, validateur fermé sur le
   contrat `MEMBER_THEME_IDS` (`@antsia/social-contracts/appearance`, liste vérifiée égale à
   `ANTSIA_THEME_IDS` d'`@antsia/ui`). `setMyPreferences` devient partiel : chaque préférence absente
   reste inchangée, un appel vide est refusé, la langue et le fuseau consomment `person.profile`, le
   thème un budget propre `person.theme` (60/h, 20 d'avance), en plus de `person.write`.
   `getMyPerson` rend le thème quand il a été choisi.
5. **En session, le compte fait foi** (`lib/theme-account-sync.ts`) : sa valeur s'applique à
   l'appareil et y reste en cache pour le prochain amorçage. Le choix du membre s'applique tout de
   suite puis s'enregistre, un enregistrement à la fois, le dernier choix l'emportant ; l'écho d'un
   choix dépassé ne le défait pas ; un refus rend le thème du compte et l'annonce. **Hors session**,
   le `localStorage` reste le repli : la sortie partout conserve la clé du thème comme celle de
   l'apparence.

## Conséquences

### Positives

- Plus d'éclair : thème et mode sont posés avant le premier affichage, sur toutes les pages.
- Le thème suit la personne : choisi sur un appareil, retrouvé sur les autres après connexion.
- Prêt pour la CSP à jeton, sans rien changer à la politique actuelle.
- Parcourir les thèmes n'écrit pas chaque clic et n'épuise pas le budget des autres réglages.

### Négatives

- Sur un appareil qui ne connaît pas encore le thème du compte, celui-ci s'applique une fois la
  fiche lue, juste après la connexion (un seul changement, ensuite en cache sur l'appareil).
- Un script en ligne de plus à autoriser quand la CSP à jeton arrivera.
- Le mode sombre reste propre à chaque appareil (choix délibéré : il suit souvent le système).

### Neutres

- Le thème fait partie de la ligne `persons` : il est exporté avec elle et effacé avec elle.
- Aucune copie automatique du thème de l'appareil vers le compte : seul un choix fait en session
  l'enregistre.

## Alternatives considérées

### Option A — cookie et rendu serveur de `data-charte` et `.dark`

Rejetée : le mode « Système » dépend d'une préférence que le serveur ignore (indice client
réservé à Chromium), le cookie voyagerait avec chaque requête et toutes les pages deviendraient
dynamiques pour une préférence de présentation.

### Option B — `next/script` en `beforeInteractive`

Rejetée : dans l'App Router, un script en ligne ainsi déclaré est mis en file
(`self.__next_s`) puis exécuté par l'amorçage de Next, une fois ses paquets chargés : trop tard
pour le premier affichage.

### Option C — empreinte `'sha256-…'` dans la CSP dès maintenant

Rejetée au palier PA0 : en présence d'une empreinte, les navigateurs ignorent `'unsafe-inline'`
et bloqueraient les scripts d'hydratation de Next. Elle reste possible avec la CSP à jeton.

### Option D — une mutation `setMyTheme` séparée

Rejetée : un seul point d'entrée pour les préférences de la personne, comme la langue et le
fuseau ; le budget distinct suffit à séparer les cadences.

### Option E — recopier le thème de l'appareil sur le compte à la première session

Rejetée : aucune écriture sans geste de la personne ; un appareil partagé imposerait le choix d'un
autre.

## Références

- `packages/social-features/src/shell/appearance/{boot-script.ts,provider.tsx}` et leurs tests
  (`boot-script.test.tsx`, `provider*.test.tsx`).
- `apps/antsia_ga/src/app/layout.tsx`, `src/components/{appearance-boot-script,personal-theme,theme-picker}.tsx`,
  `src/lib/{appearance,theme-account-sync}.ts` et leurs tests.
- `convex/modules/people/{tables,persons,preferences}.ts`, `convex/lib/{validators,rateLimit}.ts`,
  `preferences.test.ts`.
- `packages/api/csp.mjs` (`CSP_NONCE_HEADER`), `packages/api/src/sign-out-everywhere.ts`.
