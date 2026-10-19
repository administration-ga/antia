# ADR-0022 — Paiement privé et répartition ANTSIA paramétrable

- Statut : proposé ; sources P12, activation et contrôles ouverts.
- Date : 2026-10-18.
- Complète ADR0018/0019/0021 ; P06 demeure inchangé.

ANTSIA reçoit les fonds de la transaction commerciale ; PRO.GA reste autorité des commandes, du stock et des preuves de paiement. Les familles demandées sont mobiles, PayPal et Stripe. Aucun fournisseur ne devient disponible par sa seule présence dans un catalogue : devises, pays, contrat, bénéficiaire, capacités de rapprochement et remboursement sont des conditions fermées.

Un contrat privé jumeau expose les options, une autorisation courte liée aux octets exacts, le statut et la demande de remboursement. Le fingerprint interne lie bénéficiaire, environnement, modes, frais et politique de répartition. La commande P06 `payment.start` ne change pas de schéma. Un retour navigateur, une réponse d’admission ou une approbation de paiement ne constituent pas un règlement.

Les jobs fournisseur reprennent par consultation après délai, avec références et octets stables. La preuve financière déduplique événement et transaction. Deux débits réels restent deux faits comptables, mais donnent une seule commande et une seule consommation de stock. Le succès après expiration du stock peut conduire à une revue et à une demande de remboursement ; il n’invente aucune livraison.

Le propriétaire demande trois modes paramétrables : vendeur90%, vendeur85%, ou contrat vendeur ; il demande aussi le pourcentage retenu par ANTSIA. La retenue est donc représentée en points de base entiers avec préréglages10%/15% et taux personnalisé ; la part vendeur est son complément à100%. La base, l’arrondi, la révision et l’acceptation du vendeur sont figés par transaction. Les parts prévues restent distinctes des fonds effectivement versés.

La confirmation de réception acheteur est le déclencheur métier demandé pour le reversement. En l’absence de sa preuve P13 et du dispositif fournisseur compatible, les fonds restent en attente dans le modèle : aucun paiement ou reversement n’est exécuté par cette implémentation. La protection commerciale souhaitée ne vaut pas agrément de séquestre ni promesse juridique ajoutée par le code.

Les lectures privées survivent au retrait d’une vitrine sans rouvrir une nouvelle vente. L’effacement retire accès, corps et actions ; il ne commande pas d’annulation financière. Le journal financier et ses anti-rejeux sont séparés des reçus techniques courts. La durée de conservation financière et le dispositif réglementaire restent à arrêter.

Conséquences : politiques supplémentaires et rapprochement durable, absence de nouvelles ventes sans consentement/configuration exacts, connecteurs effectifs et recette laissés ouverts. Vérifications différées explicitement par le propriétaire.

Référence : [rapport P12](../etudes/2026-10-18-social-commerce/rapports/P12_PAIEMENT.md).
