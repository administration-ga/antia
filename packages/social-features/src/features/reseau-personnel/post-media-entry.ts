/**
 * Point d'entrée ÉTROIT du lecteur de médias d'une publication (P18b, F03).
 *
 * L'îlot client de la carte publique SSR
 * (`apps/antsia_ga/src/components/public/public-post-media.tsx`) l'importe par
 * `@antsia/social-features/features/reseau-personnel/post-media-entry` au lieu
 * du barillet `@antsia/social-features/reseau-personnel`, qui exporte aussi la
 * page réseau, les profils, les groupes, les personnes et le composeur : sans
 * `sideEffects` déclaré, une large part du moteur pouvait entrer dans le JS des
 * pages publiques.
 *
 * Le paquet n'expose ses modules profonds qu'en `.ts` (`"./*": "./src/*.ts"`) :
 * ce relais en `.ts` rend le composant `.tsx` atteignable sans modifier le
 * `package.json`. Le gain réel reste à MESURER au build (JS de
 * `/publications/[id]` avant et après).
 */
export { PostMedia } from "./PostMedia"
