# ADR-0025 : Conversation contextuelle ouverte et fermée par un objet déjà accepté

- **Statut** : Accepté — validation du propriétaire du 19/10/2026, relayée par la session
  DIASPORALE, citée mot pour mot : « Je valide les décisions D1 à D16 du contrat
  CONVERSATION-CONTEXTUELLE-V1, avec les amendements D5 et D8 ; transmets-le à ANTSIA. » La
  validation couvre D1 à D16 tels qu'au §14 du contrat, D5 et D8 amendés, et la correction du
  §6.3. **D7 (conservation) et D13 (export d'un message en voix de page) restent à confirmer
  juridiquement.**
- **Date** : 2026-10-19
- **Portée** : contrat `docs/contrats/CONVERSATION-CONTEXTUELLE-V1.md` ; sous-lots CC-1 à CC-6 ;
  complète ADR-0009 (gardes et droits personnels), ADR-0019 (canal commercial distinct) et
  ADR-0021 (contact commercial), sans les modifier.
- **État d'exécution** : CC-1 (domaine pur), CC-2a (type du résolveur) et CC-2b (backend du moteur)
  sont écrits dans les sources, **sans aucune vérification** (décision du propriétaire du
  18/10/2026 : « Continuer sans vérifier ») ; tests écrits, non exécutés. Rapport :
  `docs/etudes/2026-10-18-social-commerce/rapports/CC_CONVERSATION_CONTEXTUELLE.md`.

## Contexte

DIASPORALE met en relation des personnes avec des pages et des mentors : demande de service
(DG-013, DG-014), mentorat accepté (DG-024c), candidature présélectionnée (DG-025). Ces échanges
exigent une conversation privée, mais deux règles déjà décidées l'interdisent par les voies
existantes :

- la messagerie personnelle n'est ouverte qu'entre relations acceptées
  (`assertCanOpenPersonalThread`, `messaging/inbox.ts`) ; l'élargir aux inconnus a été rejeté par
  ADR-0019 (option B : démarchage et harcèlement sans quota ni acceptation) ;
- le canal commercial P10 (ADR-0021) est lui-même l'objet (demande, puis acceptation par la
  boutique), repose sur des mandats de boutique et engage des contrats avec PRO.GA ; l'accord
  D-G01 interdit à la mise en relation DIASPORALE tout lien PRO.GA et tout vocabulaire « commerce ».

Les objets DIASPORALE portent déjà leur propre parcours d'accord et un consentement explicite
d'identité. Il manquait une conversation qui naisse de cet accord, sans en créer un second.

## Décision

Nous ajoutons au moteur une troisième famille de conversations, bornée explicitement :
`convex/modules/contextualMessaging/`, tables `contextual*`.

1. **L'objet ouvre et ferme la conversation.** Elle n'a ni demande ni acceptation propres ; elle
   naît une seule fois par objet (`contextKey`), dans le réseau de l'objet, et son cycle se lit sur
   l'objet. Ses deux seuls gestes propres sont la clôture irréversible par un côté (D12) et,
   en CC-4, l'accord d'appel.
2. **Contexte typé fermé.** Trois natures V1 (`diasporaServiceRequest`, `diasporaMentoring`,
   `diasporaJobApplication`), chacune avec sa colonne typée ; `commerceJobApplication` et
   `shopContact` sont réservées et refusées. Ajouter une nature suit la procédure fermée du §10.5.
3. **Parties calculées, jamais stockées.** À chaque lecture et écriture, le moteur relit l'objet par
   le résolveur de la tranche, puis l'adhésion, la vivacité, les signataires vivants (D2), les
   blocages et la politique. Un ancien participant ne garde rien.
4. **Contrat de résolveur.** La tranche fournit, par nature, un chargeur en lecture seule, sa règle
   pure « état effectif → phase », sa visibilité propre, le pays du guichet et une règle de texte
   facultative qui reçoit le contexte de l'émetteur (D8 amendé). Le type vit dans
   `convex/modules/contextualMessaging/contract.ts`, sans fonction ; `registry.ts` est le seul
   fichier du moteur qui importe la tranche, avec un repli « nature indisponible ».
5. **Deux voix.** Une personne parle sous son nom publié ; une page parle d'une seule voix, et le
   signataire qui écrit n'est jamais montré au demandeur (D3).
6. **Gardes du moteur.** Politique par réseau et par nature fermée par défaut, réglée en console
   avec motif et audit `contextual.policy_set` ; débits `contextual.*` (D14) ; pièces par la garde
   des fichiers, deux par message (D9) ; cloche par deux genres neutres sans contenu ; modération
   par la surface unique `contextualMessage` (D15) ; export selon PA5 et effacement en cascade par
   les parents.
7. **Aucun appel automatique** (D5 amendé, CC-4) : un appel exige l'accord explicite des deux
   personnes dans le fil, qui vaut admission pour ce seul fil au-dessus du réglage « hors de mes
   relations : silencieux » ; « ne pas déranger », occupation et absence restent appliqués.
8. **Aucune durée de conservation inventée** (D7) : `CONTEXTUAL_RETENTION = null`, aucune tâche
   planifiée ; une conversation fermée reste lisible des parties jusqu'à l'effacement ou la
   suppression de l'objet.

P10 reste distinct en V1 (D1) ; une convergence facultative (CC-8) n'est envisageable qu'après
vérification et recette de P10.

## Conséquences

### Positives

- La messagerie personnelle reste fermée aux inconnus ; aucune relation, aucun suivi ni aucun fil
  personnel ne naît d'un échange contextuel.
- La révocation est immédiate (rôle retiré, page désactivée, sortie, suspension, blocage, objet
  clos) parce que rien n'est mis en cache comme vérité.
- La tranche ne détient aucune autorité sur les personnes : elle ne décrit que l'objet.

### Négatives

- Trois familles de conversations à maintenir et à tester (extension de la conséquence acceptée
  par ADR-0019), atténuée par des règles neutres partagées, des points de contact généralisés et
  une voie de convergence écrite.
- Chaque lecture relit l'objet et les signataires : coût de lecture plus élevé qu'un fil personnel,
  borné par page et par une mémoire locale à une requête.
- Un crochet manqué de la tranche retarde le cache, la coupure d'un appel établi et la purge ; le
  cliquet `contextual-hooks` rend les crochets obligatoires dès qu'une nature est enregistrée.

### Neutres

- Fermer la politique d'une nature est le retour arrière : l'historique reste lisible des parties
  (D10), aucune donnée n'est supprimée.

## Alternatives considérées

### Option A — ouvrir la messagerie personnelle sur un objet

Rejetée : contournerait la garde de relation (ADR-0019, option B) et ferait d'un objet de
mise en relation un « fil existant » personnel, réutilisable hors de son contexte.

### Option B — faire de la mise en relation un cas particulier de P10

Rejetée pour la V1 (D1) : sémantique, autorité et engagements externes différents ; P10 n'est
ni vérifié ni recetté ; l'accord D-G01 exclut tout canal attaché à une boutique.

### Option C — stocker la liste des participants dans le fil

Rejetée : une liste stockée survit à la perte d'un droit ; la révocation ne serait plus immédiate.

## Références

- `docs/contrats/CONVERSATION-CONTEXTUELLE-V1.md` (contrat accepté, §14 décisions validées).
- `docs/etudes/2026-10-18-social-commerce/EXECUTION.md` (réservations CC-1/2a/2b).
- ADR-0009, ADR-0019, ADR-0021, ADR-0024.
