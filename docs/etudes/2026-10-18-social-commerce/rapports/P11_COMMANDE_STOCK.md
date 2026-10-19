# P11 — Préparation privée et réservation de stock ANTSIA–PRO.GA

18 octobre 2026. Reprise demandée par le propriétaire, **sans relancer les vérifications**
et sans empiéter sur P10. Travail directement dans les sources connectées des deux produits.

## État et portée

Sources de préparation et de suivi raccordées ; scénarios écrits, non exécutés. Les
générations d'API, contrôles et recettes restent ouverts. Aucun échange HTTP réel,
réservation sandbox observée, activation, publication ou encaissement n'est revendiqué.

P11 crée une préparation `checkout` et un hold de stock, avec récapitulatif privé. Le contrat
P06 réserve `orderRef` à l'étape `payment.start` de P12 : aucune ancienne commande issue d'un
devis n'est fabriquée pour contourner cette frontière. Paiement, confirmation définitive,
consommation du stock et suivi d'achat complet restent leurs lots suivants.

## Parcours raccordés

- Fiche d'offre **membre** : lien « Préparer une commande » lorsque l'autorité locale P11
  le permet, à côté du contact P10 conservé. Aucune ouverture d'achat sur la fiche publique.
- Formulaire privé : variante et quantité explicites, prix attendu, modes et frais obtenus
  de PRO.GA, retrait en établissement publié ou livraison vendeur, accord décoché et versionné.
  L'adresse n'est jamais reprise du profil social.
- Récapitulatif : conditions demandées et proposées, frais, total XAF et échéance ; changement
  de prix, de révision ou de frais soumis à nouvel accord. L'ancien hold doit être libéré
  avant une nouvelle préparation ; la clé initiale n'est jamais transformée.
- « Mes préparations » dans Profil, liste paginée privée et suivi par tentative : statut
  serveur, reprise d'une réponse perdue avec la même demande, abandon et libération.
- PRO.GA : panneau réel dans les commandes pour configurer la politique vendeur et consulter
  les préparations de la structure sous ses droits effectifs.

Les trois routes membres sont `/mes-commandes`, `/mes-commandes/[attemptId]`,
`/boutique/[handle]/preparer/[offerRef]`. Elles ne sont pas indexables. Les composants utilisent
les jetons du thème existant, avec fond blanc/cartes beige en clair, variantes sombres et FR/EN.

## Autorité et stock côté PRO.GA

`integrations/commerceCheckout*` relit la source, l'environnement, la permission
`receive_orders`, le consentement catalogue, la structure vérifiée et publiée, le module
commerce, le mandat effectif, l'offre/variante et le prix courant. Politique vendeur fermée
par défaut, accord explicite, établissements et frais configurés : aucune valeur inventée.
Le public conserve ses capacités d'achat fermées.

`inventory/commerceCheckoutStock.ts` réserve toutes les lignes dans la même transaction.
Disponibilité partagée et contrôle de concurrence reposent sur les niveaux réels : refus
de la dernière unité insuffisante et rollback de tout hold partiel. Quantités entières,
montants XAF entiers sûrs, lignes et frais bornés. Aucun mouvement de sortie à cette étape.
La projection PUBLIC de disponibilité est actualisée par tâche asynchrone après le hold ;
elle reste indicative et ne remplace jamais le contrôle atomique de préparation.

La décision et l'empreinte métier restent durables après purge des reçus techniques.
Même clé/corps : même décision ; même clé/autre corps : conflit. Un `request.status` peut
retrouver le récapitulatif même si sa première réponse a été perdue. Les réservations expirent
après quinze minutes au plus, avec réveil transactionnel et reprise périodique bornée.
Libération/expiration sont idempotentes ; les anciennes voies de stock ne peuvent consommer
ou libérer directement un hold social. Les événements préparé/libéré/expiré sont effectivement
émis par ces transitions dans l'outbox métier privée, sans adresse ni texte d'acheteur.

## Tentatives privées côté ANTSIA

`shops/checkoutActions`, `checkoutFlow`, `checkoutRules`, `checkoutTables` et `checkoutClient`
séparent appels HTTP, admission et reçu. Session réelle, appartenance, personne, boutique,
mapping/génération, liaison et configuration sont corrélés avant et après chaque échange.
Une réponse tardive ne rétablit pas l'accès d'une session révoquée. Une tentative au résultat
inconnu conserve sa clé ; le suivi est recherché avant tout renvoi des octets exacts.

La politique réseau `checkoutPolicy:setPolicy` est fermée par défaut, réservée à
l'administrateur fort et auditée. Son ouverture n'est pas exécutée par cette reprise.
Le sujet acheteur est le helper **commun P10** `ensureCommerceBuyerSubject`, sans profil
PRO.GA ni adhésion créés pour l'acheteur.

Les commandes d'une tentative restent liées à sa session initiale ; une autre session
du même acheteur peut lire le résumé privé mais ne l'émet pas à nouveau. Le renvoi des octets
initiaux n'est possible que pendant la fenêtre de requête de soixante secondes, après lecture
du statut ; au-delà, seul le suivi durable recherche le résultat. Les contrôles d'état ne
peuvent ni effacer une reconfirmation locale de frais ni faire régresser une révision reçue.

Le contrat de contrôle privé `PRO-COMMERCE-CHECKOUT-CONTROL-V1` permet options, statut et
libération via un profil signé séparé ; P06 et son manifeste restent intacts. Réponses
corrélées/fermées, délais et volumes bornés, pas de cookie, redirection ni corps dans les logs.
Contrat détaillé : [PRO-COMMERCE-CHECKOUT-CONTROL-V1](../../../contrats/PRO-COMMERCE-CHECKOUT-CONTROL-V1.md).

## Données et rétention

Tentatives et requêtes privées appartiennent à l'acheteur dans l'inventaire d'effacement.
L'export ne contient que résumé et consentement : aucun corps signé, adresse, sujet opaque,
preuve de session ou bail. Les corps transitoires ANTSIA sont expurgés après trente minutes ;
le suivi conserve les métadonnées nécessaires sans pouvoir reconstruire un nouvel envoi.
La demande d'effacement invalide immédiatement les baux et les corps, par lots bornés ;
elle planifie un abandon distant pour chaque référence de checkout connue. Une tentative
inconnue sans référence n'est jamais reconstruite : son éventuel hold expire côté PRO.GA.
Une libération après effacement utilise la date réelle de la demande humaine ; si le job
est différé de plus de cinq minutes, il laisse l'expiration agir sans inventer une preuve fraîche.
PRO.GA expurge adresse/note après l'échéance technique configurée ici à sept jours après
expiration, tout en conservant décision/digest et conditions non privées. Cette durée est
un choix de rétention technique du lot, pas une validation réglementaire.

## Coordination et limites de preuve

P10 garde le contact commercial, le CRM et `inquiry.submit`. Son coordinateur a explicitement
libéré les fichiers PRO.GA partagés après son implémentation ; les ajouts P11 y sont additifs.
Le CTA utilise son `actionSlot` existant et le helper buyer partagé. Ponts de session gelés,
DIASPORALE, PA9/PA10 et autres changements de l'arbre partagé préservés.

Scénarios écrits : concurrence du dernier article, rollback multiligne, idempotence durable,
conflit de corps, identité étrangère, retrait/suspension, prix/variante, options et frais,
expiration et double libération, timeout/reprise, consentement, confidentialité et navigation.
Ils restent à exécuter lors d'une reprise autorisée, avec génération normale des références
d'API. La recette réelle devra prouver les deux clients, la course de stock et les transitions.

**Aucun test, codegen, typage, lint, audit automatique, build, serveur, navigateur ou commande
Convex lancé. Aucun fichier d'environnement, secret, donnée, commit, push ou déploiement modifié.**
