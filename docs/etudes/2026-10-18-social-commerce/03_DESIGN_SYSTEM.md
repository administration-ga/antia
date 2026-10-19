# Nouvelle charte ANTSIA — Encre, ivoire et prune

Statut : proposition du 18 octobre 2026, **non appliquée au CSS**. Objectif : laisser les photos, les personnes et les offres porter l'interface, avec une signature propre et un confort constant en clair/sombre.

## 1. Direction visuelle

Une base neutre, une seule couleur d'action, peu d'ombres, une typographie simple et des médias généreux. L'inspiration Instagram porte sur la hiérarchie média/auteur/actions et la sobriété. Le bleu institutionnel dominant laisse place à une prune profonde en clair et une rose prune douce en sombre. Le dégradé reste facultatif sur un anneau de story ou un visuel de marque ; jamais derrière un prix, du texte courant ou un contrôle.

La demande antérieure **fond blanc, cartes beige** reste le socle du thème clair. Le beige est réservé aux cartes et panneaux ; il ne remplit pas la page. En sombre, fond charbon et cartes légèrement relevées, sans appliquer un filtre inversant les photos.

## 2. Palette proposée et rôles

Les noms de rôles ci-dessous sont conceptuels. L'implémentation mappe les jetons existants avant d'en ajouter au contrat commun.

| Rôle | Clair | Sombre | Emploi |
|---|---|---|---|
| Fond page | `#FFFFFF` | `#141419` | Document, zones entre cartes |
| Surface carte | `#F7F6F2` | `#202026` | Publication, fiche offre, rail, conversation |
| Surface élevée | `#FFFFFF` | `#2A2A33` | Menu, feuille, fenêtre de confirmation |
| Texte principal | `#1F2024` | `#F7F6F2` | Auteur, prix, titres et corps |
| Texte secondaire | `#62636B` | `#B9B7C0` | Date, unité, aide ; pas de gris presque invisible |
| Action principale / lien | `#8B2F73` | `#EDADD8` | Acheter, publier, envoyer ; lien souligné selon contexte |
| Texte sur action | `#FFFFFF` | `#24101F` | Étiquettes de boutons pleins |
| Séparateur décoratif | `#DEDCE2` | `#3C3A44` | Division visuelle, jamais seul repère d'un champ |
| Contour de contrôle | `#7B7780` | `#8F8998` | Champs et contrôles non remplis |
| Focus | `#8B2F73` | `#EDADD8` | Anneau visible avec espace autour |
| Succès | `#14704A` | `#83D5AB` | Icône + texte de confirmation |
| Erreur / danger | `#B4233F` | `#FFACB9` | Erreur de formulaire, action de raccrocher |

Prix, disponibilité et confiance utilisent aussi un texte ou un symbole. Une couleur ne prouve jamais qu'une commande est payée, qu'une personne est vérifiée ou qu'un article est en stock.

### Contrastes calculés pendant l'étude

Calcul sRGB / luminance relative, valeurs opaques de la table. Il s'agit d'un contrôle arithmétique de palette, **pas d'un audit du rendu navigateur**.

| Association | Ratio clair | Ratio sombre |
|---|---:|---:|
| Texte principal / fond | 16,27:1 | 16,98:1 |
| Texte principal / carte | 15,05:1 | 14,98:1 |
| Texte secondaire / carte | 5,52:1 | 8,18:1 |
| Texte du bouton / fond primaire | 7,63:1 | 9,90:1 |
| Accent / carte | 7,06:1 | 8,93:1 |
| Contour de contrôle / carte | 4,05:1 | 4,78:1 |
| Succès / carte | 5,63:1 | 9,31:1 |
| Danger / carte | 5,97:1 | 9,15:1 |

Le seuil retenu pour le texte courant est 4,5:1 ; les grands textes peuvent relever du seuil 3:1 selon leur taille/poids. [W3C, contraste minimum](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html). Les séparateurs décoratifs n'ont pas vocation à entourer seuls un contrôle interactif. Recalculer les mélanges, survols, opacités et superpositions sur vidéo au moment de la recette.

## 3. Typographie, géométrie et rythme

| Élément | Proposition |
|---|---|
| Police d'interface | Inter existante, sans ajout de police distante ; marque actuelle conservée jusqu'à décision distincte |
| Corps / formulaires | 16 px, interligne 1,5 ; champs à 16 px minimum sur téléphone |
| Secondaire | 14 px, interligne 1,4 ; 12 px réservé aux métadonnées non essentielles |
| Titres | 20/28 px, puis 28/36 px ; éviter le surdimensionnement au-dessus du fil |
| Graisses | 400 corps, 500 contrôles, 600 auteur/titre/prix ; chiffres tabulaires pour montants |
| Espacements | Échelle 4, 8, 12, 16, 24, 32, 48 px |
| Rayons | 12 px carte/champ, 16 px feuille ; avatar rond ; pas de capsules partout |
| Icônes | Lucide existantes, 22–24 px, libellés accessibles ; état actif aussi par graisse/remplissage |
| Cible tactile produit | 44 × 44 px minimum recommandé, espacement conservé |
| Animation | 120–180 ms pour retours d'action ; 200–240 ms pour feuille ; aucune animation indispensable |
| Focus | 2 px avec décalage 2 px, non masqué par barre fixe ; test réel clavier |

La cible tactile de 44 px est un choix de confort ANTSIA. Le critère WCAG 2.2 AA 2.5.8 fixe 24 px ou un espacement suffisant, avec exceptions ; ne pas confondre les deux. [W3C, taille minimale](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html).

## 4. Composants de référence

| Composant conceptuel | Anatomie / variantes | États obligatoires |
|---|---|---|
| Publication | Auteur, origine/réseau, média, actions, légende, offre facultative ; texte/photo/galerie/vidéo/partage | Chargement, publication en cours, prête, média refusé, retirée, hors droits |
| Carte d'offre | Vendeur, photo, titre, prix/unité, disponibilité indicative, CTA selon type | Disponible, sur devis, épuisée, non livrable, prix à reconfirmer, retirée |
| Bouton | Primaire, secondaire, discret, danger ; une action dominante par zone | Repos, survol, focus, pression, attente, désactivé avec raison |
| Galerie | Un média à la fois, index « 2/4 », précédent/suivant | Début/fin, chargement, erreur d'un média, alternative textuelle |
| Feuille | Titre, fermer, contenu, action ; mobile plein écran si clavier/formulaire long | Ouverte, attente, erreur récupérable, fermeture/restauration du focus |
| Conversation | Identité personnelle ou boutique explicitée, messages, contexte offre, composeur | Brouillon, envoi, envoyé, livré/lue si preuve disponible, échec, bloqué |
| Appel | Identité, état texte, durée seulement une fois connecté, micro/caméra/sortie/raccrocher | Sortant, entrant, connexion, connecté, reconnexion, terminé, indisponible |
| Confiance | Badge calculé existant + libellé clair | Aucun badge revendiqué par CSS ni statut commercial confondu avec identité civile |

Pour les messages, « envoyé » désigne l'admission serveur. « Livré » et « lu » exigent leurs preuves séparées. Une animation d'attente ne doit pas simuler une confirmation.

## 5. Mise en page et responsive

- **320–599 px** : une colonne, marges de 12–16 px ; média presque bord à bord, légende et contrôles respirent. La navigation basse respecte les zones sûres du téléphone.
- **600–959 px** : colonne centrale de 560–640 px maximum, navigation adaptée sans imposer une fausse coque de téléphone fixe.
- **À partir de 960 px** : rail de navigation ; fil centré de 560–640 px ; panneau contextuel facultatif. Le rail iCom ne concurrence pas systématiquement le média principal.
- **Grand écran** : largeur globale plafonnée autour de 1 440 px ; commentaires ou détail produit à côté du média. Une longue légende reste lisible, pas étalée sur toute la largeur.
- **Paysage, zoom 200 %, texte agrandi** : basculer vers le flux de document/listes lorsque nécessaire, sans couper les commandes ni imposer le défilement dans deux axes.

Les seuils prolongent la bascule 960 px actuelle. La recette couvre 320, 375, 393, 440, 768, 960, 1280 et 1440 px. Aucun chiffre n'est présenté comme une dimension d'Instagram.

## 6. Cartes, vidéos et couches

Les cartes de texte et les métadonnées restent beige en clair. Une vidéo peut occuper une zone sombre pour préserver ses pixels ; cela ne transforme pas toute l'application en thème sombre. Les textes superposés utilisent un fond protecteur stable dont le contraste est mesuré, pas une ombre aléatoire sur la vidéo.

Ordre des couches : document → navigation → panneau contextuel → menu/feuille → dialogue bloquant → appel entrant. Les niveaux doivent devenir des jetons partagés, avec arbitrage explicite lorsque deux surfaces veulent le premier plan. L'appel entrant suspend le média du fil ; il ne ferme pas un brouillon.

## 7. Traduction dans les jetons existants

Points d'entrée constatés : [thème ANTSIA](../../../packages/ui/src/themes/antsia.css), [charte commune](../../../packages/ui/src/styles/charte.css), [audit](02_AUDIT_ANTSIA.md).

| Famille actuelle | Traitement prévu |
|---|---|
| `--background`, `--background-dashboard`, `--card`, `--foreground`, `--primary` | Mapper vers les rôles de la palette |
| `--esp-surface-card`, textes et interactions `--esp-*` | Maintenir les mêmes rôles que les cartes sémantiques |
| `--ink-*`, `--primary-*`, `--primary-fill`, `--on-fill` | Cartographier leurs usages avant migration ; ne pas inverser aveuglément toute une échelle |
| Surfaces nocturnes | Surcharge ANTSIA à la spécificité adaptée : `.dark[data-charte="antsia"]` et `.dark [data-charte="antsia"]` |
| Nouveaux besoins | Étendre le contrat central avec des rôles génériques et des valeurs par défaut compatibles, puis surcharger uniquement ANTSIA |

Les primitives `components/ui` ne sont pas réécrites. Les couleurs littérales restent dans `packages/ui/src/styles` ou `themes`. Aucune modification du thème DIASPORALE. Les nouveaux comportements partagés sont opt-in par capacités de l'application, pas par test de nom de marque disséminé.

## 8. Critères de validation de la charte

- Même paire fond/carte sur fil, profil, boutique, messages, feuilles et formulaires.
- Thème système/clair/sombre préservé au rechargement ; aucun flash durable de mauvais thème.
- Changer de thème ne remonte ni session, appel, lecteur ni brouillon.
- États focus/erreur/chargement visibles, aucun contrôle uniquement au survol.
- Captures comparables en clair/sombre aux largeurs convenues, contrastes rendus mesurés.
- Les noms des personnes suivent le normaliseur partagé ; organisations et titres ne subissent pas cette transformation.
- Anciennes surfaces DIASPORALE/console contrôlées sur la migration de contrat, sans refonte visuelle induite.
