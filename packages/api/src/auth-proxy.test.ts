import { NextRequest } from "next/server"
import { describe, expect, it, vi } from "vitest"

import { devCookie, proxyToConvex } from "./auth-proxy"

const SITE = "http://127.0.0.1:3211"

function request(path: string, init: { method?: string; headers?: Record<string, string>; body?: string } = {}) {
  return new NextRequest(new URL(path, "http://localhost:3030"), init)
}

describe("proxy Better Auth du moteur", () => {
  it("relaie vers les actions HTTP Convex sans les en-têtes de CE saut (x-forwarded-*)", async () => {
    const fetchImpl = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const headers = init?.headers as Record<string, string>
      expect(headers["x-forwarded-host"]).toBeUndefined()
      expect(headers["x-forwarded-for"]).toBeUndefined()
      expect(headers.host).toBe("127.0.0.1:3211")
      expect(headers["content-type"]).toBe("application/json")
      return new Response('{"ok":true}', { status: 200, headers: { "content-type": "application/json" } })
    })
    const response = await proxyToConvex(
      request("/api/auth/email-otp/send?x=1", {
        method: "POST",
        headers: { "content-type": "application/json", "x-forwarded-host": "localhost:3030", "x-forwarded-for": "1.2.3.4" },
        body: "{}",
      }),
      { convexSiteUrl: SITE, isDev: true, fetchImpl: fetchImpl as unknown as typeof fetch },
    )
    expect(fetchImpl).toHaveBeenCalledWith(`${SITE}/api/auth/email-otp/send?x=1`, expect.objectContaining({ method: "POST", redirect: "manual" }))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true })
  })

  it("réécrit les cookies en développement seulement", async () => {
    const upstream = () => {
      const headers = new Headers()
      headers.append("set-cookie", "__Secure-better-auth.session=abc; Path=/; Secure; HttpOnly; SameSite=None")
      return new Response(null, { status: 200, headers })
    }
    const dev = await proxyToConvex(request("/api/auth/session"), { convexSiteUrl: SITE, isDev: true, fetchImpl: (async () => upstream()) as unknown as typeof fetch })
    expect(dev.headers.getSetCookie()).toEqual(["better-auth.session=abc; Path=/; HttpOnly; SameSite=Lax"])
    const prod = await proxyToConvex(request("/api/auth/session"), { convexSiteUrl: SITE, isDev: false, fetchImpl: (async () => upstream()) as unknown as typeof fetch })
    expect(prod.headers.getSetCookie()).toEqual(["__Secure-better-auth.session=abc; Path=/; Secure; HttpOnly; SameSite=None"])
  })

  it("sans CONVEX_SITE_URL : 500 explicite ; moteur injoignable : 502", async () => {
    expect((await proxyToConvex(request("/api/auth/session"), { convexSiteUrl: undefined, isDev: true })).status).toBe(500)
    const error = vi.spyOn(console, "error").mockImplementation(() => {})
    const failing = (async () => {
      throw new Error("ECONNREFUSED")
    }) as unknown as typeof fetch
    expect((await proxyToConvex(request("/api/auth/session"), { convexSiteUrl: SITE, isDev: true, fetchImpl: failing })).status).toBe(502)
    error.mockRestore()
  })

  it("devCookie retire __Secure- et Secure, et passe SameSite=None en Lax", () => {
    expect(devCookie("__Secure-a=b; Secure; SameSite=None")).toBe("a=b; SameSite=Lax")
  })
})
