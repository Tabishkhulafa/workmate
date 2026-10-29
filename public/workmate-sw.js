/* Work Mate service worker: no caching of credentials, faces, or user data. */
self.addEventListener('push',event=>{
 if(!event.data)return;
 let data;try{data=event.data.json()}catch{return;}
 if(!data||data.title!=='Work Mate'||typeof data.body!=='string')return;
 const href=typeof data.href==='string'&&data.href.startsWith('/')&&!data.href.startsWith('//')?data.href:'/dashboard';
 event.waitUntil(self.registration.showNotification('Work Mate',{
  body:data.body.slice(0,180),icon:'/workmate-icon.svg',badge:'/workmate-icon.svg',
  tag:typeof data.id==='string'?`wm-${data.id}`:'workmate-notification',
  data:{href},
 }));
});
self.addEventListener('notificationclick',event=>{
 event.notification.close();
 const href=event.notification.data?.href;
 const target=typeof href==='string'&&href.startsWith('/')&&!href.startsWith('//')?href:'/dashboard';
 event.waitUntil((async()=>{
  const windows=await clients.matchAll({type:'window',includeUncontrolled:true});
  for(const win of windows){
   const u=new URL(win.url);
   if(u.origin===self.location.origin&&'focus'in win){await win.focus();if('navigate'in win)await win.navigate(target);return;}
  }
  await clients.openWindow(target);
 })());
});
