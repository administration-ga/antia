# P01 — Charte claire et sombre

**Dépendance :** P00. **Spécification :** [03](../03_DESIGN_SYSTEM.md). **Ownership :** thème ANTSIA ; contrat commun seulement si nouveaux rôles nécessaires.

```text
Depuis la racine ANTSIA, lis et applique le préambule :
docs/etudes/2026-10-18-social-commerce/prompts/PROMPT_COMMUN.md. Implémente seulement P01 dans les vrais fichiers.

Pars de packages/ui/src/themes/antsia.css et du contrat packages/ui/src/styles/charte.css.
Inventorie les usages des trois familles de jetons : shadcn sémantique, esp-*, ink-*/primary-*.
Applique la palette Encre/ivoire/prune de 03 aux rôles, avec fond blanc et cartes beige en clair.
Ajoute la surcharge sombre ANTSIA à la bonne spécificité, portails compris. Ne modifie pas la
charte DIASPORALE, la console ou les primitives components/ui. Tout nouveau jeton du contrat
possède des valeurs par défaut conservant le rendu des autres consommateurs.

Traite textes secondaires, liens, focus, champs, danger, succès, états actifs et boutons primaires ;
ne te contente pas du fond du body. N'inverse ni les photos ni toute l'échelle ink arbitrairement.
Le choix système/clair/sombre existant reste la seule infrastructure d'apparence.

Vérifie les cliquets theme-contract/no-hardcoded-colors et les contrastes des états rendus.
Recette fil, profil, messages, formulaire et feuille à 375/393/1280 px, clair et sombre, puis
reflow 320 px/zoom 200 %. Changer de thème ne doit remonter ni appel ni brouillon ni session.
Contrôle que les consommateurs DIASPORALE/console conservent leurs valeurs de thème.

Livre le code branché, captures comparables et ratios réellement mesurés. Conserve la distinction
entre les contrastes calculés de l'étude et la recette de l'application. Aucun changement de
navigation ou de comportement de publication dans ce lot.
```

**Acceptation :** palette complète, contraste des contrôles et cohérence des surfaces ; tests pertinents et recette, sans réclamer une nouvelle infrastructure de thèmes.
