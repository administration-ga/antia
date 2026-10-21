/**
 * Initialise les vrais comptes OTP de démonstration, sans secrets écrits ni identité injectée.
 * Usage : bun scripts/prepare-demo-content.mjs --target local|demo [--apply]
 */
import { ConvexHttpClient } from "convex/browser"
import { makeFunctionReference } from "convex/server"
import { fileURLToPath } from "node:url"

export function targetConfiguration(target) {
  if (target === "local") return {origin:"http://localhost:3030",backend:"http://127.0.0.1:3210"}
  if (target === "demo") return {origin:"https://antsia-demo.vercel.app",backend:"https://vivid-hedgehog-655.convex.cloud"}
  throw new Error("Choisir explicitement --target local ou demo.")
}
const ref = (name)=>makeFunctionReference(name)
const demoHandles = {
  membre:"membre.demo",verifie:"verifie.demo",nouveau:null,presse:"presse.demo",
  commercant:"commercant.demo",association:"association.demo",administration:"administration.demo",moderateur:"moderation.demo",
}
function validCatalogue(accounts) {
  return Array.isArray(accounts) && accounts.length===8
    && accounts.every(account=>{
      if (!account || !Object.hasOwn(demoHandles,account.actor) || account.email!==`${account.actor}@demo.antsia.test`) return false
      if (account.actor==="nouveau") return account.profile===null
      const profile=account.profile
      return profile && typeof profile==="object" && !Array.isArray(profile)
        && profile.handle===demoHandles[account.actor]
        && ["displayName","headline"].every(key=>typeof profile[key]==="string" && profile[key].trim().length>0)
    })
    && new Set(accounts.map(account=>account.actor)).size===8
}
export async function prepareDemoAccounts(target,{apply=false,log=console.log}={}) {
  const config=targetConfiguration(target)
  const convex=new ConvexHttpClient(config.backend)
  const accounts=await convex.query(ref("modules/platform/demoAccounts:catalogue"),{})
  if (!validCatalogue(accounts)) throw new Error("Le catalogue ne confirme pas les huit comptes fictifs.")
  const active=accounts.filter(a=>a.profile!==null)
  if (!apply) return {target,actors:active.map(a=>a.actor),action:"dry-run"}
  const report=[]
  for (const account of active) {
    const auth=async (path,body,sessionToken) => {
      const response=await fetch(new URL("/api/auth"+path,config.origin),{
        method:body===undefined?"GET":"POST",redirect:"error",
        headers:{"Content-Type":"application/json",Origin:config.origin,...(sessionToken?{Authorization:`Bearer ${sessionToken}`}:{})},
        ...(body===undefined?{}:{body:JSON.stringify(body)}),
      })
      if (!response.ok) throw new Error(`Authentification de démonstration refusée (${path}, ${response.status}).`)
      return await response.json()
    }
    await auth("/email-otp/send-verification-otp",{email:account.email,type:"sign-in"})
    let code
    for(let tries=0;tries<8;tries++) {
      const value=await convex.query(ref("modules/platform/devTools:latestOtp"),{email:account.email})
      if (value && value.expiresAt>Date.now()) {code=value.code;break}
      await new Promise(resolve=>setTimeout(resolve,250))
    }
    if (!code) throw new Error("Code de démonstration indisponible.")
    const signed=await auth("/sign-in/email-otp",{email:account.email,otp:code})
    if (typeof signed.token!=="string") throw new Error("Session de démonstration indisponible.")
    const jwt=await auth("/convex/token",undefined,signed.token)
    if (typeof jwt.token!=="string") throw new Error("Jeton du moteur indisponible.")
    const client=new ConvexHttpClient(config.backend);client.setAuth(jwt.token)
    await client.mutation(ref("modules/people/persons:ensureMyPerson"),{})
    const person=await client.query(ref("modules/people/persons:getMyPerson"),{})
    if (!person) throw new Error("Profil de démonstration indisponible.")
    if (!person.published) {
      if (!person.consentsInForce.includes("social_profile")) await client.mutation(ref("modules/people/consents:recordConsent"),{purpose:"social_profile",origin:"onboarding"})
      await client.mutation(ref("modules/people/preferences:setMyPreferences"),{locale:"fr",timeZone:"Africa/Libreville"})
      await client.mutation(ref("modules/people/profile:publishMyProfile"),account.profile)
    } else if (person.handle!==account.profile.handle) {
      throw new Error("Le compte fictif a changé d’identifiant ; profil conservé.")
    }
    const state=await client.mutation(ref("modules/platform/demoAccounts:equipMyDemoAccount"),{actor:account.actor})
    report.push({actor:account.actor,handle:account.profile.handle,status:state.status,role:state.role})
    log(`Compte démo prêt : ${account.actor} (${state.status})`)
  }
  return {target,accounts:report,newcomerPreserved:true}
}
if (process.argv[1]===fileURLToPath(import.meta.url)) {
  const target=process.argv[process.argv.indexOf("--target")+1]
  prepareDemoAccounts(target,{apply:process.argv.includes("--apply")}).then(report=>console.log(JSON.stringify(report,null,2))).catch(error=>{console.error(error.message);process.exitCode=1})
}
