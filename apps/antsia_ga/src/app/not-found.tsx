import { PublicShell } from "@/components/public/public-shell"
import { PublicStatus } from "@/components/public/public-status"
import { getPublicLocale, getServerViewer } from "@/lib/server-session"

/** Le même refus traduit pour une adresse inconnue, privée ou retirée. */
export default async function NotFoundPage() {
  const [locale, viewer] = await Promise.all([getPublicLocale(), getServerViewer()])
  return <PublicShell viewer={viewer.status}><PublicStatus status="refused" locale={locale} /></PublicShell>
}
