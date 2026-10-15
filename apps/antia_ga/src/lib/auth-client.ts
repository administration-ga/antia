"use client"

import { createEngineAuthClient } from "@antia/api/auth-client"

/** Client Better Auth d'antia.ga (proxy `/api/auth/*` de cette origine). */
export const authClient = createEngineAuthClient()
