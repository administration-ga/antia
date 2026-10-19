# PRO-COMMERCE-CATALOG-READ-V1 — réconciliation et octets de médias

18 octobre 2026, P09. Contrat privé ajouté **hors** des fichiers jumeaux et du manifeste
P06, conservés. Source pure jumelle : `packages/social-domain/src/commerce-catalogue.ts`
et `PRO_GA/packages/pro-domain/src/commerce-catalogue.ts` (sous-export `./commerce-catalogue`).
Code et scénarios écrits ; aucun échange réel ni vérification exécuté pendant cette reprise.

## Autorité et portée

Les deux endpoints appartiennent au backend HTTP PRO.GA, sur l'origine serveur autorisée
par P08. Ils ne reçoivent jamais une URL de téléchargement, un tenant, un identifiant
Convex ou une adresse de stockage choisie par ANTSIA. L'objet se résout par le lien serveur,
la référence métier, la révision et l'empreinte. Le source machine, son environnement,
sa configuration, le lien, la permission `publish_catalog`, le consentement et le mandat
actuel du délégant sont rejugés. Le scope machine de lecture est `commerce.request.status` ;
il ne confère ni publication, ni commande, ni accès à un catalogue étranger.

## Requête fermée, courte et canonique

Maximum 8 Kio. Exactement :

```typescript
{
  contract: "PRO-COMMERCE-CATALOG-READ-V1", version: 1,
  operation: "reconcile" | "media.read",
  source, environment, requestId, subjectRef, shopRef, linkRef,
  issuedAt, expiresAt, payload
}
```

Références P06 ; `subjectRef` est opaque, sans identité civile. Durée maximale 60 secondes,
expiration effective, tolérance de transport de cinq minutes. JSON canonique obligatoire,
clés supplémentaires et doublons refusés. Une requête de média porte
`payload:{offerRef,revision,sha256}` ; une réconciliation porte `payload:{cursor:null|string}`,
curseur limité à 2 048 caractères et validé dans le contexte de la source liée.

Les en-têtes sont ceux du transport privé P08 : `X-Pro-Key-Id`, `X-Pro-Timestamp`
(millisecondes), `X-Pro-Nonce`, `X-Pro-Signature` (HMAC-SHA256 base64url sans remplissage).
Les clés privées LINK/COMMAND existantes sont référencées côté serveur, hors namespace
`PRO_COMMERCE_PUBLIC_`. Le nonce est à usage unique dans l'environnement.

Le profil est **distinct** : `pro-ga-commerce-catalog-read-hmac/v1`.
`commerceCatalogSigningInput` assemble des composants préfixés par leur longueur : profil,
keyId, horodatage, nonce, source, environnement, audience `pro.ga.commerce.catalogue`,
scope `commerce.request.status`, opération, SHA-256 des octets exacts du corps.
Une preuve de COMMAND ou PUBLIC n'authentifie pas une lecture de catalogue.

## Réconciliation : réenfiler, puis recevoir par l'inbox

`POST /commerce/v1/catalogue/reconcile` réenfile au plus vingt snapshots par page via
l'outbox et le worker P08. La réponse canonique HTTP 200 est exactement :

```typescript
{contract,version:1,requestId,requestSha256,outcome:"accepted",
 cursor:null|string,done:boolean,queued:number}
```

`done` vaut `cursor===null`, `queued` est compris entre 0 et 20. Requête et empreinte
sont corrélées ; la réponse ne contient aucun catalogue ni privilège. Une répétition ne
fabrique pas de révision métier différente. La projection change uniquement lors de
l'application d'un événement authentifié `PRO-COMMERCE-PUBLIC-V1`.

L'action membre ANTSIA `shops/catalogActions.reconcile` exige le gérant vivant avant et
après HTTP, la même session, la même incarnation de mapping et la même configuration.
Un clic traite une page ; aucune boucle globale ni élévation du budget de l'inbox.
`queued` ne signifie ni reçu ni appliqué. Les trous de révision sont conservés comme
signaux de réconciliation ; aucune réparation par saisie manuelle de miroir.

## Média : octets autorisés, admission locale et retrait

`POST /commerce/v1/catalogue/media` sert un média du snapshot public **courant**, de
l'offre, du lien et de la révision demandés. Le serveur source relit l'autorité après
lecture du blob. Une offre retirée ou une empreinte remplacée ne sert aucun octet.
HTTP 200 : image JPEG, PNG ou WebP, `Content-Type`, `Content-Length`, `X-Content-SHA256` ;
jamais une redirection ni une URL voisine.

ANTSIA lit au plus 10 Mio réels par fichier, sous dix secondes, et compare type,
signature binaire, taille et SHA-256 au descripteur PUBLIC signé. Six images au plus,
séquentielles ; deux imports concurrents au plus côté mutation de claim. Les claims,
baux, jetons d'incarnation, stages et watchdogs sont persistés. L'attachement relit
source/révision/lien et passe par fraîcheur et admission des fichiers. `requiresFullScan`
impose l'analyse antivirus complète ; une copie retenue reste sans URL.

La projection ne rend que l'URL proxy ANTSIA `/catalogue/media/<jeton opaque>`, créée
depuis une origine HTTP serveur explicite. Chaque GET rejoue la garde de catalogue et
la garde de scan avant et après lecture du blob ; réponse `no-store` et `nosniff`.
Retirer une offre, sa boutique, le lien, la source, le consentement ou la politique
ferme aussi une URL déjà émise. La purge physique des copies d'un parent se poursuit
par tranches bornées ; elle ne conditionne pas la fermeture de la lecture.

Le crash entre `storage.store` et l'inscription transactionnelle reste une fenêtre
possible de blob orphelin, comme PA9B. Aucun essai de crash ni de purge réelle n'est
revendiqué ici. Les scans et les workflows PA10 restent des dépendances distinctes.

## Activation et preuve

Aucune clé, variable d'environnement, configuration, donnée, session ou consentement
n'est créé par l'agent. Les politiques vitrines et catalogue restent fermées par défaut.
Le propriétaire configure les sources, les destinations et les mappings selon les
procédures des deux dépôts. La recette croisée, la génération API et les contrôles
restent différés à sa demande. Ce contrat ne rend aucune vente ni aucun paiement actif.
