import { PublicShell } from "@/components/public/public-shell"
import { PublicStatus } from "@/components/public/public-status"
import { getPublicLocale } from "@/lib/server-session"

export default async function NotFound() { return <PublicShell><PublicStatus status="refused" locale={await getPublicLocale()} /></PublicShell> }
