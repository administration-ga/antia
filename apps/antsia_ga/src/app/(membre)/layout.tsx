import type { ReactNode } from "react"

import { NetworkShell } from "@/components/network-shell"
import { SessionProviders } from "@/components/providers"

/**
 * Le gabarit des pages de MEMBRE (fil, messagerie, statuts) : la coque du réseau
 * y est montée UNE fois et PERSISTE d'une page à l'autre — un appel en cours,
 * le battement de présence et la carte iCom ne se démontent pas à chaque
 * navigation (doctrine d'`app-shell.tsx` du socle : une seule couche de
 * communication, à une position stable de l'arbre).
 */
export default function MemberLayout({ children }: { children: ReactNode }) {
  return <SessionProviders><NetworkShell>{children}</NetworkShell></SessionProviders>
}
