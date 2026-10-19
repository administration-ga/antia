// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, expect, it } from "vitest"
import { NetworkProvider } from "@antsia/api/network"

import { TEST_NETWORK_ID, TEST_PERSON_ID, TEST_ROUTES } from "../../tests/engine-wrapper"
import { useConferenceLaunchAvailable } from "../iappel/use-launch-conference"

afterEach(cleanup)

function Probe() {
  return <p role="status">{String(useConferenceLaunchAvailable())}</p>
}

it("une adresse réservée ne propose pas de conférence avant activation explicite de l'application", () => {
  const props = { networkId: TEST_NETWORK_ID, personId: TEST_PERSON_ID, slug: "test", charte: "antsia", routes: TEST_ROUTES }
  const view = render(<NetworkProvider {...props}><Probe /></NetworkProvider>)
  expect(screen.getByRole("status")).toHaveTextContent("false")
  view.rerender(<NetworkProvider {...props} liveAvailable><Probe /></NetworkProvider>)
  expect(screen.getByRole("status")).toHaveTextContent("true")
})
