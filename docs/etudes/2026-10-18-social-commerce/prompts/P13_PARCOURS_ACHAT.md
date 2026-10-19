# P13 — Achat et suivi dans ANTSIA

**Dépendances :** P09, P10, P11, P12. **Ownership :** écrans ANTSIA, contrats de commandes et projections privées ; aucune seconde comptabilité.

```text
Depuis la racine ANTSIA, lis et applique le préambule :
docs/etudes/2026-10-18-social-commerce/prompts/PROMPT_COMMUN.md. Implémente seulement P13 avec les contrats réellement disponibles.

Monte le parcours fiche produit, variante/quantité, panier mono-vendeur, remise/adresse choisie,
préparation PRO.GA, récapitulatif total, autorisation du paiement, vérification et suivi. Les modes
range/unit/quote conservent leur sens ; Sur devis ne devient pas un montant payable arbitraire.
L'interface montre vendeur, monnaie, frais, délai, conditions et expiration avant engagement.

Appelle les commandes privées côté serveur ANTSIA, avec sujet/portée corrects. Aucun secret ou
token PRO.GA dans le navigateur. Changement de prix → comparaison et nouvelle confirmation.
Timeout → état en cours et consultation corrélée, pas nouvelle commande. Le retour du fournisseur
ne montre Payé que lorsque PRO.GA le confirme. Réseau absent → brouillon conservé, action suspendue.

Ajoute Mes achats : état de commande distinct du paiement et de la remise, historique, référence,
contact vendeur, annulation/retour/remboursement selon capacité. Un retrait de boutique n'efface pas
les engagements antérieurs ; appliquer la voie privée de support définie. Ne pas exposer d'autre client.
Le partage d'une offre est possible ; celui d'une commande n'en révèle aucune donnée privée.

Tests de navigation retour, idempotence UI, recharge pendant paiement, refus d'accès autre acheteur,
callback tardif, offre retirée, livraison non disponible et état inconnu. Recette end-to-end sandbox
avec deux variantes, quantité limitée, un refus puis un succès, suivi côté PRO.GA et côté ANTSIA,
annulation/remboursement applicable. Captures téléphone/bureau clair/sombre, clavier et lecteur d'écran.

Livre code réellement branché et preuves du scénario complet. Pas de faux reçu, faux frais ni
bouton payer actif lorsque l'admission vendeur/fournisseur manque. Documente limites de pays/devise
et moyens de paiement réellement configurés, sans les généraliser à tous les vendeurs.
```

**Acceptation :** le visiteur sait à tout moment ce qu'il a demandé, payé et reçu ; les deux systèmes servent le même état canonique.
