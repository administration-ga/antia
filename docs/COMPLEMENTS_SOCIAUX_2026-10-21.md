# Compléments sociaux — 21 octobre 2026

Les modèles fournis dans les onze captures Facebook sont intégrés dans les vrais composants ANTSIA : invitations, suggestions, profils, notifications, cartes d’offre et aperçus vidéo du fil. Les fonctions et contenus existants restent raccordés. Cette livraison est **locale, sans publication de cette tranche**.

## Comportements intégrés

- **Invitations** : identité publique, date réelle, portrait et paire Confirmer/Refuser de même largeur ; confirmation sociale et refus neutre. Annulation des demandes envoyées et pagination indépendante des deux côtés conservées.
- **Suggestions et profils** : Ajouter, Masquer, Profil, Suivre et Écrire restent des gestes distincts. Une invitation reçue mène à sa réponse ; Invitation envoyée ouvre la gestion des invitations. Le masquage conserve son comportement persistant et son retour arrière sur erreur.
- **Notifications** : portrait avec pictogramme de type, auteur mis en évidence, état non lu et sections Nouveau/Plus tôt selon la date réelle. Confirmation directement dans la notification, verrou de double clic et relecture du statut serveur ; une erreur technique ne supprime plus les choix disponibles. Filtres, pagination, liens contextualisés, fermeture et navigation clavier conservés.
- **Boutiques** : média plus visible, vignettes de la même offre, prix et disponibilité, bandeau descriptif et accès à l’offre ou au catalogue. Variantes, contexte public/membre et garde des médias restent en place.
- **Fil** : carrousels personnes/pages réintégrés dans le fil des chartes ; les actions Suivre/Écrire existantes restent présentes. Le nouveau rail Clips utilise au plus quatre vidéos déjà livrables de la page de publications chargée, sans lecture automatique, requête supplémentaire ou média retenu. Fermer l’aperçu conserve les publications.

## Charte et adaptation

Le jeton dédié `--esp-social-action-radius` vaut 8 px dans les sept chartes ANTSIA ; les actions concernées gardent une cible d’au moins 44 px. La primitive globale des boutons, les couleurs et la géométrie des filtres/onglets ne changent pas. Les couleurs restent celles du rôle métier dans chaque charte.

Les suggestions passent d’une à deux puis trois colonnes selon la largeur du panneau. Les offres s’adaptent au conteneur : média, informations et action restent accessibles sur téléphone, tablette et bureau.

| Vue locale | Largeur | Résultat observé |
| --- | ---: | --- |
| Suggestions | 390 px | Une colonne, aucun débordement horizontal |
| Suggestions | 834 px | Deux colonnes, aucun débordement horizontal |
| Suggestions | 1 440 px | Trois colonnes, aucun débordement horizontal |
| Boutique | 390 / 834 / 1 440 px | Aucun débordement horizontal ; action de 44 px, rayon de 8 px |

Le contrôle visuel porte sur Gaboma sombre. La résolution du nouveau jeton est testée dans les sept thèmes, en clair/sombre et contexte imbriqué ; cela ne remplace pas une recette visuelle complète des sept chartes ni des appareils physiques.

## Vérifications effectuées

- Génération et typage Convex locaux réussis ; typages du paquet social et de l’application réussis.
- Suite complète `social-features` : **4 157 tests / 275 fichiers**, tous réussis.
- Suite complète ANTSIA : **1 115 tests / 121 fichiers**, tous réussis, soit **5 272 tests** pour ces deux suites.
- Géométrie des thèmes : 8 tests réussis. Six cliquets ciblés : 17 tests réussis (contrat de thème, langues, couleurs, phrases, URL et délivrance des fichiers).
- Lint ciblé : aucune erreur. Un avertissement de règle Next sur le portrait `<img>` du paquet moteur générique, indépendant de Next.
- Parcours local : compte de démonstration modération → profil presse → Ajouter → Invitation envoyée ; connexion au compte presse, notification reçue, Confirmer. La nouvelle relation est acceptée. Les 51 documents de relations/invitations préexistants sont inchangés, ainsi que les 14 suivis.
- Catalogue mobile : l’action Consulter l’offre ouvre la fiche réelle, avec titre, prix, disponibilité et image. Aucun achat ni prise de contact effectué.
- Console du dernier parcours boutique/détail : **0 erreur**, deux avertissements de développement préexistants concernant l’image principale et le défilement fluide, consignés dans les preuves.

## Limites et conservation

Aucune actualité, personne, relation commune, campagne sponsorisée ni gamme de produits n’a été inventée. Les actualités restent les vraies publications autorisées du réseau. Les vignettes commerce représentent les médias de leur offre, sans simuler des produits absents des données.

Le rail Clips est couvert par ses tests de filtrage, limites, destinations, absence d’autoplay et fermeture ; les données locales utilisées pour les captures ne contiennent pas de vidéo livrable permettant d’en revendiquer la lecture en navigateur.

Pas de build de production ni de `verify` global revendiqué pour cette tranche. Aucun commit applicatif, push, déploiement distant, secret ou fichier d’environnement modifié. L’arbre et l’index partagés ainsi que les travaux voisins sont conservés. Une seule relation de recette a été ajoutée sur le backend local, sans retrait des relations ou invitations existantes.

## Preuves

- Décision : [ADR-0033](adr/0033-complements-sociaux-actions-compactes.md).
- [Mesures responsives](recette/complements-sociaux-2026-10-21/responsive.json), [conservation des données](recette/complements-sociaux-2026-10-21/local-after.json), [console locale](recette/complements-sociaux-2026-10-21/console-locale.json).
- [Notification avec décision](recette/complements-sociaux-2026-10-21/notifications-mobile.png), [suggestions bureau](recette/complements-sociaux-2026-10-21/suggestions-1440.png), [catalogue tablette](recette/complements-sociaux-2026-10-21/catalogue-tablette.png), [fiche mobile](recette/complements-sociaux-2026-10-21/offre-mobile.png).
- Les captures Facebook fournies servent de référence ; elles ne sont pas ajoutées aux médias de l’application.
