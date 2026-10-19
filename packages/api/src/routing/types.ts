// Dupliqué de socle/packages/routing/src/types.ts @ ad2e7fdc2 — adaptations : aucune (copie textuelle) ; en-tête de provenance.
import type { ComponentType, ReactNode } from "react"

export type NavigateOptions = { scroll?: boolean; replace?: boolean }

export type LinkProps = {
  href: string
  children?: ReactNode
  className?: string
  target?: string
  rel?: string
  prefetch?: boolean
  onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void
  "aria-label"?: string
  "aria-current"?: "page" | boolean
  title?: string
  style?: React.CSSProperties
  tabIndex?: number
  id?: string
  "data-testid"?: string
}

export type RouterApi = {
  push: (href: string, options?: NavigateOptions) => void
  replace: (href: string, options?: NavigateOptions) => void
  back: () => void
  forward: () => void
  refresh: () => void
  prefetch: (href: string) => void
}

export type RouterImplementation = {
  useRouter: () => RouterApi
  usePathname: () => string
  useSearchParams: () => URLSearchParams
  useParams: () => Record<string, string | string[] | undefined>
  LinkComponent: ComponentType<LinkProps>
}
