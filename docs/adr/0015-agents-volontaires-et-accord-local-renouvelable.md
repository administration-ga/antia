# ADR-0015 — Agents volontaires et accord local renouvelable

Date : 18 octobre 2026.
Statut : proposé ; code PA9C, vérifications différées par le propriétaire.

## Contexte

Une attestation administrative ne crée ni compte, ni profil social, ni accord au
nom d'une personne. Le retrait doit résister aux retards, aux révisions source
supérieures et à un futur effacement, sans conserver une tombe IDN indéfinie.

## Décision

L'accord est enregistré dans ANTSIA par le titulaire d'une identité IDN déjà
corrélée, avec un profil et une adhésion racine existants. Un grant personnel
référence ce consentement et un nonce opaque renouvelé à chaque accord. Le
contrat signé transporte ce nonce, son empreinte comme référence d'agent et le
sujet IDN à comparer côté serveur. Aucun sujet inconnu n'est conservé ou provisionné.

Le consentement local courant et l'attestation source sont requis ensemble. La
source ne peut renouveler l'accord ; son retrait le révoque. L'activation ne
modifie ni le profil choisi ni la racine ni les rôles de modération. Les badges,
accès et projections relisent le grant et les autorités courantes. Les effets
révoqués sont limités au lien et à l'adhésion administrative du grant.

Les corps personnels ne sont pas conservés dans la DLQ partagée. Les refus métier
produisent un reçu `discarded`. Le grant est exporté par projection et effacé avec
la personne. Une nouvelle génération après retrait/effacement ne reconnaît plus
les anciens messages ; aucune tombe personnelle partagée permanente n'est nécessaire.

## Conséquences

Le producteur PA9D doit obtenir la référence du consentement par un transfert
authentifié et transmettre la date exacte de l'accord. Un reçu technique ne
prouve pas une affiliation appliquée. Les copies typées, la configuration et la
recette interproduits restent à réaliser séparément ; le code PA9C n'est pas vérifié.
