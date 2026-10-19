/**
 * Tiroir (Radix Dialog) et portée de charte des surfaces portalisées — le
 * tiroir monte dans l'hôte publié par `OverlayScopeProvider` quand une coque
 * en pose un, sinon dans `<body>`.
 */
export { Sheet, SheetTrigger, SheetClose, SheetContent, SheetHeader, SheetBody, SheetFooter, SheetTitle, SheetDescription } from "./sheet"
export { OverlayScopeProvider, useOverlayContainer } from "./overlay-scope"
