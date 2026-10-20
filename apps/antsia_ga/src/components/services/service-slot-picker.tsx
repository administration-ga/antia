"use client"

import { api } from "@antsia/api/engine"
import { useNetwork } from "@antsia/api/network"
import { formatUtcOffset, wallTimeInstants, zonedWallTime } from "@antsia/social-domain/serviceTime"
import type { ServiceSlotsResult } from "@convex/modules/shops/serviceRules"
import { zodResolver } from "@hookform/resolvers/zod"
import { useAction } from "convex/react"
import { useEffect, useId, useState } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { Button, Field, TextInput } from "@/components/shared/controls"
import { useShopAction } from "@/components/shops/shop-ui"
import {
  deviceTimeZone, displayTimeZones, jumpSchema, SERVICE_AGENDA_TIME_ZONE, serviceDateTime, serviceTime, serviceZoneName, slotsByDay, slotWindow,
  type JumpValues,
} from "./service-model"

export type PickedSlot = { startAt: number; endAt: number; resourceRef: string; resourceLabel: string | null }
const WINDOW_MS = slotWindow(0).toAt

/**
 * Créneaux libres servis par PRO.GA, fenêtre de sept jours. Les instants restent ceux de
 * PRO.GA ; le fuseau d'affichage est toujours nommé, et l'heure de l'agenda reste lisible.
 * Une heure saisie qui n'existe pas (ou existe deux fois) dans le fuseau choisi est dite.
 */
export function ServiceSlotPicker({ handle, offerRef, serviceRef, selected, onPick }: { handle: string; offerRef: string; serviceRef: string; selected: PickedSlot | null; onPick: (slot: PickedSlot) => void }) {
  const { networkId } = useNetwork()
  const { t, i18n } = useTranslation("services")
  const locale = i18n.resolvedLanguage ?? "fr"
  const id = useId()
  const load = useAction(api.modules.shops.serviceActions.slots)
  const action = useShopAction()
  const { run } = action
  const [now] = useState(() => Date.now())
  const [fromAt, setFromAt] = useState(now)
  const [zones] = useState(() => displayTimeZones(deviceTimeZone(), now))
  // Fuseau d'AFFICHAGE : celui de l'agenda au départ, puis tout fuseau IANA proposé (appareil).
  const [zone, setZone] = useState<string>(SERVICE_AGENDA_TIME_ZONE)
  const [result, setResult] = useState<ServiceSlotsResult | null>(null)
  const [ambiguous, setAmbiguous] = useState<number[]>([])
  const [jumpError, setJumpError] = useState<string | null>(null)
  useEffect(() => {
    const window = slotWindow(fromAt)
    void run(() => load({ networkId, handle, offerRef, serviceRef, fromAt: window.fromAt, toAt: window.toAt }), setResult)
  }, [fromAt, handle, load, networkId, offerRef, run, serviceRef])
  const jump = useForm<JumpValues>({ resolver: zodResolver(jumpSchema(t)), defaultValues: { date: "", time: "" } })
  const goTo = jump.handleSubmit((values) => {
    setAmbiguous([])
    setJumpError(null)
    const instants = wallTimeInstants(values.date, values.time, zone)
    if (instants.length === 0) { setJumpError(t("slots.nonexistent", { zone })); return }
    if (instants.length > 1) { setAmbiguous(instants); return }
    const [instant] = instants
    if (instant !== undefined) setFromAt(Math.max(instant, now))
  })
  const ready = result?.outcome === "ready" ? result : null
  return <section aria-labelledby={`${id}-title`} className="grid gap-4">
    <h3 id={`${id}-title`} className="font-display text-base font-bold leading-snug">{t("slots.title")}</h3>
    {zones.length > 1 ? <fieldset className="grid gap-2"><legend className="text-sm font-medium">{t("slots.zone")}</legend>
      {zones.map((candidate) => <label key={candidate} className="flex min-h-11 items-center gap-3 text-sm"><input type="radio" name={`${id}-zone`} className="size-4" checked={zone === candidate} onChange={() => setZone(candidate)} />{serviceZoneName(fromAt, candidate, locale)}</label>)}
    </fieldset> : <p className="text-sm text-muted-foreground">{t("slots.zoneOnly", { zone: serviceZoneName(fromAt, zone, locale) })}</p>}
    <form noValidate className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end" onSubmit={goTo} aria-label={t("slots.jump")}>
      <Field id={`${id}-date`} label={t("slots.date")} error={jump.formState.errors.date?.message}><TextInput id={`${id}-date`} type="date" {...jump.register("date")} /></Field>
      <Field id={`${id}-time`} label={t("slots.time")} error={jump.formState.errors.time?.message}><TextInput id={`${id}-time`} type="time" {...jump.register("time")} /></Field>
      <Button type="submit" variant="outline">{t("slots.jump")}</Button>
    </form>
    {jumpError ? <p role="alert" className="text-sm">{jumpError}</p> : null}
    {ambiguous.length > 1 ? <div role="alert" className="grid gap-2 rounded-[var(--ui2-card-radius)] border border-border p-[var(--esp-card-padding,16px)] text-sm"><p>{t("slots.ambiguous", { zone })}</p><div className="flex flex-wrap gap-2">{ambiguous.map((instant) => <Button key={instant} variant="outline" onClick={() => { setAmbiguous([]); setFromAt(Math.max(instant, now)) }}>{t("slots.ambiguousChoice", { time: serviceTime(instant, zone, locale), offset: formatUtcOffset(zonedWallTime(instant, zone)?.offsetMinutes ?? 0) })}</Button>)}</div></div> : null}
    <nav aria-label={t("slots.navigation")} className="flex flex-wrap gap-2">
      <Button variant="outline" disabled={action.pending || fromAt <= now} onClick={() => setFromAt((value) => Math.max(now, value - WINDOW_MS))}>{t("slots.previous")}</Button>
      <Button variant="outline" disabled={action.pending} onClick={() => setFromAt((value) => value + WINDOW_MS)}>{t("slots.next")}</Button>
    </nav>
    {action.pending ? <p role="status" className="text-sm text-muted-foreground">{t("slots.loading")}</p> : null}
    {!action.pending && result && result.outcome !== "ready" ? <p role="alert" className="text-sm">{t(result.outcome === "refused" ? "slots.refused" : "slots.unavailable")}</p> : null}
    {action.error ? <p role="alert" className="text-sm">{action.error}</p> : null}
    {ready ? <div className="grid gap-3" aria-busy={action.pending || undefined}>
      <p className="text-sm text-muted-foreground">{t("slots.window", { from: serviceDateTime(ready.fromAt, zone, locale), to: serviceDateTime(ready.toAt, zone, locale) })}</p>
      {ready.slots.length === 0 ? <p className="rounded-[var(--ui2-card-radius)] border border-dashed border-border p-[var(--esp-card-padding,16px)] text-sm text-muted-foreground">{t("slots.empty")}</p> : slotsByDay(ready.slots, zone, locale).map((group) => <div key={group.day} className="grid gap-2">
        <h4 className="text-sm font-semibold">{group.day}</h4>
        <ul className="flex flex-wrap gap-2">{group.slots.map((slot) => {
          const picked = selected?.startAt === slot.startAt && selected.resourceRef === slot.resourceRef
          return <li key={`${slot.resourceRef}:${slot.startAt}`}><Button variant={picked ? "primary" : "outline"} aria-pressed={picked} onClick={() => onPick({ startAt: slot.startAt, endAt: slot.endAt, resourceRef: slot.resourceRef, resourceLabel: slot.resourceLabel })}>
            {slot.resourceLabel ? t("slots.slotWithResource", { time: serviceTime(slot.startAt, zone, locale), resource: slot.resourceLabel }) : serviceTime(slot.startAt, zone, locale)}
          </Button></li>
        })}</ul>
      </div>)}
      {ready.truncated ? <p className="text-xs text-muted-foreground">{t("slots.truncated")}</p> : null}
    </div> : null}
    {selected ? <SlotSummary slot={selected} zone={zone} /> : null}
  </section>
}

/** Le créneau choisi, dans le fuseau d'affichage ET dans celui de l'agenda s'ils diffèrent. */
export function SlotSummary({ slot, zone }: { slot: Pick<PickedSlot, "startAt" | "endAt" | "resourceLabel">; zone: string }) {
  const { t, i18n } = useTranslation("services")
  const locale = i18n.resolvedLanguage ?? "fr"
  return <div className="grid gap-1 rounded-[var(--ui2-card-radius)] border border-transparent bg-muted p-[var(--esp-card-padding,16px)] text-sm" role="status">
    <p className="font-medium">{t("slots.selected", { start: serviceDateTime(slot.startAt, zone, locale), end: serviceTime(slot.endAt, zone, locale) })}</p>
    <p className="text-muted-foreground">{serviceZoneName(slot.startAt, zone, locale)}</p>
    {zone !== SERVICE_AGENDA_TIME_ZONE ? <p className="text-muted-foreground">{t("slots.agendaTime", { start: serviceDateTime(slot.startAt, SERVICE_AGENDA_TIME_ZONE, locale), zone: serviceZoneName(slot.startAt, SERVICE_AGENDA_TIME_ZONE, locale) })}</p> : null}
    {slot.resourceLabel ? <p>{t("slots.resource", { resource: slot.resourceLabel })}</p> : null}
  </div>
}
