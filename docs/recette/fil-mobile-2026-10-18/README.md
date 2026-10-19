# Fil ANTSIA — contrôle mobile du 18 octobre 2026

Demande du propriétaire : vérifier le fil connecté sur téléphone avec **fond blanc et cartes beige**, comme sur ordinateur.

Contrôle réel dans Chrome natif, sur `http://localhost:3030/fil`, compte fictif `@recette.f3`. L'apparence a été sélectionnée sur **Clair** depuis le réglage visible de l'application. Les dimensions proviennent des profils d'émulation de Chrome : aucun appareil physique n'a été testé.

| Format | Constat |
| --- | --- |
| 393 × 852 (iPhone 16 émulé) | Fond blanc ; déclencheur de publication, carte d'actu et publication beige ; contenu et réactions visibles ; barre de navigation en bas et bouton Créer au-dessus. |
| 375 × 667 (iPhone SE émulé) | Même hiérarchie blanc/beige ; cartes dans la largeur disponible ; défilement observé avec en-tête collant et navigation basse fixe. |

Le menu principal mobile a été ouvert puis fermé ; il expose notamment Actus, Mon profil, Paramètres et le réglage Apparence avec la valeur **Clair**. Aucun débordement horizontal de carte n'est visible sur ces captures. La barre des sous-menus conserve son propre défilement horizontal prévu par la coque.

Ce contrôle valide les surfaces et la navigation visible. Il ne constitue pas une recette de publication, d'envoi de médias, de réactions ou d'appel. L'accès à toutes les actions du bas d'une publication n'a pas été vérifié à 375 × 667 ; elles sont visibles sur la capture 393 × 852.

## Preuves

- [Fil à 393 × 852](iphone-393x852.png) — [capture originale avec les dimensions Chrome](iphone-393x852-complet.png).
- [Fil à 375 × 667](iphone-375x667.png) — [capture originale avec les dimensions Chrome](iphone-375x667-complet.png).
- [Menu mobile à 393 × 852](menu-393x852.png) — [capture originale](menu-393x852-complet.png).
- [Défilement à 375 × 667](iphone-375x667-defilement-complet.png) et [observation suivante](iphone-375x667-bas-complet.png).

Les images recadrées montrent seulement la zone du téléphone ; les originaux complets sont conservés. Aucun contenu des captures n'a été retouché.

## État local à la fin du contrôle

Le serveur ANTSIA, initialement arrêté, a été relancé sur le port 3030 avec Node 22, webpack et un plafond de mémoire de 2 Go. Le backend local déjà actif n'a pas été relancé. Le serveur DIASPORALE a été repris par l'autre session.

L'émulation a été désactivée et DevTools fermé ; la coque de bureau à trois colonnes a été constatée à nouveau. L'onglet ANTSIA ajouté pour le contrôle reste ouvert. Aucun formulaire métier, fichier média, publication ou compte DIASPORALE n'a été manipulé.

Aucune modification de code applicatif pour ce contrôle. Aucun nouveau test ni vérification complète relancée : la modification de charte reste celle documentée dans la [recette de bureau](../accueil-inscription-2026-10-17/README.md). La recette et les captures restent locales, sans commit ni publication.

## Réouverture après le correctif de session

À la nouvelle demande du propriétaire, un nouveau document `/fil` a été chargé dans une fenêtre Chrome normale distincte de 500 × 833 (largeur minimale de Chrome). L'ancienne fenêtre dédiée n'existait plus après le redémarrage du navigateur. Aucun réglage global d'émulation ni aucune fenêtre privée n'a été modifié.

Le premier chargement a encore affiché « La session ne peut pas être confirmée ». **Une seule reprise avec le bouton visible Réessayer a ensuite ouvert le vrai fil connecté `@recette.f3`.** Ce résultat valide l'affichage retrouvé après reprise ; il ne prouve pas la disparition du défaut au premier chargement. Le constat a été transmis au chat qui coordonne la correction, sans modifier ses sources.

Preuve actuelle : [fil mobile après reprise de session](fil-mobile-apres-reprise-session.png), avec le fond blanc et les cartes beige. L'onglet 969036300, fenêtre 969036299, est conservé comme livrable. La première demande de premier plan a renvoyé `focused: false` ; la prise de premier plan a été différée pendant la manipulation du navigateur par l'autre recette.

Après libération du navigateur, cette seule fenêtre a été remise en format normal de 500 × 833. L'état final de Chrome confirme `focused: true`, `state: normal`, largeur 500. Le fil connecté mobile et ses couleurs ont été constatés à nouveau ; la capture ci-dessus correspond à cet affichage final. Aucun autre chargement ou essai de session n'a été effectué après la reprise réussie.

## Correction du refus initial

Le propriétaire a ensuite demandé de supprimer la reprise manuelle. Le [correctif du délai client et sa recette](../session-sans-reessayer-2026-10-18/README.md) documentent désormais trois ouvertures directes sans Réessayer, dont une après redémarrage du serveur et une au format téléphone. Cette dernière recette complète le constat historique de reprise ci-dessus.
