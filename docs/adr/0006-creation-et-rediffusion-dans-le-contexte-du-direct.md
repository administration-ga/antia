# ADR-0006 : Création, rediffusion et fenêtre dans le contexte du direct

- **Statut** : Accepté
- **Date** : 2026-10-16

## Contexte

F3a/F3b laissent des API sans surface : création de page/followers, choix initial
d'invités, gestion avancée de rediffusion et fenêtre de conférence. Le formulaire
local au réseau se démontait à 959/960 px. L'annonce followers perdait aussi sa
page et était refusée par la garde des publications.

## Décision

La coque persistante possède le brouillon lancé depuis le réseau ou iCom, comme
elle possède déjà la salle. Les présentations ne créent ni salle ni renderer audio.
La carte emploie le déplacement existant de la coque, des clés de session préfixées
par réseau et une miniature appariée par personId, jamais par nom.

Une page est choisie parmi les signatures vivantes du réseau courant. L'éligibilité
des invités est relue avec le contexte followers avant création, puis rejugée par
create et goLive. Une annonce public/followers conserve pageId, la même audience
que la conférence et la visibilité network. Une annonce nominative reste interdite ;
une annonce de page vers les relations n'est pas proposée, puisque les publications
de page n'acceptent que public/followers.

L'hôte décide seul de la copie, y compris pendant sa préparation. Le retrait est
confirmé, la récupération ne recrée pas de capture, et la piste WebVTT voyage en
texte vers l'action existante. Les URLs restent exclusivement produites par la garde
des fichiers. L'acceptation d'une piste ne promet pas sa servabilité immédiate.

## Conséquences

- Le brouillon titre/invités survit à la bascule téléphone/bureau ; une fermeture
  explicite, une nouvelle demande ou un changement de réseau le remplace/ferme.
- La signature de page se voit sur la conférence ; le rôle du présentateur reste
  personnel. Les vignettes de découverte conservent leur DTO minimal et leur hôte.
- Réduire ou déplacer la carte n'arrête aucun média. Quitter l'antenne exige un
  geste confirmé ; terminer reste conditionné par le droit serveur.
- Une réponse de création devenue obsolète ne navigue pas ; une réponse de fin
  ne ferme pas une nouvelle salle ouverte entre-temps.
- Le rail contient au plus trois cartes par fenêtre. Une fenêtre vide avec curseur
  propose de poursuivre ; une vraie fin vide reste silencieuse.
- Les recherches de pages et d'invités gardent leurs bornes existantes (50), sans
  affirmer un annuaire exhaustif. L'épingle et la vue du studio restent locales
  à sa présentation, comme au socle.
- Les tests et la recette sans service média ne prouvent pas SFU/Egress, caméra,
  partage, audio ni lecture d'un enregistrement réel. Cette recette reste au lot
  d'intégration après configuration LiveKit par le propriétaire.

## Alternatives considérées

Un brouillon local à chaque coquille perd la sélection au changement de largeur.
Une seconde salle dans la carte double la connexion et le son. Une URL de dépôt
pour le VTT ouvre un stockage avant la validation du texte. Ces alternatives sont
écartées au profit des propriétaires et gardes déjà présents.

## Références

- [Parité F3c](../04_RAPPORT_PARITE_FRONT.md)
- [Studio et droits d'antenne](0005-studio-persistant-et-droits-d-antenne.md)
- Sources socle ad2e7fdc2, relues sur origin/main 25398f565, identiques sur le
  périmètre de création, rediffusion, fenêtre et rail porté.
