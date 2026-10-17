import { ModerationScreen } from "@/components/moderation/moderation-screen"

export default async function ModerationPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const search = await searchParams
  return <ModerationScreen search={{ view: search.vue, team: search.equipe, cursor: search.curseur }} />
}
