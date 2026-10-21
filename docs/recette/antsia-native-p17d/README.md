# ANTSIA P17d — registre de recette native

**État livré : NOT RUN partout.** Base déclarée `c4d36f3`, arbre partagé sale et non gelé.
Aucun build, appareil, OS observé, capture, mesure, appel, configuration fournisseur ou
canal de distribution n'est attesté. Les anciens essais Web en fenêtre étroite et les
preuves d'autres applications ne valent pas recette physique ANTSIA.

Ce dossier prépare la [matrice P17a §5.3](../../etudes/2026-10-18-social-commerce/rapports/P17A_AUDIT_NATIF.md#53-p17d--recette-physique-et-parité)
et conserve les limites de la [reprise P17c](../../etudes/2026-10-18-social-commerce/rapports/P17C_REPRISE_2026-10-20.md).
Le travail de cette tranche porte uniquement sur les sources du registre et de son évaluateur.
Aucun scénario ni script n'a été exécuté.

- `candidate.json` décrit la source exacte et, lorsqu'ils existeront, les builds et appareils.
- `protocol.json` impose les 46 cas iOS/Android, plus deux constats d'arrêt forcé hors readiness.
  Le minimum est un iPhone compatible iOS 16.4+ et un Android physique ≥14 avec services Google.
- `evidence.json` contient les états, références minimisées et observations explicites. Les
  listes de builds, appareils, artefacts et observations sont actuellement vides.
- `packages/social-native/src/native-acceptance.ts` valide les trois formats fermés et calcule
  un rapport pur. Il n'importe ni SDK, ni module serveur, ni API DOM.
- `scripts/native-acceptance.mjs` lit seulement les trois manifestes, avec une borne de 1 Mio
  chacun, puis imprime le rapport. Il ne lit pas les captures ou binaires référencés, ne calcule
  pas leurs empreintes et ne contacte aucun OS, fournisseur, serveur, Git ou outil de mesure.

## Lecture du rapport

Le raccord proposé au manifeste racine est `native:acceptance` →
`bun scripts/native-acceptance.mjs` ; l'option `--json` fournit le rapport structuré. **Ce
raccord n'exécute rien ici.** Bun charge le module TypeScript pur depuis la CLI `.mjs` ; aucun
processus enfant, installation ou commande intermédiaire n'est créé. Aucun fichier n'est écrit.

`valid` décrit la conformité structurelle des manifestes, pas la vérité d'une observation.
`blocked` signale notamment source non gelée, appareil/build manquant, cas non exécuté,
échec ou preuve insuffisante. `deferred` conserve des cas explicitement différés, sans les
convertir en succès. Une déclaration physique complète donne seulement `review_required`.
La CLI sort avec le code 1 lorsqu'elle est bloquée/différée et 2 lorsqu'une revue est requise ;
elle ne fournit aucun code de réussite automatique.

`currentPhysicalEvidenceComplete` signifie uniquement que les déclarations actuelles satisfont
le protocole : références, datation, source, builds réciproques, appareils, OS, réseau,
consentement attesté, contrôles et mesures requises. Les champs `physicalAccepted`,
`distributionAccepted` et `activationAllowed` restent **false**, même dans ce cas. Une revue
humaine des artefacts et une recette autorisée restent nécessaires. Ce rapport n'est pas un
interrupteur de capacité et ne modifie aucune activation.

La preuve est classée `source`, `local_build`, `simulator`, `physical` ou `distribution`.
Les quatre autres niveaux ne remplacent jamais `physical`. Une autre candidature, empreinte
ou source est historique et ne couvre pas le candidat actuel. Un résultat d'arrêt forcé est
un constat séparé, sans garantie de réveil ni contribution à la readiness.

## Consigner une future observation autorisée

Figer d'abord la source exacte, sans changer les fichiers pendant la campagne. Renseigner
un horodatage UTC, un commit/base et une empreinte du snapshot réellement compilé ; ne pas
réutiliser `c4d36f3` comme preuve des modifications sales non identifiées. Les preuves de
build portent plateforme, version, numéro de build, date et référence d'artefact. Les appareils
portent seulement un alias technique local, modèle, OS/version et caractère physique ou
simulateur. Changer d'OS ou de build exige une nouvelle entrée/candidature, sans réécrire
l'identité d'une preuve historique.

Chaque observation référence la source, son build, son appareil, l'heure UTC et le réseau.
Les appels réciproques lient aussi le build et l'appareil de l'autre plateforme. Les mesures
requises sont des observations effectives en millisecondes : push → sonnerie, réponse → média,
fin → extinction des pistes/indicateurs selon le cas. Aucun seuil de latence ou succès de
transport n'est transformé ici en preuve d'audibilité. Les vérifications humaines de l'audio
et de la vidéo dans les deux sens restent explicites.

Les personnes et sessions de recette doivent être consenties ; seule l'attestation booléenne
est consignée. **Aucun nom, compte, identifiant de personne/session, token, numéro, message ou
contenu social n'entre dans le registre.** Pas d'enregistrement audio/vidéo d'appel. Les captures
sont minimisées et les journaux expurgés avant toute référence. Les extensions audio/vidéo,
URLs externes, chemins absolus, paramètres, encodages de traversal et `..` sont refusés.

Les références d'artefacts suivent exclusivement `artifacts/<slug>.<extension>` dans ce dossier
avec une empreinte SHA-256 déclarée. Aucune capture factice, pièce vide ou empreinte de substitution
ne doit être ajoutée. La CLI vérifie la forme des références, pas l'existence des fichiers,
leur contenu, leur empreinte réelle ou l'absence effective de données personnelles. Les artefacts
physiques devront faire l'objet d'une inspection autorisée distincte.

Pour la parité, comparer fil/messages aux parcours Web autorisés. Le commerce couvre seulement
les contrats effectivement livrés **et vérifiés** ; ni transaction simulée ni accès direct à
PRO.GA. Groupe, notifications sociales et parcours non encore branchés restent différés avec
leur limite précise. P17c n'annonce ni plein écran Android garanti, ni réponse verrouillée
prouvée avec SecureStore `WHEN_UNLOCKED_THIS_DEVICE_ONLY`, ni survie à un arrêt forcé.

Aucune publication TestFlight/Play, permission fournisseur, installation ou activation n'est
accordée par ce registre. Ces opérations et la conservation des preuves restent des décisions
séparées du propriétaire.
