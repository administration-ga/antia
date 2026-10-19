# ADR-0018 : Commerce ANTSIA × PRO.GA — autorité unique, liaison à double preuve, deux contrats

- **Statut** : Proposé. Confirmé par le propriétaire : PRO.GA (« Pro.gram ») est le système de
  gestion. Non validés : fournisseur de paiement et bénéficiaire des fonds, frais et commission,
  conditions de vente, admission des vendeurs, durées de conservation.
- **Date** : 2026-10-18
- **Portée** : lots P06–P15 de l'étude ; complète ADR-0003 (fédération par contrats signés).

## Contexte

ANTSIA doit permettre de découvrir, discuter et acheter ; PRO.GA gère déjà catalogue (prix
`fixed/range/unit/quote` en XAF), variantes, stock et réservations, devis, commandes, factures,
agenda et recrutement. L'inbox ANTSIA authentifie et rend idempotents les messages, mais classe
tout contrat en `dead_letter / unsupported_contract`. PRO.GA n'enregistre aucun adaptateur de
paiement (`convex/modules/payments/adapters.ts`, tableau vide). Aucun SSO IDN n'est configuré
dans PRO.GA. Les deux protocoles diffèrent (enveloppe, signature, références avec `/`).

## Décision

Nous allons :

1. Faire de **PRO.GA l'autorité unique** des offres, variantes, prix, stocks, réservations,
   commandes, paiements rapprochés, devis, agenda et candidatures. ANTSIA conserve des
   **projections publiques** versionnées et des **vues privées de l'acheteur**, jamais un second
   registre comptable. Une modification depuis ANTSIA est une commande vers PRO.GA.
2. Lier un vendeur par une **double preuve** : session ANTSIA vivante + authentification PRO.GA
   réelle, choix explicite d'une structure où le mandat le permet, consentement aux scopes, échange
   serveur d'un code court à usage unique avec preuve de possession. Jamais de liaison par e-mail,
   téléphone ou handle ; un badge n'est pas un mandat de vente.
3. Séparer deux contrats fermés, signés, idempotents et bornés :
   `PRO-COMMERCE-PUBLIC-V1` (reflets publics via l'inbox, DTO allowlistés, tombstones, révision
   métier monotone distincte de la version de transport) et `PRO-COMMERCE-COMMAND-V1` (commandes
   privées vers des routes PRO.GA dédiées, scopes minimaux revalidés à destination).
4. Limiter la V1 à un **panier mono-vendeur en XAF** ; trois machines d'état distinctes
   (commande, paiement, remise) ; « sur devis » et intervalle ne sont jamais payables ; seule une
   confirmation serveur/fournisseur fait passer à « payé ». La capacité « payer » reste fermée tant
   qu'un fournisseur n'est pas choisi, configuré et prouvé en sandbox (SingPay : candidat seulement).
5. Retour arrière par capacité : fermer les nouvelles ventes conserve suivi, annulation,
   remboursement et pièces des engagements existants.

## Conséquences

### Positives

- Aucun conflit de prix/stock entre deux maîtres ; la vente du dernier article reste arbitrée
  par une seule transaction.
- Les échanges sont rejouables et vérifiables (octets persistés, reçus corrélés, DLQ).

### Négatives

- Il faut écrire des producteurs PRO.GA, un adaptateur de transport, un handler ANTSIA et des
  routes privées avant toute vitrine reliée ; la fraîcheur du miroir devient un sujet d'exploitation.
- L'activation commerciale dépend de décisions externes (fournisseur, conditions, admission).

### Neutres

- Les fixtures contractuelles sont copiées octet pour octet dans les deux dépôts, sans dépendance
  d'exécution de l'un vers l'autre.

## Alternatives considérées

### Option A — double maître commerce (catalogue et commandes recréés dans ANTSIA)

Rejetée. Conséquence concrète : deux prix pour la même variante, survente du dernier article
quand les deux bases réservent indépendamment, factures PRO.GA contradictoires avec l'écran ANTSIA.

### Option B — simple lien vers la vitrine PRO.GA

Rejetée comme cible : réduit le raccord initial mais ne satisfait pas « découvrir, discuter et
acheter » dans ANTSIA. Reste un repli si le transport n'est pas prouvé.

### Option C — supposer un SSO existant entre ANTSIA et PRO.GA

Rejetée. Aucun SSO IDN n'est configuré côté PRO.GA ; une liaison sur la seule foi d'une session
ANTSIA permettrait à n'importe quel compte de revendiquer une structure et ses ventes.

## Références

- `docs/etudes/2026-10-18-social-commerce/{06,07,08}_*.md`, prompts P06–P15.
- `docs/contrats/FEDERATION-INBOX-V1.md` ; contrats à créer `docs/contrats/PRO-COMMERCE-*-V1.md` (P06).
