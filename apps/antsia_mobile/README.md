# ANTSIA — client natif, P17b/P17c en sources

Application Expo iOS/Android du moteur ANTSIA, entrée réelle `index.ts` → `src/app.tsx`.
Elle n'est pas servie par Next sur le port 3030. Aucun navigateur embarqué n'affiche le fil.
Le paquet est découvert par `apps/*` dans l'installation Bun unique du dépôt.

État du 20 octobre 2026 : **sources raccordées, dépendances non installées, lockfile non
actualisé, aucune compilation ni recette exécutée**. Ne pas présenter cette application comme
disponible sur un téléphone ou distribuée. Voir les bilans
[P17b](../../docs/etudes/2026-10-18-social-commerce/rapports/P17B_REPRISE_2026-10-20.md) et
[P17c](../../docs/etudes/2026-10-18-social-commerce/rapports/P17C_REPRISE_2026-10-20.md).

## Configuration à fournir ultérieurement

| Nom | Sens |
|---|---|
| `EXPO_PUBLIC_CONVEX_URL` | Origine du moteur Convex ANTSIA explicitement choisi |
| `EXPO_PUBLIC_CONVEX_SITE_URL` | Origine HTTP du même moteur, qui sert Better Auth |
| `EXPO_PUBLIC_SITE_URL` | Origine du site ANTSIA correspondant, pour les parcours Web restants |
| `EXPO_PUBLIC_NATIVE_SCHEME` | Schéma détenu par le propriétaire, optionnel pour cette tranche |
| `NATIVE_IOS_BUNDLE_ID` | Identifiant iOS détenu par le propriétaire, requis avant génération autonome |
| `NATIVE_ANDROID_PACKAGE` | Identifiant Android détenu par le propriétaire, requis avant génération autonome |
| `EXPO_PUBLIC_ALLOW_LOCAL_HTTP` | `true` en développement seulement pour une origine de boucle locale |
| `NATIVE_CALLS_ENABLED` | `true` uniquement pour configurer explicitement un binaire avec appels système ; désactivé par défaut |
| `EXPO_PUBLIC_NATIVE_NOTIFICATION_APPLICATION_ID` | Entrée native correspondant à la plateforme dans le registre ANTSIA |
| `APNS_ENVIRONMENT` | `development` ou `production`, requis par le plugin activé ; ne lance aucun déploiement |
| `NATIVE_FIREBASE_CONFIG_PATH` | Fichier Firebase propriétaire existant, requis par le plugin activé |

Aucune valeur n'est inventée, copiée d'un autre produit ou écrite dans un fichier `.env*`.
Les variables `EXPO_PUBLIC_*` sont publiques dans le binaire. Elles ne doivent contenir aucun
secret. HTTPS est requis, à l'exception de la boucle locale explicitement admise en mode
développement. Sur un appareil physique, `localhost` désigne l'appareil ; aucun tunnel, IP LAN
en HTTP, domaine, projet Expo ou identifiant de distribution n'est créé par cette tranche.

Les scripts Expo sont déclarés dans le paquet. Leur utilisation attend la reprise autorisée
de l'installation et des vérifications. Ne pas démarrer un deuxième serveur à côté du serveur
déjà utilisé par une autre session. Aucun fichier natif généré ni compte Apple/Google/EAS n'est fourni.

## Périmètre actuel

- Authentification par code e-mail/SMS, uniquement si le moteur expose ce transport. Le
  greffon `bearer()` existe déjà côté serveur : le client conserve son header `set-auth-token`
  dans SecureStore ; il ne copie pas le cookie d'un navigateur. Le JWT Convex reste en mémoire.
- Retour Identité.ga natif **non raccordé**. Le bouton d'inscription/IDN ouvre le site et
  explique que sa session reste dans le navigateur. Aucun transfert de cette session n'est simulé.
- Résolution du réseau, session Better Auth vivante, personne et adhésion relues. Aucun
  profil, accord ni adhésion créé automatiquement. Une inscription incomplète revient au site.
- Fil liste/défilement vertical, publication, boîte et conversations personnelles existantes.
  Fenêtres de 200 éléments au plus. Envoi texte seul, corps/clé figés pour une reprise manuelle.
- Hors ligne : contenu privé masqué ; l'intention d'envoi reste en mémoire tant que la
  conversation reste montée. Navigation, arrière-plan, sortie ou arrêt du processus peuvent
  la supprimer. Aucune boîte d'envoi durable ni garantie de reprise après arrêt n'est annoncée.
- Les liens reçus pendant la session n'acceptent que des références de publication/conversation
  et trois destinations fermées. Ils ne contiennent aucun jeton et ne donnent aucun droit.
  Les liens de démarrage à froid, associations universelles et retours OAuth restent à raccorder.
- Les DTO de médias et leurs retenues serveur font autorité. Pas de dépôt natif de fichiers,
  de reconstruction d'URL ni d'ouverture de fichier privé hors de cette garde.
- Sept chartes du dépôt, clair/sombre ; Sable donne les cartes beige. Les choix locaux sont
  limités à cette ouverture, sans écriture de la préférence de compte. Polices système.
- Sortie native par une porte asynchrone : fermeture des gestes, arrêt des lecteurs, tentative
  de révocation globale, sortie SDK, purge de la seule clé de ce moteur, remplacement du client
  SDK et démontage des clients Convex/caches. Révocation et purge ont des résultats distincts.

## Appels et notifications d’appel — P17c

Les sources ajoutent un module Expo local Swift PushKit/CallKit et Kotlin FCM/Core-Telecom,
un hôte LiveKit persistant, les gestes audio/vidéo dans les conversations et l’activation
sur geste dans les réglages. Microphone au geste d’appel/réponse, caméra pour la vidéo seulement ;
l’inscription aux notifications ne demande pas le micro. La capacité reste indisponible sans
module compilé, identités natives explicites et configuration serveur correspondante.

Une session réelle et la liaison exacte de cet appareil sont relues avant réponse/jeton. Un seul
appareil gagne. Le push ne contient que des références opaques et une échéance. La sonnerie
native expire en 45 secondes au plus ; les événements de reprise sont bornés à 32/60 secondes.
Pas de push VoIP d’annulation : canal actif et expiration native ferment la sonnerie. Les
notifications sociales ordinaires gardent leurs limites de réception/ouverture mobile.

La salle vit au-dessus des écrans. Révocation, expiration et déconnexion arrêtent les pistes ;
le nettoyage est lié à son ancien appareil/UUID. Le stockage bearer reste
`WHEN_UNLOCKED_THIS_DEVICE_ONLY` : la réponse depuis un écran verrouillé n’est pas prouvée.
Le plein écran Android n’est pas présumé. Aucun enregistrement ni E2EE annoncé.

Les dépendances/catalogue sont déclarés, mais installation, plugins Expo57, compilations natives,
livraison APNs/FCM et essais physiques restent différés. Expo Go ne prouve pas la chaîne native.
Aucun achat ni candidature native. Les fermetures P16 du moteur sont conservées ; P17d reste
une recette séparée, non exécutée.

## Préparation P17d et suite P18/P19

Le [dossier P17d](../../docs/recette/antsia-native-p17d/README.md) contient le protocole et
le registre initial non exécuté. Le script racine `native:acceptance` est déclaré pour lire ce
dossier ultérieurement ; il n’est pas lancé pendant la suspension des vérifications. Une
complétude déclarée ne prouve pas une observation et n’active aucune capacité.

Les [corrections P18](../../docs/etudes/2026-10-18-social-commerce/rapports/P18_REPRISE_2026-10-20.md)
concernent commandes et champs accessibles, états sélectionnés, grandes tailles, mouvements
réduits et présentation des listes/appels. Aucun score AA ou gain de performance mesuré.
Le [dossier P19](../../docs/etudes/2026-10-18-social-commerce/rapports/P19_REPRISE_2026-10-20.md)
est actualisé sans lancement de pilote ou publication. La configuration propriétaire, les
compilations et les essais physiques restent nécessaires et non effectués.
