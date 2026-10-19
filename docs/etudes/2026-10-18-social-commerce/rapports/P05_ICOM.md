# P05 — Conversations, appels et notifications Web

18 octobre 2026. Reprise du travail Claude, sur demande explicite du propriétaire :
« Continue le lot iCom (P05) à partir du travail de Claude, sans relancer les vérifications. »
Références : [prompt P05](../prompts/P05_ICOM.md),
[conception](../05_MESSAGES_ET_APPELS.md), [journal d'exécution](../EXECUTION.md).

**Verdict : sources raccordées ; tests écrits/étendus, non exécutés ; recette réelle ouverte.**
Aucun résultat historique de Claude n'est présenté comme une validation de cette reprise.

## 1. Navigation et présentation

ANTSIA active, par sa navigation `destinations`, une page Messages à trois vues :
**Conversations · Appels · Contacts**. Les appels et contacts réutilisent les composants
existants et leurs gardes. Les applications sans cette capacité conservent leur aiguillage.

- Téléphone : liste puis conversation ou composeur en pleine page, retour vers le réseau.
- Bureau : liste et détail sur la même page ; la destination Messages du rail ouvre cette
  page, au lieu d'intercepter le clic pour détacher le téléphone compact.
- Barre de membre et sortie conservées sur bureau et liste téléphone ; conversation et
  composeur restent immersifs au téléphone. Un seul élément principal par page.
- Filtres Toutes / Non lues / Groupes, recherche et chargement supplémentaire des fils 1:1.
  Les pastilles utilisent les décomptes serveur, avec leurs bornes, sans total de fils inventé.
- Recherche, filtre, dernière vue, profondeur chargée et position sont retenus en RAM par
  réseau, personne et pose. Au retour, la liste recharge sa profondeur avant de rétablir sa
  position. La frontière de mémoire est montée dans la coque persistante, pas dans le dock.

**Limites explicites :** la source des groupes reste une fenêtre des 50 premiers groupes ;
recherche et filtres portent sur les données chargées. Cette portée est annoncée. Les états
internes de Contacts et du Journal restent ceux de leurs composants actuels. Le filtre
Boutiques demeure réservé à P10 et n'est pas présenté comme opérationnel.

## 2. Envois, pièces et brouillons

Les outils purs laissés par Claude sont branchés sur les envois 1:1, de groupe et le premier
message. Une clé est associée à une intention comprenant cible, texte, pièces et citation :
un réessai identique garde cette clé ; un contenu différent en reçoit une nouvelle.

Le composeur possède un verrou immédiat contre le double appui. La trace locale indique
« Envoi en cours », puis l'admission est rattachée au `messageId` rendu par le serveur.
Elle disparaît seulement lorsque ce message est effectivement projeté dans le fil.
La nouvelle présentation est réservée à ANTSIA.

En cas de refus, texte, citation et pièces restent disponibles. Une réponse ancienne ne
réinjecte rien dans un autre contexte ou après fermeture du composeur. Le passage d'un
premier brouillon au fil créé attend le nettoyage des pièces : la lecture du nouveau fil ne
doit pas démonter le composeur au milieu de cette opération.

L'admission ne vaut pas réception sur appareil. Aucun statut « Livré » n'est ajouté.
L'indication de lecture reste fondée sur les preuves `readAt` existantes. Les gardes de dépôt,
d'admission des fichiers, de relation et de lecture ne sont pas élargies.

### Ajustement serveur nécessaire

`messaging.inbox.startThreadWithHandle` accepte une clé d'idempotence facultative. Après les
gardes existantes, le helper retrouve un éventuel message avant une nouvelle admission des
pièces. Le rejeu doit appartenir à l'auteur courant. La même vérification d'auteur est ajoutée
aux portes d'envoi 1:1 et de groupe : la clé d'un autre auteur ne produit pas un faux succès.
Les clés sont bornées et excluent les contrôles ; les anciennes clés opaques restent admises.
Aucun schéma ni index nouveau n'est introduit.

## 3. Appels Web

La reprise conserve l'hôte global et le pool de salles à leur emplacement persistant.
Le changement de page ou de pose ne crée qu'une nouvelle surface d'affichage.

- Un slot terminé n'est plus réaccepté depuis une ancienne carte.
- Jeton, admission et erreur sont liés à une tentative et à l'identité courante ; les
  réponses périmées et callbacks d'une ancienne salle ne réhydratent pas l'appel suivant.
- La connexion et la reconnexion de la salle alimentent aussi la pilule globale ; la
  présence d'un jeton ne suffit plus à afficher un appel connecté.
- Le chronomètre conserve le premier repère d'établissement observé : salle connectée et
  participant distant présent. Cela ne prouve pas l'audibilité ni la qualité du média.
- Les appels parqués restent observés : fin distante ou accès devenu nul retirent leur salle.
- Le nettoyage réel de l'hôte quitte les appels et purge la ligne ; le nettoyage simulé de
  React StrictMode ne provoque plus de raccrochage.
- Un rappel admis après fermeture de l'hôte est quitté sans rouvrir de slot ; les doubles
  rappels sont verrouillés.

L'appel audio garde la caméra inactive au départ. La sortie individuelle d'un groupe utilise
le cycle existant ; elle n'est pas transformée en fin globale. Aucun nouveau protocole natif,
chiffrement, droit d'appel commercial ou changement de plafond de groupe n'est introduit.

## 4. Notifications ciblées et session

Le worker Web conserve uniquement la référence opaque du job dans les données de l'avis.
Le texte affiché est neutre. Les champs supplémentaires sont refusés et l'adresse fournie
par le payload n'est jamais suivie : seules les routes de l'application composent la cible.
Le clic réutilise une fenêtre de même origine ou ouvre une fenêtre de cette origine.

La porte membre `/notifications/ouvrir` utilise la query préparée par Claude,
`notifications.open.resolveOpenTarget`. Le serveur relit le destinataire, le réseau, les
droits actuels du sujet et la sonnerie. Un jeton d'ouverture aléatoire facultatif renouvelle
la clé de lecture pour ne pas naviguer depuis une ancienne réponse en cache ; ce jeton ne
confère aucun droit et n'est pas stocké.

Une notification de contenu rejoint la destination composée par `notificationTarget`. Un
avis d'appel rejoint **Appels**, où les listes et l'hôte relisent leur état. Aucun avis ne
décroche, ne rejoint une salle ni n'allume une caméra automatiquement. Une référence expirée,
refusée ou inexistante reçoit le même repli neutre. Une erreur n'autorise pas l'utilisation
d'une ancienne destination. Cette ouverture ne marque pas l'avis comme lu.

Si la session doit être rétablie, l'identifiant opaque est conservé entre connexion,
inscription et bienvenue, puis la notification est relue. Le retour de publication P03
reste prioritaire lorsqu'il est fourni ; sessions restreintes et déconnexion incomplète
gardent leur barrière. Les cinq fichiers gelés du pont de session ne sont pas modifiés.

Le worker d'un navigateur déjà inscrit devra recevoir sa version actualisée selon le cycle
normal de mise à jour du navigateur ; aucune réception ou ouverture réelle n'a été éprouvée.

## 5. Fichiers principaux

| Domaine | Sources |
|---|---|
| Vues et retour | `messagerie/MessagesRoute.tsx`, `IcomMessagesPage.tsx`, `MessagerieListView.tsx`, `MessagerieDock.tsx`, `icom-views.ts`, `messagerie-list-state.ts`, `messagerie-styles.tsx`, barre iCom mobile |
| Envoi | `MessagerieConversationView.tsx`, `MessageComposer.tsx`, `use-conversation-send.ts`, `OutboxMessages.tsx`, `messagerie-send-intent.ts`, `messagerie-outbox.ts` |
| Serveur envoi | `convex/modules/messaging/{inbox,threads,messages}.ts`, `convex/modules/groups/messages.ts` |
| Appels | `features/iappel/{CallRoomMount,CallStage,call-phase,call-establishment,use-call-slot-connector,use-iappel-actions}`, `shell/communication/global-call-surface-host.tsx` et compléments Claude conservés |
| Application | `components/messages/messages-screen.tsx`, `network-shell.tsx`, rail de destinations, route/écran d'ouverture de notification, worker, routes et continuation d'accès |
| Serveur notification | `convex/modules/notifications/open.ts` et tests associés |
| Traductions | FR/EN messagerie/iappel et textes d'ouverture de notification ANTSIA |

PA9B, fédération, publications, boutiques et DIASPORALE restent dans leurs périmètres respectifs.
La coque commune conserve ses variantes historiques hors activation ANTSIA.

## 6. Tests préparés, sans exécution

Suites nouvelles ou étendues : vues/listes et restauration/purge ; intention d'envoi,
composeur, admission et traces locales ; premier message et rejeu d'un autre auteur ;
connecteur, pool et hôte d'appels ; worker et origine ; ouverture fraîche de notification,
erreur avec cache et continuation de connexion.

Les scénarios d'appel couvrent notamment les réponses tardives, une nouvelle entrée dans un
groupe, le refus de périphérique, la reconnexion, la fin d'un appel parqué et StrictMode.
Les assertions frontend n'établissent pas une preuve audio/vidéo réelle.

**Commandes de vérification exécutées : aucune.** Aucun test, codegen, typecheck, lint,
build, navigateur ou commande Convex n'est lancé pendant cette reprise. Lecture et édition
des sources seulement ; aucun commit, changement de service ou déploiement.

## 7. Clôture et retour arrière

Avant de déclarer P05 validé : génération officielle et contrôles ciblés puis communs sur
source stable, recette téléphone/bureau clair/sombre, réessais réels avec fichiers et vocal,
audio/vidéo dans les deux sens, groupe à trois comptes autorisés, permissions refusées,
navigation/thème/reconnexion/raccrochage et absence de pistes résiduelles. Notifications :
fournisseur configuré, réception, mise à jour du worker et clic réellement éprouvés.

Le code P05 est raccordé mais **la vérification et la recette restent ouvertes**. Les preuves
natives et de fournisseurs demeurent distinctes. Désactiver la navigation `destinations`
restitue la présentation historique de la messagerie ; les gardes, clés facultatives et
protections contre les réponses tardives restent applicables. Aucun message ni engagement
existant n'est supprimé pour ce retour arrière. P07 reste commencé et n'est pas exécuté ici.
