/** Les seules adresses du worker proviennent de la table des routes de l'application. */
export interface NotificationWorkerConfiguration {
  title: string
  messages: { fr: string; en: string }
  openPath: string
  fallbackPath: string
  referenceParam: string
}

/** Worker autonome : aucun contenu privé, adresse de payload ou action de réponse automatique. */
export function notificationWorkerScript(configuration: NotificationWorkerConfiguration): string {
  return `const config=${JSON.stringify(configuration)};
const referenceOf=value=>typeof value==='string'&&value.length>0&&value.length<=64&&!/[^a-zA-Z0-9_-]/.test(value)?value:null;
self.addEventListener('push',event=>{event.waitUntil((async()=>{
 let payload;try{payload=event.data?.json()}catch{return}
 if(!payload||typeof payload!=='object'||Array.isArray(payload))return;
 if(Object.keys(payload).sort().join('|')!=='count|locale|networkId|reference|url|version')return;
 const reference=referenceOf(payload.reference);
 if(payload.version!==1||!reference||typeof payload.networkId!=='string'||typeof payload.url!=='string')return;
 if(!Number.isInteger(payload.count)||payload.count<1||payload.count>100||(payload.locale!=='fr'&&payload.locale!=='en'))return;
 await self.registration.showNotification(config.title,{body:config.messages[payload.locale],tag:'antsia-notification-'+reference,data:{reference}});
})())});
self.addEventListener('notificationclick',event=>{event.notification.close();event.waitUntil((async()=>{
 const reference=referenceOf(event.notification.data?.reference);
 const destination=new URL(reference?config.openPath:config.fallbackPath,self.registration.scope);
 if(destination.origin!==new URL(self.registration.scope).origin)return;
 if(reference)destination.searchParams.set(config.referenceParam,reference);
 const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
 for(const client of windows){
  try{
   if(new URL(client.url).origin!==destination.origin)continue;
   const moved=await client.navigate(destination.href);
   if(!moved)continue;
   await moved.focus();return;
  }catch{continue}
 }
 await self.clients.openWindow(destination.href);
})())});`
}
