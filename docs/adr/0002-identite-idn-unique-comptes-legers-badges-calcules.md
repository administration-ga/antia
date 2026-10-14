# ADR-0002 : Identité — IDN fournisseur unique, comptes légers, attestations externes, badges calculés côté serveur

- **Statut** : Proposé
- **Date** : 2026-10-14

## Contexte

Le moteur sert des personnes qui ne sont pas des agents publics : citoyens au pays, Gabonais de
l'étranger, toute personne (ANTIA est ouvert, arbitrage A3). identite.ga (IDN) est le fournisseur
d'identité unique du programme, déclaré à l'APDPVP ; consulat.ga n'est pas fournisseur OIDC. Le
socle a appris à ses dépens qu'un profil créé d'office depuis une base existante pose problème
(ADR-0080 et 0082 du socle) et que l'identité souveraine IDN prime sur l'e-mail.

## Décision

Nous allons :

- authentifier par **Better Auth du moteur**, seul émetteur des jetons acceptés par Convex
  (`auth.config.ts`) ; IDN y entre par `genericOAuth` + `@idn-ga/better-auth` (PKCE, `/userinfo`,
  `loa`), configuré par variables du déploiement ; à côté, des **comptes légers** par code à usage
  unique (e-mail, SMS), jamais de mot de passe ;
- tenir une **personne unique** (`persons`) et ses **liens d'identité** (`identityLinks` : `idn`,
  `local`, `administration`, `consular_attestation`), un lien par fournisseur et par personne ;
- **calculer** les badges (Officiel · Vérifié · Agent public · Communauté) côté serveur, à chaque
  projection, à partir des liens d'identité et de la nature des pages ; aucun champ déclaratif ne
  les porte (test de schéma) ;
- n'ouvrir aucune adhésion ni aucun profil d'office : la personne entre, choisit son handle et son
  nom affiché (jamais recopié d'un état civil sans geste), consent (consentements horodatés,
  révocables).

## Conséquences

### Positives

- Une même personne, qu'elle entre par antia.ga ou diasporale.com, est UNE personne (même `idnSub`).
- La confiance affichée ne peut pas être usurpée par un champ modifiable.

### Négatives

- Les comptes légers restent « Communauté » : l'élévation vers IDN doit être un parcours soigné.
- Le passage d'une application à l'autre exige `crossDomain` + jeton à usage unique (patron du socle).

### Neutres

- Tant que les clients OIDC `antia` et `diasporale` n'existent pas en sandbox, seule la porte
  « compte léger » fonctionne en développement.

## Alternatives considérées

### Option A — IDN comme second fournisseur direct de Convex

Deux émetteurs donneraient deux `tokenIdentifier` pour la même personne : écartée.

### Option B — consulat.ga comme fournisseur d'identité de DIASPORALE

Second fournisseur hors du cadre déclaré à l'APDPVP, base très sensible : écartée ; consulat.ga
atteste, avec consentement, par un contrat minimal (`DIASPORA-ATTESTATION-V1`).

## Références

- Cahier §6 (portes, statuts, badges), EXF-AN-05 à 09 ; plan §5.
- Socle : ADR-0047a, 0054, 0055, 0080, 0082 ; `socle/convex/betterAuth/auth.ts` (patron).
