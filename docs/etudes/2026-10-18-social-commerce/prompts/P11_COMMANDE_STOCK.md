# P11 — Commande canonique et réservation du stock

**Dépendances :** P08, P09. **Spécification :** [08](../08_ARCHITECTURE_INTEGRATION.md), §7. **Ownership :** commandes, stock et commandes HTTP privées PRO.GA ; contrats ANTSIA correspondants.

```text
Depuis la racine ANTSIA, lis et applique
docs/etudes/2026-10-18-social-commerce/prompts/PROMPT_COMMUN.md et les règles PRO.GA. Implémente seulement P11.

Pars des modules orders, quotes, inventory et de leurs modèles réels. Ne détourne pas la caisse
opérateur ni la création depuis devis pour fabriquer une acceptation du client social.
Introduis checkout.prepare pour un sujet acheteur délégué, une structure et une devise XAF.
Relis autorité du vendeur, offre publiée, variante, prix/unité, quantité, mode de remise et frais.
Le prix fourni par le client n'est jamais autoritaire. Montants en représentation monétaire
canonique/entiers à unité minimale selon la devise ; pas d'arrondi flottant implicite.

Réserve le stock dans une transaction atomique, avec établissement, référence, expiration et
idempotence. Ajoute aux lignes les liens offre/variante/article nécessaires, plus snapshot immuable
des conditions acceptées. Une seconde demande identique retourne le même résultat ; une autre
charge avec la même clé est un conflit. Réserve et libère selon transitions explicites.

Le récapitulatif indique montant total et expiration. Changement de prix ou disponibilité exige
une reconfirmation ; pas de commande silencieusement modifiée. Distingue commande, paiement et
livraison. Le paiement est P12, aucune transition payé artificielle ici. Les événements de commande
doivent être réellement émis et les vues privées limitées au sujet acheteur ou au mandataire.

Tests de concurrence du dernier article, expiration/reprise, requête perdue après création,
double clic, mauvais acheteur, vendeur suspendu, variante retirée, prix changé, quantité invalide,
double libération et callback futur tardif. Une requête de statut après timeout retrouve le résultat.
Vérifier compatibilité des commandes historiques et des opérations de caisse existantes.

Livre recette de préparation et réservation avec stock réel de sandbox, historique/audit et
reprise après interruption. Pas d'encaissement réel, pas de données de production.
```

**Acceptation :** aucun sur-stock vendu ni doublon de commande ; préparation observable et expirations fiables ; prix et quantités sous une seule autorité.
