# ADR0024 — Emploi consenti et candidatures privées

Date : 18 octobre 2026. Statut : proposé pour les sources P15 ; tests écrits, non exécutés ; recette ouverte (décision du propriétaire « Continuer sans vérifier »). Numérotation locale, sans consultation distante.

## Contexte

PRO.GA est l'autorité des postes, candidatures, entretiens et décisions de recrutement (`recruiting/`). Le statut interne `published` d'un poste ne vaut pas accord de diffusion hors de PRO.GA. Le schéma `job.published` de PUBLIC-V1 (gelé, P06) ne porte ni compétences ni période de rémunération. COMMAND §6.9 prévoit `application.submit` (sujet `candidate`, pièces par empreinte) mais réserve `application.withdraw`. Une candidature transporte des données personnelles (nom civil, motivation, CV) qui ne doivent jamais apparaître dans une projection publique.

## Décision

1. **Publication consentie.** Un poste n'est projeté que par un consentement explicite, versionné et révocable d'un mandataire (`recruiting.openings.manage` + `site.publish`), pour une liaison `publish_jobs`, sous une vitrine dont le consentement de structure P09 est actif. Le mandataire fournit les seuls compléments publics absents du poste (lieu, compétences, période). Le parent vitrine porte la capacité `jobs` sous un mandat vivant ; ANTSIA ne lit aucune offre sans elle, ni sans politique réseau ouverte (`commerceJobPolicies`, fermée par défaut) ni sans modération (`commerceJob`, prélecture faute de politique).
2. **Contrat jumeau JOBS-V1** hors du manifeste gelé, octets identiques dans les deux dépôts : même inbox, mêmes révisions et tombes que PUBLIC-V1, `closed`/`filled` définitifs, `withdrawn` republiable seulement par révision supérieure. ANTSIA lit aussi PUBLIC-V1 `job.*` sans rien inventer.
3. **Candidature par COMMAND.** Sujet `candidate` opaque par boutique (HMAC, table distincte du sujet acheteur). Octets fixés à la demande et persistés jusqu'à résolution ; délai réseau résolu par `request.status`, jamais par une seconde demande. PRO.GA crée une `proJobApplications` ordinaire (source `antsia`) sans contact ni rôle et ne passe pas par `recordApplication`. Suivi limité à l'état autorisé de SA candidature.
4. **Contrôle privé distinct** `PRO-COMMERCE-APPLICATION-CONTROL-V1` (retrait, révocation d'une pièce) signé sur l'opération `application.submit` : le nom réservé P06 reste non exécutable. Retrait toujours possible ; tombe si le retrait précède la demande.
5. **Pièces gardées.** PDF admis par la garde des fichiers ANTSIA (usage `job_application_document`, 5 Mio, antivirus complet exigé), jamais servi par URL, ni rattaché à un réseau ou nommé dans la garde. Transfert par octets exacts signés (`PRO-COMMERCE-APPLICATION-FILES-V1`) d'une pièce déclarée, références opaques par candidature. Lecture recruteur par action authentifiée qui revalide les droits à chaque ouverture et journalise.
6. **Conservation à valider.** Aucune durée inventée (`COMMERCE_JOBS_RETENTION` à `null`) : retrait et effacement suppriment immédiatement les copies ; aucune purge temporelle ne s'exécute tant que la décision manque.

## Conséquences

L'activation exige une configuration propriétaire : émetteur ANTSIA autorisant `PRO-COMMERCE-JOBS-V1`, source PRO.GA avec le scope `commerce.application.submit`, destination admettant `job.*`, politique réseau et politique de modération `commerceJob`, liaisons portant `publish_jobs` et `receive_applications`. L'effacement ANTSIA attend le retrait distant (tentatives bornées, trace `remoteUnconfirmed`). La recette coordonnée (publier, candidater, suivre, retirer ; refus d'un tiers ; téléphone, bureau, clavier) et la décision de conservation restent ouvertes.
