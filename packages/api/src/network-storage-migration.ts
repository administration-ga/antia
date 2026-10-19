import { LEGACY_ROOT_NETWORK_SLUG, ROOT_NETWORK_SLUG } from "@antsia/social-domain/network"

/** Le contrat injecté suffit aux stockages du navigateur et aux tests, sans dépendre de `window`. */
export type NetworkStorage = Pick<Storage, "length" | "key" | "getItem" | "setItem">

/**
 * Reprend les seules clés du réseau courant après le changement de marque.
 * Les sources restent intactes et une destination existante gagne toujours :
 * une interruption, un quota ou un deuxième montage peuvent donc se rejouer.
 */
export function migrateNetworkStorage(storage: NetworkStorage, slug: string): void {
  const legacySlug = slug === ROOT_NETWORK_SLUG ? LEGACY_ROOT_NETWORK_SLUG : slug
  const sourcePrefix = `antia:${legacySlug}:`
  const destinationPrefix = `antsia:${slug}:`
  const sourceKeys: string[] = []

  // Figer les clés avant toute copie : `setItem` peut agrandir le stockage.
  try {
    const length = storage.length
    for (let index = 0; index < length; index += 1) {
      try {
        const key = storage.key(index)
        if (key?.startsWith(sourcePrefix)) sourceKeys.push(key)
      } catch {
        // Une clé inaccessible ne doit pas empêcher la reprise des autres.
      }
    }
  } catch {
    return
  }

  for (const sourceKey of sourceKeys) {
    try {
      const destinationKey = `${destinationPrefix}${sourceKey.slice(sourcePrefix.length)}`
      if (storage.getItem(destinationKey) !== null) continue
      const value = storage.getItem(sourceKey)
      if (value !== null) storage.setItem(destinationKey, value)
    } catch {
      // Stockage refusé/quota : garder la source, sans bloquer l'interface.
    }
  }
}
