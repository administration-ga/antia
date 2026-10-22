import type { Metadata } from "next"
import { FoodUniverseScreen } from "@/components/universes/food-universe-screen"
import { getAppT } from "@/i18n/server"

export function generateMetadata(): Metadata {
  const { t } = getAppT()
  return { title: t("marketplace:food.title") }
}

/** L'univers « Alimentation et restauration » : les adresses du réseau et ce qu'on peut y commander. */
export default function FoodUniversePage() {
  return <FoodUniverseScreen />
}
