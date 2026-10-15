// Dupliqué de socle/packages/agent-features/src/features/messagerie/IcomActusPanel.tsx @ ad2e7fdc2 — adaptations : ma fiche par `people.persons.getMyPerson` (sans réseau ; identifiant montré seulement si le profil est publié, portrait servi par la garde des fichiers) au lieu de `reseauPersonnel.people.getMyProfile` ; lecteur plein écran ouvert sur la base `useRoutes().stories()` (paramètre `auteur`), plus de chemin de l'espace écrit en dur ; surfaces `reseau`/`icom` du socle retirées (le moteur n'en connaît pas : le plateau et le composeur sont ceux du réseau, sans `surface` ni `origin`) ; horloge arrondie à la minute (argument `now` des lectures stable entre deux rendus) ; textes traduits (i18n `messagerie`, clés `icomActusPanel.…`) ; feuille de style sortie du JSX dans une constante de module (`ICOM_ACTUS_BAND_CSS`) — un littéral enfant de `<style>` passerait pour une chaîne d'interface — règles inchangées.
"use client"

/**
 * Les STATUTS d'iCom — les actus du réseau, dans la messagerie (ADR-0079).
 *
 * Une brique, deux poses : `IcomActusPanel` est montée dans la barre iCom
 * mobile et dans le dock du bureau. iChat reste ainsi réservé aux échanges
 * privés ; les rappels publics sous les statuts ne sont que des portes vers
 * le réseau.
 *
 * ⚠️ Le contenu vient du MÊME plateau que le rail du fil : le moteur ne
 * distingue aucune surface (les surfaces `reseau`/`icom` du socle sont
 * retirées), un statut EST une actu du réseau. Ouvrir un statut pousse le
 * lecteur plein écran (base `useRoutes().stories()`, paramètre `auteur`).
 * Créer ouvre la MÊME `StoryCreateSheet` que « Publier une actu » du fil, EN
 * PLACE et sans navigation — même carte compacte au bureau, même plein écran
 * au téléphone. Une carte de création différente ici ferait croire à deux
 * objets.
 *
 * `StoriesStyles` est montée ICI et pas supposée présente : le fil ne la
 * monte que sur son volet, et le dock vit sur TOUS les volets. React 19 hisse
 * et dédoublonne la feuille par `href`.
 */

import { api } from "@antia/api/engine"
import { useAuthenticatedConvexQuery } from "@antia/api/hooks"
import { useRoutes } from "@antia/api/network"
import { useRouter } from "@antia/api/routing"
import { Camera } from "lucide-react"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { markStoriesOpenedFromApp } from "../stories/stories-entry"
import { StoriesStyles } from "../stories/stories-styles"
import { StoriesTray } from "../stories/StoriesTray"
import { StoryCreateSheet } from "../stories/StoryCreateSheet"
import { IcomBrickHeader } from "./IcomBrickHeader"
import { IcomPublicReminders } from "./IcomPublicReminders"

/** Le paramètre du lecteur plein écran qui positionne l'entrée sur un auteur. */
const STORIES_AUTHOR_PARAM = "auteur"

const MINUTE_MS = 60_000

/** L'instant courant, ARRONDI à la minute. */
function minuteNow(): number {
  return Math.floor(Date.now() / MINUTE_MS) * MINUTE_MS
}

/**
 * L'horloge des « il y a 3 h » — la minute suffit à un contenu de 24 h.
 * ARRONDIE : l'instant part en argument des lectures du plateau (`now`), et
 * deux briques montées à quelques secondes d'écart partagent ainsi la même
 * souscription au lieu d'en ouvrir chacune une.
 */
function useMinuteClock(): number {
  const [now, setNow] = useState(minuteNow)
  useEffect(() => {
    const id = setInterval(() => setNow(minuteNow()), MINUTE_MS)
    return () => clearInterval(id)
  }, [])
  return now
}

/** Rendu de la rangée à un instant fourni — partagé avec la pose mobile pour
 *  qu'une seule horloge mette à jour statuts et rappels publics. */
function IcomActusRowAt({ now }: { now: number }) {
  const router = useRouter()
  const routes = useRoutes()
  const [createOpen, setCreateOpen] = useState(false)
  // Ma fiche (sur moi-même : sans réseau). L'identifiant ne sert au plateau que
  // s'il est PUBLIÉ — sinon `null`, comme le profil non publié du socle.
  const moi = useAuthenticatedConvexQuery(
    api.modules.people.persons.getMyPerson,
    {},
  )
  const myHandle = moi.data?.published === true ? (moi.data.handle ?? null) : null

  return (
    <>
      <StoriesStyles />
      <StoriesTray
        myHandle={myHandle}
        myAvatarUrl={moi.data?.avatar?.url ?? null}
        now={now}
        onOpen={(handle) => {
          markStoriesOpenedFromApp()
          const base = routes.stories()
          router.push(
            handle === null
              ? base
              : `${base}?${new URLSearchParams({ [STORIES_AUTHOR_PARAM]: handle }).toString()}`,
          )
        }}
        onCreate={() => setCreateOpen(true)}
      />
      {/* La MÊME feuille que « Publier une actu » du fil — un statut est une
          actu, la carte est donc identique. L'overlay portalise vers body
          (z-60) : il passe AU-DESSUS de la carte flottante iCom (z-55) sans
          en dépendre. */}
      <StoryCreateSheet open={createOpen} onClose={() => setCreateOpen(false)} />
    </>
  )
}

/**
 * La feuille de la vue, hors du JSX : un littéral enfant de `<style>` passerait
 * pour une chaîne d'interface (cliquet `no-hardcoded-strings`). Jetons de la
 * charte seulement, aucune couleur littérale.
 */
const ICOM_ACTUS_BAND_CSS = `
      .icom-actus-band:not(:has(.st-tray-tile + .st-tray-tile)) .st-tray-tile {
        width: 76px;
      }
      .icom-actus-band:has(.st-tray-tile + .st-tray-tile) .icom-actus-caption {
        display: none;
      }
    `

/**
 * La bande d'actus se RESSERRE quand elle est presque vide (X-09).
 *
 * Le constat : « l'actu unique crée une grande bande vide ». La tuile de la
 * rangée est une carte 9:16 de 112 px de large — près de 200 px de haut — et
 * quand personne n'a publié, cette hauteur est occupée par la seule carte
 * « Créer une actu », le reste étant du vide sur toute la largeur.
 *
 * Deux règles, et aucun abonnement de plus : la décision se lit dans le DOM
 * déjà rendu par `StoriesTray` (`:has()`), au lieu de re-questionner
 * `stories.tray` ici pour compter les groupes. Une seconde tuile — donc au
 * moins un statut à voir — rend à la bande sa taille pleine et retire la
 * phrase, qui n'explique QUE l'absence.
 *
 * ⚠️ Repli : un navigateur sans `:has()` garde exactement la bande d'avant.
 * C'est une amélioration progressive, jamais une dépendance.
 */
function IcomActusBandStyles() {
  return (
    <style href="icom-actus-band" precedence="default">{ICOM_ACTUS_BAND_CSS}</style>
  )
}

export interface IcomActusPanelProps {
  /** Le dock ancré peut se replier ; la page mobile reste toujours ouverte. */
  repliable?: boolean
  open?: boolean
  /** La barre globale de l'hôte porte-t-elle déjà Rétracter/Détacher ? */
  showDockControls?: boolean
}

/** La brique Statuts commune au téléphone et au dock du bureau. */
export function IcomActusPanel({
  repliable = false,
  open = true,
  showDockControls = true,
}: IcomActusPanelProps = {}) {
  const { t } = useTranslation("messagerie")
  const now = useMinuteClock()

  return (
    <>
      <IcomBrickHeader
        icon={Camera}
        title={t("icomActusPanel.title")}
        repliable={repliable}
        open={open}
        bodyId="icom-statuses"
        showDockControls={showDockControls}
      />
      {open ? (
        <div
          id="icom-statuses"
          className="msg-body"
          role="group"
          aria-label={t("icomActusPanel.bodyLabel")}
        >
          <IcomActusBandStyles />
          <div className="icom-actus-band">
            <IcomActusRowAt now={now} />
            <p className="icom-relations-empty icom-actus-caption">
              {t("icomActusPanel.caption")}
            </p>
          </div>
          <IcomPublicReminders now={now} />
        </div>
      ) : null}
    </>
  )
}
