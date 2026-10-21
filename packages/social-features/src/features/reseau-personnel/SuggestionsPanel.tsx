// Dupliqué de socle/packages/agent-features/src/features/reseau-personnel/SuggestionsPanel.tsx @ ad2e7fdc2 — adaptations : catalogue du moteur (`suggestions.suggestions.paginate` et `dismiss`, réseau courant par `useNetwork()`), demande par `graph.connections.requestConnection({ handle })` ; adresses par la table de routes injectée (`useRoutes()` : profil, page réseau pour « Voir tout ») ; refus de POLITIQUE du moteur (`policyRefused` : réseau gouverné qui sert ses propres suggestions) : le rail s'efface au lieu d'afficher une panne ; textes par l'i18n (espace `reseau`, clés `suggestionsPanel.*`) et refus du moteur dits par leur code ; « Agents à découvrir » devient « Personnes à découvrir », opposition personne / administration de la doc retirée (une page n'est plus une administration) ; règles du module sorties du JSX dans une constante (`DISCOVERY_CONTROLS_CSS`), inchangées ; primitives de `@antsia/ui`, surfaces de la coque ; couleurs par fonction (ADR-0027) : « Se connecter » en variante `social` tant que la demande est possible, neutre une fois envoyée ou reçue.
"use client"

/**
 * « Personnes à découvrir » — la mise en relation réciproque entre personnes
 * du réseau.
 *
 * ⚠️ Puisées dans l'annuaire du RÉSEAU (membres découvrables), et nulle part
 * ailleurs : suggérer quelqu'un qui ne s'est pas exposé serait l'exposer à sa
 * place. Aucun score d'affinité — mesurer qui fréquente qui est précisément ce
 * que ce module refuse de faire.
 *
 * Quand il n'a rien à proposer, le panneau conserve son titre et explique
 * l'état vide : le faire disparaître donne l'impression que le rail est cassé.
 *
 * Une seule action : « Se connecter ». L'abonnement unilatéral appartient aux
 * PAGES et au volet Relations ; le présenter ici brouillerait la différence
 * entre une relation réciproque et un simple suivi.
 *
 * ⚠️ Deux états ont quitté ce composant le 2026-09-06 (R-05), parce qu'ils y
 * mentaient au rechargement suivant : le MASQUAGE d'une carte, qui vivait dans
 * un `useState` et ne survivait pas au montage, et « Demande envoyée », qui
 * était posé localement alors que la demande, elle, était en base. Les deux
 * viennent maintenant du serveur (`suggestions.dismiss`, `relationState`) —
 * l'ensemble local ne sert plus qu'à retirer la carte AVANT le retour de la
 * mutation.
 */

import { api } from "@antsia/api/engine"
import { useAuthenticatedConvexQuery } from "@antsia/api/hooks"
import { useNetwork, useRoutes } from "@antsia/api/network"
import { Link } from "@antsia/api/routing"
import { engineErrorCode } from "@antsia/social-contracts/errors"
import { Button, Card, Icon, SkeletonCard } from "@antsia/ui"
import { useMutation } from "convex/react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { RESEAU_PILL_ACTION_STYLE, RESEAU_SURFACE_STYLE } from "../../shell/design-styles"
import { useConnectionRequest } from "./use-connection-request"
import { Avatar } from "./Avatar"
import { personHref } from "./author-link"
import { DiscoveryEmptyCard } from "./DiscoveryEmptyCard"
import { peopleViewHref, relationErrorText } from "./people-panel"
import { relationActionDisabled, relationActionLabel, type DiscoveryPresentation, visibleSuggestions } from "./suggestions-actions"

/** Le rail montre CINQ noms. La fenêtre demandée est plus large : le serveur
 *  filtre APRÈS sa page, une page courte n'est donc pas une page finale. */
const RAIL_SUGGESTIONS_SHOWN = 5
const RAIL_SUGGESTIONS_SCAN = 24

/** La géométrie de la pilule, sans couleur : la variante `social` garde la sienne (ADR-0027). */
const PILL_SHAPE_STYLE = {
  ...RESEAU_PILL_ACTION_STYLE,
  padding: "6px 10px",
  minHeight: 44,
  fontSize: 11.5,
  fontWeight: 700,
} as const

/** Une demande déjà envoyée ou reçue : le bouton redevient neutre (ADR-0027). */
const PILL_SETTLED_STYLE = {
  ...PILL_SHAPE_STYLE,
  color: "var(--muted-foreground)",
} as const

const SEE_ALL_STYLE = {
  display: "inline-flex",
  minHeight: 44,
  alignItems: "center",
  color: "var(--primary-600)",
  fontSize: 12,
  fontWeight: 700,
  textDecoration: "none",
} as const

/**
 * Les règles du module de découverte, HORS du JSX : un littéral enfant de
 * `<style>` passerait pour une chaîne d'interface (cliquet
 * `no-hardcoded-strings`).
 */
const DISCOVERY_CONTROLS_CSS = `
        .rp-discovery-module { --ui2-button-sm-min-h: 44px; }
        .rp-discovery-dismiss:focus-visible {
          outline: 2px solid var(--ring);
          outline-offset: 2px;
        }
        @media (prefers-reduced-motion: reduce) {
          .rp-discovery-module * { scroll-behavior: auto !important; }
        }
      `

export function SuggestionsPanel({ presentation = "rail" }: { presentation?: DiscoveryPresentation }) {
  const { t } = useTranslation("reseau")
  const { networkId } = useNetwork()
  const routes = useRoutes()
  /* ⚠️ `graph.follows.suggestions` reste EXPORTÉ et servi ailleurs ; ce rail
     lit le catalogue, qui seul porte l'état relationnel serveur et les
     masquages durables (R-05). La fenêtre est plus large que ce qu'on affiche
     parce que le filtrage se fait après la page côté serveur. */
  const suggestions = useAuthenticatedConvexQuery(api.modules.suggestions.suggestions.paginate, {
    networkId,
    paginationOpts: { numItems: RAIL_SUGGESTIONS_SCAN, cursor: null },
  })
  const connectionRequest = useConnectionRequest()
  const dismissSuggestion = useMutation(api.modules.suggestions.suggestions.dismiss)
  const [busyHandle, setBusyHandle] = useState<string | null>(null)
  /* Retrait OPTIMISTE, le temps de l'aller-retour : la persistance, elle, est
     au serveur — la carte ne revient plus au rechargement suivant. */
  const [dismissedHandles, setDismissedHandles] = useState<ReadonlySet<string>>(new Set())

  const items = visibleSuggestions(suggestions.data?.page ?? [], dismissedHandles).slice(0, RAIL_SUGGESTIONS_SHOWN)
  if (suggestions.isLoading) return <SkeletonCard />
  // Un réseau GOUVERNÉ par une tranche sert ses propres suggestions (annuaire
  // opt-in) : le catalogue générique le refuse par une POLITIQUE, pas par une
  // panne — le rail s'efface au lieu de proposer un « Réessayer » sans issue.
  if (suggestions.isError && engineErrorCode(suggestions.error) === "policyRefused") return null
  if (suggestions.isError) {
    return (
      <Card padded style={RESEAU_SURFACE_STYLE}>
        <p style={{ margin: 0, color: "var(--ink-700)", fontSize: 13 }}>{t("suggestionsPanel.unavailable")}</p>
        <Button variant="secondary" size="sm" style={{ minHeight: 44, marginTop: 8 }} onClick={() => void suggestions.refetch()}>
          {t("suggestionsPanel.retry")}
        </Button>
      </Card>
    )
  }
  if (items.length === 0) {
    return <DiscoveryEmptyCard title={t("suggestionsPanel.title")} message={t("suggestionsPanel.empty")} presentation={presentation} />
  }

  // Mêmes libellés que la recherche du volet Relations (`PeoplePanel.tsx`)
  // pour la même action — qui connaît déjà l'un des deux volets reconnaît l'autre.
  const handleConnect = async (handle: string) => {
    setBusyHandle(handle)
    try {
      if (!(await connectionRequest.send({ handle }))) return
      // Aucun état local d'aboutissement : la query se recalcule et rend
      // `relationState: "requested_by_me"` — c'est LUI qui dira « Demande
      // envoyée », y compris au prochain chargement.
      toast.success(t("suggestionsPanel.connectionSent"))
    } catch (error) {
      toast.error(relationErrorText(error, "reseau:suggestionsPanel.actionFailed", t))
    } finally {
      setBusyHandle(null)
    }
  }

  /** Masquer DURABLEMENT — le retrait local ne fait que devancer le serveur. */
  const handleDismiss = async (handle: string) => {
    setDismissedHandles((current) => new Set([...current, handle]))
    try {
      await dismissSuggestion({ networkId, handle })
    } catch (error) {
      setDismissedHandles((current) => {
        const next = new Set(current)
        next.delete(handle)
        return next
      })
      toast.error(relationErrorText(error, "reseau:suggestionsPanel.dismissFailed", t))
    }
  }

  const content = (
    <section className="rp-discovery-module" style={{ padding: presentation === "carousel" ? "2px 0" : 20 }}>
      <header
        style={{
          display: "flex",
          minHeight: 44,
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <h2
          style={{
            margin: 0,
            fontSize: presentation === "carousel" ? 15 : 10.5,
            fontWeight: 700,
            letterSpacing: presentation === "carousel" ? undefined : "0.09em",
            textTransform: presentation === "carousel" ? undefined : "uppercase",
            color: presentation === "carousel" ? "var(--ink-900)" : "var(--ink-500)",
          }}
        >
          {t("suggestionsPanel.title")}
        </h2>
        {/* « Voir tout » ouvre le CATALOGUE, pas le volet Relations tout court
            (R-05) : jusqu'au 2026-09-06 le lien menait à un écran qui ne
            portait aucune liste de suggestions. */}
        <Link href={peopleViewHref("suggestions", routes.home())} style={SEE_ALL_STYLE}>
          {t("suggestionsPanel.seeAll")}
        </Link>
      </header>
      <ul
        style={{
          listStyle: "none",
          margin: 0,
          padding: "4px 0 0",
          display: "flex",
          flexDirection: presentation === "carousel" ? "row" : "column",
          gap: 12,
          overflowX: presentation === "carousel" ? "auto" : undefined,
          overscrollBehaviorInline: presentation === "carousel" ? "contain" : undefined,
          scrollSnapType: presentation === "carousel" ? "x mandatory" : undefined,
          scrollbarWidth: presentation === "carousel" ? "none" : undefined,
        }}
        aria-label={t("suggestionsPanel.listLabel")}
      >
        {items.map((person) => {
          const href = personHref(person.handle, routes.profile)
          const isBusy = busyHandle === person.handle
          return (
            /* DEUX RANGÉES, jamais une seule (2026-08-20) : identité en
                 haut (nom et identifiant ELLIPSÉS — patron ProfileMiniCard),
                 boutons en bas. À 312 px de rail, la rangée unique écrasait
                 la colonne de texte jusqu'à peindre l'identifiant SOUS les
                 boutons — le groupe de boutons, incompressible
                 (white-space: nowrap + flexShrink: 0), prenait tout. */
            <li
              key={person.handle}
              style={{
                position: "relative",
                display: "flex",
                flex: presentation === "carousel" ? "0 0 min(212px, 76vw)" : undefined,
                flexDirection: "column",
                gap: 8,
                minWidth: 0,
                padding: presentation === "carousel" ? "var(--esp-card-padding, 10px)" : "0 44px 0 0",
                border: presentation === "carousel" ? "1px solid var(--esp-primitive-surface-border, var(--ink-200))" : undefined,
                borderRadius: presentation === "carousel" ? "var(--esp-primitive-card-radius, var(--radius-md))" : undefined,
                scrollSnapAlign: presentation === "carousel" ? "start" : undefined,
                background: presentation === "carousel" ? "var(--ink-0)" : undefined,
              }}
            >
              <button
                type="button"
                className="rp-discovery-dismiss"
                aria-label={t("suggestionsPanel.dismissLabel", { name: person.displayName })}
                onClick={() => void handleDismiss(person.handle)}
                style={{
                  position: "absolute",
                  top: presentation === "carousel" ? 2 : -5,
                  right: presentation === "carousel" ? 2 : -5,
                  display: "inline-flex",
                  width: 44,
                  minHeight: 44,
                  alignItems: "center",
                  justifyContent: "center",
                  border: 0,
                  borderRadius: "var(--esp-primitive-button-radius, var(--radius-lg))",
                  background: "transparent",
                  color: "var(--ink-500)",
                  cursor: "pointer",
                }}
              >
                <Icon name="x" size={16} />
              </button>
              <div
                style={{
                  display: "flex",
                  gap: 10,
                  alignItems: "center",
                  minWidth: 0,
                }}
              >
                <Link
                  href={href}
                  aria-label={t("suggestionsPanel.profileOf", { name: person.displayName })}
                  style={{ display: "inline-flex", flexShrink: 0 }}
                >
                  <Avatar displayName={person.displayName} avatarUrl={person.avatarUrl} size={presentation === "carousel" ? 44 : 34} />
                </Link>
                <div style={{ minWidth: 0, flex: 1, overflow: "hidden" }}>
                  <Link
                    href={href}
                    style={{
                      display: "block",
                      margin: 0,
                      fontSize: 12.5,
                      fontWeight: 700,
                      color: "var(--ink-900)",
                      textDecoration: "none",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {person.displayName}
                  </Link>
                  <p
                    style={{
                      margin: 0,
                      color: "var(--ink-500)",
                      fontSize: 10.5,
                      lineHeight: 1.4,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    @{person.handle}
                    {person.headline ? ` · ${person.headline}` : ""}
                  </p>
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <Button
                  size="sm"
                  icon="userPlus"
                  // Se connecter : couleur des relations tant que la demande est possible (ADR-0027).
                  variant={person.relationState === "none" ? "social" : "ghost"}
                  disabled={relationActionDisabled(person.relationState, isBusy) || connectionRequest.disabled}
                  onClick={() => void handleConnect(person.handle)}
                  style={person.relationState === "none" ? PILL_SHAPE_STYLE : PILL_SETTLED_STYLE}
                >
                  {(person.relationState === "none" && connectionRequest.waitLabel) || relationActionLabel(person.relationState, isBusy, t)}
                </Button>
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )

  return (
    <>
      {presentation === "carousel" ? (
        content
      ) : (
        <Card padded={false} style={RESEAU_SURFACE_STYLE}>
          {content}
        </Card>
      )}
      <style href="rp-discovery-controls" precedence="default">
        {DISCOVERY_CONTROLS_CSS}
      </style>
    </>
  )
}
