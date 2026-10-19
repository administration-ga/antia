# ADR-0019 : Boutique progressive, vitrine publique dédiée et canal commercial distinct

- **Statut** : Proposé. La publication d'une vitrine par un membre seulement déclaré est une
  proposition soumise au propriétaire (décision attendue au lot P07) ; tant qu'elle n'est pas
  validée, le brouillon est livré et la publication déclarée reste fermée.
- **Date** : 2026-10-18
- **Portée** : lots P07, P10, P13–P16 ; complète ADR-0009 (gardes et droits personnels) et
  ADR-0012 (projections publiques), sans les modifier.

## Contexte

Trois règles actuelles empêchent une boutique « ouverte à chacun » : créer une page exige
`verifiee` (`convex/modules/pages/pages.ts:129`) ; la lecture anonyme n'admet que les pages
`official` (`convex/modules/public/access.ts:56`) ; ouvrir un fil personnel exige une relation
acceptée (`convex/modules/messaging/inbox.ts:34`). Ces gardes protègent les institutions, la
vie privée et les personnes contre le démarchage ; elles sont testées et doivent rester.

## Décision

Nous allons :

1. Faire de la boutique une **capacité d'une page sociale** (pas un réseau ni un second profil),
   avec un **brouillon** ouvert au membre déclaré actif par une politique commerciale ciblée.
   `createPage` garde sa règle ; aucune création de page institution/official ni badge auto-attribué.
2. Distinguer **trois autorisations** : préparer (brouillon), publier la vitrine, encaisser.
   Chacune a sa garde serveur, son état et son test ; aucune ne se déduit d'un badge.
3. Exposer une vitrine anonyme par une **projection publique commerciale dédiée** : page active,
   consentement de diffusion publique, audience racine explicite, réseau admis, modération relue,
   médias via la garde des fichiers. La porte des pages officielles reste inchangée.
4. Ouvrir le premier contact par un **canal commercial distinct** de la messagerie personnelle :
   demandeur, boutique, offre facultative, équipe autorisée à mandat vivant, état
   demandée/acceptée/refusée/bloquée, quotas par membre et par boutique ; avant acceptation,
   demande bornée sans appel ni pièces en série. La garde de relation des fils personnels reste.
5. Transmettre une demande à PRO.GA comme prospect **uniquement sur consentement explicite**,
   avec le texte et les coordonnées choisis ; jamais le fil entier ni le graphe social.
6. Étendre dès chaque lot les limites de débit, la modération, l'export et l'effacement aux
   nouvelles entités ; le lot P16 revoit l'ensemble sans reporter ces gardes.

## Conséquences

### Positives

- Un artisan prépare sa vitrine sans être vérifié ni posséder PRO.GA ; les institutions et les
  conversations privées gardent leur protection.

### Négatives

- Deux portes anonymes (pages officielles, vitrines admises) et deux familles de conversations
  à maintenir et à tester.

### Neutres

- Fermer la capacité de vitrine retire les vitrines de la découverte sans effacer les engagements.

## Alternatives considérées

### Option A — retirer la garde `verifiee` de `createPage`

Rejetée : ouvrirait la création de pages de confiance à tout compte et casserait le test
`convex/modules/pages/pages.test.ts` qui protège ce refus.

### Option B — élargir les fils personnels aux inconnus

Rejetée. Conséquence concrète : tout membre pourrait écrire puis appeler n'importe qui ; le
démarchage et le harcèlement des vendeurs deviendraient possibles sans quota ni acceptation.

## Références

- `docs/etudes/2026-10-18-social-commerce/{02,05,06,08}_*.md`, prompts P07, P10, P16.
