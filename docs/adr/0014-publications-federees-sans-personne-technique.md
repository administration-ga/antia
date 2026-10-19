# ADR-0014 : Publications fédérées de page sans personne technique

- **Statut** : Proposé ; code PA9B raccordé, vérifications différées par le propriétaire.
- **Date** : 2026-10-18
- **Portée** : PA9B ; complète ADR-0003, ADR-0009 et ADR-0013.

## Contexte

La page administrative est un acteur institutionnel. Un reflet public ne donne
aucun consentement pour créer une personne, un signataire ou une adhésion. Le
writer natif exige pourtant un auteur personne, et plusieurs projections
utilisent ce signataire même lorsque l’en-tête affiche une page.

Les médias distants sont des octets externes. La signature de l’émetteur ne
remplace ni leur admission locale, ni leur analyse, ni la garde de délivrance.
Leur téléchargement ne peut pas appartenir à une mutation transactionnelle.

## Décision

1. Utiliser la table réelle `posts` et conserver les écrivains natifs à auteur
   personne obligatoire. Un reflet institutionnel porte `federationSource`, une
   page et aucun `authorPersonId`. Les gardes ferment toute ligne sans auteur
   natif ni mapping fédéré valide. Le DTO membre conserve un objet auteur neutre
   avec identifiant nullable ; les mini-profils de personnes ne sont pas élargis.
2. Exiger audience publique et geste source explicite dans le contrat fermé.
   Conserver l’identifiant, la date source initiale et l’engagement local lors
   des révisions. L’état de modération local reste indépendant de l’état source.
   Un retrait est définitif pour sa référence et purge les copies importées.
3. Relire l’autorité source au moment des lectures et restaurations, sans se
   fier uniquement au statut de page ou publication. Le retrait de page lance
   une cascade bornée, protégée par sa révision parent. Les mises à jour reçues
   sous une preuve ultérieure ne sont pas détruites par cette ancienne cascade.
4. Importer les médias à partir de descripteurs signés et bornés. Autoriser les
   seules origines HTTPS configurées explicitement, vérifier et épingler une
   adresse IPv4 publique, refuser redirections et compression, contrôler les
   octets, le MIME et le SHA-256. IPv6 seul reste fermé pour cette version.
5. Séparer transfert et rattachement : bail, révision/digest, dépôts provisoires,
   fraîcheur puis admission transactionnelle, scan requis et garde de délivrance.
   Aucun octet externe n’est déclaré produit par le serveur. Un scan sauté ou
   un antivirus non propre ne peut pas rendre un fichier fédéré servable.
6. Conserver le manifeste sous modération restrictive pour permettre sa reprise
   après restauration locale admissible. Limiter à deux imports simultanés et
   trois tentatives par série. Une nouvelle série administrative exige une
   identité IDN forte vivante, un motif et un audit. Le reçu métier et l’état
   de transfert restent présentés séparément.

## Conséquences

Les publications fédérées réutilisent fils, murs, réactions, commentaires et
partages. Aucun acteur humain fictif n’est introduit. L’indisponibilité des
médias peut être rendue sans URL distante et sans prétendre à une livraison.

La frontière auteur implique des adaptations de DTO et de consommateurs ; les
anciennes données natives restent valides. Le stockage et la base restent deux
systèmes : un crash entre `storage.store` et son inscription durable peut laisser
un blob orphelin. Les actions récupérables et les dépôts inscrits disposent d’un
nettoyage, sans garantie d’atomicité entre ces deux systèmes.

Les clients producteurs, les origines de médias et les preuves de livraison
réelles restent à configurer et à éprouver. Aucun test n’a été exécuté pour ce
lot. L’opt-in des agents et l’outbox du socle relèvent des tranches suivantes.

## Alternatives considérées

- Créer un profil technique : rejeté, cela inventerait une personne et une
  autorité sociale non consentie.
- Créer un second fil de publications fédérées : rejeté, cela dupliquerait les
  gardes, la pagination et les interactions.
- Servir les URL de l’émetteur : rejeté, cela contournerait la garde des fichiers.
- Réactiver une copie par rejeu après son retrait : rejeté, cela contredirait la
  tombe de source et les décisions locales de modération.

## Références

- [Rapport PA9B](../16_PUBLICATIONS_ET_MEDIAS_FEDERES_PA9B.md)
- [Contrat RESEAU-PUBLIC-V1](../contrats/RESEAU-PUBLIC-V1.md)
