"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter } from "next/navigation"
import { useId } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { z } from "zod"

import { Button, TextInput } from "@/components/shared/controls"
import { CATALOG_QUERY_MAX_LENGTH, catalogSearch, type CatalogFilters } from "@/lib/catalog-search"
import { routes } from "@/lib/routes"
import type { CatalogAudience, CatalogPage } from "./catalog-model"
import { SHOP_SELECT_CLASS } from "./shop-ui"

/** L'îlot ne dépend que de l'i18n ; il est aussi rendu dans le SSR public. */
export function CatalogFiltersForm({ handle, filters, collections, audience }: { handle: string; filters: CatalogFilters; collections: CatalogPage["collections"]; audience: CatalogAudience }) {
  const { t } = useTranslation("shops")
  const router = useRouter()
  const id = useId()
  const schema = z.object({ type: z.enum(["", "product", "service"]), collection: z.string().max(200), recherche: z.string().max(CATALOG_QUERY_MAX_LENGTH, t("catalog.queryTooLong", { max: CATALOG_QUERY_MAX_LENGTH })) })
  const form = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema), defaultValues: { type: filters.kind ?? "", collection: filters.collectionRef ?? "", recherche: filters.query ?? "" } })
  const action = audience === "public" ? routes.publicShopCatalog(handle) : routes.shopCatalog(handle)
  return <form action={action} method="get" className="grid gap-4 rounded-2xl border border-border bg-card p-4 sm:grid-cols-2" onSubmit={form.handleSubmit((values) => {
    const search = catalogSearch(values)
    if (!search) { form.setError("recherche", { message: t("catalog.invalidFilters") }); return }
    router.push(audience === "public" ? routes.publicShopCatalog(handle, search) : routes.shopCatalog(handle, search))
  })}>
    <div className="grid gap-2 sm:col-span-2"><label htmlFor={`${id}-query`} className="text-sm font-medium">{t("catalog.search")}</label><TextInput id={`${id}-query`} type="search" maxLength={CATALOG_QUERY_MAX_LENGTH} {...form.register("recherche")} aria-invalid={!!form.formState.errors.recherche || undefined} aria-describedby={form.formState.errors.recherche ? `${id}-error` : undefined} />{form.formState.errors.recherche ? <p id={`${id}-error`} role="alert" className="text-sm text-destructive">{form.formState.errors.recherche.message}</p> : null}</div>
    <div className="grid gap-2"><label htmlFor={`${id}-kind`} className="text-sm font-medium">{t("catalog.kind")}</label><select id={`${id}-kind`} {...form.register("type")} className={SHOP_SELECT_CLASS}><option value="">{t("catalog.allKinds")}</option><option value="product">{t("catalog.kinds.product")}</option><option value="service">{t("catalog.kinds.service")}</option></select></div>
    <div className="grid gap-2"><label htmlFor={`${id}-collection`} className="text-sm font-medium">{t("catalog.collections")}</label><select id={`${id}-collection`} {...form.register("collection")} className={SHOP_SELECT_CLASS}><option value="">{t("catalog.allCollections")}</option>{filters.collectionRef && !collections.some((collection) => collection.collectionRef === filters.collectionRef) ? <option value={filters.collectionRef}>{t("catalog.selectedCollection")}</option> : null}{collections.map((collection) => <option key={collection.collectionRef} value={collection.collectionRef}>{collection.label}</option>)}</select></div>
    <Button type="submit" className="sm:col-span-2 sm:justify-self-start">{t("catalog.applyFilters")}</Button>
  </form>
}
