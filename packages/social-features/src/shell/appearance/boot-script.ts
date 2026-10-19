/**
 * Script d'amorçage de l'apparence : la page le place, synchrone, en tête de
 * `<head>`, pour que la charte du thème choisi (`data-charte`), le motif de fond
 * choisi (`data-motif`, ADR-0027) et le mode sombre (`.dark`, `color-scheme`)
 * soient posés sur `<html>` AVANT le premier affichage.
 * Sans lui, le fournisseur d'apparence ne les pose qu'après l'hydratation : la
 * page s'affiche d'abord dans la charte d'origine, en clair, puis bascule.
 *
 * Il rejoue exactement la lecture du fournisseur (`provider.tsx`) — mêmes clés
 * sous le préfixe du réseau, même repli sur le premier thème, même suivi du
 * système — ce que `boot-script.test.ts` vérifie cas par cas. Module pur (aucun
 * `"use client"`) : la mise en page serveur l'appelle.
 *
 * CSP : son texte ne dépend que de la configuration de l'application, jamais de
 * la requête. Il passe aujourd'hui par `'unsafe-inline'` (palier PA0) ; avec la
 * CSP à jeton prévue (EXT-AN-02), la page lui donne le nonce de la requête
 * (`CSP_NONCE_HEADER`, `@antsia/api/csp`) — son empreinte stable permettrait aussi
 * de l'autoriser par `'sha256-…'`. ADR-0026.
 */

/** Un thème tel que le fournisseur le reçoit : identifiant et charte (`data-charte`). */
export interface AppearanceBootTheme {
  id: string
  charte: string
}

export interface AppearanceBootOptions {
  /** Le préfixe du réseau, celui que reçoit `AppearanceProvider`. */
  storagePrefix: string
  /** Les thèmes proposés, le premier par défaut ; absent : la charte de la page reste intacte. */
  themes?: readonly AppearanceBootTheme[]
  /** Les motifs de fond proposés (aucun par défaut) ; absent : aucun motif n'est posé. */
  motifs?: readonly string[]
}

/**
 * Le corps du script, en ES5 sans dépendance : il s'exécute avant tout paquet de
 * l'application. Chaque accès au navigateur est protégé : un stockage refusé ou
 * une API absente laissent le repli (thème par défaut, suivi du système, clair).
 */
const BOOT_BODY = [
  "var d=document.documentElement,t=null,m=null,f=null,k=false;",
  "try{var s=window.localStorage;t=s.getItem(o.t);m=s.getItem(o.a);if(o.g.length)f=s.getItem(o.f)}catch(e){}",
  "if(o.d!==null)d.setAttribute(\"data-charte\",o.c[t!==null&&Object.prototype.hasOwnProperty.call(o.c,t)?t:o.d]);",
  "if(f!==null&&o.g.indexOf(f)>=0)d.setAttribute(\"data-motif\",f);",
  "if(m===\"dark\")k=true;",
  "else if(m!==\"light\"){try{k=window.matchMedia(\"(prefers-color-scheme: dark)\").matches===true}catch(e){}}",
  "d.classList.toggle(\"dark\",k);",
  "d.style.colorScheme=k?\"dark\":\"light\"",
].join("")

/** Le JSON inséré dans un `<script>` ne doit jamais pouvoir le refermer (`</script>`, `<!--`). */
function scriptSafeJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c")
}

/** Le texte du script d'amorçage, stable pour une configuration donnée. */
export function appearanceBootScript({ storagePrefix, themes = [], motifs = [] }: AppearanceBootOptions): string {
  const chartes: Record<string, string> = {}
  for (const theme of themes) chartes[theme.id] = theme.charte
  const config = { a: `${storagePrefix}appearance`, t: `${storagePrefix}theme`, c: chartes, d: themes[0]?.id ?? null, f: `${storagePrefix}motif`, g: [...motifs] }
  return `(function(o){${BOOT_BODY}})(${scriptSafeJson(config)})`
}
