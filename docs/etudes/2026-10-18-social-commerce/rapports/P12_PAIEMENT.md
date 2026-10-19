# P12 — Paiement ANTSIA, autorité PRO.GA et répartition vendeur

Date : 18 octobre 2026. **État : implémentation en sources, partielle ; paiement et reversement réels fermés. Vérifications volontairement différées.**

## Décisions du propriétaire

- Prévoir les moyens mobiles, PayPal et Stripe. Ce choix de familles ne vaut ni disponibilité locale, ni contrat marchand, ni connecteur activé.
- ANTSIA reçoit les fonds et porte la protection commerciale de la transaction, puis reverse une part au vendeur.
- Les trois modes sont paramétrables : vendeur90%, vendeur85%, taux par contrat vendeur. La retenue ANTSIA est également paramétrable, avec préréglages10%/15% et taux personnalisé ; les deux parts doivent toujours totaliser100%.
- Le reversement attend la confirmation de réception de l’acheteur. La preuve de réception et le traitement complet des litiges P13 ne sont pas simulés par P12.
- Aucune vérification, transaction de recette, activation, installation, commande Convex, publication ou modification de secret/environnement réel n’a été exécutée.

## Sources raccordées

### ANTSIA

Le panneau du récapitulatif P11, les pages privées `/mes-paiements`, détail et retour utilisent les API `shops/payment` et `shops/paymentActions`. Le retour ne lit aucun statut affirmé par l’URL et ne lance aucun paiement. Les modes affichés sont traduits ; un moyen non offert par le serveur n’est pas présenté comme disponible. Voir [passation UI](P12_INTERFACE_PAIEMENT.md).

Les nouvelles tables `shopPaymentPolicies`, `shopPaymentOptions`, `shopPaymentAttempts` et `shopPaymentRequests` restent privées au réseau et à la personne. L’activation réseau est fermée par défaut et auditée. Les demandes sont liées à une vraie session Better Auth, au checkout, au vendeur et à la configuration courante. L’effacement révoque immédiatement les baux et les actions ; il ne commande aucun remboursement ou reversement.

Le transport borne les corps/réponses, refuse les redirections HTTP, n’envoie aucun cookie et renouvelle uniquement les preuves de transport. Les corps privés expirent après30minutes ; le balayage est borné. Une URL fournisseur n’est actionnable que sur une origine explicitement configurée côté serveur. Aucun instrument de paiement, contact de portefeuille, secret ou identifiant marchand n’est projeté dans le navigateur.

### PRO.GA

Le dispatcher P06 admet `payment.start` et retrouve son résultat durable via `request.status`. La préparation validée devient une commande commerciale réelle sans devis, client ou utilisateur fictif. Les fonctions historiques de paiement manuel sont fermées aux intentions commerce.

Les quatre contrôles privés `options`, `authorize_start`, `status` et `refund_request` utilisent un contrat jumeau distinct du manifeste P06. Un reçu `readinessRef` opaque lie les conditions affichées à la configuration complète du bénéficiaire ; le grant autorise ensuite les octets exacts de la commande. Le bénéficiaire, les taux et les règles ne peuvent changer silencieusement entre consentement et lancement.

Les opérations fournisseur possèdent leurs baux, clés d’idempotence et reprise par consultation après incertitude. Callback, réponse fournisseur et consultation passent par des preuves corrélées : intention, deviseXAF, montant, bénéficiaire et références. Un événement répété ne double pas le journal. Deux débits distincts sont chacun comptabilisés, mais ne consomment pas deux fois le stock : revue et demande de remboursement restent séparées.

Le vendeur peut demander un remboursement ; l’autorisation humaine de déplacer les fonds collectés par ANTSIA appartient à un administrateur plateforme habilité, sous session vivante, révision et audit. La fermeture des nouvelles ventes ne bloque pas ce remboursement historique, qui conserve les preuves et le solde exacts d’origine.

Le règlement prouvé consomme sa réservation une fois. Un succès tardif tente une acquisition atomique du stock disponible ; sinon la commande reste en revue avec remboursement demandé. Aucun succès, consommation de stock ou retour navigateur ne signifie expédition, livraison ou reversement vendeur.

La répartition marketplace distingue fonds retenus, part vendeur prévue et part ANTSIA prévue ; un changement de réglage ne réécrit pas une allocation passée. Les taux, la base et l’arrondi doivent appartenir à une politique acceptée. L’exécution du reversement fournisseur reste fermée.

Le paramétrage réel est branché dans l’administration PRO.GA à `/commerce-payments`, depuis **Intégrations** : retenue ANTSIA10%/15% ou personnalisée de0à100% avec deux décimales maximum, complément vendeur calculé, choix par contrat individuel, arrondi explicite, base de calcul, motif et contrôle de révision. La sauvegarde conserve la politique désactivée et ne lance aucun mouvement financier. Le registre des comptes plateforme et l’acceptation contractuelle restent des portes gardées distinctes.

## Fournisseurs : limites documentées

Le catalogue de capacités est passif ; `PAYMENT_ADAPTERS` et les bindings de callback ne contiennent aucun connecteur concret activé. Le noyau courant exige une configuration non ambiguë par structure/environnement et un binding de callback unique sur la route fixe. La sélection simultanée de plusieurs connecteurs, avec routage de callbacks distinct et accord lié au choix, reste à réaliser avant de proposer tous les moyens à l’acheteur. La présence des quatre familles dans le registre ne démontre aucune couverture d’opérateur.

| Moyen demandé | Condition non remplie par le code seul |
|---|---|
| Mobile Money | Airtel Money et Moov Money sont deux pistes locales documentées. Les contrats marchands et spécifications authentifiées de signature, consultation, idempotence, remboursement et redistribution doivent être obtenus. La couverture de tous les opérateurs n’est pas démontrée. |
| PayPal | XAF absent des devises REST admises ; Gabon indiqué « Send only ». Aucun change, taux ou compte étranger inventé. |
| Stripe | XAF admis sans décimales ; Gabon absent des pays d’ouverture directe. Compte plateforme et dispositif de redistribution compatibles à établir. |

Sources officielles : [PayPal devises](https://developer.paypal.com/api/codes/currency), [PayPal pays vendeurs](https://developer.paypal.com/platforms/seller-onboarding), [Stripe devises](https://docs.stripe.com/currencies), [Stripe pays](https://stripe.com/global), [Airtel API](https://developers.airtel.africa/), [Moov Money Online](https://moovmoney.ga/marchand/moov-money-online-marchand/).

Le modèle d’encaissement plateforme ne crée pas un séquestre agréé. Les [charges et transferts Stripe](https://docs.stripe.com/connect/separate-charges-and-transfers) font porter frais/remboursements/contestations à la plateforme. Le [reversement différé PayPal](https://developer.paypal.com/docs/multiparty/checkout/delayed-disbursement/) exige une approbation partenaire et prévoit sa propre échéance ; il ne prouve pas un blocage indéfini jusqu’à réception. Ces contraintes restent à contractualiser avant ouverture.

## Scénarios écrits, aucun exécuté

Contrats jumeaux et transport, sessions vivantes et tiers, réseau/source/environnement, consentement et bénéficiaire, corps/empreintes/reprises, callbacks répétés ou désordonnés, deux transactions distinctes, stock et succès tardif, demande de remboursement et approbation humaine, rétention/export/effacement et surfaces UI possèdent des scénarios écrits. Les scénarios de politiques de répartition et de retenue complètent ce socle.

Il n’existe aucune preuve nouvelle de génération API, compilation, test, lint, navigateur, service, échange ANTSIA–PRO.GA, signature d’un vrai fournisseur, paiement, remboursement ou reversement. Les références générées seront produites normalement lors de la reprise des contrôles ; elles ne sont pas éditées à la main.

## Suite nécessaire avant activation

1. Contrats et juridiction du bénéficiaire ANTSIA, comptes marchands, admissibilité marketplace et engagements de protection.
2. Politique commerciale explicite : retenue, base de calcul, arrondiFCFA, frais, remboursement, litige et conditions de reversement ; acceptation vendeur versionnée.
3. Connecteurs concrets documentés, secrets saisis par le propriétaire, origines de redirection et webhooks configurés, recette sandbox puis réelle autorisée.
4. Preuve de réception acheteur P13, traitement des litiges et versement idempotent avec rapprochement fournisseur ; aucun versement n’est simulé ici.
5. Génération, vérifications et recette commune quand le propriétaire les redemandera, sur sources figées.

La fermeture des nouveaux paiements doit laisser vivre le rapprochement des engagements existants. Les preuves financières/anti-rejeu PRO.GA ne suivent pas la purge courte des corps techniques ; leur durée juridique reste à arrêter. Aucun commit, push, merge ou déploiement effectué.

Références : [plan d’exécution](P12_PLAN_EXECUTION.md), [P11](P11_COMMANDE_STOCK.md), [ADR0022](../../../adr/0022-paiements-prives-et-repartition-antsia.md), PRO.GA `docs/23_P12_PAIEMENT_ANTSIA.md`.
