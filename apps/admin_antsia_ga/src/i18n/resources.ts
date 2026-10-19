import type { AppResources } from "@antsia/social-features/i18n"

import enAdmin from "./locales/en/admin.json"
import frAdmin from "./locales/fr/admin.json"
import enOperations from "./locales/en/operations.json"
import frOperations from "./locales/fr/operations.json"

export const APP_NAMESPACE = "admin"
export const appResources: AppResources = { fr: { admin: frAdmin, operations: frOperations }, en: { admin: enAdmin, operations: enOperations } }
