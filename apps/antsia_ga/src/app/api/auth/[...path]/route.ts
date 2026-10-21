import { proxyToConvex } from "@antsia/api/auth-proxy"
import { NextResponse, type NextRequest } from "next/server"
import { appBasePath } from "@/lib/app-path"
import { admittedDemoProxy } from "@/lib/demo-proxy"

function handle(request: NextRequest) {
  const basePath = appBasePath()
  if (basePath && !admittedDemoProxy(request)) return new NextResponse(null, { status: 403 })
  return proxyToConvex(request, { convexSiteUrl: process.env.CONVEX_SITE_URL, isDev: process.env.NODE_ENV !== "production", publicBasePath: basePath })
}
export { handle as GET, handle as POST, handle as PUT, handle as PATCH, handle as DELETE }
