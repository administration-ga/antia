import { legalMetadata, legalScreen } from "@/components/public/public-routes"
import { routes } from "@/lib/routes"

export const generateMetadata = legalMetadata("legal", routes.legal())
export default legalScreen("legal")
