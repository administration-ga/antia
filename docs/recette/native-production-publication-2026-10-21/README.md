# Livraison de la configuration native ANTSIA — 21 octobre 2026

Cette livraison versionne la configuration de production utilisée pour préparer
les applications téléphone ANTSIA, le retour Identité.ga natif et le profil de
compilation du simulateur iOS.

## Périmètre

- Identifiant iOS et Android : `ga.antsia.mobile` ; schéma de retour : `antsia`.
- Profils Expo `telephone`, `testflight` et `simulateur`, avec origines de production.
- Préparation depuis deux références Git immuables, dans un contexte de compilation
  isolé ; aucun emballage global de l'arbre de travail partagé.
- Connexion Identité.ga dans le navigateur système, retour natif corrélé et échange
  à usage unique. Le transport des réponses navigateur et des cookies est conservé.
- Signature iOS avec le certificat du profil ; compilation simulateur sans signature
  App Store, limitée à deux tâches Xcode pour les prochaines compilations.
- Dépendance `expo-web-browser` ajoutée au catalogue et au verrouillage, sans mise
  à niveau des dépendances Web.

Les travaux Marketplace et DIASPORALE non publiés sont exclus. Aucun changement
de schéma, de données, de sessions, de secrets ou d'environnement n'est livré.
Cette publication des sources et du Web ne déclenche pas de nouveau build mobile
ni de nouvelle soumission TestFlight ; le backend natif a été publié précédemment.

## État réel des essais mobiles

Les fichiers installables Android et iOS 0.1.0 (2) ont été préparés précédemment.
Le propriétaire a confirmé le retour Identité.ga avec son profil sur le simulateur
Android. Cette confirmation reste distincte d'une recette sur téléphone physique.

L'application iOS Simulator a été compilée, mais ANTSIA n'a pas encore été affichée
dans un simulateur iOS. Le runtime iOS 17.0.1 téléchargé est refusé par les contrôles
de signature Apple actuels. Les montages expérimentaux ont été retirés et
l'appareil dédié est arrêté ; aucune protection n'a été contournée.

La reprise iOS nécessite assez d'espace pour installer normalement un runtime
plus récent accepté par Apple. L'application compilée et le téléchargement original
sont conservés. La connexion Identité.ga sur iPhone reste à vérifier.

L'approbation externe TestFlight et l'envoi de l'invitation sont suivis séparément ;
une publication du site ne constitue pas une approbation Apple.

## Validation de cette livraison

Le contrôle global est exécuté sur les sources exactes du candidat, avec un backend
local temporaire dédié et sans commande Convex de production. Les résultats sont
consignés dans `validation.json`. La livraison Web est ensuite contrôlée sur les
déploiements préparés, puis sur les routes publiques de production et de démo.
