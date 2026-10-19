# PA9C — Agents volontaires, consentement et retrait

18 octobre 2026. Implémentation dans les sources ANTSIA, sans exécution de
vérification, génération de code, test, lint, compilation ou recette. Aucun
commit, changement d'environnement ni publication. La configuration IDN et le
producteur du socle restent distincts de ce travail.

## Parcours branché

Dans « Mes données », la carte « Apparaître comme agent public » présente la
finalité, la version courante du texte, les dates serveur et l'état de l'accord.
La case est initialement décochée. Un changement de version impose une nouvelle
lecture et un nouveau geste. Les erreurs restent visibles ; les envois concurrents
sont bloqués. Le retrait reste accessible sans adhésion active ni source disponible.

Un accord nouveau nécessite une personne ANTSIA existante, un profil choisi déjà
publié, une adhésion racine existante active, sans suspension, et une identité IDN
préexistante corrélée au compte Better Auth, au lien vivant et à une preuve de
niveau au moins 2. L'émetteur configuré doit viser le réseau `administration`
miroir actif, enfant de la racine ANTSIA. Le client ne fournit aucun sujet IDN,
rôle ou organisation. Cette étape ne crée aucune adhésion.

L'accord personnel `administration_reflection` utilise le texte `2026-10-18`.
Sa porte métier est exclusive : l'API générique de consentement ne peut pas le
créer. Le texte visible autorise le badge Agent public, l'administration et la
fonction, sous réserve des règles de confidentialité du profil.

## Rapprochement signé

Le grant personnel conserve une référence de consentement opaque renouvelée à
chaque nouvel accord et une référence d'agent dérivée de son empreinte. Le futur
transfert PA9D remettra ce matériel au producteur via un parcours authentifié ;
`myTransferGrant` le limite aujourd'hui au titulaire connecté. Il ne remet jamais
le sujet IDN au client.

`person.optin` exige le nonce exact, le même sujet IDN confirmé et le timestamp
exact de l'accord local (`consentedAt = grantedAt`). La référence d'organisation
vise une page administrative officielle active du même émetteur/environnement.
Les révisions sont monotones ; même révision et contenu différent = conflit.
L'identité IDN et l'éligibilité sont relues dans la transaction d'application.

L'attestation crée uniquement le lien `administration` et l'adhésion enfant
`verifiee/federation`, au rôle `member`. La racine existe déjà et n'est pas modifiée.
Une adhésion suspendue n'est pas réactivée ; une adhésion active étrangère au grant
n'est pas adoptée. Le nom, le handle et l'accroche ANTSIA restent ceux de la
personne, même si le contrat transmet un nom choisi côté socle.

Le badge est calculé à partir du grant, du consentement courant, des liens/preuves
IDN vivants, de l'adhésion et de la source/page encore disponibles. Les hooks de
réconciliation IDN révoquent l'accord lors de perte, remplacement ou dégradation
de l'identité. La fiche publique ajoute l'administration et la fonction seulement
après ses gardes habituelles ; aucune preuve privée n'entre dans son DTO.

## Retrait et données

Le retrait local, la révocation générique du consentement et `person.optout`
révoquent le consentement, le lien et les effets du grant. Le départ de la racine
ou du réseau administration, le retrait du profil et la demande d'effacement
révoquent également ces effets. Les autres réseaux et le profil indépendant sont
conservés. Une sanction reste une sanction ; elle n'est pas transformée en départ.
Le retrait est idempotent et une révision source supérieure ne le lève jamais.
Un nouvel accord produit un nonce et une référence d'agent distincts.

`federationAgentGrants` est une table personnelle avec propriétaire typé. Son
export projette statut/dates/génération/fonction, sans empreintes d'identité,
nonce ni référence de transport. Son effacement suit celui de la personne.
Aucune tombe IDN pseudonymisée n'est conservée indéfiniment : un ancien message
ne correspondra plus au nonce d'un nouvel accord après effacement.

Les nouveaux événements personnels ne stockent jamais leur corps en lettre morte.
Un refus métier rend un reçu `discarded` contenant seulement les métadonnées et
l'empreinte du corps. Le sujet IDN n'est autorisé qu'à la racine d'un payload
personnel de ce contrat. Aucun sujet brut ne figure dans le lien administration,
le journal ou la projection publique. Le corps d'une éventuelle lettre personnelle
historique est expurgé lors d'une demande de rejeu, sans application. Cette logique
n'est pas une preuve de purge de données historiques en service.

## Reste ouvert

- PA9D : producteur/outbox du socle, reprise typée de ce contrat et transfert du
  consentement, PR relue, configuration propriétaire et recette croisée de développement.
- Les scénarios purs et backend PA9C sont écrits, **non exécutés** : inconnus,
  consentement, nonce, révision/retrait/nouvel accord, suspension, IDN, badge,
  source/page, export et absence de corps personnel en DLQ.
- La génération Convex puis les contrôles globaux et les parcours réels sont
  différés sur demande humaine. Aucun résultat PA8/PA9A/PA9B ne valide PA9C.

Contrat : [RESEAU-PUBLIC-V1](contrats/RESEAU-PUBLIC-V1.md).
Décision : [ADR-0015](adr/0015-agents-volontaires-et-accord-local-renouvelable.md).
