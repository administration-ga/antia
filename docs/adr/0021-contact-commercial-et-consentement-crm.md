# ADR-0021 — Contact commercial distinct et consentement CRM révocable

- Statut : **Proposé ; sources P10 raccordées, vérifications et activation différées.**
- Date : 2026-10-18.
- Complète ADR-0009, ADR-0018 et ADR-0019 ; ne modifie aucun ADR accepté.

Le premier contact acheteur–boutique ne peut emprunter une exception à la relation personnelle acceptée. Le canal commercial porte son réseau fixe, sa demande initiale limitée, ses intentions de blocage et ses mandats de répondant vivants. Le droit de lire, répondre, décider ou appeler reste distinct d’un droit CRM.

ANTSIA réutilise les composants de communication et le moteur d’appels, avec une source commerciale opt-in et une relecture du consentement des deux participants. La boutique et le réseau doivent ouvrir le canal ; absence de politique signifie fermé.

Un prospect PRO.GA ne reçoit que le texte et l’alias sélectionnés volontairement. L’opération existante P06 `inquiry.submit` est conservée ; aucun carnet, fil complet ou contact direct n’est importé. Le sujet acheteur opaque est distinct du vendeur et partagé avec P11 au niveau personne/réseau/boutique/source/environnement.

L’outbox conserve les octets exacts, baux et générations, puis cherche le reçu du même effet après un délai. Un état enfilé ne prouve pas une application distante. Le retrait utilise un contrat privé jumeau hors manifeste P06 : il ne transforme pas `inquiry.withdraw`, réservé par P06, en commande admise. PRO.GA conserve une preuve externe versionnée et une tombe préventive, minimise le seul prospect dédié et préserve les engagements distincts.

Le retrait et sa relance restent disponibles depuis Mes données sans adhésion active. L’effacement local final attend sa confirmation distante avant de retirer la corrélation ; le cycle général d’export/effacement du sujet opaque dans PRO.GA reste à contractualiser. Les conversations terminales ont une rétention de 90 jours ; les intentions de blocage survivent sans contenu jusqu’au déblocage.

Conséquences : deux familles de conversations explicitement séparées, registre de mandats supplémentaire, effets externes à qualifier par reçu et attente possible d’un retrait lors d’une indisponibilité. L’activation et les preuves de recette sur deux comptes restent ouvertes.

Référence : [rapport P10](../21_CONTACT_COMMERCIAL_PRO_GA.md).
