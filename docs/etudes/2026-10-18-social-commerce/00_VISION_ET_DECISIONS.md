# ANTSIA — Réseau social de découverte, de vente et de services

Date : 18 octobre 2026. Statut : **étude et proposition d'architecture ; aucune implémentation exécutée par ce dossier**.

## 1. Direction retenue pour l'étude

**ANTSIA met en relation les personnes et leurs activités ; PRO.GA gère ces activités.** Une personne découvre un contenu, consulte l'offre associée, échange avec son vendeur et peut commander ou réserver. Une entreprise retrouve dans PRO.GA son catalogue, ses stocks, ses clients, ses commandes et sa gestion.

Le propriétaire a confirmé dans cette conversation que « Pro.gram » désigne **PRO.GA**. ANTSIA conserve son nom canonique. La refonte visuelle vise ANTSIA uniquement ; les composants communs continuent de servir DIASPORALE avec leur comportement actuel tant qu'une adoption explicite n'est pas décidée.

La demande porte sur des **plans et prompts Markdown**. Les documents proposent une nouvelle charte et des parcours ; ils ne changent pas l'application affichée dans le navigateur.

## 2. Les quatre références, traduites en un produit cohérent

| Référence demandée | Ce que l'on reprend comme principe | Résultat ANTSIA proposé |
|---|---|---|
| Instagram | Le média et son auteur au premier plan, carrousel lisible, actions compactes, profils visuels | Une carte de publication commune au fil, au profil et aux boutiques ; identité claire et sombre sobre |
| TikTok | Progression verticale, un contenu principal à la fois, lecture immédiatement compréhensible | Fil immersif mobile, geste vertical entre publications et geste horizontal dans une galerie ; mode liste accessible |
| WhatsApp | Conversation puis appel, commandes familières, continuité de l'échange | iCom lisible, demandes de contact commercial, appels persistants pendant la navigation |
| Facebook | Pages, groupes, relations et identité d'organisation | Une page sociale qui peut devenir boutique, vitrine de services ou page employeur |

Les références officielles sont documentées dans [le benchmark](01_BENCHMARK_SOURCES.md). Les dimensions, couleurs et contrats proposés ici sont des choix ANTSIA ; ce ne sont pas des spécifications internes supposées de ces plateformes.

## 3. Qui utilise quoi ?

| Persona | Besoin prioritaire | Exemple de parcours |
|---|---|---|
| Acheteur | Comprendre l'offre et savoir à qui il paie | Vidéo → produit → taille/couleur → montant total → paiement → suivi |
| Vendeur individuel, artisan | Commencer simplement sans devoir comprendre un ERP | Profil → créer ma boutique → choisir mon activité → préparer mes offres → activer la vente |
| Commerçant et équipe | Une seule gestion des stocks et prix | PRO.GA → publier une collection vers ANTSIA → répondre aux demandes → préparer les commandes |
| Prestataire indépendant | Expliquer sa spécialité et obtenir des demandes qualifiées | Réalisation → service → zone/date/besoin → devis ou créneau → confirmation |
| Employeur | Publier une offre et traiter des candidatures confidentielles | PRO.GA → offre publiée → ANTSIA → candidature privée → suivi dans PRO.GA |
| Chercheur d'emploi | Distinguer emploi, mission et service vendu | Découvrir → Emplois → fiche → candidater ; aucun passage au panier |
| Modérateur / support | Traiter abus, usurpation et litiges sans accès général aux conversations | Signalement → éléments nécessaires → décision motivée → recours |

## 4. Périmètre par étapes de produit

### Version A — Le nouveau réseau agréable à consulter

Charte claire/sombre, navigation simplifiée, carte média, défilement immersif, conservation de position, messagerie et appels plus lisibles. Les médias actuels restent compatibles. Les garde-fous de session, réseau et droits sont conservés.

### Version B — La vitrine commerciale et la conversation

Création d'une boutique en brouillon par tout membre actif, publication suivant la politique commerciale, rattachement volontaire à PRO.GA, catalogue reflété, fiche produit/service, collection et demande de contact. Une offre avec prix sur devis affiche « Demander un devis », jamais un faux bouton d'achat.

### Version C — L'achat et le service réellement exécutés

Panier d'un seul vendeur, confirmation des prix/variantes, réservation atomique du stock dans PRO.GA, commande, paiement auprès d'un prestataire configuré, suivi, annulation et remboursement. Services : devis et rendez-vous. Emploi : candidature privée. La version commerciale transactionnelle ne peut être dite livrée avant recette complète de ces opérations.

### Version D — La continuité sur téléphone réel

Application native ANTSIA, appels entrants/arrière-plan, notifications ciblées, expérience de faible connectivité et parité des parcours commerciaux. La ressemblance WhatsApp implique cette tranche ; une fenêtre Web étroite ne la remplace pas.

## 5. Exigences et résultats vérifiables

| ID | Exigence | Priorité | Critère de résultat |
|---|---|---|---|
| SC01 | Une charte ANTSIA cohérente en clair et sombre | P0 | Toutes les surfaces principales suivent les mêmes rôles ; contraste et reflow vérifiés |
| SC02 | Publications photo, galerie, vidéo et texte lisibles | P0 | Aucun média étiré ou produit coupé ; chaque action existe au clavier |
| SC03 | Progression verticale immersive | P0 | Un seul média joue ; retour à la même publication après ouverture d'une fiche |
| SC04 | Navigation compréhensible sur téléphone et bureau | P0 | Fil, découverte, création, messages et profil toujours repérables |
| SC05 | Messages et appels continus | P0 | Naviguer ne coupe pas l'appel ; refus micro/caméra et réseau perdu sont récupérables |
| SC06 | Chacun prépare sa boutique | P0 | Un membre déclaré crée un brouillon ; les droits d'encaissement restent distincts |
| SC07 | Pages adaptées aux métiers | P0 | Produit, devis, réservation et emploi ont des actions et champs différents |
| SC08 | Catalogue PRO.GA comme autorité commerciale | P0 | Une mise à jour/retrait rejoint ANTSIA sans saisie contradictoire |
| SC09 | Question au vendeur sans relation préalable | P0 | Demande filtrée, acceptation/blocage possibles, aucun droit d'appel implicite |
| SC10 | Achat et paiement fiables | P0 pour Version C | Aucun double débit/commande ; prix et stock relus ; succès seulement après preuve serveur |
| SC11 | Devis et rendez-vous | P1, obligatoire pour le lot services | Acceptation du client authentifiée ; absence de double réservation |
| SC12 | Offres d'emploi et candidatures | P1, obligatoire pour le lot emploi | Offre publique volontaire ; CV et candidature réservés aux personnes autorisées |
| SC13 | Isolation, confiance et droits personnels | P0 transverse | Ni fuite inter-réseaux, ni mandat vendeur déduit d'un badge ou d'un e-mail |
| SC14 | Qualité mesurée en conditions locales | P0 transverse | Recette faible débit, erreurs, VoiceOver/clavier et téléphone réel documentée |
| SC15 | Continuité native des appels | P1, obligatoire avant promesse de parité téléphone | Appel reçu écran verrouillé sur Android et iOS réellement testés |
| SC16 | Mesures utiles, consenties et minimisées | P0 transverse | Succès des tâches/transactions mesuré ; aucune conversation ou candidature dans l'analytique |

P0 signifie nécessaire à la version concernée ; cela ne rend pas tous les lots simultanés. [La feuille de route](09_FEUILLE_DE_ROUTE.md) les ordonne.

## 6. Ce que la nouvelle demande fait évoluer

| Règle ou périmètre antérieur | Évolution proposée | Conservation nécessaire |
|---|---|---|
| Paiements hors périmètre initial du cahier §8, monétisation ultérieure A6 | Le commerce devient un axe principal ; ajouter des lots dédiés | Le fait d'étudier n'autorise aucune activation financière ou publication |
| Création de page réservée à une adhésion vérifiée | Nouveau parcours de boutique progressive, brouillon ouvert au membre déclaré | Ne pas ouvrir les pages institutionnelles ni attribuer le badge « Vérifié » automatiquement |
| Lecture anonyme des pages limitée aux pages Officiel | Projection spécifique de boutique publiée et admise | Gardes anonymes existantes inchangées ; aucune ouverture générale des pages |
| Conversation personnelle entre relations | Canal commercial sur demande explicite, doté de permissions propres | Ne pas élargir toutes les conversations ni tous les appels aux inconnus |
| Charte bleu/parchemin héritée | Signature encre, ivoire et prune, photographies dominantes | Fond blanc/cartes beige conservés en clair ; habillage réservé à ANTSIA |
| « Le citoyen ne paie jamais » pour l'accès au réseau | Accès social gratuit ; achat volontaire d'une offre payante | Aucun frais d'inscription/candidature introduit ; commission et abonnement vendeur restent à décider |
| Fédération entrante surtout sociale | Deux contrats séparés : projection publique et commande commerciale privée | Aucune base partagée ; aucun identifiant technique ou contact glissé dans l'inbox publique |

Les ADR acceptés restent intacts. Le futur lot P00 devra proposer les ADR complémentaires et amender les sections touchées du cahier, sans réécrire leur historique.

## 7. Décisions de conception prises dans cette étude

1. Une boutique est une **capacité d'une page**, liée à une activité ; elle n'est pas un nouveau réseau ni un second profil personnel.
2. Le catalogue commercial canonique vit dans PRO.GA. Le vendeur peut le saisir depuis une interface ANTSIA simplifiée, mais cette interface commande PRO.GA par contrat ; aucune double base maître des prix et stocks.
3. Le fil mobile propose l'immersion comme expérience principale une fois validée en recette ; le mode liste reste disponible et respecte la préférence de réduction des mouvements.
4. Un seul paiement concerne un vendeur et une devise en V1 ; pas de panier multi-vendeurs, wallet ANTSIA ou séquestre improvisé.
5. Les appels sont des appels Internet entre membres. Les appels vers numéros téléphoniques ordinaires ne sont pas inclus.
6. L'identité, les autorisations et la confidentialité priment sur une ressemblance visuelle. Aucun chiffrement de bout en bout ne sera annoncé sans protocole et preuve propres à ANTSIA.
7. Les contenus commerciaux sont identifiés ; aucune donnée privée de message, de candidature ou d'achat ne sert au classement public.

## 8. Arbitrages encore nécessaires, sans bloquer le dossier

| Décision | Proposition de travail | Responsable / moment limite |
|---|---|---|
| Publication d'une boutique non vérifiée | Autoriser la vitrine déclarée avec limites et modération ; encaissement après admission vendeur | Propriétaire produit, P07 |
| Prestataire de paiement et bénéficiaire des fonds | Décision P12 : ANTSIA encaisse puis prévoit la part vendeur selon contrat ; réception acheteur requise avant reversement, PRO.GA orchestre. Fournisseur, couverture et redistribution restent à contractualiser ; aucun connecteur actif | Propriétaire et partenaire, avant activation réelle ; voir rapport P12 |
| Frais et commission | Aucun taux inventé ; afficher le total dès qu'un modèle est décidé | Propriétaire, avant paiement pilote |
| Livraison / retrait | Retrait et livraison gérée par vendeur, zones et frais explicites ; pas de réseau logistique supposé | Produit et vendeurs pilotes, P11 |
| Conditions de vente, admission vendeurs, conservation financière | Validation adaptée aux pays effectivement servis ; pas de durée légale inventée | Propriétaire / conseil compétent, avant ouverture commerciale |
| Chiffrement privé de bout en bout | Étude de protocole et d'appareils distincte ; ne pas confondre chiffrement réseau et E2EE | Sécurité/produit, avant toute promesse E2EE |
| Contenu et stocks du pilote | Vendeurs consentants, articles de recette et commandes de test identifiables | Propriétaire, avant P18 |

Les choix de dimensions, de palette et d'organisation détaillés dans les documents suivants sont assez concrets pour être revus et implémentés lot par lot.
