"use client"

import { api, type Id } from "@antsia/api/engine"
import { useMutation, useQuery } from "convex/react"
import { useTranslation } from "react-i18next"

import { ConsoleDate, EmptyRows, LoadingRows, MotiveAction, panelClass, useWindowCursor, WindowPagination } from "./console-operation-controls"

type StorefrontPolicyValue = "closed" | "review" | "auto_verified"

/**
 * Finitions (DP-37, K-19) — la porte des vitrines (P07), sur le modèle des panneaux P14/P15 :
 *  · la POLITIQUE de publication du réseau, FERMÉE par défaut, lue par toute la console et
 *    réglée par l'administration de la plateforme seule (`shops/operator.setStorefrontPolicy` :
 *    motif d'au moins dix caractères, ligne `shop.policy_set` au journal) ;
 *  · la FILE D'ADMISSION (`storefrontQueue`, `decideStorefront`) : admettre ou refuser, motif
 *    obligatoire, ligne `shop.storefront_decide` au journal.
 * L'admission d'office (`auto_verified`) n'est jamais proposée ici tant que la liste des secteurs
 * restreints n'est pas validée (DP-05) ; si elle est déjà en vigueur, le panneau permet d'en sortir.
 */
export function StorefrontPolicy({ networkId, canAdmin }: { networkId: Id<"networks">; canAdmin: boolean }) {
  const { t } = useTranslation("operations")
  const policy = useQuery(api.modules.shops.operator.storefrontPolicy, { networkId })
  const setPolicy = useMutation(api.modules.shops.operator.setStorefrontPolicy)
  const decide = (next: StorefrontPolicyValue) => (reason: string) => setPolicy({ networkId, policy: next, reason })
  return <section className={`${panelClass} flex min-w-0 flex-col gap-3`}>
    <h3 className="font-semibold">{t("storefrontPolicy.title")}</h3>
    <p className="text-sm text-muted-foreground">{t("storefrontPolicy.lead")}</p>
    <p className="text-sm text-muted-foreground">{t("storefrontPolicy.closeHint")}</p>
    <p className="text-sm text-muted-foreground">{t("storefrontPolicy.autoHint")}</p>
    {policy === undefined ? <LoadingRows /> : <>
      <p role="status" className="text-sm">{t(`storefrontPolicy.state.${policy.policy}`)}</p>
      {policy.updatedAt !== null ? <p className="text-xs text-muted-foreground">{t("storefrontPolicy.updated")} <ConsoleDate at={policy.updatedAt} /></p> : null}
      {canAdmin ? <>
        {policy.policy !== "review" ? <MotiveAction key={`${networkId}:review:${policy.policy}`} label={t(policy.policy === "closed" ? "storefrontPolicy.openReview" : "storefrontPolicy.backToReview")} minLength={10} onDecision={decide("review")} /> : null}
        {policy.policy !== "closed" ? <MotiveAction key={`${networkId}:closed:${policy.policy}`} label={t("storefrontPolicy.close")} minLength={10} danger onDecision={decide("closed")} /> : null}
      </> : <p className="text-sm text-muted-foreground">{t("common.adminRequired")}</p>}
      <StorefrontQueue networkId={networkId} admissionOpen={policy.policy !== "closed"} />
    </>}
  </section>
}

/** La file d'un réseau, la plus ancienne demande d'abord ; nom, présentation et préparateur seulement (P16 §3.7). */
function StorefrontQueue({ networkId, admissionOpen }: { networkId: Id<"networks">; admissionOpen: boolean }) {
  const { t } = useTranslation("operations")
  const window = useWindowCursor()
  const queue = useQuery(api.modules.shops.operator.storefrontQueue, { networkId, paginationOpts: { cursor: window.cursor, numItems: 10, maximumRowsRead: 25, maximumBytesRead: 524_288 } })
  const decide = useMutation(api.modules.shops.operator.decideStorefront)
  return <div className="flex min-w-0 flex-col gap-3 border-t border-border pt-3">
    <h4 className="font-semibold">{t("storefrontPolicy.queue.title")}</h4>
    <p className="text-sm text-muted-foreground">{t("storefrontPolicy.queue.lead")}</p>
    {admissionOpen ? null : <p className="text-sm text-muted-foreground">{t("storefrontPolicy.queue.closedHint")}</p>}
    {queue === undefined ? <LoadingRows /> : queue.page.length === 0 ? <EmptyRows done={queue.isDone} /> : <ul className="flex min-w-0 flex-col gap-3">{queue.page.map((item) => {
      const preparerName = item.preparer?.displayName ?? item.preparer?.handle ?? null
      return <li key={item.shopId} className="flex min-w-0 flex-col gap-2 rounded-lg border border-border p-3">
        <p className="break-words font-semibold">{item.name ?? t("storefrontPolicy.queue.unnamed")}</p>
        <p className="text-xs text-muted-foreground">{t(`storefrontPolicy.queue.model.${item.model}`)}{item.pageHandle !== null ? <> · {t("storefrontPolicy.queue.page", { handle: item.pageHandle })}</> : null}</p>
        {item.description !== null ? <p className="break-words text-sm">{item.description}</p> : null}
        <p className="break-words text-xs text-muted-foreground">
          {preparerName === null ? t("storefrontPolicy.queue.noPreparer") : item.preparer?.handle ? t("storefrontPolicy.queue.preparerWithHandle", { name: preparerName, handle: item.preparer.handle }) : t("storefrontPolicy.queue.preparer", { name: preparerName })}
          {item.preparer !== null ? <> · {t(`storefrontPolicy.queue.membership.${item.preparer.membership ?? "none"}`)}</> : null}
        </p>
        {item.requestedAt !== null ? <p className="text-xs text-muted-foreground">{t("storefrontPolicy.queue.requested")} <ConsoleDate at={item.requestedAt} /></p> : null}
        <MotiveAction key={`${item.shopId}:admit`} label={t("storefrontPolicy.queue.admit")} disabled={!admissionOpen} onDecision={(reason) => decide({ shopId: item.shopId, decision: "admit", reason })} />
        <MotiveAction key={`${item.shopId}:reject`} label={t("storefrontPolicy.queue.reject")} danger onDecision={(reason) => decide({ shopId: item.shopId, decision: "reject", reason })} />
      </li>
    })}</ul>}
    <WindowPagination window={window} result={queue} />
  </div>
}
