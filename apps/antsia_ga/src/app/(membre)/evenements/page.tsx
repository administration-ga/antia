import { redirect } from "next/navigation"
import { routes } from "@/lib/routes"

export default function EventsPage() { redirect(routes.memberTab("evenements")) }
