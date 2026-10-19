import { legalMetadata, legalScreen } from "@/components/public/public-routes"
import { routes } from "@/lib/routes"

export const generateMetadata = legalMetadata("privacy", routes.privacy())
export default legalScreen("privacy")
