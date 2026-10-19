# RESEAU-PUBLIC-V1 — reflets de l’administration et agents volontaires

Statut : tranches locales PA9A/B/C et producteur PA9D en sources, 18 octobre 2026 ;
vérifications différées. Ce contrat définit la réception des pages, publications
publiques et choix d’agents depuis le socle administration.ga. La recette
croisée, les configurations réelles et toute publication restent distinctes de
cette implémentation locale.

## Transport et périmètre

L’entrée est `POST /federation/inbox`, avec le transport signé
[FEDERATION-INBOX-V1](FEDERATION-INBOX-V1.md) : environnement explicite, clé propre
à l’émetteur, horodatage frais, corps exact signé et borné, allowlist du registre
serveur. Le contrat d’enveloppe reste fermé à cinq champs. Le type de l’événement
appartient au payload, jamais à un sixième champ d’enveloppe.

```json
{
  "eventId": "socle-page-exemple-000001",
  "contract": "RESEAU-PUBLIC-V1",
  "version": 1,
  "objectRef": "page:administration-exemple",
  "payload": {
    "type": "page.upserted",
    "orgRef": "page:administration-exemple",
    "revision": 1,
    "name": "Administration exemple",
    "shortName": "AE",
    "description": "Présentation publique fictive de l’administration.",
    "country": "GA",
    "verifiedAt": 1792281600000,
    "logoUrl": null
  }
}
```

Ces références sont publiques et opaques ; elles ne contiennent aucun identifiant
Convex ni coordonnée privée. Le réseau `administration` et la racine `antsia`
proviennent du registre du moteur. Le payload ne choisit ni son réseau ni sa
confiance locale. Aucun profil de personne ni aucune adhésion ne sont créés dans
cette tranche.

## Payload fermé de PA9A

Le parseur pur `parseReseauPublicPage(payload, objectRef, nowMs)` vit dans
`packages/social-domain/src/reseauPublic.ts`. Il retourne soit
`{ ok: true, event }`, soit `{ ok: false, reason }`.

| Champ | Règle |
|---|---|
| `type` | Obligatoire, exactement `page.upserted`. |
| `orgRef` | Obligatoire, référence métier validée par `validFederationReference`, exactement égale à l’`objectRef` de l’enveloppe. |
| `revision` | Obligatoire, entier sûr supérieur ou égal à 1, croissant pour la page source. |
| `name` | Obligatoire, chaîne de 2 à `PAGE_NAME_MAX_LENGTH` (120) caractères après retrait des espaces de bord. |
| `shortName` | Facultatif ; si présent, chaîne de 1 à `PAGE_SHORT_NAME_MAX_LENGTH` (30) caractères après retrait des espaces de bord. |
| `description` | Facultatif ; si présent, chaîne de 1 à `PAGE_DESCRIPTION_MAX_LENGTH` (1 000) caractères après retrait des espaces de bord ; LF et CR sont autorisés pour les paragraphes. |
| `country` | Obligatoire, exactement deux lettres ASCII majuscules, forme `^[A-Z]{2}$`. |
| `verifiedAt` | Obligatoire ; date Unix en millisecondes, entière sûre, strictement positive et au plus `nowMs + FEDERATION_MAX_SKEW_MS`, ou `null` pour révoquer le reflet. |
| `logoUrl` | Facultatif ; absence ou `null` uniquement pour une application réussie de PA9A. |

Tous les champs supplémentaires sont refusés : `audience`, y compris
`organisation`, identifiant interne, coordonnées, champs de publication ou de
personne. Les limites de longueur sont importées de `pages.ts`, source commune
du domaine des pages. Les champs textuels ne peuvent être vides. Aucun caractère
de contrôle C0 ou DEL n’est admis, même aux bords avant normalisation, sauf LF et
CR dans la description ; ses paragraphes intérieurs sont conservés. Le nom, le
sigle et l’URL n’admettent aucun contrôle. Les noms d’organisations conservent
leur casse. Les champs facultatifs présents ne
peuvent être `undefined`, `null` ou d’un autre type, sauf `logoUrl` qui accepte
explicitement `null`.

Un payload non objet, un tableau, un type inconnu ou toute violation de ces
règles retourne `invalid_payload`. Les quatre noms `post.published`,
`post.removed`, `person.optin` et `person.optout` sont réservés : ils retournent
`unsupported_event` dès lecture du discriminateur, sans imposer les clés de
`page.upserted` ni valider leurs futurs champs métier. Leur schéma ne fait pas
partie de cette tranche. Les clés fermées ci-dessus ne s’appliquent qu’à
`page.upserted`. La garde générique du transport interdit les champs sensibles
imbriqués avant ce parseur.

Une chaîne de média non vide retourne `unsupported_media` ; une chaîne vide, un
caractère de contrôle ou une valeur d’un autre type retourne `invalid_payload`.
Aucune URL externe n’est chargée, stockée comme média servi ou présentée comme
une livraison réussie. L’admission des médias attend une tranche qui utilise la
garde des fichiers et respecte sa politique de délivrance.

L’événement normalisé est construit dans cet ordre stable : `type`, `orgRef`,
`revision`, `name`, `shortName` si présent, `description` si présente, `country`,
`verifiedAt`, `logoUrl` si présent. Cette projection fixe l’entrée du digest
sémantique, indépendamment de l’ordre des clés du JSON reçu.

Pour ce contrat, l’admission invoque ce parseur avant de créer un reçu ou une
lettre morte. Tout refus (`invalid_payload`, `unsupported_event` ou
`unsupported_media`) renvoie HTTP `400` avec `outcome: invalid_envelope`, sans
nouveau reçu ni conservation du payload en DLQ. Seul un payload de page admis
peut ensuite entrer en DLQ si son application métier échoue. Les événements
réservés et les médias distants non gérés ne sont donc jamais annoncés comme
appliqués. Un rejeu d’une ancienne DLQ peut encore rencontrer ces raisons de
refus : il ne transforme pas une ancienne admission technique en succès métier.

## Révisions, retrait et rejeu

`eventId` identifie une livraison et sa clé d’idempotence de transport ;
`revision` ordonne les états de la page source. Ce sont deux identités
distinctes. Réutiliser le même `eventId` avec un autre corps reste un conflit de
transport, même si le changement ne touche que l’ordre des clés ou les espaces.

Le moteur conserve la révision admise comme `sourceRevision` avec le miroir et
son digest sémantique. Une révision plus ancienne ne doit pas rétablir un ancien
état ; une révision égale avec la même projection est dédoublonnée ; une révision
égale avec une projection différente est un conflit. Une révision supérieure
permet d’appliquer le nouvel état. La révision de configuration d’un émetteur
reste indépendante de cette révision métier.

`verifiedAt: null` révoque le reflet : la page cesse d’être servie, mais le miroir
conserve sa révision et une tombstone de retrait. Cette trace empêche qu’une
ancienne livraison réactive la page. Une nouvelle vérification exige une
révision source supérieure et une date de vérification admise ; une révocation
n’est pas une suppression de la preuve d’ordre. Une page existante inactive ne
redevient jamais active par cette seule mise à jour : sa réactivation exige une
décision locale explicite. Une preuve positive postérieure à une tombe sans
page peut créer la première page.

Le rejeu opérateur réutilise le même reçu, le même `eventId` et le même corps
authentifié stocké, après contrôle du digest et des autorisations courantes. Il
repasse par le même parseur et les mêmes règles `sourceRevision`/tombstone ; il
n’accepte pas de payload corrigé fourni par l’opérateur. L’opération conserve son
audit et sa lettre morte devient résolue seulement après application ou
dédoublonnage métier effectif. Un statut de réception HTTP `202` ne suffit pas à
prouver qu’une page a été appliquée.

## Configuration et suites

Le propriétaire configure l’environnement de fédération et les secrets hors du
dépôt. Un opérateur `platform_admin` avec preuve IDN vivante de niveau au moins 2
et motif explicite configure un émetteur actif, au slug `administration-ga`, lié
au réseau `administration` de nature `closed`, à politique `mirror`, enfant de
la racine `antsia`, avec `RESEAU-PUBLIC-V1` dans `allowedContracts` et une référence
de variable `ANTSIA_FEDERATION_[A-Z0-9_]+_KEY`. Le réseau et la racine doivent être
actifs. Aucune configuration réelle, modification de secret ni commande de
production n’est incluse dans cette tranche.

PA9B, PA9C et PA9D restent à définir et à livrer pour les publications publiques
volontaires et leurs retraits, l’opt-in/opt-out des agents, les médias sous garde,
l’outbox du socle, la copie typée du contrat côté socle et la recette croisée en
développement. Aucun commentaire ni réaction ne remonte au socle dans V1. La
publication du socle en production reste une décision explicite du propriétaire.

## Extension PA9B — publications, retraits et descripteurs de médias

18 octobre 2026. Les sections PA9A ci-dessus conservent la description de la
première tranche. Cette extension ajoute le contrat des publications et des
logos ; elle remplace, pour le parseur général, la réservation de
`post.published` et `post.removed`. Elle ne constitue ni une preuve de
téléchargement, ni une recette croisée. Les scénarios du contrat sont écrits
dans `packages/social-domain/src/reseauPublic.test.ts`, sans exécution à la
demande du propriétaire.

### API pure et portée

`parseReseauPublicEvent(payload, objectRef, nowMs)` retourne
`{ ok: true, event: ReseauPublicEvent }` ou
`{ ok: false, reason: "invalid_payload" | "unsupported_event" | "unsupported_media" }`.
L’union discriminée `ReseauPublicEvent` contient `ReseauPublicPageEvent`,
`ReseauPublicPostPublishedEvent` et `ReseauPublicPostRemovedEvent`.

L’export `parseReseauPublicPage` et son type de retour sont conservés. Ce parseur
spécialisé continue de refuser les événements de publication avec
`unsupported_event`. Les deux parseurs de page acceptent désormais le champ
`logo` décrit ci-dessous. `person.optin` et `person.optout` restent
`unsupported_event` dans les deux API ; aucun profil, lien d’identité,
signataire ou adhésion ne se déduit d’une publication.

Le parseur général doit servir à l’admission et au rejeu. Les payloads restent
fermés et les refus restent antérieurs à la conservation d’un nouveau corps.
Seule l’enveloppe authentifiée par le transport signé fournit ces données. Le
réseau, l’émetteur admis et la confiance locale viennent toujours du registre
du moteur, jamais du payload.

### Publication publique volontaire

```json
{
  "type": "post.published",
  "postRef": "post:communique-exemple",
  "pageRef": "page:administration-exemple",
  "revision": 1,
  "body": "Communiqué public de l’administration.",
  "audience": "public",
  "publishToAntsia": true,
  "media": [],
  "publishedAt": 1792281600000
}
```

Ces neuf champs sont obligatoires et aucun autre n’est admis. `postRef` est une
référence publique valide, exactement égale à l’`objectRef` de l’enveloppe ;
`pageRef` est une référence publique valide de la page source. L’application
métier doit résoudre cette page auprès du même émetteur, dans le même
environnement et le même réseau, et refuser toute adoption ou réaffectation
incohérente. Les références ne sont jamais des identifiants de base externes.

`revision` est un entier sûr supérieur ou égal à 1. `publishedAt` est une date
Unix en millisecondes, entière sûre, strictement positive et au plus
`nowMs + FEDERATION_MAX_SKEW_MS` (cinq minutes). La révision et la date de
publication sont distinctes : une mise à jour ne doit pas devenir une nouvelle
publication ni perdre ses interactions locales.

Les deux preuves publiques sont obligatoires : `audience` vaut exactement
`public` et `publishToAntsia` vaut exactement le booléen `true`. Aucune audience
`organisation`, `followers`, `connections` ou de groupe n’est admise. Les
identifiants d’auteur personne, réseau, groupe, stockage et les champs étrangers
sont refusés.

`body` est une chaîne, sans contrôle C0 ou DEL sauf LF/CR ; ses espaces de bord
sont retirés. Le contrat appelle `assertPostContent` : au plus 2 000 caractères
après normalisation et un corps non vide si aucun média n’est présent. Une photo
sans légende est donc admise. Un `@identifiant` reste du texte ; ce contrat ne
crée ni ne rapproche une personne externe pour lui donner un auteur ou une
mention. `media` est toujours un tableau, y compris vide, dont la composition
passe `assertPostMedia` : au plus quatre images ou une vidéo seule.

### Retrait et tombe source

```json
{
  "type": "post.removed",
  "postRef": "post:communique-exemple",
  "revision": 2
}
```

Ces trois champs seulement sont admis. `postRef` doit être valide et égal à
l’`objectRef` ; `revision` est un entier sûr supérieur ou égal à 1. Le retrait
n’exige ni page déjà reçue, ni publication locale, ni auteur personne, ni copie
de l’ancien contenu. Il peut donc être conservé comme tombe avant la création.

La même révision métier ordonne `post.published` et `post.removed` pour une
publication source. La tombe conserve la révision, le digest normalisé et
l’état source séparément du statut de modération locale. Un ancien événement ne
restaure pas une source retirée ; deux contenus différents sous une même
révision restent un conflit. Cette révision est indépendante de celle de la
page parente, de la configuration de l’émetteur et de l’`eventId` de transport.

L’application conserve l’identifiant local du reflet lors d’une mise à jour,
ainsi que ses réactions, commentaires et marques locaux. Un retrait referme
ses projections et celles de ses relais, puis purge les médias importés selon
leur propriété. Une mise à jour source ne lève jamais un retrait ou une
prélecture décidé localement ; inversement, un rétablissement local n’annule
jamais un retrait source. La révocation de la page parente doit refermer ses
publications et empêcher leur réactivation par un simple changement local de
statut. Aucun commentaire ou réaction n’est réémis vers le socle.

### Descripteur de média signé

`ReseauPublicMedia` est un objet fermé. Son URL est une adresse de
téléchargement issue de l’enveloppe signée, jamais une URL directement servie
dans l’interface.

| Champ | Règle |
|---|---|
| `url` | Obligatoire ; HTTPS absolue, au plus 2 048 caractères, sans espaces de bord, caractère de contrôle, antislash, credentials ou fragment, même vide. |
| `kind` | Obligatoire, exactement `image` ou `video`. |
| `mimeType` | Obligatoire ; MIME exact de la liste blanche du domaine correspondant au genre, sans paramètre. SVG et HTML ne sont jamais admis. |
| `sizeBytes` | Obligatoire ; entier sûr strictement positif. Image au plus 20 Mio ; vidéo au plus 50 Mio, borne fédérée plus stricte que le domaine natif. |
| `sha256` | Obligatoire ; exactement 64 caractères hexadécimaux minuscules. |
| `width`, `height` | Facultatifs ; si présents, entiers sûrs de 1 à 32 768 pixels. |
| `durationMs` | Facultatif ; si présent, entier sûr de 1 à 86 400 000 millisecondes (24 heures). |
| `altText` | Facultatif ; chaîne sans contrôle C0 ou DEL, espaces de bord retirés, au plus `POST_MEDIA_ALT_MAX_LENGTH` (300) caractères. |

Les champs facultatifs présents ne peuvent être `undefined`, `null` ou d’un
autre type. Le parseur construit les clés dans un ordre stable et canonicalise
l’URL avec `URL`, avant le calcul du digest métier par le consommateur.

Le filtre pur refuse localhost, les domaines locaux/réservés reconnus, les noms
sans point et les littéraux IPv4 privés, loopback, link-local, multicast,
réservés ou de documentation. Les écritures IPv4 abrégées, décimales, octales ou
hexadécimales sont vérifiées après canonicalisation, pour ne pas contourner ces
refus. Les littéraux IPv6 sont fermés dans cette tranche. Un nom d’hôte admis ne
prouve pas que son DNS est public.

Le téléchargeur doit encore vérifier la racine HTTPS autorisée pour l’émetteur,
résoudre et contrôler les adresses publiques, puis épingler la résolution à la
connexion. Une redirection doit être refusée ou repasser les mêmes contrôles
avant toute connexion. La provenance signée ne dispense jamais de ces gardes
contre les résolutions privées ou changeantes. Les octets téléchargés doivent
correspondre au MIME, au poids et au SHA-256 signés, dans les bornes du contrat
et de l’usage de stockage.

Après import dans le stockage du moteur, le rattachement passe par la fraîcheur
du fichier et l’admission de la garde (`admitStoredUpload`, usage
`media_social` ou `page_logo`). Il naît retenu jusqu’à une analyse admise :
jamais de statut `skipped/server_generated` pour un fichier distant. Toute
délivrance passe par la garde fail-closed et les DTO ne portent que l’URL locale
admise ou la raison de retenue, sans identifiant privé de stockage. Le parseur
pur ne télécharge rien et ne prétend pas avoir analysé ces octets.

### Logo de page

`page.upserted` accepte le champ facultatif `logo` : un descripteur
`ReseauPublicMedia` de genre `image`, ou `null` pour retirer explicitement le
logo. Sa liste blanche MIME et son poids suivent l’usage `page_logo` : JPEG,
PNG ou WebP, au plus 5 Mio. Les autres règles de descripteur s’appliquent,
ainsi que le transport signé, l’import et la garde fail-closed. Un descripteur
de vidéo ou de GIF est refusé pour cet usage.

Le champ historique `logoUrl` garde exactement son comportement PA9A : absent
ou `null` admis, chaîne non vide `unsupported_media`, chaîne vide ou valeur mal
typée `invalid_payload`. Un `logoUrl` non vide ne devient pas admissible parce
qu’un descripteur `logo` est également présent. L’ordre de projection de page
reste celui de PA9A, suivi de `logo` lorsqu’il est présent.

## PA9C — Agents volontaires et consentement local corrélé

Le parseur général `parseReseauPublicEvent(payload, objectRef, nowMs)` reconnaît
`person.optin` et `person.optout`. Il expose les types
`ReseauPublicPersonOptInEvent`, `ReseauPublicPersonOptOutEvent` et leur union
`ReseauPublicPersonEvent`. Le garde
`isReseauPublicPersonEvent(event: ReseauPublicEvent)` affine cette union.
Le parseur spécialisé `parseReseauPublicPage` continue de rendre
`unsupported_event` pour les deux types de personne ; les règles PA9A de ce
document décrivent ce seul parseur spécialisé.

### Accord d’un agent

`person.optin` exige exactement ces dix champs ; aucun autre champ n’est admis.

| Champ | Règle |
|---|---|
| `type` | Exactement `person.optin`. |
| `agentRef` | Exactement `agent:` suivi de 64 caractères hexadécimaux minuscules, égal à l’`objectRef` de l’enveloppe. |
| `revision` | Entier sûr supérieur ou égal à 1, croissant pour cette génération de consentement. |
| `idnSub` | Sujet IDN privé opaque, chaîne de 1 à 512 caractères, sans espace de bord ni contrôle C0 ou DEL ; conservé exactement, sans changement de casse ou normalisation. |
| `consentRef` | Nonce de la génération du consentement local, exactement 64 caractères hexadécimaux minuscules. |
| `textVersion` | Exactement `CONSENT_TEXT_VERSIONS.administration_reflection`, soit `2026-10-18`. |
| `consentedAt` | Date Unix en millisecondes, entière sûre, strictement positive et au plus `nowMs + FEDERATION_MAX_SKEW_MS` (cinq minutes). |
| `displayName` | Nom affiché choisi, de 2 à 120 caractères après retrait des espaces de bord, sans contrôle C0 ou DEL. |
| `orgRef` | Référence métier publique valide selon `validFederationReference`, sans identifiant interne. |
| `roleLabel` | Libellé de fonction public, de 1 à 120 caractères après retrait des espaces de bord, sans contrôle C0 ou DEL. |

La projection normalisée suit cet ordre stable : `type`, `agentRef`, `revision`,
`idnSub`, `consentRef`, `textVersion`, `consentedAt`, `displayName`, `orgRef`,
`roleLabel`. Le sujet opaque ne doit jamais être remplacé par le nom choisi,
une adresse e-mail ou un identifiant interne. Un objet non fermé, un champ
manquant, une version ancienne ou une valeur mal typée rendent `invalid_payload`.

### Retrait d’un agent

`person.optout` exige exactement cinq champs : `type` valant `person.optout`,
`agentRef`, `revision`, `idnSub` et `consentRef`, avec les mêmes bornes que
ci-dessus. Il ne transporte ni nom, ni rôle, ni organisation, ni ancienne preuve
de consentement. Sa projection suit cet ordre de cinq clés.

Les révisions d’accord et de retrait partagent la même séquence pour un même
`agentRef`. Une révision ancienne ne réactive pas un reflet retiré ; une révision
égale avec un contenu différent est un conflit. L’ordre de livraison ne remplace
pas ces vérifications métier. Le parseur pur ne lit aucun registre local et ne
décide pas lui-même d’une application ou d’un conflit de révision.

### Corrélation, révocation et minimisation

La finalité locale `administration_reflection` possède son texte versionné et
son propre geste révocable. Elle est distincte de `social_profile` : accepter un
profil social ne consent pas au reflet administratif, et ce nouveau consentement
n’est pas requis pour entrer dans le réseau public. Un événement externe ne
crée aucun compte, profil ou consentement local.

Le moteur doit posséder un accord personnel `federationAgentGrants`, rattaché
par un `personId` obligatoire à une personne locale. Le consentement local génère
un nouveau nonce aléatoire `consentRef`. La référence de transport est
`agentRef = "agent:" + SHA256(consentRef)`, où SHA-256 porte les octets UTF-8 de
la chaîne hexadécimale exacte et produit 64 caractères hexadécimaux minuscules.
Le parseur pur vérifie la syntaxe et l’égalité `agentRef === objectRef` ; le
backend doit vérifier le lien cryptographique avant tout nouveau reçu, puis
corréler l’identité IDN prouvée et le nonce actif exact avant toute
matérialisation. Une chaîne syntaxiquement valide n’est pas une preuve d’accord.

Un retrait local invalide la génération courante. Un nouveau geste local doit
produire une nouvelle génération : un ancien événement ne peut pas la viser,
même avec une révision supérieure. À l’effacement de la personne, l’accord et
son nonce sont effacés avec elle ; aucune tombe privée indéfinie de sujet IDN
n’est nécessaire à l’anti-rejeu. Une nouvelle personne ou un nouvel accord ne
réadopte jamais l’ancien nonce. Le retrait du seul reflet administratif ne
supprime pas le profil social indépendant ni ses adhésions indépendantes.

Le sujet `idnSub` reste exclusivement dans le traitement privé de la charge
signée. Il ne figure jamais dans `objectRef`, les reçus, l’audit, les DTO publics
ou de console, ni les arguments de jobs. Les reçus personnels ne conservent que
la référence pseudonyme `agentRef`, l’empreinte du corps et les métadonnées de
transport nécessaires. La référence pseudonyme ne donne aucun droit sur une
personne.

Un nouvel événement de personne dont l’application échoue ne doit pas conserver
son corps en lettre morte : le reçu porte `discarded`, sans `rawBody`, et un
nouvel envoi source avec un nouvel `eventId` est requis après correction. Les
règles de DLQ et de rejeu des pages/publications ne s’appliquent donc pas à ces
charges personnelles. Une admission technique ou un reçu `discarded` ne prouve
pas qu’un reflet a été appliqué. Le contrat pur décrit cette obligation sans
réaliser lui-même la persistance ni la recette croisée.


## PA9D — Producteur administratif et transfert d'accord

Le producteur est implémenté dans les sources du socle sous
`convex/modules/reseauPublicFederation/`. Le sous-chemin V8 pur
`@workspace/federation-contracts/reseau-public-v1` porte sa copie autonome du
contrat ; aucun import interproduit ni barrel serveur Node dans les transactions.
Le rapport [PA9D](../18_PRODUCTEUR_ET_OUTBOX_ADMINISTRATION_PA9D.md) décrit
l'outbox, ses dépendances de page, les gestes explicites et les limites.

L'accord ANTSIA peut être préparé par `agents.prepareTransfer` : code opaque,
lié au grant, valide dix minutes et utilisable une seule fois. L'administration
le résout depuis son serveur via `POST /federation/agent-consent` avec le sujet
IDN qu'elle établit elle-même ; le sujet ne traverse jamais l'URL du navigateur.
Cette requête séparée respecte le protocole `ANTSIA-AGENT-CONSENT-V1` exporté
par `agentConsentTransfer.ts` et sa copie typée.

Corps de requête fermé : `{ token, idnSub }`, au plus 4 Kio UTF-8. La clé du
registre d'émetteur et les en-têtes d'environnement/horodatage signent le texte :

```text
environment + "\n" + timestamp + "\nANTSIA-AGENT-CONSENT-V1/request\n" + rawBody
```

La réponse positive est exactement `{outcome:"granted",grant:{agentRef,
consentRef,textVersion,grantedAt}}`. Son HMAC lie également la requête exacte :

```text
environment + "\n" + responseTimestamp + "\nANTSIA-AGENT-CONSENT-V1/response\n" + SHA256(rawRequest) + "\n" + rawResponse
```

Le producteur rejuge session, identité, poste et configuration avant de conserver
son accord et de mettre l'attestation en file. Il reprend `grantedAt` comme
`consentedAt` de l'événement. Le nom public fait l'objet d'une confirmation
explicite ; le profil source historiquement créé d'office n'en tient pas lieu.
La réponse ne contient jamais le sujet IDN.

Ces changements sont locaux et non vérifiés : ni compte cloud, secret, flux réel,
PR, recette croisée ni publication ne sont établis par cette extension.
