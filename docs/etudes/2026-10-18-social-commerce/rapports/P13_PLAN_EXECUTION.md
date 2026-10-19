# P13 — Parcours d’achat et suivi privé

État : sources produites, lot partiel sans contrôles ni recette. Demande du 18 octobre 2026 : poursuivre P13 sans relancer les vérifications et préserver les travaux simultanés. Aucun contrôle, service, échange réel, activation financière ou publication n’est autorisé par ce lot. Le bilan obtenu et ses limites figurent dans `P13_ACHAT_ET_SUIVI.md`.

## Découpage et propriété

1. Contrat privé jumeau `commerce-orders.ts`, hors du manifeste P06 gelé ; orchestration et compte rendu : session principale.
2. PRO.GA : projection historique appartenant au sujet acheteur, décisions idempotentes, réception explicite, demandes d’annulation/retour et support privé ; session d’exécution PRO. Tous les fichiers PRO de P12 sont libérés, leurs mécanismes financiers sont conservés.
3. ANTSIA : contexte de panier multi-lignes, récupération d’une préparation par intention, façade privée des achats et transport signé ; session d’exécution backend.
4. ANTSIA : panier mono-vendeur, brouillon de session, parcours existant de préparation/paiement, Mes achats, partage de l’offre et textes fr/en ; session d’exécution interface.

P10, DIASPORALE, les cinq fichiers gelés du pont de session et les changements sans rapport restent hors périmètre. Aucun changement de branche ni commit de l’arbre partagé.

## Autorités et invariants

- Le panier est une intention, la préparation réserve du stock et le paiement appartient à PRO.GA. ANTSIA ne tient aucune seconde comptabilité.
- Les achats sont dérivés des intentions P12 réellement liées à une commande PRO. Propriété contrôlée par réseau/personne puis source/environnement/sujet/boutique/checkout/paiement/commande.
- Lecture et support historiques ne dépendent pas de la publication actuelle de la boutique. Aucune extension des gardes générales P10.
- La commande, le paiement, le stock, le remboursement, la remise et la réception acheteur restent distincts. Une réception explicite peut être enregistrée ; aucun reversement n’est exécuté ou simulé. Les adaptateurs financiers restent fermés.
- Annulation et retour sont des demandes selon capacité. Aucun débit incertain n’est transformé en annulation ni un remboursement demandé en remboursement effectué.
- Toute action privée porte une révision et une clé métier stable. Après un délai dépassé ou une recharge, consulter l’action corrélée avant de la reprendre avec la même clé.

## Contrat privé retenu

Profil HMAC distinct `pro-ga-commerce-order-control-hmac/v1`, contrat `PRO-COMMERCE-ORDER-CONTROL-V1`, scope machine explicite `commerce.order.cancel.request`, durée de demande 60 secondes. Opérations : `read`, `action_status`, `cancel_request`, `receipt_confirm`, `return_request`, `support_message`. Aucun secret navigateur. Les réponses sont corrélées à la demande et à son empreinte ; les décisions métier sont durables au-delà des reçus techniques. La lecture tolère cinquante lignes pour les engagements historiques ; le nouveau panier reste limité à dix. Un ancien mode de remise manquant vaut `unknown`.

La vue contient les références opaques, le vendeur et les lignes figés, frais et total, les états indépendants, les révisions de commande et de paiement, la remise connue, la preuve de réception éventuelle, les demandes après commande, un historique et des messages bornés, et des capacités explicites. Les textes internes et l’adresse ne sont pas exportés par cette vue. Une donnée absente reste inconnue.

## Parcours et conservation

Panier mono-vendeur de dix lignes maximum, quantités bornées, aucune conversion de « Sur devis » ou d’une fourchette en prix payable. Le brouillon est isolé par personne et réseau, validé et expirant dans le stockage de session déjà purgé à la déconnexion. Il conserve les références et intentions ; aucune adresse, autorisation de paiement ou donnée d’authentification. Une adresse reste à ressaisir après recharge.

Hors ligne, le brouillon demeure et les écritures sont suspendues. Au retour, relire les conditions avant tout nouvel engagement. Les intentions déjà envoyées restent séparées des modifications du panier. Le récapitulatif existant reste l’autorité de comparaison et de nouvelle confirmation des prix/frais.

Les pages d’achats restent privées et sans indexation ; seul le lien public d’une offre est partageable. Le support historique utilise l’engagement privé, même après retrait de vitrine.

## Livraison attendue et limites de preuve

Sources branchées et scénarios de tests écrits seulement. Aucune exécution de tests, génération, typage, lint, build, navigateur ou recette sandbox pendant ce travail. Les captures téléphone/bureau, accessibilité, fournisseurs réels, paiement et suivi entre appareils demeurent à prouver ultérieurement sur instruction. Ce document ne vaut pas preuve de fonctionnement.
