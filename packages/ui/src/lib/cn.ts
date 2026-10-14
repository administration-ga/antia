import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

/** Fusion de classes Tailwind (même patron que le socle `@workspace/ui/lib/utils`). */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
