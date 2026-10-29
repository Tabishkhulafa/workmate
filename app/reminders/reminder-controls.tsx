'use client';
import {useEffect,useState} from 'react';
import {deriveReminders,type ReminderSchedule} from '@/lib/reminders/schedule';
import {WM_REMINDERS_ENABLED} from '@/components/reminder-watcher';
export default function ReminderControls(){
 const [data,setData]=useState<ReminderSchedule|null>(null),[error,setError]=useState('');
 const [enabled,setEnabled]=useState(false),[supported,setSupported]=useState(false);
 useEffect(()=>{setSupported(typeof Notification!=='undefined'&&'serviceWorker'in navigator);setEnabled(localStorage.getItem(WM_REMINDERS_ENABLED)==='yes'&&typeof Notification!=='undefined'&&Notification.permission==='granted');void(async()=>{try{const res=await fetch('/api/reminders/schedule',{cache:'no-store'});const body=await res.json() as ReminderSchedule;if(!res.ok||!body.success)throw Error(body.error||'Schedule unavailable');setData(body);}catch(e){setError(e instanceof Error?e.message:'Unable to fetch shift')}})()},[]);
 async function enable(){
  try{
   if(!supported)throw Error('This browser does not support PWA notification permissions.');
   const permission=await Notification.requestPermission();
   if(permission!=='granted')throw Error('Please allow notifications in your browser settings.');
   await navigator.serviceWorker.register('/workmate-sw.js');
   localStorage.setItem(WM_REMINDERS_ENABLED,'yes');setEnabled(true);
   window.dispatchEvent(new Event('wm-reminder-settings-changed'));
   setError('');
  }catch(e){setError(e instanceof Error?e.message:'Cannot enable reminders')}
 }
 function disable(){localStorage.removeItem(WM_REMINDERS_ENABLED);setEnabled(false);window.dispatchEvent(new Event('wm-reminder-settings-changed'))}
 async function testReminder(){
  try{
   if(!supported || Notification.permission!=='granted')throw Error('Enable notifications first, then try again.');
   const registration=await navigator.serviceWorker.register('/workmate-sw.js');
   await registration.showNotification('Work Mate',{body:'Test successful — attendance reminders are enabled while Work Mate is open and visible.',icon:'/workmate-icon.svg',tag:'wm-attendance-reminder-test'});
   setError('');
  }catch(e){setError(e instanceof Error?e.message:'Test notification could not be shown')}
 }
 const reminders=data?deriveReminders(data):[];
 return <div className="card" style={{maxWidth:850,display:'grid',gap:16,padding:24}}><h2>Browser reminders {enabled?'enabled':'off'}</h2><p className="muted">These alerts run only while Work Mate is open and active. Closing Safari or Chrome can stop them. Background push is not yet enabled; install Work Mate to your Home Screen on iPhone for future push support.</p>
 <div style={{display:'flex',gap:12,flexWrap:'wrap'}}><button type="button" disabled={!supported||enabled} onClick={()=>void enable()}>Enable reminders</button><button type="button" className="secondary" disabled={!enabled} onClick={disable}>Turn off</button><button type="button" className="secondary" disabled={!enabled} onClick={()=>void testReminder()}>Send test notification</button></div>
 {error&&<div role="alert" className="notice error">{error}</div>}
 {data?.schedule?<><p><strong>Shift:</strong> {data.schedule.start_time} – {data.schedule.end_time} (IST) · {data.date}</p><div className="tablewrap"><table><thead><tr><th>Alert</th><th>IST</th></tr></thead><tbody>{reminders.map(x=><tr key={x.id}><td>{x.label}</td><td>{new Intl.DateTimeFormat('en-IN',{timeZone:'Asia/Kolkata',timeStyle:'short'}).format(new Date(x.when))}</td></tr>)}</tbody></table></div>{reminders.length===0&&<p className="muted">No further reminders needed for your recorded punches.</p>}</>:<p className="muted">No effective shift schedule loaded for today.</p>}
 </div>;
}
