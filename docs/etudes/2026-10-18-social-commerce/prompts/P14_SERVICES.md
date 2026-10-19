# P14 — Services, devis et rendez-vous

**Dépendances :** P09, P10, P11 ; P12/P13 pour un acompte. **Spécifications :** [06](../06_BOUTIQUES_SERVICES_EMPLOI.md), [08](../08_ARCHITECTURE_INTEGRATION.md), [10](../10_RECETTE_MESURES_ET_RISQUES.md). **Ownership :** devis/agenda PRO.GA, commandes privées et surfaces services ANTSIA ; réserver les fichiers partagés au coordinateur.

```text
Depuis la racine ANTSIA, lis et applique le préambule :
docs/etudes/2026-10-18-social-commerce/prompts/PROMPT_COMMUN.md. Implémente uniquement P14, sans enchaîner un autre lot.
Ce prompt est documentaire : aucune implémentation n'a été exécutée par sa rédaction.

1. Revalide les contrats livrés par P09/P10/P11 et l'audit PRO.GA. Réutilise
../PRO_GA/convex/modules/quotes/quotes.ts, orders/orders.ts et agenda/{services,
publicBooking,appointments}.ts. Raccorde les handlers privés de P08 : n'ouvre pas
les mutations de structure existantes aux acheteurs. Nouvelles cibles proposées,
à confirmer : packages/social-features/src/features/services/ et les routes
services de l'app ANTSIA, déclarées dans son lib/routes.ts. Réutilise une surface
équivalente si présente ; aucun composant isolé ni client Convex interproduits.

2. Branche les trois parcours : tarif fixe sans créneau, demande de devis,
rendez-vous. La demande privée inquiry.submit porte besoin, contraintes, date
souhaitée et pièces admises choisies. Limite les données au nécessaire ; distingue
le sujet client des mandats vendeur et préserve les refus indistincts.

3. Pour quote.accept, PRO.GA relit destinataire, structure, état, expiration et
version exacte du devis. Persiste l'acceptation authentifiée du client et son
snapshot contractuel ; crée au plus une commande. Une révision concurrente exige
une nouvelle confirmation. Un employé marquant « accepté » ne remplace jamais
cette preuve. Les prestations seules ne réservent aucun stock physique.

4. Pour booking.request, PRO.GA calcule disponibilité, durée et marges puis réserve
atomiquement la ressource. Stocke instant et fuseau IANA explicites ; distingue
créneau temporairement retenu, confirmation du professionnel et paiement. Propose
les extensions fermées de changement/annulation du contrat privé avant leur code.
Revalide politique, sujet et mandat ; affiche les conséquences avant confirmation.
Le changement doit conserver l'ancien rendez-vous si le nouveau créneau échoue.
Toute commande est idempotente ; même clé et autre corps produisent un conflit.
Un acompte reste indisponible jusqu'à la recette P12/P13.

5. Tests : mauvais client/réseau/structure, mandat révoqué, devis périmé ou révisé,
double acceptation, deux clients sur le même créneau, expiration, changement de
fuseau, heure ambiguë/inexistante, annulation et réponse perdue. Vérifie droits des
pièces, export/effacement et absence de contenu privé dans les journaux.

6. Recette croisée coordonnée : client ANTSIA et professionnel PRO.GA, devis précis,
créneau unique, modification puis annulation ; téléphone/bureau, FR/EN et clavier.
Livre preuves et limites selon le préambule. Arrête le parcours dépendant si les
contrats privés, le mandat ou l'atomicité manquent ; aucun succès simulé.
```

**Acceptation :** accord client versionné, agenda canonique sans double réservation, changements rejouables et suivi privé ; paiement qualifié séparément.
