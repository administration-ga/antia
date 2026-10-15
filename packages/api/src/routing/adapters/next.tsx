// Dupliqué de socle/packages/routing/src/adapters/next.tsx @ ad2e7fdc2 — adaptations : aucune (copie textuelle) ; en-tête de provenance.
"use client"

import NextLink from "next/link"
import {
  useRouter as useNextRouter,
  usePathname as useNextPathname,
  useSearchParams as useNextSearchParams,
  useParams as useNextParams,
} from "next/navigation"
import { useMemo, type ReactNode } from "react"
import { RouterProvider } from "../provider"
import type { LinkProps, RouterApi, RouterImplementation } from "../types"

function NextLinkComponent(props: LinkProps) {
  const { href, prefetch, children, ...rest } = props
  return (
    <NextLink href={href} prefetch={prefetch} {...rest}>
      {children}
    </NextLink>
  )
}

function useNextRouterApi(): RouterApi {
  const router = useNextRouter()
  return useMemo<RouterApi>(
    () => ({
      push: (href, options) => {
        if (options?.replace) {
          router.replace(href, { scroll: options?.scroll })
        } else {
          router.push(href, { scroll: options?.scroll })
        }
      },
      replace: (href, options) => router.replace(href, { scroll: options?.scroll }),
      back: () => router.back(),
      forward: () => router.forward(),
      refresh: () => router.refresh(),
      prefetch: (href) => router.prefetch(href),
    }),
    [router],
  )
}

function useNextSearchParamsAdapter(): URLSearchParams {
  const params = useNextSearchParams()
  return useMemo(() => new URLSearchParams(params?.toString() ?? ""), [params])
}

const nextImplementation: RouterImplementation = {
  useRouter: useNextRouterApi,
  usePathname: () => useNextPathname() ?? "/",
  useSearchParams: useNextSearchParamsAdapter,
  useParams: () => useNextParams() as Record<string, string | string[] | undefined>,
  LinkComponent: NextLinkComponent,
}

export function NextRouterAdapter({ children }: { children: ReactNode }) {
  return <RouterProvider implementation={nextImplementation}>{children}</RouterProvider>
}
