import { BRAND_NAME } from "@antsia/social-contracts/brand"
import fr from "@/i18n/locales/fr/antsia.json"
import en from "@/i18n/locales/en/antsia.json"
import { routes } from "@/lib/routes"

export function GET() {
  const configuration = JSON.stringify({ title: BRAND_NAME, messages: { fr: fr.personal.pushBody, en: en.personal.pushBody }, path: routes.personalControls() })
  const script = `const config=${configuration};
self.addEventListener('push',event=>{event.waitUntil((async()=>{
 let payload;try{payload=event.data?.json()}catch{return}
 if(!payload||typeof payload!=='object')return;
 const locale=payload.locale==='en'?'en':'fr';
 await self.registration.showNotification(config.title,{body:config.messages[locale],tag:'antsia-notification',data:{path:config.path}});
})())});
self.addEventListener('notificationclick',event=>{event.notification.close();event.waitUntil((async()=>{
 const destination=new URL(config.path,self.registration.scope);
 if(destination.origin!==new URL(self.registration.scope).origin)return;
 const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
 for(const client of windows){if(new URL(client.url).origin===destination.origin){await client.navigate(destination.href);await client.focus();return}}
 await self.clients.openWindow(destination.href);
})())});`
  return new Response(script, { headers: { "Content-Type": "application/javascript; charset=utf-8", "Cache-Control": "no-store", "Service-Worker-Allowed": routes.home() } })
}
