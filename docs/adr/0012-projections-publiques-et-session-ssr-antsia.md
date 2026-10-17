# ADR-0012 : Projections publiques et session SSR propres à ANTSIA

- **Statut** : Accepté pour la recette locale ; publication soumise à A5 et à la validation juridique.
- **Date** : 2026-10-17
- **Portée** : PA8 ; complète ADR-0008, ADR-0009 et ADR-0010.

## Contexte

Les lectures sociales du moteur restent réservées aux membres. La vitrine PA0
n'expose aucune projection sociale anonyme. La racine inclut les contenus de ses
enfants, mais une origine fermée ne doit pas devenir publique par défaut.
Les providers de session montés au root masquent le HTML public pendant leur
bootstrap ; les cookies du SDK inter-domaines ne sont pas accessibles au serveur
Next. Sur localhost, les trois applications partagent l'hôte et ses cookies.

## Décision

1. Introduire sept projections nominatives dans `modules/public`, annotées
   `@publicProjection`, qui vérifient une racine active et ne rendent que des DTO
   allowlistés. Aucune garde membre n'est élargie. Publications : `root`, `onRoot`,
   audience publique, origine active attachée à cette racine et modération admise.
   Une prélecture demeure fermée même sans propriétaire enregistré. Médias et
   original d'un partage sont relus par leurs gardes. Aucun signataire ou état de
   lecteur ne sort. Un profil retiré conserve éventuellement ses publications,
   sous une identité neutre ; son profil réduit reste fermé.
2. Les nouvelles publications natives deviennent publiques uniquement après
   un geste explicite, faux par défaut. Aucun contenu historique n'est migré.
   Les règles des pages enfants demeurent celles de leur page. Retirer la
   diffusion publique conserve le contenu dans son origine ; retirer le contenu
   referme toutes ses lectures. Ces deux gestes restent distincts.
3. La province est une attribution facultative et stable du contenu, issue du
   référentiel des neuf provinces ; aucune résidence ou identité civile n'est
   déduite. National/province/tag utilisent des fenêtres paginées et conservent
   leur curseur brut lorsqu'une fenêtre filtrée est vide.
4. Les mesures publiques sont matérialisées en générations, par tranches de25,
   avec curseur, bail et plafond explicites. Les jobs ne contiennent aucun auteur.
   Les tendances exigent cinq contributions et une borne inférieure de cinq
   auteurs ; la transparence rend seulement le total d'une période si cas et
   auteurs distincts atteignent le seuil. Aucune souscatégorie soustrayable.
5. Séparer les providers de présentation du root et les providers de session
   des portes privées. Le serveur lit un reçu HttpOnly propre à ANTSIA, admis
   après preuve de SID signé, session Better Auth vivante et JWT vérifié/corrélé
   par Convex. Le broker local ne crée et ne révoque aucune session amont.
   Le transport partagé et les consommateurs DIASPORALE restent inchangés.
6. Une génération visible non secrète ferme le reçu avant connexion, SSO,
   adoption OTT et déconnexion. Une réponse ancienne ne change jamais cette
   génération. Désaccord, expiration, révocation ou panne ne deviennent jamais
   une visite anonyme par repli. L'OTT est adopté sur l'origine courante avant
   lecture. La déconnexion globale conserve son verrou et purge aussi le reçu
   local avant navigation. Origines configurées, corps et délais sont bornés.
7. La console membre de modération relit ses compétences et la cible assignée.
   Son aperçu rend uniquement un extrait borné du contenu signalé, jamais une
   conversation, des participants ou des informations civiles. Les décisions
   réutilisent les mutations, motifs et audits existants. Les recours réseau
   sont réservés à son administrateur, avec un décideur indépendant ; les recours
   plateforme restent dans la console PA7.

## Conséquences

Le HTML public et ses métadonnées peuvent être rendus sans faux contexte membre.
Les profils privés, contenus `network`, prélectures et origines archivées restent
fermés. Les reçus ne confondent pas les applications qui partagent localhost.
Les mesures peuvent être partielles ; leurs périodes et bornes doivent être dites.

Une requête HTTP qui ne porte aucun reçu ANTSIA est réellement anonyme pour le
serveur : celui-ci ne lit pas le stockage local du SDK. Le dispositif protège les
transitions et les credentials connus de l'application, sans prétendre identifier
une personne qui consulte Internet sans credentials. Chrome/AA, IDN et transports
réels restent des preuves distinctes de la recette de code et de SSR.

## Alternatives considérées

- Ouvrir `networkQuery` aux anonymes : rejeté, cela élargirait toutes les lectures.
- Copier les cookies Better Auth dans des noms communs aux applications : rejeté,
  collisions de ports et autorité résiduelle à la reprise d'une session.
- Reconfigurer le transport partagé : rejeté pour préserver les consommateurs et
  les preuves de DIASPORALE ; le broker est opt-in, propre à cette application.
- Calculer les compteurs dans chaque visite : rejeté, lectures non bornées et coût
  proportionnel au réseau. Garder des identifiants d'auteurs dans les agrégats : rejeté.

## Références

- [PA8, plan d'exécution](../12_PLAN_EXECUTION_PA8.md)
- [Charte ANTSIA](../05_CHARTE_ANTSIA.md)
- [Cahier, invariants et R1–R4/R7](../00_CAHIER_DES_CHARGES_ANTSIA.md)
- [Rapport de recette PA8](../13_RAPPORT_RESEAU_PUBLIC_PA8.md)
