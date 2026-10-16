"use client"

import { createEngineAuthClient } from "@antsia/api/auth-client"

/** Client Better Auth d'antsia.ga (proxy `/api/auth/*` de cette origine). */
export const authClient = createEngineAuthClient()
