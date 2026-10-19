import { redirect } from "next/navigation"
import { routes } from "@/lib/routes"

/** Redirection serveur hors coque membre : les droits restent ouverts en cas de suspension. */
export default function SettingsPage() { redirect(routes.personalControls()) }
