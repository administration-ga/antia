/** Projection illustrative fermée, réservée au backend local ou à la démo déclarée. */
type DemoCatalogDeclaration = { offerRef: string; shopHandle: string; kind: "product" | "service"; collectionRef: string; imagePath: string }

const mediaRoot = "/demo-media/animation-20261020"
const demoMediaPaths = ["epicerie-produits", "panier-raphia", "savon-artisanal", "sac-wax", "service-photo", "service-informatique", "association-lecture", "association-littoral"].map((slug) => `${mediaRoot}/${slug}.png`)
const collections = ["demo:collection:epicerie-moussavou-demo", "demo:collection:studio-objectif-demo", "demo:collection:atelier-tech-demo"] as const

export const DEMO_CATALOG_DECLARATIONS: readonly DemoCatalogDeclaration[] = [
  { offerRef: "demo:offer:epicerie-produits", shopHandle: "epicerie-moussavou-demo", kind: "product", collectionRef: collections[0], imagePath: `${mediaRoot}/epicerie-produits.png` },
  { offerRef: "demo:offer:panier-raphia", shopHandle: "epicerie-moussavou-demo", kind: "product", collectionRef: collections[0], imagePath: `${mediaRoot}/panier-raphia.png` },
  { offerRef: "demo:offer:savon-artisanal", shopHandle: "epicerie-moussavou-demo", kind: "product", collectionRef: collections[0], imagePath: `${mediaRoot}/savon-artisanal.png` },
  { offerRef: "demo:offer:sac-wax", shopHandle: "epicerie-moussavou-demo", kind: "product", collectionRef: collections[0], imagePath: `${mediaRoot}/sac-wax.png` },
  { offerRef: "demo:offer:photo-portrait", shopHandle: "studio-objectif-demo", kind: "service", collectionRef: collections[1], imagePath: `${mediaRoot}/service-photo.png` },
  { offerRef: "demo:offer:reportage-photo", shopHandle: "studio-objectif-demo", kind: "service", collectionRef: collections[1], imagePath: `${mediaRoot}/service-photo.png` },
  { offerRef: "demo:offer:diagnostic-informatique", shopHandle: "atelier-tech-demo", kind: "service", collectionRef: collections[2], imagePath: `${mediaRoot}/service-informatique.png` },
  { offerRef: "demo:offer:maintenance-informatique", shopHandle: "atelier-tech-demo", kind: "service", collectionRef: collections[2], imagePath: `${mediaRoot}/service-informatique.png` },
]

/** Aucune variable de bascule ne suffit à autoriser un autre hôte de production. */
export function demoCatalogProjectionAllowed(backendUrl: string | undefined = process.env.NEXT_PUBLIC_CONVEX_URL): boolean {
  if (!backendUrl) return false
  try {
    const url = new URL(backendUrl)
    if (backendUrl !== url.origin || url.username || url.password || url.search || url.hash) return false
    return url.protocol === "http:" && url.port === "3210" && ["127.0.0.1", "localhost"].includes(url.hostname)
      || url.protocol === "https:" && !url.port && url.hostname === "vivid-hedgehog-655.convex.cloud"
  } catch { return false }
}

export function demoCatalogDeclaration(offerRef: string): DemoCatalogDeclaration | undefined {
  return DEMO_CATALOG_DECLARATIONS.find((declaration) => declaration.offerRef === offerRef)
}

export function isDemoCatalogOfferRef(value: string): boolean {
  return demoCatalogProjectionAllowed() && demoCatalogDeclaration(value) !== undefined
}

export function isDemoCatalogCollectionRef(value: string): boolean {
  return demoCatalogProjectionAllowed() && collections.some((collection) => collection === value)
}

export function isDemoCatalogAssetPath(value: string): boolean {
  return demoCatalogProjectionAllowed() && demoMediaPaths.includes(value)
}
