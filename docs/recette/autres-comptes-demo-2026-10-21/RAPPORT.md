# Autres comptes démo — connexion et sortie automatiques

Date : 21 octobre 2026. Adresse contrôlée : https://antsia.vercel.app/demo.

Les six comptes supplémentaires ont terminé leurs 18 cycles de connexion et déconnexion, sans rechargement manuel, sans navigation forcée vers le fil et sans cliquer sur « Réessayer ». Chrome reproduit les tailles téléphone (390 × 844), tablette (834 × 1112) et ordinateur (1440 × 1000) ; ce ne sont pas des essais sur appareils physiques.

| Compte | Destination automatique | Ordinateur | Tablette | Téléphone |
| --- | --- | --- | --- | --- |
| Membre vérifié | Fil, identité vérifiée | OK | OK | OK |
| Commerçant | Fil, identité vérifiée | OK | OK | OK |
| Association | Fil, identité vérifiée | OK | OK | OK |
| Administration | Fil, identité vérifiée | OK | OK | OK |
| Modération | Fil, identité vérifiée | OK | OK | OK |
| Nouvel arrivant | Accueil à compléter | OK | OK | OK |

Chaque sortie rejoint automatiquement `/demo/entrer`. Pour le nouvel arrivant, aucun consentement n’a été coché et aucun profil n’a été créé. Aucun débordement horizontal ni alerte d’erreur visible n’a été observé sur les 18 arrivées. Un bandeau d’invitation préexistant a été conservé, sans action. Le compte réel de l’onglet racine est resté connecté : le lien vers son profil a été comparé avant les essais et après chaque format. Aucun message, appel, publication, invitation ou changement de relation n’a été effectué.

## Problème isolé et correctif

Deux erreurs techniques de préparation du fil ont été observées pendant les sorties du membre vérifié. Deux cycles de diagnostic supplémentaires ont confirmé qu’un appel `prepareMyFeed` partait après le début de la sortie, alors que la session était révoquée. Le serveur l’a correctement refusé comme non authentifié.

`FeedPages.tsx` consulte désormais le verrou partagé de déconnexion avant d’amorcer une préparation. Deux tests protègent l’arrivée d’une réponse pendant la sortie et l’arrivée d’une nouvelle génération. Les gardes du serveur restent inchangées ; une requête déjà partie avant la sortie demeure susceptible d’être refusée.

Validation ciblée : 77 tests du fil et de son lecteur passent dans l’arbre de travail et sur la base publiée corrigée ; typage du paquet et lint des deux fichiers corrigés réussis. La vérification globale a été exécutée : les 12 typages et les tests du serveur passent, mais quatre tests de thème DIASPORALE échouent sur le nouveau jeton `--esp-social-action-radius`, ajouté par l’autre session. Ces sources réservées ont été conservées et restent hors de la livraison. Le lint des 11 espaces passe avec les avertissements existants. Les 987 tests de l’application sur la base publiée corrigée passent également.

Les fichiers modifiés contenaient déjà des ajouts de l’autre session. Seuls l’import du verrou, la garde et les deux cas de test sont projetés sur les sources publiées. Le répertoire partagé, sa branche, son index, les fichiers d’environnement et les backends de production sont préservés. La compilation Vercel s’effectue sur les copies figées de livraison.

## Publication et contrôle final

Correctif commité et poussé : `d76d559` (site principal) et `0af6d49` (enfant démo). Les deux commits ne portent que les deux fichiers du fil. Versions publiées : `demo-sortie-20261021-production-8a590ef4bca4e6b9` et `demo-sortie-20261021-demo-34f8d07b9ca175a6`. Les deux compilations sont READY ; santé publique OK, CSP corrélée au bon backend, secrets du relais absents des en-têtes. L’ancien alias reste supprimé (HTTP 404). La configuration Vercel du site principal pointe aussi vers le nouvel enfant privé pour les prochaines livraisons.

Trois cycles supplémentaires du membre vérifié ont passé après publication, aux trois formats, sans rechargement manuel. Un essai mobile intermédiaire a affiché un refus de connexion ; une nouvelle tentative ultérieure a réussi. Les quotas existants sont de 3 envois par 5 minutes et de 5 connexions par 15 minutes, par adresse ; le lien exact entre ce refus et un quota n’a pas été capturé et n’est donc pas affirmé. Aucune protection n’a été désactivée. Aucune nouvelle erreur de préparation du fil n’a été observée dans la console après publication. L’observation bornée du serveur n’a capturé aucun nouvel appel de préparation pendant sa fenêtre ; elle ne prouve pas l’absence d’événements hors fenêtre, notamment lors de la reprise mobile ultérieure.

Le compte démo Presse initial est restauré et son fil chargé reste ouvert en 390 × 844, avec les préférences Sombre/Gaboma préexistantes. Le lien du compte réel reste identique, sans déconnexion. Aucun serveur ni fichier d’environnement n’a été modifié ; aucune commande de déploiement Convex de production n’a été exécutée. La génération requise par la vérification a utilisé le backend local existant.

## Preuves

- `mesures.json` : les 18 arrivées et 18 sorties, avec contrôles de dimensions et de conservation de l’identité réelle.
- `diagnostic-transitions.json` et `diagnostic-sortie-membre-verifie.json` : diagnostic corrélé du refus après le début de sortie.
- `observateur.json` : incidents de rattachement du contrôleur Chrome. Des rattachements de lecture ont été nécessaires après certaines navigations ; aucun rechargement ni nouvelle soumission n’a servi à terminer ces parcours. Les temps du contrôleur ne constituent pas une mesure de latence du produit.
- Captures des 18 arrivées conservées localement ; elles sont exclues du dépôt par le fichier `.gitignore` de ce dossier.

- `controle-apres-publication.json`, `etat-final.json`, `console-apres-publication.json` : reprises finales et conservation du compte réel.
- `validation.json`, `commits.json`, `publication-proof.json` : périmètre livré et limites du contrôle global.
- `runtime-origin-proof.json` : synchronisation de l’origine privée de la démo, sans changement de secret.
