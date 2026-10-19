/**
 * @antsia/ui — jetons, charte de base, thèmes d'application et primitives du
 * moteur. Les primitives viennent d'ui-v2 (bouton, icône, badge, champs,
 * alerte, carte, tableau, squelettes, accessibilité des surfaces modales),
 * dupliquées du socle ; le tiroir (`@antsia/ui/sheet`) et les surfaces plein
 * écran (`@antsia/ui/overlay`) ont leur propre point d'entrée.
 */
export { cn } from "./lib/cn"
export { APPLICATION_THEMES, type ApplicationTheme, ANTSIA_THEME_IDS, ANTSIA_THEMES, antsiaCharteFor, type AntsiaThemeId } from "./themes"

export { Icon } from "./components/icon"
export type { IconName, IconProps } from "./components/icon"
export { Button } from "./components/button"
export type { ButtonProps } from "./components/button"
export { Badge } from "./components/badge"
export type { BadgeProps } from "./components/badge"
export { Card } from "./components/card"
export type { CardProps } from "./components/card"
export { Field, TextInput, TextArea, Select, Checkbox, Radio, Toggle } from "./components/form"
export type { FieldProps, TextInputProps, SelectProps, CheckboxProps, RadioProps, ToggleProps } from "./components/form"
export { Alert } from "./components/alert"
export type { AlertProps } from "./components/alert"
export { Table, Th, Td, Tr } from "./components/table"
export type { TableProps, ThProps, TdProps, TrProps } from "./components/table"
export { Skeleton, SkeletonText, SkeletonCard, SkeletonStatCard, SkeletonTable } from "./components/skeleton"
export type { SkeletonProps, SkeletonTextProps, SkeletonCardProps, SkeletonTableProps } from "./components/skeleton"
export type { Tone, Size, StylableProps } from "./types"

export { useModalA11y } from "./hooks/use-modal-a11y"
export type { UseModalA11yOptions } from "./hooks/use-modal-a11y"
export { useDebouncedValue, SEARCH_DEBOUNCE_MS } from "./hooks/use-debounced-value"
