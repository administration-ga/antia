import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"

vi.mock("@/components/payment/payment-screen", () => ({
  PaymentAttemptScreen: ({ paymentAttemptId, returnedFromProvider = false }: { paymentAttemptId: string; returnedFromProvider?: boolean }) => <div data-attempt={paymentAttemptId} data-returned={returnedFromProvider ? "yes" : "no"}>private-attempt</div>,
  PaymentListScreen: () => <div>private-list</div>,
}))
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("TEST_NOT_FOUND") } }))

import ListPage, { generateMetadata as listMetadata } from "../../app/(membre)/mes-paiements/page"
import AttemptPage, { generateMetadata as attemptMetadata } from "../../app/(membre)/mes-paiements/[paymentAttemptId]/page"
import ReturnPage, { generateMetadata as returnMetadata } from "../../app/(membre)/mes-paiements/[paymentAttemptId]/retour/page"
import { TEST_PAYMENT_ATTEMPT_ID } from "./payment-fixtures.test-support"

describe("routes privées de paiement sans preuve issue des paramètres", () => {
  it("les trois routes restent non indexables", () => {
    for (const metadata of [listMetadata(), attemptMetadata(), returnMetadata()]) expect(metadata.robots).toEqual({ index: false, follow: false })
    expect(renderToStaticMarkup(ListPage())).toContain("private-list")
  })
  it("la route retour n'accède même pas aux paramètres paid/success et ne transmet qu'une indication de navigation", async () => {
    const props = {
      params: Promise.resolve({ paymentAttemptId: TEST_PAYMENT_ATTEMPT_ID }),
      get searchParams(): Promise<Record<string, string>> { throw new Error("query parameters must not be read as payment proof") },
    }
    const html = renderToStaticMarkup(await ReturnPage(props))
    expect(html).toContain(`data-attempt="${TEST_PAYMENT_ATTEMPT_ID}"`)
    expect(html).toContain('data-returned="yes"')
    expect(html).not.toContain("paid")
    expect(html).not.toContain("succeeded")
  })
  it("le suivi simple ne reçoit aucune confirmation artificielle de retour", async () => {
    const html = renderToStaticMarkup(await AttemptPage({ params: Promise.resolve({ paymentAttemptId: TEST_PAYMENT_ATTEMPT_ID }) }))
    expect(html).toContain('data-returned="no"')
  })
  it("refuse les segments mal encodés avant le montage du suivi", async () => {
    await expect(ReturnPage({ params: Promise.resolve({ paymentAttemptId: "%E0" }) })).rejects.toThrow("TEST_NOT_FOUND")
    await expect(AttemptPage({ params: Promise.resolve({ paymentAttemptId: "%E0" }) })).rejects.toThrow("TEST_NOT_FOUND")
  })
})
