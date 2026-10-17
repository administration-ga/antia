import { legalMetadata, legalScreen } from "@/components/public/public-routes"
import { routes } from "@/lib/routes"

export const generateMetadata = legalMetadata("about", routes.about())
export default legalScreen("about")
