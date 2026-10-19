# Boutiques, services et emploi — modèle produit

Statut : proposition du 18 octobre 2026. PRO.GA est confirmé comme système de gestion. Les capacités déjà présentes et leurs limites sont recensées dans [l'audit PRO.GA](07_AUDIT_PRO_GA.md).

## 1. Une page qui s'adapte à l'activité

La boutique est une capacité d'une page sociale. Une même personne garde son profil, peut administrer plusieurs activités selon ses mandats et choisit sous quelle identité elle publie. La boutique possède son nom commercial ; les conventions de casse des personnes ne s'appliquent pas aux organisations.

Le choix d'un modèle active des blocs et des actions, sans créer un site différent pour chaque métier. L'utilisateur peut ensuite composer plusieurs capacités : une couturière propose des articles et des retouches ; un restaurant affiche un menu et recrute ; un photographe présente des réalisations et des prestations sur devis.

| Modèle | Blocs principaux | Champs métier nécessaires | Action principale |
|---|---|---|---|
| Commerce de produits | Collections, articles, nouveautés, informations vendeur | Variantes, prix/devise/unité, disponibilité, retrait/livraison, retours | Voir le produit / Commander |
| Artisan / fabrication | Réalisations, options, délais, témoignages admissibles | Sur mesure, mesures ou spécifications choisies, délai, devis | Demander un devis |
| Prestataire local | Services, zone d'intervention, réalisations, horaires | Périmètre de prestation, zone, durée, tarif fixe/à partir de/sur devis | Demander / Réserver |
| Salon / professionnel sur rendez-vous | Prestations, agenda disponible, équipe autorisée | Durée, ressource, lieu, créneau, politique d'annulation | Choisir un créneau |
| Restauration | Menu, catégories, horaires, retrait/livraison | Options, disponibilité par période, minimum éventuel, frais | Commander |
| Créateur / indépendant | Portfolio, spécialités, services, contacts | Livrables, délai, révisions, prix ou devis | Présenter mon besoin |
| Entreprise / employeur | Présentation, offres commerciales, emplois | Poste, contrat, lieu, compétences, date limite, rémunération si renseignée | Candidater |
| Association / collectif | Activités, événements, services autorisés | Nature de l'organisation, responsables, conditions de participation | Participer / Contacter |

Le pilote commence par commerce de produits + service sur devis. Les autres modèles réemploient les mêmes capacités au fil des lots. Les secteurs réglementés exigent une admission adaptée avant activation ; aucune qualification professionnelle n'est déduite d'un choix de modèle.

## 2. Ouvrir sa boutique en quatre étapes compréhensibles

1. **Mon activité** : nom commercial, spécialité et modèle. Un membre actif peut préparer un brouillon ; aucune vérification civile fictive n'est créée.
2. **Ma présentation** : logo/photo, description, zone approximative choisie, horaires. Prévisualisation téléphone et bureau.
3. **Mes offres** : rattacher une activité PRO.GA existante ou préparer son activation. Importer seulement les offres explicitement publiables, sans dupliquer le catalogue maître.
4. **Publier / activer la vente** : récapitulatif des informations rendues publiques et des capacités disponibles. La préparation, la publication de vitrine et l'encaissement sont trois étapes distinctes.

Un vendeur qui ne possède pas PRO.GA reçoit un parcours de création d'activité simplifié, consentant, dans PRO.GA ou via une commande contractuelle dédiée. ANTSIA ne crée jamais un compte PRO.GA ou une société en silence. Le brouillon de vitrine peut précéder la liaison ; les articles commerciaux canoniques arrivent après cette liaison.

### Politique progressive proposée

| Situation | Préparer | Vitrine publique | Recevoir une question | Encaisser |
|---|---|---|---|---|
| Membre déclaré actif | Oui | Après admission de la vitrine déclarée, selon politique à valider | Après publication, avec quotas | Non par simple déclaration |
| Identité vérifiée | Oui | Selon admission de la vitrine | Oui selon réglages | Pas automatiquement |
| Vendeur PRO.GA lié, mandat vivant | Oui | Offres publiées consenties | Équipe autorisée | Seulement après admission commerciale et configuration du prestataire |
| Membre suspendu / boutique retirée | Pas de nouvelle publication | Retirée des surfaces de découverte | Arrêt des nouvelles sollicitations | Arrêt des nouveaux achats ; suivi des obligations antérieures maintenu par voie dédiée |

Le code actuel exige une personne vérifiée pour créer n'importe quelle page et PRO.GA retire le module commerce aux structures non vérifiées. L'implémentation doit introduire des capacités limitées de préparation/publication et les tester. **Changer un libellé ou retirer globalement ces gardes ne suffit pas.** Les pages Officiel restent sous leur autorité actuelle.

## 3. La page boutique

En-tête : nom, logo, catégorie, zone de service, statut de confiance exact, suivre, partager, contacter. Sous l'en-tête : **Offres · Publications · À propos** ; onglets Services/Emplois ajoutés seulement quand la capacité est active. Le visiteur ne voit pas une collection d'onglets vides.

Le catalogue se filtre par catégorie, prix et disponibilité indicative. Le vendeur choisit une collection de couverture et quelques offres mises en avant. Les métadonnées sont fiables et courtes ; pas de grand bandeau promotionnel permanent au-dessus des produits.

L'éditeur propose des blocs et une palette limitée de présentation ; il n'accepte ni HTML arbitraire, scripts, couleurs cassant les contrastes ni réécriture de la navigation. La signature ANTSIA reste cohérente quel que soit le commerçant.

## 4. Produit : du contenu à la commande

La fiche contient photos, titre, vendeur, description, options/variantes, prix exact ou intervalle qualifié, unité, disponibilité indicative, modes de remise, frais, délai annoncé et conditions. Les informations de paiement sont récapitulées avant engagement.

```mermaid
flowchart LR
    P[Publication] --> F[Fiche produit]
    F --> V[Variante et quantité]
    V --> R[Adresse ou point de retrait]
    R --> C[Confirmation prix et stock PRO.GA]
    C --> T[Total et conditions]
    T --> A[Autorisation de paiement chez le prestataire]
    A --> E[État vérifié par le serveur]
    E --> S[Suivi dans Mes achats]
```

V1 : panier mono-vendeur et XAF, cohérent avec le catalogue PRO.GA actuel. Un changement de vendeur demande d'ouvrir un autre panier sans effacer la sélection précédente sans avertissement. Une variante sans prix/stock/identifiant stable ne devient pas achetable tant que son contrat n'est pas résolu.

**« À partir de »**, intervalle et **« Sur devis »** ne sont pas des prix payables. Le prix du panier est recalculé par PRO.GA. Si une différence apparaît, afficher l'ancien et le nouveau récapitulatif et demander une nouvelle confirmation avant paiement. Ne pas appliquer de conversion de devise implicite.

## 5. Service : demandes, devis et rendez-vous

Trois parcours explicites :

- **Tarif fixe sans créneau** : prestation décrite, zone et délai convenus ; commande de service sans réservation de stock physique.
- **Sur devis** : besoin, contraintes, date souhaitée et pièces choisies → demande → devis versionné → acceptation authentifiée du client → commande. Une modification après envoi crée une nouvelle version à accepter.
- **Sur rendez-vous** : prestation, ressource, créneaux disponibles, lieu → réservation temporaire → confirmation selon politique → éventuel acompte. La confirmation d'un rendez-vous et celle d'un paiement restent séparées.

Les heures sont affichées avec le fuseau pertinent ; la réservation porte un instant et une zone explicites. Deux clients visant le même créneau ne peuvent pas obtenir deux confirmations incompatibles. Changer/annuler un rendez-vous relit les règles et affiche les conséquences avant confirmation.

La réservation et le devis actuels PRO.GA nécessitent des adaptations pour un demandeur ANTSIA. Le fait qu'un employé ait marqué un devis « accepté » ne constitue pas une preuve d'acceptation du client social.

## 6. Emploi, mission et offre de service

| Objet | Auteur | Destination | Données |
|---|---|---|---|
| Emploi | Employeur et recruteur mandatés | Candidature | CV/pièces et réponses privées, date limite, suivi |
| Mission / appel à prestation | Donneur d'ordre | Proposition commerciale | Périmètre, budget facultatif, délai, devis |
| Service proposé | Prestataire | Demande/devis/réservation | Réalisations et offre publique, demandes privées |

Les emplois ne sont jamais dans un panier. Le candidat ne paie pas pour candidater. Publier un emploi exige un mandat employeur ; la candidature arrive dans le recrutement PRO.GA via un contrat privé dédié. Les messages sociaux et la popularité du profil ne servent pas au classement automatique des candidats.

L'offre fermée disparaît des nouvelles recommandations et indique sa clôture sur un lien connu. Les candidatures restent consultables seulement par leur auteur et les recruteurs habilités selon les règles de conservation définies. Les fichiers passent les gardes d'admission et de délivrance ; aucun CV n'est joint à un événement public.

## 7. Après la vente

« Mes achats » montre commande, montant, état de paiement, préparation, livraison/retrait, discussion et support. Le vendeur gère l'exécution dans PRO.GA ; ANTSIA reflète le résultat, sans bouton capable de fabriquer un paiement réussi.

Annulation, retour, remboursement et litige possèdent des états distincts. Le retrait d'une offre retire la découverte mais ne supprime pas la preuve d'une commande passée. Les documents déjà émis restent sous l'autorité de PRO.GA. Un avis vérifié, si ajouté, dépend d'une transaction éligible ; aucun avis de démonstration n'est affiché comme authentique.

## 8. Modèle économique à décider

Accès social et création d'un brouillon gratuits. Options futures : abonnement de gestion PRO.GA, services vendeurs, commission transparente, promotion étiquetée. Aucun taux ni promesse de revenus n'est fixé par l'étude. Les frais réels du parcours retenu doivent être présentés avant paiement, y compris si la plateforme ne facture rien.

Le succès se mesure à des demandes utiles, des commandes correctement exécutées et des vendeurs actifs, pas uniquement au temps passé à faire défiler les vidéos. Voir [la recette et les mesures](10_RECETTE_MESURES_ET_RISQUES.md).
