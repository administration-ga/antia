// @vitest-environment jsdom
import { ViewerPreferencesProvider, useViewerTimeZone } from "@antsia/api/viewer-preferences"
import { fireEvent, render, screen } from "@testing-library/react"
import { useEffect, useState } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { afterEach, describe, expect, it, vi } from "vitest"

function Probe() {
  const timeZone = useViewerTimeZone()
  return <output>{timeZone}</output>
}

afterEach(() => vi.restoreAllMocks())

describe("ViewerPreferencesProvider", () => {
  it("garde UTC au rendu serveur sans préférence et respecte une préférence explicite", () => {
    expect(renderToStaticMarkup(<ViewerPreferencesProvider><Probe /></ViewerPreferencesProvider>)).toContain("UTC")
    expect(renderToStaticMarkup(<Probe />)).toContain("UTC")
    expect(renderToStaticMarkup(<ViewerPreferencesProvider timeZone="Asia/Tokyo"><Probe /></ViewerPreferencesProvider>)).toContain("Asia/Tokyo")
  })

  it("une préférence personnelle prime sur la détection et se met à jour sans démontage", () => {
    const mounted = vi.fn()
    const unmounted = vi.fn()
    function StatefulChild() {
      const zone = useViewerTimeZone()
      const [count, setCount] = useState(0)
      useEffect(() => { mounted(); return unmounted }, [])
      return <button onClick={() => setCount((previous) => previous + 1)}>{zone}:{count}</button>
    }
    const child = <StatefulChild />
    const { rerender } = render(<ViewerPreferencesProvider timeZone="Asia/Tokyo">{child}</ViewerPreferencesProvider>)
    fireEvent.click(screen.getByRole("button"))
    rerender(<ViewerPreferencesProvider timeZone="Africa/Libreville">{child}</ViewerPreferencesProvider>)
    expect(screen.getByRole("button").textContent).toBe("Africa/Libreville:1")
    expect(mounted).toHaveBeenCalledOnce()
    expect(unmounted).not.toHaveBeenCalled()
  })

  it("les autres applications et préférences invalides gardent le repli appareil", () => {
    const deviceZone = new Intl.DateTimeFormat().resolvedOptions().timeZone
    const { rerender } = render(<ViewerPreferencesProvider timeZone="invalid/zone"><Probe /></ViewerPreferencesProvider>)
    expect(screen.getByRole("status").textContent).toBe(deviceZone)
    rerender(<Probe />)
    expect(screen.getByRole("status").textContent).toBe(deviceZone)
  })

  it("un navigateur qui refuse Intl n'empêche pas le montage du contenu", () => {
    vi.spyOn(Intl, "DateTimeFormat").mockImplementation(() => { throw new Error("Intl unavailable") })
    render(<ViewerPreferencesProvider timeZone="new/invalid-zone"><Probe /></ViewerPreferencesProvider>)
    expect(screen.getByRole("status").textContent).toBe("UTC")
  })
})
