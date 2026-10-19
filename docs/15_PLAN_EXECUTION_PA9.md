# PA9 — Fédération des administrations

18 octobre 2026. Implémentation dans le moteur réellement servi ; la demande
humaine diffère la campagne de vérification et la recette des médias.

## Tranche PA9A : pages officielles

Le transport signé PA5 est conservé. Le contrat `RESEAU-PUBLIC-V1` reçoit
`page.upserted` depuis l’émetteur enregistré `administration-ga`, uniquement
dans un réseau `administration` miroir actif rattaché à la racine ANTSIA.
Configuration et secret restent au propriétaire ; aucune base externe n’est lue.

- Payload fermé et borné ; référence d’objet publique corrélée à l’enveloppe,
  révision entière monotone et date de vérification. Les autres événements et
  les images distantes sont refusés avant conservation d’un nouveau corps.
- Page institutionnelle officielle à visibilité racine. Son adresse est dérivée
  d’une empreinte stable, sans reprendre un identifiant de base externe.
- Mapping `mirrors` portant révision/digest et tombe de retrait. Un ancien
  événement ne restaure pas une identité plus récente ; deux contenus sous une
  même révision sont en conflit.
- `verifiedAt: null` retire le badge et désactive la page. Une nouvelle preuve
  positive ne réactive pas automatiquement une page inactive : la décision de
  modération locale reste disponible dans la console.
- Identité, revendication et signataires sont fermés localement sur un miroir.
  Le déclin d’une invitation et la modération locale restent ouverts.
- Admission et rejeu appellent le même traitement transactionnel. Les reçus
  appliqués, les résolutions de lettre morte et le retour opérateur sont reliés.

## Tranche PA9B : publications, retraits et médias

Implémentée dans les sources le 18 octobre 2026, sans campagne de vérification.
Contrat signé des publications publiques volontaires, vraie table posts sans
personne technique, retraits définitifs par référence, cascade de page bornée,
médias importés sous garde et relance administrative motivée. Le détail, les
conditions de configuration et les limites sont dans
[le rapport PA9B](16_PUBLICATIONS_ET_MEDIAS_FEDERES_PA9B.md).

## Tranche PA9C : agents volontaires

Implémentée dans les sources le 18 octobre 2026, sans vérifications : accord
local explicite et versionné, identité IDN préexistante, nonce renouvelable,
attestation signée sans provisioning, badge/affiliation calculés, retrait
opposable aux rediffusions, export et effacement personnels. Carte branchée
dans « Mes données » et affiliation publique sous les gardes du profil.
Le détail est dans [le rapport PA9C](17_AGENTS_VOLONTAIRES_PA9C.md),
la décision dans [ADR-0015](adr/0015-agents-volontaires-et-accord-local-renouvelable.md).

## Tranche PA9D : producteur et outbox côté administration

Implémentée dans les sources le 18 octobre 2026 : gestes publics du composeur,
producteur transactionnel pages/publications/retraits, outbox signée avec baux et
reprises, preuve IDN existante, transfert privé de consentement, accord/retrait
sur le portail administratif et déclarations des flux. Vérifications toujours
différées ; aucune génération Convex, PR ni publication.
Détail : [rapport PA9D](18_PRODUCTEUR_ET_OUTBOX_ADMINISTRATION_PA9D.md).

La configuration propriétaire, la PR du socle et la recette croisée de
développement restent ouvertes. Toute publication du socle reste une décision explicite.

## Répartition des fichiers

PA9C : contrat et scénarios par un exécuteur ; hooks d'identité/consentement et
accès par un second ; carte et projection publique par un troisième.
Coordinateur : grant, autorité, retrait, traitement signé, registre, effacement,
transport et documentation. Les éditions DIASPORALE, refonte et commerce
préexistantes sont préservées. Aucun changement de branche dans l’arbre partagé.

## État des preuves

La vérification globale précédente (7 212 tests) est historique et ne couvre pas
ce lot. Aucun nouveau test, build ou parcours navigateur n’est annoncé réussi.
Quatorze scénarios PA9A ont été écrits dans le harnais existant sans exécution.
Les contrôles différés devront couvrir signatures, isolation du réseau,
révisions concurrentes, retrait avant création, rejeu, droits locaux, images
refusées et projection publique. Aucun commit ni déploiement de production.

Contrat : [RESEAU-PUBLIC-V1](contrats/RESEAU-PUBLIC-V1.md). Décisions de cette
tranche : [ADR-0013](adr/0013-pages-administratives-federees-et-revisions-source.md).
