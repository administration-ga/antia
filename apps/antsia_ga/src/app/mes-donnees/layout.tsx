import type { ReactNode } from "react"
import { SessionProviders } from "@/components/providers"

/** Droits personnels disponibles aux personnes suspendues, hors NetworkShell. */
export default function PersonalDataLayout({ children }: { children: ReactNode }) {
  return <SessionProviders>{children}</SessionProviders>
}
