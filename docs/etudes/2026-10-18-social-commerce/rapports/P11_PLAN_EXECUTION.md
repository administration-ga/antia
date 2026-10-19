# P11 — Plan d'exécution commande préparée et réservation

18 octobre 2026. Demande : poursuivre P11, sans relancer les vérifications et sans
empiéter sur P10 réservé à l'autre session. Travail dans les sources ANTSIA et PRO.GA,
sans worktree, changement de branche, environnement, donnée ou publication.

## Frontières gelées

- P06 reste fermé et son manifeste intact : `checkout.prepare`, résultat `held`,
  `accepted` ou `reconfirm_required` et `request.status` sont réutilisés.
- P10 garde canal commercial, CRM, `inquiry.submit`, sujets acheteurs partagés et
  raccord initial de `commerceCommands`, `http`, tables et `_deps` PRO.GA. Après livraison
  P10 et libération explicite de ces fichiers par son coordinateur, P11 étend leurs ancres
  de manière additive ; contact/CRM et retrait P10 sont préservés. Aucun double helper buyer.
- Sujet opaque P10 `ensureCommerceBuyerSubject` par personne/réseau/boutique/source/
  environnement, rôle buyer ; aucun compte PRO.GA de l'acheteur n'est créé.
- P11 prépare le checkout et réserve le stock. Le contrat P06 donne un `orderRef` à
  `payment.start` : l'ordre commercial et le paiement restent P12. Aucun faux devis,
  commande acceptée sans accord ni statut payé n'est fabriqué pour remplir l'ancien modèle.
- Le contrôle `options/status/release` porte un contrat privé versionné **hors P06**,
  signé avec un profil distinct. Un nom d'opération réservé P06 n'est pas activé à sa place.

## Responsabilités

1. PRO.GA : politique vendeur fermée par défaut et consentie, variantes/prix publiés
   cohérents, préparation idempotente et réservations atomiques, état/libération/expiration,
   événements privés et suivi vendeur ; aucune utilisation de la caisse ni du devis accepté.
2. Backend ANTSIA : tentative et octets persistés, session/génération corrélées avant/après
   HTTP, résumé privé, reprise après timeout, suivi et abandon, export/effacement/rétention.
3. Front ANTSIA : formulaire membre et consentement non coché, quantités/variantes/remise,
   prix/frais/expiration, ancienne et nouvelle proposition si écart, liste privée et libération.
4. Coordinateur : contrat et client signés, contrôle PRO.GA, politique réseau, raccords
   partagés après coordination P10, navigation/CTA distinct du contact et rapport de passation.

## Conditions de préparation

La préparation exige boutique/catalogue P09 consentis et vivants, lien `receive_orders`,
politique réseau P11 et politique source explicites, vendeur vérifié, module commerce et
mandat du délégant effectifs. L'autorité privée PRO.GA est relue avant tout stock réservé.
La capacité d'achat publique reste fermée : un CTA « Préparer une commande » n'annonce
ni achat accepté ni moyen de paiement.

Prix XAF entiers sûrs, quantité entière 1–999 et lignes uniques ; établissement stock et
frais configurés côté serveur, sans valeur inventée. Rupture : refus, jamais réduction
silencieuse. Écart prix/révision : `reconfirm_required`, même structure de récapitulatif,
sans confirmation d'achat. Avant une nouvelle préparation aux conditions affichées,
le premier hold doit être libéré explicitement ; aucune mutation de la clé initiale.

Les réservations held durent quinze minutes au plus ; réveil d'expiration transactionnel,
reprise cron bornée et libération idempotente. Les anciens appels de caisse/stock/devis
conservent leur comportement ; ils ne peuvent consommer une réservation sociale P11.

## Preuve et limite de cette reprise

Scénarios écrits seulement : concurrence du dernier article, doublon/conflit, prix/variante
retirés, vendeur suspendu, mauvaise identité, expiration/libération double, réponse perdue,
statut après délai, erreurs de session et confidentialité. **Aucun test, codegen, typage,
lint, audit automatique, build, navigateur, service, commande Convex ou recette exécuté.**
Aucun secret/configuration, commit, push, déploiement ou encaissement.
La preuve de réservation réelle sandbox et l'application observée restent à établir.
