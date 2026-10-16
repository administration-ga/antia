"use client"

import { StoriesViewerPage } from "@antsia/social-features/stories"

export function StoriesScreen({ openCreate }: { openCreate: boolean }) {
  return <StoriesViewerPage openCreate={openCreate} />
}
