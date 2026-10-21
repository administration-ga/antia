import { describe, expect, it } from "vitest"
import { createNativeSignOutGate } from "./sign-out"

describe("native sign out", () => {
  it("blocks immediately, coalesces and distinguishes server from local success", async () => {
    const calls: string[] = []
    const exit = createNativeSignOutGate()
    const options = {
      client: { revokeSessions: async () => ({ data: { status: false } }), signOut: async () => ({ data: { success: true } }) },
      block: () => { calls.push("block") },
      stopResources: async () => { calls.push("resources") },
      clearCredentials: async () => { calls.push("clear") },
      reset: () => { calls.push("reset") },
    }
    const first = exit(options)
    expect(calls[0]).toBe("block")
    expect(exit(options)).toBe(first)
    const result = await first
    expect(result.serverRevoked).toBe(false)
    expect(result.localCleared).toBe(true)
    expect(result.issues).toContain("revocation")
    expect(calls).toEqual(["block", "resources", "clear", "reset"])
  })
  it("does not announce a purge if secure storage fails", async () => {
    const result = await createNativeSignOutGate()({
      client: { revokeSessions: async () => ({ data: { status: true } }), signOut: async () => ({ data: { success: true } }) },
      block() {}, stopResources: async () => undefined,
      clearCredentials: async () => { throw new Error("locked") }, reset() {},
    })
    expect(result.serverRevoked).toBe(true)
    expect(result.localCleared).toBe(false)
    expect(result.issues).toContain("credentials")
  })
})
