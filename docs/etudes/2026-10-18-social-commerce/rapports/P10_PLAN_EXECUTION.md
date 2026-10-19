# P10 — Plan d'exécution du contact commercial

18 octobre 2026. Périmètre demandé : P10 seulement, dans les sources existantes ; **aucune vérification exécutée**.

## Comportement retenu

- Canal commercial distinct des fils personnels : demandeur, boutique, offre facultative, équipe mandatée et réseau de conversation fixe. Aucune relation personnelle créée ou garde personnelle supprimée.
- Avant acceptation : une demande textuelle de 1 à 2 000 caractères, idempotente ; aucune pièce ni appel. Après acceptation : échanges bornés, pièces sous la garde existante et réponses identifiées au nom de la boutique.
- État explicite : demande en attente, acceptée, refusée, bloquée ou close ; blocages indépendants du demandeur et de la boutique. Les droits d'équipe sont relus sur une habilitation de page vivante ; lecture et réponse sont distinctes. Le droit de répondre ne donne aucun droit CRM PRO.GA.
- Liste/recherche, retour à l'offre, gestion vendeur et activation des répondants raccordés aux écrans existants. Les appels utilisent le moteur actuel uniquement après accord des participants et relecture des préférences/mandats ; une question ne fait jamais sonner automatiquement.
- Option CRM : le demandeur choisit le texte et l'alias social à transmettre, voit qu'il s'agit d'un prospect PRO.GA et consent explicitement. Le canal de retour reste ANTSIA ; aucun carnet, fil complet, e-mail ou téléphone n'est transmis implicitement. P06 `inquiry.submit` est l'opération existante ; créer un prospect est son effet CRM local, pas une nouvelle commande `lead.create` inventée.
- Le retrait de cet accord ferme les nouvelles émissions et se propage par un contrat privé versionné hors manifeste P06 si nécessaire. Le nom réservé P06 `inquiry.withdraw` ne devient pas silencieusement exécutable. Une demande enfilée ne vaut pas prospect appliqué ; états et reçus restent distincts.

## Répartition et raccordements

1. Backend ANTSIA : canal, mandats, quotas, messages, pièces, blocages, appels et scénarios source.
2. PRO.GA : admission authentifiée `inquiry.submit`, mandats/capacités, déduplication et vrai CRM ; contrat privé de retrait et scénarios source.
3. Interface : source commerciale dédiée et composants de communication réutilisés, routes/boutiques/offres/Messages, UX d'équipe et de consentement, FR/EN.
4. Coordinateur : contrats entre tâches, schéma et registres partagés, transport ANTSIA de l'option CRM, modération, données, notifications minimales et passation.

Chaque tâche possède ses fichiers ; les registres partagés sont raccordés par ancres relues. Les modifications PA9/PA10, P06/P08/P09, DIASPORALE et les cinq fichiers du pont de session sont conservés.

## Contraintes et preuve

Aucun test, codegen, typage, lint, build, audit automatique, recette, serveur, installation, commande Convex, secret/configuration réelle, commit ou publication. Les tests sont écrits sans exécution. Le rapport final distinguera sources raccordées et recette restant à faire : inconnus, refus/spam, autre réseau, mandat retiré, pièces retenues, double clic/timeout, retrait de consentement, appel sur deux comptes et retour à l'offre.

Le lot reste sans preuve d'activation réelle jusqu'à la reprise explicite des vérifications et de la configuration. Les achats, devis engageants et paiements restent hors P10.
