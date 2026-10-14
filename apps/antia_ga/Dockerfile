# syntax=docker/dockerfile:1
# Image AUTOPORTANTE de l'application antia_ga du moteur ANTIA.
#
# Contexte de construction = le dossier ECOSYSTEMES (parent d'ANTIA) : toutes
# les applications du moteur, y compris les applications externes de
# DIASPORALE, se construisent dans ce même contexte, avec UNE installation
# (celle d'ANTIA). Fichier d'exclusion : Dockerfile.dockerignore, à côté.
#
#   docker build -f ANTIA/apps/antia_ga/Dockerfile \
#     --build-arg NEXT_PUBLIC_CONVEX_URL=… --build-arg NEXT_PUBLIC_SITE_URL=… \
#     -t antia_ga .            # lancé depuis ECOSYSTEMES
#
# Les variables NEXT_PUBLIC_* sont inscrites dans le bundle à la construction :
# chacune est un ARG ci-dessous (cliquet deploy-catalog). Aucun secret en ARG.

# ── Étape 1 : dépendances et construction ─────────────────────────────────────
FROM oven/bun:1.4.2 AS builder
ARG NEXT_PUBLIC_CONVEX_URL
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_BUILD_SHA
ENV NEXT_PUBLIC_CONVEX_URL=${NEXT_PUBLIC_CONVEX_URL} \
    NEXT_PUBLIC_SITE_URL=${NEXT_PUBLIC_SITE_URL} \
    NEXT_PUBLIC_BUILD_SHA=${NEXT_PUBLIC_BUILD_SHA} \
    NEXT_TELEMETRY_DISABLED=1 \
    NODE_OPTIONS=--max-old-space-size=4096
WORKDIR /src

COPY ANTIA ./ANTIA
RUN cd ANTIA && bun install --frozen-lockfile
RUN cd ANTIA/apps/antia_ga && bun run build

# ── Étape 2 : image d'exécution minimale (sortie standalone de Next) ─────────
FROM node:22-alpine AS runner
ENV NODE_ENV=production \
    PORT=8080 \
    HOSTNAME=0.0.0.0 \
    NEXT_TELEMETRY_DISABLED=1
WORKDIR /app

COPY --from=builder --chown=node:node /src/ANTIA/apps/antia_ga/.next/standalone ./
COPY --from=builder --chown=node:node /src/ANTIA/apps/antia_ga/.next/static ./ANTIA/apps/antia_ga/.next/static
COPY --from=builder --chown=node:node /src/ANTIA/apps/antia_ga/public ./ANTIA/apps/antia_ga/public

USER node
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s \
  CMD wget -qO- "http://127.0.0.1:8080/api/sante-fonctionnelle" >/dev/null 2>&1 || exit 1
CMD ["node", "ANTIA/apps/antia_ga/server.js"]
