/* Work Mate notification worker — no content caching or credential handling. */
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(clients.openWindow('/mobile-attendance'));
});
// Reserved for future authenticated Web Push delivery; not used by foreground reminders.
self.addEventListener('push', event => {
  if(!event.data)return;
  let data;try{data=event.data.json()}catch{return;}
  if(!data || data.title!=='Work Mate' || typeof data.body!=='string')return;
  event.waitUntil(self.registration.showNotification('Work Mate',{body:data.body,icon:'/workmate-icon.svg'}));
});
