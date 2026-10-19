# P12 — Paiement : plan d’exécution

18 octobre 2026. Demande humaine : implémenter P12 en coordination avec PRO.GA, sans vérifications. Les travaux P10/P11 et DIASPORALE restent préservés ; aucun changement de branche, de configuration réelle, de données ou de services.

## Décision de départ

Au départ, le dossier ne choisissait aucun fournisseur ; SingPay y était un candidat. Le propriétaire précise pendant l’implémentation : moyens mobiles, PayPal et Stripe ; ANTSIA collecteur puis redistribution vendeur85%/90%/contrat, les trois paramétrables après réception acheteur ; retenue ANTSIA également paramétrable. Ces choix sont intégrés au registre fermé et aux politiques de répartition, avec préréglages10%/15% et taux personnalisé complémentaire à la part vendeur. Les contraintes officielles de devises/pays/marketplace sont documentées dans le rapport.

Sans contrat marchand, mécanisme officiel de preuve, frais, modes, remboursement et accès sandbox arrêtés, aucun adaptateur concret n’est inventé ni enregistré. Le socle contractuel est raccordé et **P12 reste partiel, payer fermé**. Aucun paiement réel, appel fournisseur, test sandbox ou transaction de recette n’est exécuté.

## Répartition

1. PRO.GA paiements : port de fournisseur et capacités fermées, intention/opérations durables, baux et référence canonique, consultation après résultat incertain, preuves serveur, ledger/déduplication et remboursement/revue. Propriétaire exclusif du module payments et de son domaine pur additionnel.
2. PRO.GA commerce : payment.start, commande commerciale de source explicite sans faux devis/client/auteur, réservation/consommation et succès tardif, statut privé et demande de remboursement. Propriétaire des nouveaux commercePayment*, des raccords orders et stock dédiés ; le coordinateur garde dispatcher, HTTP, agrégats et crons.
3. Contrat privé pur jumeau hors manifeste P06 : options/statut/demande de remboursement, payloads fermés, corrélation, dates et profil HMAC distinct ; tests écrits uniquement.
4. Coordinateur : backend privé ANTSIA et reprise de la même intention, registres et transports partagés, droits/données/rétention, documentation et passation Obsidian.
5. Autre session ANTSIA : uniquement UI P12 dans components/payment, routes privées de suivi/retour, FR/EN et ancres checkout convenues. Contrats gelés par message avant édition ; aucun backend doublé.

## Invariants d’implémentation

- P06 payment.start et request.status restent inchangés. Le statut financier reste privé ; aucun PUBLIC ni retour navigateur n’établit un règlement.
- PRO.GA rejuge source/sujet, liaison et droits vendeurs, montant/devise/bénéficiaire ANTSIA configurés, consentement, politique acceptée et hold. La part prévue n’est pas assimilée à des fonds réellement détenus ou versés.
- Une intention métier par checkout. Après timeout, consultation de la référence initiale ; aucun second débit automatique si l’absence n’est pas prouvée. Le callback est lié à une preuve fournisseur réelle, jamais à un booléen libre fourni au navigateur.
- Succès tardif, stock libéré et doublon constaté sont des états de rapprochement explicites ; aucune livraison automatique. Les engagements et leur suivi subsistent après fermeture du vendeur.
- Un remboursement demandé ne vaut ni autorisation opérateur ni remboursement confirmé. Droits financiers et confirmation humaine restent séparés.
- Consentement, export, effacement, traces sans secrets, rétention et quotas sont raccordés dès ce lot. Les paramètres de navigation n’autorisent aucun statut.

## Preuves et limites

Sources et scénarios écrits seulement. Aucun codegen, test, typecheck, lint, audit automatique, build, navigateur, serveur, installation, commande Convex, transaction, commit, push ou publication. Les opérations internes pourront être exercées plus tard dans le harnais et une vraie sandbox après choix/configuration et reprise humaine des vérifications. Aucun résultat vert ni recette de paiement ne sera annoncé pour cette tranche.
