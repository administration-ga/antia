# PA9B — Publications, retraits et médias des administrations

18 octobre 2026. Sources du moteur ANTSIA et console raccordées. Les vérifications
restent différées par demande explicite du propriétaire : aucun test, typage,
lint, codegen manuel, build ou parcours navigateur n’a été lancé pour ce lot.

## Publications sous l’identité de la page

`RESEAU-PUBLIC-V1` reçoit désormais `post.published` et `post.removed`, en plus
des pages PA9A. L’enveloppe conserve son transport signé, son environnement,
son quota, son reçu et son rejeu. Le parseur métier ferme les champs avant tout
nouveau reçu ; audience `public` et geste `publishToAntsia: true` sont obligatoires.
Les notes d’organisation et les audiences privées ne sont pas admises.

Une publication rejoint la vraie table `posts`, ses fils, murs, partages,
commentaires, réactions et projections publiques existants. Sa page doit être
officielle, active, appartenir au même émetteur/environnement et provenir du réseau
miroir Administration. Elle n’a aucun auteur personne : aucun compte technique,
profil, lien IDN, signataire ou adhésion n’est créé. Le DTO membre conserve son
objet `author` neutre avec `personId: null` et présente l’identité de la page.
Les écrivains natifs continuent d’exiger une personne. Les gestes d’édition
locaux ne peuvent pas modifier un reflet, ni mettre une page en sourdine comme
s’il s’agissait d’une personne.

Les mises à jour conservent l’identifiant et la date de publication, ainsi que
les interactions locales. Une révision ancienne n’écrit rien ; une contradiction
de même révision ou un déplacement vers une autre page est mis en lettre morte.
La modération est évaluée par page ; un état local retiré ou en attente de revue
n’est pas levé par une mise à jour de la source. Un contenu en revue sans auteur
personne reste fermé aux visiteurs anonymes.

## Retraits et absence de réapparition

Un retrait peut précéder la première publication : la tombe de révision est
conservée sans créer de publication. Une référence retirée ne se republie pas,
même sous une révision supérieure ; une nouvelle publication exige une nouvelle
référence. Le corps local et les médias importés sont expurgés, les compteurs
décomptés et les relais affichent leur original indisponible. Les réactions et
commentaires locaux restent conservés sous leurs gardes.

La disponibilité source est relue indépendamment du statut local, pour les
pages et les publications. Une restauration de modération ne peut pas contourner
un retrait source ou un émetteur désactivé. Le retrait d’une page ferme aussitôt
ses publications, puis une cascade de dix miroirs par transaction purge les
copies et médias antérieurs. La révision de page portée par chaque publication
empêche cette ancienne cascade de détruire une publication reçue sous une preuve
de page ultérieure.

## Import des images, vidéos et logos

Les médias sont décrits par URL publique HTTPS, nature, type MIME, taille exacte
et SHA-256 signés. Au plus quatre images de 20 Mio ou une vidéo seule de 50 Mio ;
le logo de page utilise `logo`, un descripteur image de 5 Mio maximum. Une chaîne
`logoUrl` non nulle reste refusée : elle ne prouve pas les octets à importer.

Le serveur ne sert aucune URL distante directement. L’action d’import :

1. relit le miroir, sa révision, son empreinte, le réseau et l’émetteur actifs ;
2. n’accepte que les origines explicitement autorisées, sans redirection,
   identifiants HTTP, cookies, compression ou port autre que 443 ;
3. résout les adresses IPv4 publiques et épingle la connexion HTTPS à une adresse
   validée en conservant la vérification TLS du nom ; IPv6 seul reste fermé ;
4. borne chaque transfert à quinze secondes, vérifie le MIME, le nombre réel
   d’octets et le SHA-256, puis écrit le blob local ;
5. enregistre immédiatement les dépôts provisoires et rejuge l’autorité à leur
   rattachement ; fraîcheur, politique d’usage, taille/MIME/empreinte stockés,
   inscription au scan et rattachement s’effectuent en transaction.

Deux imports au plus travaillent simultanément, avec baux de quatre-vingt-dix
secondes, watchdog et trois tentatives. Les arguments planifiés ne contiennent
pas les URL. Une ancienne action ne peut pas rattacher des médias à une révision
plus récente ; son nettoyage ne détruit aucun blob déjà admis.

Les copies sont admises comme fichiers externes, jamais `server_generated`.
`requiresFullScan` exige un état propre et un verdict antivirus propre : scan
sauté, antivirus absent/échoué ou libération sans cette preuve restent retenus.
Le coupe-circuit des fichiers demeure fermé. Le DTO montre des médias en attente
ou bloqués sans URL ; après rattachement il réutilise la garde de délivrance.

## Console et activation

La console distingue le reçu métier du transfert. `applied` signifie que l’état
source a été traité, pas que les médias ont été analysés ou reçus sur un appareil.
`attached` signifie transfert/rattachement, avec analyse encore requise. Les
origines, URL, empreintes, identifiants de stockage et corps ne sortent pas dans
la liste opérateur des transferts. Une relance exige administrateur IDN vivant,
motif, débit et audit `federation.media_retry` ; elle ne rétablit pas une source
retirée.

Le propriétaire configure hors dépôt :

- l’émetteur `administration-ga`, sa clé et `FEDERATION_ENVIRONMENT` ;
- `ANTSIA_FEDERATION_ADMINISTRATION_MEDIA_ORIGINS`, tableau JSON de 1 à 16
  origines HTTPS exactes sur 443, sans chemin ni joker ;
- le fournisseur antivirus et sa capacité de scan.

Aucune configuration réelle, modification `.env`, commande de production ou
publication du socle n’a été effectuée. La réception réelle dépend encore du
producteur/outbox PA9D ; les agents volontaires relèvent de PA9C.

## Preuves et limites

Les scénarios de contrat, téléchargement et cycle de publication sont écrits
sans exécution. Les preuves antérieures à PA9B ne couvrent pas ces changements.
Il reste une fenêtre de crash entre le retour de `storage.store` et la première
inscription confirmée du blob provisoire : un arrêt brutal dans cette fenêtre
peut laisser un blob sans registre. Le nettoyage `finally` et le watchdog
couvrent les erreurs récupérables et les dépôts déjà inscrits, sans prétendre
rendre atomiques stockage et base. Cette limite doit être incluse dans la future
recette et la stratégie d’entretien des blobs.

Références : [contrat](contrats/RESEAU-PUBLIC-V1.md),
[plan PA9](15_PLAN_EXECUTION_PA9.md),
[ADR-0014](adr/0014-publications-federees-sans-personne-technique.md).
