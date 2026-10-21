import type { Metadata } from "next"

import { DemoEmbedScreen } from "@/components/demo-embed"
import { getAppT } from "@/i18n/server"
import { demoEmbedOrigin } from "@/lib/demo-embed"

export function generateMetadata(): Metadata {
  const { t } = getAppT()
  return { title: t("demoIntegration.title") }
}

/** L'application démo reste sur son origine et son backend, sans fournisseur de session du site principal. */
export default function DemoPage() {
  return <DemoEmbedScreen origin={demoEmbedOrigin()} />
}
