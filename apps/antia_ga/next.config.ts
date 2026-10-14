import { createEngineNextConfig } from "@antia/api/next-config"

/**
 * Configuration Next.js 16 de l'application — commune au moteur
 * (`@antia/api/next-config`) : racine ECOSYSTEMES, sortie standalone, paquets
 * du moteur en sources, en-têtes de sécurité, déploiement Convex lu dans
 * `ANTIA/.env.local` en développement et dans les ARG du Dockerfile en production.
 */
export default createEngineNextConfig({ appDir: process.cwd() })
