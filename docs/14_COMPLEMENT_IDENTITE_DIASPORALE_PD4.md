# Complément du moteur pour DIASPORALE PD4

Date : 2026-10-17. Base PA8 : `eae3a3e`.

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
