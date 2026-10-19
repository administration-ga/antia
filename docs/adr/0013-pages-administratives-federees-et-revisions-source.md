# ADR-0013 : Pages administratives fédérées et révisions source

- **Statut** : Proposé ; implémentation locale PA9A, vérifications différées par le propriétaire.
- **Date** : 2026-10-18
- **Portée** : Première tranche PA9 ; complète ADR-0003 et ADR-0009.

## Contexte

Le transport PA5 authentifie les livraisons mais ne crée aucun reflet métier.
Les pages institutionnelles ont déjà une projection publique et peuvent naître
sans personne créatrice. Une publication exige au contraire un auteur personne,
et la présence volontaire d’un agent exige un consentement distinct. Ces deux
cas ne peuvent pas être déduits de l’existence d’une administration.

L’identifiant d’événement empêche une double livraison, mais ne suffit pas à
ordonner plusieurs mises à jour d’une même page. Un retrait arrivé avant une
ancienne création doit rester effectif. Enfin, une mise à jour de la source ne
doit pas annuler une désactivation locale.

## Décision

1. Raccorder uniquement `page.upserted` de `RESEAU-PUBLIC-V1`, depuis l’émetteur
   enregistré `administration-ga`, dans le réseau fermé `administration` à
   politique `mirror`, enfant de la racine active `antsia`. Le registre choisit
   le réseau. Le contrat refuse champs étrangers et médias non admis avant
   conservation d’un nouveau corps. Aucun accès à une base externe.
2. Conserver dans `mirrors` la révision métier entière, le digest de la
   projection normalisée et l’état source. Une révision inférieure est ignorée ;
   une révision égale et identique est dédoublonnée ; une contradiction est
   conservée en lettre morte. Ces règles sont indépendantes de la clé de
   livraison et de la révision de configuration de l’émetteur.
3. Une preuve positive crée ou actualise la page institutionnelle officielle.
   `verifiedAt: null` retire sa confiance et sa diffusion, et la désactive. Sans
   page locale, le retrait conserve uniquement une tombe de révision. Une mise
   à jour positive ne réactive jamais une page existante inactive ; cette
   décision reste locale. Une référence locale incohérente n’est pas adoptée.
4. Fermer la gestion native des pages possédant un mapping de fédération :
   identité, confiance, revendication et signataires. Le badge ne sert pas à
   déterminer leur origine. La modération locale et le déclin d’une invitation
   restent possibles.
5. Utiliser le même traitement transactionnel à la réception et au rejeu.
   Conserver l’enveloppe et le reçu existants au rejeu ; résoudre la lettre morte
   seulement après succès. La console distingue application, dédoublonnage et
   nouvel échec. Aucun profil, identité, adhésion ou signataire n’est créé.

## Conséquences

La page réutilise les tables et projections existantes. Une ancienne livraison
ne restaure pas un état retiré. L’émetteur peut actualiser son identité sans
reprendre la main sur une décision locale de modération.

La configuration réelle, la preuve d’échange signé et la projection observée
restent à réaliser. Les scénarios de non-régression sont écrits mais non exécutés.
Les publications, les médias et les agents volontaires restent fermés jusqu’aux
tranches PA9B/PA9C ; le producteur du socle et la recette croisée relèvent de PA9D.

## Alternatives considérées

- Créer une personne technique pour publier : rejeté, cela inventerait une
  identité et contournerait la décision sur l’auteur et le consentement.
- Dédoublonner uniquement par `eventId` : insuffisant pour une livraison ancienne
  portant un autre identifiant après un retrait.
- Servir une URL distante de logo : rejeté tant qu’elle ne passe pas l’admission
  et la délivrance des fichiers du moteur.
- Réactiver systématiquement une page encore vérifiée : rejeté, cela écraserait
  la modération locale.

## Références

- [Plan PA9](../15_PLAN_EXECUTION_PA9.md)
- [Contrat métier RESEAU-PUBLIC-V1](../contrats/RESEAU-PUBLIC-V1.md)
- [Transport FEDERATION-INBOX-V1](../contrats/FEDERATION-INBOX-V1.md)
