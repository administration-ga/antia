# Complément du moteur pour DIASPORALE PD4

Date : 2026-10-17. Base PA8 : `eae3a3e`.

## État de recette au 18 octobre 2026

Le défaut de concurrence du composeur DIASPORALE est corrigé dans le commit
local `9317ec5`. La vidéo exacte de 14,92 secondes a été relue après
rechargement et contrôlée dans la visionneuse sur ordinateur, puis en vue
téléphone émulée. Les boutons **Partager → Copier le lien** des deux réseaux
sont branchés et contrôlés dans Chrome aux deux formats. Le fil ANTSIA s’ouvre
directement sans Réessayer après les rechargements éprouvés.

La vérification commune finale, **session 96367, code 0**, passe **7 212 tests**,
dix typages et dix jobs de tests d’espaces de travail, neuf lints sans erreur
(93 avertissements). Les **1 583 fichiers** de source/configuration sont
strictement identiques avant/après. Le détail et les journaux sont consignés
à la fin de ce document. Il s’agit d’une preuve locale, sans publication.

**La galerie à deux photos reste non validée** : la publication annoncée n’a
pas été identifiée dans le moteur local. Le lien exact est demandé à l’humain
avec le nouveau bouton de copie. La preuve vidéo et les tests automatisés
ne sont pas attribués à cette galerie. Les sections suivantes conservent la
chronologie de l’implémentation et des contrôles.

## Cadre initial de coordination

La demande humaine DIASPORALE porte sur sa visionneuse médias, l’édition des
commentaires et le complément PD4, en coordination avec ANTSIA. DIASPORALE garde
ses consommateurs, ses ports et sa recette. ANTSIA réserve uniquement
`convex/modules/people/profile.ts`, un fichier de tests dédié et le code généré.
La revue DIASPORALE ajoute un correctif minimal du hook partagé
`packages/ui/src/hooks/use-modal-a11y.ts` et son test, réservés à ANTSIA.
Aucun schéma, manifeste ou environnement ne change. Les vérifications lourdes
seront centralisées par DIASPORALE.

## Contrats existants confirmés

- `engagement.editComment({networkId, commentId, body})` est une mutation
  authentifiée réservée à l’auteur d’un commentaire publié, avec relecture du
  parent, adhésion/session vivantes, quotas et modération ; retourne `editedAt`.
- `PostMedia` est exporté, mais sa surcouche est privée au carrousel multi-image.
  Aucun viewer autonome complet mono-image/vidéo n’est exporté. DIASPORALE utilise
  ses DTO gardés et l’overlay public ; aucun identifiant de stockage ni URL inventée.
- `publishMyProfile` lève le retrait : cette mutation ne convient pas à une
  simple édition d’un profil retiré.

## Changement prévu

Ajouter `people.profile.updateMyProfile({displayName, headline?, expectedPersonId?})`,
mutation personnelle globale avec retour `{updatedAt}`. Elle exige une session vivante et
un profil déjà constitué (`handle`, `displayName`, `publishedAt` retenus), non
effacé. Le nom social reste un nom choisi, sans déduction d’un état civil.

Validation par `assertDisplayName` et `assertHeadline`, quotas existants
`person.write` et `person.profile`. L’accroche absente ou vide est effacée. Seuls
`displayName`, `headline` et `updatedAt` sont modifiés. Identifiant, historique,
publication, retrait, confidentialité, consentements, images et facettes restent
identiques. Le profil est rejugé par la politique de modération de la racine puis
l’annuaire est synchronisé dans la même transaction. Un contenu retiré par la
modération refuse toute édition ; une erreur annule toutes les écritures.

Comme les autres réglages personnels, ce contrat ne crée aucune adhésion et reste
accessible à la personne suspendue : les gardes existantes continuent à empêcher
sa découverte dans les réseaux. La lecture publique d’un profil retiré/privé/
suspendu reste fermée après l’édition. Aucune republication ni changement de
consentement ne se produit.

`expectedPersonId` est une preuve de corrélation facultative, systématiquement
envoyée par DIASPORALE depuis l’identité de son écran. Une session qui a basculé
vers une autre personne refuse (`notFound`) avant le traitement du profil. La
destination reste exclusivement `ctx.person._id` ; le client ne choisit aucun
profil. Les refus transactionnels ne consomment pas les quotas.

À la fermeture d’un overlay, le hook retire maintenant les attributs `inert`
qu’il a posés **avant** de rendre le focus au déclencheur. Le navigateur natif
refusait ce focus tant que sa cible était inert. Le test simule ce refus au
moment exact de `focus()` car jsdom ne met pas en œuvre cette propriété ; un
second cas protège l’inertage préexistant d’autres surfaces. Cela ne constitue
pas une preuve de recette Chrome ni une refonte de la pile modale.

## Vérification prévue

Codegen avant typages/tests. Tests avec le vrai schéma, composant de session et
limiteur : édition publiée et annuaire, retrait et confidentialité conservés,
suspension toujours fermante, accroche effacée, nom social choisi préservé,
profil non constitué/effacé refusé, session expirée/révoquée et anonymat refusés,
validation, quotas réels, prélecture et suppression de modération, rollback,
aucune écriture sur un tiers et changement de compte A→B entre lecture et écriture.
Puis `verify` complet centralisé sur le snapshot
coordonné. Aucune publication ni manipulation de données utilisateur réelles.

## Résultat

Sources propres gelées : 17 nouveaux cas moteur et 2 cas UI. Après le codegen
officiel terminé avec code0, DIASPORALE a exécuté ces deux suites en séquence :
**17/17 et 2/2 réussis**, logs relus dans ANTSIA :
`/tmp/diasporale-pd4-identity-backend-targeted.log` et
`/tmp/diasporale-pd4-modal-targeted.log` (17:38 Paris).
Ce sont des preuves ciblées, pas encore un `verify` intégral.

Le backend local a autoactualisé le nouveau contrat après sa reprise :
`health:ping` répond `ok` et un appel anonyme à `updateMyProfile` refuse
`unauthenticated`. Cet appel réel ne prouve pas une recette de session identifiée.

Avant cette reprise, le backend et Next3030 ne répondaient plus ; le watcher
orphelin ANTSIA a été arrêté puis3210 relancé avec le Node22 supporté et le budget
d’analyse local15s antérieur (défaut4s, délais métier/tests inchangés). Aucun
environnement ni donnée n’a été réinitialisé. Le seul cache fermé
`apps/antsia_ga/.next` recréé a été vidé dans le périmètre de l’accord humain déjà
fourni ; aucun cache DIASPORALE ou dossier de données n’a été touché.

L’accord humain pour les deux caches DIASPORALE a été reçu et leur suppression
ciblée effectuée par cette session. Aucun second nettoyage n’est lancé ici.
Le backend a été repris17:38 avec les mêmes paramètres, après fermeture des deux
watchers orphelins et pause de3030 ; codegen et suites ciblées ont suivi.

À17:43, le disque était de nouveau sous200Mio et3210/3030/3031 ne répondaient
plus. Les deux caches DIASPORALE précisément autorisés ont alors été relus sans
serveur ni fichier ouvert : webpack absent, Turbopack recréé supprimé
(19fichiers,112992336octets), espace170→275Mio. Aucun autre nettoyage ici.

L’autorisation humaine de coordonner le chat d’accueil a ensuite été donnée.
Cette session a confirmé son gel et des nettoyages supplémentaires sous son
propre accord humain ; le créneau Gabon a également été rendu. Les accueils/
connexions des deux applications sont conservés et inclus dans la vérification
commune, **hors des cinq chemins du présent commit**.

Premier passage interrompu pour éviter un croisement de réservations CPU ;
aucune preuve intégrale ne lui est attribuée. Le passage suivant a réussi tous
les tests/typages puis refusé une mutation globale du bail de visionneuse au
lint DIASPORALE. Son propriétaire a isolé `claim/owns/release` dans un helper,
sans URL ni donnée personnelle, et repassé52tests média/commentaires. La session
d’accueil a corrigé la porte IDN indisponible et le plancher mobile des liens
légaux, puis repassé46tests ciblés/typage/lint. Ces sources ont été refigées.

**Vérification commune finale : code0,7173tests réussis**, codegen officiel,
dix typages d’espaces de travail et neuf lints sans erreur.
Log : `/tmp/antsia-diasporale-pd4-verify-corrected-final.log`.
94avertissements sont conservés (UI6, social-features74, appANTSIA9, appDIAS5) :
le résultat ne signifie pas « zéro avertissement ».

Comptes du seul passage final : Convex1610, cliquets124, scripts29,
social-domain475, contrats57, API190, UI88, social-features3166,
domainDIASPORALE238, featuresDIASPORALE391, console78, appANTSIA109,
appDIASPORALE618. Les reprises/ciblés ne sont pas ajoutés à ce total.

Empreintes avant/après **1569fichiers identiques**, code/tests/styles/manifeste/
lock ; environnements, documents, cache et code généré exclus.
SHA256 `c1a685a4d04d8b30a71a04d4838b31498ee7de70da22fa6c5a3fdb9e56a09225`.
Snapshots `/tmp/antsia-diasporale-pd4-corrected-source-before.json` et `-after.json`.

Recette navigateur DIASPORALE sur3031 : retour final de son propriétaire,
consigné dans `../DIASPORALE/docs/10_VISIONNEUSE_COMMENTAIRES_IDENTITE_PD4.md`,
relue après ses commits `8a44990`, `baee6c0` et `6c7bb0c` :

- Commentaire et réponse modifiés avec marqueur « modifié », textes persistants
  après navigation ; annulation conservant le texte et rendant le focus.
  Feuille contenue aux largeurs320/375/1280, clair/sombre effectivement joués.
- **Profil retiré édité sans republication implicite**, état relu après
  rechargement ; mode privé désactivé et adhésions conservées à l’écran. Nom
  initial et accroche vide restaurés. Le résultat d’une republication explicite
  activée ensuite reste à relire : incident local de session/budget1s inchangé,
  puis Mac verrouillé confirmé par CUA. Aucun résultat de republication inventé.
- Médias :23tests verts, mais `upload_file` refuse les chemins de fixtures,
  même dans le workspace ; aucun fichier envoyé. Lecture native images/vidéo
  encore ouverte, sans modification de la garde ni contournement du refus.

Déverrouillage manuel demandé par DIASPORALE ; ses opérations Chrome sont
arrêtées pendant cette attente. **PD4 n’est pas clôturé.** Le compte et les
fichiers de recette sont fictifs. Le complément ANTSIA est le commit `0693832`,
cinq chemins, couplé aux commits DIASPORALE ci-dessus. Aucun code n’a changé
depuis les empreintes du passage commun7173/code0.

Le contrôle d’accueil dans l’IAB a été refusé automatiquement sur l’ancien
écran `data:ERR_CONNECTION_REFUSED` de l’onglet : pas de contournement ni autre
navigateur pour cette opération. Le propriétaire attend sa réouverture manuelle.
Son créneau visuel est rendu ; conserver seul3031 à la fin, conformément à sa
demande. Ce refus est distinct des tests verts et de la recette Chrome PD4.

Après le passage vert,3210 a été repris18:02 avec les mêmes paramètres locaux.
Les quatre publications fictives de la recette PA8 ont été relues par l’API
publique : natif network et enfant network absents, natif root présent, enfant
retiré de root absent. Leurs identifiants et ces états sont conservés après les
reprises. Cela confirme ces fixtures, sans prétendre à un inventaire exhaustif
de la base.

Le Cortex reste suspendu : inventaire en lecture seule confirme l’absence de
`.git/HEAD` et d’`avancement.md` ANTSIA dans le vault. Le contexte actif et le
verrou préexistant sont conservés. Aucune réparation, suppression ni écriture
Cortex n’a été tentée. Les commits applicatifs utilisent leurs chemins propres.

## Reprise après déverrouillage — 2026-10-17

L’humain a confirmé le déverrouillage et demandé la fin de la recette médias et
de la vérification commune. Le blocage de verrouillage décrit ci-dessus est
levé. Le premier contrôle trouve 12 449 824 Kio libres et les services arrêtés ;
aucun nettoyage supplémentaire n’est effectué. Le chat d’accueil reprend le
moteur local3210 puis le seul Next3031 en mode moteur, Node22 et Webpack.
Compilation initiale réussie et HTTP200 confirmés par ce propriétaire ; ses
deux services restent conservés, sans lancement de3030.

Les 1569 fichiers de l’empreinte finale ont été relus : aucun fichier changé
ou manquant, empreinte de référence identique. Le passage officiel7173/code0
reste applicable à ces sources ; il n’est pas présenté comme un nouveau
passage. Les modifications d’accueil non committées restent conservées.

Contrôles réels ANTSIA refaits après ce redémarrage : `health:ping` retourne
`ok`, `updateMyProfile` sans session refuse `unauthenticated`, et les quatre
projections publiques PA8 gardent leurs états attendus (deux publications
`network` absentes, publication native `root` présente, publication enfant
retirée de `root` absente). Aucune écriture anonyme ni exposition nouvelle.

DIASPORALE a retrouvé la session fictive et une photo déjà enregistrée dans
le fil. Sa recette Chrome confirme l’image1600×900 effectivement chargée,
l’ouverture depuis l’original et son partage cité, les largeurs320/375/1280,
les thèmes clair/sombre, le confinement de Tab/Maj+Tab et la fermeture par
Échap rendant précisément le focus au déclencheur. Captures inspectées par
son propriétaire. Cette preuve native s’ajoute aux tests automatisés.

Le refus d’accès de `upload_file` aux fichiers de test reste respecté : aucune
nouvelle copie ni autre mécanisme d’envoi essayé. La lecture de médias déjà
présents ne vaut pas recette d’un nouvel envoi. DIASPORALE a atteint la fin des
paginations des fils consultés (81 publications initiales,45diaspora,
82récentes) : la photo et son partage sont les seuls médias disponibles ;
aucune vidéo ni série d’images permettant les deux autres essais. Les deux
ressources image répondent200. Le404favicon est distinct du lecteur.

Après le créneau CPU coordonné, le profil fictif a été réellement relu dans
Chrome : publication enregistrée, action « Retirer mon profil », privé
désactivé. Le formulaire ouvert puis annulé confirme le nom d’origine
« Relations Recette » et l’accroche exactement vide. Annuaire masqué,
consentement annuaire désactivé et adhésions DIASPORALE vérifiée / ANTSIA
déclarée conservés. Son adresse de profil fonctionne à nouveau dans cette
session, y compris après rechargement ; console sans nouvelle erreur. La
republication explicite précédente avait réussi : aucune nouvelle mutation
de republication ni sauvegarde n’a été effectuée pendant ce contrôle.

Les images multiples et la lecture vidéo restent ouvertes faute de médias
existants et d’accès autorisé aux fichiers de test par l’outil. Leur sélection
manuelle humaine dans le composeur normal est nécessaire pour poursuivre ;
aucune garde ni contrôle d’accès n’est désactivé. PD4 reste ouvert jusqu’à ces
constats. Le créneau CPU de DIASPORALE est rendu, ses sources restent gelées.

### Nouvel état d’accueil à inclure dans la vérification

Un contrôle supplémentaire juste avant le commit documentaire détecte six
fichiers ANTSIA modifiés depuis l’empreinte précédente et un nouveau test de
la route `entrer`. Le chat « Lancer l’app ANTSIA localement » a terminé une
autre demande humaine, limitée explicitement à ANTSIA : intentions connexion /
inscription transmises par la page serveur, état de déconnexion incomplète,
présentation et textes de l’accueil. Son dernier tour est terminé et ses
changements restent conservés. Ses contrôles ciblés ne remplacent pas le
passage commun complet.

Le commit documentaire a été arrêté avant toute mise à l’index. Les 7 173
tests sont désormais une preuve de l’ancien instantané. L’inventaire suivant
comprend 1 570 fichiers, dont `apps/antsia_ga/src/app/entrer/page.test.tsx` ;
une nouvelle vérification commune et un contrôle de non-dérive sont requis.
Le serveur ANTSIA3030, identifié par son processus et son dossier de travail,
est mis en pause par SIGINT pour respecter la règle d’un seul Next. Le moteur
3210 et DIASPORALE3031 du chat d’accueil restent conservés.

Le Chrome natif conserve un autre compte fictif, en attente, qui peut relire
le profil republié et les deux commentaires corrigés, sans commande d’édition
ni champ de réponse. Ce contrôle de lecture est réellement joué ; ce compte
et sa session restent conservés. Le composeur auteur dans Chrome DevTools
n’est pas visible dans l’inventaire natif : aucune sélection humaine prête
n’est annoncée dans ce navigateur. Une connexion normale du compte fictif
auteur dans une fenêtre privée visible est la préparation envisagée ; elle
ne vaut ni sélection ni envoi de médias.

### Vérification commune de l’état courant — réussie

Le nouveau `bun run verify` officiel se termine avec **code0 et 7 179 tests
réussis**, le 17 octobre de 19:18 à 19:22 (Paris), session94825.
Journal : `/tmp/antsia-diasporale-pd4-verify-resume-final.log`.
Codegen et typages stricts réussis ; les dix espaces de travail passent leurs
typages et leurs tests, les neuf lints ne signalent aucune erreur. Les
93 avertissements restent visibles : UI6, social-features74, appANTSIA8,
appDIASPORALE5. Aucun contrôle ni délai de test n’a été désactivé ou augmenté.

Ventilation : Convex1610, cliquets124, scripts29, social-domain475,
contrats57, API190, UI88, social-features3166, domaineDIASPORALE238,
surfacesDIASPORALE391, console78, applicationANTSIA115,
applicationDIASPORALE618. Les six cas supplémentaires de l’application
ANTSIA sont inclus dans ce total, les ciblés antérieurs ne sont pas ajoutés.

Les **1 570 fichiers** de code, tests, styles, manifestes et verrou sont
identiques avant et après. Le nouveau test de la route d’accès est inclus ;
les documents, environnements, caches et fichiers générés restent exclus.
Snapshots : `/tmp/antsia-diasporale-pd4-resume-source-before.json` et
`/tmp/antsia-diasporale-pd4-resume-source-after.json`.
SHA256 commun :
`809adebcdcf0f469ab27993c8a98f437728b27cba6cf5e12a7febe4325f3eb51`.
Le préflight confirme également que le backend vivant correspond au
`deploymentName` de la configuration locale ; aucune cible distante utilisée.

Le job lourd est terminé et le créneau CPU rendu. Les services3210/3031 du
chat d’accueil restent actifs ;3030 reste en pause. Les changements des deux
chats d’accueil sont préservés et ne sont pas committés par cette session.
Ce passage valide le code courant ; la recette native des images multiples
et de la vidéo reste ouverte pour la sélection manuelle des fichiers.

Les trois preuves DIASPORALE sont committées localement dans `2df3f43`
(`docs/01`, `docs/04`, `docs/10`), couplées au présent bilan ANTSIA `15004a2`.
Au moment de préparer la fenêtre privée native du compte fictif auteur, CUA
confirme que le Mac s’est de nouveau verrouillé. Le court créneau CPU est
rendu immédiatement ; aucune connexion privée ni sélection ni publication
de fichier n’a eu lieu. Le déverrouillage manuel est demandé, puis l’accès
normal privé devra être préparé avant de présenter la sélection humaine.
Ne pas annoncer un composeur auteur visible et prêt dans le Chrome natif.
Le refus d’accès de l’outil aux fichiers de test reste un blocage distinct du
verrouillage du Mac. Aucun contournement, changement de session existante ni
promotion du compte fictif de lecture n’est effectué.

### Coordination autorisée et applications simultanées

L’humain autorise explicitement la coordination du chat « Lancer l’app
ANTSIA localement ». Ses sources restent figées et sont toujours identiques
aux 1 570 fichiers du passage commun. Une première bascule vers ANTSIA est
effectuée sous son choix « Ouvrir ANTSIA maintenant », après les points sûrs
des deux recettes DIASPORALE et sans fichier sélectionné.

Une nouvelle demande humaine dans le chat d’accueil autorise ensuite
expressément **DIASPORALE et ANTSIA en même temps**, avec consommation mémoire
limitée. Cette demande remplace l’alternance pour cette visite. Le propriétaire
reprend les deux Next en Node22 / Webpack, old-space2048MiB et
UV_THREADPOOL_SIZE2 chacun ; les accueils sont chauffés séquentiellement et
répondent200. L’héritage de la limite est contrôlé dans leurs traces
(heapSizeLimit2096MiB, espaces auxiliaires compris) ; pression normale et
41% de mémoire libre au contrôle du propriétaire. Le backend3210 est conservé.
Aucune source applicative ni environnement persistant modifié.

DIASPORALE reprend normalement son onglet Chrome de test : compte auteur
« Relations Recette » confirmé, brouillon de81caractères restauré, portée
diaspora / tous les membres, partage ANTSIA décoché, aucun média. Une nouvelle
connexion privée n’est pas nécessaire. Le composeur est réellement visible
nativement et la demande de sélection manuelle des deux PNG est présentée
dans ce chat ; aucun envoi automatisé ni publication média effectué.
L’onglet ANTSIA est conservé. Le refus d’accès de l’outil aux fichiers reste
respecté et les essais multi-image / vidéo restent ouverts dans l’attente de
l’intervention humaine.

### Corrections de surfaces et nouvelle sélection — contrôle différé

Deux nouvelles demandes humaines inversent les fonds et cartes. Le propriétaire
ANTSIA ajuste seulement les classes de surfaces de `AccessHomeScreen` et
`SignInCard`, rendu contrôlé à1280/375. Le propriétaire DIASPORALE ajuste son
thème clair, les alias de `extras.css`, la vitrine existante et ses traductions,
ainsi que l’ancienne assertion de contraste incompatible avec ce changement.
Sa charte3.3 et ses captures de `/charte` montrent un fond clair et des cartes
gris clair, neuf contrastes conformes et aucun débordement mobile. Les preuves
visuelles concernent les contextes effectivement observés, sans revendiquer
une recette authentifiée du fil depuis l’IAB anonyme.

Ces huit fichiers de code/style/tests/traductions changent l’empreinte : le
passage7 179 est désormais historique. Le nouvel inventaire en lecture seule
contient encore1 570fichiers, SHA256
`235e940c3c648495c936a57544af2d4d62ae8698d1162ea2f57a2edeb49c71ae`,
préparé dans `/tmp/antsia-diasporale-pd4-surfaces-source-before.json`.
Aucun contrôle lourd n’a été lancé sur cet instantané.

L’humain avait annoncé deux PNG sélectionnés. À la reprise, le propriétaire
PD4 observe une ouverture de session puis le fil sans composeur ; le post
textuel préexistant ne contient aucun média et le composeur rouvert n’a ni
fichier ni aperçu. La cause n’est pas établie : les photos ne sont pas validées
et aucun nouveau post textuel n’est créé pour prétendre à une recette média.

Tous les propriétaires confirment le gel des sources et l’absence d’édition,
HMR provoqué, redémarrage, navigation ou contrôle pendant la nouvelle sélection
manuelle des photos puis de la vidéo. PD4 a déjà rendu la main à l’humain ; le
créneau zéro fichier n’est donc plus garanti. Le codegen et le contrôle officiel
centralisé sont différés jusqu’à sa confirmation de fin des deux essais ou
d’abandon explicite de la sélection. Aucun test ciblé ou codegen parallèle,
aucun changement de garde ; les deux applications restent actives.

### Vérification finale des surfaces figées — réussie

Le créneau média est clôturé par une nouvelle demande humaine de vérification
complète dans le chat d’accueil. Cette clôture n’est pas interprétée comme une
recette photos/vidéo réussie. Une première passe officielle, session80168,
termine avec code0 et7 179tests, mais deux composants ANTSIA changent pendant
son exécution : elle ne constitue pas une preuve d’un instantané stable.

La capture humaine suivante précise que la correction ANTSIA vise `/fil`
connecté en clair, avec choix explicite **fond blanc, cartes beige**. Le thème
`packages/ui/src/themes/antsia.css` est ajusté par son propriétaire, rendu
natif observé et sombre conservé. Ses trois chemins applicatifs sont ensuite
figés, avec les sept chemins de correction DIASPORALE déjà figés.

La reprise officielle **session85261, code0**, valide cet état final :
**7 179 tests**, dix typages et dix jobs de tests d’espaces de travail,
neuf lints sans erreur. **94 avertissements de lint** restent visibles.
Ventilation des tests :6 912Vitest et267Bun (scripts29 et domaineDIASPORALE238).
Journal : `/tmp/antsia-diasporale-surfaces-verify-final-20261017.log` ;
résumé : même préfixe suivi de `-summary.json`.

Les **1 580 fichiers** sont strictement identiques avant/après ; cette couverture
inclut aussi les fichiers de configuration, Dockerfile, HTML et scripts shell.
Inventaires :
`/tmp/antsia-diasporale-surfaces-verify-20261017-source-final-before.json`
et `-after.json`. SHA256 de l’inventaire JSON compact :
`0107f0a643cc31c3f6f2a6dc18a4065b77a9fc7f46e8cc917cc7d581042cd6b7`.
SHA256 des octets des fichiers JSON formatés, identiques entre eux :
`4b8158ed19bf3b879d9dfef65ab15ee1c4242327d65e4e68f75f64a30cf150bc`.
Les deux calculs ont été relus dans ANTSIA, ainsi que le total et les lints
(y compris le groupe singulier d’un avertissement).

Diagnostic médias, lecture seule bornée : la publication fictive précisément
demandée est relue dans le moteur local3210, une seule ligne et identifiant
correspondant vérifié avant toute sortie. Elle est publiée/non retirée, champ
`media` absent, longueur effective0. Seules ces métadonnées sont rapportées,
aucun contenu privé ni secret, aucune mutation. Le moteur conserve les médias
sur ce champ et le résolveur de lecture lit ce même champ : ce constat n’est
pas une simple perte de projection. La cause de l’absence n’est pas établie.

La relecture du composeur confirme l’envoi dès sélection, l’assemblage des
médias prêts au submit et leur transmission par l’adaptateur ; le bouton
« Joindre » est de typebutton. Les fichiers ne font pas partie du brouillon
durable. Ces constats ne prouvent pas une cause de publication sans pièces
jointes. Les autres agents confirment n’avoir pas manipulé ce composeur.
Une observation native montre toutefois AX3030 puis capture3031 sans clic
intermédiaire de l’observateur ; le changement de contexte n’est pas attribué.
Une capture humaine du composeur attendu est demandée par PD4 pour distinguer
fenêtre, profil et état. **Multi-image et vidéo restent non validées.**

Les preuves DIASPORALE sont actualisées dans son commit documentaire local
`e84790a`, uniquement docs01/04/10. Les corrections applicatives des autres
chats restent conservées hors des commits de cette session. Plus aucun job
lourd, les deux Next et le moteur local restent actifs sous mandat humain ;
aucune livraison en production, modification d’environnement ou suppression
de données.

### Reprise du 18 octobre — course du composeur corrigée

La capture annoncée dans les deux chats n’est pas jointe aux messages reçus.
Le propriétaire DIASPORALE réserve à cette session son `composer.tsx`,
l’adaptateur et leurs tests ; il conserve la recette Chrome native. Les deux
serveurs Next et le même backend local sont repris par leurs propriétaires,
sans suppression de données ni modification d’environnement.

Le vrai composeur transmet correctement deux médias prêts, dans l’ordre choisi,
même si les dépôts terminent dans l’ordre inverse. Un dépôt refusé bloque la
publication, et fermer/rouvrir la feuille conserve ses pièces. En revanche, une
sélection **pendant une publication déjà partie** appelle encore `uploadMedia` :
les aperçus tardifs apparaissent, mais la requête initiale ne contient aucun
média et son succès les efface. Ce défaut est reproduit ; son lien avec les
deux anciens posts textuels reste non établi.

Correction minimale dans le composeur DIASPORALE réellement servi : verrou
synchrone avant validation, double envoi et événement de sélection tardif
ignorés, contrôles gelés pendant l’envoi, verrou libéré même après refus.
Sept nouveaux tests couvrent ce défaut, les deux photos, les refus, la reprise
avec les mêmes dépôts/clé, la vidéo seule et la validation refusée. Aucun
contrat moteur, adaptateur, garde des fichiers, thème ou environnement modifié.

Le passage officiel **session53670, code0** valide **7 186 tests**
(6 919Vitest +267Bun), dix typages, dix jobs de tests et neuf lints : zéro erreur,
94avertissements préexistants. Les **1 581fichiers** de sources/configuration
sont strictement identiques avant/après. SHA256 du JSON compact :
`a85d56b7e759a20422e290a2439b7d784e123580b2b4ffbddcbc88b3e91f439a`.
Journal `/tmp/antsia-diasporale-media-verify-20261018.log`, résumé même préfixe
suivi de `-summary.json`, inventaires
`/tmp/antsia-diasporale-media-20261018-source-before.json` et `-after.json`.
Le créneau lourd est rendu après ce passage ; aucun contrôle parallèle.

La session auteur fictive DIASPORALE est ouverte par le parcours normal dans
une fenêtre privée séparée. Le compte de lecture en attente est conservé.
La prochaine recette utilise un composeur **sans texte** pour que l’absence de
pièces ne puisse produire un nouveau post textuel. Les fichiers doivent être
sélectionnés manuellement après préparation ; la limite d’accès de l’outil de
transfert n’est pas contournée. **Les deux photos et la lecture vidéo réelles
restent à confirmer**, distinctement de cette vérification automatisée.
La preuve de correction détaillée vit dans DIASPORALE `docs/12`.
Le correctif et ses sept cas sont enregistrés dans le commit local DIASPORALE
`9317ec5`, limité au composeur, à son test et à cette preuve documentaire.

Actualisation de la préparation native : deux fenêtres privées n’ont plus été
retrouvées par le contrôle, sans cause établie. Une page du Chrome DevTools
distinct montre bien le compte auteur et un composeur vide, mais sa présence au
premier plan natif n’est pas prouvée : elle ne sert pas de passage de main.
Une dernière fenêtre privée native est ensuite présente, mais rencontre une
connexion refusée puis un `ChunkLoadError`. Aucun fichier ni clic de publication.

Le journal du propriétaire de3031 confirme un redémarrage **automatique** au
seuil mémoire pendant la compilation de `/bienvenue`, parent82353 conservé,
worker82354 remplacé par94491. Aucune purge ni relance doublée. Après compilation,
les deux applications répondent ; la relecture indépendante donne `/bienvenue`
200 en0,115s et `/_next/static/chunks/app/layout.js` 200 en0,167s. Un rechargement
normal de la même fenêtre auteur est demandé pour reprendre les nouveaux chunks.
Ce constat n’établit pas la cause des deux anciens posts sans média.

Un chantier humain distinct corrige ensuite la session d’entrée ANTSIA dans
`session-bridge.tsx` et son test. Son propriétaire rapporte24tests ciblés,
typage/lint et recette du fil réussis. Ce changement **postérieur** n’est pas
inclus dans l’inventaire de la vérification7 186 ci-dessus ; aucun paquet auth
partagé ni composeur DIASPORALE n’est modifié par ce chantier.

Dernière observation avant passage de main : le rechargement normal réussit,
le compte auteur privé est confirmé et son composeur natif est ouvert avec
corps0/2000, zéro pièce, portée France par défaut, tous membres, ANTSIA décoché.
À l’observation suivante, le contrôle revient au Chrome normal du lecteur en
attente, sans geste de sélection/fermeture attribuable au contrôleur. Aucune
portée n’est changée et aucun fichier/Publish n’est envoyé. Le contrôle natif
est arrêté. L’intervention requise est uniquement de placer la fenêtre privée
auteur « Relations Recette / Nouvelle publication » au premier plan et de la
laisser stable, avant toute nouvelle sélection de fichiers. Les médias réels
restent non validés ; la cause du changement de fenêtre est inconnue.

L’humain confirme ensuite « Fenêtre auteur au premier plan ». Les autres
contrôles sont suspendus. L’observation native ne corrèle toujours pas ce
contexte : AX `chrome://newtab` du profil habituel puis capture du fil ANTSIA
`localhost:3030/fil`, sans clic du contrôleur intermédiaire. Capture de diagnostic
`/tmp/diasporale-native-surface-20261018.jpg`, inspectée dans ce chat : elle ne
montre pas le composeur demandé. Un nouveau processus Chrome et de nouveaux
identifiants d’onglets sont constatés ; aucun rapport Chrome du jour trouvé
dans le dossier utilisateur consulté, aucune cause de redémarrage établie.
Aucun média ni publication envoyé. La prochaine identification doit passer par
une pièce jointe réellement reçue ou le partage direct de l’onglet souhaité,
plutôt que par une nouvelle sélection de fichiers à l’aveugle.

Nouveau point exploitable : pendant un contrôle mobile distinct, le fil du
lecteur montre une publication existante de Relations Recette, texte « test »,
avec un lecteur vidéo arrêté à0:00/0:14 et « Agrandir la vidéo ». Son lien lu
dans l’interface est `/publication/kn795ekrtd65evydvry3973ff58gh306`.
Les captures DIASPORALE `docs/recette/fils-mobiles-2026-10-18/`
`diasporale-375x667-haut.jpg` et `-cartes.jpg` sont des observations de présence,
pas de lecture. La seconde est inspectée ici.

La lecture backend en une ligne, sans mutation, vérifie l’identifiant exact
avant toute sortie : statutpublished, texte correspondant, `media.length=1`,
vidéoMP4,22 869 119octets,1290×2796, durée déclarée14 920ms et référence de
stockage présente. Ni clé ni URL de stockage ni contenu privé rapporté. Cela
confirme son enregistrement actuel ; aucune attribution de création à cette
session ni confusion avec la mire muette de2s. Le créneau UI est réservé à
PD4 pour la lecture/pause/visionneuse de ce post existant, sans nouvel upload
ni publication. Les deux photos restent non validées.

Premier résultat natif du post exact, onglet313 : lecteur en attente corrélé,
vidéo décodée1 290×2 796, durée14,92s, `readyState=4`, aucune erreur.
La lecture du fil progresse de0 à2,448s puis pause constatée à2,461s.
La visionneuse s’ouvre avec le focus sur Fermer, compteur1/1, sa propre vidéo
à0 en pause et sans autoplay ; celle du fil reste en pause à2,461s.
La suite termine le contrôle : visionneuse de0 à7,696s puis pause à7,708s,
Tab/Maj+Tab contenus, Échap ferme et rend le focus au bouton d’agrandissement.
Un second cycle confirme la pause de la grille lors de l’ouverture et le
démontage de la vidéo de la visionneuse en fermant pendant sa lecture.

Dans le détail du post exact, après rechargement normal unique, le même lecteur
en attente est conservé. La vidéo est redécodée sans erreur ; la grille
progresse de0 à7,198s puis pause à7,210s, la visionneuse de0 à5,093s puis pause
à5,106s. La capture `DIASPORALE/docs/recette/pd4-video-2026-10-18/`
`visionneuse-pause-5s.jpg` et son `preuve.json` sont relus ici : lecteur à0:05,
durée et mesures cohérentes. Bureau clair1 100×690, sans débordement horizontal.
Retour final au fil : aucun dialogue, vidéo en pause à0, aucune erreur ni
avertissement console. Aucun upload ni publication par les agents. La piste
audio, un appareil physique et les variantes responsive/sombre de cette vidéo
ne sont pas éprouvés par ce contrôle.

L’inventaire est borné aux30cartes déjà chargées, sans pagination : une vidéo,
aucune image ; les trois posts d’essai photos identifiés n’ont aucun média.
La recette de galerie à deux photos reste donc ouverte. La méthode de reprise
proposée à l’humain est de publier manuellement deux photos **sans texte** puis
transmettre leur lien ; ce schéma bloque un nouveau post sans média et permet
au lecteur corrélé de vérifier ensuite stockage, rechargement et galerie, sans
dépendre du ciblage de la fenêtre auteur ni contourner le transfert refusé.

L’humain confirme ensuite dans les deux chats DIASPORALE que les deux photos
sont publiées sans texte. Un seul pilote est conservé : le chat des accueils
possède désormais l’onglet313, PD4 respecte cette propriété et reste hors UI.
Après Récents et un rechargement normal, aucun nouveau post sans texte à deux
photos n’est visible. La lecture backend est bornée à une ligne et ne sort
qu’un booléen de corrélation : la dernière publication reste exactement le
post vidéo déjà vérifié. Aucun candidat supplémentaire n’est donc déduit.
Le lien exact de la publication annoncée est demandé à l’humain par les
accueils ; cette information conditionne la recette ordinateur puis téléphone.
Aucune nouvelle publication, sélection ou pagination à l’aveugle.

Le propriétaire ANTSIA transmet ensuite le gel final de cinq fichiers du pont
de session. Le délai de transport client passe à 15 secondes, tandis que la
vérification serveur conserve sa borne de 4 secondes. Les réponses valides
initiales à 5 secondes, l’annulation et les réponses tardives sont couvertes :
29 tests ciblés passent, ainsi que le codegen, le typage et le lint ciblés.
Trois ouvertures réelles du fil après relance/rechargement, dont une au format
téléphone, aboutissent sans Réessayer. La preuve
`docs/recette/session-sans-reessayer-2026-10-18/README.md` est relue ici, ainsi
que sa capture : fond blanc, cartes beige, fil connecté, aucun écran d’erreur.
Cette évolution n’est pas couverte par le passage historique à 7 186 tests.

L’humain indique également que le partage ne propose pas de lien et demande
explicitement le bouton de partage dans le chat des accueils. Ce chat prend
seul en charge le correctif des cartes/du partage et des traductions associées :
copier le lien d’une publication lisible reste une lecture ; citer dans le fil
conserve les conditions de publication existantes. Le lien exact des deux
photos reste attendu. La prochaine vérification commune attend le gel de ce
correctif et inclura les cinq fichiers ANTSIA, sans contrôle lourd concurrent.

Le correctif Partager est ensuite figé dans cinq chemins DIASPORALE : le
composant de partage, la carte, son test et les deux traductions. Onze tests
ciblés passent, avec codegen et typage ciblé réussis. La recette Chrome du
lecteur confirme la copie et son message de réussite sur ordinateur et en
émulation iPhone SE 375 × 667, puis le retour du focus à Partager après Échap.
Le document et le panneau mesurent 375 pixels sans débordement horizontal.
La preuve `DIASPORALE/docs/recette/partage-2026-10-18/README.md` est relue ici.

Cette même recette complète la vidéo exacte en vue téléphone : lecture réelle
jusqu’à 2,914 secondes, pause à 2,928 secondes, agrandissement sans lecture
automatique et fermeture par Échap avec retour au déclencheur. La capture
`telephone-video.jpg`, inspectée ici, montre la même vidéo de 14 secondes dans
la visionneuse. Il s’agit d’une émulation locale, sans preuve sur appareil
physique ni contrôle de la piste audio. L’émulation et l’inspecteur sont fermés
à la fin. Les deux photos restent non identifiées et non validées.

Le passage commun est lancé une seule fois en session 36733, après inventaire
de 1 582 fichiers. La configuration de lancement présente est maintenant
incluse, en plus du périmètre précédent. Le gel reçu pendant le début du
passage est confronté à l’inventaire initial : empreinte strictement identique,
`2aee6e37b83e52ab1d44909eab2e646878d1d63736fdaedb69ad6abe5c7adef6`.
Journal `/tmp/antsia-diasporale-final-verify-20261018.log`. Le passage termine
avec **code 1**, sur le contrôle typographique français de la nouvelle clé
`post.shareActions.copyFailed` : une espace ASCII précède le deux-points.
Les 404 autres tests du paquet, dont les onze cas de la carte/du partage,
passent. L’inventaire après confirme les mêmes 1 582 fichiers et la même
empreinte ; cet échec est donc reproductible sur un état stable. Aucun lint
global ni test des applications suivant ce paquet n’est présumé exécuté.

Correction limitée à cette clé : remplacement par une espace insécable U+00A0.
Avant la relance, l’humain demande dans le chat des accueils le même bouton de
partage dans ANTSIA. La prochaine passe complète est différée pour inclure ce
petit ajout et éviter deux exécutions successives. Son propriétaire peut
modifier uniquement les cartes/actions de partage, leurs traductions/tests
et l’injection de route associée ; les cinq fichiers d’auth restent gelés.
Le créneau lourd est rendu pendant ce travail ciblé. Aucun nouveau résultat
global vert n’est annoncé à ce stade.

Le partage ANTSIA est ensuite figé dans neuf chemins, sans backend, thème ni
fichier d’auth modifié. Le dialogue existant propose la copie du lien membre
injecté par `engineRoutes.post = routes.memberPost` ; la citation reste un
geste séparé, soumis à l’audience et à la disponibilité de l’original. Sans
route ni citation possible, le bouton est masqué. Les 41 tests/assertions
ciblés, le codegen et le typage ciblé passent. Le lint ciblé n’a aucune erreur.

La preuve `docs/recette/partage-2026-10-18/README.md` et la capture téléphone
sont relues ici. Chrome confirme « Lien copié. » sur ordinateur et en
émulation 375 × 667 ; le lien ouvre exactement la publication F3 attendue,
Échap rend le focus à Partager, et le document reste large de 375 pixels.
Le dialogue mesure 343 pixels avec un bord de 16 pixels. Les neuf empreintes
de la preuve correspondent au source actuel et à l’inventaire du passage
commun. Aucun envoi ni changement de session pendant cette recette.

Nouvelle exécution commune unique après ce gel : **session 48757**, journal
`/tmp/antsia-diasporale-final-recheck-20261018.log`, inventaire de **1 583
fichiers**, SHA256 compact
`2573f493635bba14d916f9623cf48c26e35a3cd99a16ac7d0e4f916cb13d45bd`.
Les sources des trois propriétaires restent figées pendant le passage.
L’inventaire après est identique. Le passage termine néanmoins avec **code 1**
sur le seul test de copie refusée DIASPORALE : la requête `findByText` normalise
l’espace insécable du DOM, contrairement à son attente textuelle exacte.
Les locales et les 404 autres tests du paquet passent. Les 3 175 tests des
composants ANTSIA passent également ; aucun résultat global vert n’est déduit.

Correction du test uniquement : attendre le rôle accessible `alert`, puis
comparer son `textContent` brut à la traduction exacte, y compris U+00A0.
Cette assertion vérifie à la fois l’annonce accessible et le texte français,
sans affaiblir le cas de refus ni changer le comportement. Le codegen est
réexécuté avec succès, puis tout le paquet DIASPORALE et son typage sont lancés
avant la prochaine vérification complète. Les sources ANTSIA restent figées.

Le ciblé complet termine avec **405/405 tests** et typage code 0. Le nouveau
passage officiel **session 96367** termine ensuite avec **code 0** : **7 212
tests** (6 945 Vitest et 267 Bun), dix typages, dix jobs de tests et neuf lints,
**zéro erreur, 93 avertissements**. Aucun contrôle ni assertion n’est supprimé.
Les 1 583 fichiers de source/configuration sont identiques avant/après ; SHA256
du JSON compact :
`79d3b36c8e4612d090aebbc77d28637d2d30495a4823c581b7874006b6c242b0`.

Preuves de ce dernier état :

- Journal `/tmp/antsia-diasporale-shared-verify-20261018.log`.
- Résumé `/tmp/antsia-diasporale-shared-verify-20261018-summary.json`.
- Inventaires `/tmp/antsia-diasporale-shared-verify-20261018-source-before.json`
  et `-source-after.json`.
- Capture et reçu du partage ANTSIA : `docs/recette/partage-2026-10-18/`.
- Capture et reçu du partage/vidéo téléphone DIASPORALE :
  `../DIASPORALE/docs/recette/partage-2026-10-18/`.
- Vidéo bureau et rechargement :
  `../DIASPORALE/docs/recette/pd4-video-2026-10-18/`.

La dernière lecture backend est limitée à une ligne et confirme encore que
le dernier post est la vidéo exacte déjà vérifiée ; aucun nouveau post photo
n’est déduit. La question humaine demandant le lien de la publication à deux
photos reste ouverte. Le créneau lourd est rendu ; aucun autre job n’est lancé.
