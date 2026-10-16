import type { AppResources } from "@antsia/social-features/i18n"

import enAdmin from "./locales/en/admin.json"
import frAdmin from "./locales/fr/admin.json"

export const APP_NAMESPACE = "admin"
export const appResources: AppResources = { fr: { admin: frAdmin }, en: { admin: enAdmin } }
