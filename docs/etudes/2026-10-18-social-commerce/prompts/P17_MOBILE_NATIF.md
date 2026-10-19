# P17 — Client natif ANTSIA et appels sur appareils

**Dépendances :** P04, P05, contrats mobiles stabilisés ; lots commerciaux pour leur parité. **Spécifications :** [02](../02_AUDIT_ANTSIA.md), [04](../04_PARCOURS_FIL_ET_PUBLICATIONS.md), [05](../05_MESSAGES_ET_APPELS.md), [10](../10_RECETTE_MESURES_ET_RISQUES.md). **Ownership :** nouveau client natif ANTSIA, adaptateurs mobiles ; contrats coordonnés.

```text
Depuis la racine ANTSIA, lis et applique le préambule :
docs/etudes/2026-10-18-social-commerce/prompts/PROMPT_COMMUN.md. Exécute seulement la tranche P17 explicitement sélectionnée.
Aucun client natif ANTSIA n'est établi par l'audit ; les transports Expo/FCM/APNs existants
ne constituent pas une application. Commence par auditer les briques Expo du programme,
leur provenance, maintenance, compatibilité et preuves ; réutilise celles qui conviennent
selon les règles de duplication. Ne reconstruis pas un module disponible ni ne copie ses secrets.

Décompose avant codage : P17a audit/contrats et limites Web ; P17b coque native/authentification/
fil/messages ; P17c appels et notifications système ; P17d recette physique/parité disponible.
Attribue chemins réels et ownership, puis réalise une seule tranche vérifiable sans lancer
les suivantes automatiquement. Les évolutions Web de P04/P05 restent distinctes du natif.

Réutilise packages/social-contracts, les API ANTSIA, les contrats d'appels LiveKit et la logique pure ; adapte les
composants natifs sans importer DOM, Next ou modules serveur. Conserve réseau, adhésion, session
vivante, déconnexion globale et gardes fichiers. Prévois stockage sécurisé, purge des données
personnelles, erreurs et reprise bornée. Commerce : seulement les contrats et parcours réellement
livrés ; aucune transaction simulée ni accès direct au backend Convex PRO.GA.

Monte une coque et un hôte d'appel persistants : navigation, partage et changement de thème
ne recréent pas la salle. Priorité appel → vocal → vidéo ; arrêt réel des pistes à la fin.
Gère AppLifecycle/AppState, passage arrière-plan/premier plan, reprise après arrêt du processus,
faible réseau et événements tardifs. Ne promets pas de survie au force-stop du système.

Demande micro, caméra, notifications et médiathèque au moment utile ; un appel audio n'exige
pas la caméra. Branche notifications ciblées et liens de partage sur une destination autorisée,
avec revalidation de session, destinataire et appel vivant. Implémente CallKit et la chaîne
d'appel entrant iOS adaptée, puis intégration système Android et service requis selon versions.
Vérifie les documentations officielles actuelles ; un push APNs alert n'est pas une chaîne VoIP.

Teste automatiquement transitions, double acceptation, permissions refusées, révocation et jetons
tardifs. Recette sur deux appareils physiques, Android/iOS identifiés : audio/vidéo bidirectionnels,
verrouillage, arrière-plan, démarrage à froid, Bluetooth, interruption système, changement Wi-Fi/
mobile, perte/reprise réseau et raccrochage distant. Contrôle absence de micro/caméra résiduels.

Livre matrice par OS/version/appareil, captures minimisées, mesures et limites. Distingue code,
build local, simulateur, appareil et distribution. Aucun E2EE annoncé sans protocole et preuve
dédiés ; aucun enregistrement d'appel ni publication sur les stores sans demande explicite.
```

**Acceptation :** tranche branchée et vérifiée ; promesse native limitée aux scénarios éprouvés. **Limite :** appareils, fournisseur ou signature manquants restent ouverts.
