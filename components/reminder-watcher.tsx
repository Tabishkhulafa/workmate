'use client';
import {useEffect} from 'react';
import {deriveReminders,type ReminderSchedule} from '@/lib/reminders/schedule';
export const WM_REMINDERS_ENABLED='wm-reminders-foreground-enabled';
export default function ReminderWatcher(){
 useEffect(()=>{
  let active=true;let payload:ReminderSchedule|null=null;let lastFetch=0;
  async function fetchSchedule(){
   if(localStorage.getItem(WM_REMINDERS_ENABLED)!=='yes')return;
   lastFetch=Date.now();
   try{const res=await fetch('/api/reminders/schedule',{cache:'no-store'});if(!res.ok) return;payload=await res.json() as ReminderSchedule;}catch{/* offline */}
  }
  async function tick(){
   if(!active||document.visibilityState!=='visible'||localStorage.getItem(WM_REMINDERS_ENABLED)!=='yes'||Notification.permission!=='granted')return;
   if(!payload||Date.now()-lastFetch>180000)await fetchSchedule();if(!payload)return;
   const now=Date.now();
   for(const reminder of deriveReminders(payload)){
    if(now<reminder.when||now-reminder.when>70000)continue;
    const key=`wm-reminder-${payload.date}-${reminder.id}`;
    if(localStorage.getItem(key)==='sent')continue;
    try{
     const registration=await navigator.serviceWorker.ready;
     await registration.showNotification('Work Mate',{body:reminder.label,icon:'/workmate-icon.svg',tag:key});
     localStorage.setItem(key,'sent');
    }catch{/* Notification may not be supported in browser-only Safari */}
   }
  }
  void fetchSchedule().then(tick);
  const id=setInterval(()=>{void tick();},30000);
  const refresh=()=>{payload=null;void fetchSchedule().then(tick)};
  window.addEventListener('wm-reminder-settings-changed',refresh);
  window.addEventListener('focus',refresh);
  return()=>{active=false;clearInterval(id);window.removeEventListener('wm-reminder-settings-changed',refresh);window.removeEventListener('focus',refresh)};
 },[]);
 return null;
}
