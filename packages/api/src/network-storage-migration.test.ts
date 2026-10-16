import { describe, expect, it } from "vitest"

import { migrateNetworkStorage, type NetworkStorage } from "./network-storage-migration"

function memoryStorage(initial: Record<string, string> = {}): NetworkStorage & { data: Map<string, string> } {
  const data = new Map(Object.entries(initial))
  return {
    data,
    get length() { return data.size },
    key: (index) => [...data.keys()][index] ?? null,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => { data.set(key, value) },
  }
}

describe("migrateNetworkStorage", () => {
  it("conserve les brouillons et positions dans les deux stockages de la racine", () => {
    const localStorage = memoryStorage({
      "antia:antia:iappel:audio-route": '{"deviceId":"speaker"}',
      "antia:antia:ringtone-muted": "false",
    })
    const sessionStorage = memoryStorage({
      "antia:antia:post-drafts:v1:person-a": '{"text":"Brouillon conservé"}',
      "antia:antia:messagerie-dock:v6": '{"openThreads":["thread-a"]}',
      "antia:antia:direct-floating-card:v1": '{"x":12,"y":34}',
    })

    for (const storage of [localStorage, sessionStorage]) {
      const sources = [...storage.data.entries()]
      migrateNetworkStorage(storage, "antsia")
      for (const [key, value] of sources) {
        expect(storage.getItem(key)).toBe(value)
        expect(storage.getItem(key.replace("antia:antia:", "antsia:antsia:"))).toBe(value)
      }
    }
  })

  it("change uniquement le préfixe de marque pour un réseau fermé", () => {
    const storage = memoryStorage({ "antia:diaspora:post-drafts:v1:person-a": "draft" })
    migrateNetworkStorage(storage, "diaspora")
    expect(storage.getItem("antsia:diaspora:post-drafts:v1:person-a")).toBe("draft")
    expect(storage.getItem("antia:diaspora:post-drafts:v1:person-a")).toBe("draft")
    expect(storage.getItem("antsia:antsia:post-drafts:v1:person-a")).toBeNull()
  })

  it("ne remplace jamais une valeur nouvelle, même vide, et conserve une source vide", () => {
    const storage = memoryStorage({
      "antia:antia:post-drafts:v1:person-a": "old draft",
      "antsia:antsia:post-drafts:v1:person-a": "new draft",
      "antia:antia:ringtone-muted": "true",
      "antsia:antsia:ringtone-muted": "",
      "antia:antia:empty": "",
    })
    migrateNetworkStorage(storage, "antsia")
    migrateNetworkStorage(storage, "antsia")
    expect(storage.getItem("antsia:antsia:post-drafts:v1:person-a")).toBe("new draft")
    expect(storage.getItem("antsia:antsia:ringtone-muted")).toBe("")
    expect(storage.getItem("antsia:antsia:empty")).toBe("")
    expect(storage.getItem("antia:antia:post-drafts:v1:person-a")).toBe("old draft")
  })

  it("isole les autres réseaux, les préfixes voisins et la session Better Auth", () => {
    const storage = memoryStorage({
      "antia:antia:mine": "current",
      "antia:diaspora:private": "other network",
      "antia:antia-extra:private": "similar slug",
      "better-auth_cookie": "auth session",
    })
    migrateNetworkStorage(storage, "antsia")
    expect(storage.getItem("antsia:antsia:mine")).toBe("current")
    expect(storage.getItem("antsia:diaspora:private")).toBeNull()
    expect(storage.getItem("antsia:antsia-extra:private")).toBeNull()
    expect(storage.getItem("better-auth_cookie")).toBe("auth session")
    expect(storage.length).toBe(5)
  })

  it("laisse un stockage inaccessible sans empêcher la reprise du second", () => {
    const inaccessible: NetworkStorage = {
      get length(): number { throw new Error("Storage denied") },
      key: () => { throw new Error("Storage denied") },
      getItem: () => { throw new Error("Storage denied") },
      setItem: () => { throw new Error("Storage denied") },
    }
    const sessionStorage = memoryStorage({ "antia:antia:direct-floating-card:v1": "position" })
    expect(() => migrateNetworkStorage(inaccessible, "antsia")).not.toThrow()
    migrateNetworkStorage(sessionStorage, "antsia")
    expect(sessionStorage.getItem("antsia:antsia:direct-floating-card:v1")).toBe("position")
  })

  it("reprend les autres clés après une faute d'énumération ou de lecture", () => {
    const storage = memoryStorage({
      "antia:antia:enumeration-denied": "retained",
      "antia:antia:read-denied": "retained too",
      "antia:antia:allowed": "copied",
    })
    const key = storage.key
    const getItem = storage.getItem
    storage.key = (index) => {
      if (index === 0) throw new Error("Key inaccessible")
      return key(index)
    }
    storage.getItem = (name) => {
      if (name === "antsia:antsia:read-denied") throw new Error("Destination inaccessible")
      return getItem(name)
    }
    expect(() => migrateNetworkStorage(storage, "antsia")).not.toThrow()
    expect(storage.data.get("antsia:antsia:allowed")).toBe("copied")
    expect(storage.data.get("antsia:antsia:enumeration-denied")).toBeUndefined()
    expect(storage.data.get("antsia:antsia:read-denied")).toBeUndefined()
    expect(storage.data.get("antia:antia:read-denied")).toBe("retained too")
  })

  it("rejoue une copie partielle après un quota sans supprimer les sources", () => {
    const storage = memoryStorage({
      "antia:antia:post-drafts:v1:person-a": "draft",
      "antia:antia:icom-floating-placement:v1": "position",
    })
    const setItem = storage.setItem
    let quotaExceeded = true
    storage.setItem = (key, value) => {
      if (quotaExceeded && key === "antsia:antsia:post-drafts:v1:person-a") throw new Error("Quota exceeded")
      setItem(key, value)
    }
    expect(() => migrateNetworkStorage(storage, "antsia")).not.toThrow()
    expect(storage.getItem("antsia:antsia:post-drafts:v1:person-a")).toBeNull()
    expect(storage.getItem("antsia:antsia:icom-floating-placement:v1")).toBe("position")
    expect(storage.getItem("antia:antia:post-drafts:v1:person-a")).toBe("draft")

    quotaExceeded = false
    setItem("antsia:antsia:icom-floating-placement:v1", "new position")
    migrateNetworkStorage(storage, "antsia")
    expect(storage.getItem("antsia:antsia:post-drafts:v1:person-a")).toBe("draft")
    expect(storage.getItem("antsia:antsia:icom-floating-placement:v1")).toBe("new position")
    expect(storage.getItem("antia:antia:icom-floating-placement:v1")).toBe("position")
  })
})
