# P12 — Plan de la tranche interface ANTSIA

18 octobre 2026. Le propriétaire demande P12 sans relancer les vérifications et en
préservant l'autre session. Coordination convenue : l'autre chat porte PRO.GA, le contrat
privé, le backend ANTSIA et ses registres ; ce chat porte uniquement le parcours web ANTSIA.

1. Conserver le récapitulatif P11 et ajouter son panneau de paiement privé. Lire le contexte
   courant et les options par API authentifiée ; sans fournisseur/bénéficiaire configurés,
   montrer l'indisponibilité et ne proposer aucune transaction simulée.
2. Avant lancement : montant total et bénéficiaire confirmés serveur, prestataire et modes
   admis affichés, accord explicite versionné et décoché. Même intention/clientRequestId si
   la réponse se perd ; aucune relance automatique et aucun second débit supposé sûr.
3. Brancher trois routes membres non indexables : liste des paiements, suivi privé par
   tentative, retour prestataire par tentative. Le retour ne lit aucun résultat de l'URL
   et ne lance aucun paiement ; consulter seulement le statut canonique autorisé.
4. Distinguer intention/paiement, commande, stock, remboursement et besoin de rapprochement.
   Une réussite n'est affichée qu'après preuve serveur ; elle ne confirme pas la livraison.
   En cas d'inconnu, consulter le statut avant toute reprise autorisée côté serveur.
5. Action prestataire explicite, lien HTTPS validé côté serveur et filtre défensif UI,
   sans secret, cookie croisé, navigation automatique ni persistance de l'URL fournisseur.
   Demande de remboursement : choix du motif, accord explicite, révision et clé stable.
6. Réseau/personne/tentative bornent la durée de vie de l'écran ; sortie, refus de lecture
   ou nouvelle identité ferment les anciennes données/actions. FR/EN et jetons du thème
   existant, fond blanc/cartes beige en clair ; source réelle sous coque membre.
7. Écrire les scénarios utiles sans les exécuter ; rapport séparé précisant état source,
   dépendances fournisseur, génération/contrôles/recette en attente et absence d'activation.

Aucun test, codegen, typage, lint, build, navigateur, service, commande Convex, changement
d'environnement, donnée, secret, commit ou publication dans cette tranche. P10/P11,
DIASPORALE, les ponts de session et les paiements historiques PRO.GA sont préservés.
