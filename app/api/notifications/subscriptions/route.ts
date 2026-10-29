import {NextResponse} from 'next/server';
import {supabaseServer} from '@/lib/supabase/server';
export const dynamic='force-dynamic';
const noStore={'Cache-Control':'private, no-store'};
const allowedHost=(host:string)=>['fcm.googleapis.com','fcm-xm.googleapis.com','updates.push.services.mozilla.com','web.push.apple.com'].includes(host)||host.endsWith('.push.apple.com')||host.endsWith('.notify.windows.com')||host.endsWith('.wns.windows.com');
function validEndpoint(value:string){try{const u=new URL(value);return u.protocol==='https:'&&u.username===''&&u.password===''&&allowedHost(u.hostname.toLowerCase())&&value.length<=2500;}catch{return false;}}
async function auth(){
 const db=await supabaseServer();const {data:{user}}=await db.auth.getUser();
 if(!user)return {db,user:null};
 const {data:profile}=await db.from('profiles').select('is_active,must_change_password').eq('id',user.id).maybeSingle();
 return {db,user:profile?.is_active&&!profile.must_change_password?user:null};
}
export async function POST(req:Request){
 try{
  const {db,user}=await auth();if(!user)return NextResponse.json({error:'Sign in required'},{status:401,headers:noStore});
  const json=await req.json().catch(()=>null);const endpoint=json?.endpoint,keys=json?.keys;
  if(typeof endpoint!=='string'||!validEndpoint(endpoint)||typeof keys?.p256dh!=='string'||typeof keys?.auth!=='string'||
      !/^[A-Za-z0-9_-]{20,300}$/.test(keys.p256dh)||!/^[A-Za-z0-9_-]{10,200}$/.test(keys.auth))
    return NextResponse.json({error:'Invalid browser push subscription'},{status:400,headers:noStore});
  const {data:existing,error:lookupError}=await db.from('workmate_push_subscriptions').select('id').eq('endpoint',endpoint).maybeSingle();
  if(lookupError)return NextResponse.json({error:'Subscriptions are not configured'},{status:503,headers:noStore});
  const result=existing?await db.from('workmate_push_subscriptions').update({p256dh:keys.p256dh,auth_key:keys.auth,updated_at:new Date().toISOString()}).eq('id',existing.id):
    await db.from('workmate_push_subscriptions').insert({user_id:user.id,endpoint,p256dh:keys.p256dh,auth_key:keys.auth});
  if(result.error)return NextResponse.json({error:'Cannot save this device subscription'},{status:409,headers:noStore});
  return NextResponse.json({success:true},{headers:noStore});
 }catch{return NextResponse.json({error:'Push enrollment failed'},{status:500,headers:noStore});}
}
export async function DELETE(req:Request){
 try{
  const {db,user}=await auth();if(!user)return NextResponse.json({error:'Sign in required'},{status:401,headers:noStore});
  const json=await req.json().catch(()=>null);const endpoint=json?.endpoint;
  if(typeof endpoint!=='string'||!validEndpoint(endpoint))return NextResponse.json({error:'Invalid endpoint'},{status:400,headers:noStore});
  const {error}=await db.from('workmate_push_subscriptions').delete().eq('endpoint',endpoint).eq('user_id',user.id);
  if(error)return NextResponse.json({error:'Cannot remove subscription'},{status:503,headers:noStore});
  return NextResponse.json({success:true},{headers:noStore});
 }catch{return NextResponse.json({error:'Push unsubscribe failed'},{status:500,headers:noStore});}
}
