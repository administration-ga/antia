# P12 — Parcours privé de paiement ANTSIA

18 octobre 2026. Tranche interface réalisée en coordination avec l'autre session, qui
porte PRO.GA, le protocole privé et le backend ANTSIA. Demande du propriétaire : poursuivre
P12 sans relancer les vérifications et en préservant les sources partagées.

## État source

Interface raccordée aux API `shops/payment` et `shops/paymentActions`, avec types locaux
`PaymentContext`, `PaymentAttempt`, `PaymentActionResult` de `shops/paymentRules` importés
uniquement comme types. **Le lot paiement reste partiel : admission/configuration des
fournisseurs, contrats de bénéficiaire et recette sandbox restent des prérequis à son
activation.** Les décisions métier courantes sont tenues par le coordinateur de l'autre
session ; cette tranche n'en déduit aucune admission technique. L'interface ne crée aucun moyen de paiement,
compte marchand, frais, signature callback ou règlement de démonstration.

- `PaymentCheckoutPanel` est monté dans le suivi d'une préparation P11. Il lit le contexte
  privé et ouvre une relecture des possibilités uniquement sur geste explicite.
- Le formulaire exige montant positif XAF, bénéficiaire, prestataire, modes admis,
  échéance et autorisation de préparation du paiement courants. Consentement versionné
  et décoché ; toute modification des données affichées réinitialise cet accord.
- La demande contient `readinessRef`, `expectedTotal`, version du consentement et clé
  d'intention stable. Aucun bénéficiaire ni URL de paiement n'est librement saisi par le
  navigateur. L'admission finale et la corrélation des options restent côté serveur.
- Une réponse perdue conserve l'intention exacte dans l'écran. La reprise recherche d'abord
  une tentative existante, puis reprend la même demande ; elle ne génère pas une nouvelle clé.
- Les codes de modes admis sont traduits en libellés lisibles : Mobile Money, Airtel Money,
  Moov Money, PayPal ou carte bancaire, avec libellé neutre pour une autre valeur. Ils sont
  affichés seulement si le serveur les propose ; cette traduction n'active aucun connecteur
  et ne prouve pas la disponibilité d'un compte marchand ou d'un moyen dans un pays donné.
- Routes membres `noindex` : `/mes-paiements`, `/mes-paiements/[paymentAttemptId]` et
  `/mes-paiements/[paymentAttemptId]/retour`. Profil ouvre « Mes paiements », avec liste
  privée paginée. L'ensemble utilise le thème et les surfaces existants, FR/EN.

## Confirmation et suites

La page de retour n'accepte aucun résultat de `searchParams`, `location` ou du prestataire
dans l'URL. Elle lit le suivi privé et indique qu'un retour n'est pas une preuve de paiement.
Aucun lancement, reprise ou remboursement automatique n'y est exécuté.

Le statut provient du DTO serveur. Une confirmation financière exige état `succeeded`,
état de paiement corrélé, date d'observation et références de paiement/commande. Une valeur
manquante n'est remplacée ni par zéro, ni par l'heure locale, ni par « payé ».
Commande, réserve de stock et remboursement ont leur propre affichage ; le règlement ne
confirme jamais la remise. Un état signalé à examiner appelle au rapprochement sans déduire
une livraison, un double encaissement ou un remboursement non confirmé.

Décision métier relayée par le coordinateur P12 pendant cette tranche : ANTSIA encaisse,
puis reverse une part au vendeur, avec fournisseurs mobiles, PayPal et Stripe souhaités.
Les parts ANTSIA/vendeur sont paramétrables et le reversement dépend de la confirmation de
réception par l'acheteur. Le détail des taux et préréglages, en cours d'arbitrage pendant
cette tranche, reste dans le rapport global et le contrat vendeur, sans duplication ici.
La politique effective, le solde en attente et l'admission technique sont tenus côté PRO.GA.
Ces décisions ne prouvent ni une réception ni un versement effectif.
L'interface ne calcule pas une commission implicite et ne présente jamais `succeeded` ou
`consumed` comme un reversement vendeur. Une phrase explicite distingue ce reversement du
paiement ; aucun état de versement ni garantie juridique n'est inventé en l'absence de DTO.

L'action prestataire nécessite `requires_action`, le droit courant de contrôler la tentative,
une URL admise côté serveur et une garde syntaxique HTTPS supplémentaire côté interface.
Ouverture explicite, sans redirection automatique, cookie croisé, préchargement, stockage
local de l'URL ni référent envoyé. L'interface n'établit pas elle-même la liste des prestataires
autorisés ; c'est une décision du backend configuré.

Une demande de remboursement exige motif fermé et accord explicite. La révision et la clé
de la demande sont conservées si sa réponse se perd. Le statut est consulté avant sa reprise.
Un résultat inconnu reste en lecture seule pour cette reprise : aucun remboursement n'est
réémis tant que le paiement n'est pas prouvé et l'action encore autorisée par le serveur.
La transmission n'est jamais présentée comme une acceptation ou un remboursement effectué.

Les écrans sont remontés par réseau/personne/tentative. Une lecture refusée ferme l'ancien
DTO ; un refus d'action ferme l'écran d'action. Les réponses tardives après remplacement
d'identité, démontage ou déconnexion ne peuvent provoquer navigation ou réadoption de données.

## Périmètre réservé et fichiers

- Interface neuve : `apps/antsia_ga/src/components/payment/` et locales FR/EN `payment.json`.
- Pages neuves : `apps/antsia_ga/src/app/(membre)/mes-paiements/`.
- Raccords additifs : routes centrales, ressources i18n, entrée Profil et panneau du suivi P11.
  Les textes P11 rappellent que préparer ne déclenche aucun paiement ; l'état `consumed`
  annoncé par le backend dispose d'un libellé neutre et distinct de la livraison.
- Tests de navigation et de frontière P11 adaptés ; scénarios UI écrits sans exécution.
- Aucun fichier backend, contrat pur, registre, configuration PRO.GA ou pont de session
  n'est modifié par cette tranche. Le rapport global P12 et `EXECUTION.md` appartiennent
  au coordinateur de l'autre session ; sa passation décrit la partie serveur séparément.
  Rapport global : [P12_PAIEMENT.md](P12_PAIEMENT.md).

## Preuve et dépendances

Présence et raccord des sources seulement. Aucun test, codegen, typage, lint, audit, build,
navigateur, serveur, commande Convex ou échange de paiement exécuté ici. Aucun secret,
environnement, donnée, commit, push ou publication manipulé.

À établir lors d'une reprise autorisée : génération des références d'API, contrôles sur
sources figées, affichage desktop/téléphone et recette sandbox authentifiée. Le rapprochement
PRO.GA/prestataire, les callbacks, le bénéficiaire, l'idempotence et les remboursements réels
ne sont pas prouvés par une capture ou par les scénarios de l'interface.

Retour arrière : retirer les liens et le panneau ne suffit pas à annuler une transaction.
Fermer l'admission serveur des nouveaux paiements, préserver les intentions et continuer le
suivi/rapprochement des engagements existants sous leurs droits ; aucun effacement de registre.
