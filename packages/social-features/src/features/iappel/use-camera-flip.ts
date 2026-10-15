// Dupliqué de socle/packages/agent-features/src/features/iappel/use-camera-flip.ts @ ad2e7fdc2 — adaptations : aucune (plomberie LiveKit, sans texte affiché ni dépendance au socle).
"use client"

/**
 * useCameraFlip — passer de la caméra avant à la caméra arrière.
 *
 * Au téléphone, c'est la commande la plus utilisée d'un appel vidéo après le
 * micro : on montre un document, une salle, un guichet — pas seulement son
 * visage. Elle n'a en revanche AUCUN sens avec une seule caméra, et la
 * commande disparaît alors (`availableCallControls.flip`).
 *
 * La décision « quel périphérique ensuite » vit dans `call-controls.ts`
 * (module pur, testé, avec sa reconnaissance de libellés en français comme en
 * anglais et son repli par cyclage quand les libellés sont vides — ce qui est
 * le cas tant que la permission n'a pas été accordée). Ici, on ne fait que
 * demander la bascule à LiveKit.

 * ⚠️ La salle est OPTIONNELLE : `useMaybeRoomContext`, jamais
 * `useRoomContext`. Ce hook est appelé depuis l'écran d'appel, qui s'ouvre
 * AVANT que la salle n'existe ; la variante qui lève emportait le rendu.
 */

import { useMaybeRoomContext } from "@livekit/components-react"
import { useCallback, useEffect, useState } from "react"
import { nextCameraDevice } from "./call-controls"

export interface CameraFlip {
	/** Nombre de caméras détectées — décide si la commande existe. */
	deviceCount: number
	facing: "user" | "environment"
	flip: () => Promise<void>
}

export function useCameraFlip(): CameraFlip {
	const room = useMaybeRoomContext()
	const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
	const [activeId, setActiveId] = useState<string | null>(null)
	const [facing, setFacing] = useState<"user" | "environment">("user")

	useEffect(() => {
		if (typeof navigator === "undefined" || !navigator.mediaDevices) return
		let cancelled = false
		const refresh = () => {
			void navigator.mediaDevices
				.enumerateDevices()
				.then((all) => {
					if (cancelled) return
					setDevices(all.filter((d) => d.kind === "videoinput"))
				})
				.catch(() => {
					if (!cancelled) setDevices([])
				})
		}
		refresh()
		// Une caméra branchée ou retirée en cours d'appel change la donne :
		// la commande doit apparaître ou disparaître en conséquence.
		navigator.mediaDevices.addEventListener("devicechange", refresh)
		return () => {
			cancelled = true
			navigator.mediaDevices.removeEventListener("devicechange", refresh)
		}
	}, [])

	const flip = useCallback(async () => {
		if (!room || devices.length < 2) return
		const wanted = facing === "user" ? "environment" : "user"
		const nextId = nextCameraDevice(
			devices.map((d) => ({ deviceId: d.deviceId, label: d.label })),
			activeId,
			wanted,
		)
		if (nextId === null) return
		try {
			await room.switchActiveDevice("videoinput", nextId)
			setActiveId(nextId)
			setFacing(wanted)
		} catch {
			// Caméra occupée par une autre application, ou débranchée entre
			// l'énumération et le clic : on ne casse pas l'appel pour autant.
		}
	}, [room, devices, activeId, facing])

	return { deviceCount: devices.length, facing, flip }
}
