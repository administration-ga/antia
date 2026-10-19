# P15 — Emploi et candidatures privées

**Dépendances :** P08, P09. **Spécifications :** [06](../06_BOUTIQUES_SERVICES_EMPLOI.md), [08](../08_ARCHITECTURE_INTEGRATION.md), [10](../10_RECETTE_MESURES_ET_RISQUES.md). **Ownership :** recrutement PRO.GA, projections d'emploi et surfaces candidates ANTSIA ; réserver les fichiers partagés au coordinateur.

```text
Depuis la racine ANTSIA, lis et applique le préambule :
docs/etudes/2026-10-18-social-commerce/prompts/PROMPT_COMMUN.md. Implémente uniquement P15, sans enchaîner un autre lot.
Ce prompt est documentaire : aucune implémentation n'a été exécutée par sa rédaction.

1. Revalide P08/P09 et les producteurs réels de ../PRO_GA/convex/modules/recruiting/
{tables,openings,applications}.ts. PRO.GA reste l'autorité des postes, candidatures,
entretiens et décisions. Réutilise sa route structure/[structureRef]/recrutement.
Nouvelles cibles proposées, à confirmer : packages/social-features/src/features/
employment/ et routes emplois/candidatures de l'app ANTSIA, centralisées dans
lib/routes.ts. Réutilise les passerelles livrées, sans importer le backend voisin.

2. Ajoute un consentement explicite de publication vers ANTSIA par un employeur
mandaté. Le statut interne published ne suffit pas. Définis les schémas fermés
job.published/job.closed du contrat public, puis leurs producteurs, révisions,
retraits et handlers. Le DTO contient poste, contrat, lieu, compétences, échéance
et rémunération renseignée ; exclut candidats, coordonnées privées et notes RH.
Une offre clôturée quitte la découverte mais son lien connu indique sa clôture.
Un ancien événement ne la réactive pas après retrait.

3. Branche Candidater vers application.submit par le canal privé signé. ANTSIA
identifie le candidat ; PRO.GA vérifie sujet délégué, structure, offre encore
ouverte, limites et consentement. N'accorde aucun rôle de structure au candidat
et ne remplace pas recordApplication par une mutation publique permissive.
Déduplique la demande avec résultat stable ; même clé et autre corps produisent
un conflit. Le suivi candidat expose seulement ses données et états autorisés,
jamais les notes internes. Prévois retrait de candidature selon politique définie.
Emploi, mission commerciale et service restent distincts : aucun panier ni frais
pour candidater, aucun classement par popularité ou messages sociaux.

4. Fais admettre CV et pièces par la garde fichiers : propriétaire, taille, MIME,
analyse et autorisation avant délivrance. Définis le transfert interproduits
autorisé et ses références opaques ; aucun identifiant de stockage, URL privée
ou CV dans l'événement public. Teste export, retrait et effacement des blobs/copies
selon conservation validée, sans inventer de durée. Chaque lecture recruteur
revalide son mandat ; sa révocation ferme aussi les anciens liens de fichiers.

5. Tests : publication sans mandat, clôture concurrente au dépôt, rejeu, autre
candidat/réseau/structure, recruteur révoqué, CV infecté/retiré et URL directe.
Recette coordonnée : publier volontairement depuis PRO.GA, candidater dans ANTSIA,
suivre puis retirer ; vérifier les refus avec un tiers, téléphone/bureau et clavier.
Applique les contrôles du préambule et rapporte les preuves séparément.
Arrête l'activation si contrat privé, mandat, admission des CV ou politique de
conservation manque ; poursuis seulement les éléments indépendants autorisés.
```

**Acceptation :** offre volontairement publique, candidature privée canonique PRO.GA, documents gardés et accès immédiatement refusé au recruteur révoqué.
