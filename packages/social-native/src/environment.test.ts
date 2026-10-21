import { describe, expect, it } from "vitest"
import { nativeEnvironment } from "./environment"

const configured = { convexUrl: "https://engine.example", authUrl: "https://auth.example", webUrl: "https://site.example", development: false }
describe("native environment", () => {
  it("never infers a deployment or a native scheme", () => {
    expect(nativeEnvironment({ development: false })).toBe(null)
    expect(nativeEnvironment(configured)?.scheme).toBe(null)
  })
  it("requires development and explicit consent for private HTTP", () => {
    const local = { ...configured, convexUrl: "http://127.0.0.1:3210", allowLocalHttp: "true" }
    expect(nativeEnvironment(local)).toBe(null)
    expect(nativeEnvironment({ ...local, development: true })?.convexUrl).toBe(local.convexUrl)
    expect(nativeEnvironment({ ...local, development: true, convexUrl: "http://untrusted.example" })).toBe(null)
    expect(nativeEnvironment({ ...local, development: true, convexUrl: "http://192.168.1.2:3210" })).toBe(null)
  })
  it("rejects credential URLs, paths and generic callback schemes", () => {
    expect(nativeEnvironment({ ...configured, authUrl: "https://a:b@auth.example" })).toBe(null)
    expect(nativeEnvironment({ ...configured, webUrl: "https://site.example/path" })).toBe(null)
    expect(nativeEnvironment({ ...configured, scheme: "exp" })).toBe(null)
    expect(nativeEnvironment({ ...configured, scheme: "antsia-owned" })?.scheme).toBe("antsia-owned")
  })
})
