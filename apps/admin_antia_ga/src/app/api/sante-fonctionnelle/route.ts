import { computeHealth } from "@antia/api/health"

// Jamais de rendu statique : une santé figée à la compilation décrit la
// machine de build, pas le service qui répond.
export const dynamic = "force-dynamic"

export function GET() {
  const report = computeHealth(
    {
      // Références LITTÉRALES : Next les inscrit au build (jamais `process.env` entier).
      NEXT_PUBLIC_CONVEX_URL: process.env.NEXT_PUBLIC_CONVEX_URL,
      NEXT_PUBLIC_BUILD_SHA: process.env.NEXT_PUBLIC_BUILD_SHA,
    },
    "admin-antia-ga",
  )
  return Response.json(report, { status: report.status === "ok" ? 200 : 503 })
}
