// Dupliqué de socle/packages/agent-features/src/features/messagerie/icom-public-reminders.test.ts @ ad2e7fdc2 — adaptations : badge de la page porté par la source (`pageBadge`) ; destination par une table des routes injectée (`publicReminderHref(reminder, routes)`) — encodage gardé, et sans route de page le rappel ne mène nulle part (jamais au profil d'une personne) ; heure relative lue par un `t` français ; cas neuf : projection du DTO du moteur (`pageUpdateFromEngine`).
import { describe, expect, it } from "vitest"
import { createAppI18n } from "../../i18n"
import {
  ICOM_PUBLIC_REMINDERS_MAX,
  pageUpdateFromEngine,
  publicReminderHref,
  publicReminderTime,
  publicRemindersForIcom,
  type IcomPageUpdateSource,
  type IcomPublicUpdateSource,
} from "./icom-public-reminders"

const t = createAppI18n({ locale: "fr", appResources: { fr: {}, en: {} }, defaultNS: "messagerie" }).t

/** Une table des routes qui sert les pages, et une qui ne les sert pas. */
const AVEC_PAGES = {
  profile: (handle: string) => `/profil/${handle}`,
  page: (handle: string) => `/pages/${handle}`,
}
const SANS_PAGES = { profile: (handle: string) => `/profil/${handle}` }

function page(index: number): IcomPageUpdateSource {
  return {
    kind: "page",
    postId: `post-${index}`,
    publishedAt: 1_000 + index,
    excerpt: `  Information   publique ${index}  `,
    pageId: `page-${index}`,
    pageHandle: `ministere-${index}`,
    pageName: `Ministère ${index}`,
    pageBadge: "official",
  }
}

describe("publicRemindersForIcom", () => {
  it("borne la surface à cinq rappels et normalise les champs optionnels", () => {
    const reminders = publicRemindersForIcom(
      Array.from({ length: 8 }, (_, index) => page(index)),
    )

    expect(reminders).toHaveLength(ICOM_PUBLIC_REMINDERS_MAX)
    expect(reminders[0]).toMatchObject({
      kind: "page",
      excerpt: "Information publique 0",
      pageLogoUrl: null,
      pageBadge: "official",
    })
  })

  it("ignore fail-closed un futur canal au lieu d'inventer son rendu", () => {
    const updates: IcomPublicUpdateSource[] = [
      { kind: "channel", channelId: "canal-a-venir" },
      page(1),
    ]

    expect(publicRemindersForIcom(updates)).toEqual([
      expect.objectContaining({ kind: "page", postId: "post-1" }),
    ])
  })

  it("ne mute pas la réponse reçue", () => {
    const updates = [page(1), page(2)]
    const before = JSON.stringify(updates)
    publicRemindersForIcom(updates)
    expect(JSON.stringify(updates)).toBe(before)
  })
})

describe("pageUpdateFromEngine — la carte de page du moteur", () => {
  it("projette l'identité et le badge CALCULÉ de la page", () => {
    expect(
      pageUpdateFromEngine({
        postId: "posts_1",
        publishedAt: 42,
        excerpt: "Communiqué",
        page: { pageId: "pages_1", handle: "quartier-nord", name: "Quartier nord", logoUrl: null, badge: "community" },
      }),
    ).toEqual({
      kind: "page",
      postId: "posts_1",
      publishedAt: 42,
      excerpt: "Communiqué",
      pageId: "pages_1",
      pageHandle: "quartier-nord",
      pageName: "Quartier nord",
      pageLogoUrl: null,
      pageBadge: "community",
    })
  })
})

describe("navigation et temps", () => {
  it("reconstruit la route de page de l'application et encode le handle", () => {
    const [reminder] = publicRemindersForIcom([
      { ...page(1), pageHandle: "min-économie/finances" },
    ])
    expect(publicReminderHref(reminder!, AVEC_PAGES)).toBe(
      "/pages/min-%C3%A9conomie%2Ffinances",
    )
  })

  it("sans route de page, ne mène nulle part — jamais au profil d'une personne homonyme", () => {
    const [reminder] = publicRemindersForIcom([page(1)])
    expect(publicReminderHref(reminder!, SANS_PAGES)).toBeNull()
  })

  it("formate l'heure à partir d'un instant fourni", () => {
    const [reminder] = publicRemindersForIcom([
      { ...page(1), publishedAt: 1_000_000 },
    ])
    expect(publicReminderTime(reminder!, 1_000_000 + 3 * 3_600_000, t)).toBe(
      "il y a 3 h",
    )
  })
})
