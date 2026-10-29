import {NextResponse} from 'next/server';
import {createClient} from '@supabase/supabase-js';
import webPush from 'web-push';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=60;
type WorkmatePush={id:string;recipient_id:string;title:string;body:string;href:string};
type Device={id:string;endpoint:string;p256dh:string;auth_key:string};
const cacheHeaders={'Cache-Control':'no-store'};
function safeEqual(a:string,b:string){
 if(!a||!b||a.length!==b.length)return false;
 let match=0;for(let i=0;i<a.length;i++)match|=a.charCodeAt(i)^b.charCodeAt(i);
 return match===0;
}
export async function POST(request:Request){
 const expected=process.env.WORKMATE_PUSH_DISPATCH_SECRET||'';
 const provided=request.headers.get('authorization')?.replace(/^Bearer /i,'')||'';
 if(!expected||!safeEqual(expected,provided))return NextResponse.json({error:'Unauthorized'},{status:401,headers:cacheHeaders});
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,service=process.env.SUPABASE_SERVICE_ROLE_KEY;
 const pub=process.env.NEXT_PUBLIC_WORKMATE_VAPID_PUBLIC_KEY,priv=process.env.WORKMATE_VAPID_PRIVATE_KEY,subject=process.env.WORKMATE_VAPID_SUBJECT;
 if(!url||!service||!pub||!priv||!subject)return NextResponse.json({error:'Push backend not configured'},{status:503,headers:cacheHeaders});
 try{
  webPush.setVapidDetails(subject,pub,priv);
  const db=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data,error}=await db.rpc('workmate_claim_push_notifications',{p_limit:25});
  if(error)throw Error('Claim failed: '+error.code);
  const batch=(data||[]) as WorkmatePush[];
  let delivered=0,retry=0,removed=0;
  for(const item of batch){
   const {data:devices,error:subErr}=await db.from('workmate_push_subscriptions').select('id,endpoint,p256dh,auth_key').eq('user_id',item.recipient_id);
   if(subErr){retry++;continue;}
   let shouldRetry=false;
   const payload=JSON.stringify({title:'Work Mate',body:item.body,href:item.href,id:item.id});
   for(const sub of (devices||[]) as Device[]){
    try{
     await webPush.sendNotification({endpoint:sub.endpoint,keys:{p256dh:sub.p256dh,auth:sub.auth_key}},payload,{TTL:3600,urgency:'high'});
     delivered++;
    }catch(err){
     const status=(err as {statusCode?:number})?.statusCode;
     if(status===404||status===410){await db.from('workmate_push_subscriptions').delete().eq('id',sub.id);removed++;}
     else shouldRetry=true;
    }
   }
   if(shouldRetry){retry++;continue;}
   const {error:markError}=await db.from('workmate_notifications').update({push_sent_at:new Date().toISOString()}).eq('id',item.id);
   if(markError)retry++;
  }
  return NextResponse.json({success:true,claimed:batch.length,delivered,retry,invalid_subscriptions_removed:removed},{headers:cacheHeaders});
 }catch(e){console.error('Work Mate push dispatch',e instanceof Error?e.message:'Unknown error');return NextResponse.json({error:'Push dispatch failed'},{status:500,headers:cacheHeaders});}
}
