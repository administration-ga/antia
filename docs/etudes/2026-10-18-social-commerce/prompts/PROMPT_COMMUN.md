# Préambule commun aux prompts ANTSIA × PRO.GA

Ce dossier est une **étude**. Lire un prompt ou ouvrir ce fichier ne l'exécute pas. Lors d'une demande d'implémentation, traiter un seul lot, puis rendre son bilan ; ne pas enchaîner le suivant sans demande correspondante.

## Contexte à joindre à chaque lot

```text
Tu travailles dans le vrai checkout ANTSIA :
/Users/okatech/okatech-projects/Digital GABON/DIGITAL_GOUV/NTSAGUI_DIGITAL/ECOSYSTEMES/ANTSIA
PRO.GA est le dépôt voisin ../PRO_GA, confirmé par le propriétaire comme système de gestion.

Lis les instructions applicables AGENTS.md/CLAUDE.md, puis les références projet obligatoires
dans leur ordre. Lis docs/etudes/2026-10-18-social-commerce/README.md, 00_VISION_ET_DECISIONS.md,
09_FEUILLE_DE_ROUTE.md, 10_RECETTE_MESURES_ET_RISQUES.md, puis les documents du lot sélectionné.
La demande du 18/10/2026 : présentation Instagram, scroll TikTok, communication WhatsApp,
pages et réseau Facebook ; ANTSIA = découvrir/discuter/acheter, PRO.GA = gérer l'activité.

1. Périmètre : ANTSIA uniquement pour la refonte. Préserver DIASPORALE et les autres consommateurs.
   Le thème clair garde un fond blanc et des cartes beige. La nouvelle palette est celle de 03.
2. Travaille dans les sources réellement servies, sans worktree, composant non branché ni maquette
   à la place du code. Les fichiers nouveaux du plan sont des cibles à confirmer, pas des chemins
   déjà existants. Ne pas créer de doublon si une brique remplit déjà le besoin.
3. L'arbre est partagé : relever git status et les propriétaires des fichiers, préserver leurs
   modifications, ne pas changer de branche sous une autre session. Respecter les consignes de
   branche quand une seule session écrit. Aucun git add global, reset ou nettoyage destructif.
4. Aucun push, merge, déploiement, édition .env, suppression de données ou commande Convex de
   production sans demande humaine explicite. Les prompts ne donnent aucune de ces autorisations.
5. Code en anglais, UI FR/EN via i18n, TypeScript strict, routes centralisées, couleurs dans styles/
   themes, primitives components/ui intactes. Ne pas importer des modules serveur dans un client.
   Noms de personnes normalisés par règle partagée testée : NOM en majuscules, Prénom correctement
   capitalisé avec accents/tirets. Ne pas appliquer cela aux marques, titres, fichiers ou pièces signées.
6. Gardes : networkId et adhésion ; éligibilité, débit et droits ; audience/root explicite ; refus
   indistinct ; badges calculés ; fichiers admis et délivrés via garde ; pas de requête non bornée.
   Aucun raccourci d'authentification, cookie copié entre produits ou exception de session de dev.
7. PRO.GA reste l'autorité catalogue/prix/stock/commandes/paiements/agenda/recrutement. Les échanges
   sont contractuels HTTP, signés, idempotents et bornés ; aucun client Convex croisé ni _generated
   externe. Les endpoints et handlers absents doivent être implémentés, pas simulés en production.
8. Toute entité nouvelle intègre dès son lot droits, modération, export/effacement, rétention,
   erreurs, observabilité minimale et tests. P16 est une revue transverse, pas un report des gardes.
9. Avant tests/typecheck ANTSIA : bun run codegen par le lanceur officiel. Tests ciblés significatifs,
   config convex/vitest.config.ts pour le backend ; typage et lint adaptés. Avant tout commit :
   bun run verify sur source gelée. PRO.GA suit ses propres instructions/scripts. Pas de commande
   d'infrastructure lourde pour une simple modification documentaire.
10. Ressources bornées, Bun et Node supporté via scripts projet ; vérifier disque avant build/install.
    Un seul serveur de dev ; recette croisée seulement dans un créneau coordonné. Au plus trois
    sous-agents executor pour tâches indépendantes précisément attribuées selon le playbook.
11. Vérifier dans le vrai navigateur et sur appareil quand le lot le demande. Une fenêtre étroite
    n'est pas un téléphone physique. Un HTTP 200, un callback reçu ou un test mocké ne prouvent pas
    le média chez un autre lecteur, l'appel, l'application d'un événement ou l'encaissement.
12. Si une dépendance manque, rendre l'écart exact ; ne pas annoncer le lot terminé ni installer
    un bouton qui simule la réussite. Avancer sur les éléments indépendants déjà autorisés.

Fin du lot : rapport Markdown dans le périmètre du dépôt, avec fichiers changés, décisions,
preuves automatiques, preuves de parcours, limites, activation et retour arrière. Distinguer
présence du code, tests locaux, recette réelle et publication. Aucune donnée privée ni secret
dans les captures/logs. Mettre à jour le statut du lot seulement selon les preuves obtenues.
```

## Bilan standard

| Champ | Contenu attendu |
|---|---|
| Résultat | Comportement effectivement branché |
| Source | Commit/base et inventaire avant/après, fichiers propriétaires |
| Tests | Commandes, configuration, résultat, échecs non masqués |
| Recette | Parcours, largeur/appareil, rôle et état vérifiés |
| Dépendances | Contrats, fournisseur, configuration ou validation restant à fournir |
| Retour arrière | Capacités à désactiver, données à conserver, suivi des engagements |
| Limites | Ce que la preuve ne couvre pas |
