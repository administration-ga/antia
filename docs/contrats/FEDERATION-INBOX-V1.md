# FEDERATION-INBOX-V1 — transport entrant d’ANTSIA

Statut : transport PA5, complété dans le code local par PA9A/PA9B/PA9C le 18 octobre 2026.
`RESEAU-PUBLIC-V1` prend en charge `page.upserted`, `post.published` et
`post.removed`, `person.optin` et `person.optout` ; les événements personnels
exigent un accord local corrélé et ne créent aucun profil. P09 ajoute le handler
catalogue `PRO-COMMERCE-PUBLIC-V1` pour boutiques/offres/disponibilité, sans emplois P15.
Les vérifications de PA9A/PA9B/PA9C et P09
sont différées à la demande du propriétaire. Aucun émetteur ni secret réel n’est
créé par l’implémentation.

P08 ajoute une corrélation technique aux réponses admises : `eventId`, `bodySha256`
et `applicationStatus` (`received`, `applied`, `rejected`). Le statut historique reste
présent : `dead_letter` et `discarded` correspondent à `rejected`, jamais à une
application métier. Un HTTP 202 seul ne prouve donc pas cette application.
`PRO-COMMERCE-PUBLIC-V1` est validé sur ses octets canoniques avant un nouveau reçu,
et son handler catalogue est raccordé par P09 dans les sources, sous mapping/politique
et consentement explicites. `PRO-COMMERCE-TRANSPORT-TEST-V1` possède un
effet de preuve technique uniquement en sandbox avec activation explicite ; il ne
crée aucune projection commerciale. Sources et tests sont écrits, sans exécution.

## Transport et authentification

`POST /federation/inbox`, sur l’origine Convex du moteur configurée par le
propriétaire. Le corps est du JSON UTF-8, au maximum **128 Kio réels**. Le lecteur
borne le flux indépendamment de `Content-Length` et refuse l’UTF-8 invalide.

En-têtes obligatoires :

| En-tête | Valeur |
|---|---|
| `x-antsia-emitter` | Slug enregistré, minuscules ASCII, 2 à 64 caractères |
| `x-antsia-environment` | `sandbox` ou `production` |
| `x-antsia-timestamp` | Unix en secondes, décimal canonique sans zéro initial |
| `x-antsia-signature` | HMAC-SHA256, exactement 64 caractères hexadécimaux minuscules |

Le message signé, encodé en UTF-8, est exactement :

```text
environment + "\n" + timestamp + "\n" + rawBody
```

`rawBody` est le texte exact reçu : ordre des propriétés, espaces et sauts de ligne
sont significatifs. La comparaison de signatures traite les 64 caractères sans
arrêt précoce. La fenêtre temporelle est de **± cinq minutes**.

`FEDERATION_ENVIRONMENT` doit déclarer explicitement l’environnement du backend.
Absent, `dev` ou toute autre valeur ferme l’inbox. Une signature de sandbox ne
passe jamais en production, ni l’inverse. Aucune inférence depuis le déploiement
local n’est faite.

Le registre `federationEmitters` fixe le réseau, le couple slug/environnement,
l’activation, les contrats autorisés et **le nom d’une variable** de secret. Ce
nom respecte `ANTSIA_FEDERATION_[A-Z0-9_]+_KEY`. La valeur reste uniquement dans
l’environnement ; elle doit contenir au moins 32 octets UTF-8 et au plus 4 096
caractères. Chaque émetteur et environnement doit recevoir sa propre clé ; une
référence de variable déjà réservée à un autre couple ne peut pas être réutilisée.

La configuration exige un opérateur `platform_admin`, une preuve IDN vivante de
niveau au moins 2 et un motif d’au moins dix caractères. Le réseau d’un émetteur
existant est immuable. La révision avance à chaque modification. L’admission
transactionnelle rejuge activation, révision, réseau, environnement et signature
avec la clé courante : une désactivation ou rotation concurrente refuse l’ancien
accord HTTP.

## Enveloppe fermée

```json
{
  "eventId": "event-public-001",
  "contract": "RESEAU-PUBLIC-V1",
  "version": 1,
  "objectRef": "page:administration-publique",
  "payload": {
    "type": "page.upserted",
    "orgRef": "page:administration-publique",
    "revision": 1,
    "name": "Administration publique fictive",
    "country": "GA",
    "verifiedAt": 1792281600000
  }
}
```

Ces cinq clés sont obligatoires, aucune autre n’est admise. `eventId` et
`objectRef` sont des références externes opaques de 1 à 200 caractères ASCII
(`A-Z`, `a-z`, chiffres, `.`, `_`, `:`, `-`, avec premier caractère alphanumérique).
Le contrat est un code majuscule versionné, par exemple `RESEAU-PUBLIC-V1` ou
`DIASPORA-ATTESTATION-V1`, au maximum 100 caractères. La version de transport vaut
uniquement `1`.

Le payload JSON est borné : profondeur 8, 2 000 nœuds, 256 éléments par tableau,
64 champs par objet, clés de 1 à 100 caractères, chaînes de 8 192 caractères.
Les nombres doivent être finis. Les identifiants internes, coordonnées privées et
secrets sont interdits. La frontière refuse notamment `_id`, `_creationTime`,
`networkId`, `personId`, `authUserId`, `storageId`, `localId`, `localTable`,
`convexId`, les champs de mot de passe, clé/token/session, e-mail et téléphone,
ainsi que les clés de pollution de prototype, même imbriqués. Cette barrière ne
remplace pas le schéma métier fermé de chaque contrat. Celui de
[`RESEAU-PUBLIC-V1`](RESEAU-PUBLIC-V1.md) est appliqué avant conservation d’un
nouveau corps.

## Admission, reçus et lettres mortes

La signature est validée **avant toute écriture**, puis une mutation interne
consomme `federation.receive` : **300/minute, capacité 60**, clé du registre
`emitterId:environment`. Le payload ne choisit ni ce budget ni le réseau.

Un contrat syntaxiquement valide mais absent de l’allowlist est refusé sans reçu
ni lettre morte. Un contrat autorisé sans traitement métier donne un reçu et une
lettre morte `unsupported_contract`.

PA9A branche `RESEAU-PUBLIC-V1` pour les pages de l’émetteur `administration-ga`,
enregistré dans le réseau fermé `administration`, à politique `mirror`, enfant
de la racine active ANTSIA. Le registre fournit le réseau ; aucune valeur du
payload ne peut le choisir. Une page officielle et sa référence `mirrors` sont
créées ou actualisées après validation métier. Aucune personne, identité ou
adhésion n’est créée. Les publications utilisent le traitement PA9B du même
contrat. Un retrait reçu avant la création conserve
une tombe de révision sans créer de page.

Un nouveau payload de ce contrat invalide, un événement réservé non encore
géré ou un média distant non admis donne `400` sans reçu ni DLQ. Pour une page
valide, une configuration incompatible donne `contract_not_allowed` en DLQ ;
une contradiction de révision ou de référence locale donne `source_conflict`.

Idempotence : `(emitterId, environment, eventId)` et SHA-256 du corps UTF-8 exact.
Un doublon identique conserve le reçu et la lettre morte existants ; un autre
corps sous la même clé reçoit `409`. Les états de reçu sont `received`, `applied`
et `dead_letter`. `received` puis l’état final sont écrits dans la même
transaction que l’application métier. `applied` peut aussi signifier qu’une
révision obsolète ou identique a été reconnue sans réécrire l’objet : il ne
signifie pas nécessairement qu’une nouvelle page a été créée.

La DLQ conserve seulement l’enveloppe authentifiée et bornée pour le rejeu.
Un succès conserve les métadonnées et l’empreinte du reçu, sans copie du corps.
Elle est lisible uniquement par un opérateur vivant. Les réponses HTTP
n’exposent aucun identifiant interne, corps, secret ou détail technique.

| HTTP | Sens |
|---|---|
| `202` | Réception admise ; lire `status`, qui vaut `applied` ou `dead_letter` |
| `200` | Doublon identique, état du reçu existant |
| `400` | Corps/enveloppe invalide, ou payload/événement/média non admis d’un contrat connu |
| `401` | Identité, signature, environnement, horodatage ou contrat refusé |
| `409` | Même clé d’évènement, autre corps exact |
| `413` | Corps trop grand |
| `429` | Budget de l’émetteur épuisé |
| `503` | Configuration/clé absente ou service indisponible |

## Rejeu et application PA9A/PA9B

Le rejeu est explicite, sans boucle automatique ni appel réseau externe. Il exige
le même administrateur habilité et un motif ; il consomme les budgets communs
d’opérateur et `moderation.decide`. Il rejuge l’émetteur actif, le réseau,
l’environnement, l’allowlist, le digest et la corrélation des identifiants stockés.
Il réutilise la même enveloppe, le même évènement et le même reçu, jamais un
payload fourni par l’opérateur.

Un reçu déjà appliqué est dédoublonné. Sinon, le rejeu utilise le même traitement
que l’admission. Une page traitée donne `applied`, résout la même lettre morte
et actualise son reçu. Un échec donne `still_failing`, incrémente les tentatives
de la même DLQ et conserve sa raison courante. Chaque issue laisse une entrée
`federationReplayAudit` et un `engineAudit` `federation.replay`. La console rend
distinctement application, dédoublonnage et échec.

La table `mirrors` conserve les références de page, révisions et empreintes
métier, y compris les tombes de retrait. La gestion native d’une page reflétée
est fermée même après perte du badge Officiel. La modération locale reste
possible ; une mise à jour positive de la source ne réactive pas une page
inactive. PA9B applique les publications publiques volontaires et leurs retraits,
sans créer de personne technique. Il importe images, vidéos et logos sous garde
des fichiers, par des jobs internes bornés et révisés. Le reçu `applied` ne
garantit pas le transfert ou l’analyse des médias : l’état distinct de transfert
est visible dans la console, avec relance motivée. Les agents volontaires et le
producteur du socle attendent PA9C/PA9D.

Patrons lus dans `origin/main` du socle au commit `25398f565` :
`modules/reseau/federationTables.ts` et `federation.ts`. Les créations d’agents et
rattachements du socle sont exclues du moteur. Les tests utilisent des clés
éphémères et des données fictives ; ils ne prouvent aucun échange avec un
émetteur réel ni aucune livraison de production. Les scénarios PA9A/PA9B ont été
écrits sans être exécutés ; la preuve PA5 antérieure ne couvre pas ce nouveau
traitement métier.

## PA9C — corps personnels et reçu écarté

`idnSub` est admis uniquement au premier niveau du payload des deux événements
personnels `RESEAU-PUBLIC-V1`. La référence d'agent est l'empreinte du nonce local ;
sa corrélation est vérifiée avant un nouveau reçu. L'application exige le grant
personnel, le sujet IDN existant et la date exacte de son consentement.

Les échecs métier personnels produisent `202 accepted / status: discarded` sans
lettre morte et sans corps conservé. Ce statut n'est pas une application. Le
doublon rend `200 duplicate` avec le même statut ; une reprise valide nécessite
un nouvel identifiant d'événement après résolution des conditions de consentement.
Le retrait impose un nouveau nonce, et non une simple révision supérieure.

Une éventuelle lettre morte personnelle historique n'est pas réappliquée par la
console : le rejeu expurge son corps et sa référence d'objet, ferme la lettre et
marque le reçu `discarded`. Cette logique n'a pas été exécutée sur des données
réelles. Aucun historique en service n'a été audité ou déclaré purgé.
