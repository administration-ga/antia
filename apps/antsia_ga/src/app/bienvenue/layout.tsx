import type { ReactNode } from "react"
import { SessionProviders } from "@/components/providers"

export default function WelcomeLayout({ children }: { children: ReactNode }) {
  return <SessionProviders>{children}</SessionProviders>
}
