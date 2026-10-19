# PA9D — Producteur et outbox de l'administration

18 octobre 2026. Demande humaine : poursuivre l'implémentation, sans vérifications.
Aucun test, génération de code, typage, lint, build, serveur ou recette à lancer.
Aucun secret, environnement réel, publication ou donnée métier à modifier.

## Périmètre et séquence

1. Conserver la séparation des bases. Copier le contrat pur dans le socle ; aucun
   import interproduit ni client Convex de l'autre produit.
2. Brancher le producteur transactionnel aux pages vérifiées, aux publications
   publiques portant un geste explicite `publishToAntsia`, et à tous les retraits.
3. Construire une outbox persistante : références opaques, révisions monotones,
   baux de travail, lots bornés, signature HMAC environnement/horodatage/corps exact,
   nouvelles tentatives bornées et accusés métier distincts de l'admission HTTP.
4. Brancher l'accord/retrait côté administration sur une identité IDN réellement
   corrélée à une session vivante et une adhésion administrative validée. Ne pas
   traiter `users.idnSub`, `authId` ou les pseudo-rattachements d'un superadmin
   comme une preuve suffisante.
5. Transférer l'accord ANTSIA sans sujet IDN dans le navigateur : code court
   propre au grant, une utilisation, lié au même sujet vérifié côté serveur.
   Résolution HTTP authentifiée avec réponse signée et liée à la requête.
6. Déclarer le flux, sa minimisation/rétention et ses limites. Scénarios écrits
   sans exécution, génération Convex et recette croisée différées.

## Coordination du socle partagé

La copie source canonique est sur `chantier/dgap-module-20261016`, avec beaucoup
d'éditions étrangères. Le fichier `socle/AGENTS.md` demande avant édition un fetch
de `origin/main`, un fast-forward sûr de main, sinon un arrêt. La tentative de
fetch du 18 octobre rend « Repository not found ». Aucune branche, référence
distante ni modification étrangère n'est remplacée. Le propriétaire a explicitement autorisé la poursuite dans ces sources, sans
actualisation distante ni changement de branche. Les modifications PA9D ont donc
été ajoutées au checkout canonique, en préservant les autres travaux.

## Points de raccordement repérés

- `reseauPages/pages.ts` : `publishAsPage`, `removePagePost` ; `public` historique
  signifie tout le réseau connecté, pas un consentement ANTSIA. Case distincte,
  fausse par défaut ; interdite pour `organisation`.
- `reseauPages/admin.ts` : activation/désactivation ; page active ne suffit pas,
  vérifier aussi le statut officiel de l'organisation.
- `reseauPersonnel/contentRemoval.ts` : retrait commun, y compris modération.
- Médias : préserver les gardes de fraîcheur, d'acteur et d'analyse ajoutées par
  les autres sessions. Une URL source servable ne prouve pas une analyse clean.
- Le barrel existant `@workspace/federation-contracts` importe du Node : nouveau
  point d'entrée pur nécessaire pour les mutations/queries Convex.
- Le transport NDJOBI utilise une autre signature ; ne pas le substituer à celle
  d'ANTSIA, ni assimiler `response.ok` à un reflet appliqué.

## État

Code ajouté aux sources et raccordé aux points métier décrits ci-dessous.
Les scénarios sont écrits sans exécution. Aucune recette ou preuve de production
ne découle de ce document. Décision : [ADR-0016](adr/0016-producteur-administratif-et-transfert-de-consentement.md).

## Implémentation source

### Producteur administratif

Dans `ADMINISTRATION_GA/socle/convex/modules/reseauPublicFederation/` :

- `tables`, `producer`, `enqueue` : sources publiques, révisions, consentements
  personnels et outbox transactionnelle. Les références exposées sont des
  empreintes cloisonnées par environnement, jamais des identifiants Convex.
- `delivery`, `reconcile`, `triggers` : autorité relue avant chaque envoi,
  rapprochement borné avec curseur, retrait des pages, réexamen des affiliations.
- `identity`, `agents`, `agentActions`, `agentEvents`, `rate` : session Better Auth
  vivante liée au sujet, compte IDN unique, véritable rattachement validé, poste
  vivant dans une administration vérifiée ; accord explicite et retrait self.
- `outbox`, `transport`, `transportPolicy` : lots de 150, baux de 120 secondes,
  HTTP limité à 15 secondes, corps de réponse limité à 4 Kio, dix tentatives
  réseau et reprise exponentielle bornée à une heure.

`schema.ts` agrège les quatre tables nouvelles ; `crons.ts` branche les passes
pages/publications/agents, le drain et l'expiration privée. Les déclencheurs des
organisations, pages et utilisateurs gardent les autres écrivains du socle.
Le retrait commun d'une publication couvre aussi sa modération. Les changements
IDN, la fin du rattachement, le retrait du profil et la suppression de compte
révoquent les accords concernés. Le réexamen des fonctions est borné et son délai
dépend du volume : il ne constitue pas une garantie de synchronisation instantanée.

La case du composeur est distincte de l'audience interne et ne se restaure pas
depuis le brouillon. Le rejeu d'une ancienne clé de publication ne promeut jamais
une publication historique. Une publication source retirée ne renaît pas à la
suite d'une simple restauration de sa ligne : une nouvelle publication est nécessaire.

### Ordre, délivrance et médias

Une publication et une attestation attendent le reçu **applied** de la dernière
révision de leur page parente. Cette attente ne consomme pas de tentative HTTP.
`received` reste en attente d'application ; `dead_letter` et `discarded` sont des
échecs explicites. Le même événement/corps est réutilisé lors d'une reprise réseau.
Les résultats d'un ancien bail ne peuvent pas remplacer le résultat du bail courant.

Les descripteurs de médias utilisent les métadonnées du stockage, leur empreinte
réelle et une analyse **clean avec verdict antivirus clean**. Un fichier sans
scan, skipped ou retenu ne part pas. Les publications avec médias attendent leur
admission complète ; leur texte ne part pas en perdant silencieusement les images.
Le logo distant historique sans preuve d'octets n'est pas repris. Les médias
importés restent ensuite soumis aux gardes et analyses propres à ANTSIA.

### Transfert d'accord et données

ANTSIA ajoute `agents.prepareTransfer` et `POST /federation/agent-consent`.
Le bouton de Mes données prépare un lien à activer explicitement, avec un code
valable dix minutes, utilisable une fois, transmis dans le fragment de l'URL.
Le lien ne contient ni sujet IDN ni nonce du consentement. Le portail administratif
nettoie le fragment, conserve le code uniquement en mémoire et demande un nouveau
geste : administration réelle, nom public choisi et case initialement décochée.

La résolution serveur signe la requête ; la réponse est signée avec un domaine
séparé et liée au SHA-256 de la requête exacte. La transaction finale rejuge
session, sujet, configuration, poste et accord avant l'outbox. Le retrait local
reste ouvert au titulaire avec session vivante même après désactivation/perte IDN.
Aucun compte, profil ou rattachement racine n'est créé depuis une source externe.

Le sujet IDN et le nonce restent dans la table personnelle de consentement et les
corps réseau transitoires, jamais dans les arguments de jobs ou une DLQ personnelle.
Après retrait, les données privées sont conservées au plus sept jours pour tenter
le retrait externe, et expurgées dès son reçu appliqué. L'effacement effectif du
compte purge les consentements et jobs personnels sans délai supplémentaire.
L'export du compte ajoute les preuves projetées sans sujet, nonce ni référence
de transport. Une livraison de retrait non confirmée avant la purge reste une
limite explicite ; aucune purge distante ou réception réelle n'est annoncée.

### Configuration laissée au propriétaire

Côté administration :

- `ANTSIA_FEDERATION_ENVIRONMENT` : sandbox ou production explicite ;
- `ANTSIA_FEDERATION_ENDPOINT` : URL exacte terminant par `/federation/inbox` ;
- `ANTSIA_FEDERATION_ADMINISTRATION_KEY` : clé partagée avec le registre ANTSIA.

Côté ANTSIA : registre d'émetteur `administration-ga`, réseau `administration`
miroir et racine actifs, environnement et secret correspondants ;
`ANTSIA_ADMINISTRATION_PUBLIC_ORIGIN` pour le retour au portail administratif.
HTTPS est obligatoire ; HTTP loopback est réservé à la sandbox explicitement
configurée. Aucun environnement réel, secret ni domaine n'a été édité.

Les deux contrats sont inscrits dans le registre des flux du socle, avec
`productionEvidence:false`. Classification et rétention juridique restent à
valider ; la borne technique de sept jours n'en tient pas lieu.

## Clôture de la tranche

Code local ajouté dans les deux vrais arbres partagés. Scénarios de contrats,
transfert, autorité, producteur et transport écrits **sans exécution**. Aucune
génération Convex, test, vérification globale, compilation, recette, commande de
production, publication, commit ou PR. Les API générées doivent être actualisées
lorsque les vérifications seront reprises. La copie typée et l'ADR-0225 du socle
restent à confronter à la branche distante et aux PR avant livraison.

PA9 reste ouvert pour configuration propriétaire, contrôles, PR du socle et
recette croisée de développement ; aucune preuve PA8 n'est réutilisée comme
validation de PA9D.
