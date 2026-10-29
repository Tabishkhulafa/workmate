import {NextResponse} from 'next/server';
import {createClient} from '@supabase/supabase-js';
import webPush from 'web-push';
import {supabaseServer} from '@/lib/supabase/server';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function POST(){
 const client=await supabaseServer();
 const {data:{user}}=await client.auth.getUser();
 if(!user)return NextResponse.json({error:'Login required'},{status:401});
 const {data:profile}=await client.from('profiles').select('is_active,must_change_password').eq('id',user.id).maybeSingle();
 if(!profile?.is_active||profile.must_change_password)return NextResponse.json({error:'Not permitted'},{status:403});
 const pub=process.env.NEXT_PUBLIC_WORKMATE_VAPID_PUBLIC_KEY;
 const priv=process.env.WORKMATE_VAPID_PRIVATE_KEY;
 const subject=process.env.WORKMATE_VAPID_SUBJECT;
 const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!pub||!priv||!subject||!key||!process.env.NEXT_PUBLIC_SUPABASE_URL)return NextResponse.json({error:'Push backend not configured'},{status:503});
 try{
  webPush.setVapidDetails(subject,pub,priv);
  const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,key,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:subs,error}=await db.from('workmate_push_subscriptions').select('id,endpoint,p256dh,auth_key').eq('user_id',user.id).limit(5);
  if(error)throw Error('Could not read subscriptions');
  let sent=0;
  for(const sub of subs||[]){
   try{
    await webPush.sendNotification({endpoint:sub.endpoint,keys:{p256dh:sub.p256dh,auth:sub.auth_key}},JSON.stringify({title:'Work Mate',body:'Test notification: device push is working.',href:'/dashboard',id:'test-'+Date.now()}),{TTL:120});
    sent++;
   }catch(e){const status=(e as {statusCode?:number}).statusCode;if(status===404||status===410)await db.from('workmate_push_subscriptions').delete().eq('id',sub.id);}
  }
  return NextResponse.json({success:sent>0,sent});
 }catch{return NextResponse.json({error:'Could not send test push'},{status:500});}
}
