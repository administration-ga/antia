import { handleSessionBridge } from "@/lib/session-bridge-server"

export const dynamic = "force-dynamic"
export function POST(request: Request) { return handleSessionBridge(request) }
export function DELETE(request: Request) { return handleSessionBridge(request) }
