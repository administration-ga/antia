# FEDERATION-INBOX-V1 — transport entrant d’ANTSIA

Statut : implémentation PA5 locale, 16 octobre 2026. Les contrats métier restent à
brancher en PA9 / DIASPORALE PD3 et PD5. Aucun émetteur ni secret réel n’est créé par
l’implémentation.

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
  "payload": { "title": "Information publique fictive" }
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
remplace pas le futur schéma métier fermé de chaque contrat.

## Admission, reçus et lettres mortes

La signature est validée **avant toute écriture**, puis une mutation interne
consomme `federation.receive` : **300/minute, capacité 60**, clé du registre
`emitterId:environment`. Le payload ne choisit ni ce budget ni le réseau.

Un contrat syntaxiquement valide mais absent de l’allowlist est refusé sans reçu
ni lettre morte. Le registre de handlers métier est **vide** en PA5. Tout contrat
autorisé donne donc un reçu et une lettre morte `unsupported_contract`, sans
création de personne, d’adhésion, de page, de publication ou de miroir.

Idempotence : `(emitterId, environment, eventId)` et SHA-256 du corps UTF-8 exact.
Un doublon identique conserve le reçu et la lettre morte existants ; un autre
corps sous la même clé reçoit `409`. Les états de reçu sont `received`, `applied`
et `dead_letter`. PA5 ne produit aucun état `applied`. `received` puis
`dead_letter` sont écrits dans la même transaction.

La DLQ conserve seulement l’enveloppe authentifiée et bornée pour le rejeu.
Elle est lisible uniquement par un opérateur vivant. Les réponses HTTP
n’exposent aucun identifiant interne, corps, secret ou détail technique.

| HTTP | Sens |
|---|---|
| `202` | Réception admise, actuellement `dead_letter` |
| `200` | Doublon identique, état du reçu existant |
| `400` | Corps/enveloppe invalide |
| `401` | Identité, signature, environnement, horodatage ou contrat refusé |
| `409` | Même clé d’évènement, autre corps exact |
| `413` | Corps trop grand |
| `429` | Budget de l’émetteur épuisé |
| `503` | Configuration/clé absente ou service indisponible |

## Rejeu et limites PA5

Le rejeu est explicite, sans boucle automatique ni appel réseau externe. Il exige
le même administrateur habilité et un motif ; il consomme les budgets communs
d’opérateur et `moderation.decide`. Il rejuge l’émetteur actif, le réseau,
l’environnement, l’allowlist, le digest et la corrélation des identifiants stockés.
Il réutilise la même enveloppe, le même évènement et le même reçu, jamais un
payload fourni par l’opérateur.

Un reçu déjà appliqué est dédoublonné. Avec le registre PA5 fermé, le rejeu reste
`still_failing`, incrémente les tentatives de la même DLQ et laisse une entrée
`federationReplayAudit` ainsi qu’un `engineAudit` `federation.replay`.
La table `mirrors` est prête, avec réseau et référence externe, mais possède
**zéro écrivain** avant admission d’un contrat métier.

Patrons lus dans `origin/main` du socle au commit `25398f565` :
`modules/reseau/federationTables.ts` et `federation.ts`. Les créations d’agents et
rattachements du socle sont exclues du moteur. Les tests utilisent des clés
éphémères et des données fictives ; ils ne prouvent aucun échange avec un
émetteur réel ni aucune livraison de production.
