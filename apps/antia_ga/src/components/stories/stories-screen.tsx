"use client"

import { StoriesViewerPage } from "@antia/social-features/stories"

export function StoriesScreen({ openCreate }: { openCreate: boolean }) {
  return <StoriesViewerPage openCreate={openCreate} />
}
