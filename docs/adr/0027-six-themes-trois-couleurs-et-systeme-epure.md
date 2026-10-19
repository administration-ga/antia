# ADR-0027 : Six thèmes à trois couleurs, Gaboma par défaut, et système épuré

- **Statut** : Proposé — demandé par le propriétaire le 19/10/2026 (« implémente tous ces design
  et thème […] celui par défaut est le Tricolore que tu vas nommer Gaboma ») ; « accepté » après
  recette.
- **Date** : 2026-10-19
- **Remplace** : ADR-0017 §1 (palette encre, ivoire et prune) et la liste des thèmes de
  l'ADR-0026 (sept thèmes et la charte d'origine). Le mécanisme de l'ADR-0026 (apparence posée
  avant l'affichage, thème enregistré sur le compte) reste en vigueur.
- **État d'exécution** : code dans les sources, tests verts (typages, lint, Convex, `@antsia/ui`,
  `@antsia/social-features`, application, cliquets). Observé dans le navigateur (serveur de
  développement, 19/10/2026) : six thèmes en clair et en sombre, motif de fond, largeur téléphone,
  couleurs par fonction (Se connecter, Suivre, J'aime), barre flottante, retour du thème du compte
  sur un appareil vierge. Verify complet (codegen compris) au code 0 le 19/10/2026, de 11 h 48 à
  11 h 55, sur `ab813ec` et les commits de Sable.

## Contexte

Le 19/10, le propriétaire a comparé trois séries de maquettes de charte. Il a retenu la troisième :
six palettes de trois couleurs, une par famille d'actions, sur des fonds neutres. Il a ensuite fait
revoir le système qui les porte, d'après 21st.dev : un angle propre à chaque élément, aucun contour
quand un élément n'a pas la couleur de la couche sous lui, plus d'air, une barre d'onglets
flottante, un bouton Annuler gris, et des motifs de fond (points, quadrillage, grain, projecteur)
en option, désactivés par défaut.

Il demande que ces six palettes deviennent les thèmes au choix du membre, le Tricolore renommé
« Gaboma » étant le thème par défaut, et qu'elles remplacent les sept thèmes livrés le matin même
ainsi que la Prune d'origine.

Contraintes : `@antsia/ui` et la coque sont partagés avec DIASPORALE, dont le rendu ne doit pas
changer (cliquet `theme-contract`) ; `persons.theme` est validé par une liste fermée avec
`schemaValidation` ; les correctifs d'accessibilité P18b doivent rester verts ; certaines couleurs
retenues (turquoise, mandarine, rose corail) sont claires et portent un texte foncé, alors que le
contrat n'avait qu'un texte commun à tous les aplats (`--on-fill`).

## Décision

Nous allons :

1. **Remplacer les thèmes du membre par six chartes complètes.** Gaboma est la charte du réseau
   elle-même (`antsia.css`, `data-charte="antsia"`) : vert `#007E4D`, safran `#F4BB44` et bleu
   `#2F67B5`, dans l'ordre du drapeau ; c'est le thème par défaut. Les cinq autres sont des chartes
   `antsia-<id>.css` : Soleil (mandarine, azur, coquelicot), Forêt (vert forêt, olive, miel), Corail
   (rose corail, mandarine, lilas), Lagon (turquoise, corail, jaune de Naples) et Électrique (bleu,
   rose, citron vert). La Prune, ancien contenu d'`antsia.css`, et les thèmes Atlantique, Indigo,
   Hibiscus, Encre et Mandarine sont retirés.
2. **Donner à chaque famille d'actions sa couleur** par des jetons de rôle déclarés dans
   `charte.css` à `initial`, avec repli sur l'identité au point d'usage :
   - publier : l'aplat d'identité (`--primary-fill`) ;
   - suivre et écrire : `--role-social-*` (Suivre) et `--role-message-*` (Écrire) ;
   - réagir et participer : `--role-react-*` (J'aime, pastilles de décompte) et `--role-commerce-*`
     (Acheter, Participer).

   L'aplat d'identité reçoit son propre texte (`--primary-fill-on`), et `--primary` reste une encre
   lisible en texte (≥ 4,5:1). L'encre des réactions est une encre d'icône (≥ 3:1) : le libellé
   d'un bouton réagi garde la couleur du texte.

   Écrire se dit en tonal des messages (`--role-message-soft` et `--role-message-ink`), Envoyer à
   l'aplat des messages (`--role-message-fill`), y compris dans les appels et la messagerie
   commerciale (lot ultérieur, 19/10/2026) :
   - sur la scène sombre d'un appel, le fond tonal des cartes n'a pas de sens : « Écrire »
     (pendant l'appel, à la fin d'un appel qui n'a pas abouti) et « Message » / « Refuser avec
     un message » d'un appel entrant prennent l'aplat des messages (`.iappel-ctl[data-tone="message"]`,
     `.iappel-soft-action[data-role="message"]`) ; « Écrire à » du journal d'appels, posé sur
     une carte, reste tonal ;
   - dans antsia.ga, « Poser une question » et l'ouverture d'une conversation commerciale sont en
     tonal (variante `message` du bouton de l'application), « Envoyer la demande » à l'aplat
     (variante `send`). La facture des boutons vit dans `button-class.ts`, hors du module client,
     pour qu'une page serveur (catalogue public) puisse habiller un lien en bouton.

   Chaque site garde en repli son rendu d'origine, survol compris : DIASPORALE et la console ne
   changent pas. Une seule exception, un correctif d'accessibilité (19/10/2026) : la bannière
   d'appel entrant au bureau (`.iappel-banner`) est posée sur une carte, et le rond neutre de la
   scène sombre (encre claire, icône claire) y était blanc sur blanc en mode clair. Dans la
   bannière, ce rond et le repli de « Refuser avec un message » prennent l'encre de la carte
   (`--card-foreground` à 12 %, 18 % au survol) : l'icône dépasse 9:1 dans toutes les chartes,
   au lieu de 1:1 environ en clair. antsia.ga garde l'aplat des messages ; la scène, Décrocher et
   Raccrocher ne changent pas.

   Participer se dit à la couleur du commerce (`--role-commerce-*`, variante `commerce`), sur
   décision du propriétaire du 19/10/2026 : « Je participe » (évènements), « Rejoindre la salle »
   et « Demander la parole » (direct), « Candidater » et « Envoyer ma candidature » (emploi). Le
   filet de ma réaction à un message reste sans contour dans les thèmes ANTSIA : sa teinte
   (`--role-react-soft`) suffit. Dans DIASPORALE, les deux gestes du direct gardent l'aplat
   d'identité en repli ; seul leur filet d'un pixel, de la couleur de l'aplat, devient
   transparent, comme pour « Je participe ».
3. **Porter le système épuré** par des jetons de géométrie et de surface, eux aussi à `initial`
   avec repli sur le rendu historique : DIASPORALE et la console ne changent pas.
   - Un angle par élément : bouton en pilule, badge 6 px, puce 10 px, avatar de page 12 px,
     champ 14 px, média 16 px, bouton Créer 18 px, carte 24 px, barre flottante 28 px.
   - Un contour seulement à couleur égale : `--esp-surface-border` pose un filet quand la carte a la
     couleur du fond (Électrique) et reste transparent sinon. Une publication, sans filet depuis la
     décision du 21/08, reçoit alors un anneau intérieur qui ne déplace rien.
   - Un bouton Annuler en gris plein et des puces sans contour.
   - Un état actif de navigation ou de filtre en pastille tonale (`--esp-tab-active-*`) : barre
     d'onglets, destination du rail de bureau, Liste / Immersion, filtres et onglets d'iCom. Les
     puces de portée du fil sur téléphone gardent l'aplat d'identité. La loupe de recherche du
     fil est un rond gris, comme les icônes de l'en-tête.
   - Une barre d'onglets flottante (fond translucide, ombre légère), avec le bouton Créer en carré
     arrondi plein de 48 px. Son libellé reste son nom accessible.
   - Les champs de saisie gardent leur bordure (WCAG 1.4.11, correctifs P18b).
4. **Exiger de chaque thème des contrastes vérifiés**, en clair et en sombre :
   - encres sur fond, carte et zone atténuée ;
   - texte sur chaque aplat ;
   - champs à 3:1 ;
   - icônes de réaction à 3:1.

   Les aplats clairs (turquoise, mandarine, safran…) ne tiennent pas 3:1 contre la carte. Or un
   bouton plein se reconnaît à son libellé, lisible à ≥ 4,5:1 sur son aplat : la limite d'un bouton
   plein contre la carte n'est donc exigée que de Gaboma. Les valeurs livrées (encres, aplats,
   nuanciers, angles) sont figées par `antsia-themes.test.ts` et `antsia-palette.test.ts`.
5. **Garder en base les anciens identifiants** (`antsia`, `atlantique`, `indigo`, `hibiscus`,
   `encre`, `mandarine`). Le validateur de la table les accepte, l'écriture les refuse, et la
   lecture les projette vers Gaboma (`memberThemeOf`). `foret` et `lagon` gardent leur identifiant,
   avec le nouveau rendu.
6. **Ajouter un réglage « Motif de fond »**, propre à l'appareil comme le mode sombre :
   - aucun motif par défaut ; au choix : points, quadrillage, grain, projecteur ;
   - le motif est posé par `data-motif` sur `<html>` dès le script d'amorçage, donc avant
     l'affichage ;
   - il est peint sur le fond de la page, jamais sur les cartes.
7. **Appliquer les chartes à la lettre** (avenant du 19/10/2026 au soir, demandé par le propriétaire :
   « applique les sept chartes dans le code »). Une mesure dans l'application avait montré 341
   couleurs sur 392 identiques aux maquettes, 27 écarts nets (tous sur Valider et Supprimer) et une
   police de texte jamais chargée :
   - **Valider et Supprimer deviennent deux fonctions** comme les autres : `--role-success-*` et
     `--role-danger-*` (aplat, texte sur l'aplat, encre), à `initial` dans la base et déclarés par
     les sept thèmes aux valeurs des chartes. Dans ces thèmes, `--success` et `--destructive` se
     lisent en encre (messages de confirmation et d'erreur), `--success-fill` et `--danger-fill` en
     aplat. Les boutons Valider et Supprimer, Décrocher, Reprendre, Raccrocher, Refuser et la
     pastille « En direct » lisent l'aplat et le texte de leur fonction ; l'erreur et l'astérisque
     d'un champ, l'encre. Avant, en sombre, le texte d'un bouton Supprimer prenait le vert foncé du
     succès (`--on-fill` commun). DIASPORALE et la console ne changent pas (replis d'origine).
   - **Inter est embarquée** (`@fontsource-variable/inter`, importée par `styles.css` comme
     Familjen Grotesk) : le texte courant s'affichait dans la police du système.
   - **Valeurs exactes des chartes** partout où le contrôle AA les accepte : 385 sur 392. Les sept
     autres (encres d'identité de Forêt et de Lagon, contours de champ de Gaboma, Corail et Lagon,
     tous trop faibles sur le creux) gardent la valeur du code ; la liste est dans
     `docs/22_THEMES_ET_OPTIONS_ANTSIA.md`. Le creux du fond Lin (Forêt, `#ECE6DB`) entre tel quel :
     le seuil de neutralité des fonds passe de 0,06 à 0,07.
   - **Gardés par décision du propriétaire** : cibles de 44 px, contour des champs (§3) et motif de
     fond commun aux thèmes (§6).
   - **Aplats d'identité et leur texte** (même soir, second lot) : une douzaine de sites peignaient
     l'aplat d'identité avec le texte commun `--on-fill`, blanc en clair (1,9:1 sur le turquoise
     de Lagon, 2,6:1 sur la mandarine de Soleil) : bulles de mes messages, puces de portée du fil,
     bouton principal et pagination du kit, case cochée, interrupteur, groupes de la messagerie,
     stories. Ils lisent `--primary-fill-on` (repli `--on-fill`) ; le bouton d'enregistrement
     vocal, sur l'aplat de danger, `--role-danger-on`. Quatre sites peignaient l'ENCRE en fond
     plein (« Nouvelles publications », « Appeler » et case cochée du lanceur d'appel, photo d'un
     groupe) : ils lisent `--esp-identity-fill` (`initial` dans la base, `--primary-fill` dans
     les thèmes ANTSIA), l'encre d'origine en repli. L'onglet courant de la page iCom et la ligne
     choisie du lanceur passent en pastille tonale (§3). Un test refuse désormais le texte commun
     sur l'aplat d'identité.

## Conséquences

### Positives

- Le membre choisit parmi six thèmes cohérents ; chaque famille d'actions se reconnaît à sa
  couleur, dans tous les thèmes.
- Aucun membre n'est bloqué : un ancien thème enregistré reste valide et s'affiche en Gaboma.
- DIASPORALE et la console gardent leur rendu (jetons à `initial`, replis inchangés).

### Négatives

- Davantage de jetons au contrat, et une couleur par fonction à tester dans chaque thème.
- Certaines surfaces gardent leur traitement historique : carte d'identité du profil (`.pp-identity`,
  fond de page et filet, conforme à la règle), sélecteur Liste / Immersion (encre pleine). Les
  appels et la messagerie commerciale ont adopté les jetons des messages le 19/10/2026, et les
  gestes de participation du direct et de l'emploi la couleur du commerce (§2) ; la messagerie
  contextuelle adoptera les jetons de rôle dans un lot ultérieur.
- Le changement de validateur exige une poussée Convex annoncée (un seul pousseur).

### Neutres

- Retour arrière : remettre l'ancienne liste dans `MEMBER_THEME_IDS` et restaurer les fichiers de
  thème depuis Git ; les anciens identifiants n'ont jamais quitté la base.
- Un septième thème, Sable, suit le même contrat : c'est la charte de DIASPORALE portée dans le
  réseau, ajoutée le 19/10/2026 à la demande du propriétaire (`690b4c6`). Sa charte
  `antsia-sable.css` est générée et contrôlée comme les six autres, et l'identifiant `sable` entre
  dans `MEMBER_THEME_IDS` et `ANTSIA_THEME_IDS`. Gaboma reste le thème par défaut.
- Les maquettes de la troisième série (version 6, 19/10/2026) restent la référence visuelle.

## Alternatives considérées

### Option A — ajouter les six thèmes aux sept existants

Quatorze thèmes au choix, avec des doublons de nom (Forêt, Lagon). Rejetée par le propriétaire.

### Option B — garder la Prune en plus des six thèmes

Rejetée par le propriétaire : Gaboma devient l'identité par défaut.

### Option C — réécrire les anciens identifiants en base

Écartée : la projection à la lecture suffit, sans migration de données, et aucune cible de
déploiement n'existe encore.

### Option D — un contour sur toutes les surfaces

Écartée par le propriétaire (« éviter les contours si les boutons n'ont pas la même couleur que
leur arrière-plan ») : la surface suffit à détacher un élément d'une autre couleur.

### Option E — motifs de fond actifs par défaut

Écartée par le propriétaire : les motifs restent une option, le fond est uni par défaut.

## Références

- ADR-0017 §1 ; ADR-0026 §4 et §5.
- Maquettes de charte, troisième série, version 6 (19/10/2026), et leur système : angles par
  élément, contours à couleur égale, espaces, profondeur, motifs en option.
- `packages/ui/src/styles/charte.css` (jetons du contrat), `packages/ui/src/themes/antsia*.css`,
  `packages/ui/src/themes/antsia-themes.test.ts`, `apps/antsia_ga/src/lib/appearance.ts`.
