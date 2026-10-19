import { redirect } from "next/navigation"
import { routes } from "@/lib/routes"

export default function GroupsPage() { redirect(routes.memberTab("groupes")) }
