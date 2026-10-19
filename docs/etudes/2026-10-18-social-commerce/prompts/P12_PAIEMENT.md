# P12 — Paiement sandbox et rapprochement

**Dépendance :** P11 et fournisseur choisi/configuré pour l'environnement de test. **Ownership :** adaptateur paiement, callback et rapprochement PRO.GA. **Spécification :** [08](../08_ARCHITECTURE_INTEGRATION.md).

```text
Depuis la racine ANTSIA, lis et applique
docs/etudes/2026-10-18-social-commerce/prompts/PROMPT_COMMUN.md et les règles PRO.GA. Implémente seulement P12.

Vérifie les décisions : fournisseur, bénéficiaire des fonds, devise, modes admis, frais, remboursement
et documentation officielle courante. Le dossier cite SingPay comme candidat, pas comme prestataire
retenu. N'invente aucun compte, secret, signature callback ni moyen de paiement.

Pars de payments/adapters.ts et des machines d'état/rapprochement existantes. Enregistre un
adaptateur sandbox réel selon le contrat retenu. payment.start relit commande, montant, devise,
bénéficiaire, droits et réservation. Une clé canonique lie commande/intention/opération fournisseur.
Après timeout, rechercher la transaction par référence ; ne pas tenter un second débit sans preuve.
Si le fournisseur ne garantit pas l'idempotence, mettre un protocole de rapprochement/verrouillage
explicite et tester les cas incertains avant de permettre une relance.

Callback : valider origine/preuve selon mécanisme officiel, identifiant, unicité, montant, devise,
bénéficiaire et transition autorisée ; rapprocher avec une consultation serveur si nécessaire.
Retour navigateur = information de navigation, jamais preuve de paiement. Envoyer les statuts
privés autorisés vers ANTSIA ; ne pas publier les transactions dans l'inbox publique.

Traiter refus/annulation/expiration, succès tardif après libération du stock, paiement en double
constaté, remboursement demandé/en cours/confirmé/échec. Journaliser sans secret ni données sensibles.
Ne pas confirmer une livraison du seul fait que le paiement est confirmé.

Tests provider simulé puis vraie sandbox : callback dupliqué, hors ordre, faux montant/devise,
référence inconnue, requête réseau perdue, remboursement et réconciliation tardive. Vérifier registre,
commande et état fournisseur concordants ; décrire séparément les scénarios réellement disponibles.

Sans prérequis fournisseur, livrer l'adaptateur contractuel/testé et la liste exacte des manques,
mais garder le lot partiel et la capacité payer fermée. Aucune transaction réelle ni production.
```

**Acceptation :** une intention ne crée pas de double débit et la confirmation vient du serveur/fournisseur ; la preuve comprend le rapprochement, pas uniquement l'écran de succès.
