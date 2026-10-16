// Dupliqué de socle/packages/agent-features/src/features/reseau-personnel/ContactsRail.tsx @ ad2e7fdc2 — adaptations : primitives de `@antsia/ui`, surfaces et état d'échec de la coque (`shell/`) ; connexions du graphe du réseau courant (`usePersonalConnections`, DTO `otherPersonId`, nom nullable rendu par le libellé neutre) ; tri dans la langue de l'écran ; textes par l'i18n (espace `reseau`, clés `contactsRail.*`) ; « iRéseau » devient « le réseau ». Composant orphelin au socle comme ici : aucun point de montage inventé.
"use client"

/**
 * « Contacts » — mes connexions, et le geste qui leur écrit.
 *
 * ⚠️ Ce n'est PAS une liste de présence : une colonne de pastilles vertes
 * toujours grises dirait que tout le monde est absent, ce qui est faux et
 * décourage d'écrire. La liste dit qui l'on connaît, et le clic ouvre un
 * brouillon de conversation — c'est le service qu'elle rend, et la raison de
 * son ordre alphabétique (`contacts-rail.ts`, où ce choix est testé).
 *
 * Le panneau disparaît tant qu'on n'a aucune connexion : un rail « Contacts »
 * vide occupe la place et n'apprend rien — même arbitrage que `SuggestionsPanel`.
 *
 * Orphelin : exporté par le barrel de la tranche, monté nulle part (comme au
 * socle). Le monter est une décision de la coque, pas de ce composant.
 */

import { Button, Card, TextInput } from "@antsia/ui"
import { useState } from "react"
import { useTranslation } from "react-i18next"

import { RESEAU_SURFACE_STYLE } from "../../shell/design-styles"
import { ReseauQueryError } from "../../shell/ReseauQueryError"
import { Avatar } from "./Avatar"
import { contactSubtitle, emptyContactsText, filterContacts, sortContacts, type ContactRailPerson } from "./contacts-rail"
import { usePersonalConnections } from "./use-dual-connection-pagination"

/** À partir de combien de contacts le champ de filtre a un sens. */
const FILTER_FROM = 8

export function ContactsRail({
  onOpenConversation,
}: {
  /** Ouvre un brouillon de conversation vers ce handle. */
  onOpenConversation: (handle: string) => void
}) {
  const { t, i18n } = useTranslation("reseau")
  const connections = usePersonalConnections({ autoLoad: true })
  const [query, setQuery] = useState("")

  const all: ContactRailPerson[] = connections.items.map((row) => ({
    otherPersonId: String(row.otherPersonId),
    displayName: row.displayName,
    handle: row.handle,
    headline: row.headline,
    avatarUrl: row.avatarUrl,
  }))

  // Rien à montrer et rien à dire : le rail s'efface plutôt que d'occuper une
  // colonne pour annoncer un vide.
  if (connections.isLoading || connections.isLoadingMore) return null
  if (connections.isError) {
    return (
      <Card padded={false} style={RESEAU_SURFACE_STYLE}>
        <section style={{ padding: 20 }}>
          <ReseauQueryError title={t("contactsRail.errorTitle")} message={t("contactsRail.errorMessage")} onRetry={connections.retry} />
        </section>
      </Card>
    )
  }
  if (all.length === 0) return null

  const shown = sortContacts(filterContacts(all, query), i18n.language)

  return (
    <Card padded={false} style={RESEAU_SURFACE_STYLE}>
      <section style={{ padding: 20 }}>
        <h2
          style={{
            margin: "0 0 12px",
            fontSize: 10.5,
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "var(--muted-foreground)",
          }}
        >
          {t("contactsRail.title")}
        </h2>

        {all.length >= FILTER_FROM ? (
          <div style={{ marginBottom: 10 }}>
            <TextInput
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("contactsRail.filterLabel")}
              aria-label={t("contactsRail.filterLabel")}
            />
          </div>
        ) : null}

        {shown.length === 0 ? (
          <p style={{ margin: 0, fontSize: 12.5, color: "var(--muted-foreground)" }}>{emptyContactsText(query, t)}</p>
        ) : (
          <ul
            style={{
              listStyle: "none",
              margin: 0,
              padding: 0,
              display: "grid",
              gap: 2,
            }}
          >
            {shown.map((contact) => {
              const subtitle = contactSubtitle(contact)
              const name = contact.displayName ?? t("contactsRail.unnamed")
              return (
                <li key={contact.otherPersonId}>
                  <Button
                    variant="ghost"
                    // Un contact sans handle publié n'a pas d'adresse de
                    // conversation : le bouton reste, inerte et dit pourquoi
                    // par son `title`, plutôt que de disparaître sans raison.
                    disabled={contact.handle === null}
                    title={contact.handle === null ? t("contactsRail.noHandle") : undefined}
                    onClick={() => {
                      if (contact.handle !== null) {
                        onOpenConversation(contact.handle)
                      }
                    }}
                    style={{
                      width: "100%",
                      justifyContent: "flex-start",
                      gap: 10,
                      // 44 px de cible : la règle de la charte, et ici elle
                      // compte double — la liste est dense.
                      minHeight: 44,
                      paddingInline: 8,
                      textAlign: "left",
                    }}
                  >
                    <Avatar displayName={name} avatarUrl={contact.avatarUrl} size={28} hasIdentity={contact.displayName !== null} />
                    <span style={{ display: "grid", gap: 1, minWidth: 0 }}>
                      <span
                        style={{
                          fontSize: 13,
                          fontWeight: 600,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {name}
                      </span>
                      {subtitle !== null ? (
                        <span
                          style={{
                            fontSize: 11.5,
                            color: "var(--muted-foreground)",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {subtitle}
                        </span>
                      ) : null}
                    </span>
                  </Button>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </Card>
  )
}
